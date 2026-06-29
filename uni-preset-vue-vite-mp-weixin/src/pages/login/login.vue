<template>
  <view class="container" :class="{ 'dark-mode': isDarkMode }">
    <!-- 隐私协议弹窗 -->
    <view class="privacy-modal" v-if="showPrivacyModal">
      <view class="privacy-content">
        <view class="privacy-title">隐私保护指引</view>
        <view class="privacy-body">
          <text class="privacy-text">
            在使用本小程序前，请您仔细阅读并同意{{ privacyContractName }}。
          </text>
          <view class="privacy-items">
            <view class="privacy-item">
              <text class="item-dot">•</text>
              <text class="item-text">我们可能会收集您的微信昵称、头像，用于用户身份识别</text>
            </view>
            <view class="privacy-item">
              <text class="item-dot">•</text>
              <text class="item-text">我们可能会收集您的学习记录，用于提供学习进度跟踪服务</text>
            </view>
          </view>
          <text class="privacy-link" @click="openPrivacyContract">查看完整隐私协议</text>
        </view>
        <view class="privacy-actions">
          <button class="privacy-btn disagree" @click="handleDisagree">不同意</button>
          <button 
            class="privacy-btn agree" 
            open-type="agreePrivacyAuthorization" 
            @agreeprivacyauthorization="handleAgreePrivacy"
            id="agree-btn"
          >同意</button>
        </view>
      </view>
    </view>

    <!-- 登录页面主体 -->
    <view class="login-page">
      <!-- Logo 区域 -->
      <view class="logo-section">
        <view class="logo-icon">
          <text class="logo-text">刷</text>
        </view>
        <text class="app-name">考研刷题</text>
        <text class="app-desc">智能刷题 · 高效备考</text>
      </view>

      <!-- 登录方式切换 -->
      <view class="login-tabs">
        <view 
          class="tab-item" 
          :class="{ active: loginMode === 'wechat' }"
          @click="loginMode = 'wechat'"
        >
          <text>微信登录</text>
          <view class="tab-line" v-if="loginMode === 'wechat'"></view>
        </view>
        <view 
          class="tab-item" 
          :class="{ active: loginMode === 'account' }"
          @click="loginMode = 'account'"
        >
          <text>账号登录</text>
          <view class="tab-line" v-if="loginMode === 'account'"></view>
        </view>
      </view>

      <!-- 微信一键登录 -->
      <view class="login-main" v-if="loginMode === 'wechat'">
        <button 
          class="wechat-login-btn" 
          :class="{ disabled: !agreeAllPrivacy || loggingIn }"
          :disabled="!agreeAllPrivacy || loggingIn"
          @click="handleWechatLogin"
        >
          <view class="wechat-icon-wrap">
            <text class="wechat-icon-text">微</text>
          </view>
          <text class="btn-text">{{ loggingIn ? '登录中...' : '微信一键登录' }}</text>
        </button>

        <!-- 隐私政策勾选 -->
        <view class="privacy-checkbox-section">
          <view class="checkbox-item" @click="toggleAllPrivacy">
            <checkbox :checked="agreeAllPrivacy" color="#07c160" />
            <text class="checkbox-text">
              已阅读并同意
              <text class="link-text" @click.stop="openAppPrivacy">《用户服务协议》</text>
              和
              <text class="link-text" @click.stop="openMiniProgramPrivacy">《隐私保护指引》</text>
            </text>
          </view>
        </view>
      </view>

      <!-- 账号密码登录 -->
      <view class="login-main" v-if="loginMode === 'account'">
        <view class="input-card">
          <view class="input-row">
            <text class="input-label">账号</text>
            <input 
              class="input-field" 
              v-model="accountUsername" 
              placeholder="请输入用户名或学号"
              placeholder-class="input-placeholder"
            />
          </view>
          <view class="input-divider"></view>
          <view class="input-row">
            <text class="input-label">密码</text>
            <input 
              class="input-field" 
              v-model="accountPassword" 
              password
              placeholder="请输入密码"
              placeholder-class="input-placeholder"
            />
          </view>
        </view>

        <button 
          class="account-login-btn" 
          :class="{ disabled: !canAccountLogin || loggingIn }"
          :disabled="!canAccountLogin || loggingIn"
          @click="handleAccountLogin"
        >
          <text class="btn-text">{{ loggingIn ? '登录中...' : '登录' }}</text>
        </button>

        <view class="account-actions">
          <text class="action-text" @click="goToRegister">注册账号</text>
          <text class="action-text" @click="goToForgot">忘记密码</text>
        </view>
      </view>

      <!-- 底部说明 -->
      <view class="login-footer">
        <text class="footer-text">未注册用户将自动创建账号</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { getCurrentInstance } from 'vue';

const instance = getCurrentInstance();

const isDarkMode = ref(false);
const agreeAllPrivacy = ref(false);
const showPrivacyModal = ref(false);
const privacyContractName = ref('《小程序隐私保护指引》');
const loggingIn = ref(false);

// 登录模式：wechat / account
const loginMode = ref('wechat');

// 账号登录数据
const accountUsername = ref('');
const accountPassword = ref('');

// 账号登录按钮是否可用
const canAccountLogin = computed(() => {
  return accountUsername.value.trim().length > 0 && accountPassword.value.length > 0;
});

// 切换隐私政策勾选
const toggleAllPrivacy = () => {
  agreeAllPrivacy.value = !agreeAllPrivacy.value;
};

// 打开官方隐私协议页面
const openPrivacyContract = () => {
  // #ifdef MP-WEIXIN
  wx.openPrivacyContract({
    success: () => {
      console.log('打开隐私协议成功');
    },
    fail: (err) => {
      console.error('打开隐私协议失败', err);
    }
  });
  // #endif
};

// 打开研大师刷研题小程序隐私保护指引
const openMiniProgramPrivacy = () => {
  uni.navigateTo({
    url: '/pages/privacy/mini-program-privacy'
  });
};

// 打开用户服务协议
const openAppPrivacy = () => {
  uni.navigateTo({
    url: '/pages/privacy/app-privacy'
  });
};

// 检查隐私协议状态
const checkPrivacySetting = () => {
  // #ifdef MP-WEIXIN
  if (wx.getPrivacySetting) {
    wx.getPrivacySetting({
      success: (res) => {
        console.log('隐私协议状态:', res);
        if (res.needAuthorization) {
          showPrivacyModal.value = true;
        }
        privacyContractName.value = res.privacyContractName || '《小程序隐私保护指引》';
      },
      fail: (err) => {
        console.error('获取隐私协议状态失败:', err);
      }
    });
  }
  // #endif
};

// 不同意隐私协议
const handleDisagree = () => {
  uni.showModal({
    title: '提示',
    content: '您需要同意隐私保护指引才能继续使用本小程序。',
    showCancel: false,
    confirmText: '知道了'
  });
};

// 同意隐私协议
const handleAgreePrivacy = () => {
  console.log('用户同意隐私协议');
  showPrivacyModal.value = false;
  agreeAllPrivacy.value = true;
};

// 微信一键登录
const handleWechatLogin = async () => {
  // #ifndef MP-WEIXIN
  uni.showToast({
    title: '请在微信小程序中使用此功能',
    icon: 'none'
  });
  return;
  // #endif

  if (!agreeAllPrivacy.value) {
    uni.showToast({
      title: '请先同意隐私协议',
      icon: 'none'
    });
    return;
  }

  if (loggingIn.value) return;
  loggingIn.value = true;

  uni.showLoading({
    title: '登录中...',
    mask: true
  });

  try {
    // 1. 获取登录 code
    const loginRes = await new Promise((resolve, reject) => {
      uni.login({
        provider: 'weixin',
        success: (res) => resolve(res),
        fail: (err) => reject(err)
      });
    });

    if (!loginRes.code) {
      throw new Error('获取微信登录凭证失败');
    }

    // 2. 获取用户信息 (可选)
    let userInfo = null;
    try {
      const userProfileRes = await new Promise((resolve) => {
        uni.getUserProfile({
          desc: '用于完善会员资料',
          success: (res) => resolve(res.userInfo),
          fail: () => resolve(null)
        });
      });
      userInfo = userProfileRes;
    } catch (e) {
      console.log('获取用户信息失败或用户拒绝', e);
    }

    // 3. 调用后端微信登录接口
    const res = await instance.appContext.config.globalProperties.$api.userApi.wechatLogin({
      code: loginRes.code,
      userInfo: userInfo
    });

    uni.hideLoading();

    if (res.code === 0) {
      handleLoginSuccess(res.data);
    } else {
      uni.showToast({
        title: res.message || '登录失败',
        icon: 'none'
      });
    }

  } catch (error) {
    uni.hideLoading();
    console.error('微信登录失败:', error);
    uni.showToast({
      title: '登录异常，请重试',
      icon: 'none'
    });
  } finally {
    loggingIn.value = false;
  }
};

// 账号密码登录
const handleAccountLogin = async () => {
  if (!accountUsername.value.trim() || !accountPassword.value) {
    uni.showToast({ title: '请输入账号和密码', icon: 'none' });
    return;
  }

  if (loggingIn.value) return;
  loggingIn.value = true;

  uni.showLoading({ title: '登录中...', mask: true });

  try {
    const res = await instance.appContext.config.globalProperties.$api.userApi.login({
      username: accountUsername.value.trim(),
      password: accountPassword.value
    });

    uni.hideLoading();

    if (res.code === 0) {
      handleLoginSuccess(res.data);
    } else {
      uni.showToast({
        title: res.message || '登录失败',
        icon: 'none'
      });
    }
  } catch (error) {
    uni.hideLoading();
    console.error('账号登录失败:', error);
    uni.showToast({
      title: '登录异常，请重试',
      icon: 'none'
    });
  } finally {
    loggingIn.value = false;
  }
};

// 跳转注册页
const goToRegister = () => {
  uni.navigateTo({ url: '/pages/register/register' });
};

// 跳转忘记密码页
const goToForgot = () => {
  uni.showToast({ title: '功能开发中', icon: 'none' });
};

const handleLoginSuccess = (userData) => {
  uni.setStorageSync('token', userData.token);
  uni.setStorageSync('userId', userData.userId);
  uni.setStorageSync('username', userData.username);
  uni.setStorageSync('role', userData.role);
  if (userData.avatar) {
    uni.setStorageSync('avatar', userData.avatar);
  }
  
  uni.showToast({
    title: '登录成功',
    icon: 'success'
  });
  
  setTimeout(() => {
    uni.switchTab({
      url: '/pages/index/index'
    });
  }, 1500);
};

onMounted(() => {
  // 检查是否有token
  const token = uni.getStorageSync('token');
  if (token) {
    uni.switchTab({
      url: '/pages/index/index'
    });
    return;
  }
  
  checkPrivacySetting();
  
  const currentTheme = uni.getStorageSync('themeMode') || 'light';
  isDarkMode.value = currentTheme === 'dark';
  
  uni.$on('themeChange', (darkMode) => {
    isDarkMode.value = darkMode;
  });
});
</script>

<style>
.container {
  background-color: #f5f5f5;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 登录页主体 */
.login-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 60rpx;
}

/* Logo区域 */
.logo-section {
  margin-top: 180rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 100rpx;
}

.logo-icon {
  width: 140rpx;
  height: 140rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 28rpx;
  box-shadow: 0 8rpx 32rpx rgba(102, 126, 234, 0.3);
}

.logo-text {
  font-size: 52rpx;
  font-weight: bold;
  color: #fff;
}

.app-name {
  font-size: 44rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 12rpx;
}

.app-desc {
  font-size: 26rpx;
  color: #999;
}

/* 登录方式切换 */
.login-tabs {
  display: flex;
  justify-content: center;
  gap: 60rpx;
  margin-bottom: 40rpx;
}

.tab-item {
  font-size: 30rpx;
  color: #999;
  padding-bottom: 12rpx;
  position: relative;
  transition: color 0.2s;
}

.tab-item.active {
  color: #333;
  font-weight: bold;
}

.tab-line {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40rpx;
  height: 4rpx;
  background: #ff9800;
  border-radius: 2rpx;
}

/* 登录主区域 */
.login-main {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 输入卡片 */
.input-card {
  width: 100%;
  background: #fff;
  border-radius: 16rpx;
  padding: 0 28rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  margin-bottom: 40rpx;
}

.input-row {
  display: flex;
  align-items: center;
  padding: 28rpx 0;
}

.input-label {
  font-size: 28rpx;
  color: #333;
  width: 80rpx;
  flex-shrink: 0;
}

.input-field {
  flex: 1;
  font-size: 28rpx;
  color: #333;
  margin-left: 16rpx;
}

.input-placeholder {
  color: #ccc;
  font-size: 28rpx;
}

.input-divider {
  height: 1rpx;
  background: #f0f0f0;
}

/* 账号登录按钮 */
.account-login-btn {
  width: 100%;
  height: 96rpx;
  background: #ff9800;
  color: #ffffff;
  border-radius: 48rpx;
  font-size: 32rpx;
  font-weight: 500;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(255, 152, 0, 0.3);
  transition: all 0.2s;
}

.account-login-btn::after {
  border: none;
}

.account-login-btn.disabled {
  background: #ccc;
  box-shadow: none;
}

.account-actions {
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin-top: 32rpx;
  padding: 0 20rpx;
}

.action-text {
  font-size: 26rpx;
  color: #999;
}

/* 微信登录按钮 */
.wechat-login-btn {
  width: 100%;
  height: 96rpx;
  background-color: #07c160;
  color: #ffffff;
  border-radius: 48rpx;
  font-size: 32rpx;
  font-weight: 500;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(7, 193, 96, 0.3);
  transition: all 0.2s;
}

.wechat-login-btn::after {
  border: none;
}

.wechat-login-btn.disabled {
  background-color: #ccc;
  box-shadow: none;
}

.wechat-icon-wrap {
  width: 44rpx;
  height: 44rpx;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
}

.wechat-icon-text {
  font-size: 24rpx;
  color: #07c160;
  font-weight: bold;
}

.btn-text {
  color: #fff;
}

/* 隐私政策勾选 */
.privacy-checkbox-section {
  margin-top: 40rpx;
  display: flex;
  justify-content: center;
}

.checkbox-item {
  display: flex;
  align-items: center;
}

.checkbox-text {
  font-size: 24rpx;
  color: #999;
  margin-left: 10rpx;
  line-height: 1.4;
}

.link-text {
  color: #07c160;
}

/* 底部说明 */
.login-footer {
  margin-top: auto;
  padding-bottom: 80rpx;
}

.footer-text {
  font-size: 24rpx;
  color: #bbb;
}

/* 隐私协议弹窗样式 */
.privacy-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.privacy-content {
  background: #fff;
  border-radius: 16rpx;
  width: 80%;
  max-width: 600rpx;
  padding: 40rpx;
}

.privacy-title {
  font-size: 36rpx;
  font-weight: 700;
  text-align: center;
  margin-bottom: 30rpx;
  color: #333;
}

.privacy-body {
  max-height: 600rpx;
  overflow-y: auto;
  margin-bottom: 30rpx;
}

.privacy-text {
  font-size: 28rpx;
  color: #666;
  line-height: 1.6;
  display: block;
  margin-bottom: 20rpx;
}

.privacy-items {
  margin-bottom: 20rpx;
}

.privacy-item {
  display: flex;
  margin-bottom: 16rpx;
}

.item-dot {
  font-size: 28rpx;
  color: #333;
  margin-right: 10rpx;
  flex-shrink: 0;
}

.item-text {
  font-size: 28rpx;
  color: #666;
  line-height: 1.5;
}

.privacy-link {
  font-size: 28rpx;
  color: #4a90e2;
  text-decoration: underline;
  display: block;
  text-align: center;
}

.privacy-actions {
  display: flex;
  gap: 20rpx;
}

.privacy-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}

.privacy-btn.disagree {
  background: #f5f5f5;
  color: #666;
}

.privacy-btn.agree {
  background: #07c160;
  color: #fff;
}

/* 夜间模式 */
.dark-mode .container {
  background-color: #1a1a1a;
}

.dark-mode .app-name {
  color: #e0e0e0;
}

.dark-mode .app-desc {
  color: #666;
}

.dark-mode .checkbox-text {
  color: #999;
}

.dark-mode .link-text {
  color: #4caf50;
}

.dark-mode .footer-text {
  color: #666;
}

.dark-mode .privacy-content {
  background: #2c2c2c;
}

.dark-mode .privacy-title {
  color: #fff;
}

.dark-mode .privacy-text,
.dark-mode .item-text {
  color: #ccc;
}

.dark-mode .item-dot {
  color: #fff;
}

.dark-mode .privacy-btn.disagree {
  background: #444;
  color: #ccc;
}

.dark-mode .tab-item {
  color: #666;
}

.dark-mode .tab-item.active {
  color: #e0e0e0;
}

.dark-mode .input-card {
  background: #2c2c2c;
}

.dark-mode .input-label {
  color: #e0e0e0;
}

.dark-mode .input-field {
  color: #e0e0e0;
}

.dark-mode .input-placeholder {
  color: #555;
}

.dark-mode .input-divider {
  background: #444;
}

.dark-mode .action-text {
  color: #666;
}
</style>
