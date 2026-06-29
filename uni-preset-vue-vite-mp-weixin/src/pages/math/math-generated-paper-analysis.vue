<template>
  <view class="paper-container">
    <main class="paper-content" id="paper-content" :style="{ fontSize: baseFontSize + 'px' }">
      <div class="paper-header">
        <h1 class="main-title" :style="{ fontSize: (baseFontSize + 12) + 'px' }">答案解析</h1>
        <p class="subtitle" :style="{ fontSize: (baseFontSize - 2) + 'px' }">{{ paper.Title }}</p>
      </div>

      <div class="questions-list">
        <div v-for="(q, index) in paper.questions" :key="q.QuestionID" class="question-item">
          <div class="question-header">
            <span class="question-num">{{ index + 1 }}.</span>
          <span class="question-id-badge">ID: {{ q.QuestionID }}</span>
          <span class="question-type-tag">{{ q.QuestionType }}</span>
          <button class="correction-btn" @click="openCorrectionModal(q.QuestionID)">纠错</button>
        </div>
          
          <div class="question-body">
            <!-- #ifdef H5 -->
            <div class="question-text" v-html="formatLatex(q.QuestionText)"></div>
            <!-- #endif -->
            <!-- #ifdef MP-WEIXIN -->
            <mp-html class="question-text" :content="q.QuestionText" markdown copy-link="false"></mp-html>
            <!-- #endif -->
          </div>

          <!-- #ifdef H5 -->
          <div class="analysis-section" :class="{ 'expanded': q.isExpanded }" @click="toggleAnalysis(index)">
            <div class="analysis-header">
              <div class="analysis-title-group">
                <div class="analysis-dot"></div>
                <h3 class="analysis-title">正确答案与题目详解</h3>
              </div>
              <span class="expand-icon">{{ q.isExpanded ? '收起 ▲' : '点击展开 ▼' }}</span>
            </div>
            <div class="analysis-content-wrapper" v-if="q.isExpanded">
              <!-- 详细解析列表 -->
              <div v-if="q.details && q.details.length > 0" class="details-list">
                <div v-for="(detail, dIndex) in filteredDetails(q.details)" :key="dIndex" class="detail-card">
                  <div class="detail-card-header">
                    <div class="detail-card-dot"></div>
                    <div class="detail-card-title" v-html="getDetailHeader(detail)"></div>
                  </div>
                  <div v-if="detail.Context" class="detail-card-body" v-html="formatLatex(detail.Context)"></div>
                </div>
              </div>
              <!-- Fallback: 如果没有 details 但有 OriginalAnswerText -->
              <div v-else-if="q.OriginalAnswerText" class="answer-content" v-html="formatLatex(q.OriginalAnswerText)"></div>
              <!-- 无内容显示 -->
              <div v-else class="no-answer">
                <div class="empty-icon">📝</div>
                <p>该题目暂无详细解析内容</p>
              </div>
            </div>
          </div>
          <!-- #endif -->
          <!-- #ifdef MP-WEIXIN -->
          <div class="analysis-section" :class="{ 'expanded': q.isExpanded }" @click="toggleAnalysis(index)">
            <div class="analysis-header">
              <div class="analysis-title-group">
                <div class="analysis-dot"></div>
                <h3 class="analysis-title">正确答案与题目详解</h3>
              </div>
              <span class="expand-icon">{{ q.isExpanded ? '收起 ▲' : '点击展开 ▼' }}</span>
            </div>
            <div class="analysis-content-wrapper" v-if="q.isExpanded">
              <div v-if="q.details && q.details.length > 0" class="details-list">
                <div v-for="(detail, dIndex) in filteredDetails(q.details)" :key="dIndex" class="detail-card">
                  <div class="detail-card-header">
                    <div class="detail-card-dot"></div>
                    <mp-html class="detail-card-title" :content="getDetailHeader(detail)" markdown copy-link="false"></mp-html>
                  </div>
                  <mp-html v-if="detail.Context" class="detail-card-body" :content="detail.Context" markdown copy-link="false"></mp-html>
                </div>
              </div>
              <mp-html v-else-if="q.OriginalAnswerText" class="answer-content" :content="q.OriginalAnswerText" markdown copy-link="false"></mp-html>
              <div v-else class="no-answer">
                <div class="empty-icon">📝</div>
                <p>该题目暂无详细解析内容</p>
              </div>
            </div>
          </div>
          <!-- #endif -->

          <div class="source-footer">
            来源：{{ q.BookTitle }} - {{ q.BookChapter }}
          </div>
        </div>
      </div>
    </main>

    <!-- 纠错弹窗 -->
    <div class="correction-modal-overlay" :class="{ 'active': correctionModalOpen }" @click="closeCorrectionModal">
      <div class="correction-modal-content" @click.stop>
        <div class="correction-modal-header">
          <div class="header-title-group">
            <span class="modal-icon">⚠️</span>
            <h2 class="correction-modal-title">题目纠错</h2>
          </div>
          <button class="correction-modal-close-btn" @click="closeCorrectionModal" aria-label="关闭">×</button>
        </div>
        <div class="correction-modal-body">
          <div class="correction-type-grid">
            <div 
              v-for="type in correctionTypes" 
              :key="type" 
              class="type-tag"
              :class="{ active: selectedCorrectionType === type }"
              @click="selectedCorrectionType = type"
            >
              {{ type }}
            </div>
          </div>
          <textarea 
            v-model="correctionContent" 
            placeholder="请详细描述错误内容，例如：公式显示异常、答案错误、解析不清晰等..." 
            class="correction-textarea"
          ></textarea>
          <div class="correction-footer">
            <p class="correction-tip">感谢您的反馈，我们将尽快核实并修正。</p>
            <button class="correction-submit-btn" :disabled="!isCorrectionValid" @click="submitCorrection">提交反馈</button>
          </div>
        </div>
      </div>
    </div>
  </view>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { request, BASE_URL } from '../../api/request';
import { transformContextString, parseTextWithLatexForMp } from '../../utils/latex';
import { checkTextContent } from '@/utils/contentSecurity.js';
import MpHtml from './components/mp-html/mp-html.vue';

const paperId = ref(null);
const paper = ref({});
const loading = ref(true);
const baseFontSize = ref(16);

// 纠错相关状态
const correctionModalOpen = ref(false);
const correctionContent = ref('');
const correctionTypes = ['内容错误', '图片模糊', '解析有误', '分类错误', '其他问题'];
const selectedCorrectionType = ref('内容错误');
const currentCorrectionQid = ref(null);

const isCorrectionValid = computed(() => {
  return correctionContent.value.trim().length >= 2;
});

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
      url: '/math/corrections',
      method: 'POST',
      data: {
        questionId: currentCorrectionQid.value,
        type: selectedCorrectionType.value,
        content: correctionContent.value,
        paperId: paperId.value
      }
    });
    uni.showToast({ title: '反馈已提交', icon: 'success' });
    closeCorrectionModal();
  } catch (error) {
    console.error('Failed to submit correction:', error);
    uni.showToast({ title: '提交失败，请稍后重试', icon: 'none' });
  }
};

const handleFontSizeChange = (e) => {
  baseFontSize.value = e.detail.value;
};

const fetchPaper = async () => {
  loading.value = true;
  try {
    const res = await request({
      url: `/math/smart-paper/${paperId.value}`
    });
    
    // 初始化解析展开状态
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

const filteredDetails = (details) => {
  if (!details) return [];
  // 仅显示“题目详解”和“一题多解”，过滤掉考点、疑难点等
  return details.filter(item => 
    ['题目详解', '一题多解', '答案', '解析', '证明', '步骤'].includes(item.BusType)
  );
};

const getDetailHeader = (item) => {
  let headerHtml = '';
  const itemBusType = item.BusType;
  
  if (itemBusType) {
    if (['答案', '解析', '证明'].includes(itemBusType)) {
      headerHtml += `<span class="tag-label-${itemBusType === '答案' ? 'daan' : (itemBusType === '解析' ? 'jiexi' : 'zhengming')}">${itemBusType}</span> `;
    } else if (['步骤'].includes(itemBusType)) {
      headerHtml += `<span class="tag-label-steps">${itemBusType}</span> `;
    } else if (['分析', '思路分析', '注释'].includes(itemBusType)) {
      headerHtml += `<span class="tag-label-analysis">${itemBusType}</span> `;
    } else {
      headerHtml += `<span class="bus-type-label">${itemBusType}</span>`;
    }
  }
  
  const itemTitle = item.Title;
  if (itemTitle) {
    headerHtml += `<span class="detail-title">${transformContextString(itemTitle)}</span>`;
  }
  
  return headerHtml;
};

const parseKps = (kpStr) => {
  if (!kpStr) return [];
  return kpStr.split(/[,，]/).filter(s => s.trim());
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

const goBack = () => {
  uni.navigateBack();
};

onLoad((options) => {
  if (options.paperId) {
    paperId.value = options.paperId;
    fetchPaper();
  } else {
    uni.showToast({ title: '参数错误', icon: 'none' });
    setTimeout(() => uni.navigateBack(), 1500);
  }
});
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
  max-width: 1200rpx;
  margin: 0 auto;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.left-actions {
  display: flex;
  align-items: center;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.font-ctrl {
  display: flex;
  align-items: center;
  background: #f5f5f5;
  padding: 4rpx 12rpx;
  border-radius: 30rpx;
  margin-right: 10rpx;
}

.ctrl-label {
  font-size: 0.7em;
  color: #666;
  white-space: nowrap;
}

.font-slider {
  width: 120rpx;
  margin: 0 10rpx;
}

.action-icon-btn {
  background: none;
  border: none;
  font-size: 32rpx;
  padding: 10rpx;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
}

.action-icon-btn:active {
  background-color: #f0f0f0;
}

.back-btn {
  font-size: 28rpx;
  color: #666;
  background: none;
  border: none;
  padding: 10rpx 20rpx;
  line-height: 1;
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

.action-btn {
  padding: 10rpx 24rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
  border: none;
}

.paper-content {
  padding: 20rpx;
  max-width: 800px;
  margin: 0 auto;
}

.paper-header {
  text-align: center;
  margin-bottom: 20rpx;
}

.main-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 4rpx;
}

.subtitle {
  font-size: 20rpx;
  color: #7f8c8d;
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.question-item {
  page-break-inside: avoid;
  border-bottom: 1rpx solid #eee;
  padding-bottom: 20rpx;
}

.question-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.question-num {
  font-weight: bold;
  color: #3498db;
  font-size: 1.05em;
}

.question-text {
  font-size: 1em;
  line-height: 1.5;
  color: #000;
  margin-bottom: 12rpx;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.question-text :deep(div),
.question-text :deep(p),
.answer-content :deep(div),
.answer-content :deep(p),
.detail-card-body :deep(div),
.detail-card-body :deep(p) {
  font-size: inherit !important;
}

.question-id-badge {
  font-size: 0.55em;
  color: #999;
  background: #f8f9fa;
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
  border: 1rpx solid #eee;
}

.question-type-tag {
  font-size: 0.6em;
  padding: 2rpx 10rpx;
  background: #f0f2f5;
  color: #666;
  border-radius: 4rpx;
}

.question-body {
  font-size: 1em;
  line-height: 1.5;
  color: #000;
  margin-bottom: 15rpx;
}

.question-img {
  max-width: 100%;
  display: block;
  margin: 12rpx 0;
  opacity: 0.8;
}

.analysis-section {
  background: #fdfefe;
  border: 1rpx solid #e1f0fa;
  border-radius: 8rpx;
  padding: 0;
  margin-bottom: 12rpx;
  overflow: hidden;
  transition: all 0.3s ease;
}

.analysis-header {
  padding: 12rpx 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #f8fbff;
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
  font-size: 0.9em;
  color: #333;
  font-weight: 600;
  margin-bottom: 0;
}

.expand-icon {
  font-size: 0.6em;
  color: #007aff;
}

.analysis-content-wrapper {
  padding: 15rpx;
  border-top: 1rpx solid #e1f0fa;
  background-color: #fff;
}

.answer-content {
  font-size: 1em;
  line-height: 1.5;
  color: #2c3e50;
  margin-bottom: 15rpx;
}

.no-answer {
  padding: 40rpx 0;
  text-align: center;
  color: #999;
}

.empty-icon {
  font-size: 48rpx;
  margin-bottom: 12rpx;
  opacity: 0.5;
}

.no-answer p {
  font-size: 24rpx;
}

/* 详细解析卡片样式 */
.details-list {
  margin-bottom: 12rpx;
}

.detail-card {
  background: #fdfdfd;
  border-radius: 8rpx;
  padding: 8rpx 12rpx;
  margin-bottom: 8rpx;
  border: 1rpx solid #f0f0f0;
}

.detail-card-header {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx;
}

.detail-card-dot {
  width: 6rpx;
  height: 6rpx;
  background: #007aff;
  border-radius: 50%;
  margin-right: 10rpx;
}

.detail-card-title {
  font-size: 0.9em;
  font-weight: bold;
  color: #000;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.detail-card-body {
  font-size: 0.95em;
  color: #000;
  line-height: 1.5;
}

/* 标签样式 */
:deep(.tag-label-daan),
:deep(.tag-label-jiexi),
:deep(.tag-label-zhengming) {
  background-color: #e3f2fd;
  color: #1976d2;
  padding: 2rpx 12rpx;
  border-radius: 4rpx;
  font-size: 0.85em;
  margin-right: 10rpx;
  font-weight: bold;
}

:deep(.tag-label-steps) {
  color: #ff5405;
  margin-right: 10rpx;
  font-size: 0.85em;
}

:deep(.tag-label-analysis) {
  color: #546e7a;
  margin-right: 10rpx;
  font-size: 0.85em;
}

:deep(.bus-type-label) {
  background-color: #f5f5f5;
  color: #666;
  padding: 2rpx 12rpx;
  border-radius: 4rpx;
  font-size: 0.85em;
  margin-right: 10rpx;
}

:deep(.detail-title) {
  margin-left: 4rpx;
}

/* 考点样式参考详情页 */
.knowledge-points-analysis {
  background: #fff8f2;
  border-radius: 12rpx;
  padding: 15rpx 20rpx;
  margin-top: 20rpx;
}

.kp-header {
  font-size: 0.85em;
  font-weight: bold;
  color: #e67e22;
  margin-bottom: 10rpx;
}

.kp-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.kp-item {
  font-size: 0.7em;
  color: #333;
  background: #fff;
  padding: 8rpx 20rpx;
  border-radius: 12rpx;
  border: 1rpx solid #ffd8b5;
}

.kp-item.custom {
  color: #666;
  background-color: #f5f5f5;
  border: 1rpx solid #ddd;
}

.source-footer {
  font-size: 0.75em;
  color: #bdc3c7;
  text-align: right;
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

/* 纠错按钮及弹窗样式 */
.correction-btn {
  background: none;
  border: 1px solid #ff3b30;
  color: #ff3b30;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  margin-left: 10rpx;
  line-height: 1.4;
}

.correction-btn:active {
  background-color: rgba(255, 59, 48, 0.1);
}

.correction-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 2000;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.correction-modal-overlay.active {
  opacity: 1;
  visibility: visible;
}

.correction-modal-content {
  width: 90%;
  max-width: 500rpx;
  background: #fff;
  border-radius: 20rpx;
  overflow: hidden;
  transform: translateY(20px);
  transition: transform 0.3s ease;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.correction-modal-overlay.active .correction-modal-content {
  transform: translateY(0);
}

.correction-modal-header {
  padding: 20rpx 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.modal-icon {
  font-size: 32rpx;
}

.correction-modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin: 0;
}

.correction-modal-close-btn {
  background: #f5f5f5;
  border: none;
  color: #999;
  width: 50rpx;
  height: 50rpx;
  border-radius: 25rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  cursor: pointer;
}

.correction-modal-body {
  padding: 30rpx;
}

.correction-type-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 15rpx;
  margin-bottom: 30rpx;
}

.type-tag {
  padding: 10rpx 25rpx;
  background: #f5f5f5;
  border: 1rpx solid #eee;
  border-radius: 30rpx;
  font-size: 24rpx;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.type-tag.active {
  background: #007aff;
  color: #fff;
  border-color: #007aff;
}

.correction-textarea {
  width: 100%;
  height: 240rpx;
  background: #f9f9f9;
  border: 1rpx solid #eee;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 30rpx;
  font-size: 28rpx;
  line-height: 1.6;
  color: #333;
  box-sizing: border-box;
}

.correction-footer {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.correction-tip {
  font-size: 22rpx;
  color: #999;
  margin: 0;
  text-align: center;
}

.correction-submit-btn {
  width: 100%;
  background: linear-gradient(135deg, #007aff, #0056b3);
  color: #fff;
  border: none;
  padding: 20rpx;
  border-radius: 12rpx;
  font-size: 30rpx;
  font-weight: bold;
  transition: all 0.2s;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.correction-submit-btn:disabled {
  background: #e0e0e0;
  color: #a0a0a0;
}
</style>
