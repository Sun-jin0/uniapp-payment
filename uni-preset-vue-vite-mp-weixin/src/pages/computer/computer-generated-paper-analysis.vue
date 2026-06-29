<template>
  <view class="paper-container">
    <view class="top-bar no-print">
      <view class="top-bar-content">
        <view class="left-actions">
          <view class="back-btn" @click="goBack">❮</view>
        </view>
        <text class="paper-title">{{ paper.title }} - 解析</text>
        <view class="top-actions" v-if="!loading">
          <button class="action-btn" @click="toggleAllAnalysis">
            {{ isAllExpanded ? '全部收起' : '全部展开' }}
          </button>
          <view class="font-ctrl">
            <text class="ctrl-label">字号</text>
            <slider class="font-slider" :value="baseFontSize" @change="handleFontSizeChange" min="12" max="24" stroke-width="3" block-size="16" v-if="paper.questions" />
          </view>
          <view class="action-icon-btn" @click="handlePrint">⎙</view>
        </view>
      </view>
    </view>

    <view class="paper-content" id="paper-content" :style="{ fontSize: baseFontSize + 'px' }">
      <view class="paper-header">
        <text class="main-title" :style="{ fontSize: (baseFontSize + 12) + 'px' }">答案解析</text>
        <text class="subtitle" :style="{ fontSize: (baseFontSize - 2) + 'px' }">{{ paper.title }}</text>
      </view>

      <view class="questions-list">
        <view v-for="(q, index) in paper.questions" :key="q.question_id" class="question-item">
          <view class="question-header">
            <text class="question-num">{{ index + 1 }}.</text>
            <text class="question-id-badge">ID: {{ q.question_id }}</text>
            <text class="question-type-tag">{{ q.exercise_type_name }}</text>
            <view class="correction-btn" @click="openCorrectionModal(q.question_id)">纠错</view>
          </view>
          
          <view class="question-body">
            <view class="question-text" v-html="formatLatex(q.stem)"></view>
            <!-- 选项展示 -->
            <view class="options-list" v-if="q.options && q.options.length > 0">
              <view v-for="opt in q.options" :key="opt.option_key" class="option-item">
                <text class="option-key">{{ opt.option_key }}.</text>
                <text class="option-value" v-html="formatLatex(opt.option_value)"></text>
              </view>
            </view>
          </view>

          <view class="analysis-section" :class="{ 'expanded': q.isExpanded }" @click="toggleAnalysis(index)">
            <view class="analysis-header">
              <view class="analysis-title-group">
                <view class="analysis-dot"></view>
                <text class="analysis-title">正确答案与题目详解</text>
              </view>
              <text class="expand-icon">{{ q.isExpanded ? '收起 ▲' : '点击展开 ▼' }}</text>
            </view>
            <view class="analysis-content-wrapper" v-if="q.isExpanded">
              <!-- 答案 -->
              <view class="detail-card">
                <view class="detail-card-header">
                  <view class="detail-card-dot"></view>
                  <view class="detail-card-title"><text class="tag-label-daan">答案</text></view>
                </view>
                <view class="detail-card-body" v-html="formatLatex(q.answer)"></view>
              </view>
              
              <!-- 解析 -->
              <view v-if="q.analysis" class="detail-card">
                <view class="detail-card-header">
                  <view class="detail-card-dot"></view>
                  <view class="detail-card-title"><text class="tag-label-jiexi">解析</text></view>
                </view>
                <view class="detail-card-body" v-html="formatLatex(q.analysis)"></view>
              </view>

              <!-- 小题解析 -->
              <view v-if="q.subs && q.subs.length > 0" class="subs-analysis">
                <view v-for="sub in q.subs" :key="sub.sub_id" class="sub-item">
                  <view class="sub-stem" v-html="formatLatex(`(${sub.question_order}) ${sub.stem}`)"></view>
                  <view class="sub-answer">【答案】<text v-html="formatLatex(sub.answer)"></text></view>
                  <view class="sub-analysis" v-if="sub.analysis">【解析】<text v-html="formatLatex(sub.analysis)"></text></view>
                </view>
              </view>

              <!-- 无内容显示 -->
              <view v-if="!q.answer && !q.analysis && (!q.subs || q.subs.length === 0)" class="no-answer">
                <view class="empty-icon">📝</view>
                <text>该题目暂无详细解析内容</text>
              </view>
            </view>
          </view>

          <view class="source-footer">
            来源：{{ q.major_id }} - {{ q.chapter_id }}
          </view>
        </view>
      </view>
    </view>

    <!-- 纠错弹窗 -->
    <view class="correction-modal-overlay" :class="{ 'active': correctionModalOpen }" @click="closeCorrectionModal">
      <view class="correction-modal-content" @click.stop>
        <view class="correction-modal-header">
          <view class="header-title-group">
            <text class="modal-icon">⚠️</text>
            <text class="correction-modal-title">题目纠错</text>
          </view>
          <view class="correction-modal-close-btn" @click="closeCorrectionModal">×</view>
        </view>
        <view class="correction-modal-body">
          <view class="correction-type-grid">
            <view 
              v-for="type in correctionTypes" 
              :key="type" 
              class="type-tag"
              :class="{ active: selectedCorrectionType === type }"
              @click="selectedCorrectionType = type"
            >
              {{ type }}
            </view>
          </view>
          <textarea 
            v-model="correctionContent" 
            placeholder="请详细描述错误内容，例如：公式显示异常、答案错误、解析不清晰等..." 
            class="correction-textarea"
          ></textarea>
          <view class="correction-footer">
            <text class="correction-tip">感谢您的反馈，我们将尽快核实并修正。</text>
            <button class="correction-submit-btn" :disabled="!isCorrectionValid" @click="submitCorrection">提交反馈</button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, nextTick, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { request, BASE_URL } from '../../api/request';
import { transformContextString } from '../../utils/latex';
import { checkTextContent } from '@/utils/contentSecurity.js';

const paperId = ref(null);
const paper = ref({});
const loading = ref(true);
const baseFontSize = ref(16);

const handlePrint = () => {
  // 优先使用 print_token 以增强安全性
  const idOrToken = paper.value.print_token || paperId.value;
  const printUrl = `${BASE_URL}/computer1/smart-papers/${idOrToken}/print`;
  
  uni.setClipboardData({
    data: printUrl,
    success: () => {
      uni.showModal({
        title: '复制成功',
        content: '打印链接已复制到剪贴板。由于小程序不支持直接打印，请在电脑浏览器中打开此链接进行打印。',
        showCancel: false,
        confirmText: '知道了'
      });
    },
    fail: () => {
      uni.showModal({
        title: '复制失败',
        content: `请手动复制链接：\n${printUrl}`,
        confirmText: '确定'
      });
    }
  });
};

const isAllExpanded = computed(() => {
  if (!paper.value.questions || paper.value.questions.length === 0) return false;
  return paper.value.questions.every(q => q.isExpanded);
});

const toggleAllAnalysis = () => {
  const targetState = !isAllExpanded.value;
  paper.value.questions.forEach(q => {
    q.isExpanded = targetState;
  });
  if (targetState) {
    nextTick(() => renderMath());
  }
};

const renderMath = () => {
  if (typeof renderMathInElement !== 'undefined') {
    const el = document.getElementById('paper-content');
    if (!el) return;
    
    try {
      renderMathInElement(el, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false
      });
    } catch (err) {
      console.warn('MathJax render error:', err);
    }
  }
};

// 纠错相关状态
const correctionModalOpen = ref(false);
const correctionContent = ref('');
const correctionTypes = ['内容错误', '图片模糊', '解析有误', '分类错误', '其他问题'];
const selectedCorrectionType = ref('内容错误');
const currentCorrectionQid = ref(null);

const isCorrectionValid = computed(() => {
  return correctionContent.value.trim().length >= 2;
});

onLoad((options) => {
  if (options.paperId) {
    paperId.value = options.paperId;
    fetchPaper();
  } else {
    uni.showToast({ title: '参数错误', icon: 'none' });
    setTimeout(() => uni.navigateBack(), 1500);
  }
});

const fetchPaper = async () => {
  loading.value = true;
  try {
    const res = await request({
      url: `/computer1/smart-papers/${paperId.value}`
    });
    
    if (res.data && res.data.questions) {
      res.data.questions = res.data.questions.map(q => ({
        ...q,
        isExpanded: false
      }));
    }
    
    paper.value = res.data;
    await nextTick();
    renderMath();
  } catch (err) {
    console.error('Fetch paper error:', err);
    uni.showToast({ title: '加载解析失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const toggleAnalysis = (index) => {
  if (paper.value.questions[index]) {
    paper.value.questions[index].isExpanded = !paper.value.questions[index].isExpanded;
    if (paper.value.questions[index].isExpanded) {
      nextTick(() => renderMath());
    }
  }
};

const formatLatex = (text) => {
  return transformContextString(text || '');
};

const handleFontSizeChange = (e) => {
  baseFontSize.value = e.detail.value;
};

const openCorrectionModal = (qid) => {
  currentCorrectionQid.value = qid;
  correctionModalOpen.value = true;
};

const closeCorrectionModal = () => {
  correctionModalOpen.value = false;
  correctionContent.value = '';
  selectedCorrectionType.value = '内容错误';
  currentCorrectionQid.value = null;
};

const submitCorrection = async () => {
  if (!isCorrectionValid.value) {
    uni.showToast({ title: '请详细描述错误内容', icon: 'none' });
    return;
  }

  // 内容安全检测
  uni.showLoading({ title: '内容检测中...' });
  const checkResult = await checkTextContent(correctionContent.value);
  uni.hideLoading();

  if (!checkResult.isSafe) {
    uni.showToast({
      title: checkResult.message,
      icon: 'none',
      duration: 3000
    });
    return;
  }

  try {
    await request({
      url: '/computer1/corrections',
      method: 'POST',
      data: {
        questionId: currentCorrectionQid.value,
        majorId: paper.value.major_id,
        type: selectedCorrectionType.value,
        content: correctionContent.value
      }
    });
    uni.showToast({ title: '反馈已提交', icon: 'success' });
    closeCorrectionModal();
  } catch (error) {
    console.error('Failed to submit correction:', error);
    uni.showToast({ title: '提交失败，请稍后重试', icon: 'none' });
  }
};

const goBack = () => {
  uni.navigateBack();
};
</script>

<style scoped>
.paper-container {
  min-height: 100vh;
  background-color: #fff;
}

.top-bar {
  padding: 10rpx 30rpx;
  background: #f8f9fa;
  border-bottom: 2rpx solid #eee;
  position: sticky;
  top: 0;
  z-index: 100;
}

.top-bar-content {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.paper-title {
  font-size: 28rpx;
  font-weight: bold;
  flex: 1;
  text-align: center;
  margin: 0 20rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #333;
}

.back-btn {
  font-size: 40rpx;
  background: none;
  border: none;
  padding: 0 20rpx;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 15rpx;
}

.action-btn {
  font-size: 24rpx;
  color: #007aff;
  background: #fff;
  border: 1rpx solid #007aff;
  padding: 4rpx 16rpx;
  border-radius: 30rpx;
  line-height: 1.5;
}

.action-icon-btn {
  background: none;
  border: none;
  padding: 10rpx;
  font-size: 36rpx;
  color: #666;
  line-height: 1;
}

.font-ctrl {
  display: flex;
  align-items: center;
  background: #f5f5f5;
  padding: 4rpx 12rpx;
  border-radius: 30rpx;
}

.ctrl-label {
  font-size: 24rpx;
  color: #666;
}

.font-slider {
  width: 100rpx;
  margin-left: 10rpx;
}

.paper-content {
  padding: 30rpx;
}

.paper-header {
  text-align: center;
  margin-bottom: 40rpx;
}

.main-title {
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 10rpx;
}

.subtitle {
  color: #7f8c8d;
}

.question-item {
  margin-bottom: 40rpx;
  border-bottom: 1rpx solid #eee;
  padding-bottom: 30rpx;
}

.question-header {
  display: flex;
  align-items: center;
  gap: 15rpx;
  margin-bottom: 20rpx;
}

.question-num {
  font-weight: bold;
  color: #007aff;
}

.question-id-badge {
  font-size: 20rpx;
  color: #999;
  background: #f8f9fa;
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
}

.question-type-tag {
  font-size: 20rpx;
  background: #f0f2f5;
  color: #666;
  padding: 2rpx 10rpx;
  border-radius: 4rpx;
}

.correction-btn {
  font-size: 20rpx;
  color: #ff3b30;
  background: none;
  border: 1rpx solid #ff3b30;
  padding: 2rpx 10rpx;
  border-radius: 4rpx;
  margin-left: auto;
}

.question-body {
  line-height: 1.6;
  margin-bottom: 20rpx;
}

.options-list {
  margin-top: 20rpx;
}

.option-item {
  display: flex;
  margin-bottom: 10rpx;
}

.option-key {
  margin-right: 15rpx;
  font-weight: 500;
}

.analysis-section {
  background: #f8fbff;
  border: 1rpx solid #e1f0fa;
  border-radius: 8rpx;
  margin-top: 20rpx;
  overflow: hidden;
}

.analysis-header {
  padding: 15rpx 20rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.analysis-title-group {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.analysis-dot {
  width: 8rpx;
  height: 8rpx;
  background-color: #007aff;
  border-radius: 50%;
}

.analysis-title {
  font-size: 28rpx;
  font-weight: bold;
}

.expand-icon {
  font-size: 24rpx;
  color: #007aff;
}

.analysis-content-wrapper {
  padding: 20rpx;
  background: #fff;
  border-top: 1rpx solid #e1f0fa;
}

.detail-card {
  margin-bottom: 20rpx;
}

.detail-card-header {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}

.detail-card-dot {
  width: 6rpx;
  height: 6rpx;
  background: #007aff;
  border-radius: 50%;
  margin-right: 10rpx;
}

.tag-label-daan {
  background: #e3f2fd;
  color: #1976d2;
  padding: 2rpx 12rpx;
  border-radius: 4rpx;
  font-size: 24rpx;
  font-weight: bold;
}

.tag-label-jiexi {
  background: #f1f8e9;
  color: #388e3c;
  padding: 2rpx 12rpx;
  border-radius: 4rpx;
  font-size: 24rpx;
  font-weight: bold;
}

.subs-analysis {
  margin-top: 20rpx;
  border-top: 1rpx solid #eee;
  padding-top: 20rpx;
}

.sub-item {
  margin-bottom: 20rpx;
  padding: 15rpx;
  background: #f9f9f9;
  border-radius: 8rpx;
}

.sub-stem {
  font-weight: 500;
  margin-bottom: 10rpx;
}

.sub-answer, .sub-analysis {
  font-size: 26rpx;
  margin-top: 5rpx;
}

.no-answer {
  padding: 40rpx;
  text-align: center;
  color: #999;
}

.empty-icon {
  font-size: 48rpx;
  margin-bottom: 10rpx;
}

.source-footer {
  font-size: 22rpx;
  color: #ccc;
  text-align: right;
  margin-top: 10rpx;
}

/* Correction Modal */
.correction-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.6);
  z-index: 2000;
  display: none;
  align-items: center;
  justify-content: center;
}

.correction-modal-overlay.active {
  display: flex;
}

.correction-modal-content {
  background: #fff;
  width: 90%;
  max-width: 600rpx;
  border-radius: 20rpx;
  overflow: hidden;
}

.correction-modal-header {
  padding: 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1rpx solid #eee;
}

.correction-modal-title {
  font-size: 32rpx;
  font-weight: bold;
}

.correction-modal-close-btn {
  background: none;
  border: none;
  font-size: 48rpx;
  color: #999;
}

.correction-modal-body {
  padding: 30rpx;
}

.correction-type-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
  margin-bottom: 30rpx;
}

.type-tag {
  padding: 10rpx 24rpx;
  background: #f5f5f5;
  border-radius: 30rpx;
  font-size: 26rpx;
}

.type-tag.active {
  background: #007aff;
  color: #fff;
}

.correction-textarea {
  width: 100%;
  height: 200rpx;
  background: #f9f9f9;
  border: 1rpx solid #eee;
  border-radius: 12rpx;
  padding: 20rpx;
  box-sizing: border-box;
}

.correction-footer {
  margin-top: 30rpx;
}

.correction-tip {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 20rpx;
  text-align: center;
}

.correction-submit-btn {
  width: 100%;
  background: #007aff;
  color: #fff;
  border: none;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 30rpx;
}

.correction-submit-btn:disabled {
  background: #ccc;
}

@media print {
  .no-print {
    display: none !important;
  }
  .paper-content {
    padding: 0;
    margin: 0;
    max-width: none;
  }
  .question-item {
    padding-bottom: 40rpx;
    margin-bottom: 40rpx;
  }
}
</style>
