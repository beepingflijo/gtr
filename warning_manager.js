const WarningManager = (function() {
    const CONFIG = {
        ZERO_SPEED_THRESHOLD: 0,
        ZERO_SPEED_DURATION: 180000,
        LONG_STOP_DURATION: 300000,
        AT_STATION_THRESHOLD: 200,
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
        WARNING_COLORS: {
            warning: 'crimson',
            critical: 'crimson'
        }
    };

    const WARNING_API_URL = './api/warning';
    const ZERO_SPEED_START_PREFIX = 'zero_speed_start_';
    const WARNING_START_TIMES_KEY = 'warning_start_times';
    let reportedWarnings = new Map();
    let pendingReports = new Map();

    // 获取所有警告开始时间的统一存储
    function getAllWarningStartTimes() {
        try {
            const stored = localStorage.getItem(WARNING_START_TIMES_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            return {};
        }
    }

    // 保存所有警告开始时间到统一存储
    function setAllWarningStartTimes(data) {
        try {
            localStorage.setItem(WARNING_START_TIMES_KEY, JSON.stringify(data));
        } catch (e) { }
    }

    // 获取特定警告的开始时间
    function getWarningStartTime(trainId, warningType) {
        try {
            const allTimes = getAllWarningStartTimes();
            if (allTimes[trainId] && allTimes[trainId][warningType]) {
                return allTimes[trainId][warningType].startTime;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    // 设置特定警告的开始时间
    function setWarningStartTime(trainId, warningType, timestamp) {
        try {
            const allTimes = getAllWarningStartTimes();
            if (!allTimes[trainId]) {
                allTimes[trainId] = {};
            }
            allTimes[trainId][warningType] = {
                startTime: timestamp,
                trainId: trainId,
                warningType: warningType,
                createdAt: new Date().toISOString()
            };
            setAllWarningStartTimes(allTimes);
        } catch (e) { }
    }

    // 清除特定警告的开始时间
    function clearWarningStartTime(trainId, warningType) {
        try {
            const allTimes = getAllWarningStartTimes();
            if (allTimes[trainId] && allTimes[trainId][warningType]) {
                delete allTimes[trainId][warningType];
                // 如果该列车没有其他警告，删除整个列车条目
                if (Object.keys(allTimes[trainId]).length === 0) {
                    delete allTimes[trainId];
                }
                setAllWarningStartTimes(allTimes);
            }
        } catch (e) { }
    }

    // 清除特定列车的所有警告开始时间
    function clearAllWarningStartTimesForTrain(trainId) {
        try {
            const allTimes = getAllWarningStartTimes();
            if (allTimes[trainId]) {
                delete allTimes[trainId];
                setAllWarningStartTimes(allTimes);
            }
        } catch (e) { }
    }

    // 向后兼容：获取零速度开始时间
    function getZeroSpeedStartTime(trainName) {
        return getWarningStartTime(trainName, CONFIG.WARNING_TYPES.ZERO_SPEED);
    }

    // 向后兼容：设置零速度开始时间
    function setZeroSpeedStartTime(trainName, timestamp) {
        setWarningStartTime(trainName, CONFIG.WARNING_TYPES.ZERO_SPEED, timestamp);
    }

    // 向后兼容：清除零速度开始时间
    function clearZeroSpeedStartTime(trainName) {
        clearWarningStartTime(trainName, CONFIG.WARNING_TYPES.ZERO_SPEED);
    }

    function getApiBaseUrl() {
        return WARNING_API_URL;
    }

    function isUsingExampleData() {
        try {
            if (typeof TrainDataSource !== 'undefined' && typeof TrainDataSource.getDataSource === 'function') {
                return TrainDataSource.getDataSource() === 'fallback';
            }
        } catch (e) { }
        return false;
    }

    function resolveLocationInfo(position, trainId) {
        const result = {
            station: '',
            line: '',
            position: '',
            x_coordinate: position ? position.x : null,
            z_coordinate: position ? position.z : null
        };

        if (!position || typeof PositionUtils === 'undefined') return result;

        try {
            const closestTrack = PositionUtils.findClosestTrackOnAllLines(position);
            if (closestTrack && closestTrack.line) {
                result.line = closestTrack.line.name || '';

                const closestStation = PositionUtils.findClosestStation(closestTrack.line, position);
                if (closestStation && closestStation.station) {
                    result.station = PositionUtils.getStationName(closestStation.station.code, lang) || closestStation.station.code;
                    const dist = Math.round(closestStation.distance);
                    const direction = closestStation.coordinates
                        ? (position.x > closestStation.coordinates.x ? '南' : '北')
                        : '';
                    result.position = `${result.station}${direction ? direction + '约' : ''}${dist}m处`;
                }
            }
        } catch (e) {
            console.warn('[WarningManager] 解析位置信息时出错:', e);
        }

        return result;
    }

    async function reportWarningToServer(trainId, warningType, warningParams, position) {
        const key = `${trainId}-${warningType}`;

        if (isUsingExampleData()) {
            return { success: false, skipped: true, reason: 'example_data' };
        }

        if (reportedWarnings.has(key)) {
            return { success: false, skipped: true, reason: 'already_reported' };
        }

        if (pendingReports.has(key)) {
            return { success: false, skipped: true, reason: 'report_pending' };
        }

        pendingReports.set(key, true);

        const locationInfo = resolveLocationInfo(position, trainId);

        try {
            const response = await fetch(`${getApiBaseUrl()}/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trainId,
                    warningType,
                    warningParams,
                    position,
                    locationInfo,
                    timestamp: new Date().toISOString()
                })
            });
            const result = await response.json();
            if (result.success) {
                reportedWarnings.set(key, result.data.id);
                console.log(`[WarningManager] 警告已上报服务器: ${trainId} - ${warningType}`);
            }
            return result;
        } catch (error) {
            console.warn('[WarningManager] 上报警告失败:', error);
            return { success: false, error };
        } finally {
            pendingReports.delete(key);
        }
    }

    async function resolveWarningOnServer(trainId, warningType, reason) {
        try {
            const response = await fetch(`${getApiBaseUrl()}/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trainId,
                    warningType,
                    resolveReason: reason || 'Warning condition cleared',
                    timestamp: new Date().toISOString()
                })
            });
            const result = await response.json();
            if (result.success) {
                const key = `${trainId}-${warningType}`;
                reportedWarnings.delete(key);
                console.log(`[WarningManager] 警告已从服务器撤回: ${trainId} - ${warningType}`);
            }
            return result;
        } catch (error) {
            console.warn('[WarningManager] 撤回警告失败:', error);
            return { success: false, error };
        }
    }

    function checkIfTrainAtStation(trainName, position) {
        if (typeof PositionUtils !== 'undefined' && PositionUtils.checkIfTrainAtStation) {
            return PositionUtils.checkIfTrainAtStation(trainName, position);
        }
        return false;
    }

    function checkPlatformConflict(train, trainItem, isAtStation) {
        if (!CONFIG.PLATFORM_CONFLICT_ENABLED || !trainItem || !isAtStation) {
            return false;
        }

        try {
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const platformElement = trainItem.querySelector('.platform');
            if (!platformElement) return false;

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

            if (!currentStationName || !platformNumber) return false;

            const samePlatformTrains = [];
            document.querySelectorAll('.station-list-item').forEach(stationElement => {
                const stationNameElement = stationElement.querySelector('.station-name');
                if (stationNameElement && stationNameElement.textContent.trim() === currentStationName) {
                    stationElement.querySelectorAll('.train-item').forEach(trainElement => {
                        const platformEl = trainElement.querySelector('.platform');
                        const trainNameEl = trainElement.querySelector('.train-name');
                        if (platformEl && trainNameEl) {
                            const otherPlatform = platformEl.textContent.trim().replace(/[A-Za-z]/g, '');
                            if (otherPlatform === platformNumber) {
                                samePlatformTrains.push({
                                    trainName: trainNameEl.textContent,
                                    element: trainElement
                                });
                            }
                        }
                    });
                }
            });

            if (samePlatformTrains.length > 1) {
                const currentIndex = samePlatformTrains.findIndex(t => t.trainName === train.name);
                return currentIndex > 0;
            }

            return false;
        } catch (e) {
            console.warn('[WarningManager] 检查站台冲突时出错:', e);
            return false;
        }
    }

    function detectWarnings(train, position, trainItem, isAtStation) {
        const warnings = [];
        const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
        const currentTrainData = allTrainsData[train.name];
        const now = Date.now();

        // 零速度警告检测
        if (!isAtStation && currentTrainData && currentTrainData.speed === CONFIG.ZERO_SPEED_THRESHOLD) {
            const isCoordinateChanging = checkCoordinateChange(train.name, allTrainsData);
            
            if (isCoordinateChanging) {
                clearZeroSpeedStartTime(train.name);
            } else {
                const atStation = position ? checkIfTrainAtStation(train.name, position) : false;
                if (!atStation) {
                    const existingStart = getZeroSpeedStartTime(train.name);

                    if (existingStart === null) {
                        setZeroSpeedStartTime(train.name, now);
                    } else {
                        const elapsed = now - existingStart;
                        if (elapsed >= CONFIG.ZERO_SPEED_DURATION) {
                            warnings.push({
                                type: CONFIG.WARNING_TYPES.ZERO_SPEED,
                                level: CONFIG.WARNING_LEVELS.zero_speed,
                                params: { speed: 0, duration: elapsed }
                            });
                        }
                    }
                } else {
                    clearZeroSpeedStartTime(train.name);
                }
            }
        } else {
            clearZeroSpeedStartTime(train.name);
        }

        // 长时间停车警告检测
        if (currentTrainData && currentTrainData.timestamp) {
            const timeSinceUpdate = now - currentTrainData.timestamp;
            if (timeSinceUpdate > CONFIG.LONG_STOP_DURATION) {
                // 记录长时间停车警告的开始时间
                const longStopStart = getWarningStartTime(train.name, CONFIG.WARNING_TYPES.LONG_STOP);
                if (longStopStart === null) {
                    setWarningStartTime(train.name, CONFIG.WARNING_TYPES.LONG_STOP, currentTrainData.timestamp);
                }

                warnings.push({
                    type: CONFIG.WARNING_TYPES.LONG_STOP,
                    level: CONFIG.WARNING_LEVELS.long_stop,
                    params: {
                        duration: timeSinceUpdate,
                        threshold: CONFIG.LONG_STOP_DURATION
                    }
                });
            } else {
                // 条件不满足时清除长时间停车警告的开始时间
                clearWarningStartTime(train.name, CONFIG.WARNING_TYPES.LONG_STOP);
            }
        } else {
            clearWarningStartTime(train.name, CONFIG.WARNING_TYPES.LONG_STOP);
        }

        // 站台冲突警告检测
        if (checkPlatformConflict(train, trainItem, isAtStation)) {
            // 记录站台冲突警告的开始时间
            const conflictStart = getWarningStartTime(train.name, CONFIG.WARNING_TYPES.PLATFORM_CONFLICT);
            if (conflictStart === null) {
                setWarningStartTime(train.name, CONFIG.WARNING_TYPES.PLATFORM_CONFLICT, now);
            }

            warnings.push({
                type: CONFIG.WARNING_TYPES.PLATFORM_CONFLICT,
                level: CONFIG.WARNING_LEVELS.platform_conflict,
                params: {}
            });
        } else {
            // 条件不满足时清除站台冲突警告的开始时间
            clearWarningStartTime(train.name, CONFIG.WARNING_TYPES.PLATFORM_CONFLICT);
        }

        return warnings;
    }

    function checkCoordinateChange(trainName, allTrainsData) {
        try {
            const currentData = allTrainsData[trainName];
            if (!currentData || !currentData.position || !currentData.timestamp) {
                return false;
            }

            const previousPositions = JSON.parse(localStorage.getItem('train_previous_positions') || '{}');
            const prevPos = previousPositions[trainName];

            if (!prevPos || !prevPos.position || !prevPos.timestamp) {
                previousPositions[trainName] = {
                    position: { ...currentData.position },
                    timestamp: currentData.timestamp
                };
                localStorage.setItem('train_previous_positions', JSON.stringify(previousPositions));
                return false;
            }

            const timeDiff = currentData.timestamp - prevPos.timestamp;
            if (timeDiff < 100 || timeDiff > 10000) {
                previousPositions[trainName] = {
                    position: { ...currentData.position },
                    timestamp: currentData.timestamp
                };
                localStorage.setItem('train_previous_positions', JSON.stringify(previousPositions));
                return false;
            }

            const distance = Math.sqrt(
                Math.pow(currentData.position.x - prevPos.position.x, 2) +
                Math.pow(currentData.position.z - prevPos.position.z, 2)
            );

            const COORD_CHANGE_THRESHOLD = 0.5;
            const isChanging = distance > COORD_CHANGE_THRESHOLD;

            previousPositions[trainName] = {
                position: { ...currentData.position },
                timestamp: currentData.timestamp
            };
            localStorage.setItem('train_previous_positions', JSON.stringify(previousPositions));

            return isChanging;
        } catch (e) {
            console.warn('[WarningManager] 检查坐标变化时出错:', e);
            return false;
        }
    }

    function getWarningColor(level) {
        return CONFIG.WARNING_COLORS[level] || CONFIG.WARNING_COLORS.warning;
    }

    function createWarningElement(warnings, strings, lang) {
        if (!warnings || warnings.length === 0) return null;

        const warningElement = document.createElement('div');
        warningElement.className = 'train-warning';

        const highestLevel = warnings.some(w => w.level === 'critical') ? 'critical' : 'warning';
        warningElement.style.color = getWarningColor(highestLevel);
        warningElement.style.fontWeight = 'bold';

        let warningText = '! ';
        warnings.forEach(warning => {
            const stringKey = `warning_${warning.type}`;
            if (strings && strings.lines_info && strings.lines_info[stringKey]) {
                warningText += strings.lines_info[stringKey][lang] + '; ';
            } else {
                warningText += warning.type + '; ';
            }
        });

        warningElement.textContent = warningText.slice(0, -2);
        return warningElement;
    }

    function addWarningSignToElement(trainItem, warnings) {
        if (!trainItem || !warnings || warnings.length === 0) return;

        const existingWarning = trainItem.querySelector('.warning');
        if (existingWarning) return;

        const highestLevel = warnings.some(w => w.level === 'critical') ? 'critical' : 'warning';
        const warningSpan = document.createElement('span');
        warningSpan.className = 'warning';
        warningSpan.style.color = getWarningColor(highestLevel);
        warningSpan.style.fontWeight = 'bold';
        warningSpan.textContent = '! ';
        trainItem.appendChild(warningSpan);
        trainItem.style.color = getWarningColor(highestLevel);
    }

    function removeWarningSignFromElement(trainItem) {
        if (!trainItem) return;

        const existingWarning = trainItem.querySelector('.warning');
        if (existingWarning) {
            existingWarning.remove();
            trainItem.style.color = '';
        }
    }

    function updateWarningState(train, trainItem, isAtStation, strings, lang) {
        const warnings = detectWarnings(train, null, trainItem, isAtStation);
        const hasWarning = warnings.length > 0;

        const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
        if (!allTrainsData[train.name]) {
            allTrainsData[train.name] = {};
        }

        const previousWarnings = allTrainsData[train.name].warningReasons || [];
        const hadWarning = previousWarnings.length > 0;

        if (hasWarning) {
            allTrainsData[train.name].warningReasons = warnings.map(w => w.type);
            addWarningSignToElement(trainItem, warnings);

            if (!hadWarning) {
                warnings.forEach(warning => {
                    reportWarningToServer(train.name, warning.type, warning.params, train.cars[0]?.leading?.location);
                });
            }
        } else {
            delete allTrainsData[train.name].warningReasons;
            removeWarningSignFromElement(trainItem);

            if (hadWarning) {
                previousWarnings.forEach(warningType => {
                    resolveWarningOnServer(train.name, warningType, 'Warning condition cleared');
                });
            }
        }

        localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
        return warnings;
    }

    function updateWarningStateForTrainsInfo(train, position, strings, lang) {
        const warnings = detectWarnings(train, position, null, false);
        const hasWarning = warnings.length > 0;

        const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
        if (!allTrainsData[train.name]) {
            allTrainsData[train.name] = {};
        }

        const previousWarnings = allTrainsData[train.name].warningReasons || [];
        const hadWarning = previousWarnings.length > 0;

        if (hasWarning) {
            allTrainsData[train.name].warningReasons = warnings.map(w => w.type);

            if (!hadWarning) {
                warnings.forEach(warning => {
                    reportWarningToServer(train.name, warning.type, warning.params, position);
                });
            }
        } else {
            delete allTrainsData[train.name].warningReasons;

            if (hadWarning) {
                previousWarnings.forEach(warningType => {
                    resolveWarningOnServer(train.name, warningType, 'Warning condition cleared');
                });
            }
        }

        localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
        return warnings;
    }

    function getWarningReasonsText(warningReasons, strings, lang) {
        if (!warningReasons || warningReasons.length === 0) return '';

        let text = '';
        warningReasons.forEach(reason => {
            const stringKey = `warning_${reason}`;
            if (strings && strings.lines_info && strings.lines_info[stringKey]) {
                text += strings.lines_info[stringKey][lang] + '; ';
            } else {
                text += reason + '; ';
            }
        });
        return text.slice(0, -2);
    }

    return {
        CONFIG,
        detectWarnings,
        updateWarningState,
        updateWarningStateForTrainsInfo,
        createWarningElement,
        addWarningSignToElement,
        removeWarningSignFromElement,
        getWarningColor,
        getWarningReasonsText,
        reportWarningToServer,
        resolveWarningOnServer,
        // 统一警告开始时间管理
        getAllWarningStartTimes,
        getWarningStartTime,
        setWarningStartTime,
        clearWarningStartTime,
        clearAllWarningStartTimesForTrain,
        // 向后兼容
        getZeroSpeedStartTime,
        setZeroSpeedStartTime,
        clearZeroSpeedStartTime,
        resolveLocationInfo
    };
})();

if (typeof window !== 'undefined') {
    window.WarningManager = WarningManager;
}
