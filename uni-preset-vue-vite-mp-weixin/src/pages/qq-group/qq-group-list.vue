<template>
  <view class="container" :class="{ 'dark-mode': isDarkMode }">
    <!-- 固定区域：搜索 + 筛选 -->
    <view class="fixed-header">
      <!-- 搜索区域 -->
      <view class="search-section">
        <view class="search-box">
          <icon type="search" size="16" color="#999" />
          <input 
            class="search-input" 
            type="text" 
            placeholder="搜索群号或机构名称" 
            v-model="searchKeyword"
            @confirm="onSearch"
          />
          <view v-if="searchKeyword" class="clear-btn" @click="clearSearch">
            <text>×</text>
          </view>
        </view>
      </view>

      <!-- 筛选区域 -->
      <view class="filter-section">
        <scroll-view class="filter-scroll" scroll-x :show-scrollbar="false" :enhanced="true">
          <view class="filter-list">
            <view 
              class="filter-item" 
              :class="{ active: currentFilter === 'all' }"
              @click="setFilter('all')"
            >
              全部
            </view>
            <view 
              v-for="org in organizations" 
              :key="org.name"
              class="filter-item" 
              :class="{ active: currentFilter === org.name }"
              @click="setFilter(org.name)"
            >
              {{ org.name }}
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 群列表区域 -->
    <scroll-view class="group-scroll-view" scroll-y :show-scrollbar="false" :enhanced="true">
      <!-- 头部图片 -->
      <view class="header-section">
        <image class="header-image" src="/static/QQ2.png" mode="widthFix" />
      </view>
      
      <!-- 群列表 -->
      <view class="group-list">
        <view v-if="filteredGroups.length === 0" class="empty-state">
          <text class="empty-text">暂无Q群数据</text>
        </view>

        <view v-else>
          <view 
            v-for="group in filteredGroups" 
            :key="group.id"
            class="group-card"
            :class="{ pinned: group.isPinned }"
            @click="handleGroupClick(group)"
          >
            <view v-if="group.isPinned" class="pinned-badge">置顶</view>
            
            <view class="group-main">
              <view class="group-left">
                <view class="group-name">{{ group.name }}</view>
                <view class="group-info">
                  <text class="org-name" v-if="group.orgName">{{ group.orgName }}</text>
                  <text class="tag-item" v-for="(tag, index) in group.tags" :key="index">{{ tag }}</text>
                </view>
              </view>
              <view class="group-right">
                <text class="group-detail">详情</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view v-if="showModal" class="modal-mask" @click="closeModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ selectedGroup?.name }}</text>
          <view class="modal-close" @click="closeModal">×</view>
        </view>
        <scroll-view class="modal-body" scroll-y>
          <view class="modal-desc">{{ selectedGroup?.description }}</view>
        </scroll-view>
        <view class="modal-footer">
          <view class="modal-group-number">
            <text class="label">群号：</text>
            <text class="number">{{ selectedGroup?.groupNumber }}</text>
          </view>
          <view class="modal-btn" @click="copyAndClose">复制群号</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, getCurrentInstance } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { copyToClipboard } from '@/utils/clipboard.js';

const instance = getCurrentInstance();

const isDarkMode = ref(false);
const searchKeyword = ref('');
const currentFilter = ref('all');

const qqGroups = ref([]);
const organizations = ref([]);

const showModal = ref(false);
const selectedGroup = ref(null);

const filteredGroups = computed(() => {
  let result = [...qqGroups.value];
  
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.trim().toLowerCase();
    result = result.filter(group => 
      group.name.toLowerCase().includes(keyword) ||
      group.groupNumber.includes(keyword) ||
      (group.orgName && group.orgName.toLowerCase().includes(keyword))
    );
  }
  
  if (currentFilter.value === 'pinned') {
    result = result.filter(group => group.isPinned);
  } else if (currentFilter.value !== 'all') {
    result = result.filter(group => group.orgName === currentFilter.value);
  }
  
  result.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return (b.memberCount || 0) - (a.memberCount || 0);
  });
  
  return result;
});

const loadOrganizations = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.qqGroupApi.getOrganizations();
    if (res.code === 0) {
      organizations.value = res.data || [];
    }
  } catch (error) {
    console.error('加载机构列表失败:', error);
  }
};

const loadQQGroups = async () => {
  try {
    uni.showLoading({ title: '加载中...' });
    const res = await instance.appContext.config.globalProperties.$api.qqGroupApi.getQQGroups();
    uni.hideLoading();
    
    if (res.code === 0) {
      qqGroups.value = res.data || [];
    } else {
      uni.showToast({ title: res.message || '加载失败', icon: 'none' });
    }
  } catch (error) {
    uni.hideLoading();
    console.error('加载Q群失败:', error);
    uni.showToast({ title: '加载失败', icon: 'none' });
  }
};

const onSearch = () => {
};

const clearSearch = () => {
  searchKeyword.value = '';
};

const setFilter = (filter) => {
  currentFilter.value = filter;
};

const copyGroupNumber = async (groupNumber) => {
  await copyToClipboard(groupNumber, {
    successMsg: '群号已复制',
    showModal: false
  });
};

const handleGroupClick = (group) => {
  if (group.description) {
    selectedGroup.value = group;
    showModal.value = true;
  } else {
    copyGroupNumber(group.groupNumber);
  }
};

const closeModal = () => {
  showModal.value = false;
  selectedGroup.value = null;
};

const copyAndClose = () => {
  if (selectedGroup.value) {
    copyGroupNumber(selectedGroup.value.groupNumber);
    closeModal();
  }
};

const togglePin = async (group) => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.qqGroupApi.togglePin(group.id);
    if (res.code === 0) {
      group.isPinned = res.data.isPinned;
      uni.showToast({ 
        title: res.data.message, 
        icon: 'success' 
      });
    } else {
      uni.showToast({ title: res.message || '操作失败', icon: 'none' });
    }
  } catch (error) {
    console.error('置顶操作失败:', error);
    uni.showToast({ title: '操作失败', icon: 'none' });
  }
};

onMounted(() => {
  loadOrganizations();
  loadQQGroups();
});

onShow(() => {
  loadQQGroups();
});
</script>

<style scoped>
.container {
  height: 100vh;
  background: linear-gradient(180deg, #e0f2fe 0%, #f0f9ff 100%);
  overflow: hidden;
  position: relative;
}

::-webkit-scrollbar {
  display: none;
}

.dark-mode.container {
  background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
}

/* 固定头部区域 */
.fixed-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: linear-gradient(180deg, #e0f2fe 0%, #f0f9ff 100%);
}

/* #ifdef H5 */
.fixed-header {
  padding-top: 44px;
}
/* #endif */

/* #ifdef MP-WEIXIN */
.fixed-header {
  padding-top: 0;
}
/* #endif */

.dark-mode .fixed-header {
  background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
}

.search-section {
  padding: 20rpx 30rpx 16rpx;
  box-sizing: border-box;
}

.dark-mode .search-section {
  background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
}

.search-box {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 40rpx;
  padding: 16rpx 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
  box-sizing: border-box;
  width: 100%;
}

.dark-mode .search-box {
  background: #1e293b;
}

.search-input {
  flex: 1;
  margin-left: 16rpx;
  font-size: 28rpx;
  color: #333;
  border: none;
  outline: none;
  background: transparent;
}

.dark-mode .search-input {
  color: #e2e8f0;
}

.clear-btn {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e5e7eb;
  border-radius: 50%;
  color: #6b7280;
  font-size: 28rpx;
}

.filter-section {
  padding: 0 30rpx 20rpx;
  box-sizing: border-box;
}

.filter-scroll {
  width: 100%;
}

.filter-list {
  display: flex;
  gap: 20rpx;
}

.filter-item {
  flex-shrink: 0;
  padding: 12rpx 28rpx;
  background: #fff;
  border-radius: 30rpx;
  font-size: 26rpx;
  color: #64748b;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
}

.dark-mode .filter-item {
  background: #1e293b;
  color: #94a3b8;
}

.filter-item.active {
  background: linear-gradient(135deg, #0ea5e9, #0284c7);
  color: #fff;
}

.group-scroll-view {
  height: 100vh;
  box-sizing: border-box;
}

/* #ifdef H5 */
.group-scroll-view {
  padding-top: 140px;
}
/* #endif */

/* #ifdef MP-WEIXIN */
.group-scroll-view {
  padding-top: 180rpx;
}
/* #endif */

.header-section {
  width: 100%;
  padding-top: 20rpx;
}

.header-image {
  width: 100%;
  height: auto;
}

.group-list {
  padding: 0 30rpx 30rpx;
  box-sizing: border-box;
}

.group-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  position: relative;
  box-sizing: border-box;
  width: 100%;
  overflow: hidden;
}

.group-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 40rpx;
  height: 40rpx;
  border-top: 4rpx solid #0ea5e9;
  border-left: 4rpx solid #0ea5e9;
  border-top-left-radius: 16rpx;
}

.group-card::after {
  content: '';
  position: absolute;
  bottom: 0;
  right: 0;
  width: 40rpx;
  height: 40rpx;
  border-bottom: 4rpx solid #0ea5e9;
  border-right: 4rpx solid #0ea5e9;
  border-bottom-right-radius: 16rpx;
}

.dark-mode .group-card {
  background: #1e293b;
}

.group-card.pinned::before {
  border-top-color: #f59e0b;
  border-left-color: #f59e0b;
}

.pinned-badge {
  position: absolute;
  top: 0;
  right: 0;
  background: #f59e0b;
  color: #fff;
  font-size: 18rpx;
  padding: 4rpx 12rpx;
  border-radius: 0 16rpx 0 12rpx;
}

.group-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-left {
  flex: 1;
  min-width: 0;
}

.group-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dark-mode .group-name {
  color: #f1f5f9;
}

.group-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12rpx;
}

.org-name {
  font-size: 22rpx;
  color: #0ea5e9;
  background: #e0f2fe;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}

.dark-mode .org-name {
  background: #0c4a6e;
  color: #7dd3fc;
}

.member-count {
  font-size: 22rpx;
  color: #9ca3af;
}

.tag-item {
  font-size: 20rpx;
  color: #64748b;
  background: #f1f5f9;
  padding: 4rpx 10rpx;
  border-radius: 6rpx;
}

.dark-mode .tag-item {
  background: #334155;
  color: #94a3b8;
}

.group-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 12rpx;
  flex-shrink: 0;
  min-width: 140rpx;
}

.group-detail {
  font-size: 24rpx;
  font-weight: bold;
  color: #0ea5e9;
  white-space: nowrap;
}

.copy-text {
  font-size: 20rpx;
  color: #9ca3af;
  margin-top: 4rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 0;
}

.empty-text {
  font-size: 28rpx;
  color: #9ca3af;
}

.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-content {
  width: 600rpx;
  max-height: 70vh;
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dark-mode .modal-content {
  background: #1e293b;
}

.modal-header {
  padding: 32rpx;
  border-bottom: 1rpx solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dark-mode .modal-header {
  border-bottom-color: #334155;
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1e293b;
}

.dark-mode .modal-title {
  color: #f1f5f9;
}

.modal-close {
  font-size: 48rpx;
  color: #9ca3af;
  line-height: 1;
}

.modal-body {
  padding: 32rpx;
  max-height: 400rpx;
  box-sizing: border-box;
}

.modal-desc {
  font-size: 28rpx;
  color: #475569;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-all;
  width: 100%;
  box-sizing: border-box;
}

.dark-mode .modal-desc {
  color: #94a3b8;
}

.modal-footer {
  padding: 24rpx 32rpx;
  border-top: 1rpx solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dark-mode .modal-footer {
  border-top-color: #334155;
}

.modal-group-number {
  display: flex;
  align-items: center;
}

.modal-group-number .label {
  font-size: 26rpx;
  color: #64748b;
}

.modal-group-number .number {
  font-size: 30rpx;
  font-weight: bold;
  color: #0ea5e9;
}

.modal-btn {
  background: linear-gradient(135deg, #0ea5e9, #0284c7);
  color: #fff;
  font-size: 28rpx;
  padding: 16rpx 32rpx;
  border-radius: 12rpx;
}
</style>
