let activeLineId;
let activeLine = [];
let actionList = [];
let widthList = [];
let actionListAssembled = false;
let activeStepIndex = 0;
let isUpwards = false;
let newStationCount = 2;

document.addEventListener('DOMContentLoaded', function () { 
    fetch('./data/lines.json')
        .then(response => response.json())
        .then(data => {
            window.lines = data.lines;
            init();
            initBackgroundModeSelector();
            initLineSelector();
            initLineNameInputs();
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
    const previewContainer = document.querySelector('.preview-container');
    previewContainer.addEventListener('wheel', (e) => { 
        e.preventDefault();
        // 根据滚动方向调整activeStepIndex
        if (e.deltaY > 0) { 
            // 向上滚动，前进
            activeStepIndex++;
            if (activeStepIndex > actionList.length - 1) activeStepIndex = actionList.length - 1;
            refreshFrame();
            refreshStationList();
        } else { 
            // 向下滚动，后退
            activeStepIndex--;
            if (activeStepIndex < 0) activeStepIndex = 0;
            refreshFrame();
            refreshStationList();
        }
    });
}

function initBackgroundModeSelector() { 
    const selector = document.querySelector('.background-mode-selector');
    if (!selector) return;

    selector.innerHTML = ''; // 清空现有选项
    // 为每个背景模式创建选项
    const modes = [
        { id: 'transparent', name: '透明（直接叠加）' },
        { id: 'color', name: '纯色（抠像）' },
        { id: 'video', name: '导入视频' },
        { id: 'capture', name: '屏幕捕获（电脑）' },
    ];
    modes.forEach(mode => {
        const item = document.createElement('div');
        item.className = 'selection-item';
        item.textContent = mode.name;
        item.dataset.background = mode.id;
        selector.appendChild(item);
    });
    // 添加点击事件
    selector.querySelectorAll('.selection-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            // 移除之前的激活状态
            const previousActive = selector.querySelector('.selection-item.active');
            if (previousActive) {
                previousActive.classList.remove('active');
            }
            // 添加当前项的激活状态
            this.classList.add('active');
            // 获取当前激活的选项的data-background属性
            const background = this.dataset.background;
            applyBackgroundMode(background);
        });
    });
    selector.querySelectorAll('.selection-item')[0].click(); // 默认选择第一个选项
}

function applyBackgroundMode(mode) {
    const previewBackground = document.querySelector('.preview-background');
    const customBackground = document.querySelector('.custom-background');
    if (!previewBackground || !customBackground) return;
    previewBackground.innerHTML = ''; // 清空现有背景
    // 停止所有的屏幕共享
    const existingVideos = previewBackground.querySelectorAll('video');
    existingVideos.forEach(video => {
        const stream = video.srcObject;
        if (stream) {
            stream.getTracks().forEach(track => {
                track.stop();
                video.srcObject = null;
                video.remove();
            });
        }
    });
    // 修复：将 HTMLCollection 转换为数组后再使用 forEach
    Array.from(customBackground.children).forEach(child => {
        child.style.width = 0;
        child.style.minWidth = 0;
        child.style.margin = 0;
        child.style.padding = 0;
        child.style.opacity = 0;
        child.style.whiteSpace = 'nowrap';
    });
    customBackground.parentElement.style.height = 0;
    customBackground.parentElement.style.opacity = 0;
    customBackground.style.overflow = 'hidden';
    customBackground.parentElement.style.padding = '0 12px';
    const colorInput = document.getElementById('backgroundColorInput');
    const videoInput = document.getElementById('backgroundVideoInput');
    videoInput.value = ''; // 重置视频输入
    const videoControls = document.querySelector('.video-controls');

    switch (mode) {
        case 'transparent':
            previewBackground.style.backgroundColor = 'transparent';
            break;
        case 'color':
            customBackground.parentElement.style.height = '30px';
            customBackground.parentElement.style.opacity = 1;
            customBackground.parentElement.style.padding = '4px 12px';
            colorInput.style.width = '24px';
            colorInput.style.opacity = 1;
            colorInput.style.margin = 'unset';
            colorInput.style.padding = '';
            previewBackground.style.backgroundColor = colorInput.value;
            colorInput.addEventListener('input', (e) => {
                const color = e.target.value;
                previewBackground.style.backgroundColor = color;
            });
            break;
        case 'video':
            customBackground.parentElement.style.height = '30px';
            customBackground.parentElement.style.opacity = 1;
            customBackground.parentElement.style.padding = '4px 12px';            
            // 添加视频背景
            videoInput.style.width = '240px';
            videoInput.style.opacity = 1;
            videoInput.style.margin = 'unset';
            videoInput.style.padding = '';
            //videoControls.style.width = '120px';
            //videoControls.style.opacity = 1; 视频控制暂不支持
            videoInput.addEventListener('change', (e) => { 
                const video = e.target.files[0];
                if (video) { 
                    const videoURL = URL.createObjectURL(video);
                    previewBackground.innerHTML = ''; // 清空现有背景
                    const videoElement = document.createElement('video');
                    videoElement.src = videoURL;
                    videoElement.autoplay = true;
                    videoElement.loop = true;
                    videoElement.muted = true;
                    videoElement.style.width = '100%';
                    videoElement.style.height = '100%';
                    videoElement.style.objectFit = 'cover';
                    previewBackground.appendChild(videoElement);
                }
            });
            break;
        case 'capture':
            customBackground.parentElement.style.height = '30px';
            customBackground.parentElement.style.opacity = 1;
            customBackground.parentElement.style.padding = '4px 12px';  
            // 添加屏幕捕获背景
            const captureButton = document.querySelector('.capture-screen-btn');
            captureButton.style.width = '120px';
            captureButton.style.opacity = 1;
            customBackground.style.overflow = 'visible';
            captureButton.style.padding = 'unset';
            captureButton.addEventListener('click', async () => {
                try {
                    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                    previewBackground.innerHTML = ''; // 清空现有背景
                    const videoElement = document.createElement('video');
                    videoElement.srcObject = stream;
                    videoElement.autoplay = true;
                    videoElement.style.width = '100%';
                    videoElement.style.height = '100%';
                    videoElement.style.objectFit = 'cover';
                    previewBackground.appendChild(videoElement);
                } catch (err) {
                    console.error('Error accessing display media:', err);
                }
            });
            break;
        default:
            console.error('Invalid background mode:', mode);    
    }
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
            if (activeLineId === 'manual') {
                // 保存activeLine到window.lines
                window.lines.push(activeLine);
            }
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
            actionListAssembled = false;
            refreshFrame();
            //handleWindowResize();
            
        });
        
        selector.appendChild(item);
        if (index === 0) item.click(); // 默认选择第一条线路
    });

    const editItem = selector.querySelectorAll('.selection-item')[0];
    editItem.addEventListener('click', function(e) { 
        e.stopPropagation();
        if (window.lines.find(line => line.id === 'manual')) {
            activeLine = window.lines.find(line => line.id === 'manual');
            activeLineId = this.dataset.line;
        } else {
            const exampleLine = { 
                id: 'manual',
                name: { zh_hans: '自定义线路', en: 'Custom Line' },
                color: '#E77000',
                route: [
                    { code: 'M001', name:['第一站','First Station'], type: 'station' },
                    { code: 'M002', name:['终点站','終點站','Terminal Station'], type: 'station' },
                ]
            };
            activeLine = exampleLine;
            activeLineId = this.dataset.line;
        }
        this.parentElement.querySelectorAll('.selection-item').forEach(child => child.classList.remove('active'));
        this.style.setProperty('--color-primary', activeLine.color);
        this.classList.add('active');
        

        initStationList();
        actionListAssembled = false;
        refreshFrame();
        //handleWindowResize();
    });
}

function initLineNameInputs() {
    const lineNameInputContainer = document.querySelector('.line-name-input-container');
    if (!lineNameInputContainer) return;
    lineNameInputContainer.parentElement.style.height = activeLineId === 'manual' ? '30px' : '0px';
    lineNameInputContainer.parentElement.style.overflow = 'hidden';
    lineNameInputContainer.parentElement.style.minHeight = 0;
    lineNameInputContainer.parentElement.style.padding = activeLineId === 'manual' ? '4px 12px' : '0px 12px';
    lineNameInputContainer.parentElement.style.opacity = activeLineId === 'manual' ? 1 : 0;
    const nameInput1 = document.querySelector('#lineNameInput1');
    const nameInput2 = document.querySelector('#lineNameInput2');
    const colorInput = document.querySelector('#lineColorInput');
    nameInput1.value = activeLine.name.zh_hans;
    nameInput1.addEventListener('input', function() { 
        activeLine.name.zh_hans = this.value;
        refreshFrame();
    });
    nameInput2.value = activeLine.name.en;
    nameInput2.addEventListener('input', function() { 
        activeLine.name.en = this.value;
        refreshFrame();
    });
    colorInput.value = activeLine.color;
    colorInput.addEventListener('input', function() { 
        activeLine.color = this.value;
        refreshFrame();
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
        //console.log('Assembling station name container...');
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
            //console.log('Station name container assembled');
        } else {
            console.warn('No actionList data available');
        }
        setInterval(function() { 
            stationNameContainer.style.opacity = 1;
        }, 1200);
    } else if (stationNameContainer) {
        // 站台信息可能会在组装后才会更新
        actionList.forEach((action,index) => {
            if (action.type === 'arrive') {
                const platformElement = stationNameContainer.querySelector(`[data-id="platform-${action.station}"]`);
                if (platformElement) {
                    const platformText = platformElement.querySelector('.platform-accent');
                    if (platformText) {
                        platformText.textContent = action.platform;
                    } else {
                        platformElement.classList.add(index > activeStepIndex ? 'collapsed' : 'hidden');
                        platformElement.width = 0;
                    }
                }
            }
        });
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
    //console.log('Active step:', activeStep);
    //console.log('Children count:', stationNameContainer.children.length);
    
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
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    stations.forEach((station,index) => { 
        if (station.code === activeStep.station) { 
            // 当前车站
            stationFound = true;
            if (index === stations.length - 1 && activeStep.type === 'arrive') {
                prevBtn.style.opacity = 1;
                prevBtn.style.cursor = 'pointer';
                nextBtn.style.opacity = 0.1;
                nextBtn.style.cursor = 'not-allowed';
            } else if (index === 0) { 
                prevBtn.style.opacity = 0.1;
                prevBtn.style.cursor = 'not-allowed';
                nextBtn.style.cursor = 'pointer';
                nextBtn.style.opacity = 1;
            } else { 
                prevBtn.style.opacity = 1;
                prevBtn.style.cursor = 'pointer';
                nextBtn.style.cursor = 'pointer';
                nextBtn.style.opacity = 1;
            }
            //查找dataset-id为station.code的元素
            const stationElement = document.querySelector(`[data-id="${station.code}"]`);
            if (stationElement) { 
                // 找到元素
                stationElement.classList.remove('hidden','out','collapsed');
                // 修正：需要访问.name属性才能获取字符串长度
                stationElement.style.width = 
                    calculateTextWidth(getLanguageListForStation(station.code)[0].name) * 4.2 +
                    Math.max(calculateTextWidth(getLanguageListForStation(station.code)[1].name) * 2.2 ,
                    calculateTextWidth(getLanguageListForStation(station.code)[2].name) * 1.4) + 1 + 'em';
            }
            switch (activeStep.type) { 
                case 'nextStation':
                    const platformForNext = document.querySelector(`[data-id="platform-${station.code}"]`);
                    if (platformForNext) { 
                        platformForNext.classList.remove('out','collapsed');
                        platformForNext.classList.add('hidden');
                        platformForNext.style.width = 0;
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
                        platform.style.width = calculateTextWidth(activeStep.platform) * 4.2 + 8 + 'em';
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
                platform.style.width = 0;
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
                platform.style.width = 0;
            }
        }
    });
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

function getLanguageListForStation(stationCode) {
    const stationNames = window.strings.station_names[stationCode];
    const languages = [];
    if (activeLineId === 'manual') { 
        const stationNamesForManual = activeLine.route.find(station => station.code === stationCode).name;
        for (let index = 0; index < 3; index++) { 
            const name = stationNamesForManual[index];
            if (name) languages.push({ code: 'manual-' + index, name: name });
            else languages.push({ code: 'end', name: '' });
        }
    } else { 
        // 如果stationCode以A开头则添加乌克兰语
        const addUk = stationCode.startsWith('A');
        if (stationNames.original) languages.push({ code: 'original', name: stationNames.original });
        if (stationNames.zh_hans) languages.push({ code: 'zh_hans', name: stationNames.zh_hans });
        if (stationNames.zh_hant && stationNames.zh_hant != languages[0].name) languages.push({ code: 'zh_hant', name: stationNames.zh_hant });
        //console.log(languages);
        if (stationNames.en) languages.push({ code: 'en', name: stationNames.en + (languages.length >= 2 && addUk ? (' / ' + stationNames.uk) : '') });
        if (addUk) languages.push({ code: 'uk', name: stationNames.uk });
        if (languages.length < 3) {
            languages.push({ code: 'end', name: '' });
        }
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
        actionListAssembled = false;
        initStationList();
        refreshStationList();
    });
}

function initStationList() {
    const list = document.querySelector('.station-list');
    if (!list) return;
    //console.log('initStationList');
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
            nextStaItem.textContent = '下一站 ' + getLanguageListForStation(station.code)[0].name;
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
        const actionSpan = document.createElement('span');
        actionSpan.textContent = '到达 ' + getLanguageListForStation(station.code)[0].name;
        item.appendChild(actionSpan);
        item.addEventListener('click', () => { 
            activeStepIndex = index * 2;
            refreshFrame();
            refreshStationList();
        });

        const stationInputContainer = document.createElement('div');
        stationInputContainer.className = 'station-input-container';
        stationInputContainer.style.display = 'flex';
        stationInputContainer.style.flexDirection = 'row';
        stationInputContainer.style.alignItems = 'center';
        stationInputContainer.style.justifyContent = 'flex-end';
        
        if (activeLineId === 'manual') {
            for (let i = 0; i < 3; i++) { 
                const nameInput = document.createElement('input');
                nameInput.type = 'text';
                nameInput.placeholder = '站名' + (i + 1);
                nameInput.className = 'name-input';
                nameInput.id = 'name-input-' + i + '-' + station.code;
                nameInput.style.minWidth = 0;
                nameInput.style.width = '40px';
                nameInput.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                nameInput.addEventListener('input', (e) => { 
                    const value = e.target.value;
                    // 更新activeLine中的对应车站名称
                    const stationInRoute = activeLine.route.find(s => s.code === station.code);
                    if (stationInRoute) {
                        stationInRoute.name[i] = value;
                    }
                    // 如果是第0个输入框，更新item的文本内容
                    if (i === 0) {
                        actionSpan.textContent = '到达 ' + value;
                    }
                    actionListAssembled = false;
                    refreshFrame();
                    refreshStationList();
                });
                nameInput.value = activeLine.route.find(s => s.code === station.code).name[i] || '';
                stationInputContainer.appendChild(nameInput);
            }
        }

        const platformInput = document.createElement('input');
        platformInput.type = 'text';
        platformInput.placeholder = '站台';
        platformInput.className = 'platform-input';
        platformInput.style.minWidth = 0;
        platformInput.style.width = '24px';
        platformInput.id = 'platform-input-' + station.code;
        platformInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        platformInput.addEventListener('input', (e) => { 
            const value = e.target.value;
            // 更新actionList中的对应平台信息
            const actionIndex = actionList.findIndex(action => action.type === 'arrive' && action.station === station.code);
            if (actionIndex !== -1) {
                actionList[actionIndex].platform = value;
            }
            refreshFrame();
        });
        stationInputContainer.appendChild(platformInput);

        if (activeLineId === 'manual') {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.textContent = '×';
            deleteButton.addEventListener('mouseover', (e) => {
                deleteButton.style.color = '#ff4d4d';
                deleteButton.style.fontWeight = 'bold';
            });
            deleteButton.addEventListener('mouseout', (e) => {
                deleteButton.style.color = ''; // 恢复初始颜色
                deleteButton.style.fontWeight = '';
            });
            deleteButton.addEventListener('click', (e) => { 
                e.stopPropagation();
                const index = activeLine.route.findIndex(s => s.code === station.code);
                if (index !== -1) {
                    activeLine.route.splice(index, 1);
                    initStationList();
                    actionListAssembled = false;
                    refreshFrame();
                }
            });
            stationInputContainer.appendChild(deleteButton);
        }
        item.appendChild(stationInputContainer);

        list.appendChild(item);
        actionList.push({ 
            type: 'arrive', 
            station: station.code,
            platform: platformInput.value || ''
        });
    });
    if (activeLineId === 'manual') { 
        const addStationItem = document.createElement('div');
        addStationItem.className = 'pref-item station-item add-station-item';
        addStationItem.textContent = '+ 添加车站';
        addStationItem.addEventListener('click', () => { 
            newStationCount++;
            const newStationCode = 'M' + newStationCount.toString().padStart(3, '0');
            activeLine.route.push({
                type: 'station',
                code: newStationCode,
                name: [newStationCode + '站', '', '']
            });
            initStationList();
            actionListAssembled = false;
            refreshFrame();
        });
        list.appendChild(addStationItem);
    }
    refreshFrame();
    refreshStationList();
    initLineNameInputs();
}

function refreshStationList() { 
    const list = document.querySelectorAll('.station-list .station-item');
    if (list && list.length > 0) {
        list.forEach((item, index) => {
            item.classList.remove('active');
            if (index === activeStepIndex) {
                item.classList.add('active');
            }
            const action = actionList[index];
            if (action) {
                const stationNames = getLanguageListForStation(action.station);
                if (action.type === 'nextStation') {
                    item.textContent = '下一站 ' + stationNames[0].name;
                }
            }
        });
    }
    const deleteButtons = document.querySelectorAll('.delete-button');
    if (list.length <= 4) {
        deleteButtons.forEach(button => button.style.display = 'none');
    } else {
        deleteButtons.forEach(button => button.style.display = 'inline');
    }
    initLineNameInputs();
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
            initBackgroundModeSelector();
            initLineNameInputs();

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

    const expandWindowText = document.querySelector('.expand-window-text');
    if (window.innerHeight < window.innerWidth * 0.8) {
        expandWindowText.style.opacity = 1;
    } else { 
        expandWindowText.style.opacity = 0;
    }
}