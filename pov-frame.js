let activeLineId;
let activeLine = [];
let actionList = [];
let widthList = [];
let actionListAssembled = false;
let activeStepIndex = 0;
let isUpwards = false;

document.addEventListener('DOMContentLoaded', function () { 
    fetch('./data/lines.json')
        .then(response => response.json())
        .then(data => {
            window.lines = data.lines;
            init();
            initLineSelector();
            initUpwardsSwitch();
            initStationList();
            handleWindowResize();
            window.addEventListener('resize', handleWindowResize);
        })
        .catch(error => console.error('Error loading lines data:', error));
});

function init() { 
    const backBtn = document.querySelector('.back-btn');
    backBtn.addEventListener('click', () => {
        window.open('index.html?lang='+lang, '_self');
    });
    const prevBtn = document.querySelector('.prev-btn');
    prevBtn.addEventListener('click', () => {
        activeStepIndex--;
        if (activeStepIndex < 0) activeStepIndex = 0;
        refreshFrame();
        refreshStationList();
    });
    const nextBtn = document.querySelector('.next-btn');
    nextBtn.addEventListener('click', () => { 
        activeStepIndex++;
        if (activeStepIndex > actionList.length - 1) activeStepIndex = actionList.length - 1;
        refreshFrame();
        refreshStationList();
    });
}

function initLineSelector() { 
    const selector = document.querySelector('.line-selector');

    const lines = window.lines || [];
    if (!selector || !lines.length) return;

    selector.querySelectorAll('.selection-item').forEach(child => child.classList.remove('active'));

    // 为每个线路创建选项
    lines.forEach((line,index) => {
        const item = document.createElement('div');
        item.className = 'selection-item';
        item.textContent = line.name.zh_hans;
        item.dataset.line = line.id;
        
        // 添加点击事件
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            // 移除之前的激活状态
            const previousActive = selector.querySelector('.selection-item.active');
            if (previousActive) {
                previousActive.classList.remove('active');
            }
            // 设置当前项为激活状态
            this.classList.add('active');
            activeLine = line;
            activeLineId = this.dataset.line;
            this.style.setProperty('--color-primary', line.color);

            initStationList();
            refreshFrame();
            //handleWindowResize();
            
        });
        
        selector.appendChild(item);
        if (index === 0) item.click(); // 默认选择第一条线路
    });
}

function refreshFrame() {     
    const frame = document.querySelector('.frame-container');
    if (!frame) {
        console.error('Frame container not found');
        return;
    }
    if (!activeLine) {
        console.error('Active line not set');
        return;
    }
    
    frame.style.setProperty('--color-primary', activeLine.color);

    const lineName = frame.querySelector('.line-name');
    if (lineName) {
        lineName.textContent = activeLine.name.zh_hans;
    }
    const lineNameEn = frame.querySelector('.line-name-en');
    if (lineNameEn) {
        lineNameEn.textContent = activeLine.name.en;
    }

    // 根据actionList组装station-name-container
    const stationNameContainer = frame.querySelector('.station-name-container');
    if (actionListAssembled === false && stationNameContainer) {
        console.log('Assembling station name container...');
        stationNameContainer.innerHTML = ''; // 清空现有内容
        widthList = [];
        stationNameContainer.style.opacity = 0;
        if (actionList && actionList.length > 0) {
            actionList.forEach((action, index) => {
                const currentStation = action.station;
                if (action.type === 'nextStation') {
                    // 创建实际的 DOM 元素而不是字符串
                    const element = document.createElement('div');
                    element.className = 'next-arrow-container hidden';
                    element.dataset.id = 'next-'+currentStation;
                    element.innerHTML = `
                        <div class="frame-text-accent next-arrow">→</div>
                        <div class="frame-text-lines next-secondary">
                            <div class="frame-text next-text">下一站</div>
                            <div class="frame-text-secondary next-text-en">Next Station</div>
                        </div>
                    `;
                    
                    // 先添加到 DOM 中才能测量宽度
                    stationNameContainer.appendChild(element);
                    const width = element.getBoundingClientRect().width;
                    
                    widthList.push({
                        id: 'next-'+currentStation,
                        width: width,
                    });
                } else if (action.type === 'arrive') {
                    const platform = action.platform;
                    // 创建实际的 DOM 元素而不是字符串
                    const stationNames = getLanguageListForStation(action.station);
                    // 统一使用 createElement 方式
                    const element = document.createElement('div');
                    element.className = 'station-names hidden';
                    element.dataset.id = currentStation;
                    element.innerHTML = `
                        <div class="frame-text-accent station-name-accent">${stationNames[0].name}</div>
                        <div class="frame-text-lines station-name-secondary">
                            <div class="frame-text station-name-hant">${stationNames[1].name}</div>
                            <div class="frame-text-secondary station-name-en">${stationNames[2].name}</div>
                        </div>
                    `;
                    
                    stationNameContainer.appendChild(element);
                    const width = element.getBoundingClientRect().width;
                    
                    widthList.push({
                        id: currentStation,
                        width: width,
                    });
                    const platformElement = document.createElement('div');
                    platformElement.className = 'platform-container hidden';
                    platformElement.dataset.id = 'platform-'+currentStation;
                    platformElement.innerHTML = `
                        <div class="frame-text-accent platform-accent">${platform}</div>
                        <div class="frame-text-lines platform-secondary">
                            <div class="frame-text platform-text">站台</div>
                            <div class="frame-text-secondary platform-text-en">Platform</div>
                        </div>
                    `;
                    
                    // 先添加到 DOM 中才能测量宽度
                    stationNameContainer.appendChild(platformElement);
                    const platformElementWidth = platformElement.getBoundingClientRect().width;
                    
                    widthList.push({
                        id: 'platform-'+currentStation,
                        width: platformElementWidth,
                    });
                }
            });
            actionListAssembled = true;
            console.log('Station name container assembled');
        } else {
            console.warn('No actionList data available');
        }
        setInterval(function() { 
            stationNameContainer.style.opacity = 1;
        }, 1200);
    }

    // 安全检查：确保必要元素存在
    if (!stationNameContainer) {
        console.error('Station name container not found');
        return;
    }
    if (!actionList || actionList.length === 0) {
        console.warn('No action list data available');
        return;
    }

    const activeStep = actionList[activeStepIndex];
    
    // 安全检查：确保当前步骤存在
    if (!activeStep) {
        console.error('No active step found at index:', activeStepIndex);
        console.error('Available indices:', actionList.map((_, i) => i));
        return;
    }

    // 修复：使用正确的子元素遍历方式，添加详细的调试信息
    console.log('Active step:', activeStep);
    console.log('Children count:', stationNameContainer.children.length);
    
    const children = stationNameContainer.children;
    let stations;
    switch (isUpwards) {
        case true: 
            stations = activeLine.route.filter(step => step.type === 'station').reverse();
            break;
        default:
            stations = activeLine.route.filter(step => step.type === 'station');
    }
    let stationFound = false;
    let pastStations = [];
    stations.forEach(station => { 
        if (station.code === activeStep.station) { 
            // 当前车站
            stationFound = true;
            //查找dataset-id为station.code的元素
            const stationElement = document.querySelector(`[data-id="${station.code}"]`);
            if (stationElement) { 
                // 找到元素
                stationElement.classList.remove('hidden','out','collapsed');
                // 修正：需要访问.name属性才能获取字符串长度
                stationElement.style.width = 
                    getLanguageListForStation(station.code)[0].name.length * 4.2 +
                    Math.max(getLanguageListForStation(station.code)[1].name.length * 1.25 ,
                    getLanguageListForStation(station.code)[2].name.length * 0.8 ) + 'em';
            }
            switch (activeStep.type) { 
                case 'nextStation':
                    const platformForNext = document.querySelector(`[data-id="platform-${station.code}"]`);
                    if (platformForNext) { 
                        platformForNext.classList.remove('out','collapsed');
                        platformForNext.classList.add('hidden');
                        //platform.style.width = widthList.find(item => item.id === `platform-${station.code}`).width;
                    }
                    const nextStation = document.querySelector(`[data-id="next-${station.code}"]`);
                    if (nextStation) { 
                        nextStation.classList.remove('hidden','out','collapsed');
                        //nextStation.style.width = getLanguageListForStation(station.code)[0].length * 8 + 'em';
                    }
                    break;
                case 'arrive':
                    const nextStationForArrive = document.querySelector(`[data-id="next-${station.code}"]`);
                    if (nextStationForArrive) { 
                        nextStationForArrive.classList.remove('hidden','out');
                        nextStationForArrive.classList.add('collapsed');
                        //nextStation.style.width = getLanguageListForStation(station.code)[0].length * 8 + 'em';
                    }
                    if (activeStep.platform === '' || !activeStep.platform) break;
                    const platform = document.querySelector(`[data-id="platform-${station.code}"]`);
                    if (platform) { 
                        platform.classList.remove('hidden','out','collapsed');
                        //platform.style.width = widthList.find(item => item.id === `platform-${station.code}`).width;
                    }
                    
            }
        } else if (stationFound === true) { 
            // 未来车站
            //查找dataset-id为station.code的元素
            const stationElement = document.querySelector(`[data-id="${station.code}"]`);
            if (stationElement) { 
                stationElement.classList.remove('out','collapsed');
                stationElement.classList.add('hidden');
                stationElement.style.width = 0;
            }
            const nextStation = document.querySelector(`[data-id="next-${station.code}"]`);
            if (nextStation) { 
                nextStation.classList.remove('out','collapsed');
                nextStation.classList.add('hidden');
                //nextStation.style.width = 0;
            }
            const platform = document.querySelector(`[data-id="platform-${station.code}"]`);
            if (platform) { 
                platform.classList.remove('out','collapsed');
                platform.classList.add('hidden');
                //platform.style.width = 0;
            }
        } else { 
            // 已过车站
            //查找dataset-id为station.code的元素
            const stationElement = document.querySelector(`[data-id="${station.code}"]`);
            if (stationElement) { 
                stationElement.classList.remove('out','hidden');
                stationElement.classList.add('collapsed');
                stationElement.style.width = 0;
            }
            const nextStation = document.querySelector(`[data-id="next-${station.code}"]`);
            if (nextStation) { 
                nextStation.classList.remove('out','hidden');
                nextStation.classList.add('collapsed');
                //nextStation.style.width = 0;
            }
            const platform = document.querySelector(`[data-id="platform-${station.code}"]`);
            if (platform) { 
                platform.classList.remove('out','hidden');
                platform.classList.add('collapsed');
                //platform.style.width = 0;
            }
        }
    });
}

function getLanguageListForStation(stationCode) {
    const stationNames = window.strings.station_names[stationCode];
    const languages = [];
    // 如果stationCode以A开头则添加乌克兰语
    const addUk = stationCode.startsWith('A');
    if (stationNames.original) languages.push({ code: 'original', name: stationNames.original });
    if (stationNames.zh_hans) languages.push({ code: 'zh_hans', name: stationNames.zh_hans });
    if (stationNames.zh_hant && stationNames.zh_hant != languages[0].name) languages.push({ code: 'zh_hant', name: stationNames.zh_hant });
    console.log(languages);
    if (stationNames.en) languages.push({ code: 'en', name: stationNames.en + (languages.length >= 2 && addUk ? (' / ' + stationNames.uk) : '') });
    if (addUk) languages.push({ code: 'uk', name: stationNames.uk });
    if (languages.length < 3) {
        languages.push({ code: 'end', name: '' });
    }
    return languages;
}

function initUpwardsSwitch() {
    const switchElement = document.querySelector('.set-upwards');
    if (!switchElement) return;
    if (isUpwards) {
        switchElement.classList.add('active');
    } else { 
        switchElement.classList.remove('active');
    }

    switchElement.addEventListener('click', () => {
        isUpwards = !isUpwards;
        switchElement.classList.toggle('active');
        initStationList();
        refreshStationList();
    });
}

function initStationList() {
    const list = document.querySelector('.station-list');
    if (!list) return;
    console.log('initStationList');
    list.innerHTML = ''; // 清空现有列表
    actionList = [];
    actionListAssembled = false;
    activeStepIndex = 0;
    
    // 修复：正确访问线路的route属性
    const activeStations = !isUpwards ? activeLine.route.filter(step => step.type === 'station') : activeLine.route.filter(step => step.type === 'station').reverse();
    activeStations.forEach((station, index) => {
        if (index > 0){
            const nextStaItem = document.createElement('div');
            nextStaItem.className = 'pref-item station-item';
            nextStaItem.textContent = '下一站 ' + window.strings.station_names[station.code].zh_hans;
            nextStaItem.addEventListener('click', () => { 
                activeStepIndex = index * 2 - 1;
                refreshFrame();
                refreshStationList();
            });
            list.appendChild(nextStaItem);
            actionList.push({ 
                type: 'nextStation', 
                station: station.code,
                platform: ''
            });
        }
        const item = document.createElement('div');
        item.className = 'pref-item station-item';
        item.textContent = '到达 ' + window.strings.station_names[station.code].zh_hans;
        item.addEventListener('click', () => { 
            activeStepIndex = index * 2;
            refreshFrame();
            refreshStationList();
        });
        list.appendChild(item);
        actionList.push({ 
            type: 'arrive', 
            station: station.code,
            platform: ''
        });
    });
    refreshFrame();
    refreshStationList();
}

function refreshStationList() { 
    const list = document.querySelectorAll('.station-list .station-item');
    if (list && list.length > 0) {
        list.forEach((item, index) => {
            item.classList.remove('active');
            if (index === activeStepIndex) {
                item.classList.add('active');
            }
        });
    }
}

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

function handleWindowResize() {
    // 添加空值检查确保所有DOM元素都存在
    const searchBar = document.querySelector('header .search-bar');
    const footer = document.querySelector('footer');
    const header = document.querySelector('header');
    const main = document.querySelector('main');
    const languageSelector = document.querySelector('.language-selection');

    // 为这些元素添加安全检查（如果后续代码需要使用它们的话）
    if (searchBar) {
        // 后续可以在这里处理searchBar相关逻辑
    }
    if (footer) {
        // 后续可以在这里处理footer相关逻辑
    }
    if (header) {
        // 后续可以在这里处理header相关逻辑
    }
    if (main) {
        // 后续可以在这里处理main相关逻辑
    }
    if (languageSelector) {
        // 后续可以在这里处理languageSelector相关逻辑
    }

    const prefItems = document.querySelectorAll('.pref-item');
    prefItems.forEach(item => { 
        if (!item.classList.contains('station-list')) {
            item.style.flexDirection = 'row';
            item.style.alignItems = 'center';
            item.style.justifyContent = 'space-between';
            item.style.height = '30px';

            // 修复：添加空值检查
            const firstChild = item.querySelector('*');
            if (firstChild) {
                firstChild.style.width = 'fit-content';
            }
            
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
                // 修复：添加空值检查
                const firstChild = item.querySelector('*');
                if (firstChild) {
                    firstChild.style.width = '-webkit-fill-available';
                }
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
        }
    });

    const expandWindowText = document.querySelector('#expandWindowText');
    if (window.innerHeight < window.innerWidth * 0.8) {
        expandWindowText.style.opacity = 1;
    } else { 
        expandWindowText.style.opacity = 0;
    }
}