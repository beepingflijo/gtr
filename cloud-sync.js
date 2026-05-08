// ==================== Cloud Sync Module ====================

const CloudSync = (function() {
    const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000/api'
        : '/gtr/api';

    let _isSyncing = false;
    let _pushTimer = null;
    let _lastPulledData = { preferences: null, visitedPages: null, pov_progress: null };
    const PUSH_DEBOUNCE_MS = 2000;

    // Helper: get auth token from session
    function _getToken() {
        try {
            const session = localStorage.getItem('userSession');
            if (session) {
                const parsed = JSON.parse(session);
                return parsed.token || null;
            }
        } catch (e) {}
        return null;
    }

    // Helper: authenticated fetch
    async function _authFetch(url, options = {}) {
        const token = _getToken();
        if (!token) return null;
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        headers['Authorization'] = 'Bearer ' + token;
        const response = await fetch(url, { ...options, headers });
        return response.json();
    }

    // Synchronous XHR pull - runs immediately at script load time
    // so localStorage is updated BEFORE any other script reads it
    function pullCloudDataSync() {
        const token = _getToken();
        if (!token) return;

        try {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', API_BASE_URL + '/user/data', false);
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send();

            if (xhr.status !== 200) {
                console.warn('[CloudSync] Sync pull failed, status:', xhr.status);
                return;
            }

            const result = JSON.parse(xhr.responseText);
            if (!result || !result.success || !result.data) {
                console.log('[CloudSync] No cloud data available');
                return;
            }

            _applyPulledData(result.data);
        } catch (error) {
            console.warn('[CloudSync] Sync pull error:', error);
        }
    }

    // Pull cloud data and merge into local
    async function pullCloudData() {
        if (_isSyncing) return;
        const token = _getToken();
        if (!token) return;

        _isSyncing = true;
        try {
            console.log('[CloudSync] Pulling cloud data...');
            const result = await _authFetch(API_BASE_URL + '/user/data');
            if (!result || !result.success || !result.data) {
                console.log('[CloudSync] No cloud data available');
                return;
            }

            const cloudData = result.data;

            _applyPulledData(cloudData);
        } catch (error) {
            console.error('[CloudSync] Pull failed:', error);
            _updateSyncUI('error');
        } finally {
            _isSyncing = false;
        }
    }

    // Merge two visitedPages arrays: union by page+params, keep latest timestamp
    function _mergeVisitedPages(localPages, cloudPages) {
        const map = {};
        // Add all cloud entries first
        for (const item of cloudPages) {
            if (!item || !item.page) continue;
            const key = (item.page || '') + '_' + (item.params || '');
            map[key] = item;
        }
        // Override/merge with local entries (local may be newer)
        for (const item of localPages) {
            if (!item || !item.page) continue;
            const key = (item.page || '') + '_' + (item.params || '');
            if (!map[key] || item.timestamp > map[key].timestamp) {
                map[key] = item;
            }
        }
        return Object.values(map).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
    // Apply pulled cloud data into localStorage
    function _applyPulledData(cloudData) {
        if (cloudData.preferences) {
            _lastPulledData.preferences = JSON.parse(JSON.stringify(cloudData.preferences));
            localStorage.setItem('preferences', JSON.stringify(cloudData.preferences));
            console.log('[CloudSync] Preferences synced from cloud');
        }

        if (cloudData.visitedPages && Array.isArray(cloudData.visitedPages)) {
            _lastPulledData.visitedPages = JSON.parse(JSON.stringify(cloudData.visitedPages));
            const localPages = _getLocalVisitedPages();
            const merged = _mergeVisitedPages(localPages, cloudData.visitedPages);
            localStorage.setItem('visitedPages', JSON.stringify(merged));
            console.log('[CloudSync] VisitedPages merged, total:', merged.length);
        }

        if (cloudData.pov_progress) {
            _lastPulledData.pov_progress = JSON.parse(JSON.stringify(cloudData.pov_progress));
            localStorage.setItem('pov_progress', JSON.stringify(cloudData.pov_progress));
            console.log('[CloudSync] POV progress synced from cloud');
        }

        console.log('[CloudSync] Pull complete, lastSync:', cloudData.lastSync);
        _updateSyncUI('synced', cloudData.lastSync);

        if (typeof initStorageList === 'function') {
            try { initStorageList(); } catch(e) {}
        }
    }

    // Get local visitedPages safely
    function _getLocalVisitedPages() {
        try {
            const data = localStorage.getItem('visitedPages');
            if (data) {
                const parsed = JSON.parse(data);
                return Array.isArray(parsed) ? parsed : [];
            }
        } catch (e) {}
        return [];
    }

    // Push local data to cloud (debounced)
    function pushCloudData() {
        if (_pushTimer) clearTimeout(_pushTimer);
        _pushTimer = setTimeout(_doPush, PUSH_DEBOUNCE_MS);
    }

    async function _doPush() {
        if (_isSyncing) return;
        const token = _getToken();
        if (!token) return;

        _isSyncing = true;
        _updateSyncUI('syncing');

        try {
            // Read local data
            let preferences = null;
            try {
                const p = localStorage.getItem('preferences');
                if (p) preferences = JSON.parse(p);
            } catch (e) {}

            // For visitedPages, merge local with cloud-stored version (ignore history limit)
            const localPages = _getLocalVisitedPages();
            const cloudPages = _lastPulledData.visitedPages || [];
            const mergedPages = _mergeVisitedPages(localPages, cloudPages);

            let pov_progress = null;
            try {
                const pp = localStorage.getItem('pov_progress');
                if (pp) pov_progress = JSON.parse(pp);
            } catch (e) {}

            const payload = {};
            if (preferences !== null) payload.preferences = preferences;
            if (mergedPages.length > 0) payload.visitedPages = mergedPages;
            if (pov_progress !== null) payload.pov_progress = pov_progress;

            if (Object.keys(payload).length === 0) return;

            // Update local cache of what we've pushed
            if (preferences) _lastPulledData.preferences = JSON.parse(JSON.stringify(preferences));
            if (mergedPages.length > 0) _lastPulledData.visitedPages = JSON.parse(JSON.stringify(mergedPages));
            if (pov_progress) _lastPulledData.pov_progress = JSON.parse(JSON.stringify(pov_progress));

            console.log('[CloudSync] Pushing data to cloud...');
            const result = await _authFetch(API_BASE_URL + '/user/data', {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            if (result && result.success) {
                console.log('[CloudSync] Push successful, lastSync:', result.data?.lastSync);
                _updateSyncUI('synced', result.data?.lastSync);
            } else {
                console.error('[CloudSync] Push failed:', result);
                _updateSyncUI('error');
            }
        } catch (error) {
            console.error('[CloudSync] Push error:', error);
            _updateSyncUI('error');
        } finally {
            _isSyncing = false;
        }
    }

    // Update sync status UI element
    function _updateSyncUI(status, lastSync) {
        const el = document.getElementById('cloudSyncStatus');
        if (!el) return;

        const strings = window.strings;
        const lang = window.lang || 'zh_hans';

        if (status === 'syncing') {
            el.textContent = (strings?.preferences?.auto_sync?.[lang]) || '同步中...';
            el.style.color = 'var(--color-primary)';
        } else if (status === 'synced') {
            const syncText = (strings?.preferences?.auto_sync_success?.[lang]) || '已同步';
            if (lastSync) {
                const time = new Date(lastSync);
                const timeStr = time.toLocaleTimeString();
                el.textContent = syncText + ' ' + timeStr;
            } else {
                el.textContent = syncText;
            }
            el.style.color = '';
        } else if (status === 'error') {
            el.textContent = (strings?.preferences?.sync_error?.[lang]) || '同步失败';
            el.style.color = 'crimson';
        }
    }

    // Check if user is logged in
    function _isLoggedIn() {
        try {
            const session = localStorage.getItem('userSession');
            if (session) {
                const parsed = JSON.parse(session);
                return !!(parsed && parsed.token);
            }
        } catch (e) {}
        return false;
    }

    // Initialize: pull on page load if logged in
    function init() {
        if (_isLoggedIn()) {
            // Pull cloud data on page load
            pullCloudData();
        }
    }

    return {
        pullCloudDataSync: pullCloudDataSync,
        pullCloudData: pullCloudData,
        pushCloudData: pushCloudData,
        isLoggedIn: _isLoggedIn
    };
})();

// ===== Immediate sync pull on script load =====
// Uses synchronous XHR so localStorage is updated BEFORE other scripts read it
CloudSync.pullCloudDataSync();