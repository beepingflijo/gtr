// timetable-config.js - 时刻表服务配置
// 集中管理所有可配置参数，便于统一修改和维护

const config = {
    // 时间分割点配置
    // 当日定义：从北京时间早上8:00开始到次日早上8:00
    // 注意：北京时间8:00 = UTC 0:00，所有时间计算均基于UTC
    dayBoundary: {
        hour: 8,        // 北京时间早上8点
        minute: 0,
        second: 0,
        // 北京时间偏移量（UTC+8）
        timezoneOffset: 8 * 60 * 60 * 1000,
        // 对应的UTC小时（北京时间8:00 = UTC 0:00）
        utcHour: 0
    },

    // 站点停留时间配置
    dwellTime: {
        default: 30,    // 默认停留时间（秒）
        min: 5,         // 最小有效停留时间（秒）
        max: 300        // 最大有效停留时间（秒）
    },

    // 区间用时配置
    segmentDuration: {
        minValid: 5,    // 最小有效用时（秒）
        maxValid: 600,  // 最大有效用时（秒）
        maxSamples: 50, // 每个区间最多存储的样本数
        dataTTL: 24 * 60 * 60 * 1000 // 数据有效期（24小时）
    },

    // 时刻表推算配置
    schedule: {
        // 推算时间范围：从当前时间到下一个时间分割点
        maxForecastHours: 24, // 最大推算时间（小时）
        recalcDebounceMs: 5000 // 线路时刻表重算防抖时间（毫秒）
    },

    // 站点检测配置
    stationDetection: {
        radius: 150 // 站点检测半径（米）
    },

    // 日志配置
    logging: {
        enabled: true,
        level: 'info', // 'debug', 'info', 'warn', 'error'
        logDataUpdates: true,
        logScheduleGeneration: true
    }
};

/**
 * 获取北京时间（用于显示）
 * 返回的Date对象在使用 toLocaleString('zh-CN', {timeZone:'Asia/Shanghai'}) 时正确显示北京时间
 */
function getBeijingTime(date = new Date()) {
    // 直接使用 Intl 获取北京时间各分量，构造一个等效的 Date 对象
    // 这样避免了 getTimezoneOffset 的环境依赖问题
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(date);

    const get = (type) => parseInt(parts.find(p => p.type === type).value);
    // 构造一个 UTC 表示的"北京时间"Date（其 UTC 分量等于北京时间分量）
    return new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')));
}

/**
 * 获取当日时间分割点（北京时间早上8:00 = UTC 0:00）
 * 直接基于UTC计算，不依赖本地时区
 */
function getDayBoundary(date = new Date()) {
    const utcBoundaryHour = config.dayBoundary.utcHour; // 0

    // 创建今日UTC 0:00
    const boundary = new Date(date);
    boundary.setUTCHours(utcBoundaryHour, config.dayBoundary.minute, config.dayBoundary.second, 0);

    // 如果当前时间已超过今日UTC 0:00，则返回明日UTC 0:00
    if (date >= boundary) {
        boundary.setUTCDate(boundary.getUTCDate() + 1);
    }

    return boundary;
}

/**
 * 获取当前时间段的起始时间（上一个时间分割点）
 */
function getCurrentPeriodStart(date = new Date()) {
    const utcBoundaryHour = config.dayBoundary.utcHour; // 0

    // 创建今日UTC 0:00
    const todayBoundary = new Date(date);
    todayBoundary.setUTCHours(utcBoundaryHour, config.dayBoundary.minute, config.dayBoundary.second, 0);

    // 如果当前时间已超过今日UTC 0:00，则起始时间是今日UTC 0:00
    // 否则是昨日UTC 0:00
    if (date >= todayBoundary) {
        return todayBoundary;
    } else {
        todayBoundary.setUTCDate(todayBoundary.getUTCDate() - 1);
        return todayBoundary;
    }
}

/**
 * 检查时间是否在当前时间段内
 */
function isInCurrentPeriod(date, referenceDate = new Date()) {
    const periodStart = getCurrentPeriodStart(referenceDate);
    const periodEnd = getDayBoundary(referenceDate);

    const dateTime = new Date(date).getTime();
    return dateTime >= periodStart.getTime() && dateTime < periodEnd.getTime();
}

/**
 * 获取时间段描述（用于日志）
 */
function getPeriodDescription(date = new Date()) {
    const periodStart = getCurrentPeriodStart(date);
    const periodEnd = getDayBoundary(date);

    const startStr = periodStart.toISOString();
    const endStr = periodEnd.toISOString();

    return `${startStr} - ${endStr} (北京时间${config.dayBoundary.hour}:00分割)`;
}

module.exports = {
    config,
    getBeijingTime,
    getDayBoundary,
    getCurrentPeriodStart,
    isInCurrentPeriod,
    getPeriodDescription
};
