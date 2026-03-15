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

// 从strings.json获取strings
document.addEventListener('DOMContentLoaded', () => { 
    fetch('strings.json')
        .then(stringsResponse => stringsResponse.json())
        .then(stringsData => {
            strings = stringsData;
            initSearchBar();
            applySavedTheme(); // 应用保存的主题设置
            checkForceRefresh(); // 检查是否需要强制刷新
        })
    .catch(error => console.error('Error loading Language data:', error));
});

// 记录用户访问的页面和参数
function recordLastVisitedPage(paramsString) {
    // 获取当前页面文件名
    const currentPage = window.location.pathname.split('/').pop();
    console.log('Recording last visited page:', currentPage, paramsString);
    
    // 定义允许记录的页面
    const allowedPages = ['lines_info.html', 'ticket_calculator.html', 'trains_info.html'];
    
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

        // 取每个页面最新的访问记录合成新的数组
        visitedPages = visitedPages.reduce((acc, item) => {
            const existingItem = acc.find(i => i.page === item.page);
            if (!existingItem) {
                acc.push(item);
            } else if (existingItem.timestamp < item.timestamp) {
                existingItem.timestamp = item.timestamp;
                existingItem.params = item.params;
            }
            return acc;
        }, []);
        
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

// 延迟执行selection元素的处理，确保在所有脚本执行完毕后运行
function hideNonActiveSelectionItems() {
    console.log('Hiding non-active selection items');
    document.querySelectorAll('.selection.collapsed').forEach(elem => {
        console.log('Processing collapsed selection element:', elem);
        // 检查是否已经有non-active-items容器
        if (elem.querySelector('.non-active-items')) {
            console.log('Non-active items container already exists');
            return;
        }
        
        let nonActiveContainer = document.createElement('div');
        nonActiveContainer.className = 'non-active-items';
        
        // 将非活动项移到新容器中
        Array.from(elem.children).forEach(child => {
            if (!child.classList.contains('active')) {
                nonActiveContainer.appendChild(child);
            }
        });
        
        // 只有当非活动项容器中有内容时才添加到DOM中
        if (nonActiveContainer.children.length > 0) {
            elem.appendChild(nonActiveContainer);
        }
    });
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
        initSearchBar();
        applySavedTheme(); // 应用保存的主题设置
        checkForceRefresh(); // 检查是否需要强制刷新
        
        // 暴露 lang 到全局供其他模块使用
        window.lang = lang;
    } catch (error) {
        console.error('Error initializing language and strings:', error);
        // 降级处理
        lang = 'zh_hans';
        window.lang = lang;
    }
});

// 显示Toast提示
function showToast(message, duration = 3000) {
    const prevToast = document.querySelector('.toast');
    if (prevToast) {
        prevToast.remove();
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 100);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 500);
    }, duration);
}

function removeToast(message) {
    const toast = document.querySelectorAll('.toast');
    if (toast.textContent === message) {
        toast.remove();
    }
}

// 切换侧边栏显示状态
function toggleSidebar() {
    const sidebar = document.querySelector('.side-bar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        // 在已加载的脚本中查找handleWindowResize
        const handleWindowResize = window.handleWindowResize;
        if (handleWindowResize) {
            handleWindowResize();
        }
    }
}

// 应用保存的主题设置
function applySavedTheme() {
    
    const savedTheme = prefs.theme || 'system';
    const html = document.documentElement;
    
    if (savedTheme === 'light') {
        html.setAttribute('data-theme', 'light');
        html.classList.remove('dark');
    } else if (savedTheme === 'dark') {
        html.setAttribute('data-theme', 'dark');
        html.classList.add('dark');
    } else {
        // 跟随系统
        html.removeAttribute('data-theme');
        html.classList.remove('dark');
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDark) {
            html.classList.add('dark');
        }
    }

    const reduceMotion = prefs.reduceMotion || false;
    if (reduceMotion) {
        html.classList.add('effect-reduced');
    } else {
        html.classList.remove('effect-reduced');
    }

    const savedFont = prefs.font;
    if (savedFont) {
        applyFont(savedFont);
    }
}

// 应用字体
function applyFont(font) {
    const root = document.documentElement;
    let fontFamily;
    
    switch (font) {
        case 'inter':
            fontFamily = '"Bricolage Grotesque", "MiSans Latin", "Helvetica Neue", "Helvetica", "Roboto", "BlinkMacSystemFont", "MiSans", "HarmonyOS Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif;';
            break;
        case 'harmonyos':
            fontFamily = '"HarmonyOS Sans SC", "HarmonyOS Sans", "MiSans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", "Inter", "MiSans Latin", "Helvetica Neue", "Helvetica", "Roboto", "BlinkMacSystemFont", Arial, sans-serif';
            break;
        case 'sans-serif':
            fontFamily = 'sans-serif';
            break;
        case 'system':
            fontFamily = 'none';
            break;
        default:
            // 默认使用 Inter 字体
            fontFamily = '"Bricolage Grotesque", "MiSans Latin", "Helvetica Neue", "Helvetica", "Roboto", "BlinkMacSystemFont", "MiSans", "HarmonyOS Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif;';
            break;
    }
    
    root.style.setProperty('--font-family', fontFamily);
}

// 初始化语言选择器
function initLanguageSelector() {
    if (!document.querySelector('.language-selection')) return;
    // 添加语言选择功能
    const languageSelector = document.querySelector('.language-selection');
    const selectionElement = languageSelector.querySelector('.selection');
    const selectionItems = languageSelector.querySelectorAll('.selection-item');
    const languageSelection = document.querySelector('.language-selection');

    // 从URL获取当前显示的页面以决定启用哪部分语言，并去掉后缀名
    const currentPage = window.location.pathname.split('/').pop().split('.')[0];
    
    // 从strings.json中获取支持的语言列表
    const languages = [];
    if (strings.general && strings[currentPage]) {
        Object.keys(strings.general.lang).forEach(langKey => {
            // 仅添加在当前页面有翻译的语言
            if (strings[currentPage].page_title[langKey]) {
                languages.push({
                    code: langKey,
                class: `lang-${langKey.replace('_', '-')}`,
                    textKey: langKey
                });
            }
        });
    }

    // 轮询页面宽度
    let isMobile = window.innerWidth < 720;

    // 如果有选项则清空之前的选项
    if (languageSelection.children.length > 0) {
        languageSelection.innerHTML = '';
    }
    
    // 为每个语言创建选项
    languages.forEach(langObj => {
        // 如果在preferences.html则仅使用lang不用lang_short
        if (window.location.href.includes('preferences.html')) isMobile = false;
        const item = document.createElement('div');
        item.className = `selection-item ${langObj.class}`;
        item.textContent = isMobile ? strings.general.lang_short[langObj.textKey] : strings.general.lang[langObj.textKey];
        item.dataset.lang = langObj.code;
        item.style.justifyContent = isMobile ? 'center' : 'flex-start';
        item.style.width = isMobile ? '-webkit-fill-available' : 'auto';
        
        // 添加点击事件
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            selectLanguage(langObj.code);
        });
        
        languageSelection.appendChild(item);
    });
    
    // 设置当前语言为激活状态
    const activeItem = languageSelection.querySelector(`[data-lang="${lang}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }
    
    // 添加展开/收起功能
    languageSelection.addEventListener('click', function() {
        this.classList.toggle('collapsed');
    });

    // 为每个语言选项添加点击事件
    selectionItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            
            // 移除所有选项的active类
            selectionItems.forEach(el => el.classList.remove('active'));
            
            // 为当前点击的选项添加active类
            this.classList.add('active');
            
            // 获取选择的语言并更新页面
            const selectedLang = this.classList[1].replace('lang-', '').replace('-', '_');
            selectLanguage(selectedLang);
            
            // 收起语言选择
            selectionElement.classList.add('collapsed');
        });
    });

    // 根据当前语言设置active状态
    selectionItems.forEach(item => {
        const itemLang = item.classList[1].replace('lang-', '').replace('-', '_');
        if (itemLang === lang) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// 当页面宽度改变时更新语言选择器
window.addEventListener('resize', () => {
    initLanguageSelector();
    //hideNonActiveSelectionItems();
});

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

// 点击展开/收起语言选择
const selectionElements = document.querySelectorAll('.selection');
selectionElements.forEach(selectionElement => { 
    selectionElement.addEventListener('mouseover', function() {
        this.classList.remove('collapsed');
    });

    selectionElement.addEventListener('mouseout', function() {
        if (this.classList.contains('no-collapse')) return;
        this.classList.add('collapsed');
    });

    // 针对触摸进行优化
    // 触摸collapsed元素展开
    selectionElement.addEventListener('touchstart', function(e) {
        if (this.classList.contains('collapsed')) {
            e.preventDefault();
            this.classList.remove('collapsed')
        };
    });

    // 触摸元素外的位置收起元素
    document.addEventListener('touchstart', function(e) { 
        if (!selectionElement.contains(e.target) && !selectionElement.classList.contains('no-collapse')) selectionElement.classList.add('collapsed');
    });

    // 禁用已有collapsed类的点击事件
    selectionElement.addEventListener('click', function(e) {
        if (this.classList.contains('collapsed')) {
            e.preventDefault();
            // 然后禁用子元素的点击事件
            selectionElement.querySelectorAll('.selection-item').forEach(el => el.removeEventListener('click', e => e.preventDefault()));
        }
    });
});

// 调整actions样式
document.querySelectorAll('header .actions').forEach(actions => { 
    if (actions.classList.contains('tabs') || actions.classList.contains('search-bar') && actions.classList.contains('collapsed')) actions.style.padding = '2px 4px';
    else if (actions.children.length >= 2 ) actions.style.padding = '2px 8px';
});

function initSearchBar() {
    // 获取所有的搜索栏
    const searchBars = document.querySelectorAll('.search-bar');
    
    searchBars.forEach(searchBar => { 
        searchBar.title = strings.ticket_calculator.search[lang] || '搜索';
        // 获取搜索栏中的input元素
        const searchInput = searchBar.querySelector('input');
        
        // 页面加载时检查搜索栏是否有内容，如果有则展开
        if (searchInput.value) {
            searchBar.classList.remove('collapsed');
        }
        
        if (searchBar.classList.contains('collapsed')) {
            searchBar.addEventListener('click', function() {
                this.classList.remove('collapsed');
            });
        }
        
        // 获取header内的所有.actions和.selection元素（除了当前搜索栏）
        const header = document.querySelector('header');
        if (header && searchInput) {
            const otherElements = Array.from(header.querySelectorAll('.actions, .selection'))
                .filter(element => element !== searchBar);
            
            otherElements.forEach(element => {
                element.addEventListener('mouseover', function() {
                    // 只有当搜索栏没有内容时才添加collapsed类
                    if (!searchInput.value.trim()) {
                        searchBar.classList.add('collapsed');
                    }
                });
                
                element.addEventListener('mouseout', function() {
                    // 当鼠标离开其他元素且搜索栏有内容时，移除collapsed类
                    if (searchInput.value.trim()) {
                        searchBar.classList.remove('collapsed');
                    }
                });

                // 当点击header以外的区域时收起搜索栏（如果没有内容）
                document.addEventListener('click', function(e) {
                    if (!searchBar.contains(e.target) && !otherElements.some(el => el.contains(e.target))) {
                        if (!searchInput.value.trim()) {
                            searchBar.classList.add('collapsed');
                        }
                    }
                });
            });
            
            // 监听搜索输入框的内容变化
            searchInput.addEventListener('input', function() {
                // 同步所有搜索框的内容
                const inputValue = this.value.trim();
                searchBars.forEach(bar => {
                    const input = bar.querySelector('input');
                    if (input !== this) {  // 不更新当前正在输入的搜索框
                        input.value = this.value;
                    }
                });
                
                if (inputValue) {
                    // 如果有内容，移除所有搜索框的collapsed类
                    searchBars.forEach(bar => {
                        bar.classList.remove('collapsed');
                    });
                } else {
                    // 如果没有内容，检查鼠标是否悬停在其他元素上
                    const isHoveringOtherElements = otherElements.some(element => 
                        element.matches(':hover')
                    );
                    
                    if (isHoveringOtherElements) {
                        searchBars.forEach(bar => {
                            if (!bar.querySelector('input').value.trim()) {
                                bar.classList.add('collapsed');
                            }
                        });
                    }
                }
                
                // 更新URL参数
                updateSearchURLParameter(inputValue);
            });
            
            // 页面加载时从URL参数中获取搜索词
            const urlSearchParams = new URLSearchParams(window.location.search);
            const searchQuery = urlSearchParams.get('q') || '';
            if (searchQuery) {
                searchInput.value = searchQuery;
                searchBars.forEach(bar => {
                    const input = bar.querySelector('input');
                    if (input !== searchInput) {
                        input.value = searchQuery;
                    }
                    bar.classList.remove('collapsed');
                });
            }
        }
    });
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

function initBlurLayers() {
    document.querySelectorAll('.gradient-blur').forEach(layer => {
        const layer1 = document.createElement('div');
        layer1.className = 'blur-layer-1';
        const layer2 = document.createElement('div');
        layer2.className = 'blur-layer-2';
        const layer3 = document.createElement('div');
        layer3.className = 'blur-layer-3';
        layer.appendChild(layer1);
        layer.appendChild(layer2);
        layer.appendChild(layer3);
    });
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

// 在DOM内容加载完成后调用hideNonActiveSelectionItems函数
document.addEventListener('DOMContentLoaded', () => {
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
});

function pushDialog(content, type = 'confirm', title = '') {
    // 返回Promise以支持异步等待
    return new Promise((resolve) => {
        if (window.prefs.useSystemDialog === false) {
            const appContainer = document.querySelector('main');
            const existingDialog = document.querySelectorAll('.modal-overlay');
            if (existingDialog && existingDialog.length > 0) {
                existingDialog.forEach(dialog => {
                    dialog.remove();
                });
            }
            
            // 使用自定义对话框
            const modalOverlay = document.createElement('div');
            modalOverlay.classList.add('modal-overlay');
            modalOverlay.addEventListener('click', (e) => {
                // 只有点击遮罩层才关闭，避免点击对话框内容时关闭
                if (e.target === modalOverlay) {
                    closeDialog(modalOverlay);
                    resolve(false); // 用户取消
                }
            });
            modalOverlay.style.opacity = 0;
            modalOverlay.style.backdropFilter = 'blur(1px)';
            
            const dialogContainer = document.createElement('div');
            dialogContainer.classList.add('dialog-container');
            dialogContainer.classList.add('item');
            dialogContainer.style.opacity = 0;
            dialogContainer.style.transform = 'scale(1.1)';

            const dialogTitle = document.createElement('h3');
            dialogTitle.classList.add('dialog-title');
            dialogTitle.textContent = title;
            dialogContainer.appendChild(dialogTitle);

            const dialogContent = document.createElement('div');
            dialogContent.classList.add('dialog-content');
            dialogContent.textContent = content;
            dialogContainer.appendChild(dialogContent);

            const dialogButtons = document.createElement('div');
            dialogButtons.classList.add('dialog-buttons');
            
            // 取消按钮
            const cancelButton = document.createElement('button');
            cancelButton.textContent = strings.general.cancel[lang];
            cancelButton.addEventListener('click', () => {
                closeDialog(modalOverlay);
                resolve(false); // 用户取消
            });
            if (type !== 'alert') dialogButtons.appendChild(cancelButton);
            
            // 确认按钮
            const confirmButton = document.createElement('button');
            if (type === 'confirm-danger') confirmButton.style.color = 'crimson';
            else confirmButton.classList.add('active');
            confirmButton.textContent = strings.general.confirm[lang];
            confirmButton.addEventListener('click', () => {
                closeDialog(modalOverlay);
                resolve(true); // 用户确认
            });
            dialogButtons.appendChild(confirmButton);
            
            dialogContainer.appendChild(dialogButtons);
            modalOverlay.appendChild(dialogContainer);
            appContainer.appendChild(modalOverlay);
            
            // 动画显示
            setTimeout(() => {
                modalOverlay.style.opacity = 1;
                modalOverlay.style.backdropFilter = '';
                setTimeout(() => {
                    dialogContainer.style.opacity = 1;
                    dialogContainer.style.transform = 'scale(1)';
                }, 10);
            }, 10);
        } else { 
            // 使用系统对话框
            let result;
            switch (type) {
                case 'alert':
                    window.alert((title ? (title + '\n') : '') + content);
                    result = true; // alert总是返回true
                    break;
                default:
                    result = window.confirm((title ? (title + '\n') : '') + content);
            }
            resolve(result);
        }
    });
}

function closeDialog(modalOverlay, callback) {
    modalOverlay.style.opacity = 0;
    modalOverlay.style.backdropFilter = 'blur(1px)';
    setTimeout(() => {
        modalOverlay.remove();
        if (callback && typeof callback === 'function') {
            callback();
        }
    }, 300); 
}

// 使用示例：
// 1. 异步/await 方式（推荐）
// async function handleDelete() {
//     const confirmed = await pushDialog('确定要删除吗？', 'confirm', '删除确认');
//     if (confirmed) {
//         // 执行删除操作
//         console.log('用户确认删除');
//     } else {
//         console.log('用户取消删除');
//     }
// }

// 2. Promise.then() 方式
// pushDialog('确定要继续吗？', 'confirm', '操作确认')
//     .then(confirmed => {
//         if (confirmed) {
//             // 用户确认后的操作
//             console.log('用户确认');
//         } else {
//             console.log('用户取消');
//         }
//     });

// 3. Alert模式（只有确定按钮）
// await pushDialog('操作成功！', 'alert', '提示');

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
