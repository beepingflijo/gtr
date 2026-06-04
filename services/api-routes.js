// api-routes.js - API 路由
// 提供列车时刻表、导航用时等 API 接口

const express = require('express');
const router = express.Router();
const timetableService = require('./timetable-service');
const durationCalculator = require('./duration-calculator');
const storageService = require('./storage-service');
const trainPositionService = require('./train-position-service');
const segmentDurationCollector = require('./segment-duration-collector');

// 获取最近班次信息
// GET /api/timetable/recent-trips?start=XXX&end=XXX&lang=zh_hans
router.get('/recent-trips', (req, res) => {
    try {
        const { start, end, lang = 'zh_hans' } = req.query;
        
        if (!start || !end) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数: start, end'
            });
        }
        
        const result = timetableService.getRecentTrips(start, end, lang);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[API] 获取最近班次失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 获取导航用时信息
// GET /api/timetable/navigation?start=XXX&end=XXX&lang=zh_hans
router.get('/navigation', (req, res) => {
    try {
        const { start, end, lang = 'zh_hans' } = req.query;
        
        if (!start || !end) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数: start, end'
            });
        }
        
        const result = timetableService.getNavigationDuration(start, end, lang);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[API] 获取导航用时失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 获取计算后的 duration 数据
// GET /api/timetable/durations?lineId=XXX
router.get('/durations', (req, res) => {
    try {
        const { lineId } = req.query;
        const result = durationCalculator.getCalculatedDurations(lineId);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[API] 获取 duration 数据失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 获取服务状态
// GET /api/timetable/status
router.get('/status', (req, res) => {
    try {
        const trainStatus = trainPositionService.getStatus();
        const storageStatus = storageService.getStatus();
        const dataAvailable = timetableService.isDataAvailable();
        
        res.json({
            success: true,
            data: {
                trainPositionService: trainStatus,
                storage: storageStatus,
                dataAvailable,
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[API] 获取状态失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 手动触发 duration 数据保存
// POST /api/timetable/save
router.post('/save', (req, res) => {
    try {
        const durations = durationCalculator.getCalculatedDurations();
        const success = storageService.saveDurations(durations);
        
        res.json({
            success,
            message: success ? '数据保存成功' : '数据保存失败',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] 保存数据失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 清除缓存
// POST /api/timetable/clear-cache
router.post('/clear-cache', (req, res) => {
    try {
        const success = storageService.clearCache();
        durationCalculator.reset();
        
        res.json({
            success,
            message: success ? '缓存已清除' : '清除缓存失败',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] 清除缓存失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 获取区间实际用时数据
// GET /api/timetable/segment-durations?lineId=XXX&segmentIndex=0&direction=1
router.get('/segment-durations', (req, res) => {
    try {
        const { lineId, segmentIndex, direction } = req.query;
        
        if (lineId && segmentIndex !== undefined) {
            // 获取特定区间的用时
            const dir = direction ? parseInt(direction) : 1;
            const result = segmentDurationCollector.getSegmentDuration(
                lineId, 
                parseInt(segmentIndex), 
                dir
            );
            
            res.json({
                success: true,
                data: result || { duration: null, sampleCount: 0, isActual: false }
            });
        } else {
            // 获取所有区间的用时
            const result = segmentDurationCollector.getAllSegmentDurations();
            
            res.json({
                success: true,
                data: result
            });
        }
    } catch (error) {
        console.error('[API] 获取区间用时失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 获取区间收集服务状态
// GET /api/timetable/collector-status
router.get('/collector-status', (req, res) => {
    try {
        const status = segmentDurationCollector.getStatus();
        
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('[API] 获取收集服务状态失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 获取正在追踪的列车列表
// GET /api/timetable/tracked-trains
router.get('/tracked-trains', (req, res) => {
    try {
        const trains = segmentDurationCollector.getTrackedTrains();
        
        res.json({
            success: true,
            data: trains
        });
    } catch (error) {
        console.error('[API] 获取追踪列车列表失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 获取站点停留时间数据
// GET /api/timetable/station-dwell-times?lineId=XXX&stationCode=XXX&direction=1
router.get('/station-dwell-times', (req, res) => {
    try {
        const { lineId, stationCode, direction } = req.query;
        
        if (lineId && stationCode) {
            // 获取特定站点的停留时间
            const dir = direction ? parseInt(direction) : 1;
            const result = segmentDurationCollector.getStationDwellTime(
                lineId,
                stationCode,
                dir
            );
            
            res.json({
                success: true,
                data: result
            });
        } else {
            // 获取所有站点的停留时间
            const result = segmentDurationCollector.getAllStationDwellTimes();
            
            res.json({
                success: true,
                data: result
            });
        }
    } catch (error) {
        console.error('[API] 获取站点停留时间失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 获取多段换乘路线的班次信息
// POST /api/timetable/multi-segment-trips
// Body: { segments: [{ lineId, startCode, endCode }, ...], lang: 'zh_hans' }
router.post('/multi-segment-trips', (req, res) => {
    try {
        const { segments, lang = 'zh_hans' } = req.body;
        
        if (!segments || !Array.isArray(segments) || segments.length === 0) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数: segments（数组）'
            });
        }
        
        // 验证每个 segment 的格式
        for (const seg of segments) {
            if (!seg.lineId || !seg.startCode || !seg.endCode) {
                return res.status(400).json({
                    success: false,
                    error: '每个 segment 必须包含 lineId, startCode, endCode'
                });
            }
        }
        
        const result = timetableService.getMultiSegmentTrips(segments, lang);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[API] 获取多段换乘班次失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

module.exports = router;
