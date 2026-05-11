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
            openMapMode();
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
                        <span class="line-name-original">${!lang.startsWith('zh') ? line.name['zh_hans'] : ''}</span>
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
        lineSelector.setAttribute('style', `--color-primary: ${window.lines.find(line => line.id === getActiveLineId()).color}`);
    });
    
    const mapBtn = document.querySelector('.map-btn');
    mapBtn.title = strings.pov_frame.page_title[lang];
    mapBtn.addEventListener('click', () => {
        window.open('pov-frame.html', '_blank');
    });

    const lineId = getActiveLineId();
    // 获取lineId对应的线路数据、
    const line = window.lines.find(line => line.id === lineId);

    loadSegmentInfo();
    loadUpdateTime();

    displayStations(line);
    initDataSource();

    initMapMode();

    const shareBtn = document.querySelector('.share-btn');
    shareBtn.title = strings.lines_info.share_route[lang];
    shareBtn.addEventListener('click', function () { 
        shareRouteMap();
    });
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

    const rapidLine = (!line.id.startsWith('GX'))?window.lines.find(ln => ln.id === line.id+'-R'):null;
    const rapidStations = rapidLine ? rapidLine.route.filter(node => node.type === 'station') : [];

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
        if (!trainInfo || (trainInfo && trainInfo.line !== activeLineId)) {
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
        
        // 添加警告原因信息
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
                
                // 移除末尾的分号和空格
                reasonsText = reasonsText.slice(0, -2);
                warningReasonsElement.textContent = reasonsText;
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
        // 合理范围：50ms 到 3s
        if (timeDiff > 50 && timeDiff < 3000) {
            direction = [
                carPos.x - previousTrainData.position.x,
                carPos.z - previousTrainData.position.z
            ];
            
            // 计算3D空间中的位移距离
            const distance = Math.sqrt(
                Math.pow(carPos.x - previousTrainData.position.x, 2) +
                Math.pow(carPos.z - previousTrainData.position.z, 2)
            );
            
            // 添加调试日志
            /*console.log(`列车 ${trainName} 位置变化:`, {
                currentTime: currentTime,
                previousTime: previousTrainData.timestamp,
                timeDiff: timeDiff,
                oldPosition: previousTrainData.position,
                newPosition: carPos,
                direction: direction,
                distance: distance
            });*/
            
            // 计算速度（假设距离单位是米，时间是毫秒，则结果为 m/s，转换为 km/h 需要乘以 3.6）
            // 注意：这里的时间单位是毫秒，所以需要除以1000转换为秒
            speed = (distance / (timeDiff / 1000) * 3.6);
            if (speed <= 0 && isSpeedLost === false) {
                if (prevSpeed !== 0) speedLostTime = currentTime; else speed = 0;
                isSpeedLost = prevSpeed !== 0;
            } else isSpeedLost = false;
            
            // 增加速度上限保护（假设列车最高速度不超过 360 km/h）
            if (speed > 360 || speed === 0) {
                speed = prevSpeed;
            }
        } else {
            speed = prevSpeed;
            //console.log(`列车 ${trainName} 时间差不在合理范围内: ${timeDiff}ms`);
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
        //width: 1200,
        //height: 800,
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
        if (!sidebarCollapseDone) { 
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
        }
        sidebarCollapseDone = true;
        setTimeout(() => {
            const lineSelectorWidth = sideBar.getBoundingClientRect().width <= 60 ? 0 : sideBar.getBoundingClientRect().width;
            const mainWidth = main.getBoundingClientRect().width;
            stationsDisplay.style.marginLeft = `calc(${lineSelectorWidth}px + 2vw)`;
            tabs.style.marginLeft = `calc(${lineSelectorWidth}px + 2vw)`;
        }, 150);
    }

    setTimeout(() => {
        mapFitBtn?.click();
    }, 500)
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

// 添加检查并添加警告标志的函数
function checkAndAddWarningSign(train, trainItem, isAtStation) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        PositionUtils.checkAndAddWarningSign(train, trainItem, isAtStation);
        return;
    }
    
    // 降级处理：如果PositionUtils不可用，使用原有实现
    // 从localStorage获取列车数据
    try {
        const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
        const currentTrainData = allTrainsData[train.name];
        
        // 检查是否需要添加警告标志
        let shouldShowWarning = false;
        let warningReasons = [];
        
        // 条件1: 列车在车站内停靠超过3分钟
        if (isAtStation && currentTrainData && currentTrainData.timestamp) {
            const currentTime = Date.now();
            const timeInStation = currentTime - currentTrainData.timestamp;
            // 3分钟 = 180000毫秒
            if (timeInStation > 180000) {
                shouldShowWarning = true;
                warningReasons.push('long_stop');
            }
        }
        
        // 条件2: 列车在轨道上的车速为0
        // 修改条件：只有当列车不在任何车站时才显示警告
        if (currentTrainData && currentTrainData.speed === 0) {
            // 检查列车是否在任何车站
            const isAtAnyStation = checkIfTrainAtAnyStation(train.name);
            if (!isAtAnyStation) {
                shouldShowWarning = true;
                warningReasons.push('zero_speed');
            }
        }
        
        // 条件3: 有多于一辆列车停靠在同一站台（不考虑AB后缀）且该列车不是离站台最近的列车
        if (isAtStation) {
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
        
        // 根据检查结果添加或移除警告标志
        const existingWarning = trainItem.querySelector('.warning');
        if (shouldShowWarning && !existingWarning) {
            // 添加警告标志
            const warningSpan = document.createElement('span');
            warningSpan.className = 'warning';
            warningSpan.style.color = 'crimson';
            warningSpan.style.fontWeight = 'bold';
            warningSpan.textContent = '! ';
            trainItem.appendChild(warningSpan);
            trainItem.style.color = 'crimson';
            
            // 保存警告原因到localStorage
            if (!allTrainsData[train.name]) {
                allTrainsData[train.name] = {};
            }
            allTrainsData[train.name].warningReasons = warningReasons;
            localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
        } else if (!shouldShowWarning && existingWarning) {
            // 移除警告标志
            existingWarning.remove();
            trainItem.style.color = ''; // 恢复默认颜色
            
            // 清除localStorage中的警告原因
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

    var MIN_ZOOM = 0.05;
    var MAX_ZOOM = 8;
    var STATION_RADIUS = 6;
    var TRAIN_RADIUS = 10;
    var sidebarObserver = null;

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

    function computeBounds() {
        var minX = Infinity, maxX = -Infinity;
        var minZ = Infinity, maxZ = -Infinity;
        window.lines.forEach(function (line) {
            if (line.id.match('-R')) return;
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
        viewState.zoom = Math.min(scaleX, scaleY);
        MIN_ZOOM = viewState.zoom;

        viewState.offsetX = -(bounds.minX + worldW / 2);
        viewState.offsetY = -(bounds.minZ + worldH / 2);

        render();
    }

    function drawGrid() {
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
    }

    function drawSingleLine(line) {
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 3;
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
    }

    function drawLines() {
        ctx.save();
        
        window.lines.forEach(function (line) {
            if (line.id.match('-R')) return;
            if (line.id.startsWith('GX')) {
                var originalColor = line.color;
                line.color = '#808080';
                drawSingleLine(line);
                line.color = originalColor;
            }
        });

        window.lines.forEach(function (line) {
            if (line.id.match('-R')) return;
            if (!line.id.startsWith('GX')) {
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

    function drawStations() {
        Object.keys(stationCoordsMap).forEach(function (code) {
            var station = stationCoordsMap[code];
            if (station.count === 0) return;

            var pos = worldToScreen(station.x, station.z);
            var r = STATION_RADIUS;

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            var bgColor = getComputedStyle(document.documentElement).getPropertyValue('--color-background-card-solid').trim() || '#fff';
            ctx.fillStyle = bgColor;
            ctx.fill();

            var primaryColor = station.lines.length > 1 ? '#666' : (window.lines.find(function (l) { return l.id === station.lines[0]; }) || {}).color || '#666';
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            var name = getStationName(code, lang);
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim() || '#000';
            ctx.font = '11px ' + getComputedStyle(document.body).getPropertyValue('--font-family');
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(name, pos.x + r + 6, pos.y);
        });
    }

    function drawTrains() {
        if (!showTrains || !mapTrainsData || !mapTrainsData.trains) return;

        mapTrainsData.trains.forEach(function (train) {
            if (!train || !train.cars || train.cars.length === 0) return;
            var car = train.cars[0];
            if (!car.leading || !car.leading.location) return;
            var loc = car.leading.location;

            var pos = worldToScreen(loc.x, loc.z);
            var r = TRAIN_RADIUS;

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
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = '#fff';
            ctx.font = '16px "Material Symbols Outlined"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('\ue534', pos.x, pos.y);
        });
    }

    function drawCoordinates() {
        var ch = getCanvasCssHeight();
        var textColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text-secondary').trim() || 'rgba(128,128,128,0.6)';
        ctx.fillStyle = textColor;
        ctx.font = '10px ' + getComputedStyle(document.body).getPropertyValue('--font-family');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        var centerX = getVisibleCenterX();
        var centerWorld = screenToWorld(centerX, ch / 2);
        ctx.fillText(
            'x: ' + Math.round(centerWorld.x) + '  z: ' + Math.round(centerWorld.z),
            centerX,
            ch - 20
        );
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
            if (e.button !== 0) return;
            viewState.isDragging = true;
            dragMoved = false;
            viewState.dragStartX = e.clientX;
            viewState.dragStartY = e.clientY;
            viewState.dragOffsetX = viewState.offsetX;
            viewState.dragOffsetY = viewState.offsetY;
            container.classList.add('dragging');
        });

        window.addEventListener('mousemove', function (e) {
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

                var stCode = findStationAtScreen(mx, my);
                if (stCode) {
                    showTooltipForStation(stCode, mx, my);
                    container.style.cursor = 'pointer';
                    return;
                }

                var train = findTrainAtScreen(mx, my);
                if (train) {
                    showTooltipForTrain(train, mx, my);
                    container.style.cursor = 'pointer';
                    return;
                }

                hideTooltip();
                container.style.cursor = 'grab';
            }
        });

        window.addEventListener('mouseup', function () {
            viewState.isDragging = false;
            container.classList.remove('dragging');
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
            }
        });

        var lastTouchDist = 0;
        var lastTouchCenter = { x: 0, y: 0 };
        var touchDragging = false;

        container.addEventListener('touchstart', function (e) {
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
            render();
        });

        document.getElementById('map-zoom-out').addEventListener('click', function () {
            viewState.zoom = Math.max(MIN_ZOOM, viewState.zoom / 1.3);
            render();
        });

        document.getElementById('map-fit-btn').addEventListener('click', function () {
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

        showTrains = true;
        document.getElementById('map-trains-toggle').classList.add('active');

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

        setTimeout(function () {
            fitAll();
            render();
        }, 50);
    }

    function closeMapMode() {
        overlay.classList.remove('active');
        isOpen = false;
        hideTooltip();
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

    return {
        open: openMapMode,
        close: closeMapMode,
        updateTrains: updateMapTrains,
        isOpen: function () { return isOpen; }
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
    }
}
