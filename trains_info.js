// 修改文件内容
// 解析url参数确定页面语言
var urlParams = new URLSearchParams(window.location.search);
var lang = urlParams.get('lang');
if (lang === null) {
    lang = 'zh_hans';
}
console.log('lang:', lang);
if (lang.startsWith('zh')) {
    document.documentElement.lang = 'zh';
} else {
    document.documentElement.lang = lang;
}

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
                                    init();
                                    initLanguageSelector();
                                    handleWindowResize();
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

// 初始化函数
function init() {
    
    const headerTitle = document.querySelector('header h1');
    const pageTitle = document.querySelector('title');
    console.log(pageTitle.textContent);
    headerTitle.textContent = strings.trains_info.page_title[lang];
    pageTitle.textContent = strings.trains_info.page_title[lang];
    
    const linesBtn = document.querySelector('.lines-btn');
    linesBtn.title = strings.lines_info.page_title[lang];
    linesBtn.addEventListener('click', () => {
            window.open(`lines_info.html${'?lang='+lang}`, '_self');
    });
    const fareBtn = document.querySelector('.fare-btn');
    fareBtn.title = strings.ticket_calculator.page_title[lang];
    fareBtn.addEventListener('click', () => {
            window.open(`ticket_calculator.html${'?lang='+lang}`, '_self');
    });
    const trainsBtn = document.querySelector('.trains-btn');
    trainsBtn.title = strings.trains_info.page_title[lang];

    // 添加搜索功能
    const searchInput = document.querySelector('.search-input');
    searchInput.placeholder = strings.trains_info.search_placeholder[lang];
    const urlSearchParams = new URLSearchParams(window.location.search);
    const searchQuery = urlSearchParams.get('q') || '';
    searchInput.value = searchQuery; // 从URL参数获取搜索词或设置为空
    searchInput.addEventListener('input', handleSearch);

    window.addEventListener('resize', handleWindowResize);
    
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
            
            displayTrains(data.trains, mainContainer);
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
            showToast(strings.lines_info.loading[lang] || 'Loading...', 5000);
        }
        
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
            const searchInput = document.querySelector('.search-input');
            searchInput.value = '';
            
            // 重新加载数据
            fetchTrainData();
        });
        searchHeader.appendChild(clearBtn);
        container.appendChild(searchHeader);
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
        
        // 根据列车名称前缀查找线路
        for (const line of window.lines) {
            if (train.name.startsWith(line.id)) {
                trainLine = line;
                trainLineId = line.id;
                break;
            }
        }
        
        // 如果是GX列车，查找它当前所在的线路
        if (!trainLine && train.name.startsWith('GX')) {
            // 需要通过位置信息来判断列车在哪条线路上
            const closestTrack = findClosestTrack(position);
            if (closestTrack) {
                trainLine = closestTrack.line;
                trainLineId = closestTrack.line.id;
            }
        }
        
        // 检查列车是否在车站范围内
        let isAtStation = false;
        let stationName = '';
        let platform = '';
        
        if (trainLine) {
            // 检查列车是否在车站
            for (const node of trainLine.route) {
                if (node.type === 'station') {
                    const stationCoords = findStationCoordinates(node.code, trainDirection);
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
                            isAtStation = true;
                            stationName = getStationName(node.code, lang);
                            // 将coord.name去掉station.code作为站台名
                            platform = coord.name.replace(node.code, "");
                            
                            // 如果列车未到站则去除站台编号中的字母
                            if (train.stopped === 'false') {
                                platform = platform.replace(/[A-Za-z]/g, '') + '…';
                            }
                            break;
                        }
                    }
                    if (isAtStation) break;
                }
            }
        }
        
        if (isAtStation) {
            // 显示列车所在站台
            platformElement.textContent = platform;
            
            // 如果在车站，下一站显示为终点站
            nextStationElement.textContent = stationName;
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

    const lineElement = document.createElement('a');
    lineElement.className = 'train-line';
    lineElement.textContent = getLineForTrain(train.name) || strings.trains_info.line_unregistered[lang];
    lineElement.textContent += ' ' + directionText;
    if (getLineForTrain(train.name)) {
    lineElement.href = `lines_info.html${'?lang='+lang+'&line='+getLineForTrain(train.name, 'id')}`;
    }
    const lineColor = getLineColor(getLineForTrain(train.name, 'id'));
    lineElement.style.color = lineColor;
    lineElement.style.textDecoration = 'none';
    lineElement.style.padding = '4px 8px';
    lineElement.style.borderRadius = '12px';
    // 获取的线路颜色做透明化处理
    const tintedColor = (() => {
        // 处理十六进制颜色值
        if (lineColor.startsWith('#')) {
            return lineColor + '10'; // 添加透明度33
        }
        else return 'var(--color-secondary-hover)'; // 其他情况直接返回原始颜色
    })();

    lineElement.style.backgroundColor = tintedColor;
    
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
    // 从本地的data/trains_info.json获取列车限速信息
    if (!window.trainsInfo) {
        console.warn('Trains info data not loaded yet');
        return 360; // 默认限速360 km/h
    }
    
    // 从已加载的数据中查找列车信息
    const trainInfo = window.trainsInfo.find(train => train.name === trainName);
    if (trainInfo && trainInfo.maxSpeed) {
        //console.log(`Train ${trainName} limit speed: ${trainInfo.maxSpeed} km/h`);
        return trainInfo.maxSpeed;
    } else {
        return 360; // 默认限速360 km/h
    }
}

function getLineForTrain(trainName, mode = 'name') { 
    // 从本地的data/trains_info.json获取列车线路信息
    if (!window.trainsInfo) {
        console.warn('Trains info data not loaded yet');
        return null;
    }
    
    // 从已加载的数据中查找列车信息
    const trainInfo = window.trainsInfo.find(train => train.name === trainName);
    if (trainInfo && trainInfo.line) {
        //console.log(`Train ${trainName} line: ${trainInfo.line}`);
        if (mode === 'id') return trainInfo.line;
        else return getLineName(trainInfo.line);
    }
}

function getLineName(lineId = '') {
    return lines.find(line => line.id === lineId).name[lang];
}

function getLineColor(lineId = '') {
    const line = lines.find(line => line.id === lineId);
    return line ? line.color : 'var(--color-text-secondary)'; // 如果找不到线路，返回默认灰色
}

function getSeriesForTrain(trainName) {
    // 从本地的data/trains_info.json获取列车车系信息
    if (!window.trainsInfo) {
        console.warn('Trains info data not loaded yet');
        return null;
    }
    
    // 从已加载的数据中查找列车信息
    const trainInfo = window.trainsInfo.find(train => train.name === trainName);
    if (trainInfo && trainInfo.series) {
        //console.log(`Train ${trainName} series: ${trainInfo.series}`);
        return trainInfo.series;
    }
}

// 查找最近的轨道
function findClosestTrack(position) {
        let closestTrack = null;
        let minDistance = Infinity;
        
    for (const line of window.lines) {
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

// 计算点到线段的距离
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

// 查找线路上最近的车站
function findClosestStation(line, position, direction = null) {
    let closestStation = null;
    let minDistance = Infinity;
    
    for (let i = 0; i < line.route.length; i++) {
        const node = line.route[i];
        if (node.type === 'station') {
            // 查找车站的所有坐标点
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

// 查找车站坐标
// 查找车站的坐标
function findStationCoordinates(stationCode, filterType = null) {
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

// 根据方向查找下一站
function findNextStation(line, currentStation, direction) {
    // 找到当前车站在线路中的位置
    const stationIndex = line.route.findIndex(node => 
        node.type === 'station' && node.code === currentStation.code);
    
    if (stationIndex === -1) return null;
    
    // 根据列车方向查找下一站
    let nextStationIndex;
    if (direction === 'down') {
        // 下行方向，查找后面的车站
        for (let i = stationIndex + 1; i < line.route.length; i++) {
            if (line.route[i].type === 'station') {
                nextStationIndex = i;
                break;
            }
        }
    } else if (direction === 'up') {
        // 上行方向，查找前面的车站
        for (let i = stationIndex - 1; i >= 0; i--) {
            if (line.route[i].type === 'station') {
                nextStationIndex = i;
                break;
            }
        }
    }
    
    return nextStationIndex !== undefined ? line.route[nextStationIndex] : null;
}

// 获取车站名称
function getStationName(stationCode, lang) {
    const stationNames = window.strings.station_names;
    if (stationNames[stationCode]) {
        return stationNames[stationCode][lang] || stationNames[stationCode].zh_hans || stationCode;
    }
    return stationCode;
}

// 计算到车站的距离
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

// 计算两点间距离
function calculateDistance(v, w) {
    //console.log ('calculating distance: ',v, w);
    return Math.sqrt(Math.pow(v.x - w.x, 2) + Math.pow(v.z - w.z, 2));
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
                        ${strings.lines_info.updated_at[lang] + new Date().toLocaleString()}<br />
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

// 检查列车是否在车站的辅助函数
function checkIfTrainAtStation(trainName, position) {
    try {
        // 获取所有线路信息
        const lines = window.lines || [];
        
        // 查找列车所在的线路
        let trainLine = null;
        for (const line of lines) {
            if (trainName.startsWith(line.id)) {
                trainLine = line;
                break;
            }
        }
        
        // 如果是GX列车，查找它当前所在的线路
        if (!trainLine && trainName.startsWith('GX')) {
            // 需要通过位置信息来判断列车在哪条线路上
            const closestTrack = findClosestTrack(position);
            if (closestTrack) {
                trainLine = closestTrack.line;
            }
        }
        
        // 检查列车是否在车站范围内
        if (trainLine) {
            // 检查列车是否在车站
            for (const node of trainLine.route) {
                if (node.type === 'station') {
                    const stationCoords = findStationCoordinates(node.code, 'zh'); // 使用默认语言
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

// 添加防抖变量
let searchTimeout;

// 处理搜索输入
function handleSearch(event) {
    // 清除之前的timeout
    clearTimeout(searchTimeout);
    
    // 设置新的timeout
    searchTimeout = setTimeout(() => {
        const searchTerm = event.target.value.toLowerCase().trim();
        
        // 更新URL参数
        const url = new URL(window.location);
        if (searchTerm) {
            url.searchParams.set('q', searchTerm);
        } else {
            url.searchParams.delete('q');
        }
        window.history.replaceState({}, '', url);
        
        // 应用搜索过滤
        applySearchFilter(searchTerm);
        
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
            const searchInput = document.querySelector('.search-input');
            searchInput.value = '';
            
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
        
        // 添加车站和站台信息
        try {
            const position = train.cars[0].leading.location;
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const currentTrainData = allTrainsData[train.name];
            const trainDirection = currentTrainData && currentTrainData.direction ? currentTrainData.direction : 'unknown';
            
            let trainLine = null;
            
            // 根据列车名称前缀查找线路
            for (const line of window.lines) {
                if (train.name.startsWith(line.id)) {
                    trainLine = line;
                    break;
                }
            }
            
            // 如果是GX列车，查找它当前所在的线路
            if (!trainLine && train.name.startsWith('GX')) {
                const closestTrack = findClosestTrack(position);
                if (closestTrack) {
                    trainLine = closestTrack.line;
                }
            }
            
            // 查找列车所在的车站和站台
            if (trainLine) {
                for (const node of trainLine.route) {
                    if (node.type === 'station') {
                        const stationCoords = findStationCoordinates(node.code, trainDirection);
                        for (const coord of stationCoords) {
                            if (!coord || coord.x === undefined || coord.y === undefined || coord.z === undefined) {
                                continue;
                            }
                            
                            const distance = Math.sqrt(
                                Math.pow(position.x - coord.x, 2) + 
                                Math.pow(position.y - coord.y, 2) + 
                                Math.pow(position.z - coord.z, 2)
                            );
                            
                            if (distance <= 200) {
                                const stationName = getStationName(node.code, lang);
                                searchText += ` ${stationName.toLowerCase()}`;
                                
                                // 添加站台信息
                                let platform = coord.name.replace(node.code, "");
                                if (train.stopped === 'false') {
                                    platform = platform.replace(/[A-Za-z]/g, '') + '…';
                                }
                                searchText += ` ${platform.toLowerCase()}`;
                                break;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('获取车站信息时出错:', e);
        }
        
        // 添加警告信息
        try {
            const position = train.cars[0].leading.location;
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
        
        // 根据搜索词显示或隐藏列车信息
        if (searchTerm === '' || searchText.includes(searchTerm)) {
            element.style.display = '';
        } else {
            element.style.display = 'none';
        }
    });
}

function handleWindowResize() {
    const searchBar = document.querySelector('.search-bar');
    const footer = document.querySelector('footer');
    const header = document.querySelector('header');
    const main = document.querySelector('main');
    const languageSelector = document.querySelector('.language-selection');
    
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
    const tabs = document.querySelector('.tabs');

    if (isVirtualKeyboardOpen || isInputFocused) return;
    
    // 只有在不是虚拟键盘导致的resize且输入框未聚焦时才执行布局调整
    if (window.innerWidth < 640) {
        // 添加collapsed类
        //searchBar.classList.remove('no-collapse');
        //searchBar.classList.add('collapsed');
        footer.style.opacity = 1;
        // 先移除footer中现有search-panel
        footer.querySelectorAll('.search-bar').forEach(e => footer.removeChild(e));
        main.querySelectorAll('.search-bar').forEach(e => main.removeChild(e));
        footer.insertBefore(searchBar, footer.firstChild);
        // 确保tabs在footer中
        if (!footer.contains(tabs)) {
            footer.appendChild(tabs);
        }
    } else {
        // 移除collapsed类
        //searchBar.classList.remove('collapsed');
        //searchBar.classList.add('no-collapse');

        footer.style.opacity = 0;
        
        header.querySelectorAll('.search-bar').forEach(e => header.removeChild(e));
        header.insertBefore(searchBar, languageSelector);
        if (!header.contains(tabs)) {
            header.appendChild(tabs);
        }
    }
    // 当虚拟键盘打开时(isVirtualKeyboardOpen为true)或输入框聚焦时，不执行任何布局调整操作
}
