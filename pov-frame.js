let activeLineId;
let __povViewOnly = false;
let __povShareId = null;
let __originalTitle = '';
let activeLine = [];
let actionList = [];
let widthList = [];
let playList = [];
let currentBgType = 'transparent';
let currentBgContent = '';
let actionListAssembled = false;
let activeStepIndex = 0;
let isUpwards = false;
let playAnnouncement = false;
let isShowStationInfo = true;
let newStationCount = 2;
let isPlayingAnnouncement = false;
let __announceTimeout = null;
const backgroundTypeNames = {
    'transparent': '透明',
    'color': '纯色',
    'image': '图片',
    'video': '视频',
    'link': '链接',
    'capture': '屏幕捕获'
};

const BLOCKED_URL_PATTERNS = [
    /^javascript:/i,
    /^data:text\/html/i,
    /^vbscript:/i,
    /localhost/i,
    /127\.0\.0\.1/i,
    /0\.0\.0\.0/i,
    /192\.168\./i,
    /10\.\d+\.\d+\.\d+/i,
    /172\.(1[6-9]|2\d|3[01])\./i,
    /\.onion$/i,
    /\.local$/i
];

function isValidBackgroundUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) return false;
        for (const pattern of BLOCKED_URL_PATTERNS) {
            if (pattern.test(url)) return false;
        }
        return true;
    } catch {
        return false;
    }
}

function canUseLinkBackground() {
    const loggedIn = typeof window.auth !== 'undefined' && window.auth.isLoggedIn && window.auth.isLoggedIn();
    const verified = typeof window.auth !== 'undefined' && window.auth.isVerified && window.auth.isVerified();
    return loggedIn && verified;
}

// 设置报站期间的视觉提示（降低不透明度并改变光标）
function setAnnouncementLockVisual() {
    const lockElements = document.querySelectorAll(
        '.line-selector .selection-item, ' +
        '.station-list .pref-item, ' +
        '.prev-btn, .next-btn, ' +
        '.set-upwards, .show-station-info'
    );
    
    lockElements.forEach(element => {
        if (!element.style.cursor || element.style.cursor !== 'not-allowed') {
            element.dataset.originalOpacity = element.style.opacity || '1';
            element.classList.add('wait');
            element.title = '报站中…';
        }
    });
}

// 清除报站期间的视觉提示
function clearAnnouncementLockVisual() {
    const lockElements = document.querySelectorAll(
        '.line-selector .selection-item, ' +
        '.station-list .pref-item, ' +
        '.prev-btn, .next-btn, ' +
        '.set-upwards, .show-station-info'
    );
    
    lockElements.forEach(element => {
        element.classList.remove('wait');
        element.title = '';
    });
}

function waitForStrings() {
    return new Promise(resolve => {
        if (window.strings) { resolve(); return; }
        const check = setInterval(() => {
            if (window.strings) { clearInterval(check); resolve(); }
        }, 50);
    });
}

// 展示模式：隐藏所有控制组件，只显示预览
function enterViewOnlyMode() {
    document.body.classList.add('view-only');
    const main = document.querySelector('main');
    const footer = document.querySelector('footer');
    const title = document.querySelector('.title');
    const disclaimer = document.querySelector('.disclaimer');
    const expandWindowText = document.querySelector('.expand-window-text');
    if (main) main.style.display = 'none';
    if (footer) footer.style.display = 'none';
    if (title) title.style.display = 'none';
    if (disclaimer) disclaimer.style.display = 'none';
    if (expandWindowText) expandWindowText.style.display = 'none';
    const previewContainer = document.querySelector('.preview-container');
    if (previewContainer) {
        previewContainer.style.width = window.innerWidth + 'px';
        previewContainer.style.minWidth = window.innerWidth + 'px';
        previewContainer.style.left = '';
        previewContainer.style.minHeight = window.innerWidth * 0.5625 + 'px';
        previewContainer.style.margin = '0';
        previewContainer.style.borderRadius = '0';
        previewContainer.style.backgroundColor = 'transparent';
        previewContainer.style.boxShadow = 'none';
        previewContainer.style.position = 'absolute';
        previewContainer.style.top = '0';
        previewContainer.style.transform = 'translate(-50%, 0)';
        previewContainer.style.transformOrigin = 'top center';
    }
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
        appContainer.style.flexDirection = 'column';
        appContainer.style.alignItems = 'center';
        appContainer.style.overflow = 'hidden';
    }
    actionListAssembled = false;
    refreshFrame();
    startViewOnlyPolling();
}

// 展示模式：定时从云端拉取最新进度
let __viewOnlyPollTimer = null;
function startViewOnlyPolling() {
    if (!__povShareId) return;
    __viewOnlyPollTimer = setInterval(async () => {
        try {
            const resp = await fetch('./api/pov/share/' + encodeURIComponent(__povShareId));
            if (!resp.ok) {
                clearInterval(__viewOnlyPollTimer);
                showToast(resp.status === 403 ? '分享进度已关闭' : '分享链接已失效', 3000);
                return;
            }
            const data = await resp.json();
            console.log('View-only mode progress data:', data);
            const prog = data.progress;
            const sharerName = data.username || '';
            if (sharerName) {
                document.title = sharerName + '的分享 - ' + __originalTitle;
            }
            const isSameLan = data.sameLan !== false;
            if (prog && prog.activeLine) {
                const prevIndex = activeStepIndex;
                const prevLineId = activeLineId;
                activeLine = prog.activeLine;
                activeLineId = prog.activeLineId;
                isUpwards = prog.isUpwards;
                actionList = prog.actionList || [];
                playList = prog.playList || [];
                if (prog.playAnnouncement !== undefined) playAnnouncement = prog.playAnnouncement;
                if (prog.isShowStationInfo !== undefined) isShowStationInfo = prog.isShowStationInfo;
                const effectiveBgType = (prog.bgType === 'link' && !isSameLan) ? 'transparent' : prog.bgType;
                applyBackgroundFromData(effectiveBgType, prog.bgContent);
                const nextIndex = prog.activeStepIndex || 0;
                if (prevIndex !== nextIndex || prevLineId !== activeLineId) {
                    activeStepIndex = nextIndex;
                    if (prevLineId !== activeLineId) {
                        actionListAssembled = false;
                    }
                    refreshFrame();
                }
            }
        } catch (err) {
            console.warn('展示模式轮询失败:', err);
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', async function () { 
    try {
            __originalTitle = document.title;
            const response = await fetch('./data/lines.json');
            const data = await response.json();
            window.lines = data.lines;
            await waitForStrings();

            // 检测 shareId 参数，进入展示模式
            const urlParams = new URLSearchParams(window.location.search);
            const shareIdParam = urlParams.get('shareId');
            if (shareIdParam) {
                __povViewOnly = true;
                __povShareId = shareIdParam;
                try {
                    const resp = await fetch('./api/pov/share/' + encodeURIComponent(shareIdParam));
                    if (!resp.ok) {
                        const errText =
                            resp.status === 404
                                ? '该分享 ID 不存在或已过期'
                                : resp.status === 403
                                    ? '该用户未开启分享进度功能'
                                    : '获取分享进度失败';
                        showToast(errText + '，已返回一般模式', 3000);
                        __povViewOnly = false;
                        __povShareId = null;
                    } else {
                        const shareData = await resp.json();
                        const prog = shareData.progress;
                        if (prog && prog.activeLine) {
                            activeLine = prog.activeLine;
                            activeLineId = prog.activeLineId;
                            isUpwards = prog.isUpwards;
                            activeStepIndex = prog.activeStepIndex || 0;
                            actionList = prog.actionList || [];
                            playList = prog.playList || [];
                            if (prog.playAnnouncement !== undefined) playAnnouncement = prog.playAnnouncement;
                            if (prog.isShowStationInfo !== undefined) isShowStationInfo = prog.isShowStationInfo;
                        }
                        enterViewOnlyMode();
                        if (prog && prog.bgType) {
                            const initialSameLan = shareData.sameLan !== false;
                            const effectiveBgType = (prog.bgType === 'link' && !initialSameLan) ? 'transparent' : prog.bgType;
                            applyBackgroundFromData(effectiveBgType, prog.bgContent);
                        }
                        const sharerName = shareData.username || '';
                        if (sharerName) {
                            document.title = sharerName + '的分享 - ' + __originalTitle;
                        }
                    }
                } catch (fetchErr) {
                    console.warn('获取分享进度失败:', fetchErr);
                    showToast('获取分享进度失败，已返回一般模式', 3000);
                    __povViewOnly = false;
                    __povShareId = null;
                }
            }

            if (!__povViewOnly) { resumeProgress(); }
            init();
            initLineSelector();
            if (!__povViewOnly) {
                initLineNameInputs();
                initUpwardsSwitch();
                initAnnounceSwitch();
                initStationInfoSwitch();
                initStationList();
                initPlayList();
                initShareSwitch();
            }
            handleWindowResize();
            window.addEventListener('resize', handleWindowResize);
        } catch(error) {
            console.error('Error loading lines data:', error);
        }
});

function init() { 
    const backBtn = document.querySelector('.back-btn');
    backBtn.addEventListener('click', () => {
        window.open('index.html?lang='+lang, '_self');
    });
    const prevBtn = document.querySelector('.prev-btn');
    prevBtn.addEventListener('click', () => {
        if (isPlayingAnnouncement) {
            console.warn('报站进行中，无法切换车站');
            showToast(strings?.toast?.announcement_in_progress || '报站进行中，请稍后再试', 2000);
            return;
        }
        activeStepIndex--;
        if (activeStepIndex < 0) activeStepIndex = 0;
        refreshFrame();
        refreshStationList();
    });
    const nextBtn = document.querySelector('.next-btn');
    nextBtn.addEventListener('click', () => { 
        if (isPlayingAnnouncement) {
            console.warn('报站进行中，无法切换车站');
            showToast(strings?.toast?.announcement_in_progress || '报站进行中，请稍后再试', 2000);
            return;
        }
        activeStepIndex++;
        if (activeStepIndex > actionList.length - 1) activeStepIndex = actionList.length - 1;
        refreshFrame();
        refreshStationList();
    });
    const previewContainer = document.querySelector('.preview-container');
    previewContainer.addEventListener('wheel', (e) => { 
        if (__povViewOnly) return;
        e.preventDefault();
        if (isPlayingAnnouncement) {
            console.warn('报站进行中，无法切换车站');
            showToast(strings?.toast?.announcement_in_progress || '报站进行中，请稍后再试', 2000);
            return;
        }
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
    main.style.marginLeft = fullscreenBtn.classList.contains('active') ? '0' : window.innerWidth * 0.6 + 16 + 'px';
    main.style.marginTop = fullscreenBtn.classList.contains('active') ? window.innerWidth * 0.5625 + 16 + 'px' : '0';
    appContainer.style.flexDirection = fullscreenBtn.classList.contains('active') ? 'column' : 'row';
    appContainer.style.alignItems = fullscreenBtn.classList.contains('active') ? 'center' : 'flex-start';
    const previewContainer = document.querySelector('.preview-container');
    previewContainer.style.width = fullscreenBtn.classList.contains('active') ? '' : '60svw';
    previewContainer.style.minWidth = fullscreenBtn.classList.contains('active') ? '' : '60svw';
    previewContainer.style.left = fullscreenBtn.classList.contains('active') ? '50%' : '30% ';
    previewContainer.style.minHeight = window.innerWidth * (fullscreenBtn.classList.contains('active') ? 0.5625 : 0.3375) + 'px';
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
        container.style.transform = 'scale(' + window.innerWidth*(fullscreenBtn.classList.contains('active') ? 1 : 0.6)/1920 + ')';
    });
}

// 添加辅助函数来检测URL类型
function isImageUrl(url) {
    return /\.(jpeg|jpg|gif|png|webp|bmp|svg)$/.test(url.toLowerCase());
}

function isVideoUrl(url) {
    return /\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv|m3u8)$/.test(url.toLowerCase());
}

function applyBackgroundMode(mode,inputContainer=document) {
    const previewBackground = document.querySelector('.preview-background');
    const customBackground = inputContainer.querySelector('.custom-background');
    //console.log(previewBackground, inputContainer, customBackground);
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
        child.style.filter = 'blur(8px)'
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
    const linkInput = inputContainer.querySelector('#backgroundLinkInput');
    const allColorInputs = document.querySelectorAll('#backgroundColorInput');
    const allVideoInputs = document.querySelectorAll('#backgroundVideoInput');
    const allImageInputs = document.querySelectorAll('#backgroundImageInput');
    const allLinkInputs = document.querySelectorAll('#backgroundLinkInput');
    //console.log(inputContainer,colorInput,videoInput);
    allVideoInputs.forEach(input => { input.value = ''; }); // 重置视频输入
    const videoControls = inputContainer.querySelector('.video-controls');

    switch (mode) {
        case 'transparent':
            previewBackground.style.backgroundColor = 'transparent';
            currentBgType = 'transparent';
            currentBgContent = '';
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
            previewBackground.style.backgroundImage = '';
            colorInput.addEventListener('input', (e) => {
                const color = e.target.value;
                previewBackground.style.backgroundColor = color;
                allColorInputs.forEach(input => { input.value = color; });
                currentBgContent = color;
            });
            currentBgContent = colorInput.value;
            elementToHide.classList.remove('collapsed');
            currentBgType = 'color';
            break;
        case 'image':
            elementToHide.style.height = '30px';
            elementToHide.style.opacity = 1;
            elementToHide.style.padding = '4px 12px';
            imageInput.style.width = '240px';
            imageInput.style.opacity = 1;
            imageInput.style.margin = 'unset';
            imageInput.style.padding = '';
            imageInput.style.filter = '';
            const file = imageInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    previewBackground.style.backgroundImage = `url(${event.target.result})`;
                    previewBackground.style.backgroundSize = 'cover';
                    previewBackground.style.backgroundPosition = 'center';
                };
                reader.readAsDataURL(file);
            }
            // 监听文件选择事件
            imageInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        previewBackground.style.backgroundImage = `url(${event.target.result})`;
                        previewBackground.style.backgroundSize = 'cover';
                        previewBackground.style.backgroundPosition = 'center';
                    };
                    reader.readAsDataURL(file);
                }
            };
            elementToHide.classList.remove('collapsed');
            currentBgType = 'image';
            break;
        case 'video':
            elementToHide.style.height = '30px';
            elementToHide.style.opacity = 1;
            elementToHide.style.padding = '4px 12px';
            videoInput.style.width = '240px';
            videoInput.style.opacity = 1;
            videoInput.style.margin = 'unset';
            videoInput.style.padding = '';
            videoInput.style.filter = '';
            // 监听文件选择事件
            videoInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const url = URL.createObjectURL(file);
                    previewBackground.innerHTML = `<video src="${url}" autoplay muted loop style="width:100%;height:100%;object-fit:fill;"></video>`;
                    // 播放一段时间之后设置音量为5%
                    setTimeout(() => {
                        previewBackground.querySelector('video').volume = 0.05;
                        previewBackground.querySelector('video').muted = false;
                    }, 100);
                }
            };
            elementToHide.classList.remove('collapsed');
            currentBgType = 'video';
            break;
        case 'link':
            if (!canUseLinkBackground()) {
                showToast('请先登录并完成审核后再使用URL背景功能', 3000);
                const transparentItem = inputContainer.querySelector?.('[data-background="transparent"]') 
                    || document.querySelector('[data-background="transparent"]');
                if (transparentItem) transparentItem.click();
                return;
            }
            elementToHide.style.height = '30px';
            elementToHide.style.opacity = 1;
            elementToHide.style.padding = '4px 12px';
            linkInput.style.width = '240px';
            linkInput.style.opacity = 1;
            linkInput.style.margin = 'unset';
            linkInput.style.padding = '';
            linkInput.style.filter = '';
            linkInput.oninput = (e) => {
                const url = e.target.value;
                currentBgContent = url;
                if (url) {
                    if (!isValidBackgroundUrl(url)) {
                        previewBackground.style.backgroundImage = 'none';
                        previewBackground.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;color:#ff6b6b;font-size:14px;">不安全的URL，已被拦截</div>';
                        return;
                    }
                    if (isImageUrl(url)) {
                        previewBackground.style.backgroundImage = `url(${url})`;
                        previewBackground.style.backgroundSize = 'cover';
                        previewBackground.style.backgroundPosition = 'center';
                        previewBackground.innerHTML = ''; // 清空之前的内容
                    } else if (isVideoUrl(url)) {
                        if (url.toLowerCase().endsWith('.m3u8')) {
                            // 创建视频元素
                            const video = document.createElement('video');
                            video.style.width = '100%';
                            video.style.height = '100%';
                            video.style.objectFit = 'fill';
                            video.autoplay = true;
                            video.loop = true;
                            video.muted = true; // 初始静音，因为直播流通常不允许自动播放有声内容
                            
                            previewBackground.innerHTML = '';
                            previewBackground.appendChild(video);
                            
                            // 检查是否支持HLS
                            if (video.canPlayType('application/vnd.apple.mpegurl') || 
                                video.canPlayType('application/x-mpegURL')) {
                                // 原生支持HLS
                                video.src = url;
                            } else if (window.Hls && window.Hls.isSupported()) {
                                // 使用HLS.js库
                                const hls = new window.Hls();
                                hls.loadSource(url);
                                hls.attachMedia(video);
                                
                                // 错误处理
                                hls.on(window.Hls.Events.ERROR, function (event, data) {
                                    console.error('HLS error:', data);
                                });
                            } else {
                                // 浏览器不支持HLS
                                console.warn('HLS is not supported in this browser.');
                                previewBackground.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;color:white;font-size:16px;">浏览器不支持HLS播放</div>';
                            }
                        } else {
                            // 普通视频格式
                            previewBackground.innerHTML = `<video src="${url}" autoplay loop muted style="width:100%;height:100%;object-fit:fill;"></video>`;
                        }
                        // 播放一段时间之后设置音量为5%
                        setTimeout(() => {
                            previewBackground.querySelector('video').volume = 0.05;
                            previewBackground.querySelector('video').muted = false;
                        }, 100);
                    } else {
                        // 如果不能确定类型，尝试作为图片处理
                        previewBackground.style.backgroundImage = `url(${url})`;
                        previewBackground.style.backgroundSize = 'cover';
                        previewBackground.style.backgroundPosition = 'center';
                        previewBackground.innerHTML = '';
                    }
                } else {
                    previewBackground.style.backgroundImage = 'none';
                    previewBackground.innerHTML = '';
                }
            };
            elementToHide.classList.remove('collapsed');
            currentBgType = 'link';
            break;
        case 'capture':
            elementToHide.style.height = '30px';
            elementToHide.style.opacity = 1;
            elementToHide.style.padding = '4px 12px';
            const captureScreenBtn = inputContainer.querySelector('.capture-screen-btn');
            captureScreenBtn.style.width = '240px';
            captureScreenBtn.style.opacity = 1;
            captureScreenBtn.style.margin = 'unset';
            captureScreenBtn.style.padding = '';
            captureScreenBtn.style.filter = '';
            captureScreenBtn.onclick = async () => {
                try {
                    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                    previewBackground.innerHTML = `<video src="" autoplay muted loop style="width:100%;height:100%;object-fit:fill;"></video>`;
                    const videoElement = previewBackground.querySelector('video');
                    videoElement.srcObject = stream;
                    
                    // 监听流结束事件，重置为透明背景
                    stream.getTracks()[0].onended = () => {
                        const activeItem = document.querySelector('.background-mode-selector .selection-item.active');
                        if(activeItem && activeItem.dataset.background === 'capture') {
                            // 如果当前还是capture模式，则切换到透明
                            document.querySelector('[data-background="transparent"]').click();
                        }
                    };
                } catch (err) {
                    console.error('Error capturing screen:', err);
                    alert('屏幕捕获失败，请确保浏览器有相应权限');
                }
            };
            elementToHide.classList.remove('collapsed');
            currentBgType = 'capture';
            break;
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
            if (isPlayingAnnouncement) {
                console.warn('报站进行中，无法切换线路');
                showToast(strings?.toast?.announcement_in_progress || '报站进行中，请稍后再试', 2000);
                return;
            }
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
        if (isPlayingAnnouncement) {
            console.warn('报站进行中，无法切换线路');
            showToast(strings?.toast?.announcement_in_progress || '报站进行中，请稍后再试', 2000);
            return;
        }
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
                        <div class="frame-text-accent next-arrow"><span class="material-symbols-outlined">arrow_forward</span></div>
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
                prevBtn.style.opacity = '';
                prevBtn.style.cursor = '';
                nextBtn.style.opacity = 0.1;
                nextBtn.style.cursor = 'not-allowed';
            } else if (index === 0) { 
                prevBtn.style.opacity = 0.1;
                prevBtn.style.cursor = 'not-allowed';
                nextBtn.style.cursor = '';
                nextBtn.style.opacity = '';
            } else { 
                prevBtn.style.opacity = '';
                prevBtn.style.cursor = '';
                nextBtn.style.cursor = '';
                nextBtn.style.opacity = '';
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
    if (shareEnabled) syncToServer();
    window.activeLine = activeLine;
    window.activeLineId = activeLineId;

    if (__announceTimeout) clearTimeout(__announceTimeout);
    __announceTimeout = setTimeout(async () => { 
        __announceTimeout = null;
        await synthesizeAnnouncement(actionList[activeStepIndex]);
    }, 1000);
}

async function synthesizeAnnouncement(step) { 
    if (!step || playAnnouncement!==true || isPlayingAnnouncement === true) return;
    const announcementTypo = {
        'zh-CN':{
            'nextStation_first':'欢迎乘坐通运铁路，祝您出行愉快。本次列车终点站：{dest}。下一站：{sta}。',
            'nextStation':'列车启动，请扶好坐稳，本次列车终点站：{dest}。下一站：{sta}。',
            'nextStation_last':'列车启动，请扶好坐稳。下一站为本次列车的终点站：{sta}。',
            'nextStationPlat_first':'列车开启前进方向{door}车门，请下车的乘客做好准备。',
            'nextStationPlat':'列车开启前进方向{door}车门，请下车的乘客做好准备。',
            'nextStationPlat_last':'列车开启前进方向{door}车门，请全体乘客做好下车准备。',
            'arrive':'{sta}，到了。',
            'arrive_last':'终点站{sta}，到了。',
            'arrivePlat':'请从列车前进方向的{door}车门下车。',
            'arrivePlat_last':'请全体乘客从列车前进方向的{door}车门下车，欢迎再次乘坐通运铁路。',
            'transfer':'换乘{lines}的乘客，请从该站下车。请您注意换乘时间，合理安排行程。',
            'left':'左侧','right':'右侧','both':'两侧'
        },
        'zh-CN-liaoning':{
            'nextStation_first':'欢迎乘坐通运铁路，这趟车的终点站是：{dest}。下一站搁{sta}。',
            'nextStation':'这趟车的终点站是：{dest}。下一站搁{sta}。',
            'nextStation_last':'下一站是咱这趟车的终点站：{sta}。',
            'nextStationPlat_first':'列车将会开{door}的车门儿，请下车的乘客做好准备。',
            'nextStationPlat':'列车将会开{door}的车门儿，请下车的乘客做好准备。',
            'nextStationPlat_last':'列车将会开{door}的车门儿，所有乘客都得搁这站下车。',
            'arrive':'{sta}到了。',
            'arrive_last':'终点站{sta}，到了。',
            'arrivePlat':'请从列车前进方向{door}的车门儿下车。',
            'arrivePlat_last':'所有乘客都得搁列车前进方向{door}的车门儿下车，欢迎再次乘坐通运铁路。',
            'transfer':'导{lines}的乘客得搁这站下车，请您注意换乘时间，合理安排行程。',
            'left':'左半拉儿','right':'右半拉儿','both':'两边儿'
        },
        'en-US':{
            'nextStation_first':'Welcome to take GT Railways. The destination of the train is {dest}. The next station is {sta}.',
            'nextStation':'The next station is {sta}.',
            'nextStation_last':'The next station is {sta}, the destination of the train.',
            'nextStationPlat_first':'{door} doors will be used.',
            'nextStationPlat':'{door} doors will be used.',
            'nextStationPlat_last':'{door} doors will be used. All the passengers, please get ready to get off.',
            'arrive':'We are arriving at {sta}.',
            'arrive_last':'We are arriving at {sta}, the destination of the train.',
            'arrivePlat':'{door} doors will be used.',
            'arrivePlat_last':'{door} doors will be used. All the passengers, please get off at this station. Welcome to take GT Railways again.',
            'transfer':'Passengers for {lines}, please prepare to get off. Please pay attention to transfer time, and arrange your travel properly.',
            'left':'The left','right':'The right','both':'Both'
        },
        'zh-HK':{
            'nextStation_first':'歡迎乘搭通運鐵路，本次列车嘅终点站係{dest}。下一站：{sta}。',
            'nextStation':'下一站：{sta}。',
            'nextStation_last':'下一站係本次列车嘅终点站：{sta}。',
            'nextStationPlat_first':'{door}嘅車門將會打開。',
            'nextStationPlat':'{door}嘅車門將會打開。',
            'nextStationPlat_last':'{door}嘅車門將會打開。',
            'arrive':'列車已經到達：{sta}。',
            'arrive_last':'列車已經到達終點站：{sta}。歡迎再次乘搭通運鐵路。',
            'arrivePlat':'',
            'arrivePlat_last':'',
            'transfer':'轉乘{lines}嘅乘客請喺呢一站落車。',
            'left':'左邊','right':'右邊','both':'两邊'
        },
        'uk-UA':{
            'nextStation_first':'Наступна станцiя: {sta}.',
            'nextStation':'Наступна станцiя: {sta}.',
            'nextStation_last':'Наступна станцiя: {sta}, кінцева станцiя.',
            'nextStationPlat_first':'',
            'nextStationPlat':'',
            'nextStationPlat_last':'',
            'arrive':'Станцiя {sta}.',
            'arrive_last':'Станцiя {sta}, кінцева станцiя.',
            'arrivePlat':'',
            'arrivePlat_last':'',
            'transfer':'Перехід на {lines}.',
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
    const punctuationMap = {
        '、':{
            'zh_hans':'、',
            'zh_hant':'、',
            'en':', ',
            'uk':', '
        },
        'and':{
            'zh_hans':'和',
            'zh_hant':'和',
            'en':' and ',
            'uk':' i '
        }
    };

    // 设置播放状态标志，阻止用户切换
    isPlayingAnnouncement = true;
    console.log('开始报站流程，锁定用户交互');
    
    // 设置视觉提示
    setAnnouncementLockVisual();

    const stationInfo = document.createElement('div');
    let stationInfoContent = await loadStationInfo(step.station,false,'zh_hans');
    let stationInfoContentEn = await loadStationInfo(step.station,false,'en');
    
    // 等待MTR线路信息完全加载（包括颜色和英文名称）
    await new Promise(resolve => {
        setTimeout(resolve, 500);
    });
    
    console.log('MTR线路信息已加载完成，准备显示中文信息');
    

    // Get visible text, excluding material-symbols icon text
    function _getVisibleText(el) {
        const clone = el.cloneNode(true);
        clone.querySelectorAll('.material-symbols-outlined').forEach(icon => icon.remove());
        return (clone.textContent || '').replace(/\s+/g, ' ');
    }

    // 计算文本总字数的辅助函数（提升到外部作用域）
    function calculateTotalTextLength(element, phase = 'all', language = 'zh_hans') {
        if (!element) return 0;
        let totalLength = 0;
        let totalText = '';
        
        let selectors = [];
        if (phase === 'first') {
            // 第一阶段只统计 exits-info
            selectors = ['.exits-info'];
        } else if (phase === 'second') {
            // 第二阶段只统计 floors-info
            selectors = ['.floors-info > * > *'];
        } else {
            // 默认统计所有可见文本(排除标题和链接)
            const textElements = element.querySelectorAll(':not(.floors-title):not(.exits-title):not(.train-info-title):not(.train-info-link)');
            textElements.forEach(el => {
                if (el.textContent && el.style.display !== 'none') {
                    // 去除所有空格后统计长度
                    const trimmedText = _getVisibleText(el);
                    totalLength += trimmedText.length;
                }
            });
            return totalLength;
        }
        
        // 根据阶段选择器统计字数
        selectors.forEach(selector => {
            const elements = element.querySelectorAll(selector+':not(.material-symbols-outlined)');
            elements.forEach(el => {
                if (el.textContent && el.style.display !== 'none') {
                    // 去除所有空格后统计长度
                    const trimmedText = _getVisibleText(el);
                    console.log(`Counting text for selector "${selector}" (${language}):`,trimmedText.split(/\s+/).length, trimmedText);
                    if (language.includes('zh')) totalLength += trimmedText.length;
                    else totalLength += trimmedText.length * 0.3; // 英文按30%权重计算字数
                    totalText += trimmedText;
                }
            });
        });
        console.log(`Total text for ${element.id}: ${totalText}`);
        
        return totalLength;
    }
    
    // 根据字数计算展示时间（每个字符约100ms，最少3秒，最多15秒）
    function calculateDisplayTime(textLength) {
        const baseTime = 3000; // 基础时间3秒
        const timePerChar = 50; // 每个字符50ms
        const maxTime = 15000; // 最大时间15秒
        return Math.min(maxTime, Math.max(baseTime, textLength * timePerChar));
    }
    
    // 定义显示车站信息的通用函数，返回Promise以便追踪完成时间
    async function showStationInfo(content, language) {
        return new Promise((resolve) => {
        if (!content || !content.innerHTML) {
            console.error(`Failed to load station info for: ${step.station} (${language})`);
                resolve();
            return;
        }
        
        const infoElement = document.createElement('div');
        infoElement.innerHTML = content.innerHTML;
        infoElement.classList.add('item');
        infoElement.style.backgroundColor = 'var(--color-background-card)';
        infoElement.style.webkitBackdropFilter = 'var(--background-filter-transparent)';
        infoElement.style.backdropFilter = 'var(--background-filter-transparent)';
        infoElement.style.width = 'max-content';
        infoElement.style.height = 'fit-content';
        infoElement.style.position = 'absolute';
        infoElement.style.top = '540px';
        infoElement.style.left = '960px';
        infoElement.style.transform = 'translate(-50%, -50%) scale(2.5)';
        infoElement.style.maxWidth = '480px';
        infoElement.classList.add('station-info');
        infoElement.style.opacity = 0;
        if (currentBgType === 'transparent') infoElement.style.background = 'var(--color-background-card-solid)';
        infoElement.querySelectorAll('.train-info-title,.train-info-link,.floors-title,.floors-info').forEach(item => { 
            item.style.display = 'none';
        });
        infoElement.querySelectorAll('.floors-info,.facilities-container').forEach(item => { 
            item.style.width = '-webkit-fill-available';
        });
        
        const previewBackground = document.querySelector('.preview-background');
        previewBackground.appendChild(infoElement);
        
        setTimeout(() => { 
            
            // 计算第一阶段的字数和时间（只统计exits-info）
            const firstPhaseTextLength = calculateTotalTextLength(infoElement, 'first', language);
            const firstPhaseDisplayTime = calculateDisplayTime(firstPhaseTextLength);
            console.log(`第一阶段字数(exits-info): ${firstPhaseTextLength}, 展示时间: ${firstPhaseDisplayTime}ms`);
            infoElement.style.opacity = 1;
            console.log(`stationInfo height (${language})`, infoElement.getBoundingClientRect().height);
            if (infoElement.getBoundingClientRect().height > previewBackground.getBoundingClientRect().height) { 
                infoElement.style.transition = 'none';
                infoElement.style.transform = 'translate(-50%, 0%) scale(2.5)';
                setTimeout(() => { 
                    infoElement.style.transition = `all ${firstPhaseDisplayTime - 1000}ms ease-in-out`;
                    infoElement.style.transform = 'translate(-50%, -100%) scale(2.5)';
                }, 100);
            } else { 
                infoElement.style.transition = '';
                infoElement.style.transform = 'translate(-50%, -50%) scale(2.5)';
            }
            
            setTimeout(() => { 
                // 先更新显示状态,再计算字数
                infoElement.querySelector('.floors-title').style.display = '';
                infoElement.querySelectorAll('.floors-info').forEach(item => { 
                    item.style.display = '';
                });
                infoElement.querySelector('.exits-title').style.display = 'none';
                infoElement.querySelectorAll('.exits-info').forEach(item => { 
                    item.style.display = 'none';
                });
                
                // 计算第二阶段的字数和时间（只统计floors-info）
                const secondPhaseTextLength = calculateTotalTextLength(infoElement, 'second', language);
                const secondPhaseDisplayTime = calculateDisplayTime(secondPhaseTextLength);
                console.log(`第二阶段字数(floors-info): ${secondPhaseTextLength}, 展示时间: ${secondPhaseDisplayTime}ms`);
                
                console.log(`stationInfo height after update (${language})`, infoElement.getBoundingClientRect().height);
                if (infoElement.getBoundingClientRect().height > previewBackground.getBoundingClientRect().height) { 
                    infoElement.style.transition = 'none';
                    infoElement.style.transform = 'translate(-50%, 0%) scale(2.5)';
                    setTimeout(() => { 
                        infoElement.style.transition = `all ${secondPhaseDisplayTime - 1000}ms ease-in-out`;
                        infoElement.style.transform = 'translate(-50%, -100%) scale(2.5)';
                    }, 100);
                } else { 
                    infoElement.style.transition = '';
                    infoElement.style.transform = 'translate(-50%, -50%) scale(2.5)';
                }
                
                setTimeout(() => { 
                    infoElement.style.transition = '';
                    infoElement.style.opacity = 0;
                    setTimeout(() => { 
                        infoElement.remove();
                            console.log(`车站信息(${language})显示完毕`);
                            resolve(); // 车站信息完全移除后resolve
                    }, 500);
                }, secondPhaseDisplayTime);
            }, firstPhaseDisplayTime);
        }, 1000);
        });
    } 
    // 先显示中文信息（不等待完成）
    let stationInfoResolve;
    const stationInfoPromise = new Promise((resolve) => {
        stationInfoResolve = resolve;
    });
    
    if (isShowStationInfo) {  
        showStationInfo(stationInfoContent, 'zh_hans');
        console.log('中文车站信息开始显示');
        
        // 监听中文第二阶段开始,计算轮换时间并提前0.5秒启动英文信息
        const checkChineseSecondPhase = setInterval(() => {
            const zhElement = document.querySelector('.station-info:last-of-type');
            if (zhElement) {
                const floorsTitle = zhElement.querySelector('.floors-title');
                if (floorsTitle && floorsTitle.style.display !== 'none') {
                    // 第二阶段已开始,计算时间（只统计floors-info）
                    const secondPhaseTextLength = calculateTotalTextLength(zhElement, 'second', 'zh_hans');
                    const secondPhaseDisplayTime = calculateDisplayTime(secondPhaseTextLength);
                    console.log(`中文第二阶段字数(floors-info): ${secondPhaseTextLength}, 展示时间: ${secondPhaseDisplayTime}ms`);
                    clearInterval(checkChineseSecondPhase);
                    
                    // 在第二阶段结束前0.5秒启动英文信息显示
                    const advanceTime = Math.max(0, secondPhaseDisplayTime - 1000);
                    console.log(`将在 ${advanceTime}ms 后启动英文信息显示（提前1秒）`);
                    
                    setTimeout(async () => {
                        await showStationInfo(stationInfoContentEn, 'en');
                        console.log('英文车站信息显示完成');
                        stationInfoResolve();
                    }, advanceTime);
                }
            }
        }, 100);
        console.log('所有车站信息显示完毕');
    }
    

    //console.log('synthesizeAnnouncement',languages,step.station,activeLine);
    const firstSta = isUpwards?activeLine.route[activeLine.route.length-1].code:activeLine.route[0].code;
    const destSta = isUpwards?activeLine.route[0].code:activeLine.route[activeLine.route.length-1].code;
    const secondSta = isUpwards?activeLine.route[activeLine.route.length-3].code:activeLine.route[2].code;
    console.log(secondSta);
    
    // 异步获取doorSide
    const doorSide = await getDoorSide(step.station, step.platform, isUpwards?'up':'down');
    const lines = getLinesForStation(step.station).filter(line => line.id !== activeLineId.replace('-R',''));
    console.log(activeLine);
    
    // 定义单个语言的播报函数
    async function announceInLanguage(lang,index) {
    switch (step.station) { 
        case firstSta:
            break;
        case destSta: 
                const newAnnouncementLast = 
                        announcementTypo[lang.voice][step.type+'_last']
                    .replace('{sta}',getStationName(step.station,activeLineId==='manual'?index:lang.text))
                    .replace('{dest}',getStationName(destSta,activeLineId==='manual'?index:lang.text));
                showToast(newAnnouncementLast, 10000);
                await speakText(newAnnouncementLast, lang.voice);
                removeToast(newAnnouncementLast);
                    if (doorSide) { 
                    const platAnnouncementLast = 
                            announcementTypo[lang.voice][step.type+'Plat_last']
                            .replace('{door}',announcementTypo[lang.voice][doorSide]);
                    showToast(platAnnouncementLast, 10000);
                    await speakText(platAnnouncementLast, lang.voice);
                    removeToast(platAnnouncementLast);
                    }
                    if (lines.length>0 && step.type==='nextStation'){
                        const lastDelimiter = punctuationMap['、'][lang.text];
                    const transferAnnouncementLast = 
                            announcementTypo[lang.voice].transfer
                            .replace(
                                '{lines}',
                                lines.map(line => line.name[lang.text])
                                .join(lastDelimiter)
                            )
                            .replace(
                                // 匹配最后一个分隔符
                                new RegExp('(' + lastDelimiter.replace(/[.*+\?^${}()|[\]\\]/g, '\\$&') + ')([^' + lastDelimiter.replace(/[.*+\?^${}()|[\]\\]/g, '\\$&') + ']*$)', 'g'),
                                punctuationMap['and'][lang.text] + '$2'
                            );
                    showToast(transferAnnouncementLast, 10000);
                    await speakText(transferAnnouncementLast, lang.voice);
                    removeToast(transferAnnouncementLast);
                    }
            break;
        case secondSta: 
                if (activeLineId === 'manual') break; // 如果是自定义线路，就不区分首站和末站，全部按常规播报
                const newAnnouncementFirst = 
                        announcementTypo[lang.voice][step.type==='arrive'?'arrive':'nextStation_first']
                    .replace('{sta}',getStationName(step.station,activeLineId==='manual'?index:lang.text))
                    .replace('{dest}',getStationName(destSta,activeLineId==='manual'?index:lang.text));
                showToast(newAnnouncementFirst, 10000);
                await speakText(newAnnouncementFirst, lang.voice);
                removeToast(newAnnouncementFirst);
                    if (doorSide) { 
                    const platAnnouncementFirst = 
                            announcementTypo[lang.voice][step.type+'Plat']
                            .replace('{door}',announcementTypo[lang.voice][doorSide]);
                    showToast(platAnnouncementFirst, 10000);
                    await speakText(platAnnouncementFirst, lang.voice);
                    removeToast(platAnnouncementFirst);
                    }
                    if (lines.length>0 && step.type==='nextStation'){
                        const lastDelimiter = punctuationMap['、'][lang.text];
                    const transferAnnouncementFirst = 
                            announcementTypo[lang.voice].transfer
                            .replace(
                                '{lines}',
                                lines.map(line => line.name[lang.text])
                                .join(lastDelimiter)
                            )
                            .replace(
                                // 匹配最后一个分隔符
                                new RegExp('(' + lastDelimiter.replace(/[.*+\?^${}()|[\]\\]/g, '\\$&') + ')([^' + lastDelimiter.replace(/[.*+\?^${}()|[\]\\]/g, '\\$&') + ']*$)', 'g'),
                                punctuationMap['and'][lang.text] + '$2'
                            );
                    showToast(transferAnnouncementFirst, 10000);
                    await speakText(transferAnnouncementFirst, lang.voice);
                    removeToast(transferAnnouncementFirst);
                    }
            break;
        default: 
                    const newAnnouncement = 
                        announcementTypo[lang.voice][step.type]
                    .replace('{sta}',getStationName(step.station,activeLineId==='manual'?index:lang.text))
                    .replace('{dest}',getStationName(destSta,activeLineId==='manual'?index:lang.text));
                    showToast(newAnnouncement, 10000);
                    await speakText(newAnnouncement, lang.voice);
                    removeToast(newAnnouncement);
                    if (doorSide) { 
                        const platAnnouncement = 
                            announcementTypo[lang.voice][step.type+'Plat']
                            .replace('{door}',announcementTypo[lang.voice][doorSide]);
                        showToast(platAnnouncement, 10000);
                        await speakText(platAnnouncement, lang.voice);
                        removeToast(platAnnouncement);
                    }
                    if (lines.length>0 && step.type==='nextStation'){
                        const lastDelimiter = punctuationMap['、'][lang.text];
                        const transferAnnouncement = 
                            announcementTypo[lang.voice].transfer
                            .replace(
                                '{lines}',
                                lines.map(line => line.name[lang.text])
                                .join(lastDelimiter)
                            )
                            .replace(
                                // 匹配最后一个分隔符
                                new RegExp('(' + lastDelimiter.replace(/[.*+\?^${}()|[\]\\]/g, '\\$&') + ')([^' + lastDelimiter.replace(/[.*+\?^${}()|[\]\\]/g, '\\$&') + ']*$)', 'g'),
                                punctuationMap['and'][lang.text] + '$2'
                            );
                        showToast(transferAnnouncement, 10000);
                        await speakText(transferAnnouncement, lang.voice);
                        removeToast(transferAnnouncement);
                    }
                }
    }
    
    // 按语言顺序串行播报：先播完一种语言的所有内容，再播下一种语言
    let langIndex = 0;
    for (const lang of languages) {
        console.log(`开始播报${lang.voice}语言`);
        await announceInLanguage(lang,langIndex);
        console.log(`${lang.voice}语言播报完成`);
        langIndex++;
    }
    console.log('所有语言播报完成');
    
    // 并行执行：同时等待车站信息显示和语音播报完成
    if (isShowStationInfo) {
        await Promise.all([stationInfoPromise]);
    }
    console.log('所有车站信息显示和语音播报均已完成');
    
    // 所有报站和车站信息显示完成，解除锁定
    isPlayingAnnouncement = false;
    console.log('报站流程结束，解锁用户交互');
    
    // 清除视觉提示
    clearAnnouncementLockVisual();
}

// 语音播报函数
async function speakText(text, lang) {
    const preferredVoices = {
        'zh-CN':[
            'Microsoft Xiaoxiao Online (Natural)- Chinese (Mainland) (zh-CN)'
        ],
    }

    // 获取视频元素以备调整音量
    const videoElement = document.querySelector('.preview-background video');
    let originalVolume = 1; // 默认音量
    
    // 如果浏览器不支持语音合成，则直接返回
    if (!('speechSynthesis' in window)) {
        console.warn('浏览器不支持语音合成功能');
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        // 如果有视频元素，保存原始音量并降低它
        if (videoElement) {
            originalVolume = videoElement.volume;
            videoElement.volume = Math.min(originalVolume, 0.01); // 将音量降至最大1%
        }
        
        // 如果没有要朗读的文本，直接返回
        if (!text.trim()) {
            if (videoElement) {
                videoElement.volume = originalVolume; // 恢复原始音量
            }
            resolve();
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.onend = () => {
            // 语音播报结束后恢复视频原始音量
            if (videoElement) {
                videoElement.volume = originalVolume;
            }
            resolve();
        };
        utterance.onerror = () => {
            // 发生错误也恢复视频原始音量并解决Promise，避免阻塞
            if (videoElement) {
                videoElement.volume = originalVolume;
            }
            resolve();
        };
        speechSynthesis.speak(utterance);
    });
}

function recordProgress() { 
    if (__povViewOnly) return;
    const prefs = getPreferences();
    // 只有当用户明确禁用时才不记录进度（undefined或true都视为启用）
    if (prefs.resumeOnLoading === false) return;
    
    const bgContent = (currentBgType === 'color' || currentBgType === 'link') ? currentBgContent : '';
    const progressData = [{
        id: activeLineId,
        line: activeLine,
        isUpwards: isUpwards,
        index: activeStepIndex,
        steps: actionList,
        manualLine: window.lines.find(line => line.id === 'manual'),
        bgType: currentBgType,
        bgContent: bgContent,
        playAnnouncement: playAnnouncement,
        isShowStationInfo: isShowStationInfo,
    }];
    console.log('recordProgress',progressData);
    
    // 保存到localStorage（覆盖原有数据）
    localStorage.setItem('pov_progress', JSON.stringify(progressData));
        if (typeof CloudSync !== 'undefined' && CloudSync.pushCloudData) CloudSync.pushCloudData();
}

function resumeProgress() { 
    const prefs = getPreferences();
    const progressData = JSON.parse(localStorage.getItem('pov_progress'));
    if (prefs.resumeOnLoading !== false && progressData && progressData.length > 0) {
        const progress = progressData[0];
        activeLineId = progress.id;
        activeLine = progress.line;
        isUpwards = progress.isUpwards;
        activeStepIndex = progress.index;
        actionList = progress.steps;
        playList = progress.playList;
        playAnnouncement = false;
        isShowStationInfo = progress.isShowStationInfo !== false;
        if (progress.manualLine) { 
            window.lines.push(progress.manualLine);
        }
        if (progress.bgType) {
            applyBackgroundFromData(progress.bgType, progress.bgContent);
        }
    } else { 
        console.log(window.lines, window.lines[0]);
        activeLineId = window.lines[0].id;
        activeLine = window.lines[0];
    }
    console.log('resumeProgress', activeLineId, activeStepIndex, isUpwards, actionList);
}

function applyBackgroundFromData(bgType, bgContent) {
    if (!bgType || bgType === 'transparent') {
        currentBgType = 'transparent';
        currentBgContent = '';
        return;
    }
    const previewBackground = document.querySelector('.preview-background');
    if (!previewBackground) return;
    switch (bgType) {
        case 'color':
            if (bgContent) {
                currentBgType = 'color';
                currentBgContent = bgContent;
                previewBackground.style.backgroundColor = bgContent;
                previewBackground.style.backgroundImage = '';
            }
            break;
        case 'link':
            if (bgContent) {
                if (!canUseLinkBackground()) {
                    currentBgType = 'transparent';
                    currentBgContent = '';
                    return;
                }
                if (!isValidBackgroundUrl(bgContent)) {
                    currentBgType = 'transparent';
                    currentBgContent = '';
                    return;
                }
                currentBgType = 'link';
                currentBgContent = bgContent;
                if (isImageUrl(bgContent)) {
                    previewBackground.style.backgroundImage = `url(${bgContent})`;
                    previewBackground.style.backgroundSize = 'cover';
                    previewBackground.style.backgroundPosition = 'center';
                    previewBackground.innerHTML = '';
                } else if (isVideoUrl(bgContent)) {
                    if (bgContent.toLowerCase().endsWith('.m3u8')) {
                        const video = document.createElement('video');
                        video.style.width = '100%';
                        video.style.height = '100%';
                        video.style.objectFit = 'fill';
                        video.autoplay = true;
                        video.loop = true;
                        video.muted = true;
                        previewBackground.innerHTML = '';
                        previewBackground.appendChild(video);
                        if (video.canPlayType('application/vnd.apple.mpegurl') || 
                            video.canPlayType('application/x-mpegURL')) {
                            video.src = bgContent;
                        } else if (window.Hls && window.Hls.isSupported()) {
                            const hls = new window.Hls();
                            hls.loadSource(bgContent);
                            hls.attachMedia(video);
                            hls.on(window.Hls.Events.ERROR, function (event, data) {
                                console.error('HLS error:', data);
                            });
                        }
                    } else {
                        previewBackground.innerHTML = `<video src="${bgContent}" autoplay loop muted style="width:100%;height:100%;object-fit:fill;"></video>`;
                    }
                    setTimeout(() => {
                        const v = previewBackground.querySelector('video');
                        if (v) { v.volume = 0.05; v.muted = false; }
                    }, 100);
                } else {
                    previewBackground.style.backgroundImage = `url(${bgContent})`;
                    previewBackground.style.backgroundSize = 'cover';
                    previewBackground.style.backgroundPosition = 'center';
                    previewBackground.innerHTML = '';
                }
            }
            break;
    }
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
        const stationNames = window?.strings?.station_names?.[stationCode] || activeLine.route.find(station => station.code === stationCode).name;
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
        if (isPlayingAnnouncement) {
            console.warn('报站进行中，无法切换方向');
            showToast(strings?.toast?.announcement_in_progress || '报站进行中，请稍后再试', 2000);
            return;
        }
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

function initStationInfoSwitch() {
    const switchElement = document.querySelector('.show-station-info');
    if (!switchElement) return;
    if (isShowStationInfo === true) {
        switchElement.classList.add('active');
    } else { 
        switchElement.classList.remove('active');
    }

    switchElement.addEventListener('click', () => {
        if (isPlayingAnnouncement) {
            console.warn('报站进行中，无法切换车站');
            showToast(strings?.toast?.announcement_in_progress || '报站进行中，请稍后再试', 2000);
            return;
        }
        isShowStationInfo = !isShowStationInfo;
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
                if (isPlayingAnnouncement) {
                    console.warn('报站进行中，无法切换车站');
                    showToast(strings?.toast?.announcement_in_progress || '报站进行中，请稍后再试', 2000);
                    return;
                }
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
            if (isPlayingAnnouncement) {
                console.warn('报站进行中，无法切换车站');
                showToast(strings?.toast?.announcement_in_progress || '报站进行中，请稍后再试', 2000);
                return;
            }
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
        
        // 异步获取平台信息并设置到输入框中
        getPossiblePlatform(station.code, isUpwards ? 'up' : 'down')
            .then(platform => {
                if (platform) {
                    platformInput.value = platform.id;
                    // 更新actionList中所有匹配车站代码的条目的平台信息
                    actionList.forEach(step => {
                        if (step.station === station.code) {
                            step.platform = platform.id;
                        }
                    });
                    refreshFrame();
                } else {
                    console.info(`No platform found for ${station.code}, direction: ${isUpwards ? 'up' : 'down'}`);
                }
            })
            .catch(error => {
                console.error('Error getting platform:', error);
            });

        // 删除之前的console.log，因为它是异步的，会产生Promise {<pending>}输出
        // console.log(getPossiblePlatform(station.code,isUpwards?'up':'down'))
        platformInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        platformInput.addEventListener('input', (e) => { 
            const value = e.target.value;
            // 更新actionList中的对应平台信息
            actionList.forEach(step => {
                if (step.station === station.code) {
                    step.platform = platform.id;
                }
            });
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

function getStationInfo(code) {
    return new Promise((resolve, reject) => {
        fetch('./data/stations_info.json')
            .then(response => response.json())
            .then(data => {
                resolve(data[code]);
            })
            .catch(error => {
                console.error('Error fetching station data:', error);
                reject(error);
            });
    });
}

function getPossiblePlatform(code,dir='down') {
    return new Promise((resolve, reject) => { 
        getStationInfo(code)
            .then(stationData => {
                if (!stationData || !stationData.platforms) {
                    console.warn(`Station ${code} does not have platform data`);
                    resolve(null); // 返回 null 而不是抛出错误
                    return;
                }
                
                let platform = stationData.platforms.find(pl => pl.plat_side === dir);
                if (!platform) {
                    platform = stationData.platforms.find(pl => pl.id);
                    console.warn(`No platform found for direction ${dir} at station ${code}`);
                }
                resolve(platform);
            })
            .catch(error => { 
                console.error('Error fetching station data:', error); 
                reject(error); 
            })
    });
}

function getDoorSide(code,plat,dir='down') {
    return new Promise((resolve, reject) => { 
        getStationInfo(code)
            .then(stationData => {
                if (!stationData || !stationData.platforms) {
                    console.warn(`Station ${code} does not have platform data`);
                    resolve(null); // 返回 null 而不是抛出错误
                    return;
                }
                
                const rawDoorDirection = stationData.platforms.find(pl => pl.id === plat).door_side;
                const rawPlatDirection = stationData.platforms.find(pl => pl.id === plat).plat_side;
                let output = '';
                if (rawDoorDirection && rawPlatDirection) {
                    if (rawDoorDirection === 'both') output = 'both';
                    else if (rawPlatDirection === dir) output = rawDoorDirection;
                    else output = rawDoorDirection==='left'? 'right':'left';
                } else {
                    console.warn(`No side found for platform ${plat} at station ${code}`,rawDoorDirection,rawPlatDirection);
                }
                resolve(output);
            })
            .catch(error => { 
                console.error('Error fetching station data:', error); 
                reject(error); 
            })
    });
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
                <input type="url" placeholder="输入图片或视频链接" class="pref-value" id="backgroundLinkInput"></input>
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
                'capture': 'screen_share',
                'link': 'link'
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
    }
    toggleFullscreen();

    const previewContainer = document.querySelector('.preview-container');
    previewContainer.style.width = window.innerWidth *(fullscreenBtn.classList.contains('active') ? 1 : 0.6)+ 'px';
    previewContainer.style.minHeight = window.innerWidth * (fullscreenBtn.classList.contains('active') ? 0.5625 : 0.3375) + 'px';
    Array.from(previewContainer.children).forEach(container => { 
        container.style.transform = 'scale(' + window.innerWidth*(fullscreenBtn.classList.contains('active') ? 1 : 0.6)/1920 + ')';
    });
}

window.handleWindowResize = handleWindowResize;

let sessionId = localStorage.getItem('povSessionId') || '';
let shareEnabled = localStorage.getItem('povShareEnabled') === null ? true : localStorage.getItem('povShareEnabled') === 'true';
function initShareSwitch() {
    if (__povViewOnly) return;
    const shareToggle = document.querySelector('.share-toggle');
    const shareIdEl = document.getElementById('shareId');
    const copyBtn = document.getElementById('copyShareLink');
    const sharePrefItem = shareToggle?.closest('.pref-item');
    if (!shareToggle || !shareIdEl) return;

    const loggedIn = typeof window.auth !== 'undefined' && window.auth.isLoggedIn && window.auth.isLoggedIn();
    if (!loggedIn) {
        shareEnabled = false;
        if (sharePrefItem) {
            sharePrefItem.style.opacity = '0.5';
            sharePrefItem.style.cursor = 'not-allowed';
            sharePrefItem.title = '请先登录后再使用分享功能';
        }
        shareToggle.classList.remove('active');
        shareToggle.style.pointerEvents = 'none';
        if (copyBtn) copyBtn.style.display = 'none';
        shareIdEl.style.display = 'none';
        shareToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            showToast('请先登录后再使用分享功能', 3000);
            if (window.auth && window.auth.login) window.auth.login();
        });
        if (sharePrefItem) {
            sharePrefItem.addEventListener('click', () => {
                showToast('请先登录后再使用分享功能', 3000);
                if (window.auth && window.auth.login) window.auth.login();
            });
        }
        return;
    }

    function viewerLink() {
        return './pov-frame.html?shareId=' + encodeURIComponent(sessionId);
    }

    shareToggle.addEventListener('click', () => {
        shareEnabled = !shareEnabled;
        localStorage.setItem('povShareEnabled', String(shareEnabled));
        updateUI();
        syncToServer();
    });

    shareIdEl.addEventListener('click', () => {
        window.open(viewerLink(), '_blank');
    });

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
        if (!sessionId) return;
        navigator.clipboard.writeText(sessionId).then(() => {
            showToast('分享链接已复制到剪贴板');
        }).catch(() => {
            showToast('复制失败，请手动复制链接');
        });
        });
    }

    updateUI();
    syncToServer();

    window.addEventListener('beforeunload', () => {
        if (!shareEnabled) return;
        try {
            navigator.sendBeacon('./api/pov/share', new Blob([JSON.stringify(buildProgressPayload())], { type: 'application/json' }));
        } catch (error) {
            console.warn('离开时同步进度失败:', error);
        }
    });
}

async function syncToServer() {
    try {
        const response = await fetch('./api/pov/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildProgressPayload())
        });
        const data = await response.json();
        if (data.success) {
            sessionId = data.sessionId;
            localStorage.setItem('povSessionId', sessionId);
            updateUI();
        }
    } catch (error) {
        console.warn('同步分享进度失败:', error);
    }
}

function buildProgressPayload() {
    const progress = JSON.parse(localStorage.getItem('pov_progress'));
    const current = Array.isArray(progress) && progress.length > 0 ? progress[0] : null;
    const bgContent = (currentBgType === 'color' || currentBgType === 'link') ? currentBgContent : '';
    const currentUser = (typeof window.auth !== 'undefined' && window.auth.getCurrentUser) ? window.auth.getCurrentUser() : null;
    return {
        sessionId,
        shared: shareEnabled,
        username: currentUser ? currentUser.username : '',
        progress: {
            activeLineId,
            activeLine,
            isUpwards,
            activeStepIndex,
            actionList,
            playList,
            bgType: currentBgType,
            bgContent: bgContent,
            playAnnouncement,
            isShowStationInfo,
            savedAt: Date.now(),
            lineSummary: current || null
        }
    };
}

function updateUI() {
    const shareToggle = document.querySelector('.share-toggle');
    const shareIdEl = document.getElementById('shareId');
    shareToggle.classList.toggle('active', shareEnabled);
    if (sessionId) {
        shareIdEl.textContent = sessionId;
        shareIdEl.title = '点击查看分享链接';
    } else {
        shareIdEl.textContent = '';
        shareIdEl.title = '';
    }
}