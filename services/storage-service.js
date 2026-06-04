// storage-service.js - 临时存储服务
// 将计算后的 duration 数据和时刻表存储到独立的 JSON 文件

const fs = require('fs');
const path = require('path');
const eventBus = require('./event-bus');

const CACHE_DIR = path.join(__dirname, '..', 'data', 'cache');
const DURATIONS_FILE = path.join(CACHE_DIR, 'calculated_durations.json');
const TIMETABLE_FILE = path.join(CACHE_DIR, 'timetable.json');

// 确保缓存目录存在
function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        console.log('[StorageService] 创建缓存目录:', CACHE_DIR);
    }
}

// 读取 JSON 文件
function readJsonFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`[StorageService] 读取文件失败 ${filePath}:`, error.message);
        return null;
    }
}

// 写入 JSON 文件
function writeJsonFile(filePath, data) {
    try {
        ensureCacheDir();
        const jsonData = JSON.stringify(data, null, 2);
        fs.writeFileSync(filePath, jsonData, 'utf8');
        return true;
    } catch (error) {
        console.error(`[StorageService] 写入文件失败 ${filePath}:`, error.message);
        return false;
    }
}

// 保存 duration 数据
function saveDurations(durationsData) {
    const data = {
        lastUpdated: new Date().toISOString(),
        durations: durationsData
    };
    
    const success = writeJsonFile(DURATIONS_FILE, data);
    if (success) {
        console.log('[StorageService] Duration 数据已保存');
        eventBus.publish('duration-data-saved', { timestamp: Date.now() });
    }
    return success;
}

// 读取 duration 数据
function loadDurations() {
    return readJsonFile(DURATIONS_FILE);
}

// 保存时刻表数据
function saveTimetable(timetableData) {
    const data = {
        lastUpdated: new Date().toISOString(),
        timetable: timetableData
    };
    
    const success = writeJsonFile(TIMETABLE_FILE, data);
    if (success) {
        console.log('[StorageService] 时刻表数据已保存');
        eventBus.publish('timetable-data-saved', { timestamp: Date.now() });
    }
    return success;
}

// 读取时刻表数据
function loadTimetable() {
    return readJsonFile(TIMETABLE_FILE);
}

// 清除缓存
function clearCache() {
    try {
        if (fs.existsSync(DURATIONS_FILE)) {
            fs.unlinkSync(DURATIONS_FILE);
        }
        if (fs.existsSync(TIMETABLE_FILE)) {
            fs.unlinkSync(TIMETABLE_FILE);
        }
        console.log('[StorageService] 缓存已清除');
        return true;
    } catch (error) {
        console.error('[StorageService] 清除缓存失败:', error.message);
        return false;
    }
}

// 获取存储状态
function getStatus() {
    return {
        cacheDir: CACHE_DIR,
        durationsFileExists: fs.existsSync(DURATIONS_FILE),
        timetableFileExists: fs.existsSync(TIMETABLE_FILE),
        durationsLastModified: fs.existsSync(DURATIONS_FILE) 
            ? fs.statSync(DURATIONS_FILE).mtime.toISOString() 
            : null,
        timetableLastModified: fs.existsSync(TIMETABLE_FILE) 
            ? fs.statSync(TIMETABLE_FILE).mtime.toISOString() 
            : null
    };
}

// 初始化
function init() {
    ensureCacheDir();
    console.log('[StorageService] 初始化完成');
}

module.exports = {
    init,
    saveDurations,
    loadDurations,
    saveTimetable,
    loadTimetable,
    clearCache,
    getStatus
};
