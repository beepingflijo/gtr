function listenKeyboardShortcuts() {
    let shortcutStartTime;
    let shortcutEndTime;
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
        const modalOverlay = document.querySelectorAll('.modal-overlay');
        const backBtn = document.querySelector('.back-btn');
        const nextBtn = document.querySelector('.next-btn');
        const prevBtn = document.querySelector('.prev-btn');
        const setUpwardsSwitch = document.querySelector('.switch.set-upwards');
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
                case 'F':
                    sortByTime?.click();
                    break;
                case 'D':
                    sortByTransfers?.click();
                    break;
                case 'C':
                    sortByPrice?.click();
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
            switch (event.key) { 
                case 'Enter': 
                    swapBtn?.click();
                    prevBtn?.click();
                    break;
            }
            if (currentPage === 'lines_info.html') {
                const linesWithoutR = window.lines.filter(line => !line.id.includes('-R'));
                // 处理 Shift + 数字键的情况,将特殊字符转换回数字
                let searchKey = event.key;
                const shiftNumberMap = {
                    '!': '1', '@': '2', '#': '3', '$': '4', '%': '5',
                    '^': '6', '&': '7', '*': '8', '(': '9', ')': '0'
                };
                if (event.shiftKey && shiftNumberMap[event.key]) {
                    searchKey = shiftNumberMap[event.key];
                }
                const matchedLine = linesWithoutR.find(line => line.id.slice(-1) === searchKey);
                const newLineId = matchedLine?.id;
                if (newLineId) {
                    window.location.href = 'lines_info.html?line=' + newLineId;
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
            }
        }
        if (event.ctrlKey || event.altKey || event.shiftKey) { 
            // 根据系统判断显示alt还是option
            const altKeyName = navigator.platform.includes('Mac') || navigator.platform.includes('iPhone') ? '⌥' : 'Alt';
            const ctrlKeyName = navigator.platform.includes('Mac') || navigator.platform.includes('iPhone') ? '^' : 'Ctrl';
            const metaKeyName = navigator.platform.includes('Mac') || navigator.platform.includes('iPhone') ? '⌘' : '⊞';
            const enterKeyName = navigator.platform.includes('Mac') || navigator.platform.includes('iPhone') ? 'return' : 'Enter';
            const deleteKeyName = navigator.platform.includes('Mac') || navigator.platform.includes('iPhone') ? '⌦' : 'Del';
            const backspaceKeyName = navigator.platform.includes('Mac') || navigator.platform.includes('iPhone') ? '⌫' : 'Backspace';
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
                    <span class="shortcut-key">⇧</span>
                    <span class="shortcut-key">R</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-description">${strings.general.history[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key">⇧</span>
                    <span class="shortcut-key">H</span>
                </div>
                <div class="shortcut-item" ${sideBarBtnTitle ? '' : 'style="display: none;"'}>
                    <span class="shortcut-description">${sideBarBtnTitle}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key">⇧</span>
                    <span class="shortcut-key">\\</span>
                </div>
                <div class="shortcut-item" ${shareBtn ? '' : 'style="display: none;"'}>
                    <span class="shortcut-description">${shareBtn?.getAttribute('title')}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key">⇧</span>
                    <span class="shortcut-key">S</span>
                </div>` : ''}
                <div class="shortcut-item" ${currentPage === 'lines_info.html' ? '' : 'style="display: none;"'}>
                    <span class="shortcut-description">${strings.lines_info.show_other_line[lang]}</span>
                    <span class="shortcut-key">⇧</span>
                    <span>${strings.lines_info.last_of_code[lang]}</span>
                </div>
                <div class="shortcut-item" ${searchBar.length > 0 || (sidebarSearchPanel && sidebarSearchPanel.style.display !== 'none' && sidebar.style.opacity > 0) ? '' : 'style="display: none;"'}>
                    <span class="shortcut-description">${searchBar.length > 0 ? strings.ticket_calculator.search[lang] : strings.ticket_calculator.input[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key">⇧</span>
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
                    <span class="shortcut-key">⇧</span>
                    <span class="shortcut-key">${enterKeyName}</span>
                </div>` : ''}
                <div class="shortcut-item" ${clearBtn.length>0 || searchBar.length>0 ? '' : 'style="display: none;"'}>
                    <span class="shortcut-description">${strings.ticket_calculator.clear_input[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key">${backspaceKeyName}</span>
                </div>
                ${currentPage === 'pov-frame.html' ? `
                <div class="shortcut-item">
                    <span class="shortcut-description">上一张</span>
                    <span class="shortcut-key">⇧</span>
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
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key">⇧</span>
                    <span class="shortcut-key">F</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-description">${strings.ticket_calculator.show_[lang] + strings.ticket_calculator.direct[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key">⇧</span>
                    <span class="shortcut-key">D</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-description">${strings.ticket_calculator.show_[lang] + strings.ticket_calculator.cheaper[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key">⇧</span>
                    <span class="shortcut-key">C</span>
                </div>` : ''}
                <div class="shortcut-item" ${!['lines_info.html', 'trains_info.html'].includes(currentPage) ? 'style="display: none;"' : ''}>
                    <span class="shortcut-description">${strings.general.toggle_compact_mode[lang]}</span>
                    <span class="shortcut-key">${altKeyName}</span>
                    <span class="shortcut-key">⇧</span>
                    <span class="shortcut-key">M</span>
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
                        <span class="shortcut-key">⇧</span>
                    </div>`;
                    listParent.appendChild(listShortcut);
                    listShortcut.style.width = '-webkit-fill-available';
                    listShortcut.style.maxWidth = '-webkit-fill-available';
                    listShortcut.style.paddingTop = '12px';
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