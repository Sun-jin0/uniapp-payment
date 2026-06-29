<template>
  <view class="container" :style="{ paddingTop: statusBarHeight + 'px' }">
    <!-- 顶部导航 -->
    <view class="nav-header">
      <view class="back-icon" @tap="goBack">
        <SvgIcon name="left" size="44" fill="#333" />
      </view>
      <view class="nav-title">题库</view>
      <view class="placeholder"></view>
    </view>

    <view class="main-body">
      <!-- 左侧边栏 -->
      <scroll-view class="sidebar" scroll-y>
        <view 
          v-for="cat in categories" 
          :key="cat.id" 
          class="sidebar-item" 
          :class="{ active: activeCategoryId === cat.id }"
          @tap="selectCategory(cat)"
        >
          <text>{{ cat.name }}</text>
          <view v-if="activeCategoryId === cat.id" class="active-bar"></view>
        </view>
      </scroll-view>

      <!-- 右侧内容区 -->
      <view class="content-area">
        <view class="content-header">
          <text class="subject-name">{{ currentCategoryName }}</text>
          <text class="item-count">{{ books.length }}个项目</text>
        </view>

        <scroll-view class="book-list" scroll-y>
          <view v-if="loading" class="loading-state">
            <text>加载中...</text>
          </view>
          <view v-else-if="books.length > 0" class="list-container">
            <!-- 分组显示 -->
            <template v-if="hasGroups">
              <view v-for="(groupBooks, groupName) in groupedBooks" :key="groupName" class="book-group">
                <view class="group-header" v-if="groupName && groupName !== currentCategoryName">
                  <text class="group-title">{{ groupName }}</text>
                </view>
                <view 
                  v-for="book in groupBooks" 
                  :key="book.id" 
                  class="book-item"
                  @tap="goToPractice(book)"
                >
                  <SvgIcon name="book-tag" size="32" fill="#00796b" class="book-tag-icon" />
                  <view class="book-info">
                      <rich-text class="book-name" :nodes="formatTitle(book.title)"></rich-text>
                    </view>
                  <view class="book-count" v-if="book.questionCount">
                    <text class="count-num">{{ book.questionCount }}</text>
                    <text class="count-unit">题</text>
                  </view>
                  <SvgIcon name="right" size="28" fill="#eee" />
                </view>
              </view>
            </template>
            
            <!-- 不分组显示 -->
            <template v-else>
              <view 
                v-for="book in books" 
                :key="book.id" 
                class="book-item"
                @tap="goToPractice(book)"
              >
                <SvgIcon name="book-tag" size="32" fill="#00796b" class="book-tag-icon" />
                <view class="book-info">
                  <rich-text class="book-name" :nodes="formatTitle(book.title)"></rich-text>
                </view>
                <view class="book-count" v-if="book.questionCount">
                  <text class="count-num">{{ book.questionCount }}</text>
                  <text class="count-unit">题</text>
                </view>
                <SvgIcon name="right" size="28" fill="#eee" />
              </view>
            </template>
          </view>
          <view v-else class="empty-state">
            <text>暂无书籍内容</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import publicApi from '@/api/public';
import SvgIcon from '@/components/SvgIcon/SvgIcon.vue';

const statusBarHeight = ref(0);
const categoryId = ref(null);
const title = ref('');
const subject = ref('');
const books = ref([]);
const loading = ref(true);

const currentCategoryName = computed(() => {
  const cat = categories.value.find(c => c.id === activeCategoryId.value);
  return cat ? cat.name : '';
});

// 判断是否有三级分类分组
const hasGroups = computed(() => {
  return books.value.some(book => book.third_category_name);
});

// 按三级分类分组书籍
const groupedBooks = computed(() => {
  if (!hasGroups.value) return {};
  
  const groups = {};
  books.value.forEach(book => {
    const groupName = book.third_category_name || '';
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(book);
  });
  return groups;
});

const subjects = ref([]);
const categories = ref([]);
const activeCategoryId = ref(null);

const parentCategoryId = ref(null);

onMounted(async () => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight;

  const pages = getCurrentPages();
  const options = pages[pages.length - 1].options;
  
  subject.value = options.subject || 'politics';
  parentCategoryId.value = options.categoryId ? parseInt(options.categoryId) : null;
  const urlTitle = options.title ? decodeURIComponent(options.title) : '';
  
  // 1. 获取当前二级分类下的所有三级分类用于侧边栏
  await fetchSidebarCategories();
  
  // 2. 确定初始选中的三级分类 ID
  let targetId = null;
  
  // 如果 URL 中有匹配的分类名称，优先选中
  if (urlTitle && categories.value.length > 0) {
    const matchedCat = categories.value.find(c => c.name.includes(urlTitle) || urlTitle.includes(c.name));
    if (matchedCat) {
      targetId = matchedCat.id;
    }
  }
  
  // 否则默认选中第一个三级分类
  if (!targetId && categories.value.length > 0) {
    targetId = categories.value[0].id;
  }
  
  // 3. 设置选中并获取书籍
  if (targetId) {
    activeCategoryId.value = targetId;
    await fetchBooksByCategory(targetId);
  } else {
    loading.value = false;
  }
});

const fetchSidebarCategories = async () => {
  try {
    const res = await publicApi.getPublicCategories({
      subject: subject.value,
      parentId: parentCategoryId.value, // 传入二级分类 ID 作为父 ID
      level: 3 // 获取三级分类
    });
    if (res.code === 0) {
      categories.value = res.data;
    }
  } catch (error) {
    console.error('Fetch categories failed:', error);
  }
};

const selectCategory = (cat) => {
  if (activeCategoryId.value === cat.id) return;
  activeCategoryId.value = cat.id;
  fetchBooksByCategory(cat.id);
};

const fetchBooksByCategory = async (catId) => {
  loading.value = true;
  try {
    const res = await publicApi.getPublicBooks({
      categoryId: catId,
      level: 3, // 获取三级分类下的书籍
      subject: subject.value
    });
    if (res.code === 0) {
      books.value = res.data;
    }
  } catch (error) {
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const formatTitle = (title) => {
  if (!title) return '';
  
  // 预处理：解码 HTML 实体
  let processed = title
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, '\u00A0');
    
  // 响应用户最新要求：原模原样渲染，不再剥离 style
  
  // 检查是否包含 HTML 标签，如果没有，则直接返回
  if (!/<[a-z/][\s\S]*>/i.test(processed)) {
    return processed;
  }
  
  return `<div style="text-align: justify; word-break: break-all; color: #333;">${processed}</div>`;
};

const goToPractice = (book) => {
  // 保存为最近练习
  uni.setStorageSync('lastPracticeSubject', {
    id: book.id,
    title: book.title,
    url: `/pages/public/public-book-detail?bookId=${book.id}&title=${encodeURIComponent(book.title)}`,
    icon: 'books'
  });

  uni.navigateTo({
    url: `/pages/public/public-book-detail?bookId=${book.id}&title=${encodeURIComponent(book.title)}`
  });
};

const goBack = () => {
  uni.navigateBack();
};
</script>

<style lang="scss" scoped>
.container {
  height: 100vh;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nav-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 20rpx;
  background-color: #fff;
  color: #333;
  border-bottom: 1rpx solid #f2f2f2;
  .nav-title {
    font-size: 34rpx;
    font-weight: 600;
  }
  .back-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60rpx;
    height: 60rpx;
    &:active {
      opacity: 0.6;
    }
  }
  .placeholder {
    width: 60rpx;
  }
}

.main-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 180rpx;
  background-color: #f8f8f8;
  height: 100%;
  flex-shrink: 0;
  .sidebar-item {
    position: relative;
    padding: 28rpx 16rpx;
    font-size: 26rpx;
    color: #666;
    text-align: center;
    transition: all 0.3s;
    line-height: 1.3;
    
    &.active {
      background-color: #fff;
      color: #00796b;
      font-weight: bold;
    }
    
    .active-bar {
      position: absolute;
      left: 0;
      top: 25%;
      height: 50%;
      width: 6rpx;
      background-color: #00796b;
      border-radius: 0 4rpx 4rpx 0;
    }
  }
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #fff;
  padding: 10rpx 16rpx;
  overflow: hidden;
  
  .content-header {
    margin-bottom: 12rpx;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding: 8rpx 4rpx;
    flex-shrink: 0;
    
    .subject-name {
      font-size: 30rpx;
      font-weight: bold;
      color: #333;
    }
    
    .item-count {
      font-size: 22rpx;
      color: #999;
    }
  }
}

.book-list {
  flex: 1;
  height: 0; // 关键：确保 flex 容器内的 scroll-view 能正常工作
  .list-container {
    padding-bottom: 20rpx;
  }

  .book-group {
    margin-bottom: 8rpx;
    
    .group-header {
      padding: 8rpx 4rpx;
      
      .group-title {
        font-size: 24rpx;
        color: #bbb;
        font-weight: 500;
      }
    }
  }

  .book-item {
    display: flex;
    align-items: center;
    padding: 16rpx 16rpx;
    background-color: #fff;
    border-radius: 8rpx;
    margin-bottom: 8rpx;
    box-shadow: 0 2rpx 6rpx rgba(0,0,0,0.02);
    border: 1rpx solid #f0f0f0;
    transition: all 0.2s;
    .book-tag-icon {
      margin-right: 12rpx;
      flex-shrink: 0;
      opacity: 0.8;
    }
    .book-info {
      flex: 1;
      .book-name {
        font-size: 26rpx;
        color: #333;
        line-height: 1.3;
        font-weight: 500;
      }
    }
    .book-count {
      margin-right: 12rpx;
      display: flex;
      align-items: baseline;
      background-color: #f0f7f6;
      padding: 4rpx 12rpx;
      border-radius: 20rpx;
      .count-num {
        font-size: 24rpx;
        color: #00796b;
        font-weight: bold;
      }
      .count-unit {
        font-size: 20rpx;
        color: #00796b;
        margin-left: 2rpx;
        opacity: 0.8;
      }
    }
    &:active {
      background-color: #f5faff;
      transform: scale(0.99);
    }
  }
}

.loading-state, .empty-state {
  padding: 100rpx 0;
  text-align: center;
  color: #999;
  font-size: 28rpx;
}
</style>
