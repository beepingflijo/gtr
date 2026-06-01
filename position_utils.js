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
    
    // 玩家数据缓存
    let playersDataCache = null;
    let playersDataCacheTime = 0;
    const PLAYERS_CACHE_DURATION = 10000; // 10秒缓存
    let playersFetchPromise = null;
    
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
            return strings.trains_info.unknown_eta[lang] + ' ';
        }
        
        const train = trainsInfo.find(t => t.name === trainName);
        if (!train) {
            //console.warn(`未找到列车 ${trainName} 的型号信息`);
            return strings.trains_info.unknown_eta[lang] + ' ';
        }
        
        return train.series || strings.trains_info.unknown_eta[lang] + ' ';
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
     * 查找线路上最近的车站（方向感知版本）
     * @param {Object} line - 线路对象
     * @param {Object} position - 位置对象 {x, z}
     * @param {string} direction - 方向 ('up', 'down', null)
     * @param {Object} prevPosition - 上一位置，用于辅助方向判断
     * @returns {Object|null} 最近的车站信息
     */
    function findClosestStation(line, position, direction = null, prevPosition = null) {
        const stations = line.route.filter(node => node.type === 'station');
        if (stations.length === 0) return null;
        
        const stationDistances = [];
        
        for (let i = 0; i < stations.length; i++) {
            const station = stations[i];
            const stationCoords = findStationCoordinates(station.code, direction);
            
            for (const coord of stationCoords) {
                const distance = Math.sqrt(
                    Math.pow(position.x - coord.x, 2) +
                    Math.pow(position.z - coord.z, 2)
                );
                
                stationDistances.push({
                    station: station,
                    stationIndex: i,
                    distance: distance,
                    coordinates: coord
                });
            }
        }
        
        if (stationDistances.length === 0) return null;
        
        stationDistances.sort((a, b) => a.distance - b.distance);
        
        const STATION_THRESHOLD = 500;
        const nearestStation = stationDistances[0];
        
        if (nearestStation.distance <= STATION_THRESHOLD) {
            if (prevPosition && direction) {
                const currentDistToNearest = nearestStation.distance;
                const prevDistToNearest = Math.sqrt(
                    Math.pow(prevPosition.x - nearestStation.coordinates.x, 2) +
                    Math.pow(prevPosition.z - nearestStation.coordinates.z, 2)
                );
                
                const isApproaching = currentDistToNearest < prevDistToNearest;
                
                if (isApproaching) {
                    return nearestStation;
                } else {
                    const sortedByRouteIndex = stationDistances
                        .filter(sd => sd.distance <= STATION_THRESHOLD)
                        .sort((a, b) => {
                            if (direction === 'down') return a.stationIndex - b.stationIndex;
                            return b.stationIndex - a.stationIndex;
                        });
                    
                    if (sortedByRouteIndex.length > 0) {
                        return sortedByRouteIndex[0];
                    }
                }
            }
            
            return nearestStation;
        }
        
        const candidateStations = stationDistances.filter(sd => sd.distance <= STATION_THRESHOLD * 2);
        
        if (candidateStations.length > 1 && prevPosition && direction) {
            for (const candidate of candidateStations) {
                const currentDist = candidate.distance;
                const prevDist = Math.sqrt(
                    Math.pow(prevPosition.x - candidate.coordinates.x, 2) +
                    Math.pow(prevPosition.z - candidate.coordinates.z, 2)
                );
                
                if (currentDist < prevDist) {
                    return candidate;
                }
            }
        }
        
        return nearestStation;
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
     * 计算沿轨道到车站的距离（更精确）
     * @param {Object} line - 线路对象
     * @param {Object} position - 当前位置
     * @param {Object} station - 目标车站
     * @param {string} direction - 方向
     * @returns {number} 沿轨道的距离
     */
    function calculateTrackDistanceToStation(line, position, station, direction) {
        if (!line || !position || !station) return Infinity;
        
        const stations = line.route.filter(node => node.type === 'station');
        const stationIndex = stations.findIndex(s => s.code === station.code);
        
        if (stationIndex === -1) return calculateDistanceToStation(position, station, direction);
        
        let totalDistance = 0;
        let foundCurrentPosition = false;
        
        const tracks = line.route.filter(node => node.type === 'track');
        
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            if (!track.nodes || track.nodes.length < 2) continue;
            
            for (let j = 0; j < track.nodes.length - 1; j++) {
                const node1 = track.nodes[j];
                const node2 = track.nodes[j + 1];
                
                const distToSegment = distanceFromSegment(position, node1, node2);
                
                if (distToSegment < 50) {
                    foundCurrentPosition = true;
                    
                    const projection = projectPointOnSegment(position, node1, node2);
                    const distToNode2 = calculateDistance(projection, node2);
                    
                    totalDistance += distToNode2;
                    
                    for (let k = j + 1; k < track.nodes.length - 1; k++) {
                        totalDistance += calculateDistance(track.nodes[k], track.nodes[k + 1]);
                    }
                    
                    let remainingTracks = tracks.slice(i + 1);
                    let stationFound = false;
                    
                    for (const remainingTrack of remainingTracks) {
                        if (stationFound) break;
                        
                        const trackIndex = line.route.indexOf(remainingTrack);
                        const nextStation = line.route.find((node, idx) => 
                            idx > trackIndex && node.type === 'station'
                        );
                        
                        if (nextStation && nextStation.code === station.code) {
                            for (let k = 0; k < remainingTrack.nodes.length - 1; k++) {
                                totalDistance += calculateDistance(remainingTrack.nodes[k], remainingTrack.nodes[k + 1]);
                            }
                            stationFound = true;
                            break;
                        } else {
                            for (let k = 0; k < remainingTrack.nodes.length - 1; k++) {
                                totalDistance += calculateDistance(remainingTrack.nodes[k], remainingTrack.nodes[k + 1]);
                            }
                        }
                    }
                    
                    break;
                }
            }
            
            if (foundCurrentPosition) break;
        }
        
        if (!foundCurrentPosition) {
            return calculateDistanceToStation(position, station, direction);
        }
        
        return totalDistance;
    }

    /**
     * 将点投影到线段上
     * @param {Object} p - 点
     * @param {Object} v - 线段起点
     * @param {Object} w - 线段终点
     * @returns {Object} 投影点
     */
    function projectPointOnSegment(p, v, w) {
        const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.z - w.z, 2);
        if (l2 === 0) return { x: v.x, z: v.z };
        
        let t = ((p.x - v.x) * (w.x - v.x) + (p.z - v.z) * (w.z - v.z)) / l2;
        t = Math.max(0, Math.min(1, t));
        
        return {
            x: v.x + t * (w.x - v.x),
            z: v.z + t * (w.z - v.z)
        };
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
     * 获取玩家数据（带缓存和请求合并）
     * @returns {Promise<Array>} 玩家数据数组
     */
    function fetchPlayersDataInternal() {
        const now = Date.now();
        
        // 检查缓存是否有效
        if (playersDataCache && (now - playersDataCacheTime) < PLAYERS_CACHE_DURATION) {
            return Promise.resolve(playersDataCache);
        }
        
        // 如果已有请求在进行中，复用该请求
        if (playersFetchPromise) {
            return playersFetchPromise;
        }
        
        const timestamp = now;
        const playerDataUrl = `https://map.nitrogen.hydcraft.cn/up/world/world/${timestamp}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        playersFetchPromise = fetch(playerDataUrl, { 
            signal: controller.signal,
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            mode: 'cors'
        })
            .then(response => {
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                playersFetchPromise = null;
                if (data.players && data.players.length > 0) {
                    playersDataCache = data.players;
                    playersDataCacheTime = Date.now();
                    return data.players;
                }
                return [];
            })
            .catch(error => {
                clearTimeout(timeoutId);
                playersFetchPromise = null;
                console.warn('直接获取玩家数据失败，尝试代理:', error.message);
                return fetchPlayersViaProxy(playerDataUrl);
            });
        
        return playersFetchPromise;
    }
    
    /**
     * 通过代理获取玩家数据
     * @param {string} originalUrl - 原始URL
     * @returns {Promise<Array>} 玩家数据数组
     */
    function fetchPlayersViaProxy(originalUrl) {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(originalUrl)}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        return fetch(proxyUrl, { 
            signal: controller.signal,
            method: 'GET'
        })
            .then(response => {
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error(`Proxy error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                try {
                    let playersData;
                    if (data.contents) {
                        playersData = typeof data.contents === 'string' ? JSON.parse(data.contents) : data.contents;
                    } else {
                        playersData = data;
                    }
                    
                    if (playersData.players && playersData.players.length > 0) {
                        playersDataCache = playersData.players;
                        playersDataCacheTime = Date.now();
                        return playersData.players;
                    }
                } catch (parseError) {
                    console.error('解析代理数据失败:', parseError);
                }
                return [];
            })
            .catch(proxyError => {
                clearTimeout(timeoutId);
                console.warn('代理获取玩家数据也失败:', proxyError.message);
                return [];
            });
    }
    
    /**
     * 获取并显示玩家信息（兼容旧接口）
     * @param {Function} callback - 回调函数，接收玩家数据作为参数
     */
    function fetchAndDisplayPlayers(callback) {
        fetchPlayersDataInternal().then(function(players) {
            if (players.length > 0 && callback) {
                callback(players);
            }
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
        if (typeof WarningManager !== 'undefined') {
            const warnings = WarningManager.detectWarnings(train, position, trainItem, isAtStation);
            return {
                shouldShowWarning: warnings.length > 0,
                warningReasons: warnings.map(w => w.type)
            };
        }
        
        try {
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const currentTrainData = allTrainsData[train.name];
            let shouldShowWarning = false;
            let warningReasons = [];
            
            if (position && currentTrainData && currentTrainData.speed === 0) {
                const isAtStation = checkIfTrainAtStation(train.name, position);
                if (!isAtStation) {
                    shouldShowWarning = true;
                    warningReasons.push('zero_speed');
                }
            }
            
            if (currentTrainData && currentTrainData.timestamp) {
                const currentTime = Date.now();
                const timeSinceUpdate = currentTime - currentTrainData.timestamp;
                if (timeSinceUpdate > 180000) {
                    shouldShowWarning = true;
                    warningReasons.push('long_stop');
                }
            }
            
            if (trainItem && isAtStation) {
                const platformElement = trainItem.querySelector('.platform');
                if (platformElement) {
                    const platformText = platformElement.textContent.trim();
                    const platformNumber = platformText.replace(/[A-Za-z]/g, '');
                    let currentStationName = '';
                    const stationListItem = trainItem.closest('.station-list-item');
                    if (stationListItem) {
                        const stationNameElement = stationListItem.querySelector('.station-name');
                        if (stationNameElement) {
                            currentStationName = stationNameElement.textContent.trim();
                        }
                    }
                    const samePlatformTrains = [];
                    document.querySelectorAll('.station-list-item').forEach(stationElement => {
                        const stationNameElement = stationElement.querySelector('.station-name');
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
                    if (samePlatformTrains.length > 1) {
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
                        if (trainPositions.length > 1) {
                            const currentIndex = trainPositions.findIndex(pos => pos.name === train.name);
                            if (currentIndex > 0) {
                                shouldShowWarning = true;
                                warningReasons.push('platform_conflict');
                            }
                        }
                    }
                }
            }
            
            return { shouldShowWarning, warningReasons };
        } catch (e) {
            console.warn('检查列车警告条件时出错:', e);
            return { shouldShowWarning: false, warningReasons: [] };
        }
    }
    
    /**
     * 检查并更新列车警告状态
     * @param {Object} train - 列车对象
     * @param {Object} position - 列车位置
     */
    function checkAndUpdateTrainWarnings(train, position) {
        if (typeof WarningManager !== 'undefined') {
            WarningManager.updateWarningStateForTrainsInfo(train, position, strings, lang);
            return;
        }
        
        const isAtStation = checkIfTrainAtStation(train.name, position);
        const warningInfo = checkTrainWarnings(train, position);
        
        try {
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            if (!allTrainsData[train.name]) {
                allTrainsData[train.name] = {};
            }
            
            const previousWarningReasons = allTrainsData[train.name].warningReasons || [];
            const hadWarning = previousWarningReasons.length > 0;
            const hasWarning = warningInfo.shouldShowWarning;
            
            if (hasWarning) {
                allTrainsData[train.name].warningReasons = warningInfo.warningReasons;
            } else {
                delete allTrainsData[train.name].warningReasons;
            }
            
            localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
            
            if (hasWarning && !hadWarning) {
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
                
                if (typeof window.sendNetworkWarningNotification === 'function') {
                    window.sendNetworkWarningNotification(train.name, warningInfo.warningReasons, trainPosition);
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
        if (typeof WarningManager !== 'undefined') {
            WarningManager.updateWarningState(train, trainItem, isAtStation, strings, lang);
            return;
        }
        
        const warningInfo = checkTrainWarnings(train, null, trainItem, isAtStation);
        
        try {
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            if (!allTrainsData[train.name]) {
                allTrainsData[train.name] = {};
            }
            
            const previousWarningReasons = allTrainsData[train.name].warningReasons || [];
            const hadWarning = previousWarningReasons.length > 0;
            const hasWarning = warningInfo.shouldShowWarning;

            let trainPosition = null;
            if (train.cars && Array.isArray(train.cars) && train.cars.length > 0 && 
                train.cars[0].leading && train.cars[0].leading.location) {
                trainPosition = train.cars[0].leading.location;
            }
            
            const existingWarning = trainItem.querySelector('.warning');
            if (hasWarning && !existingWarning) {
                const warningSpan = document.createElement('span');
                warningSpan.className = 'warning';
                warningSpan.style.color = 'crimson';
                warningSpan.style.fontWeight = 'bold';
                warningSpan.textContent = '! ';
                trainItem.appendChild(warningSpan);
                trainItem.style.color = 'crimson';
                
                allTrainsData[train.name].warningReasons = warningInfo.warningReasons;
                localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
                
                if (!hadWarning && trainPosition) {
                    if (typeof window.sendNetworkWarningNotification === 'function') {
                        window.sendNetworkWarningNotification(train.name, warningInfo.warningReasons, trainPosition);
                    }
                }
            } else if (!hasWarning && existingWarning) {
                existingWarning.remove();
                trainItem.style.color = '';
                delete allTrainsData[train.name].warningReasons;
                localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
            } else if (hasWarning && existingWarning) {
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
            //console.log('开始检查列车接近玩家:', train.name);
            
            // 检查是否启用了通知功能
            const prefs = JSON.parse(localStorage.getItem('preferences') || '{}');
            if (!prefs.notifyTrainApproaching) {
                //console.log('列车接近通知功能未启用');
                return;
            }
            
            // 解析关注的玩家列表
            const players = followedPlayers.split(',').map(player => player.trim()).filter(player => player);
            if (players.length === 0) {
                //console.log('没有关注的玩家');
                return;
            }
            //console.log('关注的玩家列表:', players);
            
            // 获取列车位置
            if (!train.cars || !Array.isArray(train.cars) || train.cars.length === 0) {
                //console.log('列车车辆信息无效');
                return;
            }
            
            const trainPosition = train.cars[0].leading.location;
            if (!trainPosition) {
                //console.log('列车位置信息无效');
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
            
            //console.log(`列车信息: ${train.name}, 位置: (${trainPosition.x}, ${trainPosition.y}, ${trainPosition.z}), 速度: ${trainSpeed}km/h`);
            
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
                        //console.log(`近期已通知过玩家 ${player} 列车 ${train.name} 接近`);
                        //return;
                    }
                }
                
                // 获取玩家位置
                fetchAndDisplayPlayers((playersData) => {
                    const playerData = playersData.find(p => p.name === player);
                    if (!playerData) {
                        //console.log(`未找到玩家 ${player} 的位置信息`);
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
                    
                    //console.log(`列车 ${train.name} 与玩家 ${player} 之间的距离: ${distance} 米`);
                    
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
                                //console.log(`计算得到相对速度: ${relativeSpeed} km/h`);
                            }
                        }
                    }
                    
                    //console.log(`列车 ${train.name} 接近玩家 ${player}，距离: ${distance} 米，相对速度: ${relativeSpeed} km/h`);
                    
                    // 如果距离小于500米且相对速度大于20km/h，则发送通知
                    if (distance <= 500 && relativeSpeed > 20) {
                        //console.log(`列车 ${train.name} 接近玩家 ${player}，距离: ${distance} 米，相对速度: ${relativeSpeed} km/h`);
                        
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
                                    //console.log(`获取列车方向: ${trainDirection}`);
                                    directionText = ' ' + strings.lines_info[trainDirection][lang];
                                }
                            }
                        } catch (e) {
                            console.warn('获取列车方向时出错:', e);
                        }
                        
                        // 构造通知正文
                        const lineName = trainLine || '未知线路';
                        const series = trainSeries || strings.trains_info.unknown_eta[lang] + ' ';
                        const speed = Math.round(trainSpeed) || 0;
                        const count = carsCount || 0;
                        
                        const body = `${lineName}${directionText}, ${strings.lines_info.speed[lang]+speed}km/h\n${series+strings.trains_info.series[lang]}, ${count+strings.trains_info.cars[lang]}\n(${currentTrainData.position.x.toFixed(0)}, ${currentTrainData.position.y.toFixed(0)}, ${currentTrainData.position.z.toFixed(0)})`;
                        
                        // 发送通知
                        if (typeof window.sendTrainApproachingNotification === 'function') {
                            //console.log(`发送列车接近通知: ${train.name} 接近 ${player}`);
                            window.sendTrainApproachingNotification(train.name, player, body);
                        } else {
                            //console.log('sendTrainApproachingNotification 函数未定义');
                        }
                    }
                });
            });
        } catch (error) {
            console.error('检查列车接近玩家时出错:', error);
        }
    }
    
    // 公共接口
    function computeTrainDirection(trainName, carPos, isStopped) {
        let allTrainsData = {};
        try {
            const storedData = localStorage.getItem('all_trains_positions');
            if (storedData) allTrainsData = JSON.parse(storedData);
        } catch (e) {
            console.warn('无法解析列车位置数据:', e);
        }

        let previousTrainData = allTrainsData[trainName] || null;
        let direction = [0, 0];
        let speed = 0;
        const currentTime = Date.now();

        let prevSpeed = previousTrainData && previousTrainData.speed !== undefined ? previousTrainData.speed : 0;
        let isSpeedLost = previousTrainData && previousTrainData.isSpeedLost;
        let speedLostTime = previousTrainData && previousTrainData.speedLostTime ? previousTrainData.speedLostTime : 0;

        if (previousTrainData && previousTrainData.timestamp) {
            const timeDiff = currentTime - previousTrainData.timestamp;
            const speedLostDuration = currentTime - speedLostTime;

            if (timeDiff > 50 && timeDiff < 5000) {
                direction = [
                    carPos.x - previousTrainData.position.x,
                    carPos.z - previousTrainData.position.z
                ];

                const distance = Math.sqrt(
                    Math.pow(carPos.x - previousTrainData.position.x, 2) +
                    Math.pow(carPos.z - previousTrainData.position.z, 2)
                );

                const COORD_CHANGE_THRESHOLD = 0.1;
                const isCoordinateChanged = distance > COORD_CHANGE_THRESHOLD;

                speed = (distance / (timeDiff / 1000) * 3.6);
                
                if (speed <= 0) {
                    if (isCoordinateChanged && prevSpeed > 0) {
                        speed = prevSpeed;
                        isSpeedLost = false;
                        speedLostTime = 0;
                    } else if (!isSpeedLost) {
                        isSpeedLost = true;
                        speedLostTime = currentTime;
                    }
                } else {
                    isSpeedLost = false;
                    speedLostTime = 0;
                }
            } else if (timeDiff >= 5000) {
                const distance = Math.sqrt(
                    Math.pow(carPos.x - previousTrainData.position.x, 2) +
                    Math.pow(carPos.z - previousTrainData.position.z, 2)
                );
                const COORD_CHANGE_THRESHOLD = 0.1;
                const isCoordinateChanged = distance > COORD_CHANGE_THRESHOLD;

                if (isCoordinateChanged && prevSpeed > 0) {
                    speed = prevSpeed;
                    isSpeedLost = false;
                    speedLostTime = 0;
                } else if (isSpeedLost && speedLostDuration > 10000) {
                    isSpeedLost = false;
                    speedLostTime = 0;
                }
            }
        }

        if (!allTrainsData[trainName]) {
            allTrainsData[trainName] = {};
        }

        allTrainsData[trainName].position = { x: carPos.x, y: carPos.y, z: carPos.z };
        allTrainsData[trainName].timestamp = currentTime;
        allTrainsData[trainName].speed = speed;
        allTrainsData[trainName].isSpeedLost = isSpeedLost;
        allTrainsData[trainName].speedLostTime = speedLostTime;
        allTrainsData[trainName].isStopped = isStopped;

        if (isStopped) {
            allTrainsData[trainName].speed = 0;
        }

        try {
            localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
        } catch (e) {
            console.warn('无法存储列车位置数据:', e);
        }

        return direction;
    }

    function computeTrackDirection(directionVector, trackDirectionVector) {
        if (!directionVector || !trackDirectionVector) return 'unknown';

        const magDirection = Math.sqrt(directionVector[0] ** 2 + directionVector[1] ** 2);
        const magTrackDirection = Math.sqrt(trackDirectionVector[0] ** 2 + trackDirectionVector[1] ** 2);

        if (magDirection === 0 || magTrackDirection === 0) {
            return 'unknown';
        }

        const dotProd = directionVector[0] * trackDirectionVector[0] + directionVector[1] * trackDirectionVector[1];
        const cosAngle = dotProd / (magDirection * magTrackDirection);

        if (cosAngle > 0.1) {
            return 'down';
        } else if (cosAngle < -0.1) {
            return 'up';
        } else {
            return 'unknown';
        }
    }

    function getInheritedDirection(trainName) {
        try {
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const currentTrainData = allTrainsData[trainName];
            if (currentTrainData && currentTrainData.direction && currentTrainData.direction !== 'unknown') {
                return currentTrainData.direction;
            }
        } catch (e) { }
        return 'unknown';
    }

    function saveTrainDirection(trainName, carDirection, trainDirection) {
        try {
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            if (!allTrainsData[trainName]) allTrainsData[trainName] = {};
            allTrainsData[trainName].direction = carDirection;
            allTrainsData[trainName].directionText = trainDirection;
            localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
        } catch (e) {
            console.warn('保存列车方向信息时出错:', e);
        }
    }

    function resolveDirectionFromSpeed(trainName, carDirection) {
        try {
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const currentTrainData = allTrainsData[trainName];

            if (currentTrainData && currentTrainData.speed !== undefined && !currentTrainData.isSpeedLost) {
                if (currentTrainData.speed > 5) {
                    if (carDirection === 'unknown' && currentTrainData.direction !== 'unknown') {
                        return currentTrainData.direction;
                    }
                }
            }
        } catch (e) {
            console.warn('使用速度方向确定列车方向时出错:', e);
        }
        return carDirection;
    }

    function applyBackwardsDirection(train, carDirection) {
        if (train.backwards === 'true' && carDirection !== 'unknown') {
            return carDirection;
        }
        return carDirection;
    }

    /**
     * 检测列车是否在车站及确定停靠站台的公共方法
     *
     * 核心算法：
     *   1. 遍历指定线路的所有站点坐标，计算列车位置到每个站点的三维距离
     *   2. 选出距离最近的站点，若距离 <= atStationThreshold 则判定为"到站"
     *   3. 从站点坐标名中剥离站点三字码，得到站台编号
     *   4. 根据列车 stopped 状态格式化站台编号（运行中去除字母后缀并追加 '…'）
     *
     * @param {Object} train - 列车对象，需包含 name, stopped, cars 等字段
     * @param {Object} line - 线路对象，需包含 route 数组（含 type='station' 的节点）
     * @param {Object} [options] - 配置选项
     * @param {boolean} [options.checkBothEnds=false] - 是否同时检查头尾两端位置，取更近的一端
     * @param {number}  [options.atStationThreshold=200] - 判定到站的最大距离（米）
     * @param {boolean} [options.isGXTrain=false] - 是否为 GX 列车（用于站台显示特殊处理）
     * @param {boolean} [options.isStationInCurrentLine=false] - GX 列车是否在当前线路站点范围内
     * @returns {Object} 检测结果
     * @returns {boolean} result.isAtStation - 是否在车站
     * @returns {string}  result.stationName - 车站显示名称
     * @returns {string}  result.stationCode - 车站坐标全名（含站台后缀，如 "ABC1A"）
     * @returns {string}  result.platform - 格式化后的站台编号
     * @returns {Object|null} result.actualCarPos - 实际使用的车厢坐标 {x, y, z}
     * @returns {Object|null} result.stationNode - 匹配到的车站路由节点
     */
    function detectTrainAtStation(train, line, options) {
        const {
            checkBothEnds = false,
            atStationThreshold = 200,
            isGXTrain = false,
            isStationInCurrentLine = false
        } = options || {};

        const result = {
            isAtStation: false,
            stationName: '',
            stationCode: '',
            platform: '',
            actualCarPos: null,
            stationNode: null
        };

        if (!train || !line) return result;

        const cars = train.cars;
        if (!cars || !Array.isArray(cars) || cars.length === 0) return result;

        const leadingPos = cars[0].leading && cars[0].leading.location;
        if (!leadingPos) return result;

        const trailingPos = checkBothEnds
            && cars[cars.length - 1].trailing
            && cars[cars.length - 1].trailing.location;

        const positions = checkBothEnds && trailingPos
            ? [
                { pos: leadingPos, label: 'leading' },
                { pos: trailingPos, label: 'trailing' }
            ]
            : [{ pos: leadingPos, label: 'leading' }];

        const stations = line.route.filter(node => node.type === 'station');
        let closestDistance = Infinity;
        let closestCoord = null;
        let closestNode = null;
        let closestPosLabel = 'leading';

        for (const positionInfo of positions) {
            const pos = positionInfo.pos;
            for (const station of stations) {
                const stationCoords = findStationCoordinates(station.code);
                for (const coord of stationCoords) {
                    if (!coord || coord.x === undefined || coord.y === undefined || coord.z === undefined) {
                        continue;
                    }

                    const distance = Math.sqrt(
                        Math.pow(pos.x - coord.x, 2) +
                        Math.pow(pos.y - coord.y, 2) +
                        Math.pow(pos.z - coord.z, 2)
                    );

                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestCoord = coord;
                        closestNode = station;
                        closestPosLabel = positionInfo.label;
                    }
                }
            }
        }

        if (closestDistance <= atStationThreshold && closestCoord && closestNode) {
            result.isAtStation = true;
            result.stationName = getStationName(closestNode.code, lang);
            result.stationCode = closestCoord.name;
            result.stationNode = closestNode;

            if (checkBothEnds && trailingPos && closestPosLabel === 'trailing') {
                result.actualCarPos = trailingPos;
            } else {
                result.actualCarPos = leadingPos;
            }

            if (isGXTrain && !isStationInCurrentLine) {
                result.platform = '\u2026';
            } else {
                result.platform = closestCoord.name.replace(closestNode.code, '');
                if (train.stopped === 'false') {
                    result.platform = result.platform.replace(/[A-Za-z]/g, '') + '\u2026';
                }
            }
        }

        return result;
    }

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
        calculateTrackDistanceToStation,
        calculateDistance,
        projectPointOnSegment,
        fetchAndDisplayPlayers,
        displayPlayers,
        getStationCode,
        checkAndUpdateTrainWarnings,
        checkIfTrainAtStation,
        checkAndAddWarningSign,
        checkIfTrainAtAnyStation,
        getTrainDirection,
        checkTrainApproachingPlayers,
        computeTrainDirection,
        computeTrackDirection,
        getInheritedDirection,
        saveTrainDirection,
        resolveDirectionFromSpeed,
        applyBackwardsDirection,
        detectTrainAtStation
    };
})();