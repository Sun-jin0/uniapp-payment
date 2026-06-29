<template>
  <view class="container">
    <!-- 主体内容 -->
    <scroll-view class="main-content" scroll-y>
      <view v-if="loading" class="loading-state">
        <text>加载中...</text>
      </view>
      
      <template v-else-if="tutorial">
        <!-- 章节列表 -->
        <view class="chapter-section">
          
          <view class="chapter-list">
            <view 
              v-for="chapter in chapters" 
              :key="chapter.id" 
              class="chapter-group"
            >
              <!-- 章节标题 -->
              <view class="chapter-header" @tap="toggleChapter(chapter.id)">
                <view class="chapter-left">
                  <view class="expand-icon">
                    <SvgIcon :name="expandedChapters[chapter.id] ? 'down' : 'right'" size="24" fill="#bbb" />
                  </view>
                  <text class="chapter-name">{{ chapter.name }}</text>
                </view>
                <view class="chapter-right">
                  <text class="chapter-count">{{ chapter.question_count }}题</text>
                </view>
              </view>
              
              <!-- 小节列表 -->
              <view class="section-list" v-if="expandedChapters[chapter.id]">
                <view 
                  v-for="section in chapter.children" 
                  :key="section.id" 
                  class="section-item"
                  @tap="goToPractice(section)"
                >
                  <view class="section-left">
                    <view class="section-dot"></view>
                    <text class="section-name">{{ section.name }}</text>
                  </view>
                  <view class="section-right">
                    <text class="section-count">{{ section.question_count }}题</text>
                    <SvgIcon name="right" size="24" fill="#ccc" />
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </template>
      
      <view v-else class="empty-state">
        <text>教辅不存在或已下架</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { request } from '@/api/request';
import SvgIcon from '@/components/SvgIcon/SvgIcon.vue';

const loading = ref(true);
const tutorial = ref(null);
const chapters = ref([]);
const expandedChapters = ref({});

const tutorialId = ref(null);

onMounted(async () => {
  // 获取路由参数
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options || {};

  tutorialId.value = options.tutorialId;

  if (tutorialId.value) {
    await fetchTutorialDetail();
  }
});

const fetchTutorialDetail = async () => {
  loading.value = true;
  try {
    const res = await request({
      url: `/computer/tutorials/${tutorialId.value}`
    });
    
    if (res.code === 0) {
      tutorial.value = res.data;
      chapters.value = res.data.chapters || [];
      
      // 默认展开第一个章节
      if (chapters.value.length > 0) {
        expandedChapters.value[chapters.value[0].id] = true;
      }
    }
  } catch (error) {
    console.error('获取教辅详情失败:', error);
  } finally {
    loading.value = false;
  }
};

const toggleChapter = (chapterId) => {
  expandedChapters.value[chapterId] = !expandedChapters.value[chapterId];
};

const goToPractice = (section) => {
  // 获取该小节下的所有题目ID
  const questionIds = section.question_ids || [];
  if (questionIds.length === 0) {
    uni.showToast({
      title: '该章节暂无题目',
      icon: 'none'
    });
    return;
  }
  
  // 构建题目类型列表（用于筛选）
  const questionTypes = [...new Set(section.question_types || ['单选题', '多选题', '填空题', '解答题'])];
  
  // 检查是否有保存的进度
  const progressKey = `computer_chapter_${section.id}`;
  const progressList = uni.getStorageSync('practiceProgressList') || [];
  const savedProgress = progressList.find(item => item.progressKey === progressKey);
  
  // 确定要跳转的题目ID
  let targetQuestionId = questionIds[0];
  if (savedProgress && savedProgress.url) {
    const queryString = savedProgress.url.split('?')[1];
    if (queryString) {
      const params = {};
      queryString.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) {
          params[key] = decodeURIComponent(value);
        }
      });
      const savedQuestionId = params.questionId;
      if (savedQuestionId && questionIds.includes(savedQuestionId)) {
        targetQuestionId = savedQuestionId;
      }
    }
  }
  
  // 跳转到 computer-practice 页面
  uni.navigateTo({
    url: `/pages/computer/computer-practice?questionId=${targetQuestionId}&context=chapter_${section.id}_types_${questionTypes.join(',')}&chapterId=${section.id}&majorId=tutorial`
  });
};
</script>

<style lang="scss" scoped>
.container {
  height: 100vh;
  background-color: #f8f9fa;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-content {
  flex: 1;
  padding: 20rpx;
  height: 100vh;
  overflow-y: auto;
}

.chapter-section {
}

.chapter-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.chapter-group {
  background-color: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.chapter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 24rpx;
  
  &:active {
    background-color: #f9f9f9;
  }
  
  .chapter-left {
    display: flex;
    align-items: center;
    flex: 1;
    
    .expand-icon {
      margin-right: 12rpx;
    }
    
    .chapter-name {
      font-size: 30rpx;
      font-weight: 600;
      color: #333;
    }
  }
  
  .chapter-right {
    .chapter-count {
      font-size: 24rpx;
      color: #4db6ac;
      background-color: #e0f2f1;
      padding: 4rpx 16rpx;
      border-radius: 20rpx;
    }
  }
}

.section-list {
  background-color: #fafafa;
  border-top: 1rpx solid #f0f0f0;
}

.section-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 24rpx 24rpx 60rpx;
  border-bottom: 1rpx solid #f0f0f0;
  
  &:active {
    background-color: #f5f5f5;
  }
  
  &:last-child {
    border-bottom: none;
  }
  
  .section-left {
    display: flex;
    align-items: center;
    flex: 1;
    
    .section-dot {
      width: 8rpx;
      height: 8rpx;
      border-radius: 50%;
      background-color: #ccc;
      margin-right: 16rpx;
    }
    
    .section-name {
      font-size: 28rpx;
      color: #555;
    }
  }
  
  .section-right {
    display: flex;
    align-items: center;
    
    .section-count {
      font-size: 24rpx;
      color: #999;
      margin-right: 8rpx;
    }
  }
}

.loading-state, .empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 100rpx;
  color: #999;
  font-size: 28rpx;
}
</style>
