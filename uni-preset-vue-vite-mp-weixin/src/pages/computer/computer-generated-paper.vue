<template>
  <view class="paper-container" :class="{ 'loading-mask': loading }" @click="showMoreMenu = false">
    <view class="top-bar no-print">
      <view class="top-bar-content">
        <view class="left-actions">
          <view class="back-btn" @click="goBack">❮</view>
        </view>
        <view class="paper-title-container" @click="editTitle">
          <text class="paper-title">{{ paper.title || '智能组卷' }}</text>
          <text class="edit-icon">✎</text>
        </view>
        <view class="top-actions" v-if="!loading">
          <view class="more-actions-container">
            <view class="action-icon-btn more-btn" @click.stop="toggleMoreMenu">更多 ⋮</view>
            <view class="more-menu" v-if="showMoreMenu" @click.stop>
              <view class="menu-item no-hover">
                <view class="font-ctrl-menu">
                  <text class="ctrl-label">字号</text>
                  <slider class="font-slider" :value="baseFontSize" @change="handleFontSizeChange" min="12" max="24" stroke-width="3" block-size="16" v-if="paper.questions" />
                </view>
              </view>
              <view class="menu-divider"></view>
              <view class="menu-item" @click="goToAnalysis(); showMoreMenu = false">
                <text class="menu-icon">📖</text> 查看解析
              </view>
              <view class="menu-item" @click="showDataAnalysis(); showMoreMenu = false">
                <text class="menu-icon">📊</text> 数据分析
              </view>
              <view class="menu-item" @click="showPaperInfo(); showMoreMenu = false">
                <text class="menu-icon">ⓘ</text> 试卷信息
              </view>
              <view class="menu-item" @click="handlePrint(); showMoreMenu = false">
                <text class="menu-icon">⎙</text> 打印试卷
              </view>
              <view class="menu-divider"></view>
              <view class="menu-item delete" @click="confirmDelete(); showMoreMenu = false">
                <text class="menu-icon">🗑</text> 删除试卷
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="paper-content" id="paper-content" :style="{ fontSize: baseFontSize + 'px' }">
      <view class="paper-header">
        <text class="main-title" :style="{ fontSize: (baseFontSize + 12) + 'px' }">{{ paper.title }}</text>
        <view class="paper-info" :style="{ fontSize: (baseFontSize - 2) + 'px' }">
          <text>科目：{{ subjectName }}</text>
          <text>题目数量：{{ paper.questions?.length || 0 }}</text>
          <text>生成时间：{{ formatDate(paper.create_time) }}</text>
        </view>
      </view>

      <view class="questions-list">
        <view v-for="(q, index) in paper.questions" :key="q.question_id" class="question-item">
          <view class="question-header">
            <view class="q-left">
              <text class="question-num">{{ index + 1 }}.</text>
              <text class="question-type-tag">{{ q.exercise_type_name }}</text>
            </view>
            <view class="q-right no-print">
              <view class="reorder-btns">
                <text class="reorder-btn" @click="moveQuestion(index, -1)" :class="{ disabled: index === 0 }">上移</text>
                <text class="reorder-btn" @click="moveQuestion(index, 1)" :class="{ disabled: index === paper.questions.length - 1 }">下移</text>
              </view>
              <text class="replace-btn" @click="replaceQuestion(q, index)">换一题</text>
              <view class="correction-btn" @click="openCorrectionModal(q.question_id)">纠错</view>
            </view>
          </view>
          
          <view class="question-body">
            <view class="question-text" v-html="formatLatex(q.stem)"></view>
            <!-- 选项展示 -->
            <view class="options-list" v-if="q.options && q.options.length > 0">
              <view v-for="opt in q.options" :key="opt.option_key" class="option-item">
                <text class="option-key">{{ opt.option_key }}.</text>
                <view class="option-value" v-html="formatLatex(opt.option_value)"></view>
              </view>
            </view>
          </view>
          
          <view class="question-footer no-print">
            <text class="source-tag">来源：{{ q.major_id }}</text>
            <text class="chapter-tag">{{ q.chapter_id }}</text>
          </view>

          <view class="question-footer-print only-print">
            来源：{{ q.major_id }} - {{ q.chapter_id }}
          </view>
        </view>
      </view>
    </view>

    <!-- 试卷信息弹窗 -->
    <view class="modal" v-if="showInfoModal" @click="showInfoModal = false">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-h3">试卷配置信息</text>
          <text class="close-btn" @click="showInfoModal = false">×</text>
        </view>
        <view class="modal-body" v-if="paper.config">
          <view class="info-item">
            <text class="info-label">生成标题：</text>
            <text>{{ paper.title }}</text>
          </view>
          <view class="info-item">
            <text class="info-label">题目分布：</text>
            <text>单选:{{ paperConfig.counts?.choice || 0 }} | 多选:{{ paperConfig.counts?.multiple || 0 }} | 填空:{{ paperConfig.counts?.fill || 0 }} | 解答:{{ paperConfig.counts?.analysis || 0 }} | 判断:{{ paperConfig.counts?.judge || 0 }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 数据分析弹窗 (简化版) -->
    <view class="modal" v-if="showAnalysisModal" @click="showAnalysisModal = false">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-h3">试卷数据分析</text>
          <text class="close-btn" @click="showAnalysisModal = false">×</text>
        </view>
        <view class="modal-body analysis-body">
          <view class="analysis-item">
            <text class="analysis-sub-title">1. 题型分布</text>
            <view class="stats-bars">
              <view v-for="(count, type) in analysisData.typeDist" :key="type" class="stat-bar-item">
                <text class="stat-label">{{ type }}</text>
                <view class="bar-bg">
                  <view class="bar-fill" :style="{ width: (count / paper.questions.length * 100) + '%' }"></view>
                </view>
                <text class="stat-count">{{ count }}题</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="fab-container no-print">
      <view class="fab-btn" @click="goToAnalysis">
        <text class="fab-icon">📝</text>
        <text class="fab-text">答案解析</text>
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
          <view class="correction-modal-close-btn" @click="closeCorrectionModal" aria-label="关闭">×</view>
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
import { ref, onMounted, nextTick, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { request, BASE_URL } from '../../api/request';
import { transformContextString } from '../../utils/latex';
import { checkTextContent } from '@/utils/contentSecurity.js';

const paperId = ref(null);
const paper = ref({});
const subjectName = ref('');
const loading = ref(true);
const showInfoModal = ref(false);
const showAnalysisModal = ref(false);
const paperConfig = ref({ scope: [], counts: {} });
const showMoreMenu = ref(false);
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

onLoad((options) => {
  if (options.paperId) {
    paperId.value = options.paperId;
    fetchPaper();
  }
});

const fetchPaper = async () => {
  loading.value = true;
  try {
    const res = await request({
      url: `/computer1/smart-papers/${paperId.value}`
    });
    
    paper.value = res.data;
    
    if (paper.value.config) {
      paperConfig.value = typeof paper.value.config === 'string' 
        ? JSON.parse(paper.value.config) 
        : paper.value.config;
    }
    
    // Get subject name
    const subRes = await request({ url: '/computer1/subjects' });
    const sub = subRes.data.find(s => s.major_id === paper.value.major_id);
    subjectName.value = sub ? sub.subject_name : '未知科目';
    
    await nextTick();
    renderMath();
  } catch (err) {
    console.error('Fetch paper error:', err);
    uni.showToast({ title: '加载试卷失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const formatLatex = (text) => {
  return transformContextString(text);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
  } else {
    uni.redirectTo({ url: '/pages/computer/computer-main' });
  }
};

const toggleMoreMenu = () => {
  showMoreMenu.value = !showMoreMenu.value;
};

const handleFontSizeChange = (e) => {
  baseFontSize.value = e.detail.value;
};

const editTitle = () => {
  uni.showModal({
    title: '修改试卷标题',
    editable: true,
    placeholderText: '请输入新的标题',
    content: paper.value.title,
    success: async (res) => {
      if (res.confirm) {
        const newTitle = res.content ? res.content.trim() : '';
        if (!newTitle) {
          uni.showToast({ title: '标题不能为空', icon: 'none' });
          return;
        }
        try {
          await request({
            url: `/computer1/smart-papers/${paperId.value}/title`,
            method: 'PUT',
            data: { title: newTitle }
          });
          paper.value.title = newTitle;
          uni.showToast({ title: '修改成功', icon: 'success' });
        } catch (err) {
          console.error('Update title error:', err);
          uni.showToast({ title: '修改失败', icon: 'none' });
        }
      }
    }
  });
};

const confirmDelete = () => {
  uni.showModal({
    title: '确认删除',
    content: '删除后无法恢复，确定要删除这张试卷吗？',
    confirmColor: '#dd524d',
    success: async (res) => {
      if (res.confirm) {
        try {
          await request({
            url: `/computer1/smart-papers/${paperId.value}`,
            method: 'DELETE'
          });
          uni.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => {
            uni.redirectTo({ url: '/pages/computer/computer-my-papers' });
          }, 1000);
        } catch (err) {
          console.error('Delete paper error:', err);
          uni.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    }
  });
};

const replaceQuestion = async (q, index) => {
  uni.showLoading({ title: '正在寻找新题目...' });
  try {
    const res = await request({
      url: `/computer1/smart-papers/${paperId.value}/replace-question`,
      method: 'POST',
      data: {
        oldQuestionId: q.question_id,
        sortOrder: index + 1
      }
    });
    
    uni.showToast({ title: '更换成功', icon: 'success' });
    await fetchPaper(); // 重新加载试卷
  } catch (err) {
    console.error('Replace question error:', err);
    uni.showToast({ title: err.message || '更换失败', icon: 'none' });
  } finally {
    uni.hideLoading();
  }
};

const moveQuestion = (index, direction) => {
  // 仅前端移动，实际后端排序需要额外接口，这里简化处理
  const questions = [...paper.value.questions];
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= questions.length) return;
  
  const temp = questions[index];
  questions[index] = questions[newIndex];
  questions[newIndex] = temp;
  
  paper.value.questions = questions;
};

const goToAnalysis = () => {
  uni.navigateTo({
    url: `/pages/computer/computer-generated-paper-analysis?paperId=${paperId.value}`
  });
};

const showDataAnalysis = () => {
  showAnalysisModal.value = true;
};

const showPaperInfo = () => {
  showInfoModal.value = true;
};

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

const analysisData = computed(() => {
  if (!paper.value.questions) return { typeDist: {} };
  
  const typeDist = {};
  paper.value.questions.forEach((q) => {
    typeDist[q.exercise_type_name] = (typeDist[q.exercise_type_name] || 0) + 1;
  });
  
  return { typeDist };
});

</script>

<style scoped>
.paper-container {
  min-height: 100vh;
  background-color: #f8f9fa;
  padding-bottom: 120rpx;
}

.top-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #fff;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
}

.top-bar-content {
  height: 88rpx;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
}

.paper-title-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 20rpx;
}

.paper-title {
  font-size: 32rpx;
  font-weight: bold;
  max-width: 400rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-icon {
  font-size: 24rpx;
  color: #999;
  margin-left: 10rpx;
}

.back-btn {
  background: none;
  border: none;
  font-size: 40rpx;
  padding: 0 20rpx;
}

.action-icon-btn {
  background: #f0f0f0;
  border: none;
  font-size: 24rpx;
  padding: 10rpx 20rpx;
  border-radius: 30rpx;
}

.more-actions-container {
  position: relative;
}

.more-menu {
  position: absolute;
  top: 70rpx;
  right: 0;
  background: #fff;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.15);
  border-radius: 12rpx;
  width: 280rpx;
  padding: 10rpx 0;
  z-index: 200;
}

.menu-item {
  padding: 20rpx 30rpx;
  display: flex;
  align-items: center;
  font-size: 28rpx;
}

.menu-item:active {
  background: #f5f5f5;
}

.menu-item.delete {
  color: #dd524d;
}

.menu-icon {
  margin-right: 15rpx;
}

.menu-divider {
  height: 1rpx;
  background: #eee;
  margin: 10rpx 0;
}

.font-ctrl-menu {
  display: flex;
  align-items: center;
  width: 100%;
}

.font-slider {
  flex: 1;
  margin-left: 20rpx;
}

.paper-content {
  padding: 40rpx 30rpx;
  background: #fff;
  margin: 20rpx;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.02);
}

.paper-header {
  text-align: center;
  margin-bottom: 60rpx;
  padding-bottom: 30rpx;
  border-bottom: 2rpx dashed #eee;
}

.main-title {
  font-weight: bold;
  margin-bottom: 20rpx;
}

.paper-info {
  color: #666;
  display: flex;
  justify-content: center;
  gap: 30rpx;
}

.question-item {
  margin-bottom: 60rpx;
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20rpx;
}

.question-num {
  font-weight: bold;
  margin-right: 15rpx;
}

.question-type-tag {
  font-size: 22rpx;
  background: #e1f5fe;
  color: #039be5;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
}

.q-right {
  display: flex;
  align-items: center;
  gap: 15rpx;
}

.reorder-btns {
  display: flex;
  gap: 10rpx;
}

.reorder-btn {
  font-size: 24rpx;
  color: #007aff;
}

.reorder-btn.disabled {
  color: #ccc;
}

.replace-btn {
  font-size: 24rpx;
  color: #4cd964;
}

.correction-btn {
  font-size: 22rpx;
  background: #fff5f5;
  color: #ff5252;
  border: 1rpx solid #ffcfcf;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  line-height: 1.2;
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
  margin-bottom: 15rpx;
}

.option-key {
  margin-right: 15rpx;
  font-weight: 500;
}

.question-footer {
  font-size: 24rpx;
  color: #999;
  display: flex;
  gap: 20rpx;
  margin-top: 15rpx;
  padding-top: 15rpx;
  border-top: 1rpx solid #f5f5f5;
}

/* Modal styles */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  width: 80%;
  max-height: 80vh;
  border-radius: 16rpx;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1rpx solid #eee;
}

.modal-body {
  padding: 40rpx 30rpx;
  overflow-y: auto;
}

.info-item {
  margin-bottom: 30rpx;
}

.info-item label {
  font-weight: bold;
  display: block;
  margin-bottom: 10rpx;
}

.fab-container {
  position: fixed;
  right: 30rpx;
  bottom: 40rpx;
  z-index: 90;
}

.fab-btn {
  background: #007aff;
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 120rpx;
  height: 120rpx;
  border-radius: 60rpx;
  box-shadow: 0 6rpx 20rpx rgba(0,122,255,0.3);
}

.fab-icon {
  font-size: 36rpx;
  margin-bottom: 4rpx;
}

.fab-text {
  font-size: 20rpx;
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

.header-title-group {
  display: flex;
  align-items: center;
}

.correction-modal-title {
  font-size: 32rpx;
  font-weight: bold;
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
  color: #666;
}

.type-tag.active {
  background: #e3f2fd;
  color: #1976d2;
  border: 1rpx solid #90caf9;
}

.correction-textarea {
  width: 100%;
  height: 200rpx;
  background: #f9f9f9;
  border: 1rpx solid #eee;
  border-radius: 12rpx;
  padding: 20rpx;
  box-sizing: border-box;
  font-size: 28rpx;
}

.correction-footer {
  margin-top: 30rpx;
}

.correction-tip {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 20rpx;
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

.only-print {
  display: none;
}

@media print {
  .no-print {
    display: none !important;
  }
  .only-print {
    display: block !important;
  }
  .paper-content {
    padding: 0;
    margin: 0;
    max-width: none;
  }
  .paper-container {
    background: #fff;
  }
  .question-footer-print {
    margin-top: 10rpx;
    font-size: 20rpx;
    color: #999;
    text-align: right;
    border-top: 1rpx dashed #eee;
  }
}
</style>
