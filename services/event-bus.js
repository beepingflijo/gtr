// event-bus.js - 事件总线（单例模式）
// 遵循事件驱动架构，解耦各服务模块

const EventEmitter = require('events');

class EventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(50); // 增加最大监听器数量
    }

    // 发布事件并记录日志
    publish(eventName, payload) {
        const timestamp = Date.now();
        const enrichedPayload = { ...payload, timestamp };
        
        console.log(`[EventBus] 发布事件: ${eventName}`, {
            timestamp: new Date(timestamp).toISOString(),
            payloadKeys: Object.keys(payload)
        });
        
        this.emit(eventName, enrichedPayload);
    }

    // 订阅事件
    subscribe(eventName, handler) {
        this.on(eventName, handler);
        return () => this.off(eventName, handler); // 返回取消订阅函数
    }
}

// 单例导出
module.exports = new EventBus();
