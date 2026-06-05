// timetable-service.js - 时刻表生成服务
// 基于计算后的 duration 数据和列车实时位置生成精确时刻表
// 优先使用实际收集的区间用时数据，回退到计算数据
// 实现区间用时共享机制：当收集到某一线路特定区间的运行用时数据后，
// 自动将该数据应用于该线路所有列车在相同区间的时刻表推算中
// 时间分割点：北京时间早上8:00作为当日与第二日的时刻分割点

const fs = require('fs');
const path = require('path');
const eventBus = require('./event-bus');
const durationCalculator = require('./duration-calculator');
const segmentDurationCollector = require('./segment-duration-collector');
const { config, getBeijingTime, getDayBoundary, getCurrentPeriodStart, isInCurrentPeriod, getPeriodDescription } = require('./timetable-config');

const LINES_FILE = path.join(__dirname, '..', 'data', 'lines.json');
const STRINGS_FILE = path.join(__dirname, '..', 'strings.json');
const TRAINS_INFO_FILE = path.join(__dirname, '..', 'data', 'trains_info.json');

let linesData = null;
let stringsData = null;
let trainsInfoData = null; // 列车静态信息（线路、型号等）
let currentTrains = []; // 当前活跃的列车

// 列车上次位置记录（用于方向推断）
const trainPrevPositions = new Map(); // trainName -> { segmentIndex, timestamp }

// 站点停留时间（秒）
const DWELL_TIME = config.dwellTime.default;

// 列车完整时刻表缓存（每辆车直到时间分割点的到站时刻）
const trainSchedules = new Map(); // trainName -> schedule object

// 线路时刻表重算防抖
const pendingLineRecalcs = new Map(); // lineId -> timer handle
const RECALC_DEBOUNCE_MS = config.schedule.recalcDebounceMs;

// 日志函数
function log(level, message, data = null) {
    if (!config.logging.enabled) return;
    
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(config.logging.level);
    const messageLevel = levels.indexOf(level);
    
    if (messageLevel >= configLevel) {
        const timestamp = new Date().toISOString();
        const logMessage = `[TimetableService] [${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        if (data) {
            console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](logMessage, data);
        } else {
            console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](logMessage);
        }
    }
}

// 加载数据
function loadData() {
    try {
        const linesRaw = fs.readFileSync(LINES_FILE, 'utf8');
        linesData = JSON.parse(linesRaw).lines;
        
        if (fs.existsSync(STRINGS_FILE)) {
            const stringsRaw = fs.readFileSync(STRINGS_FILE, 'utf8');
            stringsData = JSON.parse(stringsRaw);
        }
        
        if (fs.existsSync(TRAINS_INFO_FILE)) {
            const trainsInfoRaw = fs.readFileSync(TRAINS_INFO_FILE, 'utf8');
            trainsInfoData = JSON.parse(trainsInfoRaw).trains;
            console.log(`[TimetableService] 加载了 ${trainsInfoData.length} 条列车静态信息`);
        }
        
        console.log('[TimetableService] 数据加载成功');
    } catch (error) {
        console.error('[TimetableService] 数据加载失败:', error.message);
    }
}

// 根据列车名称获取静态信息（线路、型号）
function getTrainStaticInfo(trainName) {
    if (!trainsInfoData) return null;
    return trainsInfoData.find(t => t.name === trainName) || null;
}

// 计算两点之间的距离
function distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dz = (p1.z || 0) - (p2.z || 0);
    return Math.sqrt(dx * dx + dz * dz);
}

// 计算轨道段的总长度
function calculateTrackLength(nodes) {
    let totalLength = 0;
    for (let i = 0; i < nodes.length - 1; i++) {
        totalLength += distance(nodes[i], nodes[i + 1]);
    }
    return totalLength;
}

// 找到列车所在的线路和位置，并推断行驶方向
function findTrainPosition(train) {
    if (!linesData || !train.cars || !train.cars[0]) return null;
    
    const position = train.cars[0].leading.location;
    
    // 优先从 trains_info.json 获取列车所属线路
    const staticInfo = getTrainStaticInfo(train.name);
    let preferredLineId = staticInfo ? staticInfo.line : null;
    
    // 如果 trains_info.json 中有指定线路，严格使用该线路，不回退
    if (preferredLineId) {
        const line = linesData.find(l => l.id === preferredLineId);
        if (line) {
            const result = findTrainOnLine(train, line, position);
            if (result) return result;
        }
        return null; // trains_info.json 中有定义但未在该线路上找到，不回退
    }
    
    // 仅对 trains_info.json 中未定义的列车，在所有线路上查找
    for (const line of linesData) {
        const result = findTrainOnLine(train, line, position);
        if (result) return result;
    }
    
    return null;
}

// 在指定线路上查找列车位置
function findTrainOnLine(train, line, position) {
    for (let i = 0; i < line.route.length; i++) {
        const segment = line.route[i];
        if (segment.type !== 'track') continue;
        
        const nodes = segment.nodes;
        for (let j = 0; j < nodes.length - 1; j++) {
            const dist = distanceToSegment(position, nodes[j], nodes[j + 1]);
            if (dist < 50) {
                const progress = calculateProgress(position, segment);
                
                // 推断方向：比较当前 segmentIndex 与上次记录
                let direction = 'unknown';
                const prev = trainPrevPositions.get(train.name);
                if (prev) {
                    if (i > prev.segmentIndex) {
                        direction = 'forward';
                    } else if (i < prev.segmentIndex) {
                        direction = 'backward';
                    } else {
                        direction = prev.lastDirection || 'unknown';
                    }
                }
                
                trainPrevPositions.set(train.name, {
                    segmentIndex: i,
                    timestamp: Date.now(),
                    lastDirection: direction
                });
                
                return {
                    lineId: line.id,
                    segmentIndex: i,
                    progress,
                    position,
                    direction
                };
            }
        }
    }
    return null;
}

// 计算点到线段的距离
function distanceToSegment(point, p1, p2) {
    const x = point.x;
    const z = point.z || 0;
    const x1 = p1.x, z1 = p1.z || 0;
    const x2 = p2.x, z2 = p2.z || 0;
    
    const dx = x2 - x1;
    const dz = z2 - z1;
    const lengthSquared = dx * dx + dz * dz;
    
    if (lengthSquared === 0) return distance(point, p1);
    
    let t = ((x - x1) * dx + (z - z1) * dz) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    
    const projX = x1 + t * dx;
    const projZ = z1 + t * dz;
    
    return distance(point, { x: projX, z: projZ });
}

// 计算列车在轨道段上的进度
function calculateProgress(position, segment) {
    const nodes = segment.nodes;
    const totalLength = calculateTrackLength(nodes);
    
    let traveledLength = 0;
    let minDist = Infinity;
    let closestNodeIndex = 0;
    
    for (let i = 0; i < nodes.length; i++) {
        const dist = distance(position, nodes[i]);
        if (dist < minDist) {
            minDist = dist;
            closestNodeIndex = i;
        }
    }
    
    for (let i = 0; i < closestNodeIndex; i++) {
        traveledLength += distance(nodes[i], nodes[i + 1]);
    }
    
    if (closestNodeIndex < nodes.length - 1) {
        const projDist = distanceToSegment(
            position,
            nodes[closestNodeIndex],
            nodes[closestNodeIndex + 1]
        );
        traveledLength += projDist;
    }
    
    return Math.min(1, traveledLength / totalLength);
}

// 获取站点名称
function getStationName(code, lang = 'zh_hans') {
    if (stringsData && stringsData.station_names && stringsData.station_names[code]) {
        return stringsData.station_names[code][lang] || stringsData.station_names[code].zh_hans || code;
    }
    return code;
}

// 获取最佳区间用时（优先使用实际数据，回退到计算数据）
function getBestSegmentDuration(lineId, segmentIndex, direction = 1) {
    // 首先尝试从收集器获取实际数据
    const actualData = segmentDurationCollector.getSegmentDuration(lineId, segmentIndex, direction);
    if (actualData && actualData.isActual) {
        return actualData.duration;
    }
    
    // 回退到计算数据
    const calculatedData = durationCalculator.getSegmentDuration(lineId, segmentIndex);
    if (calculatedData) {
        return calculatedData.duration;
    }
    
    // 最后使用线路配置中的默认值
    const line = linesData.find(l => l.id === lineId);
    if (line && segmentIndex < line.route.length) {
        const segment = line.route[segmentIndex];
        return segment.duration || 0;
    }
    
    return 0;
}

// 获取站点停留时间（优先使用实际数据，回退到默认值）
function getBestDwellTime(lineId, stationCode, direction = 1) {
    const actualData = segmentDurationCollector.getStationDwellTime(lineId, stationCode, direction);
    if (actualData && actualData.isActual) {
        return actualData.dwellTime;
    }
    return DWELL_TIME;
}

// 为单辆列车推算从当前位置到时间分割点的完整时刻表
// 对于运行途中的列车，从当前位置开始连续记录后续所有站点信息，直至时间超出当日范围
// 列车到达终点站后会折返，继续记录时刻表
function generateFullSchedule(train, line, trainPosition) {
    const now = Date.now();
    const endTime = getDayBoundary().getTime();

    // 如果已过时间分割点则不推算
    if (now >= endTime) return null;

    const staticInfo = getTrainStaticInfo(train.name);
    const trainSeries = (staticInfo && staticInfo.series) || train.series || '未知型号';

    const lineId = trainPosition.lineId;
    const segIdx = trainPosition.segmentIndex;
    const progress = trainPosition.progress;
    const direction = trainPosition.direction;

    if (direction === 'unknown') return null;

    const isForward = direction === 'forward';
    const lang = 'zh_hans';

    const stops = [];
    let accumulatedSeconds = 0;
    let currentDirection = isForward;
    let currentSegIdx = segIdx;
    let currentProgress = progress;
    let maxIterations = 1000; // 防止无限循环

    // 计算当前轨道段剩余用时
    const dir = currentDirection ? 1 : -1;
    const trackDuration = getBestSegmentDuration(lineId, currentSegIdx, dir);
    if (currentDirection) {
        accumulatedSeconds += trackDuration * (1 - currentProgress);
    } else {
        accumulatedSeconds += trackDuration * currentProgress;
    }

    // 移动到下一个轨道段或站点
    if (currentDirection) {
        currentSegIdx++;
    } else {
        currentSegIdx--;
    }

    // 循环遍历，支持列车折返
    while (maxIterations-- > 0) {
        // 检查是否超出时间分割点
        const currentTime = now + accumulatedSeconds * 1000;
        if (currentTime >= endTime) break;

        // 检查是否超出线路范围
        if (currentSegIdx < 0 || currentSegIdx >= line.route.length) {
            // 列车到达终点站，需要折返
            if (currentDirection) {
                // 正向到达终点，改为反向
                currentDirection = false;
                currentSegIdx = line.route.length - 2; // 从倒数第二个轨道段开始
            } else {
                // 反向到达起点，改为正向
                currentDirection = true;
                currentSegIdx = 1; // 从第二个轨道段开始
            }
            continue;
        }

        const segment = line.route[currentSegIdx];
        const dir = currentDirection ? 1 : -1;

        if (segment.type === 'station') {
            const arrivalTime = now + accumulatedSeconds * 1000;
            const dwellTime = getBestDwellTime(lineId, segment.code, dir);
            const isTerminal = (currentSegIdx === 0 || currentSegIdx === line.route.length - 1);

            stops.push({
                stationCode: segment.code,
                stationName: getStationName(segment.code, lang),
                arrivalTime: new Date(arrivalTime).toISOString(),
                departureTime: new Date(now + (accumulatedSeconds + dwellTime) * 1000).toISOString(),
                isTerminal,
                direction: currentDirection ? 'forward' : 'backward'
            });

            accumulatedSeconds += dwellTime;
        } else if (segment.type === 'track') {
            accumulatedSeconds += getBestSegmentDuration(lineId, currentSegIdx, dir);
        }

        // 移动到下一个轨道段
        if (currentDirection) {
            currentSegIdx++;
        } else {
            currentSegIdx--;
        }
    }

    if (stops.length === 0) return null;

    // 记录日志
    if (config.logging.logScheduleGeneration) {
        log('info', `生成列车时刻表: ${train.name}`, {
            lineId,
            direction: isForward ? 'forward' : 'backward',
            stopsCount: stops.length,
            period: getPeriodDescription()
        });
    }

    return {
        trainName: train.name,
        trainSeries,
        lineId,
        lineName: line.name ? line.name[lang] || line.name.zh_hans : lineId,
        direction: isForward ? 'forward' : 'backward',
        directionLabel: isForward
            ? (getStationName(line.route[0]?.code, lang) + ' → ' + getStationName(line.route[line.route.length - 1]?.code, lang))
            : (getStationName(line.route[line.route.length - 1]?.code, lang) + ' → ' + getStationName(line.route[0]?.code, lang)),
        currentSegmentIndex: segIdx,
        currentProgress: progress,
        stops,
        lastUpdated: new Date(now).toISOString(),
        periodStart: getCurrentPeriodStart().toISOString(),
        periodEnd: getDayBoundary().toISOString()
    };
}

// 重新推算指定线路所有活跃列车的完整时刻表
function recalculateLineTimetables(lineId) {
    if (!linesData) return;

    const line = linesData.find(l => l.id === lineId);
    if (!line) return;

    let updatedCount = 0;
    for (const train of currentTrains) {
        const trainPosition = findTrainPosition(train);
        if (!trainPosition || trainPosition.lineId !== lineId) continue;

        const schedule = generateFullSchedule(train, line, trainPosition);
        if (schedule) {
            trainSchedules.set(train.name, schedule);
            updatedCount++;
        }
    }

    if (updatedCount > 0) {
        eventBus.publish('train-schedule-updated', {
            lineId,
            scheduleCount: updatedCount,
            trainNames: [...trainSchedules.entries()]
                .filter(([, s]) => s.lineId === lineId)
                .map(([name]) => name),
            timestamp: Date.now()
        });
        
        // 记录日志
        if (config.logging.logScheduleGeneration) {
            log('info', `线路 ${lineId} 时刻表重算完成`, {
                updatedCount,
                period: getPeriodDescription()
            });
        }
    }
}

// 防抖调度线路时刻表重算
function scheduleLineRecalc(lineId) {
    if (pendingLineRecalcs.has(lineId)) {
        clearTimeout(pendingLineRecalcs.get(lineId));
    }
    pendingLineRecalcs.set(lineId, setTimeout(() => {
        pendingLineRecalcs.delete(lineId);
        recalculateLineTimetables(lineId);
    }, RECALC_DEBOUNCE_MS));
}

// 计算到达时间（支持正向和反向）
function calculateArrivalTime(lineId, fromSegmentIndex, fromProgress, toSegmentIndex, lang) {
    const line = linesData.find(l => l.id === lineId);
    if (!line) return null;
    
    let totalDuration = 0;
    const isForward = fromSegmentIndex < toSegmentIndex;
    const dir = isForward ? 1 : -1;
    
    if (isForward) {
        // 正向：从 fromSegmentIndex 到 toSegmentIndex，索引递增
        // 当前轨道段剩余时间
        if (fromSegmentIndex < line.route.length) {
            const segmentDuration = getBestSegmentDuration(lineId, fromSegmentIndex, dir);
            const remainingProgress = 1 - fromProgress;
            totalDuration += segmentDuration * remainingProgress;
        }
        
        // 中间轨道段
        for (let i = fromSegmentIndex + 1; i < toSegmentIndex; i++) {
            const segment = line.route[i];
            if (segment.type === 'track') {
                totalDuration += getBestSegmentDuration(lineId, i, dir);
            } else if (segment.type === 'station') {
                totalDuration += getBestDwellTime(lineId, segment.code, dir);
            }
        }
        
        // 目标轨道段
        if (toSegmentIndex < line.route.length) {
            totalDuration += getBestSegmentDuration(lineId, toSegmentIndex, dir);
        }
    } else {
        // 反向：从 fromSegmentIndex 到 toSegmentIndex，索引递减
        // 当前轨道段剩余时间（反向：剩余 = fromProgress，从当前位置往回走）
        if (fromSegmentIndex < line.route.length) {
            const segmentDuration = getBestSegmentDuration(lineId, fromSegmentIndex, dir);
            totalDuration += segmentDuration * fromProgress;
        }
        
        // 中间轨道段（索引递减）
        for (let i = fromSegmentIndex - 1; i > toSegmentIndex; i--) {
            const segment = line.route[i];
            if (segment.type === 'track') {
                totalDuration += getBestSegmentDuration(lineId, i, dir);
            } else if (segment.type === 'station') {
                totalDuration += getBestDwellTime(lineId, segment.code, dir);
            }
        }
        
        // 目标轨道段
        if (toSegmentIndex >= 0 && toSegmentIndex < line.route.length) {
            totalDuration += getBestSegmentDuration(lineId, toSegmentIndex, dir);
        }
    }
    
    return totalDuration;
}

// 处理列车位置更新
function handleTrainPositionUpdate(payload) {
    currentTrains = payload.trains || [];

    // 每次位置更新时，为所有活跃列车重新推算完整时刻表
    if (!linesData || currentTrains.length === 0) return;

    let generatedCount = 0;
    for (const train of currentTrains) {
        const trainPosition = findTrainPosition(train);
        if (!trainPosition) continue;

        const line = linesData.find(l => l.id === trainPosition.lineId);
        if (!line) continue;

        const schedule = generateFullSchedule(train, line, trainPosition);
        if (schedule) {
            trainSchedules.set(train.name, schedule);
            generatedCount++;
        }
    }

    // 清理已不存在的列车的时刻表
    const activeNames = new Set(currentTrains.map(t => t.name));
    for (const name of trainSchedules.keys()) {
        if (!activeNames.has(name)) {
            trainSchedules.delete(name);
        }
    }

    // 记录日志
    if (config.logging.logScheduleGeneration && generatedCount > 0) {
        log('debug', `列车位置更新，重新推算时刻表`, {
            activeTrains: currentTrains.length,
            generatedSchedules: generatedCount,
            totalSchedules: trainSchedules.size
        });
    }
}

// 检查数据是否可用
function isDataAvailable() {
    return linesData !== null && currentTrains.length > 0;
}

// 生成最近班次信息
function getRecentTrips(startCode, endCode, lang = 'zh_hans') {
    if (!linesData) {
        return { trips: [], available: false, reason: 'lines_not_loaded' };
    }
    if (!currentTrains.length) {
        return { trips: [], available: false, reason: 'no_trains' };
    }
    
    const trips = [];
    const now = Date.now();
    
    for (const train of currentTrains) {
        const trainPosition = findTrainPosition(train);
        if (!trainPosition) continue;
        
        const staticInfo = getTrainStaticInfo(train.name);
        
        const line = linesData.find(l => l.id === trainPosition.lineId);
        if (!line) continue;
        
        const startIdx = line.route.findIndex(s => s.type === 'station' && s.code === startCode);
        const endIdx = line.route.findIndex(s => s.type === 'station' && s.code === endCode);
        
        if (startIdx === -1 || endIdx === -1) continue;
        
        // 根据列车方向确定站点顺序
        const trainSegIdx = trainPosition.segmentIndex;
        const trainDirection = trainPosition.direction;
        
        // 判断列车行进方向下的站点顺序是否合法
        let isForwardTrip = false; // true: startIdx < endIdx
        let trainPassedStart = false;
        
        if (trainDirection === 'forward') {
            // 列车向 route 末尾移动
            // 只接受 startIdx < endIdx（正向）且列车在起点之前或在起点轨道段
            if (startIdx >= endIdx) continue;
            if (trainSegIdx > startIdx) continue; // 列车已过起点
            isForwardTrip = true;
        } else if (trainDirection === 'backward') {
            // 列车向 route 开头移动
            // 只接受 startIdx > endIdx（反向）且列车在起点之前或在起点轨道段
            if (startIdx <= endIdx) continue;
            if (trainSegIdx < startIdx) continue; // 列车已过起点
            isForwardTrip = false;
        } else {
            // 方向未知时，尝试两种方向
            if (startIdx < endIdx) {
                // 正向：列车需在起点之前
                if (trainSegIdx > startIdx) continue;
                isForwardTrip = true;
            } else if (startIdx > endIdx) {
                // 反向：列车需在起点之前（索引更大）
                if (trainSegIdx < startIdx) continue;
                isForwardTrip = false;
            } else {
                continue; // startIdx === endIdx，同一站
            }
        }
        
        // 计算到达起点的时间
        let timeToStart = 0;
        if (trainSegIdx !== startIdx) {
            timeToStart = calculateArrivalTime(
                trainPosition.lineId,
                trainSegIdx,
                trainPosition.progress,
                startIdx,
                lang
            );
        } else {
            // 列车在起点所在的轨道段
            const segment = line.route[startIdx];
            if (segment.type === 'track') {
                const segDuration = getBestSegmentDuration(trainPosition.lineId, startIdx, isForwardTrip ? 1 : -1);
                timeToStart = segDuration * (1 - trainPosition.progress);
            }
        }
        
        // 计算从起点到终点的时间
        const timeFromStartToEnd = calculateArrivalTime(
            trainPosition.lineId,
            startIdx,
            0,
            endIdx,
            lang
        );
        
        if (timeToStart !== null && timeFromStartToEnd !== null) {
            const departureTime = now + timeToStart * 1000;
            const arrivalTime = departureTime + timeFromStartToEnd * 1000;
            
            const trainSeries = (staticInfo && staticInfo.series) || train.series || '未知型号';
            
            trips.push({
                trainName: train.name,
                trainSeries,
                lineId: trainPosition.lineId,
                lineName: line.name ? line.name[lang] || line.name.zh_hans : trainPosition.lineId,
                startStation: getStationName(startCode, lang),
                endStation: getStationName(endCode, lang),
                startCode,
                endCode,
                departureTime: new Date(departureTime).toISOString(),
                arrivalTime: new Date(arrivalTime).toISOString(),
                duration: Math.round(timeFromStartToEnd),
                status: train.stopped === 'true' ? 'stopped' : 'running',
                direction: isForwardTrip ? 'forward' : 'backward',
                directionLabel: isForwardTrip
                    ? (getStationName(line.route[0]?.code, lang) + ' → ' + getStationName(line.route[line.route.length - 1]?.code, lang))
                    : (getStationName(line.route[line.route.length - 1]?.code, lang) + ' → ' + getStationName(line.route[0]?.code, lang)),
                position: {
                    segmentIndex: trainPosition.segmentIndex,
                    progress: trainPosition.progress
                }
            });
        }
    }
    
    // 按出发时间排序
    trips.sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));
    
    return {
        trips: trips.slice(0, 20), // 返回最近20个班次
        available: true,
        timestamp: new Date().toISOString()
    };
}

// 获取导航用时信息
function getNavigationDuration(startCode, endCode, lang = 'zh_hans') {
    if (!linesData) {
        return { error: '线路数据未加载' };
    }
    
    const results = [];
    
    for (const line of linesData) {
        const startIdx = line.route.findIndex(s => s.type === 'station' && s.code === startCode);
        const endIdx = line.route.findIndex(s => s.type === 'station' && s.code === endCode);
        
        if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) continue;
        
        let totalDuration = 0;
        const segments = [];
        
        for (let i = startIdx; i < endIdx; i++) {
            const segment = line.route[i];
            
            if (segment.type === 'track') {
                const durationData = durationCalculator.getSegmentDuration(line.id, i);
                const duration = durationData ? durationData.duration : (segment.duration || 0);
                const isOriginal = durationData ? durationData.isOriginal : true;
                const confidence = durationData ? durationData.confidence : 0;
                
                totalDuration += duration;
                segments.push({
                    type: 'track',
                    fromStation: getStationName(line.route[i - 1]?.code, lang),
                    toStation: getStationName(line.route[i + 1]?.code, lang),
                    duration,
                    isOriginal,
                    confidence
                });
            } else if (segment.type === 'station') {
                const dwellTime = getBestDwellTime(line.id, segment.code, 1);
                totalDuration += dwellTime;
                segments.push({
                    type: 'station',
                    stationCode: segment.code,
                    stationName: getStationName(segment.code, lang),
                    duration: dwellTime
                });
            }
        }
        
        results.push({
            lineId: line.id,
            lineName: line.name ? line.name[lang] || line.name.zh_hans : line.id,
            startStation: getStationName(startCode, lang),
            endStation: getStationName(endCode, lang),
            totalDuration,
            segments,
            timestamp: new Date().toISOString()
        });
    }
    
    return results;
}

// 获取多段换乘路线的班次信息
// segments: [{ lineId, startCode, endCode }, ...]
// 返回每段的班次信息，后续段以上一段到达时间为基准查找
function getMultiSegmentTrips(segments, lang = 'zh_hans') {
    if (!linesData) {
        return { segments: [], available: false, reason: 'lines_not_loaded' };
    }
    if (!currentTrains.length) {
        return { segments: [], available: false, reason: 'no_trains' };
    }
    if (!segments || segments.length === 0) {
        return { segments: [], available: false, reason: 'no_segments' };
    }

    const now = Date.now();
    const result = [];
    let previousArrivalTime = null; // 上一段到达换乘站的时间
    let previousArrivalStation = null; // 上一段到达的换乘站

    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
        const seg = segments[segIdx];
        const { lineId, startCode, endCode } = seg;

        const line = linesData.find(l => l.id === lineId);
        if (!line) {
            result.push({
                lineId,
                startCode,
                endCode,
                trips: [],
                available: false,
                reason: 'line_not_found'
            });
            continue;
        }

        const startIdx = line.route.findIndex(s => s.type === 'station' && s.code === startCode);
        const endIdx = line.route.findIndex(s => s.type === 'station' && s.code === endCode);

        if (startIdx === -1 || endIdx === -1) {
            result.push({
                lineId,
                startCode,
                endCode,
                trips: [],
                available: false,
                reason: 'station_not_found'
            });
            continue;
        }

        const isForward = startIdx < endIdx;
        const dir = isForward ? 1 : -1;

        // 查找该段的可用列车
        const segTrips = [];

        for (const train of currentTrains) {
            const trainPosition = findTrainPosition(train);
            if (!trainPosition) continue;
            if (trainPosition.lineId !== lineId) continue;

            const staticInfo = getTrainStaticInfo(train.name);
            const trainSegIdx = trainPosition.segmentIndex;
            const trainDirection = trainPosition.direction;

            // 判断列车方向是否匹配本段
            if (isForward) {
                if (trainDirection === 'backward') continue;
                if (trainSegIdx > startIdx) continue; // 列车已过起点
            } else {
                if (trainDirection === 'forward') continue;
                if (trainSegIdx < startIdx) continue; // 列车已过起点
            }

            // 计算列车到达起点站的时间
            let timeToStart = 0;
            if (trainSegIdx !== startIdx) {
                timeToStart = calculateArrivalTime(lineId, trainSegIdx, trainPosition.progress, startIdx, lang);
            } else {
                const segment = line.route[startIdx];
                if (segment.type === 'track') {
                    const segDuration = getBestSegmentDuration(lineId, startIdx, dir);
                    timeToStart = segDuration * (1 - trainPosition.progress);
                }
            }

            if (timeToStart === null) continue;

            const departureTime = now + timeToStart * 1000;

            // 如果是换乘后的段，必须在上一段到达之后才能出发
            if (previousArrivalTime !== null && departureTime < previousArrivalTime) {
                continue;
            }

            // 计算从起点到终点的时间
            const timeFromStartToEnd = calculateArrivalTime(lineId, startIdx, 0, endIdx, lang);
            if (timeFromStartToEnd === null) continue;

            const arrivalTime = departureTime + timeFromStartToEnd * 1000;
            const trainSeries = (staticInfo && staticInfo.series) || train.series || '未知型号';

            segTrips.push({
                trainName: train.name,
                trainSeries,
                lineId,
                lineName: line.name ? line.name[lang] || line.name.zh_hans : lineId,
                startStation: getStationName(startCode, lang),
                endStation: getStationName(endCode, lang),
                startCode,
                endCode,
                departureTime: new Date(departureTime).toISOString(),
                arrivalTime: new Date(arrivalTime).toISOString(),
                duration: Math.round(timeFromStartToEnd),
                status: train.stopped === 'true' ? 'stopped' : 'running',
                direction: isForward ? 'forward' : 'backward',
                directionLabel: isForward
                    ? (getStationName(line.route[0]?.code, lang) + ' → ' + getStationName(line.route[line.route.length - 1]?.code, lang))
                    : (getStationName(line.route[line.route.length - 1]?.code, lang) + ' → ' + getStationName(line.route[0]?.code, lang)),
                position: {
                    segmentIndex: trainPosition.segmentIndex,
                    progress: trainPosition.progress
                }
            });
        }

        // 按出发时间排序，取前几个
        segTrips.sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));
        const topTrips = segTrips.slice(0, 15);

        if (topTrips.length > 0) {
            // 更新下一段的基准时间：取第一班车的到达时间
            previousArrivalTime = new Date(topTrips[0].arrivalTime).getTime();
            previousArrivalStation = endCode;
        } else {
            // 没有找到合适的班次
            previousArrivalTime = null;
        }

        result.push({
            lineId,
            lineName: line.name ? line.name[lang] || line.name.zh_hans : lineId,
            startCode,
            endCode,
            startStation: getStationName(startCode, lang),
            endStation: getStationName(endCode, lang),
            trips: topTrips,
            available: topTrips.length > 0,
            reason: topTrips.length > 0 ? null : 'no_matching_trips'
        });
    }

    // 计算总行程信息
    const firstSeg = result[0];
    const lastSeg = result[result.length - 1];
    const overallDeparture = firstSeg.trips.length > 0 ? firstSeg.trips[0].departureTime : null;
    const overallArrival = lastSeg.trips.length > 0 ? lastSeg.trips[0].arrivalTime : null;
    const allAvailable = result.every(s => s.available);

    return {
        segments: result,
        overallDeparture,
        overallArrival,
        allAvailable,
        available: allAvailable,
        timestamp: new Date().toISOString()
    };
}

// 初始化
function init() {
    loadData();
    
    // 订阅列车位置更新事件
    eventBus.subscribe('train-position-updated', handleTrainPositionUpdate);
    
    // 订阅区间用时更新事件 → 防抖重算受影响线路的时刻表
    // 实现区间用时共享机制：当收集到某一线路特定区间的运行用时数据后，
    // 自动将该数据应用于该线路所有列车在相同区间的时刻表推算中
    eventBus.subscribe('segment-duration-updated', (payload) => {
        scheduleLineRecalc(payload.lineId);
        
        // 记录日志
        if (config.logging.logDataUpdates) {
            log('info', `收到区间用时更新事件，触发线路 ${payload.lineId} 时刻表重算`, {
                segmentIndex: payload.segmentIndex,
                direction: payload.direction,
                duration: payload.duration,
                sampleCount: payload.sampleCount
            });
        }
    });
    
    // 订阅站点停留时间更新事件 → 防抖重算受影响线路的时刻表
    eventBus.subscribe('station-dwell-updated', (payload) => {
        scheduleLineRecalc(payload.lineId);
        
        // 记录日志
        if (config.logging.logDataUpdates) {
            log('info', `收到站点停留时间更新事件，触发线路 ${payload.lineId} 时刻表重算`, {
                stationCode: payload.stationCode,
                direction: payload.direction,
                dwellTime: payload.dwellTime,
                sampleCount: payload.sampleCount
            });
        }
    });
    
    // 定期重新生成时刻表（每分钟）
    setInterval(() => {
        if (currentTrains.length > 0) {
            eventBus.publish('timetable-generated', {
                trainCount: currentTrains.length,
                timestamp: Date.now()
            });
        }
    }, 60000);
    
    log('info', `时刻表服务初始化完成，时间分割点: ${getPeriodDescription()}`);
}

// 获取所有列车完整时刻表（可按线路筛选）
function getTrainSchedules(lineId) {
    if (lineId) {
        const result = [];
        for (const [name, schedule] of trainSchedules.entries()) {
            if (schedule.lineId === lineId) {
                result.push(schedule);
            }
        }
        return result;
    }
    return Array.from(trainSchedules.values());
}

// 获取单辆列车的完整时刻表
function getTrainSchedule(trainName) {
    return trainSchedules.get(trainName) || null;
}

// 基于推算时刻表获取从 startCode 到 endCode 的班次信息
// 返回匹配的班次以及每条线路+方向的第二辆车
function getScheduledTrips(startCode, endCode, lang = 'zh_hans') {
    if (!linesData || trainSchedules.size === 0) {
        return { trips: [], nextTrips: {}, available: false, reason: 'no_schedules' };
    }

    const trips = [];
    const now = Date.now();

    // 根据线路数据确定用户查询方向：正向（startCode 在 endCode 之前）或反向
    let routeForward = true;
    if (linesData) {
        for (const line of linesData) {
            const sIdx = line.route.findIndex(s => s.type === 'station' && s.code === startCode);
            const eIdx = line.route.findIndex(s => s.type === 'station' && s.code === endCode);
            if (sIdx !== -1 && eIdx !== -1) {
                routeForward = sIdx < eIdx;
                break;
            }
        }
    }

    for (const [, schedule] of trainSchedules.entries()) {
        const stopA = schedule.stops.find(s => s.stationCode === startCode);
        const stopB = schedule.stops.find(s => s.stationCode === endCode);

        if (!stopA || !stopB) continue;

        const idxA = schedule.stops.indexOf(stopA);
        const idxB = schedule.stops.indexOf(stopB);

        // 根据行程方向确定出发/到达站点
        let departureTime, arrivalTime;
        if (routeForward) {
            // 正向：startCode 在 endCode 之前
            if (idxA >= idxB) continue;
            departureTime = new Date(stopA.departureTime).getTime();
            arrivalTime = new Date(stopB.arrivalTime).getTime();
        } else {
            // 反向：startCode 在 endCode 之后
            if (idxB >= idxA) continue;
            departureTime = new Date(stopB.departureTime).getTime();
            arrivalTime = new Date(stopA.arrivalTime).getTime();
        }

        // 跳过出发时间已过的班次
        if (departureTime < now) continue;

        trips.push({
            trainName: schedule.trainName,
            trainSeries: schedule.trainSeries,
            lineId: schedule.lineId,
            lineName: schedule.lineName,
            startStation: stopA.stationName,
            endStation: stopB.stationName,
            startCode,
            endCode,
            departureTime: new Date(departureTime).toISOString(),
            arrivalTime: new Date(arrivalTime).toISOString(),
            duration: Math.round((arrivalTime - departureTime) / 1000),
            direction: schedule.direction,
            directionLabel: schedule.directionLabel,
            isScheduled: true
        });
    }

    // 按出发时间排序
    trips.sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));

    // 为每条线路+方向找到第二辆车
    const nextTrips = {};
    const lineDirectionGroups = new Map();
    for (const trip of trips) {
        const key = `${trip.lineId}:${trip.direction}`;
        if (!lineDirectionGroups.has(key)) {
            lineDirectionGroups.set(key, []);
        }
        lineDirectionGroups.get(key).push(trip);
    }

    for (const [key, group] of lineDirectionGroups.entries()) {
        if (group.length >= 2) {
            nextTrips[key] = {
                trainName: group[1].trainName,
                trainSeries: group[1].trainSeries,
                departureTime: group[1].departureTime,
                arrivalTime: group[1].arrivalTime
            };
        }
    }

    return {
        trips: trips.slice(0, 30),
        nextTrips,
        available: true,
        timestamp: new Date().toISOString()
    };
}

// 基于推算时刻表获取多段换乘班次信息
// 每段返回最近的列车，并附带第二辆列车的出发时刻
function getScheduledMultiSegmentTrips(segments, lang = 'zh_hans') {
    if (!linesData || trainSchedules.size === 0) {
        return { segments: [], available: false, reason: 'no_schedules' };
    }
    if (!segments || segments.length === 0) {
        return { segments: [], available: false, reason: 'no_segments' };
    }

    const now = Date.now();
    const result = [];
    let previousArrivalTime = null;

    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
        const seg = segments[segIdx];
        const { lineId, startCode, endCode } = seg;

        const line = linesData.find(l => l.id === lineId);
        if (!line) {
            result.push({
                lineId, startCode, endCode,
                trips: [], nextTrip: null,
                available: false, reason: 'line_not_found'
            });
            continue;
        }

        const startIdx = line.route.findIndex(s => s.type === 'station' && s.code === startCode);
        const endIdx = line.route.findIndex(s => s.type === 'station' && s.code === endCode);

        if (startIdx === -1 || endIdx === -1) {
            result.push({
                lineId, startCode, endCode,
                trips: [], nextTrip: null,
                available: false, reason: 'station_not_found'
            });
            continue;
        }

        // 从 trainSchedules 中筛选匹配的列车
        const segTrips = [];

        for (const [, schedule] of trainSchedules.entries()) {
            if (schedule.lineId !== lineId) continue;

            const stopA = schedule.stops.find(s => s.stationCode === startCode);
            const stopB = schedule.stops.find(s => s.stationCode === endCode);

            if (!stopA || !stopB) continue;

            const sIdx = schedule.stops.indexOf(stopA);
            const eIdx = schedule.stops.indexOf(stopB);

            // 确保起点在终点之前（按行程顺序）
            if (sIdx >= eIdx) continue;

            const departureTime = new Date(stopA.departureTime).getTime();
            const arrivalTime = new Date(stopB.arrivalTime).getTime();

            // 跳过出发时间已过的班次
            if (departureTime < now) continue;

            // 如果是换乘后的段，必须在上一段到达之后才能出发
            if (previousArrivalTime !== null && departureTime < previousArrivalTime) continue;

            segTrips.push({
                trainName: schedule.trainName,
                trainSeries: schedule.trainSeries,
                lineId: schedule.lineId,
                lineName: schedule.lineName,
                startStation: stopA.stationName,
                endStation: stopB.stationName,
                startCode,
                endCode,
                departureTime: new Date(departureTime).toISOString(),
                arrivalTime: new Date(arrivalTime).toISOString(),
                duration: Math.round((arrivalTime - departureTime) / 1000),
                direction: schedule.direction,
                directionLabel: schedule.directionLabel,
                status: 'scheduled',
                isScheduled: true
            });
        }

        // 按出发时间排序
        segTrips.sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));
        const topTrips = segTrips.slice(0, 10);

        // 更新下一段的基准时间
        if (topTrips.length > 0) {
            previousArrivalTime = new Date(topTrips[0].arrivalTime).getTime();
        } else {
            previousArrivalTime = null;
        }

        result.push({
            lineId,
            lineName: line.name ? line.name[lang] || line.name.zh_hans : lineId,
            startCode,
            endCode,
            startStation: getStationName(startCode, lang),
            endStation: getStationName(endCode, lang),
            trips: topTrips,
            nextTrip: topTrips.length >= 2 ? {
                trainName: topTrips[1].trainName,
                departureTime: topTrips[1].departureTime
            } : null,
            available: topTrips.length > 0,
            reason: topTrips.length > 0 ? null : 'no_matching_trips'
        });
    }

    // 计算总行程信息
    const firstSeg = result[0];
    const lastSeg = result[result.length - 1];
    const overallDeparture = firstSeg && firstSeg.trips.length > 0 ? firstSeg.trips[0].departureTime : null;
    const overallArrival = lastSeg && lastSeg.trips.length > 0 ? lastSeg.trips[0].arrivalTime : null;
    const allAvailable = result.every(s => s.available);

    return {
        segments: result,
        overallDeparture,
        overallArrival,
        allAvailable,
        available: allAvailable,
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    init,
    getRecentTrips,
    getMultiSegmentTrips,
    getScheduledTrips,
    getScheduledMultiSegmentTrips,
    getNavigationDuration,
    isDataAvailable,
    getTrainSchedules,
    getTrainSchedule,
    generateFullSchedule // 导出用于测试
};
