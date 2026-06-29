<template>
  <view class="container" :class="{ 'dark-mode': isDarkMode }">
    <!-- 分类标签 -->
    <view class="category-wrapper">
      <scroll-view class="category-scroll" scroll-x :show-scrollbar="false" :enhanced="true">
        <view class="category-list">
          <view
            v-for="cat in categories"
            :key="cat"
            class="category-item"
            :class="{ active: currentFilter === cat }"
            @click="selectCategory(cat)"
          >
            {{ cat }}
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 收藏列表区域 -->
    <scroll-view
      scroll-y
      class="collection-scroll-view"
      @scrolltolower="loadMore"
      :show-scrollbar="false"
      :enhanced="true"
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <!-- 空状态 -->
      <view v-if="!loading && filteredCollections.length === 0" class="empty-state">
        <view class="empty-icon">
          <text class="icon-star">☆</text>
        </view>
        <text class="empty-title">暂无收藏</text>
        <text class="empty-desc">看到好文章就收藏起来，建立自己的知识库</text>

      </view>

      <!-- 收藏列表 -->
      <view v-else class="collection-list">
        <view
          v-for="item in filteredCollections"
          :key="item.id"
          class="collection-card"
          @click="viewArticle(item)"
        >
          <view class="card-content">
            <view class="card-info">
              <view class="title-container">
                <text v-if="item.isTop" class="top-tag">置顶</text>
                <text v-if="item.noticeType === 'pan_resource'" class="type-tag pan">网盘</text>
                <text v-else-if="item.linkUrl" class="type-tag wechat">微信</text>
                <text class="item-title">{{ item.title }}</text>
              </view>
              <text v-if="item.description" class="item-desc">{{ item.description }}</text>
              <view class="card-meta">
                <text class="meta-category">{{ item.category || '精选' }}</text>
                <text class="meta-date">{{ formatDate(item.createTime) }}</text>
              </view>
            </view>
            <view class="card-right">
              <image
                v-if="item.imageUrl"
                :src="item.imageUrl"
                mode="aspectFill"
                class="card-cover"
              ></image>
              <!-- 操作按钮 -->
              <view class="card-actions-bar">
                <view class="action-btn delete" @click.stop="removeCollection(item)">
                  <text class="action-icon">×</text>
                  <text>删除</text>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 加载状态 -->
        <view class="loading-status" v-if="loading">
          <text>加载中...</text>
        </view>
        <view class="no-more" v-if="!loading && noMore && collections.length > 0">
          <text>没有更多了</text>
        </view>
      </view>

      

      <!-- 底部安全区 -->
      <view class="safe-area"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted, computed, getCurrentInstance } from 'vue';

const { proxy } = getCurrentInstance();

// 主题状态
const isDarkMode = ref(false);

// 数据状态
const collections = ref([]);
const loading = ref(false);
const refreshing = ref(false);
const noMore = ref(false);
const page = ref(1);
const pageSize = ref(10);

// 分类筛选
const currentFilter = ref('全部');
const categories = ref(['全部']);

// 从API获取分类列表
const fetchCategories = async () => {
  try {
    const res = await proxy.$api.publicApi.getPanCategories();
    if (res && res.data) {
      const categoryNames = res.data.map(c => c.CategoryName || c);
      categories.value = ['全部', ...categoryNames];
    }
  } catch (error) {
    console.error('获取分类失败:', error);
  }
};

// 计算属性：筛选后的列表
const filteredCollections = computed(() => {
  if (currentFilter.value === '全部') return collections.value;
  return collections.value.filter(item => item.category === currentFilter.value);
});

// 选择分类
const selectCategory = (cat) => {
  currentFilter.value = cat;
};

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes + '分钟前';
    }
    return hours + '小时前';
  } else if (days === 1) {
    return '昨天';
  } else if (days < 7) {
    return days + '天前';
  } else {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
};

// 加载数据
const loadCollections = async (isRefresh = false) => {
  if (loading.value) return;

  if (isRefresh) {
    page.value = 1;
    noMore.value = false;
  }

  loading.value = true;

  try {
    const storedCollections = uni.getStorageSync('collectedArticles') || [];

    const start = (page.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    const pageData = storedCollections.slice(start, end);

    if (isRefresh) {
      collections.value = pageData;
    } else {
      collections.value = [...collections.value, ...pageData];
    }

    if (pageData.length < pageSize.value || collections.value.length >= storedCollections.length) {
      noMore.value = true;
    }
  } catch (error) {
    console.error('加载失败:', error);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
};

const onRefresh = () => {
  refreshing.value = true;
  loadCollections(true);
};

const loadMore = () => {
  if (!noMore.value && !loading.value) {
    page.value++;
    loadCollections();
  }
};

// 查看文章
const viewArticle = (item) => {
  uni.navigateTo({
    url: `/pages/article/article-detail?id=${item.id}`
  });
};

// 分享文章
const shareArticle = (item) => {
  uni.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  });
};

// 删除收藏
const removeCollection = (item) => {
  uni.showModal({
    title: '取消收藏',
    content: '确定要删除这篇文章吗？',
    confirmColor: '#dc2626',
    success: (res) => {
      if (res.confirm) {
        const collectedArticles = uni.getStorageSync('collectedArticles') || [];
        const newCollections = collectedArticles.filter(article => article.id !== item.id);
        uni.setStorageSync('collectedArticles', newCollections);
        collections.value = collections.value.filter(article => article.id !== item.id);
        uni.showToast({ title: '已删除', icon: 'success' });
      }
    }
  });
};

// 导航到文章列表
const goToArticleList = () => {
  uni.switchTab({ url: '/pages/index/index' });
};

// 生命周期
onMounted(() => {
  const currentTheme = uni.getStorageSync('themeMode') || 'light';
  isDarkMode.value = currentTheme === 'dark';
  uni.$on('themeChange', (darkMode) => { isDarkMode.value = darkMode; });
  fetchCategories();
  loadCollections(true);
});
</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
}

/* 分类标签 - 和 exam 页面完全一致 */
.category-wrapper {
  background-color: #ffffff;
  border-bottom: 1rpx solid #f0f0f0;
}

.category-list {
  display: flex;
  padding: 0 24rpx;
  height: 76rpx;
  align-items: center;
}

.category-item {
  margin-right: 32rpx;
  font-size: 28rpx;
  color: #666666;
  height: 76rpx;
  line-height: 76rpx;
  position: relative;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.category-item:last-child {
  margin-right: 0;
}

.category-item.active {
  color: #000000;
  font-weight: 600;
  font-size: 30rpx;
}

.category-item.active::after {
  content: '';
  position: absolute;
  bottom: 12rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 40rpx;
  height: 4rpx;
  background-color: #07c160;
  border-radius: 2rpx;
}

/* 收藏列表区域 - 和 exam 页面一致 */
.collection-scroll-view {
  flex: 1;
  height: 0;
  background-color: #ffffff;
}

.dark-mode .collection-scroll-view {
  background-color: #000;
}

/* 收藏卡片 - 和 exam 页面完全一致 */
.collection-card {
  padding: 24rpx;
  background-color: #ffffff;
  border-bottom: 1rpx solid #f0f0f0;
}

.collection-card:last-child {
  border-bottom: none;
}

.collection-card:active {
  background-color: #f9f9f9;
}

.dark-mode .collection-card {
  background-color: #000;
  border-bottom-color: #1a1a1a;
}

.dark-mode .collection-card:active {
  background-color: #111;
}

.card-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20rpx;
  position: relative;
}

.card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 12rpx;
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}

.title-container {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12rpx;
}

.top-tag {
  font-size: 18rpx;
  color: #fff;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
  margin-right: 10rpx;
  margin-top: 6rpx;
  flex-shrink: 0;
  font-weight: bold;
}

.type-tag {
  font-size: 18rpx;
  color: #fff;
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
  margin-right: 10rpx;
  margin-top: 6rpx;
  flex-shrink: 0;
}

.type-tag.pan {
  background-color: #07c160;
}

.type-tag.wechat {
  background-color: #07c160;
}

.item-title {
  font-size: 30rpx;
  line-height: 1.5;
  color: #1a1a1a;
  font-weight: 500;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.dark-mode .item-title {
  color: #e6e6e6;
}

.item-desc {
  font-size: 26rpx;
  color: #666;
  line-height: 1.5;
  margin-bottom: 12rpx;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dark-mode .item-desc {
  color: #888;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 16rpx;
  font-size: 22rpx;
  color: #b3b3b3;
  height: 30rpx;
  overflow: hidden;
}

.dark-mode .card-meta {
  color: #666;
}

.meta-category {
  color: #576b95;
  font-weight: 500;
}

.card-cover {
  width: 120rpx;
  height: 120rpx;
  border-radius: 6rpx;
  background-color: #f0f0f0;
  flex-shrink: 0;
  object-fit: cover;
}

.dark-mode .card-cover {
  background-color: #222;
}

/* 操作按钮栏 - 放在右侧 */
.card-actions-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  font-size: 24rpx;
  color: #999;
}

.action-btn.delete {
  color: #ff6b6b;
}

.dark-mode .action-btn {
  color: #666;
}

.action-icon {
  font-size: 24rpx;
}

/* 空状态 - 和 exam 页面一致 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 200rpx;
}

.empty-icon {
  width: 120rpx;
  height: 120rpx;
  margin-bottom: 30rpx;
}

.icon-star {
  font-size: 80rpx;
  color: #999;
}

.dark-mode .icon-star {
  color: #666;
}

.empty-title {
  font-size: 32rpx;
  color: #999;
  margin-bottom: 16rpx;
}

.dark-mode .empty-title {
  color: #666;
}

.empty-desc {
  font-size: 26rpx;
  color: #b3b3b3;
  margin-bottom: 40rpx;
  text-align: center;
  padding: 0 60rpx;
}

.dark-mode .empty-desc {
  color: #666;
}

/* 加载状态 - 和 exam 页面一致 */
.loading-status, .no-more {
  text-align: center;
  padding: 32rpx 0;
  font-size: 24rpx;
  color: #999;
}

.dark-mode .loading-status, .dark-mode .no-more {
  color: #666;
}

.safe-area {
  height: 40rpx;
}

/* 深色模式 */
.dark-mode {
  background-color: #000;
}

.dark-mode .category-wrapper {
  background-color: #111;
  border-bottom-color: #222;
}

.dark-mode .category-item {
  color: #888;
}

.dark-mode .category-item.active {
  color: #fff;
}
</style>
