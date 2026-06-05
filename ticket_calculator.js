let sidebarCollapseDone = false;

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
                            const waitForScript = window.scriptReady || Promise.resolve();
                            waitForScript.then(() => init());
                        })
                    .catch(error => console.error('Error loading Language data:', error));
                })
                .catch(error => console.error('Error loading network data:', error));
        })
        .catch(error => console.error('Error loading lines data:', error));
});

// 初始化函数
function init() {
    initDatalist('start');
    initDatalist('end');
    
    const headerTitles = document.querySelectorAll('header h1');
    const pageTitles = document.querySelectorAll('title');
    headerTitles.forEach(headerTitle => {
        headerTitle.textContent = strings.ticket_calculator.page_title[lang];
    });
    pageTitles.forEach(pageTitle => {
        pageTitle.textContent = strings.ticket_calculator.page_title[lang] + ' - ' + strings.mainpage.gtr_info[lang];
    });

    const startInputs = document.querySelectorAll('#startInput');
    const endInputs = document.querySelectorAll('#endInput');
    startInputs.forEach(startInput => {
        startInput.placeholder = strings.ticket_calculator.start_station[lang];
    });
    endInputs.forEach(endInput => {
        endInput.placeholder = strings.ticket_calculator.end_station[lang];
    });

    // 检查URL参数中的start和end值
    const urlParams = new URLSearchParams(window.location.search);
    const lastVisitedParams = new URLSearchParams(getLastVisitedParams());
    const startParam = urlParams.get('start') || lastVisitedParams.get('start');
    const endParam = urlParams.get('end') || lastVisitedParams.get('end');
    const sortParam = urlParams.get('sort') || lastVisitedParams.get('sort'); // 获取排序参数
    console.log(startParam,endParam,sortParam);

    // 如果URL中有start和end参数，则填充输入框并自动搜索
    if (startParam && endParam) {
        // 等待站点数据加载完成后再填充和搜索
        setTimeout(() => {
            // 获取所有车站数据，查找匹配的车站
            const allStations = getAllStations();
            // 对参数进行大写处理以确保匹配（车站代码都是大写的）
            const startCode = startParam.toUpperCase();
            const endCode = endParam.toUpperCase();
            
            // 查找匹配的车站（精确匹配车站代码）
            const startStation = allStations.find(station => {
                const parts = station.split(' ');
                return parts.length > 1 && parts[parts.length - 1] === startCode;
            });
            
            const endStation = allStations.find(station => {
                const parts = station.split(' ');
                return parts.length > 1 && parts[parts.length - 1] === endCode;
            });
            
            if (startStation && endStation) {
                startInputs.forEach(startInput => {
                    startInput.value = startStation;
                });
                endInputs.forEach(endInput => {
                    endInput.value = endStation;
                });
                // 触发搜索
                handleSearch(sortParam || 'time'); // 传递排序参数，默认为time
                
                // 设置正确的排序按钮为激活状态
                if (sortParam) {
                    setTimeout(() => {
                        const sortButtons = {
                            'time': '.sort-by-time',
                            'transfer': '.sort-by-transfers',
                            'price': '.sort-by-price',
                            'departure_early': '.sort-by-departure-early',
                            'arrival_early': '.sort-by-arrival-early'
                        };
                        
                        const buttonSelector = sortButtons[sortParam];
                        console.log('buttonSelector:', buttonSelector);
                        if (buttonSelector) {
                            const sortButton = document.querySelector(buttonSelector);
                            setActiveSortButton(sortButton);
                        }
                    }, 200);
                }
            }
        }, 100);
    }

    startInputs.forEach(startInput => {
        startInput.addEventListener('input', () => { 
            // 同步所有startInput的值
            const value = startInput.value;
            startInputs.forEach(si => {
                if (si !== startInput) {
                    si.value = value;
                }
            });
            filterStations(value, 'start');
        });
    });
    endInputs.forEach(endInput => {
        endInput.addEventListener('input', () => { 
            // 同步所有endInput的值
            const value = endInput.value;
            endInputs.forEach(ei => {
                if (ei !== endInput) {
                    ei.value = value;
                }
            });
            filterStations(value, 'end');
        });
    });

    const searchBtns = document.querySelectorAll('#searchBtn');
    const clearBtns = document.querySelectorAll('#clearBtn');
    searchBtns.forEach(searchBtn => {
        searchBtn.textContent = strings.ticket_calculator.search[lang];
    });
    clearBtns.forEach(clearBtn => {
        clearBtn.textContent = strings.ticket_calculator.clear_input[lang];
    });

    clearBtns.forEach(clearBtn => {
        clearBtn.addEventListener('click', () => { 
            startInputs.forEach(startInput => {
                startInput.value = '';
            });
            endInputs.forEach(endInput => {
                endInput.value = '';
            });
            // 清除URL中的start和end参数
            recordLastVisitedPage();
        });
    });
    
    // 添加搜索按钮事件监听器
    searchBtns.forEach(searchBtn => {
        searchBtn.addEventListener('click', () => {
            // 获取当前激活的排序方式
            let sortBy = 'time'; // 默认排序方式
            const activeSortButton = document.querySelector('.sort-selector .icon-btn.active');
            
            if (activeSortButton) {
                if (activeSortButton.classList.contains('sort-by-time')) {
                    sortBy = 'time';
                } else if (activeSortButton.classList.contains('sort-by-transfers')) {
                    sortBy = 'transfer';
                } else if (activeSortButton.classList.contains('sort-by-price')) {
                    sortBy = 'price';
                } else if (activeSortButton.classList.contains('sort-by-departure-early')) {
                    sortBy = 'departure_early';
                } else if (activeSortButton.classList.contains('sort-by-arrival-early')) {
                    sortBy = 'arrival_early';
                }
            }
            
            handleSearch(sortBy); // 传递排序参数
            // 更新URL参数
            const startCode = parseStationInput(startInput.value);
            const endCode = parseStationInput(endInput.value);
            if (startCode && endCode) {
                recordLastVisitedPage(`?start=${startCode}&end=${endCode}&sort=${sortBy}`);
            }
        });
    });

    const searchResult = document.querySelector('.search-result');
    const inputHint = document.createElement('div');
    inputHint.className = 'input-hint';
    inputHint.classList.add('item');
    inputHint.textContent = strings.ticket_calculator.type_and_search_to_display_results[lang];
    searchResult.appendChild(inputHint);
    recordLastVisitedPage();

    const fareInfoBtns = document.querySelectorAll('.fare-info-btn');
    const fareInfoContent = {
        'zh_hans': `
> 普通/快速车次收取基础票价：
- 3公里内起步价3元
- 3-18公里每增加2.5公里加收1元
- 18-32公里每增加3.5公里加收1元
- 32公里以上每增加5公里加收1元
- 相同起终点的基础票价里程均按普通车最短行程计算，不足按相应公里数计算

> 急行车次按实际里程加收加快费：
- 超出3公里部分每公里收0.65元
- 超出15公里部分每公里收0.45元
- 不足1公里按1公里计算

> 一等座加收一半票价
> 商务座加收2倍加快费，最低票价29元
> 不足0.05元部分舍去`,
        'zh_hant': `
> 普通/快速车次收取基礎票價：
- 3公里内起步價3元
- 3-18公里每增加2.5公里加收1元
- 18-32公里每增加3.5公里加收1元
- 32公里以上每增加5公里加收1元
- 相同起終點的基礎票價里程均按普通车最短行程計算，不足按相应公里數計算

> 急行车次按實際里程加收加快費：
- 超出3公里部分每公里收0.65元
- 超出15公里部分每公里收0.45元
- 不足1公里按1公里計算

> 一等座加收一半票價
> 商務座加收2倍加快費，最低票價29元
> 不足0.05元部分捨去`,
        'en': `
> Local/Express trains charge a Basic fare:
- Starting fare of ¥3 within 3 km
- ¥1 for every additional 2.5 km between 3–18 km
- ¥1 for every additional 3.5 km between 18–32 km
- ¥1 for every additional 5 km beyond 32 km
- The basic fare with same start/end points is calculated according to the shortest distance for local trains
- Fractions are calculated according to the corresponding distance

> Express trains charge an Express addition based on actual distance:
- ¥0.65/km for the portion exceeding 3 km
- ¥0.45/km for the portion exceeding 15 km
- Distances less than 1 km are counted as 1 km

> First-class seats charge an additional half of the fare
> Premium-class seats charge twice the Express addition, minimum fare ¥29
> Fare less than 0.05 are rounded down to the nearest 0.05`,
        'uk': `
> Місцеві/експрес-поїзди стягують базовий тариф:
- Початковий тариф ¥3 за перші 3 км
- ¥1 за кожні додаткові 2,5 км між 3–18 км
- ¥1 за кожні додаткові 3,5 км між 18–32 км
- ¥1 за кожні додаткові 5 км понад 32 км
- Базовий тариф за однаковими пунктами початку/кінця обчислюється відповідно до найкоротшої відстані для місцевих поїздів
- Частини кілометрів розраховуються відповідно до відповідної відстані

> Експрес-поїзди стягують експрес-доплату залежно від фактичної відстані:
- ¥0,65/км за частину понад 3 км
- ¥0,45/км за частину понад 15 км
- Відстані менше 1 км вважаються 1 км

> Плата за квиток першого класу стягується додатково на половину ціни
> Місця преміум-класу стягують вдвічі більше доплати за експрес, мінімальний тариф ¥29
> Частини кілометрів заокругляються до найближчого 0,05`,
    };
    fareInfoBtns.forEach(fareInfoBtn => {
        fareInfoBtn.title = strings.ticket_calculator.fare_info[lang];
        fareInfoBtn.addEventListener('click', () => {
            pushDialog(fareInfoContent[lang],'alert',strings.ticket_calculator.fare_info[lang]);
        });
    });

    // 添加交换按钮点击事件处理程序
    let rotation = 0;
    const swapBtns = document.querySelectorAll('.swap-btn');
    swapBtns.forEach(swapBtn => {
    swapBtn.addEventListener('click', () => {
        // 交换起始站和终点站输入框的内容
        const tempValue = startInputs[0].value;
        startInputs.forEach(input => input.value = endInputs[0].value);
        endInputs.forEach(input => input.value = tempValue);
        
        // 旋转图标180度
        rotation += 180;
        const swapIcons = swapBtn.querySelectorAll('.material-symbols-outlined');
        swapIcons.forEach(swapIcon => {
            swapIcon.style.transform = `rotate(${rotation}deg)`;
            swapIcon.style.transition = 'transform 0.3s ease-in-out';
        });
        
        // 获取当前激活的排序方式
        let sortBy = 'time'; // 默认排序方式
        const activeSortButton = document.querySelector('.sort-selector .icon-btn.active');
        
        if (activeSortButton) {
            if (activeSortButton.classList.contains('sort-by-time')) {
                sortBy = 'time';
            } else if (activeSortButton.classList.contains('sort-by-transfers')) {
                sortBy = 'transfer';
            } else if (activeSortButton.classList.contains('sort-by-price')) {
                sortBy = 'price';
            } else if (activeSortButton.classList.contains('sort-by-departure-early')) {
                sortBy = 'departure_early';
            } else if (activeSortButton.classList.contains('sort-by-arrival-early')) {
                sortBy = 'arrival_early';
            }
        }
        
        // 触发搜索并传递当前排序方式
        handleSearch(sortBy);
        
        // 更新URL参数
        const startCode = parseStationInput(startInputs[0].value);
        const endCode = parseStationInput(endInputs[0].value);
        if (startCode && endCode) {
            recordLastVisitedPage(`?start=${startCode}&end=${endCode}&sort=${sortBy}`);
        }
    });
    });

    window.addEventListener('resize', handleWindowResize);

    // 添加排序按钮的事件监听器
    const sortByTimeBtns = document.querySelectorAll('.sort-by-time');
    const sortByTransfersBtns = document.querySelectorAll('.sort-by-transfers');
    const sortByPriceBtns = document.querySelectorAll('.sort-by-price');
    const sortByDepartureEarlyBtns = document.querySelectorAll('.sort-by-departure-early');
    const sortByArrivalEarlyBtns = document.querySelectorAll('.sort-by-arrival-early');
    
    if (sortByTimeBtns && sortByTransfersBtns && sortByPriceBtns) {
        sortByTimeBtns.forEach(sortByTimeBtn => {
            sortByTimeBtn.addEventListener('click', () => {
                setActiveSortButton(sortByTimeBtn);
                handleSearch('time');
                const startCode = parseStationInput(startInput.value);
                const endCode = parseStationInput(endInput.value);
                if (startCode && endCode) {
                    recordLastVisitedPage(`?start=${startCode}&end=${endCode}&sort=time`);
                }
            });
        });
        
        sortByTransfersBtns.forEach(sortByTransfersBtn => {
            sortByTransfersBtn.addEventListener('click', () => {
                setActiveSortButton(sortByTransfersBtn);
                handleSearch('transfer');
                const startCode = parseStationInput(startInput.value);
                const endCode = parseStationInput(endInput.value);
                if (startCode && endCode) {
                    recordLastVisitedPage(`?start=${startCode}&end=${endCode}&sort=transfer`);
                }
            });
        });
        
        sortByPriceBtns.forEach(sortByPriceBtn => {
            sortByPriceBtn.addEventListener('click', () => {
                setActiveSortButton(sortByPriceBtn);
                handleSearch('price');
                const startCode = parseStationInput(startInput.value);
                const endCode = parseStationInput(endInput.value);
                if (startCode && endCode) {
                    recordLastVisitedPage(`?start=${startCode}&end=${endCode}&sort=price`);
                }
            });
        });
        
        // 新增：按出发早排序
        sortByDepartureEarlyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                setActiveSortButton(btn);
                handleSearch('departure_early');
                const startCode = parseStationInput(startInput.value);
                const endCode = parseStationInput(endInput.value);
                if (startCode && endCode) {
                    recordLastVisitedPage(`?start=${startCode}&end=${endCode}&sort=departure_early`);
                }
            });
        });
        
        // 新增：按到达早排序
        sortByArrivalEarlyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                setActiveSortButton(btn);
                handleSearch('arrival_early');
                const startCode = parseStationInput(startInput.value);
                const endCode = parseStationInput(endInput.value);
                if (startCode && endCode) {
                    recordLastVisitedPage(`?start=${startCode}&end=${endCode}&sort=arrival_early`);
                }
            });
        });
    }

    // 添加时刻表显示按钮事件监听器
    const showTimetableBtns = document.querySelectorAll('.show-timetable-btn');
    showTimetableBtns.forEach(btn => {
        btn.title = strings.ticket_calculator.show_timetable[lang];
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            const isActive = btn.classList.contains('active');
            document.querySelectorAll('.line-trip-info, .line-trip-list').forEach(el => {
                if (isActive) {
                    el.classList.remove('collapsed');
                } else {
                    el.classList.add('collapsed');
                }
            });
        });
    });

    // 添加票价明细显示按钮事件监听器
    const showFareDetailBtns = document.querySelectorAll('.show-fare-detail-btn');
    showFareDetailBtns.forEach(btn => {
        btn.title = strings.ticket_calculator.show_fare_detail[lang];
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            const isActive = btn.classList.contains('active');
            document.querySelectorAll('.fare-detail-calc').forEach(el => {
                if (isActive) {
                    el.classList.remove('collapsed');
                } else {
                    el.classList.add('collapsed');
                }
            });
        });
    });
    window.handleActionsOverflow();
}

// 设置激活的排序按钮
function setActiveSortButton(activeButton) {
    const sortButtons = document.querySelectorAll('.sort-selector .icon-btn');
    sortButtons.forEach(button => {
        button.classList.remove('active');
        const spanText = button.querySelector('span:not(.material-symbols-outlined)');
        if (button.parentElement.classList.contains('segment')) {
            spanText.style.width = '0';
            button.style.width = '30px';
        } else button.style.width = '';
    });
    // 查找activeButton中以'sort-by-'开头的类名
    let activeSortClass = '';
    for (const className of activeButton.classList) {
        if (className.startsWith('sort-by-')) {
            activeSortClass = className;
            break;
        }
    }
    if (activeSortClass) {
        const activeSortButtons = document.querySelectorAll(`.sort-selector .${activeSortClass}`);
        activeSortButtons.forEach(button => {
            button.classList.add('active');
            const spanText = button.querySelector('span:not(.material-symbols-outlined)');
            spanText.style.width = Math.min(calculateTextWidth(spanText.textContent),5)+'em';
            button.style.width = 'calc(100% - 60px)';
        });
    }
}

// 从输入值中提取车站代码
function getStationCode(stationInputValue) {
    if (!stationInputValue) return '';
    const parts = stationInputValue.split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : '';
}

// 初始化datalist元素
function initDatalist(type) {
    const searchInput = document.getElementById(`${type}Input`);
    if (!searchInput) {
        console.warn(`${type}Input元素未找到`);
        return;
    }

    // 设置input的list属性
    searchInput.setAttribute('list', `${type}-stations`);

    const datalist = document.createElement("datalist");
    datalist.id = `${type}-stations`;
    searchInput.parentNode.insertBefore(datalist, searchInput.nextSibling);
}

// 为start-station和end-station提供输入建议
function filterStations(query, type) {
    // 获取当前语言设置
    var urlParams = new URLSearchParams(window.location.search);
    var currentLang = urlParams.get('lang');
    if (currentLang === null) {
        currentLang = 'zh_hans';
    }
    
    query = query.toLowerCase();
    let filteredStations = [];
    
    if (currentLang.startsWith('zh')) {
        // 对于中文，支持繁简体匹配
        const allStations = getAllStations();
        filteredStations = allStations.filter(stationItem => {
            // 分离车站名称和三字码
            const parts = stationItem.split(' ');
            const stationName = parts.slice(0, -1).join(' ');
            const stationCode = parts[parts.length - 1];
            
            // 检查是否匹配查询（不区分大小写）
            if (stationItem.toLowerCase().includes(query)) {
                return true;
            }
            
            // 检查繁简体中文匹配
            if (window.strings && window.strings.station_names) {
                // 遍历所有车站的中文名称
                for (const [code, names] of Object.entries(window.strings.station_names)) {
                    if (code === stationCode) {
                        // 检查简体和繁体是否匹配查询
                        if (names.zh_hans && names.zh_hans.includes(query)) {
                            return true;
                        }
                        if (names.zh_hant && names.zh_hant.includes(query)) {
                            return true;
                        }
                        // 也检查小写匹配
                        if (names.zh_hans && names.zh_hans.toLowerCase().includes(query)) {
                            return true;
                        }
                        if (names.zh_hant && names.zh_hant.toLowerCase().includes(query)) {
                            return true;
                        }
                    }
                }
            }
            
            return false;
        });
    } else {
        // 对于非中文语言，使用原有逻辑
        filteredStations = getAllStations().filter(stationName => stationName.toLowerCase().includes(query));
    }
    
    console.log(`过滤后的站点列表 (${type}):`, filteredStations); // 调试信息

    const datalist = document.getElementById(`${type}-stations`);
    if (!datalist) {
        console.warn(`${type}-stations元素未找到`);
        return;
    }

    // 清空现有选项
    while (datalist.firstChild) {
        datalist.removeChild(datalist.firstChild);
    }

    filteredStations.forEach(stationName => {
        const option = document.createElement("option");
        // 只保留|之前的站名部分
        option.value = stationName;
        datalist.appendChild(option);
        datalist.style.display = 'flex';
    });
}

// 获取所有车站（用于搜索）
function getAllStations() {    
    const stations = new Set();
    Object.values(lines).forEach(line => {
        line.route.forEach(step => {
            if (step.type === 'station') {
                //将车站名称和三字码绑定在一起添加到集合中
                stations.add(`${getStationName(step.code, lang)} ${step.code}`);
            }
        });
    });
    //console.log(stations);
    return Array.from(stations);
}

// 班次时间信息缓存
let tripTimesCache = {
    data: null,
    startCode: null,
    endCode: null,
    timestamp: 0,
    TTL: 30000 // 30秒缓存有效期
};

// 自动刷新状态管理
let refreshState = {
    timer: null,          // 定时器 ID
    active: false,        // 是否正在自动刷新
    interval: 30000,      // 刷新间隔（30秒）
    retryCount: 0,        // 当前重试次数
    maxRetries: 3,        // 最大重试次数
    retryDelay: 5000,     // 重试基础延迟（5秒）
    lastRefreshTime: 0,   // 上次刷新时间
    consecutiveErrors: 0, // 连续失败次数
    routes: null,         // 当前路线数据
    sortBy: 'time',       // 当前排序方式
    startCode: null,      // 当前起点
    endCode: null,        // 当前终点
    resultsContainer: null // 结果容器
};

// 轻量日志系统
const tripLogger = {
    _logs: [],
    _maxLogs: 100,
    log(level, message, data = null) {
        const entry = {
            time: new Date().toISOString(),
            level,
            message,
            data
        };
        this._logs.push(entry);
        if (this._logs.length > this._maxLogs) {
            this._logs = this._logs.slice(-this._maxLogs);
        }
        const prefix = `[TripRefresh][${level.toUpperCase()}]`;
        if (level === 'error') {
            console.error(prefix, message, data || '');
        } else if (level === 'warn') {
            console.warn(prefix, message, data || '');
        } else {
            console.log(prefix, message, data || '');
        }
    },
    info(msg, data) { this.log('info', msg, data); },
    warn(msg, data) { this.log('warn', msg, data); },
    error(msg, data) { this.log('error', msg, data); },
    getLogs() { return [...this._logs]; }
};

// 带重试的 fetch 封装
async function fetchWithRetry(url, options = {}, maxRetries = 2, baseDelay = 2000) {
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                const delay = baseDelay * Math.pow(2, attempt - 1);
                tripLogger.info(`重试请求 (第${attempt}次): ${url}`, { delay });
                await new Promise(r => setTimeout(r, delay));
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            lastError = error;
            tripLogger.warn(`请求失败 (第${attempt + 1}次): ${url}`, { error: error.message });
        }
    }
    throw lastError;
}

// 更新刷新状态指示器
function updateRefreshIndicator(status) {
    // 非本地测试情况下不继续执行
    const isLocalTest = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalTest) {
        return;
    }
    if (status === 'updated') {
        const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        showToast(`✓ ${timeStr} 班次数据已更新`, 3000);
    } else if (status === 'error') {
        showToast('班次数据更新失败，稍后自动重试', 5000);
    }
}

// 执行一次刷新（重新获取所有班次数据）
async function performRefresh(forceRefresh = true) {
    const { routes, sortBy, startCode, endCode, resultsContainer } = refreshState;
    if (!routes || !startCode || !endCode || !resultsContainer) {
        tripLogger.warn('刷新跳过：缺少必要上下文');
        return false;
    }

    tripLogger.info('开始刷新班次数据', { startCode, endCode, forceRefresh });
    updateRefreshIndicator('refreshing');

    let hasError = false;
    let hasUpdate = false;

    try {
        // 并行获取所有数据源
        const fetchPromises = [];

        // 1. 实时单线数据
        fetchPromises.push(
            fetchTripTimes(startCode, endCode, forceRefresh).then(tripTimes => {
                if (tripTimes && tripTimes.trips && tripTimes.trips.length > 0) {
                    updateRoutesWithTripTimes(routes, tripTimes.trips);
                    updateTripTimesDisplay(tripTimes.trips);
                    hasUpdate = true;
                    tripLogger.info('实时单线数据更新成功', { count: tripTimes.trips.length });
                }
            }).catch(e => {
                tripLogger.error('实时单线数据更新失败', { error: e.message });
                hasError = true;
            })
        );

        // 2. 推算单线数据
        fetchPromises.push(
            fetchScheduledTrips(startCode, endCode, forceRefresh).then(scheduledData => {
                if (scheduledData && scheduledData.trips && scheduledData.trips.length > 0) {
                    routes.forEach(route => {
                        if (route.segments && route.segments.length > 1) return;
                        const routeLineIds = route.segments ? route.segments.map(s => s.line) : [];
                        const matchingScheduled = scheduledData.trips.filter(trip => routeLineIds.includes(trip.lineId));
                        if (matchingScheduled.length > 0) {
                            route.scheduledTrips = matchingScheduled;
                            const key = `${matchingScheduled[0].lineId}:${matchingScheduled[0].direction}`;
                            if (scheduledData.nextTrips && scheduledData.nextTrips[key]) {
                                route.scheduledNextTrip = scheduledData.nextTrips[key];
                            }
                            if (!route.earliestDeparture || !route.earliestArrival) {
                                if (!route.earliestDeparture) {
                                    route.earliestDeparture = new Date(matchingScheduled[0].departureTime).getTime();
                                }
                                if (!route.earliestArrival) {
                                    route.earliestArrival = new Date(matchingScheduled[matchingScheduled.length - 1].arrivalTime).getTime();
                                }
                            }
                        }
                    });
                    hasUpdate = true;
                    tripLogger.info('推算单线数据更新成功', { count: scheduledData.trips.length });
                }
            }).catch(e => {
                tripLogger.error('推算单线数据更新失败', { error: e.message });
                hasError = true;
            })
        );

        // 3. 多段换乘数据
        routes.forEach(route => {
            if (!route.segments || route.segments.length <= 1) return;
            const segments = route.segments.map(seg => ({
                lineId: seg.line,
                startCode: seg.stations[0],
                endCode: seg.stations[seg.stations.length - 1]
            }));

            fetchPromises.push(
                fetchMultiSegmentTrips(segments, forceRefresh).then(multiResult => {
                    if (multiResult) {
                        route.multiSegmentTrips = multiResult;
                        // 更新路线时间：出发取第一个有数据的段，到达取最后一个有数据的段
                        if (multiResult.segments && multiResult.segments.length > 0) {
                            const firstAvailableIdx = multiResult.segments.findIndex(s => s.available && s.trips.length > 0);
                            if (firstAvailableIdx >= 0) {
                                let departureTime = new Date(multiResult.segments[firstAvailableIdx].trips[0].departureTime).getTime();
                                for (let i = 0; i < firstAvailableIdx; i++) {
                                    departureTime -= (route.segments[i].duration || 0) * 1000;
                                    departureTime -= 120 * 1000;
                                }
                                route.earliestDeparture = departureTime;
                            }
                            const lastAvailableIdx = [...multiResult.segments].reverse().findIndex(s => s.available && s.trips.length > 0);
                            if (lastAvailableIdx >= 0) {
                                const actualLastIdx = multiResult.segments.length - 1 - lastAvailableIdx;
                                let arrivalTime = new Date(multiResult.segments[actualLastIdx].trips[multiResult.segments[actualLastIdx].trips.length - 1].arrivalTime).getTime();
                                for (let i = actualLastIdx + 1; i < multiResult.segments.length; i++) {
                                    arrivalTime += 120 * 1000;
                                    arrivalTime += (route.segments[i].duration || 0) * 1000;
                                }
                                route.earliestArrival = arrivalTime;
                            }
                            route.allSegmentsAvailable = multiResult.allAvailable;
                        } else if (multiResult.overallDeparture && multiResult.overallArrival) {
                            route.earliestDeparture = new Date(multiResult.overallDeparture).getTime();
                            route.earliestArrival = new Date(multiResult.overallArrival).getTime();
                            route.allSegmentsAvailable = multiResult.allAvailable;
                        }
                        hasUpdate = true;
                    }
                }).catch(e => {
                    tripLogger.error('实时多段数据更新失败', { error: e.message });
                    hasError = true;
                })
            );

            fetchPromises.push(
                fetchScheduledMultiSegmentTrips(segments, forceRefresh).then(scheduledMultiResult => {
                    if (scheduledMultiResult) {
                        route.scheduledMultiSegmentTrips = scheduledMultiResult;
                        // 如果没有实时数据，使用推算数据：出发取第一个有数据的段，到达取最后一个有数据的段
                        if (!route.earliestDeparture || !route.earliestArrival) {
                            if (scheduledMultiResult.segments && scheduledMultiResult.segments.length > 0) {
                                if (!route.earliestDeparture) {
                                    const firstAvailableIdx = scheduledMultiResult.segments.findIndex(s => s.available && s.trips.length > 0);
                                    if (firstAvailableIdx >= 0) {
                                        let departureTime = new Date(scheduledMultiResult.segments[firstAvailableIdx].trips[0].departureTime).getTime();
                                        for (let i = 0; i < firstAvailableIdx; i++) {
                                            departureTime -= (route.segments[i].duration || 0) * 1000;
                                            departureTime -= 120 * 1000;
                                        }
                                        route.earliestDeparture = departureTime;
                                    }
                                }
                                if (!route.earliestArrival) {
                                    const lastAvailableIdx = [...scheduledMultiResult.segments].reverse().findIndex(s => s.available && s.trips.length > 0);
                                    if (lastAvailableIdx >= 0) {
                                        const actualLastIdx = scheduledMultiResult.segments.length - 1 - lastAvailableIdx;
                                        let arrivalTime = new Date(scheduledMultiResult.segments[actualLastIdx].trips[scheduledMultiResult.segments[actualLastIdx].trips.length - 1].arrivalTime).getTime();
                                        for (let i = actualLastIdx + 1; i < scheduledMultiResult.segments.length; i++) {
                                            arrivalTime += 120 * 1000;
                                            arrivalTime += (route.segments[i].duration || 0) * 1000;
                                        }
                                        route.earliestArrival = arrivalTime;
                                    }
                                }
                            } else if (scheduledMultiResult.overallDeparture && scheduledMultiResult.overallArrival) {
                                if (!route.earliestDeparture) {
                                    route.earliestDeparture = new Date(scheduledMultiResult.overallDeparture).getTime();
                                }
                                if (!route.earliestArrival) {
                                    route.earliestArrival = new Date(scheduledMultiResult.overallArrival).getTime();
                                }
                            }
                        }
                        hasUpdate = true;
                    }
                }).catch(e => {
                    tripLogger.error('推算多段数据更新失败', { error: e.message });
                    hasError = true;
                })
            );
        });

        await Promise.allSettled(fetchPromises);

        if (hasUpdate) {
            if (sortBy === 'departure_early' || sortBy === 'arrival_early') {
                sortRoutes(routes, sortBy);
            }
            renderSearchResults(routes, resultsContainer);
            refreshState.consecutiveErrors = 0;
            updateRefreshIndicator('updated');
            tripLogger.info('班次数据刷新完成');
        } else if (hasError) {
            refreshState.consecutiveErrors++;
            updateRefreshIndicator('error');
            tripLogger.warn('刷新完成但无数据更新', { consecutiveErrors: refreshState.consecutiveErrors });
        }

        return hasUpdate;
    } catch (error) {
        refreshState.consecutiveErrors++;
        tripLogger.error('刷新过程异常', { error: error.message });
        updateRefreshIndicator('error');
        return false;
    }
}

// 启动自动刷新
function startAutoRefresh(routes, sortBy, startCode, endCode, resultsContainer) {
    stopAutoRefresh();
    refreshState.routes = routes;
    refreshState.sortBy = sortBy;
    refreshState.startCode = startCode;
    refreshState.endCode = endCode;
    refreshState.resultsContainer = resultsContainer;
    refreshState.active = true;
    refreshState.consecutiveErrors = 0;
    refreshState.lastRefreshTime = Date.now();

    tripLogger.info('启动自动刷新', { interval: refreshState.interval, startCode, endCode });

    refreshState.timer = setInterval(async () => {
        if (!refreshState.active) return;
        // 连续失败超过阈值时，逐步增加间隔（退避策略）
        if (refreshState.consecutiveErrors >= refreshState.maxRetries) {
            const backoffInterval = refreshState.interval * Math.min(refreshState.consecutiveErrors, 5);
            tripLogger.warn(`连续失败${refreshState.consecutiveErrors}次，延迟${backoffInterval / 1000}秒后重试`);
            updateRefreshIndicator('stopped');
            return;
        }
        await performRefresh(true);
        refreshState.lastRefreshTime = Date.now();
    }, refreshState.interval);
}

// 停止自动刷新
function stopAutoRefresh() {
    if (refreshState.timer) {
        clearInterval(refreshState.timer);
        refreshState.timer = null;
    }
    refreshState.active = false;
    updateRefreshIndicator('stopped');
    tripLogger.info('停止自动刷新');
}

// 页面卸载时清理
window.addEventListener('beforeunload', stopAutoRefresh);

// 多段换乘查询缓存
let multiSegmentCache = {
    data: null,
    key: null,
    timestamp: 0,
    TTL: 30000
};

// 推算时刻表查询缓存
let scheduledTripsCache = {
    data: null,
    startCode: null,
    endCode: null,
    timestamp: 0,
    TTL: 15000 // 15秒缓存（推算数据更新更频繁）
};

// 推算时刻表多段换乘缓存
let scheduledMultiSegmentCache = {
    data: null,
    key: null,
    timestamp: 0,
    TTL: 15000
};

// 获取推算时刻表班次信息（含第二辆列车）
async function fetchScheduledTrips(startCode, endCode, forceRefresh = false) {
    const now = Date.now();

    // 检查缓存（强制刷新时跳过）
    if (!forceRefresh &&
        scheduledTripsCache.data &&
        scheduledTripsCache.startCode === startCode &&
        scheduledTripsCache.endCode === endCode &&
        (now - scheduledTripsCache.timestamp) < scheduledTripsCache.TTL) {
        return scheduledTripsCache.data;
    }

    try {
        const response = await fetchWithRetry(`./api/timetable/scheduled-trips?start=${startCode}&end=${endCode}&lang=${lang}`);
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                scheduledTripsCache = {
                    data: result.data,
                    startCode,
                    endCode,
                    timestamp: now,
                    TTL: 15000
                };
                return result.data;
            }
        }
    } catch (error) {
        console.warn('获取推算班次信息失败:', error);
    }

    return null;
}

// 获取推算时刻表多段换乘班次信息
async function fetchScheduledMultiSegmentTrips(segments, forceRefresh = false) {
    const now = Date.now();

    const cacheKey = segments.map(s => `${s.lineId}:${s.startCode}:${s.endCode}`).join('|');

    if (!forceRefresh &&
        scheduledMultiSegmentCache.data &&
        scheduledMultiSegmentCache.key === cacheKey &&
        (now - scheduledMultiSegmentCache.timestamp) < scheduledMultiSegmentCache.TTL) {
        return scheduledMultiSegmentCache.data;
    }

    try {
        const response = await fetchWithRetry('./api/timetable/scheduled-multi-segment-trips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ segments, lang })
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                scheduledMultiSegmentCache = {
                    data: result.data,
                    key: cacheKey,
                    timestamp: now,
                    TTL: 15000
                };
                return result.data;
            }
        }
    } catch (error) {
        console.warn('获取推算换乘班次信息失败:', error);
    }

    return null;
}

// 获取班次时间信息
async function fetchTripTimes(startCode, endCode, forceRefresh = false) {
    const now = Date.now();
    
    // 检查缓存是否有效（强制刷新时跳过）
    if (!forceRefresh &&
        tripTimesCache.data && 
        tripTimesCache.startCode === startCode && 
        tripTimesCache.endCode === endCode && 
        (now - tripTimesCache.timestamp) < tripTimesCache.TTL) {
        return tripTimesCache.data;
    }
    
    try {
        const response = await fetchWithRetry(`./api/timetable/recent-trips?start=${startCode}&end=${endCode}&lang=${lang}`);
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                // 更新缓存
                tripTimesCache = {
                    data: result.data,
                    startCode,
                    endCode,
                    timestamp: now,
                    TTL: 30000
                };
                return result.data;
            }
        }
    } catch (error) {
        console.warn('获取班次时间信息失败:', error);
    }
    
    return null;
}

// 获取多段换乘路线的班次信息
async function fetchMultiSegmentTrips(segments, forceRefresh = false) {
    const now = Date.now();
    
    // 生成缓存 key
    const cacheKey = segments.map(s => `${s.lineId}:${s.startCode}:${s.endCode}`).join('|');
    
    // 检查缓存是否有效（强制刷新时跳过）
    if (!forceRefresh &&
        multiSegmentCache.data && 
        multiSegmentCache.key === cacheKey && 
        (now - multiSegmentCache.timestamp) < multiSegmentCache.TTL) {
        return multiSegmentCache.data;
    }
    
    try {
        const response = await fetchWithRetry('./api/timetable/multi-segment-trips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ segments, lang })
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                // 更新缓存
                multiSegmentCache = {
                    data: result.data,
                    key: cacheKey,
                    timestamp: now,
                    TTL: 30000
                };
                return result.data;
            }
        }
    } catch (error) {
        console.warn('获取多段换乘班次信息失败:', error);
    }
    
    return null;
}

// 格式化时间显示
function formatTime(isoString) {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// 处理桌面版搜索
function handleSearch(sortBy = 'time') {
    const startStation = document.getElementById('startInput').value.trim();
    const endStation = document.getElementById('endInput').value.trim();

    if (!startStation || !endStation) {
        showToast(strings.ticket_calculator.please_input_start_and_end[lang] || '请输入起点站和终点站');
        handleWindowResize();
        return;
    }

    // 解析输入的站点名称和代码
    const startStationCode = parseStationInput(startStation);
    const endStationCode = parseStationInput(endStation);
    recordLastVisitedPage(`?start=${startStationCode}&end=${endStationCode}&sort=${sortBy}`);

    if (!startStationCode) {
        showToast(strings.ticket_calculator.invalid_start_station[lang] || '起点站无效');
        return;
    }

    if (!endStationCode) {
        showToast(strings.ticket_calculator.invalid_end_station[lang] || '终点站无效');
        return;
    }

    const routes = findShortestRoutes(startStationCode, endStationCode);
    
    // 根据sortBy参数对路线进行排序
    sortRoutes(routes, sortBy);
    
    //console.log(routes);
    const resultsContainer = document.querySelector('.search-result');
    renderSearchResults(routes, resultsContainer);
    handleWindowResize();
    
    // 异步获取班次时间信息
    // 1. 单线直达查询（原有逻辑）
    fetchTripTimes(startStationCode, endStationCode).then(tripTimes => {
        if (tripTimes && tripTimes.available === false) {
            // 时刻表不可用，显示提示
            showTimetableUnavailable(tripTimes.reason);
            return;
        }
        if (tripTimes && tripTimes.trips && tripTimes.trips.length > 0) {
            updateTripTimesDisplay(tripTimes.trips);

            // 按线路匹配班次到各路线
            updateRoutesWithTripTimes(routes, tripTimes.trips);

            // 如果是按出发早或到达早排序，先重新排序
            if (sortBy === 'departure_early' || sortBy === 'arrival_early') {
                sortRoutes(routes, sortBy);
            }

            // 重新渲染以显示各路线的班次信息
            renderSearchResults(routes, resultsContainer);
        }
    });

    // 2. 多段换乘查询（原有逻辑）
    routes.forEach((route, routeIndex) => {
        if (!route.segments || route.segments.length <= 1) return;
        
        // 构建分段查询参数
        const segments = route.segments.map(seg => ({
            lineId: seg.line,
            startCode: seg.stations[0],
            endCode: seg.stations[seg.stations.length - 1]
        }));
        
        fetchMultiSegmentTrips(segments).then(multiResult => {
            if (multiResult) {
                route.multiSegmentTrips = multiResult;
                
                // 更新路线时间：出发时间取第一个有数据的段，到达时间取最后一个有数据的段
                // 始终覆盖，因为单段回调可能为多段行程设置了错误的时间（matchingTrips 混合了所有段的班次）
                if (multiResult.segments && multiResult.segments.length > 0) {
                    // 找到第一个有班次数据的段
                    const firstAvailableIdx = multiResult.segments.findIndex(s => s.available && s.trips.length > 0);
                    if (firstAvailableIdx >= 0) {
                        let departureTime = new Date(multiResult.segments[firstAvailableIdx].trips[0].departureTime).getTime();
                        // 如果第一个有数据的段不是第一段，减去前面段的 duration 和换乘时间
                        for (let i = 0; i < firstAvailableIdx; i++) {
                            departureTime -= (route.segments[i].duration || 0) * 1000;
                            departureTime -= 120 * 1000; // 换乘时间
                        }
                        route.earliestDeparture = departureTime;
                    }
                    // 找到最后一个有班次数据的段
                    const lastAvailableIdx = [...multiResult.segments].reverse().findIndex(s => s.available && s.trips.length > 0);
                    if (lastAvailableIdx >= 0) {
                        const actualLastIdx = multiResult.segments.length - 1 - lastAvailableIdx;
                        let arrivalTime = new Date(multiResult.segments[actualLastIdx].trips[multiResult.segments[actualLastIdx].trips.length - 1].arrivalTime).getTime();
                        // 如果最后一个有数据的段不是最后一段，加上后面段的 duration 和换乘时间
                        for (let i = actualLastIdx + 1; i < multiResult.segments.length; i++) {
                            arrivalTime += 120 * 1000; // 换乘时间
                            arrivalTime += (route.segments[i].duration || 0) * 1000;
                        }
                        route.earliestArrival = arrivalTime;
                    }
                    route.allSegmentsAvailable = multiResult.allAvailable;
                } else if (multiResult.overallDeparture && multiResult.overallArrival) {
                    route.earliestDeparture = new Date(multiResult.overallDeparture).getTime();
                    route.earliestArrival = new Date(multiResult.overallArrival).getTime();
                    route.allSegmentsAvailable = multiResult.allAvailable;
                }
                
                // 如果是按出发早或到达早排序，重新排序
                if (sortBy === 'departure_early' || sortBy === 'arrival_early') {
                    sortRoutes(routes, sortBy);
                }
                
                // 重新渲染
                renderSearchResults(routes, resultsContainer);
            }
        });
    });

    // 3. 基于推算时刻表查询（新逻辑：使用 trainSchedules 推算数据，含第二辆列车）
    // 3a. 单线直达
    fetchScheduledTrips(startStationCode, endStationCode).then(scheduledData => {
        if (scheduledData && scheduledData.available && scheduledData.trips.length > 0) {
            // 将推算数据合并到单线路线
            routes.forEach(route => {
                if (route.segments && route.segments.length > 1) return;

                const routeLineIds = route.segments ? route.segments.map(s => s.line) : [];
                const matchingScheduled = scheduledData.trips.filter(trip => {
                    // 后端已根据用户查询方向过滤班次，前端仅需匹配线路
                    return routeLineIds.includes(trip.lineId);
                });

                if (matchingScheduled.length > 0) {
                    route.scheduledTrips = matchingScheduled;
                    // 存储第二辆列车信息
                    const key = `${matchingScheduled[0].lineId}:${matchingScheduled[0].direction}`;
                    if (scheduledData.nextTrips && scheduledData.nextTrips[key]) {
                        route.scheduledNextTrip = scheduledData.nextTrips[key];
                    }
                    // 如果没有实时数据，使用推算数据更新出发/到达时间
                    if (!route.earliestDeparture || !route.earliestArrival) {
                        if (!route.earliestDeparture) {
                            route.earliestDeparture = new Date(matchingScheduled[0].departureTime).getTime();
                        }
                        if (!route.earliestArrival) {
                            route.earliestArrival = new Date(matchingScheduled[matchingScheduled.length - 1].arrivalTime).getTime();
                        }
                    }
                }
            });

            if (sortBy === 'departure_early' || sortBy === 'arrival_early') {
                sortRoutes(routes, sortBy);
            }
            renderSearchResults(routes, resultsContainer);
        }
    });

    // 3b. 多段换乘
    routes.forEach((route, routeIndex) => {
        if (!route.segments || route.segments.length <= 1) return;

        const segments = route.segments.map(seg => ({
            lineId: seg.line,
            startCode: seg.stations[0],
            endCode: seg.stations[seg.stations.length - 1]
        }));

        fetchScheduledMultiSegmentTrips(segments).then(scheduledMultiResult => {
            if (scheduledMultiResult) {
                route.scheduledMultiSegmentTrips = scheduledMultiResult;

                // 如果没有实时数据，使用推算数据：出发取第一个有数据的段，到达取最后一个有数据的段
                if (!route.earliestDeparture || !route.earliestArrival) {
                    if (scheduledMultiResult.segments && scheduledMultiResult.segments.length > 0) {
                        if (!route.earliestDeparture) {
                            const firstAvailableIdx = scheduledMultiResult.segments.findIndex(s => s.available && s.trips.length > 0);
                            if (firstAvailableIdx >= 0) {
                                let departureTime = new Date(scheduledMultiResult.segments[firstAvailableIdx].trips[0].departureTime).getTime();
                                for (let i = 0; i < firstAvailableIdx; i++) {
                                    departureTime -= (route.segments[i].duration || 0) * 1000;
                                    departureTime -= 120 * 1000;
                                }
                                route.earliestDeparture = departureTime;
                            }
                        }
                        if (!route.earliestArrival) {
                            const lastAvailableIdx = [...scheduledMultiResult.segments].reverse().findIndex(s => s.available && s.trips.length > 0);
                            if (lastAvailableIdx >= 0) {
                                const actualLastIdx = scheduledMultiResult.segments.length - 1 - lastAvailableIdx;
                                let arrivalTime = new Date(scheduledMultiResult.segments[actualLastIdx].trips[scheduledMultiResult.segments[actualLastIdx].trips.length - 1].arrivalTime).getTime();
                                for (let i = actualLastIdx + 1; i < scheduledMultiResult.segments.length; i++) {
                                    arrivalTime += 120 * 1000;
                                    arrivalTime += (route.segments[i].duration || 0) * 1000;
                                }
                                route.earliestArrival = arrivalTime;
                            }
                        }
                    } else if (scheduledMultiResult.overallDeparture && scheduledMultiResult.overallArrival) {
                        if (!route.earliestDeparture) {
                            route.earliestDeparture = new Date(scheduledMultiResult.overallDeparture).getTime();
                        }
                        if (!route.earliestArrival) {
                            route.earliestArrival = new Date(scheduledMultiResult.overallArrival).getTime();
                        }
                    }
                }

                if (sortBy === 'departure_early' || sortBy === 'arrival_early') {
                    sortRoutes(routes, sortBy);
                }
                renderSearchResults(routes, resultsContainer);
            }
        });
    });

    // 启动自动刷新（等待初始数据加载完成后开始）
    stopAutoRefresh();
    setTimeout(() => {
        startAutoRefresh(routes, sortBy, startStationCode, endStationCode, resultsContainer);
    }, refreshState.interval);
}

// 更新路线的班次时间信息（按线路和方向匹配）
function updateRoutesWithTripTimes(routes, trips) {
    if (!trips || trips.length === 0 || !routes) return;

    // 获取用户查询的起终点站
    const startStation = document.getElementById('startInput').value.trim();
    const endStation = document.getElementById('endInput').value.trim();
    const startCode = startStation ? parseStationInput(startStation) : null;
    const endCode = endStation ? parseStationInput(endStation) : null;

    routes.forEach(route => {
        // 获取该路线涉及的所有线路ID
        const routeLineIds = route.segments ? route.segments.map(s => s.line) : [];

        // 筛选出匹配该路线的班次：同线路 + 同方向
        const matchingTrips = trips.filter(trip => {
            // 后端已根据用户查询方向过滤班次，前端仅需匹配线路
            return routeLineIds.includes(trip.lineId);
        });

        if (matchingTrips.length > 0) {
            route.tripCount = matchingTrips.length;
            route.matchingTrips = matchingTrips;
            
            // 仅对单段行程设置时间
            // 多段行程的时间由多段回调（fetchMultiSegmentTrips）正确设置
            // 避免 matchingTrips 混合多段班次导致出发时间取自非首段
            if (!route.segments || route.segments.length <= 1) {
                route.earliestDeparture = new Date(matchingTrips[0].departureTime).getTime();
                route.earliestArrival = new Date(matchingTrips[matchingTrips.length - 1].arrivalTime).getTime();
            }
        }
    });
}

// 解析车站输入，支持仅输入车站名称或三字码
function parseStationInput(input) {
    // 检查输入是否有效
    if (!input || typeof input !== 'string') {
        return null;
    }
    
    // 检查是否已加载线路数据
    if (!window.lines) {
        console.warn('线路数据尚未加载完成');
        return null;
    }

    // 如果输入的是三字码（全大写字母，长度为3）
    if (/^[A-Z]{3}$/i.test(input)) {
        const inputCode = input.toUpperCase();
        // 检查该三字码是否存在于线路数据中
        for (const line of window.lines) {
            for (const step of line.route) {
                if (step.type === 'station' && step.code === inputCode) {
                    return inputCode;
                }
            }
        }
        return null; // 未找到匹配的三字码
    }
    
    // 如果输入包含车站名称和三字码（用空格分隔）
    if (input.includes(' ')) {
        const parts = input.split(' ');
        if (parts.length > 1) {
            const code = parts[parts.length - 1].toUpperCase();
            // 验证三字码是否有效
            for (const line of window.lines) {
                for (const step of line.route) {
                    if (step.type === 'station' && step.code === code) {
                        return code;
                    }
                }
            }
        }
    }
    
    // 如果输入的是车站名称（中文或其他语言）
    // 获取当前语言设置
    var urlParams = new URLSearchParams(window.location.search);
    var currentLang = urlParams.get('lang');
    if (currentLang === null) {
        currentLang = 'zh_hans';
    }
    
    const inputLower = input.toLowerCase();
    
    for (const line of window.lines) {
        for (const step of line.route) {
            if (step.type === 'station') {
                const stationName = getStationName(step.code, currentLang);
                // 检查完全匹配
                if (stationName === input) {
                    return step.code;
                }
                // 检查小写匹配（不区分大小写）
                if (stationName.toLowerCase() === inputLower) {
                    return step.code;
                }
                
                // 对于中文，检查繁简体匹配
                if (currentLang.startsWith('zh')) {
                    // 确保strings已加载
                    if (window.strings && window.strings.station_names && window.strings.station_names[step.code]) {
                        // 检查所有中文翻译
                        const zhNames = [
                            window.strings.station_names[step.code]['zh_hans'],
                            window.strings.station_names[step.code]['zh_hant']
                        ];
                        
                        if (zhNames.some(name => name && (name === input || name.toLowerCase() === inputLower))) {
                            return step.code;
                        }
                    }
                }
            }
        }
    }
    
    return null; // 未找到匹配的车站
}

// 根据指定的排序方式对路线进行排序
function sortRoutes(routes, sortBy) {
    switch (sortBy) {
        case 'time':
            // 按时间从短到长排序（默认）
            routes.sort((a, b) => a.totalDuration - b.totalDuration);
            break;
        case 'transfer':
            // 按换乘次数从少到多排序
            routes.sort((a, b) => {
                // 首先按换乘次数排序
                const transferDiff = (a.segments.length - 1) - (b.segments.length - 1);
                if (transferDiff !== 0) {
                    return transferDiff;
                }
                // 换乘次数相同时按时间排序
                return a.totalDuration - b.totalDuration;
            });
            break;
        case 'price':
            // 按票价从低到高排序
            routes.sort((a, b) => {
                // 首先按票价排序
                const priceDiff = a.fare - b.fare;
                if (priceDiff !== 0) {
                    return priceDiff;
                }
                // 票价相同时按时间排序
                return a.totalDuration - b.totalDuration;
            });
            break;
        case 'departure_early':
            // 按出发时间从早到晚排序
            routes.sort((a, b) => {
                // 使用班次时间信息进行排序
                const aDeparture = a.earliestDeparture || Infinity;
                const bDeparture = b.earliestDeparture || Infinity;
                if (aDeparture !== bDeparture) {
                    return aDeparture - bDeparture;
                }
                // 出发时间相同时按总用时排序
                return a.totalDuration - b.totalDuration;
            });
            break;
        case 'arrival_early':
            // 按到达时间从早到晚排序
            routes.sort((a, b) => {
                // 使用班次时间信息进行排序
                const aArrival = a.earliestArrival || Infinity;
                const bArrival = b.earliestArrival || Infinity;
                if (aArrival !== bArrival) {
                    return aArrival - bArrival;
                }
                // 到达时间相同时按总用时排序
                return a.totalDuration - b.totalDuration;
            });
            break;
        default:
            // 默认按时间排序
            routes.sort((a, b) => a.totalDuration - b.totalDuration);
            break;
    }
}

// 使用Dijkstra算法查找最短路径
function findShortestRoutes(startCode, endCode) {
    // 构建图（含所有线路）
    const graphWithAll = buildGraph(false);
    
    // 使用Dijkstra算法计算最短路径（含所有线路）
    const timesWithAll = {};
    const previousWithAll = {};
    const visitedWithAll = {};
    const queueWithAll = [];
    
    // 初始化时间
    Object.keys(graphWithAll).forEach(station => {
        timesWithAll[station] = station === startCode ? 0 : Infinity;
        previousWithAll[station] = [];
        visitedWithAll[station] = false;
        queueWithAll.push(station);
    });
    
    while (queueWithAll.length > 0) {
        // 找到未访问的最短时间节点
        let minTime = Infinity;
        let minStation = null;
        
        for (const station of queueWithAll) {
            if (!visitedWithAll[station] && timesWithAll[station] < minTime) {
                minTime = timesWithAll[station];
                minStation = station;
            }
        }
        
        if (minStation === null) break;
        
        visitedWithAll[minStation] = true;
        queueWithAll.splice(queueWithAll.indexOf(minStation), 1);
        
        // 更新相邻节点的时间
        if (graphWithAll[minStation]) {
            Object.keys(graphWithAll[minStation]).forEach(neighbor => {
                if (!visitedWithAll[neighbor]) {
                    graphWithAll[minStation][neighbor].forEach(edge => {
                        const newTime = timesWithAll[minStation] + edge.duration + 30;
                        
                        if (newTime < timesWithAll[neighbor]) {
                            timesWithAll[neighbor] = newTime;
                            previousWithAll[neighbor] = [{
                                station: minStation,
                                line: edge.line,
                                distance: edge.distance,
                                duration: edge.duration
                            }];
                        } else if (Math.abs(newTime - timesWithAll[neighbor]) < 1e-6) {
                            previousWithAll[neighbor].push({
                                station: minStation,
                                line: edge.line,
                                distance: edge.distance,
                                duration: edge.duration
                            });
                        }
                    });
                }
            });
        }
    }
    
    // 重构所有路径（含所有线路）
    const allRoutes = [];
    const paths = buildAllPaths(previousWithAll, startCode, endCode);
    
    paths.forEach(path => {
        const formattedPath = formatPath(path.path, false, graphWithAll, path.lineInfo);
        if (formattedPath) {
            formattedPath.totalDuration = path.time;
            allRoutes.push(formattedPath);
        }
    });
    
    // 如果起点站有多于一条线路，则在寻路时找出从每条线路出发的路径
    const startStationLines = getStationLines(startCode);
    if (startStationLines.length > 1) {
        for (const lineInfo of startStationLines) {
            const routesFromLine = findRoutesFromStartLine(startCode, endCode, lineInfo, graphWithAll, false);
            routesFromLine.forEach(route => {
                const isDuplicate = allRoutes.some(existingRoute => 
                    existingRoute.path.join('-') === route.path.join('-') && 
                    Math.abs(existingRoute.totalDuration - route.totalDuration) < 1e-6
                );
                if (!isDuplicate) allRoutes.push(route);
            });
        }
    }
    
    // 计算每条路线的用时
    allRoutes.forEach(route => {
        route.totalDuration = calculateRouteDuration(route);
    });
    
    // 按用时排序所有路线
    allRoutes.sort((a, b) => a.totalDuration - b.totalDuration);
    
    // 找到计费基准路线（总时间最短且换乘次数最少的不使用GX线路的路线）
    let billingRoute = null;
    
    // 构建图（不含GX开头的线路）
    const graphWithoutGX = buildGraph(true);
    
    // 使用Dijkstra算法计算最短路径（不含GX开头的线路）
    const timesWithoutGX = {};
    const previousWithoutGX = {};
    const visitedWithoutGX = {};
    const queueWithoutGX = [];
    
    Object.keys(graphWithoutGX).forEach(station => {
        timesWithoutGX[station] = station === startCode ? 0 : Infinity;
        previousWithoutGX[station] = [];
        visitedWithoutGX[station] = false;
        queueWithoutGX.push(station);
    });
    
    while (queueWithoutGX.length > 0) {
        let minTime = Infinity;
        let minStation = null;
        
        for (const station of queueWithoutGX) {
            if (!visitedWithoutGX[station] && timesWithoutGX[station] < minTime) {
                minTime = timesWithoutGX[station];
                minStation = station;
            }
        }
        
        if (minStation === null) break;
        
        visitedWithoutGX[minStation] = true;
        queueWithoutGX.splice(queueWithoutGX.indexOf(minStation), 1);
        
        if (graphWithoutGX[minStation]) {
            Object.keys(graphWithoutGX[minStation]).forEach(neighbor => {
                if (!visitedWithoutGX[neighbor]) {
                    graphWithoutGX[minStation][neighbor].forEach(edge => {
                        const newTime = timesWithoutGX[minStation] + edge.duration + 30;
                        
                        if (newTime < timesWithoutGX[neighbor]) {
                            timesWithoutGX[neighbor] = newTime;
                            previousWithoutGX[neighbor] = [{
                                station: minStation,
                                line: edge.line,
                                distance: edge.distance,
                                duration: edge.duration
                            }];
                        } else if (Math.abs(newTime - timesWithoutGX[neighbor]) < 1e-6) {
                            previousWithoutGX[neighbor].push({
                                station: minStation,
                                line: edge.line,
                                distance: edge.distance,
                                duration: edge.duration
                            });
                        }
                    });
                }
            });
        }
    }
    
    // 重构路径（不含GX开头的线路）
    const routesWithoutGX = [];
    const pathsWithoutGX = buildAllPaths(previousWithoutGX, startCode, endCode);
    
    pathsWithoutGX.forEach(path => {
        const formattedPath = formatPath(path.path, true, graphWithoutGX, path.lineInfo);
        if (formattedPath) {
            formattedPath.totalDuration = path.time;
            routesWithoutGX.push(formattedPath);
        }
    });
    
    // 如果起点站有多于一条线路，则在寻路时找出从每条线路出发的路径（不含GX线路）
    const startStationLinesWithoutGX = getStationLines(startCode, true);
    if (startStationLinesWithoutGX.length > 1) {
        for (const lineInfo of startStationLinesWithoutGX) {
            const routesFromLine = findRoutesFromStartLine(startCode, endCode, lineInfo, graphWithoutGX, true);
            routesFromLine.forEach(route => {
                const isDuplicate = routesWithoutGX.some(existingRoute => 
                    existingRoute.path.join('-') === route.path.join('-') && 
                    Math.abs(existingRoute.totalDuration - route.totalDuration) < 1e-6
                );
                if (!isDuplicate) routesWithoutGX.push(route);
            });
        }
    }
    
    // 从不含GX线路的路线中找到计费基准路线
    if (routesWithoutGX.length > 0) {
        routesWithoutGX.forEach(route => {
            route.totalDuration = calculateRouteDuration(route);
        });
        
        routesWithoutGX.sort((a, b) => {
            if (a.totalDuration !== b.totalDuration) return a.totalDuration - b.totalDuration;
            return a.segments.length - b.segments.length;
        });
        billingRoute = routesWithoutGX[0];
    }
    
    // 确保计费基准路线也在结果中
    if (billingRoute && !allRoutes.includes(billingRoute)) {
        billingRoute.totalDuration = calculateRouteDuration(billingRoute);
        billingRoute.fare = calculateFare(billingRoute.totalDistance);
        allRoutes.push(billingRoute);
    }
    
    // 为所有路线计算票价
    allRoutes.forEach(route => {
        if (billingRoute) {
            route.fare = calculateFareWithBillingRoute(route, billingRoute);
        } else {
            route.fare = calculateFare(route.totalDistance);
        }
        route.basicFare = billingRoute ? billingRoute.fare : calculateFare(route.totalDistance);
    });
    
    // 去重处理
    const uniqueRoutes = [];
    const routeSignatures = new Set();

    allRoutes.forEach(route => {
        let signature = route.path.join('-');
        const hasGXLine = route.segments.some(segment => segment.line.startsWith('GX'));
        if (hasGXLine) signature += '-with-GX';

        if (!routeSignatures.has(signature)) {
            routeSignatures.add(signature);
            uniqueRoutes.push(route);
        }
    });

    // 排序并限制数量
    uniqueRoutes.sort((a, b) => a.totalDuration - b.totalDuration);
    return uniqueRoutes.slice(0, 20);
}

// 构建图
function buildGraph(excludeGXLines) {
    const graph = {};
    
    // 根据参数决定是否排除GX开头的线路
    let validLines = window.lines;
    if (excludeGXLines) {
        validLines = window.lines.filter(line => !line.id.startsWith("GX") && !line.id.match('-R'));
    }
    
    validLines.forEach(line => {
        // 获取线路中的所有车站
        const stations = [];
        line.route.forEach((step, index) => {
            if (step.type === 'station') {
                stations.push({
                    code: step.code,
                    name: step.name,
                    index: index
                });
            }
        });
        
        // 连接相邻车站
        for (let i = 0; i < stations.length - 1; i++) {
            const fromStation = stations[i];
            const toStation = stations[i + 1];
            
            // 计算两站之间的距离和用时
            const { distance, duration } = calculateSegmentDistanceAndDuration(line, fromStation.index, toStation.index);
            
            // 添加到图中
            if (!graph[fromStation.code]) {
                graph[fromStation.code] = {};
            }
            if (!graph[toStation.code]) {
                graph[toStation.code] = {};
            }
            
            // 由于是无向图，需要添加两个方向的边
            // 支持两站之间的多条线路
            if (!graph[fromStation.code][toStation.code]) {
                graph[fromStation.code][toStation.code] = [];
            }
            
            // 检查是否已存在相同线路的连接
            const existingEdgeIndex = graph[fromStation.code][toStation.code].findIndex(edge => edge.line === line.id);
            if (existingEdgeIndex === -1) {
                // 如果不存在相同线路的连接，则添加新边
                graph[fromStation.code][toStation.code].push({
                    line: line.id,
                    distance: distance,
                    duration: duration
                });
            } else {
                // 如果已存在相同线路的连接，更新距离和用时（取较小值）
                const existingEdge = graph[fromStation.code][toStation.code][existingEdgeIndex];
                if (distance < existingEdge.distance) {
                    existingEdge.distance = distance;
                    existingEdge.duration = duration;
                }
            }
            
            if (!graph[toStation.code][fromStation.code]) {
                graph[toStation.code][fromStation.code] = [];
            }
            
            // 对反向边执行相同操作
            const existingReverseEdgeIndex = graph[toStation.code][fromStation.code].findIndex(edge => edge.line === line.id);
            if (existingReverseEdgeIndex === -1) {
                graph[toStation.code][fromStation.code].push({
                    line: line.id,
                    distance: distance,
                    duration: duration
                });
            } else {
                const existingReverseEdge = graph[toStation.code][fromStation.code][existingReverseEdgeIndex];
                if (distance < existingReverseEdge.distance) {
                    existingReverseEdge.distance = distance;
                    existingReverseEdge.duration = duration;
                }
            }
        }
    });
    
    return graph;
}

// 计算线路段距离和用时
function calculateSegmentDistanceAndDuration(line, fromIndex, toIndex) {
    let totalDistance = 0;
    let totalDuration = 0;
    
    // 确保fromIndex小于toIndex
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    
    for (let i = start; i < end; i++) {
        const step = line.route[i];
        if (step.type === 'track') {
            totalDuration += step.duration;
            // 计算轨道段的距离
            for (let j = 0; j < step.nodes.length - 1; j++) {
                const node1 = step.nodes[j];
                const node2 = step.nodes[j + 1];
                totalDistance += Math.sqrt(
                    Math.pow(node2.x - node1.x, 2) + 
                    Math.pow(node2.z - node1.z, 2)
                );
            }
        }
    }
    
    return { distance: totalDistance, duration: totalDuration };
}

// 构建所有可能的路径（兼容旧的 previous[station]=[array] 格式）
// 返回值中 path 为站点代码数组，lineInfo 为与 path 中相邻站点对一一对应的线路ID数组
function buildAllPaths(previous, startCode, endCode) {
    const paths = [];
    
    function dfs(station, path, time, lineInfos) {
        // 如果已经到达起点
        if (station === startCode) {
            paths.push({
                path: [...path, startCode].reverse(),
                time: time,
                lineInfo: [...lineInfos].reverse()
            });
            return;
        }
        
        const prev = previous[station];
        if (!prev || prev.length === 0) return;
        
        // 遍历所有前驱节点，记录每条边使用的线路
        prev.forEach(p => {
            const newTime = time + p.duration + 30; // 30秒站点停留时间
            dfs(p.station, [...path, station], newTime, [...lineInfos, p.line]);
        });
    }
    
    dfs(endCode, [], 0, []);
    return paths;
}

// 从新的状态扩展 previous 数据中构建所有路径
// previous 格式: previous["station:line"] = { station, line, distance, duration }
function buildAllPathsWithTransfer(previous, times, startCode, endCode) {
    const paths = [];
    
    // 找到终点站的所有状态（可能通过不同线路到达）
    const endStates = Object.keys(previous).filter(key => key.startsWith(endCode + ':'));
    
    for (const endStateKey of endStates) {
        const path = [];
        let currentStateKey = endStateKey;
        let totalTime = times[endStateKey] || 0;
        
        // 回溯路径
        while (currentStateKey && previous[currentStateKey]) {
            const prev = previous[currentStateKey];
            const currentStation = currentStateKey.split(':')[0];
            path.push(currentStation);
            currentStateKey = `${prev.station}:${prev.line}`;
        }
        
        // 添加起点
        const startStation = currentStateKey ? currentStateKey.split(':')[0] : startCode;
        if (startStation === startCode) {
            path.push(startCode);
            path.reverse();
            
            // 检查是否已存在相同路径
            const pathKey = path.join('-');
            const isDuplicate = paths.some(p => p.path.join('-') === pathKey);
            
            if (!isDuplicate) {
                paths.push({
                    path: path,
                    time: totalTime
                });
            }
        }
    }
    
    return paths;
}

// 格式化路径
// lineInfo: 与 path 中相邻站点对一一对应的线路ID数组（由 buildAllPaths 提供）
function formatPath(path, excludeGXLines, graph, lineInfo) {
    if (path.length < 2) return null;
    
    // 根据参数决定是否排除GX开头的线路
    let validLines = window.lines;
    if (excludeGXLines) {
        validLines = window.lines.filter(line => !line.id.startsWith("GX"));
    }
    
    const segments = [];
    let currentSegment = {
        line: null,
        stations: [],
        distance: 0,
        duration: 0
    };
    
    for (let i = 0; i < path.length - 1; i++) {
        const from = path[i];
        const to = path[i + 1];
        // 从 Dijkstra 计算的最短路径中获取该段实际使用的线路ID
        const expectedLineId = lineInfo && lineInfo[i] ? lineInfo[i] : null;
        
        // 查找连接这两站的线路
        let foundLines = []; // 修改：支持多条线路
        let segmentDistance = 0;
        let segmentDuration = 0;
        
        // 如果有图信息，优先使用图中的边信息
        if (graph && graph[from] && graph[from][to]) {
            // 从图中获取所有可能的线路
            graph[from][to].forEach(edge => {
                const line = validLines.find(l => l.id === edge.line);
                if (line) {
                    foundLines.push({
                        line: line,
                        edge: edge
                    });
                }
            });
        } else {
            // 如果没有图信息，使用原来的方法查找线路
            for (const line of validLines) {
                const stationCodes = line.route
                    .filter(step => step.type === 'station')
                    .map(step => step.code);
                    
                if (stationCodes.includes(from) && stationCodes.includes(to)) {
                    // 检查这两个站是否相邻
                    const fromIndex = stationCodes.indexOf(from);
                    const toIndex = stationCodes.indexOf(to);
                    
                    if (Math.abs(fromIndex - toIndex) === 1) {
                        foundLines.push({
                            line: line,
                            edge: null
                        });
                    }
                }
            }
        }
        
        // 选择合适的线路：优先使用 Dijkstra 计算路径中的实际线路
        let foundInfo = null;
        let foundLine = null;
        
        if (foundLines.length > 0) {
            // 1. 最高优先级：使用路径计算时确定的线路（确保线路选择与最短路径一致）
            if (expectedLineId) {
                foundInfo = foundLines.find(info => info.line.id === expectedLineId);
            }
            // 2. 次优先级：与当前段同一线路（保持连续性）
            if (!foundInfo && currentSegment.line) {
                foundInfo = foundLines.find(info => info.line.id === currentSegment.line);
            }
            // 3. 兜底：选择第一条可用线路
            if (!foundInfo) {
                foundInfo = foundLines[0];
            }
            
            foundLine = foundInfo.line;
        }
        
        if (foundLine) {
            let result;
            if (foundInfo.edge) {
                // 如果有图中的边信息，直接使用
                result = {
                    distance: foundInfo.edge.distance,
                    duration: foundInfo.edge.duration
                };
            } else {
                // 否则重新计算
                result = calculateSegmentDistanceAndDuration(foundLine, 
                    foundLine.route.findIndex(step => step.type === 'station' && step.code === from),
                    foundLine.route.findIndex(step => step.type === 'station' && step.code === to));
            }
            
            segmentDistance = result.distance;
            segmentDuration = result.duration;
            
            if (currentSegment.line === null) {
                currentSegment.line = foundLine.id;
                currentSegment.stations.push(from);
                currentSegment.stations.push(to);
                currentSegment.distance = segmentDistance;
                currentSegment.duration = segmentDuration;
            } else if (currentSegment.line === foundLine.id) {
                // 同一条线路，添加到当前段
                if (!currentSegment.stations.includes(to)) {
                    currentSegment.stations.push(to);
                }
                currentSegment.distance += segmentDistance;
                currentSegment.duration += segmentDuration;
            } else {
                // 线路变化，保存当前段并开始新段
                segments.push({ ...currentSegment });
                currentSegment = {
                    line: foundLine.id,
                    stations: [from, to],
                    distance: segmentDistance,
                    duration: segmentDuration
                };
            }
        }
    }
    
    // 添加最后一段
    if (currentSegment.line !== null) {
        segments.push(currentSegment);
    }
    
    // 计算总距离
    const totalDistance = segments.reduce((sum, segment) => sum + segment.distance, 0);
    
    return {
        segments: segments,
        totalDistance: totalDistance,
        stationCount: path.length,
        path: path
    };
}

function getStationLines (stationCode) {
    return window.lines.filter(line => line.route.some(step => step.type === 'station' && step.code === stationCode));
}

// 从特定线路开始寻路
function findRoutesFromStartLine(startCode, endCode, startLineInfo, graph, excludeGXLines) {
    const times = {};
    const previous = {};
    const visited = {};
    const queue = [];
    
    // 初始化时间
    Object.keys(graph).forEach(station => {
        times[station] = station === startCode ? 0 : Infinity;
        previous[station] = [];
        visited[station] = false;
        queue.push(station);
    });
    
    // 使用Dijkstra算法计算最短路径
    while (queue.length > 0) {
        // 找到未访问的最短时间节点
        let minTime = Infinity;
        let minStation = null;
        
        for (const station of queue) {
            if (!visited[station] && times[station] < minTime) {
                minTime = times[station];
                minStation = station;
            }
        }
        
        if (minStation === null) {
            break;
        }
        
        visited[minStation] = true;
        queue.splice(queue.indexOf(minStation), 1);
        
        // 更新相邻节点的时间
        if (graph[minStation]) {
            Object.keys(graph[minStation]).forEach(neighbor => {
                if (!visited[neighbor]) {
                    graph[minStation][neighbor].forEach(edge => {
                        // 计算换乘时间
                        let transferTime = 0;
                        let waitingTime = 0;
                        
                        // 计算换乘时间
                        if (previous[minStation].length > 0) {
                            // 检查是否需要换乘（线路不同）
                            const lastEdge = previous[minStation][previous[minStation].length - 1];
                            if (lastEdge && lastEdge.line !== edge.line) {
                                transferTime = 180; // 3分钟换乘时间（根据规范）
                            }
                        } else if (minStation === startCode && edge.line !== startLineInfo.lineId) {
                            // 如果是从起点站出发且线路不同，也需要换乘时间
                            transferTime = 180; // 3分钟换乘时间
                        }
                        
                        const newTime = times[minStation] + edge.duration + 30 + transferTime + waitingTime; // 30秒站点停留时间
                        
                        // 如果找到更短的时间，更新时间并记录路径
                        if (newTime < times[neighbor]) {
                            times[neighbor] = newTime;
                            previous[neighbor] = [{
                                station: minStation,
                                line: edge.line,
                                distance: edge.distance,
                                duration: edge.duration
                            }];
                        } 
                        // 如果时间相等，也记录这个路径选项（添加到现有路径中）
                        else if (Math.abs(newTime - times[neighbor]) < 1e-6) {
                            previous[neighbor].push({
                                station: minStation,
                                line: edge.line,
                                distance: edge.distance,
                                duration: edge.duration
                            });
                        }
                        // 即使不是最短路径，我们也记录这个可能的路径（扩展搜索范围）
                        else {
                            // 添加非最优但有效的路径
                            previous[neighbor].push({
                                station: minStation,
                                line: edge.line,
                                distance: edge.distance,
                                duration: edge.duration
                            });
                        }
                    });
                }
            });
        }
    }
    
    // 重构路径
    const routes = [];
    const paths = buildAllPaths(previous, startCode, endCode);
    
    paths.forEach(path => {
        const formattedPath = formatPath(path.path, excludeGXLines, graph, path.lineInfo);
        if (formattedPath) {
            formattedPath.totalDuration = path.time;
            routes.push(formattedPath);
        }
    });
    
    return routes;
}

// 计算路线总用时（包括行驶时间和停站时间）
function calculateRouteDuration(route) {
    // 行驶时间总和
    let travelTime = 0;
    // 停站时间（每站30秒）
    let stopTime = (route.stationCount - 1) * 30;
    // 换乘时间（每次换乘2分钟）
    let transferTime = (route.segments.length - 1) * 120;
    
    route.segments.forEach((segment,index) => {
        segment.duration += (segment.stations.length - 2) * 30
        travelTime += segment.duration;
        if (
            index > 0 && (
                segment.line.startsWith(route.segments[index - 1].line) ||
                route.segments[index-1].line.startsWith(segment.line)
            )
        ) transferTime += 120;
    });
    
    return travelTime + transferTime;
}

// 计算票价（基于计费基准路线）
function calculateFareWithBillingRoute(route, billingRoute) {
    // 检查路线是否包含GX开头的线路
    const hasGXLine = route.segments.some(segment => segment.line.startsWith("GX"));
    
    // 只有包含GX线路的路线才加收加快费
    if (hasGXLine && billingRoute) {
        // 新规则：普通线路部分不管走多远价格都和计费基准路线的价格一样
        // 只对GX线路部分收取额外费用
        
        // 计算GX线路段的总距离
        let gxDistance = 0;
        route.segments.forEach(segment => {
            if (segment.line.startsWith("GX")) {
                gxDistance += segment.distance;
            }
        });
        
        // 基准票价加上GX线路部分的费用
        const baseFare = calculateFare(billingRoute.totalDistance);
        
        // GX线路部分费用：超出3公里部分每公里收0.65元，超出15公里部分每公里收0.45元，不足1公里按1公里计算
        let gxExtraFare = 0;
        if (gxDistance >= 3000) {
            if (gxDistance <= 15000) gxExtraFare = Math.ceil((gxDistance - 3000) / 1000) * 0.65;
            else gxExtraFare = Math.ceil((gxDistance - 15000) / 1000) * 0.45 + 7.8; // 7.8元是3-15公里部分的费用
        }
        
        return baseFare + gxExtraFare;
    }
    
    // 其他情况（纯普通线路）直接使用计费基准路线的票价
    return calculateFare(billingRoute.totalDistance);
}

// 计算票价
function calculateFare(distance) {
    // 旧规则：2公里内（含2公里）执行起步价1.25元，超出2公里后每增加1公里加收0.75元，不足1公里按1公里计算
    // 旧规则：3公里内（含3公里）执行起步价3元，3-9公里每增加1.2公里加收1元，9-18公里每增加1.5公里加收1元，18公里以上每增加1.8公里加收1元，不足按相应公里数计算
    // 新规则：3公里内（含3公里）执行起步价3元，3-18公里每增加2.5公里加收1元，18-32公里每增加3.5公里加收1元，32公里以上每增加5公里加收1元，不足按相应公里数计算
    if (distance <= 3000) return 3;
    else if (distance <= 18000) return 3 + Math.ceil((distance - 3000) / 2500);
    else if (distance <= 32000) return 9 + Math.ceil((distance - 18000) / 3500);
    else return 13 + Math.ceil((distance - 32000) / 5000);
}

// 渲染搜索结果
function renderSearchResults(routes, container) {
    // 清空容器
    container.innerHTML = '';
    
    if (routes.length === 0) {
        container.innerHTML = `<div class="item no-route">${strings.ticket_calculator.no_routes_found[lang] || '未找到路线'}</div>`;
        return;
    }
    
    routes.forEach((route, index) => {
        const routeElement = document.createElement('div');
        routeElement.className = 'route-result';
        routeElement.classList.add('item');
        
        // 格式化用时显示
        const totalDuration = route.totalDuration;
        const hours = Math.floor(totalDuration / 3600);
        const minutes = Math.floor((totalDuration % 3600) / 60);
        let durationText = '';
        if (hours > 0) {
            durationText = hours + strings.ticket_calculator.hours[lang] + minutes + strings.ticket_calculator.min[lang];
        } else {
            durationText = minutes + strings.ticket_calculator.min[lang];
        }
        
        let routeHTML = `
            <div class="route-header">
                <div class="route-title"> 
                    <h3>${strings.ticket_calculator.route[lang] || '路线'} ${index + 1}: ${route.segments ? route.segments.map((segment, segIndex) => segment ? segment.line : '').join(' → ') : ''}</h3>
                    <span class="fare">¥<b>${(Math.floor(route.fare*20)/20).toFixed(2)}</b></span>
                </div>
                <div class="route-summary">
                    <span>${strings.ticket_calculator.total_distance[lang] || '总距离'}: ${(route.totalDistance / 1000).toFixed(1)+strings.ticket_calculator.km[lang]}</span>
                    <span>${strings.ticket_calculator.estimated_time[lang] || '预计用时'}: ${durationText}</span>
                    <span>${strings.ticket_calculator.station_count[lang] || '站点数'}: ${route.stationCount - 1}</span>
                </div>
            </div>
            <div class="route-details">
        `;

        // 跨段时间依赖：记录前一段到达时间，约束后续段出发时间
        let previousSegmentArrivalTime = null;

        route.segments.forEach((segment, segIndex) => {
            const line = window.lines.find(l => l.id === segment.line);
            const onStationIndex = line.route.findIndex(step => step.type === 'station' && step.code === route.segments[segIndex].stations[0]);
            const offStationIndex = line.route.findIndex(step => step.type === 'station' && step.code === route.segments[segIndex].stations[route.segments[segIndex].stations.length - 1]);
            const isUpwards = onStationIndex > offStationIndex;
            const terminal = isUpwards ? line.route[0].code : line.route[line.route.length - 1].code;
            const terminalAddr = strings.district_names_short[terminal[0]][lang];
            console.log(line,onStationIndex,offStationIndex);
            if (line) {
                // 如果是第一段，添加上车站信息
                if (segIndex === 0) {
                    routeHTML += `
                        <div class="transfer depart" data-station="${segment.stations[0]}">
                            <span>${!lang.includes('zh')?strings.ticket_calculator.depart_from[lang]:''}${getStationName(segment.stations[0],lang)}${lang.includes('zh')?strings.ticket_calculator.depart_from[lang]:''}</span>
                        </div>`
                }

                // 获取该段的班次信息（优先实时数据，补充推算数据）
                let tripInfoHTML = '';
                let allTrips = [];
                let dataSource = ''; // 'realtime' | 'scheduled' | 'mixed'

                // 1. 收集实时班次
                let realtimeTrips = [];
                if (route.multiSegmentTrips && route.multiSegmentTrips.segments && route.multiSegmentTrips.segments[segIndex]) {
                    const segTrips = route.multiSegmentTrips.segments[segIndex];
                    if (segTrips.available && segTrips.trips.length > 0) {
                        realtimeTrips = segTrips.trips;
                    }
                }
                if (realtimeTrips.length === 0 && route.matchingTrips && route.matchingTrips.length > 0 && route.segments.length === 1) {
                    realtimeTrips = route.matchingTrips;
                }

                // 2. 收集推算班次
                let scheduledTrips = [];
                if (route.scheduledMultiSegmentTrips && route.scheduledMultiSegmentTrips.segments && route.scheduledMultiSegmentTrips.segments[segIndex]) {
                    const schedSeg = route.scheduledMultiSegmentTrips.segments[segIndex];
                    if (schedSeg.available && schedSeg.trips.length > 0) {
                        scheduledTrips = schedSeg.trips;
                    }
                }
                if (scheduledTrips.length === 0 && route.scheduledTrips && route.scheduledTrips.length > 0 && route.segments.length === 1) {
                    scheduledTrips = route.scheduledTrips;
                }

                // 3. 智能合并：实时数据优先，不足时补充推算数据
                const realtimeNames = new Set(realtimeTrips.map(t => t.trainName));
                const mergedScheduled = scheduledTrips.filter(t => !realtimeNames.has(t.trainName));

                if (realtimeTrips.length > 0 && mergedScheduled.length > 0) {
                    // 合并：实时 + 不重复的推算班次
                    allTrips = [...realtimeTrips, ...mergedScheduled];
                    dataSource = 'mixed';
                } else if (realtimeTrips.length > 0) {
                    allTrips = realtimeTrips;
                    dataSource = 'realtime';
                } else if (scheduledTrips.length > 0) {
                    allTrips = scheduledTrips;
                    dataSource = 'scheduled';
                }

                // 按出发时间排序
                allTrips.sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));

                // 跨段时间校验：过滤掉出发时间早于前段到达时间的班次
                const tripsBeforeFilter = allTrips.length;
                if (segIndex > 0 && previousSegmentArrivalTime !== null && allTrips.length > 0) {
                    allTrips = allTrips.filter(t => new Date(t.departureTime).getTime() > previousSegmentArrivalTime);
                }

                // 记录本段第一班的到达时间，作为下段时间约束
                if (allTrips.length > 0) {
                    previousSegmentArrivalTime = new Date(allTrips[0].arrivalTime).getTime();
                }

                // 生成 HTML：显示所有匹配的列车（最多显示前12辆）
                const maxDisplayTrips = 12;
                const displayTrips = allTrips.slice(0, maxDisplayTrips);
                const showTimetableBtn = document.querySelector('.show-timetable-btn');
                const isTimetableVisible = showTimetableBtn && showTimetableBtn.classList.contains('active');

                if (displayTrips.length > 0) {
                    tripInfoHTML = `<div class="line-trip-list${isTimetableVisible ? '' : ' collapsed'}">`;
                    displayTrips.forEach((trip, tripIdx) => {
                        const depTime = formatTime(trip.departureTime);
                        const arrTime = formatTime(trip.arrivalTime);
                        const durMin = Math.ceil(trip.duration / 60);
                        const iconClass = tripIdx === 0 ? 'cast' : 'fast_forward';
                        const itemClass = tripIdx === 0 ? 'line-trip-info' : 'line-trip-info line-trip-next';
                        // 混合模式下仅对推算班次标注
                        const isScheduled = dataSource === 'scheduled' || (dataSource === 'mixed' && realtimeNames.has(trip.trainName) === false);
                        const schedTag = isScheduled ? ' ..' : '';
                        tripInfoHTML += `<span class="${itemClass}"><span class="material-symbols-outlined">${iconClass}</span> <b>${trip.trainName}</b>${schedTag} ${depTime} (${durMin}${strings.ticket_calculator.min?.[lang] || '分钟'})</span>`;
                    });
                    if (allTrips.length > maxDisplayTrips) {
                        tripInfoHTML += `<span class="line-trip-more">+${allTrips.length - maxDisplayTrips} ${strings.ticket_calculator.more_trips?.[lang] || '更多班次'}</span>`;
                    }
                    tripInfoHTML += '</div>';
                } else {
                    if (segIndex > 0 && tripsBeforeFilter > 0 && previousSegmentArrivalTime !== null) {
                        // 有班次数据但因时间衔接被过滤
                        const prevArrivalStr = formatTime(new Date(previousSegmentArrivalTime).toISOString());
                        tripInfoHTML = `<div class="line-trip-list${isTimetableVisible ? '' : ' collapsed'}"><span class="line-trip-info line-trip-unavailable"><span class="material-symbols-outlined">cast_warning</span> ${strings.ticket_calculator.no_valid_connection?.[lang]?.replace('{time}', prevArrivalStr) || `暂无晚于 ${prevArrivalStr} 出发的有效衔接班次`}</span></div>`;
                    } else {
                        tripInfoHTML = `<div class="line-trip-list${isTimetableVisible ? '' : ' collapsed'}"><span class="line-trip-info line-trip-unavailable"><span class="material-symbols-outlined">cast_warning</span> ${strings.ticket_calculator.no_timetable_for_segment?.[lang] || '该区间暂无时刻表数据'}</span></div>`;
                    }
                }

                routeHTML += `
                    <div class="segment collapsed">
                        <div class="line-info" style="
                            border-color: ${line.color};
                            border-left-style:${(line.id.match('-R'))?
                                'double':''}
                        ">
                            <div class="line-header">
                                <a class="line-name" 
                                    href="lines_info.html?line=${line.id.replace('-R', '')}"
                                    >${line.name[lang]}</a>
                                <span>${strings.ticket_calculator.to_[lang].replace(
                                    '{dir}',
                                    terminalAddr
                                )}</span>
                            </div>
                            ${tripInfoHTML}
                            <div class="line-meta">
                                <span>${strings.ticket_calculator.about_time[lang]}${Math.ceil(segment.duration / 60)}${strings.ticket_calculator.min[lang]}</span>
                                <span> (${segment.stations.length - 1}${segment.stations.length > 2 ? strings.ticket_calculator.stations[lang] : strings.ticket_calculator._station[lang]},</span>
                                <span>${(segment.distance/1000).toFixed(1)}${strings.ticket_calculator.km[lang]})</span>
                                <span class="material-symbols-outlined expand-btn">keyboard_arrow_down</span>
                            </div>
                        </div>
                        <div class="stations" style="border-color: ${line.color};border-left-style:${(line.id.match('-R'))?'double':''}">
                            <ul class="station-list" ${segment.stations.length < 3 ? 'style="display: none;"' : ''}>
                                <li data-station="${segment.stations[1]}">${segment.stations.slice(1, -1).map((station,index) => getStationName(station, lang) + `</li><li data-station="${segment.stations[index+2]}">`).join('')}</li>
                            </ul>
                        </div>
                    </div>
                `;
                
                // 如果不是最后一段，添加换乘提示
                if (segIndex < route.segments.length - 1) {
                    routeHTML += `
                        <div class="transfer" data-station="${segment.stations[segment.stations.length - 1]}">
                            <span>${!lang.includes('zh')?strings.ticket_calculator.transfer_at[lang]:''}${getStationName(segment.stations[segment.stations.length - 1],lang)}${lang.includes('zh')?strings.ticket_calculator.transfer_at[lang]:''}</span>
                        </div>
                    `;
                } else {
                    routeHTML += `
                        <div class="transfer arrive" data-station="${segment.stations[segment.stations.length - 1]}">
                            <span>${strings.ticket_calculator.arrive_at[lang] || '到达'} ${getStationName(segment.stations[segment.stations.length - 1],lang)}</span>
                        </div>`
                }
            }
        });
        
        routeHTML += `
            </div>
        </div>`;
        
        routeElement.innerHTML = routeHTML;

        const segments = routeElement.querySelectorAll('.segment');
        segments.forEach(segment => {
            segment.addEventListener('click', () => {
                const stationList = segment.querySelector('.station-list');
                if (stationList.style.display !== 'none') {
                    segment.classList.toggle('collapsed');
                }
            });
            segment.addEventListener('mouseenter', () => {
                const stationList = segment.querySelector('.station-list');
                if (stationList.style.display === 'none') {
                    const icon = segment.querySelector('.expand-btn');
                    icon.style.display = 'none';
                    segment.style.cursor = 'default';
                }
            });
            document.addEventListener('touchstart', () => {
                const icons = segment.querySelectorAll('.line-info .expand-btn');
                icons.forEach(icon => { 
                    const stationList = segment.querySelector('.station-list');
                    if (stationList.style.display !== 'none') {
                        icon.style.opacity = '1';
                        icon.style.filter = 'none';
                    }
                });
                const lineNames = segment.querySelectorAll('.line-name');
                lineNames.forEach(lineName => { 
                    lineName.style.textDecoration = 'underline';
                });
            });
        });

        const transfers = routeElement.querySelectorAll('.transfer, .station-list li');
        transfers.forEach(transfer => { 
            transfer.addEventListener('click', (e) => { 
                e.stopPropagation();
                const station = transfer.dataset.station;
                if (station) {
                    loadStationInfo(station);
                }
            });
            document.addEventListener('touchstart', () => { 
                const span = transfer.querySelectorAll('span');
                span.forEach(s => { 
                    s.style.textDecoration = 'underline';
                });
            });
        });

        const fareDetails = document.createElement('div');
        fareDetails.className = 'fare-details';

        const basicFare = route.basicFare;
        const secondClassFare = route.fare;
        const addition = secondClassFare - basicFare;
        const additionalDistance = route.segments.filter(segment => segment.line.startsWith('GX'))
            .map(segment => segment.distance)
            .reduce((sum, distance) => sum + distance, 0);
        let additionalDistanceText = '';
        if (additionalDistance > 15000) {
            additionalDistanceText = `¥0.65 × 12 + ¥0.45 × ${Math.ceil((additionalDistance/1000)-15)}`;
        } else if (additionalDistance > 3000) {
            additionalDistanceText = `¥0.65 × ${Math.ceil((additionalDistance/1000)-3)}`;
        }
        const firstClassFare = route.fare * 1.5;
        const premiumClassAddition = addition * 2;
        const premiumClassFare = Math.max(secondClassFare + premiumClassAddition, 29);
        const showFareDetailBtn = document.querySelector('.show-fare-detail-btn');
        const isFareDetailVisible = showFareDetailBtn && showFareDetailBtn.classList.contains('active');
        const fareDetailsHTML = `
        <div class="fare-detail-item second">
            <span class="fare-detail-title">${
                strings.ticket_calculator.second_class[lang] + ' / ' 
                + strings.ticket_calculator.no_seat_class[lang]  || '二等座/无座'
            }</span>
            <span class="fare-detail-title fare-detail-calc${isFareDetailVisible ? '' : ' collapsed'}">
                <span>${strings.ticket_calculator.basic_fare[lang]+' ('+(route.totalDistance / 1000).toFixed(1)+strings.ticket_calculator.km[lang]+')'}</span>
                <span>¥${(basicFare.toFixed(2))}</span>
            </span>
            <span class="fare-detail-title fare-detail-calc${isFareDetailVisible ? '' : ' collapsed'}" ${addition > 0 ? '' : 'style="display: none;"'}>
                <span>${strings.ticket_calculator.additional_fare[lang]+' ('+Math.ceil((additionalDistance/1000))+strings.ticket_calculator.km[lang]+')'}</span>
                <span>${(addition > 0 ? '¥'+addition.toFixed(2) : '')}</span>
            </span>
            <span class="fare-detail-value">¥<b>${(Math.floor(secondClassFare*20)/20).toFixed(2)}</b></span>
        </div>
        <div class="fare-detail-item first">
            <span class="fare-detail-title">${
                strings.ticket_calculator.first_class[lang] + ' (' 
                + strings.ticket_calculator.if_available[lang]  + ') ' || '一等座（如有）'
            }</span>
            <span class="fare-detail-title fare-detail-calc${isFareDetailVisible ? '' : ' collapsed'}">
                <span>${strings.ticket_calculator.basic_fare[lang]+' ('+(route.totalDistance / 1000).toFixed(1)+strings.ticket_calculator.km[lang]+')'}</span>
                <span>¥${basicFare.toFixed(2)}</span>
            </span>
            <span class="fare-detail-title fare-detail-calc${isFareDetailVisible ? '' : ' collapsed'}" ${addition > 0 ? '' : 'style="display: none;"'}>
                <span>${strings.ticket_calculator.additional_fare[lang]+' ('+Math.ceil((additionalDistance/1000))+strings.ticket_calculator.km[lang]+')'}</span>
                <span>¥${addition.toFixed(2)}</span>
            </span>
            <span class="fare-detail-title fare-detail-calc${isFareDetailVisible ? '' : ' collapsed'}">
                <span>${strings.ticket_calculator.first_class_addition[lang]}</span>
                <span>¥${((basicFare+addition)/2).toFixed(2)}</span>
            </span>
            <span class="fare-detail-title fare-detail-calc${isFareDetailVisible ? '' : ' collapsed'}" ${(firstClassFare*100).toFixed(0)%5!==0 ? '' : 'style="display: none;"'}>
                <span>${strings.ticket_calculator.price_rounding[lang]}</span>
                <span>-¥${(firstClassFare-Math.floor(firstClassFare*20)/20).toFixed(2)}</span>
            </span>
            <span class="fare-detail-value">¥<b>${(Math.floor(firstClassFare*20)/20).toFixed(2)}</b></span>
        </div>
        <div class="fare-detail-item premium"${route.segments.filter(segment => segment.line.startsWith('GX')).length > 0 ? '' : ' style="display: none;"'}>
            <span class="fare-detail-title">${
                strings.ticket_calculator.premium_class[lang] + ' (' 
                + strings.ticket_calculator.if_available[lang] + ') ' || '商务座（如有）'
            }</span>
            <span class="fare-detail-title fare-detail-calc${isFareDetailVisible ? '' : ' collapsed'}">
                <span>${strings.ticket_calculator.basic_fare[lang]+' ('+(route.totalDistance / 1000).toFixed(1)+strings.ticket_calculator.km[lang]+')'}</span>
                <span>${(addition > 0 ? '¥'+basicFare.toFixed(2) : '')}</span>
            </span>
            <span class="fare-detail-title fare-detail-calc${isFareDetailVisible ? '' : ' collapsed'}" ${addition > 0 ? '' : 'style="display: none;"'}>
                <span>${strings.ticket_calculator.additional_fare[lang]+' ('+Math.ceil((additionalDistance/1000))+strings.ticket_calculator.km[lang]+')'}</span>
                <span>${(addition > 0 ? '¥'+addition.toFixed(2) : '')}</span>
            </span>
            <span class="fare-detail-title fare-detail-calc${isFareDetailVisible ? '' : ' collapsed'}" ${addition > 0 ? '' : 'style="display: none;"'}>
                <span>${strings.ticket_calculator.premium_class_addition[lang]}</span>
                <span>¥${(premiumClassFare === 29 ? (29-secondClassFare) : (addition*2)).toFixed(2)}</span>
            </span>
            <span class="fare-detail-value">¥<b>${(Math.floor(premiumClassFare*20)/20).toFixed(2)}</b></span>
        </div>`;
        fareDetails.innerHTML = fareDetailsHTML;
        routeElement.appendChild(fareDetails);

        container.appendChild(routeElement);
        handleWindowResize();
    });
}

// 创建单个路线的最近班次信息元素
function createRouteTripInfo(trips) {
    if (!trips || trips.length === 0) return null;

    const container = document.createElement('div');
    container.className = 'route-trip-info';

    const displayTrips = trips.slice(0, 3);
    let html = `<div class="route-trip-header">
        <span class="material-symbols-outlined">schedule</span>
        <span>${strings.ticket_calculator.recent_trips?.[lang] || '最近班次'}</span>
    </div><div class="route-trip-list">`;

    displayTrips.forEach(trip => {
        const depTime = formatTime(trip.departureTime);
        const arrTime = formatTime(trip.arrivalTime);
        const durMin = Math.ceil(trip.duration / 60);

        let statusText = '';
        let statusClass = '';
        if (trip.status === 'running') {
            statusText = strings.ticket_calculator.running?.[lang] || '运行中';
            statusClass = 'running';
        } else if (trip.status === 'stopped') {
            statusText = strings.ticket_calculator.stopped?.[lang] || '已停靠';
            statusClass = 'stopped';
        } else {
            statusText = strings.ticket_calculator.approaching?.[lang] || '即将到达';
            statusClass = 'approaching';
        }

        // 方向信息
        const directionLabel = trip.directionLabel || '';

        html += `
        <div class="route-trip-item">
            <div class="route-trip-meta">
                <span class="route-trip-name">${trip.trainName}</span>
                <span class="route-trip-series">${trip.trainSeries || ''}</span>
                <span class="route-trip-line">${trip.lineName || ''}</span>
                ${directionLabel ? `<span class="route-trip-direction">${directionLabel}</span>` : ''}
                <span class="route-trip-status ${statusClass}">${statusText}</span>
            </div>
            <div class="route-trip-times">
                <span class="route-trip-dep">${strings.ticket_calculator.departure?.[lang] || '出发'} ${depTime}</span>
                <span class="route-trip-dur">${durMin}${strings.ticket_calculator.min?.[lang] || '分钟'}</span>
                <span class="route-trip-arr">${strings.ticket_calculator.arrival?.[lang] || '到达'} ${arrTime}</span>
            </div>
        </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
    return container;
}

// 创建多段换乘路线的班次信息元素
function createMultiSegmentTripInfo(multiResult) {
    if (!multiResult || !multiResult.segments || multiResult.segments.length === 0) return null;

    const container = document.createElement('div');
    container.className = 'route-trip-info multi-segment';

    let html = `<div class="route-trip-header">
        <span class="material-symbols-outlined">schedule</span>
        <span>${strings.ticket_calculator.recent_trips?.[lang] || '最近班次'}</span>
    </div>`;

    // 总体出发/到达时间
    if (multiResult.overallDeparture && multiResult.overallArrival) {
        const totalDep = formatTime(multiResult.overallDeparture);
        const totalArr = formatTime(multiResult.overallArrival);
        const totalDur = Math.round((new Date(multiResult.overallArrival) - new Date(multiResult.overallDeparture)) / 60000);
        html += `<div class="multi-seg-overall">
            <span class="multi-seg-overall-dep">${totalDep}</span>
            <span class="multi-seg-overall-arrow">→</span>
            <span class="multi-seg-overall-arr">${totalArr}</span>
            <span class="multi-seg-overall-dur">(${totalDur}${strings.ticket_calculator.min?.[lang] || '分钟'})</span>
        </div>`;
    }

    html += `<div class="multi-seg-segments">`;

    multiResult.segments.forEach((seg, segIdx) => {
        const line = window.lines ? window.lines.find(l => l.id === seg.lineId) : null;
        const lineColor = line ? line.color : '#999';

        html += `<div class="multi-seg-segment">`;

        // 换乘站提示（在第一段之前显示出发站）
        if (segIdx === 0) {
            html += `<div class="multi-seg-station depart">
                <span class="material-symbols-outlined">directions_walk</span>
                <span>${strings.ticket_calculator.depart_from?.[lang] || '从'}${seg.startStation}${strings.ticket_calculator.depart_from_zh?.[lang] || '出发'}</span>
            </div>`;
        }

        // 线路信息
        html += `<div class="multi-seg-line" style="border-left: 3px solid ${lineColor};">
            <span class="multi-seg-line-name" style="color: ${lineColor};">${seg.lineName}</span>
        `;

        if (seg.available && seg.trips.length > 0) {
            // 显示第一班车信息
            const trip = seg.trips[0];
            const depTime = formatTime(trip.departureTime);
            const arrTime = formatTime(trip.arrivalTime);
            const durMin = Math.ceil(trip.duration / 60);

            let statusText = '';
            let statusClass = '';
            if (trip.status === 'running') {
                statusText = strings.ticket_calculator.running?.[lang] || '运行中';
                statusClass = 'running';
            } else if (trip.status === 'stopped') {
                statusText = strings.ticket_calculator.stopped?.[lang] || '已停靠';
                statusClass = 'stopped';
            } else {
                statusText = strings.ticket_calculator.approaching?.[lang] || '即将到达';
                statusClass = 'approaching';
            }

            html += `<div class="multi-seg-trip">
                <span class="multi-seg-train">${trip.trainName}</span>
                <span class="multi-seg-series">${trip.trainSeries || ''}</span>
                <span class="multi-seg-status ${statusClass}">${statusText}</span>
                <span class="multi-seg-times">${depTime} → ${arrTime} (${durMin}${strings.ticket_calculator.min?.[lang] || '分钟'})</span>
            </div>`;

            // 如果有更多班次，显示可展开的列表
            if (seg.trips.length > 1) {
                html += `<div class="multi-seg-more" style="display:none;">`;
                seg.trips.slice(1).forEach(t => {
                    const tDep = formatTime(t.departureTime);
                    const tArr = formatTime(t.arrivalTime);
                    const tDur = Math.ceil(t.duration / 60);
                    html += `<div class="multi-seg-trip extra">
                        <span class="multi-seg-train">${t.trainName}</span>
                        <span class="multi-seg-series">${t.trainSeries || ''}</span>
                        <span class="multi-seg-times">${tDep} → ${tArr} (${tDur}${strings.ticket_calculator.min?.[lang] || '分钟'})</span>
                    </div>`;
                });
                html += `</div>`;
                html += `<div class="multi-seg-toggle" onclick="this.previousElementSibling.style.display=this.previousElementSibling.style.display==='none'?'block':'none';this.textContent=this.previousElementSibling.style.display==='none'?'${strings.ticket_calculator.show_more?.[lang] || '展开更多'}':'${strings.ticket_calculator.collapse?.[lang] || '收起'}';">${strings.ticket_calculator.show_more?.[lang] || '展开更多'}</div>`;
            }
        } else {
            // 没有找到班次，显示警告
            html += `<div class="multi-seg-unavailable">
                <span class="material-symbols-outlined">cast_warning</span> <span class="line-trip-info line-trip-unavailable">${strings.ticket_calculator.no_timetable_for_segment?.[lang] || '该区间暂无时刻表数据'}</span>
            </div>`;
        }

        html += `</div>`;

        // 换乘站提示
        if (segIdx < multiResult.segments.length - 1) {
            const nextSeg = multiResult.segments[segIdx + 1];
            html += `<div class="multi-seg-station transfer">
                <span class="material-symbols-outlined">transfer_within_a_station</span>
                <span>${strings.ticket_calculator.transfer_at?.[lang] || '换乘'}${seg.endStation}</span>
            </div>`;
        } else {
            html += `<div class="multi-seg-station arrive">
                <span class="material-symbols-outlined">location_on</span>
                <span>${strings.ticket_calculator.arrive_at?.[lang] || '到达'} ${seg.endStation}</span>
            </div>`;
        }

        html += `</div>`;
    });

    html += `</div>`;

    // 如果有不可用的段，显示整体提示
    if (!multiResult.allAvailable) {
        html += `<div class="multi-seg-warning">
            <span class="material-symbols-outlined">info</span>
            <span>${strings.ticket_calculator.partial_timetable?.[lang] || '部分区间暂无时刻表，显示时间可能不完整'}</span>
        </div>`;
    }

    container.innerHTML = html;
    return container;
}

// 显示时刻表不可用提示
function showTimetableUnavailable(reason) {
    // 禁用早出发和早到达排序按钮
    if (typeof setSortButtonsDisabled === 'function') {
        setSortButtonsDisabled(true);
    }
    
    // 如果当前使用的是早出发或早到达排序，切换到时间排序
    const activeSortButton = document.querySelector('.sort-selector .icon-btn.active');
    if (activeSortButton) {
        const isDisabledSort = activeSortButton.classList.contains('sort-by-departure-early') ||
                              activeSortButton.classList.contains('sort-by-arrival-early');
        if (isDisabledSort) {
            const timeSortBtn = document.querySelector('.sort-by-time');
            if (timeSortBtn) {
                setActiveSortButton(timeSortBtn);
                handleSearch('time');
            }
        }
    }
    
    let tripTimesContainer = document.querySelector('.trip-times-container');
    if (!tripTimesContainer) {
        tripTimesContainer = document.createElement('div');
        tripTimesContainer.className = 'trip-times-container';
        tripTimesContainer.classList.add('item');
        
        const searchResult = document.querySelector('.search-result');
        if (searchResult) {
            searchResult.insertBefore(tripTimesContainer, searchResult.firstChild);
        }
    }
    
    const reasonText = reason === 'no_trains' 
        ? (strings.ticket_calculator.timetable_no_trains?.[lang] || '当前无列车运行，时刻表不可用')
        : (strings.ticket_calculator.timetable_unavailable?.[lang] || '时刻表数据不可用');
    
    tripTimesContainer.innerHTML = `
        <div class="trip-times-header">
            <h3>${strings.ticket_calculator.recent_trips?.[lang] || '最近班次'}</h3>
        </div>
        <div class="trip-times-unavailable">
            <span class="material-symbols-outlined">cloud_off</span>
            <span>${reasonText}</span>
        </div>
    `;
}

// 更新班次时间信息显示
function updateTripTimesDisplay(trips) {
    // 启用早出发和早到达排序按钮
    if (typeof setSortButtonsDisabled === 'function') {
        setSortButtonsDisabled(false);
    }
    
    // 查找或创建班次信息容器
    let tripTimesContainer = document.querySelector('.trip-times-container');
    if (!tripTimesContainer) {
        tripTimesContainer = document.createElement('div');
        tripTimesContainer.className = 'trip-times-container';
        tripTimesContainer.classList.add('item');
        
        // 插入到搜索结果的最前面
        const searchResult = document.querySelector('.search-result');
        if (searchResult) {
            searchResult.insertBefore(tripTimesContainer, searchResult.firstChild);
        }
    }
    
    // 根据 show-timetable-btn 状态保持显示/隐藏
    const showTimetableBtn = document.querySelector('.show-timetable-btn');
    if (showTimetableBtn && !showTimetableBtn.classList.contains('active')) {
        tripTimesContainer.classList.add('collapsed');
    } else {
        tripTimesContainer.classList.remove('collapsed');
    }
    
    // 生成班次信息HTML
    let tripTimesHTML = `
        <div class="trip-times-header">
            <h3>${strings.ticket_calculator.recent_trips || '最近班次'}</h3>
            <span class="trip-times-update">${strings.ticket_calculator.last_updated || '最后更新'}: ${new Date().toLocaleTimeString()}</span>
        </div>
        <div class="trip-times-list">
    `;
    
    // 显示最近的几个班次（最多显示15个）
    const displayTrips = trips.slice(0, 15);
    
    displayTrips.forEach((trip, index) => {
        const departureTime = formatTime(trip.departureTime);
        const arrivalTime = formatTime(trip.arrivalTime);
        const durationMinutes = Math.ceil(trip.duration / 60);
        
        let statusText = '';
        let statusClass = '';
        if (trip.status === 'running') {
            statusText = strings.ticket_calculator.running || '运行中';
            statusClass = 'running';
        } else if (trip.status === 'stopped') {
            statusText = strings.ticket_calculator.stopped || '已停靠';
            statusClass = 'stopped';
        } else {
            statusText = strings.ticket_calculator.approaching || '即将到达';
            statusClass = 'approaching';
        }
        
        tripTimesHTML += `
            <div class="trip-time-item ${statusClass}">
                <div class="trip-time-header">
                    <span class="trip-train-name">${trip.trainName}</span>
                    <span class="trip-train-series">${trip.trainSeries || ''}</span>
                    <span class="trip-line-name">${trip.lineName || ''}</span>
                    ${trip.directionLabel ? `<span class="trip-direction">${trip.directionLabel}</span>` : ''}
                </div>
                <div class="trip-time-details">
                    <div class="trip-time-departure">
                        <span class="trip-time-label">${strings.ticket_calculator.departure || '出发'}</span>
                        <span class="trip-time-value">${departureTime}</span>
                    </div>
                    <div class="trip-time-duration">
                        <span class="trip-time-label">${strings.ticket_calculator.duration || '用时'}</span>
                        <span class="trip-time-value">${durationMinutes}${strings.ticket_calculator.min || '分钟'}</span>
                    </div>
                    <div class="trip-time-arrival">
                        <span class="trip-time-label">${strings.ticket_calculator.arrival || '到达'}</span>
                        <span class="trip-time-value">${arrivalTime}</span>
                    </div>
                </div>
                <div class="trip-time-status">
                    <span class="status-indicator ${statusClass}">${statusText}</span>
                </div>
            </div>
        `;
    });
    
    tripTimesHTML += `</div>`;
    tripTimesContainer.innerHTML = tripTimesHTML;
}

// 查找车站的坐标
function findStationCoordinates(stationCode) {
    if (!window.stationsNetwork) return [];
    return window.stationsNetwork
        .filter(station => station.name.startsWith(stationCode))
        .map(station => ({
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
        Math.round(rawDuration / 60) + '\'' 
        + (Math.round(rawDuration % 60) < 10 ? '0' : '')
        + Math.round(rawDuration % 60) + '\"';
    return duration;
}

// 计算3D空间中点到线段的距离
function distanceFromSegment(p, v, w) {
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
    for (let i = 0; i < index; i++) {
        if (i < index) {
            distance += calculateDistance(track.nodes[i], track.nodes[i + 1]);
            //console.log ('i<index',distance, track.nodes[i], track.nodes[i + 1]);
        } else {
            distance += calculateDistance(p, track.nodes[i]);
            //console.log ('i=index ',distance, p, track.nodes[i]);
            // 只要满足一次这个条件就结束循环
            return distance;
        }
    }
    return distance;
}

function calculateDistance(v, w) {
    //console.log ('calculating distance: ',v, w);
    return Math.sqrt(Math.pow(v.x - w.x, 2) + Math.pow(v.z - w.z, 2));
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

// 检查路线是否在同一站点换乘两次及以上
function hasTransferAtSameStation(route) {
    if (!route.segments || route.segments.length <= 1) {
        return false; // 没有换乘或只有一个路段
    }
    
    // 统计每个换乘站的换乘次数
    const transferCount = {};
    
    // 遍历相邻的路段，检查换乘站
    for (let i = 0; i < route.segments.length - 1; i++) {
        const currentSegment = route.segments[i];
        const nextSegment = route.segments[i + 1];
        
        // 换乘站是当前段的最后一个站
        const transferStation = currentSegment.stations[currentSegment.stations.length - 1];
        
        // 增加该换乘站的换乘次数
        if (!transferCount[transferStation]) {
            transferCount[transferStation] = 0;
        }
        transferCount[transferStation]++;
    }
    
    // 检查是否有换乘次数大于1的站点
    for (const station in transferCount) {
        if (transferCount[station] > 1) {
            return true; // 存在同一站点换乘两次及以上
        }
    }
    
    return false; // 没有在同一站点换乘两次及以上
}

// 新增更精确的换乘次数判断函数
function hasMultipleTransfersAtSameStation(route) {
    if (!route.segments || route.segments.length <= 1) {
        return false; // 没有换乘或只有一个路段
    }
    
    // 统计每个换乘站的换乘次数
    const transferCount = {};
    
    // 遍历相邻的路段，检查换乘站
    for (let i = 0; i < route.segments.length - 1; i++) {
        const currentSegment = route.segments[i];
        const nextSegment = route.segments[i + 1];
        
        // 换乘站是当前段的最后一个站
        const transferStation = currentSegment.stations[currentSegment.stations.length - 1];
        
        // 增加该换乘站的换乘次数
        if (!transferCount[transferStation]) {
            transferCount[transferStation] = 0;
        }
        transferCount[transferStation]++;
    }
    
    // 检查是否有换乘次数大于1的站点
    for (const station in transferCount) {
        if (transferCount[station] > 1) {
            return true; // 存在同一站点换乘两次及以上
        }
    }
    
    return false; // 没有在同一站点换乘两次及以上
}

function handleWindowResize() {
    const searchPanel = document.querySelector('.search-controls');
    const searchPanelElement = searchPanel.querySelector('.search-panel');
    const footerPanel = document.querySelector('footer .search-panel');
    const sortSelector = searchPanel.querySelector('.sort-selector');
    const footer = document.querySelector('footer');
    const header = document.querySelector('header');
    const searchResult = document.querySelector('.search-result');
    const searchItem = searchResult.querySelectorAll('.route-result');
    const main = document.querySelector('main');
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

    const allPanels = document.querySelectorAll('footer .search-panel');
    allPanels.forEach(panel => {
        const title = panel.querySelector('.search-title');
        const titleIcon = title.querySelector('.material-symbols-outlined');
        const titleText = title.querySelector('h4');
        if (panel.classList.contains('collapsed')) {
            if (titleIcon && titleIcon.textContent !== 'search') titleIcon.textContent = 'search';
            if (titleText && titleText.textContent !== strings.ticket_calculator.search[lang]) {
                titleText.textContent = strings.ticket_calculator.search[lang] || 'Search';
                titleText.style.fontWeight = '';
            }
        } else { 
            if (titleIcon && titleIcon.textContent !== 'keyboard_arrow_down') titleIcon.textContent = 'keyboard_arrow_down';
            if (titleText && titleText.textContent !== strings.ticket_calculator.collapse[lang]) {
                titleText.textContent = strings.ticket_calculator.collapse[lang] || 'Search';
                titleText.style.fontWeight = 'normal';
            }
        }
    });
    
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
    const startInput = document.querySelector('footer #startInput');
    const endInput = document.querySelector('footer #endInput');
    const isInputFocused = (startInput && startInput === document.activeElement) || (endInput && endInput === document.activeElement);

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
        
        const searchTitle = footerPanel.querySelector('footer .search-title');
        const searchTitleImg = searchTitle.querySelector('.material-symbols-outlined');
        const searchTitleText = searchTitle.querySelector('h4');

        if (searchItem.length <= 0) {
            footerPanel.addEventListener('mouseover' , () => { 
                footerPanel.classList.remove('collapsed');
                footerPanel.classList.add('no-collapse');
                searchTitleImg.textContent = 'keyboard_arrow_down';
                searchTitleText.textContent = strings.ticket_calculator.collapse[lang];
                searchTitleText.style.fontWeight = 'normal';
                searchTitle.addEventListener('click' , () => { 
                    footerPanel.classList.remove('no-collapse');
                    footerPanel.classList.add('collapsed');
                    searchTitleImg.textContent = 'search';
                    searchTitleText.textContent = strings.ticket_calculator.search[lang];
                    searchTitleText.style.fontWeight = '';
                    setTimeout(() => {
                        tabs.classList.remove('collapsed');
                    }, 150);
                    showToast(strings.ticket_calculator.click_outside_to_collapse[lang]);
                });
            });
            document.addEventListener('click' , (e) => { 
                if (e.target.closest('.search-panel')) return;
                footerPanel.classList.remove('no-collapse');
                footerPanel.classList.add('collapsed');
                searchTitleImg.textContent = 'search';
                searchTitleText.textContent = strings.ticket_calculator.search[lang];
                searchTitleText.style.fontWeight = '';
                setTimeout(() => {
                    tabs.classList.remove('collapsed');
                }, 150);
            });
        }
        else footerPanel.classList.remove('no-collapse');
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
        }, 50);
        sideBar.style.position = 'relative';
        prefActions.style.display = 'none';
        main.style.paddingBottom = '36px';
        const sideBarPanel = sideBar.querySelector('.search-controls');
        sideBarPanel.style.width = '11em';
        if (!sidebarCollapseDone) { 
            if (prefs.collapseSidebar) { 
                if (!sideBar.classList.contains('collapsed')) {
                    sideBar.classList.add('collapsed');
                    sideBarBtn.title = strings.general.expand_side_bar[lang];
                    const sideBarBtnImg = sideBarBtn.querySelector('span');
                    console.log(sideBarBtn, sideBarBtnImg);
                    if (sideBarBtnImg) {
                        sideBarBtnImg.textContent = 'menu';
                    }
                }
            } else { 
                if (sideBar.classList.contains('collapsed')) {
                    sideBar.classList.remove('collapsed');
                    sideBarBtn.title = strings.general.collapse_side_bar[lang];
                    const sideBarBtnImg = sideBarBtn.querySelector('span');
                    console.log(sideBarBtn, sideBarBtnImg);
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
            main.style.paddingLeft = `calc(${lineSelectorWidth}px + 4vw)`;
            tabs.style.marginLeft = `calc(${lineSelectorWidth}px + 2vw)`;
        }, 150);
    }
    const startInputs = document.querySelectorAll('#startInput');
    if (!startInputs[0].value) {
        setTimeout(() => {
            const footer = document.querySelector('footer');
            const isFooterHidden = footer.style.opacity <= 0;
            //console.log('isFooterHidden:', isFooterHidden, footer);
            if (isFooterHidden) {
                const sideBarInput = document.querySelector('.side-bar #startInput');
                sideBarInput.focus();
            }
        }, 200);
    }
}

window.handleWindowResize = handleWindowResize;
