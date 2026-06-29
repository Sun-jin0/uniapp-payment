<template>
  <view class="container">
    <h1 id="bookTitleHeader" class="book-title-header">{{ bookTitle }}</h1>

    <div v-if="loading" class="message info-message" style="display: block;">
      <div class="loading-spinner" style="display:inline-block; vertical-align:middle; margin-right:10px;"></div>
      加载题目信息中...
    </div>
    <div v-else-if="error" class="message error-message" style="display:block;">{{ error }}</div>
    <div v-else id="contentDisplayArea">
      <div v-if="bookData.questions && bookData.questions.length > 0">
        <div v-if="hasNamedChapters">
          <div v-for="chapter in chapters" :key="chapter.name" class="chapter-group">
            <div class="chapter-header" @click="toggleChapter(chapter.name)">
              <span>{{ chapter.name }}</span>
              <span class="arrow" :class="{ 'expanded': expandedChapters.includes(chapter.name) }">❯</span>
            </div>
            <div v-if="expandedChapters.includes(chapter.name)" class="chapter-questions-container">
              <div v-for="question in chapter.questions" :key="question.QuestionID" class="question-image-item">
                <view class="question-link" @click="navigateToQuestion(question.QuestionID)">
                  <img v-if="question.QuestionImg" :src="question.QuestionImg" :alt="`题目 ${question.QuestionID}`" @error="handleImageError($event)">
                  <div v-else class="no-image-link-text">
                    题目 {{ question.QuestionID }} (无图)<br>
                    <span class="question-image-metadata">页/排序: {{ question.QuestionPage || 'N/A' }}-{{ question.QuestionSort || 'N/A' }}</span>
                  </div>
                  <div v-if="question.QuestionImg" class="question-image-metadata">
                    {{ question.QuestionPage && question.QuestionSort ? `(${question.QuestionPage}-${question.QuestionSort})` : '' }} ID: {{ question.QuestionID }}
                  </div>
                </view>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="all-questions-text-container">
          <div v-for="question in questionsWithText" :key="question.QuestionID" class="question-text-item" @click="navigateToQuestion(question.QuestionID)">
            <h3>题目 ID: {{ question.QuestionID }}{{ question.QuestionSort ? ` (排序: ${question.QuestionSort})` : '' }}</h3>
            <div class="question-content" v-html="question.QuestionText || &quot;<span style='color:#7f8c8d; font-style:italic;'>(无题目内容)</span>&quot;"></div>
            <div class="metadata">页码: {{ question.QuestionPage || 'N/A' }}</div>
          </div>
        </div>
      </div>
      <div v-else class="message info-message">这本书当前没有题目信息。</div>
    </div>
    <navigator href="#" class="scroll-to-top" id="scrollToTopBtn" title="回到顶部" @click="scrollToTop">︿</navigator>
  </view>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue';
import { request } from '../../api/request';
import { transformContextString } from '../../utils/latex';

const bookId = ref(null);
const bookTitle = ref('加载中...');
const bookData = ref({});
const questionsWithText = ref([]);
const chapters = ref([]);
const expandedChapters = ref([]);
const loading = ref(true);
const error = ref('');

const hasNamedChapters = computed(() => {
  return bookData.value.questions && bookData.value.questions.some(q => q.BookChapter && q.BookChapter.trim() !== "");
});

const renderKatex = () => {
  if (typeof renderMathInElement !== 'undefined') {
    const contentDisplayArea = document.getElementById('contentDisplayArea');
    if (contentDisplayArea) {
      try {
        renderMathInElement(contentDisplayArea, {
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

const fetchBookSummary = async () => {
  loading.value = true;
  error.value = '';
  try {
    // 增加学习人数
    request({
      url: `/math/books/${bookId.value}/increment-learner`,
      method: 'POST'
    }).catch(err => console.error('Failed to increment learner count:', err));

    const response = await request({
      url: `/math/books/${bookId.value}`,
      method: 'GET'
    });
    bookData.value = response.data;
    bookTitle.value = response.data.BookTitle || `书籍 ID: ${response.data.BookID}`;
    if (response.data.questions && response.data.questions.length > 0) {
      if (hasNamedChapters.value) {
        organizeChapters(response.data.questions);
      } else {
        await fetchQuestionsWithText();
      }
    }
  } catch (err) {
    console.error('Error fetching book summary:', err);
    error.value = `加载书籍详情失败: ${err.message}`;
    bookTitle.value = `错误加载书籍 ID: ${bookId.value}`;
  } finally {
    loading.value = false;
  }
};

const fetchQuestionsWithText = async () => {
  try {
    const response = await request({
      url: `/math/books/${bookId.value}/preview`,
      method: 'GET'
    });
    questionsWithText.value = response.data.questions || [];
    await nextTick();
    renderKatex();
  } catch (err) {
    console.error('Error fetching questions with text:', err);
    error.value = `加载题目内容失败: ${err.message}`;
  }
};

const organizeChapters = (questions) => {
  const chapterMap = {};
  questions.forEach(q => {
    const chapterName = (q.BookChapter && q.BookChapter.trim() !== "") ? q.BookChapter.trim() : "未分类章节";
    const chapterSort = q.ChapterSort ? parseInt(q.ChapterSort, 10) : Infinity;
    if (!chapterMap[chapterName]) {
      chapterMap[chapterName] = {
        name: chapterName,
        sortKey: isNaN(chapterSort) ? Infinity : chapterSort,
        questions: []
      };
    }
    chapterMap[chapterName].questions.push(q);
  });
  const sortedChapters = Object.values(chapterMap).sort((a, b) => a.sortKey - b.sortKey);
  chapters.value = sortedChapters;
  if (sortedChapters.length > 0) {
    expandedChapters.value = [sortedChapters[0].name];
  }
};

const toggleChapter = (chapterName) => {
  const index = expandedChapters.value.indexOf(chapterName);
  if (index > -1) {
    expandedChapters.value.splice(index, 1);
  } else {
    expandedChapters.value = [chapterName];
  }
};

const handleImageError = (event) => {
  event.target.alt = '图片加载失败';
  event.target.style.display = 'none';
  const parent = event.target.parentElement;
  const errorPlaceholder = document.createElement('div');
  errorPlaceholder.className = 'no-image-link-text';
  errorPlaceholder.innerHTML = `图 ${parent.dataset.sourceId || ''} 加载失败<br><span class="question-image-metadata">图片加载失败</span>`;
  parent.appendChild(errorPlaceholder);
};

const navigateToQuestion = (sourceId) => {
  // 检查是否有保存的进度
  const progressKey = `math_book_${bookId.value}`;
  const progressList = uni.getStorageSync('practiceProgressList') || [];
  const savedProgress = progressList.find(item => item.progressKey === progressKey);
  
  // 如果有保存的进度且进度中有 URL，直接跳转到刷题页面
  if (savedProgress && savedProgress.url && savedProgress.currentIndex > 1) {
    uni.navigateTo({ url: savedProgress.url });
    return;
  }
  
  const url = `/pages/math/math-question-detail?questionId=${sourceId}&bookId=${bookId.value}&bookTitle=${encodeURIComponent(bookTitle.value)}`;
  
  // 保存为最近练习科目，以便在首页显示
  const practiceItem = {
    type: 'math',
    subject: '数学',
    id: bookId.value,
    title: bookTitle.value,
    bookTitle: bookTitle.value,
    bookId: bookId.value,
    url: url,
    icon: 'math',
    progressKey,
    timestamp: Date.now()
  };
  uni.setStorageSync('lastPracticeSubject', practiceItem);

  uni.navigateTo({ url });
};

const scrollToTop = () => {
  uni.pageScrollTo({
    scrollTop: 0,
    duration: 300
  });
};

onMounted(() => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options;
  bookId.value = options.bookId;
  if (options.bookTitle) {
    bookTitle.value = decodeURIComponent(options.bookTitle);
  }
  fetchBookSummary();
});
</script>

<style scoped>
.container {
  max-width: 480px;
  margin: 0 auto;
  background-color: #f8f9fa;
  min-height: 100vh;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.back-link-container {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  padding: 10px 16px;
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
}

.back-link {
  color: #333;
  font-size: 14px;
  font-weight: 600;
  padding: 6px 12px;
  background: #f0f2f5;
  border-radius: 10px;
  text-decoration: none;
  transition: all 0.2s;
}

.back-link:active {
  background: #e4e7ed;
  transform: scale(0.95);
}

.book-title-header {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 20px 16px;
  line-height: 1.4;
}

#contentDisplayArea {
  padding: 0 16px 40px;
}

.chapter-group {
  margin-bottom: 12px;
  border-radius: 12px;
  overflow: hidden;
  background-color: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.chapter-header {
  padding: 16px;
  background-color: #ffffff;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s;
}

.chapter-header:active {
  background-color: #f8f9fa;
}

.chapter-header span {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
}

.chapter-header .arrow {
  font-size: 12px;
  color: #ccc;
  transition: transform 0.3s;
}

.chapter-header .arrow.expanded {
  transform: rotate(90deg);
  color: #007aff;
}

.chapter-questions-container {
  padding: 12px;
  border-top: 1px solid #f0f2f5;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.question-image-item {
  margin: 0;
}

.question-link {
  display: block;
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 8px;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
}

.question-link:active {
  transform: scale(0.96);
  background-color: #f0f2f5;
}

.question-image-item img {
  width: 100%;
  height: auto;
  border-radius: 4px;
  margin-bottom: 6px;
}

.question-image-metadata {
  font-size: 11px;
  color: #888;
  text-align: center;
}

.no-image-link-text {
  font-size: 12px;
  color: #666;
  text-align: center;
  padding: 10px 4px;
}

.all-questions-text-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.question-text-item {
  padding: 16px;
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.question-text-item h3 {
  font-size: 14px;
  color: #007aff;
  margin: 0 0 10px 0;
  font-weight: 600;
}

.question-content {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
}

.metadata {
  font-size: 11px;
  color: #999;
  margin-top: 10px;
  text-align: right;
}

.message {
  padding: 40px 20px;
  text-align: center;
  color: #888;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #007aff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.scroll-to-top {
  position: fixed;
  bottom: 30px;
  right: 20px;
  background-color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: #007aff;
  width: 44px;
  height: 44px;
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  text-decoration: none;
  z-index: 999;
  font-size: 20px;
}
</style>