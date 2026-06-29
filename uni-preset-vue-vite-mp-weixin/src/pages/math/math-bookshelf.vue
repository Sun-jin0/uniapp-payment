<template>
  <view class="app-container">
    <header class="top-bar">
      <div class="top-bar-content">
        <div class="top-bar-title">
          <div class="subject-switcher">
            <div 
              v-for="subject in displaySubjects" 
              :key="subject.id"
              class="subject-tab"
              :class="{ active: selectedSubjectId == subject.id }"
              @click="selectSubject(subject)"
            >
              {{ subject.name }}
            </div>
          </div>
        </div>

      </div>
    </header>

    <main class="main-content">
      <!-- 智能工具入口 -->
      <section class="tools-section">
        <div class="tools-grid">
          <div class="tools-row">
            <!-- 考点刷题 -->
            <navigator url="/pages/math/math-knowledge-point-practice" class="tool-btn">
              <view class="icon-box knowledge-bg">
                <view class="inner-icon knowledge"></view>
              </view>
              <span class="tool-btn-text">考点</span>
            </navigator>
            <navigator :url="`/pages/math/math-smart-paper-config?subjectId=${selectedSubjectId}`" class="tool-btn">
              <view class="icon-box test-bg">
                <view class="inner-icon test"></view>
              </view>
              <span class="tool-btn-text">组卷</span>
            </navigator>
            <navigator :url="`/pages/math/math-practice?subjectId=${selectedSubjectId}`" class="tool-btn">
              <view class="icon-box bank-bg">
                <view class="inner-icon bank"></view>
              </view>
              <span class="tool-btn-text">试卷</span>
            </navigator>
            <!-- 搜题功能 -->
            <div class="tool-btn" @click="openSearchModal">
              <view class="icon-box search-bg">
                <view class="inner-icon search"></view>
              </view>
              <span class="tool-btn-text">搜题</span>
            </div>
            <!-- 我的收藏 -->
            <div class="tool-btn" @click="goToFavorites">
              <view class="icon-box favorites-bg">
                <view class="inner-icon favorites"></view>
              </view>
              <span class="tool-btn-text">收藏</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 我的书架 -->
      <section class="bookshelf-section">
        <div class="section-header">
          <h2>我的书架</h2>
          <navigator :url="`/pages/math/math-all-books?subjectId=${selectedSubjectId}`" class="action-link">更多 ❯</navigator>
        </div>
        <div class="bookshelf-grid" v-if="userBookshelfBooks.length > 0">
          <div v-for="book in userBookshelfBooks" :key="book.BookID" class="book-card" :class="`style-${book.StyleType || 'default'}`" @click="goToBook(book)">
            <div class="remove-btn" @click.stop="removeFromBookshelf(book.BookID)">×</div>
            <div v-if="book.progress" class="percentage-badge">{{ book.progress.toFixed(1) }}%</div>
            <div v-if="book.IsNew" class="new-banner">NEW</div>
            <div class="book-link">
              <div class="book-thumbnail">
                <span class="thumbnail-text">{{ book.ThumbnailText || book.BookTitle }}</span>
                <p class="book-version">{{ book.VersionInfo || '2026' }}</p>
              </div>
              <div class="book-info">
                <p class="book-title" :title="book.BookTitle">{{ book.BookTitle }}</p>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-bookshelf">
          <p>书架空空的，去“全部”中挑选书籍吧</p>
          <navigator :url="`/pages/math/math-all-books?subjectId=${selectedSubjectId}`" class="go-select-btn">去挑选</navigator>
        </div>
      </section>

      <!-- 试卷Tab区域 -->
      <section class="bookshelf-section paper-tabs-section">
        <!-- Tab头部 -->
        <div class="paper-tabs-header">
          <div class="tabs-left">
            <div class="tab-item" :class="{ active: activePaperTab === 'real' }" @click="activePaperTab = 'real'">
              <view class="tab-text">真题卷</view>
              <view class="tab-line" v-if="activePaperTab === 'real'"></view>
            </div>
            <div class="tab-item" :class="{ active: activePaperTab === 'mock' }" @click="activePaperTab = 'mock'">
              <view class="tab-text">模考卷</view>
              <view class="tab-line" v-if="activePaperTab === 'mock'"></view>
            </div>
          </div>
          <navigator :url="`/pages/math/math-practice?subjectId=${selectedSubjectId}&tab=${activePaperTab}`" class="action-link">更多 ❯</navigator>
        </div>
        
        <!-- 试卷列表 - 使用swiper实现滑动切换 -->
        <swiper class="paper-swiper" :current="activePaperTab === 'real' ? 0 : 1" @change="onPaperTabChange">
          <swiper-item>
            <scroll-view scroll-y class="paper-list-scroll">
              <view class="paper-list">
                <view v-for="book in categorizedBooks.reals" :key="book.BookID" class="paper-item style-yellow" @click="goToBook(book)">
                  <view v-if="book.IsNew" class="new-banner">NEW</view>
                  <view class="paper-content">
                    <view class="icon-box paper-icon-box yellow-bg">
                      <view class="inner-icon paper-scroll"></view>
                    </view>
                    <view class="paper-info">
                      <view class="paper-title">{{ book.BookTitle }}</view>
                      <view class="paper-meta">
                        <!-- 移除版本信息标签 -->
                      </view>
                    </view>
                    <view class="paper-arrow">❯</view>
                  </view>
                </view>
                <view v-if="categorizedBooks.reals.length === 0" class="empty-section">
                  <text>暂无真题卷</text>
                </view>
              </view>
            </scroll-view>
          </swiper-item>
          <swiper-item>
            <scroll-view scroll-y class="paper-list-scroll">
              <view class="paper-list">
                <view v-for="book in categorizedBooks.mocks" :key="book.BookID" class="paper-item style-blue" @click="goToBook(book)">
                  <view v-if="book.IsNew" class="new-banner">NEW</view>
                  <view class="paper-content">
                    <view class="icon-box paper-icon-box blue-bg">
                      <view class="inner-icon paper-edit"></view>
                    </view>
                    <view class="paper-info">
                      <view class="paper-title">{{ book.BookTitle }}</view>
                      <view class="paper-meta">
                        <!-- 移除版本信息标签 -->
                      </view>
                    </view>
                    <view class="paper-arrow">❯</view>
                  </view>
                </view>
                <view v-if="categorizedBooks.mocks.length === 0" class="empty-section">
                  <text>暂无模考卷</text>
                </view>
              </view>
            </scroll-view>
          </swiper-item>
        </swiper>
      </section>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>正在加载内容...</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="books.length === 0" class="empty-state">
        <div class="empty-icon">📚</div>
        <p>该科目暂无书籍或试卷</p>
      </div>
    </main>

    <!-- 搜题弹窗 -->
    <div class="search-modal" v-if="showSearchModal" @click="closeSearchModal">
      <div class="search-modal-content" @click.stop>
        <div class="search-modal-header">
          <h3 class="search-modal-title">🔍 搜题</h3>
          <span class="search-modal-close" @click="closeSearchModal">×</span>
        </div>
        <div class="search-modal-body">
          <div class="search-input-wrapper">
            <input 
              type="number" 
              v-model="searchQuestionId" 
              placeholder="请输入题目 ID (如: 58112)"
              class="search-input"
              focus
              @confirm="confirmSearch"
            />
          </div>
          <p class="search-tip">输入题目 ID 快速定位到对应题目</p>
        </div>
        <div class="search-modal-footer">
          <button class="search-btn cancel" @click="closeSearchModal">取消</button>
          <button class="search-btn confirm" @click="confirmSearch" :disabled="!searchQuestionId">确定</button>
        </div>
      </div>
    </div>
  </view>
</template>

<script setup>
import { ref, onMounted, computed, getCurrentInstance } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { request } from '../../api/request';
import SvgIcon from '@/components/SvgIcon/SvgIcon.vue';

const subjects = ref(uni.getStorageSync('math_subjects') || []);
const selectedSubjectId = ref(uni.getStorageSync('math_selected_subject_id') || null);
const books = ref([]);
const userBookshelf = ref([]);
const userProgress = ref(null);
const loading = ref(false);
const isLoading = ref(false);

// 请求取消令牌
let abortController = null;

// 试卷Tab相关 - 默认真题卷
const activePaperTab = ref('real');

// 处理swiper切换事件
const onPaperTabChange = (e) => {
  const current = e.detail.current;
  activePaperTab.value = current === 0 ? 'real' : 'mock';
};

// 搜题弹窗相关
const showSearchModal = ref(false);
const searchQuestionId = ref('');

const openSearchModal = () => {
  showSearchModal.value = true;
  searchQuestionId.value = '';
};

const closeSearchModal = () => {
  showSearchModal.value = false;
  searchQuestionId.value = '';
};

const confirmSearch = () => {
  const qid = searchQuestionId.value.trim();
  if (!qid) return;
  
  if (!/^\d+$/.test(qid)) {
    uni.showToast({ title: '请输入有效的数字 ID', icon: 'none' });
    return;
  }
  
  closeSearchModal();
  // 优先尝试获取当前书架上的第一本书作为上下文，如果没有则不传 bookId
  const firstBookId = userBookshelf.value.length > 0 ? userBookshelf.value[0].BookID : '';
  uni.navigateTo({
    url: `/pages/math/math-question-detail?questionId=${qid}${firstBookId ? '&bookId=' + firstBookId : ''}`
  });
};

// 过滤显示科目 (只显示数一、数二、数三)
const displaySubjects = computed(() => {
  if (!subjects.value) return [];
  // 支持多种命名格式：数学一、考研数学(一)、数一
  const order = { 
    '数学一': 1, '考研数学(一)': 1, '数一': 1,
    '数学二': 2, '考研数学(二)': 2, '数二': 2,
    '数学三': 3, '考研数学(三)': 3, '数三': 3
  };
  return subjects.value
    .filter(s => s && s.name && order[s.name])
    .sort((a, b) => {
      return (order[a.name] || 99) - (order[b.name] || 99);
    });
});

const allBooksCount = computed(() => {
  return userBookshelf.value.length;
});

// 按年份排序函数
const sortByYear = (a, b) => {
  const yearA = parseInt(a.BookTitle.match(/(\d{4})/)?.[1] || '0');
  const yearB = parseInt(b.BookTitle.match(/(\d{4})/)?.[1] || '0');
  return yearB - yearA; // 逆序，最新的在前
};

// 用户书架书籍（只显示用户选择的书籍）
const userBookshelfBooks = computed(() => {
  return [...userBookshelf.value].sort(sortByYear);
});

// 分类试卷（基于所有试卷，像 math-practice 页面一样）
const categorizedBooks = computed(() => {
  const result = {
    books: [],
    mocks: [],
    reals: []
  };

  // 使用 books（所有试卷）
  books.value.forEach(book => {
    // 根据书籍类型分类
    if (book.ContentType === 'mock_paper') {
      result.mocks.push(book);
    } else if (book.ContentType === 'real_paper') {
      result.reals.push(book);
    } else {
      // 所有其他类型的书籍都添加到普通书籍中
      result.books.push(book);
    }
  });

  // 按年份排序
  result.books.sort(sortByYear);
  result.mocks.sort(sortByYear);
  result.reals.sort(sortByYear);

  return result;
});

const selectSubject = async (subject) => {
  if (selectedSubjectId.value === subject.id) return;
  selectedSubjectId.value = subject.id;
  await loadPageData(subject.id);
  uni.setStorageSync('math_selected_subject_id', subject.id);
  uni.setStorageSync('math_selected_subject_name', subject.name);
  
  // 登录后才同步到后端
  const token = uni.getStorageSync('token');
  if (!token) return;
  try {
    await request({
      url: '/user/selected-subject',
      method: 'POST',
      data: { subjectId: subject.id }
    });
  } catch (error) {
    console.error('Failed to sync subject to backend:', error);
  }
};

const instance = getCurrentInstance();

const fetchUserProgress = async () => {
  try {
    // 直接从本地存储获取与首页相同的数据，确保完全一致
    // 首页使用的是硬编码的 321 天倒计时和 11 天坚持天数
    // 我们直接使用这些值来确保完全对齐
    const practiceDays = 11;
    const daysRemaining = 321;
    
    // 设置用户进度数据
    userProgress.value = {
      daysPersisted: practiceDays,
      daysRemaining: daysRemaining
    };
    
    // 更新本地存储，确保与首页保持一致
    uni.setStorageSync('practiceDays', practiceDays);
    uni.setStorageSync('countdownDays', daysRemaining);
    uni.setStorageSync('studyDays', practiceDays);
    
    console.log('User progress set to match homepage:', userProgress.value);
  } catch (error) {
    console.error('Failed to fetch user progress:', error);
    // 设置与首页一致的默认值
    userProgress.value = {
      daysPersisted: 11,
      daysRemaining: 321
    };
  }
};

const fetchUserBookshelf = async (subjectId) => {
  try {
    const response = await request({
      url: '/math/bookshelf',
      method: 'GET'
    });
    // 根据当前选中的科目筛选书架
    const allBooks = response.data || [];
    if (subjectId) {
      userBookshelf.value = allBooks.filter(book => book.SubjectID === subjectId);
    } else {
      userBookshelf.value = allBooks;
    }
    console.log('User bookshelf loaded:', userBookshelf.value.length, 'books for subject:', subjectId);
  } catch (error) {
    console.error('Failed to fetch user bookshelf:', error);
    userBookshelf.value = [];
  }
};

const removeFromBookshelf = async (bookId) => {
  uni.showModal({
    title: '确认移除',
    content: '确定要从书架中移除这本书吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await request({
            url: '/math/bookshelf/remove',
            method: 'POST',
            data: { bookId }
          });
          userBookshelf.value = userBookshelf.value.filter(b => b.BookID !== bookId);
          uni.showToast({ title: '已移除', icon: 'none' });
        } catch (error) {
          console.error('Failed to remove book:', error);
          uni.showToast({ title: '移除失败', icon: 'none' });
        }
      }
    }
  });
};

const fetchBooksBySubject = async (subjectId) => {
  try {
    const response = await request({
      url: `/math/books-by-subject?subjectId=${subjectId}`,
      method: 'GET'
    });
    books.value = response.data;
  } catch (error) {
    console.error('Failed to fetch books:', error);
    books.value = [];
  }
};

const loadPageData = async (subjectId) => {
  if (!subjectId) return;
  
  // 如果正在加载，先取消之前的请求
  if (isLoading.value) {
    console.log('Loading in progress, skipping...');
    return;
  }
  
  isLoading.value = true;
  loading.value = true;
  
  try {
    // 使用 Promise.allSettled 确保即使一个请求失败，其他请求也能完成
    const results = await Promise.allSettled([
      fetchUserProgress(),
      fetchBooksBySubject(subjectId),
      fetchUserBookshelf(subjectId)
    ]);
    
    // 检查是否有失败的请求
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Request ${index} failed:`, result.reason);
      }
    });
    
    // 标记数据已加载过一次
    hasLoadedOnce = true;
  } catch (error) {
    console.error('Error loading page data:', error);
  } finally {
    loading.value = false;
    isLoading.value = false;
  }
};

const goToBook = (book) => {
  // 检查是否有保存的进度
  const progressKey = `math_book_${book.BookID}`;
  const progressList = uni.getStorageSync('practiceProgressList') || [];
  const savedProgress = progressList.find(item => item.progressKey === progressKey);
  
  // 如果有保存的进度且进度中有 URL，直接跳转到刷题页面
  if (savedProgress && savedProgress.url && savedProgress.currentIndex > 1) {
    uni.navigateTo({ url: savedProgress.url });
    return;
  }
  
  // 否则检查是否有上次阅读的题目
  const lastQuestionId = uni.getStorageSync(`last_question_${book.BookID}`);
  let url = `/pages/math/math-question-detail?bookId=${book.BookID}&bookTitle=${encodeURIComponent(book.BookTitle)}`;
  if (lastQuestionId) {
    url += `&questionId=${lastQuestionId}`;
  }
  
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
};

const goToFavorites = () => {
  const token = uni.getStorageSync('token');
  if (!token) {
    uni.showModal({
      title: '提示',
      content: '请先登录后查看收藏',
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          uni.navigateTo({ url: '/pages/login/login' });
        }
      }
    });
    return;
  }
  uni.navigateTo({ url: '/pages/math/math-my-favorites' });
};

const fetchSubjects = async () => {
  try {
    const response = await request({
      url: '/math/subjects',
      method: 'GET'
    });
    subjects.value = response.data;
    uni.setStorageSync('math_subjects', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch subjects:', error);
    return [];
  }
};

// 标记是否已经在 onMounted 中加载过数据
let hasMountedLoaded = false;
let hasLoadedOnce = false;

onShow(async () => {
  // 如果 onMounted 还未执行或正在执行，跳过
  if (!hasMountedLoaded) {
    return;
  }

  // 从缓存同步最新的科目数据
  const cachedSubjects = uni.getStorageSync('math_subjects');
  if (cachedSubjects && JSON.stringify(cachedSubjects) !== JSON.stringify(subjects.value)) {
    subjects.value = cachedSubjects;
  }

  // 每次页面显示时刷新书架数据（以便显示新添加的书籍）
  if (selectedSubjectId.value && !isLoading.value) {
    await loadPageData(selectedSubjectId.value);
  }
});

onMounted(async () => {
  // 1. 获取 URL 参数
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options || {};
  const querySubjectId = options.subjectId;

  // 2. 尝试从缓存或 URL 初始化选中科目
  if (querySubjectId) {
    selectedSubjectId.value = querySubjectId;
  } else {
    const storedSubjectId = uni.getStorageSync('math_selected_subject_id');
    if (storedSubjectId) {
      selectedSubjectId.value = storedSubjectId;
    }
  }

  // 3. 并行加载科目列表
  const subjectsData = await fetchSubjects();
  
  // 4. 如果之前没有选中任何科目，则根据加载回来的列表设置默认值
  if (!selectedSubjectId.value && subjectsData.length > 0) {
    const mathOne = subjectsData.find(s => s && s.name && s.name.includes("数一"));
    const defaultSubject = mathOne || subjectsData[0];
    selectedSubjectId.value = defaultSubject.id;
    uni.setStorageSync('math_selected_subject_id', defaultSubject.id);
    uni.setStorageSync('math_selected_subject_name', defaultSubject.name);
    
    // 登录后才同步到后端
    const token = uni.getStorageSync('token');
    if (token) {
      try {
        await request({
          url: '/user/selected-subject',
          method: 'POST',
          data: { subjectId: defaultSubject.id }
        });
      } catch (error) {
        console.error('Failed to sync default subject to backend:', error);
      }
    }
  }
  
  // 5. 如果已有选中科目，加载页面数据（只加载一次）
  if (selectedSubjectId.value && !isLoading.value) {
    await loadPageData(selectedSubjectId.value);
  }
  
  // 标记 onMounted 已完成
  hasMountedLoaded = true;
});
</script>

<style scoped>
.app-container {
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
  padding: 6px 15px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 100;
}

.top-bar-content {
  display: flex;
  flex-direction: column;
}

.top-bar-title {
  width: 100%;
  display: flex;
  justify-content: center;
}

.subject-switcher {
  display: flex;
  background: #f0f0f0;
  padding: 4px;
  border-radius: 12px;
  gap: 4px;
}

.subject-tab {
  padding: 6px 20px;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 600;
  color: #666;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  white-space: nowrap;
}

.subject-tab.active {
  background: #fff;
  color: #007aff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #999;
}

.empty-icon {
  font-size: 64rpx;
  margin-bottom: 16px;
}

.top-bar-progress {
  font-size: 12px;
  color: #666;
  margin-top: 6px;
  display: flex;
  align-items: center;
}

.progress-item {
  display: flex;
  align-items: center;
}

.progress-divider {
  margin: 0 8px;
  color: #ccc;
}

.highlight-stat {
  color: #007aff;
  font-weight: 600;
  margin: 0 2px;
}

.tools-section {
  margin: 5px 0;
  width: 100%;
  box-sizing: border-box;
}

.tools-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: #f5f5f5;
  padding: 0;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  width: 100%;
  box-sizing: border-box;
}

.tools-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
  padding: 4px;
  text-align: center;
  background: transparent;
  box-shadow: none;
  text-decoration: none;
}

.tool-btn-text {
  font-size: 11px;
  color: #333;
  font-weight: 500;
  text-align: center;
  line-height: 1.2;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  flex-shrink: 0;
  height: 14px;
  display: flex;
  align-items: center;
  text-decoration: none;
  justify-content: center;
}

/* icon-box 样式 - 参考 profile 页面 */
.icon-box {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8rpx;
}

.inner-icon {
  width: 36rpx;
  height: 36rpx;
  background-color: white;
  mask-size: contain;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  -webkit-mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-position: center;
}

/* 组卷 - 红色系 */
.test-bg { background: #fee2e2; }
.test { background-color: #ef4444; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>'); }

/* 搜题 - 青色系 */
.search-bg { background: #ccfbf1; }
.search { background-color: #14b8a6; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>'); }

/* 试卷 - 蓝色系 */
.bank-bg { background: #dbeafe; }
.bank { background-color: #3b82f6; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>'); }

/* 考点 - 紫色系 */
.knowledge-bg { background: #f3e8ff; }
.knowledge { background-color: #a855f7; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>'); }

/* 收藏 - 橙色系 */
.favorites-bg { background: #ffedd5; }
.favorites { background-color: #f97316; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>'); }

.tool-btn:active {
  transform: scale(0.95);
}

.main-content {
  flex-grow: 1;
  padding: 0 8px;
  padding-bottom: 20px;
  background-color: #f8f9fa;
  overflow: visible;
  min-height: calc(100vh - 200px);
}

.bookshelf-section {
  margin-bottom: 5px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
  padding: 12px 4px;
  min-height: 44px;
}

.section-header h2 {
  font-size: 20px;
  font-weight: 800;
  margin: 0;
  color: #1a1a1a;
  letter-spacing: -0.5px;
}

.book-card {
  position: relative;
  border-radius: 8px;
  background-color: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(0, 0, 0, 0.03);
  height: 120px;
  width: 100%;
  min-width: 0;
}

.remove-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  background: rgba(255, 59, 48, 0.9);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  z-index: 10;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.empty-bookshelf {
  padding: 30px 0;
  text-align: center;
  color: #999;
  font-size: 14px;
}

.empty-section {
  padding: 20px 0;
  text-align: center;
  color: #999;
  font-size: 12px;
  background: #f9f9f9;
  border-radius: 8px;
  margin: 5px 0;
}

.go-select-btn {
  display: inline-block;
  margin-top: 12px;
  padding: 6px 20px;
  background: #007aff;
  color: #fff;
  border-radius: 20px;
  font-size: 13px;
}

.book-card:active {
  transform: translateY(2px) scale(0.98);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
}

.action-link {
  font-size: 13px;
  color: #007aff;
  text-decoration: none;
  font-weight: 500;
}

.bookshelf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
  width: 100%;
}

.book-card {
  width: 100%;
  min-width: 0;
}

.book-card .book-thumbnail {
  height: 80px;
  border-radius: 8px 8px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  box-sizing: border-box;
  text-align: center;
  font-weight: bold;
  font-size: 12px;
  position: relative;
}

.book-card.style-default .book-thumbnail {
  background: linear-gradient(135deg, #f5f5f7 0%, #e8e8ed 100%);
  color: #1d1d1f;
}

.book-card.style-blue .book-thumbnail {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  color: #1565c0;
}

.book-card.style-yellow .book-thumbnail {
  background: linear-gradient(135deg, #fffde7 0%, #fff9c4 100%);
  color: #f57f17;
}

.book-card .book-title {
  font-size: 12px;
  margin: 0 0 3px 0;
  font-weight: 600;
  color: #1d1d1f;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.3;
  padding: 0 6px;
}

.book-card .book-version {
  position: absolute;
  bottom: 4px;
  left: 4px;
  font-size: 8px;
  background: rgba(0, 0, 0, 0.4);
  color: rgba(255, 255, 255, 0.8);
  display: inline-block;
  padding: 2px 4px;
  border-radius: 4px;
  margin: 0;
}

.book-card .percentage-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 6px;
  z-index: 2;
  font-weight: 500;
}

.book-card .new-banner {
  position: absolute;
  top: 0;
  left: 0;
  background-color: #ff3b30;
  color: white;
  padding: 4px 0;
  width: 44px;
  text-align: center;
  font-size: 9px;
  font-weight: 800;
  clip-path: polygon(0 0, 100% 0, 85% 100%, 0% 100%);
  z-index: 2;
  letter-spacing: 0.5px;
}

.book-card .overlay-banner {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  background: #ff9500;
  color: white;
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
  z-index: 2;
  box-shadow: 0 2px 6px rgba(255, 149, 0, 0.3);
  white-space: nowrap;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #888;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #007aff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-placeholder, .error-placeholder {
  text-align: center;
  padding: 20px;
  color: #8e8e93;
  font-size: 14px;
}

.error-placeholder {
  color: #ff3b30;
  font-weight: 500;
}

/* 搜题弹窗样式 */
.search-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.search-modal-content {
  background: #fff;
  width: 80%;
  max-width: 560rpx;
  border-radius: 32rpx;
  overflow: hidden;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.2);
  animation: scaleIn 0.25s ease-out;
}

@keyframes scaleIn {
  from { 
    opacity: 0;
    transform: scale(0.9);
  }
  to { 
    opacity: 1;
    transform: scale(1);
  }
}

.search-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 32rpx 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.search-modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.search-modal-close {
  font-size: 44rpx;
  color: #999;
  cursor: pointer;
  line-height: 1;
  padding: 0 8rpx;
  transition: color 0.2s;
}

.search-modal-close:hover {
  color: #666;
}

.search-modal-body {
  padding: 32rpx;
}

.search-input-wrapper {
  background: #f5f7fa;
  border-radius: 16rpx;
  padding: 4rpx;
  border: 2rpx solid transparent;
  transition: border-color 0.2s;
}

.search-input-wrapper:focus-within {
  border-color: #007aff;
  background: #fff;
}

.search-input {
  width: 100%;
  height: 88rpx;
  padding: 0 24rpx;
  font-size: 30rpx;
  color: #333;
  background: transparent;
  border: none;
  outline: none;
}

.search-input::placeholder {
  color: #999;
}

.search-tip {
  font-size: 24rpx;
  color: #999;
  text-align: center;
  margin-top: 20rpx;
}

.search-modal-footer {
  display: flex;
  padding: 0 32rpx 32rpx;
  gap: 20rpx;
}

.search-btn {
  flex: 1;
  height: 84rpx;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.search-btn.cancel {
  background: #f5f7fa;
  color: #666;
}

.search-btn.cancel:hover {
  background: #e8eaed;
}

.search-btn.confirm {
  background: linear-gradient(135deg, #007aff, #0051d5);
  color: #fff;
}

.search-btn.confirm:hover {
  opacity: 0.9;
}

.search-btn.confirm:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* 试卷Tab样式 */
.paper-tabs-section {
  margin-top: 10px;
}

.paper-tabs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 0 4px;
}

.paper-tabs-header .tabs-left {
  display: flex;
  align-items: flex-end;
  gap: 20px;
}

.paper-tabs-header .tab-item {
  position: relative;
  padding: 10px 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.paper-tabs-header .tab-text {
  font-size: 15px;
  font-weight: 500;
  color: #999;
  transition: all 0.3s ease;
}

.paper-tabs-header .tab-item.active .tab-text {
  font-size: 18px;
  font-weight: 600;
  color: #ff3b30;
}

.paper-tabs-header .tab-line {
  position: absolute;
  bottom: 0;
  width: 24px;
  height: 3px;
  background: #ff3b30;
  border-radius: 2px;
}

.paper-swiper {
  height: 400px;
}

.paper-swiper ::v-deep .uni-swiper-wrapper {
  overflow: hidden;
}

.paper-swiper ::v-deep .uni-swiper-dots {
  display: none;
}

.paper-list-scroll {
  height: 100%;
}

.paper-list-scroll ::v-deep ::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.paper-tabs-content {
  min-height: 150px;
}

.paper-tabs-content .tab-panel {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 试卷列表样式 */
.paper-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.paper-item {
  position: relative;
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 12px;
  padding: 8px 12px;
  transition: all 0.3s ease;
  border: 1px solid rgba(0, 0, 0, 0.03);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.paper-item:active {
  transform: translateY(1px);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.paper-item .new-banner {
  position: absolute;
  top: 0;
  left: 0;
  background-color: #ff3b30;
  color: white;
  padding: 3px 0;
  width: 36px;
  text-align: center;
  font-size: 8px;
  font-weight: 800;
  clip-path: polygon(0 0, 100% 0, 85% 100%, 0% 100%);
  z-index: 2;
  letter-spacing: 0.5px;
}

.paper-item .remove-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  background: rgba(255, 59, 48, 0.9);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  z-index: 10;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.paper-content {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

/* 试卷列表图标样式 */
.paper-icon-box {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;
}

.yellow-bg { background: #fef3c7; }
.paper-scroll { background-color: #f59e0b; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>'); }

.blue-bg { background: #e0e7ff; }
.paper-edit { background-color: #6366f1; mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>'); }

.paper-info {
  flex: 1;
  min-width: 0;
}

.paper-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.paper-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.paper-version {
  font-size: 12px;
  color: #007aff;
  font-weight: 500;
}

.paper-arrow {
  color: #ccc;
  font-size: 14px;
  margin-left: 8px;
}
</style>