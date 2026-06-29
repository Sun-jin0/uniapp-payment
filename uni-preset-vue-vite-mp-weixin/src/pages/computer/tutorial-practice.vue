<template>
  <view class="container" :style="{ paddingTop: statusBarHeight + 'px' }">
    <!-- 顶部导航 -->
    <view class="nav-header">
      <view class="back-icon" @tap="goBack">
        <SvgIcon name="left" size="44" fill="#333" />
      </view>
      <view class="nav-title">{{ title }}</view>
      <view class="placeholder"></view>
    </view>

    <!-- 题目内容 -->
    <scroll-view class="main-content" scroll-y>
      <view v-if="loading" class="loading-state">
        <text>加载中...</text>
      </view>
      
      <template v-else-if="questions.length > 0">
        <!-- 题目卡片 -->
        <view class="question-card">
          <!-- 题号和题型 -->
          <view class="question-header">
            <view class="question-number">
              <text class="current">{{ currentIndex + 1 }}</text>
              <text class="total">/{{ questions.length }}</text>
            </view>
            <view class="question-type" :class="getTypeClass(currentQuestion?.exercise_type_name)">
              {{ currentQuestion?.exercise_type_name }}
            </view>
          </view>
          
          <!-- 题目内容 -->
          <view class="question-content">
            <rich-text :nodes="renderContent(currentQuestion?.stem)"></rich-text>
          </view>
          
          <!-- 选项（选择题） -->
          <view v-if="isChoiceQuestion" class="options-list">
            <view 
              v-for="(option, key) in currentQuestion?.options" 
              :key="key"
              class="option-item"
              :class="{
                'selected': selectedAnswer === key,
                'correct': showAnswer && key === currentQuestion?.answer,
                'wrong': showAnswer && selectedAnswer === key && key !== currentQuestion?.answer
              }"
              @tap="selectOption(key)"
            >
              <view class="option-key">{{ key }}</view>
              <view class="option-text">
                <rich-text :nodes="renderContent(option)"></rich-text>
              </view>
            </view>
          </view>
          
          <!-- 答案和解析 -->
          <view v-if="showAnswer" class="answer-section">
            <view class="answer-header">
              <text class="answer-label">正确答案</text>
              <text class="answer-value">{{ currentQuestion?.answer }}</text>
            </view>
            <view class="analysis-section" v-if="currentQuestion?.analysis">
              <text class="analysis-label">解析</text>
              <view class="analysis-content">
                <rich-text :nodes="renderContent(currentQuestion?.analysis)"></rich-text>
              </view>
            </view>
          </view>
        </view>
      </template>
      
      <view v-else class="empty-state">
        <text>暂无题目</text>
      </view>
    </scroll-view>

    <!-- 底部操作栏 -->
    <view class="bottom-bar">
      <view class="nav-btn" :class="{ disabled: currentIndex === 0 }" @tap="prevQuestion">
        <SvgIcon name="left" size="32" fill="#666" />
        <text>上一题</text>
      </view>
      <view class="action-btns">
        <view class="action-btn" @tap="toggleAnswer">
          {{ showAnswer ? '隐藏答案' : '查看答案' }}
        </view>
      </view>
      <view class="nav-btn" :class="{ disabled: currentIndex >= questions.length - 1 }" @tap="nextQuestion">
        <text>下一题</text>
        <SvgIcon name="right" size="32" fill="#666" />
      </view>
    </view>

    <!-- 会员开通弹窗 -->
    <MembershipModal
      :visible="showMemberModal"
      :subjectKey="memberSubjectKey"
      :priceInfo="memberPriceInfo"
      @close="closeMemberModal"
      @success="onMemberSubscribeSuccess"
      @login-required="onMemberLoginRequired"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { request } from '@/api/request';
import SvgIcon from '@/components/SvgIcon/SvgIcon.vue';
import MembershipModal from '@/components/MembershipModal/MembershipModal.vue';
import { checkAccess, recordQuestionView, getFreeLimit } from '@/composables/useMembershipCheck.js';

const FREE_LIMIT = getFreeLimit();
const isMember = ref(false);
const showMemberModal = ref(false);
const memberSubjectKey = ref('computer');
const memberPriceInfo = ref(null);

const closeMemberModal = () => { showMemberModal.value = false; };
const onMemberSubscribeSuccess = () => { isMember.value = true; showMemberModal.value = false; };
const onMemberLoginRequired = () => {
  showMemberModal.value = false;
  uni.showModal({
    title: '提示', content: '请先登录后再开通会员',
    confirmText: '去登录',
    success: (res) => { if (res.confirm) uni.navigateTo({ url: '/pages/login/login' }); }
  });
};

const statusBarHeight = ref(0);
const loading = ref(true);
const questions = ref([]);
const currentIndex = ref(0);
const selectedAnswer = ref(null);
const showAnswer = ref(false);
const title = ref('');

const tutorialId = ref(null);
const chapterId = ref(null);

const currentQuestion = computed(() => {
  return questions.value[currentIndex.value] || null;
});

const isChoiceQuestion = computed(() => {
  const type = currentQuestion.value?.exercise_type_name;
  return type === '单选题' || type === '多选题';
});

onMounted(async () => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight;
  
  // 获取路由参数
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options || {};
  
  tutorialId.value = options.tutorialId;
  chapterId.value = options.chapterId;
  title.value = decodeURIComponent(options.title || '题集刷题');
  
  if (chapterId.value) {
    await fetchQuestions();
  }
});

const fetchQuestions = async () => {
  loading.value = true;
  try {
    const res = await request({
      url: `/computer/tutorial-chapters/${chapterId.value}/questions`
    });
    
    if (res.code === 0) {
      questions.value = (res.data || []).map(q => {
        // 解析选项
        let options = q.options;
        if (typeof options === 'string') {
          try {
            options = JSON.parse(options);
          } catch (e) {
            options = {};
          }
        }
        return {
          ...q,
          options
        };
      });
    }
  } catch (error) {
    console.error('获取题目失败:', error);
  } finally {
    loading.value = false;
  }
};

const renderContent = (content) => {
  if (!content) return '';
  // 处理图片等富文本内容
  return content;
};

const getTypeClass = (typeName) => {
  if (!typeName) return '';
  if (typeName.includes('单选')) return 'type-single';
  if (typeName.includes('多选')) return 'type-multi';
  if (typeName.includes('填空')) return 'type-fill';
  if (typeName.includes('判断')) return 'type-judge';
  if (typeName.includes('解答')) return 'type-essay';
  return '';
};

const selectOption = (key) => {
  if (showAnswer.value) return;
  selectedAnswer.value = key;
};

const toggleAnswer = () => {
  showAnswer.value = !showAnswer.value;
};

const prevQuestion = () => {
  if (currentIndex.value > 0) {
    const newIndex = currentIndex.value - 1;
    currentIndex.value = newIndex;
    selectedAnswer.value = null;
    showAnswer.value = false;

    // 会员检查：第20题及以后需要检查会员状态
    if (newIndex >= FREE_LIMIT && !isMember.value) {
      const result = checkAccess('computer', newIndex);
      if (result.showPrompt && !result.canAccess) {
        memberPriceInfo.value = result.subjectInfo;
        showMemberModal.value = true;
      }
    }

    // 记录做题次数
    recordQuestionView('computer');
  }
};

const nextQuestion = () => {
  if (currentIndex.value < questions.value.length - 1) {
    const newIndex = currentIndex.value + 1;
    currentIndex.value = newIndex;
    selectedAnswer.value = null;
    showAnswer.value = false;

    // 会员检查：第20题及以后需要检查会员状态
    if (newIndex >= FREE_LIMIT && !isMember.value) {
      const result = checkAccess('computer', newIndex);
      if (result.showPrompt && !result.canAccess) {
        memberPriceInfo.value = result.subjectInfo;
        showMemberModal.value = true;
      }
    }

    // 记录做题次数
    recordQuestionView('computer');
  }
};

const goBack = () => {
  uni.navigateBack();
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

.nav-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 20rpx;
  background-color: #fff;
  color: #333;
  
  .nav-title {
    font-size: 34rpx;
    font-weight: 600;
    max-width: 400rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .back-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60rpx;
    height: 60rpx;
  }
  
  .placeholder {
    width: 60rpx;
  }
}

.main-content {
  flex: 1;
  padding: 20rpx;
  padding-bottom: 140rpx;
}

.question-card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.question-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
  
  .question-number {
    .current {
      font-size: 36rpx;
      font-weight: 600;
      color: #4db6ac;
    }
    .total {
      font-size: 28rpx;
      color: #999;
    }
  }
  
  .question-type {
    font-size: 24rpx;
    padding: 6rpx 16rpx;
    border-radius: 20rpx;
    
    &.type-single {
      background-color: #e3f2fd;
      color: #1976d2;
    }
    &.type-multi {
      background-color: #f3e5f5;
      color: #7b1fa2;
    }
    &.type-fill {
      background-color: #fff3e0;
      color: #f57c00;
    }
    &.type-judge {
      background-color: #e8f5e9;
      color: #388e3c;
    }
    &.type-essay {
      background-color: #fce4ec;
      color: #c2185b;
    }
  }
}

.question-content {
  font-size: 30rpx;
  color: #333;
  line-height: 1.8;
  margin-bottom: 30rpx;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.option-item {
  display: flex;
  align-items: flex-start;
  padding: 20rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  transition: all 0.2s;
  
  &:active {
    background-color: #f5f5f5;
  }
  
  &.selected {
    border-color: #4db6ac;
    background-color: #e0f2f1;
  }
  
  &.correct {
    border-color: #4caf50;
    background-color: #e8f5e9;
  }
  
  &.wrong {
    border-color: #f44336;
    background-color: #ffebee;
  }
  
  .option-key {
    width: 48rpx;
    height: 48rpx;
    border-radius: 50%;
    background-color: #f5f5f5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26rpx;
    font-weight: 600;
    color: #666;
    margin-right: 16rpx;
    flex-shrink: 0;
  }
  
  .option-text {
    flex: 1;
    font-size: 28rpx;
    color: #333;
    line-height: 1.6;
  }
}

.answer-section {
  margin-top: 30rpx;
  padding-top: 30rpx;
  border-top: 1rpx solid #f0f0f0;
  
  .answer-header {
    display: flex;
    align-items: center;
    margin-bottom: 20rpx;
    
    .answer-label {
      font-size: 28rpx;
      color: #999;
      margin-right: 16rpx;
    }
    
    .answer-value {
      font-size: 32rpx;
      font-weight: 600;
      color: #4caf50;
    }
  }
  
  .analysis-section {
    .analysis-label {
      font-size: 28rpx;
      color: #999;
      display: block;
      margin-bottom: 12rpx;
    }
    
    .analysis-content {
      font-size: 28rpx;
      color: #555;
      line-height: 1.8;
      background-color: #fafafa;
      padding: 20rpx;
      border-radius: 12rpx;
    }
  }
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120rpx;
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30rpx;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.04);
  
  .nav-btn {
    display: flex;
    align-items: center;
    padding: 16rpx 24rpx;
    
    &.disabled {
      opacity: 0.4;
    }
    
    text {
      font-size: 28rpx;
      color: #666;
      margin: 0 8rpx;
    }
  }
  
  .action-btns {
    display: flex;
    gap: 20rpx;
    
    .action-btn {
      padding: 16rpx 32rpx;
      background-color: #4db6ac;
      color: #fff;
      font-size: 28rpx;
      border-radius: 40rpx;
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
