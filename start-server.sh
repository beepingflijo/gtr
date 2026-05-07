#!/bin/bash

echo "========================================"
echo "  通运铁路信息 GTR Info - 服务器启动"
echo "========================================"
echo ""

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到Node.js，请先安装Node.js"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

echo "[信息] Node.js版本:"
node --version
echo ""

# 检查依赖是否已安装
if [ ! -d "node_modules" ]; then
    echo "[信息] 首次运行，正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[错误] 依赖安装失败"
        exit 1
    fi
    echo "[成功] 依赖安装完成"
    echo ""
fi

echo "[信息] 启动服务器..."
echo "[提示] 按 Ctrl+C 停止服务器"
echo ""

# 启动服务器
npm start
