<script setup>
import { ref, onMounted, nextTick, computed } from 'vue';
import { request } from '../../api/request';
import { processStem } from './utils/questionUtils';

const props = defineProps(['majorId', 'chapterId', 'title']);
const statusBarHeight = ref(0);
const questions = ref([]);
const filteredQuestions = ref([]);
const loading = ref(true);
const displayTitle = ref('');
const headerHeight = ref(88);
const selectedTypes = ref(['单选题', '解答题']);
const questionTypes = ref(['全部', '单选题', '多选题', '判断题', '填空题', '解答题']);

// 只做真题模式
const onlyRealExam = ref(false);

// 选择模式相关
const isSelectMode = ref(false);
const selectedQuestionIds = ref([]);
const targetChapterId = ref(null);

const typeOrder = ['单选题', '多选题', '判断题', '填空题', '解答题'];

// 做题进度相关
const completedQuestionIds = ref(new Set());
const lastQuestionId = ref(null);
const scrollIntoId = ref('');

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

// 虚拟滚动配置
const ITEM_HEIGHT = 180; // 每个题目卡片预估高度(rpx)
const BUFFER_SIZE = 1; // 上下缓冲区域题目数量（只缓冲1个，总共显示3个）
const visibleStartIndex = ref(0);
const visibleEndIndex = ref(10);
const scrollTop = ref(0);
const listHeight = ref(0);

// 计算可见区域的题目（只加载3个：当前+上下各1个）
const visibleQuestions = computed(() => {
  const start = Math.max(0, visibleStartIndex.value - BUFFER_SIZE);
  const end = Math.min(filteredQuestions.value.length, visibleEndIndex.value + BUFFER_SIZE);
  return filteredQuestions.value.slice(start, end).map((item, index) => ({
    ...item,
    _virtualIndex: start + index
  }));
});

// 计算总高度
const totalHeight = computed(() => {
  return filteredQuestions.value.length * ITEM_HEIGHT;
});

// 处理滚动事件
const onScroll = (e) => {
  scrollTop.value = e.detail.scrollTop;
  const scrollViewHeight = listHeight.value || 800;
  const itemHeightPx = ITEM_HEIGHT * (uni.getSystemInfoSync().windowWidth / 750);
  
  visibleStartIndex.value = Math.floor(scrollTop.value / itemHeightPx);
  visibleEndIndex.value = Math.ceil((scrollTop.value + scrollViewHeight) / itemHeightPx);
};

// 获取题目样式（用于虚拟滚动定位）
const getItemStyle = (index) => {
  return {
    position: 'absolute',
    top: (index * ITEM_HEIGHT) + 'rpx',
    left: 0,
    right: 0
  };
};

const fetchProgress = async () => {
  try {
    const res = await request({
      url: '/computer1/progress',
      method: 'GET'
    });
    if (res.code === 0 && res.data) {
      const progressData = res.data;
      const completed = new Set();
      let lastId = null;
      let lastTime = 0;

      progressData.forEach(item => {
        // 兼容不同的大小写和字段名
        const status = item.Status !== undefined ? item.Status : item.status;
        const qId = item.QuestionID || item.question_id;
        const timeStr = item.UpdatedAt || item.updated_at || item.CreatedAt || item.created_at;
        
        // Status: 1 为 completed
        if (String(status) === '1' || status === 'completed') {
          completed.add(String(qId));
        }
        
        if (timeStr) {
          const updateTime = new Date(timeStr).getTime();
          if (updateTime > lastTime) {
            lastTime = updateTime;
            lastId = String(qId);
          }
        }
      });
      completedQuestionIds.value = completed;
      lastQuestionId.value = lastId;
    }
  } catch (error) {
    console.error('获取进度失败:', error);
  }
};

const showAddTypeModal = ref(false);
const availableTypes = computed(() => {
  const all = questionTypes.value.filter(t => t !== '全部');
  return all.filter(t => !selectedTypes.value.includes(t));
});

const openAddTypeModal = () => {
  if (availableTypes.value.length === 0) {
    uni.showToast({ title: '已选择所有题型', icon: 'none' });
    return;
  }
  showAddTypeModal.value = true;
};

const updateHeaderHeight = () => {
  nextTick(() => {
    const query = uni.createSelectorQuery();
    query.select('#nav-bar').boundingClientRect(data => {
      if (data) {
        headerHeight.value = data.height;
      }
    }).exec();
  });
};

onMounted(async () => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight || 0;
  
  updateHeaderHeight();

  // 获取页面参数
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options || {};
  
  const majorId = options.majorId;
  const chapterId = options.chapterId;
  const tagId = options.tagId;
  const examGroupId = options.examGroupId;
  const title = options.title ? decodeURIComponent(options.title) : '';
  
  // 检查是否为选择模式
  if (options.mode === 'select') {
    isSelectMode.value = true;
    targetChapterId.value = options.targetChapterId;
  }
  
  displayTitle.value = title || (isSelectMode.value ? '选择题目' : '题目列表');

  await Promise.all([fetchQuestions(options), fetchProgress()]);
  
  // 自动跳转到上一次做题位置
  if (lastQuestionId.value) {
    nextTick(() => {
      // 稍微延迟确保渲染完成
      setTimeout(() => {
        scrollIntoId.value = 'question-' + lastQuestionId.value;
      }, 300);
    });
  }
});

const toggleSelect = (questionId) => {
  const index = selectedQuestionIds.value.indexOf(questionId);
  if (index > -1) {
    selectedQuestionIds.value.splice(index, 1);
  } else {
    selectedQuestionIds.value.push(questionId);
  }
};

const submitSelection = async () => {
  if (selectedQuestionIds.value.length === 0) {
    uni.showToast({ title: '请选择题目', icon: 'none' });
    return;
  }

  try {
    const res = await request({
      url: `/computer1/curated-chapters/${targetChapterId.value}/questions`,
      method: 'POST',
      data: {
        questionIds: selectedQuestionIds.value
      }
    });

    if (res.code === 0) {
      uni.showToast({ title: '添加成功', icon: 'success' });
      setTimeout(() => {
        uni.navigateBack();
      }, 1500);
    }
  } catch (error) {
    console.error('添加题目失败:', error);
    uni.showToast({ title: '添加失败', icon: 'none' });
  }
};

const fetchQuestions = async (params) => {
  loading.value = true;
  try {
    const res = await request({ 
      url: '/computer1/questions',
      data: params
    });
    let data = res.data || [];

    // 排序题目：单选 > 多选 > 判断 > 填空 > 解答，同题型内按 question_id 顺序排列
    data.sort((a, b) => {
      const indexA = typeOrder.indexOf(a.exercise_type_name);
      const indexB = typeOrder.indexOf(b.exercise_type_name);
      
      const orderA = indexA === -1 ? 999 : indexA;
      const orderB = indexB === -1 ? 999 : indexB;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      // 同题型内按 exercise_number 顺序排序，确保“按顺序排序”的要求
      return (Number(a.exercise_number) || 0) - (Number(b.exercise_number) || 0);
    });

    // 渲染填空和 LaTeX
    data.forEach(q => {
      if (q.stem) q.stem = processStem(q.stem);
    });
    questions.value = data;
    
    // 提取并排序题型
    const types = [...new Set(data.map(q => q.exercise_type_name))].filter(Boolean);
    types.sort((a, b) => {
      const indexA = typeOrder.indexOf(a);
      const indexB = typeOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
    questionTypes.value = ['全部', ...types];
    
    updateHeaderHeight();
    filterQuestions();
  } catch (error) {
    console.error('获取题目列表失败:', error);
  } finally {
    loading.value = false;
  }
};

const filterQuestions = () => {
  let result = questions.value;
  
  // 题型筛选
  if (!selectedTypes.value.includes('全部')) {
    result = result.filter(q => selectedTypes.value.includes(q.exercise_type_name));
  }
  
  // 只做真题筛选 (exam_code 为 408 且 from_school 为 全国统考)
  if (onlyRealExam.value) {
    result = result.filter(q => q.exam_code === '408' && q.from_school === '全国统考');
  }
  
  filteredQuestions.value = result;
};

// 切换只做真题模式
const toggleRealExam = () => {
  onlyRealExam.value = !onlyRealExam.value;
  filterQuestions();
  updateHeaderHeight();
};

const selectType = (type) => {
  if (type === '全部') {
    selectedTypes.value = ['全部'];
  } else {
    // 如果之前是全部，先清空
    if (selectedTypes.value.includes('全部')) {
      selectedTypes.value = [];
    }
    
    const index = selectedTypes.value.indexOf(type);
    if (index > -1) {
      selectedTypes.value.splice(index, 1);
      // 如果删完后空了，自动选回全部
      if (selectedTypes.value.length === 0) {
        selectedTypes.value = ['全部'];
      }
    } else {
      selectedTypes.value.push(type);
      // 保持排序顺序
      selectedTypes.value.sort((a, b) => {
        const indexA = typeOrder.indexOf(a);
        const indexB = typeOrder.indexOf(b);
        return indexA - indexB;
      });
    }
  }
  updateHeaderHeight();
  filterQuestions();
};

const addType = (type) => {
  if (!type) return;
  selectType(type);
  showAddTypeModal.value = false;
};

const removeType = (type) => {
  if (type === '全部') return;
  const idx = selectedTypes.value.indexOf(type);
  if (idx > -1) {
    selectedTypes.value.splice(idx, 1);
    if (selectedTypes.value.length === 0) {
      selectedTypes.value = ['全部'];
    }
    updateHeaderHeight();
    filterQuestions();
  }
};
const goToDetail = (question) => {
  if (isSelectMode.value) {
    toggleSelect(question.question_id);
    return;
  }
  // 保存当前过滤后的题目列表ID，供详情页导航使用
  const idList = filteredQuestions.value.map(q => q.question_id);
  uni.setStorageSync('computer_question_list', JSON.stringify(idList));
  
  // 生成上下文标识，包含题型，用于自动定位
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options || {};
  let contextKey = options.tagId ? `tag_${options.tagId}` : 
                    (options.chapterId ? `chapter_${options.chapterId}` : 
                    (options.examGroupId ? `exam_${options.examGroupId}` : 'default'));
  
  if (!selectedTypes.value.includes('全部')) {
    contextKey += `_types_${selectedTypes.value.join(',')}`;
  }
  
  uni.setStorageSync('computer_question_context', contextKey);
  
  // 构造跳转 URL，携带所有必要参数作为兜底
  let practiceUrl = `/pages/computer/computer-practice?questionId=${question.question_id}&context=${contextKey}`;
  if (options.tagId) practiceUrl += `&tagId=${options.tagId}`;
  if (options.chapterId) practiceUrl += `&chapterId=${options.chapterId}`;
  if (options.majorId) practiceUrl += `&majorId=${options.majorId}`;
  if (options.examGroupId) practiceUrl += `&examGroupId=${options.examGroupId}`;
  
  // 生成 progressKey
  let progressKey = 'computer_general';
  if (options.chapterId) {
    progressKey = `computer_chapter_${options.chapterId}`;
  } else if (options.tagId) {
    progressKey = `computer_tag_${options.tagId}`;
  } else if (options.examGroupId) {
    progressKey = `computer_exam_${options.examGroupId}`;
  }
  
  // 保存到进度列表
  const practiceItem = {
    type: 'computer',
    subject: '计算机',
    id: options.chapterId || options.tagId || options.examGroupId || 'computer',
    title: displayTitle.value || '计算机刷题',
    url: practiceUrl,
    icon: 'computer',
    progressKey,
    currentIndex: filteredQuestions.value.findIndex(q => q.question_id === question.question_id) + 1,
    totalQuestions: filteredQuestions.value.length,
    timestamp: Date.now()
  };
  
  // 保存到进度列表
  let progressList = uni.getStorageSync('practiceProgressList') || [];
  if (!Array.isArray(progressList)) {
    progressList = [];
  }
  
  const existingIndex = progressList.findIndex(item => item.progressKey === progressKey);
  if (existingIndex !== -1) {
    progressList.splice(existingIndex, 1);
  }
  
  progressList.unshift(practiceItem);
  
  if (progressList.length > 10) {
    progressList = progressList.slice(0, 10);
  }
  
  uni.setStorageSync('practiceProgressList', progressList);
  
  uni.navigateTo({
    url: practiceUrl
  });
};

const goBack = () => {
  uni.navigateBack();
};
</script>

<template>
  <view class="container">
    <view class="custom-nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }" id="nav-bar">
      <view class="nav-content">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">❮</text>
        </view>
        <view class="nav-title">{{ displayTitle }}</view>
        <view v-if="isSelectMode" class="submit-btn" @click="submitSelection">
          确定({{ selectedQuestionIds.length }})
        </view>
      </view>
      <!-- 题型筛选标签 -->
      <view class="selected-tags-section" v-if="questionTypes.length > 1">
        <text class="tag-label">题型：</text>
        <scroll-view class="selected-tag-scroll" scroll-x>
          <view class="selected-tag-list">
            <view 
              v-for="type in (selectedTypes.includes('全部') ? ['全部'] : selectedTypes)" 
              :key="type"
              class="selected-tag-item"
            >
              <text>{{ type }}</text>
              <view v-if="type !== '全部'" class="remove-icon" @click.stop="removeType(type)">✕</view>
            </view>
            <view class="add-tag-btn" @click="openAddTypeModal">＋</view>
          </view>
        </scroll-view>
        <!-- 只做真题单选框 -->
        <view 
          class="real-exam-checkbox" 
          :class="{ active: onlyRealExam }"
          @click="toggleRealExam"
        >
          <view class="checkbox-icon">
            <view v-if="onlyRealExam" class="checkbox-inner"></view>
          </view>
          <text class="checkbox-text">408真题</text>
        </view>
      </view>

      <!-- 题型选择弹窗 -->
      <view class="modal-mask" v-if="showAddTypeModal" @click="showAddTypeModal = false" @touchmove.stop.prevent>
        <view class="modal-container" @click.stop>
          <view class="modal-header">
            <text class="modal-title">添加题型</text>
            <view class="modal-close" @click="showAddTypeModal = false">✕</view>
          </view>
          <view class="modal-body">
            <view 
              v-for="type in availableTypes" 
              :key="type" 
              class="type-option"
              @click="addType(type)"
            >
              <text class="type-name">{{ type }}</text>
              <text class="type-plus">＋</text>
            </view>
            <view v-if="availableTypes.length === 0" class="no-more-types">暂无更多题型</view>
          </view>
        </view>
      </view>
  </view>

    <scroll-view 
      class="question-list-scroll" 
      scroll-y 
      :style="{ height: `calc(100vh - ${headerHeight}px)`, marginTop: headerHeight + 'px' }"
      :scroll-into-view="scrollIntoId"
      @scroll="onScroll"
    >
      <view class="question-list-inner">
        <view v-if="loading" class="loading-state">
          <text>正在加载题目...</text>
        </view>
        <view v-else-if="filteredQuestions.length === 0" class="no-data">
          <text>{{ questions.length === 0 ? '该章节暂无题目' : '该分类下暂无题目' }}</text>
        </view>
        <view v-else class="question-list-normal">
          <template v-for="(question, index) in filteredQuestions" :key="question.question_id">
            <view 
              :id="'question-' + question.question_id"
              class="question-card" 
              :class="{ 
                'is-selected': isSelectMode && selectedQuestionIds.includes(question.question_id),
                'is-completed': completedQuestionIds.has(String(question.question_id))
              }"
              @click="goToDetail(question)"
            >
              <view class="question-info">
                <view v-if="isSelectMode" class="select-box">
                  <view class="checkbox" :class="{ checked: selectedQuestionIds.includes(question.question_id) }"></view>
                </view>
                <text class="info-item index">{{ index + 1 }}.</text>
                <text class="info-item type">{{ question.exercise_type_name }}</text>
                <text class="info-item source" v-if="question.exam_time || question.from_school || question.exam_code">
                  {{ [question.exam_time, question.from_school, question.exam_code].filter(Boolean).join(' · ') }}
              </text>
                <text class="info-item score" v-if="question.total_score">{{ question.total_score }}分</text>
              </view>
              <view class="card-body">
                <view class="question-stem" v-html="question.stem"></view>
              </view>
            </view>
            <!-- 每20题显示一个广告 -->
            <!-- #ifdef MP-WEIXIN -->
            <view v-if="(index + 1) % 20 === 0" class="ad-container">
              <ad-custom 
                unit-id="adunit-f1d0e339a07022e6" 
                @load="adLoad" 
                @error="adError" 
                @close="adClose"
              ></ad-custom>
            </view>
            <!-- #endif -->
          </template>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped lang="scss">
/* 原生模板广告容器 */
.ad-container {
  margin: 20rpx 24rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.container {
  min-height: 100vh;
  background-color: #f8f9fa;
  --primary-color: #4db6ac;
  --primary-light: #e0f2f1;
}

.custom-nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background-color: #4db6ac;
  z-index: 100;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.1);
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
  color: #fff;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  margin-right: 60rpx; /* 平衡返回按钮 */
}

.submit-btn {
  background-color: #fff;
  color: #4db6ac;
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 30rpx;
  font-weight: bold;
}

.custom-tags-section {
  padding: 8rpx 30rpx 16rpx;
  display: flex;
  align-items: center;
}

.tag-label {
  font-size: 24rpx;
  color: #fff;
  opacity: 0.8;
  margin-right: 12rpx;
  white-space: nowrap;
}

.selected-tags-section {
  padding: 12rpx 30rpx;
  display: flex;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.1);
  margin-top: 10rpx;
}

.tag-label {
  font-size: 24rpx;
  color: #fff;
  opacity: 0.9;
  margin-right: 16rpx;
  white-space: nowrap;
}

.selected-tag-scroll {
  flex: 1;
  white-space: nowrap;
  width: 0; /* 必须设置宽度或 flex: 1 以触发滚动 */
}

.selected-tag-list {
  display: inline-flex;
  align-items: center;
  gap: 16rpx;
  padding: 4rpx 0;
}

.selected-tag-item {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 20rpx;
  background-color: #fff;
  color: #4db6ac;
  border-radius: 30rpx;
  font-size: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.1);
}

.remove-icon {
  width: 32rpx;
  height: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #f5f5f5;
  color: #999;
  font-size: 20rpx;
  margin-right: -10rpx;
  margin-left: 4rpx;
}

.add-tag-btn {
  width: 50rpx;
  height: 50rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(255,255,255,0.2);
  border: 2rpx dashed rgba(255,255,255,0.4);
  border-radius: 50%;
  font-size: 32rpx;
  margin-left: 8rpx;
}

/* 只做真题单选框 */
.real-exam-checkbox {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 8rpx 16rpx;
  margin-left: 16rpx;
  cursor: pointer;
  transition: all 0.2s;
  
  .checkbox-icon {
    width: 32rpx;
    height: 32rpx;
    border: 2rpx solid rgba(255, 255, 255, 0.6);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    background-color: rgba(255, 255, 255, 0.1);
    
    .checkbox-inner {
      width: 16rpx;
      height: 16rpx;
      background-color: #fff;
      border-radius: 50%;
    }
  }
  
  .checkbox-text {
    font-size: 24rpx;
    color: #fff;
    white-space: nowrap;
  }
  
  &.active {
    .checkbox-icon {
      border-color: #fff;
      background-color: #fff;
      
      .checkbox-inner {
        background-color: #4db6ac;
      }
    }
    
    .checkbox-text {
      font-weight: bold;
    }
  }
  
  &:active {
    opacity: 0.8;
  }
}

/* 弹窗样式 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-container {
  width: 80%;
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
  animation: modalShow 0.3s ease-out;
}

@keyframes modalShow {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.modal-header {
  padding: 30rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid #f0f0f0;
}

.modal-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}

.modal-close {
  font-size: 32rpx;
  color: #999;
  padding: 10rpx;
}

.modal-body {
  padding: 20rpx 30rpx 40rpx;
  max-height: 60vh;
  overflow-y: auto;
}

.type-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f8f8f8;
}

.type-option:last-child {
  border-bottom: none;
}

.type-name {
  font-size: 28rpx;
  color: #333;
}

.type-plus {
  color: #4db6ac;
  font-size: 32rpx;
  font-weight: bold;
}

.no-more-types {
  text-align: center;
  padding: 40rpx 0;
  color: #999;
  font-size: 26rpx;
}

.question-list {
  padding: 20rpx;
}

.question-list-normal {
  padding: 0 10rpx;
}

// 虚拟列表容器
.virtual-list-container {
  position: relative;
  width: 100%;
}

// 虚拟列表项
.virtual-item {
  position: absolute;
  left: 0;
  right: 0;
  box-sizing: border-box;
}

.question-card {
  background-color: #fff;
  border-radius: 12rpx;
  padding: 16rpx;
  margin: 8rpx 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
  border: 2rpx solid transparent;
  transition: all 0.2s;
}

.question-info {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
  flex-wrap: wrap;
  gap: 12rpx;
}

.select-box {
  margin-right: 20rpx;
}

.checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid #ddd;
  border-radius: 50%;
  position: relative;
  transition: all 0.2s;
}

.checkbox.checked {
  background-color: #4db6ac;
  border-color: #4db6ac;
}

.checkbox.checked::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -60%) rotate(45deg);
  width: 10rpx;
  height: 20rpx;
  border-right: 4rpx solid #fff;
  border-bottom: 4rpx solid #fff;
}

.question-card.is-selected {
  background-color: #f0fcfb;
  border: 1rpx solid #4db6ac;
}

.question-card.is-completed {
  background-color: #f5f5f5; /* 灰色背景标记已完成 */
  opacity: 0.8;
}

.info-item {
  font-size: 22rpx;
  color: #999;
}

.info-item.index {
  color: #333;
  font-size: 24rpx;
}

.info-item.type {
  color: #4db6ac;
  background-color: #e0f2f1;
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
}

.info-item.source {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.info-item.score {
  color: #f57c00;
  font-weight: 500;
}

.card-body {
  margin-bottom: 0;
}

.question-stem {
  font-size: 28rpx;
  color: #333;
  line-height: 1.6;
  word-break: break-all;
}

.question-stem :deep(p) {
  margin: 0 0 2px 0 !important;
  padding: 0 !important;
  line-height: 1.6 !important;
}

.question-stem :deep(p:last-child) {
  margin-bottom: 0 !important;
}

.question-stem :deep(img) {
  max-width: 100% !important;
  height: auto !important;
  display: block !important;
}

.question-stem :deep(pre) {
  margin: 2px 0 !important;
  padding: 8px 12px !important;
}

:deep(.blank-placeholder) {
  display: inline-flex;
  align-items: baseline;
  margin: 0 8rpx;
  color: #4db6ac;
  vertical-align: middle;
}

:deep(.blank-index) {
  font-size: 24rpx;
  font-weight: normal;
  margin-right: 4rpx;
  color: #666;
}

:deep(.blank-underline) {
  border-bottom: 2rpx solid #4db6ac;
  min-width: 80rpx;
  display: inline-block;
  height: 2rpx;
  margin-bottom: 2rpx;
}

.loading-state, .no-data {
  text-align: center;
  padding: 100rpx 0;
  color: #999;
  font-size: 28rpx;
}
</style>
