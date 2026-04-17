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
    const sidebarBtn = document.querySelector('.side-bar-btn');
    const sidebarBtnIcon = document.querySelector('.side-bar-btn span');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        sidebarBtn.title = 
            sidebar.classList.contains('collapsed') ?
            strings.general.expand_side_bar[lang] :
            strings.general.collapse_side_bar[lang];
        sidebarBtnIcon.textContent = 
            sidebar.classList.contains('collapsed') ?
            'menu' : 'menu_open';
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
            fontFamily = '"Rubik", "MiSans Latin", "Helvetica Neue", "Helvetica", "Roboto", "BlinkMacSystemFont", "MiSans", "HarmonyOS Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif;';
            break;
        case 'harmonyos':
            fontFamily = '"HarmonyOS Sans SC", "HarmonyOS Sans", "MiSans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", "Inter", "MiSans Latin", "Helvetica Neue", "Helvetica", "Roboto", "BlinkMacSystemFont", Arial, sans-serif';
            break;
        case 'sans-serif':
            fontFamily = 'sans-serif';
            break;
        case 'serif':
            fontFamily = 'serif';
            break;
        case 'system':
            fontFamily = 'none';
            break;
        default:
            // 默认使用 Inter 字体
            fontFamily = '"Rubik", "MiSans Latin", "Helvetica Neue", "Helvetica", "Roboto", "BlinkMacSystemFont", "MiSans", "HarmonyOS Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif;';
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
        item.style.width = isMobile ? '-webkit-fill-available' : '';
        
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

function handleFooterItemCollapse() {
    const notCollapsedItems = document.querySelectorAll('footer > *:not(.tabs):not(.collapsed)');
    const tabs = document.querySelectorAll('footer .tabs');
    const footer = document.querySelector('footer');
    
    if (notCollapsedItems.length > 0) {
        tabs.forEach(tab => {
            tab.classList.add('collapsed');
        });
    } else {
        tabs.forEach(tab => {
            tab.classList.remove('collapsed');
        });
    }
    tabs.forEach(tab => {
        tab.addEventListener('mouseover', () => {
            footer.click();
            tab.classList.remove('collapsed');
            notCollapsedItems.forEach(item => {
                item.classList.add('collapsed');
            });
        });
        tab.addEventListener('click', (e) => {
            e.stopPropagation();
            if (tab.classList.contains('collapsed')) {
                e.preventDefault();
            }
            tab.classList.remove('collapsed');
            notCollapsedItems.forEach(item => {
                item.classList.add('collapsed');
            });
        });
        const activeTabItem = tab.querySelector('.active');
        if (activeTabItem) {
            activeTabItem.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                notCollapsedItems.forEach(item => {
                    item.classList.remove('collapsed');
                });
            });
        }
    });
    window.handleWindowResize();
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

function initSidebar() {
    const sidebar = document.querySelectorAll('.side-bar');
    const currentPage = window.location.pathname.split('/').pop().split('.')[0];
    sidebar.forEach(sidebar => { 
        console.log('Initializing sidebar for element:', sidebar);
        sidebar.innerHTML = `
            <div class="side-bar-header">
                <div class="icon-btn side-bar-btn">
                    <span class="material-symbols-outlined">
                    menu_open
                    </span>
                </div>
            </div>
            <div class="side-bar-list side-bar-navigation">
                <${currentPage==='lines_info'?'div':'a'} href="lines_info.html" class="side-bar-item ${currentPage === 'lines_info' ? 'active' : ''}">
                    <div class="icon-btn lines-btn ${currentPage === 'lines_info' ? 'active' : ''}">
                        <span class="material-symbols-outlined">
                        route
                        </span>
                        <span>${window.strings?.lines_info?.page_title[lang] || '线路信息'}</span>
                    </div>
                    <div class="selection line-selector no-collapse" style="display:${currentPage === 'lines_info' ? 'flex' : 'none'}"></div>
                </${currentPage==='lines_info'?'div':'a'}>
                <${currentPage==='ticket_calculator'?'div':'a'} href="ticket_calculator.html" class="side-bar-item ${currentPage === 'ticket_calculator' ? 'active' : ''}">
                    <div class="icon-btn fare-btn ${currentPage === 'ticket_calculator' ? 'active' : ''}">
                        <span class="material-symbols-outlined">
                        universal_currency_alt
                        </span>
                        <span>${window.strings?.ticket_calculator?.page_title[lang] || '票价计算'}</span>
                    </div>
                    <div class="search-controls" style="display:${currentPage === 'ticket_calculator' ? 'flex' : 'none'}">
                        <div class="item search-panel selection no-collapse">
                            <div class="icon-btn item-title search-title">
                                <span class="material-symbols-outlined">
                                search
                                </span>
                                <h4>${window.strings?.ticket_calculator.search[lang] || 'Search'}</h4>
                            </div>
                            <section class="input-section">
                                <input type="text" placeholder="${window.strings?.ticket_calculator.start_station[lang] || 'Origin'}" id="startInput" list="start-stations"></input>
                                <div class="icon-btn swap-btn">
                                    <span class="material-symbols-outlined">
                                    swap_vert
                                    </span>
                                    <span>${window.strings?.ticket_calculator.swap[lang] || 'Swap'}</span>
                                </div>
                                <input type="text" placeholder="${window.strings?.ticket_calculator.end_station[lang] || 'Destination'}" id="endInput" list="end-stations"></input>
                            </section>
                            <section class="search-actions">
                                <button id="searchBtn" class="active">${window.strings?.ticket_calculator.search[lang] || 'Search'}</button>
                                <button id="clearBtn">${window.strings?.ticket_calculator.clear_input[lang] || 'Clear'}</button>
                            </section>
                        </div>
                        <div class="item sort-selector selection no-collapse"> 
                            <div class="icon-btn selection-item sort-by-time active">
                                <span class="material-symbols-outlined">
                                timer
                                </span>
                                <span>${window.strings?.ticket_calculator.sort_by_time[lang] || 'Faster'}</span>
                            </div>
                            <div class="icon-btn selection-item sort-by-transfers">
                                <span class="material-symbols-outlined">
                                sync
                                </span>
                                <span>${window.strings?.ticket_calculator.sort_by_transfer[lang] || 'Direct'}</span>
                            </div>
                            <div class="icon-btn selection-item sort-by-price">
                                <span class="material-symbols-outlined">
                                savings
                                </span>
                                <span>${window.strings?.ticket_calculator.sort_by_price[lang] || 'Cheaper'}</span>
                            </div>
                        </div>
                    </div>
                </${currentPage==='ticket_calculator'?'div':'a'}>
                <${currentPage==='trains_info'?'div':'a'} href="trains_info.html" class="side-bar-item ${currentPage === 'trains_info' ? 'active' : ''}">
                    <div class="icon-btn trains-btn ${currentPage === 'trains_info' ? 'active' : ''}">
                        <span class="material-symbols-outlined">
                        directions_subway
                        </span>
                        <span>${window.strings?.trains_info?.page_title[lang] || '列车信息'}</span>
                    </div>
                </${currentPage==='trains_info'?'div':'a'}>
            </div>
            <div class="side-bar-list side-bar-pref">
                <a href="preferences.html" class="side-bar-item"> 
                    <div class="icon-btn preferences-btn">
                        <span class="material-symbols-outlined filled">
                        account_circle 
                        </span>
                        <span>${window.strings?.preferences?.page_title[lang] || '偏好设置'}</span>
                    </div>
                </a>
                <div class="side-bar-item"> 
                    <div class="icon-btn history-btn">
                        <span class="material-symbols-outlined">
                        history
                        </span>
                    </div>
                </div>
            </div>
        `;
    });
    window.handleWindowResize();
}

function initSearchPanel() {
    const searchPanels = document.querySelectorAll('.search-panel');
    searchPanels.forEach(panel => { 
        panel.innerHTML = `
            <div class="icon-btn item-title search-title">
                <span class="material-symbols-outlined">
                search
                </span>
                <h4>${window.strings?.ticket_calculator.search[lang] || 'Search'}</h4>
            </div>
            <section class="input-section">
                <input type="text" placeholder="${window.strings?.ticket_calculator.start_station[lang] || 'Origin'}" id="startInput" list="start-stations"></input>
                <div class="icon-btn swap-btn">
                    <span class="material-symbols-outlined">
                    swap_vert
                    </span>
                    <span>${window.strings?.ticket_calculator.swap[lang] || 'Swap'}</span>
                </div>
                <input type="text" placeholder="${window.strings?.ticket_calculator.end_station[lang] || 'Destination'}" id="endInput" list="end-stations"></input>
            </section>
            <section class="search-actions">
                <button id="searchBtn" class="active">${window.strings?.ticket_calculator.search[lang] || 'Search'}</button>
                <button id="clearBtn">${window.strings?.ticket_calculator.clear_input[lang] || 'Clear'}</button>
            </section>
            <div class="item sort-selector selection segment no-collapse"> 
                <div class="icon-btn selection-item sort-by-time active">
                    <span class="material-symbols-outlined">
                    timer
                    </span>
                    <span>${window.strings?.ticket_calculator.sort_by_time[lang] || 'Faster'}</span>
                </div>
                <div class="icon-btn selection-item sort-by-transfers">
                    <span class="material-symbols-outlined">
                    sync
                    </span>
                    <span>${window.strings?.ticket_calculator.sort_by_transfer[lang] || 'Direct'}</span>
                </div>
                <div class="icon-btn selection-item sort-by-price">
                    <span class="material-symbols-outlined">
                    savings
                    </span>
                    <span>${window.strings?.ticket_calculator.sort_by_price[lang] || 'Cheaper'}</span>
                </div>
            </div>
        `;
    });
}

function initPrefActions() { 
    const prefActions = document.querySelectorAll('.pref-actions');
    prefActions.forEach(prefAction => {
        prefAction.innerHTML = `
            <div class="icon-btn history-btn" title="${window.strings?.general.history[lang] || 'History'}">
                <span class="material-symbols-outlined">
                history
                </span>
            </div>
            <div class="icon-btn preferences-btn" title="${window.strings?.preferences.page_title[lang] || 'Preferences'}"></a>
                <span class="material-symbols-outlined filled">
                account_circle
                </span>
            </div>
        `;
    });
    const prefBtns = document.querySelectorAll('.pref-actions .preferences-btn');
    if (prefBtns.length > 0) prefBtns[0].addEventListener('click', () => { 
        window.location.href = 'preferences.html';
    });
}

function initTabs() {
    const tabsContainers = document.querySelectorAll('.tabs');
    const currentPage = window.location.pathname.split('/').pop().split('.')[0];
    tabsContainers.forEach(container => {
        container.innerHTML = `
            <a href="lines_info.html" class="tab-item ${currentPage === 'lines_info' ? 'active' : ''}">
                <div class="icon-btn lines-btn ${currentPage === 'lines_info' ? 'active' : ''}">
                    <span class="material-symbols-outlined">
                    route
                    </span>
                    <span class="tab-text">${window.strings?.lines_info.page_title_short[lang] || 'Lines'}</span>
                </div>
            </a>
            <a href="ticket_calculator.html" class="tab-item ${currentPage === 'ticket_calculator' ? 'active' : ''}">
                <div class="icon-btn fare-btn ${currentPage === 'ticket_calculator' ? 'active' : ''}">
                    <span class="material-symbols-outlined">
                    universal_currency_alt
                    </span>
                    <span class="tab-text">${window.strings?.ticket_calculator.page_title_short[lang] || 'Fare'}</span>
                </div>
            </a>
            <a href="trains_info.html" class="tab-item ${currentPage === 'trains_info' ? 'active' : ''}">
                <div class="icon-btn trains-btn ${currentPage === 'trains_info' ? 'active' : ''}">
                    <span class="material-symbols-outlined">
                    directions_subway
                    </span>
                    <span class="tab-text">${window.strings?.trains_info.page_title_short[lang] || 'Trains'}</span>
                </div>
            </a>
        `;
    });
}

function addCursor() { 
    if (prefs.showCursor !== true || prefs.reduceMotion === true) return;
    const containers = document.querySelectorAll('.tabs,.side-bar,footer > *,.tooltip, main .selection');
    containers.forEach(container => { 
        const cursor = document.createElement('div');
        cursor.classList.add('cursor');
        cursor.classList.add('out');
        container.appendChild(cursor);
        
        // 鼠标事件
        container.addEventListener('mouseover', (e) => { 
            setTimeout(() => {
                cursor.classList.remove('out');
            }, 100);
            cursor.style.left = e.clientX - container.getBoundingClientRect().left + 'px';
            cursor.style.top = e.clientY - container.getBoundingClientRect().top + 'px';
        });
        
        container.addEventListener('mousemove', (e) => { 
            cursor.style.left = e.clientX - container.getBoundingClientRect().left + 'px';
            cursor.style.top = e.clientY - container.getBoundingClientRect().top + 'px';
        });
        
        container.addEventListener('mousedown', (e) => { 
            cursor.style.transform = 'scale(1.5) translate(-25%, -25%)';
        });
        
        container.addEventListener('mouseup', (e) => { 
            cursor.style.transform = '';
        });
        
        container.addEventListener('mouseleave', (e) => { 
            setTimeout(() => {
                cursor.classList.add('out');
            }, 100);
        });
        
        // 触摸事件
        container.addEventListener('touchstart', (e) => { 
            const touch = e.touches[0];
            setTimeout(() => {
                cursor.classList.remove('out');
            }, 100);
            cursor.style.left = touch.clientX - container.getBoundingClientRect().left + 'px';
            cursor.style.top = touch.clientY - container.getBoundingClientRect().top + 'px';
        });
        
        container.addEventListener('touchmove', (e) => { 
            const touch = e.touches[0];
            cursor.style.left = touch.clientX - container.getBoundingClientRect().left + 'px';
            cursor.style.top = touch.clientY - container.getBoundingClientRect().top + 'px';
        });
        
        container.addEventListener('touchend', (e) => { 
            setTimeout(() => {
                cursor.classList.add('out');
            }, 100);
        });
    });
}

function initHistoryBtn() { 
    const historyBtns = document.querySelectorAll('.history-btn');
    historyBtns.forEach(historyBtn => { 
        historyBtn.title = strings.general.history[lang];
        historyBtn.addEventListener('click', () => { 
            loadHistory();
        });
    });
}

function pushDialog(content, type = 'confirm', title = '', defaultValue = '', coverSrc = '') {
    if (compactParam === 'true') return;
    // 返回Promise以支持异步等待
    return new Promise(async (resolve) => {
        if (window.prefs.useSystemDialog === false || type === 'custom') {
            const appContainer = document.querySelector('.app-container');
            const existingDialog = document.querySelectorAll('.modal-overlay');
            if (existingDialog && existingDialog.length > 0) {
                existingDialog.forEach(dialog => {
                    dialog.remove();
                });
            }
            
            // 使用自定义对话框
            const modalOverlay = document.createElement('div');
            modalOverlay.classList.add('modal-overlay');
            modalOverlay.addEventListener('mousedown', (e) => {
                // 只有点击遮罩层才关闭，避免点击对话框内容时关闭
                if (e.target === modalOverlay) {
                    closeDialog(modalOverlay);
                    resolve(type === 'prompt' ? null : false); // 用户取消，prompt返回null
                }
            });
            modalOverlay.style.opacity = 0;
            modalOverlay.style.backdropFilter = 'blur(1px)';
            
            const dialogContainer = document.createElement('div');
            dialogContainer.classList.add('dialog-container');
            dialogContainer.classList.add('item');
            dialogContainer.classList.add('collapsed');

            const dialogHeader = document.createElement('div');
            dialogHeader.classList.add('dialog-header');
            const dialogTitle = document.createElement('h3');
            dialogTitle.classList.add('dialog-title');
            dialogTitle.textContent = title;
            dialogHeader.appendChild(dialogTitle);
            if(title!=='')dialogContainer.appendChild(dialogHeader);

            const contentContainer = document.createElement('div');
            contentContainer.classList.add('content-container');

            const dialogContent = document.createElement('div');
            dialogContent.classList.add('dialog-content');
            if (type === 'custom') {
                content.addEventListener('scroll', (e) => { 
                    e.stopPropagation();
                });
                content.classList.add('dialog-content');
                if (title === '' && !content.classList?.contains('shortcut-list')) content.style.paddingTop = '24px';
            } else dialogContent.textContent = content;
            if (title === '' && !content.classList?.contains('shortcut-list')) {
                dialogContent.style.paddingTop = '24px';
            }
            contentContainer.appendChild(type==='custom'?content:dialogContent);

            if (coverSrc !== '') { 
                const dialogCover = document.createElement('div');
                dialogCover.classList.add('dialog-cover');
                const dialogCoverImg = document.createElement('img');
                dialogCoverImg.src = coverSrc;
                dialogCover.appendChild(dialogCoverImg);
                const targetElement = type === 'custom' ? content : dialogContent;
                contentContainer.insertBefore(dialogCover, targetElement);
                contentContainer.style.width = '-webkit-fill-available';
                targetElement.classList.add('item');
                contentContainer.addEventListener('scroll', (e) => { 
                    const contentElement = contentContainer.querySelector('.dialog-content');
                    e.stopPropagation();
                        const scrollTop = contentContainer.scrollTop;
                        if (scrollTop > 0) { 
                            contentContainer.classList.remove('cover');
                            //contentElement.style.minHeight = 'calc(60dvh - 6em)';
                        } else if (!contentContainer.classList.contains('error')) { 
                            contentContainer.classList.add('cover');
                            contentElement.style.minHeight = '';
                        }
                });
                dialogCoverImg.addEventListener('load', () => { 
                    dialogCoverImg.style.opacity = 1;
                    dialogCover.style.height = '';
                    contentContainer.classList.add('cover');
                });
                dialogCoverImg.addEventListener('error', () => { 
                    dialogCoverImg.style.opacity = 0;
                    dialogCover.style.height = 0;
                    contentContainer.classList.remove('cover');
                    contentContainer.classList.add('error');
                });
            } else dialogContainer.style.width = 'fit-content';
            dialogContainer.appendChild(contentContainer);

            const dialogInput = document.createElement('input');
            dialogInput.classList.add('dialog-input');
            dialogInput.value = defaultValue;
            if (type === 'prompt') contentContainer.appendChild(dialogInput);

            const dialogButtons = document.createElement('div');
            dialogButtons.classList.add('dialog-buttons');
            
            // 取消按钮
            const cancelButton = document.createElement('button');
            cancelButton.textContent = type === 'custom'?strings.general.close[lang]:strings.general.cancel[lang];
            cancelButton.addEventListener('click', () => {
                closeDialog(modalOverlay);
                resolve(type === 'prompt' ? null : false); // 用户取消，prompt返回null，其他类型返回false
            });
            if (type !== 'alert') dialogButtons.appendChild(cancelButton);
            
            // 确认按钮
            const confirmButton = document.createElement('button');
            if (type.match('danger')) confirmButton.style.color = 'crimson';
            else confirmButton.classList.add('active');
            confirmButton.textContent = strings.general.confirm[lang];
            confirmButton.addEventListener('click', () => {
                closeDialog(modalOverlay);
                // 如果是prompt类型，返回输入框的值；否则返回true
                resolve(type === 'prompt' ? dialogInput.value : true);
            });
            if (type !== 'custom') dialogButtons.appendChild(confirmButton);

            modalOverlay.addEventListener('scroll', (e) => { 
                e.stopPropagation();
            });
            
            dialogContainer.appendChild(dialogButtons);
            modalOverlay.appendChild(dialogContainer);
            appContainer.appendChild(modalOverlay);
            
            // 动画显示
            setTimeout(() => {
                modalOverlay.style.opacity = '';
                modalOverlay.style.webkitBackdropFilter = '';
                modalOverlay.style.backdropFilter = '';
                setTimeout(() => {
                    dialogContainer.classList.remove('collapsed');
                }, 10);
            }, 10);
        } else { 
            // 使用系统对话框
            let result;
            let isResultUpdated = false;
            const startTime = Date.now();
            console.log(`使用系统对话框，等待结果...`, startTime);

            switch (type) {
                case 'alert':
                    window.alert((title ? (title + '\n') : '') + content);
                    result = true; // alert总是返回true
                    break;
                case 'prompt':
                    result = window.prompt((title ? (title + '\n') : '') + content, defaultValue);
                    break;
                default:
                    result = window.confirm((title ? (title + '\n') : '') + content);
            }
            const endTime = Date.now();
            console.log(`系统对话框已返回结果：${result}`, endTime);
            // 标记result已被更新
            isResultUpdated = true;

            // 检测是否在20ms内更新了result
            if (endTime - startTime < 20) {
                // 结果没有在20ms内更新，说明系统对话框可能被阻止
                try {
                    // 更新localStorage设置
                    let prefs = JSON.parse(localStorage.getItem('preferences')) || {};
                    prefs.useSystemDialog = false;
                    localStorage.setItem('preferences', JSON.stringify(prefs));
                    
                    // 更新window.prefs
                    window.prefs = prefs;
                    
                    // 重新执行整个函数
                    const newResult = await pushDialog(content, type, title, defaultValue);
                    resolve(newResult);
                } catch (error) {
                    console.error('Error handling blocked system dialog:', error);
                    resolve(null);
                }
            }
            resolve(result);
        }
    });
}

function closeDialog(modalOverlay, callback) {
    modalOverlay.style.opacity = 0;
    // 同时设置标准属性和 -webkit- 前缀以确保兼容性
    modalOverlay.style.backdropFilter = 'blur(1px)';
    const dialogContainer = modalOverlay.querySelector('.dialog-container');
    dialogContainer.classList.add('collapsed');
    setTimeout(() => {
        modalOverlay.remove();
        if (callback && typeof callback === 'function') {
            callback();
        }
    }, 300); 
}