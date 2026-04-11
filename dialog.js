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

function loadStationInfo(stationCode) { 
    const stationInfo = document.createElement('div');
    stationInfo.classList.add('station-info');
}