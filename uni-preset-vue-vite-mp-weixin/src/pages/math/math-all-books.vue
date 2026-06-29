<template>
  <view class="app-container">
    <main class="main-content" :class="{ 'has-bottom-bar': selectionMode && selectedBookIds.length > 0 }">
      <section class="bookshelf-section">
        <div class="section-header">
          <span class="count-badge">{{ filteredBooks.length }} 本书籍</span>
          <div class="header-actions">
            <div class="sort-options">
              <div 
                class="sort-item" 
                :class="{ active: sortBy === 'learner' }"
                @click="sortBy = 'learner'"
              >
                人气
              </div>
              <div 
                class="sort-item" 
                :class="{ active: sortBy === 'version' }"
                @click="sortBy = 'version'"
              >
                版本
              </div>
              <div 
                class="sort-item" 
                :class="{ active: sortBy === 'new' }"
                @click="sortBy = 'new'"
              >
                最新
              </div>
            </div>
            <view 
              class="add-bookshelf-btn" 
              :class="{ active: selectionMode }"
              @click="toggleSelectionMode"
            >
              {{ selectionMode ? '取消' : '加入书架' }}
            </view>
          </div>
        </div>
        <div class="bookshelf-grid" v-if="filteredBooks.length > 0">
          <div v-for="book in filteredBooks" 
               :key="book.BookID" 
               class="book-card" 
               :class="[`style-${book.StyleType || 'default'}`, { 'selected': isSelected(book.BookID), 'in-bookshelf': isInBookshelf(book.BookID), 'is-new-style': book.IsNew }]"
               @click="handleBookClick(book)">
            <div v-if="book.progress" class="percentage-badge">{{ book.progress.toFixed(1) }}%</div>
            <!-- 使用新的 CSS 样式 -->
            <div v-if="book.IsNew" class="new-banner">NEW</div>
            
            <!-- 多选框 -->
            <div v-if="selectionMode" class="selection-overlay">
              <div class="checkbox" :class="{ 'checked': isSelected(book.BookID), 'disabled': isInBookshelf(book.BookID) }">
                <span v-if="isSelected(book.BookID) || isInBookshelf(book.BookID)">✓</span>
              </div>
            </div>

            <div class="book-content">
              <div class="book-thumbnail" :style="{ '--book-color': getBookColor(book) }">
                <svg class="book-icon" viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
                  <!-- 书脊 -->
                  <rect x="10" y="10" width="8" height="120" rx="2" fill="var(--book-color)" stroke="rgba(0,0,0,0.1)" stroke-width="1"/>
                  <!-- 封面 -->
                  <rect x="18" y="10" width="72" height="120" rx="2" fill="var(--book-color)" stroke="rgba(0,0,0,0.1)" stroke-width="1"/>
                  <!-- 封面高光 -->
                  <rect x="20" y="12" width="68" height="116" rx="1" fill="rgba(255,255,255,0.2)" opacity="0.7"/>
                  <!-- 书名 -->
                  <text x="50" y="40" font-size="10" text-anchor="middle" fill="white" font-weight="600">{{ book.BookTitle.substring(0, 8) }}</text>
                  <text x="50" y="55" font-size="9" text-anchor="middle" fill="rgba(255,255,255,0.8)">{{ book.BookTitle.length > 8 ? book.BookTitle.substring(8, 16) : '' }}</text>
                  <!-- 版本信息 -->
                  <text x="50" y="110" font-size="8" text-anchor="middle" fill="rgba(255,255,255,0.6)">{{ book.VersionInfo || '2026' }}</text>
                </svg>
              </div>
              <div class="book-info">
                <p class="book-title" :title="book.BookTitle">{{ book.BookTitle }}</p>
                <div class="book-meta">
                  <span class="book-version">{{ book.VersionInfo || '2026' }}</span>
                  <span v-if="isInBookshelf(book.BookID)" class="in-bookshelf-tag">已在书架</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <div class="empty-icon">📚</div>
          <p>暂无书籍</p>
        </div>
      </section>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>正在加载内容...</p>
      </div>
    </main>

    <!-- 底部操作栏 -->
    <div v-if="selectionMode && selectedBookIds.length > 0" class="bottom-action-bar">
      <div class="selection-info">
        已选择 <span class="highlight">{{ selectedBookIds.length }}</span> 本书籍
      </div>
      <button class="add-to-bookshelf-btn" @click="confirmBatchAdd" :disabled="submitting">
        {{ submitting ? '正在添加...' : '加入书架' }}
      </button>
    </div>
  </view>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { request } from '../../api/request';

const subjects = ref([]);
const selectedSubjectId = ref(null);
const books = ref([]);
const userBookshelf = ref([]);
const loading = ref(false);
const submitting = ref(false);
const sortBy = ref('version'); // 'learner', 'version', 'new'

// 多选相关
const selectionMode = ref(false);
const selectedBookIds = ref([]);

// 搜索相关
const searchKeyword = ref('');
const filteredBooks = computed(() => {
  let result = [...books.value]
    .filter(book => book.ContentType === 'book' || !book.ContentType);
  
  // 搜索筛选
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.trim().toLowerCase();
    result = result.filter(book => {
      return book.BookTitle && book.BookTitle.toLowerCase().includes(keyword);
    });
  }
  
  // 排序
  result.sort((a, b) => {
    if (sortBy.value === 'learner') {
      return (b.LearnerCount || 0) - (a.LearnerCount || 0);
    } else if (sortBy.value === 'new') {
      if (a.IsNew !== b.IsNew) {
        return b.IsNew ? 1 : -1;
      }
      return (b.CreatedAt || '').localeCompare(a.CreatedAt || '');
    } else {
      // version
      return (b.VersionInfo || '').localeCompare(a.VersionInfo || '');
    }
  });
  
  return result;
});

const displaySubjects = computed(() => {
  if (!subjects.value) return [];
  return subjects.value
    .filter(s => s && s.name && s.name !== '公共数学')
    .sort((a, b) => {
      const order = { '考研数学(一)': 1, '考研数学(二)': 2, '考研数学(三)': 3 };
      return (order[a.name] || 99) - (order[b.name] || 99);
    });
});

const currentSubjectName = computed(() => {
  const subject = subjects.value.find(s => s.id == selectedSubjectId.value);
  return subject ? subject.name : '数学';
});

const isInBookshelf = (bookId) => {
  return userBookshelf.value.some(b => b.BookID === bookId);
};

const isSelected = (bookId) => {
  return selectedBookIds.value.includes(bookId);
};

// 为每本书生成不同的颜色
const getBookColor = (book) => {
  // 更浅的颜色数组
  const colors = [
    '#81C784', // 浅绿
    '#64B5F6', // 浅蓝
    '#FFB74D', // 浅橙
    '#BA68C8', // 浅紫
    '#E57373', // 浅红
    '#4DD0E1', // 浅青
    '#A1887F', // 浅棕
    '#90A4AE'  // 浅蓝灰
  ];
  
  // 根据书名或ID生成哈希值
  const text = book.BookTitle || book.BookID.toString();
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // 根据哈希值选择颜色
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const toggleSelectionMode = () => {
  selectionMode.value = !selectionMode.value;
  if (!selectionMode.value) {
    selectedBookIds.value = [];
  }
};

// 搜索相关方法
const handleSearch = () => {
  // 搜索逻辑已在computed中处理
};

const clearSearch = () => {
  searchKeyword.value = '';
};

const handleBookClick = (book) => {
  if (selectionMode.value) {
    if (isInBookshelf(book.BookID)) return;
    
    const index = selectedBookIds.value.indexOf(book.BookID);
    if (index > -1) {
      selectedBookIds.value.splice(index, 1);
    } else {
      selectedBookIds.value.push(book.BookID);
    }
  } else {
    // 检查是否有保存的进度
    const progressKey = `math_book_${book.BookID}`;
    const progressList = uni.getStorageSync('practiceProgressList') || [];
    const savedProgress = progressList.find(item => item.progressKey === progressKey);
    
    // 如果有保存的进度且进度中有 URL，直接跳转到刷题页面
    if (savedProgress && savedProgress.url && savedProgress.currentIndex > 1) {
      uni.navigateTo({ url: savedProgress.url });
      return;
    }
    
    const url = `/pages/math/math-question-detail?bookId=${book.BookID}&bookTitle=${encodeURIComponent(book.BookTitle)}`;
    
    // 保存为最近练习科目，以便在首页显示
    const practiceItem = {
      type: 'math',
      subject: '数学',
      id: book.BookID,
      title: book.BookTitle,
      bookTitle: book.BookTitle,
      bookId: book.BookID,
      url: url,
      icon: 'math',
      progressKey,
      timestamp: Date.now()
    };
    uni.setStorageSync('lastPracticeSubject', practiceItem);

    uni.navigateTo({ url });
  }
};

const confirmBatchAdd = async () => {
  if (selectedBookIds.value.length === 0) return;
  
  submitting.value = true;
  try {
    await request({
      url: '/math/bookshelf/batch-add',
      method: 'POST',
      data: { bookIds: selectedBookIds.value }
    });
    
    uni.showToast({ title: '已添加到书架', icon: 'success' });
    
    // 刷新书架状态
    await fetchUserBookshelf();
    
    // 退出选择模式
    selectionMode.value = false;
    selectedBookIds.value = [];
  } catch (error) {
    console.error('Failed to add books to bookshelf:', error);
    uni.showToast({ title: '添加失败', icon: 'none' });
  } finally {
    submitting.value = false;
  }
};

const fetchSubjects = async () => {
  try {
    const response = await request({
      url: '/math/subjects',
      method: 'GET'
    });
    subjects.value = response.data;
    return response.data;
  } catch (error) {
    console.error('Failed to fetch subjects:', error);
    return [];
  }
};

const fetchUserBookshelf = async () => {
  try {
    const response = await request({
      url: '/math/bookshelf',
      method: 'GET'
    });
    userBookshelf.value = response.data;
  } catch (error) {
    console.error('Failed to fetch user bookshelf:', error);
  }
};

const fetchBooksBySubject = async (subjectId) => {
  if (!subjectId) return;
  loading.value = true;
  try {
    const response = await request({
      url: `/math/books-by-subject?subjectId=${subjectId}&contentType=book`,
      method: 'GET'
    });
    books.value = response.data;
  } catch (error) {
    console.error('Failed to fetch bookshelf:', error);
    books.value = [];
  } finally {
    loading.value = false;
  }
};

onShow(async () => {
  // 避免与onMounted重复调用，只在页面从其他页面返回时调用
  const pages = getCurrentPages();
  if (pages.length === 1) return; // 如果是首次加载，onMounted已经调用过了
  await fetchUserBookshelf();
});

onMounted(async () => {
  const subjectsData = await fetchSubjects();
  await fetchUserBookshelf();
  
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options || {};
  
  if (subjectsData.length > 0) {
    let defaultSubjectId = options.subjectId;
    
    if (!defaultSubjectId) {
      defaultSubjectId = uni.getStorageSync('selectedSubjectId');
    }
    
    if (!defaultSubjectId) {
      const mathOne = subjectsData.find(s => s && s.name && s.name.includes("数一"));
      if (mathOne) defaultSubjectId = mathOne.id;
      else if (subjectsData[0]) defaultSubjectId = subjectsData[0].id;
    }
    
    selectedSubjectId.value = defaultSubjectId;
    if (defaultSubjectId) {
      await fetchBooksBySubject(defaultSubjectId);
    }
  }
});
</script>

<style scoped>
.app-container {
  max-width: 480px;
  margin: 0 auto;
  background-color: #fff;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.top-bar {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  padding: 10px 15px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 100;
}

/* 搜索栏样式 */
.search-bar {
  position: relative;
  margin-top: 10px;
  padding: 0 2px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  padding-right: 30px;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  font-size: 14px;
  background: #f8f9fa;
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-color);
  background: #fff;
  box-shadow: 0 0 0 2px rgba(77, 182, 172, 0.1);
}

.clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:active {
  background: #bdbdbd;
  transform: translateY(-50%) scale(0.9);
}

.top-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}

.page-title {
  flex: 1;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: #333;
}

.back-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.back-icon {
  font-size: 18px;
  color: #333;
}

.main-content {
  flex: 1;
  padding: 15px;
}

.bookshelf-section {
  margin-bottom: 25px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sort-options {
  display: flex;
  background: #f0f0f0;
  padding: 3px;
  border-radius: 8px;
  gap: 2px;
}

.sort-item {
  padding: 4px 12px;
  font-size: 13px;
  color: #666;
  border-radius: 6px;
  transition: all 0.2s;
  cursor: pointer;
}

.sort-item.active {
  background: #fff;
  color: #007aff;
  font-weight: 600;
}

.add-bookshelf-btn {
  padding: 6px 14px;
  font-size: 13px;
  color: #007aff;
  background: #fff;
  border: 1px solid #007aff;
  border-radius: 16px;
  transition: all 0.2s;
}

.add-bookshelf-btn.active {
  color: #fff;
  background: #007aff;
}

.book-card.is-new-style {
  border: 1px solid rgba(0, 122, 255, 0.2);
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.1);
}

.book-card.is-new-style::after {
  content: 'NEW';
  position: absolute;
  top: 0;
  right: 0;
  background: linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%);
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-bottom-left-radius: 8px;
  z-index: 10;
}

.section-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.count-badge {
  font-size: 12px;
  color: #999;
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 10px;
}

.bookshelf-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.action-btn {
  font-size: 14px;
  color: #007aff;
  font-weight: 500;
  padding: 5px 10px;
  cursor: pointer;
}

.main-content {
  flex: 1;
  padding: 3px 15px;
}

.book-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #fff;
  border-radius: 5px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  position: relative;
  transition: transform 0.2s, box-shadow 0.2s;
  min-height: 70px;
  height: 70px;
}

.book-card:active {
  transform: scale(0.99);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.book-card.in-bookshelf {
  opacity: 0.8;
}

.selection-overlay {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
}

.checkbox {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid #ddd;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: transparent;
  transition: all 0.2s;
}

.checkbox.checked {
  background: #007aff;
  border-color: #007aff;
  color: white;
}

.checkbox.disabled {
  background: #ccc;
  border-color: #ccc;
  color: white;
}

.book-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.book-thumbnail {
  width: 50px;
  height: 65px;
  background: #f8f9fa;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  flex-shrink: 0;
}

.book-icon {
  width: 100%;
  height: 100%;
}

.book-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.book-title {
  font-size: 12px;
  font-weight: 500;
  color: #333;
  line-height: 1.2;
}

.book-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.book-version {
  font-size: 10px;
  color: #999;
}

.in-bookshelf-tag {
  font-size: 8px;
  color: #007aff;
  background: rgba(0, 122, 255, 0.1);
  padding: 1px 4px;
  border-radius: 3px;
}

.bottom-action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 15px 20px 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 -5px 20px rgba(0, 0, 0, 0.05);
  z-index: 1000;
}

.selection-info {
  font-size: 14px;
  color: #666;
}

.highlight {
  color: #007aff;
  font-weight: 600;
  margin: 0 4px;
}

.add-to-bookshelf-btn {
  background: #007aff;
  color: white;
  border: none;
  padding: 10px 25px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
}

.add-to-bookshelf-btn:disabled {
  background: #ccc;
  box-shadow: none;
}

.percentage-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(0, 122, 255, 0.9);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 8px;
  z-index: 1;
}

.new-banner {
  position: absolute;
  top: 0;
  left: 0;
  background-color: #ff3b30;
  color: white;
  padding: 2px 0;
  width: 40px;
  text-align: center;
  font-size: 8px;
  font-weight: 800;
  clip-path: polygon(0 0, 100% 0, 85% 100%, 0% 100%);
  z-index: 2;
  letter-spacing: 0.5px;
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #999;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 16px;
}

/* 夜间模式样式 */
.app-container.night-mode {
  background-color: #121212;
  color: #e0e0e0;
}

.app-container.night-mode .top-bar {
  background: rgba(31, 31, 31, 0.85);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.app-container.night-mode .back-icon {
  color: #e0e0e0;
}

.app-container.night-mode .page-title {
  color: #e0e0e0;
}

.app-container.night-mode .action-btn {
  color: #64d8cb;
}

.app-container.night-mode .search-input {
  background: #2c2c2c;
  border-color: rgba(255, 255, 255, 0.2);
  color: #e0e0e0;
}

.app-container.night-mode .search-input:focus {
  border-color: #64d8cb;
  box-shadow: 0 0 0 2px rgba(100, 216, 203, 0.2);
}

.app-container.night-mode .clear-btn {
  background: #444;
  color: #aaa;
}

.app-container.night-mode .book-card {
  background: #1e1e1e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.app-container.night-mode .book-title {
  color: #e0e0e0;
}

.app-container.night-mode .book-version {
  color: #aaa;
}

.app-container.night-mode .in-bookshelf-tag {
  background: rgba(100, 216, 203, 0.1);
  color: #64d8cb;
}

.app-container.night-mode .sort-options {
  background: #2c2c2c;
}

.app-container.night-mode .sort-item {
  color: #aaa;
}

.app-container.night-mode .sort-item.active {
  background: #1e1e1e;
  color: #64d8cb;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.app-container.night-mode .count-badge {
  background: #2c2c2c;
  color: #aaa;
}

.app-container.night-mode .bottom-action-bar {
  background: rgba(31, 31, 31, 0.95);
  box-shadow: 0 -5px 20px rgba(0, 0, 0, 0.5);
}

.app-container.night-mode .selection-info {
  color: #aaa;
}

.app-container.night-mode .highlight {
  color: #64d8cb;
}

.app-container.night-mode .add-to-bookshelf-btn {
  background: #64d8cb;
  color: #121212;
  box-shadow: 0 4px 12px rgba(100, 216, 203, 0.3);
}

.app-container.night-mode .loading-state,
.app-container.night-mode .empty-state {
  color: #666;
}
</style>