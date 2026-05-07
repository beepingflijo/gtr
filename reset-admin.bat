@echo off
chcp 65001 >nul
echo ========================================
echo   重置管理员账户
echo ========================================
echo.

REM 检查users.json是否存在
if not exist "data\users.json" (
    echo [提示] 用户数据文件不存在
    echo [操作] 直接启动服务器将自动创建admin账户
    echo.
    pause
    goto :start_server
)

echo [警告] 此操作将删除所有用户数据！
echo.
set /p confirm="确定要继续吗？(y/n): "

if /i "%confirm%"=="y" (
    echo.
    echo [操作] 正在删除用户数据...
    del "data\users.json"
    echo [成功] 用户数据已删除
    echo.
    echo [提示] 启动服务器后将自动创建新的admin账户
    echo       用户名: admin
    echo       密码: admin123
    echo.
) else (
    echo [取消] 操作已取消
    pause
    exit /b 0
)

:start_server
echo ========================================
echo   启动服务器...
echo ========================================
echo.

call npm start

pause
