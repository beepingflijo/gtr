let sidebarCollapseDone = false;

document.addEventListener('DOMContentLoaded', function () {
    const loadLines = fetch('./data/lines.json').then(r => r.json());
    const loadNetwork = typeof TrainDataSource !== 'undefined'
        ? TrainDataSource.loadNetworkData()
        : fetch('./data/network.json').then(r => r.json());
    const loadStrings = fetch('strings.json').then(r => r.json());
    const loadTrainsInfo = fetch('./data/trains_info.json').then(r => r.json());

    Promise.all([loadLines, loadNetwork, loadStrings, loadTrainsInfo])
        .then(([linesData, networkData, stringsData, trainsInfoData]) => {
            window.lines = linesData.lines;
            window.stationsNetwork = networkData.stations;
            window.strings = stringsData;
            window.trainsInfo = trainsInfoData.trains;

            const waitForScript = window.scriptReady || Promise.resolve();
            waitForScript.then(() => {
                if (typeof PositionUtils !== 'undefined') {
                    PositionUtils.init({
                        trainsInfo: window.trainsInfo,
                        stationsNetwork: window.stationsNetwork,
                        lines: window.lines,
                        strings: window.strings,
                        lang: lang
                    });
                }
                init();
            });
        })
        .catch(error => console.error('Error loading initial data:', error));
});

// 初始化函数
function init() {    
    if (compactParam !== 'true') {
        // 监听窗口大小变化
        handleWindowResize();
        window.addEventListener('resize', handleWindowResize);
    } else { 
        document.body.classList.add('effect-reduced');
        document.body.classList.add('compact');
    }

    const headerTitle = document.querySelector('header h1');
    const pageTitle = document.querySelector('title');
    console.log(pageTitle.textContent);
    headerTitle.textContent = strings.lines_info.page_title[lang];
    pageTitle.textContent = strings.lines_info.page_title[lang] + ' - ' + strings.mainpage.gtr_info[lang];
    
    // 获取线路选择和车站显示的DOM元素
    const stationsDisplay = document.querySelector('.stations-display');

    const lineSelectors = document.querySelectorAll('.line-selector');
    lineSelectors.forEach(lineSelector => {
        const mapEntry = document.createElement('div');
        mapEntry.className = 'selection-item map-entry';
        mapEntry.setAttribute('style', '--current-color: #808080');
        mapEntry.innerHTML = `
            <div class="item-content" style="cursor:pointer;">
                <div><span class="material-symbols-outlined" style="vertical-align:middle;">map</span></div>
                <div class="line-name-container">
                    <span class="line-name">${strings.lines_info.map_all_lines[lang]}</span>
                </div>
            </div>
        `;
        mapEntry.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = '?line=all';
            //openMapMode();
        });
        lineSelector.insertBefore(mapEntry, lineSelector.firstChild);
    });

    window.lines.forEach(line => {
        lineSelectors.forEach(lineSelector => {
            if (!line.id.match('-R')) {
                const lineId = line.id;
                const item = document.createElement('div');
                item.className = `selection-item ${lineId}`;
                item.innerHTML = `
                <a href="?line=${line.id}" class="item-content">
                    <div class="line-code">${line.id.replace(/[^A-Z]/g, '').trim()}<small>${line.id.replace(/[^0-9]/g, '')}</small>
                    </div>
                    <div class="line-name-container">
                        <span class="line-name">${line.name[lang]}</span>
                        <span class="line-name-original">${!lang.startsWith('zh') ? (line.name.original || line.name['zh_hans']) : ''}</span>
                    </div>
                </a>
                `;
                item.setAttribute('style', `--current-color: ${line.color}`);
                lineSelector.appendChild(item);
                if (line.id === getActiveLineId()) {
                    item.classList.add('active');
                }
            }
        });
    });

    // 调整所有lineSelector样式
    lineSelectors.forEach(lineSelector => {
        lineSelector.setAttribute('style', `--color-primary: ${window.lines.find(line => line.id === getActiveLineId())?.color || '#808080'}`);
    });

    const mapBtn = document.querySelectorAll('.map-btn');
    mapBtn.forEach(btn => {
        btn.title = strings.lines_info.route_map[lang];
        btn.addEventListener('click', () => {
            window.open('https://track.nitrogen.hydcraft.cn/', '_blank');
        });
    });
    
    const castBtn = document.querySelectorAll('.cast-btn');
    castBtn.forEach(btn => {
        btn.title = strings.pov_frame.page_title[lang];
        btn.addEventListener('click', () => {
            window.open('pov-frame.html', '_blank');
        });
    });

    const lineId = getActiveLineId();
    // 获取lineId对应的线路数据、
    const line = window.lines.find(line => line.id === lineId);
    if (lineId === 'all') {
        openMapMode();
    }

    loadSegmentInfo();
    loadUpdateTime();

    if (line) displayStations(line);
    initDataSource();

    const shareBtn = document.querySelector('.share-btn');
    shareBtn.title = strings.lines_info.share_route[lang];
    shareBtn.addEventListener('click', function () { 
        shareRouteMap();
    });

    initMapMode();
}

// 获取偏好设置
function getPreferences() {
    const prefs = localStorage.getItem('preferences');
    if (prefs) {
        try {
            return JSON.parse(prefs);
        } catch (e) {
            console.error('Error parsing preferences:', e);
            return {};
        }
    }
    return {};
}

// 显示指定线路的车站信息函数
function displayStations(line) {
    recordLastVisitedPage(`?line=${line.id}`);
    const stationsDisplay = document.querySelector('.stations-display');
    // 清空当前显示的车站信息
    stationsDisplay.innerHTML = '';

    // 更改--current-color 变量的值
    document.documentElement.style.setProperty('--current-color', line.color);

    // 创建车站列表的DOM元素
    const ul = document.createElement('ul');
    ul.className = 'station-list';
    ul.classList.add('item');
    
    // 如果是GX线路，添加GX类名
    if (line.id.startsWith('GX') || line.id.match('-R')) {
        ul.classList.add('GX');
    }

    // ... 原有代码 ...
    const rapidLine = (!line.id.startsWith('GX'))?window.lines.find(ln => ln.id === line.id+'-R'):null;
    
    let rapidStations = [];
    if (rapidLine) {
        // 1. 获取快速线的所有车站节点
        const allRapidNodes = rapidLine.route.filter(node => node.type === 'station');
        
        // 2. 统计每个车站代码出现的次数
        const stationCounts = {};
        allRapidNodes.forEach(node => {
            stationCounts[node.code] = (stationCounts[node.code] || 0) + 1;
        });

        // 3. 找出所有重复出现（出现次数 > 1）的车站代码
        const duplicatedCodes = new Set();
        for (const code in stationCounts) {
            if (stationCounts[code] > 1) {
                duplicatedCodes.add(code);
            }
        }

        // 4. 过滤车站：跳过重复车站第一次出现后、第二次出现前的所有车站，并去重
        const seenStations = new Set(); // 用于最终去重
        const skipUntil = {}; // 记录需要跳过的车站代码 { code: true }

        rapidStations = allRapidNodes.filter(node => {
            const code = node.code;

            // 如果当前车站是重复车站之一
            if (duplicatedCodes.has(code)) {
                // 如果正处于“跳过模式”且遇到了目标车站（第二次出现）
                if (skipUntil[code]) {
                    delete skipUntil[code]; // 结束跳过模式
                    return true; 
                } 
                // 如果是第一次遇到重复车站
                else if (!seenStations.has(code)) {
                    seenStations.add(code); // 标记为已见
                    skipUntil[code] = true; // 开启跳过模式，直到下次遇到它
                    return false; // 第一次出现也要去掉（根据需求“去掉重复的车站”）
                }
            }

            // 如果处于任何车站的跳过模式中，则忽略当前车站
            for (const skipCode in skipUntil) {
                if (skipUntil[skipCode]) {
                    return false;
                }
            }

            // 正常车站或不在跳过范围内的车站，进行常规去重
            if (seenStations.has(code)) {
                return false;
            }
            
            seenStations.add(code);
            return true;
        });
    }
    // ... 原有代码 ...

    // 遍历线路中的每个节点，筛选出车站并创建列表项
    line.route.filter(node => node.type === 'station').forEach(station => {
        const isRapidStation = rapidStations.some(stn => stn.code === station.code);
        const li = document.createElement('li');
        li.classList.add('station-list-item');
        li.innerHTML = `
            <div class="train-container"></div>
            <div class="station-circle" style="
                border-color: ${isRapidStation ? 'var(--color-background-card-solid)' : line.color};
                background-color: ${isRapidStation ? line.color : ''};
            "></div>
            <div class="station-name-container" style="
                font-weight: ${isRapidStation ? '500' : ''};
                color: ${isRapidStation ? line.color : ''};
            ">
                <span class="station-name">${getStationName(station.code,lang)}</span>
                <span class="station-name-original">${getStationName(station.code,'original')!==getStationName(station.code) ? getStationName(station.code,'original') : ''}</span>
            </div>
        `;
        const stationNameElement = li.querySelector('.station-name');
        stationNameElement.addEventListener('click', () => {
            loadStationInfo(station.code);
        })
        ul.appendChild(li);

        // 在每一站之间加上垂直连接线
        if (station !== line.route[line.route.length - 1]) {
            const lineItem = document.createElement('li');
            lineItem.classList.add('station-line');
            lineItem.innerHTML = `
                <div class="train-container"></div>
                <div class="station-line-block"></div>
            `;
            ul.appendChild(lineItem);
        }
    });

    // 将车站列表添加到页面中
    stationsDisplay.appendChild(ul);

    // 调用显示列车信息的函数
    //displayTrains();
    //highlightTrainsForCurrentLine();
}

// 根据显示名称查找三字码
function getStationCode(displayName) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.getStationCode(displayName);
    }
    
    // 降级处理：如果PositionUtils不可用，使用原有实现
    // 遍历window.stationsNetwork查找匹配的车站
    if (!window.stationsNetwork) return null;
    
    for (const station of window.stationsNetwork) {
        // 提取前三个大写字母作为三字码
        const stationCode = station.name.match(/[A-Z]/g)?.slice(0, 3).join('') || '';
        if (getStationName(stationCode, lang) === displayName) {
            return stationCode;
        }
    }
    
    return null;
}

let offlineToastShown = false;
let exampleToastShown = false;

let dataCount = 0;
let capturedData = null;

function isMaintenanceWindow() {
    const now = new Date();
    const utcH = now.getUTCHours();
    const utcM = now.getUTCMinutes();
    return utcH === 20 && utcM <= 15;
}

function initDataSource() {
    if (typeof TrainDataSource !== 'undefined') {
        TrainDataSource.on('online', function () {
            offlineToastShown = false;
            exampleToastShown = false;
        });

        TrainDataSource.on('data', function (payload) {
            handleTrainsUpdate(payload);
        });

        TrainDataSource.on('offline', function () {
            if (!offlineToastShown) {
                let msg = strings.lines_info.loading[lang];
                if (isMaintenanceWindow()) {
                    msg += strings.lines_info.server_maintaining[lang];
                }
                showToast(msg);
                offlineToastShown = true;
            }
        });

        TrainDataSource.on('fallback_success', function () {
            if (!exampleToastShown) {
                showToast(strings.trains_info.loading_example_data[lang], 5000);
                exampleToastShown = true;
            }
        });

        TrainDataSource.start();
    } else {
        displayTrains();
    }
}

function handleTrainsUpdate(payload) {
    document.querySelectorAll('.train-item').forEach(el => el.remove());
    document.querySelectorAll('.player-count-container').forEach(el => el.remove());

    if (!window.lines || !window.stationsNetwork) return;
    const trainsContainer = document.querySelector('.stations-display');
    if (!trainsContainer) return;

    let data = payload;
    if (!data || !data.trains || !Array.isArray(data.trains)) return;

    const isValidTrain = (train) => {
        return train && typeof train === 'object' && train.name && train.cars &&
               Array.isArray(train.cars) && train.cars.length > 0 &&
               train.cars[0].leading && train.cars[0].leading.location;
    };
    data.trains = data.trains.filter(isValidTrain);
    if (data.trains.length === 0) return;

    if (!capturedData) {
        try {
            capturedData = structuredClone(data);
            capturedData.timestamp = Date.now();
        } catch (e) {
            capturedData = JSON.parse(JSON.stringify(data));
            capturedData.timestamp = Date.now();
        }
    }

    processTrainsData(data);
}

function processTrainsData(data) {
    const trainsContainer = document.querySelector('.stations-display');
    if (!trainsContainer) return;

    document.querySelectorAll('.train-item').forEach(el => el.remove());

    data.trains.forEach(train => {
        if (!train || !train.name || !train.cars || !Array.isArray(train.cars) || train.cars.length === 0) return;
        if (!train.cars[0].leading || !train.cars[0].leading.location) return;

        let closestTrackDistance = Infinity;
        let currentTrack = null;
        let trackProgress = 0;
        let carDirection = '';
        let closestSegmentDirection = null;
        let isTrainAtStation = false;

        let carPos = train.cars[0].leading.location;
        let isStopped = train.stopped === 'true';

        let direction = getDirection(train.name, carPos, isStopped);

        let stationTrainItem = null;
        let trackItem = null;

        const isGXTrain = train.name.startsWith('GX');
        let isStationInCurrentLine = false;

        if (isGXTrain) {
            const currentLine = window.lines.find(line => line.id === getActiveLineId());
            if (currentLine) {
                const gxCheck = detectTrainAtStation(train, currentLine, { atStationThreshold: 200 });
                isStationInCurrentLine = gxCheck.isAtStation;
            }
        }

        const activeLine = window.lines.find(line => line.id === getActiveLineId());
        const stationResult = detectTrainAtStation(train, activeLine, {
            atStationThreshold: 100,
            isGXTrain,
            isStationInCurrentLine
        });

        if (stationResult.isAtStation) {
            isTrainAtStation = true;

            stationTrainItem = document.createElement('div');
            stationTrainItem.className = 'train-item';

            stationTrainItem.innerHTML = `
                <span class="material-symbols-outlined train-icon">
                directions_subway
                </span>
                <span class="train-name">${train.name}</span>
                <span class="platform">${stationResult.platform} </span>
            `;

            const stationCode = stationResult.stationNode.code;
            const stationElement = document.querySelectorAll('.station-list-item');
            stationElement.forEach(element => {
                const stationName = element.querySelector('.station-name').textContent;
                if (stationName === getStationName(stationCode, lang)) {
                    const trainContainer = element.querySelector('.train-container');
                    if (trainContainer) {
                        trainContainer.appendChild(stationTrainItem);
                    }
                }
            });

            checkAndAddWarningSign(train, stationTrainItem, true);
        }

        if (!isTrainAtStation) {
            window.lines.forEach(line => {
                const activeLineId = getActiveLineId();
                if (line.id !== activeLineId) return;
                line.route.filter(node => node.type === 'track').forEach((track, index) => {
                    for (let i = 0; i < track.nodes.length - 1; i++) {
                        const v = track.nodes[i];
                        const w = track.nodes[i + 1];
                        const distance = distanceFromSegment(carPos, v, w);

                        if (distance < closestTrackDistance && distance <= 100) {
                            closestTrackDistance = distance;
                            const currentLine = line.id;
                            currentTrack = { currentLine, track, index };
                            closestSegmentDirection = [(w.x - v.x), (w.z - v.z)];

                            const upwardDistance = calculateTotalDistance(carPos, track, index);
                            const segmentDistance = calculateTotalDistance(track.nodes[track.nodes.length - 1], track, track.nodes.length - 1);
                            trackProgress = upwardDistance / segmentDistance;
                        }
                    }
                });
            });

            if (closestSegmentDirection) {
                const magDirection = Math.sqrt(direction[0] ** 2 + direction[1] ** 2);
                const magTrackDirection = Math.sqrt(closestSegmentDirection[0] ** 2 + closestSegmentDirection[1] ** 2);

                if (magDirection === 0 || magTrackDirection === 0) {
                    try {
                        const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
                        const currentTrainData = allTrainsData[train.name];
                        if (currentTrainData && currentTrainData.direction && currentTrainData.direction !== 'unknown') {
                            carDirection = currentTrainData.direction;
                        } else {
                            if (typeof PositionUtils !== 'undefined') {
                                carDirection = PositionUtils.resolveDirectionFromSpeed(train.name, 'unknown');
                            } else {
                                carDirection = 'unknown';
                            }
                        }
                    } catch (e) {
                        carDirection = 'unknown';
                    }
                } else {
                    const cosTheta = (direction[0] * closestSegmentDirection[0] + direction[1] * closestSegmentDirection[1]) / (magDirection * magTrackDirection);

                    if (cosTheta > 0.5) {
                        carDirection = 'down';
                    } else if (cosTheta < -0.5) {
                        carDirection = 'up';
                    } else {
                        carDirection = 'unknown';
                        try {
                            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
                            const currentTrainData = allTrainsData[train.name];
                            if (currentTrainData && currentTrainData.direction && currentTrainData.direction !== 'unknown') {
                                carDirection = currentTrainData.direction;
                            } else {
                                if (typeof PositionUtils !== 'undefined') {
                                    carDirection = PositionUtils.resolveDirectionFromSpeed(train.name, carDirection);
                                }
                            }
                        } catch (e) {
                            // 保留 'unknown'
                        }
                    }
                }
            } else {
                try {
                    const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
                    const currentTrainData = allTrainsData[train.name];
                    if (currentTrainData && currentTrainData.direction && currentTrainData.direction !== 'unknown') {
                        carDirection = currentTrainData.direction;
                    } else {
                        if (typeof PositionUtils !== 'undefined') {
                            carDirection = PositionUtils.resolveDirectionFromSpeed(train.name, 'unknown');
                        } else {
                            carDirection = 'unknown';
                        }
                    }
                } catch (e) {
                    carDirection = 'unknown';
                }
            }

            if (typeof PositionUtils !== 'undefined') {
                PositionUtils.saveTrainDirection(train.name, carDirection, carDirection);
            }

            const backwards = train.backwards === 'true';
            if (backwards) {
                if (carDirection === 'down') carDirection = 'up';
                else if (carDirection === 'up') carDirection = 'down';
            }

            if (currentTrack) {
                if (carDirection === 'down') {
                    trackProgress = 1 - trackProgress;
                }
                train.trackProgress = trackProgress;
            }

            if (currentTrack) {
                const stationLineItems = document.querySelectorAll('.station-line');
                const segmentIndex = currentTrack.index;
                if (segmentIndex < stationLineItems.length) {
                    const stationLine = stationLineItems[segmentIndex];
                    const trainContainer = stationLine.querySelector('.train-container');
                    if (trainContainer) {
                        trackItem = document.createElement('div');
                        trackItem.className = 'train-item';
                        const prefs = getPreferences();

                        trackItem.innerHTML = `
                            <span class="material-symbols-outlined train-icon">
                            directions_subway
                            </span>
                            <span class="train-name">${train.name}</span>
                        `;

                        if (prefs.followPlayers && typeof PositionUtils !== 'undefined' && PositionUtils.checkTrainApproachingPlayers) {
                            try {
                                PositionUtils.checkTrainApproachingPlayers(train, prefs.followPlayers);
                            } catch (e) {
                                console.warn('检查玩家接近错误:', e);
                            }
                        }

                        trainContainer.appendChild(trackItem);
                        checkAndAddWarningSign(train, trackItem, false);
                    }
                }
            }

            if (!currentTrack) {
                const activeLineId = getActiveLineId();
                const activeLineName = getLineName(activeLineId);

                let trackItem = document.createElement('div');
                trackItem.className = 'train-item';

                trackItem.innerHTML = `
                    <span class="material-symbols-outlined">
                    directions_subway
                    </span>
                    <span class="train-name">${train.name}</span>
                `;

                trackItem.style.marginBottom = '1px';
                trackItem.style.display = 'inline-flex';

                const prefs = getPreferences();
                if (prefs.followPlayers && typeof PositionUtils !== 'undefined' && PositionUtils.checkTrainApproachingPlayers) {
                    try {
                        PositionUtils.checkTrainApproachingPlayers(train, prefs.followPlayers);
                    } catch (e) {
                        console.warn('检查玩家接近错误:', e);
                    }
                }

                const segmentsDisplay = document.querySelector('.segments-display');
                if (segmentsDisplay) {
                    if (!segmentsDisplay.querySelector('.train-container')) {
                        const trainContainer = document.createElement('div');
                        trainContainer.className = 'train-container';
                        segmentsDisplay.appendChild(trainContainer);
                    }
                    segmentsDisplay.querySelector('.train-container').appendChild(trackItem);
                }

                checkAndAddWarningSign(train, trackItem, false);
            }
        }

        const currentTrainItem = isTrainAtStation ? stationTrainItem : trackItem;
        if (currentTrainItem) {
            bindTrainTooltip(currentTrainItem, train, carDirection);
        }
    });

    updateExistingTooltips(data);

    const activeLineId = getActiveLineId();
    loadSegmentInfo();

    let trainNames = [];
    document.querySelectorAll('.train-item').forEach(item => {
        const trainName = item.querySelector('.train-name').textContent;
        const trainInfo = window.trainsInfo.find(t => t.name === trainName);
        if (!trainInfo || (trainInfo && trainInfo.line !== activeLineId && trainInfo.line !== (activeLineId + '-R'))) {
            const iconElement = item.querySelector('.train-icon');
            const nameElement = item.querySelector('.train-name');
            const platformElement = item.querySelector('.platform');
            if (iconElement) iconElement.style.opacity = 0.4;
            if (nameElement) nameElement.style.opacity = 0.4;
            if (platformElement) { platformElement.style.opacity = 0.4; }
        }
        if (trainNames.includes(trainName)) {
            item.remove();
        }
        trainNames.push(trainName);
    });

    updateLineInfoDisplay(activeLineId);

    capturedData = structuredClone(data);
    capturedData.timestamp = structuredClone(Date.now());

    updateTrainDirectionArrows();
}

function bindTrainTooltip(element, train, carDirection) {
    console.log('绑定车次提示', train.name);
    element.addEventListener('mouseover', function () {
        const trainTooltip = document.createElement('div');
        trainTooltip.classList.add('tooltip');
        trainTooltip.classList.add('train-tooltip');
        trainTooltip.innerHTML = '';

        const trainTooltipTitle = document.createElement('h4');
        trainTooltipTitle.className = 'train-tooltip-title';
        trainTooltipTitle.textContent = train.name;
        trainTooltip.appendChild(trainTooltipTitle);

        train.cars.forEach(car => {
            const carName = car.id;
            const carPos = train.backwards === 'true' ? car.trailing.location : car.leading.location;
            const carPosX = Math.round(carPos.x, 2);
            const carPosZ = Math.round(carPos.z, 2);
            const locationItem = document.createElement('div');
            locationItem.classList.add('location-item');
            locationItem.innerHTML = `
                <div class="car-name">${carName}</div>
                <div class="car-pos">(${carPosX},${carPosZ})</div>
            `;
            trainTooltip.appendChild(locationItem);
        });
        element.insertBefore(trainTooltip, element.firstChild);

        const isBackwardsElement = document.createElement("div");
        isBackwardsElement.className = "is-backwards";
        isBackwardsElement.textContent = train.backwards === 'true' ? strings.lines_info.going_backwards[lang] : '';
        trainTooltip.appendChild(isBackwardsElement);

        const platformElement = element.querySelector('.platform');
        if (platformElement) {
            try {
                const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
                const currentTrainData = allTrainsData[train.name];
                if (currentTrainData && currentTrainData.direction !== undefined) {
                    platformElement.textContent = platformElement.textContent.trim() + ' ';
                }
            } catch (e) { }
        } else {
            const directionElement = document.createElement("div");
            directionElement.className = "train-direction";
            let directionText = '';
            if (carDirection === 'up') {
                directionText = strings.lines_info.running_direction_up[lang] || '上行';
            } else if (carDirection === 'down') {
                directionText = strings.lines_info.running_direction_down[lang] || '下行';
            } else if (carDirection === 'unknown') {
                directionText = strings.lines_info.unknown_direction[lang] || '未知方向';
            }
            directionElement.textContent = directionText;
            trainTooltip.appendChild(directionElement);
        }

        try {
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const currentTrainData = allTrainsData[train.name];
            const isStopped = train.isStopped === 'true';

            if (currentTrainData && currentTrainData.speed !== undefined) {
                let speed = isStopped ? 0 : currentTrainData.speed.toFixed();
                const speedElement = document.createElement("div");
                speedElement.className = "train-speed";

                if (currentTrainData.isSpeedLost && currentTrainData.prevSpeed !== undefined) {
                    speed = currentTrainData.prevSpeed.toFixed();
                }

                speedElement.textContent = (strings.lines_info.speed[lang] + speed + 'km/h');
                speedElement.style.opacity = currentTrainData.isSpeedLost ? '0.4' : '1';
                trainTooltip.appendChild(speedElement);
            }
        } catch (e) { }

        try {
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const currentTrainData = allTrainsData[train.name];

            if (currentTrainData && currentTrainData.warningReasons && currentTrainData.warningReasons.length > 0) {
                const warningReasonsElement = document.createElement("div");
                warningReasonsElement.className = "warning-reasons";
                warningReasonsElement.style.color = 'crimson';
                warningReasonsElement.style.fontWeight = 'bold';

                let reasonsText = '! ';
                currentTrainData.warningReasons.forEach(reason => {
                    switch (reason) {
                        case 'long_stop':
                            reasonsText += strings.lines_info.warning_long_stop[lang] + '; ';
                            break;
                        case 'zero_speed':
                            reasonsText += strings.lines_info.warning_zero_speed[lang] + '; ';
                            break;
                        case 'platform_conflict':
                            reasonsText += strings.lines_info.warning_platform_conflict[lang] + '; ';
                    }
                });

                reasonsText = reasonsText.slice(0, -2);
                warningReasonsElement.textContent = reasonsText;
                trainTooltip.appendChild(warningReasonsElement);
            }
        } catch (e) { }
    });

    element.addEventListener('mouseout', function () {
        const trainTooltip = element.querySelector('.train-tooltip');
        if (trainTooltip) {
            trainTooltip.remove();
        }
    });

    element.style.cursor = 'pointer';
    element.addEventListener('click', function () {
        window.open(`trains_info.html?q=${train.name}`, '_self');
    });
}



// 对轨道上的列车按距离上行车站由近到远排序
function sortTrainsOnTracks() {
    const stationLines = document.querySelectorAll('.station-line');
    
    stationLines.forEach((stationLine, index) => {
        const trainContainer = stationLine.querySelector('.train-container');
        if (!trainContainer) return;
        
        // 获取该轨道上的所有列车
        const trainItems = Array.from(trainContainer.querySelectorAll('.train-item'));
        if (trainItems.length <= 1) return; // 如果没有列车或只有一列列车，无需排序
        
        // 为每个列车项添加距离上行车站的数据属性
        trainItems.forEach(trainItem => {
            const trainNameElement = trainItem.querySelector('.train-name');
            if (trainNameElement) {
                const fullTrainName = trainNameElement.textContent;
                // 查找该列车在capturedData中的信息
                if (typeof capturedData !== 'undefined' && capturedData && capturedData.trains) {
                    const trainData = capturedData.trains.find(t => 
                        fullTrainName.includes(t.name) || t.name.includes(fullTrainName)
                    );
                    if (trainData && typeof trainData.trackProgress !== 'undefined') {
                        // 使用trackProgress作为距离上行车站的位置指标
                        trainItem.dataset.trackPosition = trainData.trackProgress;
                    } else {
                        // 如果找不到数据，使用默认值
                        trainItem.dataset.trackPosition = 0;
                    }
                } else {
                    // 如果capturedData不可用，使用默认值
                    trainItem.dataset.trackPosition = 0;
                }
            }
        });
        
        // 按距离上行车站由近到远排序（trackPosition值从小到大）
        trainItems.sort((a, b) => {
            const posA = parseFloat(a.dataset.trackPosition) || 0;
            const posB = parseFloat(b.dataset.trackPosition) || 0;
            return posA - posB;
        });
        
        // 重新排列DOM元素
        trainItems.forEach(trainItem => {
            trainContainer.appendChild(trainItem);
        });
    });
}

// 新增函数：更新线路信息显示
function updateLineInfoDisplay(activeLineId) {
    const stationsDisplay = document.querySelector('.stations-display');
    if (!stationsDisplay) return;
    
    let updateTime = stationsDisplay.querySelector('.update-time');
    if (!updateTime) {
        updateTime = document.createElement('div');
        updateTime.className = 'update-time';
        stationsDisplay.appendChild(updateTime);
        console.log('Adding update-time element');
    }
    
    try {
        const lineLength = measureLineLengths(activeLineId);
        updateTime.innerHTML = `${
            strings.lines_info.total_length[lang] + 
            (lineLength / 1000).toFixed(1) + strings.ticket_calculator.km[lang] +
            strings.lines_info.and_total_time[lang] +
            calculateLineTotalTime(activeLineId) +
            strings.ticket_calculator.min[lang]
        }<br />${
            strings.lines_info.updated_at[lang] + new Date().toLocaleString()
        }<br />${
            strings.lines_info.locations_for_reference_only[lang]
        }`;
    } catch (error) {
        console.error('更新线路信息时出错:', error);
        updateTime.innerHTML = `${strings.lines_info.updated_at[lang] + new Date().toLocaleString()}<br />${strings.lines_info.locations_for_reference_only[lang]}`;
    }
}

// 更新已存在的列车tooltip内容
function updateExistingTooltips(trainData) {
    const existingTooltips = document.querySelectorAll('.train-tooltip');
    if (existingTooltips.length === 0) return;

    existingTooltips.forEach(tooltip => {
        // 找到包含此tooltip的列车项
        const trainItem = tooltip.closest('.train-item');
        if (!trainItem) return;

        // 获取列车名称
        const trainNameElement = trainItem.querySelector('.train-name');
        if (!trainNameElement) return;

        // 检查列车是否在车站内（通过检查是否有.platform元素）
        const platformElement = trainItem.querySelector('.platform');
        
        if (platformElement) {
            // 车站内的列车，根据方向更新站台编号
            const platformText = platformElement.textContent.trim();
            let newPlatformText = platformText;
            
            // 获取列车名称
            const trainName = trainNameElement.textContent.trim();
            
            // 从localStorage获取列车方向信息
            try {
                const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
                const currentTrainData = allTrainsData[trainName];
                
                if (currentTrainData && currentTrainData.direction !== undefined) {
                    const carDirection = currentTrainData.direction;
                    
                    // 根据方向更新站台编号
                    /*if (carDirection === 'down') {
                        // 下行方向显示为A站台
                        newPlatformText = platformText.replace(/[A-Za-z]/g, '') + 'A';
                    } else if (carDirection === 'up') {
                        // 上行方向显示为B站台
                        newPlatformText = platformText.replace(/[A-Za-z]/g, '') + 'B';
                    }*/
                    // 如果方向未知，则保持原始platform值
                    
                    // 更新站台编号
                    platformElement.textContent = newPlatformText + ' ';
                }
            } catch (e) {
                console.warn('更新车站内列车站台编号时出错:', e);
            }
            
            // 车站内的列车不需要更新其他tooltip内容
            return;
        }

        // 去掉箭头符号获取实际列车名称
        const trainName = trainNameElement.textContent.replace(/[↑↓? ]/g, '');
        
        // 在列车数据中查找对应的列车
        const train = trainData.trains.find(t => t.name === trainName);
        if (!train) return;

        // 更新tooltip内容
        tooltip.innerHTML = '';

        tooltip.style.maxWidth = '60px';

        const trainTooltipTitle = document.createElement('h4');
        trainTooltipTitle.className = 'train-tooltip-title';
        trainTooltipTitle.textContent = train.name;
        tooltip.appendChild(trainTooltipTitle);
        
        // 添加车厢位置信息
        train.cars.forEach((car, index) => {
            const carName = car.id;
            const carPos = train.backwards === 'true' ? car.trailing.location : car.leading.location;
            const carPosX = Math.round(carPos.x, 2);
            const carPosZ = Math.round(carPos.z, 2);
            const locationItem = document.createElement('div');
            locationItem.classList.add('location-item'); 
            locationItem.innerHTML = `
                <div class="car-name">${index + 1}</div>
                <div class="car-pos">(${carPosX},${carPosZ})</div>
            `;
            tooltip.appendChild(locationItem);
        });

        const isStopped = train.stopped === 'true';

        // 添加方向信息
        const isBackwardsElement = document.createElement("div");
        isBackwardsElement.className = "is-backwards";
        isBackwardsElement.textContent = train.backwards === 'true' ? strings.lines_info.going_backwards[lang] : '';
        tooltip.appendChild(isBackwardsElement);
        
        // 添加列车运行方向信息
        // 首先需要获取列车方向信息
        let carDirection = '';
        const trainNameText = trainItem.querySelector('.train-name').textContent;
        
        if (trainNameText.includes('↑')) {
            carDirection = 'up';    // ↑ 表示与轨道方向相反为上行
        } else if (trainNameText.includes('↓')) {
            carDirection = 'down';  // ↓ 表示与轨道方向一致为下行
        } else if (trainNameText.includes('?')) {
            carDirection = 'unknown';
        }
        
        // 添加列车运行方向信息
        const directionElement = document.createElement("div");
        directionElement.className = "train-direction";
        // 确定列车运行方向文本
        let directionText = '';
        if (carDirection === 'up') {
            directionText = strings.lines_info.running_direction_up[lang] || '上行';
        } else if (carDirection === 'down') {
            directionText = strings.lines_info.running_direction_down[lang] || '下行';
        } else if (carDirection === 'unknown') {
            directionText = strings.lines_info.unknown_direction[lang] || '未知方向';
        }
        directionElement.textContent = directionText;
        //tooltip.appendChild(directionElement);

        // 添加速度信息
        try {
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const currentTrainData = allTrainsData[train.name];
            
            if (currentTrainData && currentTrainData.speed !== undefined) {
                let speed = isStopped === 'true' ? 0 : currentTrainData.speed.toFixed();
                const speedElement = document.createElement("div");
                speedElement.className = "train-speed";
                
                // 如果速度丢失，则继承之前的速度值
                if (currentTrainData.isSpeedLost && currentTrainData.prevSpeed !== undefined) {
                    speed = currentTrainData.prevSpeed.toFixed();
                }
                
                speedElement.textContent = (strings.lines_info.speed[lang] + speed + 'km/h');
                // 如果速度丢失，则将文本不透明度调整为0.4
                speedElement.style.opacity = currentTrainData.isSpeedLost ? '0.4' : '1';
                tooltip.appendChild(speedElement);
            }
        } catch (e) {
            console.warn('获取列车速度时出错:', e);
        }
        
        try {
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const currentTrainData = allTrainsData[train.name];
            
            if (currentTrainData && currentTrainData.warningReasons && currentTrainData.warningReasons.length > 0) {
                const warningReasonsElement = document.createElement("div");
                warningReasonsElement.className = "warning-reasons";
                
                if (typeof WarningManager !== 'undefined') {
                    const warnings = currentTrainData.warningReasons.map(type => ({
                        type,
                        level: WarningManager.CONFIG.WARNING_LEVELS[type] || 'warning'
                    }));
                    const highestLevel = warnings.some(w => w.level === 'critical') ? 'critical' : 'warning';
                    warningReasonsElement.style.color = WarningManager.getWarningColor(highestLevel);
                    warningReasonsElement.style.fontWeight = 'bold';
                    warningReasonsElement.textContent = WarningManager.getWarningReasonsText(currentTrainData.warningReasons, strings, lang);
                } else {
                    warningReasonsElement.style.color = 'crimson';
                    warningReasonsElement.style.fontWeight = 'bold';
                    let reasonsText = '! ';
                    currentTrainData.warningReasons.forEach(reason => {
                        const stringKey = `warning_${reason}`;
                        if (strings.lines_info[stringKey]) {
                            reasonsText += strings.lines_info[stringKey][lang] + '; ';
                        }
                    });
                    warningReasonsElement.textContent = reasonsText.slice(0, -2);
                }
                
                tooltip.appendChild(warningReasonsElement);
            }
        } catch (e) {
            console.warn('获取列车警告原因时出错:', e);
        }
    });
    
    // 更新列车方向箭头
    updateTrainDirectionArrows();
}

function loadSegmentInfo() { 
    const activeLineId = getActiveLineId();
    const stationLineElements = document.querySelectorAll('.station-line');
    stationLineElements.forEach((element, index) => {
        element.addEventListener('mouseover', function() { 
            let segmentLength = document.querySelector('.segment-length');
            if (!segmentLength) {
                segmentLength = document.createElement('div');
                segmentLength.className = 'segment-length';
            }
            segmentLength.innerHTML = '<span class="material-symbols-outlined">height</span>'
            segmentLength.innerHTML +=
                (measureSegmentLength(activeLineId, index) / 1000).toFixed(1) + strings.ticket_calculator.km[lang] + ' ' 
                + findSegmentDuration(activeLineId, index);
            element.appendChild(segmentLength);
        });
        element.addEventListener('mouseout', function() { 
            const segmentLength = element.querySelector('.segmentLength');
            if (segmentLength) {
                element.removeChild(segmentLength);
            }
        });
    });
}

function loadUpdateTime() {
    const activeLineId = getActiveLineId();
    const stationsDisplay = document.querySelector('.stations-display');
    let updateTime = stationsDisplay.querySelector('.update-time');
    if (!updateTime) {
        updateTime = document.createElement('div');
        updateTime.className = 'update-time';
        stationsDisplay.appendChild(updateTime);
        console.log('Adding update-time element');
    }
    const lineLength = measureLineLengths(activeLineId);
    updateTime.innerHTML = `${strings.lines_info.total_length[lang] + (lineLength / 1000).toFixed(1) + strings.ticket_calculator.km[lang]}`;
}

function getActiveLineId () {
    // 从 URL 参数中获取线路 id
    let lineId = new URLSearchParams(window.location.search).get('line');
    if (!lineId) {
        // 检查是否有用户最后访问的线路
        const visitedPagesStr = localStorage.getItem('visitedPages');
        if (visitedPagesStr && prefs.resumeOnLoading !== 'false') {
            const params = new URLSearchParams(getLastVisitedParams());
            lineId = params.get('line');
        }
        // 如果仍然没有获取到线路 id，使用默认第一条线路
        if (!lineId) {
            lineId = lines[0].id;
        }
    }
    // 保存当前线路为最后访问的线路
    // console.log('Active line id:', lineId);
    return lineId;
}

function getLineName(lineId = getActiveLineId()) {
    if (lineId === 'all') {
        return strings.lines_info.map_all_lines[lang];
    }
    return lines.find(line => line.id === lineId).name[lang];
}

function getDirection(trainName, carPos, isStopped) {
    // 尝试从 localStorage 获取之前存储的列车位置数据
    let allTrainsData = {};
    try {
        const storedData = localStorage.getItem('all_trains_positions');
        if (storedData) {
            allTrainsData = JSON.parse(storedData);
        }
    } catch (e) {
        console.warn('无法解析列车位置数据:', e);
    }

    // 获取当前列车的之前位置数据
    let previousTrainData = allTrainsData[trainName] || null;
    
    // 计算方向向量
    let direction = [0, 0];
    let speed = 0; // 初始化速度为0
    const currentTime = Date.now();

    // 读取上一次速度值和方向
    let prevSpeed = previousTrainData && previousTrainData.speed !== undefined ? previousTrainData.speed : 0;
    let prevDirection = previousTrainData && previousTrainData.direction ? previousTrainData.direction : 'unknown';
    let isSpeedLost = previousTrainData && previousTrainData.isSpeedLost;
    let speedLostTime = previousTrainData && previousTrainData.speedLostTime ? previousTrainData.speedLostTime : 0;
    
    if (previousTrainData && previousTrainData.timestamp) {
        // 计算基于时间的位置变化方向
        const timeDiff = currentTime - previousTrainData.timestamp;
        const speedLostDuration = currentTime - speedLostTime;

        // 只有当时间差在合理范围内时才计算（避免数据更新不及时导致的异常值）
        // 合理范围：50ms 到 5s
        if (timeDiff > 50 && timeDiff < 5000) {
            direction = [
                carPos.x - previousTrainData.position.x,
                carPos.z - previousTrainData.position.z
            ];
            
            // 计算3D空间中的位移距离
            const distance = Math.sqrt(
                Math.pow(carPos.x - previousTrainData.position.x, 2) +
                Math.pow(carPos.z - previousTrainData.position.z, 2)
            );
            
            const COORD_CHANGE_THRESHOLD = 0.1;
            const isCoordinateChanged = distance > COORD_CHANGE_THRESHOLD;
            
            // 计算速度（假设距离单位是米，时间是毫秒，则结果为 m/s，转换为 km/h 需要乘以 3.6）
            // 注意：这里的时间单位是毫秒，所以需要除以1000转换为秒
            speed = (distance / (timeDiff / 1000) * 3.6);
            
            if (speed <= 0) {
                if (isCoordinateChanged && prevSpeed > 0) {
                    speed = prevSpeed;
                    isSpeedLost = false;
                    speedLostTime = 0;
                } else if (!isSpeedLost) {
                    if (prevSpeed !== 0) speedLostTime = currentTime; else speed = 0;
                    isSpeedLost = prevSpeed !== 0;
                }
            } else {
                isSpeedLost = false;
                speedLostTime = 0;
            }
            
            // 增加速度上限保护（假设列车最高速度不超过 360 km/h）
            if (speed > 360) {
                speed = prevSpeed;
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
            } else {
                speed = prevSpeed;
            }
        } else {
            speed = prevSpeed;
        }

        if (speedLostDuration > 5000 && isSpeedLost) speed = 0;
        
        if (isStopped) {
            speed = 0;
            isSpeedLost = false;
        }
    } else {
        //console.log(`列车 ${trainName} 没有历史位置数据`);
    }

    // 如果计算出的方向向量是[0,0]，继承之前的方向
    if (direction[0] === 0 && direction[1] === 0 && prevDirection !== 'unknown') {
        //console.log(`列车 ${trainName} 方向向量为[0,0]，继承之前方向: ${prevDirection}`);
        // 保持direction为[0,0]，但使用之前的方向用于显示
    }

    // 更新当前列车位置和时间戳到整体数据中
    allTrainsData[trainName] = {
        position: {
            x: carPos.x,
            y: carPos.y,
            z: carPos.z
        },
        timestamp: currentTime,
        speed: speed, // 同时存储速度信息
        prevSpeed: prevSpeed, // 存储之前的速度值
        direction: (direction[0] !== 0 || direction[1] !== 0) ? 
                   (direction[0] > 0 ? 'down' : 'up') : // 简单根据x方向判断，实际应该在主逻辑中计算
                   prevDirection, // 如果方向向量为0，则继承之前的方向
        isSpeedLost: isSpeedLost,
        speedLostTime: speedLostTime
    };

    // 存储所有列车位置数据到localStorage
    try {
        localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
    } catch (e) {
        console.warn('无法存储列车位置数据:', e);
    }

    //console.log(`列车 ${trainName} 最终方向向量:`, direction);
    return direction;
}

// 查找车站的坐标
function findStationCoordinates(stationCode, filterType = null) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.findStationCoordinates(stationCode, filterType);
    }
    
    // 降级处理：如果PositionUtils不可用，使用原有实现
    if (!window.stationsNetwork) return [];
    
    let filteredStations = window.stationsNetwork
        .filter(station => station.name.startsWith(stationCode));
    
    // 如果提供了过滤类型，则进一步过滤
    if (filterType === 'up') {
        // 上行站台：以B结尾
        filteredStations = filteredStations.filter(station => /^[A-Z0-9]+[0-9]B$/.test(station.name));
    } else if (filterType === 'down') {
        // 下行站台：以A结尾
        filteredStations = filteredStations.filter(station => /^[A-Z0-9]+[0-9]A$/.test(station.name));
    }
    
    return filteredStations.map(station => ({
        name: station.name,
        x: station.location.x,
        y: station.location.y,
        z: station.location.z
    }));
}

function findSegmentDuration(lineId, index) { 
    const currentLine = lines.find(line => line.id === lineId);
    const rawDuration = currentLine.route.filter(step => step.type === 'track')[index].duration;
    const duration = 
        ( rawDuration > 60 ? 
            (Math.floor(rawDuration / 60) + '\'') + ((rawDuration % 60) < 10 ? '0' : '') 
            : '' )     
        + (rawDuration % 60) + '\"';
    return duration;
}

// 计算3D空间中点到线段的距离
function distanceFromSegment(p, v, w) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.distanceFromSegment(p, v, w);
    }
    
    // 降级处理：如果PositionUtils不可用，使用原有实现
    const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.z - w.z, 2);
    //console.log(l2,p,v,w)
    if (l2 === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.z - v.z, 2)); // v == w case
    
    let t = ((p.x - v.x) * (w.x - v.x) + (p.z - v.z) * (w.z - v.z)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projection = {
        x: v.x + t * (w.x - v.x),
        z: v.z + t * (w.z - v.z)
    };
    return Math.sqrt(Math.pow(p.x - projection.x, 2) + Math.pow(p.z - projection.z, 2));
}

function calculateTotalDistance(p, track, index) { 
    //console.log('calculateTotalDistance', p, track, index);
    let distance = 0;
    
    // 检查参数有效性
    if (!track || !track.nodes || !Array.isArray(track.nodes)) {
        console.warn('Invalid track data provided to calculateTotalDistance');
        return 0;
    }
    
    if (index < 0 || index >= track.nodes.length) {
        console.warn('Invalid index provided to calculateTotalDistance');
        return 0;
    }
    
    for (let i = 0; i < index; i++) {
        // 确保节点存在
        if (i + 1 < track.nodes.length) {
            const node1 = track.nodes[i];
            const node2 = track.nodes[i + 1];
            
            // 检查节点是否定义
            if (node1 && node2) {
                distance += calculateDistance(node1, node2);
                //console.log ('i<index',distance, track.nodes[i], track.nodes[i + 1]);
            } else {
                console.warn('Undefined node encountered in calculateTotalDistance', node1, node2);
            }
        } else {
            const node1 = track.nodes[i];
            // 检查节点和点p是否定义
            if (node1 && p) {
                distance += calculateDistance(p, node1);
                //console.log ('i=index ',distance, p, track.nodes[i]);
            } else {
                console.warn('Undefined node or point encountered in calculateTotalDistance', p, node1);
            }
            // 只要满足一次这个条件就结束循环
            return distance;
        }
    }
    return distance;
}

function calculateDistance(v, w) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.calculateDistance(v, w);
    }
    
    // 降级处理：如果PositionUtils不可用，使用原有实现
    //console.log ('calculating distance: ',v, w);
    // 检查参数是否定义
    if (!v || !w) {
        console.warn('Undefined parameters passed to calculateDistance', v, w);
        return 0;
    }
    
    // 检查必需的属性是否存在
    if (typeof v.x !== 'number' || typeof v.z !== 'number' || 
        typeof w.x !== 'number' || typeof w.z !== 'number') {
        console.warn('Invalid coordinate data in calculateDistance', v, w);
        return 0;
    }
    return Math.sqrt(Math.pow(v.x - w.x, 2) + Math.pow(v.z - w.z, 2));
}

// 获取线路颜色
function getLineColor(lineId = '') {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.getLineColor(lineId);
    }
    
    // 降级处理：如果PositionUtils不可用，使用原有实现
    const line = lines.find(line => line.id === lineId);
    return line ? line.color : 'var(--color-text-secondary)'; // 如果找不到线路，返回默认灰色
}

// 获取车站名称
function getStationName(stationCode, language = lang) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.getStationName(stationCode, language);
    }
    
    // 降级处理：如果PositionUtils不可用，使用原有实现
    const stationNames = window.strings.station_names;
    if (stationNames[stationCode]) {
        return stationNames[stationCode][language] || stationNames[stationCode].zh_hans || stationCode;
    }
    return stationCode;
}

function detectTrainAtStation(train, line, options) {
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.detectTrainAtStation(train, line, options);
    }
    return {
        isAtStation: false,
        stationName: '',
        stationCode: '',
        platform: '',
        actualCarPos: null,
        stationNode: null
    };
}

function highlightTrainsForCurrentLine() {
    const trainItems = document.querySelectorAll('.train-item');
    console.log('train-items: ', trainItems);
    if (trainItems.length === 0) {
        console.warn('没有找到.train-item元素');
    }
    let activeLineId = getActiveLineId();
    const activeLineName = getLineName(activeLineId);

    let trainNames = [];
    trainItems.forEach(item => {
        const trainName = item.querySelector('.train-name').textContent;
        //console.log(trainName);
        // 如果列车运行线路不是其所属线路或者找不到列车信息则降低不透明度
        const trainInfo = window.trainsInfo.find(t => t.name === trainName);
        if (!trainInfo || (trainInfo && trainInfo.line !== activeLineId)) {
            const iconElement = item.querySelector('.train-icon');
            const nameElement = item.querySelector('.train-name');
            const platformElement = item.querySelector('.platform');
            iconElement.style.opacity = 0.4;
            nameElement.style.opacity = 0.4;
            if (platformElement) { platformElement.style.opacity = 0.4; }
        }
        // 如果列车名称在trainNames中则移除
        if (trainNames.includes(trainName)) {
            item.remove();
        }
        trainNames.push(trainName);
    });
}

// 测量每条线路的总长度
function measureLineLengths(lineId) { 
    let totalLength = 0;
    lines.forEach(line => { 
        if (line.id === lineId) { 
            line.route.filter(track => track.type === 'track').forEach(track => {
                track.nodes.forEach((point,index) => {
                    if (index > 0) {
                        const prevLocation = track.nodes[index - 1];
                        totalLength += calculateDistance(point, prevLocation);
                    }
                });
            })
        }
    });
    return totalLength;
}

function measureSegmentLength(lineId, index) {
    //console.log(lineId, index);
    let totalLength = 0;
    lines.forEach(line => { 
        if (line.id === lineId) {
            const currentSegment = line.route.filter(track => track.type === 'track')[index]
            //console.log(currentSegment.nodes);
            currentSegment.nodes.forEach((point,i) => {
                if (i > 0) {
                    const prevLocation = currentSegment.nodes[i - 1];
                    //console.log(index,point,prevLocation);
                    totalLength += calculateDistance(point, prevLocation);
                }
            });
        }
    });
    return totalLength;
}

// 计算线路总运行时间
function calculateLineTotalTime(lineId) { 
    let totalTime = 0;
    lines.forEach(line => { 
        if (line.id === lineId) { 
            line.route.filter(track => track.type === 'track').forEach((track, index) => {
                totalTime += track.duration;
                if (index < line.route.length - 1) {
                    //totalTime += 60; // 每段之间加一分钟停车时间
                }
            });
        }
    });
    totalTime = Math.ceil(totalTime / 60);
    return totalTime;
}

function shareRouteMap() {
    console.log('shareRouteMap');
    if (typeof MapMode !== 'undefined' && MapMode.isOpen()) {
        const sourceCanvas = document.getElementById('map-canvas');
        const container = document.getElementById('map-canvas-container');
        if (!sourceCanvas || !container) return;

        const containerRect = container.getBoundingClientRect();
        const sidebar = document.querySelector('.side-bar');
        const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
        const sidebarOpen = sidebar && !sidebar.classList.contains('collapsed') && sidebarRect && sidebarRect.width > 0 && sidebarRect.right > containerRect.left && sidebarRect.left < containerRect.right;

        const overlapLeft = sidebarOpen ? Math.max(0, Math.min(sidebarRect.right, containerRect.right) - containerRect.left) : 0;
        const cropX = Math.round(overlapLeft * (sourceCanvas.width / containerRect.width));
        const cropW = sourceCanvas.width - cropX;
        const cropH = sourceCanvas.height;

        if (cropW <= 0 || cropH <= 0) return;

        const titleText = strings.lines_info.map_all_lines[lang];
        const titleFontSize = 48;
        const titlePadding = 36;

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = cropW;
        exportCanvas.height = cropH + titleFontSize + titlePadding * 2;
        const exportCtx = exportCanvas.getContext('2d');

        const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim() || '#f5f5f5';
        exportCtx.fillStyle = bgColor;
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        exportCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim() || '#000';
        exportCtx.font = `bold ${titleFontSize}px ${getComputedStyle(document.body).getPropertyValue('--font-family')}`;
        exportCtx.textAlign = 'left';
        exportCtx.textBaseline = 'top';
        exportCtx.fillText(titleText, titlePadding, titlePadding);

        exportCtx.drawImage(sourceCanvas, cropX, 0, cropW, cropH, 0, titleFontSize + titlePadding * 2, cropW, cropH);

        const img = exportCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        const timestamp = new Date().getTime();
        a.href = img;
        a.download = `${getLineName(getActiveLineId())}_map_${timestamp}.png`;
        a.click();
        return;
    }

    const backgroundColor = getComputedStyle(document.body).backgroundColor;
    const stationsDisplay = document.querySelector('.stations-display');
    const stationList = stationsDisplay.querySelector('.station-list');
    stationList.classList.remove('item');
    stationList.style.backgroundColor = 'var(--color-background-card-solid)';
    stationsDisplay.style.padding = '1rem';
    const lineTitle = document.createElement('h1');
    lineTitle.textContent = getLineName(getActiveLineId());
    lineTitle.style.marginBottom = '1rem';
    stationsDisplay.insertBefore(lineTitle, stationsDisplay.firstChild);
    html2canvas(stationsDisplay, {
        backgroundColor: backgroundColor,
    }).then(canvas => {
        const img = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        const timestamp = new Date().getTime();
        a.href = img;
        a.download = `${lineTitle.textContent + '_' + timestamp}.png`;
        a.click();
    });
    lineTitle.remove();
    stationsDisplay.style.padding = '0';
    stationList.style.backgroundColor = 'var(--color-background-card)';
    stationList.classList.add('item');
}

function handleWindowResize() {
    if (compactParam === 'true') return;
    const lineSelectors = document.querySelectorAll('.line-selector');
    const footer = document.querySelector('footer');
    const header = document.querySelector('header');
    const stationsDisplay = document.querySelector('.stations-display');
    const main = document.querySelector('main');
    const tabs = document.querySelector('.tabs');
    const sideBar = document.querySelector('.side-bar');
    const sideBarBtn = document.querySelector('.side-bar-btn');
    const activeItem = sideBar.querySelector('.side-bar-item.active');
    const activeTab = tabs.querySelector('.tab-item.active');
    const prefActions = document.querySelector('.pref-actions');
    const mapOverlay = document.querySelector('.map-overlay');
    const mapFitBtn = document.querySelector('.map-fit-btn');
    if (header.contains(tabs)) { 
        header.removeChild(tabs);
    }
    while (activeTab && activeTab.children.length > 1) {
        activeTab.removeChild(activeTab.children[1]);
    }
    const swapFooterItems = prefs.swapFooterItems;
    if (swapFooterItems) footer.classList.add('swapped');
    else footer.classList.remove('swapped');
    
    if (window.innerWidth < 720) {
        sideBar.style.opacity = 0;
        sideBar.style.width = 0;
        sideBar.style.opacity = 0;
        sideBar.style.filter = 'blur(24px)';
        footer.style.display = 'flex';
        setTimeout(() => {
            sideBar.style.display = 'none';
            setTimeout(() => {
                footer.style.opacity = 1;
                footer.style.filter = '';
                footer.style.transform = '';
                footer.style.height = '';
                tabs.style.marginLeft = '6px';
            }, 100);
        }, 50);
        prefActions.style.display = 'flex';
        stationsDisplay.style.marginLeft = '0';
        main.style.paddingBottom = `144px`;
    } else {
        //lineSelector.style.zIndex = 1100;
        //lineSelector.style.position = 'fixed';
        //lineSelector.style.top = '66px';
        //lineSelector.style.left = `calc(${window.innerWidth > 920 ? '50vw + ' + mainWidth / 2  + 'px' : '88vw'} - ${mainWidth}px)`;
        // 移除collapsed类
        footer.style.opacity = 0;
        footer.style.height = 0;
        footer.style.filter = 'blur(24px)';
        footer.style.transform = 'scale(1.2)';
        sideBar.style.display = 'flex';
        setTimeout(() => {
            footer.style.display = 'none';
            sideBar.style.opacity = 1;
            sideBar.style.width = '';
            sideBar.style.opacity = 1;
            sideBar.style.filter = '';
            sideBar.style.right = '0';
        }, 10);
        sideBar.style.position = 'relative';
        prefActions.style.display = 'none';
        main.style.paddingBottom = '36px';
        if (!sidebarCollapseDone && sideBarBtn) { 
            if (prefs.collapseSidebar) { 
                if (!sideBar.classList.contains('collapsed')) {
                    sideBar.classList.add('collapsed');
                    sideBarBtn.title = strings.general.expand_side_bar[lang];
                    const sideBarBtnImg = sideBarBtn.querySelector('span');
                    if (sideBarBtnImg) {
                        sideBarBtnImg.textContent = 'menu';
                    }
                }
            } else { 
                if (sideBar.classList.contains('collapsed')) {
                    sideBar.classList.remove('collapsed');
                    sideBarBtn.title = strings.general.collapse_side_bar[lang];
                    const sideBarBtnImg = sideBarBtn.querySelector('span');
                    if (sideBarBtnImg) {
                        sideBarBtnImg.textContent = 'menu_open';
                    }
                }
            }
            sidebarCollapseDone = true;
        }
        setTimeout(() => {
            const lineSelectorWidth = sideBar.getBoundingClientRect().width <= 60 ? 0 : sideBar.getBoundingClientRect().width;
            const mainWidth = main.getBoundingClientRect().width;
            stationsDisplay.style.marginLeft = `calc(${lineSelectorWidth}px + 2vw)`;
            tabs.style.marginLeft = `calc(${lineSelectorWidth}px + 2vw)`;
        }, 150);
    }

    setTimeout(() => {
        if (typeof MapMode !== 'undefined' && MapMode.fitAllIfNeeded) {
            MapMode.fitAllIfNeeded();
        } else {
            mapFitBtn?.click();
        }
    }, 500)

    window.handleActionsOverflow();
}

window.handleWindowResize = handleWindowResize;

// 更新已存在的列车元素上的方向箭头
function updateTrainDirectionArrows() {
    const trainItems = document.querySelectorAll('.train-item');
    trainItems.forEach(trainItem => {
        const trainNameElement = trainItem.querySelector('.train-name');
        if (!trainNameElement) return;
        
        // 获取纯列车名称（去掉箭头和空格）
        let trainName = trainNameElement.textContent.replace(/[↑↓? ]/g, '');
        
        // 检查列车是否在车站内（通过检查是否有.platform元素）
        const platformElement = trainItem.querySelector('.platform');
        const isAtStation = !!platformElement;
        
        // 检查并更新警告标志
        checkAndAddWarningSign({name: trainName}, trainItem, isAtStation);
        
        if (platformElement) {
            // 车站内的列车，根据方向更新站台编号
            const platformText = platformElement.textContent.trim();
            let newPlatformText = platformText;
            
            // 从localStorage获取列车方向信息
            try {
                const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
                const currentTrainData = allTrainsData[trainName];
                
                if (currentTrainData && currentTrainData.direction !== undefined) {
                    const carDirection = currentTrainData.direction;
                    
                    // 根据方向更新站台编号
                    /*if (carDirection === 'down') {
                        // 下行方向显示为A站台
                        newPlatformText = platformText.replace(/[A-Za-z]/g, '') + 'A';
                    } else if (carDirection === 'up') {
                        // 上行方向显示为B站台
                        newPlatformText = platformText.replace(/[A-Za-z]/g, '') + 'B';
                    }*/
                    // 如果方向未知，则保持原始platform值
                    
                    // 更新站台编号
                    platformElement.textContent = newPlatformText + ' ';
                }
            } catch (e) {
                console.warn('更新车站内列车站台编号时出错:', e);
            }
            
            // 车站内的列车不显示方向箭头，保持原样
            return;
        }
        
        // 获取列车名称（去掉箭头和空格）
        trainName = trainNameElement.textContent.replace(/[↑↓? ]/g, '');
        
        // 从localStorage获取列车方向信息
        try {
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const currentTrainData = allTrainsData[trainName];
            
            if (currentTrainData && currentTrainData.direction !== undefined) {
                // 获取当前方向
                const carDirection = currentTrainData.direction;
                
                // 构造新的列车名称（包含方向箭头）
                let newTrainName = trainName;
                // 修复方向显示逻辑，使显示与实际方向一致
                // down表示与轨道默认方向一致，显示为↓；up表示与轨道默认方向相反，显示为↑
                // unknown表示无法确定方向，显示为?
                if (carDirection === 'up') {
                    newTrainName = '↑ ' + trainName;
                } else if (carDirection === 'down') {
                    newTrainName = '↓ ' + trainName;
                } else {
                    newTrainName = '? ' + trainName;
                }
                
                // 更新列车名称
                trainNameElement.textContent = newTrainName;
            }
        } catch (e) {
            console.warn('更新列车方向箭头时出错:', e);
        }
    });
}

function checkAndAddWarningSign(train, trainItem, isAtStation) {
    if (typeof WarningManager !== 'undefined') {
        WarningManager.updateWarningState(train, trainItem, isAtStation, strings, lang);
        return;
    }
    
    if (typeof PositionUtils !== 'undefined') {
        PositionUtils.checkAndAddWarningSign(train, trainItem, isAtStation);
        return;
    }
    
    try {
        const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
        const currentTrainData = allTrainsData[train.name];
        let shouldShowWarning = false;
        let warningReasons = [];
        
        if (isAtStation && currentTrainData && currentTrainData.timestamp) {
            const timeInStation = Date.now() - currentTrainData.timestamp;
            if (timeInStation > 180000) {
                shouldShowWarning = true;
                warningReasons.push('long_stop');
            }
        }
        
        if (currentTrainData && currentTrainData.speed === 0) {
            const isAtAnyStation = checkIfTrainAtAnyStation(train.name);
            if (!isAtAnyStation) {
                shouldShowWarning = true;
                warningReasons.push('zero_speed');
            }
        }
        
        if (isAtStation) {
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
        
        const existingWarning = trainItem.querySelector('.warning');
        if (shouldShowWarning && !existingWarning) {
            const warningSpan = document.createElement('span');
            warningSpan.className = 'warning';
            warningSpan.style.color = 'crimson';
            warningSpan.style.fontWeight = 'bold';
            warningSpan.textContent = '! ';
            trainItem.appendChild(warningSpan);
            trainItem.style.color = 'crimson';
            
            if (!allTrainsData[train.name]) {
                allTrainsData[train.name] = {};
            }
            allTrainsData[train.name].warningReasons = warningReasons;
            localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
        } else if (!shouldShowWarning && existingWarning) {
            existingWarning.remove();
            trainItem.style.color = '';
            if (allTrainsData[train.name]) {
                delete allTrainsData[train.name].warningReasons;
                localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
            }
        }
    } catch (e) {
        console.warn('检查列车警告标志时出错:', e);
    }
}

// 添加一个辅助函数，用于检查列车是否在任何车站
function checkIfTrainAtAnyStation(trainName) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.checkIfTrainAtAnyStation(trainName);
    }
    
    // 降级处理：如果PositionUtils不可用，使用原有实现
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
        const belongsToLine = window.lines?.find(line => line.id === linePrefix);
        if (belongsToLine) {
            return true;
        }
    }
    
    return false;
}

var MapMode = (function () {
    var overlay, canvas, ctx, container, tooltip, tooltipTitle, tooltipBody;
    var zoomIndicator;
    var isOpen = false;
    var showTrains = true;
    var interactionsSetup = false;
    var dragMoved = false;

    var viewState = {
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragOffsetX: 0,
        dragOffsetY: 0
    };

    var stationCoordsMap = {};
    var mapTrainsData = null;
    var mapPlayersData = [];
    var playerAvatars = {};
    var playerRefreshTimer = null;
    var playerFetchController = null;
    var playerFetchInFlight = false;
    var avatarRenderTimer = null;
    var storageListener = null;

    var MIN_ZOOM = 0.05;
    var MAX_ZOOM = 2;
    var STATION_RADIUS = 6;
    var TRAIN_RADIUS = 10;
    var sidebarObserver = null;
    var mouseScreenX = -1;
    var mouseScreenY = -1;
    var isMouseOverCanvas = false;
    var frozenMouseWorldX = 0;
    var frozenMouseWorldZ = 0;
    var isMouseWorldFrozen = false;

    var TRAIN_ANIMATION_DURATION = 2000;
    var PLAYER_ANIMATION_DURATION = 20000;
    var trainPositionCache = {};
    var playerPositionCache = {};
    var animationFrameId = null;
    var hasUserZoomed = false;

    function getSidebarWidth() {
        var sidebar = document.querySelector('.side-bar');
        if (!sidebar) return 0;
        if (sidebar.classList.contains('collapsed')) return 0;
        if (sidebar.style.display === 'none') return 0;
        var rect = sidebar.getBoundingClientRect();
        return rect.width > 60 ? rect.width : 0;
    }

    function getCanvasCssWidth() {
        return container ? container.getBoundingClientRect().width : canvas.width;
    }

    function getCanvasCssHeight() {
        return container ? container.getBoundingClientRect().height : canvas.height;
    }

    function getVisibleCenterX() {
        var cw = getCanvasCssWidth();
        var sw = getSidebarWidth();
        return (cw + sw) / 2;
    }

    function worldToScreen(wx, wz) {
        var ch = getCanvasCssHeight();
        var centerX = getVisibleCenterX();
        var sx = (wx + viewState.offsetX) * viewState.zoom + centerX;
        var sy = (wz + viewState.offsetY) * viewState.zoom + ch / 2;
        return { x: sx, y: sy };
    }

    function screenToWorld(sx, sy) {
        var ch = getCanvasCssHeight();
        var centerX = getVisibleCenterX();
        var wx = (sx - centerX) / viewState.zoom - viewState.offsetX;
        var wz = (sy - ch / 2) / viewState.zoom - viewState.offsetY;
        return { x: wx, z: wz };
    }

    function getElementScale() {
        return Math.pow(viewState.zoom,0.2) * 2;
       // return Math.max(0.4, Math.min(4, Math.pow(viewState.zoom, 0.2)));
    }

    function easeLinear(t) {
        return t;
    }

    function getCurrentInterpolated(entry, now, duration) {
        var elapsed = now - entry.startTime;
        var progress = Math.min(1, elapsed / duration);
        return {
            x: entry.prevX + (entry.x - entry.prevX) * progress,
            z: entry.prevZ + (entry.z - entry.prevZ) * progress
        };
    }

    function updatePositionCache(cache, key, newX, newZ, duration) {
        var now = Date.now();
        var entry = cache[key];
        if (!entry) {
            cache[key] = {
                x: newX,
                z: newZ,
                prevX: newX,
                prevZ: newZ,
                startTime: now
            };
            return cache[key];
        }

        if (Math.abs(entry.x - newX) > 0.5 || Math.abs(entry.z - newZ) > 0.5) {
            var current = getCurrentInterpolated(entry, now, duration);
            var distance = Math.sqrt(Math.pow(newX - current.x, 2) + Math.pow(newZ - current.z, 2));
            var speed = distance * 1000 / duration;
            
            if (speed > 200) {
                entry.prevX = newX;
                entry.prevZ = newZ;
            } else {
                entry.prevX = current.x;
                entry.prevZ = current.z;
            }
            entry.x = newX;
            entry.z = newZ;
            entry.startTime = now;
        }

        return entry;
    }

    function getInterpolatedPosition(entry, duration) {
        var now = Date.now();
        var elapsed = now - entry.startTime;
        var progress = Math.min(1, elapsed / duration);

        return {
            x: entry.prevX + (entry.x - entry.prevX) * progress,
            z: entry.prevZ + (entry.z - entry.prevZ) * progress
        };
    }

    function computeBounds() {
        var minX = Infinity, maxX = -Infinity;
        var minZ = Infinity, maxZ = -Infinity;
        window.lines.forEach(function (line) {
            //if (line.id.match('-R')) return;
            line.route.forEach(function (node) {
                if (node.type === 'track') {
                    node.nodes.forEach(function (pt) {
                        if (pt.x < minX) minX = pt.x;
                        if (pt.x > maxX) maxX = pt.x;
                        if (pt.z < minZ) minZ = pt.z;
                        if (pt.z > maxZ) maxZ = pt.z;
                    });
                }
            });
        });
        return { minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ };
    }

    function fitAll() {
        var bounds = computeBounds();
        var worldW = bounds.maxX - bounds.minX;
        var worldH = bounds.maxZ - bounds.minZ;
        if (worldW <= 0 || worldH <= 0) return;

        var cw = getCanvasCssWidth();
        var ch = getCanvasCssHeight();
        var sw = getSidebarWidth();
        var visibleW = cw - sw;
        var padding = 80;
        var scaleX = (visibleW - padding * 2) / worldW;
        var scaleY = (ch - padding * 2) / worldH;
        var initialZoom = Math.min(scaleX, scaleY);

        var savedZoom = viewState.zoom;
        var savedOffsetX = viewState.offsetX;
        var savedOffsetY = viewState.offsetY;
        viewState.zoom = initialZoom;
        viewState.offsetX = -(bounds.minX + worldW / 2);
        viewState.offsetY = -(bounds.minZ + worldH / 2);

        var fontFamily = getComputedStyle(document.body).getPropertyValue('--font-family');
        var fontSize = 11;
        ctx.font = fontSize + 'px ' + fontFamily;
        var stationRadius = STATION_RADIUS;
        var gap = stationRadius + 6;

        buildMapSegments();
        var tempLabels = [];

        var labelBounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };

        Object.keys(stationCoordsMap).forEach(function (code) {
            var station = stationCoordsMap[code];
            if (station.count === 0) return;
            var pos = worldToScreen(station.x, station.z);
            var name = getStationName(code, lang);
            var nameWidth = Math.max(ctx.measureText(name).width, 32);
            var nameHeight = fontSize + 3;

            var candidates = buildCandidatePositions(pos, nameWidth, nameHeight, gap);
            var best = null;

            for (var i = 0; i < candidates.length; i++) {
                var c = candidates[i];
                var collision = false;
                for (var j = 0; j < mapSegments.length; j++) {
                    var seg = mapSegments[j];
                    if (rectIntersectsSegment(c.boxX, c.boxY, nameWidth, nameHeight, seg.x1, seg.y1, seg.x2, seg.y2)) {
                        collision = true;
                        break;
                    }
                }
                if (!collision) {
                    for (var k = 0; k < tempLabels.length; k++) {
                        var r = tempLabels[k];
                        if (rectsOverlap(c.boxX, c.boxY, nameWidth, nameHeight, r.x, r.y, r.w, r.h)) {
                            collision = true;
                            break;
                        }
                    }
                }
                if (!collision) {
                    best = c;
                    break;
                }
            }

            if (best) {
                tempLabels.push({ x: best.boxX, y: best.boxY, w: nameWidth, h: nameHeight });
                var screenMinX = Math.min(pos.x - stationRadius, best.boxX);
                var screenMaxX = Math.max(pos.x + stationRadius, best.boxX + nameWidth);
                var screenMinZ = Math.min(pos.y - stationRadius, best.boxY);
                var screenMaxZ = Math.max(pos.y + stationRadius, best.boxY + nameHeight);

                var worldMin = screenToWorld(screenMinX, screenMinZ);
                var worldMax = screenToWorld(screenMaxX, screenMaxZ);

                if (worldMin.x < labelBounds.minX) labelBounds.minX = worldMin.x;
                if (worldMax.x > labelBounds.maxX) labelBounds.maxX = worldMax.x;
                if (worldMin.z < labelBounds.minZ) labelBounds.minZ = worldMin.z;
                if (worldMax.z > labelBounds.maxZ) labelBounds.maxZ = worldMax.z;
            }
        });

        viewState.zoom = savedZoom;
        viewState.offsetX = savedOffsetX;
        viewState.offsetY = savedOffsetY;

        var totalMinX = Math.min(bounds.minX, labelBounds.minX);
        var totalMaxX = Math.max(bounds.maxX, labelBounds.maxX);
        var totalMinZ = Math.min(bounds.minZ, labelBounds.minZ);
        var totalMaxZ = Math.max(bounds.maxZ, labelBounds.maxZ);
        var expandedW = totalMaxX - totalMinX;
        var expandedH = totalMaxZ - totalMinZ;

        scaleX = (visibleW - padding * 2) / expandedW;
        scaleY = (ch - padding * 2) / expandedH;
        viewState.zoom = Math.min(scaleX, scaleY);
        MIN_ZOOM = viewState.zoom;

        viewState.offsetX = -(totalMinX + expandedW / 2);
        viewState.offsetY = -(totalMinZ + expandedH / 2);

        render();
    }

    function computeMinZoom() {
        var bounds = computeBounds();
        var worldW = bounds.maxX - bounds.minX;
        var worldH = bounds.maxZ - bounds.minZ;
        if (worldW <= 0 || worldH <= 0) return MIN_ZOOM;

        var cw = getCanvasCssWidth();
        var ch = getCanvasCssHeight();
        var sw = getSidebarWidth();
        var visibleW = cw - sw;
        var padding = 80;
        var scaleX = (visibleW - padding * 2) / worldW;
        var scaleY = (ch - padding * 2) / worldH;
        var initialZoom = Math.min(scaleX, scaleY);

        var savedZoom = viewState.zoom;
        var savedOffsetX = viewState.offsetX;
        var savedOffsetY = viewState.offsetY;
        viewState.zoom = initialZoom;
        viewState.offsetX = -(bounds.minX + worldW / 2);
        viewState.offsetY = -(bounds.minZ + worldH / 2);

        var fontFamily = getComputedStyle(document.body).getPropertyValue('--font-family');
        var fontSize = 11;
        ctx.font = fontSize + 'px ' + fontFamily;
        var stationRadius = STATION_RADIUS;
        var gap = stationRadius + 6;

        buildMapSegments();
        var tempLabels = [];
        var labelBounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };

        Object.keys(stationCoordsMap).forEach(function (code) {
            var station = stationCoordsMap[code];
            if (station.count === 0) return;
            var pos = worldToScreen(station.x, station.z);
            var name = getStationName(code, lang);
            var nameWidth = Math.max(ctx.measureText(name).width, 32);
            var nameHeight = fontSize + 3;

            var candidates = buildCandidatePositions(pos, nameWidth, nameHeight, gap);
            var best = null;

            for (var i = 0; i < candidates.length; i++) {
                var c = candidates[i];
                var collision = false;
                for (var j = 0; j < mapSegments.length; j++) {
                    var seg = mapSegments[j];
                    if (rectIntersectsSegment(c.boxX, c.boxY, nameWidth, nameHeight, seg.x1, seg.y1, seg.x2, seg.y2)) {
                        collision = true;
                        break;
                    }
                }
                if (!collision) {
                    for (var k = 0; k < tempLabels.length; k++) {
                        var r = tempLabels[k];
                        if (rectsOverlap(c.boxX, c.boxY, nameWidth, nameHeight, r.x, r.y, r.w, r.h)) {
                            collision = true;
                            break;
                        }
                    }
                }
                if (!collision) {
                    best = c;
                    break;
                }
            }

            if (best) {
                tempLabels.push({ x: best.boxX, y: best.boxY, w: nameWidth, h: nameHeight });
                var screenMinX = Math.min(pos.x - stationRadius, best.boxX);
                var screenMaxX = Math.max(pos.x + stationRadius, best.boxX + nameWidth);
                var screenMinZ = Math.min(pos.y - stationRadius, best.boxY);
                var screenMaxZ = Math.max(pos.y + stationRadius, best.boxY + nameHeight);

                var worldMin = screenToWorld(screenMinX, screenMinZ);
                var worldMax = screenToWorld(screenMaxX, screenMaxZ);

                if (worldMin.x < labelBounds.minX) labelBounds.minX = worldMin.x;
                if (worldMax.x > labelBounds.maxX) labelBounds.maxX = worldMax.x;
                if (worldMin.z < labelBounds.minZ) labelBounds.minZ = worldMin.z;
                if (worldMax.z > labelBounds.maxZ) labelBounds.maxZ = worldMax.z;
            }
        });

        viewState.zoom = savedZoom;
        viewState.offsetX = savedOffsetX;
        viewState.offsetY = savedOffsetY;

        var totalMinX = Math.min(bounds.minX, labelBounds.minX);
        var totalMaxX = Math.max(bounds.maxX, labelBounds.maxX);
        var totalMinZ = Math.min(bounds.minZ, labelBounds.minZ);
        var totalMaxZ = Math.max(bounds.maxZ, labelBounds.maxZ);
        var expandedW = totalMaxX - totalMinX;
        var expandedH = totalMaxZ - totalMinZ;

        scaleX = (visibleW - padding * 2) / expandedW;
        scaleY = (ch - padding * 2) / expandedH;
        return Math.min(scaleX, scaleY);
    }

    function drawGrid() {
        ctx.save();
        var cw = getCanvasCssWidth();
        var ch = getCanvasCssHeight();
        var topLeft = screenToWorld(0, 0);
        var bottomRight = screenToWorld(cw, ch);

        var gridSpacing = 500;
        if (viewState.zoom < 0.3) gridSpacing = 2000;
        else if (viewState.zoom < 0.8) gridSpacing = 1000;

        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || 'rgba(128,128,128,0.15)';
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.3;

        var startX = Math.floor(topLeft.x / gridSpacing) * gridSpacing;
        var endX = Math.ceil(bottomRight.x / gridSpacing) * gridSpacing;
        for (var gx = startX; gx <= endX; gx += gridSpacing) {
            var s = worldToScreen(gx, 0);
            ctx.beginPath();
            ctx.moveTo(s.x, 0);
            ctx.lineTo(s.x, ch);
            ctx.stroke();
        }

        var startZ = Math.floor(topLeft.z / gridSpacing) * gridSpacing;
        var endZ = Math.ceil(bottomRight.z / gridSpacing) * gridSpacing;
        for (var gz = startZ; gz <= endZ; gz += gridSpacing) {
            var s2 = worldToScreen(0, gz);
            ctx.beginPath();
            ctx.moveTo(0, s2.y);
            ctx.lineTo(cw, s2.y);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }

    function drawSingleLine(line) {
        ctx.save();
        if (line.id.match('-R')) {
            ctx.globalAlpha = 0.4;
        }
        ctx.strokeStyle = line.color;
        ctx.lineWidth = Math.max(1, 3 * getElementScale());
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        var tracks = line.route.filter(function (n) { return n.type === 'track'; });
        tracks.forEach(function (track) {
            if (!track.nodes || track.nodes.length < 2) return;
            ctx.beginPath();
            var p0 = worldToScreen(track.nodes[0].x, track.nodes[0].z);
            ctx.moveTo(p0.x, p0.y);
            for (var i = 1; i < track.nodes.length; i++) {
                var pi = worldToScreen(track.nodes[i].x, track.nodes[i].z);
                ctx.lineTo(pi.x, pi.y);
            }
            ctx.stroke();
        });
        ctx.restore();
    }

    function drawLines() {
        ctx.save();

        window.lines.forEach(function (line) {
            if (line.id.match('-R')) {
                drawSingleLine(line);
            }
        });
        
        window.lines.forEach(function (line) {
            if (line.id.startsWith('GX')) {
                var originalColor = line.color;
                line.color = '#808080';
                drawSingleLine(line);
                line.color = originalColor;
            }
        });

        window.lines.forEach(function (line) {
            if (!line.id.startsWith('GX')&& !line.id.match('-R')) {
                drawSingleLine(line);
            }
        });

        ctx.restore();
    }

    function buildStationCoords() {
        stationCoordsMap = {};
        window.lines.forEach(function (line) {
            if (line.id.match('-R')) return;
            for (var i = 0; i < line.route.length; i++) {
                var node = line.route[i];
                if (node.type === 'station') {
                    var code = node.code;
                    if (!stationCoordsMap[code]) {
                        stationCoordsMap[code] = { x: 0, z: 0, count: 0, lines: [] };
                    }
                    stationCoordsMap[code].lines.push(line.id);

                    var prevTrack = null;
                    var nextTrack = null;
                    for (var j = i - 1; j >= 0; j--) {
                        if (line.route[j].type === 'track') { prevTrack = line.route[j]; break; }
                    }
                    for (var k = i + 1; k < line.route.length; k++) {
                        if (line.route[k].type === 'track') { nextTrack = line.route[k]; break; }
                    }

                    var cx = 0, cz = 0;
                    if (prevTrack && prevTrack.nodes.length > 0) {
                        var lastNode = prevTrack.nodes[prevTrack.nodes.length - 1];
                        cx += lastNode.x;
                        cz += lastNode.z;
                        stationCoordsMap[code].count++;
                    }
                    if (nextTrack && nextTrack.nodes.length > 0) {
                        var firstNode = nextTrack.nodes[0];
                        cx += firstNode.x;
                        cz += firstNode.z;
                        stationCoordsMap[code].count++;
                    }
                    if (stationCoordsMap[code].count > 0) {
                        stationCoordsMap[code].x += cx;
                        stationCoordsMap[code].z += cz;
                    }
                }
            }
        });

        Object.keys(stationCoordsMap).forEach(function (code) {
            var s = stationCoordsMap[code];
            if (s.count > 0) {
                s.x = s.x / s.count;
                s.z = s.z / s.count;
            }
        });
    }

    var mapSegments = [];

    function buildMapSegments() {
        mapSegments = [];
        window.lines.forEach(function (line) {
            //if (line.id.match('-R')) return;
            var tracks = line.route.filter(function (n) { return n.type === 'track'; });
            tracks.forEach(function (track) {
                if (!track.nodes || track.nodes.length < 2) return;
                for (var i = 0; i < track.nodes.length - 1; i++) {
                    var p0 = worldToScreen(track.nodes[i].x, track.nodes[i].z);
                    var p1 = worldToScreen(track.nodes[i + 1].x, track.nodes[i + 1].z);
                    mapSegments.push({ x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y });
                }
            });
        });
    }

    function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        var d1 = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
        var d2 = (x4 - x3) * (y2 - y3) - (y4 - y3) * (x2 - x3);
        var d3 = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
        var d4 = (x2 - x1) * (y4 - y1) - (y2 - y1) * (x4 - x1);
        if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
            ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
            return true;
        }
        return false;
    }

    function rectIntersectsSegment(rx, ry, rw, rh, x1, y1, x2, y2) {
        var pad = 2;
        var left = rx - pad;
        var top = ry - pad;
        var right = rx + rw + pad;
        var bottom = ry + rh + pad;

        if ((x1 >= left && x1 <= right && y1 >= top && y1 <= bottom) ||
            (x2 >= left && x2 <= right && y2 >= top && y2 <= bottom)) {
            return true;
        }

        var corners = [[left, top], [right, top], [right, bottom], [left, bottom]];
        for (var i = 0; i < 4; i++) {
            var j = (i + 1) % 4;
            if (segmentsIntersect(x1, y1, x2, y2, corners[i][0], corners[i][1], corners[j][0], corners[j][1])) {
                return true;
            }
        }
        return false;
    }

    var placedLabels = [];

    function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    function checkLabelCollision(labelX, labelY, labelW, labelH) {
        for (var i = 0; i < mapSegments.length; i++) {
            var seg = mapSegments[i];
            if (rectIntersectsSegment(labelX, labelY, labelW, labelH, seg.x1, seg.y1, seg.x2, seg.y2)) {
                return true;
            }
        }
        for (var j = 0; j < placedLabels.length; j++) {
            var r = placedLabels[j];
            if (rectsOverlap(labelX, labelY, labelW, labelH, r.x, r.y, r.w, r.h)) {
                return true;
            }
        }
        return false;
    }

    function buildCandidatePositions(pos, nameWidth, nameHeight, gap) {
        var positions = [];
        var DISTANCES = [gap, gap + 2, gap + 4];

        var rightAngles = [0, 20, -20, 40, -40, 60, -60, 80, -80];
        var leftAngles = [180, 160, 200, 140, 220, 120, 240, 100, 260];
        var centerAngles = [270, 90];

        DISTANCES.forEach(function (d) {
            rightAngles.forEach(function (deg) {
                var rad = deg * Math.PI / 180;
                var anchorX = pos.x + Math.cos(rad) * d;
                var anchorY = pos.y + Math.sin(rad) * d;
                positions.push({
                    textX: anchorX,
                    textY: anchorY,
                    boxX: anchorX,
                    boxY: anchorY - nameHeight / 2,
                    align: 'left'
                });
            });

            leftAngles.forEach(function (deg) {
                var rad = deg * Math.PI / 180;
                var anchorX = pos.x + Math.cos(rad) * d;
                var anchorY = pos.y + Math.sin(rad) * d;
                positions.push({
                    textX: anchorX,
                    textY: anchorY,
                    boxX: anchorX - nameWidth,
                    boxY: anchorY - nameHeight / 2,
                    align: 'right'
                });
            });

            centerAngles.forEach(function (deg) {
                var rad = deg * Math.PI / 180;
                var anchorX = pos.x + Math.cos(rad) * d;
                var anchorY = pos.y + Math.sin(rad) * d;
                positions.push({
                    textX: anchorX,
                    textY: anchorY,
                    boxX: anchorX - nameWidth / 2,
                    boxY: anchorY - nameHeight / 2,
                    align: 'center'
                });
            });
        });

        return positions;
    }

    function drawStations() {
        ctx.save();
        buildMapSegments();
        placedLabels = [];

        var bgColor = getComputedStyle(document.documentElement).getPropertyValue('--color-background-card-solid').trim() || '#fff';
        var textColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim() || '#000';
        var fontFamily = getComputedStyle(document.body).getPropertyValue('--font-family');
        var scale = getElementScale();
        var stationRadius = Math.max(3, STATION_RADIUS * scale);
        var fontSize = Math.max(8, Math.round(11 * scale));
        ctx.font = fontSize + 'px ' + fontFamily;

        var GAP = stationRadius + Math.max(3, 6 * scale);

        var stationEntries = [];
        Object.keys(stationCoordsMap).forEach(function (code) {
            var station = stationCoordsMap[code];
            if (station.count === 0) return;
            var pos = worldToScreen(station.x, station.z);
            stationEntries.push({ code: code, station: station, pos: pos });

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, stationRadius, 0, Math.PI * 2);
            ctx.fillStyle = bgColor;
            ctx.fill();

            var primaryColor = station.lines.length > 1 ? '#666' : (window.lines.find(function (l) { return l.id === station.lines[0]; }) || {}).color || '#666';
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = Math.max(1, 2.5 * scale);
            ctx.stroke();
        });

        stationEntries.forEach(function (entry) {
            var name = getStationName(entry.code, lang);
            var nameWidth = Math.max(ctx.measureText(name).width, Math.max(20, 32 * scale));
            var nameHeight = fontSize + 3;

            var candidates = buildCandidatePositions(entry.pos, nameWidth, nameHeight, GAP);
            var best = null;

            for (var i = 0; i < candidates.length; i++) {
                var c = candidates[i];
                if (!checkLabelCollision(c.boxX, c.boxY, nameWidth, nameHeight)) {
                    best = c;
                    break;
                }
            }

            if (!best) return;

            placedLabels.push({ x: best.boxX, y: best.boxY, w: nameWidth, h: nameHeight });

            ctx.textAlign = best.align;
            ctx.textBaseline = 'middle';

            ctx.strokeStyle = bgColor;
            ctx.lineWidth = Math.max(2, 3 * scale);
            ctx.lineJoin = 'round';
            ctx.strokeText(name, best.textX, best.textY);

            ctx.fillStyle = textColor;
            ctx.fillText(name, best.textX, best.textY);
        });
        ctx.restore();
    }

    function drawTrains() {
        if (!showTrains || !mapTrainsData || !mapTrainsData.trains) return;
        ctx.save();

        var needsAnimation = false;

        mapTrainsData.trains.forEach(function (train) {
            if (!train || !train.cars || train.cars.length === 0) return;
            var car = train.cars[0];
            if (!car.leading || !car.leading.location) return;
            var loc = car.leading.location;

            var cacheEntry = updatePositionCache(trainPositionCache, train.name, loc.x, loc.z, TRAIN_ANIMATION_DURATION);
            var interpolated = getInterpolatedPosition(cacheEntry, TRAIN_ANIMATION_DURATION);
            var progress = Math.min(1, (Date.now() - cacheEntry.startTime) / TRAIN_ANIMATION_DURATION);
            if (progress < 1) needsAnimation = true;

            var pos = worldToScreen(interpolated.x, interpolated.z);
            var scale = Math.pow(getElementScale(),0.1);
            var r = Math.max(5, TRAIN_RADIUS * scale);

            var trainInfo = window.trainsInfo ? window.trainsInfo.find(function (t) { return t.name === train.name; }) : null;
            var trainLine = trainInfo ? trainInfo.line : '';
            var lineData = window.lines.find(function (l) { return l.id === trainLine; });
            var color = lineData ? lineData.color : '#e77000';

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.85;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = Math.max(1, 1.5 * scale);
            ctx.stroke();

            ctx.font = Math.max(10, Math.round(16 * scale)) + 'px "Material Symbols Outlined"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(1.5, 3 * scale);
            ctx.lineJoin = 'round';
            ctx.strokeText('directions_subway', pos.x, pos.y);
            ctx.fillStyle = '#fff';
            ctx.fillText('directions_subway', pos.x, pos.y);
        });

        if (needsAnimation) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(function () {
                animationFrameId = null;
                if (isOpen) render();
            });
        }

        ctx.restore();
    }

    function isShowPlayers() {
        var prefs = getPreferences();
        return prefs.showPlayers === true;
    }

    function loadPlayerAvatar(playerName) {
        if (playerAvatars[playerName]) {
            if (playerAvatars[playerName] === 'error') return null;
            return playerAvatars[playerName];
        }
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = 'https://mc-heads.hydcraft.cn/avatar/' + encodeURIComponent(playerName) + '/24.png';
        img.onload = function () {
            if (avatarRenderTimer) clearTimeout(avatarRenderTimer);
            avatarRenderTimer = setTimeout(function () {
                avatarRenderTimer = null;
                if (isOpen) render();
            }, 80);
        };
        img.onerror = function () {
            playerAvatars[playerName] = 'error';
            setTimeout(function () {
                if (playerAvatars[playerName] === 'error') delete playerAvatars[playerName];
            }, 120000);
        };
        playerAvatars[playerName] = img;
        return img;
    }

    function fetchPlayersData() {
        if (!isShowPlayers()) {
            mapPlayersData = [];
            return;
        }
        
        if (typeof PositionUtils !== 'undefined' && PositionUtils.fetchAndDisplayPlayers) {
            PositionUtils.fetchAndDisplayPlayers(function(players) {
                mapPlayersData = players;
                players.forEach(function (p) { loadPlayerAvatar(p.name); });
                if (isOpen) render();
            });
        } else {
            if (playerFetchInFlight) {
                if (playerFetchController) playerFetchController.abort();
            }
            playerFetchInFlight = true;
            var timestamp = Date.now();
            var playerDataUrl = 'https://map.nitrogen.hydcraft.cn/up/world/world/' + timestamp;
            playerFetchController = new AbortController();
            var controller = playerFetchController;
            var timeoutId = setTimeout(function () { controller.abort(); }, 5000);

            fetch(playerDataUrl, {
                signal: controller.signal,
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                mode: 'cors'
            })
                .then(function (response) {
                    clearTimeout(timeoutId);
                    if (!response.ok) throw new Error('HTTP error: ' + response.status);
                    return response.json();
                })
                .then(function (data) {
                    playerFetchInFlight = false;
                    playerFetchController = null;
                    if (data.players && data.players.length > 0) {
                        mapPlayersData = data.players;
                        data.players.forEach(function (p) { loadPlayerAvatar(p.name); });
                        if (isOpen) render();
                    } else {
                        mapPlayersData = [];
                        if (isOpen) render();
                    }
                })
                .catch(function () {
                    clearTimeout(timeoutId);
                    playerFetchInFlight = false;
                    playerFetchController = null;
                });
        }
    }

    function startPlayersRefresh() {
        fetchPlayersData();
        playerRefreshTimer = setInterval(fetchPlayersData, 15000);
    }

    function stopPlayersRefresh() {
        if (playerRefreshTimer) {
            clearInterval(playerRefreshTimer);
            playerRefreshTimer = null;
        }
        if (playerFetchController) {
            playerFetchController.abort();
            playerFetchController = null;
        }
        playerFetchInFlight = false;
        mapPlayersData = [];
    }

    function drawRoundedRect(x, y, w, h, r) {
        if (w < r * 2) r = w / 2;
        if (h < r * 2) r = h / 2;
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    }

    function drawPlayers() {
        if (!isShowPlayers() || !mapPlayersData || mapPlayersData.length === 0) return;

        var scale = Math.pow(getElementScale(), 0.1);
        var size = Math.max(12, Math.round(18 * scale));
        var half = size / 2;
        var cr = Math.max(3, Math.round(size / 6));
        var needsAnimation = false;

        mapPlayersData.forEach(function (player) {
            if (!player || player.x === undefined || player.z === undefined) return;

            var cacheEntry = updatePositionCache(playerPositionCache, player.name, player.x, player.z, PLAYER_ANIMATION_DURATION);
            var interpolated = getInterpolatedPosition(cacheEntry, PLAYER_ANIMATION_DURATION);
            var progress = Math.min(1, (Date.now() - cacheEntry.startTime) / PLAYER_ANIMATION_DURATION);
            if (progress < 1) needsAnimation = true;

            var pos = worldToScreen(interpolated.x, interpolated.z);
            var avatar = playerAvatars[player.name];
            var loaded = avatar && avatar !== 'error' && avatar.complete && avatar.naturalWidth > 0;

            ctx.save();

            ctx.beginPath();
            drawRoundedRect(pos.x - half - 1.5, pos.y - half - 1.5, size + 3, size + 3, cr + 1);
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = Math.max(1, 1.5 * scale);
            ctx.stroke();

            ctx.beginPath();
            drawRoundedRect(pos.x - half, pos.y - half, size, size, cr);
            ctx.clip();

            if (loaded) {
                ctx.drawImage(avatar, pos.x - half, pos.y - half, size, size);
            } else {
                ctx.fillStyle = '#888';
                ctx.fillRect(pos.x - half, pos.y - half, size, size);
                ctx.font = Math.max(8, Math.round(10 * scale)) + 'px "Material Symbols Outlined"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#fff';
                ctx.fillText('\ue7fd', pos.x, pos.y);
            }

            ctx.restore();
        });

        if (needsAnimation) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(function () {
                animationFrameId = null;
                if (isOpen) render();
            });
        }
    }

    function findPlayerAtScreen(sx, sy) {
        if (!isShowPlayers() || !mapPlayersData || mapPlayersData.length === 0) return null;
        var bestDist = Infinity;
        var bestPlayer = null;
        var scale = Math.pow(getElementScale(), 0.1);
        var hitRadius = Math.max(10, Math.round(14 * scale));

        mapPlayersData.forEach(function (player) {
            if (!player || player.x === undefined || player.z === undefined) return;
            var pos = worldToScreen(player.x, player.z);
            var dx = pos.x - sx;
            var dy = pos.y - sy;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < hitRadius && dist < bestDist) {
                bestDist = dist;
                bestPlayer = player;
            }
        });
        return bestPlayer;
    }

    function findNearestStationForPlayer(px, pz) {
        var bestDist = Infinity;
        var bestCode = null;

        Object.keys(stationCoordsMap).forEach(function (code) {
            var st = stationCoordsMap[code];
            if (st.count === 0) return;
            var dx = px - st.x;
            var dz = pz - st.z;
            var dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < bestDist) {
                bestDist = dist;
                bestCode = code;
            }
        });

        return bestDist <= 200 ? { code: bestCode, distance: bestDist } : null;
    }

    function showTooltipForPlayer(player, sx, sy) {
        tooltipTitle.innerHTML = '';
        var avatar = playerAvatars[player.name];
        var loaded = avatar && avatar !== 'error' && avatar.complete && avatar.naturalWidth > 0;
        if (loaded) {
            var imgEl = document.createElement('img');
            imgEl.src = 'https://mc-heads.hydcraft.cn/avatar/' + encodeURIComponent(player.name) + '/24.png';
            imgEl.style.width = '18px';
            imgEl.style.height = '18px';
            imgEl.style.borderRadius = '3px';
            imgEl.style.verticalAlign = 'middle';
            tooltipTitle.appendChild(imgEl);
        }
        tooltipTitle.appendChild(document.createTextNode(player.name));

        var nearest = findNearestStationForPlayer(player.x, player.z);
        var bodyHtml = '(' + Math.round(player.x) + ', ' + Math.round(player.z) + ')';
        if (nearest) {
            bodyHtml = getStationName(nearest.code, lang) + '<br>' + bodyHtml;
        }
        tooltipBody.innerHTML = bodyHtml;
        tooltip.classList.add('visible');

        var tw = tooltip.offsetWidth;
        var th = tooltip.offsetHeight;
        var left = sx + 16;
        var top = sy - th / 2;
        if (left + tw > container.clientWidth) left = sx - tw - 16;
        if (top < 0) top = 4;
        if (top + th > container.clientHeight) top = container.clientHeight - th - 4;
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    function showCopyFeedback(screenX, screenY, playerName) {
        var feedback = document.createElement('div');
        feedback.className = 'player-copy-feedback';
        feedback.textContent = playerName;
        var rect = container.getBoundingClientRect();
        feedback.style.left = screenX + 'px';
        feedback.style.top = (screenY - 36) + 'px';
        container.appendChild(feedback);
        setTimeout(function () { feedback.remove(); }, 1500);
    }

    function drawCoordinates() {
        const body = document.querySelector('body');
        if (body.classList.contains('compact')) return;
        ctx.save();
        var ch = getCanvasCssHeight();
        var textColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text-secondary').trim() || 'rgba(128,128,128,0.6)';
        var bgColor = getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim() || '#f5f5f5';
        var fontFamily = getComputedStyle(document.body).getPropertyValue('--font-family');
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.lineJoin = 'round';

        var iconSize = '12px ';
        var iconFont = iconSize + '"Material Symbols Outlined"';
        var textFont = '10px ' + fontFamily;

        var centerX = getVisibleCenterX();
        var centerWorld = screenToWorld(centerX, ch / 2);
        var centerCoordText = 'x: ' + Math.round(centerWorld.x) + '  z: ' + Math.round(centerWorld.z);

        var hasMouse = isMouseOverCanvas && mouseScreenX >= 0 && mouseScreenY >= 0;
        var mouseCoordText = '';
        if (hasMouse) {
            var mouseWorld;
            if (isMouseWorldFrozen && viewState.isDragging) {
                mouseWorld = { x: frozenMouseWorldX, z: frozenMouseWorldZ };
            } else {
                mouseWorld = screenToWorld(mouseScreenX, mouseScreenY);
            }
            mouseCoordText = 'x: ' + Math.round(mouseWorld.x) + '  z: ' + Math.round(mouseWorld.z);
        }

        var baseY = hasMouse ? ch - 32 : ch - 20;

        ctx.font = iconFont;
        var iconWidth = ctx.measureText('\uE943').width;
        ctx.font = textFont;
        var centerTextWidth = ctx.measureText(centerCoordText).width;
        var totalCenterWidth = iconWidth + 4 + centerTextWidth;

        var centerStartX = centerX - totalCenterWidth / 2;

        ctx.strokeStyle = bgColor;
        ctx.lineWidth = 3;
        ctx.font = iconFont;
        ctx.strokeText('filter_center_focus', centerStartX, baseY);
        ctx.fillStyle = textColor;
        ctx.fillText('filter_center_focus', centerStartX, baseY);

        ctx.font = textFont;
        ctx.strokeText(centerCoordText, centerStartX + iconWidth + 4, baseY + 1.5);
        ctx.fillText(centerCoordText, centerStartX + iconWidth + 4, baseY + 1.5);

        if (hasMouse) {
            ctx.font = textFont;
            var mouseTextWidth = ctx.measureText(mouseCoordText).width;
            var totalMouseWidth = iconWidth + 4 + mouseTextWidth;
            var mouseStartX = centerX - totalMouseWidth / 2;

            ctx.strokeStyle = bgColor;
            ctx.lineWidth = 3;
            ctx.font = iconFont;
            ctx.strokeText('arrow_selector_tool', mouseStartX, baseY + 14);
            ctx.fillStyle = textColor;
            ctx.fillText('arrow_selector_tool', mouseStartX, baseY + 14);

            ctx.font = textFont;
            ctx.strokeText(mouseCoordText, mouseStartX + iconWidth + 4, baseY + 15.5);
            ctx.fillText(mouseCoordText, mouseStartX + iconWidth + 4, baseY + 15.5);
        }

        ctx.restore();
    }

    function render() {
        if (!canvas || !ctx) return;

        var dpr = window.devicePixelRatio || 1;
        var rect = container.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        ctx.clearRect(0, 0, rect.width, rect.height);

        var bgColor = getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim() || '#f5f5f5';
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, rect.width, rect.height);

        drawGrid();
        drawLines();
        drawStations();
        drawTrains();
        drawCoordinates();
        drawPlayers();

        zoomIndicator.textContent = Math.round(viewState.zoom * 100) + '%';
    }

    function findStationAtScreen(sx, sy) {
        var bestDist = Infinity;
        var bestCode = null;
        var hitRadius = 18;

        Object.keys(stationCoordsMap).forEach(function (code) {
            var st = stationCoordsMap[code];
            if (st.count === 0) return;
            var pos = worldToScreen(st.x, st.z);
            var dx = pos.x - sx;
            var dy = pos.y - sy;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < hitRadius && dist < bestDist) {
                bestDist = dist;
                bestCode = code;
            }
        });
        return bestCode;
    }

    function findTrainAtScreen(sx, sy) {
        if (!mapTrainsData || !mapTrainsData.trains) return null;
        var bestDist = Infinity;
        var bestTrain = null;
        var hitRadius = 16;

        mapTrainsData.trains.forEach(function (train) {
            if (!train || !train.cars || train.cars.length === 0) return;
            var car = train.cars[0];
            if (!car.leading || !car.leading.location) return;
            var loc = car.leading.location;
            var pos = worldToScreen(loc.x, loc.z);
            var dx = pos.x - sx;
            var dy = pos.y - sy;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < hitRadius && dist < bestDist) {
                bestDist = dist;
                bestTrain = train;
            }
        });
        return bestTrain;
    }

    function showTooltipForStation(code, sx, sy) {
        var name = getStationName(code, lang);
        var station = stationCoordsMap[code];
        var linesHtml = '';
        station.lines.forEach(function (lid) {
            var ld = window.lines.find(function (l) { return l.id === lid; });
            if (ld) {
                linesHtml += '<span class="line-code" style="margin-inline-end: 4px; --current-color:' + ld.color + '">'+lid+'</span>';
            }
        });

        tooltipTitle.innerHTML = name;
        tooltipBody.innerHTML = linesHtml + '<br>(' + Math.round(station.x) + ', ' + Math.round(station.z) + ')';
        tooltip.classList.add('visible');

        var tw = tooltip.offsetWidth;
        var th = tooltip.offsetHeight;
        var left = sx + 16;
        var top = sy - th / 2;
        if (left + tw > container.clientWidth) left = sx - tw - 16;
        if (top < 0) top = 4;
        if (top + th > container.clientHeight) top = container.clientHeight - th - 4;
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    function showTooltipForTrain(train, sx, sy) {
        var trainInfo = window.trainsInfo ? window.trainsInfo.find(function (t) { return t.name === train.name; }) : null;
        var lineId = trainInfo ? trainInfo.line : '';
        var lineData = window.lines.find(function (l) { return l.id === lineId; });

        tooltipTitle.innerHTML = '';
        if (lineData) {
            var tag = document.createElement('span');
            tag.className = 'map-tooltip-line-tag';
            tag.style.background = lineData.color;
            tooltipTitle.appendChild(tag);
        }
        tooltipTitle.appendChild(document.createTextNode(train.name));

        var speed = '';
        try {
            var allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            var td = allTrainsData[train.name];
            if (td && td.speed !== undefined) {
                speed = strings.lines_info.speed[lang] + td.speed.toFixed() + 'km/h';
            }
        } catch (e) {}

        var loc = train.cars[0].leading.location;
        tooltipBody.innerHTML =
            (lineData ? lineData.name[lang] : '') +
            '<br>(' + Math.round(loc.x) + ', ' + Math.round(loc.z) + ')' +
            (speed ? '<br>' + speed : '');
        tooltip.classList.add('visible');

        var tw = tooltip.offsetWidth;
        var th = tooltip.offsetHeight;
        var left = sx + 16;
        var top = sy - th / 2;
        if (left + tw > container.clientWidth) left = sx - tw - 16;
        if (top < 0) top = 4;
        if (top + th > container.clientHeight) top = container.clientHeight - th - 4;
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    function hideTooltip() {
        tooltip.classList.remove('visible');
    }

    function setupInteractions() {
        if (interactionsSetup) return;
        interactionsSetup = true;

        container.addEventListener('mousedown', function (e) {
            hasUserZoomed = true;
            if (e.button !== 0) return;
            viewState.isDragging = true;
            dragMoved = false;
            viewState.dragStartX = e.clientX;
            viewState.dragStartY = e.clientY;
            viewState.dragOffsetX = viewState.offsetX;
            viewState.dragOffsetY = viewState.offsetY;
            container.classList.add('dragging');
            if (mouseScreenX >= 0 && mouseScreenY >= 0) {
                var w = screenToWorld(mouseScreenX, mouseScreenY);
                frozenMouseWorldX = w.x;
                frozenMouseWorldZ = w.z;
                isMouseWorldFrozen = true;
            }
        });

        container.addEventListener('mouseenter', function () {
            isMouseOverCanvas = true;
        });

        container.addEventListener('mouseleave', function () {
            isMouseOverCanvas = false;
            mouseScreenX = -1;
            mouseScreenY = -1;
            render();
        });

        window.addEventListener('mousemove', function (e) {
            hasUserZoomed = true;
            if (!isOpen) return;
            if (viewState.isDragging) {
                var dx = e.clientX - viewState.dragStartX;
                var dy = e.clientY - viewState.dragStartY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
                viewState.offsetX = viewState.dragOffsetX + dx / viewState.zoom;
                viewState.offsetY = viewState.dragOffsetY + dy / viewState.zoom;
                render();
                hideTooltip();
            } else {
                var rect = container.getBoundingClientRect();
                var mx = e.clientX - rect.left;
                var my = e.clientY - rect.top;

                mouseScreenX = mx;
                mouseScreenY = my;

                var stCode = findStationAtScreen(mx, my);
                if (stCode) {
                    showTooltipForStation(stCode, mx, my);
                    container.style.cursor = 'pointer';
                    render();
                    return;
                }

                var train = findTrainAtScreen(mx, my);
                if (train) {
                    showTooltipForTrain(train, mx, my);
                    container.style.cursor = 'pointer';
                    render();
                    return;
                }

                var player = findPlayerAtScreen(mx, my);
                if (player) {
                    showTooltipForPlayer(player, mx, my);
                    container.style.cursor = 'pointer';
                    render();
                    return;
                }

                hideTooltip();
                container.style.cursor = '';
                render();
            }
        });

        window.addEventListener('mouseup', function (e) {
            viewState.isDragging = false;
            container.classList.remove('dragging');
            isMouseWorldFrozen = false;
            if (isMouseOverCanvas) {
                var rect = container.getBoundingClientRect();
                mouseScreenX = e.clientX - rect.left;
                mouseScreenY = e.clientY - rect.top;
                render();
            }
        });

        container.addEventListener('wheel', function (e) {
            e.preventDefault();
            var rect = container.getBoundingClientRect();
            var mx = e.clientX - rect.left;
            var my = e.clientY - rect.top;

            var beforeWorld = screenToWorld(mx, my);

            var factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
            var newZoom = viewState.zoom * factor;
            newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
            viewState.zoom = newZoom;
            hasUserZoomed = true;

            var afterScreen = worldToScreen(beforeWorld.x, beforeWorld.z);
            viewState.offsetX += (mx - afterScreen.x) / viewState.zoom;
            viewState.offsetY += (my - afterScreen.y) / viewState.zoom;

            render();
            hideTooltip();
        }, { passive: false });

        container.addEventListener('click', function (e) {
            if (dragMoved) return;
            var rect = container.getBoundingClientRect();
            var mx = e.clientX - rect.left;
            var my = e.clientY - rect.top;

            var stCode = findStationAtScreen(mx, my);
            if (stCode) {
                loadStationInfo(stCode);
                return;
            }

            var train = findTrainAtScreen(mx, my);
            if (train) {
                window.open('trains_info.html?q=' + train.name, '_self');
                return;
            }

            var player = findPlayerAtScreen(mx, my);
            if (player) {
                navigator.clipboard.writeText(player.name).then(function () {
                    showCopyFeedback(mx, my, player.name);
                }).catch(function () {
                    var ta = document.createElement('textarea');
                    ta.value = player.name;
                    ta.style.position = 'fixed';
                    ta.style.left = '-9999px';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    showCopyFeedback(mx, my, player.name);
                });
            }
        });

        var lastTouchDist = 0;
        var lastTouchCenter = { x: 0, y: 0 };
        var touchDragging = false;

        container.addEventListener('touchstart', function (e) {
            hasUserZoomed = true;
            if (e.touches.length === 1) {
                touchDragging = true;
                viewState.dragStartX = e.touches[0].clientX;
                viewState.dragStartY = e.touches[0].clientY;
                viewState.dragOffsetX = viewState.offsetX;
                viewState.dragOffsetY = viewState.offsetY;
            } else if (e.touches.length === 2) {
                touchDragging = false;
                var dx = e.touches[0].clientX - e.touches[1].clientX;
                var dy = e.touches[0].clientY - e.touches[1].clientY;
                lastTouchDist = Math.sqrt(dx * dx + dy * dy);
                lastTouchCenter = {
                    x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                    y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                };
            }
        }, { passive: true });

        container.addEventListener('touchmove', function (e) {
            e.preventDefault();
            if (e.touches.length === 1 && touchDragging) {
                var dx = e.touches[0].clientX - viewState.dragStartX;
                var dy = e.touches[0].clientY - viewState.dragStartY;
                viewState.offsetX = viewState.dragOffsetX + dx / viewState.zoom;
                viewState.offsetY = viewState.dragOffsetY + dy / viewState.zoom;
                render();
                hideTooltip();
            } else if (e.touches.length === 2) {
                var dx2 = e.touches[0].clientX - e.touches[1].clientX;
                var dy2 = e.touches[0].clientY - e.touches[1].clientY;
                var dist = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                if (lastTouchDist > 0) {
                    var rect = container.getBoundingClientRect();
                    var cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                    var cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
                    var beforeWorld = screenToWorld(cx, cy);

                    var factor = dist / lastTouchDist;
                    viewState.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewState.zoom * factor));
                    hasUserZoomed = true;

                    var afterScreen = worldToScreen(beforeWorld.x, beforeWorld.z);
                    viewState.offsetX += (cx - afterScreen.x) / viewState.zoom;
                    viewState.offsetY += (cy - afterScreen.y) / viewState.zoom;

                    render();
                }
                lastTouchDist = dist;
            }
        }, { passive: false });

        container.addEventListener('touchend', function () {
            touchDragging = false;
            lastTouchDist = 0;
        });

        document.getElementById('map-zoom-in').addEventListener('click', function () {
            viewState.zoom = Math.min(MAX_ZOOM, viewState.zoom * 1.3);
            hasUserZoomed = true;
            render();
        });

        document.getElementById('map-zoom-out').addEventListener('click', function () {
            viewState.zoom = Math.max(MIN_ZOOM, viewState.zoom / 1.3);
            hasUserZoomed = true;
            render();
        });

        document.getElementById('map-fit-btn').addEventListener('click', function () {
            hasUserZoomed = false;
            fitAll();
        });

        document.getElementById('map-trains-toggle').addEventListener('click', function () {
            showTrains = !showTrains;
            this.classList.toggle('active', showTrains);
            render();
        });

        window.addEventListener('resize', function () {
            if (isOpen) render();
        });
    }

    function openMapMode() {
        recordLastVisitedPage('?line=all');
        overlay = document.getElementById('map-overlay');
        const mapEntries = document.querySelectorAll('.map-entry');
        const currentLineEntries = document.querySelectorAll('.line-selector .selection-item.active');
        canvas = document.getElementById('map-canvas');
        container = document.getElementById('map-canvas-container');
        tooltip = document.getElementById('map-tooltip');
        tooltipTitle = document.getElementById('map-tooltip-title');
        tooltipBody = document.getElementById('map-tooltip-body');
        zoomIndicator = document.getElementById('map-zoom-indicator');
        ctx = canvas.getContext('2d');

        document.getElementById('map-fit-btn').title = strings.lines_info.map_fit_all[lang];
        document.getElementById('map-trains-toggle').title = strings.lines_info.map_toggle_trains[lang];
        document.getElementById('map-zoom-in').title = strings.lines_info.map_zoom_in[lang];
        document.getElementById('map-zoom-out').title = strings.lines_info.map_zoom_out[lang];

        if (isOpen === false) {
            showTrains = true;
            document.getElementById('map-trains-toggle').classList.add('active');
        }

        buildStationCoords();
        setupInteractions();

        var sidebar = document.querySelector('.side-bar');
        if (sidebar && !sidebarObserver) {
            sidebarObserver = new MutationObserver(function () {
                if (isOpen) {
                    fitAll();
                    render();
                }
            });
            sidebarObserver.observe(sidebar, { attributes: true, attributeFilter: ['class', 'style'] });
        }

        overlay.classList.add('active');
        currentLineEntries.forEach(function (entry) {
            entry.classList.remove('active');
        });
        mapEntries.forEach(function (entry) {
            entry.classList.add('active');
            entry.setAttribute('style', '--color-primary: var(--color-text);');
        });
        isOpen = true;

        startPlayersRefresh();

        storageListener = function (e) {
            if (e.key === 'preferences') {
                if (!isShowPlayers()) {
                    mapPlayersData = [];
                }
                render();
            }
        };
        window.addEventListener('storage', storageListener);

        render();
    }

    function closeMapMode() {
        overlay.classList.remove('active');
        isOpen = false;
        hideTooltip();
        stopPlayersRefresh();
        if (storageListener) {
            window.removeEventListener('storage', storageListener);
            storageListener = null;
        }
        if (sidebarObserver) {
            sidebarObserver.disconnect();
            sidebarObserver = null;
        }
    }

    function updateMapTrains(payload) {
        mapTrainsData = payload;
        if (isOpen) {
            render();
        }
    }

    function init() {
        overlay = document.getElementById('map-overlay');
        canvas = document.getElementById('map-canvas');
        container = document.getElementById('map-canvas-container');
        tooltip = document.getElementById('map-tooltip');
        tooltipTitle = document.getElementById('map-tooltip-title');
        tooltipBody = document.getElementById('map-tooltip-body');
        zoomIndicator = document.getElementById('map-zoom-indicator');
        ctx = canvas.getContext('2d');

        buildStationCoords();
        setupInteractions();
        fitAll();

        return {
            initialized: true
        };
    }

    return {
        init: init,
        open: openMapMode,
        close: closeMapMode,
        updateTrains: updateMapTrains,
        isOpen: function () { return isOpen; },
        refreshPlayers: fetchPlayersData,
        onPlayerPrefChange: function () {
            if (!isShowPlayers()) {
                mapPlayersData = [];
            }
            if (isOpen) render();
        },
        fitAllIfNeeded: function () {
            if (!isOpen) return;
            var minZoom = computeMinZoom();
            if (!hasUserZoomed || viewState.zoom < minZoom) {
                fitAll();
                hasUserZoomed = false;
            }
        }
    };
})();

function openMapMode() {
    MapMode.open();
}

function initMapMode() {
    if (typeof TrainDataSource !== 'undefined') {
        TrainDataSource.on('data', function (payload) {
            MapMode.updateTrains(payload);
        });
        MapMode.init();
    }
}
