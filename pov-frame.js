let activeLineId;
let activeLine = [];
let actionList = [];
let widthList = [];
let playList = [];
let currentBgType = 'transparent';
let actionListAssembled = false;
let activeStepIndex = 0;
let isUpwards = false;
let playAnnouncement = false;
let newStationCount = 2;
const backgroundTypeNames = {
    'transparent': '透明',
    'color': '纯色',
    'image': '图片',
    'video': '视频',
    'capture': '屏幕捕获'
};

document.addEventListener('DOMContentLoaded', function () { 
    fetch('./data/lines.json')
        .then(response => response.json())
        .then(data => {
            window.lines = data.lines;
            resumeProgress();
            init();
            initBackgroundModeSelector();
            initLineSelector();
            initLineNameInputs();
            initUpwardsSwitch();
            initAnnounceSwitch();
            initStationList();
            initPlayList();
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
    const fullscreenBtn = document.querySelector('.fullscreen-btn');
    toggleFullscreen();
    fullscreenBtn.addEventListener('click', () => { 
        fullscreenBtn.classList.toggle('active');
        toggleFullscreen();
    });
}

function toggleFullscreen() { 
    const fullscreenBtn = document.querySelector('.fullscreen-btn');
    const appContainer = document.querySelector('.app-container');
    const title = document.querySelector('.title');
    const main = document.querySelector('main');
    const expandWindowText = document.querySelector('.expand-window-text');
    const disclaimer = document.querySelector('.disclaimer');
    const previewBackground = document.querySelector('.preview-background');
    const previewBackgroundColor = 
        previewBackground.style.backgroundColor === 'transparent' ? 'var(--color-background)' : 'transparent';
    expandWindowText.style.opacity = 
        (fullscreenBtn.classList.contains('active') &&
        window.innerHeight < window.innerWidth * 0.8) ? 1 : 0;
    main.style.marginLeft = fullscreenBtn.classList.contains('active') ? '0' : 'calc(60svw + 16px)';
    appContainer.style.flexDirection = fullscreenBtn.classList.contains('active') ? 'column' : 'row';
    appContainer.style.alignItems = fullscreenBtn.classList.contains('active') ? 'center' : 'flex-start';
    const previewContainer = document.querySelector('.preview-container');
    previewContainer.style.width = fullscreenBtn.classList.contains('active') ? '' : '60svw';
    previewContainer.style.minWidth = fullscreenBtn.classList.contains('active') ? '' : '60svw';
    previewContainer.style.position = fullscreenBtn.classList.contains('active') ? '' : 'fixed';
    previewContainer.style.minHeight = fullscreenBtn.classList.contains('active') ? '56.25vw' : '33.75svw';
    previewContainer.style.margin = fullscreenBtn.classList.contains('active') ? '' : '64px 24px';
    previewContainer.style.borderRadius = fullscreenBtn.classList.contains('active') ? '' : '16px';
    previewContainer.style.backgroundColor = fullscreenBtn.classList.contains('active') ? '' : previewBackgroundColor;
    previewContainer.style.boxShadow = fullscreenBtn.classList.contains('active') ? '' : 'var(--item-shadow-inset)';
    title.style.opacity = fullscreenBtn.classList.contains('active') ? 0 : 1;
    disclaimer.style.position = fullscreenBtn.classList.contains('active') ? 'relative' : 'fixed';
    disclaimer.style.left = fullscreenBtn.classList.contains('active') ? '0' : '24px';
    disclaimer.style.top = fullscreenBtn.classList.contains('active') ? '0' : 'calc(76px + 33.75svw)';
    disclaimer.style.width = fullscreenBtn.classList.contains('active') ? '' : '58svw';
    Array.from(previewContainer.children).forEach(container => { 
        container.style.transform = 'scale(calc(' + (fullscreenBtn.classList.contains('active') ? 100 : 60) + 'svw / 1920px))';
    });
}

function initBackgroundModeSelector() { 
    const selector = document.querySelector('.background-mode-selector');
    if (!selector) return;

    selector.innerHTML = ''; // 清空现有选项
    // 为每个背景模式创建选项
    const modes = [
        { id: 'transparent', name: '透明' },
        { id: 'color', name: '纯色' },
        { id: 'video', name: '视频' },
        { id: 'capture', name: '屏幕捕获' },
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

function applyBackgroundMode(mode,inputContainer=document) {
    const previewBackground = document.querySelector('.preview-background');
    const customBackground = inputContainer.querySelector('.custom-background');
    console.log(previewBackground, inputContainer, customBackground);
    if (!previewBackground || !customBackground) return;
    if (mode!==currentBgType||currentBgType==='transparent') previewBackground.innerHTML = ''; // 清空现有背景
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
        child.style.filter = 'blur(36px)'
        child.style.whiteSpace = 'nowrap';
    });
    const elementToHide = inputContainer===document?customBackground.parentElement:customBackground;
    elementToHide.style.height = 0;
    elementToHide.style.opacity = 0;
    customBackground.style.overflow = 'hidden';
    elementToHide.style.padding = '0 12px';
    elementToHide.classList.add('collapsed');
    const colorInput = inputContainer.querySelector('#backgroundColorInput');
    const videoInput = inputContainer.querySelector('#backgroundVideoInput');
    const imageInput = inputContainer.querySelector('#backgroundImageInput');
    const allColorInputs = document.querySelectorAll('#backgroundColorInput');
    const allVideoInputs = document.querySelectorAll('#backgroundVideoInput');
    const allImageInputs = document.querySelectorAll('#backgroundImageInput');
    console.log(inputContainer,colorInput,videoInput);
    allVideoInputs.forEach(input => { input.value = ''; }); // 重置视频输入
    const videoControls = inputContainer.querySelector('.video-controls');

    switch (mode) {
        case 'transparent':
            previewBackground.style.backgroundColor = 'transparent';
            currentBgType = 'transparent';
            break;
        case 'color':
            elementToHide.style.height = '30px';
            elementToHide.style.opacity = 1;
            elementToHide.style.padding = '4px 12px';
            colorInput.style.width = '24px';
            colorInput.style.opacity = 1;
            colorInput.style.margin = 'unset';
            colorInput.style.padding = '';
            colorInput.style.filter = '';
            previewBackground.style.backgroundColor = colorInput.value;
            colorInput.addEventListener('input', (e) => {
                const color = e.target.value;
                previewBackground.style.backgroundColor = color;
                allColorInputs.forEach(input => { input.value = color; });
            });
            elementToHide.classList.remove('collapsed');
            customBackground.style.overflow = 'color';
            break;
        case 'video':
            elementToHide.style.height = '30px';
            elementToHide.style.opacity = 1;
            elementToHide.style.padding = '4px 12px';
            // 添加视频背景
            videoInput.style.width = '240px';
            videoInput.style.opacity = 1;
            videoInput.style.margin = 'unset';
            videoInput.style.padding = '';
            videoInput.style.filter = '';
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
                    videoElement.style.width = '100%';
                    videoElement.style.height = '100%';
                    videoElement.style.objectFit = 'cover';
                    previewBackground.appendChild(videoElement);
                }
            });
            elementToHide.classList.remove('collapsed');
            currentBgType = 'video';
            break;
        case 'image': 
            elementToHide.style.height = '30px';
            elementToHide.style.opacity = 1;
            elementToHide.style.padding = '4px 12px';
            // 添加视频背景
            imageInput.style.width = '240px';
            imageInput.style.opacity = 1;
            imageInput.style.margin = 'unset';
            imageInput.style.padding = '';
            imageInput.style.filter = '';
            //videoControls.style.width = '120px';
            //videoControls.style.opacity = 1; 视频控制暂不支持
            imageInput.addEventListener('change', (e) => { 
                const img = e.target.files[0];
                if (img) { 
                    const imgURL = URL.createObjectURL(img);
                    previewBackground.innerHTML = ''; // 清空现有背景
                    const imgElement = document.createElement('img');
                    imgElement.src = imgURL;
                    imgElement.autoplay = true;
                    imgElement.loop = true;
                    imgElement.style.width = '100%';
                    imgElement.style.height = '100%';
                    imgElement.style.objectFit = 'cover';
                    previewBackground.appendChild(imgElement);
                }
            });
            elementToHide.classList.remove('collapsed');
            currentBgType = 'image';
            break;
        case 'capture':
            elementToHide.style.height = '30px';
            elementToHide.style.opacity = 1;
            elementToHide.style.padding = '4px 12px';
            // 添加屏幕捕获背景
            const captureButton = inputContainer.querySelector('.capture-screen-btn');
            captureButton.style.width = '120px';
            captureButton.style.opacity = 1;
            customBackground.style.overflow = 'visible';
            captureButton.style.padding = 'unset';
            captureButton.style.filter = '';
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
            elementToHide.classList.remove('collapsed');
            currentBgType = 'capture';
            break;
        default:
            console.error('Invalid background mode:', mode);    
    }
}

function initLineSelector() { 
    const selector = document.querySelector('.line-selector');

    const lines = window.lines || [];
    if (!selector || lines.length <= 0) return;

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
        if (activeLineId && line.id === activeLineId) item.click();
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
    const activeItem = selector.querySelector('.active');
    if (!activeItem) {
        editItem.classList.add('active');
    }
}

function initLineNameInputs() {
    const lineNameInputContainer = document.querySelector('.line-name-input-container');
    if (!lineNameInputContainer) return;
    lineNameInputContainer.parentElement.style.height = activeLineId === 'manual' ? '30px' : '0px';
    lineNameInputContainer.parentElement.style.overflow = 'hidden';
    lineNameInputContainer.parentElement.style.minHeight = 0;
    lineNameInputContainer.parentElement.style.padding = activeLineId === 'manual' ? '4px 12px' : '0px 12px';
    lineNameInputContainer.parentElement.style.opacity = activeLineId === 'manual' ? 1 : 0;
    if (activeLineId !== 'manual') return;
    const nameInput1 = document.querySelector('#lineNameInput1');
    const nameInput2 = document.querySelector('#lineNameInput2');
    const colorInput = document.querySelector('#lineColorInput');
    nameInput1.value = activeLine.name?.zh_hans;
    nameInput1.addEventListener('input', function() { 
        activeLine.name.zh_hans = this.value;
        refreshFrame();
    });
    nameInput2.value = activeLine.name?.en;
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

    recordProgress();

    const announceTimeout = setTimeout(() => { 
        console.log('refreshStationList',actionList[activeStepIndex]);
        synthesizeAnnouncement(actionList[activeStepIndex]);
    }, 1000);
}

function synthesizeAnnouncement(step) { 
    if (!step || playAnnouncement!==true) return;
    const announcementTypo = {
        'zh-CN':{
            'nextStation_first':'欢迎乘坐通运铁路，祝您出行愉快。本次列车终点站：{dest}。下一站：{sta}。请下车的乘客做好准备。',
            'nextStation':'列车启动，请扶好坐稳，本次列车终点站：{dest}。下一站：{sta}。请下车的乘客做好准备。',
            'nextStation_last':'列车启动，请扶好坐稳。下一站为本次列车的终点站：{sta}。请全体乘客做好下车准备。',
            'arrive':'{sta}，到了。',
            'arrive_last':'终点站{sta}，到了。欢迎再次乘坐通运铁路。',
            'transfer':'换乘{lines}的乘客请从该站下车，请您注意换乘时间，合理安排行程。'
        },
        'zh-CN-liaoning':{
            'nextStation_first':'欢迎乘坐通运铁路，这趟车的终点站是：{dest}。下一站搁{sta}。请下车的乘客做好准备。',
            'nextStation':'这趟车的终点站是：{dest}。下一站搁{sta}。请下车的乘客做好准备。',
            'nextStation_last':'下一站是咱这趟车的终点站：{sta}。所有乘客都得搁这站下车。',
            'arrive':'{sta}到了。',
            'arrive_last':'终点站{sta}，到了。欢迎再次乘坐通运铁路。',
            'transfer':'导{lines}的乘客得搁这站下车，请您注意换乘时间，合理安排行程。'
        },
        'en-US':{
            'nextStation_first':'Welcome to take GT Railways. The destination of the train is {dest}. The next station is {sta}. ',
            'nextStation':'The next station is {sta}.',
            'nextStation_last':'The next station is {sta}, the destination of the train. All the passengers, please get ready to get off.',
            'arrive':'We are arriving at {sta}.',
            'arrive_last':'We are arriving at {sta}, the destination of the train. All the passengers, please get off at this station. Welcome to take GT Railways again.',
            'transfer':'Passengers for {lines} please prepare to get off. Please pay attention to transfer time and arrange your travel properly.'
        },
        'zh-HK':{
            'nextStation_first':'歡迎乘搭通運鐵路，本次列车嘅终点站係{dest}。下一站：{sta}。',
            'nextStation':'下一站：{sta}。',
            'nextStation_last':'下一站係本次列车嘅终点站：{sta}。',
            'arrive':'列車已經到達：{sta}。',
            'arrive_last':'列車已經到達終點站：{sta}。歡迎再次乘搭通運鐵路。',
            'transfer':'轉乘{lines}嘅乘客請喺呢一站落車。'
        },
        'uk-UA':{
            'nextStation_first':'Наступна станцiя: {sta}.',
            'nextStation':'Наступна станцiя: {sta}.',
            'nextStation_last':'Наступна станцiя: {sta}.',
            'arrive':'',
            'arrive_last':'',
            'transfer':''
        },
    }
    let languages = [
        {text:'zh_hans',voice:'zh-CN'},
        {text:'en',voice:'en-US'}
    ];
    switch (step.station.slice(0,1)) { 
        case 'A':
            languages.push(
                {text:'zh_hant',voice:'zh-HK'},
                {text:'uk',voice:'uk-UA'}
            );
            break;
        case 'N':
            languages.push(
                {text:'zh_hans',voice:'zh-CN-liaoning'}
            );
    }
    //console.log('synthesizeAnnouncement',languages,step.station,activeLine);
    const destSta = activeLine.route[activeLine.route.length-1].code;
    const secondSta = activeLine.route[1].code;
    let announcement;
    switch (step.station) { 
        case destSta: 
            (async () => {
                for (const lang of languages) { 
                    const newAnnouncement = 
                        announcementTypo[lang.voice][step.type+'_last']
                        .replace('{sta}',getStationName(step.station,lang.text))
                        .replace('{dest}',getStationName(destSta,lang.text));
                    showToast(newAnnouncement);
                    
                    // 语音播报
                    await speakText(newAnnouncement, lang.voice);
                }
            })();
            break;
        case secondSta: 
            (async () => {
                for (const lang of languages) { 
                    const newAnnouncement = 
                        announcementTypo[lang.voice][step.type+'_first']
                        .replace('{sta}',getStationName(step.station,lang.text))
                        .replace('{dest}',getStationName(destSta,lang.text));
                    showToast(newAnnouncement);
                    
                    // 语音播报
                    await speakText(newAnnouncement, lang.voice);
                }
            })();
            break;
        default: 
            (async () => {
                for (const lang of languages) { 
                    const newAnnouncement = 
                        announcementTypo[lang.voice][step.type]
                        .replace('{sta}',getStationName(step.station,lang.text))
                        .replace('{dest}',getStationName(destSta,lang.text));
                    showToast(newAnnouncement);
                    
                    // 语音播报
                    await speakText(newAnnouncement, lang.voice);
                }
            })();
    }
}

// 语音播报函数
async function speakText(text, lang) {
    // 如果浏览器不支持语音合成，则直接返回
    if (!('speechSynthesis' in window)) {
        console.warn('浏览器不支持语音合成功能');
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        // 如果没有要朗读的文本，直接返回
        if (!text.trim()) {
            resolve();
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.onend = () => resolve(); // 语音播报结束后解决Promise
        utterance.onerror = () => resolve(); // 发生错误也解决Promise，避免阻塞
        speechSynthesis.speak(utterance);
    });
}

function recordProgress() { 
    const prefs = getPreferences();
    // 只有当用户明确禁用时才不记录进度（undefined或true都视为启用）
    if (prefs.resumeOnLoading === false) return;
    console.log('recordProgress');
    
    // 创建新的进度记录数组，仅包含当前记录
    const progressData = [{
        id: activeLineId,
        line: activeLine,
        isUpwards: isUpwards,
        index: activeStepIndex,
        steps: actionList,
        manualLine: window.lines.find(line => line.id === 'manual'),
    }];
    
    // 保存到localStorage（覆盖原有数据）
    localStorage.setItem('pov_progress', JSON.stringify(progressData));
}

function resumeProgress() { 
    const prefs = getPreferences();
    // 只有当用户明确禁用时才不记录进度（undefined或true都视为启用）
    const progressData = JSON.parse(localStorage.getItem('pov_progress'));
    if (prefs.resumeOnLoading !== false && progressData && progressData.length > 0) {
        const progress = progressData[0];
        activeLineId = progress.id;
        activeLine = progress.line;
        isUpwards = progress.isUpwards;
        activeStepIndex = progress.index;
        actionList = progress.steps;
        playList = progress.playList;
        if (progress.manualLine) { 
            window.lines.push(progress.manualLine);
        }
    } else { 
        console.log(window.lines, window.lines[0]);
        activeLineId = window.lines[0].id;
        activeLine = window.lines[0];
    }
    console.log('resumeProgress', activeLineId, activeStepIndex, isUpwards, actionList);
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
    const languages = [];
    if (activeLineId === 'manual') { 
        const stationNamesForManual = activeLine.route.find(station => station.code === stationCode).name;
        for (let index = 0; index < 3; index++) { 
            const name = stationNamesForManual[index];
            if (name) languages.push({ code: 'manual-' + index, name: name });
            else languages.push({ code: 'end', name: '' });
        }
    } else { 
        const stationNames = window?.strings.station_names[stationCode] || activeLine.route.find(station => station.code === stationCode).name;
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

function initAnnounceSwitch() {
    const switchElement = document.querySelector('.announce');
    if (!switchElement) return;
    if (playAnnouncement) {
        switchElement.classList.add('active');
    } else { 
        switchElement.classList.remove('active');
    }

    switchElement.addEventListener('click', () => {
        playAnnouncement = !playAnnouncement;
        switchElement.classList.toggle('active');
        refreshFrame();
    });
}

function initStationList() {
    const list = document.querySelector('.station-list');
    if (!list) return;
    console.log('initStationList', activeLineId, actionList);
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
            deleteButton.classList.add('delete-button');
            deleteButton.classList.add('material-symbols-outlined');
            deleteButton.textContent = 'close';
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
        addStationItem.innerHTML = '<span class="material-symbols-outlined">add</span> 添加车站';
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
    if (activeLineId === 'manual') initLineNameInputs();
}

function initPlayList() { 
    const list = document.querySelector('.play-list');
    list.innerHTML = '';
    if (playList!==undefined) playList.forEach(playItem => { 
        const item = document.createElement('div');
        item.className = 'play-item';
        item.textContent = backgroundTypeNames[playItem.type]+' '+playItem.name;
        item.addEventListener('click', () => { 
            playBackground(playItem);
        });
        const inTimeInput = document.createElement('input');
        inTimeInput.type = 'number';
        inTimeInput.className = 'play-item-time-input';
        inTimeInput.value = playItem.inTime;
        inTimeInput.addEventListener('input', (e) => { 
            playItem.inTime = e.target.value;
        });
        item.appendChild(inTimeInput);
        const outTimeInput = document.createElement('input');
        outTimeInput.type = 'number';
        outTimeInput.className = 'play-item-time-input';
        outTimeInput.value = playItem.outTime;
        outTimeInput.addEventListener('input', (e) => { 
            playItem.outTime = e.target.value;
        });
        item.appendChild(outTimeInput);
        const deleteButton = document.createElement('button');
        deleteButton.classList.add('delete-button');
        deleteButton.classList.add('material-symbols-outlined');
        deleteButton.textContent = 'close';
        item.appendChild(deleteButton);
        list.appendChild(item);
    });
    const addItem = document.createElement('div');
    addItem.className = 'play-item';
    addItem.classList.add('icon-btn');
    addItem.classList.add('add-background-item');
    addItem.innerHTML = '<span class="material-symbols-outlined">edit</span> 编辑背景';
    addItem.addEventListener('click', () => { 
        const bgSelector = document.createElement('div');
        bgSelector.className = 'background-selector';
        const modeSelector = document.createElement('div');
        modeSelector.className = 'background-mode-selector';
        modeSelector.classList.add('selection');
        modeSelector.classList.add('segment');
        modeSelector.classList.add('no-collapse');

        const customBackground = document.createElement('div');
        customBackground.className = 'custom-background';
        customBackground.innerHTML = 
`
                <input type="color" class="pref-value" id="backgroundColorInput"></input>
                <input type="file" accept="image/*" class="pref-value" id="backgroundImageInput"></input>
                <input type="file" accept="video/*" class="pref-value" id="backgroundVideoInput"></input>
                <button class="icon-btn capture-screen-btn">开始屏幕捕获</button>`;
        
        // 根据 backgroundTypeNames 的键名动态生成选项
        Object.keys(backgroundTypeNames).forEach((type,index) => { 
            const selectorItem = document.createElement('div');
            selectorItem.className = 'selection-item';
            selectorItem.setAttribute('data-background', type);
            
            const selectionItemIcon = document.createElement('span');
            selectionItemIcon.className = 'material-symbols-outlined';
            
            // 根据类型设置对应的图标
            const iconMap = {
                'transparent': 'gradient',
                'color': 'palette',
                'video': 'movie',
                'image': 'photo',
                'capture': 'screen_share'
            };
            selectionItemIcon.textContent = iconMap[type] || 'help';
            
            const selectorItemText = document.createElement('span');
            selectorItemText.textContent = backgroundTypeNames[type];
            selectorItem.title = backgroundTypeNames[type];

            selectorItem.dataset.background = type;
            
            selectorItem.addEventListener('click', function(e) {
                e.stopPropagation();
                // 移除之前的激活状态
                const previousActive = modeSelector.querySelector('.selection-item.active');
                if (previousActive) {
                    previousActive.classList.remove('active');
                }
                // 添加当前项的激活状态
                this.classList.add('active');
                // 获取当前激活的选项的data-background属性
                const background = this.dataset.background;
                applyBackgroundMode(background, bgSelector);
            });
            
            selectorItem.appendChild(selectionItemIcon);
            selectorItem.appendChild(selectorItemText);
            modeSelector.appendChild(selectorItem);
        });
        
        bgSelector.appendChild(modeSelector);
        bgSelector.appendChild(customBackground);
        bgSelector.style.display = 'flex';
        bgSelector.style.flexDirection = 'column';
        bgSelector.style.gap = '0.5rem';
        pushDialog(bgSelector,'custom','添加背景');

        modeSelector.querySelectorAll('.selection-item').forEach(item => { 
            if (item.dataset.background === currentBgType) item.click();
        });

        // 获取active的选项索引
        let activeIndex = [...modeSelector.querySelectorAll('.selection-item')].findIndex(item => item.classList.contains('active'));
        const dialog = document.querySelector('.dialog-container:has(.background-selector)')
        dialog.addEventListener('wheel', function(e) { 
            e.preventDefault();
            if (e.deltaY > 0) { 
                const nextIndex = Math.min((activeIndex + 1),(modeSelector.querySelectorAll('.selection-item').length-1));
                modeSelector.querySelectorAll('.selection-item')[nextIndex].click();
                activeIndex = nextIndex;
            } else { 
                const prevIndex = Math.max((activeIndex - 1),0);
                modeSelector.querySelectorAll('.selection-item')[prevIndex].click();
                activeIndex = prevIndex;
            }
        });
    });
    list.appendChild(addItem);
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
        if (!item.classList.contains('station-list')&&!item.classList.contains('add-station-item')) {
            item.style.flexDirection = 'row';
            item.style.alignItems = 'center';
            item.style.justifyContent = 'space-between';
            //if (!item.classList.contains('collapsed')) item.style.height = '2em';
            //initBackgroundModeSelector();
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
    const fullscreenBtn = document.querySelector('.fullscreen-btn');
    if (window.innerHeight < window.innerWidth * 0.8) {
        expandWindowText.style.opacity = 1;
        fullscreenBtn.style.display = 'flex';
    } else { 
        expandWindowText.style.opacity = 0;
        fullscreenBtn.style.display = 'none';
        fullscreenBtn.classList = 'icon-btn fullscreen-btn active';
        toggleFullscreen();
    }
}

window.handleWindowResize = handleWindowResize;