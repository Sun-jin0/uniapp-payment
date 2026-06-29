<template>
  <view class="container" :class="{ 'dark-mode': isDarkMode }">
    <view class="scroll-content">
      <!-- 未登录状态 -->
      <view v-if="!isLoggedIn" class="unlogin-container">
        <view class="unlogin-card">
          <view class="unlogin-avatar">
            <view class="default-avatar">?</view>
          </view>
          <text class="unlogin-title">未登录</text>
          <text class="unlogin-desc">登录后可查看个人数据和使用更多功能</text>
          <button class="login-btn" @click="goToLogin">立即登录</button>
        </view>
      </view>
      
      <!-- 已登录状态 -->
      <template v-else>
        <!-- 用户信息卡片 (玻璃拟态效果) -->
        <view class="user-profile-header">
          <view class="user-card-glass">
            <view class="avatar-section">
              <view class="avatar-frame-container" @click="goToAvatarFrameSelect">
                <image v-if="avatarFrameUrl" class="avatar-frame" :src="avatarFrameUrl" mode="aspectFit"></image>
                <image class="main-avatar" :src="userAvatar || 'https://picsum.photos/id/1005/100/100'" mode="aspectFill"></image>
              </view>
            </view>
            <view class="info-section">
              <view class="name-row">
                <text class="user-name" style="max-width: 280rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ userName }}</text>
                <view class="vip-badge" v-if="userLevel >= 5">PRO</view>
                <view class="member-badge" v-if="membership && membership.status === 'active'" @click.stop="goToMembershipCenter">
                  <text class="member-icon">VIP</text>
                </view>
                <view class="member-badge expired" v-else-if="membership && membership.status !== 'active'" @click.stop="goToMembershipCenter">
                  <text class="member-icon">VIP</text>
                </view>
              </view>
              <view class="id-row">
                <text class="user-id">ID: {{ userId || '---' }}</text>
                <button class="copy-btn" @click="copyUserId">复制</button>
              </view>
              <view class="rank-row" v-if="questionRank > 0">
                <view class="level-tag">Lv.{{ userLevel }}</view>
                <text class="rank-label">刷题排名: </text>
                <text class="rank-value">{{ questionRank }}名</text>
              </view>
              <view class="member-info-row" v-if="membership" @click="goToMembershipCenter">
                <text class="member-info">{{ membership.status === 'active' ? '剩余 ' + remainDays + ' 天 · 到期 ' + formatDate(membership.expire_at) : '到期 ' + formatDate(membership.expire_at) }}</text>
              </view>
            </view>
            <view class="edit-btn" @click="editProfile">
              <view class="edit-icon"></view>
            </view>
          </view>
        </view>
        
        <!-- 学习数据简报 -->
        <view class="stats-container">
          <view class="stats-card">
            <view class="stat-box" @click="viewStats">
              <text class="stat-num">{{ totalQuestions }}</text>
              <text class="stat-label">刷题数</text>
            </view>
            <view class="stat-divider"></view>
            <view class="stat-box" @click="viewStats">
              <text class="stat-num">{{ questionRank > 0 ? questionRank : '---' }}</text>
              <text class="stat-label">刷题排名</text>
            </view>
            <view class="stat-divider"></view>
            <view class="stat-box" @click="viewStats">
              <text class="stat-num">{{ practiceDays }}</text>
              <text class="stat-label">坚持天数</text>
            </view>
          </view>
        </view>
        
        <!-- 功能菜单区域 -->
        <view class="menu-container">
          <!-- 快捷功能入口 -->
          <view class="quick-menu-row">
            <view class="quick-menu-item" @click="goToPrintMiniProgram">
              <view class="quick-icon-box print-bg">
                <view class="quick-inner-icon print"></view>
              </view>
              <text class="quick-label">打印资料</text>
            </view>
            <view class="quick-menu-item" @click="goToQQGroups">
              <view class="quick-icon-box qq-bg">
                <view class="quick-inner-icon qq"></view>
              </view>
              <text class="quick-label">Q群讨论</text>
            </view>
            <view class="quick-menu-item" @click="goToCheckin">
              <view class="quick-icon-box checkin-bg">
                <view class="quick-inner-icon checkin"></view>
              </view>
              <text class="quick-label">每日打卡</text>
            </view>
            <view class="quick-menu-item" @tap="goToDrawCard">
              <view class="quick-icon-box relax-bg">
                <view class="quick-inner-icon relax"></view>
              </view>
              <text class="quick-label">放松一下</text>
            </view>
          </view>
          
          <!-- 核心功能组 -->
          <view class="menu-group-card">
            <view class="menu-item-row" @click="goToMembershipCenter">
              <view class="icon-box membership-bg">
                <view class="inner-icon membership"></view>
              </view>
              <text class="item-label">会员中心</text>
              <view class="item-arrow"></view>
            </view>
            <view class="menu-divider"></view>
            <view class="menu-item-row" @click="goToRanking">
              <view class="icon-box ranking-bg">
                <view class="inner-icon ranking"></view>
              </view>
              <text class="item-label">排行榜</text>
              <view class="item-arrow"></view>
            </view>
            <view class="menu-divider"></view>
            <view class="menu-item-row" @click="goToMyCollections">
              <view class="icon-box collection-bg">
                <view class="inner-icon collection"></view>
              </view>
              <text class="item-label">我的收藏</text>
              <view class="item-arrow"></view>
            </view>
            <view class="menu-divider"></view>
            <view class="menu-item-row" @click="showRewardModal">
              <view class="icon-box reward-bg">
                <view class="inner-icon reward"></view>
              </view>
              <text class="item-label">赞赏支持</text>
              <view class="item-arrow"></view>
            </view>
          </view>

          <!-- 设置与隐私组 -->
          <view class="menu-group-card">
            <view class="menu-item-row" @click="goToPrivacyPolicy">
              <view class="icon-box privacy-bg">
                <view class="inner-icon privacy"></view>
              </view>
              <text class="item-label">隐私政策</text>
              <view class="item-arrow"></view>
            </view>
          </view>

          <!-- 赞赏弹窗 -->
          <view class="modal" v-if="showReward" @tap="closeRewardModal">
            <view class="modal-box reward-box" @tap.stop>
              <text class="modal-title">赞赏支持</text>
              <text class="modal-subtitle">感谢你的支持，我们会继续努力！</text>
              <image class="reward-qrcode" src="https://s3.hi168.com/hi168-26998-7111ilq6/uploads/1776400965165-u9b90x.jpg" mode="aspectFit" show-menu-by-longpress></image>
              <text class="reward-tip">长按识别二维码赞赏</text>
              <button class="close-btn" @tap="closeRewardModal">关闭</button>
            </view>
          </view>

          <!-- 退出操作 -->
          <view class="logout-area" @click="logout">
            <text class="logout-text">退出登录</text>
          </view>
        </view>

      </template>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted, getCurrentInstance, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { copyToClipboard } from '@/utils/clipboard.js';
import membershipApi from '@/api/membership.js';
const instance = getCurrentInstance();

// 用户信息
const userName = ref('考生');
const userId = ref('');
const userLevel = ref(1);
const totalQuestions = ref(0);
const correctRate = ref(0);
const practiceDays = ref(0);
const totalScore = ref(0);
const couponCount = ref(3);
const isDarkMode = ref(false);
const statusBarHeight = ref(0);
const userAvatar = ref('');
const avatarFrameUrl = ref('');
const avatarFrameId = ref(null);
// 排名信息
const questionRank = ref(0);
// 登录状态
const isLoggedIn = ref(false);
// 赞赏弹窗显示状态
const showReward = ref(false);
// 会员信息
const membership = ref(null);

const remainDays = computed(() => {
  if (!membership.value || membership.value.status !== 'active') return 0;
  const expire = new Date(membership.value.expire_at);
  const now = new Date();
  return Math.max(0, Math.ceil((expire - now) / (24 * 60 * 60 * 1000)));
});

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 检查登录状态
const checkLoginStatus = () => {
  const token = uni.getStorageSync('token');
  isLoggedIn.value = !!token;
  return isLoggedIn.value;
};

// 跳转到登录页
const goToLogin = () => {
  uni.navigateTo({
    url: '/pages/login/login'
  });
};

// 加载用户信息
const loadUserInfo = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.userApi.getUserInfo();
    if (res.code === 0) {
      userName.value = res.data.nickname || res.data.username || '考生';
      userId.value = res.data.studentId || res.data.userId || '';
      totalQuestions.value = res.data.totalQuestions || 0;
      correctRate.value = Math.min(100, Math.round((res.data.correctRate || 0) * 100));
      totalScore.value = res.data.totalScore || 0;
      // 计算用户等级：10级以前每20个题加一个等级，超过10级每50个题加一个等级
      const calcLevel = (questions) => {
        if (questions < 200) {
          return Math.floor(questions / 20) + 1;
        } else {
          return 10 + Math.floor((questions - 200) / 50);
        }
      };
      userLevel.value = res.data.level || calcLevel(res.data.totalQuestions || 0);
      // 优先使用本地存储的头像（避免缓存问题）
      const localAvatar = uni.getStorageSync('userAvatar');
      userAvatar.value = localAvatar || res.data.avatar || '';
      
      // 保存头像框ID
      avatarFrameId.value = res.data.avatar_frame_id || null;
      
      // 加载头像框信息
      if (avatarFrameId.value) {
        const frameRes = await instance.appContext.config.globalProperties.$api.userApi.getUserAvatarFrames();
        if (frameRes.code === 0 && frameRes.data) {
          const currentFrame = frameRes.data.find(f => f.id === avatarFrameId.value);
          if (currentFrame) {
            avatarFrameUrl.value = currentFrame.image_url || '';
          }
        }
      }
      
      // 加载排行榜数据获取排名
      const rankRes = await instance.appContext.config.globalProperties.$api.wrongBookApi.getLeaderboard('questions', 'all');
      if (rankRes.code === 0 && rankRes.data && rankRes.data.myRank) {
        questionRank.value = rankRes.data.myRank.rank || 0;
      } else {
        questionRank.value = res.data.questionRank || 0;
      }
      console.log('用户信息:', res.data);
    }
  } catch (error) {
    console.error('加载用户信息失败:', error);
  }
};

// 加载学习数据获取坚持天数
const loadStudyData = async () => {
  try {
    // 从用户信息获取答题天数
    const res = await instance.appContext.config.globalProperties.$api.userApi.getUserInfo();
    if (res.code === 0) {
      // 使用连续答题天数或总答题天数
      practiceDays.value = res.data.streakDays || res.data.totalDays || 0;
    }
  } catch (error) {
    console.error('加载学习数据失败:', error);
  }
};

// 编辑资料
const editProfile = () => {
  uni.navigateTo({
    url: '/pages/user-info/user-info'
  });
};

// 查看统计
const viewStats = () => {
  // 显示学习统计信息
  uni.showModal({
    title: '学习统计',
    content: `总题量: ${totalQuestions.value}\n正确率: ${correctRate.value}%\n练习天数: ${practiceDays.value}\n总积分: ${totalScore.value}`,
    showCancel: false,
    confirmText: '确定'
  });
};

// 复制用户ID
const copyUserId = async () => {
  if (userId.value) {
    await copyToClipboard(userId.value, {
      successMsg: '复制成功',
      showModal: false
    });
  }
};

// 跳转到我的收藏
const goToMyCollections = () => {
  uni.navigateTo({
    url: '/pages/article/my-collections'
  });
};

// 跳转到打卡页面
const goToCheckin = () => {
  uni.navigateTo({
    url: '/pages/checkin/checkin-home'
  });
};

// 跳转到抽卡页面
const goToDrawCard = () => {
  console.log('点击了放松一下按钮');
  uni.navigateTo({
    url: '/pages/draw-card/draw-card',
    success: () => {
      console.log('跳转成功');
    },
    fail: (err) => {
      console.error('跳转失败:', err);
    }
  });
};

// 切换主题模式
const toggleTheme = (e) => {
  // 获取开关的实际状态
  const newStatus = e.detail.value;
  isDarkMode.value = newStatus;
  // 保存到本地存储
  uni.setStorageSync('themeMode', newStatus ? 'dark' : 'light');
  // 发送主题变化事件给app.vue
  uni.$emit('themeChange', newStatus);
  
  // 显示状态变化反馈
  uni.showToast({
    title: newStatus ? '已开启夜间模式' : '已关闭夜间模式',
    icon: 'success'
  });
};

// 加载会员信息
const loadMembershipInfo = async () => {
  try {
    const res = await membershipApi.getMyMembership();
    if (res.code === 0) {
      membership.value = res.data;
    }
  } catch (e) {
    console.error('加载会员信息失败:', e);
  }
};

// 加载页面数据
const loadPageData = () => {
  // 检查登录状态
  checkLoginStatus();

  // 如果已登录，加载用户数据
  if (isLoggedIn.value) {
    loadUserInfo();
    loadStudyData();
    loadMembershipInfo();
  }
};

// 头像框动画定时器
let frameAnimationTimer = null;
let glowColor = { r: 59, g: 130, b: 246 }; // 默认蓝色

// 提取图片主色调
const extractImageColor = (imageSrc) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 50;
      canvas.height = 50;
      ctx.drawImage(img, 0, 0, 50, 50);
      
      const imageData = ctx.getImageData(0, 0, 50, 50);
      const data = imageData.data;
      let r = 0, g = 0, b = 0, count = 0;
      
      // 采样像素计算平均颜色
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha > 128) { // 只计算不透明像素
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
      }
      
      if (count > 0) {
        resolve({
          r: Math.round(r / count),
          g: Math.round(g / count),
          b: Math.round(b / count)
        });
      } else {
        resolve({ r: 59, g: 130, b: 246 });
      }
    };
    img.onerror = () => resolve({ r: 59, g: 130, b: 246 });
    img.src = imageSrc;
  });
};

// 更新光晕颜色
const updateGlowColor = async () => {
  const frameEl = document.querySelector('.avatar-frame');
  if (frameEl) {
    const src = frameEl.getAttribute('src');
    if (src) {
      glowColor = await extractImageColor(src);
      // 应用颜色到CSS变量
      document.documentElement.style.setProperty('--glow-r', glowColor.r);
      document.documentElement.style.setProperty('--glow-g', glowColor.g);
      document.documentElement.style.setProperty('--glow-b', glowColor.b);
    }
  }
};

// 启动头像框循环动画
const startFrameAnimation = () => {
  // 微信小程序中不需要浏览器端的动画逻辑
};

// 初始化主题状态
onMounted(() => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight || 0;
  
  // 加载页面数据
  loadPageData();
  
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
      uni.setStorageSync('userAvatar', newAvatar);
      userAvatar.value = newAvatar;
    } else if (isLoggedIn.value) {
      loadUserInfo();
    }
  });
  
  // 启动头像框循环动画
  startFrameAnimation();
});

// 每次显示页面时检查登录状态（解决缓存问题）
onShow(() => {
  loadPageData();
});

onUnmounted(() => {
  uni.$off('themeChange');
  uni.$off('avatarUpdated');
  // 清除头像框动画定时器
  if (frameAnimationTimer) {
    clearInterval(frameAnimationTimer);
    frameAnimationTimer = null;
  }
});

// 跳转到设置
const goToSettings = () => {
  uni.navigateTo({
    url: '/pages/settings/settings'
  });
};



// 跳转到管理员后台




// 跳转到头像框选择页面
const goToAvatarFrameSelect = () => {
  uni.navigateTo({
    url: '/pages/profile/avatar-frame-select'
  });
};

// 跳转到排行榜
const goToRanking = () => {
  uni.navigateTo({
    url: '/pages/ranking/ranking'
  });
};

// 跳转到隐私政策
const goToPrivacyPolicy = () => {
  uni.navigateTo({
    url: '/pages/profile/privacy-policy'
  });
};

// 跳转到刺猬打印小程序
const goToPrintMiniProgram = () => {
  uni.navigateToMiniProgram({
    appId: 'wx9580c9208762a7c5',
    path: 'pages/index/index?scene=dc%3D497866710783758336',
    success(res) {
      console.log('跳转刺猬打印小程序成功');
    },
    fail(err) {
      console.error('跳转刺猬打印小程序失败:', err);
      uni.showToast({
        title: '跳转失败，请重试',
        icon: 'none'
      });
    }
  });
};

// 跳转到Q群讨论
const goToQQGroups = () => {
  uni.navigateTo({
    url: '/pages/qq-group/qq-group-list'
  });
};

// 退出登录
const logout = () => {
  uni.showModal({
    title: '确认退出',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        // 清除本地存储的登录信息
        uni.removeStorageSync('token');
        uni.removeStorageSync('userInfo');
        
        // 跳转到登录页面
        uni.reLaunch({
          url: '/pages/login/login'
        });
      }
    }
  });
};

// 显示赞赏弹窗
const showRewardModal = () => {
  showReward.value = true;
};

// 关闭赞赏弹窗
const closeRewardModal = () => {
  showReward.value = false;
};

const goToMembershipCenter = () => {
  uni.navigateTo({
    url: '/pages/membership/membership-center'
  });
};

</script>

<style>
/* 用户资料头部 */
.user-profile-header {
  padding: 40rpx 30rpx;
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  border-radius: 0 0 60rpx 60rpx;
}

.user-card-glass {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 40rpx;
  padding: 40rpx;
  display: flex;
  align-items: center;
  position: relative;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.1);
}

.avatar-section {
  position: relative;
  margin-right: 30rpx;
}

.avatar-frame-container {
  position: relative;
  width: 140rpx;
  height: 140rpx;
}

.main-avatar {
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  border: 6rpx solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.1);
}

.avatar-frame {
  position: absolute;
  bottom: -10rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 170rpx;
  height: 60rpx;
  z-index: 100;
  pointer-events: none;
  display: block;
  animation: frameEntrance 0.8s ease-out;
}

.avatar-frame.repeat-animation {
  animation: frameEntrance 0.8s ease-out;
}

@keyframes frameEntrance {
  0% {
    opacity: 0;
    transform: translateX(-50%) scale(0.5) rotate(-10deg);
  }
  50% {
    transform: translateX(-50%) scale(1.1) rotate(5deg);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) scale(1) rotate(0deg);
  }
}

:root {
  --glow-r: 59;
  --glow-g: 130;
  --glow-b: 246;
}

@keyframes frameGlow {
  0%, 100% {
    filter: drop-shadow(0 0 5rpx rgba(var(--glow-r), var(--glow-g), var(--glow-b), 0.6));
  }
  50% {
    filter: drop-shadow(0 0 20rpx rgba(var(--glow-r), var(--glow-g), var(--glow-b), 0.9)) 
            drop-shadow(0 0 40rpx rgba(var(--glow-r), var(--glow-g), var(--glow-b), 0.7));
  }
}

.level-tag {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  color: white;
  font-size: 18rpx;
  font-weight: 600;
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
  margin-right: 10rpx;
}

.member-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ff9800;
  padding: 2rpx 8rpx;
  border-radius: 8rpx;
}

.member-badge.expired {
  background: #9ca3af;
}

.member-icon {
  font-size: 18rpx;
  font-weight: bold;
  color: #fff;
}

.member-info-row {
  margin-top: 6rpx;
  margin-bottom: 2rpx;
}

.member-info {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.85);
}

.rank-row {
  display: flex;
  align-items: center;
  gap: 6rpx;
  margin-top: 4rpx;
}

.rank-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.8);
}

.rank-value {
  font-size: 24rpx;
  font-weight: 600;
  color: #fbbf24;
}

.info-section {
  flex: 1;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.user-name {
  font-size: 40rpx;
  font-weight: bold;
  color: white;
}

.vip-badge {
  background: rgba(255, 255, 255, 0.3);
  color: white;
  font-size: 18rpx;
  font-weight: bold;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.user-id {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}



.edit-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
}

.edit-icon {
  width: 30rpx;
  height: 30rpx;
  background-color: white;
  mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>') no-repeat center;
  -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>') no-repeat center;
  mask-size: contain;
  -webkit-mask-size: contain;
}

/* 统计卡片 */
.stats-container {
  margin-top: -40rpx;
  padding: 0 30rpx;
}

.stats-card {
  background: white;
  border-radius: 30rpx;
  padding: 20rpx;
  display: flex;
  justify-content: space-around;
  align-items: center;
  box-shadow: 0 10rpx 20rpx rgba(0, 0, 0, 0.05);
  margin-bottom: 20rpx;
}

.stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 100rpx;
}

.stat-num {
  font-size: 32rpx;
  font-weight: 800;
  color: #1f2937;
  margin-bottom: 2rpx;
}

.stat-label {
  font-size: 20rpx;
  color: #6b7280;
}

.stat-divider {
  width: 2rpx;
  height: 30rpx;
  background-color: #f3f4f6;
}

/* 菜单列表 */
.menu-container {
  padding: 30rpx;
}

/* 快捷功能入口 */
.quick-menu-row {
  display: flex;
  justify-content: space-between;
  background: white;
  border-radius: 30rpx;
  padding: 20rpx 20rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.02);
}

.quick-menu-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.quick-icon-box {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8rpx;
}

.quick-inner-icon {
  width: 36rpx;
  height: 36rpx;
  background-color: white;
  mask-size: contain;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  -webkit-mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-position: center;
}

.quick-label {
  font-size: 24rpx;
  color: #333;
}

.menu-group-card {
  background: white;
  border-radius: 30rpx;
  padding: 10rpx 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.02);
}

.menu-item-row {
  display: flex;
  align-items: center;
  padding: 30rpx 0;
  border-bottom: 1rpx solid #f9fafb;
}

.menu-item-row:last-child {
  border-bottom: none;
}

.icon-box {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
}

.inner-icon {
  width: 36rpx;
  height: 36rpx;
  background-color: white;
  mask-size: contain;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  -webkit-mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-position: center;
}

.video-bg { background: #fee2e2; }
.video { background-color: #ef4444; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 .61-.03 1.3-.1 2.1-.06.8-.15 1.43-.28 1.9-.13.47-.31.81-.54 1.05s-.54.38-1 .44c-.45.06-1.07.1-1.85.11-.78.01-1.4.01-1.86.01L12 18c-3.69 0-5.74-.03-6.14-.1-.45-.06-.79-.21-1.03-.44s-.41-.58-.54-1.05c-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L4 12c0-.61.03-1.3.1-2.1.06-.8.15-1.43.28-1.9.13-.47.31-.81.54-1.05s.54-.38 1-.44c.45-.06 1.07-.1 1.85-.11.78-.01 1.4-.01 1.86-.01L12 6c3.69 0 5.74.03 6.14.1.45.06.79.21 1.03.44s.41.58.54 1.05z"/></svg>'); }

.redeem-bg { background: #fef3c7; }
.redeem { background-color: #f59e0b; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.65-.5-.65C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/></svg>'); }

.ranking-bg { background: #dcfce7; }
.ranking { background-color: #10b981; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.5 21H2V9h5.5v12zm7.25 0h-5.5V3h5.5v18zm7.25 0h-5.5v-9H22v9z"/></svg>'); }

.collection-bg { background: #fef3c7; }
.collection { background-color: #f59e0b; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>'); }

.checkin-bg { background: #e0e7ff; }
.checkin { background-color: #6366f1; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'); }

.relax-bg { background: #fce7f3; }
.relax { background-color: #ec4899; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>'); }

.qq-bg { background: #e0f2fe; }
.qq { background-color: #0ea5e9; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>'); }

.privacy-bg { background: #e0e7ff; }
.privacy { background-color: #6366f1; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>'); }

.print-bg { background: #fef3c7; }
.print { background-color: #f59e0b; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>'); }

.reward-bg { background: #fee2e2; }
.reward { background-color: #ef4444; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'); }

.item-badge {
  padding: 4rpx 16rpx;
  background: #fef3c7;
  border-radius: 20rpx;
  font-size: 24rpx;
  color: #f59e0b;
  margin-right: 16rpx;
}

.item-badge.completed {
  background: #dcfce7;
  color: #10b981;
}

.night-bg { background: #f3f4f6; }
.night { background-color: #4b5563; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>'); }

.feedback-bg { background: #f3f4f6; }
.feedback { background-color: #4b5563; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z"/></svg>'); }

.item-label {
  flex: 1;
  font-size: 28rpx;
  color: #374151;
  font-weight: 500;
}

.item-arrow {
  width: 16rpx;
  height: 16rpx;
  border-top: 3rpx solid #d1d5db;
  border-right: 3rpx solid #d1d5db;
  transform: rotate(45deg);
}

.logout-area {
  margin-top: 20rpx;
  padding: 30rpx;
  text-align: center;
  background: white;
  border-radius: 30rpx;
}

.logout-text {
  color: #ef4444;
  font-size: 28rpx;
  font-weight: 600;
}

/* 夜间模式适配 */
.dark-mode .user-profile-header {
  background: linear-gradient(135deg, #312e81 0%, #4c1d95 100%);
}

.dark-mode .stats-card,
.dark-mode .menu-group-card,
.dark-mode .logout-area {
  background: #1f2937;
}

.dark-mode .stat-num,
.dark-mode .item-label,
.dark-mode .user-name {
  color: #f9fafb;
}

.dark-mode .stat-label,
.dark-mode .user-id {
  color: #9ca3af;
}

.dark-mode .menu-item-row {
  border-bottom-color: #374151;
}

.dark-mode .stat-divider {
  background-color: #374151;
}

.dark-mode .night-bg,
.dark-mode .feedback-bg {
  background: #374151;
}

.dark-mode .night,
.dark-mode .feedback {
  background-color: #9ca3af;
}

.dark-mode .container {
  background-color: #111827;
}

/* 复制按钮样式 */
.id-row {
  display: flex;
  align-items: center;
  gap: 2rpx; /* 间距调小 */
  margin-bottom: 8rpx;
}

.user-id {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.9);
}

.copy-btn {
  background: rgba(255, 255, 255, 0.25);
  color: white;
  border: 1rpx solid rgba(255, 255, 255, 0.4);
  padding: 2rpx 12rpx;
  border-radius: 6rpx; /* 圆角矩形 */
  font-size: 20rpx;
  font-weight: 500;
  cursor: pointer;
  height: 32rpx;
  line-height: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 4rpx;
}

.copy-btn:active {
  background: rgba(255, 255, 255, 0.4);
}

.dark-mode .copy-btn {
  background: rgba(255, 255, 255, 0.15);
  color: #f9fafb;
}

.dark-mode .copy-btn:active {
  background: rgba(255, 255, 255, 0.25);
}

/* 未登录状态样式 */
.unlogin-container {
  padding: 60rpx 40rpx;
}

.unlogin-card {
  background: white;
  border-radius: 30rpx;
  padding: 80rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.08);
}

.unlogin-avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40rpx;
}

.default-avatar {
  font-size: 80rpx;
  color: #6366f1;
  font-weight: bold;
}

.unlogin-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 20rpx;
}

.unlogin-desc {
  font-size: 26rpx;
  color: #6b7280;
  text-align: center;
  margin-bottom: 50rpx;
  line-height: 1.6;
}

.login-btn {
  width: 80%;
  height: 88rpx;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 44rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-btn:active {
  opacity: 0.9;
}

/* 夜间模式 - 未登录 */
.dark-mode .unlogin-card {
  background: #1f2937;
}

.dark-mode .unlogin-avatar {
  background: linear-gradient(135deg, #312e81 0%, #4c1d95 100%);
}

.dark-mode .default-avatar {
  color: #a78bfa;
}

.dark-mode .unlogin-title {
  color: #f9fafb;
}

.dark-mode .unlogin-desc {
  color: #9ca3af;
}

/* 赞赏弹窗样式 */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-box {
  background: white;
  border-radius: 24rpx;
  padding: 40rpx;
  width: 80%;
  max-width: 560rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.reward-box {
  padding: 50rpx 40rpx;
}

.modal-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 16rpx;
}

.modal-subtitle {
  font-size: 28rpx;
  color: #6b7280;
  margin-bottom: 40rpx;
  text-align: center;
}

.reward-qrcode {
  width: 400rpx;
  height: 400rpx;
  border-radius: 16rpx;
  margin-bottom: 30rpx;
}

.reward-tip {
  font-size: 26rpx;
  color: #9ca3af;
  margin-bottom: 40rpx;
}

.close-btn {
  width: 100%;
  height: 80rpx;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 30rpx;
  border-radius: 40rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:active {
  background: #e5e7eb;
}

/* 夜间模式 - 赞赏弹窗 */
.dark-mode .modal-box {
  background: #1f2937;
}

.dark-mode .modal-title {
  color: #f9fafb;
}

.dark-mode .modal-subtitle {
  color: #9ca3af;
}

.dark-mode .reward-tip {
  color: #6b7280;
}

.dark-mode .close-btn {
  background: #374151;
  color: #d1d5db;
}

.dark-mode .close-btn:active {
  background: #4b5563;
}

.membership-bg {
  background-color: #ff9800;
}

.inner-icon.membership {
  width: 40rpx;
  height: 40rpx;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.inner-icon.membership::before {
  content: 'VIP';
  font-size: 16rpx;
  color: #ff9800;
  font-weight: bold;
}

.dark-mode .membership-bg {
  background-color: #e68a00;
}

.dark-mode .inner-icon.membership::before {
  color: #e68a00;
}
</style>