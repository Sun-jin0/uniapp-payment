<template>
  <div class="app-container">
    <section class="search-section">
      <h2>通过题目ID搜索</h2>
      <div class="search-input-group">
        <input type="text" id="searchInputQuestionId" v-model="searchQuestionId" placeholder="输入 Question ID (纯数字)">
        <button id="searchBtn" @click="handleSearch">搜索</button>
      </div>
      <p id="searchErrorMsg" class="search-error-message" v-if="searchError">{{ searchError }}</p>
    </section>

    <div class="question-display-area" id="questionDisplayArea">
      <div v-if="loading" class="message loading-message">
        <div class="loading-spinner"></div>
        加载题目数据...
      </div>
      <div v-else-if="error" class="message error-message">{{ error }}</div>
      <div v-else-if="questionData" class="question-content">
        <div class="content-container">
          <div class="question-identifier">
            {{ questionIdentifier }}
          </div>
          <div v-html="transformedQuestionText"></div>
        </div>
        
        <div v-if="hasSecondRequest" class="section-header">
          <h2>答案与解析</h2>
        </div>
        <div v-if="questionData.second_request && questionData.second_request.length > 0">
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { request } from '../../api/request';
import { transformContextString } from '../../utils/latex';

// 兼容微信小程序的 URLSearchParams 替代方案
function getQueryParam(name) {
  // #ifdef H5
  if (typeof window !== 'undefined' && window.location) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }
  // #endif
  // #ifdef MP-WEIXIN
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  if (currentPage && currentPage.options) {
    return currentPage.options[name];
  }
  // #endif
  return null;
}

const searchQuestionId = ref('');
const searchError = ref('');
const questionData = ref(null);
const loading = ref(false);
const error = ref('');

const updateURL = (questionId) => {
  if (typeof window !== 'undefined' && window.history) {
    const currentUrl = new URL(window.location.href);
    const newUrl = new URL(window.location.href);
    
    if (questionId) {
      newUrl.searchParams.set('question_id', questionId);
    } else {
      newUrl.searchParams.delete('question_id');
    }
    
    if (currentUrl.searchParams.get('question_id') !== questionId) {
      window.history.pushState(
        { questionId },
        `题目 ${questionId || '搜索'}`,
        newUrl.toString()
      );
    }
  }
};

const handleSearch = async () => {
  const qid = searchQuestionId.value.trim();
  searchError.value = '';
  
  if (!qid) {
    searchError.value = '请输入题目ID。';
    return;
  }
  
  if (!/^\d+$/.test(qid)) {
    searchError.value = '题目ID必须是纯数字。';
    return;
  }
  
  loading.value = true;
  error.value = '';
  
  try {
    const response = await request({
      url: `/math/single-question-data?global_question_id=${qid}`,
      method: 'GET'
    });
    if (response.data[qid]) {
      questionData.value = response.data[qid];
      updateURL(qid);
      await nextTick();
      setTimeout(() => {
        renderKatex();
      }, 100);
    } else {
      error.value = `题目数据 (ID: ${qid}) 返回格式无效或未找到。`;
      questionData.value = null;
    }
  } catch (err) {
    console.error('Error fetching question:', err);
    error.value = `加载题目 ${qid} 失败: ${err.message}`;
    questionData.value = null;
  } finally {
    loading.value = false;
  }
};

const renderKatex = () => {
  if (typeof renderMathInElement !== 'undefined') {
    const questionDisplayArea = document.getElementById('questionDisplayArea');
    if (questionDisplayArea) {
      try {
        renderMathInElement(questionDisplayArea, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
          ],
          throwOnError: false
        });
      } catch (error) {
        console.error('KaTeX rendering error:', error);
      }
    }
  }
};

onMounted(() => {
  const qidFromUrl = getQueryParam('question_id');
  
  if (qidFromUrl && /^\d+$/.test(qidFromUrl)) {
    searchQuestionId.value = qidFromUrl;
    handleSearch();
  }
  
  // #ifdef H5
  window.addEventListener('popstate', (event) => {
    const state = event.state;
    const qidFromUrl = getQueryParam('question_id');
    
    if (state && state.questionId) {
      if (searchQuestionId.value !== state.questionId) {
        searchQuestionId.value = state.questionId;
      }
      handleSearch();
    } else if (qidFromUrl && /^\d+$/.test(qidFromUrl)) {
      if (searchQuestionId.value !== qidFromUrl) {
        searchQuestionId.value = qidFromUrl;
      }
      handleSearch();
    } else {
      searchQuestionId.value = '';
      questionData.value = null;
    }
  });
  // #endif
});

const questionIdentifier = computed(() => {
  if (!questionData.value || !questionData.value.first_request || !questionData.value.first_request[0]) {
    return `ID: ${searchQuestionId.value}`;
  }
  const fr = questionData.value.first_request[0];
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
  if (!questionData.value || !questionData.value.first_request || !questionData.value.first_request[0]) {
    return '';
  }
  const fr = questionData.value.first_request[0];
  return fr.QuestionTxt ? transformContextString(fr.QuestionTxt) : '';
});

const hasSecondRequest = computed(() => {
  return questionData.value && questionData.value.second_request && questionData.value.second_request.length > 0;
});

const sortedSecondRequest = computed(() => {
  if (!questionData.value || !questionData.value.second_request) {
    return [];
  }
  const busTypeOrder = ["题目详解", "一题多解", "答案", "解析", "思路分析", "步骤", "注释", "分析", "点评"];
  return [...questionData.value.second_request].sort((a, b) => {
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
  if (!questionData.value || !questionData.value.second_request) {
    return [];
  }
  const KAO_DIAN_BUS_TYPE = "考点";
  const YI_NAN_DIAN_BUS_TYPE = "疑难点";
  const groupedKnowledgePoints = {};
  
  questionData.value.second_request.forEach(item => {
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

const hasKnowledgePoints = computed(() => {
  return knowledgePoints.value.length > 0;
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

body {
  font-family: 'Nunito', 'SimSun', 'Times New Roman', Times, serif, sans-serif;
  margin: 0;
  padding: 0;
  background-color: var(--bg-color);
  color: var(--text-color);
  line-height: 1.7;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
}

.app-container {
  width: 100%;
  max-width: 850px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
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
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1.3em;
  color: var(--primary-darker);
  text-align: center;
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
  font-weight: 700;
}

.bus-type-label {
  font-weight: 700;
  color: var(--secondary-color);
  margin-right: 8px;
  font-size: 1em;
  text-transform: uppercase;
  display: block;
  margin-bottom: 8px;
}

.detail-title {
  font-weight: 700;
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
  font-weight: 700;
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
  font-size: .9em;
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
  font-size: 20px;
  margin-bottom: 1px;
}

.bottom-nav-placeholder {
  height: 60px;
}
</style>