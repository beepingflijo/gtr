// 获取偏好设置
let prefs = {};
try {
    const prefsStr = localStorage.getItem('preferences');
    if (prefsStr) {
        prefs = JSON.parse(prefsStr);
    }
} catch (e) {
    console.error('Error parsing preferences:', e);
}
window.prefs = prefs;
const compactParam = new URLSearchParams(window.location.search).get('compact');
window.compactParam = compactParam;

let lang = null;

// 从 strings.json 获取 strings 和初始化语言
document.addEventListener('DOMContentLoaded', async () => { 
    try {
        // 先初始化语言设置
        lang = await getCurrentLanguage();
        console.log('Current language:', lang);
        const html = document.querySelector('html');
        html.lang = lang.includes('zh') ? 'zh' : lang;
        
        // 加载 strings 数据
        const stringsResponse = await fetch('strings.json');
        const stringsData = await stringsResponse.json();
        strings = stringsData;
        
        // 初始化其他功能
        initSearchPanel();
        initSidebar();
        initPrefActions();
        initTabs();
        initSearchBar();
        applySavedTheme(); // 应用保存的主题设置
        checkForceRefresh(); // 检查是否需要强制刷新
        initHistoryBtn();
        setInterval(handleFooterItemCollapse, 150);
        if (window.listenKeyboardShortcuts) {
            window.listenKeyboardShortcuts();
        }
        addCursor();
        handleActions();
        const tabs = document.querySelectorAll('footer .tabs');
        
        // 暴露 lang 到全局供其他模块使用
        window.lang = lang;
        // 使用setTimeout确保在其他DOM操作完成后执行
        //setTimeout(hideNonActiveSelectionItems, 0);
        initBlurLayers();

        const themeColor = document.createElement('meta');
        themeColor.name = 'theme-color';
        // 转为十六进制颜色
        const hexColor = getComputedStyle(document.body).getPropertyValue('--color-primary').trim();
        themeColor.content = hexColor;
        document.head.appendChild(themeColor);
        
        // 为侧边栏按钮添加点击事件监听器
        const sidebarButtons = document.querySelectorAll('.side-bar-btn');
        sidebarButtons.forEach(button => {
            button.addEventListener('click', toggleSidebar);
        });

        document.addEventListener('touchstart', function() {
            isTouch = true;
        })
        document.addEventListener('mouseover', function() {
            isTouch = false;
        })
    } catch (error) {
        console.error('Error initializing language and strings:', error);
        // 降级处理
        lang = 'zh_hans';
        window.lang = lang;
    }
});

// 请求通知权限
function requestNotificationPermission() {
    return new Promise((resolve) => {
        if (!("Notification" in window)) {
            console.log("This browser does not support notifications");
            resolve(false);
            return;
        }
        
        if (Notification.permission === "granted") {
            console.log("Notification permission already granted");
            resolve(true);
            return;
        }
        
        if (Notification.permission === "denied") {
            console.log("Notification permission denied");
            resolve(false);
            return;
        }
        
        // 当权限是"default"时，请求权限
        Notification.requestPermission().then(permission => {
            console.log("Notification permission result:", permission);
            resolve(permission === "granted");
        }).catch(error => {
            console.error("Error requesting notification permission:", error);
            resolve(false);
        });
    });
}

// 记录用户访问的页面和参数
function recordLastVisitedPage(paramsString,page) {
    if (compactParam === 'true') return;
    // 获取当前页面文件名
    const currentPage = page?page:window.location.pathname.split('/').pop();
    console.log('Recording last visited page:', currentPage, paramsString);
    
    // 定义允许记录的页面
    const allowedPages = ['lines_info.html', 'ticket_calculator.html', 'trains_info.html', 'content.html'];
    
    // 检查当前页面是否是允许记录的页面
    if (allowedPages.includes(currentPage)) {
        const visitedPagesStr = localStorage.getItem('visitedPages');
        let visitedPages;
        
        if (!visitedPagesStr) {
            visitedPages = [{page: currentPage, params: paramsString, timestamp: Date.now()}];
        } else {
            try {
                visitedPages = JSON.parse(visitedPagesStr);
                if (!Array.isArray(visitedPages)) {
                    visitedPages = [];
                }
            } catch (e) {
                console.warn('Failed to parse visitedPages:', e);
                visitedPages = [];
            }
            visitedPages.push({page: currentPage, params: paramsString, timestamp: Date.now()});
        }

        const historyLimit = prefs.historyLimit || 5;
        
        // 先去除重复：如果有多个page和params都相同的条目只取时间戳最新的那个
        const uniquePages = visitedPages.reduce((acc, item) => {
            const key = `${item.page}_${item.params || ''}`;
            if (!acc[key] || item.timestamp > acc[key].timestamp) {
                acc[key] = item;
            }
            return acc;
        }, {});
        
        // 将唯一记录转换回数组形式
        visitedPages = Object.values(uniquePages);
        
        // 按页面分组，保留每个页面最新的5条记录
        const groupedPages = visitedPages.reduce((acc, item) => {
            if (!acc[item.page]) {
                acc[item.page] = [];
            }
            acc[item.page].push(item);
            return acc;
        }, {});
        
        // 对每个页面的记录按时间戳降序排序，并保留前5条
        visitedPages = Object.values(groupedPages)
            .map(pageGroup => 
                pageGroup
                    .sort((a, b) => b.timestamp - a.timestamp)  // 按时间戳降序排序
                    .slice(0, historyLimit)  // 只保留最新的记录
            )
            .flat();  // 将二维数组展平成一维数组
        
        localStorage.setItem('visitedPages', JSON.stringify(visitedPages));
    }
}

function getLastVisitedParams(page) { 
    if (prefs.resumeOnLoading === false) return null;
    console.log('Getting last visited params for page:', page);
    const currentPage = window.location.pathname.split('/').pop();
    page = page || currentPage;
    let latestParams = null;
    try {
        const visitedPages = JSON.parse(localStorage.getItem('visitedPages'));
        if (Array.isArray(visitedPages)) {
            const itemsForPage = visitedPages.filter(item => item.page && item.page.includes(page));
            if (itemsForPage.length > 0) {
                let latestTimestamp = 0;
                itemsForPage.forEach(page => {
                    if (page.timestamp > latestTimestamp) {
                        latestTimestamp = page.timestamp;
                        latestParams = page.params;
                    }
                });
            }
        }
    } catch (e) {
        console.warn('Failed to parse visitedPages:', e);
    }
    return latestParams;
}

// 检查是否需要强制刷新
function checkForceRefresh() {
    // 获取当前页面
    const currentPage = window.location.pathname.split('/').pop();
    console.log('Current page:', currentPage);
    
    // 定义需要强制刷新的页面
    const refreshPages = ['lines_info.html', 'ticket_calculator.html', 'trains_info.html', 'preferences.html'];
    console.log('Refresh pages:', refreshPages.includes(currentPage));
    
    // 检查是否是preferences.html页面
    const isPreferencesPage = currentPage === 'preferences.html';
    
    // 检查是否存在强制刷新标记
    const forceRefresh = prefs.forceRefresh;
    
    if (forceRefresh === true && (refreshPages.includes(currentPage) || isPreferencesPage)) {
        console.log('Force refresh detected for page:', currentPage);
        
        // 如果当前页面在需要刷新的列表中，则刷新页面
        if (refreshPages.includes(currentPage) && !prefs.refreshedPages || !prefs.refreshedPages.includes(currentPage)) {
            // 显示提示信息
            showToast('正在强制刷新数据...', 2000);
            
            // 从preferences中移除此页面的刷新标记
            if (!prefs.refreshedPages) {
                prefs.refreshedPages = [];
            }
            
            // 如果此页面尚未刷新，则执行刷新
            if (!prefs.refreshedPages.includes(currentPage)) {
                prefs.refreshedPages.push(currentPage);
                
                // 保存更新后的preferences
                try {
                    localStorage.setItem('preferences', JSON.stringify(prefs));
                } catch (e) {
                    console.error('Error saving preferences:', e);
                }
                
                // 刷新页面，添加时间戳参数避免缓存
                const url = new URL(window.location);
                url.searchParams.set('_refresh', Date.now());
                window.location.reload(true);
                return;
            }
        }
        // 对于preferences.html页面，我们直接刷新但不添加参数
        else if (isPreferencesPage) {
            // 显示提示信息
            showToast('正在刷新偏好设置页面...', 2000);
            
            // 检查是否已经刷新过preferences页面
            if (!prefs.refreshedPages || !prefs.refreshedPages.includes(currentPage)) {
                // 更新刷新记录
                if (!prefs.refreshedPages) {
                    prefs.refreshedPages = [];
                }
                prefs.refreshedPages.push(currentPage);
                
                // 保存更新后的preferences
                try {
                    localStorage.setItem('preferences', JSON.stringify(prefs));
                } catch (e) {
                    console.error('Error saving preferences:', e);
                }
                
                // 刷新页面
                window.location.reload(true);
                return;
            }
        }
    }
    
    // 检查是否所有页面都已经刷新过了，如果是则清除forceRefresh标记
    if (forceRefresh === true) {
        const refreshedPages = prefs.refreshedPages || [];
        const allPagesRefreshed = refreshPages.every(page => refreshedPages.includes(page));
        console.log('All pages refreshed:', allPagesRefreshed);
        
        if (allPagesRefreshed) {
            // 清除强制刷新标记
            prefs.forceRefresh = false;
            prefs.refreshedPages = []; // 清空刷新记录
            
            try {
                localStorage.setItem('preferences', JSON.stringify(prefs));
            } catch (e) {
                console.error('Error saving preferences:', e);
            }
            
            console.log('All pages refreshed, force refresh flag cleared');
        }
    }
}

function getTrainData() { 
    return new Promise((resolve, reject) => { 
        fetch(`./data/trains_info.json`) 
            .then(response => response.json()) 
            .then(data => { 
                resolve(data); 
            }) 
            .catch(error => { 
                console.error('Error fetching train data:', error); 
                reject(error); 
            })
    });
}

window.getTrainData = getTrainData;

function getStationData(code = '') { 
    return new Promise((resolve, reject) => { 
        fetch(`./data/stations_info.json`) 
            .then(response => response.json()) 
            .then(data => { 
                resolve(code==='' ? data : data[code]); 
            }) 
            .catch(error => { 
                console.error('Error fetching station data:', error); 
                reject(error); 
            })
    });
}

// 从 strings.json 获取支持的语言列表
function getSupportedLanguages(page) {
    return new Promise((resolve, reject) => {
        const currentPage = window.location.pathname.split('/').pop().split('.')[0];
        page = page || currentPage;
        
        fetch('./strings.json')
            .then(response => response.json())
            .then(data => {
                const langs = Object.keys(data[page]?.page_title || data['general'] || {});
                resolve(langs);
            })
            .catch(error => {
                console.error('Error loading strings data:', error);
                // 降级返回默认支持的语言
                resolve(['zh_hans', 'zh_hant', 'en', 'uk']);
            });
    });
}

// 获取当前页面语言（异步版本）
async function getCurrentLanguage() {
    // 从 URL 参数获取语言（优先使用）
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('lang')) {
        const urlLang = urlParams.get('lang');
        
        // 检查是否是已知的语言映射
        switch (urlLang) {
            case 'zh':
            case 'zh_CN':
            case 'zh_SG':
            case 'zh_MY':
                localStorage.setItem('lang', 'zh_hans');
                showToast('重定向至简体中文');
                return 'zh_hans';
            case 'zh_HK':
            case 'zh_MO':
            case 'zh_TW':
                localStorage.setItem('lang', 'zh_hant');
                showToast('重定向至繁體中文');
                return 'zh_hant';
        }
        
        // 获取支持的语言列表并验证
        try {
            const supportedLangs = await getSupportedLanguages();
            const ethnicLangsInChina = ['bo', 'ug', 'mn', 'ii', 'za'];
            if (
                !supportedLangs.includes(urlLang) && 
                !ethnicLangsInChina.includes(urlLang) && 
                urlLang.length <= 2
            ) {
                localStorage.setItem('lang', 'en');
                showToast('Redirecting to English');
                return 'en';
            } else if (supportedLangs.includes(urlLang)) {
                return urlLang;
            } else {
                localStorage.setItem('lang', 'zh_hans');
                if (ethnicLangsInChina.includes(urlLang)) showToast('重定向至简体中文');
                return 'zh_hans';
            }
        } catch (e) {
            console.warn('Failed to get supported languages, using default:', e);
            return 'zh_hans';
        }
    }
    
    // 如果 URL 参数中没有，则从 localStorage 中获取上次使用的语言
    const storedLang = localStorage.getItem('lang');
    if (storedLang) {
        return storedLang;
    }
    
    // 如果都没有，则默认使用 zh_hans
    return 'zh_hans';
}

// 语言切换函数
function selectLanguage(newLang) {
    // 更新localStorage中的语言设置
    localStorage.setItem('lang', newLang);
    
    // 更新URL参数
    const url = new URL(window.location);
    url.searchParams.set('lang', newLang);
    
    // 重新加载页面以应用新语言
    window.location.href = url.toString();
}

/**
 * 更新URL中的搜索参数
 * @param {string} searchTerm - 搜索词
 */
function updateSearchURLParameter(searchTerm) {
    const url = new URL(window.location);
    if (searchTerm) {
        url.searchParams.set('q', searchTerm);
    } else {
        url.searchParams.delete('q');
    }
    window.history.replaceState({}, '', url);
}

function getStationName(stationCode, lang = getCurrentLanguage()) {
    console.log(window.activeLine);
    if (window.activeLine && window.activeLine.id === 'manual') { 
        const currentStation = window.activeLine.route.find(station => station.code === stationCode);
        if (lang > 0) lang = currentStation.name.filter(name => name!=='').length - 1;
        console.log('getStationName', currentStation,lang);
        return currentStation.name[lang];
    }
    if (lang === 'original') {
        lang = strings.station_names[stationCode].original ? 'original' : 'zh_hans';
    }
    return strings.station_names[stationCode] ? strings.station_names[stationCode][lang] : stationCode;
}

// 添加防抖变量
let searchTimeout;

/**
 * 通用搜索处理函数
 * @param {Event} event - 输入事件
 * @param {Object} options - 搜索选项
 */
function handleSearch(event, options = {}) {
    // 默认配置
    const config = {
        searchTermParam: 'q',
        searchTitleClass: 'search-title',
        searchItemClass: '.item',
        searchFieldFunction: null,
        ...options
    };

    // 清除之前的timeout
    clearTimeout(searchTimeout);
    
    // 设置新的timeout
    searchTimeout = setTimeout(() => {
        const searchTerm = event.target.value.toLowerCase().trim();
        
        // 更新URL参数
        const url = new URL(window.location);
        if (searchTerm) {
            url.searchParams.set(config.searchTermParam, searchTerm);
        } else {
            url.searchParams.delete(config.searchTermParam);
        }
        window.history.replaceState({}, '', url);
        
        // 应用搜索过滤
        applySearchFilter(searchTerm, config);
    }, 300); // 300ms防抖延迟
}

/**
 * 通用搜索过滤应用函数
 * @param {string} searchTerm - 搜索词
 * @param {Object} config - 配置选项
 */
function applySearchFilter(searchTerm = '', config = {}) {
    const {
        searchTitleClass,
        searchItemClass,
        searchFieldFunction
    } = config;
    
    const items = document.querySelectorAll(searchItemClass);
    
    // 处理搜索标题
    let searchTitle = document.querySelector(`.${searchTitleClass}`);
    if (searchTerm && !searchTitle) {
        // 如果有搜索词但没有标题，则添加标题
        const container = document.querySelector('main');
        if (container) {
            searchTitle = document.createElement('h3');
            searchTitle.className = searchTitleClass;
            // 使用通用文本，具体文本可以在调用时通过strings设置
            searchTitle.textContent = strings.trains_info.searching_for[lang] + ' "' + searchTerm + '"';
            searchTitle.style.padding = '8px 24px';
            searchTitle.style.fontWeight = '500';
            searchTitle.style.color = 'var(--color-text-primary)';
            container.insertBefore(searchTitle, container.firstChild);
        }
    } else if (!searchTerm && searchTitle) {
        // 如果没有搜索词但有标题，则移除标题
        searchTitle.remove();
    } else if (searchTerm && searchTitle) {
        // 如果有搜索词且有标题，则更新标题内容
            searchTitle.textContent = strings.trains_info.searching_for[lang] + ' "' + searchTerm + '"';
    }
    
    // 遍历所有项目应用搜索过滤
    items.forEach(element => {
        // 如果提供了自定义搜索字段函数，则使用它来构建搜索文本
        if (typeof searchFieldFunction === 'function') {
            const searchText = searchFieldFunction(element, searchTerm);
            if (searchText !== null) {
                // 根据搜索词显示或隐藏项目
                if (searchTerm === '' || searchText.includes(searchTerm)) {
                    element.style.display = '';
                } else {
                    element.style.display = 'none';
                }
            }
        } else {
            // 默认情况下，使用元素的文本内容进行搜索
            const itemText = element.textContent.toLowerCase();
            if (searchTerm === '' || itemText.includes(searchTerm)) {
                element.style.display = '';
                if (searchTerm !== '') {
                    // 高亮对应文字所在的容器
                    Array.from(element.children).forEach(child => {
                        if (child.textContent.toLowerCase().includes(searchTerm)) {
                            // 保存原始背景色
                            const originalBg = child.style.backgroundColor;
                            child.style.backgroundColor = 'var(--color-primary-transparent)';
                            child.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            setTimeout(() => {
                                // 只在当前背景色仍为我们设置的高亮色时才移除
                                if (child.style.backgroundColor === 'var(--color-primary-transparent)') {
                                    child.style.backgroundColor = originalBg || '';
                                }
                            }, 500);
                        }
                    });
                }
            } else {
                element.style.display = 'none';
            }
        }
    });
}

/**
 * 获取URL中的搜索词
 * @param {string} paramName - 参数名
 * @returns {string} 搜索词
 */
function getSearchTerm(paramName = 'q') {
    const urlSearchParams = new URLSearchParams(window.location.search);
    return urlSearchParams.get(paramName) || '';
}

/**
 * 设置搜索词到URL
 * @param {string} term - 搜索词
 * @param {string} paramName - 参数名
 */
function setSearchTerm(term, paramName = 'q') {
    const url = new URL(window.location);
    if (term) {
        url.searchParams.set(paramName, term);
    } else {
        url.searchParams.delete(paramName);
    }
    window.history.replaceState({}, '', url);
}

function calculateTextWidth(string) {
    // 部分字符可记为半字宽
    const halfWidthCharacters = '023456789abcdefghknopqrstuvxyzабвгґеєзийкнопрстхцчья';
    const quarterWidthCharacters = '1ilI.,\'ії"\/\\|!` ';
    let width = 0;
    for (let char of string) {
        if (halfWidthCharacters.includes(char)) {
            width += 0.5;
        } else if (quarterWidthCharacters.includes(char)) {
            width += 0.25;
        } else {
            width += 1;
        }
    }
    return width;
}

// 计算时间差并返回"多久以前"的格式
function getTimeAgo(timestamp) {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now - past;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSecs < 60) {
        return strings.general.time_just_now[lang] || '刚刚';
    } else if (diffMins < 60) {
        return strings.general.time_minutes_ago[lang] ? 
            strings.general.time_minutes_ago[lang].replace('{n}', diffMins) : `${diffMins}分钟前`;
    } else if (diffHours < 24) {
        return strings.general.time_hours_ago[lang] ? 
            strings.general.time_hours_ago[lang].replace('{n}', diffHours) : `${diffHours}小时前`;
    } else if (diffDays < 7) {
        return strings.general.time_days_ago[lang] ? 
            strings.general.time_days_ago[lang].replace('{n}', diffDays) : `${diffDays}天前`;
    } else {
        // 超过一周，显示具体日期
        const year = past.getFullYear();
        const month = String(past.getMonth() + 1).padStart(2, '0'); // 月份从0开始，需要+1
        const day = String(past.getDate()).padStart(2, '0');
        
        // 如果是同一年，只显示月日；否则显示年月日
        if (now.getFullYear() === year) {
            return `${month}-${day}`;
        } else {
            return `${year}-${month}-${day}`;
        }
    }
}
        
// 发送列车网络故障预警通知
async function sendNetworkWarningNotification(trainName, warningReasons, trainPosition, trainSpeed) {
    // 检查用户是否启用了通知功能
    if (!prefs.notifyNetworkWarning) {
        console.log('Network warning notifications disabled in preferences');
        return;
    }
    
    // 请求通知权限（如果还没有获得）
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
        console.log("No permission to send notifications");
        return;
    }
    
    // 初始化PositionUtils模块（如果尚未初始化）
    try {
        if (typeof PositionUtils !== 'undefined' && typeof window.trainsInfo !== 'undefined' && 
            typeof window.lines !== 'undefined' && typeof window.stationsNetwork !== 'undefined' &&
            typeof window.strings !== 'undefined') {
            // 检查PositionUtils是否已初始化
            // 通过尝试获取一个已知列车的线路信息来判断
            const testLine = PositionUtils.getLineForTrain(trainName, 'id');
            if (!testLine) {
                // 如果返回null，则说明模块未初始化，需要初始化
                PositionUtils.init({
                    trainsInfo: window.trainsInfo,
                    stationsNetwork: window.stationsNetwork,
                    lines: window.lines,
                    strings: window.strings,
                    lang: lang
                });
                console.log('PositionUtils module initialized in script.js');
            }
        }
    } catch (e) {
        console.warn('Failed to initialize PositionUtils:', e);
    }
    
    // 构建通知标题和正文
    let title = trainName;
    if (warningReasons.includes('zero_speed')) {
        title += ' ' + strings.lines_info.warning_zero_speed[lang];
    } else if (warningReasons.includes('long_stop')) {
        title += ' ' + strings.lines_info.warning_long_stop[lang];
    } else if (warningReasons.includes('platform_conflict')) {
        title += ' ' + strings.lines_info.warning_platform_conflict[lang];
    }
    
    // 获取列车位置、线路和附近车站信息
    let body = '';
    if (trainPosition) {
        // 获取线路信息
        let lineInfo = strings.trains_info.line_unregistered[lang];
        try {
            if (typeof PositionUtils !== 'undefined') {
                lineInfo = PositionUtils.getLineForTrain(trainName) || lineInfo;
            } else {
                // 降级处理：从localStorage中获取线路信息
                const trainsInfo = JSON.parse(localStorage.getItem('trains_info') || '{}');
                if (trainsInfo[trainName] && trainsInfo[trainName].line) {
                    // 获取线路名称
                    if (window.lines) {
                        const line = window.lines.find(l => l.id === trainsInfo[trainName].line);
                        if (line && line.name) {
                            lineInfo = line.name[lang] || line.name.zh_hans || line.name.en || line.id;
                        } else {
                            lineInfo = trainsInfo[trainName].line;
                        }
                    } else {
                        lineInfo = trainsInfo[trainName].line;
                    }
                }
            }
        } catch (e) {
            console.warn('获取列车线路信息失败:', e);
        }
        
        // 获取附近车站信息
        let nearbyStation = strings.lines_info.final_station[lang];
        try {
            // 尝试使用PositionUtils获取最近的车站
            if (typeof PositionUtils !== 'undefined' && window.lines) {
                // 查找最近的线路
                const closestTrack = PositionUtils.findClosestTrackOnAllLines(trainPosition);
                if (closestTrack && closestTrack.line) {
                    const closestStation = PositionUtils.findClosestStation(closestTrack.line, trainPosition);
                    if (closestStation && closestStation.station) {
                        // 获取车站名称
                        const stationCode = closestStation.station.code;
                        if (stationCode) {
                            nearbyStation = PositionUtils.getStationName(stationCode, lang);
                        } else {
                            nearbyStation = stationCode || strings.lines_info.final_station[lang];
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('获取附近车站信息失败:', e);
        }
        
        body = `${lineInfo}, ${strings.trains_info.near[lang] + nearbyStation}\n(${trainPosition.x.toFixed(0)}, ${trainPosition.y.toFixed(0)}, ${trainPosition.z.toFixed(0)})`;
    } else {
        body = '位置信息不可用';
    }
    
    console.log('Sending notification:', title, body);
    
    // 使用标准 Notifications API
    if ("Notification" in window && Notification.permission === "granted") {
        console.log('Using standard Notification API');
        try {
            let notification = new Notification(title, {
                body: body,
                icon: './res/network_warning.png',
                tag: 'network-warning-' + trainName,
            });
            // 添加点击事件
            notification.addEventListener('click', () => {
                window.open(`trains_info.html?q=${trainName}`, '_self');
            });
            console.log('Notification sent successfully');
            return; // 成功发送通知，直接返回
        } catch (error) {
            console.error('Standard Notification API failed:', error);
        }
    }
}

// 修改为接受第三个参数body的函数
async function sendTrainApproachingNotification(trainName, playerName, body) {
    // 检查用户是否启用了通知功能
    const prefs = JSON.parse(localStorage.getItem('preferences') || '{}');
    if (!prefs.notifyTrainApproaching) {
        console.log('Approaching warning notifications disabled in preferences');
        return;
    }
    
    // 请求通知权限（如果还没有获得）
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
        console.log("No permission to send notifications");
        return;
    }
    
    // 初始化PositionUtils模块（如果尚未初始化）
    try {
        if (typeof PositionUtils !== 'undefined' && typeof window.trainsInfo !== 'undefined' && 
            typeof window.lines !== 'undefined' && typeof window.stationsNetwork !== 'undefined' &&
            typeof window.strings !== 'undefined') {
            // 检查PositionUtils是否已初始化
            // 通过尝试获取一个已知列车的线路信息来判断
            const testLine = PositionUtils.getLineForTrain(trainName, 'id');
            if (!testLine) {
                // 如果返回null，则说明模块未初始化，需要初始化
                PositionUtils.init({
                    trainsInfo: window.trainsInfo,
                    stationsNetwork: window.stationsNetwork,
                    lines: window.lines,
                    strings: window.strings,
                    lang: lang
                });
                console.log('PositionUtils module initialized in script.js');
            }
        }
    } catch (e) {
        console.warn('Failed to initialize PositionUtils:', e);
    }

    // 确保strings对象已加载
    if (!window.strings) {
        try {
            const response = await fetch('strings.json');
            window.strings = await response.json();
        } catch (e) {
            console.error('无法加载strings.json:', e);
            return;
        }
    }

    const title = trainName + (window.strings?.trains_info?.is_approaching?.[lang] || ' 接近 ') + playerName;
    
    console.log('准备发送通知:', title, body);
    
    // 使用 Notifications API
    if ("Notification" in window && Notification.permission === "granted") {
        console.log('Using standard Notification API');
        try {
            let notification = new Notification(title, {
                body: body,
                icon: './res/train_approaching.png',
                tag: 'train-approaching-' + trainName,
                renotify: true
            });
            // 添加点击事件
            notification.addEventListener('click', () => {
                window.open(`trains_info.html?q=${trainName}`, '_self');
            });
            console.log('Notification sent successfully');
            return; // 成功发送通知，直接返回
        } catch (error) {
            console.error('Standard Notification API failed:', error);
        }
    }
}

function getLineName(lineId) { 
    return lines.find(line => line.id === lineId)?.name?.[lang] || lineId;
}

function getLinesForStation(stationCode) { 
    const linesForSearch = lines.filter(line => !line.id.includes('-R') && !line.id.includes('GX'));
    return linesForSearch.filter(line => line.route.some(step => step.code === stationCode));
}

function getColorForMtrLine(line) { 
    return fetch('https://rail.nitrogen.hydcraft.cn/data')
        .then(response => response.json())
        .then(data => {
            const lineData = data[0].routes.find(l => l.name.includes('|')?(l.name.split('|')[0] === line):(l.name === line));
            if (!lineData || !lineData.color) {
                console.warn(`No color found for MTR line: ${line}`,lineData);
                return '#cccccc'; // 默认灰色
            }
            // 将颜色从数值转换为十六进制代码
            const hexColor = '#' + lineData.color.toString(16).padStart(6, '0');
            console.log('MTR line color:', hexColor, Date.now());
            return hexColor;
        })
        .catch(error => {
            console.error('Error fetching line data:', error);
            return '#cccccc'; // 错误时返回默认色
        });
}

function getEnglishNameForMtrLine(line) { 
    return fetch('https://rail.nitrogen.hydcraft.cn/data')
        .then(response => response.json())
        .then(data => {
            const lineData = data[0].routes.find(l => l.name.includes('|')?(l.name.split('|')[0] === line):(l.name === line));
            if (!lineData || !lineData.name.includes('|')) {
                console.warn(`No English name found for MTR line: ${line}`);
                return line;
            }
            const englishName = lineData.name.split('|')[1]||line;
            console.log('MTR line English name:',lineData.name, englishName, Date.now());
            return englishName;
        })
        .catch(error => {
            console.error('Error fetching line data:', error);
            return line; // 错误时返回原始名称
        });
}