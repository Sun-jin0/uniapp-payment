<template>
  <view class="checkin-home">
    <!-- Banner区域 -->
    <view class="banner">
      <view class="banner-bg"></view>
    </view>

    <!-- 打卡类别列表 -->
    <view class="category-list">
      <view 
        class="category-card" 
        v-for="category in categories" 
        :key="category.id"
        @click="goToCategory(category)"
      >
        <view class="category-cover" :class="'cover-' + category.id">
          <image class="cover-icon" :src="category.icon" mode="aspectFit" />
        </view>
        <view class="category-info">
          <text class="category-name">{{ category.name }}</text>
          <view class="category-meta">
            <text class="category-count">{{ getPeopleText(category) }}</text>
            <text v-if="category.start_time || category.end_time" :class="['time-text', category.timeStatus]">
              <text v-if="category.timeStatus === 'notStarted'">{{ formatTime(category.start_time) }} 开始</text>
              <text v-else-if="category.timeStatus === 'ended'">已结束</text>
              <text v-else>进行中 · {{ formatTime(category.end_time) }} 截止</text>
            </text>
          </view>
        </view>
        <view class="checkin-btn-small" :class="category.timeStatus">
          <text class="btn-text">{{ getBtnText(category.timeStatus) }}</text>
        </view>
      </view>
    </view>

  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import request from '../../api/request.js';

const categories = ref([]);
const loading = ref(true);

const getTimeStatus = (startTime, endTime) => {
  const now = new Date();
  const start = startTime ? new Date(startTime) : null;
  const end = endTime ? new Date(endTime) : null;

  if (start && now < start) {
    return 'notStarted';
  }
  if (end && now > end) {
    return 'ended';
  }
  return 'ongoing';
};

const getBtnText = (status) => {
  switch (status) {
    case 'notStarted':
      return '预报名';
    case 'ended':
      return '已结束';
    default:
      return '去打卡';
  }
};

const getPeopleText = (category) => {
  if (category.timeStatus === 'notStarted') {
    return `${category.preRegisterCount || 0}人报名`;
  }
  return `${category.joinCount || 0}人参加`;
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  return `${month}月${day}日 ${hour}:${minute}`;
};

const goBack = () => {
  uni.navigateBack();
};

const sharePage = () => {
  // #ifdef H5
  uni.showModal({
    title: '分享页面',
    content: '点击右上角分享按钮，邀请好友一起打卡学习！',
    showCancel: false,
    confirmText: '知道了'
  });
  // #endif
  // #ifdef MP-WEIXIN
  uni.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  });
  uni.showToast({ title: '点击右上角分享', icon: 'none' });
  // #endif
};

const goToCategory = (category) => {
  if (category.timeStatus === 'ended') {
    uni.showToast({
      title: '打卡已结束',
      icon: 'none'
    });
    return;
  }
  uni.navigateTo({
    url: `/pages/checkin/checkin-category?id=${category.id}&name=${encodeURIComponent(category.name)}`
  });
};

const loadCategories = async () => {
  try {
    loading.value = true;
    const res = await request.get('/checkin-category/categories');
    categories.value = res.data.map(item => ({
      id: item.id,
      name: item.name,
      joinCount: item.join_count,
      preRegisterCount: item.pre_register_count,
      start_time: item.start_time,
      end_time: item.end_time,
      timeStatus: getTimeStatus(item.start_time, item.end_time),
      icon: item.icon || `https://img.icons8.com/ios-filled/50/ffffff/data-configuration.png`
    }));
  } catch (error) {
    console.error('加载打卡类别失败:', error);
    uni.showToast({
      title: '加载失败',
      icon: 'none'
    });
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadCategories();
  
  // #ifdef MP-WEIXIN
  // 启用分享功能
  uni.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  });
  // #endif
});

// 分享配置
const shareConfig = {
  title: '🔥 加入学习打卡，一起进步！',
  desc: '坚持每一天，进步看得见！💪 多种打卡任务等你来挑战！',
  path: '/pages/checkin/checkin-home',
  imageUrl: 'https://s3.hi168.com/hi168-26998-7111ilq6/uploads/1776430628218-1zjz9l.png'
};

// 暴露给 Options API
// #ifdef MP-WEIXIN
defineExpose({
  shareConfig
});
// #endif
</script>

<!-- #ifdef MP-WEIXIN -->
<script>
export default {
  onShareAppMessage() {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const data = currentPage?.$vm || {};
    const config = data.shareConfig || {
      title: '🔥 加入学习打卡，一起进步！',
      path: '/pages/checkin/checkin-home'
    };
    
    return {
      title: config.title,
      desc: config.desc,
      path: config.path,
      imageUrl: config.imageUrl
    };
  },
  onShareTimeline() {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const data = currentPage?.$vm || {};
    const config = data.shareConfig || {
      title: '🔥 加入学习打卡，一起进步！'
    };
    
    return {
      title: config.title,
      imageUrl: config.imageUrl
    };
  }
}
</script>
<!-- #endif -->

<style scoped>
/* 配色方案：温暖的橙黄色系，协调统一 */
:root {
  --primary: #FF8C42;
  --primary-light: #FFB347;
  --primary-dark: #E86A33;
  --secondary: #FFF5E6;
  --text-primary: #2D3436;
  --text-secondary: #636E72;
  --text-tertiary: #B2BEC3;
  --bg-page: #F8F9FA;
  --bg-card: #FFFFFF;
}

.checkin-home {
  min-height: 100vh;
  background: var(--bg-page);
}

/* 导航栏 - 橙色渐变 */
/* Banner */
.banner {
  position: relative;
  height: 300rpx;
  overflow: hidden;
}

.banner-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('https://s3.hi168.com/hi168-26998-7111ilq6/uploads/1776430628218-1zjz9l.png') center/cover no-repeat;
  border-radius: 0 0 30rpx 30rpx;
}

/* 类别列表 */
.category-list {
  padding: 20rpx;
}

.category-card {
  display: flex;
  align-items: center;
  background: var(--bg-card);
  border-radius: 20rpx;
  padding: 20rpx 8rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04);
}

.category-cover {
  width: 120rpx;
  height: 90rpx;
  border-radius: 12rpx;
  margin-right: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.1);
}

/* 不同类别的渐变色 */
.cover-1 {
  background: linear-gradient(135deg, #FF8C42 0%, #FFB347 100%);
}

.cover-2 {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.cover-3 {
  background: linear-gradient(135deg, #00B894 0%, #00CEC9 100%);
}

.cover-icon {
  width: 70rpx;
  height: 70rpx;
}

.category-info {
  flex: 1;
}

.category-name {
  font-size: 32rpx;
  color: var(--text-primary);
  display: block;
  margin-bottom: 12rpx;
}

.category-meta {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.category-count {
  font-size: 26rpx;
  color: #999;
}

.time-text {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}

.time-text.notStarted {
  color: #E86A33;
  background: rgba(255, 140, 66, 0.1);
}

.time-text.ended {
  color: #999;
  background: #f5f5f5;
}

.time-text.ongoing {
  color: #00B894;
  background: rgba(0, 184, 148, 0.1);
}

.checkin-btn-small {
  padding: 12rpx 28rpx;
  background: linear-gradient(135deg, #FF8C42, #FFB347);
  border-radius: 30rpx;
  box-shadow: 0 4rpx 16rpx rgba(255,140,66,0.3);
}

.checkin-btn-small.notStarted {
  background: linear-gradient(135deg, #FFB347, #FFD89B);
  box-shadow: 0 4rpx 16rpx rgba(255,179,71,0.3);
}

.checkin-btn-small.ended {
  background: #dcdfe6;
  box-shadow: none;
}

.btn-text {
  font-size: 28rpx;
  color: #fff;
  font-weight: 600;
}
</style>
