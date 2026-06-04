// duration-calculator.js - Duration 计算引擎
// 基于列车实时位置数据重新计算各站点间的行驶时间

const fs = require('fs');
const path = require('path');
const eventBus = require('./event-bus');

const LINES_FILE = path.join(__dirname, '..', 'data', 'lines.json');
const TRAINS_INFO_FILE = path.join(__dirname, '..', 'data', 'trains_info.json');

let linesData = null;
let trainsInfoData = null;

// 列车历史位置记录
const trainPositionHistory = new Map();

// 计算后的 duration 数据
const calculatedDurations = new Map(); // lineId -> { segments: [...] }

// 滑动窗口大小
const HISTORY_WINDOW_SIZE = 10;

// 加载线路数据
function loadLinesData() {
    try {
        const rawData = fs.readFileSync(LINES_FILE, 'utf8');
        linesData = JSON.parse(rawData).lines;
        console.log('[DurationCalculator] 线路数据加载成功，共', linesData.length, '条线路');
    } catch (error) {
        console.error('[DurationCalculator] 加载线路数据失败:', error.message);
    }
}

// 加载列车信息
function loadTrainsInfo() {
    try {
        if (fs.existsSync(TRAINS_INFO_FILE)) {
            const rawData = fs.readFileSync(TRAINS_INFO_FILE, 'utf8');
            trainsInfoData = JSON.parse(rawData).trains || [];
            console.log('[DurationCalculator] 列车信息加载成功，共', trainsInfoData.length, '列车');
        }
    } catch (error) {
        console.error('[DurationCalculator] 加载列车信息失败:', error.message);
        trainsInfoData = [];
    }
}

// 计算两点之间的距离
function distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dz = (p1.z || p1.y || 0) - (p2.z || p2.y || 0);
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

// 找到列车所在的轨道段
function findTrainTrackSegment(trainPosition) {
    if (!linesData) return null;
    
    let closestSegment = null;
    let minDistance = Infinity;
    let lineId = null;
    let segmentIndex = -1;
    
    for (const line of linesData) {
        for (let i = 0; i < line.route.length; i++) {
            const segment = line.route[i];
            if (segment.type !== 'track') continue;
            
            // 计算位置到轨道段的最近距离
            for (let j = 0; j < segment.nodes.length - 1; j++) {
                const dist = distanceToSegment(
                    trainPosition,
                    segment.nodes[j],
                    segment.nodes[j + 1]
                );
                
                if (dist < minDistance) {
                    minDistance = dist;
                    closestSegment = segment;
                    lineId = line.id;
                    segmentIndex = i;
                }
            }
        }
    }
    
    // 只有当距离足够近时才认为在轨道上
    if (minDistance > 50) return null;
    
    return {
        lineId,
        segmentIndex,
        segment: closestSegment,
        distance: minDistance
    };
}

// 计算点到线段的最短距离
function distanceToSegment(point, p1, p2) {
    const x = point.x;
    const z = point.z || point.y || 0;
    const x1 = p1.x, z1 = p1.z || p1.y || 0;
    const x2 = p2.x, z2 = p2.z || p2.y || 0;
    
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

// 计算列车在轨道段上的进度（0-1）
function calculateProgress(position, segment) {
    const nodes = segment.nodes;
    const totalLength = calculateTrackLength(nodes);
    
    let traveledLength = 0;
    let minDist = Infinity;
    let closestNodeIndex = 0;
    
    // 找到最近的节点
    for (let i = 0; i < nodes.length; i++) {
        const dist = distance(position, nodes[i]);
        if (dist < minDist) {
            minDist = dist;
            closestNodeIndex = i;
        }
    }
    
    // 计算到最近节点的累计距离
    for (let i = 0; i < closestNodeIndex; i++) {
        traveledLength += distance(nodes[i], nodes[i + 1]);
    }
    
    // 加上到最近节点的投影距离
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

// 更新列车位置历史
function updateTrainHistory(trainName, position, timestamp) {
    if (!trainPositionHistory.has(trainName)) {
        trainPositionHistory.set(trainName, []);
    }
    
    const history = trainPositionHistory.get(trainName);
    history.push({
        position,
        timestamp,
        trackInfo: findTrainTrackSegment(position)
    });
    
    // 保持窗口大小
    if (history.length > HISTORY_WINDOW_SIZE) {
        history.shift();
    }
}

// 计算实际行驶时间
function calculateActualDuration(trainName) {
    const history = trainPositionHistory.get(trainName);
    if (!history || history.length < 2) return null;
    
    const results = [];
    
    for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1];
        const curr = history[i];
        
        if (!prev.trackInfo || !curr.trackInfo) continue;
        
        // 同一线路同一轨道段
        if (prev.trackInfo.lineId === curr.trackInfo.lineId &&
            prev.trackInfo.segmentIndex === curr.trackInfo.segmentIndex) {
            
            const timeDiff = (curr.timestamp - prev.timestamp) / 1000; // 转换为秒
            const prevProgress = calculateProgress(prev.position, prev.trackInfo.segment);
            const currProgress = calculateProgress(curr.position, curr.trackInfo.segment);
            const progressDiff = currProgress - prevProgress;
            
            if (progressDiff > 0 && timeDiff > 0) {
                const segmentDuration = prev.trackInfo.segment.duration;
                const actualDuration = (timeDiff / progressDiff) * segmentDuration;
                
                results.push({
                    lineId: prev.trackInfo.lineId,
                    segmentIndex: prev.trackInfo.segmentIndex,
                    duration: Math.round(actualDuration),
                    confidence: Math.min(1, progressDiff * 10) // 置信度
                });
            }
        }
    }
    
    return results;
}

// 处理列车位置更新
function handleTrainPositionUpdate(payload) {
    const { trains } = payload;
    const timestamp = Date.now();
    
    for (const train of trains) {
        const position = train.cars[0].leading.location;
        updateTrainHistory(train.name, position, timestamp);
        
        // 计算实际行驶时间
        const durations = calculateActualDuration(train.name);
        if (durations && durations.length > 0) {
            // 更新计算后的 duration
            for (const dur of durations) {
                updateCalculatedDuration(dur.lineId, dur.segmentIndex, dur.duration, dur.confidence);
            }
        }
    }
}

// 更新计算后的 duration
function updateCalculatedDuration(lineId, segmentIndex, duration, confidence) {
    if (!calculatedDurations.has(lineId)) {
        calculatedDurations.set(lineId, { segments: [] });
    }
    
    const lineData = calculatedDurations.get(lineId);
    
    // 确保数组足够大
    while (lineData.segments.length <= segmentIndex) {
        lineData.segments.push({
            originalDuration: 0,
            calculatedDurations: [],
            averageDuration: 0,
            confidence: 0,
            lastUpdated: 0
        });
    }
    
    const segment = lineData.segments[segmentIndex];
    
    // 获取原始 duration
    const originalLine = linesData.find(l => l.id === lineId);
    if (originalLine && originalLine.route[segmentIndex]) {
        segment.originalDuration = originalLine.route[segmentIndex].duration || 0;
    }
    
    // 添加新的计算结果
    segment.calculatedDurations.push({
        value: duration,
        confidence,
        timestamp: Date.now()
    });
    
    // 保持历史记录大小
    if (segment.calculatedDurations.length > 100) {
        segment.calculatedDurations.shift();
    }
    
    // 计算加权平均值
    if (segment.calculatedDurations.length > 0) {
        let totalWeight = 0;
        let weightedSum = 0;
        
        for (const calc of segment.calculatedDurations) {
            const weight = calc.confidence;
            weightedSum += calc.value * weight;
            totalWeight += weight;
        }
        
        segment.averageDuration = Math.round(weightedSum / totalWeight);
        segment.confidence = totalWeight / segment.calculatedDurations.length;
    }
    
    segment.lastUpdated = Date.now();
}

// 初始化
function init() {
    loadLinesData();
    loadTrainsInfo();
    
    // 订阅列车位置更新事件
    eventBus.subscribe('train-position-updated', handleTrainPositionUpdate);
    
    console.log('[DurationCalculator] 初始化完成');
}

// 获取计算后的 duration 数据
function getCalculatedDurations(lineId) {
    if (lineId) {
        return calculatedDurations.get(lineId) || null;
    }
    
    // 返回所有线路的数据
    const result = {};
    calculatedDurations.forEach((value, key) => {
        result[key] = value;
    });
    return result;
}

// 获取单个轨道段的 duration
function getSegmentDuration(lineId, segmentIndex) {
    const lineData = calculatedDurations.get(lineId);
    if (!lineData || !lineData.segments[segmentIndex]) {
        // 返回原始 duration
        const originalLine = linesData.find(l => l.id === lineId);
        if (originalLine && originalLine.route[segmentIndex]) {
            return {
                duration: originalLine.route[segmentIndex].duration || 0,
                isOriginal: true,
                confidence: 0
            };
        }
        return null;
    }
    
    const segment = lineData.segments[segmentIndex];
    return {
        duration: segment.averageDuration || segment.originalDuration,
        isOriginal: segment.calculatedDurations.length === 0,
        confidence: segment.confidence,
        lastUpdated: segment.lastUpdated
    };
}

// 重置计算数据
function reset() {
    calculatedDurations.clear();
    trainPositionHistory.clear();
    console.log('[DurationCalculator] 计算数据已重置');
}

module.exports = {
    init,
    getCalculatedDurations,
    getSegmentDuration,
    reset
};
