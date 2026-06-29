<template>
  <view class="container" :class="{ 'dark-mode': isDarkMode }">
    <!-- 头部背景 -->
    <view class="header-section">
      <view class="header-bg">
        <view class="header-content">
          <text class="header-title">会员中心</text>
          <text class="header-sub">开通会员，畅刷全部题库</text>
        </view>
      </view>
    </view>

    <!-- 会员状态卡片 -->
    <view class="membership-card" v-if="membership">
      <view class="card-header">
        <view class="card-header-left">
          <text class="card-title">{{ membership.status === 'active' ? '会员已开通' : '会员已过期' }}</text>
          <text class="card-badge" :class="{ active: membership.status === 'active' }">
            {{ membership.card_name || '会员' }}
          </text>
        </view>
      </view>
      <view class="card-body">
        <view class="expire-info">
          <text class="expire-label">有效期至</text>
          <text class="expire-value">{{ formatDate(membership.expire_at) }}</text>
        </view>
        <view class="remain-days" v-if="membership.status === 'active'">
          <text class="remain-num">{{ remainDays }}</text>
          <text class="remain-label">天</text>
        </view>
        <view class="remain-days expired" v-else>
          <text class="remain-num">已过期</text>
        </view>
      </view>
      <view class="card-footer">
        <text class="card-tip">{{ membership.status === 'active' ? '会员有效期内畅刷全部题库' : '会员已过期，续费后可继续刷题' }}</text>
        <button class="renew-btn" @tap="goToBuy">{{ membership.status === 'active' ? '续费会员' : '重新开通' }}</button>
      </view>
    </view>

    <!-- 未开通提示 -->
    <view class="membership-card empty" v-else>
      <view class="empty-icon">VIP</view>
      <text class="empty-title">暂未开通会员</text>
      <text class="empty-desc">开通会员可畅刷全部题库</text>
      <button class="buy-btn" @tap="goToBuy">立即开通</button>
    </view>

    <!-- 卡密激活 -->
    <view class="activate-card">
      <view class="activate-title">卡密激活</view>
      <view class="activate-input-row">
        <input
          class="activate-input"
          v-model="activateCode"
          placeholder="请输入7位激活码"
          maxlength="10"
          @confirm="activateCodeSubmit"
        />
        <button class="activate-btn" @tap="activateCodeSubmit">激活</button>
      </view>
      <text class="activate-tip">输入卡密即可激活会员，支持字母和数字</text>
    </view>

    <!-- 功能入口 -->
    <view class="menu-group-card">
      <view class="menu-item-row" @tap="goToOrders">
        <view class="icon-box" style="background: #e0e7ff;">
          <text class="icon-text" style="color: #6366f1;">O</text>
        </view>
        <view class="item-info">
          <text class="item-label">我的订单</text>
          <text class="item-desc">查看购买记录</text>
        </view>
        <view class="item-right">
          <view class="item-arrow"></view>
        </view>
      </view>
      <view class="menu-divider"></view>
      <view class="menu-item-row" @tap="goToBuy">
        <view class="icon-box" style="background: #fef3c7;">
          <text class="icon-text" style="color: #f59e0b;">+</text>
        </view>
        <view class="item-info">
          <text class="item-label">开通会员</text>
          <text class="item-desc">月卡/季卡/年卡</text>
        </view>
        <view class="item-right">
          <view class="item-arrow"></view>
        </view>
      </view>
      <view class="menu-divider"></view>
      <view class="menu-item-row" @tap="goToAdmin" v-if="isAdmin">
        <view class="icon-box" style="background: #fee2e2;">
          <text class="icon-text" style="color: #ef4444;">A</text>
        </view>
        <view class="item-info">
          <text class="item-label">管理后台</text>
          <text class="item-desc">价格、折扣、订单管理</text>
        </view>
        <view class="item-right">
          <view class="item-arrow"></view>
        </view>
      </view>
    </view>

    <!-- 会员权益 -->
    <view class="benefit-card">
      <view class="benefit-title">会员权益</view>
      <view class="benefit-list">
        <view class="benefit-item">
          <text class="benefit-icon">✓</text>
          <text class="benefit-text">畅刷全部题库，不受每日限制</text>
        </view>
        <view class="benefit-item">
          <text class="benefit-icon">✓</text>
          <text class="benefit-text">会员专属错题本与收藏功能</text>
        </view>
        <view class="benefit-item">
          <text class="benefit-icon">✓</text>
          <text class="benefit-text">学习进度云端同步，换设备不丢失</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import membershipApi from '@/api/membership.js';

const isDarkMode = ref(false);
const membership = ref(null);
const activateCode = ref('');

const remainDays = computed(() => {
  if (!membership.value || membership.value.status !== 'active') return 0;
  const expire = new Date(membership.value.expire_at);
  const now = new Date();
  return Math.max(0, Math.ceil((expire - now) / (24 * 60 * 60 * 1000)));
});

const isAdmin = computed(() => {
  const role = uni.getStorageSync('role');
  console.log('membership-center role:', role, typeof role);
  return role === 1 || role === '1' || role === 'admin';
});

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const goToBuy = () => {
  uni.navigateTo({ url: '/pages/membership/membership-buy' });
};

const goToOrders = () => {
  uni.navigateTo({ url: '/pages/membership/membership-orders' });
};

const goToAdmin = () => {
  uni.navigateTo({ url: '/pages/membership/membership-admin' });
};

const activateCodeSubmit = async () => {
  const code = activateCode.value.trim();
  if (!code) {
    uni.showToast({ title: '请输入激活码', icon: 'none' });
    return;
  }
  try {
    uni.showLoading({ title: '激活中...' });
    const res = await membershipApi.activateByCode(code);
    uni.hideLoading();
    if (res.code === 0) {
      uni.showToast({ title: res.message || '激活成功', icon: 'success' });
      activateCode.value = '';
      loadMembership();
    } else {
      uni.showToast({ title: res.message || '激活失败', icon: 'none' });
    }
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: e.message || '激活失败', icon: 'none' });
  }
};

const loadMembership = async () => {
  try {
    const res = await membershipApi.getMyMembership();
    if (res.code === 0) {
      membership.value = res.data;
    }
  } catch (e) {
    console.error('loadMembership error:', e);
  }
};

onMounted(() => {
  loadMembership();
  const currentTheme = uni.getStorageSync('themeMode') || 'light';
  isDarkMode.value = currentTheme === 'dark';
});
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 40rpx;
}

.header-section {
  background: #ff9800;
  padding: 60rpx 30rpx 40rpx;
}

.header-bg {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.header-content {
  text-align: center;
}

.header-title {
  font-size: 44rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 12rpx;
}

.header-sub {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
}

/* 会员卡片 */
.membership-card {
  background: white;
  border-radius: 30rpx;
  margin: 30rpx;
  padding: 30rpx;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.05);
}

.membership-card.empty {
  text-align: center;
  padding: 60rpx 30rpx;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.card-header-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.card-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.card-badge {
  background: #fee2e2;
  color: #ef4444;
  font-size: 24rpx;
  padding: 6rpx 16rpx;
  border-radius: 12rpx;
}

.card-badge.active {
  background: #f0fdf4;
  color: #22c55e;
}

.card-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
  padding: 20rpx 0;
  border-top: 1rpx solid #f3f4f6;
  border-bottom: 1rpx solid #f3f4f6;
}

.expire-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.expire-label {
  font-size: 24rpx;
  color: #666;
}

.expire-value {
  font-size: 32rpx;
  color: #333;
  font-weight: 600;
}

.remain-days {
  display: flex;
  align-items: baseline;
}

.remain-days.expired .remain-num {
  font-size: 28rpx;
  color: #9ca3af;
}

.remain-num {
  font-size: 56rpx;
  font-weight: bold;
  color: #ff9800;
}

.remain-label {
  font-size: 24rpx;
  color: #ff9800;
  margin-left: 4rpx;
}

.card-footer {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.card-tip {
  font-size: 24rpx;
  color: #9ca3af;
}

.renew-btn {
  background: #ff9800;
  color: white;
  font-size: 28rpx;
  border-radius: 16rpx;
  line-height: 80rpx;
}

.empty-icon {
  font-size: 60rpx;
  font-weight: bold;
  color: #ff9800;
  margin-bottom: 20rpx;
}

.empty-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 12rpx;
}

.empty-desc {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 30rpx;
}

.buy-btn {
  background: #ff9800;
  color: white;
  font-size: 28rpx;
  border-radius: 16rpx;
  line-height: 80rpx;
  width: 200rpx;
}

/* 功能入口 */
.activate-card {
  background: white;
  border-radius: 30rpx;
  margin: 30rpx;
  padding: 30rpx;
  box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.02);
}

.activate-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.activate-input-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 12rpx;
}

.activate-input {
  flex: 1;
  height: 80rpx;
  background: #f5f5f5;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #333;
}

.activate-btn {
  width: 140rpx;
  height: 80rpx;
  background: #ff9800;
  color: white;
  font-size: 28rpx;
  border-radius: 16rpx;
  line-height: 80rpx;
}

.activate-tip {
  font-size: 22rpx;
  color: #999;
}

.menu-group-card {
  background: white;
  border-radius: 30rpx;
  margin: 30rpx;
  padding: 10rpx 30rpx;
  box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.02);
}

.menu-item-row {
  display: flex;
  align-items: center;
  padding: 28rpx 0;
  border-bottom: 1rpx solid #f9fafb;
}

.menu-item-row.no-border {
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

.icon-text {
  font-size: 28rpx;
  font-weight: bold;
  color: #fff;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.item-label {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
}

.item-desc {
  font-size: 24rpx;
  color: #9ca3af;
}

.item-right {
  display: flex;
  align-items: center;
}

.item-arrow {
  width: 16rpx;
  height: 16rpx;
  border-top: 3rpx solid #d1d5db;
  border-right: 3rpx solid #d1d5db;
  transform: rotate(45deg);
}

.menu-divider {
  height: 1rpx;
  background: #f9fafb;
}

/* 会员权益 */
.benefit-card {
  background: white;
  border-radius: 30rpx;
  margin: 30rpx;
  padding: 30rpx;
  box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.02);
}

.benefit-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.benefit-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.benefit-item {
  display: flex;
  align-items: center;
}

.benefit-icon {
  color: #22c55e;
  font-size: 28rpx;
  font-weight: bold;
  margin-right: 12rpx;
}

.benefit-text {
  font-size: 28rpx;
  color: #333;
}

/* 夜间模式 */
.dark-mode.container {
  background: #1a1a1a;
}

.dark-mode .membership-card,
.dark-mode .menu-group-card,
.dark-mode .benefit-card {
  background: #2c2c2c;
  box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.2);
}

.dark-mode .header-section {
  background: #e68a00;
}

.dark-mode .card-title,
.dark-mode .empty-title,
.dark-mode .item-label,
.dark-mode .benefit-title {
  color: #f0f0f0;
}

.dark-mode .expire-value,
.dark-mode .benefit-text {
  color: #f0f0f0;
}

.dark-mode .expire-label,
.dark-mode .empty-desc,
.dark-mode .item-desc {
  color: #888;
}

.dark-mode .menu-divider,
.dark-mode .menu-item-row {
  border-bottom-color: #444;
}
</style>