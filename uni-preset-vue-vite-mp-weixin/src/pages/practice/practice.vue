<template>
  <view class="container" :class="{ 'dark-mode': isDarkMode }" :style="{ paddingTop: (statusBarHeight + 44) + 'px' }">
    <!-- 自定义导航栏 -->
    <view class="custom-nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-title">题库</view>
      </view>
    </view>

    <!-- 侧边栏布局 -->
    <view class="sidebar-layout">
      <!-- 左侧分类列表 -->
      <scroll-view scroll-y class="sidebar" :show-scrollbar="false" :enhanced="true">
        <view 
          v-for="cat in categories" 
          :key="cat.id" 
          class="sidebar-item" 
          :class="{ active: activeCategoryId === cat.id }"
          @click="selectCategory(cat)"
        >
          <view class="active-line" v-if="activeCategoryId === cat.id"></view>
          <text class="sidebar-text">{{ cat.name }}</text>
        </view>
      </scroll-view>

      <!-- 右侧内容区域 -->
      <scroll-view scroll-y class="content" :show-scrollbar="false" :enhanced="true">
        <view class="content-padding">
          <view v-if="isLoading" class="loading-state">
            <text class="loading-text">加载中...</text>
          </view>
          
          <block v-else>
            <view class="section-header" v-if="categories.length > 0">
              <text class="section-title">{{ currentCategoryName }}</text>
              <text class="section-count">{{ activeItems.length }}个项目</text>
            </view>
            
            <view 
              v-for="item in activeItems" 
              :key="item.id" 
              class="item-card"
              @click="navigateToDetail(item)"
            >
              <view class="item-info">
                <text class="item-name">{{ item.name }}</text>
              </view>
              <view class="item-arrow"></view>
            </view>
            
            <!-- 空状态 -->
            <view v-if="!isLoading && activeItems.length === 0" class="empty-state">
              <text class="empty-text">暂无相关科目</text>
            </view>
          </block>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, getCurrentInstance } from 'vue';

const isDarkMode = ref(false);
const statusBarHeight = ref(0);
const activeCategoryId = ref(null);
const categories = ref([]);

const currentCategoryName = computed(() => {
  const cat = categories.value.find(c => c.id === activeCategoryId.value);
  return cat ? cat.name : '';
});

const activeItems = computed(() => {
  const cat = categories.value.find(c => c.id === activeCategoryId.value);
  return cat ? cat.items : [];
});

const isLoading = ref(false);

const loadData = async () => {
  const instance = getCurrentInstance();
  const api = instance.appContext.config.globalProperties.$api;
  
  isLoading.value = true;
  try {
    const res = await api.publicApi.getSubjects();
    if (res.code === 0 && res.data) {
      // 映射后端数据到前端结构
      categories.value = res.data.map(subject => ({
        id: subject.id,
        name: subject.name,
        items: (subject.categories || []).map(cat => ({
          id: cat.id,
          name: cat.name,
          url: cat.url
        }))
      }));
      
      // 默认选中第一个分类
      if (categories.value.length > 0) {
        activeCategoryId.value = categories.value[0].id;
      }
    }
  } catch (error) {
    console.error('加载题库数据失败:', error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  const sysInfo = uni.getSystemInfoSync();
  statusBarHeight.value = sysInfo.statusBarHeight || 0;
  
  const currentTheme = uni.getStorageSync('themeMode') || 'light';
  isDarkMode.value = currentTheme === 'dark';
  uni.$on('themeChange', (darkMode) => isDarkMode.value = darkMode);
  
  loadData();
});

onUnmounted(() => {
  uni.$off('themeChange');
});

const selectCategory = (cat) => {
  activeCategoryId.value = cat.id;
};

const navigateToDetail = (item) => {
  console.log('点击项目:', item.name, 'URL:', item.url);
  if (item.url) {
    // 保存为最近练习科目，以便在首页显示
    const practiceItem = {
      id: item.id,
      title: item.name,
      url: item.url,
      icon: 'books' // 默认图标，首页 loadLastPracticeSubject 会根据标题进行更精确的图标映射
    };
    uni.setStorageSync('lastPracticeSubject', practiceItem);
    
    uni.navigateTo({
      url: item.url,
      fail: (err) => {
        console.error('跳转失败:', err);
        uni.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  } else {
    uni.showToast({
      title: `暂无详情: ${item.name}`,
      icon: 'none'
    });
  }
};
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f8f9fa;
  overflow: hidden;
  box-sizing: border-box;
  /* 防止 iOS 橡皮筋回弹效果干扰整体布局 */
  position: fixed;
  width: 100%;
  top: 0;
  left: 0;
}

.custom-nav-bar {
  background-color: #ffffff;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

/* 隐藏滚动条 */
::-webkit-scrollbar {
  display: none;
  width: 0 !important;
  height: 0 !important;
  -webkit-appearance: none;
  background: transparent;
}

.nav-content {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 30rpx;
}

.nav-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #333;
}

.sidebar-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
  background-color: #ffffff; /* 统一底色，减少割裂感 */
}

.sidebar {
  width: 170rpx; /* 稍微缩小宽度 */
  height: 100%; /* 确保撑满父容器高度 */
  background-color: #f7f8fa; /* 侧边栏使用浅灰色背景 */
  border-right: 1rpx solid #eeeeee;
}

.sidebar-item {
  position: relative;
  padding: 38rpx 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.active-line {
  position: absolute;
  left: 0;
  width: 6rpx;
  height: 36rpx;
  background-color: #00cfbd;
  border-radius: 0 4rpx 4rpx 0;
}

.sidebar-item.active {
  background-color: #ffffff; /* 选中时与右侧背景融为一体 */
}

.sidebar-text {
  font-size: 26rpx;
  color: #666;
  text-align: center;
}

.sidebar-item.active .sidebar-text {
  color: #00cfbd;
  font-weight: bold;
}

.content {
  flex: 1;
  height: 100%; /* 确保撑满父容器高度 */
  background-color: #ffffff;
}

.content-padding {
  padding: 0 24rpx 120rpx 24rpx; /* 增加底部 padding 以免被 TabBar 遮挡 */
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 80rpx; /* 固定高度，减少间隙 */
  padding: 0 10rpx;
  margin-bottom: 10rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.section-count {
  font-size: 22rpx;
  color: #999;
}

.item-card {
  background-color: #ffffff;
  border-radius: 12rpx;
  padding: 28rpx 30rpx;
  margin-bottom: 16rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.02);
}

.item-card:active {
  background-color: #f1f1f1;
}

.item-info {
  flex: 1;
}

.item-name {
  font-size: 28rpx;
  color: #333;
}

.item-arrow {
  width: 16rpx;
  height: 16rpx;
  border-top: 4rpx solid #ccc;
  border-right: 4rpx solid #ccc;
  transform: rotate(45deg);
  margin-left: 20rpx;
}

.empty-state {
  padding-top: 100rpx;
  text-align: center;
}

.empty-text {
  font-size: 24rpx;
  color: #999;
}

.loading-state {
  padding-top: 100rpx;
  text-align: center;
}

.loading-text {
  font-size: 24rpx;
  color: #999;
}

/* 暗色模式适配 */
.dark-mode {
  background-color: #121212;
}

.dark-mode .custom-nav-bar {
  background-color: #1e1e1e;
}

.dark-mode .nav-title {
  color: #e0e0e0;
}

.dark-mode .sidebar-layout {
  background-color: #121212;
}

.dark-mode .sidebar {
  background-color: #1a1a1a;
  border-right-color: #333;
}

.dark-mode .sidebar-item.active {
  background-color: #121212;
}

.dark-mode .sidebar-text {
  color: #999;
}

.dark-mode .sidebar-item.active .sidebar-text {
  color: #00cfbd;
}

.dark-mode .content {
  background-color: #121212;
}

.dark-mode .section-title {
  color: #e0e0e0;
}

.dark-mode .item-card {
  background-color: #1e1e1e;
}

.dark-mode .item-card:active {
  background-color: #2a2a2a;
}

.dark-mode .item-name {
  color: #e0e0e0;
}
</style>
