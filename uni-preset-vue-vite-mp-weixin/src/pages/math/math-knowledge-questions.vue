<template>
  <view class="page">

    
    <view class="filter-bar">
      <view class="filter-row">
        <text class="filter-label">题型：</text>
        <scroll-view scroll-x class="filter-scroll">
          <view class="filter-options">
            <view 
              v-for="type in questionTypes" 
              :key="type.value"
              class="filter-item"
              :class="{ active: selectedQuestionTypes.includes(type.value) }"
              @tap="toggleQuestionType(type.value)"
            >
              {{ type.label }}
            </view>
          </view>
        </scroll-view>
      </view>
      <view class="filter-row">
        <text class="filter-label">来源：</text>
        <scroll-view scroll-x class="filter-scroll">
          <view class="filter-options">
            <view 
              v-for="type in bookTypes" 
              :key="type.value"
              class="filter-item"
              :class="{ active: selectedBookTypes.includes(type.value) }"
              @tap="toggleBookType(type.value)"
            >
              {{ type.label }}
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <scroll-view class="content" scroll-y>
      <view v-if="loading" class="loading">加载中...</view>
      
      <view v-else-if="filteredQuestions.length === 0" class="empty">
        <text>暂无题目</text>
      </view>

      <view v-else class="question-list">
        <template v-for="(q, index) in filteredQuestions" :key="q.QuestionID">
          <view 
            class="question-item"
            @tap="goToQuestion(q)"
          >
            <view class="question-top">
              <text class="question-num">{{ index + 1 }}</text>
              <view class="question-tags">
                <text class="tag type-tag">{{ q.QuestionType }}</text>
                <text v-if="q.bookType" class="tag book-tag">{{ getBookTypeText(q.bookType) }}</text>
              </view>
            </view>
            <view class="question-content">
              <image 
                v-if="q.QuestionImg" 
                :src="q.QuestionImg.replace('http://', 'https://')" 
                class="question-img" 
                mode="widthFix"
              />
              <view v-else class="question-text">{{ formatText(q.QuestionText) }}</view>
            </view>
          </view>
        </template>
      </view>
    </scroll-view>

    <view v-if="filteredQuestions.length > 0" class="bottom-bar">
      <view class="bottom-left">
        <view v-if="level4Categories.length > 0" class="catalog-btn" @tap="showLevel4Modal = true">
          <view class="catalog-icon">
            <view class="catalog-line"></view>
            <view class="catalog-line"></view>
            <view class="catalog-line"></view>
            <view class="catalog-line"></view>
          </view>
          <text>目录</text>
        </view>
      </view>
      <view class="start-btn" @tap="startPractice">开始练习</view>
    </view>
    
    <!-- 四级考点目录弹窗 -->
    <view class="modal-mask" v-if="showLevel4Modal" @tap="showLevel4Modal = false">
      <view class="level4-modal bottom-sheet" @tap.stop>
        <view class="modal-header">
          <text>四级考点目录</text>
          <text class="close" @tap="showLevel4Modal = false">✕</text>
        </view>
        <scroll-view scroll-y class="level4-list">
          <!-- 全部选项 -->
          <view 
            class="level4-item level3-item"
            :class="{ active: selectedLevel4 === 'all' }"
            @tap="selectLevel4('all')"
          >
            <text class="level4-name">全部</text>
          </view>
          <!-- 四级考点列表 -->
          <view 
            v-for="level4 in level4Categories" 
            :key="level4.id"
            class="level4-item"
            :class="{ active: selectedLevel4 === level4.id }"
            @tap="selectLevel4(level4.id)"
          >
            <text class="level4-name">{{ level4.name }}</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { request } from '@/api/request';

const pointId = ref('');
const pointName = ref('');
const selectedBookTypes = ref(['all']);
const selectedQuestionTypes = ref(['all']);
const selectedLevel4 = ref('all');
const level4Categories = ref([]);
const showLevel4Modal = ref(false);

// 树形目录数据
const knowledgeTree = ref({ subjects: [] });
const expandedSubjects = ref(new Set());
const expandedChapters = ref(new Set());
const bookTypes = [
  { label: '全部', value: 'all' },
  { label: '书籍', value: 'book' },
  { label: '模拟卷', value: 'mock_paper' },
  { label: '真题卷', value: 'real_paper' }
];
const questionTypes = ref([
  { label: '全部', value: 'all' }
]);
const questions = ref([]);
const loading = ref(false);

const filteredQuestions = computed(() => {
  let result = questions.value;
  
  // 四级目录筛选
  if (selectedLevel4.value !== 'all') {
    const selectedCat = level4Categories.value.find(c => c.id === selectedLevel4.value);
    if (selectedCat) {
      result = result.filter(q => q.LinkNames && q.LinkNames.includes(selectedCat.name));
    }
  }
  
  // 来源多选筛选
  if (!selectedBookTypes.value.includes('all')) {
    result = result.filter(q => selectedBookTypes.value.includes(q.bookType || q.ContentType));
  }
  
  // 题型多选筛选
  if (!selectedQuestionTypes.value.includes('all')) {
    result = result.filter(q => selectedQuestionTypes.value.includes(q.QuestionType));
  }
  
  return result;
});

const fetchQuestions = async () => {
  if (!pointId.value) return;
  try {
    loading.value = true;
    
    // 并行获取题目和四级目录
    const [questionsRes, level4Res] = await Promise.all([
      request({
        url: `/math/questions/by-knowledge-point?knowledgePointId=${pointId.value}`,
        method: 'GET'
      }),
      request({
        url: `/math/knowledge-categories`,
        method: 'GET'
      })
    ]);
    
    questions.value = questionsRes.data || [];
    
    // 从考点分类数据中提取四级目录
    const categoriesData = level4Res.data;
    if (categoriesData && categoriesData.subjects) {
      // 找到当前三级考点所属的四级目录
      const allLevel4 = [];
      categoriesData.subjects.forEach(subject => {
        subject.chapters?.forEach(chapter => {
          chapter.points?.forEach(point => {
            if (point.id === parseInt(pointId.value)) {
              // 找到了当前三级考点，查找其四级子目录
              // 需要从完整分类数据中查找
            }
          });
        });
      });
      
      // 重新查询四级目录
      fetchLevel4Categories();
    }
    
    const typeSet = new Set();
    questions.value.forEach(q => {
      if (q.QuestionType) typeSet.add(q.QuestionType);
    });
    questionTypes.value = [
      { label: '全部', value: 'all' },
      ...Array.from(typeSet).map(t => ({ label: t, value: t }))
    ];
  } catch (err) {
    console.error('获取题目失败:', err);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

// 获取四级目录
const fetchLevel4Categories = async () => {
  try {
    const res = await request({
      url: `/math/knowledge-point-level4?parentId=${pointId.value}`,
      method: 'GET'
    });
    level4Categories.value = res.data || [];
  } catch (err) {
    console.error('获取四级目录失败:', err);
  }
};

const goToQuestion = (q) => {
  // 点击单个题目时，也传递所有题目的 ids，以便可以切换题目
  const ids = filteredQuestions.value.map(q => q.QuestionID).join(',');
  uni.navigateTo({
    url: `/pages/math/math-question-detail?ids=${ids}&questionId=${q.QuestionID}`
  });
};

const startPractice = () => {
  if (filteredQuestions.value.length === 0) return;
  const ids = filteredQuestions.value.map(q => q.QuestionID).join(',');
  uni.navigateTo({
    url: `/pages/math/math-question-detail?ids=${ids}`
  });
};

// 选择四级目录
const selectLevel4 = (id) => {
  selectedLevel4.value = id;
  showLevel4Modal.value = false;
};

// 切换题型选择（多选）
const toggleQuestionType = (value) => {
  if (value === 'all') {
    // 点击"全部"，重置为只选全部
    selectedQuestionTypes.value = ['all'];
  } else {
    // 点击具体题型
    const index = selectedQuestionTypes.value.indexOf(value);
    if (index > -1) {
      // 已选中，取消选择
      selectedQuestionTypes.value.splice(index, 1);
      // 如果没有选中任何题型，默认选"全部"
      if (selectedQuestionTypes.value.length === 0) {
        selectedQuestionTypes.value = ['all'];
      }
    } else {
      // 未选中，添加选择
      // 如果当前选了"全部"，先移除
      const allIndex = selectedQuestionTypes.value.indexOf('all');
      if (allIndex > -1) {
        selectedQuestionTypes.value.splice(allIndex, 1);
      }
      selectedQuestionTypes.value.push(value);
    }
  }
};

// 切换来源选择（多选）
const toggleBookType = (value) => {
  if (value === 'all') {
    // 点击"全部"，重置为只选全部
    selectedBookTypes.value = ['all'];
  } else {
    // 点击具体来源
    const index = selectedBookTypes.value.indexOf(value);
    if (index > -1) {
      // 已选中，取消选择
      selectedBookTypes.value.splice(index, 1);
      // 如果没有选中任何来源，默认选"全部"
      if (selectedBookTypes.value.length === 0) {
        selectedBookTypes.value = ['all'];
      }
    } else {
      // 未选中，添加选择
      // 如果当前选了"全部"，先移除
      const allIndex = selectedBookTypes.value.indexOf('all');
      if (allIndex > -1) {
        selectedBookTypes.value.splice(allIndex, 1);
      }
      selectedBookTypes.value.push(value);
    }
  }
};

const formatText = (text) => {
  if (!text) return '';
  const plain = text.replace(/<[^>]+>/g, '');
  return plain.length > 100 ? plain.slice(0, 100) + '...' : plain;
};

const getBookTypeText = (type) => {
  const map = { book: '书籍', mock_paper: '模拟卷', real_paper: '真题卷' };
  return map[type] || type;
};

onMounted(() => {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  const options = current.$page?.options || current.options || {};
  pointId.value = options.pointId || '';
  pointName.value = decodeURIComponent(options.pointName || '考点题目');
  uni.setNavigationBarTitle({ title: pointName.value });
  fetchQuestions();
  fetchLevel4Categories();
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f8f9fa;
}

/* 筛选栏样式优化 */
.filter-bar {
  background: linear-gradient(135deg, #4db6ac 0%, #26a69a 100%);
  padding: 20rpx 30rpx;
}

.filter-row {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.filter-row:last-child {
  margin-bottom: 0;
}

.filter-label {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.9);
  width: 80rpx;
  flex-shrink: 0;
  font-weight: 500;
}

.filter-scroll {
  flex: 1;
  overflow: hidden;
}

.filter-options {
  display: flex;
  gap: 16rpx;
  white-space: nowrap;
}

.filter-item {
  padding: 10rpx 24rpx;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.15);
  border-radius: 30rpx;
  flex-shrink: 0;
  transition: all 0.25s ease;
}

.filter-item.active {
  color: #4db6ac;
  background: #fff;
  font-weight: 600;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.1);
}

.content {
  height: calc(100vh - 200rpx);
}

.loading, .empty {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400rpx;
  color: #999;
  font-size: 28rpx;
}

/* 题目列表样式 */
.question-list {
  padding: 20rpx;
}

.question-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  transition: all 0.25s ease;
}

.question-item:active {
  transform: translateY(-2rpx);
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.1);
}

.question-top {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.question-num {
  font-size: 28rpx;
  font-weight: 600;
  color: #4db6ac;
  margin-right: 16rpx;
  background: rgba(77, 182, 172, 0.1);
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  min-width: 48rpx;
  text-align: center;
}

.question-tags {
  display: flex;
  gap: 12rpx;
}

.tag {
  font-size: 22rpx;
  padding: 6rpx 14rpx;
  border-radius: 8rpx;
}

.type-tag {
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  color: #e65100;
}

.book-tag {
  background: linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 100%);
  color: #00695c;
}

.question-content {
  min-height: 100rpx;
}

.question-img {
  width: 100%;
  border-radius: 12rpx;
}

.question-text {
  font-size: 28rpx;
  color: #333;
  line-height: 1.6;
}

/* 底部栏样式 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 30rpx;
  background: #fff;
  border-top: 1rpx solid #f0f0f0;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.bottom-left {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.total-text {
  font-size: 28rpx;
  color: #666;
  font-weight: 500;
}

.catalog-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 20rpx;
  background: rgba(77, 182, 172, 0.1);
  border-radius: 30rpx;
  color: #4db6ac;
  font-size: 24rpx;
}

.catalog-icon {
  width: 32rpx;
  height: 32rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 4rpx 0;
}

.catalog-line {
  width: 100%;
  height: 3rpx;
  background-color: currentColor;
  border-radius: 2rpx;
}

.start-btn {
  padding: 16rpx 40rpx;
  background: linear-gradient(135deg, #4db6ac 0%, #26a69a 100%);
  color: #fff;
  font-size: 28rpx;
  border-radius: 40rpx;
  font-weight: 600;
  box-shadow: 0 4rpx 16rpx rgba(77, 182, 172, 0.3);
  transition: all 0.25s ease;
}

.start-btn:active {
  transform: scale(0.95);
  box-shadow: 0 2rpx 8rpx rgba(77, 182, 172, 0.2);
}

/* 弹窗样式 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.level4-modal {
  width: 100%;
  max-height: 70%;
  background: #fff;
  border-radius: 20rpx 20rpx 0 0;
  overflow: hidden;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx;
  background: #fff;
  border-bottom: 1rpx solid #f0f0f0;
}

.modal-header text {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.modal-header .close {
  font-size: 36rpx;
  padding: 10rpx;
  color: #999;
}

.level4-list {
  max-height: 600rpx;
  padding: 20rpx;
}

.level4-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
  transition: all 0.2s ease;
}

.level4-item:last-child {
  border-bottom: none;
}

.level4-item.active {
  background: rgba(77, 182, 172, 0.1);
  border-radius: 12rpx;
}

.level4-item:active {
  background: rgba(77, 182, 172, 0.05);
}

.level4-name {
  font-size: 28rpx;
  color: #333;
  flex: 1;
}

.level4-item.active .level4-name {
  color: #4db6ac;
  font-weight: 600;
}

/* 三级考点特殊样式（全部选项） */
.level4-item.level3-item {
  background: linear-gradient(135deg, #4db6ac, #26a69a);
  border-left: 6rpx solid #00897b;
  margin-bottom: 16rpx;
}

.level4-item.level3-item .level4-name {
  font-weight: 600;
  color: #fff;
}

.level4-item.level3-item.active {
  background: linear-gradient(135deg, #26a69a, #00897b);
  box-shadow: 0 4rpx 12rpx rgba(38, 166, 154, 0.3);
}

.level4-count {
  font-size: 24rpx;
  color: #999;
  margin-left: 20rpx;
}

.level4-item.active .level4-count {
  color: #4db6ac;
}
</style>
