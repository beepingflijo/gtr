# 通运铁路信息 GTR Info

通运铁路信息(GTR Info)是一个虚构轨道交通信息系统网站，提供线路信息、列车实时位置（基于[Create Track Map](https://github.com/jenchanws/create-track-map) API）、票价计算等功能。

## 功能特点

### 线路信息 (Lines Info)
- 查看各条线路经停车站及区间距离、用时
- 实时显示列车位置和运行状态

### 列车信息 (Trains Info)
- 实时追踪列车位置
- 推算列车运行速度和预计到达时间
- 提供列车编组及车型

### 票价计算器 (Ticket Calculator)
- 计算任意两站间不同席位的票价
- 提供最优路径推荐（时间最短、换乘最少、价格最低三种模式）

### 偏好设置 (Preferences)
- 多语言支持（简体中文、繁体中文、英语、乌克兰语等）
- 提供主题模式、字体、减弱特效等选项
- 本地存储管理

### 界面风格
- 响应式设计，适配各种设备屏幕
- 使用 CSS3 动画、过渡、阴影、滤镜等效果，营造出类似玻璃和卵石构成的界面

## 技术实现

本项目采用纯前端技术实现：

- HTML5/CSS3/JavaScript
- 响应式设计，适配各种设备屏幕
- 使用 localStorage 进行本地数据存储

## 使用方法

1. 克隆或下载本项目
2. 在浏览器中打开 [index.html](index.html) 文件即可使用
3. 首次使用会默认跳转到线路信息页面

## 多语言支持

项目支持多种语言界面：
- 简体中文 (zh_hans)
- 繁体中文 (zh_hant)
- 英语 (en)
- 乌克兰语 (uk)

用户可以在偏好设置中切换界面语言。

## 目录结构

```
.
├── data/                 # 数据文件目录
│   ├── blocks.json       # 从CTM获取的闭塞区间数据（暂未使用）
│   ├── lines.json        # 线路数据（手动指定的停站、走向、用时等）
│   ├── network.json      # 从CTM获取的网络数据，提供车站位置
│   └── trains_info.json  # 列车信息数据（手动指定的线路、型号、限速等）
├── res/                  # 资源文件目录（图片等）
├── index.html            # 网站入口文件
├── lines_info.html       # 线路信息页面
├── lines_info.js         # 线路信息逻辑
├── lines_info.css        # 线路信息样式
├── trains_info.html      # 列车信息页面
├── trains_info.js        # 列车信息逻辑
├── trains_info.css       # 列车信息样式
├── ticket_calculator.html# 票价计算器页面
├── ticket_calculator.js  # 票价计算器逻辑
├── ticket_calculator.css # 票价计算器样式
├── preferences.html      # 偏好设置页面
├── preferences.js        # 偏好设置逻辑
├── preferences.css       # 偏好设置样式
├── style.css             # 全局样式
├── script.js             # 全局脚本
├── strings.json          # 多语言字符串资源
└── readme.md             # 说明文档
```

## 数据来源

本项目的数据文件位于 [data](data/) 目录中：
- [blocks.json](data/blocks.json) - 从CTM获取的闭塞区间数据（暂未使用）
- [lines.json](data/lines.json) - 线路数据（手动指定的停站、走向、用时等）
- [network.json](data/network.json) - 从CTM获取的网络数据，提供车站位置
- [trains_info.json](data/trains_info.json) - 列车信息数据（手动指定的线路、型号、限速等）

## 浏览器兼容性

项目支持现代主流浏览器：
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 开发与贡献

欢迎提交 Issue 和 Pull Request 来帮助改进本项目。

## 免责声明

本站提及的各类地名、组织名、品牌名均为虚构，部分代码使用AI生成，图标来自 [Icons8](https://icons8.com/)。