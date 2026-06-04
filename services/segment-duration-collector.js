// segment-duration-collector.js - 区间实际用时收集服务
// 基于列车位置变化，按区间/方向收集实际运行时间
// 不必等待一辆车走完全程，每段轨道只需一辆列车经过就能获得该段耗时
// 优先使用实际收集的数据，回退到 lines.json 中的默认值

const fs = require('fs');
const path = require('path');
const eventBus = require('./event-bus');

const LINES_FILE = path.join(__dirname, '..', 'data', 'lines.json');
const TRAINS_INFO_FILE = path.join(__dirname, '..', 'data', 'trains_info.json');

let linesData = null;
let trainsInfoData = null;

// 区间用时存储：key = "lineId:segmentIndex:direction", value = { durations: [], lastUpdate, source: 'actual' }
const segmentDurations = new Map();

// 默认区间用时（从 lines.json 加载）：key = "lineId:segmentIndex", value = duration
const defaultDurations = new Map();

// 所有区间数量（不含方向，用于进度统计）
let totalTrackSegments = 0;

// 站点停留时间存储：key = "lineId:stationCode:direction", value = { dwellTimes: [], lastUpdate, source: 'actual' }
const stationDwellTimes = new Map();

// 站点坐标缓存：key = "lineId:stationCode", value = { x, z }
const stationPositions = new Map();

// 默认站点停留时间（秒）
const DEFAULT_DWELL_TIME = 30;

// 列车站点状态记录：key = trainName, value = { lineId, stationCode, direction, arrivalTime }
const trainStationState = new Map();

// 站点检测半径（米）
const STATION_DETECT_RADIUS = 150;

// 最小/最大有效停留时间（秒）
const MIN_VALID_DWELL = 5;
const MAX_VALID_DWELL = 300; // 5分钟

// 列车上次位置记录：key = trainName, value = { lineId, segmentIndex, timestamp, direction }
const trainLastPositions = new Map();

// 数据有效期（24小时）
const DATA_TTL = 24 * 60 * 60 * 1000;

// 每个区间最多存储的样本数
const MAX_SAMPLES = 50;

// 最小有效用时（秒），过滤异常数据
const MIN_VALID_DURATION = 5;
const MAX_VALID_DURATION = 600; // 10分钟

// 加载线路数据
function loadLinesData() {
    try {
        const rawData = fs.readFileSync(LINES_FILE, 'utf8');
        linesData = JSON.parse(rawData).lines;
        
        // 提取每个区间的默认 duration 和站点坐标
        for (const line of linesData) {
            for (let i = 0; i < line.route.length; i++) {
                const segment = line.route[i];
                if (segment.type === 'track') {
                    totalTrackSegments++;
                    if (segment.duration) {
                        const key = `${line.id}:${i}`;
                        defaultDurations.set(key, segment.duration);
                    }
                }
                // 计算站点坐标（从相邻 track 的端点推算）
                if (segment.type === 'station') {
                    const pos = calculateStationPosition(line, i);
                    if (pos) {
                        stationPositions.set(`${line.id}:${segment.code}`, pos);
                    }
                }
            }
        }
        
        console.log('[SegmentDurationCollector] 线路数据加载成功，共', linesData.length, '条线路，', 
            defaultDurations.size, '个区间默认值，', stationPositions.size, '个站点坐标');
    } catch (error) {
        console.error('[SegmentDurationCollector] 加载线路数据失败:', error.message);
    }

    // 加载列车静态信息
    try {
        const rawTrainsData = fs.readFileSync(TRAINS_INFO_FILE, 'utf8');
        trainsInfoData = JSON.parse(rawTrainsData).trains;
        console.log('[SegmentDurationCollector] 列车信息加载成功，共', trainsInfoData.length, '列列车');
    } catch (error) {
        console.error('[SegmentDurationCollector] 加载列车信息失败:', error.message);
    }
}

// 计算站点坐标（从相邻 track 段的端点推算）
function calculateStationPosition(line, stationIndex) {
    const route = line.route;
    
    // 向前找 track 段的末端
    for (let i = stationIndex - 1; i >= 0; i--) {
        if (route[i].type === 'track' && route[i].nodes && route[i].nodes.length > 0) {
            const endNode = route[i].nodes[route[i].nodes.length - 1];
            return { x: endNode.x, z: endNode.z || 0 };
        }
    }
    
    // 向后找 track 段的起点
    for (let i = stationIndex + 1; i < route.length; i++) {
        if (route[i].type === 'track' && route[i].nodes && route[i].nodes.length > 0) {
            const startNode = route[i].nodes[0];
            return { x: startNode.x, z: startNode.z || 0 };
        }
    }
    
    return null;
}

// 计算两点之间的距离
function distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dz = (p1.z || 0) - (p2.z || 0);
    return Math.sqrt(dx * dx + dz * dz);
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

// 找到列车所在的轨道段
function findTrainTrackSegment(trainPosition, trainName) {
    if (!linesData) return null;

    // 优先从 trains_info.json 获取列车所属线路
    let preferredLineId = null;
    if (trainsInfoData && trainName) {
        const staticInfo = trainsInfoData.find(t => t.name === trainName);
        if (staticInfo) {
            preferredLineId = staticInfo.line;
        }
    }

    // 如果有指定线路，严格只在该线路上查找
    if (preferredLineId) {
        const line = linesData.find(l => l.id === preferredLineId);
        if (line) {
            let closestSegment = null;
            let minDistance = Infinity;
            let segmentIndex = -1;

            for (let i = 0; i < line.route.length; i++) {
                const segment = line.route[i];
                if (segment.type !== 'track') continue;

                for (let j = 0; j < segment.nodes.length - 1; j++) {
                    const dist = distanceToSegment(
                        trainPosition,
                        segment.nodes[j],
                        segment.nodes[j + 1]
                    );

                    if (dist < minDistance && dist < 100) {
                        minDistance = dist;
                        closestSegment = segment;
                        segmentIndex = i;
                    }
                }
            }

            if (closestSegment) {
                return { lineId: preferredLineId, segmentIndex };
            }
        }
        return null; // trains_info.json 中有定义但未在该线路上找到，不回退
    }

    // 仅对 trains_info.json 中未定义的列车，在所有线路上查找
    let closestSegment = null;
    let minDistance = Infinity;
    let lineId = null;
    let segmentIndex = -1;
    
    for (const line of linesData) {
        for (let i = 0; i < line.route.length; i++) {
            const segment = line.route[i];
            if (segment.type !== 'track') continue;
            
            for (let j = 0; j < segment.nodes.length - 1; j++) {
                const dist = distanceToSegment(
                    trainPosition,
                    segment.nodes[j],
                    segment.nodes[j + 1]
                );
                
                if (dist < minDistance && dist < 100) {
                    minDistance = dist;
                    closestSegment = segment;
                    lineId = line.id;
                    segmentIndex = i;
                }
            }
        }
    }
    
    if (closestSegment) {
        return { lineId, segmentIndex };
    }
    
    return null;
}

// 判断列车行驶方向
function determineDirection(lineId, segmentIndex, position) {
    const line = linesData.find(l => l.id === lineId);
    if (!line) return 0;
    
    // 简化判断：根据位置在轨道段中的相对位置判断方向
    const segment = line.route[segmentIndex];
    if (!segment || segment.type !== 'track' || !segment.nodes || segment.nodes.length < 2) {
        return 0;
    }
    
    const firstNode = segment.nodes[0];
    const lastNode = segment.nodes[segment.nodes.length - 1];
    
    const distToFirst = distance(position, firstNode);
    const distToLast = distance(position, lastNode);
    
    // 如果离起点更近，认为是正向（1），否则是反向（-1）
    return distToFirst < distToLast ? 1 : -1;
}

// 检测列车是否在站点附近
function detectTrainAtStation(lineId, position) {
    const line = linesData.find(l => l.id === lineId);
    if (!line) return null;
    
    for (let i = 0; i < line.route.length; i++) {
        const segment = line.route[i];
        if (segment.type !== 'station') continue;
        
        const stationPos = stationPositions.get(`${lineId}:${segment.code}`);
        if (!stationPos) continue;
        
        const dist = distance(position, stationPos);
        if (dist < STATION_DETECT_RADIUS) {
            return {
                stationCode: segment.code,
                segmentIndex: i
            };
        }
    }
    
    return null;
}

// 计算列车在轨道段内的进度
function calculateProgress(lineId, segmentIndex, position) {
    const line = linesData.find(l => l.id === lineId);
    if (!line) return 0;
    
    const segment = line.route[segmentIndex];
    if (!segment || segment.type !== 'track' || !segment.nodes || segment.nodes.length < 2) {
        return 0;
    }
    
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

// 计算轨道段总长度
function calculateTrackLength(nodes) {
    let totalLength = 0;
    for (let i = 0; i < nodes.length - 1; i++) {
        totalLength += distance(nodes[i], nodes[i + 1]);
    }
    return totalLength;
}

// 处理列车位置更新
function handleTrainPositionUpdate(payload) {
    const trains = payload.trains || [];
    const now = Date.now();
    
    for (const train of trains) {
        if (!train || !train.name || !train.cars || !train.cars[0] || !train.cars[0].leading || !train.cars[0].leading.location) {
            continue;
        }
        
        const trainName = train.name;
        const position = train.cars[0].leading.location;
        
        // 跳过停站的列车（速度为0且在站点附近）
        const isStopped = train.stopped === 'true' || train.stopped === true;
        
        // 找到当前所在的轨道段
        const currentSegment = findTrainTrackSegment(position, trainName);
        if (!currentSegment) continue;
        
        const { lineId, segmentIndex } = currentSegment;
        const direction = determineDirection(lineId, segmentIndex, position);
        
        // 获取上次位置记录
        const lastRecord = trainLastPositions.get(trainName);
        
        if (lastRecord) {
            // 检查是否在同一轨道段
            if (lastRecord.lineId === lineId && lastRecord.segmentIndex === segmentIndex) {
                // 同一轨道段，检查进度变化
                const lastProgress = lastRecord.progress || 0;
                const currentProgress = calculateProgress(lineId, segmentIndex, position);
                const progressDiff = currentProgress - lastProgress;
                
                // 只有当进度有显著变化且不是停站状态时才记录
                if (Math.abs(progressDiff) > 0.01 && !isStopped) {
                    // 计算实际用时
                    const timeDiff = (now - lastRecord.timestamp) / 1000; // 转换为秒
                    
                    // 如果进度差很大，说明可能跳过了部分，需要按比例缩放
                    const estimatedSegmentDuration = timeDiff / Math.abs(progressDiff);
                    
                    // 验证数据有效性
                    if (estimatedSegmentDuration >= MIN_VALID_DURATION && 
                        estimatedSegmentDuration <= MAX_VALID_DURATION) {
                        
                        // 存储数据
                        const key = `${lineId}:${segmentIndex}:${direction}`;
                        if (!segmentDurations.has(key)) {
                            segmentDurations.set(key, {
                                durations: [],
                                lastUpdate: now
                            });
                        }
                        
                        const segmentData = segmentDurations.get(key);
                        segmentData.durations.push(estimatedSegmentDuration);
                        segmentData.lastUpdate = now;
                        
                        // 限制样本数量，移除最旧的数据
                        if (segmentData.durations.length > MAX_SAMPLES) {
                            segmentData.durations.shift();
                        }
                        
                        // 发布区间用时更新事件
                        eventBus.publish('segment-duration-updated', {
                            lineId,
                            segmentIndex,
                            direction,
                            duration: estimatedSegmentDuration,
                            sampleCount: segmentData.durations.length
                        });
                    }
                }
            } else if (lastRecord.lineId === lineId && lastRecord.segmentIndex !== segmentIndex) {
                // 列车移动到了相邻的轨道段
                // 这种情况说明列车离开了上一个轨道段，可以计算上一个段的完整用时
                const lastSegmentIndex = lastRecord.segmentIndex;
                const lastKey = `${lineId}:${lastSegmentIndex}:${lastRecord.direction}`;
                
                if (!segmentDurations.has(lastKey)) {
                    segmentDurations.set(lastKey, {
                        durations: [],
                        lastUpdate: now
                    });
                }
                
                // 计算从上次记录到现在的总时间
                const timeDiff = (now - lastRecord.timestamp) / 1000;
                
                // 如果时间合理，记录为完整轨道段用时
                if (timeDiff >= MIN_VALID_DURATION && timeDiff <= MAX_VALID_DURATION) {
                    const segmentData = segmentDurations.get(lastKey);
                    segmentData.durations.push(timeDiff);
                    segmentData.lastUpdate = now;
                    
                    if (segmentData.durations.length > MAX_SAMPLES) {
                        segmentData.durations.shift();
                    }
                    
                    eventBus.publish('segment-duration-updated', {
                        lineId,
                        segmentIndex: lastSegmentIndex,
                        direction: lastRecord.direction,
                        duration: timeDiff,
                        sampleCount: segmentData.durations.length
                    });
                }
            }
        }
        
        // 更新列车位置记录
        trainLastPositions.set(trainName, {
            lineId,
            segmentIndex,
            direction,
            progress: calculateProgress(lineId, segmentIndex, position),
            timestamp: now
        });
        
        // === 站点停留时间收集 ===
        const stationInfo = detectTrainAtStation(lineId, position);
        const prevStationState = trainStationState.get(trainName);
        
        if (stationInfo) {
            // 列车当前在站点附近
            if (!prevStationState || prevStationState.stationCode !== stationInfo.stationCode) {
                // 到达新站点（或首次检测到）
                trainStationState.set(trainName, {
                    lineId,
                    stationCode: stationInfo.stationCode,
                    direction,
                    arrivalTime: now
                });
            }
            // 如果是同一站点，不做任何操作（正在停靠中）
        } else {
            // 列车当前不在站点附近（在轨道上）
            if (prevStationState) {
                // 之前在站点，现在离开了 → 计算停留时间
                const dwellTime = (now - prevStationState.arrivalTime) / 1000; // 秒
                
                if (dwellTime >= MIN_VALID_DWELL && dwellTime <= MAX_VALID_DWELL) {
                    const dwellKey = `${prevStationState.lineId}:${prevStationState.stationCode}:${prevStationState.direction}`;
                    
                    if (!stationDwellTimes.has(dwellKey)) {
                        stationDwellTimes.set(dwellKey, {
                            dwellTimes: [],
                            lastUpdate: now
                        });
                    }
                    
                    const dwellData = stationDwellTimes.get(dwellKey);
                    dwellData.dwellTimes.push(dwellTime);
                    dwellData.lastUpdate = now;
                    
                    if (dwellData.dwellTimes.length > MAX_SAMPLES) {
                        dwellData.dwellTimes.shift();
                    }
                    
                    // 发布站点停留时间更新事件
                    eventBus.publish('station-dwell-updated', {
                        lineId: prevStationState.lineId,
                        stationCode: prevStationState.stationCode,
                        direction: prevStationState.direction,
                        dwellTime,
                        sampleCount: dwellData.dwellTimes.length
                    });
                }
                
                // 清除站点状态
                trainStationState.delete(trainName);
            }
        }
    }
    
    // 清理过期数据
    cleanExpiredData(now);
}

// 清理过期数据
function cleanExpiredData(now) {
    for (const [key, data] of segmentDurations.entries()) {
        if (now - data.lastUpdate > DATA_TTL) {
            segmentDurations.delete(key);
        }
    }
    
    for (const [key, data] of stationDwellTimes.entries()) {
        if (now - data.lastUpdate > DATA_TTL) {
            stationDwellTimes.delete(key);
        }
    }
    
    // 清理长时间未更新的列车记录
    for (const [trainName, record] of trainLastPositions.entries()) {
        if (now - record.timestamp > DATA_TTL) {
            trainLastPositions.delete(trainName);
        }
    }
    
    for (const [trainName, state] of trainStationState.entries()) {
        if (now - state.arrivalTime > DATA_TTL) {
            trainStationState.delete(trainName);
        }
    }
}

// 获取区间实际用时（供其他服务调用）
// 优先使用实际收集的数据，回退到 lines.json 中的默认值
function getSegmentDuration(lineId, segmentIndex, direction = 1) {
    // 1. 首先尝试获取指定方向的实际数据
    const key = `${lineId}:${segmentIndex}:${direction}`;
    const data = segmentDurations.get(key);
    
    if (data && data.durations.length > 0) {
        // 使用中位数，避免异常值影响
        const sorted = [...data.durations].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return {
            duration: sorted.length % 2 === 0 
                ? (sorted[mid - 1] + sorted[mid]) / 2 
                : sorted[mid],
            sampleCount: sorted.length,
            isActual: true,
            source: 'actual'
        };
    }
    
    // 2. 尝试反向数据（如果没有指定方向的数据）
    const reverseKey = `${lineId}:${segmentIndex}:${-direction}`;
    const reverseData = segmentDurations.get(reverseKey);
    
    if (reverseData && reverseData.durations.length > 0) {
        const sorted = [...reverseData.durations].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return {
            duration: sorted.length % 2 === 0 
                ? (sorted[mid - 1] + sorted[mid]) / 2 
                : sorted[mid],
            sampleCount: sorted.length,
            isActual: true,
            source: 'actual'
        };
    }
    
    // 3. 回退到 lines.json 中的默认值
    const defaultKey = `${lineId}:${segmentIndex}`;
    const defaultDuration = defaultDurations.get(defaultKey);
    
    if (defaultDuration) {
        return {
            duration: defaultDuration,
            sampleCount: 0,
            isActual: false,
            source: 'default'
        };
    }
    
    return null;
}

// 获取所有区间用时数据
function getAllSegmentDurations() {
    const result = {};
    
    // 1. 首先添加所有使用默认值的区间
    for (const [key, duration] of defaultDurations.entries()) {
        const [lineId, segmentIndex] = key.split(':');
        
        if (!result[lineId]) {
            result[lineId] = {};
        }
        
        result[lineId][segmentIndex] = {
            duration: duration,
            sampleCount: 0,
            isActual: false,
            source: 'default',
            lastUpdate: null
        };
    }
    
    // 2. 覆盖实际收集的数据（仅包含有有效样本的）
    for (const [key, data] of segmentDurations.entries()) {
        if (!data.durations || data.durations.length === 0) continue;
        const [lineId, segmentIndex, direction] = key.split(':');
        const sorted = [...data.durations].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        
        if (!result[lineId]) {
            result[lineId] = {};
        }
        
        result[lineId][`${segmentIndex}:${direction}`] = {
            duration: sorted.length % 2 === 0 
                ? (sorted[mid - 1] + sorted[mid]) / 2 
                : sorted[mid],
            sampleCount: sorted.length,
            isActual: true,
            source: 'actual',
            lastUpdate: new Date(data.lastUpdate).toISOString()
        };
    }
    
    return result;
}

// 获取站点停留时间（供其他服务调用）
function getStationDwellTime(lineId, stationCode, direction = 1) {
    // 1. 尝试获取指定方向的实际数据
    const key = `${lineId}:${stationCode}:${direction}`;
    const data = stationDwellTimes.get(key);
    
    if (data && data.dwellTimes.length > 0) {
        const sorted = [...data.dwellTimes].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return {
            dwellTime: sorted.length % 2 === 0 
                ? (sorted[mid - 1] + sorted[mid]) / 2 
                : sorted[mid],
            sampleCount: sorted.length,
            isActual: true,
            source: 'actual'
        };
    }
    
    // 2. 尝试反向数据
    const reverseKey = `${lineId}:${stationCode}:${-direction}`;
    const reverseData = stationDwellTimes.get(reverseKey);
    
    if (reverseData && reverseData.dwellTimes.length > 0) {
        const sorted = [...reverseData.dwellTimes].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return {
            dwellTime: sorted.length % 2 === 0 
                ? (sorted[mid - 1] + sorted[mid]) / 2 
                : sorted[mid],
            sampleCount: sorted.length,
            isActual: true,
            source: 'actual'
        };
    }
    
    // 3. 回退到默认值
    return {
        dwellTime: DEFAULT_DWELL_TIME,
        sampleCount: 0,
        isActual: false,
        source: 'default'
    };
}

// 获取所有站点停留时间数据
function getAllStationDwellTimes() {
    const result = {};
    
    for (const [key, data] of stationDwellTimes.entries()) {
        if (!data.dwellTimes || data.dwellTimes.length === 0) continue;
        const [lineId, stationCode, direction] = key.split(':');
        const sorted = [...data.dwellTimes].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        
        if (!result[lineId]) {
            result[lineId] = {};
        }
        
        result[lineId][`${stationCode}:${direction}`] = {
            dwellTime: sorted.length % 2 === 0 
                ? (sorted[mid - 1] + sorted[mid]) / 2 
                : sorted[mid],
            sampleCount: sorted.length,
            isActual: true,
            source: 'actual',
            lastUpdate: new Date(data.lastUpdate).toISOString()
        };
    }
    
    return result;
}

// 获取服务状态
function getStatus() {
    // 统计实际收集的区间数量（必须有至少1个有效样本）
    const actualSegments = new Set();
    let totalSamples = 0;
    for (const [key, data] of segmentDurations.entries()) {
        if (data.durations && data.durations.length > 0) {
            const [lineId, segmentIndex] = key.split(':');
            actualSegments.add(`${lineId}:${segmentIndex}`);
            totalSamples += data.durations.length;
        }
    }
    
    // 统计实际收集的站点停留时间数量（必须有至少1个有效样本）
    const actualStations = new Set();
    let totalStationSamples = 0;
    for (const [key, data] of stationDwellTimes.entries()) {
        if (data.dwellTimes && data.dwellTimes.length > 0) {
            const [lineId, stationCode] = key.split(':');
            actualStations.add(`${lineId}:${stationCode}`);
            totalStationSamples += data.dwellTimes.length;
        }
    }
    
    // 统计总站点数（去重）
    const allStations = new Set();
    for (const key of stationPositions.keys()) {
        allStations.add(key);
    }

    return {
        isRunning: true,
        totalSegments: totalTrackSegments,
        actualSegments: actualSegments.size,
        defaultSegments: totalTrackSegments - actualSegments.size,
        segmentCount: segmentDurations.size,
        stationDwellCount: stationDwellTimes.size,
        stationDwellStations: actualStations.size,
        totalStations: allStations.size,
        stationDwellSamples: totalStationSamples,
        trainTrackingCount: trainLastPositions.size,
        trainsAtStation: trainStationState.size,
        totalSamples: totalSamples,
        progress: totalTrackSegments > 0 
            ? Math.round((actualSegments.size / totalTrackSegments) * 100) 
            : 0
    };
}

// 获取正在追踪的列车列表
function getTrackedTrains() {
    const trains = [];
    for (const [trainName, record] of trainLastPositions.entries()) {
        trains.push({
            name: trainName,
            lineId: record.lineId,
            segmentIndex: record.segmentIndex,
            direction: record.direction,
            lastUpdate: new Date(record.timestamp).toISOString()
        });
    }
    return trains;
}

// 初始化服务
function init() {
    loadLinesData();
    
    // 监听列车位置更新事件
    eventBus.subscribe('train-position-updated', handleTrainPositionUpdate);
    
    console.log('[SegmentDurationCollector] 区间用时收集服务已启动');
}

module.exports = {
    init,
    getSegmentDuration,
    getAllSegmentDurations,
    getStationDwellTime,
    getAllStationDwellTimes,
    getStatus,
    getTrackedTrains
};
