
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

// 存储上次列车位置信息用于速度计算
let trainPositions = new Map();
let displayedTrains = []; // 存储当前显示的列车数据
let sidebarCollapseDone = false;
let loadingToastShown = false;
let loadingExampleToastShown = false;
let visitedPageRecorded = false;

// 时间表数据缓存
const timetableCache = {
    data: null,
    timestamp: 0,
    TTL: 30000 // 30秒缓存有效期
};

// 获取时间表数据
async function fetchTimetableData() {
    const now = Date.now();
    
    // 检查缓存是否有效
    if (timetableCache.data && (now - timetableCache.timestamp) < timetableCache.TTL) {
        return timetableCache.data;
    }
    
    try {
        const response = await fetch('./api/timetable/status');
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                timetableCache.data = result.data;
                timetableCache.timestamp = now;
                return result.data;
            }
        }
    } catch (error) {
        console.warn('获取时间表数据失败，使用本地计算:', error);
    }
    
    return null;
}

// 获取列车的预计到站时间（使用后端API）
async function fetchTrainETA(trainName, nextStationCode) {
    try {
        // 获取列车所在的线路
        const lineId = getLineForTrain(trainName, 'id');
        if (!lineId) return null;
        
        // 调用后端API获取导航用时
        const response = await fetch(`./api/timetable/navigation?start=${getCurrentStationForTrain(trainName)}&end=${nextStationCode}&lang=${lang}`);
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data && result.data.length > 0) {
                // 返回第一个匹配的线路的总时长
                const matchingLine = result.data.find(item => item.lineId === lineId);
                if (matchingLine) {
                    return matchingLine.totalDuration;
                }
            }
        }
    } catch (error) {
        console.warn('获取列车ETA失败:', error);
    }
    
    return null;
}

// 获取列车当前所在站点
function getCurrentStationForTrain(trainName) {
    const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
    const trainData = allTrainsData[trainName];
    
    if (!trainData || !trainData.position) return null;
    
    const position = trainData.position;
    
    // 获取列车所在的线路
    const lineId = getLineForTrain(trainName, 'id');
    if (!lineId) return null;
    
    const line = window.lines.find(l => l.id === lineId);
    if (!line) return null;
    
    // 查找最近的站点
    let closestStation = null;
    let minDistance = Infinity;
    
    for (const step of line.route) {
        if (step.type === 'station') {
            const stationPos = getStationPosition(step.code);
            if (stationPos) {
                const dist = Math.sqrt(
                    Math.pow(position.x - stationPos.x, 2) +
                    Math.pow(position.z - stationPos.z, 2)
                );
                if (dist < minDistance) {
                    minDistance = dist;
                    closestStation = step.code;
                }
            }
        }
    }
    
    return closestStation;
}

// 获取站点位置
function getStationPosition(stationCode) {
    if (window.stationsNetwork) {
        const station = window.stationsNetwork.find(s => s.code === stationCode);
        if (station && station.location) {
            return station.location;
        }
    }
    return null;
}

// 初始化函数
function init() {
    
    const headerTitle = document.querySelector('header h1');
    const pageTitle = document.querySelector('title');
    console.log(pageTitle.textContent);
    headerTitle.textContent = strings.trains_info.page_title[lang];
    pageTitle.textContent = strings.trains_info.page_title[lang] + ' - ' + strings.mainpage.gtr_info[lang];
    
    
    // 修改以下代码以处理多个按钮实例
    const fareBtns = document.querySelectorAll('.fare-btn');
    fareBtns.forEach(fareBtn => {
        const fareBtnText = fareBtn.querySelector('span:not(.material-symbols-outlined)');
        if (fareBtnText) {
            fareBtnText.textContent = strings.ticket_calculator[fareBtnText.classList.contains('tab-text')?'page_title_short':'page_title'][lang];
        } else {
            fareBtn.title = strings.ticket_calculator.page_title[lang];
        }
        fareBtn.addEventListener('click', () => {
            window.open(`ticket_calculator.html`, '_self');
        });
    });
    
    const trainsBtns = document.querySelectorAll('.trains-btn');
    trainsBtns.forEach(trainsBtn => {
        const trainsBtnText = trainsBtn.querySelector('span:not(.material-symbols-outlined)');
        if (trainsBtnText) {
            trainsBtnText.textContent = strings.trains_info[trainsBtnText.classList.contains('tab-text')?'page_title_short':'page_title'][lang];
        } else {
            trainsBtn.title = strings.trains_info.page_title[lang];
        }
        trainsBtn.addEventListener('click', () => {
            window.open(`trains_info.html`, '_self');
        });
    });
    
    const linesBtns = document.querySelectorAll('.lines-btn');
    linesBtns.forEach(linesBtn => {
        const linesBtnText = linesBtn.querySelector('span:not(.material-symbols-outlined)');
        if (linesBtnText) {
            linesBtnText.textContent = strings.lines_info[linesBtnText.classList.contains('tab-text')?'page_title_short':'page_title'][lang];
        } else {
            linesBtn.title = strings.lines_info.page_title[lang];
        }
        linesBtn.addEventListener('click', () => {
            window.open(`lines_info.html`, '_self');
        });
    });

    const prefBtns = document.querySelectorAll('.preferences-btn');
    prefBtns.forEach(prefBtn => {
        try {
            if (typeof getCurrentUser === 'function') {
                const user = getCurrentUser();
                if (user && user.username) {
                    const authmeUsername = user.authmeUsername || 'MHF_Steve';
                    const avatarUrl = `https://mc-heads.hydcraft.cn/avatar/${authmeUsername}/24.png`;
                    const prefBtnText = prefBtn.querySelector('span:not(.material-symbols-outlined)');
                    if (prefBtnText) {
                        prefBtnText.textContent = user.username;
                    }
                    prefBtn.title = strings.preferences.page_title[lang];
                } else {
                    const prefBtnText = prefBtn.querySelector('span:not(.material-symbols-outlined)');
                    if (prefBtnText) {
                        prefBtnText.textContent = strings.preferences[prefBtnText.classList.contains('tab-text')?'page_title_short':'page_title'][lang];
                    } else {
                        prefBtn.title = strings.preferences.page_title[lang];
                    }
                }
            } else {
                const prefBtnText = prefBtn.querySelector('span:not(.material-symbols-outlined)');
                if (prefBtnText) {
                    prefBtnText.textContent = strings.preferences[prefBtnText.classList.contains('tab-text')?'page_title_short':'page_title'][lang];
                } else {
                    prefBtn.title = strings.preferences.page_title[lang];
                }
            }
        } catch (error) {
            console.error('更新偏好按钮用户信息时出错:', error);
            const prefBtnText = prefBtn.querySelector('span:not(.material-symbols-outlined)');
            if (prefBtnText) {
                prefBtnText.textContent = strings.preferences[prefBtnText.classList.contains('tab-text')?'page_title_short':'page_title'][lang];
            }
        }
        prefBtn.addEventListener('click', () => { 
            window.open(`preferences.html`, '_self');
        });
    })

    // 添加搜索功能
    const searchInputs = document.querySelectorAll('.search-input');
    searchInputs.forEach(searchInput => {
        searchInput.placeholder = strings.trains_info.search_placeholder[lang];
        const urlSearchParams = new URLSearchParams(window.location.search);
        const searchQuery = urlSearchParams.get('q') || '';
        searchInput.value = searchQuery; // 从URL参数获取搜索词或设置为空
        searchInput.addEventListener('input', handleSearch);
    });

    if (compactParam !== 'true') window.addEventListener('resize', handleWindowResize);
    else { 
        document.body.classList.add('effect-reduced');
        document.body.classList.add('compact');
    }
    
    // 显示更新时间信息
    loadUpdateTime();
    
    // 初始化安全计数器
    initSafetyCounter();
    
    // 开始获取列车数据（SSE方式，不需要定时器）
    fetchTrainData();
}

/*function handleWindowResize() {
    //console.log('handleWindowResize called, window width:', window.innerWidth);
    const footer = document.querySelector('footer');
    const header = document.querySelector('header');
    const main = document.querySelector('main');
    const tabs = document.querySelector('.tabs');
    const searchBtn = document.querySelector('.icon-btn.search-btn');
    
    // 只有在不是虚拟键盘导致的resize且输入框未聚焦时才执行布局调整
    if (window.innerWidth < 512) {
        //console.log('collapse search panel');
        footer.style.opacity = 1;
        // 确保tabs在footer中
        if (tabs) {
            //console.log('move tabs to footer');
            // 先从当前位置移除tabs
            if (tabs.parentNode) {
                tabs.parentNode.removeChild(tabs);
            }
            // 添加到footer开头
            if (footer.firstChild) {
                footer.insertBefore(tabs, footer.firstChild);
            } else {
                footer.appendChild(tabs);
            }
        }
    } else {
        footer.style.opacity = 0;
        // 确保tabs在header中
        if (tabs) {
            //console.log('move tabs to header');
            // 先从当前位置移除tabs
            if (tabs.parentNode) {
                tabs.parentNode.removeChild(tabs);
            }
            // 添加到header中适当位置（在language-selection之后）
            const languageSelection = header.querySelector('.language-selection');
            if (languageSelection && languageSelection.nextSibling) {
                header.insertBefore(tabs, languageSelection.nextSibling);
            } else {
                header.appendChild(tabs);
            }
        }
    }
    // 当虚拟键盘打开时(isVirtualKeyboardOpen为true)或输入框聚焦时，不执行任何布局调整操作
}*/

function fetchTrainData() {
    const mainContainer = document.querySelector('main');
    
    if (mainContainer && (mainContainer.children.length === 0 || mainContainer.querySelector('.loading'))) {
        mainContainer.innerHTML = '';
        const loadingElement = document.createElement('div');
        loadingElement.className = 'loading';
        loadingElement.classList.add('item');
        loadingElement.textContent = strings.lines_info.loading[lang] || 'Loading...';
        mainContainer.appendChild(loadingElement);
    }

    function handleTrainData(data) {
        const searchInput = document.querySelector('.search-input');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

        displayTrains(data.trains, mainContainer);

        try {
            const userPrefs = JSON.parse(localStorage.getItem('preferences') || '{}');
            if (userPrefs.followPlayers && typeof PositionUtils !== 'undefined' && typeof PositionUtils.checkTrainApproachingPlayers === 'function') {
                data.trains.forEach(train => {
                    if (train && typeof train === 'object') {
                        PositionUtils.checkTrainApproachingPlayers(train, userPrefs.followPlayers);
                    }
                });
            }
        } catch (error) {
            console.error('检查列车接近玩家时出错:', error);
        }

        applySearchFilter(searchTerm);
        loadUpdateTime();
    }

    if (typeof TrainDataSource !== 'undefined') {
        TrainDataSource.on('data', function (payload) {
            loadingToastShown = false;
            handleTrainData(payload);
        });

        TrainDataSource.on('offline', function () {
            if (!loadingToastShown) {
                showToast(strings.lines_info.loading[lang] || 'Loading...', 5000);
                loadingToastShown = true;
                loadingExampleToastShown = true;
            }
        });

        TrainDataSource.on('fallback_success', function () {
            if (!loadingExampleToastShown) {
                showToast(strings.trains_info.loading_example_data[lang], 5000);
                loadingExampleToastShown = true;
                loadingToastShown = true;
            }
        });

        TrainDataSource.start();
    } else {
        const eventSource = new EventSource(TrainDataSource ? TrainDataSource.API_URL : 'https://track.api.hydcraft.cn/api/trains.rt');
        
        eventSource.onmessage = function(event) {
            try {
                let data = JSON.parse(event.data);
                if (!data || !data.trains || !Array.isArray(data.trains)) {
                    console.error('数据结构无效', data);
                    handleError(mainContainer, strings.lines_info.invalid_data_format[lang] || 'Invalid data format');
                    return;
                }
                data.trains = (data.trains || []).filter(t => t && typeof t === 'object' && t.name && t.cars && Array.isArray(t.cars) && t.cars.length > 0 && t.cars[0].leading && t.cars[0].leading.location);
                handleTrainData(data);
            } catch (error) {
                console.error('解析列车数据时出错:', error);
                handleError(mainContainer, strings.lines_info.json_parse_error[lang] || 'JSON parse error');
            }
        };

        eventSource.onerror = function(error) {
            eventSource.close();
            if (!loadingToastShown) {
                showToast(strings.lines_info.loading[lang] || 'Loading...', 5000);
                loadingToastShown = true;
            }

            fetch('./data/trains.json')
                .then(response => response.json())
                .then(data => {
                    if (!loadingExampleToastShown) {
                        showToast(strings.trains_info.loading_example_data[lang], 5000);
                        loadingExampleToastShown = true;
                    }
                    data.trains = (data.trains || []).filter(t => t && typeof t === 'object' && t.name && t.cars && Array.isArray(t.cars) && t.cars.length > 0 && t.cars[0].leading && t.cars[0].leading.location);
                    handleTrainData(data);
                });

            setTimeout(() => {
                fetchTrainData();
            }, 5000);
        };
    }
}

// 展示所有列车信息
function displayTrains(trains, container) {
    // 检查数据有效性
    if (!trains || !Array.isArray(trains)) {
        handleError(container, strings.lines_info.invalid_data_format[lang] || 'Invalid data format');
        return;
    }
    
    // 保存当前显示的列车数据
    displayedTrains = trains;
    
    // 过滤有效的列车数据
    const validTrains = trains.filter(train => 
        train && 
        typeof train === 'object' && 
        train.name && 
        train.cars && 
        Array.isArray(train.cars) && 
        train.cars.length > 0 &&
        train.cars[0].leading && 
        train.cars[0].leading.location
    );
    
    if (validTrains.length === 0) {
        handleError(container, strings.lines_info.offline[lang] || strings.general.no_data[lang] || 'No trains data available');
        return;
    }
    
    // 清空容器
    container.innerHTML = '';
    
    // 获取当前搜索词
    const urlSearchParams = new URLSearchParams(window.location.search);
    const searchTerm = urlSearchParams.get('q') || '';
    
    // 如果有搜索词，添加标题显示搜索内容
    if (searchTerm) {
        //showToast(strings.trains_info.searching[lang], 30000);
        const searchHeader = document.createElement('div');
        searchHeader.className = 'search-header';
        const searchTitle = document.createElement('h3');
        searchTitle.className = 'search-title';

        // 在window.trainsInfo搜索searchTerm是否与列车编号匹配
        const matchedTrain = window.trainsInfo.find(train => train.name.toLowerCase().includes(searchTerm));

        searchTitle.textContent = `${strings.trains_info.searching_for[lang] || '正在搜索'} "${matchedTrain?searchTerm.toUpperCase():searchTerm}"`;
        
        searchTitle.style.fontWeight = '500';
        searchTitle.style.color = 'var(--color-text-primary)';
        searchHeader.appendChild(searchTitle);

        const clearBtn = document.createElement('button');
        clearBtn.className = 'clear-search-btn';
        clearBtn.textContent = strings.ticket_calculator.clear_input[lang] || 'Clear';
        clearBtn.addEventListener('click', () => {
            // 重置URL参数
            const newUrl = window.location.href.split('?')[0];
            window.history.replaceState({}, '', newUrl);

            // 清空搜索输入框
            const searchInputs = document.querySelectorAll('.search-input');
            searchInputs.forEach(input => {
                input.value = '';
            });
            
            // 重新加载数据
            fetchTrainData();
        });
        searchHeader.appendChild(clearBtn);
        container.appendChild(searchHeader);
        //removeToast(strings.trains_info.searching[lang]);
    } else {
        const searchHeader = document.querySelector('.search-header');
        if (searchHeader) {
            searchHeader.remove();
        }
    }
    
    // 为每辆列车创建一个section
    validTrains.forEach(train => {
        const trainSection = createTrainSection(train);
        container.appendChild(trainSection);
    });
    
    document.addEventListener('touchstart', () => {
        const trainCarsElements = document.querySelectorAll('.train-cars');
        trainCarsElements.forEach(e => { 
            e.style.textDecoration = 'underline';
        });
    });
    
    // 应用当前搜索过滤条件
    applySearchFilter(searchTerm);
}

// 创建列车信息section
function createTrainSection(train) {
    const section = document.createElement('section');
    section.className = 'train-info';
    section.classList.add('item');

    const headerElement = document.createElement('div');
    headerElement.className = 'train-header';

    const infoElement = document.createElement('div');
    infoElement.className = 'train-info-container';

    const basicInfoElement = document.createElement('div');
    basicInfoElement.className = 'train-info-basic';

    const numberElement = document.createElement('div');
    numberElement.className = 'train-info-number';
    
    // 列车名称
    const nameElement = document.createElement('h3');
    nameElement.className = 'train-name';
    nameElement.textContent = train.name;
    nameElement.dataset.trainName = train.name; // 添加data属性用于搜索
    
    // 列车位置信息
    const positionElement = document.createElement('div');
    positionElement.className = 'train-position';
    
    // 获取列车头部位置
    const leadingCar = train.cars[0];
    const position = leadingCar.leading.location;
    positionElement.textContent = `(${position.x.toFixed(0)}, ${position.y.toFixed(0)}, ${position.z.toFixed(0)})`;
    
    const speedElement = document.createElement('div');
    speedElement.className = 'train-speed';
    
    let isStopped = train.stopped === 'true';
    if (typeof PositionUtils !== 'undefined') {
        PositionUtils.computeTrainDirection(train.name, position, isStopped);
    } else {
        const currentTime = Date.now();
        if (trainPositions.has(train.name)) {
            const lastPosition = trainPositions.get(train.name);
            const timeDiff = (currentTime - lastPosition.time) / 1000;
            if (timeDiff > 0) {
                const distance = Math.sqrt(
                    Math.pow(position.x - lastPosition.x, 2) +
                    Math.pow(position.y - lastPosition.y, 2) +
                    Math.pow(position.z - lastPosition.z, 2)
                );
                const COORD_CHANGE_THRESHOLD = 0.1;
                const isCoordinateChanged = distance > COORD_CHANGE_THRESHOLD;
                let speed = distance / timeDiff * 3.6;
                
                if (speed <= 0 && isCoordinateChanged && lastPosition.speed > 0) {
                    speed = lastPosition.speed;
                }
                
                trainPositions.set(train.name, { x: position.x, y: position.y, z: position.z, time: currentTime, speed: speed });
            }
        } else {
            trainPositions.set(train.name, { x: position.x, y: position.y, z: position.z, time: currentTime, speed: 0 });
        }
    }

    let speedText = '';
    let currentSpeed = 0;
    try {
        const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
        const currentTrainData = allTrainsData[train.name];
        if (currentTrainData && currentTrainData.speed !== undefined) {
            if (currentTrainData.isSpeedLost && currentTrainData.prevSpeed !== undefined) {
                currentSpeed = currentTrainData.prevSpeed;
            } else {
                currentSpeed = currentTrainData.speed;
            }
            const trainSpeedLimit = getTrainLimitSpeed(train.name);
            if (currentSpeed > trainSpeedLimit) currentSpeed = trainSpeedLimit;
            if (isStopped) currentSpeed = 0;
            speedText = `${strings.lines_info.speed[lang] || 'Spd '}${currentSpeed.toFixed(0)} km/h`;
        } else {
            speedText = `${strings.lines_info.speed[lang] || 'Spd '}...`;
        }
    } catch (e) {
        speedText = `${strings.lines_info.speed[lang] || 'Spd '}...`;
    }
    
    speedElement.textContent = speedText;
    
    // 列车方向信息
    const directionElement = document.createElement('div');
    directionElement.className = 'train-direction';
    
    // 从localStorage获取列车方向信息
    let directionText = '';
    try {
        const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
        const currentTrainData = allTrainsData[train.name];
        
        if (currentTrainData && currentTrainData.direction) {
            const direction = currentTrainData.direction;
            if (direction === 'up') {
                directionText = strings.lines_info.running_direction_up[lang] || 'Up';
            } else if (direction === 'down') {
                directionText = strings.lines_info.running_direction_down[lang] || 'Down';
            } else if (direction === 'unknown') {
                directionText = strings.lines_info.unknown_direction[lang] || 'Unknown direction';
            }
        }
    } catch (e) {
        console.warn('获取列车方向信息时出错:', e);
    }
    
    directionElement.textContent = directionText;
    directionElement.style.fontSize = '0.9em';
    directionElement.style.color = 'var(--color-text-secondary)';
    
    const warningElement = document.createElement('div');
    warningElement.className = 'train-warning';
    
    try {
        checkAndUpdateTrainWarnings(train, position);
        
        const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
        const currentTrainData = allTrainsData[train.name];
        
        if (currentTrainData && currentTrainData.warningReasons && currentTrainData.warningReasons.length > 0) {
            if (typeof WarningManager !== 'undefined') {
                const warningEl = WarningManager.createWarningElement(
                    currentTrainData.warningReasons.map(type => ({ type, level: WarningManager.CONFIG.WARNING_LEVELS[type] || 'warning' })),
                    strings, lang
                );
                if (warningEl) {
                    warningElement.textContent = warningEl.textContent;
                    warningElement.style.color = warningEl.style.color;
                    warningElement.style.fontWeight = warningEl.style.fontWeight;
                    warningElement.style.display = 'block';
                } else {
                    warningElement.style.display = 'none';
                }
            } else {
                let warningText = '! ';
                currentTrainData.warningReasons.forEach(reason => {
                    const stringKey = `warning_${reason}`;
                    if (strings.lines_info[stringKey]) {
                        warningText += strings.lines_info[stringKey][lang] + '; ';
                    }
                });
                warningElement.textContent = warningText.slice(0, -2);
                warningElement.style.display = 'block';
            }
        } else {
            warningElement.style.display = 'none';
        }
    } catch (e) {
        console.warn('获取列车警告信息时出错:', e);
    }
    
    // 下一站信息
    const nextStationElement = document.createElement('div');
    nextStationElement.className = 'next-station';
    
    // 计算到下一站的距离
    const distanceElement = document.createElement('div');
    distanceElement.className = 'distance-to-next';
    
    // 列车预计到达下一站的时间
    const etaElement = document.createElement('div');
    etaElement.className = 'eta-next-station';
    
    // 列车停靠站台信息
    const platformElement = document.createElement('div');
    platformElement.className = 'train-platform';
    
    // 查找列车所在的线路和下一站
    try {
        // 获取列车方向和历史位置
        const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
        const currentTrainData = allTrainsData[train.name];
        const trainDirection = currentTrainData && currentTrainData.direction ? currentTrainData.direction : 'unknown';
        const prevPosition = currentTrainData && currentTrainData.position ? currentTrainData.position : null;
        
        // 查找列车所在的线路
        let trainLine = null;
        let trainLineId = null;
        
        // 优先通过trains_info.json数据获取列车线路信息
        const lineFromData = getLineForTrain(train.name, 'id');
        if (lineFromData) {
            trainLine = window.lines.find(line => line.id === lineFromData);
            trainLineId = lineFromData;
        }
        
        // 如果trains_info.json中没有线路信息，则通过位置信息来判断列车在哪条线路上
        // 新增逻辑：对所有线路进行检查，找出距离最近的线路
        if (!trainLine) {
            const closestTrackResult = findClosestTrackOnAllLines(position);
            if (closestTrackResult) {
                trainLine = closestTrackResult.line;
                trainLineId = closestTrackResult.line.id;
            }
        }
        
        // 检查列车是否在车站范围内
        let isAtStation = false;
        let stationName = '';
        let platform = '';
        let actualCarPos = null;
        
        if (trainLine) {
            const stationResult = detectTrainAtStation(train, trainLine, {
                checkBothEnds: true,
                atStationThreshold: 100
            });
            
            isAtStation = stationResult.isAtStation;
            stationName = stationResult.stationName;
            platform = stationResult.platform;
            actualCarPos = stationResult.actualCarPos;
        }
        
        if (isAtStation) {
            // 显示列车所在站台
            platformElement.textContent = platform;
            
            // 如果在车站，下一站显示为终点站
                nextStationElement.textContent = strings.trains_info.arrived_at[lang];
                nextStationElement.textContent += stationName;
        } else {
            // 如果不在车站，显示下一站信息
            if (trainLine && trainDirection !== 'unknown') {
                // 查找列车当前所在的车站或轨道位置
                const currentPosition = position;
                const closestStation = findClosestStation(trainLine, currentPosition, trainDirection, prevPosition);
                
                if (closestStation) {
                    // 根据列车方向查找下一站
                    const nextStation = findNextStation(trainLine, closestStation.station, trainDirection);
                    
                    if (nextStation) {
                        nextStationElement.textContent = strings.trains_info.approaching[lang] + getStationName(nextStation.code, lang);
                        
                        // 计算到下一站的距离（优先使用轨道距离）
                        let distanceToNext = Infinity;
                        if (typeof PositionUtils !== 'undefined' && trainLine) {
                            distanceToNext = PositionUtils.calculateTrackDistanceToStation(trainLine, currentPosition, nextStation, trainDirection);
                        }
                        if (!isFinite(distanceToNext) || distanceToNext <= 0) {
                            distanceToNext = calculateDistanceToStation(currentPosition, nextStation, trainDirection);
                        }
                        
                        distanceElement.textContent = `${(distanceToNext / 1000).toFixed(1) + strings.trains_info.km_to[lang] + getStationName(nextStation.code, lang) + strings.ticket_calculator._station[lang]}`;
                        distanceElement.style.fontSize = '0.9em';
                        distanceElement.style.color = 'var(--color-text-secondary)';
                        
                        // 计算预计到达时间（后端优先，降级到本地算法）
                        const updateETA = async () => {
                            // 尝试使用后端API
                            try {
                                const timetableData = await fetchTimetableData();
                                if (timetableData && timetableData.dataAvailable) {
                                    const currentStation = getCurrentStationForTrain(train.name);
                                    if (currentStation) {
                                        const navResponse = await fetch(`./api/timetable/navigation?start=${currentStation}&end=${nextStation.code}&lang=${lang}`);
                                        if (navResponse.ok) {
                                            const navResult = await navResponse.json();
                                            if (navResult.success && navResult.data && navResult.data.length > 0) {
                                                const matchingLine = navResult.data.find(item => item.lineId === trainLineId);
                                                if (matchingLine) {
                                                    const totalSeconds = matchingLine.totalDuration;
                                                    const minutes = Math.floor(totalSeconds / 60);
                                                    if (minutes > 0) {
                                                        etaElement.textContent = minutes + strings.trains_info.min_to_arrival[lang];
                                                        return;
                                                    } else {
                                                        etaElement.textContent = strings.trains_info.arriving[lang];
                                                        return;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            } catch (error) {
                                // 后端不可用，静默降级
                            }

                            // 降级：本地物理计算
                            if (distanceToNext > 0) {
                                const ACCEL = 0.3; // 加速度 m/s²
                                const DECEL = 0.3; // 减速度 m/s²
                                const speedMps = currentSpeed * 1000 / 3600;
                                const trainLimitSpeed = getTrainLimitSpeed(train.name);
                                const limitSpeedMps = trainLimitSpeed * 1000 / 3600;
                                const targetSpeed = Math.min(speedMps, limitSpeedMps);

                                // 如果当前速度为0，视为中途临时停车，假设恢复后加速到限速
                                let totalTime = 0;
                                if (currentSpeed === 0) {
                                    // 从0加速到限速所需距离和时间
                                    const accelDist = (limitSpeedMps * limitSpeedMps) / (2 * ACCEL);
                                    const accelTime = limitSpeedMps / ACCEL;
                                    // 从限速减速到0所需距离和时间
                                    const decelDist = (limitSpeedMps * limitSpeedMps) / (2 * DECEL);
                                    const decelTime = limitSpeedMps / DECEL;

                                    const minDistNeeded = accelDist + decelDist;
                                    if (distanceToNext >= minDistNeeded) {
                                        // 距离足够：加速-巡航-减速
                                        const cruiseDist = distanceToNext - minDistNeeded;
                                        const cruiseTime = cruiseDist / limitSpeedMps;
                                        totalTime = accelTime + cruiseTime + decelTime;
                                    } else {
                                        // 距离不够完成加速+减速，计算能达到的最大速度
                                        // 由 d = v²/(2a) + v²/(2d) = v²*(1/(2a) + 1/(2d))
                                        // v = sqrt(d / (1/(2a) + 1/(2d)))
                                        const maxV = Math.sqrt(distanceToNext / (1/(2*ACCEL) + 1/(2*DECEL)));
                                        totalTime = maxV / ACCEL + maxV / DECEL;
                                    }
                                    // 中途停车情况下显示提示
                                    etaElement.textContent = strings.trains_info.midway_stop[lang] + ' · ' +
                                        (Math.floor(Math.round(totalTime) / 60) > 0
                                            ? Math.floor(Math.round(totalTime) / 60) + strings.trains_info.min_to_arrival[lang]
                                            : strings.trains_info.arriving[lang]);
                                    return;
                                }

                                // 当前有速度的正常情况：加速到限速 → 巡航 → 减速到0
                                // 1. 加速阶段：从当前速度加速到限速
                                const accelDist = (limitSpeedMps * limitSpeedMps - targetSpeed * targetSpeed) / (2 * ACCEL);
                                const accelTime = (limitSpeedMps - targetSpeed) / ACCEL;

                                // 2. 减速阶段：从限速减速到0
                                const decelDist = (limitSpeedMps * limitSpeedMps) / (2 * DECEL);
                                const decelTime = limitSpeedMps / DECEL;

                                const minDistNeeded = Math.max(0, accelDist) + decelDist;

                                if (distanceToNext >= minDistNeeded && limitSpeedMps > targetSpeed) {
                                    // 距离足够完成加速+减速
                                    const cruiseDist = distanceToNext - minDistNeeded;
                                    const cruiseTime = cruiseDist / limitSpeedMps;
                                    totalTime = Math.max(0, accelTime) + cruiseTime + decelTime;
                                } else if (distanceToNext >= decelDist) {
                                    // 距离不够加速，但够减速：直接巡航（当前速度）+ 减速
                                    // 或者当前速度已达到/超过限速
                                    const cruiseDist = distanceToNext - decelDist;
                                    const cruiseSpeed = Math.min(speedMps, limitSpeedMps);
                                    const cruiseTime = cruiseDist / cruiseSpeed;
                                    totalTime = cruiseTime + decelTime;
                                } else {
                                    // 距离连减速都不够，计算能达到的最大速度
                                    // d = (v² - v0²)/(2a_slowdown) ... 但这里是从当前速度减速
                                    // 使用 v_final² = v0² - 2*DECEL*d, v_final >= 0
                                    const finalV2 = speedMps * speedMps - 2 * DECEL * distanceToNext;
                                    if (finalV2 > 0) {
                                        // 还有剩余速度，用当前速度行驶整段距离
                                        totalTime = distanceToNext / speedMps;
                                    } else {
                                        // 会在到达前减速到0
                                        totalTime = speedMps / DECEL;
                                    }
                                }
                                totalTime = Math.max(totalTime, 30);
                                const minutes = Math.floor(Math.round(totalTime) / 60);
                                if (minutes > 0) {
                                    etaElement.textContent = minutes + strings.trains_info.min_to_arrival[lang];
                                } else {
                                    etaElement.textContent = strings.trains_info.arriving[lang];
                                }
                            } else {
                                etaElement.textContent = strings.trains_info.unknown_eta[lang];
                            }
                        };
                        
                        updateETA();
                    }
                }
            } else {
                nextStationElement.textContent = strings.lines_info.next_station[lang] ? 
                    `${strings.lines_info.final_station[lang] || 'Final station'}` : 
                    'Final station';
            }
        }
    } catch (e) {
        console.warn('计算下一站信息时出错:', e);
        nextStationElement.textContent = 'Unknown';
    }

    const trainSeries = getSeriesForTrain(train.name) || strings.general.unknown[lang];
    
    // 列车车厢信息
    const carsElement = document.createElement('div');
    carsElement.className = 'train-cars';
    carsElement.textContent = trainSeries + strings.trains_info.series[lang] +train.cars.length + (strings.trains_info.cars[lang] || '-car');
    carsElement.addEventListener('click', () => {
        loadSeriesInfo(trainSeries);
    });

    const lineElement = document.createElement('a');
    lineElement.className = 'train-line';
    lineElement.innerHTML = strings.trains_info.line_unregistered[lang];
    if (getLineForTrain(train.name)) {
        lineElement.innerHTML = '';
        lineElement.href = `lines_info.html${'?line='+getLineForTrain(train.name, 'id')}`;
        const lineColor = getLineColor(getLineForTrain(train.name, 'id'));
        const lineCode = document.createElement('span');
        lineCode.classList.add('line-code');
        lineCode.textContent = getLineForTrain(train.name, 'id');
        lineCode.style.setProperty('--current-color', lineColor);
        lineCode.style.fontSize = '0.7em';
        lineCode.style.marginInlineEnd = '0.5em';
        lineElement.appendChild(lineCode);
        lineElement.style.color = lineColor;
        lineElement.innerHTML += ' ' + getLineForTrain(train.name);
        lineElement.innerHTML += ' ' + directionText;
        // 获取的线路颜色做透明化处理
        const tintedColor = (() => {
            // 处理十六进制颜色值
            if (lineColor.startsWith('#')) {
                return lineColor + '10'; // 添加透明度
            }
            else return 'var(--color-secondary-hover)'; // 其他情况直接返回原始颜色
        })();
        lineElement.style.background = tintedColor;
    } else {
        // 对于未分配线路的列车，显示特殊标记
        lineElement.textContent = strings.trains_info.line_unregistered[lang];
        lineElement.style.color = 'var(--color-text-secondary)';
        lineElement.style.backgroundColor = 'var(--color-secondary-hover)';
    }
    
    headerElement.appendChild(nameElement);
    headerElement.appendChild(carsElement);

    basicInfoElement.appendChild(headerElement);
    basicInfoElement.appendChild(positionElement);
    basicInfoElement.appendChild(speedElement);
    infoElement.appendChild(basicInfoElement);
    //section.appendChild(basicInfoElement);

    //section.appendChild(speedElement);

    //section.appendChild(directionElement);
    //section.appendChild(distanceElement);
    numberElement.appendChild(etaElement);
    numberElement.appendChild(platformElement);

    numberElement.appendChild(nextStationElement);
    infoElement.appendChild(numberElement);
    section.appendChild(infoElement);
    section.appendChild(lineElement);
    section.appendChild(warningElement); // 添加警告信息显示
    
    return section;
}

function getTrainLimitSpeed(trainName) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.getTrainLimitSpeed(trainName);
    }
}

function getLineForTrain(trainName, mode = 'name') { 
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.getLineForTrain(trainName, mode);
    }
}

function getLineName(lineId = '') {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.getLineName(lineId);
    }
}

function getLineColor(lineId = '') {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.getLineColor(lineId);
    }
}

function getSeriesForTrain(trainName) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.getSeriesForTrain(trainName);
    }
}

// 查找最近的轨道
function findClosestTrack(position) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        // PositionUtils.findClosestTrackOnAllLines 是更全面的实现
        return PositionUtils.findClosestTrackOnAllLines(position);
    }
    
    return closestTrack;
}

// 在所有线路上查找最近的轨道（改进版本）
function findClosestTrackOnAllLines(position) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.findClosestTrackOnAllLines(position);
    }
    
    return closestTrack;
}

// 计算点到线段的距离
function distanceFromSegment(p, v, w) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.distanceFromSegment(p, v, w);
    }
}

// 查找线路上最近的车站（支持方向感知）
function findClosestStation(line, position, direction = null, prevPosition = null) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.findClosestStation(line, position, direction, prevPosition);
    }
}

// 查找车站坐标
// 查找车站的坐标
function findStationCoordinates(stationCode, filterType = null) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.findStationCoordinates(stationCode, filterType);
    }
}

// 根据方向查找下一站
function findNextStation(line, currentStation, direction) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.findNextStation(line, currentStation, direction);
    }
}

// 获取车站名称
function getStationName(stationCode, lang) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.getStationName(stationCode, lang);
    }
}

// 计算到车站的距离
function calculateDistanceToStation(position, station, direction = null) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.calculateDistanceToStation(position, station, direction);
    }
}

// 计算两点间距离
function calculateDistance(v, w) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.calculateDistance(v, w);
    }
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

// 测量线路总长度
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

// 显示线路更新时间及线路长度信息
function loadUpdateTime() {
    const mainContainer = document.querySelector('main');
    
    // 创建或获取更新时间元素
    let updateTime = mainContainer.querySelector('.update-time');
    if (!updateTime) {
        updateTime = document.createElement('div');
        updateTime.className = 'update-time';
        updateTime.style.color = 'var(--color-text-secondary)';
        updateTime.style.padding = '4px 24px';
        // 将元素添加为main的最后一个子项
        mainContainer.appendChild(updateTime);
    }

    updateTime.innerHTML = `
                        ${loadingExampleToastShown ? '' : (strings.lines_info.updated_at[lang] + new Date().toLocaleString() + '<br />')}
                        ${strings.lines_info.locations_for_reference_only[lang]}`;
}

// 错误处理函数
function handleError(container, message) {
    if (!container) return;
    
    container.innerHTML = '';
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.classList.add('item');
    errorElement.textContent = message;
    container.appendChild(errorElement);
}

function checkAndUpdateTrainWarnings(train, position) {
    if (typeof WarningManager !== 'undefined') {
        WarningManager.updateWarningStateForTrainsInfo(train, position, strings, lang);
        return;
    }
    
    if (typeof PositionUtils !== 'undefined') {
        PositionUtils.checkAndUpdateTrainWarnings(train, position);
        return;
    }
    
    try {
        const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
        const currentTrainData = allTrainsData[train.name];
        let shouldShowWarning = false;
        let warningReasons = [];
        
        if (currentTrainData && currentTrainData.speed === 0) {
            const isAtStation = checkIfTrainAtStation(train.name, position);
            if (!isAtStation) {
                shouldShowWarning = true;
                warningReasons.push('zero_speed');
            }
        }
        
        if (currentTrainData && currentTrainData.timestamp) {
            const timeSinceUpdate = Date.now() - currentTrainData.timestamp;
            if (timeSinceUpdate > 180000) {
                shouldShowWarning = true;
                warningReasons.push('long_stop');
            }
        }
        
        if (!allTrainsData[train.name]) {
            allTrainsData[train.name] = {};
        }
        
        if (shouldShowWarning) {
            allTrainsData[train.name].warningReasons = warningReasons;
        } else {
            delete allTrainsData[train.name].warningReasons;
        }
        
        localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
    } catch (e) {
        console.warn('检查并更新列车警告状态时出错:', e);
    }
}


// 添加防抖变量
let searchTimeout;

// 处理搜索输入
function handleSearch(event) {
    // 清除之前的timeout
    clearTimeout(searchTimeout);
    
    // 设置新的timeout
    searchTimeout = setTimeout(() => {
        console.log('处理搜索输入:', event.target.value);
        const searchTerm = event.target.value.toLowerCase().trim();
        //if (searchTerm) showToast(strings.trains_info.searching[lang], 30000);
        
        // 更新URL参数
        const url = new URL(window.location);
        if (searchTerm) {
            url.searchParams.set('q', searchTerm);
        } else {
            url.searchParams.delete('q');
        }
        window.history.replaceState({}, '', url);
        
        // 应用搜索过滤
        visitedPageRecorded = false;
        applySearchFilter(searchTerm);
        //removeToast(strings.trains_info.searching[lang]);

        
        // 如果搜索词为空，移除搜索标题
        if (!searchTerm) {
            const searchTitle = document.querySelector('.search-title');
            if (searchTitle) {
                searchTitle.remove();
            }
        }
    }, 300); // 300ms防抖延迟
}

// 应用搜索过滤条件
function applySearchFilter(searchTerm = '') {
    if (visitedPageRecorded === false) recordLastVisitedPage(`?q=${searchTerm}`,'trains_info.html');
    visitedPageRecorded = true;
    //console.log('应用搜索过滤条件:', searchTerm);
    const trainElements = document.querySelectorAll('.train-info.item');
    
    // 处理搜索标题
    let searchTitle = document.querySelector('.search-title');
    if (searchTerm && !searchTitle) {
        // 如果有搜索词但没有标题，则添加标题
        const container = document.querySelector('main');
        const searchHeader = document.createElement('div');
        searchHeader.className = 'search-header';
        const searchTitle = document.createElement('h3');
        searchTitle.className = 'search-title';

        // 在window.trainsInfo搜索searchTerm是否与列车编号匹配
        const matchedTrain = window.trainsInfo.find(train => train.name.toLowerCase().includes(searchTerm));

        searchTitle.textContent = `${strings.trains_info.searching_for[lang] || '正在搜索'} "${matchedTrain?searchTerm.toUpperCase():searchTerm}"`;
        
        searchTitle.style.fontWeight = '500';
        searchTitle.style.color = 'var(--color-text-primary)';
        searchHeader.appendChild(searchTitle);

        const clearBtn = document.createElement('button');
        clearBtn.className = 'clear-search-btn';
        clearBtn.textContent = strings.ticket_calculator.clear_input[lang] || 'Clear';
        clearBtn.addEventListener('click', () => {
            // 重置URL参数
            const newUrl = window.location.href.split('?')[0];
            window.history.replaceState({}, '', newUrl);

            // 清空搜索输入框
            const searchInput = document.querySelectorAll('.search-input');
            searchInput.forEach(input => input.value = '');
            
            // 重新加载数据
            fetchTrainData();
        });
        searchHeader.appendChild(clearBtn);
        container.insertBefore(searchHeader, container.firstChild);
    } else if (!searchTerm && searchTitle) {
        // 如果没有搜索词但有标题，则移除标题
        const searchHeader = searchTitle.parentElement;
        searchHeader.remove();
    } else if (searchTerm && searchTitle) {

        // 在window.trainsInfo搜索searchTerm是否与列车编号匹配
        const matchedTrain = window.trainsInfo.find(train => train.name.toLowerCase().includes(searchTerm));

        searchTitle.textContent = `${strings.trains_info.searching_for[lang] || '正在搜索'} "${matchedTrain?searchTerm.toUpperCase():searchTerm}"`;
    }
    
    trainElements.forEach(element => {
        const trainNameElement = element.querySelector('.train-name');
        if (!trainNameElement) return;
        
        const trainName = trainNameElement.textContent.toLowerCase();
        
        // 获取列车数据
        const train = displayedTrains.find(t => t.name === trainNameElement.textContent);
        if (!train) return;
        
        // 构建搜索文本
        let searchText = trainName; // 列车名称
        
        // 添加列车系列和车厢数
        const trainSeries = getSeriesForTrain(train.name) || '';
        searchText += ` ${trainSeries.toLowerCase()}`; // 列车系列
        
        const carsCount = train.cars.length;
        searchText += ` ${carsCount}-car ${(strings.trains_info.cars[lang] || '-car').toLowerCase()}`;
        
        // 添加线路信息
        const lineName = getLineForTrain(train.name) || '';
        searchText += ` ${lineName.toLowerCase()}`;
        
        // 添加方向信息
        let directionText = '';
        try {
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const currentTrainData = allTrainsData[train.name];
            
            if (currentTrainData && currentTrainData.direction) {
                const direction = currentTrainData.direction;
                if (direction === 'up') {
                    directionText = (strings.lines_info.running_direction_up[lang] || 'Up').toLowerCase();
                } else if (direction === 'down') {
                    directionText = (strings.lines_info.running_direction_down[lang] || 'Down').toLowerCase();
                } else if (direction === 'unknown') {
                    directionText = (strings.lines_info.unknown_direction[lang] || 'Unknown direction').toLowerCase();
                }
            }
        } catch (e) {
            console.warn('获取列车方向信息时出错:', e);
        }
        searchText += ` ${directionText}`;
        
        // 添加next-station元素中的文案
        const nextStationElement = element.querySelector('.next-station');
        if (nextStationElement) {
            searchText += ` ${nextStationElement.textContent.toLowerCase()}`;
        }
        
        // 添加车站和站台信息
        try {
            const leadingPos = train.cars[0].leading.location; // 列车头位置
            const trailingPos = train.cars[train.cars.length - 1].trailing.location; // 列车尾位置
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const currentTrainData = allTrainsData[train.name];
            const trainDirection = currentTrainData && currentTrainData.direction ? currentTrainData.direction : 'unknown';
            
            let trainLine = null;
            
            // 优先通过trains_info.json数据获取列车线路信息
            const lineFromData = getLineForTrain(train.name, 'id');
            if (lineFromData) {
                trainLine = window.lines.find(line => line.id === lineFromData);
            }
            
            // 如果trains_info.json中没有线路信息，才通过位置信息来判断列车在哪条线路上
            if (!trainLine) {
                const closestTrack = findClosestTrack(leadingPos);
                if (closestTrack) {
                    trainLine = closestTrack.line;
                }
            }
            
            // 查找列车所在的车站和站台
            let isAtStation = false;
            let stationName = '';
            let platform = '';
            let stationCode = '';
            let actualCarPos = null;
            if (trainLine) {
                const stationResult = detectTrainAtStation(train, trainLine, {
                    checkBothEnds: true,
                    atStationThreshold: 200
                });
                
                isAtStation = stationResult.isAtStation;
                stationName = stationResult.stationName;
                platform = stationResult.platform;
                stationCode = stationResult.stationCode;
                actualCarPos = stationResult.actualCarPos;
            }
            
            if (isAtStation) {
                searchText += ` ${strings.trains_info.arrived_at[lang] || 'Arrived at'} ${stationName}`;
                searchText += ` ${platform}`;
                searchText += ` ${stationCode.toLowerCase()}`; // 添加车站三字码到搜索文本
            } else {
                // 如果不在车站，显示下一站信息
                const position = actualCarPos || leadingPos; // 使用定义过的变量替代未定义的 position
                if (trainLine && trainDirection !== 'unknown') {
                    // 查找列车当前所在的车站或轨道位置
                    const currentPosition = position;
                    const closestStation = findClosestStation(trainLine, currentPosition, trainDirection);
                    
                    if (closestStation) {
                        // 根据列车方向查找下一站
                        const nextStation = findNextStation(trainLine, closestStation.station, trainDirection);
                        
                        if (nextStation) {
                            searchText += ` ${strings.trains_info.approaching[lang] || 'Approaching'} ${getStationName(nextStation.code, lang)}`;
                            searchText += ` ${nextStation.code.toLowerCase()}`; // 添加下一站三字码到搜索文本
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('获取列车车站和站台信息时出错:', e);
        }

        try {
            const position = train.cars[0].leading.location;
            checkAndUpdateTrainWarnings(train, position);
            
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const currentTrainData = allTrainsData[train.name];
            
            if (currentTrainData && currentTrainData.warningReasons && currentTrainData.warningReasons.length > 0) {
                if (typeof WarningManager !== 'undefined') {
                    searchText += ` ${WarningManager.getWarningReasonsText(currentTrainData.warningReasons, strings, lang).toLowerCase()}`;
                } else {
                    currentTrainData.warningReasons.forEach(reason => {
                        const stringKey = `warning_${reason}`;
                        if (strings.lines_info[stringKey]) {
                            searchText += ` ${strings.lines_info[stringKey][lang].toLowerCase()}`;
                        }
                    });
                }
            }
        } catch (e) {
            console.warn('获取警告信息时出错:', e);
        }
        
        // 检查搜索词是否在搜索文本中
        if (searchText.includes(searchTerm)) {
            element.style.display = 'block';
        } else {
            element.style.display = 'none';
        }
    });

    // 对显示的 trainElements 进行排序
    const container = document.querySelector('main');
    const visibleElements = Array.from(trainElements).filter(el => el.style.display !== 'none');
    
    const sortedElements = visibleElements.map((element, index) => {
        const platformElement = element.querySelector('.train-platform');
        const etaElement = element.querySelector('.eta-next-station');
        
        // 第一优先级：有 train-platform 且显示
        if (platformElement && platformElement.style.display !== 'none' && platformElement.textContent.trim()) {
            const platformText = platformElement.textContent.trim();
            const platformMatch = platformText.match(/(\d+)/);
            const platformNum = platformMatch ? parseInt(platformMatch[1], 10) : Infinity;
            return { element, priority: 1, sortValue: platformNum, originalIndex: index };
        }
        
        // 第二优先级：有 eta-next-station
        if (etaElement && etaElement.textContent.trim()) {
            const etaText = etaElement.textContent.trim();
            let etaMinutes = Infinity;
            
            // 解析不同格式的 ETA 时间
            // 格式1: "Xmin" 或 "X 分钟"
            const minMatch = etaText.match(/(\d+)\s*(?:min|分)/i);
            if (minMatch) {
                etaMinutes = parseInt(minMatch[1], 10);
            }
            // 格式2: "即将到达" 或 "arriving"
            else if (/arriving|即将|到站/i.test(etaText)) {
                etaMinutes = 0;
            }
            // 格式3: "已停靠" 或 "stopped" - 视为已到达
            else if (/stopped|已停|停靠/i.test(etaText)) {
                etaMinutes = -1; // 最高优先级
            }
            
            return { element, priority: 2, sortValue: etaMinutes, originalIndex: index };
        }
        
        // 第三优先级：其余项目
        return { element, priority: 3, sortValue: 0, originalIndex: index };
    });
    
    // 排序：先按优先级，再按 sortValue，最后保持原始顺序
    sortedElements.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.sortValue !== b.sortValue) return a.sortValue - b.sortValue;
        return a.originalIndex - b.originalIndex;
    });
    
    // 重新排列 DOM 元素
    sortedElements.forEach(({ element }) => {
        container.appendChild(element);
    });
}

function handleWindowResize() {
    if (compactParam === 'true') return;
    const searchBar = document.querySelector('header .search-bar');
    const footer = document.querySelector('footer');
    const header = document.querySelector('header');
    const main = document.querySelector('main');
    const languageSelector = document.querySelector('.language-selection');
    const tabs = document.querySelector('.tabs');
    const sideBar = document.querySelector('.side-bar');
    const sideBarBtn = document.querySelector('.side-bar-btn');
    const activeItem = sideBar.querySelector('.side-bar-item.active');
    const activeTab = tabs.querySelector('.tab-item.active');
    const prefActions = document.querySelector('.pref-actions');
    if (header.contains(tabs)) { 
        header.removeChild(tabs);
    }
    while (activeTab && activeTab.children.length > 1) {
        activeTab.removeChild(activeTab.children[1]);
    }
    
    // 检查是否是由于虚拟键盘弹出导致的窗口大小变化
    // 通过检测窗口宽度没有变化而高度发生变化来判断
    const isVirtualKeyboardOpen = (() => {
        // 保存初始窗口尺寸
        if (typeof window.lastWindowWidth === 'undefined') {
            window.lastWindowWidth = window.innerWidth;
            window.lastWindowHeight = window.innerHeight;
            return false;
        }
        
        // 检查宽度是否不变而高度变化
        const widthUnchanged = window.lastWindowWidth === window.innerWidth;
        const heightChanged = window.lastWindowHeight !== window.innerHeight;
        
        // 更新保存的窗口尺寸
        window.lastWindowWidth = window.innerWidth;
        window.lastWindowHeight = window.innerHeight;
        
        // 宽度未变而高度变化时判断为虚拟键盘弹出
        return widthUnchanged && heightChanged;
    })();
    
    // 检查输入框是否处于焦点状态
    const input = document.querySelector('.search-input');
    const isInputFocused = input && input === document.activeElement;

    if (isVirtualKeyboardOpen || isInputFocused) return;
    const swapFooterItems = prefs.swapFooterItems;
    if (swapFooterItems) footer.classList.add('swapped');
    else footer.classList.remove('swapped');
    
    // 只有在不是虚拟键盘导致的resize且输入框未聚焦时才执行布局调整
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
        main.style.paddingLeft = '24px';
        main.style.paddingBottom = `144px`;
        searchBar.style.display = 'none';
    } else {
        // 移除collapsed类
        footer.style.opacity = 0;
        footer.style.height = 0;
        footer.style.filter = 'blur(24px)';
        footer.style.transform = 'scale(1.2)';
        sideBar.style.display = 'flex';
        setTimeout(() => {
            sideBar.style.opacity = 1;
            sideBar.style.width = '';
            sideBar.style.opacity = 1;
            sideBar.style.filter = '';
            sideBar.style.right = '0';
        }, 10);
        prefActions.style.display = 'none';
        main.style.paddingBottom = '36px';
        searchBar.style.display = 'flex';
        if (activeItem) {
            activeItem.style.padding = '0 8px';
            activeItem.style.borderRadius = '36px';
        }
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
            main.style.paddingLeft = `calc(${lineSelectorWidth}px + 3vw)`;
            tabs.style.marginLeft = `calc(${lineSelectorWidth}px + 2vw)`;
        }, 150);
    }
    // 当虚拟键盘打开时(isVirtualKeyboardOpen为true)或输入框聚焦时，不执行任何布局调整操作
}

// ==================== 安全记录管理功能 ====================

let safetyStatsCache = null;

function initSafetyCounter() {
    const safetyCounter = document.getElementById('safetyCounter');
    if (!safetyCounter) return;
    
    loadSafetyStats();

    safetyCounter.title = strings.safety.title[lang];
    
    safetyCounter.addEventListener('click', () => {
        showSafetyDetails();
        recordLastVisitedPage('?type=safety', 'trains_info.html');
    });
    
    setTimeout(() => {
        safetyCounter.style.transition = 'opacity 0.5s ease';
        safetyCounter.style.opacity = 1;
    }, 500);
}

async function loadSafetyStats() {
    try {
        const response = await fetch('./api/safety/stats');
        const result = await response.json();
        
        if (result.success) {
            safetyStatsCache = result.data;
            updateSafetyCounterUI(result.data);
        }
    } catch (error) {
        console.error('Error loading safety stats:', error);
    }
}

function updateSafetyCounterUI(stats) {
    const safetyDaysEl = document.getElementById('safetyDays');
    const safetyLabelEl = document.querySelector('.safety-label');
    
    if (safetyDaysEl && stats.delayFreeDays !== undefined) {
        animateNumber(safetyDaysEl, Math.floor(stats.delayFreeDays));
    }
}

function animateNumber(element, targetNumber) {
    const duration = 1000;
    const start = 0;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(start + (targetNumber - start) * easeOutQuart);
        
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = targetNumber;
        }

        const icon = element.parentElement.querySelector('.material-symbols-outlined');

        if (targetNumber < 1) {
            element.parentElement.style.color = 'crimson';
            element.parentElement.style.fontWeight = 'bold';
            element.style.display = 'none';
            icon.style.transform = 'translateX(2px)'
            icon.textContent = 'railway_alert';
        } else {
            element.parentElement.style.color = '';
            element.parentElement.style.fontWeight = '';
            icon.textContent = 'verified_user';
            element.style.display = '';
            icon.style.transform = ''
        }
    }
    
    requestAnimationFrame(update);
}

async function showSafetyDetails() {
    if (!safetyStatsCache) {
        await loadSafetyStats();
    }
    
    const token = getAuthToken();
    const isAdmin = token ? await checkIsAdmin(token) : false;
    
    const container = createSafetyDetailsContainer(safetyStatsCache, isAdmin);
    const reportBtn = container.querySelector('.report-btn');
    reportBtn.remove();
    pushDialog(container, 'custom', strings.safety?.title?.[lang] || '安全记录', '', '',reportBtn);
    
    if (prefs.openInContent === true) {
        //window.open('content.html?type=safety', '_self');
    } else {
    }
}

async function checkIsAdmin(token) {
    try {
        const response = await fetch('./api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        
        if (!result.success || !result.data) return false;
        
        const username = result.data.username || result.data.user?.username;
        console.log('🔍 检查管理员权限:', { username, isAdmin: username === 'admin' });
        
        return username === 'admin';
    } catch (error) {
        console.error('❌ 检查管理员权限失败:', error);
        return false;
    }
}

function createSafetyDetailsContainer(stats, isAdmin) {
    const container = document.createElement('div');
    container.classList.add('safety-details-container');
    
    const statsSection = document.createElement('div');
    statsSection.classList.add('stats-container');
    statsSection.classList.add('safety-stats-section');
    
    const accidentFreeCard = createStatCard(
        'verified_user',
        stats.accidentFreeDays || 0,
        strings.safety?.accident_free_days?.[lang] || '天无事故',
        '#4caf50'
    );
    const delayFreeCard = createStatCard(
        'schedule',
        stats.delayFreeDays || 0,
        strings.safety?.delay_free_days?.[lang] || '天无延误',
        '#ff9800'
    );
    const maxDelayFreeCard = createStatCard(
        'award_star',
        stats.maxDelayFreeDays || 0,
        (strings.safety?.max_delay_free_days?.[lang] || '最长无延误天数')+
        '\n'+formatDateRange(stats.maxDelayFreeRange[0], stats.maxDelayFreeRange[1]),
        'gold'
    );
    
    statsSection.appendChild(accidentFreeCard);
    statsSection.appendChild(delayFreeCard);
    statsSection.appendChild(maxDelayFreeCard);
    container.appendChild(statsSection);
    
    const recordsSection = document.createElement('div');
    recordsSection.classList.add('safety-records-section');
    
    const recordsTitle = document.createElement('h3');
    recordsTitle.textContent = strings.safety?.records_title?.[lang] || '事故及延误记录';
    recordsSection.appendChild(recordsTitle);
    
    const recordsList = document.createElement('div');
    recordsList.classList.add('safety-records-list');
    recordsList.id = 'safetyRecordsList';
    recordsList.innerHTML = '<div class="loading-spinner"></div>';
    recordsSection.appendChild(recordsList);
    
    container.appendChild(recordsSection);
    
    if (isAdmin) {
        const adminSection = createAdminPanel();
        container.appendChild(adminSection);
    }
    const reportBtn = document.createElement('button');
    reportBtn.classList.add('report-btn', 'active');
    reportBtn.textContent = strings.safety?.report_btn?.[lang] || '上报事件';
    reportBtn.addEventListener('click', showReportForm);
    container.appendChild(reportBtn);
    
    setTimeout(() => loadSafetyRecords(), 100);
    
    return container;
}

function createStatCard(icon, value, label, color) {
    const item = document.createElement('div');
    item.classList.add('stats-item');

    const iconSpan = document.createElement('span');
    iconSpan.classList.add('material-symbols-outlined');
    iconSpan.textContent = icon;
    iconSpan.style.color = color;

    const valueDiv = document.createElement('div');
    valueDiv.classList.add('stats-num');

    const daysValue = parseFloat(value) || 0;
    let displayValue, unit;

    if (daysValue <= 0) {
        displayValue = 0;
        unit = strings.ticket_calculator.hours[lang];
    } else if (daysValue < 3) {
        displayValue = Math.round(daysValue * 24);
        unit = strings.ticket_calculator.hours[lang];
    } else {
        displayValue = Math.floor(daysValue);
        unit = strings.ticket_calculator.days[lang];
    }

    valueDiv.textContent = displayValue;

    const unitSmall = document.createElement('small');
    unitSmall.classList.add('stats-unit');
    unitSmall.textContent = unit;
    valueDiv.appendChild(unitSmall);

    const labelDiv = document.createElement('div');
    labelDiv.classList.add('stats-desc');
    labelDiv.textContent = label;
    
    item.appendChild(iconSpan);
    item.appendChild(valueDiv);
    item.appendChild(labelDiv);
    
    return item;
}

async function loadSafetyRecords(type = 'all') {
    const token = getAuthToken();
    const recordsListEl = document.getElementById('safetyRecordsList');
    if (!recordsListEl) return;
    
    try {
        let url = './api/safety/records?type=' + type;
        if (token) url += '&status=all';
        
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const response = await fetch(url, { headers });
        const result = await response.json();
        
        if (result.success) {
            renderRecordsList(recordsListEl, result.data.records);
            
            const pendingCount = result.data.pendingCount || 0;
            if (pendingCount > 0 && document.querySelector('.pending-badge')) {
                document.querySelector('.pending-badge').textContent = pendingCount;
                document.querySelector('.pending-badge').style.display = 'inline-flex';
            }
        }
    } catch (error) {
        console.error('Error loading safety records:', error);
        recordsListEl.innerHTML = '<p class="error-message">加载失败</p>';
    }
}

function renderRecordsList(container, records) {
    container.innerHTML = '';
    
    if (!records || records.length === 0) {
        container.innerHTML = `<p class="empty-message">${strings.safety?.no_records?.[lang] || '暂无记录'}</p>`;
        return;
    }
    
    records.forEach(record => {
        const recordItem = createRecordItem(record);
        container.appendChild(recordItem);
    });
}

function createRecordItem(record) {
    const item = document.createElement('div');
    item.classList.add('record-item');
    item.dataset.id = record.id;
    
    const typeBadge = document.createElement('span');
    typeBadge.classList.add('record-type-badge', record.type === 'accident' ? 'badge-accident' : 'badge-delay');
    typeBadge.textContent = record.type === 'accident' ? 
        (strings.safety?.type_accident?.[lang] || '事故') : 
        (strings.safety?.type_delay?.[lang] || '延误');
    
    const header = document.createElement('div');
    header.classList.add('record-header');
    header.appendChild(typeBadge);
    
    const timeEl = document.createElement('span');
    timeEl.classList.add('record-time');
    timeEl.textContent = formatDateTime(record.timestamp);
    header.appendChild(timeEl);
    
    item.appendChild(header);
    
    const details = document.createElement('div');
    details.classList.add('record-details');

    // 如果全大写查找站名
    const stationName = record.location.station.match(/[A-Z]+/)? getStationName(record.location.station, lang) : record.location.station;
    
    details.innerHTML += `
        <div class="detail-row">
            <span class="detail-label">${strings.safety?.location?.[lang] || '位置'}:</span>
            <span class="detail-value">${stationName} - ${record.location.position}</span>
        </div>
    `;
    
    if (record.location.x_coordinate !== undefined && record.location.z_coordinate !== undefined) {
        details.innerHTML += `
            <div class="detail-row coordinate-info">
                <span class="detail-label">${strings.safety?.coordinates?.[lang] || '坐标'}:</span>
                <span class="detail-value">X: ${Number(record.location.x_coordinate).toFixed(2)} | Z: ${Number(record.location.z_coordinate).toFixed(2)}</span>
            </div>
        `;
    }
    
    details.innerHTML += `
        <div class="detail-row">
            <span class="detail-label">${strings.safety?.train_info?.[lang] || '列车'}:</span>
            <span class="detail-value">${record.trainInfo.trainNumber || '-'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">${strings.safety?.cause?.[lang] || '原因'}:</span>
            <span class="detail-value">${record.cause}</span>
        </div>
    `;
    
    if (record.impact && (record.impact.delayMinutes || record.impact.description)) {
        details.innerHTML += `
            <div class="detail-row impact-info">
                <span class="detail-label">${strings.safety?.impact?.[lang] || '影响'}:</span>
                ${record.impact.delayMinutes ? `<span class="detail-value">延误 ${record.impact.delayMinutes} 分钟</span>` : ''}
                ${record.impact.description ? `<span class="detail-value">${record.impact.description}</span>` : ''}
            </div>
        `;
    }
    
    const statusBadge = document.createElement('span');
    statusBadge.classList.add('status-badge', record.status === 'approved' ? 'status-approved' : 
        record.status === 'rejected' ? 'status-rejected' : 'status-pending');
    statusBadge.textContent = record.status === 'approved' ? 
        (strings.safety?.status_approved?.[lang] || '已审核') :
        record.status === 'rejected' ?
        (strings.safety?.status_rejected?.[lang] || '已拒绝') :
        (strings.safety?.status_pending?.[lang] || '待审核');
    
    const footer = document.createElement('div');
    footer.classList.add('record-footer');
    footer.appendChild(statusBadge);
    
    if (record.reportedBy) {
        const reporter = document.createElement('span');
        reporter.classList.add('reporter');
        reporter.textContent = `${strings.safety?.reported_by?.[lang] || '上报人'}: ${record.reportedBy}`;
        footer.appendChild(reporter);
    }
    
    item.appendChild(details);
    item.appendChild(footer);
    
    return item;
}

function formatDateTime(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString(lang.includes('zh') ? 'zh-CN' : 'en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * 格式化日期范围
 * 如果两个时间在同一年则只取月日，如果两个时间不在同一年则只取年月日
 * @param {string|Date} startDate - 开始时间
 * @param {string|Date} endDate - 结束时间
 * @returns {string} 格式化后的日期范围字符串
 */
function formatDateRange(startDate, endDate) {
    if (!startDate || !endDate) return '-';

    const start = new Date(startDate);
    const end = new Date(endDate);

    // 检查日期是否有效
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-';

    const currentYear = new Date().getFullYear();
    const isSameYear = start.getFullYear() === end.getFullYear();
    
    // 定义格式选项
    const yearMonthDayOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const monthDayOptions = { month: '2-digit', day: '2-digit' };

    // 确定语言环境
    const locale = lang.includes('zh') ? 'zh-CN' : 'en-US';

    let startStr, endStr;

    if (isSameYear && start.getFullYear() === currentYear) {
        // 同一年：只显示月日
        // 注意：为了美观，通常开始日期也显示月日，或者根据具体UI需求调整
        // 这里假设两端都只显示月日，例如 "05-01 - 05-10"
        startStr = start.toLocaleDateString(locale, monthDayOptions);
        endStr = end.toLocaleDateString(locale, monthDayOptions);
    } else {
        // 不同年：显示年月日
        startStr = start.toLocaleDateString(locale, yearMonthDayOptions);
        endStr = end.toLocaleDateString(locale, yearMonthDayOptions);
    }

    return `${startStr} - ${endStr}`;
}

function showReportForm() {
    const loggedIn = typeof window.auth !== 'undefined' && window.auth.isLoggedIn && window.auth.isLoggedIn();
    if (!loggedIn) {
        showToast(strings.safety?.login_required?.[lang] || '请先登录后再上报事件', 3000);
        if (window.auth && window.auth.login) {
            const loginResult = window.auth.login();
            if (!loginResult) return;
        } else {
            return;
        }
    }

    const formContainer = document.createElement('div');
    formContainer.classList.add('report-form-container');
    
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    
    formContainer.innerHTML = `
        <form id="safetyReportForm" class="safety-report-form">
            <div class="form-group">
                <label>${strings.safety?.event_type?.[lang] || '事件类型'}:</label>
                <select name="type" required>
                    <option value="delay">${strings.safety?.type_delay?.[lang] || '延误'}</option>
                    <option value="accident">${strings.safety?.type_accident?.[lang] || '事故'}</option>
                </select>
            </div>
            <div class="form-group datetime-group">
                <label>${strings.safety?.event_time?.[lang] || '事件发生时间'}:</label>
                <div class="datetime-inputs">
                    <input type="date" name="eventDate" value="${currentDate}" max="${currentDate}" required>
                    <input type="time" name="eventTime" value="${currentTime}" required>
                </div>
                <small class="form-hint">${strings.safety?.time_hint?.[lang] || '不能选择未来时间'}</small>
            </div>
            <div class="form-group">
                <label>${strings.safety?.station?.[lang] || '车站'}:</label>
                <input type="text" name="station" placeholder="${strings.safety?.station_placeholder?.[lang] || '输入车站代码或名称'}" required>
            </div>
            <div class="form-group">
                <label>${strings.safety?.line?.[lang] || '线路'}:</label>
                <input type="text" name="line" placeholder="${strings.safety?.line_placeholder?.[lang] || '输入线路编号'}">
            </div>
            <div class="form-group">
                <label>${strings.safety?.position?.[lang] || '位置详情'}:</label>
                <input type="text" name="position" placeholder="${strings.safety?.position_placeholder?.[lang] || '如：站台3、区间K12+500'}">
            </div>
            <div class="form-group">
                <label>${strings.safety?.coordinates?.[lang] || '坐标'}:</label>
                <input type="number" name="coordinates-x" placeholder="${strings.safety?.x_coordinate?.[lang] || 'X坐标'}">
                <input type="number" name="coordinates-z" placeholder="${strings.safety?.z_coordinate?.[lang] || 'Z坐标'}">
            </div>
            <div class="form-group">
                <label>${strings.safety?.train_number?.[lang] || '车号'}:</label>
                <input type="text" name="trainNumber" placeholder="${strings.safety?.train_placeholder?.[lang] || '输入车号（可选）'}">
            </div>
            <div class="form-group">
                <label>${strings.safety?.cause_label?.[lang] || '原因分析'}:</label>
                <textarea name="cause" rows="3" placeholder="${strings.safety?.cause_placeholder?.[lang] || '详细描述事件原因'}" required></textarea>
            </div>
            <div class="form-group">
                <label>${strings.safety?.impact_label?.[lang] || '影响评估'}:</label>
                <textarea name="impactDesc" rows="2" placeholder="${strings.safety?.impact_placeholder?.[lang] || '描述影响范围和程度（可选）'}"></textarea>
            </div>
            <button type="submit" class="btn active">${strings.safety?.submit_btn?.[lang] || '提交上报'}</button>
        </form>
    `;
    
    pushDialog(formContainer, 'custom', strings.safety?.report_title?.[lang] || '上报安全事件', '', '');
    
    const dateInput = formContainer.querySelector('input[name="eventDate"]');
    const timeInput = formContainer.querySelector('input[name="eventTime"]');
    
    dateInput.addEventListener('change', function() {
        validateDateTime(dateInput, timeInput);
    });
    
    timeInput.addEventListener('change', function() {
        validateDateTime(dateInput, timeInput);
    });
    
    document.getElementById('safetyReportForm').addEventListener('submit', handleReportSubmit);
}

function validateDateTime(dateInput, timeInput) {
    if (!dateInput.value || !timeInput.value) return true;
    
    const selectedDate = dateInput.value;
    const selectedTime = timeInput.value;
    const selectedDateTime = new Date(`${selectedDate}T${selectedTime}`);
    const now = new Date();
    
    if (selectedDateTime > now) {
        dateInput.setCustomValidity(strings.safety?.future_time_error?.[lang] || '不能选择未来时间');
        timeInput.setCustomValidity(strings.safety?.future_time_error?.[lang] || '不能选择未来时间');
        
        const hintEl = document.querySelector('.form-hint');
        if (hintEl) {
            hintEl.textContent = strings.safety?.future_time_error?.[lang] || '不能选择未来时间';
            hintEl.style.color = '#f44336';
        }
        
        return false;
    } else {
        dateInput.setCustomValidity('');
        timeInput.setCustomValidity('');
        
        const hintEl = document.querySelector('.form-hint');
        if (hintEl) {
            hintEl.textContent = strings.safety?.time_hint?.[lang] || '不能选择未来时间';
            hintEl.style.color = '';
        }
        
        return true;
    }
}

function formatEventTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return new Date().toISOString();
    return `${dateStr} ${timeStr}`;
}

function getAuthToken() {
    try {
        const session = localStorage.getItem('userSession');
        if (session) {
            const parsedSession = JSON.parse(session);
            return parsedSession.token || null;
        }
    } catch (e) {
        console.error('Error getting auth token:', e);
    }
    return null;
}

function isLoggedIn() {
    return !!getAuthToken();
}

async function handleReportSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const token = getAuthToken();
    
    if (!token) {
        showToast(strings.safety?.login_required?.[lang] || '请先登录');
        return;
    }
    
    const eventDate = formData.get('eventDate');
    const eventTime = formData.get('eventTime');
    
    if (!eventDate || !eventTime) {
        showToast(strings.safety?.time_required?.[lang] || '请选择事件发生时间');
        return;
    }
    
    const dateInput = e.target.querySelector('input[name="eventDate"]');
    const timeInput = e.target.querySelector('input[name="eventTime"]');
    
    if (!validateDateTime(dateInput, timeInput)) {
        showToast(strings.safety?.future_time_error?.[lang] || '不能选择未来时间');
        return;
    }
    
    const eventTimestamp = formatEventTime(eventDate, eventTime);
    
    const payload = {
        type: formData.get('type'),
        timestamp: eventTimestamp,
        location: {
            station: formData.get('station'),
            line: formData.get('line'),
            position: formData.get('position'),
            x_coordinate: formData.get('coordinates-x'),
            z_coordinate: formData.get('coordinates-z')
        },
        trainInfo: {
            trainNumber: formData.get('trainNumber')
        },
        cause: formData.get('cause'),
        impact: {
            description: formData.get('impactDesc')
        }
    };
    
    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = strings.safety?.submitting?.[lang] || '提交中...';
        
        const response = await fetch('./api/safety/report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(strings.safety?.submit_success?.[lang] || '提交成功，等待管理员审核');
            
            const dialogs = document.querySelectorAll('.modal-overlay');
            dialogs.forEach(d => d.remove());
            
            await loadSafetyRecords();
        } else {
            showToast(result.message || strings.safety?.submit_failed?.[lang] || '提交失败');
            submitBtn.disabled = false;
            submitBtn.textContent = strings.safety?.submit_btn?.[lang] || '提交上报';
        }
    } catch (error) {
        console.error('Error submitting report:', error);
        showToast(strings.safety?.submit_error?.[lang] || '网络错误，请重试');
        submitBtn.disabled = false;
        submitBtn.textContent = strings.safety?.submit_btn?.[lang] || '提交上报';
    }
}

function createAdminPanel() {
    const panel = document.createElement('div');
    panel.classList.add('admin-review-panel');
    
    panel.innerHTML = `
        <h3 class="panel-title">
            ${strings.safety?.admin_panel?.[lang] || '管理面板'}
            <span class="pending-badge" style="display:none;">0</span>
        </h3>
        <div id="pendingReviewsList" class="pending-reviews-list"></div>
    `;
    
    setTimeout(() => loadPendingReviews(), 200);
    
    return panel;
}

async function loadPendingReviews() {
    const token = getAuthToken();
    const listEl = document.getElementById('pendingReviewsList');
    if (!listEl || !token) return;
    
    try {
        const response = await fetch('./api/safety/records?status=pending&type=all', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        
        if (result.success) {
            renderPendingReviews(listEl, result.data.records);
        }
    } catch (error) {
        console.error('Error loading pending reviews:', error);
    }
}

function renderPendingReviews(container, reviews) {
    container.innerHTML = '';
    
    if (!reviews || reviews.length === 0) {
        container.innerHTML = `<p class="empty-message">${strings.safety?.no_pending?.[lang] || '暂无待审核记录'}</p>`;
        return;
    }
    
    reviews.forEach(review => {
        const reviewItem = document.createElement('div');
        reviewItem.classList.add('review-item');
        
        reviewItem.innerHTML = `
            <div class="review-header">
                <span class="review-type ${review.type}">${review.type === 'accident' ? 
                    (strings.safety?.type_accident?.[lang] || '事故') : 
                    (strings.safety?.type_delay?.[lang] || '延误')}</span>
                <span class="review-time">${formatDateTime(review.createdAt)}</span>
            </div>
            <div class="review-content">
                <p><strong>${strings.safety?.train_number?.[lang] || '列车编号'}:</strong> ${review.trainInfo.trainNumber}</p>
                <p><strong>${strings.safety?.location?.[lang] || '位置'}:</strong> ${review.location.station} - ${review.location.position} (${review.location.x_coordinate}, ${review.location.z_coordinate})</p>
                <p><strong>${strings.safety?.cause?.[lang] || '原因'}:</strong> ${review.cause}</p>
                <p><strong>${strings.safety?.reported_by?.[lang] || '上报人'}:</strong> ${review.reportedBy}</p>
            </div>
            <div class="review-actions">
                <button class="btn btn-success approve-btn" data-id="${review.id}">
                    ${strings.safety?.approve_btn?.[lang] || '通过'}
                </button>
                <button class="btn btn-danger reject-btn" data-id="${review.id}">
                    ${strings.safety?.reject_btn?.[lang] || '拒绝'}
                </button>
            </div>
        `;
        
        reviewItem.querySelector('.approve-btn').addEventListener('click', () => {
            handleReviewAction(review.id, 'approve');
        });
        
        reviewItem.querySelector('.reject-btn').addEventListener('click', () => {
            handleReviewAction(review.id, 'reject');
        });
        
        container.appendChild(reviewItem);
    });
}

async function handleReviewAction(recordId, action) {
    const token = getAuthToken();
    if (!token) return;
    
    try {
        const response = await fetch(`./api/safety/review/${recordId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(action === 'approve' ? 
                (strings.safety?.approve_success?.[lang] || '已通过审核') : 
                (strings.safety?.reject_success?.[lang] || '已拒绝'));
            
            await loadPendingReviews();
            await loadSafetyRecords();
            await loadSafetyStats();
        } else {
            showToast(result.message || strings.safety?.review_error?.[lang] || '操作失败');
        }
    } catch (error) {
        console.error('Error reviewing record:', error);
        showToast(strings.safety?.review_error?.[lang] || '网络错误，请重试');
    }
}

function recordLastVisitedPage(params, page) {
    const history = JSON.parse(localStorage.getItem('visitedPages') || '[]');
    const existingIndex = history.findIndex(p => p.page === page && p.params === params);
    
    if (existingIndex > -1) {
        history.splice(existingIndex, 1);
    }
    
    history.unshift({
        page,
        params,
        timestamp: Date.now()
    });
    
    if (history.length > 50) {
        history.pop();
    }
    
    localStorage.setItem('visitedPages', JSON.stringify(history));
}

window.handleWindowResize = handleWindowResize;