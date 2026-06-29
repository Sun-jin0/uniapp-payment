<template>
  <view class="page">
    <view class="search-box">
      <view class="search-input-wrap">
        <text class="search-icon">搜索</text>
        <input 
          type="text" 
          v-model="searchKeyword"
          placeholder="输入考点名称"
          class="search-input"
          @input="onSearch"
        />
        <text v-if="searchKeyword" class="clear-btn" @tap="clearSearch">清除</text>
      </view>
    </view>

    <scroll-view class="content" scroll-y>
      <view v-if="loading" class="loading">加载中...</view>
      
      <view v-else-if="filteredTree.length === 0" class="empty">
        <text v-if="searchKeyword">未找到相关考点</text>
        <text v-else>暂无考点数据</text>
      </view>

      <view v-else class="tree-list">
        <view v-for="subject in filteredTree" :key="subject.id" class="subject-item">
          <view class="subject-header" @tap="toggleSubject(subject.id)">
            <view class="arrow" :class="{ expanded: expandedSubjects.has(subject.id) }"></view>
            <text class="subject-name">{{ subject.name }}</text>
          </view>
          
          <view v-show="expandedSubjects.has(subject.id)" class="chapter-list">
            <view v-for="chapter in subject.chapters" :key="chapter.id" class="chapter-item">
              <view class="chapter-header" @tap="toggleChapter(chapter.id)">
                <view class="arrow" :class="{ expanded: expandedChapters.has(chapter.id) }"></view>
                <text class="chapter-name">{{ chapter.name }}</text>
              </view>
              
              <view v-show="expandedChapters.has(chapter.id)" class="point-list">
                <view
                  v-for="point in chapter.points"
                  :key="point.id"
                  class="point-item"
                  @tap="goToQuestions(point)"
                >
                  <text class="point-name">{{ point.name }}</text>
                  <view class="point-arrow"></view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { request } from '@/api/request';

const searchKeyword = ref('');
const treeData = ref(null);
const expandedSubjects = ref(new Set());
const expandedChapters = ref(new Set());
const loading = ref(false);

const fetchTreeData = async () => {
  try {
    loading.value = true;
    const res = await request({
      url: '/math/knowledge-categories',
      method: 'GET'
    });
    treeData.value = res.data;
    if (res.data?.subjects?.length > 0) {
      expandedSubjects.value.add(res.data.subjects[0].id);
    }
  } catch (err) {
    console.error('获取考点失败:', err);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const filteredTree = computed(() => {
  if (!treeData.value?.subjects) return [];
  if (!searchKeyword.value) return treeData.value.subjects;
  
  const keyword = searchKeyword.value.toLowerCase();
  return treeData.value.subjects.map(subject => {
    const filteredChapters = subject.chapters?.map(chapter => {
      const filteredPoints = chapter.points?.filter(p => 
        p.name.toLowerCase().includes(keyword)
      ) || [];
      return { ...chapter, points: filteredPoints };
    }).filter(c => c.points?.length > 0) || [];
    
    return { ...subject, chapters: filteredChapters };
  }).filter(s => s.chapters?.length > 0);
});

const toggleSubject = (id) => {
  if (expandedSubjects.value.has(id)) {
    expandedSubjects.value.delete(id);
  } else {
    expandedSubjects.value.add(id);
  }
};

const toggleChapter = (id) => {
  if (expandedChapters.value.has(id)) {
    expandedChapters.value.delete(id);
  } else {
    expandedChapters.value.add(id);
  }
};

const onSearch = () => {
  if (searchKeyword.value) {
    filteredTree.value.forEach(subject => {
      expandedSubjects.value.add(subject.id);
      subject.chapters?.forEach(chapter => {
        expandedChapters.value.add(chapter.id);
      });
    });
  }
};

const clearSearch = () => {
  searchKeyword.value = '';
};

const goToQuestions = (point) => {
  uni.navigateTo({
    url: `/pages/math/math-knowledge-questions?pointId=${point.id}&pointName=${encodeURIComponent(point.name)}`
  });
};

onMounted(() => {
  fetchTreeData();
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f8f9fa;
}

/* 搜索框样式优化 */
.search-box {
  padding: 16rpx 30rpx;
  background: linear-gradient(135deg, #4db6ac 0%, #26a69a 100%);
}

.search-input-wrap {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 40rpx;
  padding: 0 24rpx;
  height: 72rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.search-icon {
  font-size: 24rpx;
  color: #4db6ac;
  margin-right: 12rpx;
  font-weight: 500;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
  background: transparent;
  border: none;
  outline: none;
}

.search-input ::v-deep .uni-input-wrapper {
  background: transparent;
}

.search-input ::v-deep .uni-input-input {
  background: transparent;
  font-size: 28rpx;
  color: #333;
  border: none;
  outline: none;
}

.search-input ::v-deep .uni-input-placeholder {
  color: #999;
  font-size: 28rpx;
}

.clear-btn {
  font-size: 24rpx;
  color: #4db6ac;
  padding: 8rpx 16rpx;
  font-weight: 500;
}

.content {
  height: calc(100vh - 104rpx);
}

.loading, .empty {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400rpx;
  color: #999;
  font-size: 28rpx;
}

/* 树形列表样式 */
.tree-list {
  padding: 20rpx;
}

/* 科目卡片样式 */
.subject-item {
  margin-bottom: 20rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.subject-header {
  display: flex;
  align-items: center;
  padding: 24rpx 30rpx;
  background: linear-gradient(135deg, #4db6ac 0%, #26a69a 100%);
  cursor: pointer;
  transition: all 0.3s ease;
}

.subject-header:active {
  opacity: 0.9;
}

.arrow {
  width: 32rpx;
  height: 32rpx;
  margin-right: 16rpx;
  transition: transform 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
}

.arrow::after {
  content: '';
  width: 0;
  height: 0;
  border-left: 8rpx solid transparent;
  border-right: 8rpx solid transparent;
  border-top: 10rpx solid #fff;
  transition: transform 0.3s ease;
}

.arrow.expanded {
  transform: rotate(180deg);
}

.subject-name {
  flex: 1;
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
}

/* 章节列表样式 */
.chapter-list {
  padding: 0 20rpx;
}

.chapter-item {
  border-bottom: 1rpx solid #f0f0f0;
}

.chapter-item:last-child {
  border-bottom: none;
}

.chapter-header {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chapter-header:active {
  background: #f8f9fa;
}

.chapter-header .arrow {
  background: rgba(77, 182, 172, 0.1);
  width: 28rpx;
  height: 28rpx;
  margin-right: 12rpx;
}

.chapter-header .arrow::after {
  border-top-color: #4db6ac;
  border-left-width: 6rpx;
  border-right-width: 6rpx;
  border-top-width: 8rpx;
}

.chapter-name {
  flex: 1;
  font-size: 30rpx;
  color: #333;
  font-weight: 500;
}

/* 考点列表样式 */
.point-list {
  padding: 0 0 16rpx 40rpx;
}

.point-item {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  margin-bottom: 12rpx;
  background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%);
  border-radius: 12rpx;
  border: 1rpx solid #e8e8e8;
  cursor: pointer;
  transition: all 0.25s ease;
}

.point-item:active {
  background: linear-gradient(135deg, #e0f2f1 0%, #f8f9fa 100%);
  border-color: #4db6ac;
  transform: translateX(4rpx);
}

.point-name {
  flex: 1;
  font-size: 28rpx;
  color: #333;
  line-height: 1.4;
}

.point-count {
  font-size: 24rpx;
  color: #4db6ac;
  font-weight: 600;
  margin-right: 16rpx;
  background: rgba(77, 182, 172, 0.1);
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
}

.point-arrow {
  width: 32rpx;
  height: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(77, 182, 172, 0.1);
  border-radius: 50%;
}

.point-arrow::after {
  content: '';
  width: 0;
  height: 0;
  border-top: 6rpx solid transparent;
  border-bottom: 6rpx solid transparent;
  border-left: 8rpx solid #4db6ac;
}
</style>
