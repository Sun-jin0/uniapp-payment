<script setup>
import { ref, onMounted } from 'vue';
import { request } from '../../api/request';

const statusBarHeight = ref(0);
const subjects = ref([]);
const chaptersMap = ref({});
const selectedSubjectId = ref(null);
const loading = ref(false);

// 选择模式相关
const isSelectMode = ref(false);
const targetChapterId = ref(null);

onMounted(async () => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight || 0;

  // 获取页面参数
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options || {};
  
  if (options.mode === 'select') {
    isSelectMode.value = true;
    targetChapterId.value = options.targetChapterId;
  }

  await fetchSubjectsAndChapters();
});

const fetchSubjectsAndChapters = async () => {
  loading.value = true;
  try {
    const res = await request({ url: '/computer1/subjects' });
    subjects.value = res.data || [];
    
    if (subjects.value.length > 0) {
      selectedSubjectId.value = subjects.value[0].id;
    }

    // 获取每个科目的章节
    for (const subject of subjects.value) {
      const chapterRes = await request({ 
        url: '/computer1/chapters',
        data: { majorId: subject.id }
      });
      chaptersMap.value[subject.id] = chapterRes.data || [];
    }
  } catch (error) {
    console.error('获取科目和章节失败:', error);
  } finally {
    loading.value = false;
  }
};

const selectSubject = (subject) => {
  selectedSubjectId.value = subject.id;
};

const handleChapterClick = (chapter) => {
  if (!isSelectMode.value) {
    const subject = subjects.value.find(s => s.id == selectedSubjectId.value);
    if (subject) {
      // 保存为最近练习科目，以便在首页显示
      const practiceItem = {
        id: subject.id,
        title: `计算机 - ${subject.name}`,
        url: '/pages/computer/computer-main',
        icon: 'computer'
      };
      uni.setStorageSync('lastPracticeSubject', practiceItem);
    }
  }

  const params = {
    majorId: selectedSubjectId.value,
    chapterId: chapter.id,
    title: chapter.name
  };

  if (isSelectMode.value) {
    params.mode = 'select';
    params.targetChapterId = targetChapterId.value;
  }

  const queryString = Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');

  if (chapter.subChapterCount > 0) {
    // 有小节，进入小节选择页
    uni.navigateTo({
      url: `/pages/computer/computer-chapter-detail?${queryString}`
    });
  } else {
    // 无小节，进入题目列表
    uni.navigateTo({
      url: `/pages/computer/computer-question-list?${queryString}`
    });
  }
};

const goBack = () => {
  uni.navigateBack();
};

const goToSearch = () => {
  const url = isSelectMode.value 
    ? `/pages/computer/computer-practice-search?curatedChapterId=${targetChapterId.value}`
    : '/pages/computer/computer-practice-search';
  uni.navigateTo({ url });
};
</script>

<template>
  <view class="container">
    <view class="custom-nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">❮</text>
        </view>
        <view class="nav-title">{{ isSelectMode ? '选择题目来源' : '选择章节' }}</view>
        <view class="search-entry" @click="goToSearch">
          <text class="search-icon">🔍</text>
        </view>
      </view>
    </view>

    <view class="main-content" :style="{ marginTop: (statusBarHeight + 44) + 'px' }">
      <!-- 科目切换栏 -->
      <scroll-view scroll-x class="subject-tabs" show-scrollbar="false">
        <view 
          v-for="subject in subjects" 
          :key="subject.id"
          class="subject-tab"
          :class="{ active: selectedSubjectId === subject.id }"
          @click="selectSubject(subject)"
        >
          {{ subject.name }}
          <view class="active-line" v-if="selectedSubjectId === subject.id"></view>
        </view>
      </scroll-view>

      <!-- 章节列表 -->
      <view class="chapter-container">
        <view v-if="loading" class="loading-state">
          <text>正在加载章节...</text>
        </view>
        <view v-else-if="!chaptersMap[selectedSubjectId] || chaptersMap[selectedSubjectId].length === 0" class="no-data">
          <text>该科目暂无章节数据</text>
        </view>
        <view v-else class="chapter-list">
          <view 
            class="chapter-card" 
            v-for="chapter in chaptersMap[selectedSubjectId]" 
            :key="chapter.id"
            @click="handleChapterClick(chapter)"
          >
            <view class="chapter-info">
              <view class="chapter-name">{{ chapter.name }}</view>
              <view class="chapter-meta">
                <text class="q-count">题目：{{ chapter.questionCount || 0 }}</text>
                <text v-if="chapter.subChapterCount > 0" class="sub-count">考点：{{ chapter.subChapterCount }}</text>
              </view>
            </view>
            <view class="arrow-icon">❯</view>
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
  background-color: #ffffff;
  z-index: 100;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
}

.nav-content {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  position: relative;
}

.back-btn {
  padding: 20rpx;
  margin-left: -20rpx;
}

.back-icon {
  font-size: 36rpx;
  color: #333;
}

.nav-title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.search-entry {
  padding: 20rpx;
  margin-right: -20rpx;
}

.search-icon {
  font-size: 36rpx;
}

.subject-tabs {
  background-color: #ffffff;
  white-space: nowrap;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #eee;
}

.subject-tab {
  display: inline-block;
  padding: 0 40rpx;
  font-size: 28rpx;
  color: #666;
  position: relative;
}

.subject-tab.active {
  color: #007aff;
  font-weight: bold;
}

.active-line {
  position: absolute;
  bottom: -10rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 40rpx;
  height: 4rpx;
  background-color: #007aff;
  border-radius: 2rpx;
}

.chapter-container {
  padding: 30rpx;
}

.chapter-card {
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.03);
}

.chapter-info {
  flex: 1;
}

.chapter-name {
  font-size: 30rpx;
  color: #333;
  font-weight: 500;
  margin-bottom: 12rpx;
}

.chapter-meta {
  display: flex;
  gap: 20rpx;
}

.q-count, .sub-count {
  font-size: 24rpx;
  color: #999;
}

.arrow-icon {
  font-size: 28rpx;
  color: #ccc;
  margin-left: 20rpx;
}

.loading-state, .no-data {
  padding: 100rpx 0;
  text-align: center;
  color: #999;
  font-size: 28rpx;
}
</style>
