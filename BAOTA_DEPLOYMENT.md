# GTR项目宝塔面板部署指南 - 子路径(/gtr)配置

## 📋 问题说明

当项目需要映射到 `/gtr` 子路径时,需要正确配置Nginx反向代理,否则会出现以下问题:
- API请求404错误
- 注册成功后仍显示admin账户状态
- 静态资源加载失败

## ✅ 解决方案

### 第一步:修复前端代码(已完成)

已在 `auth.js` 中修复注册成功后不刷新页面的问题,确保新用户信息能正确显示。

### 第二步:配置Nginx反向代理

#### 1. 在宝塔面板创建网站

- 进入「网站」→「添加站点」
- 域名:填写你的域名或服务器IP
- 根目录:`/www/wwwroot/gtr-redesigned`(或其他目录)
- PHP版本:纯静态
- 点击「提交」

#### 2. 配置反向代理

进入网站设置 → 反向代理 → 添加反向代理:

**代理名称**: `gtr-api`  
**目标URL**: `http://127.0.0.1:3000`  
**发送域名**: `$host`  

然后点击「配置文件」按钮,手动编辑Nginx配置:

```nginx
location /gtr/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Prefix /gtr;
    
    # 重写响应中的Location头
    proxy_redirect ~^http://[^/]+/(.*)$ /gtr/$1;
}

# 直接访问根路径时重定向到/gtr
location = / {
    return 301 /gtr/;
}
```

**⚠️ 关键配置说明**:
- `proxy_pass http://127.0.0.1:3000/;` **末尾的 `/` 非常重要!**
- 这个 `/` 会让Nginx自动去掉请求URL中的 `/gtr` 前缀
- 例如:`/gtr/api/auth/login` → 转发为 `/api/auth/login`

#### 3. 重启Nginx

修改配置后,在宝塔面板点击「重载配置」或执行:
```bash
nginx -t && nginx -s reload
```

### 第三步:启动Node.js应用

使用PM2管理器启动应用:

```bash
cd /www/wwwroot/gtr-redesigned
pm2 start server.js --name "gtr-redesigned"
pm2 save
```

### 第四步:验证部署

1. **测试首页访问**:
   ```
   http://你的域名/gtr/
   ```

2. **测试API接口**:
   ```
   http://你的域名/gtr/api/health
   ```
   应该返回:
   ```json
   {
     "status": "ok",
     "timestamp": "2026-05-07T...",
     "version": "1.0.0"
   }
   ```

3. **测试注册功能**:
   - 访问 `http://你的域名/gtr/`
   - 点击登录 → 注册
   - 填写新用户信息
   - 注册成功后页面应自动刷新
   - 右上角应显示新用户名(不是admin)

## 🔧 常见问题排查

### 问题1: API返回404

**症状**: 注册/登录时提示网络错误或404

**原因**: Nginx配置不正确,`/gtr` 前缀没有被正确处理

**解决**: 
1. 检查 `proxy_pass` 末尾是否有 `/`
2. 查看Nginx错误日志:
   ```bash
   tail -f /www/wwwlogs/你的域名.error.log
   ```
3. 测试后端直接访问:
   ```bash
   curl http://127.0.0.1:3000/api/health
   ```

### 问题2: 注册后仍显示admin账户

**症状**: 注册新用户后,右上角仍显示"已登录: admin"

**原因**: 页面没有刷新,localStorage中的旧会话数据未更新

**解决**: 
- 已修复!现在注册成功后会自动刷新页面
- 如果仍有问题,手动清除浏览器缓存和localStorage:
  ```javascript
  // 在浏览器控制台执行
  localStorage.clear();
  location.reload();
  ```

### 问题3: 静态资源(CSS/JS)404

**症状**: 页面样式错乱,JavaScript不工作

**原因**: 静态资源路径不正确

**解决**: 
1. 检查HTML中的资源路径是否使用相对路径
2. 确保Nginx配置中包含静态文件处理:
   ```nginx
   location /gtr/ {
       # ... proxy配置 ...
   }
   
   # 如果需要直接访问某些静态文件
   location /gtr/assets/ {
       alias /www/wwwroot/gtr-redesigned/;
   }
   ```

### 问题4: AuthMe API连接失败

**症状**: 注册时提示AuthMe验证失败

**原因**: 服务器无法访问外网或AuthMe API地址变更

**解决**:
1. 测试服务器网络连接:
   ```bash
   curl https://api.hydcraft.cn/api/auth/login
   ```
2. 检查防火墙出站规则
3. 确认AuthMe API地址是否正确

## 📊 完整的Nginx配置示例

如果你的网站配置文件位于 `/www/server/panel/vhost/nginx/你的域名.conf`,完整配置应该是:

```nginx
server {
    listen 80;
    server_name 你的域名;
    
    root /www/wwwroot/gtr-redesigned;
    index index.html;
    
    # GTR应用反向代理
    location /gtr/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Prefix /gtr;
        
        proxy_redirect ~^http://[^/]+/(.*)$ /gtr/$1;
        
        # 超时设置
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
    
    # 根路径重定向到/gtr
    location = / {
        return 301 /gtr/;
    }
    
    # SSL配置(如果启用HTTPS)
    # listen 443 ssl;
    # ssl_certificate /path/to/cert.pem;
    # ssl_certificate_key /path/to/key.pem;
}
```

## 🎯 验证清单

部署完成后,请逐项检查:

- [ ] PM2进程正常运行 (`pm2 status`)
- [ ] Nginx配置无语法错误 (`nginx -t`)
- [ ] 可以通过 `http://域名/gtr/` 访问首页
- [ ] API接口正常 (`/gtr/api/health` 返回成功)
- [ ] 可以注册新用户
- [ ] 注册成功后页面自动刷新
- [ ] 右上角显示新用户名(不是admin)
- [ ] 可以正常登录新用户账户
- [ ] 静态资源(CSS/JS/图片)正常加载
- [ ] AuthMe验证功能正常

## 💡 优化建议

### 1. 启用HTTPS

在宝塔面板中为你的域名申请Let's Encrypt证书,并开启强制HTTPS。

### 2. 配置PM2开机自启

```bash
pm2 startup
pm2 save
```

### 3. 监控应用状态

```bash
# 查看实时日志
pm2 logs gtr-redesigned

# 查看应用详情
pm2 show gtr-redesigned

# 监控资源使用
pm2 monit
```

### 4. 环境变量配置

在PM2管理器中设置环境变量:
```
PORT=3000
JWT_SECRET=your-super-secret-key-change-this-in-production
NODE_ENV=production
```

---

**部署完成后,你的GTR项目应该可以通过 `http://你的域名/gtr/` 正常访问,并且注册功能会正确显示新用户信息!**

如有其他问题,请查看PM2和Nginx日志进行排查。