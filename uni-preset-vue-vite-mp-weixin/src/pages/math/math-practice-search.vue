<template>
  <view class="app-container">
    <header class="practice-header">
      题目练习搜索
    </header>

    <section class="search-section">
      <div class="search-header-row">
        <h2>通过题目ID搜索</h2>
        <div v-if="curatedChapterId" class="curated-context-tag">
          📍 正在向章节添加题目
        </div>
      </div>
      <div class="search-input-group">
        <input type="text" id="searchInputQuestionId" v-model="searchQuestionId" placeholder="输入 ID，多个 ID 用逗号隔开">
        <button id="searchBtn" @click="searchQuestion">搜索</button>
      </div>
      <p id="searchErrorMsg" class="search-error-message" v-if="searchError">{{ searchError }}</p>
      
      <!-- 批量操作栏 -->
      <div v-if="questionList.length > 0 && curatedChapterId" class="batch-action-bar">
        <div class="selection-info">已选 {{ selectedQuestionIds.length }} 题</div>
        <button class="batch-add-btn" :disabled="selectedQuestionIds.length === 0" @click="addSelectedToCurated">
          加入当前章节
        </button>
      </div>
    </section>

    <div class="question-display-area" id="questionDisplayArea">
      <div v-if="loading" class="message loading-message">
        <div class="loading-spinner"></div>
        加载题目数据...
      </div>
      <div v-else-if="error" class="message error-message">{{ error }}</div>
      
      <!-- 多题目列表模式 -->
      <div v-else-if="questionList.length > 0" class="question-list-container">
        <div v-for="qData in questionList" :key="qData.id" class="question-list-item-wrapper">
          <div class="item-selection-overlay" v-if="curatedChapterId">
            <checkbox :checked="selectedQuestionIds.includes(qData.id)" @click="toggleSelection(qData.id)" />
          </div>
          <div class="question-content list-mode">
            <div class="content-container">
              <div class="question-identifier">
                ID: {{ qData.id }}
                <button class="correction-btn" @click="openCorrectionModal(qData.id)">纠错</button>
                <button v-if="curatedChapterId && !selectedQuestionIds.includes(qData.id)" class="quick-add-btn" @click="quickAddToCurated(qData.id)">快速加入</button>
              </div>
              <div v-html="transformContextString(qData.first_request[0].QuestionTxt || qData.first_request[0].QuestionText)"></div>
              
              <!-- 解析展开按钮 -->
              <div class="list-item-actions">
                <button class="toggle-details-btn" @click="qData.showDetails = !qData.showDetails">
                  {{ qData.showDetails ? '收起解析' : '查看解析' }}
                </button>
              </div>

              <!-- 展开详情 -->
              <div v-if="qData.showDetails" class="list-item-details">
                <div v-if="qData.second_request && qData.second_request.length > 0">
                  <div v-for="(item, idx) in sortDetails(qData.second_request)" :key="idx" class="detail-item">
                    <div class="detail-header">
                      <span class="tag-label" :class="`tag-label-${(item.BusType || '').toLowerCase()}`">{{ item.BusType }}</span>
                      <span v-if="item.Title" v-html="transformContextString(item.Title)"></span>
                    </div>
                    <div class="details-section-content" v-html="transformContextString(item.Context)"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 单题目模式 (保留原有逻辑，但其实现在都走列表模式) -->
      <div v-else-if="currentQuestion" class="question-content">
        <div class="content-container">
          <div class="question-identifier">
            {{ questionIdentifier }}
            <button class="correction-btn" @click="openCorrectionModal(currentQuestion.first_request[0].QuestionID)">纠错</button>
          </div>
          <div v-if="currentQuestion.first_request && currentQuestion.first_request[0]" v-html="transformedQuestionText"></div>
        </div>
        
        <div v-if="hasSecondRequest" class="section-header">
          <h2>答案与解析</h2>
        </div>
        <div v-if="currentQuestion.second_request && currentQuestion.second_request.length > 0">
          <div v-for="(item, index) in sortedSecondRequest" :key="index" class="content-container">
            <div v-if="item.BusType || item.Title" class="detail-header">
              <span v-if="['答案', '解析', '证明'].includes(item.BusType)" class="tag-label" :class="`tag-label-${item.BusType.toLowerCase()}`">
                {{ item.BusType }}
              </span>
              <span v-else-if="['步骤'].includes(item.BusType)" class="tag-label tag-label-steps">
                {{ item.BusType }}
              </span>
              <span v-else-if="['分析', '思路分析', '注释'].includes(item.BusType)" class="tag-label tag-label-analysis">
                {{ item.BusType }}
              </span>
              <span v-else-if="item.BusType" class="bus-type-label">
                {{ item.BusType }}
              </span>
              <span v-if="item.Title" class="detail-title" v-html="transformContextString(item.Title)"></span>
              <hr style="border:0; border-top:1px solid var(--light-border-color); margin:8px 0;">
            </div>
            <div class="details-section-content" v-if="item.Context" v-html="transformContextString(item.Context)"></div>
          </div>
        </div>
        
        <div v-if="hasKnowledgePoints" class="section-header">
          <h2>考点与知识点</h2>
        </div>
        <div v-if="knowledgePoints.length > 0">
          <div v-for="(group, index) in knowledgePoints" :key="index" class="knowledge-point-group-container">
            <div class="knowledge-point-group-header">
              {{ group.type === '考点' ? '🟠 ' : '🔴 ' }}{{ group.type }}
            </div>
            <div v-for="(item, idx) in group.items" :key="idx" class="knowledge-point-item">
              <div v-if="item.Title" class="kp-item-title" v-html="transformContextString(item.Title)"></div>
              <div v-else-if="item._question_code && item._question_code.Title" class="kp-item-title" v-html="transformContextString(item._question_code.Title)"></div>
              <div v-if="item.Context" class="kp-content" v-html="transformContextString(item.Context)"></div>
              <div v-else-if="item._question_code && item._question_code.Content" class="kp-content" v-html="transformContextString(item._question_code.Content)"></div>
              <div v-if="item._question_code && item._question_code.Notes" class="kp-notes">
                注: {{ transformContextString(item._question_code.Notes) }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="message info-message">请输入题目ID进行搜索。</div>
    </div>

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

    <nav class="bottom-nav">
      <navigator url="/pages/math/math-bookshelf" class="nav-item" aria-label="学习">
        <span class="icon">📖</span>
        学习
      </navigator>
      <a href="#" class="nav-item active" aria-label="练习">
        <span class="icon">✍️</span>
        练习
      </a>
      <a href="#" class="nav-item" aria-label="我的">
        <span class="icon">👤</span>
        我的
      </a>
    </nav>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { request } from '../../api/request';
import { transformContextString } from '../../utils/latex';
import { checkTextContent } from '@/utils/contentSecurity.js';

// 基础状态
const searchQuestionId = ref('');
const searchError = ref('');
const currentQuestion = ref(null);
const questionList = ref([]); // 题目列表模式
const loading = ref(false);
const error = ref('');

// 精选题库上下文
const curatedChapterId = ref(null);
const selectedQuestionIds = ref([]);

// 纠错弹窗相关状态
const correctionModalOpen = ref(false);
const correctionTypes = ['题目内容错误', '公式显示异常', '答案解析错误', '考点归类错误', '其他'];
const selectedCorrectionType = ref('');
const correctionContent = ref('');
const currentCorrectionQid = ref('');

const isCorrectionValid = computed(() => {
  return selectedCorrectionType.value && correctionContent.value.trim().length >= 5;
});

const openCorrectionModal = (qid) => {
  currentCorrectionQid.value = qid;
  correctionModalOpen.value = true;
};

const closeCorrectionModal = () => {
  correctionModalOpen.value = false;
  selectedCorrectionType.value = '';
  correctionContent.value = '';
};

const submitCorrection = async () => {
  if (!isCorrectionValid.value) {
    uni.showToast({ title: '请完善纠错信息', icon: 'none' });
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

const fetchQuestionData = async (questionId) => {
  loading.value = true;
  error.value = '';
  searchError.value = '';
  questionList.value = [];
  currentQuestion.value = null;
  
  try {
    // 检查是否是多个ID
    const ids = questionId.split(/[,，\s]+/).filter(id => id.trim() && !isNaN(id));
    
    if (ids.length > 1) {
      const response = await request(`/math/batch-question-data?questionIds=${ids.join(',')}`, 'GET');
      const list = [];
      for (const id of ids) {
        if (response.data && response.data[id]) {
          list.push({
            id: id,
            ...response.data[id],
            showDetails: false
          });
        }
      }
      questionList.value = list;
      if (list.length === 0) throw new Error('未找到匹配的题目');

      // 保存为最近练习科目，以便在首页显示
      if (!curatedChapterId.value) {
        const practiceItem = {
          id: 'math-search',
          title: `数学 - 题目搜索 (${ids.length}题)`,
          url: '/pages/math/math-practice-search',
          icon: 'math'
        };
        uni.setStorageSync('lastPracticeSubject', practiceItem);
      }
    } else {
      const id = ids[0];
      const response = await request(`/math/single-question-data?global_question_id=${id}`, 'GET');
      if (response.data && response.data[id]) {
        currentQuestion.value = response.data[id];
        // 为了统一，也放入列表
        questionList.value = [{
          id: id,
          ...response.data[id],
          showDetails: true
        }];

        // 保存为最近练习科目，以便在首页显示
        if (!curatedChapterId.value) {
          const practiceItem = {
            id: `math-search-${id}`,
            title: `数学 - 题目搜索 (ID: ${id})`,
            url: '/pages/math/math-practice-search',
            icon: 'math'
          };
          uni.setStorageSync('lastPracticeSubject', practiceItem);
        }
      } else {
        throw new Error(`题目 ${id} 未找到`);
      }
    }
  } catch (err) {
    console.error('Error fetching question data:', err);
    error.value = `加载题目失败: ${err.message}`;
  } finally {
    loading.value = false;
  }
};

const searchQuestion = () => {
  const qidStr = searchQuestionId.value.trim();
  if (!qidStr) {
    searchError.value = '请输入题目ID。';
    return;
  }
  fetchQuestionData(qidStr);
};

// 精选题库操作
const toggleSelection = (qid) => {
  const index = selectedQuestionIds.value.indexOf(qid);
  if (index > -1) {
    selectedQuestionIds.value.splice(index, 1);
  } else {
    selectedQuestionIds.value.push(qid);
  }
};

const quickAddToCurated = async (qid) => {
  if (!curatedChapterId.value) return;
  
  try {
    await request({
      url: `/math/curated-chapters/${curatedChapterId.value}/questions`,
      method: 'POST',
      data: {
        questionIds: [qid]
      }
    });
    uni.showToast({ title: '已加入', icon: 'success' });
    if (!selectedQuestionIds.value.includes(qid)) {
      selectedQuestionIds.value.push(qid);
    }
  } catch (err) {
    uni.showToast({ title: '添加失败', icon: 'none' });
  }
};

const addSelectedToCurated = async () => {
  if (!curatedChapterId.value || selectedQuestionIds.value.length === 0) return;
  
  try {
    await request({
      url: `/math/curated-chapters/${curatedChapterId.value}/questions`,
      method: 'POST',
      data: {
        questionIds: selectedQuestionIds.value
      }
    });
    uni.showToast({ title: `成功加入 ${selectedQuestionIds.value.length} 题`, icon: 'success' });
    // 延迟返回
    setTimeout(() => {
      uni.navigateBack();
    }, 1500);
  } catch (err) {
    uni.showToast({ title: '批量添加失败', icon: 'none' });
  }
};

const sortDetails = (details) => {
  if (!details) return [];
  const busTypeOrder = ["题目详解", "一题多解", "答案", "解析", "思路分析", "步骤", "注释", "分析", "点评"];
  return [...details].sort((a, b) => {
    const orderA = busTypeOrder.indexOf(a.BusType);
    const orderB = busTypeOrder.indexOf(b.BusType);
    if (orderA === -1 && orderB === -1) return 0;
    if (orderA === -1) return 1;
    if (orderB === -1) return -1;
    return orderA - orderB;
  });
};

const questionIdentifier = computed(() => {
  if (!currentQuestion.value || !currentQuestion.value.first_request || !currentQuestion.value.first_request[0]) {
    return '';
  }
  const fr = currentQuestion.value.first_request[0];
  const globalId = fr.GlobalQuestionID || searchQuestionId.value;
  let displayText = `ID: ${globalId}`;
  if (fr.CurrentBookTitle) {
    displayText += ` (来自《${fr.CurrentBookTitle}》)`;
  } else if (fr.LegacyOriginalBookTitle) {
    displayText += ` (原书: 《${fr.LegacyOriginalBookTitle}》)`;
  }
  return displayText;
});

const transformedQuestionText = computed(() => {
  if (!currentQuestion.value || !currentQuestion.value.first_request || !currentQuestion.value.first_request[0]) {
    return '';
  }
  const fr = currentQuestion.value.first_request[0];
  return fr.QuestionTxt ? transformContextString(fr.QuestionTxt) : '';
});

const hasSecondRequest = computed(() => {
  return currentQuestion.value && currentQuestion.value.second_request && currentQuestion.value.second_request.length > 0;
});

const hasKnowledgePoints = computed(() => {
  return knowledgePoints.value.length > 0;
});

const sortedSecondRequest = computed(() => {
  if (!currentQuestion.value || !currentQuestion.value.second_request) {
    return [];
  }
  const busTypeOrder = ["题目详解", "一题多解", "答案", "解析", "思路分析", "步骤", "注释", "分析", "点评"];
  return [...currentQuestion.value.second_request].sort((a, b) => {
    const orderA = busTypeOrder.indexOf(a.BusType);
    const orderB = busTypeOrder.indexOf(b.BusType);
    if (orderA === -1 && orderB === -1) {
      return String(a.BusType || "").localeCompare(String(b.BusType || ""));
    }
    if (orderA === -1) return 1;
    if (orderB === -1) return -1;
    return orderA - orderB;
  });
});

const knowledgePoints = computed(() => {
  if (!currentQuestion.value || !currentQuestion.value.second_request) {
    return [];
  }
  const KAO_DIAN_BUS_TYPE = "考点";
  const YI_NAN_DIAN_BUS_TYPE = "疑难点";
  const groupedKnowledgePoints = {};
  
  currentQuestion.value.second_request.forEach(item => {
    if (item.BusType === KAO_DIAN_BUS_TYPE || item.BusType === YI_NAN_DIAN_BUS_TYPE) {
      if (!groupedKnowledgePoints[item.BusType]) {
        groupedKnowledgePoints[item.BusType] = [];
      }
      groupedKnowledgePoints[item.BusType].push(item);
    }
  });
  
  return Object.entries(groupedKnowledgePoints).map(([type, items]) => ({
    type,
    items
  }));
});

onMounted(() => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options;
  
  if (options.curatedChapterId) {
    curatedChapterId.value = options.curatedChapterId;
  }
  
  if (options.question_id) {
    searchQuestionId.value = options.question_id;
    searchQuestion();
  }
});
</script>

<style>
:root {
  --primary-color: #5DADE2;
  --primary-darker: #3498DB;
  --secondary-color: #48C9B0;
  --text-color: #34495E;
  --light-text-color: #5D6D7E;
  --bg-color: #f8f9fa;
  --container-bg: #ffffff;
  --border-color: #e0e6ed;
  --light-border-color: #f1f3f5;
  --shadow-color: rgba(0, 0, 0, 0.08);
  --error-color: #e74c3c;
  --info-color: #3498db;
  --tag-bg: #009688;
  --tag-text: #ffffff;
  --primary-color-rgb: 93, 173, 226;
}

.app-container {
  width: 100%;
  max-width: 850px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 100vh;
  background-color: var(--bg-color);
}

.practice-header {
  background-color: var(--primary-darker);
  color: white;
  padding: 15px 20px;
  text-align: center;
  font-size: 1.2em;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.search-section {
  background-color: var(--container-bg);
  padding: 20px;
  margin: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-color);
}

.search-section h2 {
  margin: 0;
  font-size: 1.3em;
  color: var(--primary-darker);
}

.search-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.curated-context-tag {
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.85em;
  font-weight: 500;
}

.batch-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px dashed var(--border-color);
}

.selection-info {
  font-size: 0.9em;
  color: var(--light-text-color);
}

.batch-add-btn {
  background: var(--secondary-color);
  color: white;
  border: none;
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 0.9em;
  font-weight: 600;
}

.batch-add-btn:disabled {
  opacity: 0.5;
  background: #ccc;
}

.question-list-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.question-list-item-wrapper {
  position: relative;
  display: flex;
  gap: 15px;
}

.item-selection-overlay {
  padding-top: 20px;
}

.question-content.list-mode {
  flex: 1;
}

.quick-add-btn {
  background: #f0f7ff;
  border: 1px solid #007bff;
  color: #007bff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  margin-left: 10px;
  cursor: pointer;
}

.quick-add-btn:hover {
  background: #007bff;
  color: white;
}

.list-item-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.toggle-details-btn {
  background: none;
  border: none;
  color: var(--primary-color);
  font-size: 0.9em;
  cursor: pointer;
  padding: 5px;
}

.list-item-details {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--light-border-color);
}

.detail-item {
  margin-bottom: 15px;
}

.search-input-group {
  display: flex;
  margin-bottom: 10px;
}

.search-input-group input[type=text] {
  flex-grow: 1;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px 0 0 4px;
  font-size: 1em;
  outline: 0;
}

.search-input-group input[type=text]:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb),.2);
}

.search-input-group button {
  padding: 10px 15px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
  font-size: 1em;
  font-weight: 600;
}

.search-input-group button:hover {
  background-color: var(--primary-darker);
}

.search-error-message {
  color: var(--error-color);
  font-size: 0.9em;
  min-height: 1.2em;
  text-align: left;
  margin-top: 5px;
}

.question-display-area {
  padding: 0 20px 20px 20px;
  flex-grow: 1;
}

.message.loading-message,
.message.error-message,
.message.info-message {
  text-align: center;
  font-size: 1.05em;
  padding: 30px 20px;
  color: var(--light-text-color);
  background-color: var(--container-bg);
  border-radius: 8px;
  margin-top: 15px;
  border: 1px solid var(--border-color);
}

.message.error-message {
  color: var(--error-color);
  font-weight: 600;
  background-color: #fdecea;
  border: 1px solid var(--error-color);
}

.message.info-message {
  background-color: #e6f7ff;
  border: 1px solid var(--info-color);
  color: var(--info-color);
}

.loading-spinner {
  border: 3px solid #f0f0f0;
  border-top: 3px solid var(--primary-color);
  border-radius: 50%;
  width: 20px;
  height: 20px;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 10px auto;
  display: block;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.content-container {
  border: 1px solid var(--border-color);
  padding: 18px;
  margin-bottom: 20px;
  background-color: var(--container-bg);
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.03);
  overflow-x: auto;
}

.question-identifier {
  font-family: 'SimSun', 'Times New Roman', Times, serif;
  font-size: 0.95em;
  color: var(--light-text-color);
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--light-border-color);
  background-color: #fdfdfd;
  padding: 10px 15px;
  border-radius: 6px;
  word-break: break-all;
}

.md-image {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 15px auto;
  border: 1px solid var(--border-color);
  padding: 4px;
  background-color: var(--container-bg);
  border-radius: 6px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.07);
}

.katex-display {
  display: inline-block !important;
  vertical-align: middle;
  margin-left: 0.2em;
  margin-right: 0.2em;
  text-align: left !important;
}

.katex {
  vertical-align: baseline;
  font-size: 1.05em;
}

.math-display-scrollable {
  display: block;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.3em 0.1em;
  -webkit-overflow-scrolling: touch;
  position: relative;
  z-index: 1;
}

.math-display-scrollable > .katex-display {
  margin: 0 !important;
}

.details-section-content {
  font-size: 1em;
  line-height: 1.7;
}

.details-section-content .katex-display .katex,
.details-section-content .katex {
  font-size: 1em !important;
}

.tag-label-steps {
  color: #FF5405;
}

.tag-label-analysis,
[class*="tag-label-思路"] {
  color: #546E7A;
}

[class*="tag-label-注释"] {
  color: #546E7A;
  font-style: italic;
}

[class*="tag-label-答案"],
[class*="tag-label-解析"],
[class*="tag-label-证明"] {
  color: var(--tag-text);
  background-color: var(--tag-bg);
  padding: 1px 6px;
  margin-right: 6px;
  border-radius: 4px;
  font-weight: bold;
}

.bus-type-label {
  font-weight: bold;
  color: var(--secondary-color);
  margin-right: 8px;
  font-size: 1em;
  text-transform: uppercase;
  display: block;
  margin-bottom: 8px;
}

.detail-title {
  font-weight: bold;
  color: var(--text-color);
  font-size: 1.05em;
  margin-bottom: 8px;
  display: block;
  overflow-x: auto;
  padding-bottom: 3px;
}

.knowledge-point-group-container {
  border: 1px solid var(--border-color);
  padding: 0;
  margin-bottom: 20px;
  background-color: var(--container-bg);
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0,0,0,.03);
}

.knowledge-point-group-header {
  font-weight: bold;
  color: var(--tag-text);
  background-color: #e67e22;
  padding: 10px 18px;
  font-size: 1.05em;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
}

.knowledge-point-item {
  padding: 15px 18px;
  border-bottom: 1px solid var(--light-border-color);
}

.knowledge-point-item:last-child {
  border-bottom: none;
}

.knowledge-point-item .kp-item-title {
  font-weight: 600;
  color: #2c3e50;
  font-size: 1em;
  margin-bottom: 6px;
  display: block;
  overflow-x: auto;
  padding-bottom: 3px;
}

.knowledge-point-item .kp-content {
  font-style: normal;
  color: var(--text-color);
  font-size: 1em;
  margin-top: 8px;
  overflow-x: auto;
  padding-bottom: 3px;
}

.knowledge-point-item .kp-notes {
  font-style: italic;
  color: var(--light-text-color);
  font-size: 0.9em;
  margin-top: 8px;
  padding-left: 10px;
  border-left: 2px solid var(--secondary-color);
  overflow-x: auto;
  padding-bottom: 3px;
}

.section-header {
  font-size: 1.2em;
  font-weight: 700;
  color: var(--primary-darker);
  margin-top: 25px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--primary-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: 850px;
  margin: 0 auto;
  background-color: #ffffff;
  border-top: 1px solid #dee2e6;
  display: flex;
  justify-content: space-around;
  padding: 6px 0 4px 0;
  box-shadow: 0 -2px 5px rgba(0,0,0,0.03);
  z-index: 100;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: #6c757d;
  font-size: 10px;
  position: relative;
  padding: 0 5px;
  flex: 1;
  min-width: 0;
}

.nav-item.active {
  color: #007bff;
}

.nav-item .icon {
  font-size: 18px;
  margin-bottom: 1px;
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
  margin-left: 15rpx;
  line-height: 1.4;
  vertical-align: middle;
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
  font-size: 28rpx;
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