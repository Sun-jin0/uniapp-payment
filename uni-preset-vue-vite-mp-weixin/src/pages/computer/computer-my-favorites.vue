<script setup>
import { ref, onMounted } from 'vue';
import { request } from '../../api/request';
import { transformContextString } from '../../utils/latex';

const statusBarHeight = ref(0);
const categories = ref([]);
const favorites = ref([]);
const loading = ref(true);
const collapsedGroups = ref({}); // 用于记录哪些分类是收起的

onMounted(async () => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight || 0;

  await fetchData();
});

const fetchData = async () => {
  loading.value = true;
  try {
    const [catRes, favRes] = await Promise.all([
      request({ url: '/computer1/favorite-categories' }),
      request({ url: '/computer1/favorites' })
    ]);
    
    categories.value = catRes.data || [];
    const favData = favRes.data || [];
    
    // 渲染 LaTeX
    favData.forEach(f => {
      if (f.stem) f.stem = transformContextString(f.stem);
    });
    favorites.value = favData;
    
    // 默认收起所有分类 (用户要求收藏夹默认收起)
    const groups = {};
    categories.value.forEach(cat => {
      groups[cat.CategoryID] = true;
    });
    groups['unclassified'] = true;
    collapsedGroups.value = groups;
  } catch (error) {
    console.error('获取收藏数据失败:', error);
  } finally {
    loading.value = false;
  }
};

const getGroupedFavorites = () => {
  const groups = {};
  
  // 初始化分类
  categories.value.forEach(cat => {
    groups[cat.CategoryID] = {
      title: cat.Title,
      questions: []
    };
  });
  
  // 未分类
  groups['unclassified'] = {
    title: '未分类题目',
    questions: []
  };
  
  // 填充题目
  favorites.value.forEach(fav => {
    const groupId = fav.CategoryID || 'unclassified';
    if (groups[groupId]) {
      groups[groupId].questions.push(fav);
    } else {
      groups['unclassified'].questions.push(fav);
    }
  });
  
  return groups;
};

const toggleGroup = (groupId) => {
  collapsedGroups.value[groupId] = !collapsedGroups.value[groupId];
};

const goToDetail = (fav) => {
  // 保存为最近练习科目，以便在首页显示
  const practiceItem = {
    id: 'computer-favorites',
    title: '计算机 - 收藏夹',
    url: '/pages/computer/computer-my-favorites',
    icon: 'computer'
  };
  uni.setStorageSync('lastPracticeSubject', practiceItem);

  uni.navigateTo({
    url: `/pages/computer/computer-question-detail?questionId=${fav.QuestionID}`
  });
};

const goBack = () => {
  uni.navigateBack();
};

const startPractice = (groupId) => {
  const group = getGroupedFavorites()[groupId];
  if (!group || group.questions.length === 0) return;
  
  // 保存为最近练习科目，以便在首页显示
  const practiceItem = {
    id: 'computer-favorites-' + groupId,
    title: `计算机 - 收藏 - ${group.title}`,
    url: '/pages/computer/computer-my-favorites',
    icon: 'computer'
  };
  uni.setStorageSync('lastPracticeSubject', practiceItem);

  const ids = group.questions.map(q => q.QuestionID).join(',');
  uni.navigateTo({
    url: `/pages/computer/computer-question-detail?ids=${ids}`
  });
};
</script>

<template>
  <view class="container">
    <view class="custom-nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">❮</text>
        </view>
        <view class="nav-title">计算机收藏夹</view>
      </view>
    </view>

    <scroll-view scroll-y class="content-scroll" :style="{ marginTop: (statusBarHeight + 44) + 'px' }">
      <view v-if="loading" class="loading-state">
        <text>正在加载收藏...</text>
      </view>
      <view v-else-if="favorites.length === 0" class="no-data">
        <text>暂无收藏题目</text>
      </view>
      <view v-else class="favorites-content">
        <view 
          v-for="(group, id) in getGroupedFavorites()" 
          :key="id"
          class="favorite-group"
          v-show="group.questions.length > 0"
        >
          <view class="group-header" @click="toggleGroup(id)">
            <view class="header-left">
              <text class="arrow" :class="{ 'collapsed': collapsedGroups[id] }">▼</text>
              <text class="group-title">{{ group.title }}</text>
              <text class="count">({{ group.questions.length }})</text>
            </view>
            <view class="header-right" @click.stop="startPractice(id)">
              <text class="practice-btn">刷此分类</text>
            </view>
          </view>
          
          <view class="question-list" v-show="!collapsedGroups[id]">
            <view 
              v-for="fav in group.questions" 
              :key="fav.FavoriteID"
              class="question-item"
              @click="goToDetail(fav)"
            >
              <view class="item-main">
                <view class="item-type">{{ fav.exercise_type_name }}</view>
                <view class="item-stem" v-html="fav.stem"></view>
              </view>
              <view class="item-meta">
                <text class="subject-name">{{ fav.subject_name }}</text>
                <text class="fav-time">{{ new Date(fav.CreatedAt).toLocaleDateString() }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped>
.container {
  height: 100vh;
  background-color: #f8f9fa;
}

.custom-nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background-color: #fff;
  z-index: 100;
  border-bottom: 1rpx solid #eee;
}

.nav-content {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 36rpx;
  color: #333;
}

.nav-title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  font-weight: bold;
}

.content-scroll {
  height: calc(100vh - 44px);
}

.favorites-content {
  padding: 20rpx;
}

.favorite-group {
  background-color: #fff;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
}

.group-header {
  padding: 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #fff;
  border-bottom: 1rpx solid #f0f0f0;
}

.header-left {
  display: flex;
  align-items: center;
}

.arrow {
  font-size: 24rpx;
  color: #999;
  margin-right: 16rpx;
  transition: transform 0.2s;
}

.arrow.collapsed {
  transform: rotate(-90deg);
}

.group-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}

.count {
  font-size: 24rpx;
  color: #999;
  margin-left: 10rpx;
}

.practice-btn {
  font-size: 24rpx;
  color: #1976d2;
  border: 1rpx solid #1976d2;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}

.question-list {
  padding: 0 20rpx;
}

.question-item {
  padding: 24rpx 10rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.question-item:last-child {
  border-bottom: none;
}

.item-main {
  margin-bottom: 16rpx;
}

.item-type {
  font-size: 22rpx;
  color: #1976d2;
  background-color: #e3f2fd;
  display: inline-block;
  padding: 2rpx 10rpx;
  border-radius: 4rpx;
  margin-bottom: 10rpx;
}

.item-stem {
  font-size: 28rpx;
  color: #333;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.item-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.subject-name {
  font-size: 24rpx;
  color: #666;
}

.fav-time {
  font-size: 22rpx;
  color: #999;
}

.loading-state, .no-data {
  text-align: center;
  padding: 100rpx 0;
  color: #999;
}
</style>
