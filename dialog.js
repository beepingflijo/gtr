function loadHistory(inDialog = true) { 
    const history = localStorage.getItem('visitedPages');
    if (history) {
        const historyList = document.createElement('div');
        historyList.classList.add('history-list');
        const visitedPages = JSON.parse(history);
        // 按timestamp排序
        visitedPages.sort((a, b) => b.timestamp - a.timestamp);
        visitedPages.forEach(page => {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            const historyIcon = document.createElement('span');
            historyIcon.classList.add('icon');
            historyIcon.classList.add('history-icon');
            historyIcon.classList.add('material-symbols-outlined');
            const historyTitle = document.createElement('div');
            historyTitle.classList.add('history-title');
            const pageName = page.page.split('.')[0];
            const params = new URLSearchParams(page.params);
            switch (pageName) {
                case 'lines_info':
                    historyIcon.textContent = 'route';
                    const lineId = params.get('line');
                    const lineName = getLineName(lineId);
                    historyTitle.textContent = lineName;
                    break;
                case 'trains_info':
                    historyIcon.textContent = 'directions_subway';
                    historyTitle.textContent = params.get('q')?params.get('q') : strings.trains_info.page_title[lang];
                    break;
                case 'ticket_calculator':
                    historyIcon.textContent = 'universal_currency_alt';
                    const startCode = params.get('start');
                    const endCode = params.get('end');
                    const sortBy = params.get('sort') || 'time';
                    let routeText = '';
                    if (startCode && endCode) {
                        routeText = 
                            strings.station_names[startCode.toUpperCase()][lang] + ' → ' +
                            strings.station_names[endCode.toUpperCase()][lang] + ' (' + 
                            strings.ticket_calculator['sort_by_'+sortBy][lang] + ')';
                    }
                    console.log(startCode, endCode);
                    historyTitle.textContent = 
                        routeText ? routeText :
                        strings.ticket_calculator.page_title[lang];
                    break;
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
        if (inDialog === true) pushDialog(historyList, 'custom', strings.general.history[lang]);
        else return historyList;
    }
}

async function loadSeriesInfo(seriesName,inDialog = true) { 
    console.log('loadSeriesInfo', seriesName);
    const trainInfo = document.createElement('div');
    trainInfo.classList.add('series-info-container');
    
    try {
        // 从./data/trains_info.json中获取数据
        const trainData = await getTrainData();
        
        const sereisData = trainData.series.find(series => series.name === seriesName);
        if (!sereisData) throw showToast(strings.trains_info.series_not_found[lang]);
        
        const seriesImg = sereisData.gallery.find(img => img.class === 'cover').image;

        const seriesInfo = document.createElement('div');
        seriesInfo.classList.add('series-info');
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
        if (inDialog === true) pushDialog(seriesInfo, 'custom', seriesName + strings.trains_info._series[lang], '', seriesImg);
        else return seriesInfo;            
    } catch (error) {
        console.error('Error loading series info:', error);
    }
}

async function loadStationInfo(code, inDialog = true) { 
    try { 
        const data = await getStationData(code);
        console.log('Station info:', data);
        if (!data) throw showToast(strings.station_info.info_not_found[lang]);

        const platforms = window.stationsNetwork.filter(station => station.name.startsWith(code));

        const stationName = strings.station_names[code][lang];
        const originalName = strings.station_names[code].original || strings.station_names[code].zh_hans;

        const stationInfo = document.createElement('div');
        stationInfo.classList.add('station-info');

        const trainInfoTitle = document.createElement('h4');
        trainInfoTitle.textContent = strings.trains_info.page_title[lang];
        stationInfo.appendChild(trainInfoTitle);

        const trainInfoBtn = document.createElement('div');
        trainInfoBtn.classList.add('train-info-link');
        trainInfoBtn.classList.add('icon-btn');
        trainInfoBtn.style.width = 'fit-content';
        trainInfoBtn.style.padding = 0;
        const trainInfoLink = document.createElement('a');
        trainInfoLink.textContent = strings.station_info.check_train_info[lang];
        trainInfoLink.href = `trains_info.html?q=${strings.station_names[code][lang]}`;
        trainInfoBtn.appendChild(trainInfoLink);
        stationInfo.appendChild(trainInfoBtn);

        const exitsTitle = document.createElement('h4');
        exitsTitle.textContent = strings.station_info.exits[lang];
        stationInfo.appendChild(exitsTitle);
        const exitsInfo = document.createElement('div');
        exitsInfo.classList.add('exits-info');
        if (data.exits.length > 0) { 
            data.exits.forEach(exit => { 
                const exitInfo = document.createElement('div');
                exitInfo.classList.add('exit-info');
                exitInfo.innerHTML = `
                    <div class="exit-id ${exit.oneway!==undefined?exit.oneway:''}">${exit.id.split('.')[0]}<small ${exit.id.split('.').length<=1?'style="display:none"':''}>.${exit.id.split('.')[1]}</small></div>
                    <div class="exit-dir">${exit.floor+' <small>'+strings.station_info[exit.dir][lang]+'</small>'}</div>
                    <div class="exit-desc">${(strings.station_info[exit.desc]?
                        strings.station_info[exit.desc][lang]:exit.desc)+
                        strings.station_info[exit.desc_dir+'_side'][lang]+' '+
                        (exit.oneway!==undefined?(' ('+strings.station_info['way_'+exit.oneway][lang]+')'):'')}</div>
                    <div class="exit-facilities material-symbols-outlined">${Array.isArray(exit.facilities) ? exit.facilities.join('') : ''}</div>
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
        facilitiesTitle.textContent = strings.station_info.floors[lang];
        stationInfo.appendChild(facilitiesTitle);
        const platformsItem = document.createElement('div');
        platformsItem.classList.add('platforms-item');
        platformsItem.textContent = strings.station_info.platforms_[lang]
            .replace('{plat}',[
                ...new Set(
                    platforms
                    .map(platform => platform.name.replace(/[A-Z]/g,'').replace(/^0+/,'')))
                ].sort((a, b) => parseInt(a) - parseInt(b)).join('/'));
        if (data.floors.length > 0) { 
            data.floors.forEach(f => { 
                const floorsInfo = document.createElement('div');
                floorsInfo.classList.add('floors-info');
                const floorNo = document.createElement('div');
                floorNo.classList.add('floor-no');
                floorNo.innerHTML = f.id+`<br /><small>${strings.station_info['floor_'+f.type][lang]}</small>`;
                const floorInfo = document.createElement('div');
                floorInfo.classList.add('facilities-container');
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
                        wheelchair: 'accessible',
                        elevator: 'elevator',
                        parking: 'local_parking',
                        wifi: 'wifi',
                        restaurant: 'restaurant',
                        coffee: 'coffee',
                        food: 'local_dining',
                        phone: 'phone',
                        tv: 'tv',
                        internet: 'wifi',

                    }
                    facilityIcon.textContent = textToIcon[fd.type] || 'info';
                    const facilityText = document.createElement('span');
                    facilityText.textContent = strings.station_info[fd.type][lang] || fd.type;
                    if (fd.dir) {
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
                if (f.type === 'platform') floorInfo.appendChild(platformsItem);
                floorsInfo.appendChild(floorNo);
                floorsInfo.appendChild(floorInfo);
                stationInfo.appendChild(floorsInfo);
            });
        }


        if (inDialog === true) pushDialog(stationInfo, 'custom', strings.station_names[code][lang]+(stationName!==originalName?(' / '+originalName):''), '', data.cover);
        else return stationInfo;  
    } catch (error) {
        console.error('Error loading station info:', error);
    }
}
