const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'gtr-secret-key-2026-change-in-production';
const TOKEN_EXPIRY = '7d'; // Token有效期7天

// 用户数据文件路径
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const LOGIN_LOG_FILE = path.join(__dirname, 'data', 'login_log.json');

// AuthMe API配置
const AUTHME_API_URL = 'https://api.hydcraft.cn/api/auth/login';

// ==================== 初始化Admin账户 ====================
async function initializeAdmin() {
    ensureUsersFile();
    const users = readUsers();
    
    // 检查是否已存在admin账户
    const adminExists = users.find(u => u.username === 'admin');
    
    if (!adminExists) {
        console.log('\n🔧 正在创建默认管理员账户...');
        
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash('admin123', saltRounds);
        
        const adminUser = {
            id: 'admin-' + Date.now(),
            username: 'admin',
            password: hashedPassword,
            email: 'admin@gtr.local',
            createdAt: new Date().toISOString(),
            lastLogin: null
        };
        
        users.push(adminUser);
        saveUsers(users);
        
        console.log('✅ 管理员账户创建成功！');
        console.log('   用户名: admin');
        console.log('   密码: admin123');
        console.log('   ⚠️  请立即修改默认密码！\n');
    } else {
        console.log('✓ 管理员账户已存在');
        console.log('   提示: 如果你忘记了admin密码，可以删除 data/users.json 文件后重启服务器\n');
    }
}

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 确保用户数据文件存在
function ensureUsersFile() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify([]), 'utf8');
    }
}

// 读取用户数据
function readUsers() {
    ensureUsersFile();
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading users file:', error);
        return [];
    }
}

// 保存用户数据
function saveUsers(users) {
    ensureUsersFile();
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving users file:', error);
        throw new Error('Failed to save user data');
    }
}

// ==================== 登录日志 & 设备管理 ====================

function ensureLoginLogFile() {
    if (!fs.existsSync(LOGIN_LOG_FILE)) {
        fs.writeFileSync(LOGIN_LOG_FILE, JSON.stringify([]), 'utf8');
    }
}

function readLoginLog() {
    ensureLoginLogFile();
    try {
        const data = fs.readFileSync(LOGIN_LOG_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading login log:', error);
        return [];
    }
}

function saveLoginLog(logs) {
    ensureLoginLogFile();
    try {
        fs.writeFileSync(LOGIN_LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving login log:', error);
    }
}

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || req.ip || '';
}

function parseSubnet(ip) {
    const cleanIp = ip.replace(/^::ffff:/, '');
    const parts = cleanIp.split('.');
    if (parts.length === 4) {
        return parts.slice(0, 3).join('.');
    }
    return cleanIp;
}

function isSameLan(ip1, ip2) {
    const clean1 = ip1.replace(/^::ffff:/, '');
    const clean2 = ip2.replace(/^::ffff:/, '');
    if (clean1 === clean2) return true;
    return parseSubnet(clean1) === parseSubnet(clean2);
}

function generateDeviceId(req) {
    const ua = req.headers['user-agent'] || '';
    const ip = getClientIp(req);
    const raw = ua + '|' + ip;
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16);
}

function detectDeviceType(ua) {
    if (/mobile|android|iphone|ipad/i.test(ua)) return 'mobile';
    if (/tablet|ipad/i.test(ua)) return 'tablet';
    return 'desktop';
}

function detectBrowser(ua) {
    if (/edg\//i.test(ua)) return 'Edge';
    if (/chrome/i.test(ua) && !/edg/i.test(ua)) return 'Chrome';
    if (/firefox/i.test(ua)) return 'Firefox';
    if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
    if (/opera|opr\//i.test(ua)) return 'Opera';
    return 'Unknown';
}

function detectOS(ua) {
    if (/windows nt 10/i.test(ua)) return 'Windows 10/11';
    if (/windows/i.test(ua)) return 'Windows';
    if (/mac os x/i.test(ua)) return 'macOS';
    if (/android/i.test(ua)) return 'Android';
    if (/iphone|ipad/i.test(ua)) return 'iOS';
    if (/linux/i.test(ua)) return 'Linux';
    return 'Unknown';
}

function recordLoginEvent(userId, username, action, req) {
    const logs = readLoginLog();
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';
    const deviceId = generateDeviceId(req);
    const entry = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2),
        userId,
        username,
        action,
        ip,
        deviceId,
        deviceType: detectDeviceType(ua),
        browser: detectBrowser(ua),
        os: detectOS(ua),
        userAgent: ua,
        timestamp: new Date().toISOString()
    };
    logs.push(entry);
    if (logs.length > 5000) {
        logs.splice(0, logs.length - 5000);
    }
    saveLoginLog(logs);
    return entry;
}

function updateDeviceSession(userId, req, token) {
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) return;
    const ua = req.headers['user-agent'] || '';
    const ip = getClientIp(req);
    const deviceId = generateDeviceId(req);
    if (!users[userIndex].devices) {
        users[userIndex].devices = [];
    }
    const existing = users[userIndex].devices.find(d => d.deviceId === deviceId);
    if (existing) {
        existing.lastActive = new Date().toISOString();
        existing.ip = ip;
        existing.token = token;
    } else {
        users[userIndex].devices.push({
            deviceId,
            deviceType: detectDeviceType(ua),
            browser: detectBrowser(ua),
            os: detectOS(ua),
            ip,
            token,
            loginTime: new Date().toISOString(),
            lastActive: new Date().toISOString()
        });
    }
    saveUsers(users);
}

// 验证Token中间件
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.log('❌ Token验证失败：未提供token');
        return res.status(401).json({ 
            success: false, 
            message: 'Access token required' 
        });
    }

    console.log('🔍 收到Token验证请求');
    console.log('   - Token前20字符:', token.substring(0, 20) + '...');
    
    // 先解码token看看payload是什么
    try {
        const parts = token.split('.');
        if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            console.log('   - Token Payload (解码):', payload);
        }
    } catch(e) {
        console.log('   - Token解码失败:', e.message);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('❌ Token验证失败：', err.message);
            return res.status(403).json({ 
                success: false, 
                message: 'Invalid or expired token' 
            });
        }
        
        console.log('✅ JWT.verify 成功，解析结果:', {
            id: user.id,
            username: user.username,
            iat: user.iat,
            exp: user.exp
        });
        req.user = user;
        next();
    });
}

function requireVerified(req, res, next) {
    if (req.user.username === 'admin') return next();
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.verificationStatus === 'rejected') {
        return res.status(403).json({
            success: false,
            message: 'Your registration has been rejected',
            verificationStatus: 'rejected',
            errorCode: 'VERIFICATION_REJECTED'
        });
    }
    if (user.verificationStatus !== 'approved') {
        return res.status(403).json({
            success: false,
            message: 'Your account is pending admin review',
            verificationStatus: 'pending',
            errorCode: 'PENDING_REVIEW'
        });
    }
    next();
}

// ==================== API路由 ====================

// 验证AuthMe账户
async function verifyAuthMeAccount(authmeUsername, authmePassword) {
    try {
        const response = await fetch(AUTHME_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mode: 'AUTHME',
                authmeId: authmeUsername,
                password: authmePassword,
                rememberMe: true
            })
        });

        const data = await response.json();
        console.log('Authme API响应:', data);

        if (!response.ok || data.code !== 0) {
            return {
                success: false,
                message: data.message || 'AuthMe verification failed',
                errorCode: data.data?.code
            };
        }

        // 验证成功，返回用户信息
        return {
            success: true,
            authmeData: data.data,
            authmeUsername: data.data.user.authmeBindings?.find(b => b.authmeUsername === authmeUsername)?.authmeRealname || authmeUsername,
            authmeDisplayName: data.data.user.profile?.displayName || authmeUsername,
            email: data.data.user.email,
            authmeAvatarUrl: data.data.user.avatarUrl
        };
    } catch (error) {
        console.error('AuthMe verification error:', error);
        return {
            success: false,
            message: 'Network error during AuthMe verification',
            errorCode: 'NETWORK_ERROR'
        };
    }
}

// 用户注册
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, email, authmeUsername, authmePassword } = req.body;
        
        console.log('📝 收到注册请求:', {
            username,
            hasEmail: !!email,
            hasAuthme: !!(authmeUsername && authmePassword)
        });

        // 验证基本输入
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({
                success: false,
                message: 'Username must be between 3 and 20 characters'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        const { verificationNote } = req.body;
        const hasAuthme = !!(authmeUsername && authmePassword);
        let authmeVerificationResult = null;
        const users = readUsers();

        // 检查用户名是否已存在
        if (users.find(u => u.username === username)) {
            return res.status(409).json({
                success: false,
                message: 'Username already exists'
            });
        }

        if (hasAuthme) {
            // 路径A：提供AuthMe凭据
            authmeVerificationResult = await verifyAuthMeAccount(authmeUsername, authmePassword);
            
            if (!authmeVerificationResult.success) {
                return res.status(400).json({
                    success: false,
                    message: authmeVerificationResult.message,
                    errorCode: authmeVerificationResult.errorCode,
                    requiresAuthMeVerification: true
                });
            }

            const existingUserWithAuthme = users.find(u => u.authmeUsername === authmeUsername);
            if (existingUserWithAuthme) {
                return res.status(409).json({
                    success: false,
                    message: `This AuthMe account (${authmeUsername}) is already bound to another user`,
                    errorCode: 'AUTHME_ALREADY_BOUND'
                });
            }
        } else {
            // 路径B：无AuthMe凭据，需要提交审核说明
            if (!verificationNote || verificationNote.trim().length < 10) {
                return res.status(400).json({
                    success: false,
                    message: 'Application note is required (at least 10 characters)',
                    errorCode: 'VERIFICATION_NOTE_REQUIRED'
                });
            }
        }

        // 哈希密码
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const now = new Date().toISOString();
        const newUser = {
            id: Date.now().toString(),
            username,
            password: hashedPassword,
            email: email || authmeVerificationResult?.email || null,
            authmeBound: hasAuthme,
            authmeUsername: authmeVerificationResult?.authmeUsername || null,
            authmeDisplayName: authmeVerificationResult?.authmeDisplayName || null,
            authmeAvatarUrl: authmeVerificationResult?.authmeAvatarUrl || null,
            verificationStatus: hasAuthme ? 'approved' : 'pending',
            verificationNote: hasAuthme ? null : (verificationNote?.trim() || null),
            verificationAt: hasAuthme ? now : null,
            createdAt: now
        };

        console.log('✅ 新用户注册成功:', {
            id: newUser.id,
            username: newUser.username,
            authmeBound: newUser.authmeBound,
            authmeUsername: newUser.authmeUsername,
            authmeDisplayName: newUser.authmeDisplayName,
            verificationStatus: newUser.verificationStatus
        });

        users.push(newUser);
        saveUsers(users);

        if (!hasAuthme) {
            return res.status(201).json({
                success: true,
                message: 'Registration application submitted, pending admin review',
                pendingReview: true,
                data: {
                    user: {
                        id: newUser.id,
                        username: newUser.username,
                        email: newUser.email,
                        verificationStatus: 'pending'
                    }
                }
            });
        }

        const tokenPayload = { id: newUser.id, username: newUser.username };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

        recordLoginEvent(newUser.id, newUser.username, 'register', req);
        updateDeviceSession(newUser.id, req, token);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: {
                    id: newUser.id,
                    username: newUser.username,
                    email: newUser.email,
                    authmeBound: newUser.authmeBound || false,
                    authmeUsername: newUser.authmeUsername || null,
                    authmeDisplayName: newUser.authmeDisplayName || null,
                    authmeAvatarUrl: newUser.authmeAvatarUrl || null,
                    verificationStatus: newUser.verificationStatus
                },
                token
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('🔐 收到登录请求:', { username });

        // 验证输入
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        const users = readUsers();
        const user = users.find(u => u.username === username);

        if (!user) {
            console.log('❌ 登录失败：用户不存在', username);
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        // 验证密码
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log('❌ 登录失败：密码错误', username);
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        console.log('✅ 密码验证成功，用户:', {
            id: user.id,
            username: user.username
        });

        // 更新最后登录时间
        user.lastLogin = new Date().toISOString();
        saveUsers(users);

        // 生成Token
        const tokenPayload = { id: user.id, username: user.username };
        console.log('🔑 生成JWT Token，payload:', tokenPayload);
        
        const token = jwt.sign(
            tokenPayload,
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        recordLoginEvent(user.id, user.username, 'login', req);
        updateDeviceSession(user.id, req, token);

        console.log('✅ 登录成功，返回用户信息:', {
            id: user.id,
            username: user.username,
            authmeBound: user.authmeBound,
            tokenLength: token.length
        });

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    authmeBound: user.authmeBound || false,
                    authmeUsername: user.authmeUsername || null,
                    authmeDisplayName: user.authmeDisplayName || null,
                    authmeAvatarUrl: user.authmeAvatarUrl || null,
                    verificationStatus: user.verificationStatus || 'approved'
                },
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// 验证Token（获取当前用户信息）
app.get('/api/auth/me', authenticateToken, (req, res) => {
    console.log('📋 /api/auth/me 被调用');
    console.log('   - req.user (从JWT解析):', req.user);
    
    const users = readUsers();
    console.log('   - 正在查找用户ID:', req.user.id);
    
    const user = users.find(u => u.id === req.user.id);
    
    if (!user) {
        console.log('   - ❌ 用户未找到！');
        console.log('   - 所有用户ID列表:', users.map(u => ({ id: u.id, username: u.username })));
        
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }

    console.log('   - ✅ 找到用户:', user.username);

    res.json({
        success: true,
        data: {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                authmeBound: user.authmeBound || false,
                authmeUsername: user.authmeUsername || null,
                authmeDisplayName: user.authmeDisplayName || null,
                authmeAvatarUrl: user.authmeAvatarUrl || null,
                verificationStatus: user.verificationStatus || 'approved',
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            }
        }
    });
});

// 用户登出（客户端清除token，服务端可选：加入黑名单）
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    // 这里可以实现token黑名单机制
    // 目前只需客户端删除token即可
    res.json({
        success: true,
        message: 'Logout successful'
    });
});

// 修改密码
app.put('/api/auth/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters'
            });
        }

        const users = readUsers();
        const user = users.find(u => u.id === req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // 验证当前密码
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // 哈希新密码
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        user.password = hashedPassword;
        saveUsers(users);

        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// ==================== 管理员接口 ====================

// 获取所有用户列表（需要管理员权限）
app.get('/api/admin/users', authenticateToken, (req, res) => {
    // 简单管理员验证：检查用户名是否为admin
    if (req.user.username !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }

    const users = readUsers();
    
    // 移除密码字段，返回安全的用户信息
    const safeUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        authmeBound: user.authmeBound || false,
        authmeUsername: user.authmeUsername || null,
        authmeDisplayName: user.authmeDisplayName || null,
        authmeAvatarUrl: user.authmeAvatarUrl || null,
        verificationStatus: user.verificationStatus || 'approved',
        verificationNote: user.verificationNote || null,
        verificationAt: user.verificationAt || null,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
    }));

    res.json({
        success: true,
        data: {
            users: safeUsers,
            total: safeUsers.length
        }
    });
});

// 删除用户（需要管理员权限）
app.delete('/api/admin/users/:userId', authenticateToken, (req, res) => {
    // 验证管理员权限
    if (req.user.username !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }

    const userId = req.params.userId;
    const users = readUsers();
    
    // 不能删除admin账户
    const userToDelete = users.find(u => u.id === userId);
    if (userToDelete && userToDelete.username === 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Cannot delete admin account'
        });
    }

    const filteredUsers = users.filter(u => u.id !== userId);
    
    if (filteredUsers.length === users.length) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }

    saveUsers(filteredUsers);

    res.json({
        success: true,
        message: 'User deleted successfully'
    });
});

// 重置指定用户密码（需要管理员权限）
app.put('/api/admin/users/:userId/reset-password', authenticateToken, async (req, res) => {
    // 验证管理员权限
    if (req.user.username !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }

    const userId = req.params.userId;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
            success: false,
            message: 'New password must be at least 6 characters'
        });
    }

    const users = readUsers();
    const user = users.find(u => u.id === userId);

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }

    // 哈希新密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    user.password = hashedPassword;
    saveUsers(users);

    res.json({
        success: true,
        message: 'Password reset successfully'
    });
});

// 审批用户注册（需要管理员权限）
app.put('/api/admin/users/:userId/verify', authenticateToken, async (req, res) => {
    if (req.user.username !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }

    const userId = req.params.userId;
    const { action } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({
            success: false,
            message: 'Action must be "approve" or "reject"'
        });
    }

    const users = readUsers();
    const user = users.find(u => u.id === userId);

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }

    user.verificationStatus = action === 'approve' ? 'approved' : 'rejected';
    user.verificationAt = new Date().toISOString();
    saveUsers(users);

    res.json({
        success: true,
        message: `User ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
        data: {
            id: user.id,
            username: user.username,
            verificationStatus: user.verificationStatus
        }
    });
});

// ==================== User Cloud Data Sync ====================

// Get user cloud data
app.get('/api/user/data', authenticateToken, requireVerified, (req, res) => {
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({
        success: true,
        data: {
            preferences: user.cloudData?.preferences || null,
            visitedPages: user.cloudData?.visitedPages || null,
            pov_progress: user.cloudData?.pov_progress || null,
            lastSync: user.cloudData?.lastSync || null
        }
    });
});

// Update user cloud data
app.put('/api/user/data', authenticateToken, requireVerified, (req, res) => {
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === req.user.id);
    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    const { preferences, visitedPages, pov_progress } = req.body;
    if (!users[userIndex].cloudData) {
        users[userIndex].cloudData = {};
    }
    if (preferences !== undefined) {
        users[userIndex].cloudData.preferences = preferences;
    }
    if (visitedPages !== undefined) {
        users[userIndex].cloudData.visitedPages = visitedPages;
    }
    if (pov_progress !== undefined) {
        users[userIndex].cloudData.pov_progress = pov_progress;
    }
    users[userIndex].cloudData.lastSync = new Date().toISOString();
    saveUsers(users);
    res.json({
        success: true,
        data: {
            lastSync: users[userIndex].cloudData.lastSync
        }
    });
});

// ==================== POV Sharing ====================
const povSessions = new Map();
const POV_ID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generatePovId() {
    let id = '';
    for (let i = 0; i < 8; i++) id += POV_ID_CHARS[Math.floor(Math.random() * POV_ID_CHARS.length)];
    return id;
}

// Cleanup stale sessions every 30 min (sessions older than 6 hours)
setInterval(() => {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    for (const [key, val] of povSessions) {
        if (val.lastUpdate < cutoff) povSessions.delete(key);
    }
}, 30 * 60 * 1000);



// ==================== 项目版本接口 ====================
const SCAN_EXTENSIONS = new Set(['.html', '.js', '.css', '.json', '.png', '.jpg', '.svg', '.ico', '.bat', '.sh']);
const SCAN_EXCLUDE_DIRS = new Set(['node_modules', '.git', '.trae', 'data']);

function scanLastModified(dir) {
    let latest = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SCAN_EXCLUDE_DIRS.has(entry.name)) continue;
            const subLatest = scanLastModified(fullPath);
            if (subLatest > latest) latest = subLatest;
        } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (!SCAN_EXTENSIONS.has(ext)) continue;
            try {
                const stat = fs.statSync(fullPath);
                if (stat.mtimeMs > latest) latest = stat.mtimeMs;
            } catch (e) { /* skip */ }
        }
    }
    return latest;
}

let cachedVersion = null;
let cachedVersionTime = 0;
const VERSION_CACHE_TTL = 5 * 60 * 1000;

app.get('/api/version', (req, res) => {
    const now = Date.now();
    if (!cachedVersion || now - cachedVersionTime > VERSION_CACHE_TTL) {
        const latestMs = scanLastModified(__dirname);
        const date = latestMs ? new Date(latestMs) : new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const versionStr = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
        cachedVersion = versionStr;
        cachedVersionTime = now;
    }
    res.json({ version: cachedVersion, lastModified: cachedVersion });
});

// ==================== 设备管理 & 登录日志 ====================

// 获取当前用户的设备列表
app.get('/api/user/devices', authenticateToken, (req, res) => {
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    const devices = (user.devices || []).map(d => ({
        deviceId: d.deviceId,
        deviceType: d.deviceType,
        browser: d.browser,
        os: d.os,
        ip: d.ip,
        loginTime: d.loginTime,
        lastActive: d.lastActive,
        isCurrent: d.deviceId === generateDeviceId(req)
    }));
    res.json({ success: true, data: { devices } });
});

// 移除指定设备（远程登出）
app.delete('/api/user/devices/:deviceId', authenticateToken, (req, res) => {
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === req.user.id);
    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    const deviceId = req.params.deviceId;
    const currentDeviceId = generateDeviceId(req);
    if (deviceId === currentDeviceId) {
        return res.status(400).json({ success: false, message: 'Cannot remove current device' });
    }
    if (!users[userIndex].devices) {
        return res.status(404).json({ success: false, message: 'Device not found' });
    }
    const before = users[userIndex].devices.length;
    users[userIndex].devices = users[userIndex].devices.filter(d => d.deviceId !== deviceId);
    if (users[userIndex].devices.length === before) {
        return res.status(404).json({ success: false, message: 'Device not found' });
    }
    saveUsers(users);
    res.json({ success: true, message: 'Device removed' });
});

// 获取当前用户的登录日志
app.get('/api/user/login-log', authenticateToken, (req, res) => {
    const logs = readLoginLog();
    const userLogs = logs.filter(l => l.userId === req.user.id);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const total = userLogs.length;
    const items = userLogs.reverse().slice(offset, offset + limit);
    res.json({ success: true, data: { items, total } });
});

// 管理员：获取所有登录日志
app.get('/api/admin/login-log', authenticateToken, (req, res) => {
    if (req.user.username !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    const logs = readLoginLog();
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = parseInt(req.query.offset) || 0;
    const username = req.query.username || '';
    let filtered = logs;
    if (username) {
        filtered = logs.filter(l => l.username === username);
    }
    const total = filtered.length;
    const items = filtered.reverse().slice(offset, offset + limit);
    res.json({ success: true, data: { items, total } });
});

// ==================== POV 局域网检测 ====================

// 记录 POV 发送端 IP 到会话
app.post('/api/pov/share', (req, res) => {
    const { sessionId, progress, shared, username } = req.body;
    let id = sessionId;
    if (!id || !povSessions.has(id)) {
        do { id = generatePovId(); } while (povSessions.has(id));
    }
    const existing = povSessions.get(id) || { progress: null, shared: true, username: '', created: Date.now() };
    if (progress !== undefined) existing.progress = progress;
    if (shared !== undefined) existing.shared = shared;
    if (username !== undefined && username) existing.username = username;
    existing.lastUpdate = Date.now();
    existing.sharerIp = getClientIp(req);
    povSessions.set(id, existing);
    res.json({ success: true, sessionId: id, shared: existing.shared });
});

// 获取分享会话（含局域网检测）
app.get('/api/pov/share/:id', (req, res) => {
    const session = povSessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!session.shared) return res.status(403).json({ error: 'Sharing is disabled' });
    const viewerIp = getClientIp(req);
    const sameLan = isSameLan(session.sharerIp || '', viewerIp);
    res.json({
        success: true,
        progress: session.progress,
        username: session.username || '',
        lastUpdate: session.lastUpdate,
        sameLan,
        sharerIp: session.sharerIp || '',
        viewerIp
    });
});

// ==================== 安全记录管理 API ====================
const SAFETY_RECORDS_FILE = path.join(__dirname, 'data', 'safety_records.json');

function ensureSafetyRecordsFile() {
    if (!fs.existsSync(SAFETY_RECORDS_FILE)) {
        const defaultData = {
            stats: { accidentFreeDays: 0, delayFreeDays: 0, lastAccidentDate: null, lastDelayDate: null, totalAccidents: 0, totalDelays: 0 },
            records: [],
            pendingReviews: []
        };
        fs.writeFileSync(SAFETY_RECORDS_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
    }
}

function readSafetyRecords() {
    ensureSafetyRecordsFile();
    try {
        const data = fs.readFileSync(SAFETY_RECORDS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading safety records:', error);
        return { stats: {}, records: [], pendingReviews: [] };
    }
}

function saveSafetyRecords(data) {
    ensureSafetyRecordsFile();
    try {
        fs.writeFileSync(SAFETY_RECORDS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving safety records:', error);
        throw error;
    }
}

function calculateSafetyStats(data) {
    const now = new Date();
    const approvedRecords = data.records || [];
    const accidents = approvedRecords.filter(r => r.type === 'accident' && r.status === 'approved');
    const delays = approvedRecords.filter(r => r.type === 'delay' && r.status === 'approved');

    let accidentFreeDays = 0;
    let delayFreeDays = 0;
    let lastAccidentDate = null;
    let lastDelayDate = null;
    let maxDelayFreeDays = 0;
    let maxDelayFreeRange = [null, null];

    if (accidents.length > 0) {
        const lastAccident = accidents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        lastAccidentDate = lastAccident.timestamp;
        const diffTime = now - new Date(lastAccidentDate);
        accidentFreeDays = diffTime / (1000 * 60 * 60 * 24);
    } else {
        accidentFreeDays = 365;
    }

    if (approvedRecords.length > 0) {
        const lastDelay = approvedRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        lastDelayDate = lastDelay.timestamp;
        const diffTime = now - new Date(lastDelayDate);
        delayFreeDays = diffTime / (1000 * 60 * 60 * 24);

        const sortedRecords = [...approvedRecords].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        let currentStart = null;
        sortedRecords.forEach(record => {
            if (currentStart !== null) {
                const start = new Date(currentStart);
                const end = new Date(record.timestamp);
                const duration = (end - start) / (1000 * 60 * 60 * 24);
                if (duration > maxDelayFreeDays) {
                    maxDelayFreeDays = duration;
                    maxDelayFreeRange = [currentStart, record.timestamp];
                }
            }
            currentStart = record.timestamp;
        });

        if (currentStart !== null && approvedRecords.length > 1) {
            const start = new Date(currentStart);
            const end = now;
            const duration = (end - start) / (1000 * 60 * 60 * 24);
            if (duration > maxDelayFreeDays) {
                maxDelayFreeDays = duration;
                maxDelayFreeRange = [currentStart, now.toISOString()];
            }
        } else if (currentStart !== null && approvedRecords.length === 1) {
            const start = new Date(currentStart);
            const end = now;
            maxDelayFreeDays = (end - start) / (1000 * 60 * 60 * 24);
            maxDelayFreeRange = [currentStart, now.toISOString()];
        }
    } else {
        delayFreeDays = 365;
    }

    return {
        accidentFreeDays: Math.round(accidentFreeDays * 100) / 100,
        delayFreeDays: Math.round(delayFreeDays * 100) / 100,
        maxDelayFreeDays: Math.round(maxDelayFreeDays * 100) / 100,
        lastAccidentDate,
        lastDelayDate,
        totalAccidents: accidents.length,
        totalDelays: delays.length,
        maxDelayFreeRange
    };
}

app.get('/api/safety/stats', (req, res) => {
    try {
        const data = readSafetyRecords();
        const stats = calculateSafetyStats(data);
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load safety stats' });
    }
});

app.get('/api/safety/records', (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        let user = null;
        
        if (token) {
            try {
                jwt.verify(token, JWT_SECRET, (err, decoded) => {
                    if (!err) user = decoded;
                });
            } catch (e) { 
                user = null; 
            }
        }
        
        const data = readSafetyRecords();
        const type = req.query.type || 'all';
        const status = req.query.status || 'approved';
        
        let filteredRecords = data.records || [];
        if (type !== 'all') {
            filteredRecords = filteredRecords.filter(r => r.type === type);
        }
        if (status === 'pending' && user && user.username === 'admin') {
            filteredRecords = [...(data.pendingReviews || [])];
        } else if (status !== 'all') {
            filteredRecords = filteredRecords.filter(r => r.status === status);
        }
        
        filteredRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json({
            success: true,
            data: {
                records: filteredRecords,
                total: filteredRecords.length,
                pendingCount: (data.pendingReviews || []).length
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load safety records' });
    }
});

app.post('/api/safety/report', authenticateToken, requireVerified, async (req, res) => {
    try {
        const { type, location, trainInfo, cause, impact, timestamp } = req.body;
        
        if (!type || !location || !cause) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: type, location, cause'
            });
        }
        
        if (!['accident', 'delay'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Type must be "accident" or "delay"'
            });
        }
        
        let eventTimestamp = new Date().toISOString();
        
        if (timestamp) {
            try {
                const parsedTimestamp = new Date(timestamp);
                
                const now = new Date();
                if (parsedTimestamp > now) {
                    return res.status(400).json({
                        success: false,
                        message: 'Event time cannot be in the future'
                    });
                }
                
                eventTimestamp = parsedTimestamp.toISOString();
            } catch (e) {
                console.warn('Invalid timestamp format provided:', timestamp);
            }
        }
        
        const data = readSafetyRecords();
        const newRecord = {
            id: 'rec-' + Date.now().toString(36),
            type,
            status: 'pending',
            timestamp: eventTimestamp,
            location: {
                station: location.station || '',
                line: location.line || '',
                position: location.position || '',
                x_coordinate: location.x_coordinate || null,
                z_coordinate: location.z_coordinate || null
            },
            trainInfo: trainInfo || {},
            cause,
            impact: impact || {},
            reportedBy: req.user.username,
            createdAt: new Date().toISOString()
        };
        
        data.pendingReviews.push(newRecord);
        saveSafetyRecords(data);
        
        console.log(`📋 新的安全报告已提交: ${newRecord.id} (${type}) by ${req.user.username}`);
        
        res.json({
            success: true,
            message: 'Report submitted successfully, awaiting admin review',
            data: newRecord
        });
    } catch (error) {
        console.error('Error submitting safety report:', error);
        res.status(500).json({ success: false, message: 'Failed to submit report' });
    }
});

app.put('/api/safety/review/:id', authenticateToken, (req, res) => {
    if (req.user.username !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
    
    try {
        const recordId = req.params.id;
        const { action, notes } = req.body; // action: 'approve' | 'reject'
        
        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Action must be "approve" or "reject"'
            });
        }
        
        const data = readSafetyRecords();
        const recordIndex = data.pendingReviews.findIndex(r => r.id === recordId);
        
        if (recordIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Record not found in pending reviews'
            });
        }
        
        const record = data.pendingReviews[recordIndex];
        record.status = action === 'approve' ? 'approved' : 'rejected';
        record.reviewedBy = req.user.username;
        record.reviewedAt = new Date().toISOString();
        record.reviewNotes = notes || '';

        if (!data.stats) {
            data.stats = { accidentFreeDays: 0, delayFreeDays: 0, maxDelayFreeDays: 0, maxDelayFreeRange: [null, null], lastAccidentDate: null, lastDelayDate: null, totalAccidents: 0, totalDelays: 0 };
        }
        
        if (action === 'approve') {
            data.records.push(record);
            
            if (record.type === 'accident') {
                data.stats.totalAccidents++;
                data.stats.accidentFreeDays = 0;
                data.stats.lastAccidentDate = record.timestamp;
            } else if (record.type === 'delay') {
                data.stats.totalDelays++;
                data.stats.delayFreeDays = 0;
                data.stats.lastDelayDate = record.timestamp;
            }
        }
        
        data.pendingReviews.splice(recordIndex, 1);
        saveSafetyRecords(data);
        
        console.log(`🔍 安全记录审核完成: ${recordId} -> ${action} by ${req.user.username}`);
        
        res.json({
            success: true,
            message: `Record ${action}d successfully`,
            data: record
        });
    } catch (error) {
        console.error('Error reviewing safety record:', error);
        res.status(500).json({ success: false, message: 'Failed to review record' });
    }
});

// ==================== 静态文件服务 ====================
// 在生产环境中，Express也提供静态文件
app.use(express.static(path.join(__dirname)));

// 启动服务器
async function startServer() {
    // 先初始化admin账户
    await initializeAdmin();
    
    app.listen(PORT, () => {
        console.log(`\n🚀 GTR API Server v1.0.4-JWT-FIX running on http://localhost:${PORT}`);
        console.log(`   ⚠️  JWT_SECRET 长度: ${JWT_SECRET.length} 字符`);
        console.log(`   ⚠️  JWT_SECRET 前缀: ${JWT_SECRET.substring(0, 20)}...`);
        console.log(`   ⚠️  如果长度不是35，说明使用了自定义JWT_SECRET！`);
        console.log(`   Environment: ${process.env.NODE_ENV || 'production'}`);
        console.log(`   PORT env: ${process.env.PORT || 'not set'}`);
        console.log(`\n📝 API Documentation:`);
        console.log(`   POST /api/auth/register - 用户注册`);
        console.log(`   POST /api/auth/login - 用户登录`);
        console.log(`   GET  /api/auth/me - 获取当前用户信息`);
        console.log(`   POST /api/auth/logout - 用户登出`);
        console.log(`   PUT  /api/auth/password - 修改密码`);
        console.log(`   GET  /api/admin/users - 获取所有用户（需要admin权限）`);
        console.log(`   DELETE /api/admin/users/:id - 删除用户（需要admin权限）`);
        console.log(`   PUT  /api/admin/users/:id/reset-password - 重置密码（需要admin权限）`);
        console.log(`   GET  /api/health - 健康检查`);

        console.log(`   GET  /api/user/data - 获取云端数据（需要登录）`);
        console.log(`   PUT  /api/user/data - 更新云端数据（需要登录）`);        console.log(`\n👤 管理页面: http://localhost:${PORT}/admin.html`);
        console.log(`\n⚠️  默认管理员账户: admin / admin123`);
        console.log(`   请首次登录后立即修改密码！\n`);
    });
}

startServer();

module.exports = app;
