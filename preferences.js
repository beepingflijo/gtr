// 页面加载完成后执行初始化函数
document.addEventListener('DOMContentLoaded', function () {
    fetch('strings.json')
        .then(stringsResponse => stringsResponse.json())
        .then(stringsData => {
            window.strings = stringsData;
            init();
            initLanguageSelector();
            initThemeSelector();
            initFontSelector();
            initReduceMotionSwitch();
            initStorageList();
            handleWindowResize();
        })
    .catch(error => console.error('Error loading Language data:', error));
});

// 初始化函数
function init() {
    
    const headerTitle = document.querySelector('header h1');
    const pageTitle = document.querySelector('title');
    console.log(pageTitle.textContent);
    headerTitle.textContent = strings.preferences.page_title[lang];
    pageTitle.textContent = strings.preferences.page_title[lang] + ' - ' + strings.mainpage.gtr_info[lang];

    // 添加搜索功能
    const searchInput = document.querySelector('.search-input');
    searchInput.placeholder = strings.preferences.search_placeholder[lang];
    const urlSearchParams = new URLSearchParams(window.location.search);
    const searchQuery = urlSearchParams.get('q') || '';
    searchInput.value = searchQuery; // 从URL参数获取搜索词或设置为空
    searchInput.addEventListener('input', handleSearch);

    window.addEventListener('resize', handleWindowResize);

    const backBtn = document.querySelector('.back-btn');
    backBtn.addEventListener('click', () => {
        window.open('index.html?lang='+lang, '_self');
    });
    backBtn.title = strings.general.back[lang];

    const generalPref = document.getElementById('generalPref');
    generalPref.textContent = strings.preferences.general[lang];
    const languagePref = document.getElementById('languagePref');
    languagePref.textContent = strings.preferences.language[lang];
    const themePref = document.getElementById('themePref');
    themePref.textContent = strings.preferences.theme_mode[lang];
    const fontPref = document.getElementById('fontPref');
    fontPref.textContent = strings.preferences.font[lang];
    const reduceMotionPref = document.getElementById('reduceMotionPref');
    reduceMotionPref.textContent = strings.preferences.reduce_motion_and_transparency[lang];
    const storagePref = document.getElementById('storagePref');
    storagePref.textContent = strings.preferences.storage[lang];
    const managePref = document.getElementById('storageManagePref');
    managePref.textContent = strings.preferences.manage_storage[lang];
    const resetPref = document.getElementById('resetPref');
    resetPref.textContent = strings.preferences.reset_all_data[lang];
    
    // 添加重置所有数据按钮的事件监听器
    resetPref.addEventListener('click', resetAllData);
    
    const aboutPref = document.getElementById('aboutPref');
    aboutPref.textContent = strings.preferences.about_[lang] + strings.mainpage.gtr_info[lang];
    const versionPref = document.getElementById('versionPref');
    versionPref.textContent = strings.preferences.version[lang];
    const refreshPref = document.getElementById('refreshPref');
    refreshPref.textContent = strings.preferences.refresh_all_files[lang];
    
    // 添加强制刷新按钮的事件监听器
    refreshPref.addEventListener('click', forceRefresh);
    
    const aboutGtLink = document.getElementById('aboutGtLink');
    aboutGtLink.textContent = strings.preferences.about_gt[lang];
    const yctLink = document.getElementById('yctLink');
    yctLink.textContent = strings.preferences.yct[lang];
    const disclaimerText = document.getElementById('disclaimerText');
    disclaimerText.textContent = strings.preferences.disclaimer_text[lang];
    if (lang === 'zh_hans') {
        const preparedInfo = document.createElement('span');
        preparedInfo.classList.add('prepared-info');
        preparedInfo.innerHTML = `
                    <a href="https://beian.miit.gov.cn" style="margin-right:8px;">辽ICP备2021004959号-1</a>
                    <a href="https://beian.mps.gov.cn">辽公网安备21100502000117号</a>`;
        const main = document.querySelector('main');
        main.appendChild(preparedInfo);
    }
}

// 强制刷新功能
function forceRefresh() {
    // 设置强制刷新标记
    localStorage.setItem('forceRefresh', 'true');
    
    // 显示提示信息
    showToast(strings.preferences.refresh_all_files_success[lang] || '刷新标记已设置，下次访问相关页面时将强制刷新', 3000);
}

// 重置所有数据
function resetAllData() {
    // 确认对话框
    if (confirm(strings.preferences.reset_all_data_confirm[lang])) {
        // 清空localStorage
        localStorage.clear();
        
        // 重新加载页面以应用更改
        location.reload();
        
        // 显示提示
        showToast(strings.preferences.reset_all_data_success[lang], 2000);
    }
}

// 初始化存储列表
function initStorageList() {
    const storageListContainer = document.querySelector('.storage-list');
    if (!storageListContainer) return;

    const warningStorageKeys = ['metroTransferQuery','orders','notificationSettings','festiveEffects','redirectAfterRefund','localMarkers'];

    // 清空容器
    storageListContainer.innerHTML = '';

    // 获取所有存储项
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        
        // 创建存储项元素
        const item = document.createElement('div');
        item.className = 'storage-item';
        
        // 创建键名元素
        const keyElement = document.createElement('span');
        keyElement.className = 'storage-key';
        keyElement.textContent = key;

        const valueElement = document.createElement('span');
        valueElement.className = 'storage-value';
        valueElement.textContent = getStorageDescription(key, value);

        // 组装键名和描述
        const itemHeader = document.createElement('div');
        itemHeader.className = 'storage-item-header';
        itemHeader.appendChild(keyElement);
        itemHeader.appendChild(valueElement);
        
        // 创建描述元素
        const descElement = document.createElement('span');
        descElement.className = 'storage-desc';
        if (strings.storage_descriptions[key]) { 
            descElement.textContent = strings.storage_descriptions[key][lang];
            itemHeader.appendChild(descElement);
        }
        if (warningStorageKeys.includes(key)) { 
            descElement.textContent = strings.storage_descriptions.warning[lang];
            descElement.style.color = 'crimson';
            descElement.style.fontWeight = 'bold';
            itemHeader.appendChild(descElement);
            item.style.background = 'linear-gradient(to right,rgba(255, 0, 0, 0.1) ,rgba(255, 0, 0, 0.05) 20%, rgba(255, 0, 0, 0.02) 80%, rgba(255, 0, 0, 0.05) 95%, rgba(255, 0, 0, 0.1))';
        }

        item.appendChild(itemHeader);
        
        // 创建重置按钮
        const resetButton = document.createElement('button');
        resetButton.className = 'storage-reset-btn';
        resetButton.textContent = strings.general.reset[lang];
        resetButton.addEventListener('click', () => {
            removeFromStorage(key, item);
        });
        item.appendChild(resetButton);
        
        // 添加到容器
        storageListContainer.appendChild(item);
    }
    
    // 如果没有存储项，显示提示信息
    if (localStorage.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'storage-empty';
        emptyMessage.textContent = strings.preferences.no_storage_items[lang] || '暂无存储项';
        storageListContainer.appendChild(emptyMessage);
    }
}

// 获取存储项描述
function getStorageDescription(key, value) {
    // 根据键名提供描述
    const descriptions = {
        'theme': strings.preferences.theme_mode[lang],
        'font': strings.preferences.font[lang],
        'reduceMotion': strings.preferences.reduce_motion_and_transparency[lang],
        'lang': strings.preferences.language[lang],
        'lastVisitedPage': strings.preferences.last_visited_page[lang] || '最后访问页面',
        'lastVisitedParams': strings.preferences.last_visited_params[lang] || '最后访问参数',
        'forceRefresh': strings.preferences.refresh_all_files[lang] || '强制刷新标记'
    };
    
    // 尝试解析JSON值以提供更好的描述
    try {
        const parsedValue = JSON.parse(value);
        if (Array.isArray(parsedValue)) {
            return `${strings.preferences.array_with_items[lang] || '数组包含'} ${parsedValue.length} ${strings.preferences.items[lang] || '个项目'}`;
        } else if (typeof parsedValue === 'object' && parsedValue !== null) {
            return `${strings.preferences.object_with_keys[lang] || '对象包含'} ${Object.keys(parsedValue).length} ${strings.preferences.keys[lang] || '个键'}`;
        }
    } catch (e) {
        // 如果不是有效的JSON，就继续使用原始值
    }
    
    // 对于简短的字符串值，直接显示
    if (typeof value === 'string' && value.length <= 50) {
        return value;
    }
    
    // 对于较长的值，显示类型和长度
    if (typeof value === 'string') {
        return `${strings.preferences.string_value[lang] || '字符串'} (${value.length} ${strings.preferences.characters[lang] || '个字符'})`;
    }
    
    // 默认描述
    return descriptions[key] || typeof value;
}

// 从存储中移除项
function removeFromStorage(key, element) {
    // 确认对话框
    if (confirm(`${strings.preferences.confirm_remove_item[lang] || '确定要移除'} "${key}" ${strings.preferences.confirm_remove_item_end[lang] || '吗？'}`)) {
        localStorage.removeItem(key);
        // 从DOM中移除元素
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
        // 显示提示
        showToast(`${strings.preferences.item_removed[lang] || '已移除'} "${key}"`, 2000);
        initStorageList();
    }
}

// 初始化主题选择器
function initThemeSelector() {
    const themeSelector = document.querySelector('.theme-selector');
    if (!themeSelector) return;

    // 从 localStorage 获取保存的主题设置，默认为 'system'
    const savedTheme = localStorage.getItem('theme') || 'system';
    
    // 创建主题选项
    const themes = [
        { id: 'light', label: strings.preferences.theme_mode_light },
        { id: 'dark', label: strings.preferences.theme_mode_dark },
        { id: 'system', label: strings.preferences.system }
    ];

    // 清空选择器
    themeSelector.innerHTML = '';

    // 为每个主题创建选项
    themes.forEach(theme => {
        const item = document.createElement('div');
        item.className = 'selection-item';
        item.textContent = theme.label[lang];
        item.dataset.theme = theme.id;
        
        // 添加点击事件
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            selectTheme(theme.id);
        });
        
        themeSelector.appendChild(item);
    });
    
    // 设置当前主题为激活状态
    const activeItem = themeSelector.querySelector(`[data-theme="${savedTheme}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }
    
    // 应用当前主题
    applyTheme(savedTheme);
    
    // 添加展开/收起功能
    themeSelector.addEventListener('click', function() {
        this.classList.toggle('collapsed');
    });
}

// 选择主题
function selectTheme(theme) {
    // 保存到 localStorage
    localStorage.setItem('theme', theme);
    
    // 更新 UI
    const themeSelector = document.querySelector('.theme-selector');
    const activeItem = themeSelector.querySelector('.selection-item.active');
    if (activeItem) {
        activeItem.classList.remove('active');
    }
    
    const newItem = themeSelector.querySelector(`[data-theme="${theme}"]`);
    if (newItem) {
        newItem.classList.add('active');
    }
    
    // 应用主题
    applyTheme(theme);
}

// 应用主题
function applyTheme(theme) {
    const html = document.documentElement;
    
    if (theme === 'light') {
        html.setAttribute('data-theme', 'light');
        html.classList.remove('dark');
    } else if (theme === 'dark') {
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
}

// 初始化字体选择器
function initFontSelector() {
    const fontSelector = document.querySelector('.font-selector');
    if (!fontSelector) return;

    // 从 localStorage 获取保存的字体设置，默认为 'inter'
    const savedFont = localStorage.getItem('font') || 'inter';
    
    // 创建字体选项
    const fonts = [
        { id: 'inter', label: 'Inter + MiSans' },
        { id: 'harmonyos', label: 'HarmonyOS Sans' },
        { id: 'sans-serif', label: strings.preferences.sans_serif },
        { id: 'system', label: strings.preferences.system }
    ];

    // 清空选择器
    fontSelector.innerHTML = '';

    // 为每个字体创建选项
    fonts.forEach(font => {
        const item = document.createElement('div');
        item.className = 'selection-item';
        item.textContent = font.label[lang] || font.label;
        item.dataset.font = font.id;
        
        // 添加点击事件
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            selectFont(font.id);
        });
        
        fontSelector.appendChild(item);
    });
    
    // 设置当前字体为激活状态
    const activeItem = fontSelector.querySelector(`[data-font="${savedFont}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }
    
    // 应用当前字体
    applyFont(savedFont);
    
    // 添加展开/收起功能
    fontSelector.addEventListener('click', function() {
        this.classList.toggle('collapsed');
    });
}

// 选择字体
function selectFont(font) {
    // 保存到 localStorage
    localStorage.setItem('font', font);
    
    // 更新 UI
    const fontSelector = document.querySelector('.font-selector');
    const activeItem = fontSelector.querySelector('.selection-item.active');
    if (activeItem) {
        activeItem.classList.remove('active');
    }
    
    const newItem = fontSelector.querySelector(`[data-font="${font}"]`);
    if (newItem) {
        newItem.classList.add('active');
    }
    
    // 应用字体
    applyFont(font);
}

// 应用字体
function applyFont(font) {
    const root = document.documentElement;
    let fontFamily;
    
    switch (font) {
        case 'inter':
            fontFamily = '"Inter", "MiSans Latin", "Helvetica Neue", "Helvetica", "Roboto", "BlinkMacSystemFont", "MiSans", "HarmonyOS Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif';
            break;
        case 'harmonyos':
            fontFamily = '"HarmonyOS Sans SC", "HarmonyOS Sans", "MiSans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", "Inter", "MiSans Latin", "Helvetica Neue", "Helvetica", "Roboto", "BlinkMacSystemFont", Arial, sans-serif';
            break;
        case 'sans-serif':
            fontFamily = 'sans-serif';
            break;
        case 'system':
            fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';
            break;
        default:
            // 默认使用 Inter 字体
            fontFamily = '"Inter", "MiSans Latin", "Helvetica Neue", "Helvetica", "Roboto", "BlinkMacSystemFont", "MiSans", "HarmonyOS Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif';
            break;
    }
    
    root.style.setProperty('--font-family', fontFamily);
}

// 初始化减弱特效开关
function initReduceMotionSwitch() {
    const reduceMotionSwitch = document.querySelector('.reduce-motion');
    if (!reduceMotionSwitch) return;

    // 从 localStorage 获取保存的设置，默认为 false（关闭）
    const reduceMotion = localStorage.getItem('reduceMotion') === 'true';
    
    // 设置开关状态
    if (reduceMotion) {
        reduceMotionSwitch.classList.add('active');
    } else {
        reduceMotionSwitch.classList.remove('active');
    }
    
    // 应用当前设置
    applyReduceMotion(reduceMotion);
    
    // 添加点击事件
    reduceMotionSwitch.addEventListener('click', function() {
        const isActive = this.classList.toggle('active');
        localStorage.setItem('reduceMotion', isActive);
        applyReduceMotion(isActive);
    });
}

// 应用减弱特效设置
function applyReduceMotion(reduceMotion) {
    const root = document.documentElement;
    
    if (reduceMotion) {
        root.classList.add('effect-reduced');
    } else {
        root.classList.remove('effect-reduced');
    }
}

function handleWindowResize() {
    const searchBar = document.querySelector('header .search-bar');
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

    if (isVirtualKeyboardOpen || isInputFocused) return;
    
    // 只有在不是虚拟键盘导致的resize且输入框未聚焦时才执行布局调整
    if (window.innerWidth < 640) {
        searchBar.style.display = 'none';

        footer.style.opacity = 1;
        footer.style.opacity = 1;
        footer.style.justifyContent = 'flex-end';
    } else {
        footer.style.opacity = 0;
        searchBar.style.display = 'flex';
    }
    // 当虚拟键盘打开时(isVirtualKeyboardOpen为true)或输入框聚焦时，不执行任何布局调整操作
}

window.handleWindowResize = handleWindowResize;