<script setup>
import { ref, onMounted } from 'vue';
import { request } from '../../api/request';

const statusBarHeight = ref(0);
const chapterId = ref('');
const majorId = ref('');
const title = ref('');
const tags = ref([]);
const loading = ref(true);

// 选择模式相关
const isSelectMode = ref(false);
const targetChapterId = ref(null);

onMounted(async () => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight || 0;

  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options || {};
  
  majorId.value = options.majorId;
  chapterId.value = options.chapterId;
  title.value = options.title;

  if (options.mode === 'select') {
    isSelectMode.value = true;
    targetChapterId.value = options.targetChapterId;
  }

  await fetchTags();
});

const fetchTags = async () => {
  loading.value = true;
  try {
    const res = await request({ 
      url: `/computer1/tags?chapterId=${chapterId.value}`
    });
    tags.value = res.data || [];
  } catch (error) {
    console.error('获取考点列表失败:', error);
  } finally {
    loading.value = false;
  }
};

const handleReset = async () => {
  uni.showModal({
    title: '提示',
    content: '确定要重置该章节的所有进度吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await request({
            url: '/computer1/progress/reset',
            method: 'POST',
            data: { chapterId: chapterId.value }
          });
          uni.showToast({ title: '重置成功', icon: 'success' });
          fetchTags();
        } catch (error) {
          console.error('重置进度失败:', error);
        }
      }
    }
  });
};

const startPractice = (tag) => {
  // 保存为最近练习科目，以便在首页显示
  const practiceItem = {
    id: `computer-${majorId.value}-${chapterId.value}-${tag.id}`,
    title: `计算机 - ${title.value}(${tag.name})`,
    url: '/pages/computer/computer-main',
    icon: 'computer'
  };
  uni.setStorageSync('lastPracticeSubject', practiceItem);

  const params = {
    majorId: majorId.value,
    chapterId: chapterId.value,
    tagId: tag.id,
    title: title.value
  };

  if (isSelectMode.value) {
    params.mode = 'select';
    params.targetChapterId = targetChapterId.value;
  }

  const queryString = Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');

  uni.navigateTo({
    url: `/pages/computer/computer-question-list?${queryString}`
  });
};

const goBack = () => {
  uni.navigateBack();
};
</script>

<template>
  <view class="container">
    <view class="custom-nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">❮</text>
        </view>
        <view class="nav-title">{{ title || '章节详情' }}</view>
        <view class="reset-btn" @click="handleReset">
          <text class="reset-text">重置</text>
        </view>
      </view>
    </view>

    <view class="tag-list" :style="{ marginTop: (statusBarHeight + 44) + 'px' }">
      <view v-if="loading" class="loading-state">
        <text>正在加载考点...</text>
      </view>
      <view v-else-if="tags.length === 0" class="no-data">
        <text>该章节暂无考点数据</text>
      </view>
      <view v-else>
        <view 
          class="tag-card" 
          v-for="tag in tags" 
          :key="tag.id"
        >
          <view class="tag-main">
            <view class="tag-icon">💎</view>
            <view class="tag-info">
              <text class="tag-name">{{ tag.name }}</text>
              <view class="tag-stats">
                <text class="stat-item">已刷{{ tag.brushedCount || 0 }}道</text>
                <text class="stat-divider">|</text>
                <text class="stat-item">错误率: {{ tag.errorRate || 0 }}%</text>
              </view>
            </view>
            <view class="practice-btn" @click="startPractice(tag)">
              <text class="practice-btn-text">待刷题</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f8f9fa;
}

.custom-nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background-color: #4db6ac;
  z-index: 100;
}

.nav-content {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}

.back-icon {
  font-size: 36rpx;
  color: #fff;
}

.nav-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.reset-btn {
  padding: 10rpx 20rpx;
}

.reset-text {
  font-size: 28rpx;
  color: #fff;
}

.tag-list {
  padding: 30rpx;
}

.tag-card {
  background-color: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.tag-main {
  display: flex;
  align-items: center;
}

.tag-icon {
  font-size: 40rpx;
  margin-right: 24rpx;
}

.tag-info {
  flex: 1;
}

.tag-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 12rpx;
  display: block;
}

.tag-stats {
  display: flex;
  align-items: center;
}

.stat-item {
  font-size: 24rpx;
  color: #999;
}

.stat-divider {
  font-size: 20rpx;
  color: #eee;
  margin: 0 16rpx;
}

.practice-btn {
  background-color: #4db6ac;
  padding: 12rpx 30rpx;
  border-radius: 30rpx;
  margin-left: 20rpx;
}

.practice-btn-text {
  font-size: 24rpx;
  font-weight: bold;
  color: #fff;
}

.loading-state, .no-data {
  text-align: center;
  padding: 100rpx 0;
  color: #999;
  font-size: 28rpx;
}
</style>
