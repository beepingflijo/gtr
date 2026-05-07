#!/bin/bash

echo "========================================"
echo "  重置管理员账户"
echo "========================================"
echo ""

# 检查users.json是否存在
if [ ! -f "data/users.json" ]; then
    echo "[提示] 用户数据文件不存在"
    echo "[操作] 直接启动服务器将自动创建admin账户"
    echo ""
    read -p "按回车键启动服务器..."
    npm start
    exit 0
fi

echo "[警告] 此操作将删除所有用户数据！"
echo ""
read -p "确定要继续吗？(y/n): " confirm

if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
    echo ""
    echo "[操作] 正在删除用户数据..."
    rm "data/users.json"
    echo "[成功] 用户数据已删除"
    echo ""
    echo "[提示] 启动服务器后将自动创建新的admin账户"
    echo "       用户名: admin"
    echo "       密码: admin123"
    echo ""
else
    echo "[取消] 操作已取消"
    exit 0
fi

echo "========================================"
echo "  启动服务器..."
echo "========================================"
echo ""

npm start
