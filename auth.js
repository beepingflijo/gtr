// ==================== 用户认证模块 ====================

// API基础URL（开发环境使用本地服务器，生产环境可配置）
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000/api' 
    : '/api';

// 获取当前会话
function getUserSession() {
    try {
        const session = localStorage.getItem('userSession');
        console.log('获取当前会话:', session);
        if (session) {
            const parsedSession = JSON.parse(session);
            
            // 会话数据版本迁移：检查是否包含AuthMe字段
            if (parsedSession && parsedSession.user) {
                const user = parsedSession.user;
                const hasAuthmeFields = 'authmeBound' in user || 'authmeUsername' in user;
                
                if (!hasAuthmeFields) {
                    console.warn('检测到旧版本会话数据（缺少AuthMe字段），正在清除并提示重新登录...');
                    console.log('当前用户数据:', user);
                    
                    // 清除旧会话
                    localStorage.removeItem('userSession');
                    
                    // 显示提示消息（如果toast函数可用）
                    if (typeof showToast === 'function') {
                        showToast('系统已升级，请重新登录以获取完整功能', 3000);
                    }
                    
                    return null;
                }
            }
            
            return parsedSession;
        }
    } catch (error) {
        console.error('Error parsing user session:', error);
        localStorage.removeItem('userSession');
    }
    return null;
}

// 保存会话
function saveUserSession(sessionData) {
    try {
        localStorage.setItem('userSession', JSON.stringify(sessionData));
    } catch (error) {
        console.error('Error saving user session:', error);
    }
}

// 清除会话
function clearUserSession() {
    localStorage.removeItem('userSession');
}

// 检查是否已登录
function isLoggedIn() {
    const session = getUserSession();
    return !!(session && session.token);
}

// 获取当前用户信息
function getCurrentUser() {
    const session = getUserSession();
    return session ? session.user : null;
}

// 通过用户名获取authmeUsername
async function getAuthmeUsernameByUsername(username = getCurrentUser()?.username) {
    // 首先检查是否是当前登录用户
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.username === username) {
        console.log('获取当前用户的AuthMe用户名:', {
            username: currentUser.username,
            authmeUsername: currentUser.authmeUsername,
            authmeBound: currentUser.authmeBound
        });
        return currentUser.authmeUsername || null;
    }

    // 如果不是当前用户，尝试通过API查询（需要认证）
    const session = getUserSession();
    if (!session || !session.token) {
        console.warn('无法查询其他用户的authmeUsername：未登录');
        return null;
    }

    try {
        // 这里可以调用一个专门的API端点来查询
        // 目前先返回null，因为后端没有提供公开查询接口
        // 如果需要，可以在后端添加 /api/users/:username/authme 接口
        console.warn('查询其他用户的authmeUsername功能尚未实现', { targetUsername: username });
        return null;
    } catch (error) {
        console.error('查询authmeUsername失败:', error);
        return null;
    }
}

window.getAuthmeUsernameByUsername = getAuthmeUsernameByUsername;

// 验证Token有效性
async function validateToken() {
    const session = getUserSession();
    if (!session || !session.token) {
        return false;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${session.token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            clearUserSession();
            return false;
        }

        const data = await response.json();
        if (data.success) {
            // 更新会话中的用户信息（合并字段，避免覆盖AuthMe字段）
            session.user = {
                ...session.user,  // 保留原有字段
                ...data.data.user  // 用后端返回的字段更新
            };
            saveUserSession(session);
            return true;
        }
        
        clearUserSession();
        return false;
    } catch (error) {
        console.error('Token validation error:', error);
        // 网络错误时不立即清除会话，允许离线使用
        return true;
    }
}

// 用户注册
async function registerUser(username, password, email = null, authmeUsername = null, authmePassword = null) {
    try {
        const requestBody = { username, password, email };
        
        // 如果提供了AuthMe凭据，添加到请求中
        if (authmeUsername && authmePassword) {
            requestBody.authmeUsername = authmeUsername;
            requestBody.authmePassword = authmePassword;
        }
        
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok) {
            // 处理不同的错误类型
            if (data.errorCode === 'AUTHME_ALREADY_BOUND') {
                // AuthMe用户名已被其他账号绑定
                throw new Error(data.message || strings.preferences.authme_already_bound[lang] || '该AuthMe账户已被其他用户绑定');
            } else if (data.requiresAuthMeVerification) {
                // AuthMe验证失败
                throw new Error(data.message || strings.preferences.authme_verification_failed[lang] || 'AuthMe验证失败');
            }
            throw new Error(data.message || 'Registration failed');
        }

        if (data.success) {
            saveUserSession({
                token: data.data.token,
                user: data.data.user,
                loginTime: new Date().toISOString()
            });
            return { success: true, user: data.data.user };
        }

        return { success: false, message: data.message };
    } catch (error) {
        console.error('Registration error:', error);
        return { 
            success: false, 
            message: error.message || 'Network error, please try again' 
        };
    }
}

// 用户登录
async function loginUser(username, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        console.log('登录API响应:', {
            success: data.success,
            user: data.data?.user,
            hasAuthmeFields: {
                authmeBound: data.data?.user?.authmeBound,
                authmeUsername: data.data?.user?.authmeUsername,
                authmeDisplayName: data.data?.user?.authmeDisplayName,
                authmeAvatarUrl: data.data?.user?.authmeAvatarUrl
            }
        });

        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }

        if (data.success) {
            console.log('保存会话数据:', {
                token: data.data.token ? '***' : null,
                user: data.data.user
            });
            saveUserSession({
                token: data.data.token,
                user: data.data.user,
                loginTime: new Date().toISOString()
            });
            return { success: true, user: data.data.user };
        }

        return { success: false, message: data.message };
    } catch (error) {
        console.error('Login error:', error);
        return { 
            success: false, 
            message: error.message || 'Network error, please try again' 
        };
    }
}

// 用户登出
async function logoutUser() {
    const session = getUserSession();
    
    if (session && session.token) {
        try {
            await fetch(`${API_BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.token}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Logout API error:', error);
            // 即使API调用失败，也要清除本地会话
        }
    }

    clearUserSession();
    return { success: true };
}

// 修改密码
async function changePassword(currentPassword, newPassword) {
    const session = getUserSession();
    
    if (!session || !session.token) {
        return { success: false, message: 'Not logged in' };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/password`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${session.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Password change failed');
        }

        return { success: data.success, message: data.message };
    } catch (error) {
        console.error('Password change error:', error);
        return { 
            success: false, 
            message: error.message || 'Network error, please try again' 
        };
    }
}

// 显示登录对话框
async function showLoginDialog() {
    // 从stations_info.json中随机选取一项的cover作为登录对话框的背景图
    let backgroundImage = '';
    let stationName = '';
    let stationCode = '';
    try {
        const stationsData = await window.getStationData();
        const trainData = await window.getTrainData();
        if (stationsData && typeof stationsData === 'object') {
            // stations_info.json 是对象结构，需要转换为数组
            const stationsArray = Object.values(stationsData);
            if (Array.isArray(stationsArray) && stationsArray.length > 0) {
                // 提取所有有cover的图片URL，并构建统一格式
                const stationImages = stationsArray
                    .filter(station => station.cover)
                    .map(station => {
                        const stationCode = Object.keys(stationsData).find(key => stationsData[key] === station);
                        const name = getStationName(stationCode, lang);
                        const desc = name + (name.includes(strings.ticket_calculator._station[lang]) ? '' : strings.ticket_calculator._station[lang]);
                        const link = `content.html?type=station&q=${stationCode}`;
                        return { img: station.cover, desc, link };
                    });

                // 提取所有列车的封面图片，并构建统一格式
                const trainImages = trainData.series
                    .filter(train => train.gallery && Array.isArray(train.gallery))
                    .flatMap(train => {
                        const coverImg = train.gallery.find(img => img.class === 'cover');
                        if (!coverImg || !coverImg.image) return [];
                        // 查找该列车对应的系列信息以获取系列名称
                        const seriesInfo = trainData.series?.find(series => series.name === train.series);
                        const desc = train.name+strings.trains_info._series[lang];
                        const link = `content.html?type=series&q=${train.name}`;
                        return [{ img: coverImg.image, desc, link }];
                    });
                
                // 合并车站和列车图片数组
                const allImages = [...stationImages, ...trainImages];
                
                if (allImages.length > 0) {
                    const selectedImage = allImages[Math.floor(Math.random() * allImages.length)];
                    backgroundImage = selectedImage.img;
                    stationName = selectedImage.desc;
                    stationCode = selectedImage.link;
                }
            }
        }
    } catch (error) {
        console.error('Failed to load station data:', error);
    }

    return new Promise((resolve) => {
        // 创建登录对话框内容
        const dialogContent = document.createElement('div');
        dialogContent.className = 'login-dialog-content';
        dialogContent.innerHTML = `
            <div class="login-form">
                <div class="form-error" id="login-error" style="display: none; color: crimson; margin-top: 8px; font-size: 14px;"></div>
                <div class="form-group">
                    <label for="login-username">${strings.preferences.username[lang] || '用户名'}</label>
                    <input type="text" id="login-username" class="form-input" placeholder="${strings.preferences.username_placeholder[lang] || '输入用户名'}" autocomplete="username">
                </div>
                <div class="form-group">
                    <label for="login-password">${strings.preferences.password[lang] || '密码'}</label>
                    <input type="password" id="login-password" class="form-input" placeholder="${strings.preferences.password_placeholder[lang] || '输入密码'}" autocomplete="current-password">
                </div>
            </div>
        `;

        const dialogButtons = document.createElement('div');
        dialogButtons.className = 'dialog-buttons';
        dialogButtons.innerHTML = `
                    <button class="btn" id="login-register-btn">${strings.preferences.register[lang] || '注册'}</button>
                    <button class="btn active" id="login-submit-btn">${strings.preferences.login[lang] || '登录'}</button>
        `;

        // 显示对话框
        pushDialog(dialogContent, 'custom', strings.preferences.login[lang] || '登录', false, backgroundImage, dialogButtons)
            .then(() => {
                resolve(false);
            });

        // 绑定事件
        const usernameInput = dialogContent.querySelector('#login-username');
        const passwordInput = dialogContent.querySelector('#login-password');
        const errorDiv = dialogContent.querySelector('#login-error');
        const submitBtn = dialogButtons.querySelector('#login-submit-btn');
        const registerBtn = dialogButtons.querySelector('#login-register-btn');
        const dialogParent = dialogContent.parentNode;
        const stationNameElement = document.createElement('div');
        stationNameElement.classList.add('station-name');
        stationNameElement.innerHTML = '<span class="material-symbols-outlined" style="font-size: 1.2em;">photo_camera</span><a href="'+stationCode+'" target="_blank" style="color: var(--color-text-secondary)">'+stationName+'</a>';
        stationNameElement.style.display = stationName ? 'flex' : 'none';
        stationNameElement.style.flexDirection = 'row';
        stationNameElement.style.alignItems = 'center';
        stationNameElement.style.gap = '2px';
        stationNameElement.style.justifyContent = 'flex-end';
        stationNameElement.style.transform = 'translateY(-0.5em)';
        stationNameElement.style.padding = '0 1em';
        stationNameElement.style.color = 'var(--color-text-secondary)';
        stationNameElement.style.fontSize = '0.9em';
        stationNameElement.style.width = '-webkit-fill-available';
        stationNameElement.style.height = '0';
        stationNameElement.style.textShadow = '0 2px 12px var(--color-background-card-solid);';
        dialogParent.insertBefore(stationNameElement, dialogContent);

        // 回车提交
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitBtn.click();
            }
        });

        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                passwordInput.focus();
            }
        });

        // 登录按钮点击事件
        submitBtn.addEventListener('click', async () => {
            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            // 验证输入
            if (!username || !password) {
                errorDiv.textContent = strings.preferences.login_error_empty[lang] || '请输入用户名和密码';
                errorDiv.style.display = 'block';
                return;
            }

            // 禁用按钮，显示加载状态
            submitBtn.disabled = true;
            submitBtn.textContent = strings.preferences.logging_in[lang] || '登录中...';
            errorDiv.style.display = 'none';

            // 调用登录API
            const result = await loginUser(username, password);

            if (result.success) {
                // 登录成功，关闭对话框并刷新页面
                showToast(strings.preferences.login_success[lang] || '登录成功', 2000);
                setTimeout(() => {
                    location.reload();
                }, 500);
                resolve(true);
            } else {
                // 登录失败，显示错误
                errorDiv.textContent = result.message;
                errorDiv.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = strings.preferences.login[lang] || '登录';
            }
        });

        // 注册按钮点击事件
        registerBtn.addEventListener('click', async () => {
            // 关闭登录对话框，打开注册对话框
            const dialogElement = dialogContent.closest('.dialog-overlay');
            if (dialogElement) {
                dialogElement.remove();
            }
            
            const registerResult = await showRegisterDialog();
            if (registerResult) {
                // 注册成功后自动登录
                resolve(true);
                window.location.reload();
            } else {
                // 注册取消或失败，重新显示登录对话框
                showLoginDialog().then(resolve);
            }
        });

        // 聚焦到用户名输入框
        setTimeout(() => {
            usernameInput.focus();
        }, 100);
    });
}

// 显示注册对话框
async function showRegisterDialog() {
    return new Promise((resolve) => {
        const dialogContent = document.createElement('div');
        dialogContent.className = 'register-dialog-content';
        dialogContent.innerHTML = `
            <div class="register-form">
                <div class="form-group">
                    <label for="register-username">${strings.preferences.username[lang] || '用户名'}</label>
                    <input type="text" id="register-username" class="form-input" placeholder="${strings.preferences.username_placeholder[lang] || '输入用户名（3-20个字符）'}" autocomplete="username">
                </div>
                <div class="form-group">
                    <label for="register-email">${strings.preferences.email[lang] || '邮箱（可选）'}</label>
                    <input type="email" id="register-email" class="form-input" placeholder="${strings.preferences.email_placeholder[lang] || '输入邮箱地址'}" autocomplete="email">
                </div>
                <div class="form-group">
                    <label for="register-password">${strings.preferences.password[lang] || '密码'}</label>
                    <input type="password" id="register-password" class="form-input" placeholder="${strings.preferences.password_placeholder_register[lang] || '输入密码（至少6个字符）'}" autocomplete="new-password">
                </div>
                <div class="form-group">
                    <label for="register-confirm-password">${strings.preferences.confirm_password[lang] || '确认密码'}</label>
                    <input type="password" id="register-confirm-password" class="form-input" placeholder="${strings.preferences.confirm_password_placeholder[lang] || '再次输入密码'}" autocomplete="new-password">
                </div>
                <div class="form-group">
                    <label for="register-authme-username">${strings.preferences.authme_username[lang] || '服务器账号用户名'} <span style="color: crimson;">*</span></label>
                    <input type="text" id="register-authme-username" class="form-input" placeholder="${strings.preferences.authme_username_placeholder[lang] || '输入服务器账号用户名'}" autocomplete="off" required>
                </div>
                <div class="form-group">
                    <label for="register-authme-password">${strings.preferences.authme_password[lang] || '服务器账号密码'} <span style="color: crimson;">*</span></label>
                    <input type="password" id="register-authme-password" class="form-input" placeholder="${strings.preferences.authme_password_placeholder[lang] || '输入服务器账号密码'}" autocomplete="off" required>
                </div>
                <div style="font-size: 12px; color: var(--color-text-secondary); transform: translateY(-2em);">
                    ${strings.preferences.authme_required[lang] || '必须验证服务器账户才能注册'}
                </div>
                <div class="form-error" id="register-error" style="display: none; color: crimson; margin-top: 8px; font-size: 14px;"></div>
            </div>
        `;

        const dialogButtons = document.createElement('div');
        dialogButtons.className = 'dialog-buttons';
        dialogButtons.innerHTML = `
            <button class="btn btn-secondary" id="register-cancel-btn">${strings.general.cancel[lang] || '取消'}</button>
            <button class="btn btn-primary" id="register-submit-btn">${strings.preferences.register[lang] || '注册'}</button>
        `;

        pushDialog(dialogContent, 'custom', strings.preferences.register[lang] || '注册', false, '', dialogButtons)
            .then(() => {
                resolve(false);
            });

        const usernameInput = dialogContent.querySelector('#register-username');
        const emailInput = dialogContent.querySelector('#register-email');
        const passwordInput = dialogContent.querySelector('#register-password');
        const confirmPasswordInput = dialogContent.querySelector('#register-confirm-password');
        const errorDiv = dialogContent.querySelector('#register-error');
        const submitBtn = dialogButtons.querySelector('#register-submit-btn');
        const cancelBtn = dialogButtons.querySelector('#register-cancel-btn');
        
        // AuthMe相关元素（现在是必填）
        const authmeUsernameInput = dialogContent.querySelector('#register-authme-username');
        const authmePasswordInput = dialogContent.querySelector('#register-authme-password');

        // 回车提交
        confirmPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitBtn.click();
            }
        });
        
        authmePasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitBtn.click();
            }
        });

        // 取消按钮
        cancelBtn.addEventListener('click', () => {
            const dialogElement = dialogContent.closest('.dialog-overlay');
            if (dialogElement) {
                dialogElement.remove();
            }
            resolve(false);
        });

        // 注册按钮点击事件
        submitBtn.addEventListener('click', async () => {
            const username = usernameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            
            // AuthMe相关字段（必填）
            const authmeUsername = authmeUsernameInput.value.trim();
            const authmePassword = authmePasswordInput.value;

            // 验证基本输入
            if (!username || !password || !confirmPassword) {
                errorDiv.textContent = strings.preferences.register_error_empty[lang] || '请填写所有必填字段';
                errorDiv.style.display = 'block';
                return;
            }

            if (username.length < 3 || username.length > 20) {
                errorDiv.textContent = strings.preferences.register_error_username[lang] || '用户名长度必须在3-20个字符之间';
                errorDiv.style.display = 'block';
                return;
            }

            if (password.length < 6) {
                errorDiv.textContent = strings.preferences.register_error_password[lang] || '密码长度至少为6个字符';
                errorDiv.style.display = 'block';
                return;
            }

            if (password !== confirmPassword) {
                errorDiv.textContent = strings.preferences.register_error_password_mismatch[lang] || '两次输入的密码不一致';
                errorDiv.style.display = 'block';
                return;
            }
            
            // 验证AuthMe字段（必填）
            if (!authmeUsername || !authmePassword) {
                errorDiv.textContent = strings.preferences.authme_verification_failed[lang] + ': ' + (strings.preferences.authme_account_not_found[lang] || '请输入AuthMe用户名和密码');
                errorDiv.style.display = 'block';
                return;
            }

            // 禁用按钮，显示加载状态
            submitBtn.disabled = true;
            submitBtn.textContent = strings.preferences.registering[lang] || '注册中...';
            errorDiv.style.display = 'none';

            // 调用注册API（包含AuthMe信息）
            const result = await registerUser(username, password, email || null, authmeUsername, authmePassword);

            if (result.success) {
                // 注册成功，关闭对话框
                showToast(strings.preferences.register_success[lang] || '注册成功', 2000);
                const dialogElement = dialogContent.closest('.modal-overlay');
                if (dialogElement) {
                    closeDialog(dialogElement);
                }
                resolve(true);
            } else {
                // 注册失败，显示错误
                errorDiv.textContent = result.message;
                errorDiv.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = strings.preferences.register[lang] || '注册';
            }
        });

        // 聚焦到用户名输入框
        setTimeout(() => {
            usernameInput.focus();
        }, 100);
    });
}

// 显示登出确认对话框
async function showLogoutDialog() {
    const confirmed = await pushDialog(
        strings.preferences.logout_confirm[lang] || '确定要登出吗？',
        'confirm-danger'
    );

    if (confirmed) {
        const result = await logoutUser();
        if (result.success) {
            showToast(strings.preferences.logout_success[lang] || '已登出', 2000);
            setTimeout(() => {
                location.reload();
            }, 500);
        }
    }
}

// 更新登录状态UI
async function updateLoginStatusUI() {
    const loginStatus = document.getElementById('loginStatus');
    const toggleLogin = document.getElementById('toggleLogin');

    if (!loginStatus || !toggleLogin) return;

    const user = getCurrentUser();

    if (user) {
        // 从当前用户信息中获取authmeUsername
        const authmeUsername = await getAuthmeUsernameByUsername(user.username) || '';

        console.log('已登录', user);
        // 已登录状态
        loginStatus.innerHTML = '<img src="https://mc-heads.hydcraft.cn/avatar/' + (authmeUsername || 'MHF_Steve') + '/24.png" alt="' + user.username + '" style="border-radius: 4px"><span>' + user.username + '</span>';
        loginStatus.style.display = 'flex';
        loginStatus.style.alignItems = 'center';
        loginStatus.style.gap = '0.5em';
        toggleLogin.textContent = strings.preferences.logout[lang] || '登出';
        toggleLogin.style.color = 'crimson';
        
        // 移除旧的监听器，添加新的
        toggleLogin.removeEventListener('click', handleLoginClick);
        toggleLogin.addEventListener('click', handleLogoutClick);
        
        // 如果是admin用户，显示管理入口
        if (user.username === 'admin') {
            const adminLink = document.getElementById('adminLink');
            if (adminLink) {
                adminLink.style.display = 'inline-block';
            }
        }
    } else {
        // 未登录状态
        loginStatus.textContent = strings.preferences.not_logged_in[lang] || '未登录';
        toggleLogin.textContent = strings.preferences.login[lang] || '登录';
        toggleLogin.style.color = 'var(--color-primary)';
        
        // 移除旧的监听器，添加新的
        toggleLogin.removeEventListener('click', handleLogoutClick);
        toggleLogin.addEventListener('click', handleLoginClick);
        
        // 隐藏管理入口
        const adminLink = document.getElementById('adminLink');
        if (adminLink) {
            adminLink.style.display = 'none';
        }
    }
}

// 登录按钮点击处理
async function handleLoginClick() {
    await showLoginDialog();
}

// 登出按钮点击处理
async function handleLogoutClick() {
    await showLogoutDialog();
}

// 初始化认证系统
async function initAuth() {
    // 检查是否有保存的会话
    const session = getUserSession();
    
    if (session && session.token) {
        // 验证token有效性
        const isValid = await validateToken();
        
        if (!isValid) {
            console.log('Token invalid or expired');
        }
    }

    // 更新UI
    updateLoginStatusUI();
}

// 导出函数供其他模块使用
window.auth = {
    isLoggedIn,
    getCurrentUser,
    getUserSession,
    login: showLoginDialog,
    logout: showLogoutDialog,
    register: showRegisterDialog,
    changePassword,
    validateToken,
    init: initAuth
};
