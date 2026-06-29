<template>
  <view class="container" :style="{ paddingTop: statusBarHeight + 'px' }">
    <!-- 顶部导航 -->
    <view class="nav-header">
      <view class="back-icon" @tap="goBack">
        <svg-icon name="back" size="40" />
      </view>
      <view class="nav-title">书籍详情</view>
      <view class="reset-icon" @tap="handleClearRecord">
        <svg-icon name="clear" size="40" color="#fff" />
      </view>
    </view>

    <scroll-view class="content-scroll" scroll-y>
      <!-- 书籍信息卡片 -->
      <view class="book-card">
        <view class="book-cover">
          <svg-icon name="books" size="80" color="#4db6ac" />
        </view>
        <view class="book-info">
          <view class="book-title">{{ bookInfo.title || '加载中...' }}</view>
          <view class="book-stats">
            <view class="stat-item">
              <text class="stat-value">{{ bookInfo.questionCount || 0 }}</text>
              <text class="stat-label">总题数</text>
            </view>
            <view class="stat-item">
              <text class="stat-value">{{ bookInfo.doneCount || 0 }}</text>
              <text class="stat-label">已做</text>
            </view>
            <view class="stat-item">
              <text class="stat-value">{{ bookInfo.wrongCount || 0 }}</text>
              <text class="stat-label">错题</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 练习模式选择 -->
      <view class="practice-modes">
        <view class="mode-item" @tap="startPractice('order')">
          <view class="mode-icon order">
            <svg-icon name="order" size="48" color="#fff" />
          </view>
          <text class="mode-name">顺序练习</text>
        </view>
        <view class="mode-item" @tap="startPractice('wrong')">
          <view class="mode-icon wrong">
            <svg-icon name="wrong" size="48" color="#fff" />
          </view>
          <text class="mode-name">错题重做</text>
          <view class="badge" v-if="bookInfo.wrongCount > 0">{{ bookInfo.wrongCount }}</view>
        </view>
        <view class="mode-item" @tap="startPractice('favorite')">
          <view class="mode-icon favorite">
            <svg-icon name="star" size="48" color="#fff" />
          </view>
          <text class="mode-name">我的收藏</text>
          <view class="badge" v-if="bookInfo.favoriteCount > 0">{{ bookInfo.favoriteCount }}</view>
        </view>
        <view class="mode-item" @tap="startPractice('category')">
          <view class="mode-icon category">
            <svg-icon name="category" size="48" color="#fff" />
          </view>
          <text class="mode-name">题型练习</text>
        </view>
      </view>

      <!-- 快捷入口 -->
      <view class="quick-actions" v-if="bookInfo.lastIndex > 0">
        <view class="action-card continue" @tap="startPractice('continue')">
          <view class="card-left">
            <view class="card-title">继续练习</view>
            <view class="card-desc">上次练习到第 {{ bookInfo.lastIndex + 1 }} 题</view>
          </view>
          <svg-icon name="play" size="40" color="#fff" />
        </view>
      </view>

      <!-- 章节列表 -->
      <view id="chapters" class="section-container">
        <view class="section-header">
          <view class="section-title">章节练习</view>
        </view>

        <!-- 一级章节 Tab (如：马原、毛中特) -->
        <scroll-view class="subject-tabs" scroll-x v-if="chapters.length > 0">
          <view 
            v-for="(subject, index) in chapters" 
            :key="subject.id"
            class="tab-item"
            :class="{ active: currentSubjectIndex === index }"
            @tap="currentSubjectIndex = index"
          >
            <text>{{ subject.name }}</text>
            <view class="active-line" v-if="currentSubjectIndex === index"></view>
          </view>
        </scroll-view>

        <view v-if="loading" class="loading-state">
          <text>加载中...</text>
        </view>
        
        <view v-else-if="currentSubject" class="chapter-list">
          <view v-for="(chapter, index) in currentSubject.children" :key="chapter.id" class="chapter-group">
            <!-- 二级章节 (如：导论、第一章) -->
            <view class="chapter-header" @tap="toggleChapter(index)">
              <view class="header-left">
                <view class="chapter-dot" :class="{ 'has-children': chapter.children && chapter.children.length > 0 }"></view>
                <text class="chapter-name">{{ chapter.name }}</text>
              </view>
              <view class="header-right">
                <text class="progress-text">{{ chapter.doneCount || 0 }}/{{ chapter.totalCount || 0 }}</text>
                <svg-icon v-if="!chapter.children || chapter.children.length === 0" name="edit" size="32" color="#4db6ac" style="margin-left: 10rpx;" />
              </view>
            </view>
            
            <view class="chapter-meta">
              <text>正确率: {{ calculateAccuracy(chapter) }}%</text>
              <text class="divider">|</text>
              <text>答错{{ chapter.doneCount - chapter.correctCount || 0 }}题</text>
            </view>

            <!-- 三级章节 (如：单选、多选) -->
            <view v-if="chapter.expanded" class="sub-chapter-list">
              <view 
                v-for="sub in chapter.children" 
                :key="sub.id" 
                class="sub-item"
                @tap="startPractice('chapter', sub)"
              >
                <view class="sub-left">
                  <view class="sub-dot"></view>
                  <text class="sub-name">{{ sub.name }}</text>
                </view>
                <view class="sub-right">
                  <text class="sub-progress">{{ sub.doneCount || 0 }}/{{ sub.totalCount || 0 }}</text>
                  <svg-icon name="edit" size="32" color="#4db6ac" />
                </view>
                <view class="sub-meta">
                  <text>正确率: {{ calculateAccuracy(sub) }}%</text>
                  <text class="divider">|</text>
                  <text>答错{{ sub.doneCount - sub.correctCount || 0 }}题</text>
                </view>
              </view>
            </view>
          </view>
        </view>
        
        <view v-else-if="!loading" class="empty-state">
          <text>暂无章节数据</text>
        </view>
      </view>
    </scroll-view>

    <!-- 底部按钮 -->
    <view class="bottom-bar">
      <view class="action-btn secondary" @tap="startPractice('wrong')">
        <svg-icon name="note" size="36" color="#4db6ac" />
        <text>错题重做</text>
      </view>
      <view class="action-btn primary" @tap="startPractice('continue')">
        <text>继续练习</text>
      </view>
      <view class="action-btn secondary" @tap="toggleMemoryMode">
        <svg-icon :name="memoryMode ? 'eye' : 'eye-close'" size="36" :color="memoryMode ? '#4db6ac' : '#999'" />
        <text>{{ memoryMode ? '背题模式' : '做题模式' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import publicApi from '@/api/public';
import SvgIcon from '@/components/SvgIcon/SvgIcon.vue';

const statusBarHeight = ref(0);
const bookId = ref(null);
const bookInfo = ref({});
const chapters = ref([]);
const availableTypes = ref([]);
const currentSubjectIndex = ref(0);
const loading = ref(true);
const memoryMode = ref(false);
const allExpanded = ref(false);

const currentSubject = computed(() => {
  if (chapters.value.length === 0) return null;
  return chapters.value[currentSubjectIndex.value];
});

const calculateAccuracy = (item) => {
  if (!item.doneCount || item.doneCount === 0) return 0;
  return Math.round((item.correctCount / item.doneCount) * 100);
};

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight;

  const pages = getCurrentPages();
  const options = pages[pages.length - 1].options;
  bookId.value = options.bookId;
  
  if (options.title) {
    bookInfo.value.title = decodeURIComponent(options.title);
  }

  fetchData();
});

onShow(() => {
  if (bookId.value) {
    fetchData();
  }
});

const fetchData = async () => {
  loading.value = true;
  try {
    // 获取章节数据和题型数据
    const [chapterRes, typeRes] = await Promise.all([
      publicApi.getBookChapters({ bookId: bookId.value }),
      publicApi.getBookTypes({ bookId: bookId.value })
    ]);

    if (chapterRes.code === 0) {
      // 递归处理章节数据，添加 expanded 属性
      const processChapters = (list) => {
        return list.map(item => ({
          ...item,
          expanded: false,
          children: item.children ? processChapters(item.children) : []
        }));
      };
      
      const data = chapterRes.data.chapters || chapterRes.data; // 兼容旧接口格式
      chapters.value = processChapters(data);
      
      // 更新书籍统计信息
      if (chapterRes.data.bookInfo) {
        bookInfo.value = { ...bookInfo.value, ...chapterRes.data.bookInfo };
      }
    }

    if (typeRes.code === 0) {
      availableTypes.value = typeRes.data;
    }
  } catch (error) {
    console.error('Fetch data error:', error);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  uni.navigateBack();
};

const toggleChapter = (index) => {
  if (currentSubject.value && currentSubject.value.children[index]) {
    const chapter = currentSubject.value.children[index];
    // 如果没有子章节（小节），直接开始练习该章
    if (!chapter.children || chapter.children.length === 0) {
      startPractice('chapter', chapter);
    } else {
      chapter.expanded = !chapter.expanded;
    }
  }
};

const toggleExpandAll = () => {
  allExpanded.value = !allExpanded.value;
  chapters.value.forEach(c => {
    c.expanded = allExpanded.value;
  });
};

const scrollToChapters = () => {
  // 简单的滚动实现
  uni.createSelectorQuery()
    .select('#chapters')
    .boundingClientRect(data => {
      if (data) {
        uni.pageScrollTo({
          scrollTop: data.top,
          duration: 300
        });
      }
    }).exec();
};

const toggleMemoryMode = () => {
  memoryMode.value = !memoryMode.value;
  uni.showToast({
    title: memoryMode.value ? '已开启背题模式' : '已切换为做题模式',
    icon: 'none'
  });
};

const handleClearRecord = () => {
  uni.showModal({
    title: '提示',
    content: '确定要清空该书籍的所有练习记录吗？此操作不可撤销。',
    confirmColor: '#4db6ac',
    success: async (res) => {
      if (res.confirm) {
        try {
          const response = await publicApi.clearPracticeRecord({ bookId: bookId.value });
          if (response.code === 0) {
            uni.showToast({ title: '已清空记录', icon: 'success' });
            fetchData(); // 重新加载数据
          }
        } catch (error) {
          console.error('Clear record error:', error);
          uni.showToast({ title: '清空失败', icon: 'none' });
        }
      }
    }
  });
};

const startPractice = (mode, extra = null) => {
  // 检查是否有保存的进度
  let progressKey = null;
  if (mode === 'continue') {
    progressKey = `public_book_${bookId.value}`;
  } else if (mode === 'chapter' && extra && extra.id) {
    progressKey = `public_chapter_${extra.id}`;
  } else if (mode === 'wrong') {
    progressKey = `public_wrong_${bookId.value}`;
  } else if (mode === 'favorite') {
    progressKey = `public_favorite_${bookId.value}`;
  }
  
  if (progressKey) {
    const progressList = uni.getStorageSync('practiceProgressList') || [];
    const savedProgress = progressList.find(item => item.progressKey === progressKey);
    
    // 如果有保存的进度且进度中有 URL，直接跳转到刷题页面
    if (savedProgress && savedProgress.url && savedProgress.currentIndex > 1) {
      uni.navigateTo({ url: savedProgress.url });
      return;
    }
  }
  
  let url = `/pages/public/public-practice?bookId=${bookId.value}&mode=${mode}&title=${encodeURIComponent(bookInfo.value.title || '练习')}`;
  
  if (mode === 'category') {
    // 题型练习：弹出选择题型
    if (availableTypes.value.length === 0) {
      uni.showToast({ title: '该书籍暂无题型数据', icon: 'none' });
      return;
    }

    const itemList = availableTypes.value.map(t => `${t.name} (${t.count})`);
    
    uni.showActionSheet({
      itemList: itemList,
      success: (res) => {
        const typeObj = availableTypes.value[res.tapIndex];
        const type = typeObj.type;
        const typeName = typeObj.name;
        url += `&type=${type}&typeName=${encodeURIComponent(typeName)}`;
        if (memoryMode.value) url += `&memoryMode=1`;
        uni.navigateTo({ url });
      }
    });
    return;
  }

  if (extra) {
    if (extra.id) url += `&chapterId=${extra.id}`;
    if (extra.name) url += `&chapterName=${encodeURIComponent(extra.name)}`;
  }
  
  if (memoryMode.value) {
    url += `&memoryMode=1`;
  }

  uni.navigateTo({ url });
};
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background-color: #f5f7f9;
  display: flex;
  flex-direction: column;
}

.nav-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 30rpx;
  background-color: #4db6ac;
  color: #fff;
  position: sticky;
  top: 0;
  z-index: 100;
  .nav-title {
    font-size: 34rpx;
    font-weight: 500;
  }
  .back-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .reset-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .placeholder {
    width: 40rpx;
  }
}

.content-scroll {
  flex: 1;
}

.book-card {
  margin: 30rpx;
  padding: 40rpx;
  background-color: #fff;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
  
  .book-cover {
    width: 160rpx;
    height: 200rpx;
    background-color: #e0f2f1;
    border-radius: 12rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 40rpx;
  }
  
  .book-info {
    flex: 1;
    .book-title {
      font-size: 36rpx;
      font-weight: bold;
      color: #333;
      margin-bottom: 30rpx;
      line-height: 1.4;
    }
    .book-stats {
      display: flex;
      justify-content: space-between;
      .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        .stat-value {
          font-size: 32rpx;
          font-weight: bold;
          color: #4db6ac;
        }
        .stat-label {
          font-size: 22rpx;
          color: #999;
          margin-top: 4rpx;
        }
      }
    }
  }
}

.practice-modes {
  display: flex;
  justify-content: space-around;
  padding: 30rpx 0;
  background-color: #fff;
  border-radius: 20rpx;
  margin: 0 30rpx 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
  
  .mode-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      
      .mode-icon {
        width: 100rpx;
        height: 100rpx;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 16rpx;
        
        &.order { background: linear-gradient(135deg, #4db6ac, #00897b); }
        &.wrong { background: linear-gradient(135deg, #ef5350, #c62828); }
        &.favorite { background: linear-gradient(135deg, #ffca28, #f9a825); }
        &.category { background: linear-gradient(135deg, #ffb74d, #f57c00); }
        &.chapter { background: linear-gradient(135deg, #81c784, #388e3c); }
      }
      
      .mode-name {
        font-size: 26rpx;
        color: #333;
      }

      .badge {
        position: absolute;
        top: -10rpx;
        right: -10rpx;
        background-color: #f44336;
        color: #fff;
        font-size: 20rpx;
        padding: 4rpx 10rpx;
        border-radius: 20rpx;
        min-width: 30rpx;
        text-align: center;
        border: 2rpx solid #fff;
      }
    }
}

.quick-actions {
  margin: 0 30rpx 30rpx;
  .action-card {
    padding: 30rpx;
    border-radius: 20rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    &.continue {
      background: linear-gradient(135deg, #4db6ac, #00796b);
      box-shadow: 0 8rpx 24rpx rgba(77, 182, 172, 0.3);
    }
    
    .card-left {
      .card-title {
        font-size: 32rpx;
        font-weight: bold;
        color: #fff;
        margin-bottom: 8rpx;
      }
      .card-desc {
        font-size: 24rpx;
        color: rgba(255, 255, 255, 0.8);
      }
    }
  }
}

.section-container {
  background-color: #fff;
  margin: 0 30rpx 120rpx;
  border-radius: 20rpx;
  padding: 30rpx;
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20rpx;
    .section-title {
      font-size: 32rpx;
      font-weight: bold;
      color: #333;
      position: relative;
      padding-left: 20rpx;
      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 8rpx;
        height: 32rpx;
        background-color: #4db6ac;
        border-radius: 4rpx;
      }
    }
  }
}

.subject-tabs {
  white-space: nowrap;
  margin-bottom: 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
  .tab-item {
    display: inline-block;
    padding: 20rpx 40rpx;
    font-size: 30rpx;
    color: #666;
    position: relative;
    &.active {
      color: #333;
      font-weight: bold;
    }
    .active-line {
      position: absolute;
      bottom: 0;
      left: 40rpx;
      right: 40rpx;
      height: 6rpx;
      background-color: #4db6ac;
      border-radius: 3rpx;
    }
  }
}

.chapter-list {
  .chapter-group {
    margin-bottom: 30rpx;
    .chapter-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20rpx 0 10rpx;
      .header-left {
        display: flex;
        align-items: center;
        .chapter-dot {
          width: 16rpx;
          height: 16rpx;
          border-radius: 50%;
          background-color: #4db6ac;
          margin-right: 20rpx;
          position: relative;
          &::after {
            content: '';
            position: absolute;
            top: 16rpx;
            left: 7rpx;
            width: 2rpx;
            height: 100rpx;
            background-color: #e0e0e0;
          }
          &.has-children {
            background-color: #fff;
            border: 4rpx solid #4db6ac;
            width: 12rpx;
            height: 12rpx;
          }
        }
        .chapter-name {
          font-size: 30rpx;
          color: #333;
          font-weight: 500;
        }
      }
      .header-right {
        display: flex;
        align-items: center;
        .progress-text {
          font-size: 26rpx;
          color: #999;
        }
      }
    }
    
    .chapter-meta {
      font-size: 22rpx;
      color: #999;
      padding-left: 36rpx;
      margin-bottom: 20rpx;
      display: flex;
      align-items: center;
      .divider {
        margin: 0 12rpx;
        color: #eee;
      }
    }
    
    .sub-chapter-list {
      padding-left: 36rpx;
      .sub-item {
        margin-bottom: 20rpx;
        padding: 20rpx 0;
        border-bottom: 1rpx solid #f9f9f9;
        &:last-child { border-bottom: none; }
        
        .sub-left {
          display: flex;
          align-items: center;
          margin-bottom: 10rpx;
          .sub-dot {
            width: 12rpx;
            height: 12rpx;
            border-radius: 50%;
            background-color: #80cbc4;
            margin-right: 16rpx;
          }
          .sub-name {
            font-size: 28rpx;
            color: #444;
          }
        }
        
        .sub-right {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          margin-top: -40rpx;
          .sub-progress {
            font-size: 24rpx;
            color: #999;
            margin-right: 20rpx;
          }
        }
        
        .sub-meta {
          font-size: 20rpx;
          color: #bbb;
          display: flex;
          align-items: center;
          padding-left: 28rpx;
          .divider {
            margin: 0 10rpx;
          }
        }
      }
    }
  }
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100rpx;
  background-color: #fff;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.05);
  padding-bottom: env(safe-area-inset-bottom);
  
  .action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 80rpx;
    
    &.secondary {
      width: 140rpx;
      text {
        font-size: 20rpx;
        color: #666;
        margin-top: 4rpx;
      }
    }
    
    &.primary {
      flex: 1;
      background-color: #4db6ac;
      color: #fff;
      border-radius: 40rpx;
      font-size: 30rpx;
      font-weight: bold;
      margin: 0 20rpx;
    }
  }
}

.loading-state, .empty-state {
  padding: 60rpx 0;
  text-align: center;
  color: #999;
  font-size: 26rpx;
}
</style>
