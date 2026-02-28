// 修改文件内容
// 解析url参数确定页面语言
var urlParams = new URLSearchParams(window.location.search);
var lang = urlParams.get('lang');
if (lang === null) {
    lang = 'zh_hans';
}
console.log('lang:', lang);
if (lang.startsWith('zh')) {
    document.documentElement.lang = 'zh';
} else {
    document.documentElement.lang = lang;
}

let sidebarCollapseDone = false;

// 页面加载完成后执行初始化函数
document.addEventListener('DOMContentLoaded', function () {
    
    // 加载线路数据
    fetch('./data/lines.json')
        .then(response => response.json())
        .then(data => {
            window.lines = data.lines;
            // 加载network.json
            fetch('./data/network.json')
                .then(networkResponse => networkResponse.json())
                .then(networkData => {
                    window.stationsNetwork = networkData.stations;
                    fetch('strings.json')
                        .then(stringsResponse => stringsResponse.json())
                        .then(stringsData => {
                            window.strings = stringsData;
                            // 加载列车信息数据
                            fetch('./data/trains_info.json')
                                .then(trainsInfoResponse => trainsInfoResponse.json())
                                .then(trainsInfoData => {
                                    window.trainsInfo = trainsInfoData.trains;
                                    // 初始化PositionUtils模块
                                    if (typeof PositionUtils !== 'undefined') {
                                        PositionUtils.init({
                                            trainsInfo: window.trainsInfo,
                                            stationsNetwork: window.stationsNetwork,
                                            lines: window.lines,
                                            strings: window.strings,
                                            lang: lang
                                        });
                                    }
                                    init();
                                    initLanguageSelector();
                                    handleWindowResize();
                                })
                                .catch(error => console.error('Error loading trains info data:', error));
                        })
                    .catch(error => console.error('Error loading Language data:', error));
                })
                .catch(error => console.error('Error loading network data:', error));
        })
        .catch(error => console.error('Error loading lines data:', error));
});

// 初始化函数
function init() {

    
    // 监听窗口大小变化
    handleWindowResize();
    window.addEventListener('resize', handleWindowResize);

    const headerTitle = document.querySelector('header h1');
    const pageTitle = document.querySelector('title');
    console.log(pageTitle.textContent);
    headerTitle.textContent = strings.lines_info.page_title[lang];
    pageTitle.textContent = strings.lines_info.page_title[lang] + ' - ' + strings.mainpage.gtr_info[lang];
    
    // 获取线路选择和车站显示的DOM元素
    //const lineSelection = document.querySelector('.line-selection');
    const stationsDisplay = document.querySelector('.stations-display');

    // 动态生成线路选择按钮
    /*const buttonGroup = document.createElement('div');
    buttonGroup.className = 'lines-button';
    window.lines.forEach(line => {
        const button = document.createElement('button');
        button.classList.remove('active');
        // 加载对应语言的文本，如中文为line.name.zh_hans，英文为line.name.en
        button.textContent = line.name[lang];
        button.addEventListener('click', () => {
            //displayStations(line);
            //displayTrains();
            // 点击后添加对应的url参数
            window.location.href = `?line=${line.id}&lang=${lang}`;
        });
        buttonGroup.appendChild(button);
    });
    lineSelection.appendChild(buttonGroup);*/

    // 为selection.line-selector也添加线路选项selection-item
    const lineSelectors = document.querySelectorAll('.line-selector');
    window.lines.forEach(line => {
        lineSelectors.forEach(lineSelector => {
            const item = document.createElement('div');
            item.className = `selection-item ${line.id}`;
            item.innerHTML = `
            <div class="line-name-container">
                ${line.name[lang]}
                <span class="line-name-original">${!lang.startsWith('zh') ? line.name['zh_hans'] : ''}</span>
            </div>
            `;
            item.addEventListener('click', () => {
                //displayStations(line);
                //displayTrains();
                // 点击后添加对应的url参数
                window.location.href = `?line=${line.id}&lang=${lang}`;
            })
            lineSelector.appendChild(item);
            if (line.id === getActiveLineId()) {
                item.classList.add('active');
            }
        });
    });

    // 调整所有lineSelector样式
    lineSelectors.forEach(lineSelector => {
        lineSelector.setAttribute('style', `--color-primary: ${window.lines.find(line => line.id === getActiveLineId()).color}`);
    });

    //const divider = document.createElement('div');
    //divider.className = 'divider';
    //lineSelection.appendChild(divider);
    
    const mapBtn = document.querySelector('.map-btn');
    mapBtn.title = strings.pov_frame.page_title[lang];
    mapBtn.addEventListener('click', () => {
        window.open('pov-frame.html', '_blank');
    });
    
    // 修改以下代码以处理多个按钮实例
    const fareBtns = document.querySelectorAll('.fare-btn');
    fareBtns.forEach(fareBtn => {
        const fareBtnText = fareBtn.querySelector('span');
        if (fareBtnText) {
            fareBtnText.textContent = strings.ticket_calculator[fareBtnText.classList.contains('tab-text')?'page_title_short':'page_title'][lang];
        } else {
            fareBtn.title = strings.ticket_calculator.page_title[lang];
        }
        fareBtn.addEventListener('click', () => {
            window.open(`ticket_calculator.html${'?lang='+lang}`, '_self');
        });
    });
    
    const trainsBtns = document.querySelectorAll('.trains-btn');
    trainsBtns.forEach(trainsBtn => {
        const trainsBtnText = trainsBtn.querySelector('span');
        if (trainsBtnText) {
            trainsBtnText.textContent = strings.trains_info[trainsBtnText.classList.contains('tab-text')?'page_title_short':'page_title'][lang];
        } else {
            trainsBtn.title = strings.trains_info.page_title[lang];
        }
        trainsBtn.addEventListener('click', () => {
            window.open(`trains_info.html${'?lang='+lang}`, '_self');
        });
    });
    
    const linesBtns = document.querySelectorAll('.lines-btn');
    linesBtns.forEach(linesBtn => {
        const linesBtnText = linesBtn.querySelector('span');
        if (linesBtnText) {
            linesBtnText.textContent = strings.lines_info[linesBtnText.classList.contains('tab-text')?'page_title_short':'page_title'][lang];
        } else {
            linesBtn.title = strings.lines_info.page_title[lang];
        }
        linesBtn.addEventListener('click', () => {
            // 获取用户最后访问的线路
            const lastVisitedLine = localStorage.getItem('lastVisitedLine');
            let targetLine = lines[0].id; // 默认线路
            
            // 如果有最后访问的线路且该线路存在，则使用该线路
            if (lastVisitedLine && window.lines.some(line => line.id === lastVisitedLine)) {
                targetLine = lastVisitedLine;
            }
            
            window.open(`lines_info.html?line=${targetLine}&lang=${lang}`, '_self');
        });
    });

    const prefBtns = document.querySelectorAll('.preferences-btn');
    prefBtns.forEach(prefBtn => {
        const prefBtnText = prefBtn.querySelector('span');
        if (prefBtnText) {
            prefBtnText.textContent = strings.preferences[prefBtnText.classList.contains('tab-text')?'page_title_short':'page_title'][lang];
        } else {
            prefBtn.title = strings.preferences.page_title[lang];
        }
        prefBtn.addEventListener('click', () => { 
            window.open(`preferences.html${'?lang='+lang}`, '_self');
        });
    })

    const lineId = getActiveLineId();
    // 获取lineId对应的线路数据、
    const line = window.lines.find(line => line.id === lineId);

    loadSegmentInfo();
    loadUpdateTime();

    displayStations(line);
    displayTrains();
    // 当获取受阻时再试一次
    
    //setInterval(displayTrains, 5000);

    const shareBtn = document.querySelector('.share-btn');
    shareBtn.title = strings.lines_info.share_route[lang];
    shareBtn.addEventListener('click', function () { 
        shareRouteMap();
    });
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

// 显示指定线路的车站信息函数
function displayStations(line) {
    const stationsDisplay = document.querySelector('.stations-display');
    // 清空当前显示的车站信息
    stationsDisplay.innerHTML = '';

    // 更改--current-color 变量的值
    document.documentElement.style.setProperty('--current-color', line.color);

    // 创建车站列表的DOM元素
    const ul = document.createElement('ul');
    ul.className = 'station-list';
    ul.classList.add('item');
    
    // 如果是GX线路，添加GX类名
    if (line.id.startsWith('GX')) {
        ul.classList.add('GX');
    }

    // 遍历线路中的每个节点，筛选出车站并创建列表项
    line.route.filter(node => node.type === 'station').forEach(station => {
        const li = document.createElement('li');
        li.classList.add('station-list-item');
        li.innerHTML = `
            <div class="train-container"></div>
            <div class="station-circle" style="border-color: ${line.color}"></div>
            <div class="station-name-container">
                <span class="station-name">${getStationName(station.code,lang)}</span>
                <span class="station-name-original">${getStationName(station.code,'original')!==getStationName(station.code) ? getStationName(station.code,'original') : ''}</span>
            </div>
        `;
        ul.appendChild(li);

        // 在每一站之间加上垂直连接线
        if (station !== line.route[line.route.length - 1]) {
            const lineItem = document.createElement('li');
            lineItem.classList.add('station-line');
            lineItem.innerHTML = `
                <div class="train-container"></div>
                <div class="station-line-block"></div>
            `;
            ul.appendChild(lineItem);
        }
    });

    // 将车站列表添加到页面中
    stationsDisplay.appendChild(ul);

    // 调用显示列车信息的函数
    //displayTrains();
    //highlightTrainsForCurrentLine();
}

// 根据显示名称查找三字码
function getStationCode(displayName) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.getStationCode(displayName);
    }
    
    // 降级处理：如果PositionUtils不可用，使用原有实现
    // 遍历window.stationsNetwork查找匹配的车站
    if (!window.stationsNetwork) return null;
    
    for (const station of window.stationsNetwork) {
        // 提取前三个大写字母作为三字码
        const stationCode = station.name.match(/[A-Z]/g)?.slice(0, 3).join('') || '';
        if (getStationName(stationCode, lang) === displayName) {
            return stationCode;
        }
    }
    
    return null;
}

let offlineToastShown = false;

let dataCount = 0;
let capturedData = null;

// 显示列车信息
function displayTrains() {
    // 清除现有的列车元素
    document.querySelectorAll('.train-item').forEach(el => el.remove());
    document.querySelectorAll('.player-count-container').forEach(el => el.remove());

    if (!window.lines || !window.stationsNetwork) return;

    const trainsContainer = document.querySelector('.stations-display');
    if (!trainsContainer) return;

    // 加载列车数据
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://track.nitrogen.hydcraft.cn/api/trains.rt', true);
    // 如无法加载则提示离线
    xhr.onerror = function () {
        if (offlineToastShown === false) {
            let maintainingToast = '';
            // 当时间在北京时间4:00-4:10 之间显示提示
            if (new Date().getUTCHours() == 20 && new Date().getUTCMinutes() <= 10 ) {
                maintainingToast = strings.lines_info.server_maintaining[lang];
            }
            showToast(strings.lines_info.loading[lang] + maintainingToast);
            offlineToastShown = true;
        }
        setTimeout(function () {
            displayTrains();
        }, 5000);
        return;
    };

    xhr.onreadystatechange = function () {
        if (xhr.status === 200) {
            offlineToastShown = false;
            // 解析服务器发送的数据，移除前缀'data:'并解析JSON
            let rawData = xhr.responseText.replace(/^data:/, '');
            // 移除所有空白字符（包括换行符、空格等）和注释
            rawData = rawData.replace(/[$\s\*\/]+/g, '');

            // 手动解析 raw data，提取最后一个有效的 JSON 字符串
            let jsonStrings = [];
            let startIndex = -1;
            let depth = 0;


            for (let i = 0; i < rawData.length; i++) {
                const char = rawData[i];
                
                if (char === '{' && depth++ === 0) {
                    startIndex = i;
                } else if (char === '}' && --depth === 0 && startIndex !== -1) {
                    jsonStrings.push(rawData.substring(startIndex, i + 1));
                    startIndex = -1;
                }
            }

            // 尝试解析每个 JSON 字符串，取最后一个有效的结果
            let data = null;
            let lastError = null;
            if (jsonStrings && jsonStrings.length > 0) {
                for (let i = 0; i < jsonStrings.length; i++) {
                    try {
                        //console.log (`解析第 ${i} 个 JSON`);
                        data = JSON.parse(jsonStrings[i]);
                        dataCount++;
                        lastError = null; // 清除错误记录
                    } catch (e) {
                        console.error(`解析第 ${i} 个 JSON 失败:`, e);
                        lastError = e; // 记录最后一个错误
                    }
                }
            } else {
                console.error('未找到有效的 JSON 数据');
            }

            // 如果解析失败，尝试更灵活的解析方法
            if (!data && rawData) {
                try {
                    // 使用函数方式创建 JSON 对象作为最后的尝试
                    let cleanedRawData = rawData
                        .replace(/(['"])?([a-zA-Z0-9_]+)(['"]):/g, '"$2":') // 确保键名有引号
                        .replace(/:([^,"}\]]+)$/gm, ': "$1"') // 修复末尾值
                        .replace(/(["'])$(?:(?=(\\?))\2.)*?\1/g, match => match.replace(/\n/g, '\\n')); // 转义换行符

                    data = new Function('return ' + cleanedRawData)();
                } catch (fallbackError) {
                    console.error('备用解析失败:', fallbackError);
                    // 如果有之前的解析错误，也一并记录
                    if (lastError) {
                        console.error('之前的解析错误:', lastError);
                    }
                    //showToast(strings.lines_info.json_parse_error?.[lang] || 'JSON解析错误');
                    return;
                }
            }

            // 验证数据结构
            if (data) {
                if (typeof data === 'object' && data.trains && Array.isArray(data.trains)) {
                    // 验证列车数据结构的有效性
                    const isValidTrain = (train) => {
                        return train && 
                               typeof train === 'object' && 
                               train.name && 
                               train.cars && 
                               Array.isArray(train.cars) && 
                               train.cars.length > 0 &&
                               train.cars[0].leading && 
                               train.cars[0].leading.location;
                    };
                    
                    // 过滤掉无效的列车数据
                    data.trains = data.trains.filter(isValidTrain);
                    
                    //console.log(`有效列车数据数量: ${data.trains.length}`);
                } else {
                    console.error('解析成功但数据结构无效');
                    //showToast(strings.lines_info.invalid_data_format?.[lang] || '数据格式错误');
                    return;
                }
                
                if (data && !capturedData) {
                    try {
                        capturedData = structuredClone(data);
                        // 为capturedData添加一个时间戳
                        capturedData.timestamp = Date.now();
                    } catch (cloneError) {
                        console.warn('structuredClone失败，使用替代方法:', cloneError);
                        try {
                            capturedData = JSON.parse(JSON.stringify(data));
                            capturedData.timestamp = Date.now();
                        } catch (jsonError) {
                            console.error('JSON序列化失败:', jsonError);
                            capturedData = data;
                            capturedData.timestamp = Date.now();
                        }
                    }
                }

                // 不再筛选对应线路列车以及GX开头的列车
                if (data && data.trains && Array.isArray(data.trains)) {
                    // 先清理现有的列车元素，避免重复
                    document.querySelectorAll('.train-item').forEach(el => el.remove());
                    
                    data.trains
                        .filter(train => { 
                            // 检查列车数据是否完整
                            if (!train || !train.name || !train.cars || !Array.isArray(train.cars) || train.cars.length === 0) {
                                console.warn('过滤掉不完整的列车数据:', train);
                                return false; // 过滤掉不完整的列车数据
                            }
                            
                            if (!train.cars[0].leading || !train.cars[0].leading.location) {
                                console.warn('过滤掉缺少位置信息的列车:', train.name);
                                return false; // 过滤掉缺少位置信息的列车
                            }
                            
                            const activeLineId = getActiveLineId();
                            return train.name;
                            //return train.name.startsWith(activeLineId) || train.name.startsWith('GX');
                        })
                        .forEach(train => {
                            //console.log('Processing train:', train.name);
                        //data.trains.forEach(train => {
                            // 检查是否在轨道上
                            let closestTrackDistance = Infinity;
                            let currentTrack = null;
                            let trackProgress = 0;
                            let carDirection = '';
                            let closestSegmentDirection = null; // 保存最近线段的方向
                            let isTrainAtStation = false; // 标记列车是否在车站
                            //train.cars.forEach((car, index) => {
                                //if (index < 1) {
                                    // 获取列车初始位置并进行深拷贝，避免后续随原数据变化
                                    let carPos = train.cars[0].leading.location;
                                    let isStopped = train.stopped === 'true';

                                    // 将列车在一段时间内位移的方向定义为行驶方向
                                    let direction = getDirection(train.name, carPos, isStopped);
                                    
                                    // 首先检查列车是否在车站
                                    let closestStationDistance = Infinity;
                                    let platform = '';
                                    let stationTrainItem = null;
                                    
                                    // 检查是否为GX列车且在车站内
                                    const isGXTrain = train.name.startsWith('GX');
                                    let isStationInCurrentLine = false;
                                    
                                    // 如果是GX列车，先检查当前线路是否包含该车站
                                    if (isGXTrain) {
                                        const currentLine = window.lines.find(line => line.id === getActiveLineId());
                                        if (currentLine) {
                                            // 检查当前线路是否包含列车所在车站
                                            for (const station of currentLine.route.filter(node => node.type === 'station')) {
                                                const stationCoords = findStationCoordinates(station.code);
                                                for (const coord of stationCoords) {
                                                    const distance = Math.sqrt(
                                                        Math.pow(carPos.x - coord.x, 2) + 
                                                        Math.pow(carPos.y - coord.y, 2) + 
                                                        Math.pow(carPos.z - coord.z, 2)
                                                    );
                                                    if (distance <= 200) {
                                                        isStationInCurrentLine = true;
                                                        break;
                                                    }
                                                }
                                                if (isStationInCurrentLine) break;
                                            }
                                        }
                                    }
                                    
                                    window.lines.forEach(line => {
                                        if (line.id !== getActiveLineId()) return;
                                        line.route.filter(node => node.type === 'station').forEach(station => {
                                            const stationCoords = findStationCoordinates(station.code);
                                            stationCoords.forEach(coord => {
                                                // 确保坐标数据存在
                                                if (!coord || coord.x === undefined || coord.y === undefined || coord.z === undefined) {
                                                    return;
                                                }
                                                
                                                const distance = Math.sqrt(
                                                    Math.pow(carPos.x - coord.x, 2) + 
                                                    Math.pow(carPos.y - coord.y, 2) + 
                                                    Math.pow(carPos.z - coord.z, 2)
                                                );
                                                if (distance <= 200 && distance < closestStationDistance) {
                                                    closestStationDistance = distance;
                                                    // 对于GX列车，如果不在当前线路停靠，则显示省略号
                                                    if (isGXTrain && !isStationInCurrentLine) {
                                                        platform = '…';
                                                    } else {
                                                        // 将coord.name去掉station.code作为站台名
                                                        platform = coord.name.replace(station.code, "");

                                                        if (train.stopped === 'false') {
                                                            // 如果列车未到站则去除站台编号中的字母
                                                            platform = platform.replace(/[A-Za-z]/g, '') + '…';
                                                        }
                                                    }
                                                }
                                            });
                                        });
                                    });
                                    
                                    // 如果列车在车站范围内，则标记为在车站
                                    if (closestStationDistance <= 140) {
                                        isTrainAtStation = true;
                                        
                                        // 创建列车元素并放置到对应的车站
                                        stationTrainItem = document.createElement('div');
                                        stationTrainItem.className = 'train-item';
                                        
                                        // 根据列车方向确定站台编号
                                        let platformWithDirection = platform;
                                        /*if (carDirection === 'down') {
                                            // 下行方向显示为A站台
                                            platformWithDirection = platform.replace(/[A-Za-z]/g, '') + 'A';
                                        } else if (carDirection === 'up') {
                                            // 上行方向显示为B站台
                                            platformWithDirection = platform.replace(/[A-Za-z]/g, '') + 'B';
                                        }*/
                                        // 如果方向未知，则保持原始platform值
                                        
                                        stationTrainItem.innerHTML = `
                                            <img src="./res/train.png" class="icon train-icon" style="z-index:1"></img>
                                            <span class="train-name">${train.name}</span>
                                            <span class="platform">${platformWithDirection} </span>
                                        `;
                                        
                                        // 将列车放置到对应车站
                                        window.lines.forEach(line => {
                                            if (line.id !== getActiveLineId()) return;
                                            line.route.filter(node => node.type === 'station').forEach(station => {
                                                const stationCoords = findStationCoordinates(station.code);
                                                let filteredCoords = stationCoords.filter(coord => 
                                                    coord.name.replace(station.code, "") === platform);
                                                
                                                filteredCoords.forEach(coord => {
                                                    // 确保坐标数据存在
                                                    if (!coord || coord.x === undefined || coord.y === undefined || coord.z === undefined) {
                                                        return;
                                                    }
                                                    
                                                    const distance = Math.sqrt(
                                                        Math.pow(carPos.x - coord.x, 2) + 
                                                        Math.pow(carPos.y - coord.y, 2) + 
                                                        Math.pow(carPos.z - coord.z, 2)
                                                    );
                                                    if (distance <= 200) {
                                                        // 找到对应车站的DOM节点
                                                        const stationElement = document.querySelectorAll('.station-list-item');
                                                        stationElement.forEach(element => {
                                                            const stationName = element.querySelector('.station-name').textContent;
                                                            if (stationName === getStationName(station.code,lang)) {
                                                                const trainContainer = element.querySelector('.train-container');
                                                                if (trainContainer) {
                                                                    trainContainer.appendChild(stationTrainItem);
                                                                }
                                                            }
                                                        });
                                                    }
                                                });
                                            });
                                        });
                                        
                                        // 检查是否需要添加警告标志
                                        checkAndAddWarningSign(train, stationTrainItem, true);
                                    }
                                    
                                    // 只有当列车不在车站范围内时，才执行轨道位置检测
                                    if (!isTrainAtStation) {
                                        window.lines.forEach(line => {
                                            const activeLineId = getActiveLineId();
                                            const activeLineName = getLineName(activeLineId);
                                            if (line.id !== activeLineId) return;
                                            line.route.filter(node => node.type === 'track').forEach((track, index) => {
                                                for (let i = 0; i < track.nodes.length - 1; i++) {
                                                    const v = track.nodes[i];
                                                    const w = track.nodes[i + 1];
                                                    const distance = distanceFromSegment(carPos, v, w);
                                                    
                                                    // 添加调试日志
                                                    //console.log(`列车 ${train.name} 到轨道段[${index}][${i}]的距离: ${distance}`);
                                                    
                                                    //console.log(distance);
                                                    if (distance < closestTrackDistance && distance <= 100) { // 增加距离阈值到100
                                                        closestTrackDistance = distance;
                                                        const currentLine = line.id;
                                                        currentTrack = { currentLine, track, index };
                                                        //console.log('track:',currentTrack);

                                                        // 保存最近线段的方向向量
                                                        closestSegmentDirection = [(w.x - v.x), (w.z - v.z)];
                                                        
                                                        // 计算此时列车离上一个节点的距离
                                                        const upwardDistance = calculateTotalDistance(carPos, track, index);
                                                        //console.log('track.nodes[track.nodes.length]: ',track.nodes[track.nodes.length - 1]);
                                                        const segmentDistance = calculateTotalDistance(track.nodes[track.nodes.length - 1], track, track.nodes.length - 1);
                                                        trackProgress = upwardDistance / segmentDistance;
                                                        //console.log(train.name,'trackProgress: ',trackProgress,'distance: ',upwardDistance,'/',segmentDistance);
                                                    }
                                                }
                                                //console.log('track distance: ',closestTrackDistance, line.id, index);
                                            });
                                        });
                                        
                                        /*console.log(`列车 ${train.name} 轨道检测结果:`, {
                                            isTrainAtStation: isTrainAtStation,
                                            closestTrackDistance: closestTrackDistance,
                                            currentTrack: currentTrack,
                                            closestSegmentDirection: closestSegmentDirection
                                        });*/
                                        
                                        // 只有找到最近的轨道段时才计算方向
                                        if (closestSegmentDirection) {
                                            // 计算方向向量的模长
                                            const magDirection = Math.sqrt(direction[0] ** 2 + direction[1] ** 2);
                                            // 计算轨道方向向量的模长
                                            const magTrackDirection = Math.sqrt(closestSegmentDirection[0] ** 2 + closestSegmentDirection[1] ** 2);

                                            // 添加调试日志
                                            /*console.log(`列车 ${train.name} 方向计算:`, {
                                                directionVector: direction,
                                                trackDirectionVector: closestSegmentDirection,
                                                magDirection: magDirection,
                                                magTrackDirection: magTrackDirection
                                            });*/

                                            // 防止除以零
                                            if (magDirection === 0 || magTrackDirection === 0) {
                                                // 如果任意向量长度为0，则无法计算角度，默认设为 'unknown'
                                                // 但我们可以尝试从localStorage中获取之前的方向
                                                try {
                                                    const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
                                                    const currentTrainData = allTrainsData[train.name];
                                                    if (currentTrainData && currentTrainData.direction && currentTrainData.direction !== 'unknown') {
                                                        carDirection = currentTrainData.direction;
                                                        //console.log(`列车 ${train.name} 无法计算方向，继承之前方向: ${carDirection}`);
                                                    } else {
                                                        carDirection = 'unknown';
                                                        //console.log(`列车 ${train.name} 无法计算方向且无历史方向，设为 unknown`);
                                                    }
                                                } catch (e) {
                                                    carDirection = 'unknown';
                                                    //console.log(`列车 ${train.name} 无法计算方向且读取历史数据失败，设为 unknown`);
                                                }
                                            } else {
                                                // 计算点积
                                                const dotProd = direction[0] * closestSegmentDirection[0] + direction[1] * closestSegmentDirection[1];
                                                const cosAngle = dotProd / (magDirection * magTrackDirection);
                                                
                                                // 添加调试日志
                                                /*console.log(`列车 ${train.name} 点积计算:`, {
                                                    dotProduct: dotProd,
                                                    cosAngle: cosAngle
                                                });*/

                                                // 直接比较余弦值，避免调用 Math.acos 提升性能且增加数值稳定性
                                                if (cosAngle > 0.1) {  // 增加一点容差
                                                    carDirection = 'down';  // 当余弦值大于0.1，表示夹角小于约84度
                                                } else if (cosAngle < -0.1) {  // 增加负值判断
                                                    carDirection = 'up';    // 当余弦值小于-0.1，表示夹角大于约96度
                                                } else {
                                                    // 余弦值在-0.1到0.1之间，方向不确定
                                                    carDirection = 'unknown';
                                                    //console.log(`列车 ${train.name} 方向不确定，余弦值接近0: ${cosAngle}`);
                                                }
                                                //console.log(`列车 ${train.name} 方向计算结果: ${carDirection}`);
                                            }
                                        } else {
                                            // 如果没有找到最近的轨道段，则无法确定方向
                                            // 尝试从localStorage中获取之前的方向
                                            try {
                                                const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
                                                const currentTrainData = allTrainsData[train.name];
                                                if (currentTrainData && currentTrainData.direction && currentTrainData.direction !== 'unknown') {
                                                    carDirection = currentTrainData.direction;
                                                   // console.log(`列车 ${train.name} 未找到最近轨道段，继承之前方向: ${carDirection}`);
                                                } else {
                                                    carDirection = 'unknown';
                                                    //console.log(`列车 ${train.name} 未找到最近轨道段且无历史方向，设为 unknown`);
                                                }
                                            } catch (e) {
                                                carDirection = 'unknown';
                                                //console.log(`列车 ${train.name} 未找到最近轨道段且读取历史数据失败，设为 unknown`);
                                            }
                                        }

                                        // 处理backwards属性
                                        if (train.backwards === 'true') { 
                                            if (carDirection !== 'unknown') {
                                                carDirection = carDirection === 'up' ? 'down' : 'up';
                                                //console.log(`列车 ${train.name} backwards属性为true，方向调整为: ${carDirection}`);
                                            } else {
                                                //console.log(`列车 ${train.name} backwards属性为true但方向未知，无法调整`);
                                            }
                                        }

                                        // 优先考虑速度方向来确定列车方向
                                        try {
                                            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
                                            const currentTrainData = allTrainsData[train.name];
                                            
                                            if (currentTrainData && currentTrainData.speed !== undefined && !currentTrainData.isSpeedLost) {
                                                // 如果有有效速度信息
                                                if (currentTrainData.speed > 5) { // 速度大于5km/h
                                                    if (currentTrainData.speed > (currentTrainData.lastReportedSpeed || 0) + 10) {
                                                        // 如果速度突然增加超过10km/h，可能表示方向改变
                                                        //console.log(`列车 ${train.name} 检测到速度显著增加，可能方向改变`);
                                                        // 这里可以添加额外的逻辑来处理方向变化
                                                    }
                                                    
                                                    // 使用速度方向作为最终方向
                                                    if (carDirection === 'unknown' && currentTrainData.direction !== 'unknown') {
                                                        carDirection = currentTrainData.direction;
                                                        //console.log(`列车 ${train.name} 用速度方向替代未知方向: ${carDirection}`);
                                                    }
                                                }
                                            }
                                        } catch (e) {
                                            console.warn('使用速度方向确定列车方向时出错:', e);
                                        }
                                        
                                        // 添加列车运行方向信息（与线路默认方向一致为下行，相反为上行）
                                        const trainDirection = carDirection === 'down' ? '下行' : carDirection === 'up' ? '上行' : '未知方向';
                                        
                                        // 保存列车方向信息到localStorage
                                        try {
                                            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
                                            if (!allTrainsData[train.name]) {
                                                allTrainsData[train.name] = {};
                                            }
                                            // 修复方向显示问题，统一使用"上行/下行"的定义
                                            // 与轨道默认方向一致为下行（down），相反为上行（up）
                                            // unknown表示无法确定方向
                                            allTrainsData[train.name].direction = carDirection;
                                            // 添加方向文本表示，用于tooltip显示
                                            allTrainsData[train.name].directionText = trainDirection;
                                            localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
                                            //console.log(`列车 ${train.name} 方向信息已保存: ${carDirection} (${trainDirection})`);
                                        } catch (e) {
                                            console.warn('保存列车方向信息时出错:', e);
                                        }

                                    }

                                    // 如果找到轨道，则在轨道上显示列车
                                    if (currentTrack && !isTrainAtStation) {
                                        const activeLineId = getActiveLineId();
                                        const activeLineName = getLineName(activeLineId);
                                        //console.log(activeLineId);
                                        // 根据currentTrack.currentLine作为id查到的线路名称是否和activeLineName相匹配
                                        if (currentTrack.currentLine === activeLineId) {
                                            // 如果在轨道上，找到轨道的DOM元素并将列车信息插入进去，也就是第currentTrack.index个.station-line-block类
                                            const trackElements = document.querySelectorAll('.station-line');
                                            if (trackElements.length > currentTrack.index) {
                                                const trackElement = trackElements[currentTrack.index];
                                                //console.log(trackElement);
                                                // 这里需要实现具体的逻辑来定位正确的轨道位置
                                                // 可以基于当前轨道的线路颜色等特征匹配DOM上的元素
                                                // 然后创建列车元素并将其放入.track-container中

                                                const trainItem = document.createElement('div');
                                                trainItem.className = 'train-item';
                                                // 修复方向显示，使显示与实际方向一致
                                                // down表示与轨道默认方向一致，显示为↓；up表示与轨道默认方向相反，显示为↑
                                                // unknown表示无法确定方向，显示为?
                                                let directionSymbol = '';
                                                if (carDirection === 'up') {
                                                    directionSymbol = '↑';
                                                } else if (carDirection === 'down') {
                                                    directionSymbol = '↓';
                                                } else if (carDirection === 'unknown') {
                                                    directionSymbol = '?';
                                                }
                                                
                                                //console.log(`列车 ${train.name} 创建元素，方向符号: ${directionSymbol}, 方向: ${carDirection}`);
                                                
                                                trainItem.innerHTML = `
                                                    <img src="./res/train.png" class="icon train-icon">
                                                    <span class="train-name">${directionSymbol} ${train.name}</span>
                                                `;
                                                // 将列车项加入容器

                                                // 如果匹配，则将trainItem加入trainContainer
                                                const trainContainer = trackElement.querySelectorAll('.train-container');
                                                trainContainer.forEach(container => { 
                                                    container.appendChild(trainItem);
                                                    //trainItem.style.marginTop = trackProgress * 60 + 'px' ;
                                                    //trainItem.style.position = 'relative';
                                                    //trainItem.style.top = '40%' ;
                                                    //trainItem.style.bottom = '40%' ;
                                                });
                                                
                                                // 检查是否需要添加警告标志
                                                checkAndAddWarningSign(train, trainItem, false);
                                                
                                                // 检查列车是否接近关注的玩家
                                                try {
                                                    // 从localStorage获取关注的玩家列表
                                                    const prefs = JSON.parse(localStorage.getItem('preferences') || '{}');
                                                    if (prefs.followPlayers && 
                                                        typeof PositionUtils !== 'undefined' && typeof PositionUtils.checkTrainApproachingPlayers === 'function') {
                                                        console.log('通过XHR检查列车接近玩家');
                                                        PositionUtils.checkTrainApproachingPlayers(train, prefs.followPlayers);
                                                    }
                                                } catch (error) {
                                                    console.error('检查列车接近玩家时出错:', error);
                                                }
                                                
                                                // 更新已存在的列车方向箭头
                                                updateTrainDirectionArrows();
                                            }
                                        }
                                    }
                        
                            // 对轨道上的列车按距离上行车站由近到远排序
                            sortTrainsOnTracks();
                            
                            const trainItems = document.querySelectorAll('.train-item');
                            //console.log('train-items: ', trainItems);
                            if (trainItems.length === 0) {
                                //console.warn('没有找到.train-item元素');
                            }

                            // 使用Map来跟踪已经添加过事件监听器的列车元素
                            const trainItemEventMap = new Map();
                            
                            // 更新完列车信息后，获取并显示玩家信息
                            PositionUtils.fetchAndDisplayPlayers((players) => {
                                // 使用PositionUtils模块显示玩家信息
                                if (typeof PositionUtils !== 'undefined') {
                                    PositionUtils.displayPlayers(players, () => prefs.showPlayers);
                                }
                            });
                            trainItems.forEach(item => { 
                                // 需要和train的信息对应
                                const trainNameElement = item.querySelector('.train-name');
                                if (!trainNameElement) return;
                                
                                const fullTrainName = trainNameElement.textContent;
                                // 检查是否已经为这个列车元素添加过事件监听器
                                if (trainItemEventMap.has(fullTrainName)) {
                                    return; // 已经添加过事件监听器，跳过
                                }
                                
                                // 标记已经为这个列车元素添加过事件监听器
                                trainItemEventMap.set(fullTrainName, true);
                                
                                // 添加点击事件监听器，跳转到列车详细信息页面
                                item.addEventListener('click', function() {
                                    // 提取纯列车名称（去除方向符号）
                                    const cleanTrainName = fullTrainName.replace(/[↑↓? ]/g, '');
                                    window.open(`trains_info.html?q=${cleanTrainName}&lang=${lang}`, '_self');
                                });
                                
                                if (fullTrainName.includes(train.name)){
                                    item.addEventListener('mouseover', function() { 
                                        // 移除现有的train-tooltip
                                        const existingTooltip = document.querySelectorAll('.train-tooltip');
                                        existingTooltip.forEach(tooltip => { 
                                            //tooltip.remove();
                                        });

                                        const trainTooltip = document.createElement('div');
                                        trainTooltip.classList.add('tooltip');
                                        trainTooltip.classList.add('train-tooltip');
                                        
                                        trainTooltip.innerHTML = '';

                                        const trainTooltipTitle = document.createElement('h4');
                                        trainTooltipTitle.className = 'train-tooltip-title';
                                        trainTooltipTitle.textContent = train.name;
                                        trainTooltip.appendChild(trainTooltipTitle);

                                        train.cars.forEach(car => {
                                            const carName = car.id;
                                            const carType = car.type;
                                            const carPos = train.backwards === 'true' ? car.trailing.location : car.leading.location;
                                            //console.log(carName, carType, carPos);
                                            const carPosX = Math.round(carPos.x, 2);
                                            const carPosZ = Math.round(carPos.z, 2);
                                            const locationItem = document.createElement('div');
                                            locationItem.classList.add('location-item'); 
                                            locationItem.innerHTML = `
                                                <div class="car-name">${carName}</div>
                                                <div class="car-pos">(${carPosX},${carPosZ})</div>
                                            `;
                                            trainTooltip.appendChild(locationItem);
                                        });
                                        item.insertBefore(trainTooltip, item.firstChild);

                                        const isBackwardsElement = document.createElement("div");
                                        isBackwardsElement.className = "is-backwards";
                                        isBackwardsElement.textContent = train.backwards === 'true' ? strings.lines_info.going_backwards[lang] : '';
                                        trainTooltip.appendChild(isBackwardsElement);
                                        
                                        // 检查列车是否在车站内（通过检查是否有.platform元素）
                                        const platformElement = item.querySelector('.platform');
                                        if (platformElement) {
                                            // 车站内的列车，根据方向更新站台编号
                                            const platformText = platformElement.textContent.trim();
                                            let newPlatformText = platformText;
                                            
                                            // 从localStorage获取列车方向信息
                                            try {
                                                const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
                                                const currentTrainData = allTrainsData[train.name];
                                                
                                                if (currentTrainData && currentTrainData.direction !== undefined) {
                                                    const carDirection = currentTrainData.direction;
                                                    
                                                    // 根据方向更新站台编号
                                                    /*if (carDirection === 'down') {
                                                        // 下行方向显示为A站台
                                                        newPlatformText = platformText.replace(/[A-Za-z]/g, '') + 'A';
                                                    } else if (carDirection === 'up') {
                                                        // 上行方向显示为B站台
                                                        newPlatformText = platformText.replace(/[A-Za-z]/g, '') + 'B';
                                                    }*/
                                                    // 如果方向未知，则保持原始platform值
                                                    
                                                    // 更新站台编号
                                                    platformElement.textContent = newPlatformText + ' ';
                                                }
                                            } catch (e) {
                                                console.warn('更新车站内列车站台编号时出错:', e);
                                            }
                                            
                                            // 车站内的列车不显示方向箭头
                                        } else {
                                            // 添加列车运行方向信息
                                            const directionElement = document.createElement("div");
                                            directionElement.className = "train-direction";
                                            // 确定列车运行方向文本，修复方向显示逻辑
                                            // up表示与轨道默认方向相反，为上行；down表示与轨道默认方向一致，为下行
                                            // unknown表示无法确定方向
                                            let directionText = '';
                                            if (carDirection === 'up') {
                                                directionText = strings.lines_info.running_direction_up[lang] || '上行';
                                            } else if (carDirection === 'down') {
                                                directionText = strings.lines_info.running_direction_down[lang] || '下行';
                                            } else if (carDirection === 'unknown') {
                                                directionText = strings.lines_info.unknown_direction[lang] || '未知方向';
                                            }
                                            directionElement.textContent = directionText;
                                            //trainTooltip.appendChild(directionElement);
                                        }
                                        
                                        // 从localStorage获取之前计算并存储的速度信息
                                        try {
                                            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
                                            const currentTrainData = allTrainsData[train.name];
                                            const isStopped = train.isStopped === 'true';
                                            
                                            if (currentTrainData && currentTrainData.speed !== undefined) {
                                                let speed = isStopped ? 0 : currentTrainData.speed.toFixed();
                                                const speedElement = document.createElement("div");
                                                speedElement.className = "train-speed";
                                                
                                                // 如果速度丢失，则继承之前的速度值
                                                if (currentTrainData.isSpeedLost && currentTrainData.prevSpeed !== undefined) {
                                                    speed = currentTrainData.prevSpeed.toFixed();
                                                }
                                                
                                                speedElement.textContent = (strings.lines_info.speed[lang] + speed + 'km/h');
                                                // 如果速度丢失，则将文本不透明度调整为0.4
                                                speedElement.style.opacity = currentTrainData.isSpeedLost ? '0.4' : '1';
                                                trainTooltip.appendChild(speedElement);
                                            }
                                        } catch (e) {
                                            console.warn('获取列车速度时出错:', e);
                                        }
                                        
                                        // 添加警告原因信息
                                        try {
                                            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
                                            const currentTrainData = allTrainsData[train.name];
                                            
                                            if (currentTrainData && currentTrainData.warningReasons && currentTrainData.warningReasons.length > 0) {
                                                const warningReasonsElement = document.createElement("div");
                                                warningReasonsElement.className = "warning-reasons";
                                                warningReasonsElement.style.color = 'crimson';
                                                warningReasonsElement.style.fontWeight = 'bold';
                                                
                                                let reasonsText = '! ';
                                                currentTrainData.warningReasons.forEach(reason => {
                                                    switch (reason) {
                                                        case 'long_stop':
                                                            reasonsText += strings.lines_info.warning_long_stop[lang] + '; ';
                                                            break;
                                                        case 'zero_speed':
                                                            reasonsText += strings.lines_info.warning_zero_speed[lang] + '; ';
                                                            break;
                                                        case 'platform_conflict':
                                                            reasonsText += strings.lines_info.warning_platform_conflict[lang] + '; ';
                                                    }
                                                });
                                                
                                                // 移除末尾的分号和空格
                                                reasonsText = reasonsText.slice(0, -2);
                                                warningReasonsElement.textContent = reasonsText;
                                                trainTooltip.appendChild(warningReasonsElement);
                                            }
                                        } catch (e) {
                                            console.warn('获取列车警告原因时出错:', e);
                                        }

                                        // 只显示第一个trainTooltip，其余隐藏
                                    });
                                    item.addEventListener('mouseout', function() { 
                                        const trainTooltip = item.querySelector('.train-tooltip');
                                        if (trainTooltip) {
                                            trainTooltip.remove();
                                        }
                                    });

                                }
                            });

                            // 更新已存在的tooltip内容
                            updateExistingTooltips(data);

                            const activeLineId = getActiveLineId();
                            const activeLineName = getLineName(activeLineId);

                            loadSegmentInfo();

                            let trainNames = [];
                            trainItems.forEach(item => {
                                const trainName = item.querySelector('.train-name').textContent;
                                //console.log(trainName);
                                // 如果列车运行线路不是其所属线路或者找不到列车信息则降低不透明度
                                const trainInfo = window.trainsInfo.find(t => t.name === trainName);
                                if (!trainInfo || (trainInfo && trainInfo.line !== activeLineId)) {
                                    const iconElement = item.querySelector('.train-icon');
                                    const nameElement = item.querySelector('.train-name');
                                    const platformElement = item.querySelector('.platform');
                                    iconElement.style.opacity = 0.4;
                                    nameElement.style.opacity = 0.4;
                                    if (platformElement) { platformElement.style.opacity = 0.4; }
                                }
                                // 如果列车名称在trainNames中则移除
                                if (trainNames.includes(trainName)) {
                                    item.remove();
                                }
                                trainNames.push(trainName);
                            });

                            // 更新线路信息显示
                            updateLineInfoDisplay(activeLineId);
                    
                        });
                        
                    }
                capturedData = structuredClone(data);
                // 为capturedData添加一个时间戳
                capturedData.timestamp = structuredClone(Date.now());
                
                // 更新已存在的列车方向箭头
                updateTrainDirectionArrows();
            }
        } else {
            console.error('数据结构无效，无法处理列车信息');
            // 即使列车数据无效，也更新线路信息
            const activeLineId = getActiveLineId();
            updateLineInfoDisplay(activeLineId);
            loadSegmentInfo();
            PositionUtils.fetchAndDisplayPlayers((players) => {
                // 使用PositionUtils模块显示玩家信息
                if (typeof PositionUtils !== 'undefined') {
                    PositionUtils.displayPlayers(players, () => prefs.showPlayers);
                }
            });
        }
    };
    xhr.send();
    //highlightTrainsForCurrentLine();
}



// 对轨道上的列车按距离上行车站由近到远排序
function sortTrainsOnTracks() {
    const stationLines = document.querySelectorAll('.station-line');
    
    stationLines.forEach((stationLine, index) => {
        const trainContainer = stationLine.querySelector('.train-container');
        if (!trainContainer) return;
        
        // 获取该轨道上的所有列车
        const trainItems = Array.from(trainContainer.querySelectorAll('.train-item'));
        if (trainItems.length <= 1) return; // 如果没有列车或只有一列列车，无需排序
        
        // 为每个列车项添加距离上行车站的数据属性
        trainItems.forEach(trainItem => {
            const trainNameElement = trainItem.querySelector('.train-name');
            if (trainNameElement) {
                const fullTrainName = trainNameElement.textContent;
                // 查找该列车在capturedData中的信息
                if (typeof capturedData !== 'undefined' && capturedData && capturedData.trains) {
                    const trainData = capturedData.trains.find(t => 
                        fullTrainName.includes(t.name) || t.name.includes(fullTrainName)
                    );
                    if (trainData && typeof trainData.trackProgress !== 'undefined') {
                        // 使用trackProgress作为距离上行车站的位置指标
                        trainItem.dataset.trackPosition = trainData.trackProgress;
                    } else {
                        // 如果找不到数据，使用默认值
                        trainItem.dataset.trackPosition = 0;
                    }
                } else {
                    // 如果capturedData不可用，使用默认值
                    trainItem.dataset.trackPosition = 0;
                }
            }
        });
        
        // 按距离上行车站由近到远排序（trackPosition值从小到大）
        trainItems.sort((a, b) => {
            const posA = parseFloat(a.dataset.trackPosition) || 0;
            const posB = parseFloat(b.dataset.trackPosition) || 0;
            return posA - posB;
        });
        
        // 重新排列DOM元素
        trainItems.forEach(trainItem => {
            trainContainer.appendChild(trainItem);
        });
    });
}

// 新增函数：更新线路信息显示
function updateLineInfoDisplay(activeLineId) {
    const stationsDisplay = document.querySelector('.stations-display');
    if (!stationsDisplay) return;
    
    let updateTime = stationsDisplay.querySelector('.update-time');
    if (!updateTime) {
        updateTime = document.createElement('div');
        updateTime.className = 'update-time';
        stationsDisplay.appendChild(updateTime);
        console.log('Adding update-time element');
    }
    
    try {
        const lineLength = measureLineLengths(activeLineId);
        updateTime.innerHTML = `${
            strings.lines_info.total_length[lang] + 
            Math.round(lineLength / 1000, 4) + 'km' +
            strings.lines_info.and_total_time[lang] +
            calculateLineTotalTime(activeLineId) +
            strings.ticket_calculator.min[lang]
        }<br />${
            strings.lines_info.updated_at[lang] + new Date().toLocaleString()
        }<br />${
            strings.lines_info.locations_for_reference_only[lang]
        }`;
    } catch (error) {
        console.error('更新线路信息时出错:', error);
        updateTime.innerHTML = `${strings.lines_info.updated_at[lang] + new Date().toLocaleString()}<br />${strings.lines_info.locations_for_reference_only[lang]}`;
    }
}

// 更新已存在的列车tooltip内容
function updateExistingTooltips(trainData) {
    const existingTooltips = document.querySelectorAll('.train-tooltip');
    if (existingTooltips.length === 0) return;

    existingTooltips.forEach(tooltip => {
        // 找到包含此tooltip的列车项
        const trainItem = tooltip.closest('.train-item');
        if (!trainItem) return;

        // 获取列车名称
        const trainNameElement = trainItem.querySelector('.train-name');
        if (!trainNameElement) return;

        // 检查列车是否在车站内（通过检查是否有.platform元素）
        const platformElement = trainItem.querySelector('.platform');
        
        if (platformElement) {
            // 车站内的列车，根据方向更新站台编号
            const platformText = platformElement.textContent.trim();
            let newPlatformText = platformText;
            
            // 获取列车名称
            const trainName = trainNameElement.textContent.trim();
            
            // 从localStorage获取列车方向信息
            try {
                const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
                const currentTrainData = allTrainsData[trainName];
                
                if (currentTrainData && currentTrainData.direction !== undefined) {
                    const carDirection = currentTrainData.direction;
                    
                    // 根据方向更新站台编号
                    /*if (carDirection === 'down') {
                        // 下行方向显示为A站台
                        newPlatformText = platformText.replace(/[A-Za-z]/g, '') + 'A';
                    } else if (carDirection === 'up') {
                        // 上行方向显示为B站台
                        newPlatformText = platformText.replace(/[A-Za-z]/g, '') + 'B';
                    }*/
                    // 如果方向未知，则保持原始platform值
                    
                    // 更新站台编号
                    platformElement.textContent = newPlatformText + ' ';
                }
            } catch (e) {
                console.warn('更新车站内列车站台编号时出错:', e);
            }
            
            // 车站内的列车不需要更新其他tooltip内容
            return;
        }

        // 去掉箭头符号获取实际列车名称
        const trainName = trainNameElement.textContent.replace(/[↑↓? ]/g, '');
        
        // 在列车数据中查找对应的列车
        const train = trainData.trains.find(t => t.name === trainName);
        if (!train) return;

        // 更新tooltip内容
        tooltip.innerHTML = '';

        tooltip.style.maxWidth = '60px';

        const trainTooltipTitle = document.createElement('h4');
        trainTooltipTitle.className = 'train-tooltip-title';
        trainTooltipTitle.textContent = train.name;
        tooltip.appendChild(trainTooltipTitle);
        
        // 添加车厢位置信息
        train.cars.forEach((car, index) => {
            const carName = car.id;
            const carPos = train.backwards === 'true' ? car.trailing.location : car.leading.location;
            const carPosX = Math.round(carPos.x, 2);
            const carPosZ = Math.round(carPos.z, 2);
            const locationItem = document.createElement('div');
            locationItem.classList.add('location-item'); 
            locationItem.innerHTML = `
                <div class="car-name">${index + 1}</div>
                <div class="car-pos">(${carPosX},${carPosZ})</div>
            `;
            tooltip.appendChild(locationItem);
        });

        const isStopped = train.stopped === 'true';

        // 添加方向信息
        const isBackwardsElement = document.createElement("div");
        isBackwardsElement.className = "is-backwards";
        isBackwardsElement.textContent = train.backwards === 'true' ? strings.lines_info.going_backwards[lang] : '';
        tooltip.appendChild(isBackwardsElement);
        
        // 添加列车运行方向信息
        // 首先需要获取列车方向信息
        let carDirection = '';
        const trainNameText = trainItem.querySelector('.train-name').textContent;
        
        if (trainNameText.includes('↑')) {
            carDirection = 'up';    // ↑ 表示与轨道方向相反为上行
        } else if (trainNameText.includes('↓')) {
            carDirection = 'down';  // ↓ 表示与轨道方向一致为下行
        } else if (trainNameText.includes('?')) {
            carDirection = 'unknown';
        }
        
        // 添加列车运行方向信息
        const directionElement = document.createElement("div");
        directionElement.className = "train-direction";
        // 确定列车运行方向文本
        let directionText = '';
        if (carDirection === 'up') {
            directionText = strings.lines_info.running_direction_up[lang] || '上行';
        } else if (carDirection === 'down') {
            directionText = strings.lines_info.running_direction_down[lang] || '下行';
        } else if (carDirection === 'unknown') {
            directionText = strings.lines_info.unknown_direction[lang] || '未知方向';
        }
        directionElement.textContent = directionText;
        //tooltip.appendChild(directionElement);

        // 添加速度信息
        try {
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const currentTrainData = allTrainsData[train.name];
            
            if (currentTrainData && currentTrainData.speed !== undefined) {
                let speed = isStopped === 'true' ? 0 : currentTrainData.speed.toFixed();
                const speedElement = document.createElement("div");
                speedElement.className = "train-speed";
                
                // 如果速度丢失，则继承之前的速度值
                if (currentTrainData.isSpeedLost && currentTrainData.prevSpeed !== undefined) {
                    speed = currentTrainData.prevSpeed.toFixed();
                }
                
                speedElement.textContent = (strings.lines_info.speed[lang] + speed + 'km/h');
                // 如果速度丢失，则将文本不透明度调整为0.4
                speedElement.style.opacity = currentTrainData.isSpeedLost ? '0.4' : '1';
                tooltip.appendChild(speedElement);
            }
        } catch (e) {
            console.warn('获取列车速度时出错:', e);
        }
        
        // 添加警告原因信息
        try {
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const currentTrainData = allTrainsData[train.name];
            
            if (currentTrainData && currentTrainData.warningReasons && currentTrainData.warningReasons.length > 0) {
                const warningReasonsElement = document.createElement("div");
                warningReasonsElement.className = "warning-reasons";
                warningReasonsElement.style.color = 'crimson';
                warningReasonsElement.style.fontWeight = 'bold';
                
                let reasonsText = '! ';
                currentTrainData.warningReasons.forEach(reason => {
                    switch (reason) {
                        case 'long_stop':
                            reasonsText += strings.lines_info.warning_long_stop[lang] + '; ';
                            break;
                        case 'zero_speed':
                            reasonsText += strings.lines_info.warning_zero_speed[lang] + '; ';
                            break;
                        case 'platform_conflict':
                            reasonsText += strings.lines_info.warning_platform_conflict[lang] + '; ';
                    }
                });
                
                // 移除末尾的分号和空格
                reasonsText = reasonsText.slice(0, -2);
                warningReasonsElement.textContent = reasonsText;
                tooltip.appendChild(warningReasonsElement);
            }
        } catch (e) {
            console.warn('获取列车警告原因时出错:', e);
        }
    });
    
    // 更新列车方向箭头
    updateTrainDirectionArrows();
}

function loadSegmentInfo() { 
    const activeLineId = getActiveLineId();
    const stationLineElements = document.querySelectorAll('.station-line');
    stationLineElements.forEach((element, index) => {
        element.addEventListener('mouseover', function() { 
            let segmentLength = document.querySelector('.segment-length');
            if (!segmentLength) {
                segmentLength = document.createElement('div');
                segmentLength.className = 'segment-length';
            }
            segmentLength.textContent = '↕ ' +
                Math.round(measureSegmentLength(activeLineId, index) / 1000, 4) + 'km ' 
                + findSegmentDuration(activeLineId, index);
            element.appendChild(segmentLength);
        });
        element.addEventListener('mouseout', function() { 
            const segmentLength = element.querySelector('.segmentLength');
            if (segmentLength) {
                element.removeChild(segmentLength);
            }
        });
    });
}

function loadUpdateTime() {
    const activeLineId = getActiveLineId();
    const stationsDisplay = document.querySelector('.stations-display');
    let updateTime = stationsDisplay.querySelector('.update-time');
    if (!updateTime) {
        updateTime = document.createElement('div');
        updateTime.className = 'update-time';
        stationsDisplay.appendChild(updateTime);
        console.log('Adding update-time element');
    }
    const lineLength = measureLineLengths(activeLineId);
    updateTime.innerHTML = `${strings.lines_info.total_length[lang] + Math.round(lineLength / 1000, 4)}km`;
}

function getActiveLineId () {
    // 从URL参数中获取线路id
    let lineId = new URLSearchParams(window.location.search).get('line');
    if (!lineId) {
        // 检查是否有用户最后访问的线路
        const lastVisitedLine = localStorage.getItem('lastVisitedLine');
        if (lastVisitedLine && window.lines.some(line => line.id === lastVisitedLine)) {
            lineId = lastVisitedLine;
        } else {
            // 获取默认第一条线路
            lineId = lines[0].id;
        }
    }
    // 保存当前线路为最后访问的线路
    localStorage.setItem('lastVisitedLine', lineId);
    // console.log('Active line id:', lineId);
    return lineId;
}

function getLineName(lineId = getActiveLineId()) {
    return lines.find(line => line.id === lineId).name[lang];
}

function getDirection(trainName, carPos, isStopped) {
    // 尝试从localStorage获取之前存储的列车位置数据
    let allTrainsData = {};
    try {
        const storedData = localStorage.getItem('all_trains_positions');
        if (storedData) {
            allTrainsData = JSON.parse(storedData);
        }
    } catch (e) {
        console.warn('无法解析列车位置数据:', e);
    }

    // 获取当前列车的之前位置数据
    let previousTrainData = allTrainsData[trainName] || null;
    
    // 计算方向向量
    let direction = [0, 0];
    let speed = 0; // 初始化速度为0
    const currentTime = Date.now();

    // 读取上一次速度值和方向
    let prevSpeed = previousTrainData && previousTrainData.speed !== undefined ? previousTrainData.speed : 0;
    let prevDirection = previousTrainData && previousTrainData.direction ? previousTrainData.direction : 'unknown';
    let isSpeedLost = previousTrainData && previousTrainData.isSpeedLost;
    let speedLostTime = previousTrainData && previousTrainData.speedLostTime ? previousTrainData.speedLostTime : 0;
    
    if (previousTrainData && previousTrainData.timestamp) {
        // 计算基于时间的位置变化方向
        const timeDiff = currentTime - previousTrainData.timestamp;
        const speedLostDuration = currentTime - speedLostTime;

        // 只有当时间差在合理范围内时才计算（避免数据更新不及时导致的异常值）
        // 合理范围：50ms 到 3s
        if (timeDiff > 50 && timeDiff < 3000) {
            direction = [
                carPos.x - previousTrainData.position.x,
                carPos.z - previousTrainData.position.z
            ];
            
            // 计算3D空间中的位移距离
            const distance = Math.sqrt(
                Math.pow(carPos.x - previousTrainData.position.x, 2) +
                Math.pow(carPos.z - previousTrainData.position.z, 2)
            );
            
            // 添加调试日志
            /*console.log(`列车 ${trainName} 位置变化:`, {
                currentTime: currentTime,
                previousTime: previousTrainData.timestamp,
                timeDiff: timeDiff,
                oldPosition: previousTrainData.position,
                newPosition: carPos,
                direction: direction,
                distance: distance
            });*/
            
            // 计算速度（假设距离单位是米，时间是毫秒，则结果为 m/s，转换为 km/h 需要乘以 3.6）
            // 注意：这里的时间单位是毫秒，所以需要除以1000转换为秒
            speed = (distance / (timeDiff / 1000) * 3.6);
            if (speed <= 0 && isSpeedLost === false) {
                if (prevSpeed !== 0) speedLostTime = currentTime; else speed = 0;
                isSpeedLost = prevSpeed !== 0;
            } else isSpeedLost = false;
            
            // 增加速度上限保护（假设列车最高速度不超过 360 km/h）
            if (speed > 360 || speed === 0) {
                speed = prevSpeed;
            }
        } else {
            speed = prevSpeed;
            //console.log(`列车 ${trainName} 时间差不在合理范围内: ${timeDiff}ms`);
        }

        if (speedLostDuration > 5000 && isSpeedLost) speed = 0;
        
        if (isStopped) {
            speed = 0;
            isSpeedLost = false;
        }
    } else {
        //console.log(`列车 ${trainName} 没有历史位置数据`);
    }

    // 如果计算出的方向向量是[0,0]，继承之前的方向
    if (direction[0] === 0 && direction[1] === 0 && prevDirection !== 'unknown') {
        //console.log(`列车 ${trainName} 方向向量为[0,0]，继承之前方向: ${prevDirection}`);
        // 保持direction为[0,0]，但使用之前的方向用于显示
    }

    // 更新当前列车位置和时间戳到整体数据中
    allTrainsData[trainName] = {
        position: {
            x: carPos.x,
            y: carPos.y,
            z: carPos.z
        },
        timestamp: currentTime,
        speed: speed, // 同时存储速度信息
        prevSpeed: prevSpeed, // 存储之前的速度值
        direction: (direction[0] !== 0 || direction[1] !== 0) ? 
                   (direction[0] > 0 ? 'down' : 'up') : // 简单根据x方向判断，实际应该在主逻辑中计算
                   prevDirection, // 如果方向向量为0，则继承之前的方向
        isSpeedLost: isSpeedLost,
        speedLostTime: speedLostTime
    };

    // 存储所有列车位置数据到localStorage
    try {
        localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
    } catch (e) {
        console.warn('无法存储列车位置数据:', e);
    }

    //console.log(`列车 ${trainName} 最终方向向量:`, direction);
    return direction;
}

// 查找车站的坐标
function findStationCoordinates(stationCode, filterType = null) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.findStationCoordinates(stationCode, filterType);
    }
    
    // 降级处理：如果PositionUtils不可用，使用原有实现
    if (!window.stationsNetwork) return [];
    
    let filteredStations = window.stationsNetwork
        .filter(station => station.name.startsWith(stationCode));
    
    // 如果提供了过滤类型，则进一步过滤
    if (filterType === 'up') {
        // 上行站台：以B结尾
        filteredStations = filteredStations.filter(station => /^[A-Z0-9]+[0-9]B$/.test(station.name));
    } else if (filterType === 'down') {
        // 下行站台：以A结尾
        filteredStations = filteredStations.filter(station => /^[A-Z0-9]+[0-9]A$/.test(station.name));
    }
    
    return filteredStations.map(station => ({
        name: station.name,
        x: station.location.x,
        y: station.location.y,
        z: station.location.z
    }));
}

function findSegmentDuration(lineId, index) { 
    const currentLine = lines.find(line => line.id === lineId);
    const rawDuration = currentLine.route.filter(step => step.type === 'track')[index].duration;
    const duration = 
        ( rawDuration > 60 ? 
            (Math.floor(rawDuration / 60) + '\'') + ((rawDuration % 60) < 10 ? '0' : '') 
            : '' )     
        + (rawDuration % 60) + '\"';
    return duration;
}

// 计算3D空间中点到线段的距离
function distanceFromSegment(p, v, w) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.distanceFromSegment(p, v, w);
    }
    
    // 降级处理：如果PositionUtils不可用，使用原有实现
    const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.z - w.z, 2);
    //console.log(l2,p,v,w)
    if (l2 === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.z - v.z, 2)); // v == w case
    
    let t = ((p.x - v.x) * (w.x - v.x) + (p.z - v.z) * (w.z - v.z)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projection = {
        x: v.x + t * (w.x - v.x),
        z: v.z + t * (w.z - v.z)
    };
    return Math.sqrt(Math.pow(p.x - projection.x, 2) + Math.pow(p.z - projection.z, 2));
}

function calculateTotalDistance(p, track, index) { 
    //console.log('calculateTotalDistance', p, track, index);
    let distance = 0;
    
    // 检查参数有效性
    if (!track || !track.nodes || !Array.isArray(track.nodes)) {
        console.warn('Invalid track data provided to calculateTotalDistance');
        return 0;
    }
    
    if (index < 0 || index >= track.nodes.length) {
        console.warn('Invalid index provided to calculateTotalDistance');
        return 0;
    }
    
    for (let i = 0; i < index; i++) {
        // 确保节点存在
        if (i + 1 < track.nodes.length) {
            const node1 = track.nodes[i];
            const node2 = track.nodes[i + 1];
            
            // 检查节点是否定义
            if (node1 && node2) {
                distance += calculateDistance(node1, node2);
                //console.log ('i<index',distance, track.nodes[i], track.nodes[i + 1]);
            } else {
                console.warn('Undefined node encountered in calculateTotalDistance', node1, node2);
            }
        } else {
            const node1 = track.nodes[i];
            // 检查节点和点p是否定义
            if (node1 && p) {
                distance += calculateDistance(p, node1);
                //console.log ('i=index ',distance, p, track.nodes[i]);
            } else {
                console.warn('Undefined node or point encountered in calculateTotalDistance', p, node1);
            }
            // 只要满足一次这个条件就结束循环
            return distance;
        }
    }
    return distance;
}

function calculateDistance(v, w) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.calculateDistance(v, w);
    }
    
    // 降级处理：如果PositionUtils不可用，使用原有实现
    //console.log ('calculating distance: ',v, w);
    // 检查参数是否定义
    if (!v || !w) {
        console.warn('Undefined parameters passed to calculateDistance', v, w);
        return 0;
    }
    
    // 检查必需的属性是否存在
    if (typeof v.x !== 'number' || typeof v.z !== 'number' || 
        typeof w.x !== 'number' || typeof w.z !== 'number') {
        console.warn('Invalid coordinate data in calculateDistance', v, w);
        return 0;
    }
    return Math.sqrt(Math.pow(v.x - w.x, 2) + Math.pow(v.z - w.z, 2));
}

// 获取线路颜色
function getLineColor(lineId = '') {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.getLineColor(lineId);
    }
    
    // 降级处理：如果PositionUtils不可用，使用原有实现
    const line = lines.find(line => line.id === lineId);
    return line ? line.color : 'var(--color-text-secondary)'; // 如果找不到线路，返回默认灰色
}

// 获取车站名称
function getStationName(stationCode, language = lang) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.getStationName(stationCode, language);
    }
    
    // 降级处理：如果PositionUtils不可用，使用原有实现
    const stationNames = window.strings.station_names;
    if (stationNames[stationCode]) {
        return stationNames[stationCode][language] || stationNames[stationCode].zh_hans || stationCode;
    }
    return stationCode;
}

function highlightTrainsForCurrentLine() {
    const trainItems = document.querySelectorAll('.train-item');
    console.log('train-items: ', trainItems);
    if (trainItems.length === 0) {
        console.warn('没有找到.train-item元素');
    }
    let activeLineId = getActiveLineId();
    const activeLineName = getLineName(activeLineId);

    let trainNames = [];
    trainItems.forEach(item => {
        const trainName = item.querySelector('.train-name').textContent;
        //console.log(trainName);
        // 如果列车运行线路不是其所属线路或者找不到列车信息则降低不透明度
        const trainInfo = window.trainsInfo.find(t => t.name === trainName);
        if (!trainInfo || (trainInfo && trainInfo.line !== activeLineId)) {
            const iconElement = item.querySelector('.train-icon');
            const nameElement = item.querySelector('.train-name');
            const platformElement = item.querySelector('.platform');
            iconElement.style.opacity = 0.4;
            nameElement.style.opacity = 0.4;
            if (platformElement) { platformElement.style.opacity = 0.4; }
        }
        // 如果列车名称在trainNames中则移除
        if (trainNames.includes(trainName)) {
            item.remove();
        }
        trainNames.push(trainName);
    });
}

// 测量每条线路的总长度
function measureLineLengths(lineId) { 
    let totalLength = 0;
    lines.forEach(line => { 
        if (line.id === lineId) { 
            line.route.filter(track => track.type === 'track').forEach(track => {
                track.nodes.forEach((point,index) => {
                    if (index > 0) {
                        const prevLocation = track.nodes[index - 1];
                        totalLength += calculateDistance(point, prevLocation);
                    }
                });
            })
        }
    });
    return totalLength;
}

function measureSegmentLength(lineId, index) {
    //console.log(lineId, index);
    let totalLength = 0;
    lines.forEach(line => { 
        if (line.id === lineId) {
            const currentSegment = line.route.filter(track => track.type === 'track')[index]
            //console.log(currentSegment.nodes);
            currentSegment.nodes.forEach((point,i) => {
                if (i > 0) {
                    const prevLocation = currentSegment.nodes[i - 1];
                    //console.log(index,point,prevLocation);
                    totalLength += calculateDistance(point, prevLocation);
                }
            });
        }
    });
    return totalLength;
}

// 计算线路总运行时间
function calculateLineTotalTime(lineId) { 
    let totalTime = 0;
    lines.forEach(line => { 
        if (line.id === lineId) { 
            line.route.filter(track => track.type === 'track').forEach((track, index) => {
                totalTime += track.duration;
                if (index < line.route.length - 1) {
                    totalTime += 60; // 每段之间加一分钟停车时间
                }
            });
        }
    });
    totalTime = Math.ceil(totalTime / 60);
    return totalTime;
}

function shareRouteMap() { 
    const backgroundColor = getComputedStyle(document.body).backgroundColor;
    const stationsDisplay = document.querySelector('.stations-display');
    const stationList = stationsDisplay.querySelector('.station-list');
    stationList.classList.remove('item');
    stationList.style.backgroundColor = 'var(--color-background-card-solid)';
    stationsDisplay.style.padding = '1rem';
    const lineTitle = document.createElement('h1');
    lineTitle.textContent = getLineName(getActiveLineId());
    lineTitle.style.marginBottom = '1rem';
    stationsDisplay.insertBefore(lineTitle, stationsDisplay.firstChild);
    html2canvas(stationsDisplay, {
        //width: 1200,
        //height: 800,
        backgroundColor: backgroundColor,
    }).then(canvas => {
        const img = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        const timestamp = new Date().getTime();
        a.href = img;
        a.download = `${lineTitle.textContent + '_' + timestamp}.png`;
        a.click();
    });
    lineTitle.remove();
    stationsDisplay.style.padding = '0';
    stationList.style.backgroundColor = 'var(--color-background-card)';
    stationList.classList.add('item');
}

function handleWindowResize() {
    const lineSelectors = document.querySelectorAll('.line-selector');
    const footer = document.querySelector('footer');
    const header = document.querySelector('header');
    const stationsDisplay = document.querySelector('.stations-display');
    const main = document.querySelector('main');
    const tabs = document.querySelector('.tabs');
    const sideBar = document.querySelector('.side-bar');
    const activeItem = sideBar.querySelector('.side-bar-item.active');
    const activeTab = tabs.querySelector('.tab-item.active');
    const prefActions = document.querySelector('.pref-actions');
    if (header.contains(tabs)) { 
        header.removeChild(tabs);
    }
    while (activeTab && activeTab.children.length > 1) {
        activeTab.removeChild(activeTab.children[1]);
    }
    const swapFooterItems = prefs.swapFooterItems;
    if (swapFooterItems) footer.classList.add('swapped');
    else footer.classList.remove('swapped');
    
    if (window.innerWidth < 720) {
        sideBar.style.opacity = 0;
        sideBar.style.position = 'fixed';
        sideBar.style.right = '100%';
        sideBar.style.display = 'none';
        prefActions.style.display = 'flex';
        stationsDisplay.style.marginLeft = '0';
        main.style.paddingBottom = `144px`;

        footer.style.opacity = 1;
        tabs.style.marginLeft = '6px';
    } else {
        //lineSelector.style.zIndex = 1100;
        //lineSelector.style.position = 'fixed';
        //lineSelector.style.top = '66px';
        //lineSelector.style.left = `calc(${window.innerWidth > 920 ? '50vw + ' + mainWidth / 2  + 'px' : '88vw'} - ${mainWidth}px)`;
        // 移除collapsed类
        footer.style.opacity = 0;
        sideBar.style.opacity = 1;
        sideBar.style.display = 'flex';
        sideBar.style.right = '0';
        sideBar.style.position = 'relative';
        prefActions.style.display = 'none';
        main.style.paddingBottom = '36px';
        if (!sidebarCollapseDone) { 
            if (prefs.collapseSidebar) { 
                if (!sideBar.classList.contains('collapsed')) sideBar.classList.add('collapsed');
            } else { 
                if (sideBar.classList.contains('collapsed')) sideBar.classList.remove('collapsed');
            }
        } else console.log('sidebarCollapseDone');
        sidebarCollapseDone = true;
        setTimeout(() => {
            const lineSelectorWidth = sideBar.getBoundingClientRect().width <= 60 ? 0 : sideBar.getBoundingClientRect().width;
            const mainWidth = main.getBoundingClientRect().width;
            stationsDisplay.style.marginLeft = `calc(${lineSelectorWidth}px + 2vw)`;
            tabs.style.marginLeft = `calc(${lineSelectorWidth}px + 2vw)`;
        }, 100);
    }
}

window.handleWindowResize = handleWindowResize;

// 更新已存在的列车元素上的方向箭头
function updateTrainDirectionArrows() {
    const trainItems = document.querySelectorAll('.train-item');
    trainItems.forEach(trainItem => {
        const trainNameElement = trainItem.querySelector('.train-name');
        if (!trainNameElement) return;
        
        // 获取纯列车名称（去掉箭头和空格）
        let trainName = trainNameElement.textContent.replace(/[↑↓? ]/g, '');
        
        // 检查列车是否在车站内（通过检查是否有.platform元素）
        const platformElement = trainItem.querySelector('.platform');
        const isAtStation = !!platformElement;
        
        // 检查并更新警告标志
        checkAndAddWarningSign({name: trainName}, trainItem, isAtStation);
        
        if (platformElement) {
            // 车站内的列车，根据方向更新站台编号
            const platformText = platformElement.textContent.trim();
            let newPlatformText = platformText;
            
            // 从localStorage获取列车方向信息
            try {
                const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
                const currentTrainData = allTrainsData[trainName];
                
                if (currentTrainData && currentTrainData.direction !== undefined) {
                    const carDirection = currentTrainData.direction;
                    
                    // 根据方向更新站台编号
                    /*if (carDirection === 'down') {
                        // 下行方向显示为A站台
                        newPlatformText = platformText.replace(/[A-Za-z]/g, '') + 'A';
                    } else if (carDirection === 'up') {
                        // 上行方向显示为B站台
                        newPlatformText = platformText.replace(/[A-Za-z]/g, '') + 'B';
                    }*/
                    // 如果方向未知，则保持原始platform值
                    
                    // 更新站台编号
                    platformElement.textContent = newPlatformText + ' ';
                }
            } catch (e) {
                console.warn('更新车站内列车站台编号时出错:', e);
            }
            
            // 车站内的列车不显示方向箭头，保持原样
            return;
        }
        
        // 获取列车名称（去掉箭头和空格）
        trainName = trainNameElement.textContent.replace(/[↑↓? ]/g, '');
        
        // 从localStorage获取列车方向信息
        try {
            const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
            const currentTrainData = allTrainsData[trainName];
            
            if (currentTrainData && currentTrainData.direction !== undefined) {
                // 获取当前方向
                const carDirection = currentTrainData.direction;
                
                // 构造新的列车名称（包含方向箭头）
                let newTrainName = trainName;
                // 修复方向显示逻辑，使显示与实际方向一致
                // down表示与轨道默认方向一致，显示为↓；up表示与轨道默认方向相反，显示为↑
                // unknown表示无法确定方向，显示为?
                if (carDirection === 'up') {
                    newTrainName = '↑ ' + trainName;
                } else if (carDirection === 'down') {
                    newTrainName = '↓ ' + trainName;
                } else {
                    newTrainName = '? ' + trainName;
                }
                
                // 更新列车名称
                trainNameElement.textContent = newTrainName;
            }
        } catch (e) {
            console.warn('更新列车方向箭头时出错:', e);
        }
    });
}

// 添加检查并添加警告标志的函数
function checkAndAddWarningSign(train, trainItem, isAtStation) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        PositionUtils.checkAndAddWarningSign(train, trainItem, isAtStation);
        return;
    }
    
    // 降级处理：如果PositionUtils不可用，使用原有实现
    // 从localStorage获取列车数据
    try {
        const allTrainsData = JSON.parse(localStorage.getItem('all_trains_positions') || '{}');
        const currentTrainData = allTrainsData[train.name];
        
        // 检查是否需要添加警告标志
        let shouldShowWarning = false;
        let warningReasons = [];
        
        // 条件1: 列车在车站内停靠超过3分钟
        if (isAtStation && currentTrainData && currentTrainData.timestamp) {
            const currentTime = Date.now();
            const timeInStation = currentTime - currentTrainData.timestamp;
            // 3分钟 = 180000毫秒
            if (timeInStation > 180000) {
                shouldShowWarning = true;
                warningReasons.push('long_stop');
            }
        }
        
        // 条件2: 列车在轨道上的车速为0
        // 修改条件：只有当列车不在任何车站时才显示警告
        if (currentTrainData && currentTrainData.speed === 0) {
            // 检查列车是否在任何车站
            const isAtAnyStation = checkIfTrainAtAnyStation(train.name);
            if (!isAtAnyStation) {
                shouldShowWarning = true;
                warningReasons.push('zero_speed');
            }
        }
        
        // 条件3: 有多于一辆列车停靠在同一站台（不考虑AB后缀）且该列车不是离站台最近的列车
        if (isAtStation) {
            // 获取当前列车所在站台（去除AB后缀）
            const platformElement = trainItem.querySelector('.platform');
            if (platformElement) {
                const platformText = platformElement.textContent.trim();
                const platformNumber = platformText.replace(/[A-Za-z]/g, '');
                
                // 获取当前列车所在的车站名称
                let currentStationName = '';
                const stationListItem = trainItem.closest('.station-list-item');
                if (stationListItem) {
                    const stationNameElement = stationListItem.querySelector('.station-name');
                    if (stationNameElement) {
                        currentStationName = stationNameElement.textContent.trim();
                    }
                }
                
                // 查找同一车站内相同站台编号的其他列车
                const samePlatformTrains = [];
                document.querySelectorAll('.station-list-item').forEach(stationElement => {
                    const stationNameElement = stationElement.querySelector('.station-name');
                    // 确保是同一个车站
                    if (stationNameElement && stationNameElement.textContent.trim() === currentStationName) {
                        const trainContainer = stationElement.querySelector('.train-container');
                        if (trainContainer) {
                            const trains = trainContainer.querySelectorAll('.train-item');
                            trains.forEach(trainEl => {
                                const platElement = trainEl.querySelector('.platform');
                                if (platElement) {
                                    const platText = platElement.textContent.trim();
                                    const platNumber = platText.replace(/[A-Za-z]/g, '');
                                    if (platNumber === platformNumber) {
                                        const trainNameElement = trainEl.querySelector('.train-name');
                                        if (trainNameElement) {
                                            samePlatformTrains.push({
                                                element: trainEl,
                                                trainName: trainNameElement.textContent.trim()
                                            });
                                        }
                                    }
                                }
                            });
                        }
                    }
                });
                
                // 如果有多于一辆列车在同一站台
                if (samePlatformTrains.length > 1) {
                    // 获取所有列车的坐标数据
                    const trainPositions = [];
                    samePlatformTrains.forEach(trainObj => {
                        const trainData = allTrainsData[trainObj.trainName];
                        if (trainData && trainData.position) {
                            trainPositions.push({
                                element: trainObj.element,
                                position: trainData.position,
                                name: trainObj.trainName
                            });
                        }
                    });
                    
                    // 简化处理：如果有多个列车在同一站台，除了第一个，其他都显示警告
                    if (trainPositions.length > 1) {
                        // 找到当前列车在数组中的位置
                        const currentIndex = trainPositions.findIndex(pos => pos.name === train.name);
                        // 如果不是第一个（最靠近的），则显示警告
                        if (currentIndex > 0) {
                            shouldShowWarning = true;
                            warningReasons.push('platform_conflict');
                        }
                    }
                }
            }
        }
        
        // 根据检查结果添加或移除警告标志
        const existingWarning = trainItem.querySelector('.warning');
        if (shouldShowWarning && !existingWarning) {
            // 添加警告标志
            const warningSpan = document.createElement('span');
            warningSpan.className = 'warning';
            warningSpan.style.color = 'crimson';
            warningSpan.style.fontWeight = 'bold';
            warningSpan.textContent = '! ';
            trainItem.appendChild(warningSpan);
            trainItem.style.color = 'crimson';
            
            // 保存警告原因到localStorage
            if (!allTrainsData[train.name]) {
                allTrainsData[train.name] = {};
            }
            allTrainsData[train.name].warningReasons = warningReasons;
            localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
        } else if (!shouldShowWarning && existingWarning) {
            // 移除警告标志
            existingWarning.remove();
            trainItem.style.color = ''; // 恢复默认颜色
            
            // 清除localStorage中的警告原因
            if (allTrainsData[train.name]) {
                delete allTrainsData[train.name].warningReasons;
                localStorage.setItem('all_trains_positions', JSON.stringify(allTrainsData));
            }
        }
    } catch (e) {
        console.warn('检查列车警告标志时出错:', e);
    }
}

// 添加一个辅助函数，用于检查列车是否在任何车站
function checkIfTrainAtAnyStation(trainName) {
    // 使用PositionUtils模块
    if (typeof PositionUtils !== 'undefined') {
        return PositionUtils.checkIfTrainAtAnyStation(trainName);
    }
    
    // 降级处理：如果PositionUtils不可用，使用原有实现
    // 检查页面上是否存在该列车的车站元素
    const trainElements = document.querySelectorAll('.train-item');
    for (const trainElement of trainElements) {
        const trainNameElement = trainElement.querySelector('.train-name');
        if (trainNameElement && trainNameElement.textContent.includes(trainName)) {
            // 如果列车元素有.platform子元素，则表示在车站
            const platformElement = trainElement.querySelector('.platform');
            if (platformElement) {
                return true;
            }
        }
    }
    
    // 如果在当前页面没有找到，进一步检查列车是否属于其他线路的车站
    // 通过列车名称前缀判断所属线路
    const linePrefix = trainName.match(/^([A-Z]+)/)?.[1];
    if (linePrefix) {
        // 检查所有线路中是否有与列车前缀匹配的线路
        const belongsToLine = window.lines?.find(line => line.id === linePrefix);
        if (belongsToLine) {
            // 如果列车属于某条线路，那么它在该线路的车站上是正常的，不应触发警告
            return true;
        }
    }
    
    return false;
}