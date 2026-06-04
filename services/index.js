// index.js - 服务初始化入口
// 负责初始化所有服务模块并建立事件监听

const eventBus = require('./event-bus');
const trainPositionService = require('./train-position-service');
const durationCalculator = require('./duration-calculator');
const storageService = require('./storage-service');
const timetableService = require('./timetable-service');
const segmentDurationCollector = require('./segment-duration-collector');
const apiRoutes = require('./api-routes');

// 定期保存计算结果的定时器
let autoSaveTimer = null;

// 初始化所有服务
function initServices() {
    console.log('[Services] 开始初始化服务...');
    
    // 1. 初始化存储服务
    storageService.init();
    
    // 2. 初始化 duration 计算引擎
    durationCalculator.init();
    
    // 3. 初始化区间用时收集服务
    segmentDurationCollector.init();
    
    // 4. 初始化时刻表服务
    timetableService.init();
    
    // 5. 设置事件监听
    setupEventListeners();
    
    // 6. 启动列车位置数据服务
    trainPositionService.start();
    
    // 7. 设置自动保存（每5分钟）
    autoSaveTimer = setInterval(() => {
        const durations = durationCalculator.getCalculatedDurations();
        if (Object.keys(durations).length > 0) {
            storageService.saveDurations(durations);
            console.log('[Services] 自动保存 duration 数据完成');
        }
    }, 5 * 60 * 1000);
    
    console.log('[Services] 所有服务初始化完成');
}

// 设置事件监听
function setupEventListeners() {
    // 监听数据同步错误
    eventBus.subscribe('data-sync-error', (payload) => {
        console.error('[Services] 数据同步错误:', payload.error.message);
    });
    
    // 监听 duration 数据保存事件
    eventBus.subscribe('duration-data-saved', (payload) => {
        console.log('[Services] Duration 数据已保存:', new Date(payload.timestamp).toISOString());
    });
    
    // 监听时刻表生成事件
    eventBus.subscribe('timetable-generated', (payload) => {
        console.log('[Services] 时刻表已更新，当前列车数:', payload.trainCount);
    });
    
    // 监听区间用时更新事件（可选：记录日志或触发其他操作）
    eventBus.subscribe('segment-duration-updated', (payload) => {
        // 只在样本数较少时记录日志，避免日志过多
        if (payload.sampleCount <= 3) {
            console.log(`[Services] 区间用时更新: ${payload.lineId} 段${payload.segmentIndex} 方向${payload.direction}, ` +
                `用时 ${payload.duration.toFixed(1)}s, 样本数 ${payload.sampleCount}`);
        }
    });
    
    console.log('[Services] 事件监听器设置完成');
}

// 停止所有服务
function stopServices() {
    console.log('[Services] 停止所有服务...');
    
    // 停止列车位置服务
    trainPositionService.stop();
    
    // 清除自动保存定时器
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
    }
    
    // 保存当前数据
    const durations = durationCalculator.getCalculatedDurations();
    if (Object.keys(durations).length > 0) {
        storageService.saveDurations(durations);
    }
    
    console.log('[Services] 所有服务已停止');
}

// 获取服务状态
function getServiceStatus() {
    return {
        trainPosition: trainPositionService.getStatus(),
        storage: storageService.getStatus(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    initServices,
    stopServices,
    getServiceStatus,
    apiRoutes
};
