<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { request } from '@/api/request';
import SvgIcon from '@/components/SvgIcon/SvgIcon.vue';
import { processStem } from './utils/questionUtils';
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
const paperId = ref('');
const paperTitle = ref('');
const questions = ref([]);
const currentIndex = ref(0);
const userAnswers = ref({});
const subAnswers = ref({});
const blankAnswers = ref({});
const remainingTime = ref(0);
const timer = ref(null);
const showAnswerSheet = ref(false);
const showConfirmSubmit = ref(false);
const showExitConfirm = ref(false);
const showResult = ref(false);
const scrollTop = ref(0);
const oldScrollTop = ref(0);

const dynamicFontSize = computed(() => {
  const levels = {
    small: { title: '30rpx', option: '28rpx', explanation: '28rpx', content: '28rpx' },
    standard: { title: '34rpx', option: '32rpx', explanation: '30rpx', content: '30rpx' },
    large: { title: '38rpx', option: '36rpx', explanation: '34rpx', content: '34rpx' },
    extra: { title: '42rpx', option: '40rpx', explanation: '38rpx', content: '38rpx' }
  };
  return levels.standard;
});

const currentQuestion = computed(() => {
  return questions.value[currentIndex.value] || {};
});

const answeredCount = computed(() => {
  let count = 0;
  questions.value.forEach(q => {
    const qid = q.question_id;
    if (userAnswers.value[qid] && userAnswers.value[qid].trim()) {
      count++;
    }
    if (q.exercise_type === 4 && q.subs && q.subs.length > 0) {
      const hasAnswer = q.subs.some(sub => {
        const subKey = sub.sub_id || sub.id;
        return subAnswers.value[subKey] && subAnswers.value[subKey].trim();
      });
      if (hasAnswer) count++;
    }
    if (q.exercise_type === 3 && blankAnswers.value[qid]) {
      const blanks = blankAnswers.value[qid];
      if (Array.isArray(blanks) && blanks.some(b => b && b.trim())) {
        count++;
      }
    }
  });
  return count;
});

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight || 0;
  
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  paperId.value = currentPage.$page?.options?.paperId || currentPage.options?.paperId;
  paperTitle.value = decodeURIComponent(currentPage.$page?.options?.title || currentPage.options?.title || '');
  
  if (paperId.value) {
    loadPaper();
  }
});

onUnmounted(() => {
  if (timer.value) {
    clearInterval(timer.value);
  }
});

const loadPaper = async () => {
  try {
    uni.showLoading({ title: '加载中...' });
    
    const res = await request({
      url: '/computer1/questions',
      data: { examGroupId: paperId.value }
    });

    if (res.code === 0 || res.data) {
      const questionsData = res.data || res;
      
      questions.value = (questionsData || []).map(async (q, index) => {
        const detailRes = await request({
          url: `/computer1/questions/${q.question_id}`
        });
        
        if (detailRes.code === 0 || detailRes.data) {
          q = detailRes.data || detailRes;
        }
        
        if (q.stem) {
          q.stem = processStem(q.stem);
        }
        
        if (q.options && q.options.length > 0) {
          q.options = q.options.map(opt => ({
            ...opt,
            option_value: processStem(opt.option_value)
          }));
        }
        
        if (q.subs && q.subs.length > 0) {
          q.subs.forEach(sub => {
            if (sub.stem) sub.stem = processStem(sub.stem);
            if (sub.answer) sub.answer = processStem(sub.answer);
            if (sub.analysis) sub.analysis = processStem(sub.analysis);
          });
        }
        
        return q;
      });
      
      questions.value = await Promise.all(questions.value);
      
      remainingTime.value = 120 * 60;
      startTimer();
      
      loadSavedAnswers();
    } else {
      uni.showToast({
        title: res.message || '加载试卷失败',
        icon: 'none'
      });
      setTimeout(() => {
        uni.navigateBack();
      }, 1500);
    }
  } catch (error) {
    console.error('加载试卷失败:', error);
    uni.showToast({
      title: '加载试卷失败',
      icon: 'none'
    });
  } finally {
    uni.hideLoading();
  }
};

const startTimer = () => {
  timer.value = setInterval(() => {
    if (remainingTime.value > 0) {
      remainingTime.value--;
      
      if (remainingTime.value === 300) {
        uni.showToast({
          title: '剩余5分钟',
          icon: 'none',
          duration: 2000
        });
      }
      
      if (remainingTime.value === 0) {
        clearInterval(timer.value);
        submitPaper();
      }
    }
  }, 1000);
};

const formatTime = (seconds) => {
  if (!seconds) return '00:00';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const getTypeName = (type) => {
  const types = {
    1: '单选题',
    2: '多选题',
    3: '填空题',
    4: '解答题',
    5: '判断题'
  };
  return types[type] || '其他题型';
};

const isChoiceQuestion = (question) => {
  const type = question.exercise_type || question.question_type;
  return type === 1 || type === 2 || type === 5;
};

const isFillQuestion = (question) => {
  const type = question.exercise_type || question.question_type;
  return type === 3;
};

const isEssayQuestion = (question) => {
  const type = question.exercise_type || question.question_type;
  const isEssay = type === 4 || type === '4' || question.exercise_type_name === '解答题';
  return isEssay;
};

const selectOption = (question, optionKey) => {
  if (showResult.value) return;
  userAnswers.value[question.question_id] = optionKey;
  saveAnswers();
};

const onSwiperChange = (e) => {
  const newIndex = e.detail.current;
  currentIndex.value = newIndex;
  scrollTop.value = oldScrollTop.value;
  nextTick(() => {
    scrollTop.value = 0;
  });

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
};

const prevQuestion = () => {
  if (currentIndex.value > 0) {
    const newIndex = currentIndex.value - 1;
    currentIndex.value = newIndex;

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

const jumpToQuestion = (index) => {
  currentIndex.value = index;
  showAnswerSheet.value = false;

  // 会员检查：第20题及以后需要检查会员状态
  if (index >= FREE_LIMIT && !isMember.value) {
    const result = checkAccess('computer', index);
    if (result.showPrompt && !result.canAccess) {
      memberPriceInfo.value = result.subjectInfo;
      showMemberModal.value = true;
    }
  }

  // 记录做题次数
  recordQuestionView('computer');
};

const confirmSubmit = () => {
  showConfirmSubmit.value = true;
};

const submitPaper = () => {
  showConfirmSubmit.value = false;
  showResult.value = true;
  
  uni.showToast({
    title: '交卷成功',
    icon: 'success'
  });
};

const confirmExit = () => {
  showExitConfirm.value = true;
};

const exitExam = () => {
  showExitConfirm.value = false;
  saveAnswers();
  uni.navigateBack();
};

const saveAnswers = () => {
  const key = `paper_answers_${paperId.value}`;
  uni.setStorageSync(key, {
    userAnswers: userAnswers.value,
    subAnswers: subAnswers.value,
    blankAnswers: blankAnswers.value
  });
};

const loadSavedAnswers = () => {
  const key = `paper_answers_${paperId.value}`;
  const saved = uni.getStorageSync(key);
  if (saved) {
    userAnswers.value = saved.userAnswers || {};
    subAnswers.value = saved.subAnswers || {};
    blankAnswers.value = saved.blankAnswers || {};
  }
};

const clearSavedAnswers = () => {
  const key = `paper_answers_${paperId.value}`;
  uni.removeStorageSync(key);
};

const onScroll = (e) => {
  oldScrollTop.value = e.detail.scrollTop;
};

const goBack = () => {
  confirmExit();
};
</script>

<template>
  <view class="app-container">
    <view class="custom-nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-left">
          <view class="back-btn" @click="goBack">
            <text class="back-icon">❮</text>
          </view>
        </view>
        
        <view class="nav-title">
          <text>{{ paperTitle || '全真测试' }}</text>
          <text class="progress-text" v-if="questions.length > 0">
            ({{ currentIndex + 1 }}/{{ questions.length }})
          </text>
        </view>
        
        <view class="nav-right">
          <view class="timer-box" :class="{ warning: remainingTime < 300 }" v-if="remainingTime > 0">
            <text class="timer-text">{{ formatTime(remainingTime) }}</text>
          </view>
        </view>
      </view>
      <view class="progress-bar-container" v-if="questions.length > 0">
        <view class="progress-bar-fill" :style="{ width: ((currentIndex + 1) / questions.length * 100) + '%' }"></view>
      </view>
    </view>

    <swiper
      v-if="questions.length > 0"
      :key="questions.length"
      class="content-scroll"
      :current="currentIndex"
      @change="onSwiperChange"
      :duration="250"
    >
      <swiper-item v-for="(question, qIndex) in questions" :key="question.question_id || qIndex">
        <scroll-view 
          class="swiper-scroll" 
          scroll-y 
          :enable-back-to-top="true" 
          :show-scrollbar="false"
          :enhanced="true"
          :scroll-top="scrollTop"
          @scroll="onScroll"
        >
          <view class="question-detail">
            <view class="question-info" v-if="question">
              <view class="info-left">
                <text class="info-item type">{{ question.exercise_type_name || getTypeName(question.exercise_type) }}</text>
              </view>
              <view class="info-right">
                <text class="question-score" v-if="question.total_score">{{ question.total_score }}分</text>
              </view>
            </view>

            <view class="stem-section">
              <view class="stem-text">
                <text class="question-index">{{ qIndex + 1 }}.</text>
                <view class="stem-content" v-html="question.stem"></view>
              </view>
            </view>

            <view class="options-section" v-if="isChoiceQuestion(question) && question.options && question.options.length > 0">
              <view 
                v-for="option in question.options" 
                :key="option.option_key"
                class="option-item"
                :class="{ selected: userAnswers[question.question_id] === option.option_key }"
                @click="selectOption(question, option.option_key)"
              >
                <view class="option-key">
                  <text>{{ option.option_key }}</text>
                </view>
                <view class="option-value" v-html="option.option_value"></view>
              </view>
            </view>

            <view class="blanks-input-section" v-if="isFillQuestion(question)">
              <view class="blank-input-item">
                <text class="blank-label">答案</text>
                <input 
                  class="blank-input" 
                  v-model="userAnswers[question.question_id]" 
                  placeholder="请输入答案"
                  :disabled="showResult"
                />
              </view>
            </view>

            <view class="saq-input-section" v-if="isEssayQuestion(question) && (!question.subs || question.subs.length === 0)">
              <textarea 
                class="saq-input" 
                v-model="userAnswers[question.question_id]" 
                placeholder="请输入您的答案..."
                :disabled="showResult"
              />
            </view>

            <view class="subs-section" v-if="isEssayQuestion(question) && question.subs && question.subs.length > 0">
              <view v-for="(sub, index) in question.subs" :key="sub.sub_id || sub.id || index" class="sub-item">
                <view class="sub-header">
                  <text class="sub-index">({{ index + 1 }})</text>
                  <text class="sub-score" v-if="sub.score">[{{ sub.score }}分]</text>
                </view>
                <view class="sub-stem" v-html="sub.stem"></view>
                
                <view class="sub-input-section">
                  <textarea 
                    class="sub-input" 
                    v-model="subAnswers[sub.sub_id || sub.id || index]" 
                    placeholder="请输入该小题的答案..."
                    :disabled="showResult"
                  />
                </view>

                <view v-if="showResult && sub.answer" class="sub-answer-section">
                  <view class="sub-answer">
                    <text class="label">【答案】</text>
                    <view v-html="sub.answer"></view>
                  </view>
                  <view class="sub-analysis" v-if="sub.analysis">
                    <text class="label">【解析】</text>
                    <view v-html="sub.analysis"></view>
                  </view>
                </view>
              </view>
            </view>

            <view class="answer-section" v-if="showResult">
              <view v-if="question.answer && question.answer.trim() !== ''" class="answer-box">
                <view class="answer-title">正确答案</view>
                <view class="answer-content">
                  <rich-text :nodes="question.answer"></rich-text>
                </view>
              </view>
              
              <view class="analysis-box" v-if="question.analysis && question.analysis.trim() !== ''">
                <view class="analysis-title">题目解析</view>
                <view class="analysis-content">
                  <rich-text :nodes="question.analysis"></rich-text>
                </view>
              </view>
            </view>

            <view class="bottom-placeholder"></view>
          </view>
        </scroll-view>
      </swiper-item>
    </swiper>

    <view v-else class="loading-state">
      <text>正在加载题目...</text>
    </view>

    <view class="action-section" v-if="questions.length > 0">
      <view class="nav-actions">
        <view class="nav-btn-group">
          <view class="nav-btn" @click="showAnswerSheet = true">
            <SvgIcon name="menu" size="44" fill="#666" />
            <text class="btn-text">答题卡</text>
          </view>
        </view>
        
        <view class="main-nav-btns">
          <view class="side-nav-btn" @click="prevQuestion" :class="{ 'disabled': currentIndex <= 0 }">
            <text>上一题</text>
          </view>
          <view v-if="currentIndex < questions.length - 1" class="side-nav-btn" @click="nextQuestion">
            <text>下一题</text>
          </view>
          <view v-else class="submit-btn" @click="confirmSubmit">
            <text>交卷</text>
          </view>
        </view>
      </view>
    </view>

    <view class="modal-mask" v-if="showAnswerSheet" @click="showAnswerSheet = false">
      <view class="answer-sheet-modal" @click.stop>
        <view class="modal-header">
          <text>答题卡</text>
          <view class="close-btn" @click="showAnswerSheet = false">
            <SvgIcon name="close" size="32" fill="#999" />
          </view>
        </view>
        <scroll-view scroll-y class="sheet-content">
          <view class="sheet-status-legend">
            <view class="legend-item"><view class="status-dot current"></view><text>当前</text></view>
            <view class="legend-item"><view class="status-dot answered"></view><text>已答</text></view>
            <view class="legend-item"><view class="status-dot undone"></view><text>未答</text></view>
          </view>
          <view class="sheet-grid">
            <view 
              v-for="(q, index) in questions" 
              :key="q.question_id"
              class="sheet-item"
              :class="{ 
                current: index === currentIndex,
                answered: userAnswers[q.question_id],
                undone: !userAnswers[q.question_id]
              }"
              @click="jumpToQuestion(index)"
            >
              {{ index + 1 }}
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <view class="modal-mask" v-if="showConfirmSubmit" @click="showConfirmSubmit = false">
      <view class="confirm-modal" @click.stop>
        <view class="confirm-title">确认交卷？</view>
        <view class="confirm-info">
          <text>已答 {{ answeredCount }} 题，未答 {{ questions.length - answeredCount }} 题</text>
        </view>
        <view class="confirm-btns">
          <view class="btn cancel" @click="showConfirmSubmit = false">继续答题</view>
          <view class="btn confirm" @click="submitPaper">确认交卷</view>
        </view>
      </view>
    </view>

    <view class="modal-mask" v-if="showExitConfirm" @click="showExitConfirm = false">
      <view class="confirm-modal" @click.stop>
        <view class="confirm-title">确认退出？</view>
        <view class="confirm-info">
          <text>退出后答题进度将保存，可稍后继续</text>
        </view>
        <view class="confirm-btns">
          <view class="btn cancel" @click="showExitConfirm = false">继续答题</view>
          <view class="btn confirm" @click="exitExam">确认退出</view>
        </view>
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

<style scoped>
.app-container {
  --primary-color: #4db6ac;
  --bg-color: #f5f7fa;
  --card-bg: #ffffff;
  --text-main: #333333;
  --text-secondary: #666666;
  --text-light: #999999;
  --border-color: #f0f0f0;
  --accent-bg: #e0f2f1;
  --primary-gradient: linear-gradient(135deg, #4db6ac 0%, #00897b 100%);
  --shadow-lg: 0 10rpx 30rpx rgba(0,0,0,0.1);
  
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
  overflow: hidden;
  position: fixed;
  width: 100%;
  top: 0;
  left: 0;
}

.custom-nav-bar {
  background-color: var(--primary-color);
  z-index: 100;
  color: #ffffff;
  flex-shrink: 0;
}

.nav-content {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  position: relative;
}

.nav-left {
  position: absolute;
  left: 30rpx;
  z-index: 10;
}

.nav-right {
  position: absolute;
  right: 30rpx;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 15rpx;
  z-index: 10;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 40rpx;
  color: #ffffff;
}

.nav-title {
  flex: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.nav-title text:first-child {
  font-size: 32rpx;
  font-weight: bold;
  color: #ffffff;
}

.progress-text {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.8);
}

.timer-box {
  display: flex;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.2);
  padding: 8rpx 20rpx;
  border-radius: 30rpx;
}

.timer-box.warning {
  background-color: rgba(255, 77, 79, 0.3);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.timer-text {
  font-size: 26rpx;
  color: #fff;
  font-weight: 600;
  font-family: monospace;
}

.progress-bar-container {
  height: 4rpx;
  background: rgba(255, 255, 255, 0.2);
  width: 100%;
}

.progress-bar-fill {
  height: 100%;
  background: #ffffff;
  transition: width 0.3s;
}

.content-scroll {
  flex: 1;
  height: 0;
}

swiper-item {
  height: 100%;
  overflow: hidden;
}

.swiper-scroll {
  height: 100%;
}

.question-detail {
  padding: 30rpx;
}

.question-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.info-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
  flex: 1;
}

.info-right {
  display: flex;
  align-items: center;
}

.question-score {
  font-size: 24rpx;
  color: var(--primary-color);
  font-weight: bold;
  background: var(--accent-bg);
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}

.info-item.type, .info-item.chapter-tag {
  background: var(--accent-bg);
  color: var(--primary-color);
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 20rpx;
  max-width: 300rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stem-section {
  margin-bottom: 30rpx;
}

.stem-text {
  line-height: 1.8;
  color: var(--text-main);
  font-size: 34rpx;
  word-break: break-word;
  display: flex;
  align-items: flex-start;
}

.stem-content {
  flex: 1;
  line-height: 1.8;
}

.question-index {
  margin-right: 8rpx;
  font-weight: bold;
  color: var(--primary-color);
  flex-shrink: 0;
}

.options-section {
  margin-top: 30rpx;
}

.option-item {
  display: flex;
  margin-bottom: 20rpx;
  padding: 24rpx;
  background: var(--card-bg);
  border: 2rpx solid var(--border-color);
  border-radius: 16rpx;
  transition: all 0.2s;
  align-items: flex-start;
}

.option-item:last-child {
  margin-bottom: 0;
}

.option-item:active {
  background: var(--bg-color);
}

.option-item.selected {
  border-color: var(--primary-color);
  background: var(--accent-bg);
}

.option-key {
  width: 56rpx;
  height: 56rpx;
  min-width: 56rpx;
  font-weight: bold;
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color);
  border-radius: 50%;
  margin-right: 20rpx;
  font-size: 28rpx;
  border: 2rpx solid var(--border-color);
}

.option-item.selected .option-key {
  background: var(--primary-color);
  color: #fff;
  border-color: var(--primary-color);
}

.option-value {
  flex: 1;
  font-size: 30rpx;
  line-height: 1.6;
  color: var(--text-main);
  word-break: break-all;
}

.blanks-input-section {
  margin: 20rpx 0;
  padding: 20rpx;
  background: var(--bg-color);
  border-radius: 20rpx;
  border: 1rpx solid var(--border-color);
}

.blank-input-item {
  margin-bottom: 16rpx;
}

.blank-input-item:last-child {
  margin-bottom: 0;
}

.blank-label {
  font-size: 0.8em;
  color: var(--text-secondary);
  margin-bottom: 8rpx;
  display: block;
  font-weight: 500;
}

.blank-input {
  height: 80rpx;
  background: var(--card-bg);
  border: 2rpx solid var(--border-color);
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: v-bind('dynamicFontSize.content');
  width: 100%;
  box-sizing: border-box;
  transition: all 0.3s;
}

.blank-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 4rpx rgba(25, 118, 210, 0.1);
}

.saq-input-section {
  margin: 10rpx 0;
}

.saq-input, .sub-input {
  width: 100%;
  min-height: 100rpx;
  background: var(--bg-color);
  border: 2rpx solid var(--border-color);
  border-radius: 20rpx;
  padding: 20rpx;
  font-size: v-bind('dynamicFontSize.content');
  box-sizing: border-box;
  color: var(--text-main);
  transition: all 0.3s;
  line-height: 1.6;
}

.saq-input:focus, .sub-input:focus {
  border-color: var(--primary-color);
  background: var(--card-bg);
  box-shadow: 0 0 0 4rpx rgba(25, 118, 210, 0.1);
}

.subs-section {
  margin-top: 40rpx;
  border-top: 1rpx dashed var(--border-color);
  padding-top: 30rpx;
}

.sub-item {
  margin-bottom: 40rpx;
  padding: 24rpx;
  background: var(--bg-color);
  border-radius: 20rpx;
}

.sub-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 10rpx;
}

.sub-index {
  font-weight: bold;
  color: var(--primary-color);
  font-size: v-bind('dynamicFontSize.title');
}

.sub-score {
  font-size: 0.8em;
  color: var(--text-light);
}

.sub-stem {
  font-size: v-bind('dynamicFontSize.title');
  line-height: 1.6;
  color: var(--text-main);
  margin-bottom: 20rpx;
}

.sub-input-section {
  margin-top: 16rpx;
}

.sub-answer-section {
  margin-top: 24rpx;
  padding: 24rpx;
  background: rgba(25, 118, 210, 0.05);
  border-radius: 12rpx;
  border-left: 6rpx solid var(--primary-color);
}

.sub-answer, .sub-analysis {
  margin-bottom: 16rpx;
}

.sub-answer:last-child, .sub-analysis:last-child {
  margin-bottom: 0;
}

.sub-answer .label, .sub-analysis .label {
  font-weight: bold;
  color: var(--primary-color);
  font-size: v-bind('dynamicFontSize.explanation');
  margin-bottom: 8rpx;
  display: block;
}

.answer-section {
  margin-top: 40rpx;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20rpx); }
  to { opacity: 1; transform: translateY(0); }
}

.answer-box {
  background: rgba(76, 175, 80, 0.08);
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  border-left: 8rpx solid #4CAF50;
}

.answer-title {
  font-size: v-bind('dynamicFontSize.explanation');
  font-weight: bold;
  color: #2e7d32;
  margin-bottom: 12rpx;
}

.answer-content {
  font-size: v-bind('dynamicFontSize.title');
  font-weight: bold;
  color: #1b5e20;
}

.analysis-box {
  background: var(--bg-color);
  border-radius: 16rpx;
  padding: 24rpx;
  border: 2rpx solid var(--border-color);
  margin-top: 30rpx;
  position: relative;
}

.analysis-title {
  font-size: v-bind('dynamicFontSize.explanation');
  font-weight: bold;
  color: #f57c00;
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.analysis-content, .sub-answer, .sub-analysis, .answer-content {
  font-size: v-bind('dynamicFontSize.explanation');
  line-height: 1.8;
  color: var(--text-main);
}

:deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8rpx;
}

.bottom-placeholder {
  height: 200rpx;
}

.loading-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-light);
}

.action-section {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: var(--card-bg);
  border-top: 1rpx solid var(--border-color);
  z-index: 100;
}

.nav-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.nav-btn-group {
  display: flex;
  gap: 16rpx;
}

.nav-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
  min-width: 70rpx;
  transition: all 0.2s;
}

.nav-btn:active {
  transform: scale(0.9);
}

.btn-text {
  font-size: 18rpx;
  color: var(--text-secondary);
}

.main-nav-btns {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16rpx;
}

.side-nav-btn {
  font-size: 28rpx;
  color: var(--text-secondary);
  padding: 0 32rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  background: var(--bg-color);
  border-radius: 40rpx;
}

.side-nav-btn.disabled {
  opacity: 0.3;
}

.submit-btn {
  height: 80rpx;
  padding: 0 48rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-gradient);
  color: #fff;
}

.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.answer-sheet-modal {
  width: 100%;
  background: var(--card-bg);
  border-radius: 40rpx 40rpx 0 0;
  padding: 40rpx 30rpx;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
  height: 70vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid var(--border-color);
  margin-bottom: 20rpx;
}

.modal-header text {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--text-main);
}

.close-btn {
  padding: 10rpx;
}

.sheet-content {
  flex: 1;
  min-height: 0;
  padding-bottom: 40rpx;
}

.sheet-status-legend {
  display: flex;
  justify-content: space-around;
  padding: 20rpx 0 40rpx;
  border-bottom: 1rpx solid var(--border-color);
  margin-bottom: 30rpx;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
}

.status-dot {
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
}

.status-dot.current { background: var(--primary-color); border: 2rpx solid var(--primary-color); }
.status-dot.answered { background: #4caf50; }
.status-dot.undone { background: var(--bg-color); border: 1rpx solid var(--border-color); }

.sheet-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 20rpx;
  padding: 20rpx 0;
}

.sheet-item {
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color);
  border-radius: 16rpx;
  font-size: 28rpx;
  color: var(--text-main);
  border: 2rpx solid transparent;
  transition: all 0.2s;
}

.sheet-item.current {
  border-color: var(--primary-color);
  color: var(--primary-color);
  font-weight: bold;
  background: rgba(25, 118, 210, 0.1);
}

.sheet-item.answered {
  background: rgba(76, 175, 80, 0.1);
  color: #2e7d32;
}

.sheet-item.undone {
  background: var(--bg-color);
  color: var(--text-secondary);
}

.confirm-modal {
  width: 80%;
  max-width: 600rpx;
  background: var(--card-bg);
  border-radius: 24rpx;
  padding: 40rpx;
  margin: auto;
}

.confirm-title {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--text-main);
  text-align: center;
  margin-bottom: 20rpx;
}

.confirm-info {
  font-size: 28rpx;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 40rpx;
}

.confirm-btns {
  display: flex;
  gap: 20rpx;
}

.confirm-btns .btn {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 40rpx;
  font-size: 28rpx;
}

.confirm-btns .btn.cancel {
  background: var(--bg-color);
  color: var(--text-secondary);
  border: 1rpx solid var(--border-color);
}

.confirm-btns .btn.confirm {
  background: var(--primary-color);
  color: #fff;
}
</style>
