// warning_monitor.js - 后端持续监控列车预警模块（事件驱动架构）

const { EventEmitter } = require('events');
const https = require('https');

// ==================== 事件定义 ====================
// 事件列表：
// - 'warning_detected' - 检测到新警告
// - 'warning_resolved' - 警告条件解除
// - 'train_data_updated' - 列车数据更新
// - 'monitor_started' - 监控启动
// - 'monitor_stopped' - 监控停止
// - 'monitor_error' - 监控错误
// - 'sse_connected' - SSE连接成功
// - 'sse_disconnected' - SSE连接断开

// Payload 数据结构：
// WarningDetectedPayload: { trainId: string, warningType: string, warningParams: object, position: object, timestamp: string }
// WarningResolvedPayload: { trainId: string, warningType: string, reason: string, timestamp: string }
// TrainDataUpdatedPayload: { trains: Train[], timestamp: string }
// MonitorErrorPayload: { error: Error, context: string }

const API_URL = 'https://track.api.hydcraft.cn/api/trains.rt';

// 配置常量
const CONFIG = {
    ZERO_SPEED_THRESHOLD: 0,
    ZERO_SPEED_DURATION: 180000,      // 3分钟
    LONG_STOP_DURATION: 300000,       // 5分钟
    PLATFORM_CONFLICT_ENABLED: true,
    WARNING_TYPES: {
        ZERO_SPEED: 'zero_speed',
        LONG_STOP: 'long_stop',
        PLATFORM_CONFLICT: 'platform_conflict'
    },
    WARNING_LEVELS: {
        zero_speed: 'warning',
        long_stop: 'warning',
        platform_conflict: 'critical'
    },
    RECONNECT_DELAY: 5000,
    POSITION_HISTORY_TTL: 3000,
    SPEED_LOST_TTL: 10000
};

class WarningMonitor extends EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
        this.trainPositionHistory = new Map();
        this.warningStartTimes = new Map();  // key: `${trainId}-${warningType}`, value: timestamp
        this.activeWarnings = new Set();     // 已上报的活跃警告 key: `${trainId}-${warningType}`
        this.sseConnection = null;
        this.reconnectTimer = null;
        this.trainStore = new Map();
    }

    // ==================== SSE连接管理 ====================
    
    connectSSE() {
        if (this.sseConnection) {
            this.sseConnection.destroy();
        }

        console.log('[WarningMonitor] 正在连接 SSE 数据源...');
        
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

        this.sseConnection = https.request(options, (res) => {
            if (res.statusCode !== 200) {
                console.error(`[WarningMonitor] SSE 连接失败，状态码: ${res.statusCode}`);
                this.emit('monitor_error', { 
                    error: new Error(`SSE connection failed with status ${res.statusCode}`), 
                    context: 'sse_connect' 
                });
                this.scheduleReconnect();
                return;
            }

            console.log('[WarningMonitor] SSE 连接成功');
            this.emit('sse_connected', { timestamp: new Date().toISOString() });

            let buffer = '';
            
            res.on('data', (chunk) => {
                buffer += chunk.toString();
                
                // 解析SSE数据流
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            this.processTrainData(data);
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            });

            res.on('end', () => {
                console.log('[WarningMonitor] SSE 连接断开');
                this.emit('sse_disconnected', { timestamp: new Date().toISOString() });
                this.scheduleReconnect();
            });

            res.on('error', (error) => {
                console.error('[WarningMonitor] SSE 连接错误:', error.message);
                this.emit('sse_disconnected', { timestamp: new Date().toISOString() });
                this.scheduleReconnect();
            });
        });

        this.sseConnection.on('error', (error) => {
            console.error('[WarningMonitor] HTTPS 请求错误:', error.message);
            this.scheduleReconnect();
        });

        this.sseConnection.end();
    }

    scheduleReconnect() {
        if (!this.isRunning) return;
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        
        this.reconnectTimer = setTimeout(() => {
            if (this.isRunning) {
                console.log('[WarningMonitor] 尝试重新连接...');
                this.connectSSE();
            }
        }, CONFIG.RECONNECT_DELAY);
    }

    // ==================== 数据处理 ====================
    
    processTrainData(data) {
        try {
            let trains;
            
            // 处理增量数据
            if (data.type === 'patch' && Array.isArray(data.upsert)) {
                if (Array.isArray(data.upsert)) {
                    data.upsert.forEach(train => {
                        if (train && train.id) {
                            this.trainStore.set(train.id, train);
                        }
                    });
                }
                if (Array.isArray(data.remove)) {
                    data.remove.forEach(id => {
                        this.trainStore.delete(id);
                    });
                }
                trains = Array.from(this.trainStore.values());
            } else {
                // 全量数据
                trains = data.trains || [];
                this.trainStore.clear();
                trains.forEach(train => {
                    if (train && train.id) {
                        this.trainStore.set(train.id, train);
                    }
                });
            }

            // 过滤有效列车
            const validTrains = this.filterValidTrains(trains);
            
            if (validTrains.length === 0) return;

            // 更新位置历史
            this.updatePositionHistory(validTrains);
            
            // 检测警告
            this.detectAllWarnings(validTrains);
            
            // 发出数据更新事件
            this.emit('train_data_updated', { 
                trains: validTrains, 
                timestamp: new Date().toISOString() 
            });
        } catch (error) {
            console.error('[WarningMonitor] 处理列车数据时出错:', error);
            this.emit('monitor_error', { error, context: 'process_train_data' });
        }
    }

    filterValidTrains(trains) {
        if (!Array.isArray(trains)) return [];
        return trains.filter(train => 
            train && 
            typeof train === 'object' && 
            train.name && 
            train.cars && 
            Array.isArray(train.cars) && 
            train.cars.length > 0 && 
            train.cars[0].leading && 
            train.cars[0].leading.location &&
            !this.shouldFilterTrain(train)
        );
    }

    shouldFilterTrain(train) {
        if (!train || !train.name) return true;
        const name = train.name;
        return name.startsWith('TC') || 
               name.startsWith('SL') || 
               name === '未命名列车';
    }

    updatePositionHistory(trains) {
        const now = Date.now();
        
        trains.forEach(train => {
            const pos = train.cars[0].leading.location;
            const prev = this.trainPositionHistory.get(train.name);
            let speed = 0;
            let isSpeedLost = false;

            if (prev && prev.timestamp) {
                const timeDiff = now - prev.timestamp;
                if (timeDiff > 50 && timeDiff < CONFIG.POSITION_HISTORY_TTL) {
                    const dx = pos.x - prev.x;
                    const dz = pos.z - prev.z;
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    speed = (distance / (timeDiff / 1000)) * 3.6;

                    if (speed <= 0 && prev.speed > 0 && !prev.isSpeedLost) {
                        isSpeedLost = true;
                    }
                }
            }

            if (isSpeedLost && prev && prev.speedLostTime) {
                const lostDuration = now - prev.speedLostTime;
                if (lostDuration > CONFIG.SPEED_LOST_TTL) {
                    isSpeedLost = false;
                }
            }

            this.trainPositionHistory.set(train.name, {
                x: pos.x,
                y: pos.y,
                z: pos.z,
                timestamp: now,
                speed: speed,
                isSpeedLost: isSpeedLost,
                speedLostTime: isSpeedLost ? (prev && prev.speedLostTime || now) : 0,
                isStopped: train.stopped === true || train.stopped === 'true',
                backwards: train.backwards === true || train.backwards === 'true'
            });
        });

        // 清理过期数据
        const expired = [];
        this.trainPositionHistory.forEach((value, key) => {
            if (now - value.timestamp > 60000) {
                expired.push(key);
            }
        });
        expired.forEach(key => this.trainPositionHistory.delete(key));
    }

    // ==================== 警告检测 ====================
    
    detectAllWarnings(trains) {
        trains.forEach(train => {
            const warnings = this.detectWarnings(train);
            const warningKey = (type) => `${train.name}-${type}`;
            
            // 检查是否应该上报新警告
            warnings.forEach(warning => {
                const key = warningKey(warning.type);
                if (!this.activeWarnings.has(key)) {
                    this.activeWarnings.add(key);
                    this.emit('warning_detected', {
                        trainId: train.name,
                        warningType: warning.type,
                        warningParams: warning.params,
                        position: train.cars[0]?.leading?.location,
                        timestamp: new Date().toISOString()
                    });
                }
            });
            
            // 检查是否应该撤回警告
            Object.values(CONFIG.WARNING_TYPES).forEach(type => {
                const key = warningKey(type);
                if (this.activeWarnings.has(key) && !warnings.find(w => w.type === type)) {
                    this.activeWarnings.delete(key);
                    this.emit('warning_resolved', {
                        trainId: train.name,
                        warningType: type,
                        reason: 'Warning condition cleared',
                        timestamp: new Date().toISOString()
                    });
                }
            });
        });
    }

    detectWarnings(train) {
        const warnings = [];
        const trainState = this.trainPositionHistory.get(train.name);
        const now = Date.now();

        if (!trainState) return warnings;

        // 1. 零速度警告检测
        if (trainState.speed === CONFIG.ZERO_SPEED_THRESHOLD && !trainState.isStopped) {
            const warningKey = `${train.name}-${CONFIG.WARNING_TYPES.ZERO_SPEED}`;
            const startTime = this.warningStartTimes.get(warningKey);
            
            if (startTime === undefined) {
                this.warningStartTimes.set(warningKey, now);
            } else {
                const elapsed = now - startTime;
                if (elapsed >= CONFIG.ZERO_SPEED_DURATION) {
                    warnings.push({
                        type: CONFIG.WARNING_TYPES.ZERO_SPEED,
                        level: CONFIG.WARNING_LEVELS.zero_speed,
                        params: { speed: 0, duration: elapsed }
                    });
                }
            }
        } else {
            // 条件不满足，清除开始时间
            this.warningStartTimes.delete(`${train.name}-${CONFIG.WARNING_TYPES.ZERO_SPEED}`);
        }

        // 2. 长时间停车警告检测
        if (trainState.timestamp) {
            const timeSinceUpdate = now - trainState.timestamp;
            if (timeSinceUpdate > CONFIG.LONG_STOP_DURATION) {
                const warningKey = `${train.name}-${CONFIG.WARNING_TYPES.LONG_STOP}`;
                const startTime = this.warningStartTimes.get(warningKey);
                
                if (startTime === undefined) {
                    this.warningStartTimes.set(warningKey, trainState.timestamp);
                }

                warnings.push({
                    type: CONFIG.WARNING_TYPES.LONG_STOP,
                    level: CONFIG.WARNING_LEVELS.long_stop,
                    params: { duration: timeSinceUpdate, threshold: CONFIG.LONG_STOP_DURATION }
                });
            } else {
                this.warningStartTimes.delete(`${train.name}-${CONFIG.WARNING_TYPES.LONG_STOP}`);
            }
        }

        return warnings;
    }

    // ==================== 生命周期管理 ====================
    
    start() {
        if (this.isRunning) {
            console.log('[WarningMonitor] 监控已在运行中');
            return;
        }
        
        console.log('[WarningMonitor] 启动列车预警监控...');
        this.isRunning = true;
        this.connectSSE();
        this.emit('monitor_started', { timestamp: new Date().toISOString() });
    }

    stop() {
        if (!this.isRunning) {
            console.log('[WarningMonitor] 监控未在运行');
            return;
        }
        
        console.log('[WarningMonitor] 停止列车预警监控...');
        this.isRunning = false;
        
        if (this.sseConnection) {
            this.sseConnection.destroy();
            this.sseConnection = null;
        }
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        this.emit('monitor_stopped', { timestamp: new Date().toISOString() });
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            activeWarningsCount: this.activeWarnings.size,
            trackedTrainsCount: this.trainPositionHistory.size,
            warningStartTimesCount: this.warningStartTimes.size
        };
    }
}

module.exports = WarningMonitor;
