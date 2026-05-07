# 通运铁路信息 GTR Info - 用户认证系统

## 📋 概述

本项目现已集成完整的用户认证系统，支持用户注册、登录、登出和密码修改功能。

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动后端服务器

```bash
# 生产模式
npm start

# 开发模式（自动重启）
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

### 3. 访问前端页面

在浏览器中打开 `preferences.html`，点击"登录"按钮即可使用认证功能。

## 🔐 功能特性

### 用户注册
- 用户名：3-20个字符
- 密码：至少6个字符
- 邮箱：可选
- 密码确认验证

### 用户登录
- 用户名/密码认证
- JWT Token会话管理
- Token有效期7天
- 自动登录支持

### 用户登出
- 安全清除本地会话
- 服务端Token注销

### 密码修改
- 验证当前密码
- 新密码强度要求
- 即时生效

### 👑 管理员功能
- **查看用户列表**：查看所有注册用户信息
- **删除用户**：移除指定用户账户（不能删除admin）
- **重置密码**：为任意用户重置密码
- **统计数据**：显示总用户数、管理员数量、邮箱绑定情况

#### 默认管理员账户
- 用户名：`admin`
- 密码：`admin123`
- ⚠️ **重要**：首次启动服务器后会自动创建此账户，请立即修改密码！

#### 访问管理页面
1. 使用admin账户登录
2. 在偏好设置页面会显示"用户管理"链接
3. 或直接访问：`http://localhost:3000/admin.html`

## 📁 文件结构

```
gtr-redesigned/
├── server.js              # 后端API服务器
├── auth.js                # 前端认证模块
├── preferences.js         # 偏好设置页面（集成登录UI）
├── preferences.html       # 偏好设置页面HTML
├── package.json           # Node.js依赖配置
└── data/
    └── users.json         # 用户数据存储（自动生成）
```

## 🔧 API接口

### 用户注册
```
POST /api/auth/register
Body: { username, password, email? }
Response: { success, message, data: { user, token } }
```

### 用户登录
```
POST /api/auth/login
Body: { username, password }
Response: { success, message, data: { user, token } }
```

### 获取当前用户
```
GET /api/auth/me
Headers: { Authorization: Bearer <token> }
Response: { success, data: { user } }
```

### 用户登出
```
POST /api/auth/logout
Headers: { Authorization: Bearer <token> }
Response: { success, message }
```

### 修改密码
```
PUT /api/auth/password
Headers: { Authorization: Bearer <token> }
Body: { currentPassword, newPassword }
Response: { success, message }
```

### 获取所有用户（管理员）
```
GET /api/admin/users
Headers: { Authorization: Bearer <admin-token> }
Response: { success, data: { users: [...], total: number } }
```

### 删除用户（管理员）
```
DELETE /api/admin/users/:userId
Headers: { Authorization: Bearer <admin-token> }
Response: { success, message }
```

### 重置用户密码（管理员）
```
PUT /api/admin/users/:userId/reset-password
Headers: { Authorization: Bearer <admin-token> }
Body: { newPassword }
Response: { success, message }
```

### 健康检查
```
GET /api/health
Response: { status, timestamp, version }
```

## 🔒 安全特性

1. **密码加密**：使用bcryptjs进行哈希存储
2. **JWT Token**：基于JSON Web Token的会话管理
3. **Token过期**：7天自动过期
4. **输入验证**：前后端双重验证
5. **CORS支持**：跨域请求保护
6. **HTTPS建议**：生产环境应启用HTTPS

## 💾 数据存储

用户数据存储在 `data/users.json` 文件中，格式如下：

```json
[
  {
    "id": "1234567890",
    "username": "testuser",
    "password": "$2a$10$...",  // bcrypt哈希
    "email": "test@example.com",
    "createdAt": "2026-05-06T10:00:00.000Z",
    "lastLogin": "2026-05-06T10:30:00.000Z"
  }
]
```

⚠️ **注意**：此文件包含敏感信息，不应提交到版本控制系统。

## 🌍 多语言支持

登录界面支持以下语言：
- 简体中文 (zh_hans)
- 繁体中文 (zh_hant)
- English (en)
- Українська (uk)

## 🛠️ 开发指南

### 环境变量

```bash
# 服务器端口（默认3000）
export PORT=3000

# JWT密钥（生产环境必须修改）
export JWT_SECRET="your-secret-key-here"
```

### 本地测试

1. 启动后端：`npm run dev`
2. 打开浏览器访问：`http://localhost/preferences.html`
3. 点击"登录"按钮测试注册/登录流程

### 生产部署

1. 设置强JWT密钥
2. 启用HTTPS
3. 配置防火墙规则
4. 定期备份用户数据
5. 监控服务器日志

## ⚠️ 注意事项

1. **首次使用**：需要先启动后端服务器才能使用登录功能
2. **数据持久化**：用户数据保存在本地文件系统
3. **安全性**：生产环境务必修改JWT_SECRET
4. **备份**：定期备份 `data/users.json` 文件
5. **网络**：前端会自动检测是否使用本地服务器

## 🐛 常见问题

### Q: 如何查看所有注册用户？
A: 
1. 使用admin账户登录（默认密码：admin123）
2. 在偏好设置页面点击"用户管理"链接
3. 或直接访问 http://localhost:3000/admin.html
4. 管理页面会显示所有用户的详细信息和操作按钮

### Q: 忘记了admin密码怎么办？
A: 删除 `data/users.json` 文件，重启服务器会自动重新创建admin账户（密码：admin123）。

### Q: 登录后刷新页面显示未登录？
A: 检查localStorage中是否有'userSession'，确认后端服务器正在运行。

### Q: 注册时提示用户名已存在？
A: 更换其他用户名，或联系管理员清除重复数据。

### Q: 无法连接到服务器？
A: 确认后端服务器已启动（`npm start`），检查端口3000是否被占用。

### Q: Token过期怎么办？
A: Token有效期7天，过期后需要重新登录。

## 📞 技术支持

如有问题，请查看：
- 浏览器控制台错误信息
- 服务器终端日志
- `data/users.json` 文件格式

---

**最后更新**: 2026-05-06
**版本**: 1.0.0
