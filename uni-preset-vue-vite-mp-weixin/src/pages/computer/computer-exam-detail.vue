<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { request } from '@/api/request';
import SvgIcon from '@/components/SvgIcon/SvgIcon.vue';
import ExamRichEditor from '@/components/RichTextEditor/ExamRichEditor.vue';
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
const examId = ref('');
const recordId = ref('');
const examInfo = ref({});
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

// 图片预览
const showImagePreview = ref(false);
const previewImageUrl = ref('');
const previewImageList = ref([]);

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
  examId.value = currentPage.$page?.options?.examId || currentPage.options?.examId;
  
  if (examId.value) {
    startExam();
  }
});

onUnmounted(() => {
  if (timer.value) {
    clearInterval(timer.value);
  }
});

const startExam = async () => {
  try {
    uni.showLoading({ title: '加载中...' });
    
    const res = await request({
      url: `/online-exam/exams/${examId.value}/start`,
      method: 'POST'
    });

    if (res.code === 0) {
      recordId.value = res.data.recordId;
      examInfo.value = res.data.exam;
      
      // 处理题目数据，与 computer-question-detail.vue 保持一致
      questions.value = (res.data.questions || []).map(q => {
        // 处理题干
        if (q.stem) {
          q.stem = processStem(q.stem);
        }
        
        // 处理选项
        if (q.options && q.options.length > 0) {
          q.options = q.options.map(opt => ({
            ...opt,
            option_value: processStem(opt.option_value)
          }));
        }
        
        // 处理小题
        if (q.subs && q.subs.length > 0) {
          q.subs.forEach(sub => {
            if (sub.stem) sub.stem = processStem(sub.stem);
            if (sub.answer) sub.answer = processStem(sub.answer);
            if (sub.analysis) sub.analysis = processStem(sub.analysis);
          });
        }
        
        return q;
      });
      
      // 调试日志：输出题目类型信息
      console.log('题目类型分布:', questions.value.map(q => ({
        question_id: q.question_id,
        exercise_type: q.exercise_type,
        exercise_type_name: q.exercise_type_name,
        isEssay: isEssayQuestion(q)
      })));
      
      if (examInfo.value.isLimitedTime && examInfo.value.duration) {
        remainingTime.value = examInfo.value.duration * 60;
        startTimer();
      }
      
      loadSavedAnswers();
    } else {
      uni.showToast({
        title: res.message || '开始考试失败',
        icon: 'none'
      });
      setTimeout(() => {
        uni.navigateBack();
      }, 1500);
    }
  } catch (error) {
    console.error('开始考试失败:', error);
    uni.showToast({
      title: '开始考试失败',
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
        submitExam();
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
  // 更宽松的类型检查：支持数字4、字符串'4'、以及包含'解答'的类型名
  const isEssay = 
    type === 4 || 
    type === '4' || 
    String(type) === '4' ||
    (question.exercise_type_name && question.exercise_type_name.includes('解答')) ||
    (question.question_type && question.question_type.includes('解答'));
  console.log('isEssayQuestion:', { question_id: question.question_id, type, exercise_type_name: question.exercise_type_name, isEssay, subsCount: question.subs?.length });
  return isEssay;
};

const parseOptions = (options) => {
  if (!options) return [];
  try {
    if (typeof options === 'string') {
      const parsed = JSON.parse(options);
      return Object.entries(parsed).map(([key, content]) => ({
        key,
        content
      }));
    }
    if (Array.isArray(options)) {
      return options.map(opt => ({
        key: opt.option_key || opt.key,
        content: opt.option_value || opt.content
      }));
    }
    return Object.entries(options).map(([key, content]) => ({
      key,
      content
    }));
  } catch {
    return [];
  }
};

const getOptionClass = (question, optionKey) => {
  const userAnswer = userAnswers.value[question.question_id];
  
  if (!showResult.value) {
    return { selected: userAnswer === optionKey };
  }
  
  const correctAnswer = question.correct_answer || question.answer;
  return {
    correct: optionKey === correctAnswer,
    wrong: userAnswer === optionKey && optionKey !== correctAnswer,
    selected: userAnswer === optionKey
  };
};

const selectOption = async (question, optionKey) => {
  if (showResult.value) return;
  userAnswers.value[question.question_id] = optionKey;
  saveAnswers();
  
  // 保存答案到后端
  console.log('保存答案:', {
    recordId: recordId.value,
    questionId: question.question_id,
    answer: optionKey
  });
  
  try {
    const res = await request({
      url: `/online-exam/records/${recordId.value}/answers`,
      method: 'POST',
      data: {
        questionId: question.question_id,
        answer: optionKey,
        answerTime: 0
      }
    });
    console.log('保存答案成功:', res);
  } catch (error) {
    console.error('保存答案失败:', error);
  }
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

const handleContentClick = (e, content) => {
  if (e.target && e.target.tagName === 'IMG') {
    const src = e.target.src;
    if (src) {
      const imgRegex = /<img[^>]+src="([^">]+)"/g;
      const urls = [];
      let match;
      while ((match = imgRegex.exec(content)) !== null) {
        urls.push(match[1]);
      }
      
      uni.previewImage({
        urls: urls.length > 0 ? urls : [src],
        current: src
      });
    }
  }
};

const confirmSubmit = () => {
  showConfirmSubmit.value = true;
};

const submitExam = async () => {
  showConfirmSubmit.value = false;
  
  try {
    uni.showLoading({ title: '提交中...' });
    
    // 第一步：逐个提交所有答案
    const submitPromises = [];
    questions.value.forEach(q => {
      const qid = q.question_id;
      let answer = userAnswers.value[qid] || '';
      
      // 判断是否为解答题
      const isEssay = isEssayQuestion(q);
      
      if (isEssay) {
        // 解答题答案（保留HTML格式）
        answer = userAnswers.value[qid] || '';
        console.log(`准备提交解答题 ${qid}, 答案长度:`, answer?.length);
      } else if (q.exercise_type === 3 || q.exercise_type === '填空题') {
        // 填空题答案
        answer = JSON.stringify(blankAnswers.value[qid] || []);
      }
      
      // 对于解答题，无论是否有内容都提交（确保数据库有记录）
      // 对于其他题型，检查去除HTML后是否为空
      const shouldSubmit = isEssay 
        ? true  // 解答题始终提交
        : (answer && answer.replace(/<[^>]*>/g, '').trim() !== '');
      
      // 提交题目
      if (shouldSubmit) {
        console.log(`正在提交题目 ${qid}, 类型:`, q.exercise_type, 'isEssay:', isEssay, '答案长度:', answer?.length);
        submitPromises.push(
          request({
            url: `/online-exam/records/${recordId.value}/answers`,
            method: 'POST',
            data: {
              questionId: qid,
              answer: answer,
              answerTime: 0
            }
          }).then(res => {
            console.log(`题目 ${qid} 提交成功:`, res);
          }).catch(err => {
            console.error(`提交题目 ${qid} 答案失败:`, err);
          })
        );
      } else {
        console.log(`题目 ${qid} 无内容，跳过提交`);
      }
    });
    
    // 等待所有答案提交完成
    if (submitPromises.length > 0) {
      await Promise.all(submitPromises);
    }
    
    // 第二步：提交考试
    const res = await request({
      url: `/online-exam/records/${recordId.value}/submit`,
      method: 'POST',
      data: {}
    });

    if (res.code === 0) {
      clearSavedAnswers();
      showResult.value = true;
      
      uni.showToast({
        title: '交卷成功',
        icon: 'success'
      });
      
      setTimeout(() => {
        uni.redirectTo({
          url: `/pages/computer/computer-exam-result?recordId=${recordId.value}`
        });
      }, 1500);
    } else {
      uni.showToast({
        title: res.message || '提交失败',
        icon: 'none'
      });
    }
  } catch (error) {
    console.error('提交考试失败:', error);
    uni.showToast({
      title: '提交失败',
      icon: 'none'
    });
  } finally {
    uni.hideLoading();
  }
};

const confirmExit = () => {
  showExitConfirm.value = true;
};

const exitExam = () => {
  showExitConfirm.value = false;
  saveAnswers();
  uni.navigateBack();
};

// 图片预览功能
const previewImage = (url) => {
  previewImageUrl.value = url;
  showImagePreview.value = true;
};

const closeImagePreview = () => {
  showImagePreview.value = false;
  previewImageUrl.value = '';
};

const saveAnswers = () => {
  const key = `exam_answers_${recordId.value}`;
  uni.setStorageSync(key, {
    userAnswers: userAnswers.value,
    subAnswers: subAnswers.value,
    blankAnswers: blankAnswers.value
  });
};

// 防抖函数
const debounce = (fn, delay) => {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

// 保存答案到后端（解答题用）
const saveAnswerToBackend = async (questionId, answer) => {
  if (!recordId.value || !questionId) {
    console.log('自动保存失败: recordId或questionId为空', { recordId: recordId.value, questionId });
    return;
  }
  
  // 确保answer是字符串
  const answerStr = answer || '';
  
  try {
    console.log('自动保存答案:', { 
      recordId: recordId.value,
      questionId, 
      answerLength: answerStr.length,
      answerPreview: answerStr?.substring(0, 100) 
    });
    
    const res = await request({
      url: `/online-exam/records/${recordId.value}/answers`,
      method: 'POST',
      data: {
        questionId: questionId,
        answer: answerStr,
        answerTime: 0
      }
    });
    
    console.log('自动保存成功:', res);
  } catch (error) {
    console.error('自动保存失败:', error);
    console.error('错误详情:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
  }
};

// 防抖后的保存函数
const debouncedSaveToBackend = debounce(saveAnswerToBackend, 2000);

const loadSavedAnswers = () => {
  const key = `exam_answers_${recordId.value}`;
  const saved = uni.getStorageSync(key);
  if (saved) {
    userAnswers.value = saved.userAnswers || {};
    subAnswers.value = saved.subAnswers || {};
    blankAnswers.value = saved.blankAnswers || {};
  }
};

const clearSavedAnswers = () => {
  const key = `exam_answers_${recordId.value}`;
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
          <text>{{ examInfo.title || '在线考试' }}</text>
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
                <text class="question-score" v-if="question.question_score">{{ question.question_score }}分</text>
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
                :class="getOptionClass(question, option.option_key)"
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
              <ExamRichEditor
                v-model="userAnswers[question.question_id]"
                placeholder="请输入您的答案，支持富文本、图片和代码..."
                :disabled="showResult"
                @change="(val) => { saveAnswers(); debouncedSaveToBackend(question.question_id, val); }"
              />
            </view>

            <view class="subs-section" v-if="isEssayQuestion(question) && question.subs && question.subs.length > 0">
              <view class="subs-title">小题列表</view>
              <view v-for="(sub, index) in question.subs" :key="sub.sub_id || sub.id || index" class="sub-item">
                <view class="sub-header">
                  <text class="sub-index">({{ index + 1 }})</text>
                  <text class="sub-score" v-if="sub.score">[{{ sub.score }}分]</text>
                </view>
                <view class="sub-stem" v-html="sub.stem"></view>

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
              
              <!-- 所有小题共用一个编辑框 -->
              <view class="sub-input-section" v-if="!showResult">
                <text class="sub-input-label">请在此输入所有小题的答案：</text>
                <ExamRichEditor
                  v-model="userAnswers[question.question_id]"
                  placeholder="请按小题顺序输入答案，如：(1)答案1 (2)答案2..."
                  :disabled="showResult"
                  @change="(val) => { saveAnswers(); debouncedSaveToBackend(question.question_id, val); }"
                />
              </view>
            </view>

            <view class="answer-section" v-if="showResult">
              <view v-if="isChoiceQuestion(question)" class="answer-grid-card">
                <view class="answer-grid">
                  <view class="grid-item">
                    <text class="label">我的答案</text>
                    <text class="value" :class="{ 
                      'correct': userAnswers[question.question_id] === (question.correct_answer || question.answer),
                      'error': userAnswers[question.question_id] && userAnswers[question.question_id] !== (question.correct_answer || question.answer)
                    }">
                      {{ userAnswers[question.question_id] || '无' }}
                    </text>
                  </view>
                  <view class="grid-item">
                    <text class="label">正确答案</text>
                    <text class="value correct">{{ question.correct_answer || question.answer }}</text>
                  </view>
                  <view class="grid-item">
                    <text class="label">结果</text>
                    <text class="value" :class="{ 
                      'correct': userAnswers[question.question_id] === (question.correct_answer || question.answer),
                      'error': userAnswers[question.question_id] !== (question.correct_answer || question.answer)
                    }">
                      {{ userAnswers[question.question_id] === (question.correct_answer || question.answer) ? '正确' : '错误' }}
                    </text>
                  </view>
                </view>
              </view>

              <view v-else-if="question.answer && question.answer.trim() !== ''" class="answer-box">
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

    <!-- 固定提交按钮 -->
    <view class="fixed-submit-btn" v-if="questions.length > 0" @click="confirmSubmit">
      <text>交卷</text>
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
          <view class="btn confirm" @click="submitExam">确认交卷</view>
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
    
    <!-- 图片预览 -->
    <view class="image-preview-mask" v-if="showImagePreview" @click="closeImagePreview">
      <view class="image-preview-container" @click.stop>
        <image
          class="preview-image"
          :src="previewImageUrl"
          mode="widthFix"
          @click="closeImagePreview"
        />
        <view class="preview-close" @click="closeImagePreview">✕</view>
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

.question-image-box {
  margin-bottom: 30rpx;
  border-radius: 12rpx;
  overflow: hidden;
}

.question-image-box image {
  width: 100%;
  display: block;
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

.option-item.correct {
  border-color: #4caf50;
  background: rgba(76, 175, 80, 0.08);
}

.option-item.wrong {
  border-color: #f44336;
  background: rgba(244, 67, 54, 0.08);
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

.option-item.correct .option-key {
  background: #4caf50;
  color: #fff;
  border-color: #4caf50;
}

.option-item.wrong .option-key {
  background: #f44336;
  color: #fff;
  border-color: #f44336;
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
  margin: 20rpx 0;
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

/* 富文本编辑器样式 */
.exam-rich-editor {
  border-radius: 20rpx;
  overflow: hidden;
}

.exam-rich-editor .toolbar {
  background: var(--bg-color);
  border-bottom: 2rpx solid var(--border-color);
}

.exam-rich-editor .editor-content {
  background: var(--card-bg);
  min-height: 300rpx;
}

.subs-section {
  margin-top: 24rpx;
  border-top: 1rpx dashed var(--border-color);
  padding-top: 16rpx;
}

.subs-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 12rpx;
}

.sub-item {
  margin-bottom: 16rpx;
  padding: 16rpx;
  background: var(--bg-color);
  border-radius: 12rpx;
}

.sub-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
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
  line-height: 1.5;
  color: var(--text-main);
  margin-bottom: 12rpx;
}

.sub-stem p {
  margin: 4rpx 0;
}

.sub-input-section {
  margin-top: 16rpx;
  padding: 16rpx;
  background: var(--bg-color);
  border-radius: 12rpx;
  border: 2rpx solid var(--border-color);
}

.sub-input-label {
  font-size: 28rpx;
  color: var(--text-main);
  font-weight: 500;
  margin-bottom: 12rpx;
  display: block;
}

.sub-answer-section {
  margin-top: 16rpx;
  padding: 16rpx;
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

.answer-grid-card {
  background: var(--card-bg);
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.05);
  border: 1rpx solid var(--border-color);
}

.answer-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
  text-align: center;
}

.grid-item {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 16rpx;
  background: var(--bg-color);
  border-radius: 12rpx;
}

.grid-item .label {
  font-size: 22rpx;
  color: var(--text-light);
}

.grid-item .value {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--text-main);
}

.grid-item .value.correct {
  color: #4caf50;
}

.grid-item .value.error {
  color: #f44336;
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

.analysis-title::before {
  content: '';
  font-size: 1.1em;
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

.fixed-submit-btn {
  position: fixed;
  right: 30rpx;
  bottom: 140rpx;
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: var(--primary-gradient);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: bold;
  box-shadow: 0 4rpx 20rpx rgba(77, 182, 172, 0.4);
  z-index: 99;
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

/* 图片预览样式 */
.image-preview-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview-container {
  position: relative;
  width: 90%;
  max-height: 80%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-image {
  max-width: 100%;
  max-height: 80vh;
  border-radius: 8rpx;
}

.preview-close {
  position: absolute;
  top: -60rpx;
  right: 0;
  width: 48rpx;
  height: 48rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 28rpx;
  cursor: pointer;
}
</style>
