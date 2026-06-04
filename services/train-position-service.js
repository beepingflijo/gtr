// train-position-service.js - 列车实时位置数据获取服务
// 使用 SSE 连接获取实时数据，事件驱动架构

const https = require('https');
const eventBus = require('./event-bus');

const API_URL = 'https://track.api.hydcraft.cn/api/trains.rt';
const RECONNECT_DELAY = 5000; // 断线重连延迟（毫秒）
const CONNECTION_TIMEOUT = 30000; // 连接超时（30秒无数据则重连）

let sseConnection = null;
let reconnectTimer = null;
let timeoutTimer = null;
let isRunning = false;
let lastDataTime = 0;

// 列车数据存储
const trainStore = new Map();

// 通过 SSE 连接获取实时数据
function connectSSE() {
    if (!isRunning) return;
    
    // 清理旧连接
    if (sseConnection) {
        sseConnection.destroy();
        sseConnection = null;
    }
    if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
    }

    const url = new URL(API_URL);
    const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'GET',
        headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache'
        }
    };

    const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
            console.error(`[TrainPositionService] SSE 连接失败，状态码: ${res.statusCode}`);
            res.resume();
            scheduleReconnect();
            return;
        }

        console.log('[TrainPositionService] SSE 连接已建立');
        sseConnection = res;
        resetConnectionTimeout();

        let buffer = '';

        res.on('data', (chunk) => {
            if (!isRunning) return;
            buffer += chunk.toString();

            // 解析 SSE 数据流
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));
                        handleIncomingData(data);
                    } catch (e) {
                        // 忽略非 JSON 行
                    }
                }
            }
        });

        res.on('end', () => {
            console.log('[TrainPositionService] SSE 连接断开');
            sseConnection = null;
            scheduleReconnect();
        });

        res.on('error', (error) => {
            console.error('[TrainPositionService] SSE 连接错误:', error.message);
            sseConnection = null;
            scheduleReconnect();
        });
    });

    req.on('error', (error) => {
        console.error('[TrainPositionService] HTTPS 请求错误:', error.message);
        scheduleReconnect();
    });

    req.end();
}

// 重置连接超时计时器
function resetConnectionTimeout() {
    if (timeoutTimer) {
        clearTimeout(timeoutTimer);
    }
    timeoutTimer = setTimeout(() => {
        console.warn('[TrainPositionService] 连接超时，重新连接...');
        if (sseConnection) {
            sseConnection.destroy();
            sseConnection = null;
        }
        scheduleReconnect();
    }, CONNECTION_TIMEOUT);
}

// 处理接收到的数据
function handleIncomingData(data) {
    lastDataTime = Date.now();
    resetConnectionTimeout();

    let trains;
    if (data.type === 'patch' && Array.isArray(data.upsert)) {
        trains = applyPatch(trainStore, data);
    } else {
        trains = applyFullData(trainStore, data);
    }

    const validTrains = filterValidTrains(trains);

    if (validTrains.length > 0) {
        eventBus.publish('train-position-updated', {
            trains: validTrains,
            count: validTrains.length
        });
    }
}

// 计划重连
function scheduleReconnect() {
    if (!isRunning) return;
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }
    reconnectTimer = setTimeout(() => {
        if (isRunning) {
            console.log('[TrainPositionService] 尝试重新连接...');
            connectSSE();
        }
    }, RECONNECT_DELAY);
}

// 过滤有效列车
function filterValidTrains(trains) {
    if (!Array.isArray(trains)) return [];

    return trains.filter(train => {
        if (!train || !train.name || !train.cars || !Array.isArray(train.cars) || train.cars.length === 0) {
            return false;
        }
        const leading = train.cars[0].leading;
        if (!leading || !leading.location) {
            return false;
        }
        const name = train.name;
        if (name.startsWith('TC') || name.startsWith('SL') || name === '未命名列车') {
            return false;
        }
        return true;
    });
}

// 处理增量数据
function applyPatch(store, patchData) {
    if (Array.isArray(patchData.upsert)) {
        patchData.upsert.forEach(train => {
            if (train && train.id) {
                store.set(train.id, train);
            }
        });
    }
    if (Array.isArray(patchData.remove)) {
        patchData.remove.forEach(id => {
            store.delete(id);
        });
    }
    return Array.from(store.values());
}

// 处理全量数据
function applyFullData(store, data) {
    store.clear();
    if (Array.isArray(data.trains)) {
        data.trains.forEach(train => {
            if (train && train.id) {
                store.set(train.id, train);
            }
        });
    }
    return Array.from(store.values());
}

// 启动服务
function start() {
    if (isRunning) return;

    console.log('[TrainPositionService] 启动列车位置数据服务（SSE 模式）');
    isRunning = true;

    connectSSE();
}

// 停止服务
function stop() {
    if (!isRunning) return;

    console.log('[TrainPositionService] 停止列车位置数据服务');
    isRunning = false;

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
    }
    if (sseConnection) {
        sseConnection.destroy();
        sseConnection = null;
    }

    trainStore.clear();
}

// 获取当前状态
function getStatus() {
    return {
        isRunning,
        connected: sseConnection !== null,
        trainCount: trainStore.size,
        lastDataTime,
        source: API_URL
    };
}

module.exports = {
    start,
    stop,
    getStatus
};
