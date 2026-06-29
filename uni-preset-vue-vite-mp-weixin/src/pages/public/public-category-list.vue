<template>
  <view class="container" :style="{ paddingTop: statusBarHeight + 'px' }">
    <!-- 顶部导航 -->
    <view class="nav-header">
      <view class="back-icon" @tap="goBack">
        <text class="iconfont icon-back">←</text>
      </view>
      <view class="nav-title">研兔刷题</view>
      <view class="placeholder"></view>
    </view>

    <!-- 搜索栏 -->
    <view class="search-section">
      <view class="search-bar">
        <text class="search-icon">🔍</text>
        <input class="search-input" placeholder="请输入搜索关键词" v-model="keyword" />
        <text class="search-btn">搜索</text>
      </view>
    </view>

    <!-- 面包屑/当前分类 -->
    <view class="breadcrumb">
      <text class="parent-name">{{ parentName }}</text>
      <text class="separator">></text>
      <text class="current-name">{{ title }}</text>
    </view>

    <!-- 三级类目列表 -->
    <scroll-view class="category-list" scroll-y>
      <view v-if="loading" class="loading-state">
        <text>加载中...</text>
      </view>
      <view v-else-if="categories.length > 0" class="list-container">
        <view 
          v-for="cat in filteredCategories" 
          :key="cat.id" 
          class="category-item"
          @tap="goToBookList(cat)"
        >
          <text class="cat-name">{{ cat.name }}</text>
          <text class="arrow">></text>
        </view>
      </view>
      <view v-else class="empty-state">
        <text>暂无分类内容</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import publicApi from '@/api/public';

const statusBarHeight = ref(0);
const parentId = ref(null);
const title = ref('');
const subject = ref('');
const parentName = ref('');
const keyword = ref('');
const categories = ref([]);
const loading = ref(true);

const filteredCategories = computed(() => {
  if (!keyword.value) return categories.value;
  return categories.value.filter(c => c.name.includes(keyword.value));
});

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight;

  const pages = getCurrentPages();
  const options = pages[pages.length - 1].options;
  parentId.value = options.parentId;
  title.value = options.title || '分类列表';
  subject.value = options.subject;
  parentName.value = options.parentName || '全部';

  fetchCategories();
});

const fetchCategories = async () => {
  loading.value = true;
  try {
    const res = await publicApi.getPublicCategories({
      parentId: parentId.value,
      level: 3,
      subject: subject.value
    });
    if (res.code === 0) {
      categories.value = res.data;
    }
  } catch (error) {
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const goToBookList = (cat) => {
  uni.navigateTo({
    url: `/pages/public/public-book-list?categoryId=${cat.id}&title=${encodeURIComponent(cat.name)}&subject=${subject.value}`
  });
};

const goBack = () => {
  uni.navigateBack();
};
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background-color: #fff;
  display: flex;
  flex-direction: column;
}

.nav-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 30rpx;
  background-color: #4db6ac;
  color: #fff;
  .nav-title {
    font-size: 34rpx;
    font-weight: 500;
  }
  .back-icon {
    font-size: 40rpx;
  }
  .placeholder {
    width: 40rpx;
  }
}

.search-section {
  padding: 20rpx 30rpx;
  background-color: #f5f5f5;
  .search-bar {
    display: flex;
    align-items: center;
    background-color: #fff;
    border-radius: 40rpx;
    padding: 10rpx 30rpx;
    height: 72rpx;
    .search-icon {
      margin-right: 10rpx;
      font-size: 28rpx;
      color: #999;
    }
    .search-input {
      flex: 1;
      font-size: 28rpx;
    }
    .search-btn {
      color: #333;
      font-size: 28rpx;
      padding-left: 20rpx;
      border-left: 1rpx solid #eee;
    }
  }
}

.breadcrumb {
  padding: 30rpx;
  display: flex;
  align-items: center;
  font-size: 32rpx;
  .parent-name {
    color: #333;
  }
  .separator {
    margin: 0 16rpx;
    color: #999;
  }
  .current-name {
    color: #4db6ac;
    font-weight: bold;
  }
}

.category-list {
  flex: 1;
  padding: 0 30rpx;
  .list-container {
    padding-bottom: 40rpx;
  }
  .category-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: #f8f9fa;
    padding: 30rpx 40rpx;
    border-radius: 12rpx;
    margin-bottom: 24rpx;
    box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.02);
    .cat-name {
      font-size: 32rpx;
      color: #333;
    }
    .arrow {
      color: #999;
      font-size: 28rpx;
    }
    &:active {
      background-color: #eee;
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
