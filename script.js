// 从strings.json获取strings
document.addEventListener('DOMContentLoaded', () => { 
    fetch('strings.json')
        .then(stringsResponse => stringsResponse.json())
        .then(stringsData => {
            strings = stringsData;
            initSearchBar();
        })
    .catch(error => console.error('Error loading Language data:', error));
});

// 记录用户访问的页面和参数
function recordLastVisitedPage() {
    // 获取当前页面文件名
    const currentPage = window.location.pathname.split('/').pop();
    
    // 定义允许记录的页面
    const allowedPages = ['lines_info.html', 'ticket_calculator.html', 'trains_info.html'];
    
    // 检查当前页面是否是允许记录的页面
    if (allowedPages.includes(currentPage)) {
        // 获取当前URL参数
        const urlParams = new URLSearchParams(window.location.search);
        const paramsString = urlParams.toString();
        
        // 存储到localStorage
        localStorage.setItem('lastVisitedPage', currentPage);
        if (paramsString) {
            localStorage.setItem('lastVisitedParams', paramsString);
        } else {
            localStorage.removeItem('lastVisitedParams');
        }
    }
}

// 页面加载完成后记录访问信息
document.addEventListener('DOMContentLoaded', recordLastVisitedPage);

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

// 获取当前页面语言
function getCurrentLanguage() {
    const urlParams = new URLSearchParams(window.location.search);
    // 如果没有参数默认输出简体中文
    if (!urlParams.has('lang')) {
        return 'zh_hans';
    }
    return urlParams.get('lang') || navigator.language || navigator.userLanguage;
}

let lang = getCurrentLanguage();

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
    const isMobile = window.innerWidth < 720;

    // 如果有选项则清空之前的选项
    if (languageSelection.children.length > 0) {
        languageSelection.innerHTML = '';
    }
    
    // 为每个语言创建选项
    languages.forEach(langObj => {
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
            changeLanguage(selectedLang);
            
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

// 语言切换函数
function changeLanguage(newLang) {
    // 更新URL参数
    const url = new URL(window.location);
    url.searchParams.set('lang', newLang);
    
    // 重新加载页面以应用新语言
    window.location.href = url.toString();
}

// 调整actions样式
document.querySelectorAll('header .actions').forEach(actions => { 
    if (actions.classList.contains('tabs') || actions.classList.contains('search-bar') && actions.classList.contains('collapsed')) actions.style.padding = '2px 4px';
    else if (actions.children.length >= 2 ) actions.style.padding = '2px 8px';
});

function initSearchBar() {
    document.querySelectorAll('.search-bar').forEach(searchBar => { 
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
                if (this.value.trim()) {
                    // 如果有内容，移除collapsed类
                    searchBar.classList.remove('collapsed');
                } else {
                    // 如果没有内容，检查鼠标是否悬停在其他元素上
                    const isHoveringOtherElements = otherElements.some(element => 
                        element.matches(':hover')
                    );
                    
                    if (isHoveringOtherElements) {
                        searchBar.classList.add('collapsed');
                    }
                }
                
                // 更新URL参数
                updateSearchURLParameter(this.value.trim());
            });
            
            // 页面加载时从URL参数中获取搜索词
            const urlSearchParams = new URLSearchParams(window.location.search);
            const searchQuery = urlSearchParams.get('q') || '';
            if (searchQuery) {
                searchInput.value = searchQuery;
                searchBar.classList.remove('collapsed');
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
            searchTitle.textContent = `Searching for "${searchTerm}"`;
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
        searchTitle.textContent = `Searching for "${searchTerm}"`;
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
        

// 在DOM内容加载完成后调用hideNonActiveSelectionItems函数
document.addEventListener('DOMContentLoaded', () => {
    // 使用setTimeout确保在其他DOM操作完成后执行
    //setTimeout(hideNonActiveSelectionItems, 0);
    initBlurLayers();
    
    // 为侧边栏按钮添加点击事件监听器
    const sidebarButtons = document.querySelectorAll('.side-bar-btn');
    sidebarButtons.forEach(button => {
        button.addEventListener('click', toggleSidebar);
    });
});