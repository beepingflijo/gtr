function loadHistory() { 
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
        pushDialog(historyList, 'custom', strings.general.history[lang]);
    }
}

async function loadSeriesInfo(seriesName) { 
    console.log('loadSeriesInfo', seriesName);
    const trainInfo = document.createElement('div');
    trainInfo.classList.add('train-info');
    
    try {
        // 从./data/trains_info.json中获取数据
        const trainData = await getTrainData();
        
        const sereisData = trainData.series.find(series => series.name === seriesName);

        const seriesCover = document.createElement('img');
        seriesCover.classList.add('series-cover');
        seriesCover.src = sereisData.gallery.find(img => img.class === 'cover').image;
        trainInfo.appendChild(seriesCover);

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
                        if (carriage.class === 'premium') seatItem.style.backgroundColor = 'var(--color-primary)';
                        else seatItem.style.backgroundColor = 'var(--color-primary-transparent)';
                        if (seat.match(/[A-C]/)) seatsAbc.appendChild(seatItem);
                        else if (seat.match(/[D-F]/)) seatsDef.appendChild(seatItem);
                    });
                    row.appendChild(seatsAbc);
                    row.appendChild(seatsDef);
                    seatMap.appendChild(row);
                }
            } else { 
                const row = document.createElement('div');
                row.classList.add('row');
                for (let i=0; i<2; i++) {
                    const seatItem = document.createElement('div');
                    seatItem.classList.add('seat-item');
                    seatItem.style.opacity = 0.5;
                    seatItem.style.borderRadius = '0';
                    seatItem.style.height = '-webkit-fill-available';
                    row.appendChild(seatItem);
                }
                row.style.height = '-webkit-fill-available'
                seatMap.appendChild(row);
            }
            carriageInfo.appendChild(seatMap);

            const carriageDesc = document.createElement('div');
            carriageDesc.classList.add('carriage-desc');
            const carriageNo = document.createElement('div');
            carriageNo.classList.add('carriage-no');
            carriageNo.textContent = strings.ticket_calculator.carriage_no[lang].replace('{no}', index+1);
            carriageDesc.appendChild(carriageNo);
            const carriageClass = document.createElement('div');
            carriageClass.classList.add('carriage-class');
            carriageClass.textContent = strings.ticket_calculator[carriage.class+'_class'][lang];
            carriageDesc.appendChild(carriageClass);
            const carriageSeats = document.createElement('div');
            carriageSeats.classList.add('carriage-seats');
            //console.log(carriage.seatsCount,carriage.seatsInRow,carriage.seatsInRow.length,carriage.rows,carriage.seatsInRow.length * carriage.rows);
            carriageSeats.textContent = 
                strings.ticket_calculator.seats_count[lang] + ': ' + 
                (carriage.seatsCount ? carriage.seatsCount : (carriage.seatsInRow.length * carriage.rows));
            carriageDesc.appendChild(carriageSeats);
            const carriageImg = document.createElement('img');
            carriageImg.classList.add('carriage-img');
            carriageImg.src = sereisData.gallery.find(img => img.class === carriage.class).image;
            carriageDesc.appendChild(carriageImg);
            carriageInfo.appendChild(carriageDesc);
            seriesInfo.appendChild(carriageInfo);
        });
    
        trainInfo.appendChild(seriesInfo);
        pushDialog(trainInfo, 'custom', seriesName);

        const images = trainInfo.querySelectorAll('img');
        images.forEach(image => { 
            image.addEventListener('error', () => { 
                image.style.opacity = 0;
            });
        });
            
    } catch (error) {
        console.error('Error loading series info:', error);
    }
}
