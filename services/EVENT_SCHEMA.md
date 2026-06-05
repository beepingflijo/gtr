# 时刻表服务事件驱动架构

## 事件列表 (Event Schema)

### 1. train-position-updated
**描述**: 列车位置数据更新事件
**触发时机**: 每3秒从API获取最新列车位置数据后
**Payload**:
```typescript
interface TrainPositionUpdatedPayload {
    trains: TrainData[];      // 列车数据数组
    count: number;            // 列车数量
    timestamp: number;        // 事件触发时间戳
}
```

### 2. duration-recalculated
**描述**: Duration重新计算完成事件
**触发时机**: 当有足够的列车位置数据进行duration计算时
**Payload**:
```typescript
interface DurationRecalculatedPayload {
    lineId: string;           // 线路ID
    segments: SegmentDuration[];  // 各轨道段的duration数据
    timestamp: number;        // 事件触发时间戳
}
```

### 3. timetable-generated
**描述**: 时刻表生成完成事件
**触发时机**: 每分钟自动触发，或手动请求时
**Payload**:
```typescript
interface TimetableGeneratedPayload {
    trainCount: number;       // 当前活跃列车数
    timestamp: number;        // 事件触发时间戳
}
```

### 4. data-sync-error
**描述**: 数据同步错误事件
**触发时机**: 获取列车数据失败时
**Payload**:
```typescript
interface DataSyncErrorPayload {
    error: Error;             // 错误对象
    source: string;           // 错误来源
    timestamp: number;        // 事件触发时间戳
}
```

### 5. duration-data-saved
**描述**: Duration数据保存完成事件
**触发时机**: 数据成功写入缓存文件后
**Payload**:
```typescript
interface DurationDataSavedPayload {
    timestamp: number;        // 事件触发时间戳
}
```

### 6. timetable-data-saved
**描述**: 时刻表数据保存完成事件
**触发时机**: 时刻表数据成功写入缓存文件后
**Payload**:
```typescript
interface TimetableDataSavedPayload {
    timestamp: number;        // 事件触发时间戳
}
```

### 7. segment-duration-updated
**描述**: 区间实际用时数据更新事件
**触发时机**: 列车经过某轨道段后，收集到新的实际用时样本时
**Payload**:
```typescript
interface SegmentDurationUpdatedPayload {
    lineId: string;           // 线路ID
    segmentIndex: number;     // 轨道段索引
    direction: number;        // 行驶方向（1=正向, -1=反向）
    duration: number;         // 本次收集的用时（秒）
    sampleCount: number;      // 该区间累计样本数
    timestamp: number;        // 事件触发时间戳
}
```

### 8. station-dwell-updated
**描述**: 站点停留时间数据更新事件
**触发时机**: 列车离开某站点后，收集到新的停留时间样本时
**Payload**:
```typescript
interface StationDwellUpdatedPayload {
    lineId: string;           // 线路ID
    stationCode: string;      // 站点代码
    direction: number;        // 行驶方向（1=正向, -1=反向）
    dwellTime: number;        // 本次收集的停留时间（秒）
    sampleCount: number;      // 该站点累计样本数
    timestamp: number;        // 事件触发时间戳
}
```

### 9. train-schedule-updated
**描述**: 列车完整时刻表更新事件
**触发时机**: 因位置更新或时间数据变化，重新推算了某线路所有列车的完整时刻表后
**Payload**:
```typescript
interface TrainScheduleUpdatedPayload {
    lineId: string;           // 线路ID
    scheduleCount: number;    // 更新的列车时刻表数量
    trainNames: string[];     // 更新的列车名称列表
    timestamp: number;        // 事件触发时间戳
}
```

## 服务模块

### 1. TrainPositionService (train-position-service.js)
- **职责**: 从API获取列车实时位置数据
- **发布事件**: `train-position-updated`, `data-sync-error`
- **订阅事件**: 无

### 2. DurationCalculator (duration-calculator.js)
- **职责**: 基于列车位置数据计算实际duration
- **发布事件**: 无
- **订阅事件**: `train-position-updated`

### 3. TimetableService (timetable-service.js)
- **职责**: 生成列车时刻表、导航用时，以及每辆列车到 UTC 24:00 的完整时刻表
- **发布事件**: `timetable-generated`, `train-schedule-updated`
- **订阅事件**: `train-position-updated`, `segment-duration-updated`, `station-dwell-updated`

### 4. SegmentDurationCollector (segment-duration-collector.js)
- **职责**: 收集列车实际区间用时和站点停留时间数据
- **发布事件**: `segment-duration-updated`, `station-dwell-updated`
- **订阅事件**: `train-position-updated`

### 5. StorageService (storage-service.js)
- **职责**: 管理临时存储（JSON缓存）
- **发布事件**: `duration-data-saved`, `timetable-data-saved`
- **订阅事件**: 无

### 6. EventBus (event-bus.js)
- **职责**: 事件总线，解耦各服务模块
- **功能**: 事件发布/订阅、日志记录

## API接口

### GET /api/timetable/recent-trips
获取最近班次信息
- **参数**: `start` (起点站代码), `end` (终点站代码), `lang` (语言，默认zh_hans)
- **响应**: 包含发车时间、预计到达时间、列车状态的班次列表

### GET /api/timetable/navigation
获取导航用时信息
- **参数**: `start` (起点站代码), `end` (终点站代码), `lang` (语言)
- **响应**: 包含总行程时间、各站点间行驶时间的详细信息

### GET /api/timetable/durations
获取计算后的duration数据
- **参数**: `lineId` (可选，线路ID)
- **响应**: 各线路各轨道段的duration数据

### GET /api/timetable/status
获取服务状态
- **响应**: 服务运行状态、数据更新时间等

### POST /api/timetable/save
手动保存数据到缓存
- **响应**: 保存结果

### POST /api/timetable/clear-cache
清除缓存数据
- **响应**: 清除结果

### GET /api/timetable/train-schedules
获取所有列车完整时刻表（每辆车到 UTC 24:00 前的到站时刻）
- **参数**: `lineId` (可选，按线路ID筛选)
- **响应**: 列车时刻表数组，包含每辆车经过每个站点的 arrivalTime、departureTime

### GET /api/timetable/train-schedule/:trainName
获取单辆列车的完整时刻表
- **参数**: `trainName` (列车名称，路径参数)
- **响应**: 单辆列车的完整时刻表数据

### GET /api/timetable/scheduled-trips
基于推算时刻表获取班次信息（含第二辆列车出发时刻）
- **参数**: `start` (起点站代码), `end` (终点站代码), `lang` (语言，默认 zh_hans)
- **响应**: 匹配的班次数组 + `nextTrips` 对象（每条线路+方向的第二辆车）

### POST /api/timetable/scheduled-multi-segment-trips
基于推算时刻表获取多段换乘班次信息（含第二辆列车）
- **Body**: `{ segments: [{ lineId, startCode, endCode }], lang }`
- **响应**: 每段的班次信息，每段附带 `nextTrip`（第二辆列车）
