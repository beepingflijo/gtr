
// 页面加载完成后执行初始化函数
document.addEventListener('DOMContentLoaded', function () {
    // 加载线路数据
    fetch('./data/lines.json')
        .then(response => response.json())
        .then(data => {
            window.lines = data.lines;
            // 加载network.json
            fetch('./data/network.json')
                .then(networkResponse => networkResponse.json())
                .then(networkData => {
                    window.stationsNetwork = networkData.stations;
                    fetch('strings.json')
                        .then(stringsResponse => stringsResponse.json())
                        .then(stringsData => {
                            window.strings = stringsData;
                            // 加载列车信息数据
                            fetch('./data/trains_info.json')
                                .then(trainsInfoResponse => trainsInfoResponse.json())
                                .then(trainsInfoData => {
                                    window.trainsInfo = trainsInfoData.trains;
                                    // 初始化PositionUtils模块
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
                                .catch(error => console.error('Error loading trains info data:', error));
                        })
                    .catch(error => console.error('Error loading Language data:', error));
                })
                .catch(error => console.error('Error loading network data:', error));
        })
        .catch(error => console.error('Error loading lines data:', error));
});

// 存储上次列车位置信息用于速度计算
let trainPositions = new Map();
let displayedTrains = []; // 存储当前显示的列车数据
let sidebarCollapseDone = false;
let loadingToastShown = false;
let loadingExampleToastShown = false;
let visitedPageRecorded = false;

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
        const prefBtnText = prefBtn.querySelector('span:not(.material-symbols-outlined)');
        if (prefBtnText) {
            prefBtnText.textContent = strings.preferences[prefBtnText.classList.contains('tab-text')?'page_title_short':'page_title'][lang];
        } else {
            prefBtn.title = strings.preferences.page_title[lang];
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

// 获取列车实时数据
function fetchTrainData() {
    const mainContainer = document.querySelector('main');
    
    // 如果是第一次加载，显示加载中状态
    if (mainContainer && (mainContainer.children.length === 0 || mainContainer.querySelector('.loading'))) {
        mainContainer.innerHTML = '';
        
        // 显示加载中状态
        const loadingElement = document.createElement('div');
        loadingElement.className = 'loading';
        loadingElement.classList.add('item');
        loadingElement.textContent = strings.lines_info.loading[lang] || 'Loading...';
        mainContainer.appendChild(loadingElement);
    }
    
    // 使用EventSource处理Server-Sent Events
    const eventSource = new EventSource('https://track.nitrogen.hydcraft.cn/api/trains.rt');
    
    eventSource.onmessage = function(event) {
        try {
            // 解析服务器发送的数据
            let data = JSON.parse(event.data);
            
            // 验证数据结构
            if (!data || !data.trains || !Array.isArray(data.trains)) {
                console.error('数据结构无效: trains属性不存在或不是数组', data);
                handleError(mainContainer, strings.lines_info.invalid_data_format[lang] || 'Invalid data format');
                return;
            }
            
            // 过滤掉无效的列车数据
            const originalLength = data.trains.length;
            data.trains = data.trains.filter(train => {
                return train && 
                       typeof train === 'object' && 
                       train.name && 
                       train.cars && 
                       Array.isArray(train.cars) && 
                       train.cars.length > 0 &&
                       train.cars[0].leading && 
                       train.cars[0].leading.location;
            });
            //console.log(`过滤前${originalLength}条数据，过滤后${data.trains.length}条数据`);
            
            // 保存当前搜索词
            const searchInput = document.querySelector('.search-input');
            const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
            
            // 显示列车信息
            displayTrains(data.trains, mainContainer);
            
            // 检查列车是否接近关注的玩家
            try {
                // 从localStorage获取关注的玩家列表
                const prefs = JSON.parse(localStorage.getItem('preferences') || '{}');
                if (prefs.followPlayers && 
                    typeof PositionUtils !== 'undefined' && typeof PositionUtils.checkTrainApproachingPlayers === 'function') {
                    console.log('通过SSE检查列车接近玩家');
                    // 遍历所有列车，逐个检查是否接近玩家
                    if (Array.isArray(data.trains)) {
                        data.trains.forEach(train => {
                            // 确保train是有效对象后再调用
                            if (train && typeof train === 'object') {
                                PositionUtils.checkTrainApproachingPlayers(train, prefs.followPlayers);
                                loadingExampleToastShown = false;
                                loadingToastShown = false;
                            }
                        });
                    } else {
                        console.warn('data.trains 不是数组格式:', data.trains);
                    }
                }
            } catch (error) {
                console.error('检查列车接近玩家时出错:', error);
            }
            // 数据更新后，重新应用之前的搜索过滤
            applySearchFilter(searchTerm);
            loadUpdateTime();
        } catch (error) {
            console.error('解析列车数据时出错:', error);
            handleError(mainContainer, strings.lines_info.json_parse_error[lang] || 'JSON parse error');
        }
    };
    
    eventSource.onerror = function(error) {
        console.error('SSE连接错误:', error);
        
        // 关闭当前连接
        eventSource.close();
        
        // 显示toast提示正在重新连接，但保留现有数据
        if (mainContainer) {
            // 检查是否已经存在toast提示，避免重复添加
            if (loadingToastShown === false) showToast(strings.lines_info.loading[lang] || 'Loading...', 5000);
            loadingToastShown = true;
        }

        // 从./data/trains.json中加载数据
        fetch('./data/trains.json')
        .then(response => response.json())
        .then(data => {
            console.log('从./data/trains.json加载数据',data);
            if (loadingExampleToastShown === false) showToast(strings.trains_info.loading_example_data[lang], 5000);
            loadingExampleToastShown = true;
            loadingToastShown = true;
            
            // 显示列车信息
            
            // 过滤掉无效的列车数据
            const originalLength = data.trains.length;
            data.trains = data.trains.filter(train => {
                return train && 
                       typeof train === 'object' && 
                       train.name && 
                       train.cars && 
                       Array.isArray(train.cars) && 
                       train.cars.length > 0 &&
                       train.cars[0].leading && 
                       train.cars[0].leading.location;
            });
            //console.log(`过滤前${originalLength}条数据，过滤后${data.trains.length}条数据`);
            
            // 保存当前搜索词
            const searchInput = document.querySelector('.search-input');
            const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
            
            // 显示列车信息
            displayTrains(data.trains, mainContainer);
            
            // 检查列车是否接近关注的玩家
            try {
                // 从localStorage获取关注的玩家列表
                const prefs = JSON.parse(localStorage.getItem('preferences') || '{}');
                if (prefs.followPlayers && 
                    typeof PositionUtils !== 'undefined' && typeof PositionUtils.checkTrainApproachingPlayers === 'function') {
                    console.log('通过SSE检查列车接近玩家');
                    // 遍历所有列车，逐个检查是否接近玩家
                    if (Array.isArray(data.trains)) {
                        data.trains.forEach(train => {
                            // 确保train是有效对象后再调用
                            if (train && typeof train === 'object') {
                                PositionUtils.checkTrainApproachingPlayers(train, prefs.followPlayers);
                            }
                        });
                    } else {
                        console.warn('data.trains 不是数组格式:', data.trains);
                    }
                }
            } catch (error) {
                console.error('检查列车接近玩家时出错:', error);
            }
            // 数据更新后，重新应用之前的搜索过滤
            applySearchFilter(searchTerm);
            loadUpdateTime();
        })
        
        // 5秒后尝试重新连接
        setTimeout(() => {
            console.log('正在尝试重新连接SSE...');
            fetchTrainData();
        }, 5000);
    };
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
    
    // 列车速度信息 (根据位移和时间差计算)
    const speedElement = document.createElement('div');
    speedElement.className = 'train-speed';
    
    // 计算速度
    const currentTime = Date.now();
    let speedText = '';
    let currentSpeed = 0; // 保存当前速度用于后续计算
    
    if (trainPositions.has(train.name)) {
        const lastPosition = trainPositions.get(train.name);
        const timeDiff = (currentTime - lastPosition.time) / 1000; // 转换为秒
        
        if (timeDiff > 0) {
            // 计算位移距离
            const dx = position.x - lastPosition.x;
            const dy = position.y - lastPosition.y;
            const dz = position.z - lastPosition.z;
            const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            // 计算速度 (km/h)
            currentSpeed = distance / timeDiff * 3.6;

            // 获取列车限速
            const trainSpeedLimit = getTrainLimitSpeed(train.name);

            // 如果计算出超出限速的速度，则认为是异常数据，继承上次速度
            if (currentSpeed > trainSpeedLimit) {
                currentSpeed = lastPosition.speed;
            }
            speedText = `${strings.lines_info.speed[lang] || 'Spd '}${currentSpeed.toFixed(0)} km/h`;
        } else {
            speedText = `${strings.lines_info.speed[lang] || 'Spd '}0 km/h`;
        }
    } else {
        speedText = `${strings.lines_info.speed[lang] || 'Spd '}...`;
    }
    
    // 更新位置缓存
    trainPositions.set(train.name, {
        x: position.x,
        y: position.y,
        z: position.z,
        time: currentTime,
        speed: currentSpeed
    });
    
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
    
    // 列车警告信息
    const warningElement = document.createElement('div');
    warningElement.className = 'train-warning';
    
    try {
        // 检查并更新列车的警告状态
        checkAndUpdateTrainWarnings(train, position);
        
        const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
        const currentTrainData = allTrainsData[train.name];
        
        if (currentTrainData && currentTrainData.warningReasons && currentTrainData.warningReasons.length > 0) {
            let warningText = '! ';
            currentTrainData.warningReasons.forEach(reason => {
                switch (reason) {
                    case 'long_stop':
                        warningText += strings.lines_info.warning_long_stop[lang] + '; ';
                        break;
                    case 'zero_speed':
                        warningText += strings.lines_info.warning_zero_speed[lang] + '; ';
                        break;
                    case 'platform_conflict':
                        warningText += strings.lines_info.warning_platform_conflict[lang] + '; ';
                        break;
                }
            });
            
            // 移除末尾的分号和空格
            warningText = warningText.slice(0, -2);
            warningElement.textContent = warningText;
            warningElement.style.display = warningText ? 'block' : 'none';
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
        // 获取列车方向
        const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
        const currentTrainData = allTrainsData[train.name];
        const trainDirection = currentTrainData && currentTrainData.direction ? currentTrainData.direction : 'unknown';
        
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
        let actualCarPos = null; // 记录实际位置
        
        if (trainLine) {
            // 检查列车是否在车站
            // 新逻辑：分别检查列车头尾车厢，选择更靠近站台的一端
            const leadingPos = train.cars[0].leading.location; // 列车头位置
            const trailingPos = train.cars[train.cars.length - 1].trailing.location; // 列车尾位置
            
            let closestLeadingDistance = Infinity;
            let closestTrailingDistance = Infinity;
            let leadingStation = null;
            let trailingStation = null;
            let leadingCoord = null;
            let trailingCoord = null;
            let leadingNode = null;
            let trailingNode = null;
            
            // 查找头车最近的车站
            for (const node of trainLine.route) {
                if (node.type === 'station') {
                    const stationCoords = findStationCoordinates(node.code);
                    for (const coord of stationCoords) {
                        // 确保坐标数据存在
                        if (!coord || coord.x === undefined || coord.y === undefined || coord.z === undefined) {
                            continue;
                        }
                        
                        const distance = Math.sqrt(
                            Math.pow(leadingPos.x - coord.x, 2) + 
                            Math.pow(leadingPos.y - coord.y, 2) + 
                            Math.pow(leadingPos.z - coord.z, 2)
                        );
                        
                        if (distance < closestLeadingDistance) {
                            closestLeadingDistance = distance;
                            leadingStation = getStationName(node.code, lang);
                            leadingCoord = coord;
                            leadingNode = node;
                        }
                    }
                }
            }
            
            // 查找尾车最近的车站
            for (const node of trainLine.route) {
                if (node.type === 'station') {
                    const stationCoords = findStationCoordinates(node.code);
                    for (const coord of stationCoords) {
                        // 确保坐标数据存在
                        if (!coord || coord.x === undefined || coord.y === undefined || coord.z === undefined) {
                            continue;
                        }
                        
                        const distance = Math.sqrt(
                            Math.pow(trailingPos.x - coord.x, 2) + 
                            Math.pow(trailingPos.y - coord.y, 2) + 
                            Math.pow(trailingPos.z - coord.z, 2)
                        );
                        
                        if (distance < closestTrailingDistance) {
                            closestTrailingDistance = distance;
                            trailingStation = getStationName(node.code, lang);
                            trailingCoord = coord;
                            trailingNode = node;
                        }
                    }
                }
            }
            
            // 比较头尾车厢哪个更接近车站（距离小于200）
            if (closestLeadingDistance <= 200 || closestTrailingDistance <= 200) {
                isAtStation = true;
                if (closestLeadingDistance <= closestTrailingDistance) {
                    // 头车更接近车站
                    stationName = leadingStation;
                    platform = leadingCoord.name.replace(leadingNode.code, "");
                    actualCarPos = leadingPos; // 记录实际位置
                } else {
                    // 尾车更接近车站
                    stationName = trailingStation;
                    platform = trailingCoord.name.replace(trailingNode.code, "");
                    actualCarPos = trailingPos; // 记录实际位置
                }
                
                // 如果列车未到站则去除站台编号中的字母
                if (train.stopped === 'false') {
                    platform = platform.replace(/[A-Za-z]/g, '') + '…';
                }
            }
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
                const closestStation = findClosestStation(trainLine, currentPosition, trainDirection);
                
                if (closestStation) {
                    // 根据列车方向查找下一站
                    const nextStation = findNextStation(trainLine, closestStation.station, trainDirection);
                    
                    if (nextStation) {
                        nextStationElement.textContent = strings.trains_info.approaching[lang] + getStationName(nextStation.code, lang);
                        
                        // 计算到下一站的距离
                        const distanceToNext = calculateDistanceToStation(currentPosition, nextStation);
                        distanceElement.textContent = `${(distanceToNext / 1000).toFixed(1) + strings.trains_info.km_to[lang] + getStationName(nextStation.code, lang) + strings.ticket_calculator._station[lang]}`;
                        distanceElement.style.fontSize = '0.9em';
                        distanceElement.style.color = 'var(--color-text-secondary)';
                        
                        // 计算预计到达时间
                        if (currentSpeed > 0 && distanceToNext > 0) {
                            // 假设以0.3m/s²的加速度减速到0
                            // 使用运动学公式: v² = u² + 2as
                            // 其中 v = 0 (最终速度), u = currentSpeed (初始速度), a = -0.3 (减速度), s = distanceToNext (距离)
                            // 解得: s = u² / (2a)
                            // 如果 distanceToNext > s, 则列车需要先匀速行驶一段距离再减速
                            // 如果 distanceToNext <= s, 则列车需要减速行驶全程
                            
                            // 将速度从 km/h 转换为 m/s
                            const speedMps = currentSpeed * 1000 / 3600;
                            
                            // 计算减速到0所需的距离 (m)
                            const decelDistance = (speedMps * speedMps) / (2 * 0.3);

                            // 从本地的data/trains.json获取列车限速信息
                            const trainLimitSpeed = getTrainLimitSpeed(train.name);

                            // 计算从列车限速减速到0的距离
                            const decelDistanceFromLimit = (trainLimitSpeed * 1000 / 3600) ** 2 / (2 * 0.3);
                            
                            let totalTime = 0; // 总时间（秒）
                            
                            if (distanceToNext > decelDistanceFromLimit) {
                                // 需要匀速行驶一段距离再减速
                                const cruiseDistance = distanceToNext - decelDistance; // 匀速行驶距离 (m)
                                const cruiseTime = cruiseDistance / speedMps; // 匀速行驶时间 (秒)
                                
                                // 减速时间 (从当前速度减到0的时间)
                                const decelTime = speedMps / 0.3;
                                
                                totalTime = cruiseTime + decelTime;
                            } else {
                                // 全程减速行驶
                                // 使用公式: s = ut + (1/2)at² 来计算时间
                                // 由于我们已知 s 和 a，需要求解 t
                                // 0.5 * a * t² + u * t - s = 0
                                // 使用二次方程求解: t = (-u ± √(u² + 2as)) / a
                                // 因为我们知道最终速度为0，所以使用 t = u / a
                                totalTime = speedMps / 0.3;
                            }
                            
                            // 将时间转换为分钟和秒
                            const totalSeconds = Math.round(totalTime);
                            const minutes = Math.floor(totalSeconds / 60);
                            const seconds = totalSeconds % 60;
                            
                            if (minutes > 0) {
                                etaElement.textContent = minutes + strings.trains_info.min_to_arrival[lang];
                            } else {
                                etaElement.textContent = strings.trains_info.arriving[lang];
                            }
                            //etaElement.textContent += getStationName(nextStation.code, lang) + strings.ticket_calculator._station[lang];
                        } else if (currentSpeed === 0) {
                            etaElement.textContent = strings.trains_info.stopped[lang];
                        } else {
                            etaElement.textContent = strings.trains_info.unknown_eta[lang];
                        }
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
    lineElement.textContent = getLineForTrain(train.name) || strings.trains_info.line_unregistered[lang];
    lineElement.textContent += ' ' + directionText;
    if (getLineForTrain(train.name)) {
        lineElement.href = `lines_info.html${'?line='+getLineForTrain(train.name, 'id')}`;
        const lineColor = getLineColor(getLineForTrain(train.name, 'id'));
        lineElement.style.color = lineColor;
        // 获取的线路颜色做透明化处理
        const tintedColor = (() => {
            // 处理十六进制颜色值
            if (lineColor.startsWith('#')) {
                return lineColor + '10'; // 添加透明度33
            }
            else return 'var(--color-secondary-hover)'; // 其他情况直接返回原始颜色
        })();
        lineElement.style.backgroundColor = tintedColor;
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

// 查找线路上最近的车站
function findClosestStation(line, position, direction = null) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.findClosestStation(line, position, direction);
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

// 检查并更新列车警告状态的函数
function checkAndUpdateTrainWarnings(train, position) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        PositionUtils.checkAndUpdateTrainWarnings(train, position);
        return;
    }
    
    // 降级处理：如果PositionUtils不可用，使用原有实现
    try {
        // 从localStorage获取列车数据
        const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
        const currentTrainData = allTrainsData[train.name];
        
        // 检查是否需要添加警告标志
        let shouldShowWarning = false;
        let warningReasons = [];
        
        // 条件1: 列车在轨道上的车速为0且不在任何车站
        if (currentTrainData && currentTrainData.speed === 0) {
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
        
        // 更新localStorage中的警告信息
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
    if (visitedPageRecorded === false) recordLastVisitedPage(`?q=${searchTerm}`);
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
            let stationCode = ''; // 添加车站三字码
            let actualCarPos = null; // 定义 actualCarPos 变量
            if (trainLine) {
                // 检查列车是否在车站
                // 新逻辑：分别检查列车头尾车厢，选择更靠近站台的一端
                const leadingPos = train.cars[0].leading.location; // 列车头位置
                const trailingPos = train.cars[train.cars.length - 1].trailing.location; // 列车尾位置
                
                let closestLeadingDistance = Infinity;
                let closestTrailingDistance = Infinity;
                let leadingStation = null;
                let trailingStation = null;
                let leadingCoord = null;
                let trailingCoord = null;
                let leadingNode = null;
                let trailingNode = null;
                
                // 查找头车最近的车站
                for (const node of trainLine.route) {
                    if (node.type === 'station') {
                        const stationCoords = findStationCoordinates(node.code);
                        for (const coord of stationCoords) {
                            // 确保坐标数据存在
                            if (!coord || coord.x === undefined || coord.y === undefined || coord.z === undefined) {
                                continue;
                            }
                            
                            const distance = Math.sqrt(
                                Math.pow(leadingPos.x - coord.x, 2) + 
                                Math.pow(leadingPos.y - coord.y, 2) + 
                                Math.pow(leadingPos.z - coord.z, 2)
                            );
                            
                            if (distance < closestLeadingDistance) {
                                closestLeadingDistance = distance;
                                leadingStation = getStationName(node.code, lang);
                                leadingCoord = coord;
                                leadingNode = node;
                                stationCode = coord.name; // 保存车站三字码
                            }
                        }
                    }
                }
                
                // 查找尾车最近的车站
                for (const node of trainLine.route) {
                    if (node.type === 'station') {
                        const stationCoords = findStationCoordinates(node.code);
                        for (const coord of stationCoords) {
                            // 确保坐标数据存在
                            if (!coord || coord.x === undefined || coord.y === undefined || coord.z === undefined) {
                                continue;
                            }
                            
                            const distance = Math.sqrt(
                                Math.pow(trailingPos.x - coord.x, 2) + 
                                Math.pow(trailingPos.y - coord.y, 2) + 
                                Math.pow(trailingPos.z - coord.z, 2)
                            );
                            
                            if (distance < closestTrailingDistance) {
                                closestTrailingDistance = distance;
                                trailingStation = getStationName(node.code, lang);
                                trailingCoord = coord;
                                trailingNode = node;
                                stationCode = coord.name; // 保存车站三字码
                            }
                        }
                    }
                }
                
                // 比较头尾车厢哪个更接近车站（距离小于200）
                if (closestLeadingDistance <= 200 || closestTrailingDistance <= 200) {
                    isAtStation = true;
                    if (closestLeadingDistance <= closestTrailingDistance) {
                        // 头车更接近车站
                        stationName = leadingStation;
                        platform = leadingCoord.name.replace(leadingNode.code, "");
                        actualCarPos = leadingPos; // 记录实际位置
                    } else {
                        // 尾车更接近车站
                        stationName = trailingStation;
                        platform = trailingCoord.name.replace(trailingNode.code, "");
                        actualCarPos = trailingPos; // 记录实际位置
                    }
                    
                    // 如果列车未到站则去除站台编号中的字母
                    if (train.stopped === 'false') {
                        platform = platform.replace(/[A-Za-z]/g, '') + '…';
                    }
                }
            }
            
            if (isAtStation) {
                searchText += ` ${strings.trains_info.arrived_at[lang] || 'Arrived at'} ${stationName}`;
                searchText += ` ${platform}`;
                searchText += ` ${stationCode}`; // 添加车站三字码到搜索文本
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
                            searchText += ` ${nextStation.code}`; // 添加下一站三字码到搜索文本
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('获取列车车站和站台信息时出错:', e);
        }

        // 添加警告信息
        try {
            const position = train.cars[0].leading.location; // 定义 position 变量
            checkAndUpdateTrainWarnings(train, position);
            
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const currentTrainData = allTrainsData[train.name];
            
            if (currentTrainData && currentTrainData.warningReasons && currentTrainData.warningReasons.length > 0) {
                currentTrainData.warningReasons.forEach(reason => {
                    switch (reason) {
                        case 'long_stop':
                            searchText += ` ${(strings.lines_info.warning_long_stop[lang] || 'Long stop').toLowerCase()}`;
                            break;
                        case 'zero_speed':
                            searchText += ` ${(strings.lines_info.warning_zero_speed[lang] || 'Zero speed').toLowerCase()}`;
                            break;
                        case 'platform_conflict':
                            searchText += ` ${(strings.lines_info.warning_platform_conflict[lang] || 'Platform conflict').toLowerCase()}`;
                            break;
                    }
                });
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

window.handleWindowResize = handleWindowResize;