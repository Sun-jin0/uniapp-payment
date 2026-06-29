<template>
  <view class="container">
    <!-- 头部 -->
    <view class="rank-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="header-top">
        <view class="back-btn" @tap="goBack">
          <SvgIcon name="left" size="40" fill="#fff" />
        </view>
        <view class="header-title">考试排名</view>
        <view class="placeholder"></view>
      </view>
    </view>

    <!-- 考试信息 -->
    <view class="exam-info-card" v-if="examInfo">
      <view class="exam-title">{{ examInfo.title }}</view>
      <view class="exam-stats">
        <view class="stat-item">
          <text class="stat-num">{{ statistics.total_participants || 0 }}</text>
          <text class="stat-label">参与人数</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ statistics.average_score ? statistics.average_score.toFixed(1) : 0 }}</text>
          <text class="stat-label">平均分</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ statistics.highest_score || 0 }}</text>
          <text class="stat-label">最高分</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ statistics.pass_rate ? statistics.pass_rate.toFixed(1) : 0 }}%</text>
          <text class="stat-label">及格率</text>
        </view>
      </view>
    </view>

    <!-- 前三名 -->
    <view class="top-three" v-if="topThree.length > 0">
      <view class="top-item second" v-if="topThree[1]">
        <view class="avatar-container">
          <image class="avatar" :src="topThree[1].avatar || '/static/default-avatar.png'" mode="aspectFill" />
          <view class="rank-badge">2</view>
        </view>
        <text class="top-name">{{ topThree[1].username || '匿名' }}</text>
        <text class="top-score">{{ topThree[1].total_score }}分</text>
      </view>
      <view class="top-item first" v-if="topThree[0]">
        <view class="avatar-container">
          <image class="avatar" :src="topThree[0].avatar || '/static/default-avatar.png'" mode="aspectFill" />
          <view class="rank-badge">1</view>
          <view class="crown">👑</view>
        </view>
        <text class="top-name">{{ topThree[0].username || '匿名' }}</text>
        <text class="top-score">{{ topThree[0].total_score }}分</text>
      </view>
      <view class="top-item third" v-if="topThree[2]">
        <view class="avatar-container">
          <image class="avatar" :src="topThree[2].avatar || '/static/default-avatar.png'" mode="aspectFill" />
          <view class="rank-badge">3</view>
        </view>
        <text class="top-name">{{ topThree[2].username || '匿名' }}</text>
        <text class="top-score">{{ topThree[2].total_score }}分</text>
      </view>
    </view>

    <!-- 排名列表 -->
    <scroll-view class="rank-list" scroll-y @scrolltolower="loadMore">
      <view class="list-header">
        <text class="header-rank">排名</text>
        <text class="header-user">考生</text>
        <text class="header-score">分数</text>
        <text class="header-time">用时</text>
      </view>
      
      <view v-if="loading && rankings.length === 0" class="loading-state">
        <text>加载中...</text>
      </view>
      
      <view v-else-if="rankings.length === 0" class="empty-state">
        <text>暂无排名数据</text>
      </view>
      
      <view 
        v-else
        v-for="(item, index) in rankings" 
        :key="item.id"
        class="rank-item"
        :class="{ 'is-me': item.user_id === currentUserId }"
      >
        <view class="rank-num">
          <text v-if="item.rank > 3">{{ item.rank }}</text>
          <view v-else class="rank-medal" :class="'rank-' + item.rank">
            {{ item.rank }}
          </view>
        </view>
        <view class="user-info">
          <image class="user-avatar" :src="item.avatar || '/static/default-avatar.png'" mode="aspectFill" />
          <text class="user-name">{{ item.username || '匿名' }}</text>
        </view>
        <view class="score">{{ item.total_score }}分</view>
        <view class="duration">{{ formatDuration(item.duration) }}</view>
      </view>
      
      <view v-if="loadingMore" class="loading-more">
        <text>加载更多...</text>
      </view>
      <view v-if="noMore && rankings.length > 0" class="no-more">
        <text>没有更多了</text>
      </view>
    </scroll-view>

    <!-- 我的排名 -->
    <view class="my-rank" v-if="myRank">
      <view class="my-rank-info">
        <text class="my-rank-text">我的排名</text>
        <text class="my-rank-num">{{ myRank.rank }}</text>
      </view>
      <view class="my-score">{{ myRank.total_score }}分</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { request } from '@/api/request';
import SvgIcon from '@/components/SvgIcon/SvgIcon.vue';

const statusBarHeight = ref(0);
const examId = ref('');
const examInfo = ref(null);
const statistics = ref({});
const rankings = ref([]);
const myRank = ref(null);
const currentUserId = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const noMore = ref(false);
const page = ref(1);
const pageSize = 20;

// 前三名
const topThree = computed(() => {
  return rankings.value.slice(0, 3);
});

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight;
  
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  examId.value = currentPage.$page?.options?.examId || currentPage.options?.examId;
  
  if (examId.value) {
    fetchRankings();
    fetchStatistics();
    getCurrentUser();
  }
});

// 获取当前用户ID
const getCurrentUser = async () => {
  try {
    const res = await request({ url: '/user/info' });
    if (res.code === 0) {
      currentUserId.value = res.data.id;
    }
  } catch (error) {
    console.error('获取用户信息失败:', error);
  }
};

// 获取排名列表
const fetchRankings = async (isRefresh = false) => {
  if (isRefresh) {
    page.value = 1;
    noMore.value = false;
  }
  
  if (isRefresh) {
    loading.value = true;
  } else {
    loadingMore.value = true;
  }

  try {
    const res = await request({
      url: `/online-exam/exams/${examId.value}/rankings`,
      data: {
        page: page.value,
        pageSize: pageSize
      }
    });

    if (res.code === 0) {
      const list = res.data.list || [];
      
      if (isRefresh) {
        rankings.value = list;
      } else {
        rankings.value = [...rankings.value, ...list];
      }
      
      // 查找我的排名
      const mine = list.find(item => item.user_id === currentUserId.value);
      if (mine) {
        myRank.value = mine;
      }
      
      if (list.length < pageSize) {
        noMore.value = true;
      }
    }
  } catch (error) {
    console.error('获取排名失败:', error);
    uni.showToast({
      title: '获取排名失败',
      icon: 'none'
    });
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
};

// 获取考试统计
const fetchStatistics = async () => {
  try {
    const res = await request({
      url: `/online-exam/admin/exams/${examId.value}/statistics`
    });

    if (res.code === 0) {
      statistics.value = res.data;
    }
  } catch (error) {
    console.error('获取统计失败:', error);
  }
};

// 加载更多
const loadMore = () => {
  if (noMore.value || loadingMore.value) return;
  page.value++;
  fetchRankings();
};

// 格式化用时
const formatDuration = (seconds) => {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}'${String(secs).padStart(2, '0')}"`;
};

const goBack = () => {
  uni.navigateBack();
};
</script>

<style lang="scss" scoped>
.container {
  height: 100vh;
  background-color: #f5f7fa;
  display: flex;
  flex-direction: column;
}

// 头部
.rank-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20rpx 30rpx;
  
  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    
    .back-btn {
      width: 60rpx;
      height: 60rpx;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .header-title {
      font-size: 34rpx;
      font-weight: 600;
      color: #fff;
    }
    
    .placeholder {
      width: 60rpx;
    }
  }
}

// 考试信息卡片
.exam-info-card {
  background-color: #fff;
  margin: 20rpx;
  border-radius: 16rpx;
  padding: 30rpx;
  
  .exam-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
    text-align: center;
    margin-bottom: 24rpx;
  }
  
  .exam-stats {
    display: flex;
    justify-content: space-around;
    
    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      
      .stat-num {
        font-size: 36rpx;
        font-weight: bold;
        color: #667eea;
        margin-bottom: 8rpx;
      }
      
      .stat-label {
        font-size: 24rpx;
        color: #999;
      }
    }
  }
}

// 前三名
.top-three {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding: 30rpx 40rpx;
  background: linear-gradient(180deg, #fff 0%, #f5f7fa 100%);
  
  .top-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0 30rpx;
    
    &.first {
      transform: scale(1.1);
      z-index: 2;
      
      .avatar-container {
        .rank-badge {
          background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
        }
      }
    }
    
    &.second {
      .avatar-container {
        .rank-badge {
          background: linear-gradient(135deg, #c0c0c0 0%, #a0a0a0 100%);
        }
      }
    }
    
    &.third {
      .avatar-container {
        .rank-badge {
          background: linear-gradient(135deg, #cd7f32 0%, #b87333 100%);
        }
      }
    }
    
    .avatar-container {
      position: relative;
      margin-bottom: 16rpx;
      
      .avatar {
        width: 120rpx;
        height: 120rpx;
        border-radius: 50%;
        border: 4rpx solid #fff;
        box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
      }
      
      .rank-badge {
        position: absolute;
        bottom: -10rpx;
        left: 50%;
        transform: translateX(-50%);
        width: 40rpx;
        height: 40rpx;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 24rpx;
        font-weight: bold;
        box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.2);
      }
      
      .crown {
        position: absolute;
        top: -20rpx;
        left: 50%;
        transform: translateX(-50%);
        font-size: 40rpx;
      }
    }
    
    .top-name {
      font-size: 28rpx;
      color: #333;
      margin-bottom: 8rpx;
      max-width: 150rpx;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .top-score {
      font-size: 32rpx;
      font-weight: bold;
      color: #667eea;
    }
  }
}

// 排名列表
.rank-list {
  flex: 1;
  background-color: #fff;
  margin: 0 20rpx;
  border-radius: 16rpx 16rpx 0 0;
  overflow: hidden;
  
  .list-header {
    display: flex;
    padding: 24rpx 30rpx;
    background-color: #f8f9fa;
    border-bottom: 1rpx solid #f0f0f0;
    
    text {
      font-size: 26rpx;
      color: #999;
      font-weight: 500;
    }
    
    .header-rank {
      width: 100rpx;
      text-align: center;
    }
    
    .header-user {
      flex: 1;
      padding-left: 20rpx;
    }
    
    .header-score {
      width: 120rpx;
      text-align: center;
    }
    
    .header-time {
      width: 100rpx;
      text-align: center;
    }
  }
  
  .rank-item {
    display: flex;
    align-items: center;
    padding: 24rpx 30rpx;
    border-bottom: 1rpx solid #f5f5f5;
    
    &.is-me {
      background-color: #e6f7ff;
    }
    
    .rank-num {
      width: 100rpx;
      text-align: center;
      
      text {
        font-size: 30rpx;
        color: #666;
        font-weight: 500;
      }
      
      .rank-medal {
        width: 48rpx;
        height: 48rpx;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto;
        color: #fff;
        font-size: 26rpx;
        font-weight: bold;
        
        &.rank-1 {
          background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
        }
        
        &.rank-2 {
          background: linear-gradient(135deg, #c0c0c0 0%, #a0a0a0 100%);
        }
        
        &.rank-3 {
          background: linear-gradient(135deg, #cd7f32 0%, #b87333 100%);
        }
      }
    }
    
    .user-info {
      flex: 1;
      display: flex;
      align-items: center;
      padding-left: 20rpx;
      
      .user-avatar {
        width: 64rpx;
        height: 64rpx;
        border-radius: 50%;
        margin-right: 16rpx;
      }
      
      .user-name {
        font-size: 28rpx;
        color: #333;
        max-width: 200rpx;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
    
    .score {
      width: 120rpx;
      text-align: center;
      font-size: 30rpx;
      color: #667eea;
      font-weight: 600;
    }
    
    .duration {
      width: 100rpx;
      text-align: center;
      font-size: 26rpx;
      color: #999;
    }
  }
}

// 我的排名
.my-rank {
  background-color: #fff;
  padding: 24rpx 30rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
  
  .my-rank-info {
    display: flex;
    align-items: center;
    
    .my-rank-text {
      font-size: 28rpx;
      color: #666;
      margin-right: 16rpx;
    }
    
    .my-rank-num {
      font-size: 40rpx;
      font-weight: bold;
      color: #667eea;
    }
  }
  
  .my-score {
    font-size: 36rpx;
    font-weight: bold;
    color: #52c41a;
  }
}

// 加载和空状态
.loading-state, .empty-state, .loading-more, .no-more {
  text-align: center;
  padding: 40rpx;
  color: #999;
  font-size: 26rpx;
}
</style>
