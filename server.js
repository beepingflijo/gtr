const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'gtr-secret-key-2026-change-in-production';
const TOKEN_EXPIRY = '7d'; // Token有效期7天

// 用户数据文件路径
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

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

// Create or update a POV session
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
    povSessions.set(id, existing);
    res.json({ success: true, sessionId: id, shared: existing.shared });
});

// Get a shared POV session
app.get('/api/pov/share/:id', (req, res) => {
    const session = povSessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!session.shared) return res.status(403).json({ error: 'Sharing is disabled' });
    res.json({ success: true, progress: session.progress, username: session.username || '', lastUpdate: session.lastUpdate });
});

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
