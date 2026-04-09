// position_utils.js - 处理列车和玩家位置相关的通用功能

/**
 * PositionUtils - 处理列车和玩家位置相关的通用功能模块
 */
const PositionUtils = (function() {
    // 私有变量和方法
    let trainsInfo = [];
    let stationsNetwork = [];
    let lines = [];
    let strings = {};
    let lang = 'zh_hans';
    
    /**
     * 初始化函数
     * @param {Object} data - 包含trainsInfo, stationsNetwork, lines, strings, lang等数据的对象
     */
    function init(data) {
        trainsInfo = data.trainsInfo || [];
        stationsNetwork = data.stationsNetwork || [];
        lines = data.lines || [];
        strings = data.strings || {};
        lang = data.lang || 'zh_hans';
    }
    
    /**
     * 获取列车限速
     * @param {string} trainName - 列车名称
     * @returns {number} 限速值(km/h)
     */
    function getTrainLimitSpeed(trainName) {
        if (!trainsInfo) {
            console.warn('Trains info data not loaded yet');
            return 360; // 默认限速360 km/h
        }
        
        const trainInfo = trainsInfo.find(train => train.name === trainName);
        if (trainInfo && trainInfo.maxSpeed) {
            return trainInfo.maxSpeed;
        } else {
            return 360; // 默认限速360 km/h
        }
    }
    
    /**
     * 根据列车名称获取线路信息
     * @param {string} trainName - 列车名称
     * @param {string} returnType - 返回类型 ('name' | 'id')
     * @returns {string|null} 线路名称或ID
     */
    function getLineForTrain(trainName, returnType = 'name') {
        if (!trainsInfo || !Array.isArray(trainsInfo)) {
            console.warn('trainsInfo 数据不可用');
            return null;
        }
        
        const train = trainsInfo.find(t => t.name === trainName);
        if (!train || !train.line) {
            //console.warn(`未找到列车 ${trainName} 的线路信息`);
            return null;
        }
        
        if (returnType === 'id') {
            return train.line;
        }
        
        // 根据线路ID获取线路名称
        if (lines && Array.isArray(lines)) {
            const line = lines.find(l => l.id === train.line);
            if (line && line.name) {
                return line.name[lang] || line.name.zh_hans || line.name.en || line.id;
            }
        }
        
        return train.line; // 如果找不到线路名称，返回线路ID
    }
    
    /**
     * 根据线路ID获取线路名称
     * @param {string} lineId - 线路ID
     * @returns {string} 线路名称
     */
    function getLineName(lineId = '') {
        const line = lines.find(line => line.id === lineId);
        return line ? line.name[lang] : '';
    }
    
    /**
     * 根据线路ID获取线路颜色
     * @param {string} lineId - 线路ID
     * @returns {string} 线路颜色
     */
    function getLineColor(lineId = '') {
        const line = lines.find(line => line.id === lineId);
        return line ? line.color : 'var(--color-text-secondary)';
    }
    
    /**
     * 根据列车名称获取列车型号
     * @param {string} trainName - 列车名称
     * @returns {string} 列车型号
     */
    function getSeriesForTrain(trainName) {
        if (!trainsInfo || !Array.isArray(trainsInfo)) {
            console.warn('trainsInfo 数据不可用');
            return '未知车型';
        }
        
        const train = trainsInfo.find(t => t.name === trainName);
        if (!train) {
            //console.warn(`未找到列车 ${trainName} 的型号信息`);
            return '未知车型';
        }
        
        return train.series || '未知车型';
    }
    
    /**
     * 在所有线路上查找最近的轨道
     * @param {Object} position - 位置对象 {x, y, z}
     * @returns {Object|null} 最近的轨道信息
     */
    function findClosestTrackOnAllLines(position) {
        let closestTrack = null;
        let minDistance = Infinity;
        
        for (const line of lines) {
            for (let i = 0; i < line.route.length; i++) {
                const segment = line.route[i];
                if (segment.type === 'track') {
                    for (let j = 0; j < segment.nodes.length - 1; j++) {
                        const node1 = segment.nodes[j];
                        const node2 = segment.nodes[j + 1];
                        const distance = distanceFromSegment(position, node1, node2);
                        
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestTrack = {
                                line: line,
                                segment: segment,
                                segmentIndex: i,
                                nodeIndex: j,
                                distance: distance
                            };
                        }
                    }
                }
            }
        }
        
        return closestTrack;
    }
    
    /**
     * 计算点到线段的距离
     * @param {Object} p - 点 {x, z}
     * @param {Object} v - 线段起点 {x, z}
     * @param {Object} w - 线段终点 {x, z}
     * @returns {number} 距离
     */
    function distanceFromSegment(p, v, w) {
        const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.z - w.z, 2);
        if (l2 === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.z - v.z, 2));
        
        let t = ((p.x - v.x) * (w.x - v.x) + (p.z - v.z) * (w.z - v.z)) / l2;
        t = Math.max(0, Math.min(1, t));
        const projection = {
            x: v.x + t * (w.x - v.x),
            z: v.z + t * (w.z - v.z)
        };
        return Math.sqrt(Math.pow(p.x - projection.x, 2) + Math.pow(p.z - projection.z, 2));
    }
    
    /**
     * 查找线路上最近的车站
     * @param {Object} line - 线路对象
     * @param {Object} position - 位置对象 {x, z}
     * @param {string} direction - 方向 ('up', 'down', null)
     * @returns {Object|null} 最近的车站信息
     */
    function findClosestStation(line, position, direction = null) {
        let closestStation = null;
        let minDistance = Infinity;
        
        for (let i = 0; i < line.route.length; i++) {
            const node = line.route[i];
            if (node.type === 'station') {
                const stationCoords = findStationCoordinates(node.code, direction);
                for (const coord of stationCoords) {
                    const distance = Math.sqrt(
                        Math.pow(position.x - coord.x, 2) +
                        Math.pow(position.z - coord.z, 2)
                    );
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestStation = {
                            station: node,
                            distance: distance,
                            coordinates: coord
                        };
                    }
                }
            }
        }
        
        return closestStation;
    }
    
    /**
     * 查找车站坐标
     * @param {string} stationCode - 车站代码
     * @param {string} filterType - 过滤类型 ('up', 'down', null)
     * @returns {Array} 车站坐标数组
     */
    function findStationCoordinates(stationCode, filterType = null) {
        if (!stationsNetwork) return [];
        
        let filteredStations = stationsNetwork
            .filter(station => station.name.startsWith(stationCode));
        
        if (filterType === 'up') {
            filteredStations = filteredStations.filter(station => /^[A-Z0-9]+[0-9]B$/.test(station.name));
        } else if (filterType === 'down') {
            filteredStations = filteredStations.filter(station => /^[A-Z0-9]+[0-9]A$/.test(station.name));
        }
        
        return filteredStations.map(station => ({
            name: station.name,
            x: station.location.x,
            y: station.location.y,
            z: station.location.z
        }));
    }
    
    /**
     * 获取列车行驶方向
     * @param {Object} line - 列车所在的线路
     * @param {Object} position - 列车当前位置
     * @param {Object} prevPosition - 列车上一位置
     * @returns {string} 列车行驶方向 ('up', 'down', 'unknown')
     */
    function getTrainDirection(line, position, prevPosition) {
        // 如果没有历史位置数据，则无法判断方向
        if (!prevPosition) {
            return 'unknown';
        }
        
        // 查找线路上所有车站
        const stations = line.route.filter(node => node.type === 'station');
        if (stations.length < 2) {
            return 'unknown';
        }
        
        // 计算当前点到各个车站的距离
        let minDistanceToStation = Infinity;
        let closestStationIndex = -1;
        
        for (let i = 0; i < stations.length; i++) {
            const stationCoords = findStationCoordinates(stations[i].code);
            for (const coord of stationCoords) {
                const distance = Math.sqrt(
                    Math.pow(position.x - coord.x, 2) +
                    Math.pow(position.z - coord.z, 2)
                );
                
                if (distance < minDistanceToStation) {
                    minDistanceToStation = distance;
                    closestStationIndex = i;
                }
            }
        }
        
        // 计算前一点到最近车站的距离
        const closestStationCoords = findStationCoordinates(stations[closestStationIndex].code);
        if (closestStationCoords.length === 0) {
            return 'unknown';
        }
        
        const closestCoord = closestStationCoords[0];
        const currentDistance = Math.sqrt(
            Math.pow(position.x - closestCoord.x, 2) +
            Math.pow(position.z - closestCoord.z, 2)
        );
        
        const prevDistance = Math.sqrt(
            Math.pow(prevPosition.x - closestCoord.x, 2) +
            Math.pow(prevPosition.z - closestCoord.z, 2)
        );
        
        // 如果当前距离小于前一点距离，则朝向该车站，否则远离
        if (currentDistance < prevDistance) {
            // 朝向车站，需要判断是上行还是下行
            return closestStationIndex < stations.length / 2 ? 'up' : 'down';
        } else if (currentDistance > prevDistance) {
            // 远离车站，方向相反
            return closestStationIndex < stations.length / 2 ? 'down' : 'up';
        }
        
        // 距离相等，无法判断方向
        return 'unknown';
    }
    
    /**
     * 根据方向查找下一站
     * @param {Object} line - 线路对象
     * @param {Object} currentStation - 当前车站
     * @param {string} direction - 方向 ('up', 'down')
     * @returns {Object|null} 下一站信息
     */
    function findNextStation(line, currentStation, direction) {
        const stationIndex = line.route.findIndex(node => 
            node.type === 'station' && node.code === currentStation.code);
        
        if (stationIndex === -1) return null;
        
        let nextStationIndex;
        if (direction === 'down') {
            for (let i = stationIndex + 1; i < line.route.length; i++) {
                if (line.route[i].type === 'station') {
                    nextStationIndex = i;
                    break;
                }
            }
        } else if (direction === 'up') {
            for (let i = stationIndex - 1; i >= 0; i--) {
                if (line.route[i].type === 'station') {
                    nextStationIndex = i;
                    break;
                }
            }
        }
        
        return nextStationIndex !== undefined ? line.route[nextStationIndex] : null;
    }
    
    /**
     * 获取车站名称
     * @param {string} stationCode - 车站代码
     * @param {string} language - 语言
     * @returns {string} 车站名称
     */
    function getStationName(stationCode, language) {
        if (!strings.station_names) return stationCode;
        
        const stationNames = strings.station_names;
        if (stationNames[stationCode]) {
            return stationNames[stationCode][language] || stationNames[stationCode].zh_hans || stationCode;
        }
        return stationCode;
    }
    
    /**
     * 计算到车站的距离
     * @param {Object} position - 位置对象
     * @param {Object} station - 车站对象
     * @param {string} direction - 方向
     * @returns {number} 距离
     */
    function calculateDistanceToStation(position, station, direction = null) {
        const stationCoords = findStationCoordinates(station.code, direction);
        if (stationCoords.length === 0) return Infinity;
        
        let minDistance = Infinity;
        for (const coord of stationCoords) {
            const distance = Math.sqrt(
                Math.pow(position.x - coord.x, 2) +
                Math.pow(position.z - coord.z, 2)
            );
            if (distance < minDistance) {
                minDistance = distance;
            }
        }
        
        return minDistance;
    }
    
    /**
     * 计算两点间距离
     * @param {Object} v - 点1
     * @param {Object} w - 点2
     * @returns {number} 距离
     */
    function calculateDistance(v, w) {
        return Math.sqrt(Math.pow(v.x - w.x, 2) + Math.pow(v.z - w.z, 2));
    }
    
    /**
     * 获取并显示玩家信息
     * @param {Function} callback - 回调函数，接收玩家数据作为参数
     */
    function fetchAndDisplayPlayers(callback) {
        const timestamp = Date.now();
        const playerDataUrl = `https://map.nitrogen.hydcraft.cn/up/world/world/${timestamp}`;
        
        // 添加超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
        
        fetch(playerDataUrl, { 
            signal: controller.signal,
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        })
            .then(response => {
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.players && data.players.length > 0) {
                    if (callback) callback(data.players);
                }
            })
            .catch(error => {
                clearTimeout(timeoutId);
                //console.warn('获取玩家数据失败:', error);
                
                // 如果直接访问失败，尝试通过代理访问
                const proxyUrls = [
                    `https://api.allorigins.win/get?url=${encodeURIComponent(playerDataUrl)}&callback=?`
                ];
                
                fetchProxyData(proxyUrls, 0, playerDataUrl, callback);
            });
    }
    
    /**
     * 通过代理获取玩家数据
     * @param {Array} proxyUrls - 代理URL数组
     * @param {number} index - 当前代理索引
     * @param {string} originalUrl - 原始URL
     * @param {Function} callback - 回调函数
     */
    function fetchProxyData(proxyUrls, index, originalUrl, callback) {
        if (index >= proxyUrls.length) {
            //console.warn('所有代理服务都尝试失败');
            return;
        }
        
        const proxyController = new AbortController();
        const proxyTimeoutId = setTimeout(() => proxyController.abort(), 10000); // 10秒超时
        
        fetch(proxyUrls[index], { 
            signal: proxyController.signal,
            method: 'GET'
        })
            .then(response => {
                clearTimeout(proxyTimeoutId);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // 处理allorigins.win返回的数据格式
                if (proxyUrls[index].includes('allorigins.win')) {
                    try {
                        if (typeof data === 'string') {
                            const jsonData = JSON.parse(data.replace(/^\?\(|\)$/g, ''));
                            if (jsonData.contents) {
                                const playersData = JSON.parse(jsonData.contents);
                                if (playersData.players && playersData.players.length > 0 && callback) {
                                    callback(playersData.players);
                                }
                            }
                        } else if (data.contents) {
                            const playersData = JSON.parse(data.contents);
                            if (playersData.players && playersData.players.length > 0 && callback) {
                                callback(playersData.players);
                            }
                        } else {
                            if (data.players && data.players.length > 0 && callback) {
                                callback(data.players);
                            }
                        }
                    } catch (parseError) {
                        console.error('解析代理返回数据失败:', parseError);
                        fetchProxyData(proxyUrls, index + 1, originalUrl, callback);
                    }
                } else {
                    if (data.players && data.players.length > 0 && callback) {
                        callback(data.players);
                    }
                }
            })
            .catch(proxyError => {
                clearTimeout(proxyTimeoutId);
                //console.warn(`通过代理${proxyUrls[index]}获取玩家数据失败:`, proxyError);
                fetchProxyData(proxyUrls, index + 1, originalUrl, callback);
            });
    }
    
    /**
     * 显示玩家信息
     * @param {Array} players - 玩家数组
     * @param {Function} shouldShowPlayers - 判断是否应该显示玩家的函数
     */
    function displayPlayers(players, shouldShowPlayers) {
        if (shouldShowPlayers && !shouldShowPlayers()) return;
        
        // 获取所有车站元素
        const stationElements = document.querySelectorAll('.station-list-item');
        
        // 为每个车站计算附近的玩家数量
        stationElements.forEach(stationElement => {
            const stationNameElement = stationElement.querySelector('.station-name');
            if (!stationNameElement) return;
            
            const stationName = stationNameElement.textContent.trim();
            
            // 查找车站坐标
            const stationCode = getStationCode(stationName);
            const stationCoords = findStationCoordinates(stationCode);
            if (!stationCoords) return;
            
            // 计算在该车站附近的玩家数量（距离小于200米）
            let nearbyPlayerCount = 0;
            let nearbyPlayers = [];
            players.forEach(player => {
                let minDistance = Infinity;
                for (const coord of stationCoords) {
                    const distance = Math.sqrt(
                        Math.pow(player.x - coord.x, 2) + 
                        Math.pow(player.z - coord.z, 2)
                    );
                    if (distance < minDistance) {
                        minDistance = distance;
                    }
                    
                    if (minDistance <= 200) {
                        nearbyPlayerCount++;
                        nearbyPlayers.push(player.name);
                        break;
                    }
                }
            });
            
            // 如果有玩家在附近，显示玩家数量
            if (nearbyPlayerCount > 0) {
                const trainContainer = stationElement.querySelector('.train-container');
                if (trainContainer) {
                    // 创建玩家数量显示元素
                    const playerItem = document.createElement('div');
                    playerItem.className = 'player-count-container';
                    playerItem.innerHTML = `
                        <span class="player-count">×${nearbyPlayerCount}</span>
                        <span class="material-symbols-outlined">
                        group
                        </span>
                    `;
                    playerItem.addEventListener('mouseover', () => {
                        const tooltip = document.createElement('div');
                        tooltip.className = 'tooltip player-tooltip';
                        tooltip.innerHTML = `
                            <div class="tooltip-title">
                                <span class="material-symbols-outlined">
                                group
                                </span>
                                <h4 class="tooltip-title-text">${strings.lines_info?.nearby_players?.[lang] || '附近玩家'}</h4>
                            </div>
                            <div class="tooltip-content">
                                <span class="tooltip-content-text">${nearbyPlayers.join('<br />')}</span>
                            </div>`;
                        playerItem.appendChild(tooltip);
                    });
                    playerItem.addEventListener('mouseout', () => {
                        const tooltip = playerItem.querySelector('.tooltip');
                        if (tooltip) playerItem.removeChild(tooltip);
                    });

                    playerItem.addEventListener('click', () => {
                        // 复制所有玩家ID，用逗号隔开
                        navigator.clipboard.writeText(nearbyPlayers.join(','));
                        showToast(strings.lines_info?.players_copied?.[lang] || '已复制玩家ID');
                    });
                    
                    if (!trainContainer.querySelector('.player-count')) {
                        trainContainer.appendChild(playerItem);
                    }
                }
            }
        });
    }
    
    /**
     * 根据显示名称查找车站代码
     * @param {string} displayName - 显示名称
     * @returns {string|null} 车站代码
     */
    function getStationCode(displayName) {
        if (!stationsNetwork) return null;
        
        for (const station of stationsNetwork) {
            const stationCode = station.name.match(/[A-Z]/g)?.slice(0, 3).join('') || '';
            if (getStationName(stationCode, lang) === displayName) {
                return stationCode;
            }
        }
        
        return null;
    }
    
    /**
     * 检查列车警告条件
     * @param {Object} train - 列车对象
     * @param {Object} position - 列车位置（可选）
     * @param {Element} trainItem - 列车DOM元素（可选）
     * @param {boolean} isAtStation - 是否在车站（可选）
     * @returns {Object} 警告信息对象
     */
    function checkTrainWarnings(train, position, trainItem, isAtStation) {
        try {
            // 从localStorage获取列车数据
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const currentTrainData = allTrainsData[train.name];
            
            // 检查是否需要添加警告标志
            let shouldShowWarning = false;
            let warningReasons = [];
            
            // 条件1: 列车在轨道上的车速为0且不在任何车站
            if (position && currentTrainData && currentTrainData.speed === 0) {
                // 检查列车是否在任何车站
                const isAtStation = checkIfTrainAtStation(train.name, position);
                if (!isAtStation) {
                    shouldShowWarning = true;
                    warningReasons.push('zero_speed');
                }
            }
            
            // 条件2: 列车长时间停止（超过3分钟）
            if (currentTrainData && currentTrainData.timestamp) {
                const currentTime = Date.now();
                const timeSinceUpdate = currentTime - currentTrainData.timestamp;
                // 3分钟 = 180000毫秒
                if (timeSinceUpdate > 180000) {
                    shouldShowWarning = true;
                    warningReasons.push('long_stop');
                }
            }
            
            // 条件3: 列车在车站内停靠超过3分钟
            if (isAtStation && currentTrainData && currentTrainData.timestamp && currentTrainData.speed < 10) {
                const currentTime = Date.now();
                const timeInStation = currentTime - currentTrainData.timestamp;
                // 3分钟 = 180000毫秒
                if (isAtStation && timeInStation > 180000) {
                    shouldShowWarning = true;
                    warningReasons.push('long_stop');
                }
            }
            
            // 条件4: 有多于一辆列车停靠在同一站台（不考虑AB后缀）且该列车不是离站台最近的列车
            if (trainItem && isAtStation) {
                // 获取当前列车所在站台（去除AB后缀）
                const platformElement = trainItem.querySelector('.platform');
                if (platformElement) {
                    const platformText = platformElement.textContent.trim();
                    const platformNumber = platformText.replace(/[A-Za-z]/g, '');
                    
                    // 获取当前列车所在的车站名称
                    let currentStationName = '';
                    const stationListItem = trainItem.closest('.station-list-item');
                    if (stationListItem) {
                        const stationNameElement = stationListItem.querySelector('.station-name');
                        if (stationNameElement) {
                            currentStationName = stationNameElement.textContent.trim();
                        }
                    }
                    
                    // 查找同一车站内相同站台编号的其他列车
                    const samePlatformTrains = [];
                    document.querySelectorAll('.station-list-item').forEach(stationElement => {
                        const stationNameElement = stationElement.querySelector('.station-name');
                        // 确保是同一个车站
                        if (stationNameElement && stationNameElement.textContent.trim() === currentStationName) {
                            const trainContainer = stationElement.querySelector('.train-container');
                            if (trainContainer) {
                                const trains = trainContainer.querySelectorAll('.train-item');
                                trains.forEach(trainEl => {
                                    const platElement = trainEl.querySelector('.platform');
                                    if (platElement) {
                                        const platText = platElement.textContent.trim();
                                        const platNumber = platText.replace(/[A-Za-z]/g, '');
                                        if (platNumber === platformNumber) {
                                            const trainNameElement = trainEl.querySelector('.train-name');
                                            if (trainNameElement) {
                                                samePlatformTrains.push({
                                                    element: trainEl,
                                                    trainName: trainNameElement.textContent.trim()
                                                });
                                            }
                                        }
                                    }
                                });
                            }
                        }
                    });
                    
                    // 如果有多于一辆列车在同一站台
                    if (samePlatformTrains.length > 1) {
                        // 获取所有列车的坐标数据
                        const trainPositions = [];
                        samePlatformTrains.forEach(trainObj => {
                            const trainData = allTrainsData[trainObj.trainName];
                            if (trainData && trainData.position) {
                                trainPositions.push({
                                    element: trainObj.element,
                                    position: trainData.position,
                                    name: trainObj.trainName
                                });
                            }
                        });
                        
                        // 简化处理：如果有多个列车在同一站台，除了第一个，其他都显示警告
                        if (trainPositions.length > 1) {
                            // 找到当前列车在数组中的位置
                            const currentIndex = trainPositions.findIndex(pos => pos.name === train.name);
                            // 如果不是第一个（最靠近的），则显示警告
                            if (currentIndex > 0) {
                                shouldShowWarning = true;
                                warningReasons.push('platform_conflict');
                            }
                        }
                    }
                }
            }
            
            return {
                shouldShowWarning,
                warningReasons
            };
        } catch (e) {
            console.warn('检查列车警告条件时出错:', e);
            return {
                shouldShowWarning: false,
                warningReasons: []
            };
        }
    }
    
    /**
     * 检查并更新列车警告状态
     * @param {Object} train - 列车对象
     * @param {Object} position - 列车位置
     */
    function checkAndUpdateTrainWarnings(train, position) {
        
        const isAtStation = checkIfTrainAtStation(train.name, position);
        // 使用统一的警告检测函数
        const warningInfo = checkTrainWarnings(train, position);
        
        try {
            // 从localStorage获取列车数据
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            
            // 检查是否已有列车数据
            if (!allTrainsData[train.name]) {
                allTrainsData[train.name] = {};
            }
            
            // 获取之前的警告状态
            const previousWarningReasons = allTrainsData[train.name].warningReasons || [];
            const hadWarning = previousWarningReasons.length > 0;
            const hasWarning = warningInfo.shouldShowWarning;
            
            // 更新localStorage中的警告信息
            if (hasWarning) {
                allTrainsData[train.name].warningReasons = warningInfo.warningReasons;
            } else {
                delete allTrainsData[train.name].warningReasons;
            }
            
            localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
            
            // 只有在首次触发警告时才发送通知（之前没有警告，现在有警告）
            if (hasWarning && !hadWarning) {
                // 获取列车速度
                let trainSpeed = 0;
                if (allTrainsData[train.name] && allTrainsData[train.name].speed !== undefined) {
                    trainSpeed = allTrainsData[train.name].speed;
                }
                
                // 尝试获取列车位置信息
                let trainPosition = null;
                try {
                    if (allTrainsData[train.name] && allTrainsData[train.name].position) {
                        trainPosition = {
                            x: allTrainsData[train.name].position.x,
                            y: allTrainsData[train.name].position.y,
                            z: allTrainsData[train.name].position.z
                        };
                    }
                } catch (e) {
                    console.warn('获取列车位置信息失败:', e);
                }
                
                // 调用script.js中的通知函数发送网络故障预警通知
                if (typeof window.sendNetworkWarningNotification === 'function') {
                    window.sendNetworkWarningNotification(
                        train.name, 
                        warningInfo.warningReasons, 
                        trainPosition
                    );
                }
            }
        } catch (e) {
            console.warn('检查并更新列车警告状态时出错:', e);
        }
    }
    
    /**
     * 检查列车是否在车站
     * @param {string} trainName - 列车名称
     * @param {Object} position - 列车位置
     * @returns {boolean} 是否在车站
     */
    function checkIfTrainAtStation(trainName, position) {
        try {
            // 查找列车所在的线路
            let trainLine = null;
            
            // 优先通过trains_info.json数据获取列车线路信息
            const lineFromData = getLineForTrain(trainName, 'id');
            if (lineFromData) {
                trainLine = lines.find(line => line.id === lineFromData);
            }
            
            // 如果trains_info.json中没有线路信息，才通过位置信息来判断列车在哪条线路上
            if (!trainLine) {
                const closestTrack = findClosestTrackOnAllLines(position);
                if (closestTrack) {
                    trainLine = closestTrack.line;
                }
            }
            
            // 检查列车是否在车站范围内
            if (trainLine) {
                // 检查列车是否在车站
                for (const node of trainLine.route) {
                    if (node.type === 'station') {
                        const stationCoords = findStationCoordinates(node.code);
                        for (const coord of stationCoords) {
                            // 确保坐标数据存在
                            if (!coord || coord.x === undefined || coord.y === undefined || coord.z === undefined) {
                                continue;
                            }
                            
                            const distance = Math.sqrt(
                                Math.pow(position.x - coord.x, 2) + 
                                Math.pow(position.y - coord.y, 2) + 
                                Math.pow(position.z - coord.z, 2)
                            );
                            
                            if (distance <= 200) {
                                return true;
                            }
                        }
                    }
                }
            }
            
            return false;
        } catch (e) {
            console.warn('检查列车是否在车站时出错:', e);
            return false;
        }
    }
    
    /**
     * 检查并添加警告标志
     * @param {Object} train - 列车对象
     * @param {Element} trainItem - 列车DOM元素
     * @param {boolean} isAtStation - 是否在车站
     */
    function checkAndAddWarningSign(train, trainItem, isAtStation) {
        // 使用统一的警告检测函数
        const warningInfo = checkTrainWarnings(train, null, trainItem, isAtStation);
        
        // 从localStorage获取列车数据
        try {
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            
            // 检查是否已有列车数据
            if (!allTrainsData[train.name]) {
                allTrainsData[train.name] = {};
            }
            
            // 获取之前的警告状态
            const previousWarningReasons = allTrainsData[train.name].warningReasons || [];
            const hadWarning = previousWarningReasons.length > 0;
            const hasWarning = warningInfo.shouldShowWarning;

            // 安全地获取列车位置
            let trainPosition = null;
            if (train.cars && Array.isArray(train.cars) && train.cars.length > 0 && 
                train.cars[0].leading && train.cars[0].leading.location) {
                trainPosition = train.cars[0].leading.location;
            }

            let notified = false;
            
            // 根据检查结果添加或移除警告标志
            const existingWarning = trainItem.querySelector('.warning');
            if (hasWarning && !existingWarning) {
                // 添加警告标志
                const warningSpan = document.createElement('span:not(.material-symbols-outlined)');
                warningSpan.className = 'warning';
                warningSpan.style.color = 'crimson';
                warningSpan.style.fontWeight = 'bold';
                warningSpan.textContent = '! ';
                trainItem.appendChild(warningSpan);
                trainItem.style.color = 'crimson';
                
                // 保存警告原因到localStorage
                allTrainsData[train.name].warningReasons = warningInfo.warningReasons;
                localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
                
                // 只有在首次触发警告时才发送通知（之前没有警告，现在有警告）
                if (!hadWarning && trainPosition) {
                    // 获取列车速度
                    let trainSpeed = 0;
                    if (allTrainsData[train.name] && allTrainsData[train.name].speed !== undefined) {
                        trainSpeed = allTrainsData[train.name].speed;
                    }
                    
                    // 调用script.js中的通知函数发送网络故障预警通知
                    if (typeof window.sendNetworkWarningNotification === 'function') {
                        window.sendNetworkWarningNotification(
                            train.name, 
                            warningInfo.warningReasons, 
                            trainPosition
                        );
                    }
                }
            } else if (!hasWarning && existingWarning) {
                // 移除警告标志
                existingWarning.remove();
                trainItem.style.color = ''; // 恢复默认颜色
                
                // 清除localStorage中的警告原因
                delete allTrainsData[train.name].warningReasons;
                localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
            } else if (hasWarning && existingWarning) {
                // 如果已经有警告标志，但警告原因可能发生变化，更新localStorage
                allTrainsData[train.name].warningReasons = warningInfo.warningReasons;
                localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
            }
        } catch (e) {
            console.warn('检查列车警告标志时出错:', e);
        }
    }
    
    /**
     * 检查列车是否在任何车站
     * @param {string} trainName - 列车名称
     * @returns {boolean} 是否在任何车站
     */
    function checkIfTrainAtAnyStation(trainName) {
        // 检查页面上是否存在该列车的车站元素
        const trainElements = document.querySelectorAll('.train-item');
        for (const trainElement of trainElements) {
            const trainNameElement = trainElement.querySelector('.train-name');
            if (trainNameElement && trainNameElement.textContent.includes(trainName)) {
                // 如果列车元素有.platform子元素，则表示在车站
                const platformElement = trainElement.querySelector('.platform');
                if (platformElement) {
                    return true;
                }
            }
        }
        
        // 如果在当前页面没有找到，进一步检查列车是否属于其他线路的车站
        // 通过列车名称前缀判断所属线路
        const linePrefix = trainName.match(/^([A-Z]+)/)?.[1];
        if (linePrefix) {
            // 检查所有线路中是否有与列车前缀匹配的线路
            const belongsToLine = lines?.find(line => line.id === linePrefix);
            if (belongsToLine) {
                // 如果列车属于某条线路，那么它在该线路的车站上是正常的，不应触发警告
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 检查列车是否接近关注的玩家
     * @param {Object} train - 列车对象
     * @param {string} followedPlayers - 关注的玩家列表(逗号分隔)
     */
    function checkTrainApproachingPlayers(train, followedPlayers) {
        try {
            console.log('开始检查列车接近玩家:', train.name);
            
            // 检查是否启用了通知功能
            const prefs = JSON.parse(localStorage.getItem('preferences') || '{}');
            if (!prefs.notifyTrainApproaching) {
                console.log('列车接近通知功能未启用');
                return;
            }
            
            // 解析关注的玩家列表
            const players = followedPlayers.split(',').map(player => player.trim()).filter(player => player);
            if (players.length === 0) {
                console.log('没有关注的玩家');
                return;
            }
            console.log('关注的玩家列表:', players);
            
            // 获取列车位置
            if (!train.cars || !Array.isArray(train.cars) || train.cars.length === 0) {
                console.log('列车车辆信息无效');
                return;
            }
            
            const trainPosition = train.cars[0].leading.location;
            if (!trainPosition) {
                console.log('列车位置信息无效');
                return;
            }
            
            // 获取列车速度
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const currentTrainData = allTrainsData[train.name];
            const trainSpeed = currentTrainData && currentTrainData.speed !== undefined ? currentTrainData.speed : 0;
            
            // 获取列车线路和型号信息
            const trainLine = getLineForTrain(train.name);
            const trainSeries = getSeriesForTrain(train.name);
            const carsCount = train.cars.length;
            
            console.log(`列车信息: ${train.name}, 位置: (${trainPosition.x}, ${trainPosition.y}, ${trainPosition.z}), 速度: ${trainSpeed}km/h`);
            
            // 检查每个关注的玩家
            players.forEach(player => {
                // 检查是否已经通知过该列车接近此玩家，避免重复通知
                const notificationKey = `${train.name}-${player}-approaching`;
                const notified = sessionStorage.getItem(notificationKey);
                if (notified) {
                    // 如果已经通知过，则在一定时间后清除标记（比如5分钟）
                    const notifiedTime = parseInt(notified);
                    const currentTime = Date.now();
                    if (currentTime - notifiedTime < 5 * 60 * 1000) { // 5分钟内不再重复通知
                        console.log(`近期已通知过玩家 ${player} 列车 ${train.name} 接近`);
                        //return;
                    }
                }
                
                // 获取玩家位置
                fetchAndDisplayPlayers((playersData) => {
                    const playerData = playersData.find(p => p.name === player);
                    if (!playerData) {
                        console.log(`未找到玩家 ${player} 的位置信息`);
                        return;
                    }
                    
                    const playerPosition = {
                        x: playerData.x,
                        y: playerData.y,
                        z: playerData.z
                    };
                    
                    // 计算列车与玩家之间的距离
                    const distance = Math.sqrt(
                        Math.pow(trainPosition.x - playerPosition.x, 2) +
                        Math.pow(trainPosition.y - playerPosition.y, 2) +
                        Math.pow(trainPosition.z - playerPosition.z, 2)
                    );
                    
                    console.log(`列车 ${train.name} 与玩家 ${player} 之间的距离: ${distance} 米`);
                    
                    // 基于单位时间内列车和玩家距离的变化量来计算相对速度
                    let relativeSpeed = trainSpeed; // 默认使用列车速度
                    
                    // 基于单位时间内距离的变化量来计算相对速度
                    if (currentTrainData && currentTrainData.position && currentTrainData.timestamp) {
                        const playersPositions = JSON.parse(localStorage.getItem('players_positions') || '{}');
                        const playerPrevData = playersPositions[player];
                        
                        if (playerPrevData && playerPrevData.timestamp) {
                            // 计算当前时刻列车与玩家之间的距离
                            const currentDistance = Math.sqrt(
                                Math.pow(trainPosition.x - playerPosition.x, 2) +
                                Math.pow(trainPosition.y - playerPosition.y, 2) +
                                Math.pow(trainPosition.z - playerPosition.z, 2)
                            );
                            
                            // 计算历史时刻列车与玩家之间的距离
                            const previousDistance = Math.sqrt(
                                Math.pow(currentTrainData.position.x - playerPrevData.x, 2) +
                                Math.pow(currentTrainData.position.y - playerPrevData.y, 2) +
                                Math.pow(currentTrainData.position.z - playerPrevData.z, 2)
                            );
                            
                            // 计算时间差（毫秒）
                            const timeDiffMs = Date.now() - Math.max(currentTrainData.timestamp, playerPrevData.timestamp);
                            
                            // 只有当时间差在合理范围内时才计算（避免数据更新不及时导致的异常值）
                            // 合理范围：50ms 到 5s
                            if (timeDiffMs > 50 && timeDiffMs < 5000) {
                                // 计算单位时间内距离的变化量（mm/ms -> km/h）
                                // 先计算距离变化量(mm)和时间变化量(ms)
                                const distanceDiff = currentDistance - previousDistance; // mm
                                // 转换为 km/h: (distanceDiff / timeDiffMs) * 3600 -> km/h
                                relativeSpeed = Math.abs(distanceDiff / timeDiffMs) * 3.6;
                                console.log(`计算得到相对速度: ${relativeSpeed} km/h`);
                            }
                        }
                    }
                    
                    console.log(`列车 ${train.name} 接近玩家 ${player}，距离: ${distance} 米，相对速度: ${relativeSpeed} km/h`);
                    
                    // 如果距离小于500米且相对速度大于20km/h，则发送通知
                    if (distance <= 500 && relativeSpeed > 20) {
                        console.log(`列车 ${train.name} 接近玩家 ${player}，距离: ${distance} 米，相对速度: ${relativeSpeed} km/h`);
                        
                        // 标记已通知
                        sessionStorage.setItem(notificationKey, Date.now().toString());
                        
                        // 获取列车方向
                        let directionText = strings.trains_info.unknown_direction[lang];
                        try {
                            if (typeof window.lines !== 'undefined') {
                                const lineId = getLineForTrain(train.name, 'id');
                                const line = window.lines.find(l => l.id === lineId);
                                if (line && currentTrainData && currentTrainData.position) {
                                    // 简化方向判断逻辑
                                    const trainDirection = 'running_direction_'+getTrainDirection(line, currentTrainData.position, trainPosition);
                                    console.log(`获取列车方向: ${trainDirection}`);
                                    directionText = ' ' + strings.lines_info[trainDirection][lang];
                                }
                            }
                        } catch (e) {
                            console.warn('获取列车方向时出错:', e);
                        }
                        
                        // 构造通知正文
                        const lineName = trainLine || '未知线路';
                        const series = trainSeries || '未知车型';
                        const speed = Math.round(trainSpeed) || 0;
                        const count = carsCount || 0;
                        
                        const body = `${lineName}${directionText}, ${strings.lines_info.speed[lang]+speed}km/h\n${series+strings.trains_info.series[lang]}, ${count+strings.trains_info.cars[lang]}\n(${currentTrainData.position.x.toFixed(0)}, ${currentTrainData.position.y.toFixed(0)}, ${currentTrainData.position.z.toFixed(0)})`;
                        
                        // 发送通知
                        if (typeof window.sendTrainApproachingNotification === 'function') {
                            console.log(`发送列车接近通知: ${train.name} 接近 ${player}`);
                            window.sendTrainApproachingNotification(train.name, player, body);
                        } else {
                            console.log('sendTrainApproachingNotification 函数未定义');
                        }
                    }
                });
            });
        } catch (error) {
            console.error('检查列车接近玩家时出错:', error);
        }
    }
    
    // 公共接口
    return {
        init,
        getTrainLimitSpeed,
        getLineForTrain,
        getLineName,
        getLineColor,
        getSeriesForTrain,
        findClosestTrackOnAllLines,
        distanceFromSegment,
        findClosestStation,
        findStationCoordinates,
        findNextStation,
        getStationName,
        calculateDistanceToStation,
        calculateDistance,
        fetchAndDisplayPlayers,
        displayPlayers,
        getStationCode,
        checkAndUpdateTrainWarnings,
        checkIfTrainAtStation,
        checkAndAddWarningSign,
        checkIfTrainAtAnyStation,
        getTrainDirection,
        checkTrainApproachingPlayers
    };
})();