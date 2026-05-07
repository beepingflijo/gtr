# AuthMe账户绑定功能实现

## 📋 功能概述

在用户注册过程中，增加了可选的AuthMe账户验证和绑定功能。用户可以输入他们的AuthMe用户名和密码进行验证，验证成功后会将AuthMe账户信息绑定到GTR系统账户。

## 🔧 技术实现

### 1. 后端API（server.js）

#### AuthMe验证函数
```javascript
async function verifyAuthMeAccount(authmeUsername, authmePassword)
```

**功能**：
- 向 `https://api.hydcraft.cn/api/auth/login` 发送POST请求
- 使用指定的请求格式验证AuthMe账户
- 返回验证结果和用户信息

**请求格式**：
```json
{
    "mode": "AUTHME",
    "authmeId": "username",
    "password": "password",
    "rememberMe": true
}
```

#### 注册接口增强
```javascript
app.post('/api/auth/register', async (req, res) => {
    // ... 基本验证
    
    // 如果提供了AuthMe凭据，先验证
    if (authmeUsername && authmePassword) {
        const result = await verifyAuthMeAccount(authmeUsername, authmePassword);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message,
                errorCode: result.errorCode,
                requiresAuthMeVerification: true
            });
        }
    }
    
    // 创建用户时保存AuthMe绑定信息
    const newUser = {
        // ...
        authmeBound: !!authmeVerificationResult,
        authmeUsername: authmeVerificationResult?.authmeUsername || null,
        authmeDisplayName: authmeVerificationResult?.displayName || null,
        authmeAvatarUrl: authmeVerificationResult?.avatarUrl || null,
        // ...
    };
});
```

### 2. 前端界面（auth.js）

#### 注册对话框增强
添加了AuthMe验证选项：
- ✅ 复选框："验证并绑定AuthMe账户（可选）"
- 📝 AuthMe用户名输入框
- 🔐 AuthMe密码输入框
- 💡 默认隐藏，勾选后显示

#### 交互逻辑
1. 用户勾选"验证并绑定AuthMe账户"
2. 显示AuthMe用户名和密码输入框
3. 提交时如果启用了AuthMe验证：
   - 验证AuthMe字段是否填写
   - 将AuthMe凭据发送到后端
   - 后端调用HydCraft API验证
   - 验证失败则阻止注册并显示错误
   - 验证成功则继续注册并绑定信息

### 3. 多语言支持（strings.json）

新增字符串：
- `authme_username`: "AuthMe用户名"
- `authme_password`: "AuthMe密码"
- `verify_authme`: "验证并绑定AuthMe账户（可选）"
- `verifying_authme`: "验证中..."
- `authme_verification_success`: "AuthMe验证成功"
- `authme_verification_failed`: "AuthMe验证失败"
- `authme_account_not_found`: "AuthMe账号不存在，请确认后再试"

## 📊 数据流程

```
用户填写注册表单
    ↓
勾选AuthMe验证（可选）
    ↓
输入AuthMe用户名和密码
    ↓
点击"注册"按钮
    ↓
前端验证基本字段
    ↓
发送注册请求（包含AuthMe凭据）
    ↓
后端接收请求
    ↓
验证基本字段
    ↓
如果提供AuthMe凭据：
    ├─ 调用HydCraft API验证
    ├─ 验证失败 → 返回错误，阻止注册
    └─ 验证成功 → 提取用户信息
    ↓
创建GTR账户
    ↓
保存AuthMe绑定信息
    ↓
生成JWT Token
    ↓
返回成功响应
    ↓
前端保存会话
    ↓
自动登录
```

## 🔍 响应处理

### AuthMe验证失败响应
```json
{
    "code": 400,
    "message": "AuthMe 账号不存在，请确认后再试",
    "timestamp": 1778044604,
    "data": {
        "code": "AUTHME_ACCOUNT_NOT_FOUND"
    }
}
```

**前端处理**：
- 显示错误消息
- 阻止注册流程
- 允许用户修正AuthMe凭据

### AuthMe验证成功响应
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "tokens": { ... },
        "user": {
            "email": "...@qq.com",
            "profile": {
                "displayName": "...",
                ...
            },
            "authmeBindings": [
                {
                    "authmeUsername": "...",
                    "authmeRealname": "...",
                    ...
                }
            ],
            "avatarUrl": "..."
        }
    }
}
```

**后端处理**：
- 提取AuthMe用户名
- 提取显示名称
- 提取邮箱（如果GTR未提供）
- 提取头像URL
- 保存到GTR用户记录

## 🎨 UI特性

### 视觉设计
- AuthMe部分用分隔线与基本字段区分
- 复选框控制字段显示/隐藏
- 平滑过渡动画
- 与整体设计风格一致

### 用户体验
- 可选功能，不影响基本注册流程
- 清晰的标签和提示
- 实时验证反馈
- 友好的错误提示

## 🔒 安全考虑

1. **密码传输**
   - AuthMe密码通过HTTPS传输
   - 不在前端存储AuthMe密码
   - 仅用于一次性验证

2. **数据保护**
   - AuthMe绑定信息存储在服务器端
   - 不暴露完整的AuthMe响应给前端
   - 仅保存必要的绑定信息

3. **验证时机**
   - 在后端进行AuthMe验证
   - 防止前端绕过验证
   - 确保数据一致性

## 📝 用户数据存储

### 用户记录结构
```json
{
    "id": "1234567890",
    "username": "gtruser",
    "password": "$2a$10$...",
    "email": "user@example.com",
    "authmeBound": true,
    "authmeUsername": "minecraft_user",
    "authmeDisplayName": "Display Name",
    "authmeAvatarUrl": "https://...",
    "createdAt": "2026-05-06T...",
    "lastLogin": null
}
```

### 字段说明
- `authmeBound`: 布尔值，表示是否绑定了AuthMe账户
- `authmeUsername`: AuthMe用户名
- `authmeDisplayName`: AuthMe显示名称
- `authmeAvatarUrl`: AuthMe头像URL

## 🧪 测试步骤

### 1. 测试不带AuthMe的注册
1. 访问偏好设置页面
2. 点击"登录" → "注册"
3. 填写用户名、密码
4. **不勾选**AuthMe验证
5. 点击注册
6. ✅ 应该成功注册，`authmeBound`为false

### 2. 测试带AuthMe的注册（成功）
1. 点击"注册"
2. 填写GTR用户名、密码
3. **勾选**"验证并绑定AuthMe账户"
4. 输入有效的AuthMe用户名和密码
5. 点击注册
6. ✅ 应该成功注册，`authmeBound`为true，保存AuthMe信息

### 3. 测试AuthMe验证失败
1. 点击"注册"
2. 填写GTR用户名、密码
3. **勾选**AuthMe验证
4. 输入**错误**的AuthMe凭据
5. 点击注册
6. ❌ 应该显示错误："AuthMe账号不存在，请确认后再试"
7. 注册被阻止，可以修正后重试

### 4. 测试部分填写AuthMe字段
1. 点击"注册"
2. 勾选AuthMe验证
3. 只填写AuthMe用户名，不填密码
4. 点击注册
5. ❌ 应该显示错误，要求填写完整

## 🐛 常见问题

### Q: AuthMe验证失败但可以继续注册吗？
A: 不可以。如果启用了AuthMe验证但验证失败，注册会被阻止。用户必须：
- 取消AuthMe验证选项，或
- 修正AuthMe凭据后重新尝试

### Q: AuthMe验证是必须的吗？
A: 不是。AuthMe验证是完全可选的：
- 不勾选复选框即可跳过
- 不影响基本注册流程
- 适合没有AuthMe账户的用户

### Q: 绑定的AuthMe信息有什么用？
A: 目前主要用于：
- 显示用户的Minecraft身份
- 未来可能用于游戏内集成
- 关联HydCraft生态系统

### Q: 可以修改已绑定的AuthMe账户吗？
A: 当前版本不支持。如需更改：
1. 联系管理员删除账户
2. 重新注册并绑定新的AuthMe账户

### Q: AuthMe密码会保存吗？
A: 不会。AuthMe密码：
- 仅用于一次性验证
- 不存储在GTR系统中
- 验证完成后立即丢弃

## 🚀 未来改进

1. **AuthMe解绑功能**
   - 允许用户解除AuthMe绑定
   - 在偏好设置中添加管理入口

2. **AuthMe信息同步**
   - 定期同步AuthMe头像和显示名
   - 保持信息最新

3. **批量AuthMe验证**
   - 支持导入现有AuthMe账户
   - 自动匹配和绑定

4. **AuthMe登录**
   - 支持直接使用AuthMe账户登录GTR
   - 简化登录流程

5. **双因素认证**
   - 结合AuthMe和GTR账户
   - 提高安全性

---

**实现时间**: 2026-05-06  
**API端点**: https://api.hydcraft.cn/api/auth/login  
**版本**: 1.0.0
