// train_data_source.js - 统一的列车数据源管理器（事件驱动架构）

const TrainDataSource = (function () {
    const API_URL = 'https://track.nitrogen.hydcraft.cn/api/trains.rt';
    const FALLBACK_URL = './data/trains.json';
    const NETWORK_URL = './data/network.json';
    
    const RECONNECT_DELAY = 5000;
    const POSITION_HISTORY_TTL = 3000;
    const SPEED_LOST_TTL = 10000;

    let eventSource = null;
    let reconnectTimer = null;
    let isOnline = false;
    let currentSource = 'none';
    let listeners = {};
    let trainPositionHistory = new Map();

    function on(eventName, callback) {
        if (!listeners[eventName]) listeners[eventName] = [];
        listeners[eventName].push(callback);
    }

    function off(eventName, callback) {
        if (!listeners[eventName]) return;
        listeners[eventName] = listeners[eventName].filter(cb => cb !== callback);
    }

    function emit(eventName, payload) {
        if (!listeners[eventName]) return;
        listeners[eventName].forEach(cb => {
            try {
                cb(payload);
            } catch (e) {
                console.error(`事件处理器错误 [${eventName}]:`, e);
            }
        });
    }

    function isValidTrainData(data) {
        return data && data.trains && Array.isArray(data.trains);
    }

    function isValidTrain(train) {
        return train &&
            typeof train === 'object' &&
            train.name &&
            train.cars &&
            Array.isArray(train.cars) &&
            train.cars.length > 0 &&
            train.cars[0].leading &&
            train.cars[0].leading.location;
    }

    function filterValidTrains(trains) {
        if (!Array.isArray(trains)) return [];
        return trains.filter(isValidTrain);
    }

    function updatePositionHistory(trains) {
        const now = Date.now();
        trains.forEach(train => {
            const pos = train.cars[0].leading.location;
            const prev = trainPositionHistory.get(train.name);
            let speed = 0;
            let direction = 'unknown';
            let isSpeedLost = false;

            if (prev && prev.timestamp) {
                const timeDiff = now - prev.timestamp;
                if (timeDiff > 50 && timeDiff < POSITION_HISTORY_TTL) {
                    const dx = pos.x - prev.x;
                    const dz = pos.z - prev.z;
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    speed = (distance / (timeDiff / 1000)) * 3.6;

                    if (speed > 5) {
                        direction = { dx, dz };
                    }
                }
            }

            if (speed <= 0 && prev && prev.speed > 0 && !prev.isSpeedLost) {
                isSpeedLost = true;
            } else if (speed > 0) {
                isSpeedLost = false;
            }

            if (isSpeedLost && prev && prev.speedLostTime) {
                const lostDuration = now - prev.speedLostTime;
                if (lostDuration > SPEED_LOST_TTL) {
                    isSpeedLost = false;
                }
            }

            trainPositionHistory.set(train.name, {
                x: pos.x,
                y: pos.y,
                z: pos.z,
                timestamp: now,
                speed: speed,
                direction: direction,
                isSpeedLost: isSpeedLost,
                speedLostTime: isSpeedLost ? (prev && prev.speedLostTime || now) : 0,
                isStopped: train.stopped === 'true',
                backwards: train.backwards === 'true'
            });
        });

        const expired = [];
        trainPositionHistory.forEach((value, key) => {
            if (now - value.timestamp > 60000) {
                expired.push(key);
            }
        });
        expired.forEach(key => trainPositionHistory.delete(key));
    }

    function getTrainState(trainName) {
        return trainPositionHistory.get(trainName) || null;
    }

    function connectSSE() {
        if (eventSource) {
            eventSource.close();
        }

        eventSource = new EventSource(API_URL);
        currentSource = 'sse';

        eventSource.onmessage = function (event) {
            try {
                let data = JSON.parse(event.data);
                if (!isValidTrainData(data)) {
                    console.warn('SSE 数据结构无效');
                    return;
                }

                const validTrains = filterValidTrains(data.trains);
                if (validTrains.length === 0) {
                    console.warn('SSE 返回的列车数据全部无效');
                    return;
                }

                data.trains = validTrains;

                if (!isOnline) {
                    isOnline = true;
                    emit('online', { source: 'sse' });
                }

                updatePositionHistory(validTrains);
                emit('data', data);
            } catch (error) {
                console.error('解析 SSE 数据失败:', error);
                emit('parse_error', { error: error });
            }
        };

        eventSource.onerror = function (error) {
            console.warn('SSE 连接错误，切换到备用数据源');
            eventSource.close();
            eventSource = null;
            isOnline = false;

            emit('offline', { source: 'sse', error: error });
            loadFallbackData();
            scheduleReconnect();
        };
    }

    function loadFallbackData() {
        currentSource = 'fallback';
        emit('fallback_start', { url: FALLBACK_URL });

        fetch(FALLBACK_URL)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(data => {
                if (!isValidTrainData(data)) {
                    console.warn('备用数据结构无效');
                    emit('fallback_error', { error: '数据结构无效' });
                    return;
                }

                const validTrains = filterValidTrains(data.trains);
                data.trains = validTrains;

                updatePositionHistory(validTrains);
                emit('data', data);
                emit('fallback_success', { url: FALLBACK_URL, count: validTrains.length });
            })
            .catch(error => {
                console.error('加载备用数据失败:', error);
                emit('fallback_error', { error: error });
            });
    }

    function scheduleReconnect() {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
            console.log('尝试重新连接 SSE...');
            emit('reconnect', {});
            connectSSE();
        }, RECONNECT_DELAY);
    }

    function loadNetworkData() {
        return fetch(NETWORK_URL)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(data => {
                if (data.stations) {
                    emit('network_loaded', { stations: data.stations });
                }
                return data;
            })
            .catch(error => {
                console.error('加载 network.json 失败:', error);
                emit('network_error', { error: error });
                throw error;
            });
    }

    function getDataSource() {
        return currentSource;
    }

    function isDataSourceOnline() {
        return isOnline;
    }

    function stop() {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        isOnline = false;
        currentSource = 'none';
    }

    function start() {
        connectSSE();
    }

    return {
        on,
        off,
        emit,
        start,
        stop,
        getTrainState,
        loadNetworkData,
        getDataSource,
        isDataSourceOnline,
        filterValidTrains,
        isValidTrain,
        API_URL,
        FALLBACK_URL,
        NETWORK_URL
    };
})();
