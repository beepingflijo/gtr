// 页面加载完成后执行初始化函数
document.addEventListener('DOMContentLoaded', function () {
    fetch('strings.json')
        .then(stringsResponse => stringsResponse.json())
        .then(stringsData => {
            window.strings = stringsData;
            init();
            initFollowPlayersPref();
            initShowPlayersSwitch();
            initAllowNotificationsSwitch();
            initTrainApproachingSwitch();
            initNetworkWarningSwitch();
            initLanguageSelector();
            initThemeSelector();
            initFontSelector();
            initHistoryLimitInput();
            initResumeOnLoadingSwitch();
            initUseDialogSwitch();
            initOpenInContentSwitch();
            initShowFareCalculationSwitch();
            initCollapseSwitch();
            initSwapFooterSwitch();
            initShowCursorSwitch();
            initReduceMotionSwitch();
            initStorageList();
            handleWindowResize();
            
            // 初始化认证系统
            if (window.auth && window.auth.init) {
                window.auth.init();
            }
        })
    .catch(error => console.error('Error loading Language data:', error));
});

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

// 保存偏好设置
function savePreferences(prefs) {
    try {
        localStorage.setItem('preferences', JSON.stringify(prefs));
        if (typeof CloudSync !== 'undefined' && CloudSync.pushCloudData) CloudSync.pushCloudData();
    } catch (e) {
        console.error('Error saving preferences:', e);
    }
}

// 初始化函数
function init() {
    
    const headerTitle = document.querySelector('header h1');
    const pageTitle = document.querySelector('title');
    console.log(pageTitle.textContent);
    headerTitle.textContent = strings.preferences.page_title[lang];
    pageTitle.textContent = strings.preferences.page_title[lang] + ' - ' + strings.mainpage.gtr_info[lang];

    // 添加搜索功能
    const searchInputs = document.querySelectorAll('.search-input');
    searchInputs.forEach(searchInput => {
        searchInput.placeholder = strings.preferences.search_placeholder[lang];
        const urlSearchParams = new URLSearchParams(window.location.search);
        const searchQuery = urlSearchParams.get('q') || '';
        searchInput.value = searchQuery; // 从URL参数获取搜索词或设置为空
        searchInput.addEventListener('input', handleSearch);
    });

    window.addEventListener('resize', handleWindowResize);

    const backBtn = document.querySelector('.back-btn');
    backBtn.addEventListener('click', () => {
        window.open('index.html?lang='+lang, '_self');
    });
    backBtn.title = strings.general.back[lang];

    const rolePref = document.getElementById('rolePref');
    rolePref.textContent = strings.preferences.role_and_notifications[lang];
    const loginStatus = document.getElementById('loginStatus');
    const toggleLogin = document.getElementById('toggleLogin');
    toggleLogin.style.color = 'var(--color-primary)';
    
    // 初始化登录状态（后续由auth模块更新）
    loginStatus.textContent = strings.preferences.not_logged_in[lang];
    toggleLogin.textContent = strings.preferences.login[lang];

    // Initialize cloud sync label
    const cloudSyncPref = document.getElementById('cloudSyncPref');
    if (cloudSyncPref) cloudSyncPref.textContent = (strings.preferences.cloud_sync && strings.preferences.cloud_sync[lang]) || '云端同步';    
    const followPlayersPref = document.getElementById('followPlayersPref');
    followPlayersPref.textContent = strings.preferences.following_players[lang];
    const showPlayersPref = document.getElementById('showPlayersPref');
    showPlayersPref.textContent = strings.preferences.show_players_nearby[lang];
    const allowNotificationsPref = document.getElementById('allowNotificationPref');
    allowNotificationsPref.textContent = strings.preferences.allow_notifications[lang];
    const notifyTrainApproachingPref = document.getElementById('notifyTrainApproachingPref');
    notifyTrainApproachingPref.textContent = strings.preferences.notify_train_approaching[lang];
    const networkWarningPref = document.getElementById('notifyNetworkWarningPref');
    networkWarningPref.textContent = strings.preferences.notify_network_warning[lang];

    const generalPref = document.getElementById('generalPref');
    generalPref.textContent = strings.preferences.general[lang];
    const appearancePref = document.getElementById('appearancePref');
    appearancePref.textContent = strings.preferences.appearance[lang];
    const languagePref = document.getElementById('languagePref');
    languagePref.textContent = strings.preferences.language[lang];
    const themePref = document.getElementById('themePref');
    themePref.textContent = strings.preferences.theme_mode[lang];
    const fontPref = document.getElementById('fontPref');
    fontPref.textContent = strings.preferences.font[lang];
    const historyLimitPref = document.getElementById('historyLimitPref');
    historyLimitPref.textContent = strings.preferences.history_limit[lang];
    const setHistoryLimit = document.getElementById('setHistoryLimit');
    setHistoryLimit.textContent = strings.general.set[lang];
    setHistoryLimit.style.color = 'var(--color-primary)';
    const resumeOnLoadingPref = document.getElementById('resumeOnLoadingPref');
    resumeOnLoadingPref.textContent = strings.preferences.resume_on_loading[lang];
    const useDialogPref = document.getElementById('useDialogPref');
    useDialogPref.textContent = strings.preferences.use_system_dialog[lang];
    const openInContentPref = document.getElementById('openInContentPref');
    openInContentPref.textContent = strings.preferences.open_in_content[lang];
    const showFareCalculation = document.getElementById('showFareCalculationPref');
    showFareCalculation.textContent = strings.preferences.show_fare_calculation[lang];
    const collapsePref = document.getElementById('collapseSideBarPref');
    collapsePref.textContent = strings.preferences.collapse_sidebar[lang];
    const swapFooterPref = document.getElementById('swapFooterPref');
    swapFooterPref.textContent = strings.preferences.swap_footer_items[lang];
    const showCursorPref = document.getElementById('showCursorPref');
    showCursorPref.textContent = strings.preferences.hover_effects[lang];
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
    const versionPrefContainer = versionPref.parentElement;
    versionPrefContainer.addEventListener('click', () => {
        window.open('https://github.com/beepingflijo/gtr/commits', '_blank');
    });
    const refreshPref = document.getElementById('refreshPref');
    refreshPref.textContent = strings.preferences.refresh_all_files[lang];
    
    // 添加强制刷新按钮的事件监听器
    refreshPref.addEventListener('click', forceRefresh);

    // 实现languageHintPref每2秒轮流显示不同语言的功能
    const languageHintContainer = document.getElementById('languageHintPref');
    if (languageHintContainer) {
        languageHintContainer.innerHTML = ''; // 清空容器
        
        // 获取所有支持的语言，但排除当前页面语言
        const allLanguages = Object.keys(strings.preferences.language);
        const languages = allLanguages.filter(language => language !== lang);
        
        // 为每种语言创建一个span元素
        const languageElements = [];
        languages.forEach((languageCode, index) => {
            const langSpan = document.createElement('span');
            langSpan.className = 'language-hint-item';
            langSpan.textContent = strings.preferences.language[languageCode];
            langSpan.style.display = 'inline-block';
            langSpan.style.opacity = '0';
            langSpan.style.width = '0';
            langSpan.style.overflow = 'hidden';
            langSpan.style.whiteSpace = 'nowrap';
            langSpan.style.transition = 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            langSpan.style.marginRight = '4px';
            languageHintContainer.appendChild(langSpan);
            languageElements.push({
                element: langSpan,
                index: index
            });
        });
        
        let currentIndex = 0;
        
        // 每2秒轮流显示一种语言
        setInterval(() => {
            if (languageElements.length > 0) {
                const prefs = getPreferences();
                const transitionDuration = prefs.reduceMotion ? 0 : 300;
                
                // 先隐藏当前显示的语言
                languageElements.forEach(item => {
                    item.element.style.opacity = '0';
                    item.element.style.width = '0';
                    item.element.style.margin = '0';
                });
                
                // 延迟后显示下一个语言
                setTimeout(() => {
                    const currentItem = languageElements[currentIndex];
                    currentItem.element.style.opacity = '1';
                    currentItem.element.style.width = calculateTextWidth(currentItem.element.textContent) + 'em';
                    currentItem.element.style.margin = '4px';
                    currentIndex = (currentIndex + 1) % languageElements.length;
                }, transitionDuration);
            }
        }, 2000);
    }
    
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

    window.prefs = prefs;
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
        console.log('reduce motion change');
        if (event.matches) {
            html.classList.add('effect-reduced');
            prefs.reduceMotion = true;
            savePreferences(prefs);
        }
    })
}

async function initFollowPlayersPref() { 
    const prefs = getPreferences();
    let authmeUserName = ' ';
    authmeUserName = await window.getAuthmeUsernameByUsername();

    const followPlayers = document.getElementById('followPlayers');
    followPlayers.placeholder = strings.preferences.following_players_placeholder[lang];
    if (prefs.followPlayers) { 
        followPlayers.value = prefs.followPlayers.replace(authmeUserName,'').replace(/(^,)|(,$)/g,'');
    }
    followPlayers.addEventListener('change', () => { 
        console.log(followPlayers.value);
        prefs.followPlayers = authmeUserName+','+followPlayers.value;
        savePreferences(prefs);
    });
}

function initShowPlayersSwitch() { 
    const prefs = getPreferences();
    const showPlayersSwitch = document.querySelector('.show-players');
    // 默认开启显示玩家开关
    if (prefs.showPlayers !== false) { 
        showPlayersSwitch.classList.add('active');
        // 确保首次使用时保存默认值
        if (prefs.showPlayers === undefined) {
            prefs.showPlayers = true;
            savePreferences(prefs);
        }
    } else { 
        showPlayersSwitch.classList.remove('active');
    }
    showPlayersSwitch.addEventListener('click', function() { 
        const isActive = this.classList.toggle('active');
        prefs.showPlayers = isActive;
        savePreferences(prefs);
    });
}

function initAllowNotificationsSwitch() { 
    const prefs = getPreferences();
    const allowNotificationsSwitch = document.querySelector('.allow-notifications');
    // 默认关闭允许通知开关
    if (prefs.allowNotifications) { 
        allowNotificationsSwitch.classList.add('active');
        // 请求通知权限
        Notification.requestPermission().then(function(permission) { 
            if (permission === 'granted') { 
                // 允许通知，保存权限状态
                prefs.allowNotifications = true;
                savePreferences(prefs);
            }
        });
    } else { 
        allowNotificationsSwitch.classList.remove('active');
    }

    allowNotificationsSwitch.addEventListener('click', function() { 
        const isActive = this.classList.toggle('active');
        prefs.allowNotifications = isActive;
        savePreferences(prefs);
        initTrainApproachingSwitch();
        initNetworkWarningSwitch();
    });
}

function initTrainApproachingSwitch() {
    const prefs = getPreferences();
    const trainApproachingSwitch = document.querySelector('.notify-train-approaching');
    // 默认开启列车接近通知开关
    if (prefs.notifyTrainApproaching === true || prefs.notifyTrainApproaching === undefined) { 
        trainApproachingSwitch.classList.add('active');
        // 确保首次使用时保存默认值
        if (prefs.notifyTrainApproaching === undefined) {
            prefs.notifyTrainApproaching = true;
            savePreferences(prefs);
        }
    } else { 
        trainApproachingSwitch.classList.remove('active');
    }

    // 如果没有通知权限则淡化switch
    if (!prefs.allowNotifications) { 
        trainApproachingSwitch.style.opacity = '0.1';
        trainApproachingSwitch.style.cursor = 'not-allowed';
    } else { 
        trainApproachingSwitch.style.opacity = '1';
        trainApproachingSwitch.style.cursor = 'pointer';
    }

    trainApproachingSwitch.addEventListener('click', function() { 
        const isActive = this.classList.toggle('active');
        prefs.notifyTrainApproaching = isActive;
        savePreferences(prefs);
    });
}

function initNetworkWarningSwitch() { 
    const prefs = getPreferences();
    const networkWarningSwitch = document.querySelector('.notify-network-warning');
    // 默认开启网络警告开关
    if (prefs.notifyNetworkWarning !== false) { 
        networkWarningSwitch.classList.add('active');
        // 确保首次使用时保存默认值
        if (prefs.notifyNetworkWarning === undefined) {
            prefs.notifyNetworkWarning = true;
            savePreferences(prefs);
        }
    } else { 
        networkWarningSwitch.classList.remove('active');
    }

    // 如果没有通知权限则淡化switch
    if (!prefs.allowNotifications) { 
        networkWarningSwitch.style.opacity = '0.1';
        networkWarningSwitch.style.cursor = 'not-allowed';
    } else { 
        networkWarningSwitch.style.opacity = '1';
        networkWarningSwitch.style.cursor = 'pointer';
    }
    networkWarningSwitch.addEventListener('click', function() { 
        const isActive = this.classList.toggle('active');
        prefs.notifyNetworkWarning = isActive;
        savePreferences(prefs);
    });
}

// 强制刷新功能
function forceRefresh() {
    // 设置强制刷新标记
    const prefs = getPreferences();
    prefs.forceRefresh = true;
    savePreferences(prefs);
    
    // 显示提示信息
    showToast(strings.preferences.refresh_all_files_success[lang] || '刷新标记已设置，下次访问相关页面时将强制刷新', 3000);
}

// 重置所有数据
function resetAllData() {
    // 确认对话框
    pushDialog(strings.preferences.reset_all_data_confirm[lang], 'confirm-danger')
            .then(confirmed => {
                if (confirmed) {
                    // 清空localStorage
                    localStorage.clear();
                    
                    // 重新加载页面以应用更改
                    location.reload();
                    
                    // 显示提示
                    showToast(strings.preferences.reset_all_data_success[lang], 2000);
                } else {
                    return;
                }
            });
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

            const isEffectReduced = window.prefs.reduceMotion;
            if (isEffectReduced){
                item.style.border = '2px solid crimson';
            }
            else {
                item.style.background = 'linear-gradient(to right,rgba(255, 0, 0, 0.1) ,rgba(255, 0, 0, 0.05) 20%, rgba(255, 0, 0, 0.02) 80%, rgba(255, 0, 0, 0.05) 95%, rgba(255, 0, 0, 0.1))';
            }
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
    pushDialog(`${strings.preferences.confirm_remove_item[lang] || '确定要移除'} "${key}" ${strings.preferences.confirm_remove_item_end[lang] || '吗？'}`, 'confirm-danger')
            .then(confirmed => {
                if (confirmed) {
                    if (key === 'preferences') {
                        // 如果移除的是preferences项，则清空所有偏好设置
                        localStorage.removeItem('preferences');
                    } else {
                        localStorage.removeItem(key);
                    }
                    // 从DOM中移除元素
                    if (element && element.parentNode) {
                        element.parentNode.removeChild(element);
                    }
                    // 显示提示
                    showToast(`${strings.preferences.item_removed[lang] || '已移除'} "${key}"`, 2000);
                    initStorageList();
                } else {
                    return;
                }
            });
}

// 初始化主题选择器
function initThemeSelector() {
    const themeSelector = document.querySelector('.theme-selector');
    if (!themeSelector) return;

    // 从偏好设置中获取保存的主题设置，默认为 'system'
    const prefs = getPreferences();
    const savedTheme = prefs.theme || 'system';
    
    // 创建主题选项
    const themes = [
        { id: 'light', label: strings.preferences.theme_mode_light },
        { id: 'dark', label: strings.preferences.theme_mode_dark },
        { id: 'system', label: strings.preferences.theme_mode_system }
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
    // 保存到偏好设置
    const prefs = getPreferences();
    prefs.theme = theme;
    savePreferences(prefs);
    
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

    // 从偏好设置中获取保存的字体设置，默认为 'inter'
    const prefs = getPreferences();
    const savedFont = prefs.font || 'inter';
    
    // 创建字体选项
    const fonts = [
        { id: 'inter', label: 'HydCraft (Rubik + MiSans)' },
        { id: 'harmonyos', label: strings.mainpage.gt[lang]+' (HarmonyOS Sans)' },
        { id: 'sans-serif', label: strings.preferences.sans_serif },
        { id: 'serif', label: strings.preferences.serif },
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

        let fontFamily;    
        switch (font.id) {
            case 'inter':
                fontFamily = '"Rubik", "Helvetica Neue", "Helvetica", Arial, "MiSans Latin", "Roboto", "BlinkMacSystemFont", "MiSans", "HarmonyOS Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", sans-serif;';
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
                fontFamily = '"Rubik", "Helvetica Neue", "Helvetica", Arial, "MiSans Latin", "Roboto", "BlinkMacSystemFont", "MiSans", "HarmonyOS Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", sans-serif;';
                break;
        }
        item.setAttribute('style', `font-family: ${fontFamily};`);
        
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
    // 保存到偏好设置
    const prefs = getPreferences();
    prefs.font = font;
    savePreferences(prefs);
    
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
            fontFamily = '"Rubik", "Helvetica Neue", "Helvetica", Arial, "MiSans Latin", "Roboto", "BlinkMacSystemFont", "MiSans", "HarmonyOS Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", sans-serif;';
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
            fontFamily = 'unset';
            break;
        default:
            // 默认使用 Inter 字体
            fontFamily = '"Rubik", "Helvetica Neue", "Helvetica", Arial, "MiSans Latin", "Roboto", "BlinkMacSystemFont", "MiSans", "HarmonyOS Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", sans-serif;';
            break;
    }
    
    root.style.setProperty('--font-family', fontFamily);
}

function initHistoryLimitInput() { 
    const setHistoryLimit = document.getElementById('setHistoryLimit');
    if (!setHistoryLimit) return;
    setHistoryLimit.addEventListener('click', async function() { 
        const prefs = getPreferences();
        if (!prefs.historyLimit) {
            prefs.historyLimit = 5;
        }
        const previousLimit = prefs.historyLimit || 5;
        let newLimit = await pushDialog(strings.preferences.new_limit_apply_warning[lang], 'prompt', strings.preferences.set_history_limit[lang], previousLimit);
        console.log(newLimit);
        if (!newLimit) newLimit = previousLimit;
        let finalLimit = newLimit;
        
        if (newLimit < 1) finalLimit = 1;
        if (newLimit < previousLimit) {
            const confirmed = await pushDialog(strings.preferences.new_limit_reducing_warning[lang],'confirm-danger');
            if (confirmed) {
                finalLimit = newLimit;
            } else {
                finalLimit = previousLimit;
            }
        } else { 
            finalLimit = newLimit;
        }
        
        prefs.historyLimit = finalLimit;
        savePreferences(prefs);
    });
}

function initResumeOnLoadingSwitch() { 
    const sw = document.querySelector('.resume-on-loading');
    if (!sw) return;

    const prefs = getPreferences();
    if (prefs.resumeOnLoading !== false) { 
        sw.classList.add('active');
    } else { 
        sw.classList.remove('active');
    }
    sw.addEventListener('click', function() { 
        const isActive = this.classList.toggle('active');
        prefs.resumeOnLoading = isActive;
        savePreferences(prefs);
    });
}

function initUseDialogSwitch() { 
    const sw = document.querySelector('.use-system-dialog');
    if (!sw) return;

    const prefs = getPreferences();
    if (prefs.useSystemDialog !== false) { 
        sw.classList.add('active');
    } else { 
        sw.classList.remove('active');
    }
    sw.addEventListener('click', function() { 
        const isActive = this.classList.toggle('active');
        const prefs = getPreferences();
        prefs.useSystemDialog = isActive;
        savePreferences(prefs);
    });
}

function initOpenInContentSwitch() { 
    const sw = document.querySelector('.open-in-content');
    if (!sw) return;

    const prefs = getPreferences();
    if (prefs.openInContent !== true) { 
        sw.classList.remove('active');
    } else { 
        sw.classList.add('active');
    }
    sw.addEventListener('click', function() { 
        const isActive = this.classList.toggle('active');
        const prefs = getPreferences();
        prefs.openInContent = isActive;
        savePreferences(prefs);
    });
}

function initShowFareCalculationSwitch() { 
    const sw = document.querySelector('.show-fare-calculation');
    if (!sw) return;

    const prefs = getPreferences();
    if (prefs.showFareCalculation !== true) { 
        sw.classList.remove('active');
    } else { 
        sw.classList.add('active');
    }
    sw.addEventListener('click', function() { 
        const isActive = this.classList.toggle('active');
        const prefs = getPreferences();
        prefs.showFareCalculation = isActive;
        savePreferences(prefs);
    });
}

function initCollapseSwitch() { 
    const sw = document.querySelector('.collapse-sidebar');
    if (!sw) return;

    const prefs = getPreferences();
    if (prefs.collapseSidebar) { 
        sw.classList.add('active');
    } else { 
        sw.classList.remove('active');
    }

    sw.addEventListener('click', function() { 
        const isActive = this.classList.toggle('active');
        prefs.collapseSidebar = isActive;
        savePreferences(prefs);
    });
}

function initSwapFooterSwitch() { 
    const sw = document.querySelector('.swap-footer');
    if (!sw) return;

    const prefs = getPreferences();
    if (prefs.swapFooterItems) { 
        sw.classList.add('active');
    } else { 
        sw.classList.remove('active');
    }

    sw.addEventListener('click', function() { 
        const isActive = this.classList.toggle('active');
        prefs.swapFooterItems = isActive;
        savePreferences(prefs);
        handleWindowResize();
    });
}

function initShowCursorSwitch() { 
    const sw = document.querySelector('.show-cursor');
    if (!sw) return;

    const prefs = getPreferences();
    if (prefs.showCursor === true) { 
        sw.classList.add('active');
    } else { 
        sw.classList.remove('active');
    }

    sw.addEventListener('click', function() { 
        const isActive = this.classList.toggle('active');
        prefs.showCursor = isActive;
        savePreferences(prefs);
    });
}

// 初始化减弱特效开关
function initReduceMotionSwitch() {
    const sw = document.querySelector('.reduce-motion');
    if (!sw) return;

    // 从偏好设置中获取保存的设置，默认为 false（关闭）
    const prefs = getPreferences();
    const reduceMotion = prefs.reduceMotion || false;
    
    // 设置开关状态
    if (reduceMotion) {
        sw.classList.add('active');
    } else {
        sw.classList.remove('active');
    }
    
    // 应用当前设置
    applyReduceMotion(reduceMotion);
    
    // 添加点击事件
    sw.addEventListener('click', function() {
        const isActive = this.classList.toggle('active');
        const prefs = getPreferences();
        prefs.reduceMotion = isActive;
        savePreferences(prefs);
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

function resetPreferences() { 
    pushDialog(strings.preferences.reset_warning[lang], 'confirm-danger').then(confirmed => { 
        if (confirmed) { 
            localStorage.removeItem('preferences');
            location.reload();
        }
    });
}

window.resetPreferences = resetPreferences;

function handleWindowResize() {
    const searchBar = document.querySelector('header .search-bar');
    const footer = document.querySelector('footer');
    const header = document.querySelector('header');
    const main = document.querySelector('main');
    const languageSelector = document.querySelector('.language-selection');

    const prefItems = document.querySelectorAll('.pref-item');
    prefItems.forEach(item => { 
        if (item.classList.contains('storage-list')) return;
        item.style.flexDirection = 'row';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'space-between';
        item.style.height = '30px';

        item.querySelector('*').style.width = 'fit-content';
        let itemTotalWidth = 0;
        let itemTotalHeight = 0;
        Array.from(item.children).forEach(child => { 
            const childWidth = child.getBoundingClientRect().width;
            itemTotalWidth += childWidth;
            itemTotalHeight += child.getBoundingClientRect().height;
        });
        const changeDirection = itemTotalWidth + 36 > item.getBoundingClientRect().width;
        if (changeDirection) { 
            item.style.flexDirection = 'column';
            item.style.alignItems = 'flex-end';
            item.style.justifyContent = 'flex-start';
            item.style.height = itemTotalHeight + 8 + 'px';
            item.querySelector('*').style.width = '-webkit-fill-available';
        }
        // 如果item的子元素有#followPlayers
        if (item.querySelector('#followPlayers')) { 
            item.style.height = 'fit-content';
        }
        // 如果item的id是moreLinkPref
        if (item.id === 'moreLinkPref') { 
            item.style.justifyContent = 'flex-start';
            item.style.alignItems = 'flex-start';
            item.style.height = 'fit-content';
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
    const input = document.querySelector('.search-input');
    const isInputFocused = input && input === document.activeElement;
    const swapFooterItems = getPreferences().swapFooterItems;
    if (swapFooterItems) footer.classList.add('swapped');
    else footer.classList.remove('swapped');

    if (isVirtualKeyboardOpen || isInputFocused) return;
    
    // 只有在不是虚拟键盘导致的resize且输入框未聚焦时才执行布局调整
    if (window.innerWidth < 720) {
        searchBar.style.display = 'none';
        footer.style.display = 'flex';
        setTimeout(() => {
            footer.style.opacity = 1;
            footer.style.filter = '';
            footer.style.transform = '';
            footer.style.height = '';
        }, 100);
    } else {
        footer.style.opacity = 0;
        footer.style.height = 0;
        footer.style.filter = 'blur(24px)';
        footer.style.transform = 'scale(1.2)';
        searchBar.style.display = 'flex';
        setTimeout(() => {
            footer.style.display = 'none';
        }, 10);
    }
    // 当虚拟键盘打开时(isVirtualKeyboardOpen为true)或输入框聚焦时，不执行任何布局调整操作
}

window.handleWindowResize = handleWindowResize;