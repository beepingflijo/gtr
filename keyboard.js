function listenKeyboardShortcuts() {
    let shortcutStartTime;
    let shortcutEndTime;
    let shortcutDisabledToastShown = false;
    document.addEventListener('keydown', function(event) { 
        const currentPage = window.location.pathname.split('/').pop();
        shortcutStartTime = Date.now();
        if (compactParam === 'true') {
            if (event.altKey && event.key === 'M') {
                // 去掉compact参数
                const newUrl = window.location.pathname.replace(`compact=true`, '');
                window.history.replaceState({}, '', newUrl);
                window.location.reload();
            }
            return;
        }
        const shareBtn = document.querySelector('.share-btn');
        const searchBar = document.querySelectorAll('.search-bar');
        const startInput = document.querySelector('.side-bar #startInput');
        const endInput = document.querySelector('.side-bar #endInput');
        const sidebar = document.querySelector('.side-bar');
        const searchBtn = document.querySelector('#searchBtn');
        const swapBtn = document.querySelector('.swap-btn');
        const clearBtn = document.querySelectorAll('.active #clearBtn');
        console.log(clearBtn.length);
        const clearSearchBtn = document.querySelector('.clear-search-btn');
        const sidebarSearchPanel = document.querySelector('.side-bar .search-controls');
        const sortByTime = document.querySelector('.side-bar .sort-by-time');
        const sortByTransfers = document.querySelector('.side-bar .sort-by-transfers');
        const sortByPrice = document.querySelector('.side-bar .sort-by-price');
        const sortByDepartureEarly = document.querySelector('.side-bar .sort-by-departure-early');
        const sortByArrivalEarly = document.querySelector('.side-bar .sort-by-arrival-early');
        const mapEntry = document.querySelector('.map-entry');
        const modalOverlay = document.querySelectorAll('.modal-overlay');
        const backBtn = document.querySelector('.back-btn');
        const nextBtn = document.querySelector('.next-btn');
        const prevBtn = document.querySelector('.prev-btn');
        const showTimetableBtn = document.querySelector('.show-timetable-btn');
        const showFareDetailBtn = document.querySelector('.show-fare-detail-btn');
        const mapZoomIn = document.querySelector('#map-zoom-in');
        const mapZoomOut = document.querySelector('#map-zoom-out');
        const mapFitBtn = document.querySelector('#map-fit-btn');
        const mapTrainsToggle = document.querySelector('#map-trains-toggle');
        const mapLayerToggle = document.querySelector('#map-layer-toggle');
        const setUpwardsSwitch = document.querySelector('.switch.set-upwards');
        const linesWithoutR = window.lines?.filter(line => !line.id.includes('-R'));
        const lineCodeLastLetters = linesWithoutR?.map(line => line.id.slice(-1));
        // Alt 触发快捷键操作
        if (event.altKey) { 
            switch (event.key) {
                case '1':
                    if (!sidebar) break;
                    window.location.href = 'lines_info.html'; 
                    break;
                case '2':
                    if (!sidebar) break;
                    window.location.href = 'ticket_calculator.html'; 
                    break;
                case '3':
                    if (!sidebar) break;
                    window.location.href = 'trains_info.html'; 
                    break;
                case 'R':
                    if (!sidebar) break;
                    window.location.href = 'preferences.html'; 
                    break;
                case 'H':
                    if (!sidebar) break;
                    const existingHistoryList = document.querySelectorAll('.modal-overlay .history-list');
                    modalOverlay.forEach(overlay => {
                        closeDialog(overlay);
                    });
                    if (existingHistoryList.length > 0) break;
                    loadHistory();
                    break;
                case '|':
                    if (!sidebar) break;
                    if (sidebar.style.opacity > 0) toggleSidebar();
                    break;
                case 'S':
                    if (!sidebar) break;
                    if (shareBtn) {
                        shareBtn.click();
                    }
                    break;
                case 'N':
                    showTimetableBtn?.click();
                    mapTrainsToggle?.click();
                    break;
                case 'L':
                    //mapLayerToggle?.click();
                    break;
                case 'F':
                    showFareDetailBtn?.click();
                    break;
                case 'Q':
                    if (searchBar.length > 0) {
                        const footer = document.querySelector('footer');
                        const activeBar =
                            footer.style.opacity > 0 ?
                            document.querySelector('footer .search-bar') :
                            document.querySelector('header .search-bar');
                        const input = activeBar.querySelector('input');
                        
                        if (activeBar.classList.contains('collapsed')) {
                            activeBar.classList.remove('collapsed');
                            input?.focus();
                        } else{
                            activeBar.classList.add('collapsed');
                            input?.blur();
                        }
                        handleFooterItemCollapse();
                    } else if (startInput && endInput && sidebar.style.opacity > 0) { 
                        if (!endInput.value.trim()) {
                            endInput.focus();
                        }
                        if (!startInput.value.trim()) {
                            startInput.focus();
                        }
                    }
                    break;
                case 'Backspace':
                    if (clearBtn.length > 0) clearBtn.forEach(btn => btn.click());
                    clearSearchBtn?.click();
                    break;
                case 'Delete':
                    if (currentPage === 'preferences.html') {window.resetPreferences()};
                    break;
                case 'A':
                    mapEntry?.click();
                    break;
                case 'Enter': 
                    if (currentPage!=='content.html') backBtn?.click();
                    break;
                case '\\': 
                    setUpwardsSwitch?.click();
                    break;
                case 'M': 
                    if (!['lines_info.html', 'trains_info.html'].includes(currentPage)) break;
                    // 添加compact=true参数
                    window.location.href = 
                        window.location.pathname + 
                        (window.location.pathname.includes('?') ? '&' : '?') + 
                        'compact=true';
                    break;
            }
        } else if (event.shiftKey) { 
            // 输入过程中不要响应只有shift和其他按键触发的快捷键
            const composingInput = document.querySelector('input:focus');
            console.log(composingInput);
            if (composingInput) {
                if (!shortcutDisabledToastShown) {
                    showToast(strings.general.shortcut_key_disabled_while_typing[lang]);
                    shortcutDisabledToastShown = true;
                }
                return;
            }
            // 处理 Shift + 数字键的情况,将特殊字符转换回数字
            let searchKey = event.key;
            const shiftNumberMap = {
                '!': '1', '@': '2', '#': '3', '$': '4', '%': '5',
                '^': '6', '&': '7', '*': '8', '(': '9', ')': '0'
            };
            if (event.shiftKey && shiftNumberMap[event.key]) {
                searchKey = shiftNumberMap[event.key];
            }
            switch (searchKey) { 
                case 'Enter': 
                    swapBtn?.click();
                    prevBtn?.click();
                    break;
                case '1':
                    sortByTime?.click();
                    break;
                case '2':
                    sortByTransfers?.click();
                    break;
                case '3':
                    sortByPrice?.click();
                    break;
                case '4':
                    sortByDepartureEarly?.click();
                    break;
                case '5':
                    sortByArrivalEarly?.click();
                    break;
            }
            if (currentPage === 'lines_info.html') {
                const matchedLine = linesWithoutR.find(line => line.id.slice(-1) === searchKey);
                const newLineId = matchedLine?.id;
                if (newLineId) {
                    window.location.href = 'lines_info.html?line=' + newLineId;
                }
            }
        } else if (event.ctrlKey){
            if (event.key === 'C' || event.key === 'c') {
                const currentDialog = document.querySelector('.modal-overlay .dialog-container');
                if (currentDialog) {
                    const dialogTitle = currentDialog.querySelector('.dialog-title');
                    const dialogContent = currentDialog.querySelector('.dialog-content');
                    const dialogButtons = currentDialog.querySelector('.dialog-buttons');
                    let text = '';
                    // 标题部分
                    if (dialogTitle && dialogTitle.textContent.trim()) {
                        text += '[Window Title]\n' + dialogTitle.textContent.trim() + '\n\n';
                    }
                    // 内容部分 - 递归格式化处理
                    if (dialogContent) {
                        function formatDialogContent(el) {
                            // 纯文本节点（无子元素）直接返回文本
                            if (el.children.length === 0) {
                                return (el.textContent || '').replace(/\s+/g, ' ').trim();
                            }
                            const parts = [];
                            for (const child of el.children) {
                                // 跳过图标元素
                                if (child.classList.contains('material-symbols-outlined')) continue;
                                // 检查是否有嵌套的元素子节点（排除纯文本和图标）
                                const hasNestedElements = Array.from(child.children).some(
                                    sub => !sub.classList.contains('material-symbols-outlined')
                                );
                                if (hasNestedElements) {
                                    // 有嵌套子项，递归处理并用换行连接
                                    parts.push(formatDialogContent(child));
                                } else {
                                    // 无嵌套子项，用空格连接文本内容
                                    const clone = child.cloneNode(true);
                                    clone.querySelectorAll('.material-symbols-outlined').forEach(icon => icon.remove());
                                    const t = (clone.textContent || '').replace(/\s+/g, ' ').trim();
                                    if (t) parts.push(t);
                                }
                            }
                            return parts.join('\n');
                        }
                        const contentText = formatDialogContent(dialogContent);
                        if (contentText) {
                            text += '[Content]\n' + contentText + '\n\n';
                        }
                    }
                    // 按钮部分
                    if (dialogButtons) {
                        const buttons = Array.from(dialogButtons.querySelectorAll('button'));
                        if (buttons.length > 0) {
                            const buttonTexts = buttons.map(btn => '[' + btn.textContent.trim() + ']');
                            text += buttonTexts.join(' ');
                        }
                    }
                    // 写入剪贴板
                    if (text) {
                        navigator.clipboard.writeText(text).catch(() => {
                            // 降级方案：使用临时 textarea
                            const textArea = document.createElement('textarea');
                            textArea.value = text;
                            textArea.style.position = 'fixed';
                            textArea.style.opacity = '0';
                            document.body.appendChild(textArea);
                            textArea.select();
                            try { document.execCommand('copy'); } catch (e) {}
                            document.body.removeChild(textArea);
                        });
                    }
                }
            }
        } else { 
            switch (event.key) { 
                case 'Escape': 
                    if (currentPage === 'content.html') {
                        document.querySelector('.back-btn')?.click();
                    }
                    modalOverlay.forEach(overlay => {
                        closeDialog(overlay);
                    });
                    break;
                case 'Enter': 
                    searchBtn?.click();
                    nextBtn?.click();
                    break;
                case '-':
                    mapZoomOut?.click();
                    break;
                case '=':
                    mapZoomIn?.click();
                    break;
                case '0':
                    mapFitBtn?.click();
                    break;
                case 'ArrowUp':
                case 'ArrowDown':
                case 'ArrowLeft':
                case 'ArrowRight':
                    // 键盘方向键控制地图平移（屏幕像素步长，由 MapMode 内部转换为世界坐标）
                    if (typeof MapMode !== 'undefined' && MapMode.isOpen()) {
                        var PAN_STEP = 80;
                        var dx = 0, dy = 0;
                        if (event.key === 'ArrowLeft') dx = PAN_STEP;
                        else if (event.key === 'ArrowRight') dx = -PAN_STEP;
                        else if (event.key === 'ArrowUp') dy = PAN_STEP;
                        else if (event.key === 'ArrowDown') dy = -PAN_STEP;
                        MapMode.panBy(dx, dy);
                        event.preventDefault();
                    }
                    break;
            }
        }
        if (event.ctrlKey || event.altKey || event.shiftKey) { 
            // 根据系统判断显示alt还是option
            const altKeyName = navigator.platform.includes('Mac') || navigator.platform.includes('iPhone') ? '<span class="material-symbols-outlined">keyboard_option_key</span>' : 'Alt';
            const ctrlKeyName = navigator.platform.includes('Mac') || navigator.platform.includes('iPhone') ? '<span class="material-symbols-outlined">keyboard_control_key</span>' : 'Ctrl';
            const metaKeyName = navigator.platform.includes('Mac') || navigator.platform.includes('iPhone') ? '<span class="material-symbols-outlined">keyboard_command_key</span>' : '<span class="material-symbols-outlined">window</span>';
            const enterKeyName = navigator.platform.includes('Mac') || navigator.platform.includes('iPhone') ? 'return' : 'Enter';
            const deleteKeyName = navigator.platform.includes('Mac') || navigator.platform.includes('iPhone') ? '<span class="material-symbols-outlined" style="transform: rotate(180deg);">backspace</span>' : 'Del';
            const backspaceKeyName = navigator.platform.includes('Mac') || navigator.platform.includes('iPhone') ? '<span class="material-symbols-outlined">backspace</span>' : 'Backspace';
            const shortcutList = document.createElement('div');
            shortcutList.className = 'shortcut-list';
            const sideBarBtn = document.querySelector('.side-bar-btn');
            const sideBarBtnTitle = sideBarBtn?.title || sideBarBtn?.getAttribute('title') || '';
            shortcutList.innerHTML = `
                ${sidebar ? `<div class="shortcut-item">
                    <span class="shortcut-description">${strings.lines_info.page_title[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key">1</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-description">${strings.ticket_calculator.page_title[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key">2</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-description">${strings.trains_info.page_title[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key">3</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-description">${strings.preferences.page_title[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">R</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-description">${strings.general.history[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">H</span>
                </div>
                <div class="shortcut-item" ${sideBarBtnTitle ? '' : 'style="display: none;"'}>
                    <span class="shortcut-description">${sideBarBtnTitle}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">\\</span>
                </div>
                <div class="shortcut-item" ${shareBtn ? '' : 'style="display: none;"'}>
                    <span class="shortcut-description">${shareBtn?.getAttribute('title')}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">S</span>
                </div>` : ''}
                <div class="shortcut-item" ${currentPage === 'lines_info.html' ? '' : 'style="display: none;"'}>
                    <span class="shortcut-description">${strings.lines_info.show_other_line[lang]}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">${lineCodeLastLetters?.join('/') || ''}</span>
                </div>
                <div class="shortcut-item" ${currentPage === 'lines_info.html' ? '' : 'style="display: none;"'}>
                    <span class="shortcut-description">${strings.lines_info.route_map[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">A</span>
                </div>
                <div class="shortcut-item" ${searchBar.length > 0 || (sidebarSearchPanel && sidebarSearchPanel.style.display !== 'none' && sidebar.style.opacity > 0) ? '' : 'style="display: none;"'}>
                    <span class="shortcut-description">${searchBar.length > 0 ? strings.ticket_calculator.search[lang] : strings.ticket_calculator.input[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">Q</span>
                </div>
                <div class="shortcut-item" ${(backBtn && currentPage!=='content.html') ? '' : 'style="display: none;"'}>
                    <span class="shortcut-description">${strings.preferences.save_and_exit[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key">${enterKeyName}</span>
                </div>
                <div class="shortcut-item" ${currentPage==='content.html' ? '' : 'style="display: none;"'}>
                    <span class="shortcut-description">${strings.general.back[lang]}</span>
                    <span class="shortcut-key">esc</span>
                </div>
                <div class="shortcut-item" ${currentPage === 'preferences.html' ? '' : 'style="display: none;"'}>
                    <span class="shortcut-description">${strings.preferences.reset_preferences[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key">${deleteKeyName}</span>
                </div>
                ${sidebarSearchPanel && sidebarSearchPanel.style.display !== 'none' ? `
                <div class="shortcut-item">
                    <span class="shortcut-description">${strings.ticket_calculator.search[lang]}</span>
                    <span class="shortcut-key">${enterKeyName}</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-description">${strings.ticket_calculator.swap[lang]}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">${enterKeyName}</span>
                </div>` : ''}
                <div class="shortcut-item" ${currentPage !== 'preferences.html' && (clearBtn.length>0 || searchBar.length>0) ? '' : 'style="display: none;"'}>
                    <span class="shortcut-description">${strings.ticket_calculator.clear_input[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key">${backspaceKeyName}</span>
                </div>
                ${currentPage === 'pov-frame.html' ? `
                <div class="shortcut-item">
                    <span class="shortcut-description">上一张</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">${enterKeyName}</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-description">下一张</span>
                    <span class="shortcut-key">${enterKeyName}</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-description">切换上下行</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key">\\</span>
                </div>` : ''}
                ${sidebarSearchPanel && sidebarSearchPanel.style.display !== 'none' ? `
                <div class="shortcut-item">
                    <span class="shortcut-description">${strings.ticket_calculator.show_[lang] + strings.ticket_calculator.faster[lang]}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">1</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-description">${strings.ticket_calculator.show_[lang] + strings.ticket_calculator.direct[lang]}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">2</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-description">${strings.ticket_calculator.show_[lang] + strings.ticket_calculator.cheaper[lang]}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">3</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-description">${strings.ticket_calculator.show_[lang] + strings.ticket_calculator.sort_by_departure_early[lang]}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">4</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-description">${strings.ticket_calculator.show_[lang] + strings.ticket_calculator.sort_by_arrival_early[lang]}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">5</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-description">${strings.ticket_calculator.toggle_[lang] + strings.ticket_calculator.show_timetable[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">N</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-description">${strings.ticket_calculator.toggle_[lang] + strings.ticket_calculator.show_fare_detail[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">F</span>
                </div>` : ''}
                ${document.querySelector('.map-overlay.active') ? `
                <div class="shortcut-item"> 
                    <span class="shortcut-description">${strings.lines_info.map_zoom_in[lang]+' / '+strings.lines_info.map_zoom_out[lang]}</span>
                    <span class="shortcut-key">=</span>/<span class="shortcut-key">-</span>
                </div>
                <div class="shortcut-item"> 
                    <span class="shortcut-description">${strings.lines_info.map_fit_all[lang]}</span>
                    <span class="shortcut-key">0</span>
                </div>
                <div class="shortcut-item"> 
                    <span class="shortcut-description">${strings.lines_info.map_toggle_trains[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">N</span>
                </div>
                <!--<div class="shortcut-item"> 
                    <span class="shortcut-description">${strings.lines_info.map_toggle_layer[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">L</span>
                </div>-->
                <div class="shortcut-item"> 
                    <span class="shortcut-description">${strings.lines_info.map_pan[lang]}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">keyboard_arrow_up</span></span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">keyboard_arrow_left</span></span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">keyboard_arrow_right</span></span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">keyboard_arrow_down</span></span>
                </div>` : ''}
                <div class="shortcut-item" ${!['lines_info.html', 'trains_info.html'].includes(currentPage) ? 'style="display: none;"' : ''}>
                    <span class="shortcut-description">${strings.general.toggle_compact_mode[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    <span class="shortcut-key">M</span>
                </div>
                <div class="shortcut-item" ${!document.querySelector('.modal-overlay') ? 'style="display: none;"' : ''}>
                    <span class="shortcut-description">${strings.general.close_dialog[lang]}</span>
                    <span class="shortcut-key">Esc</span>
                </div>
                <div class="shortcut-item" ${!document.querySelector('.modal-overlay') ? 'style="display: none;"' : ''}>
                    <span class="shortcut-description">${strings.general.copy_dialog[lang]}</span>
                    <span class="shortcut-key">${ctrlKeyName}</span>
                    <span class="shortcut-key">C</span>
                </div>
            `;
            setTimeout(() => {
                if (Date.now() - shortcutStartTime > 1000 && (shortcutEndTime < shortcutStartTime || !shortcutEndTime)) {
                    console.log('show shortcut',shortcutStartTime,shortcutEndTime);
                    pushDialog(shortcutList, 'custom');
                    const appendedList = document.querySelector('.modal-overlay .shortcut-list');
                    const listParent = appendedList.parentElement;
                    const listWidth = appendedList.getBoundingClientRect().width;
                    const windowWidth = window.innerWidth;
                    if (listWidth / windowWidth < 0.5) {
                        appendedList.style.maxHeight = listWidth * 1.5 + 'px';
                    } else {
                        appendedList.style.maxHeight = '90vh';
                    }
                    appendedList.style.width = '-webkit-fill-available';
                    const listShortcut = document.createElement('div');
                    listShortcut.classList.add('dialog-content');
                    listShortcut.innerHTML = `
                    <div class="shortcut-item" style="justify-content: end;">
                        <span class="shortcut-description">${strings.ticket_calculator.show_[lang] + strings.general.shortcut_keys[lang]}</span>
                        <span>${strings.general.hold_key[lang]}</span>
                        <span class="shortcut-key">${ctrlKeyName}</span>
                        <span>/</span>
                        <span class="shortcut-key">${altKeyName}</span>
                        <span>/</span>
                        <span class="shortcut-key"><span class="material-symbols-outlined">shift</span></span>
                    </div>`;
                    listParent.appendChild(listShortcut);
                    listShortcut.style.width = '-webkit-fill-available';
                    listShortcut.style.maxWidth = '-webkit-fill-available';
                    //listShortcut.style.paddingTop = '12px';
                    listShortcut.style.borderTop = '1px solid var(--color-text-secondary)';
                }
            }, 1000);
        }
    });
    document.addEventListener('keyup', function(event) { 
        shortcutEndTime = Date.now();
        const modalOverlay = document.querySelectorAll('.modal-overlay');
        modalOverlay.forEach(overlay => {
            if (overlay.querySelector('.shortcut-list')) {
                closeDialog(overlay);
            }
        });
    });
    // 浏览器失去焦点时关闭窗口
    window.addEventListener('blur', function() {
        // 如果当前IP为localhost，不关闭窗口
        if (window.location.hostname === 'localhost') {
            return;
        }
        shortcutEndTime = Date.now();
        console.log('blur',shortcutEndTime);
        const modalOverlay = document.querySelectorAll('.modal-overlay');
        modalOverlay.forEach(overlay => {
            if (overlay.querySelector('.shortcut-list')) {
                closeDialog(overlay);
            }
        });
    });
}