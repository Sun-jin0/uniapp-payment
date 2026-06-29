<template>
  <view class="container" :class="{ 'dark-mode': isDarkMode }">
    <view class="scroll-content">
      <!-- 修改密码模态框 -->
      <view class="modal-overlay" v-if="showPasswordModal" @click="closePasswordModal">
        <view class="modal-content" @click.stop>
          <view class="modal-header">
            <view class="modal-title">修改密码</view>
            <view class="modal-close" @click="closePasswordModal">×</view>
          </view>
          <view class="modal-body">
            <view class="password-section">
              <view class="section-title">旧密码</view>
              <input 
                class="password-input" 
                type="password" 
                v-model="oldPassword"
                placeholder="请输入旧密码"
              />
            </view>
            
            <view class="password-section">
              <view class="section-title">新密码</view>
              <input 
                class="password-input" 
                type="password" 
                v-model="newPassword"
                placeholder="请输入新密码（至少6位）"
              />
            </view>
            
            <view class="password-section">
              <view class="section-title">确认新密码</view>
              <input 
                class="password-input" 
                type="password" 
                v-model="confirmPassword"
                placeholder="请再次输入新密码"
              />
            </view>
            
            <view class="password-tips">
              <text class="tips-text">密码长度至少6位，包含字母和数字</text>
            </view>
          </view>
          <view class="modal-footer">
            <button class="cancel-btn" @click="closePasswordModal">取消</button>
            <button class="confirm-btn" @click="submitPasswordChange">确定</button>
          </view>
        </view>
      </view>
      
      <!-- 用户头像 -->
      <view class="avatar-card">
        <view class="avatar-wrapper">
          <image class="user-avatar" :src="getFullAvatarUrl(userInfo.avatar)" mode="aspectFill"></image>
          <view class="avatar-edit" @click="chooseAvatar">
            <view class="edit-icon"></view>
          </view>
        </view>
        <view class="avatar-hint">点击更换头像</view>
      </view>

      <!-- 原生模板广告 -->
      <!-- #ifdef MP-WEIXIN -->
      <view class="ad-container-f1d0">
        <ad-custom 
          unit-id="adunit-f1d0e339a07022e6" 
          @load="adLoadF1d0" 
          @error="adErrorF1d0" 
          @close="adCloseF1d0"
        ></ad-custom>
      </view>
      <!-- #endif -->
      
      <!-- 用户信息表单 -->
      <view class="info-group">
        <view class="group-title">基本信息</view>
        <view class="info-card">
          <view class="info-item">
            <view class="item-left">
              <view class="item-icon name-icon"></view>
              <view class="info-label">昵称</view>
            </view>
            <view class="info-content">
              <input class="info-input" v-model="userInfo.nickname" placeholder="设置你的昵称" maxlength="20" />
            </view>
          </view>
          <view class="info-item">
            <view class="item-left">
              <view class="item-icon id-icon"></view>
              <view class="info-label">学号</view>
            </view>
            <view class="info-content">
              <text class="info-text">{{ userInfo.studentId || '未设置' }}</text>
            </view>
          </view>
        </view>
      </view>
      
      <!-- 账户安全 -->
      <view class="security-group">
        <view class="group-title">账户安全</view>
        <view class="info-card">
          <view class="info-item" @click="changePassword">
            <view class="item-left">
              <view class="item-icon password-icon"></view>
              <view class="info-label">修改密码</view>
            </view>
            <view class="item-arrow"></view>
          </view>
        </view>
      </view>

      <!-- 头像框 -->
      <view class="security-group">
        <view class="group-title">头像框</view>
        <view class="info-card">
          <view class="info-item" @click="goToAvatarFrameSelect">
            <view class="item-left">
              <view class="item-icon frame-icon"></view>
              <view class="info-label">选择头像框</view>
            </view>
            <view class="item-arrow"></view>
          </view>
          <view class="current-frame" v-if="currentFrameUrl">
            <text class="frame-label">当前头像框：</text>
            <image class="frame-preview-img" :src="currentFrameUrl" mode="aspectFit"></image>
          </view>
        </view>
      </view>

      <!-- 保存按钮 -->
      <view class="action-section">
        <button class="save-btn" @click="saveUserInfo">保存修改</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, getCurrentInstance } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { checkTextContent } from '@/utils/contentSecurity.js';
import { BASE_URL } from '@/api/request.js';

const instance = getCurrentInstance();

// 原生模板广告事件监听 (adunit-f1d0e339a07022e6)
const adLoadF1d0 = () => {
  console.log('原生模板广告加载成功');
};

const adErrorF1d0 = (err) => {
  console.error('原生模板广告加载失败', err);
};

const adCloseF1d0 = () => {
  console.log('原生模板广告关闭');
};

// 确保头像URL是完整的
const getFullAvatarUrl = (avatar) => {
  if (!avatar) return 'https://picsum.photos/id/1005/100/100';
  // 如果已经是完整URL，直接返回
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar;
  }
  // 否则拼接完整URL
  return BASE_URL + avatar;
};

// 主题状态
const isDarkMode = ref(false);

// 修改密码相关状态
const showPasswordModal = ref(false);
const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');

// 用户信息
const userInfo = reactive({
  avatar: '',
  nickname: '',
  studentId: ''
});

// 头像框相关
const currentFrameUrl = ref('');
const avatarFrameId = ref(null);

// 加载用户信息
const loadUserInfo = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.userApi.getUserInfo();

    if (res.code === 0) {
      const data = res.data;
      userInfo.nickname = data.nickname || '';
      userInfo.avatar = data.avatar || '/avatar/default.jpg';
      userInfo.studentId = data.studentId || '';

      // 加载头像框信息
      avatarFrameId.value = data.avatar_frame_id || null;
      if (avatarFrameId.value) {
        const frameRes = await instance.appContext.config.globalProperties.$api.userApi.getUserAvatarFrames();
        if (frameRes.code === 0 && frameRes.data) {
          const currentFrame = frameRes.data.find(f => f.id === avatarFrameId.value);
          if (currentFrame) {
            currentFrameUrl.value = currentFrame.image_url || '';
          }
        }
      }
    }
  } catch (error) {
    console.error('加载用户信息失败:', error);
  }
};

// 选择头像
const chooseAvatar = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      // 上传头像
      uploadAvatar(res.tempFilePaths[0]);
    }
  });
};

// 上传头像
const uploadAvatar = async (tempFilePath) => {
  try {
    uni.showLoading({ title: '上传中...' });

    // 获取 token
    const token = uni.getStorageSync('token') || '';

    console.log('上传头像开始:', tempFilePath);
    console.log('上传URL:', `${BASE_URL}/user/upload-avatar`);
    console.log('Token:', token ? '已设置' : '未设置');

    // 使用uni.uploadFile上传文件
    uni.uploadFile({
      url: `${BASE_URL}/user/upload-avatar`, // 后端上传接口
      filePath: tempFilePath,
      name: 'avatar',
      header: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (uploadRes) => {
        uni.hideLoading();

        console.log('上传响应状态码:', uploadRes.statusCode);
        console.log('上传响应数据:', uploadRes.data);

        try {
          const res = JSON.parse(uploadRes.data);
          if (res.code === 0) {
            // 确保新头像URL完整
            const newAvatar = getFullAvatarUrl(res.data.avatar);
            userInfo.avatar = res.data.avatar;

            // 更新本地存储的头像
            uni.setStorageSync('userAvatar', newAvatar);

            uni.showToast({ title: '头像更新成功', icon: 'success' });

            // 发送事件通知其他页面更新头像
            uni.$emit('avatarUpdated', newAvatar);
          } else {
            uni.showToast({ title: '上传失败: ' + res.message, icon: 'none' });
          }
        } catch (error) {
          console.error('解析上传响应失败:', error, uploadRes.data);
          uni.showToast({ title: '上传失败: 服务器返回数据格式错误', icon: 'none' });
        }
      },
      fail: (error) => {
        uni.hideLoading();
        console.error('上传头像失败:', error);
        uni.showToast({ title: '上传失败: ' + (error.errMsg || '网络错误'), icon: 'none' });
      }
    });
  } catch (error) {
    uni.hideLoading();
    console.error('上传头像失败:', error);
    uni.showToast({ title: '上传失败', icon: 'none' });
  }
};

// 保存用户信息
const saveUserInfo = async () => {
  try {
    // 先检测昵称内容
    if (userInfo.nickname && userInfo.nickname.trim()) {
      uni.showLoading({
        title: '内容检测中...'
      });
      
      const checkResult = await checkTextContent(userInfo.nickname);
      
      if (!checkResult.isSafe) {
        uni.hideLoading();
        uni.showToast({
          title: checkResult.message,
          icon: 'none',
          duration: 3000
        });
        return;
      }
    }
    
    uni.showLoading({
      title: '保存中...'
    });
    
    const res = await instance.appContext.config.globalProperties.$api.userApi.updateUserInfo({
      nickname: userInfo.nickname
    });
    
    uni.hideLoading();
    
    if (res.code === 0) {
      uni.showToast({
        title: '保存成功',
        icon: 'success'
      });
      
      // 返回上一页
      setTimeout(() => {
        uni.navigateBack();
      }, 1500);
    }
  } catch (error) {
    uni.hideLoading();
    console.error('保存用户信息失败:', error);
    uni.showToast({
      title: '保存失败',
      icon: 'none'
    });
  }
};

// 打开修改密码模态框
const changePassword = () => {
  showPasswordModal.value = true;
};

// 跳转到头像框选择页面
const goToAvatarFrameSelect = () => {
  uni.navigateTo({
    url: '/pages/profile/avatar-frame-select'
  });
};

// 关闭修改密码模态框
const closePasswordModal = () => {
  showPasswordModal.value = false;
  oldPassword.value = '';
  newPassword.value = '';
  confirmPassword.value = '';
};

// 提交密码修改
const submitPasswordChange = async () => {
  // 验证旧密码
  if (!oldPassword.value) {
    uni.showToast({
      title: '请输入旧密码',
      icon: 'none'
    });
    return;
  }
  
  // 验证新密码
  if (!newPassword.value) {
    uni.showToast({
      title: '请输入新密码',
      icon: 'none'
    });
    return;
  }
  
  if (newPassword.value.length < 6) {
    uni.showToast({
      title: '新密码长度至少6位',
      icon: 'none'
    });
    return;
  }
  
  // 验证新密码格式（包含字母和数字）
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,}$/;
  if (!passwordRegex.test(newPassword.value)) {
    uni.showToast({
      title: '新密码必须包含字母和数字',
      icon: 'none'
    });
    return;
  }
  
  // 验证确认密码
  if (newPassword.value !== confirmPassword.value) {
    uni.showToast({
      title: '两次输入的密码不一致',
      icon: 'none'
    });
    return;
  }
  
  try {
    uni.showLoading({
      title: '修改中...',
      mask: true
    });
    
    const res = await instance.appContext.config.globalProperties.$api.userApi.changePassword({
      oldPassword: oldPassword.value,
      newPassword: newPassword.value
    });
    
    uni.hideLoading();
    
    if (res.code === 0) {
      uni.showToast({
        title: '密码修改成功',
        icon: 'success'
      });
      
      // 关闭模态框并重置表单
      closePasswordModal();
    }
  } catch (error) {
    uni.hideLoading();
    console.error('修改密码失败:', error);
    uni.showToast({
      title: '修改失败',
      icon: 'none'
    });
  }
};

// 初始化主题状态
onMounted(async () => {
  // 从本地存储获取当前主题模式，默认白天模式
  const currentTheme = uni.getStorageSync('themeMode') || 'light';
  isDarkMode.value = currentTheme === 'dark';
  
  // 监听主题变化事件
  uni.$on('themeChange', (darkMode) => {
    isDarkMode.value = darkMode;
  });
  
  // 监听头像更新事件
  uni.$on('avatarUpdated', (newAvatar) => {
    if (newAvatar) {
      userInfo.avatar = newAvatar;
      uni.setStorageSync('userAvatar', newAvatar);
    }
  });
  
  // 加载用户信息
  await loadUserInfo();
});

onUnmounted(() => {
  uni.$off('themeChange');
  uni.$off('avatarUpdated');
});

// 每次显示页面时刷新用户信息
onShow(() => {
  loadUserInfo();
});
</script>

<style>
/* 原生模板广告容器 (f1d0) */
.ad-container-f1d0 {
  margin: 20rpx 0;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.container {
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  min-height: 100vh;
}

.scroll-content {
  padding: 40rpx 32rpx;
  max-width: 960rpx;
  margin: 0 auto;
}

/* 头像卡片 */
.avatar-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 48rpx;
  box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.05);
  margin-bottom: 48rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.4);
}

.avatar-wrapper {
  position: relative;
  margin-bottom: 28rpx;
  width: 300rpx;
  height: 300rpx;
  display: flex;
  justify-content: center;
  align-items: center;
}

.user-avatar {
  width: 280rpx;
  height: 280rpx;
  border-radius: 50%;
  border: 10rpx solid #ffffff;
  box-shadow: 0 16rpx 40rpx rgba(0, 0, 0, 0.1);
}

.avatar-edit {
  position: absolute;
  bottom: 20rpx;
  right: 20rpx;
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background-color: #6366f1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 6rpx solid #ffffff;
  box-shadow: 0 8rpx 20rpx rgba(99, 102, 241, 0.4);
  transition: all 0.2s;
}

.avatar-edit:active {
  transform: scale(0.9);
}

.edit-icon {
  width: 32rpx;
  height: 32rpx;
  background-color: white;
  mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>') no-repeat center;
  -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>') no-repeat center;
  mask-size: contain;
  -webkit-mask-size: contain;
}

.avatar-hint {
  font-size: 28rpx;
  color: #6366f1;
  font-weight: 600;
  letter-spacing: 1rpx;
}

/* 信息卡片组 */
.info-group, .security-group {
  margin-bottom: 48rpx;
}

.group-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1e293b;
  margin-left: 12rpx;
  margin-bottom: 28rpx;
  display: flex;
  align-items: center;
}

.group-title::before {
  content: '';
  width: 10rpx;
  height: 36rpx;
  background: linear-gradient(to bottom, #6366f1, #818cf8);
  border-radius: 6rpx;
  margin-right: 20rpx;
}

.info-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 40rpx;
  padding: 8rpx 40rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.03);
  border: 1rpx solid rgba(255, 255, 255, 0.4);
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 40rpx 0;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}

.item-left {
  display: flex;
  align-items: center;
}

.item-icon {
  width: 44rpx;
  height: 44rpx;
  margin-right: 24rpx;
  background-color: #6366f1;
  mask-size: contain;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  -webkit-mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-position: center;
}

.name-icon {
  mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>');
  -webkit-mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>');
}

.id-icon {
  mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 11h-2v-2h2v2zm0-4h-2V7h2v3zm4 4h-2v-2h2v2zm0-4h-2V7h2v3z"/></svg>');
  -webkit-mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 11h-2v-2h2v2zm0-4h-2V7h2v3zm4 4h-2v-2h2v2zm0-4h-2V7h2v3z"/></svg>');
}

.password-icon {
  mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"/></svg>');
  -webkit-mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"/></svg>');
}

.frame-icon {
  mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM12 10.5c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5z"/></svg>');
  -webkit-mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM12 10.5c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5z"/></svg>');
  background-color: #6366f1;
}

.current-frame {
  display: flex;
  align-items: center;
  padding: 20rpx 30rpx;
  border-top: 1rpx solid #f0f0f0;
}

.frame-label {
  font-size: 28rpx;
  color: #64748b;
}

.frame-preview-img {
  width: 120rpx;
  height: 70rpx;
  margin-left: 20rpx;
}

.info-label {
  font-size: 32rpx;
  color: #334155;
  font-weight: 600;
}

.info-content {
  flex: 1;
  text-align: right;
  margin-left: 40rpx;
}

.info-input {
  font-size: 32rpx;
  color: #475569;
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
}

.info-text {
  font-size: 32rpx;
  color: #94a3b8;
}

.item-arrow {
  width: 40rpx;
  height: 40rpx;
  background-color: #94a3b8;
  mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>') no-repeat center;
  -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>') no-repeat center;
  mask-size: contain;
  -webkit-mask-size: contain;
  margin-left: 12rpx;
}

/* 操作区域 */
.action-section {
  margin-top: 100rpx;
  padding: 0 16rpx;
}

.save-btn {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  height: 110rpx;
  line-height: 110rpx;
  border-radius: 36rpx;
  font-size: 34rpx;
  font-weight: 700;
  box-shadow: 0 16rpx 32rpx rgba(99, 102, 241, 0.3);
  border: none;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.save-btn:active {
  transform: translateY(4rpx);
  box-shadow: 0 8rpx 16rpx rgba(99, 102, 241, 0.2);
  opacity: 0.95;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 40rpx;
}

.modal-content {
  width: 100%;
  background: #ffffff;
  border-radius: 48rpx;
  overflow: hidden;
  box-shadow: 0 20rpx 50rpx rgba(0, 0, 0, 0.2);
  animation: modalIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalIn {
  from { transform: scale(0.9) translateY(40rpx); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

.modal-header {
  padding: 40rpx 48rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid #f1f5f9;
}

.modal-title {
  font-size: 36rpx;
  font-weight: 800;
  color: #1e293b;
}

.modal-close {
  font-size: 56rpx;
  color: #94a3b8;
  line-height: 1;
}

.modal-body {
  padding: 48rpx;
}

.password-section {
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 28rpx;
  color: #64748b;
  margin-bottom: 12rpx;
  font-weight: 600;
}

.password-input {
  height: 88rpx;
  background: #f8fafc;
  border-radius: 24rpx;
  padding: 0 32rpx;
  font-size: 30rpx;
  border: 2rpx solid #e2e8f0;
  transition: all 0.3s;
}

.password-input:focus {
  border-color: #6366f1;
  background: #ffffff;
}

.password-tips {
  margin-top: 24rpx;
  background: #f0fdf4;
  padding: 16rpx 24rpx;
  border-radius: 16rpx;
}

.tips-text {
  font-size: 24rpx;
  color: #16a34a;
}

.modal-footer {
  padding: 0 48rpx 48rpx;
  display: flex;
  gap: 24rpx;
}

.modal-footer button {
  flex: 1;
  height: 100rpx;
  line-height: 100rpx;
  border-radius: 24rpx;
  font-size: 30rpx;
  font-weight: 700;
}

.cancel-btn {
  background: #f1f5f9;
  color: #64748b;
  border: none;
}

.confirm-btn {
  background: #6366f1;
  color: white;
  border: none;
  box-shadow: 0 8rpx 16rpx rgba(99, 102, 241, 0.2);
}

/* 夜间模式适配 */
.dark-mode .container { background: #0f172a; }
.dark-mode .avatar-card,
.dark-mode .info-card { background: rgba(30, 41, 59, 0.7); border-color: rgba(255, 255, 255, 0.1); }
.dark-mode .modal-content { background: #1e293b; }
.dark-mode .info-label,
.dark-mode .modal-title,
.dark-mode .group-title { color: #f1f5f9; }
.dark-mode .info-input,
.dark-mode .password-input { color: #cbd5e1; background: #0f172a; border-color: #334155; }
.dark-mode .info-text { color: #64748b; }
.dark-mode .item-icon { background-color: #818cf8; }
.dark-mode .avatar-hint { color: #818cf8; }
.dark-mode .section-title { color: #94a3b8; }
.dark-mode .modal-header { border-bottom-color: #334155; }
.dark-mode .cancel-btn { background: #334155; color: #94a3b8; }
.dark-mode .password-tips { background: rgba(22, 163, 74, 0.1); }
.dark-mode .tips-text { color: #4ade80; }
</style>