function loadHistory(inDialog = true,lang=window.lang) { 
    const history = localStorage.getItem('visitedPages');
    if (history) {
        const historyList = document.createElement('div');
        historyList.classList.add('history-list');
        let visitedPages;
        try {
            visitedPages = JSON.parse(history);
        } catch (e) {
            console.error('Error parsing history:', e);
            visitedPages = [];
        }
        
        if (!Array.isArray(visitedPages)) {
            visitedPages = [];
        }
        
        // 按timestamp排序
        visitedPages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        visitedPages.forEach(page => {
            if (!page || !page.page) return;
            
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            const historyIcon = document.createElement('span');
            historyIcon.classList.add('icon');
            historyIcon.classList.add('history-icon');
            historyIcon.classList.add('material-symbols-outlined');
            const historyTitle = document.createElement('div');
            historyTitle.classList.add('history-title');
            
            const pageName = (page.page || '').split('.')[0] || '';
            const safeParams = page.params || '';
            const params = new URLSearchParams(safeParams);
            switch (pageName) {
                case 'lines_info':
                    historyIcon.textContent = 'route';
                    const lineId = params.get('line');
                    const lineName = getLineName(lineId) || strings.lines_info.map_all_lines[lang];
                    historyTitle.textContent = lineName;
                    break;
                case 'trains_info':
                    historyIcon.textContent = 'directions_subway';
                    historyTitle.textContent = params.get('q')?params.get('q') : strings.trains_info.page_title[lang];
                    break;
                case 'ticket_calculator':
                    historyIcon.textContent = 'universal_currency_alt';
                    const startCode = params.get('start') || '';
                    const endCode = params.get('end') || '';
                    const sortBy = params.get('sort') || 'time';
                    let routeText = '';
                    console.log(startCode, endCode);
                    if (strings.station_names[startCode.toUpperCase()]) {
                        routeText += strings.station_names[startCode.toUpperCase()][lang];
                    } else routeText += '...';
                    routeText += ' → ';
                    if (strings.station_names[endCode.toUpperCase()]) {
                        routeText += strings.station_names[endCode.toUpperCase()][lang];
                    } else routeText += '...';
                    routeText += ' (' + strings.ticket_calculator['sort_by_'+sortBy][lang] + ')';
                    historyTitle.textContent = 
                        (strings.station_names[startCode.toUpperCase()] || 
                        strings.station_names[endCode.toUpperCase()]) ? 
                        routeText : strings.ticket_calculator.page_title[lang];
                    break;
                case 'content':
                    historyIcon.textContent = 'newsmode';
                    const type = params.get('type');
                    const query = params.get('q');
                    console.log('content', type,query);
                    switch (type) {
                        case 'series':
                            historyTitle.textContent = query+strings.trains_info._series[lang];
                            break;
                        case 'station':
                            const stationName = strings.station_names[query][lang];
                            const originalName = strings.station_names[query].original || strings.station_names[query].zh_hans;
                            historyTitle.textContent = stationName+(stationName!==originalName?(' / '+originalName):'');
                            break;
                    }
            }
            historyItem.addEventListener('click', () => {
                // 获取当前参数，如果已经有参数则添加&from=history，否则添加?from=history
                const separator = (page.params && page.params.includes('?')) ? '&' : '?';
                const newParams = page.params?page.params:'' + separator + 'from=history';
                window.open(page.page + newParams, '_self');
            });
            historyItem.appendChild(historyIcon);
            historyItem.appendChild(historyTitle);

            const historyTime = document.createElement('div');
            historyTime.classList.add('history-time');
            // 将绝对时间改为相对时间显示
            historyTime.textContent = getTimeAgo(page.timestamp);
            historyItem.appendChild(historyTime);
            
            historyList.appendChild(historyItem);
        })
        if (inDialog === true) {
            if (prefs.openInContent !== true) pushDialog(historyList, 'custom', strings.general.history[lang]);
            else window.open('content.html?type=history','_self');
        }
        else {
            historyList.dataset.title = strings.general.history[lang];
            return historyList;
        }
    }
}

async function loadSeriesInfo(seriesName,inDialog = true,lang=window.lang) { 
    console.log('loadSeriesInfo', seriesName);
    const trainInfo = document.createElement('div');
    trainInfo.classList.add('series-info-container');
    
    try {
        // 从./data/trains_info.json中获取数据
        const trainData = await getTrainData();
        
        const sereisData = trainData.series.find(series => series.name === seriesName);
        if (!sereisData) throw showToast(strings.trains_info.series_not_found[lang]);
        
        const coverItems = (sereisData.gallery || []).filter(img => img && img.class === 'cover');
        const seriesImg = coverItems.length > 0
            ? coverItems[Math.floor(Math.random() * coverItems.length)].image || ''
            : '';

        const seriesInfo = document.createElement('div');
        seriesInfo.classList.add('series-info');
        const statsContainer = document.createElement('div');
        statsContainer.classList.add('stats-container');
        const seatsInfo = document.createElement('div');
        seatsInfo.classList.add('seats-info');
        seatsInfo.classList.add('stats-item');
        const seatsNum = document.createElement('div');
        seatsNum.classList.add('stats-num');
        let totalSeats = 0;
        seatsInfo.appendChild(seatsNum);
        const seatsDesc = document.createElement('div');
        seatsDesc.textContent = strings.ticket_calculator.seats_count[lang];
        seatsDesc.classList.add('stats-desc');
        seatsInfo.appendChild(seatsDesc);
        statsContainer.appendChild(seatsInfo);
        const maxSpdInfo = document.createElement('div');
        maxSpdInfo.classList.add('max-spd-info');
        maxSpdInfo.classList.add('stats-item');
        const maxSpdNum = document.createElement('div');
        maxSpdNum.classList.add('stats-num');
        maxSpdNum.innerHTML = (sereisData.maxSpeed || 0) + '<small>km/h</small>';
        maxSpdInfo.appendChild(maxSpdNum);
        const maxSpdDesc = document.createElement('div');
        maxSpdDesc.textContent = strings.ticket_calculator.max_spd[lang];
        maxSpdDesc.classList.add('stats-desc');
        maxSpdInfo.appendChild(maxSpdDesc);
        statsContainer.appendChild(maxSpdInfo);
        seriesInfo.appendChild(statsContainer);

        sereisData.seats.forEach((carriage,index) => { 
            const carriageInfo = document.createElement('div');
            carriageInfo.classList.add('carriage-info');
            const seatMap = document.createElement('div');
            seatMap.classList.add('seat-map');
            if (carriage.rows) {
                for (let i = 0; i < carriage.rows; i++) { 
                    const row = document.createElement('div');
                    row.classList.add('row');
                    const seatsAbc = document.createElement('div');
                    seatsAbc.classList.add('seats-abc');
                    const seatsDef = document.createElement('div');
                    seatsDef.classList.add('seats-def');
                    carriage.seatsInRow.forEach(seat => { 
                        const seatItem = document.createElement('div');
                        seatItem.classList.add('seat-item');
                        seatItem.textContent = seat;
                        totalSeats++;
                        if (carriage.class === 'premium') {
                            seatItem.style.backgroundColor = 'var(--color-primary)';
                            seatItem.style.color = 'var(--color-text-on-primary)';
                        }
                        else seatItem.style.backgroundColor = 'var(--color-primary-transparent)';
                        if (seat.match(/[A-C]/)) seatsAbc.appendChild(seatItem);
                        else if (seat.match(/[D-F]/)) seatsDef.appendChild(seatItem);
                    });
                    row.appendChild(seatsAbc);
                    row.appendChild(seatsDef);
                    seatMap.appendChild(row);
                }
                const storage = document.createElement('div');
                storage.classList.add('storage');
                if (carriage.class === 'premium') { 
                    if (index === 0) seatMap.insertBefore(storage, seatMap.firstChild);
                    else seatMap.appendChild(storage);
                }
            } else { 
                for (let i=0; i<carriage.seatsCount/2; i++) {
                    const row = document.createElement('div');
                    row.classList.add('row');
                    for (let j=0; j<2; j++) {
                        const seatItem = document.createElement('div');
                        seatItem.classList.add('seat-item');
                        totalSeats++;
                        seatItem.style.opacity = 0.5;
                        seatItem.style.borderRadius = '0';
                        seatItem.textContent = i*2+j+1;
                        row.appendChild(seatItem);
                    }
                    seatMap.appendChild(row);
                }
                seatMap.style.justifyContent = 'center';
            }
            carriageInfo.appendChild(seatMap);

            const carriageDesc = document.createElement('div');
            carriageDesc.classList.add('carriage-desc');
            const carriageTitle = document.createElement('div');
            carriageTitle.classList.add('carriage-title');
            const carriageNo = document.createElement('span');
            carriageNo.classList.add('carriage-no');
            carriageNo.textContent = strings.ticket_calculator.carriage_no[lang].replace('{no}', index+1);
            carriageTitle.appendChild(carriageNo);
            const carriageClass = document.createElement('small');
            carriageClass.classList.add('carriage-class');
            carriageClass.textContent = strings.ticket_calculator[carriage.class+'_class'][lang];
            carriageTitle.appendChild(carriageClass);
            carriageDesc.appendChild(carriageTitle);
            const facilitiesContainer = document.createElement('div');
            facilitiesContainer.classList.add('facilities-container');
            carriage.facilities?.forEach(facility => { 
                const facilityItem = document.createElement('div');
                facilityItem.classList.add('facility-item');
                const facilityIcon = document.createElement('span');
                facilityIcon.classList.add('material-symbols-outlined');
                const facilityText = document.createElement('span');
                switch (facility) { 
                    case 'luggage': 
                        facilityIcon.textContent = 'checked_bag'; 
                        break;
                    case 'tray': 
                        facilityIcon.textContent = 'table_restaurant'; 
                        break;
                    case 'box': 
                        facilityIcon.textContent = 'door_sliding'; 
                        break;
                    case 'no_seat': 
                        facilityItem.style.opacity = 0.5;
                        facilityIcon.classList.add('no-seat');
                        facilityIcon.textContent = 'flight_class'; 
                        facilityText.textContent = carriage.seatsCount + strings.ticket_calculator._seats[lang] + ' ';
                        break;
                    case 'seats': 
                        facilityIcon.textContent = 'flight_class'; 
                        facilityText.textContent = (carriage.seatsInRow.length * carriage.rows) + strings.ticket_calculator._seats[lang] + ' ';
                        break;
                }
                facilityText.textContent += strings.ticket_calculator['facility_'+facility][lang];
                facilityItem.appendChild(facilityIcon);
                facilityItem.appendChild(facilityText);
                facilitiesContainer.appendChild(facilityItem);
            });
            carriageDesc.appendChild(facilitiesContainer);
            carriageInfo.appendChild(carriageDesc);
            seriesInfo.appendChild(carriageInfo);
        });
        seatsNum.textContent = totalSeats;
        if (inDialog === true) {
            if (prefs.openInContent !== true) pushDialog(seriesInfo, 'custom', seriesName + strings.trains_info._series[lang], '', seriesImg);
            else window.open('content.html?type=series&q='+seriesName, '_self');
        }
        recordLastVisitedPage('?type=series&q='+seriesName,'content.html');
        seriesInfo.dataset.title=seriesName + strings.trains_info._series[lang];
        seriesInfo.dataset.cover=seriesImg;
        return seriesInfo;          
    } catch (error) {
        console.error('Error loading series info:', error);
    }
}

async function loadStationInfo(code, inDialog = true, lang=window.lang) { 
    try { 
        const data = await getStationData(code);
        console.log('Station info:', data);
        if (!data) throw showToast(strings.station_info.info_not_found[lang]);

        // 检查window.stationsNetwork是否存在，如果不存在则尝试获取
        if (!window.stationsNetwork) {
            // 尝试从network.json加载数据
            const networkResponse = await fetch('./data/network.json');
            const networkData = await networkResponse.json();
            window.stationsNetwork = networkData.stations;
        }

        const platforms = window.stationsNetwork.filter(station => station.name.startsWith(code));

        const stationName = strings.station_names[code][lang];
        const originalName = strings.station_names[code].original || strings.station_names[code].zh_hans;

        const stationInfo = document.createElement('div');
        stationInfo.classList.add('station-info');

        const trainInfoTitle = document.createElement('h4');
        trainInfoTitle.classList.add('train-info-title');
        trainInfoTitle.textContent = strings.trains_info.page_title[lang];
        stationInfo.appendChild(trainInfoTitle);

        const trainInfoBtn = document.createElement('div');
        trainInfoBtn.classList.add('train-info-link');
        trainInfoBtn.classList.add('icon-btn');
        trainInfoBtn.style.width = 'fit-content';
        trainInfoBtn.style.padding = 0;
        const trainInfoLink = document.createElement('a');
        trainInfoLink.textContent = strings.station_info.check_train_info[lang];
        trainInfoLink.href = `trains_info.html?q=${code}`;
        trainInfoBtn.appendChild(trainInfoLink);
        stationInfo.appendChild(trainInfoBtn);

        const exitsTitle = document.createElement('h4');
        exitsTitle.classList.add('exits-title');
        exitsTitle.textContent = strings.station_info.exits[lang];
        stationInfo.appendChild(exitsTitle);
        const exitsInfo = document.createElement('div');
        exitsInfo.classList.add('exits-info');
        if (data.exits.length > 0) { 
            data.exits.forEach(exit => { 
                const exitId = exit.id;
                // 如果是字母开头，取第一段连续的字母部分；否则取字母或小数点前的部分
                const exitMain = /^[a-zA-Z]/.test(exitId) ? 
                    exitId.match(/^[a-zA-Z]+/)[0] : 
                    exitId.split(/[a-zA-Z.]/)[0];
                // 剩余部分用小字表示
                const exitSub = exitId.replace(exitMain,'');
                const exitInfo = document.createElement('div');
                exitInfo.classList.add('exit-info');
                exitInfo.innerHTML = `
                    <div class="exit-id ${exit.oneway!==undefined?exit.oneway:''}">${exitMain}<small ${exitSub===''?'style="display:none"':''}>${exitSub}</small></div>
                    <div class="exit-dir">${exit.floor+' <small>'+(exit.dir?strings.station_info[exit.dir][lang]:'')+'</small>'}</div>
                    <div class="exit-desc">
                        <span>${(strings.station_info[exit.desc]?
                        strings.station_info[exit.desc][lang]:exit.desc)+
                        (exit.desc_dir?strings.station_info[exit.desc_dir+'_side'][lang]:'')+' '+
                        (exit.oneway!==undefined?(' ('+strings.station_info['way_'+exit.oneway][lang]+')'):'')}</span>
                        <div class="exit-facilities material-symbols-outlined">${Array.isArray(exit.facilities) ? exit.facilities.join('') : ''}</div>
                    </div>
                `;
                exitsInfo.appendChild(exitInfo);
            });
        } else { 
            const exitInfo = document.createElement('div');
            exitInfo.classList.add('exit-info');
            exitInfo.textContent = strings.station_info.no_exit[lang];
            exitInfo.style.color = 'var(--color-text-secondary)';
            exitsInfo.appendChild(exitInfo);
        }
        stationInfo.appendChild(exitsInfo);

        const facilitiesTitle = document.createElement('h4');
        facilitiesTitle.classList.add('floors-title');
        facilitiesTitle.textContent = strings.station_info.floors[lang];
        stationInfo.appendChild(facilitiesTitle);
        const platformsItem = document.createElement('div');
        platformsItem.classList.add('platforms-item');
        console.log(getLinesForStation(code));
        platformsItem.innerHTML += '<span class="material-symbols-outlined">train</span>';
        const platformsContent = document.createElement('div');
        platformsContent.classList.add('platforms-content');
        platformsContent.innerHTML += strings.station_info.platforms[lang]
            .replace('{plat}',[
                ...new Set(
                    platforms
                    .map(platform => platform.name.replace(/[A-Z]/g,'').replace(/^0+/,'')))
                ].sort((a, b) => parseInt(a) - parseInt(b)).join('/'));
        getLinesForStation(code).forEach(line => {
            platformsContent.innerHTML+=`<a href="lines_info.html?line=${line.id}" title="${line.name[lang]}" class="line-code" style="--current-color:${line.color}">${line.id}</a>`
        });
        platformsItem.appendChild(platformsContent);
        if (data.floors.length > 0) { 
            data.floors.forEach(f => { 
                const floorsInfo = document.createElement('div');
                floorsInfo.classList.add('floors-info');
                const floorNo = document.createElement('div');
                floorNo.classList.add('floor-no');
                floorNo.innerHTML = f.id+`<br /><small>${strings.station_info['floor_'+f.type][lang]}</small>`;
                const floorInfo = document.createElement('div');
                floorInfo.classList.add('facilities-container');
                if (f.type === 'platform') floorInfo.appendChild(platformsItem);
                const facilitiesData = data.facilities.filter(fd => fd.floor === f.id);
                facilitiesData.forEach(fd => { 
                    const facilityItem = document.createElement('div');
                    facilityItem.classList.add('facility-item');
                    const facilityIcon = document.createElement('span');
                    facilityIcon.classList.add('material-symbols-outlined');
                    const textToIcon = {
                        toilet: 'wc',
                        longue: 'airline_seat_recline_extra',
                        services: 'help',
                        ticket: 'transit_ticket',
                        luggage: 'checked_bag',
                        claim: 'massage',
                        shopping: 'shopping_bag',
                        food: 'local_dining',
                        nursing: 'baby_changing_station',
                        accessible_toilet: 'accessible',
                        family_toilet: 'family_restroom',
                        elevator: 'elevator',
                        parking: 'local_parking',
                        platforms: 'train',
                        transfer: 'transfer',
                    }
                    facilityIcon.textContent = textToIcon[fd.type] || 'info';
                    const facilityText = document.createElement('span');
                    facilityText.textContent = strings.station_info[fd.type][lang] || fd.type;
                    if (fd.type === 'platforms') { 
                        const facilityPlatforms = document.createElement('div');
                        facilityPlatforms.classList.add('platforms-content');
                        facilityPlatforms.innerHTML = 
                            facilityText.textContent.replace('{plat}', fd.desc);
                        if (fd.lines) {
                            // 并行获取所有线路的颜色和英文名称
                            const lineDataPromises = fd.lines.map(async l => {
                                const [color, englishName] = await Promise.all([
                                    getColorForMtrLine(l),
                                    getEnglishNameForMtrLine(l)
                                ]);
                                return { line: l, color, englishName };
                            });
                            
                            Promise.all(lineDataPromises).then(results => {
                                const lineElements = results.map(({ line, color, englishName }) => {
                                    const displayName = lang.startsWith('zh') ? line : englishName;
                                    return `<span class="line-mtr" style="background:${color+'30'};color:${color}">${displayName}</span>`;
                                });
                                facilityPlatforms.innerHTML += lineElements.join('');
                            });
                        }
                        facilityText.textContent = '';
                        facilityText.appendChild(facilityPlatforms);
                    } else if (fd.dir) {
                        facilityText.textContent += 
                            strings.station_info._of_the_floor[lang]
                            .replace('{dir}', strings.station_info[fd.dir+'_part'][lang]);
                    } else if (fd.plat) { 
                        facilityText.textContent += 
                            strings.station_info._of_platform_no_[lang]
                            .replace('{side}', strings.station_info['plat_side_'+fd.plat_side][lang])
                            .replace('{plat}', fd.plat);
                    }
                    facilityItem.appendChild(facilityIcon);
                    facilityItem.appendChild(facilityText);
                    floorInfo.appendChild(facilityItem);
                });
                floorsInfo.appendChild(floorNo);
                floorsInfo.appendChild(floorInfo);
                stationInfo.appendChild(floorsInfo);
            });
        }


        if (inDialog === true) {
            if (prefs.openInContent !== true) pushDialog(stationInfo, 'custom', strings.station_names[code][lang]+(stationName!==originalName?(' / '+originalName):''), '', data.cover);
            else window.open('content.html?type=station&q='+code,'_self');
        }
        recordLastVisitedPage('?type=station&q='+code,'content.html');
        stationInfo.dataset.cover = data.cover;
        stationInfo.dataset.title = strings.station_names[code][lang]+(stationName!==originalName?(' / '+originalName):'');
        return stationInfo;
    } catch (error) {
        console.error('Error loading station info:', error);
    }
}
