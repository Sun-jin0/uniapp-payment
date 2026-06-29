<script setup>
import { ref, onMounted, computed } from 'vue';
import { request } from '../../api/request';

const statusBarHeight = ref(0);
const loading = ref(true);
const currentSubjectId = ref(null);
const currentTab = ref('real');
const realPapers = ref([]);
const mockPapers = ref([]);

onMounted(async () => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight || 0;
  
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options || {};
  currentSubjectId.value = options.subjectId;
  
  await fetchPapers();
});

const fetchPapers = async () => {
  loading.value = true;
  try {
    const res = await request({
      url: '/computer1/exams',
      data: { majorId: currentSubjectId.value }
    });
    
    const allPapers = res.data || [];
    realPapers.value = allPapers.filter(p => p.paper_type === 1 || !p.paper_type);
    mockPapers.value = allPapers.filter(p => p.paper_type === 2);
  } catch (error) {
    console.error('获取试卷列表失败:', error);
    uni.showToast({ title: '获取试卷失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const handlePaperClick = (paper) => {
  // 检查是否有保存的进度
  const progressKey = `computer_exam_${paper.id}`;
  const progressList = uni.getStorageSync('practiceProgressList') || [];
  const savedProgress = progressList.find(item => item.progressKey === progressKey);
  
  // 如果有保存的进度且进度中有 URL，直接跳转到刷题页面
  if (savedProgress && savedProgress.url && savedProgress.currentIndex > 1) {
    uni.navigateTo({
      url: savedProgress.url
    });
  } else {
    // 否则跳转到题目列表
    uni.navigateTo({
      url: `/pages/computer/computer-question-list?examGroupId=${paper.id}&mode=year&title=${encodeURIComponent(paper.year + paper.title)}`
    });
  }
};

// 原生模板广告事件监听
const adLoad = () => {
  console.log('原生模板广告加载成功');
};

const adError = (err) => {
  console.error('原生模板广告加载失败', err);
};

const adClose = () => {
  console.log('原生模板广告关闭');
};

const goBack = () => {
  uni.navigateBack();
};
</script>

<template>
  <view class="app-container">
    <!-- 状态栏占位 -->
    <view :style="{ height: statusBarHeight + 'px', background: '#fff' }"></view>
    
    <!-- 自定义导航栏 -->
    <view class="nav-bar">
      <view class="nav-left" @click="goBack">
        <text class="back-icon">❮</text>
      </view>
      <view class="nav-title">全真测试</view>
      <view class="nav-right"></view>
    </view>

    <!-- Tab切换 -->
    <view class="tabs">
      <view 
        class="tab-item" 
        :class="{ active: currentTab === 'real' }"
        @click="currentTab = 'real'"
      >
        <text class="tab-text">真题卷</text>
      </view>
      <view 
        class="tab-item" 
        :class="{ active: currentTab === 'mock' }"
        @click="currentTab = 'mock'"
      >
        <text class="tab-text">模拟卷</text>
      </view>
    </view>

    <!-- 试卷列表 -->
    <scroll-view scroll-y class="paper-list">
      <view v-if="currentTab === 'real'" class="paper-section">
        <template v-for="(paper, index) in realPapers" :key="paper.id">
          <view class="paper-card" @click="handlePaperClick(paper)">
            <view class="paper-header">
              <view class="title-row">
                <text class="paper-year">{{ paper.year }}</text>
                <text class="paper-title">{{ paper.title }}</text>
              </view>
              <view class="paper-tag" :class="paper.type === '统考' ? 'tag-unified' : 'tag-school'">
                {{ paper.type }}
              </view>
            </view>
            <view class="paper-info">
              <text class="info-item">{{ paper.from_school }}</text>
              <text class="info-item">{{ paper.questionCount }}道题</text>
              <view class="difficulty-inline">
                <text class="difficulty-label">难度：</text>
                <view class="difficulty-stars">
                  <text v-for="i in 5" :key="i" class="star" :class="{ filled: i <= paper.difficulty }">★</text>
                </view>
              </view>
            </view>
          </view>
          <!-- 第4个真题卷后显示广告 -->
          <!-- #ifdef MP-WEIXIN -->
          <view v-if="index === 3" class="ad-container">
            <ad-custom 
              unit-id="adunit-f1d0e339a07022e6" 
              @load="adLoad" 
              @error="adError" 
              @close="adClose"
            ></ad-custom>
          </view>
          <!-- #endif -->
          <!-- 最后一个真题卷后显示广告（当总数超过4个时） -->
          <!-- #ifdef MP-WEIXIN -->
          <view v-if="index === realPapers.length - 1 && index > 3" class="ad-container">
            <ad-custom 
              unit-id="adunit-f1d0e339a07022e6" 
              @load="adLoad" 
              @error="adError" 
              @close="adClose"
            ></ad-custom>
          </view>
          <!-- #endif -->
        </template>
        <view v-if="realPapers.length === 0" class="empty-state">
          <text class="empty-text">暂无真题卷</text>
        </view>
      </view>

      <view v-if="currentTab === 'mock'" class="paper-section">
        <template v-for="(paper, index) in mockPapers" :key="paper.id">
          <view class="paper-card" @click="handlePaperClick(paper)">
            <view class="paper-header">
              <view class="title-row">
                <text class="paper-year">{{ paper.year }}</text>
                <text class="paper-title">{{ paper.title }}</text>
              </view>
              <view class="paper-tag tag-mock">
                模拟卷
              </view>
            </view>
            <view class="paper-info">
              <text class="info-item">{{ paper.from_school }}</text>
              <text class="info-item">{{ paper.questionCount }}道题</text>
              <view class="difficulty-inline">
                <text class="difficulty-label">难度：</text>
                <view class="difficulty-stars">
                  <text v-for="i in 5" :key="i" class="star" :class="{ filled: i <= paper.difficulty }">★</text>
                </view>
              </view>
            </view>
          </view>
          <!-- 第4个模拟卷后显示广告 -->
          <!-- #ifdef MP-WEIXIN -->
          <view v-if="index === 3" class="ad-container">
            <ad-custom 
              unit-id="adunit-f1d0e339a07022e6" 
              @load="adLoad" 
              @error="adError" 
              @close="adClose"
            ></ad-custom>
          </view>
          <!-- #endif -->
          <!-- 最后一个模拟卷后显示广告（当总数超过4个时） -->
          <!-- #ifdef MP-WEIXIN -->
          <view v-if="index === mockPapers.length - 1 && index > 3" class="ad-container">
            <ad-custom 
              unit-id="adunit-f1d0e339a07022e6" 
              @load="adLoad" 
              @error="adError" 
              @close="adClose"
            ></ad-custom>
          </view>
          <!-- #endif -->
        </template>
        <view v-if="mockPapers.length === 0" class="empty-state">
          <text class="empty-text">暂无模拟卷</text>
        </view>
      </view>
    </scroll-view>

    <!-- 加载中 -->
    <view v-if="loading" class="loading-overlay">
      <view class="spinner"></view>
      <text>加载中...</text>
    </view>
  </view>
</template>

<style scoped>
/* 原生模板广告容器 */
.ad-container {
  margin: 20rpx 24rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.app-container {
  --primary-color: #4db6ac;
  --primary-gradient: linear-gradient(135deg, #4db6ac 0%, #80cbc4 100%);
  --bg-color: #f8f9fa;
  --card-bg: #ffffff;
  --text-main: #333333;
  --text-secondary: #666666;
  --text-light: #999999;
  --border-color: #eee;
  --accent-bg: #e0f2f1;
  
  min-height: 100vh;
  background-color: var(--bg-color);
  display: flex;
  flex-direction: column;
}

.nav-bar {
  height: 44px;
  background: var(--card-bg);
  display: flex;
  align-items: center;
  padding: 0 15px;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
  border-bottom: 1rpx solid var(--border-color);
}

.nav-left { 
  width: 60rpx; 
}

.back-icon {
  font-size: 36rpx;
  color: var(--text-main);
}

.nav-title { 
  flex: 1; 
  text-align: center; 
  font-weight: bold; 
  font-size: 32rpx; 
  color: var(--text-main); 
}

.nav-right { 
  min-width: 60rpx; 
}

.tabs {
  display: flex;
  background: var(--card-bg);
  padding: 0 20rpx;
  border-bottom: 1rpx solid var(--border-color);
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  position: relative;
}

.tab-text {
  font-size: 30rpx;
  color: var(--text-secondary);
  font-weight: 500;
}

.tab-item.active .tab-text {
  color: var(--primary-color);
  font-weight: bold;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60rpx;
  height: 4rpx;
  background: var(--primary-color);
  border-radius: 2rpx;
}

.paper-list {
  flex: 1;
  padding: 20rpx;
}

.paper-section {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.paper-card {
  background: var(--card-bg);
  border-radius: 16rpx;
  padding: 10rpx 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  border: 1rpx solid var(--border-color);
}

.paper-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.title-row {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 12rpx;
}

.paper-year {
  font-size: 28rpx;
  color: var(--primary-color);
  font-weight: bold;
  background: var(--accent-bg);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}

.paper-title {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--text-main);
  flex: 1;
}

.paper-tag {
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  font-weight: 500;
}

.paper-tag.tag-unified {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
  color: #fff;
}

.paper-tag.tag-school {
  background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
  color: #fff;
}

.paper-tag.tag-mock {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.paper-info {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 16rpx;
}

.info-item {
  font-size: 26rpx;
  color: var(--text-secondary);
}

.paper-difficulty {
  display: flex;
  align-items: center;
}

.difficulty-inline {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.difficulty-label {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-right: 10rpx;
}

.difficulty-stars {
  display: flex;
  gap: 4rpx;
}

.star {
  font-size: 28rpx;
  color: #ddd;
}

.star.filled {
  color: #ffc107;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 100rpx 0;
}

.empty-text {
  font-size: 28rpx;
  color: var(--text-light);
}

.loading-overlay {
  position: fixed;
  top: 0; 
  left: 0; 
  right: 0; 
  bottom: 0;
  background: rgba(255,255,255,0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.spinner {
  width: 60rpx;
  height: 60rpx;
  border: 4rpx solid #f3f3f3;
  border-top: 4rpx solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20rpx;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
