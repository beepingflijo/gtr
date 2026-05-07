# 管理员快速使用指南

## 🚀 快速开始

### 1. 启动服务器

**Windows用户：**
```bash
双击 start-server.bat
```

**Mac/Linux用户：**
```bash
chmod +x start-server.sh
./start-server.sh
```

或者手动执行：
```bash
npm install
npm start
```

### 2. 查看默认管理员账户

服务器启动后，终端会显示：
```
✅ 管理员账户创建成功！
   用户名: admin
   密码: admin123
   ⚠️  请立即修改默认密码！
```

### 3. 登录管理员账户

1. 打开浏览器访问：`http://localhost/preferences.html`
2. 点击"登录"按钮
3. 输入用户名：`admin`
4. 输入密码：`admin123`
5. 点击"登录"

### 4. 访问管理页面

登录后，在偏好设置页面底部会显示**"用户管理"**链接，点击即可进入管理页面。

或直接访问：`http://localhost:3000/admin.html`

## 📊 管理功能

### 查看用户列表
管理页面会显示：
- **统计卡片**：总用户数、管理员数量、已绑定邮箱数
- **用户表格**：用户名、邮箱、注册时间、最后登录时间
- **操作按钮**：重置密码、删除用户（admin账户不可删除）

### 删除用户
1. 在用户列表中找到要删除的用户
2. 点击"删除"按钮
3. 确认删除操作
4. ⚠️ 注意：此操作不可恢复！

### 重置密码
1. 在用户列表中找到需要重置密码的用户
2. 点击"重置密码"按钮
3. 输入新密码（至少6个字符）
4. 密码立即生效

## 🔒 安全建议

### 1. 修改默认密码
首次登录后，立即修改admin密码：
1. 在偏好设置页面找到"角色与通知"部分
2. 目前需要通过API修改，或使用管理页面的重置密码功能

### 2. 生产环境配置
在生产环境中：
```bash
# 设置强JWT密钥
export JWT_SECRET="your-super-secret-key-here"

# 启用HTTPS
# 配置Nginx反向代理或其他方式
```

### 3. 定期备份
定期备份 `data/users.json` 文件：
```bash
cp data/users.json data/users.json.backup
```

## 🛠️ API调用示例

### 获取所有用户
```bash
curl -X GET http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 删除用户
```bash
curl -X DELETE http://localhost:3000/api/admin/users/USER_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 重置密码
```bash
curl -X PUT http://localhost:3000/api/admin/users/USER_ID/reset-password \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newPassword": "newpassword123"}'
```

## ❓ 常见问题

### Q: 看不到"用户管理"链接？
A: 确保你使用的是admin账户登录，其他账户不会显示此链接。

### Q: 如何创建新的管理员？
A: 目前只支持一个admin账户。如需多管理员，可以修改server.js中的权限验证逻辑。

### Q: 误删了admin账户怎么办？
A: 删除 `data/users.json` 文件，重启服务器会重新创建admin账户。

### Q: 管理页面加载失败？
A: 
1. 确认后端服务器正在运行
2. 检查浏览器控制台是否有错误
3. 确认使用的是admin账户登录

## 📝 用户数据位置

所有用户数据存储在：`data/users.json`

文件格式：
```json
[
  {
    "id": "admin-1234567890",
    "username": "admin",
    "password": "$2a$10$...",  // bcrypt加密
    "email": "admin@gtr.local",
    "createdAt": "2026-05-06T10:00:00.000Z",
    "lastLogin": "2026-05-06T10:30:00.000Z"
  }
]
```

⚠️ **警告**：不要手动编辑此文件，除非你知道自己在做什么！

---

**最后更新**: 2026-05-06
**版本**: 1.0.0
