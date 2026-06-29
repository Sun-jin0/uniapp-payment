<template>
  <view class="checkin-page">
    <!-- 顶部导航 -->
    <view class="nav-bar">
      <view class="back-btn" @click="goBack">
        <text class="iconfont icon-arrow-left"></text>
      </view>
      <text class="nav-title">每日打卡</text>
      <view class="right-btn" @click="goToHistory">
        <text class="history-text">记录</text>
      </view>
    </view>

    <!-- Banner区域 -->
    <view class="banner">
      <view class="banner-content">
        <view class="banner-left">
          <text class="banner-day">{{ consecutiveDays }}</text>
          <text class="banner-label">连续打卡天数</text>
        </view>
        <view class="banner-right">
          <text class="banner-total">{{ totalCheckins }}</text>
          <text class="banner-label">累计打卡</text>
        </view>
      </view>
    </view>

    <!-- 打卡类型选择 -->
    <view class="type-section">
      <view 
        class="type-card" 
        :class="{ active: checkinType === 'study' }"
        @click="checkinType = 'study'"
      >
        <view class="type-icon-wrap study">
          <text class="type-emoji">📚</text>
        </view>
        <view class="type-info">
          <text class="type-name">刷题打卡</text>
          <text class="type-desc">记录今日刷题数量</text>
        </view>
        <view class="type-arrow">
          <text class="arrow-icon">›</text>
        </view>
      </view>

      <view 
        class="type-card" 
        :class="{ active: checkinType === 'custom' }"
        @click="checkinType = 'custom'"
      >
        <view class="type-icon-wrap custom">
          <text class="type-emoji">✍️</text>
        </view>
        <view class="type-info">
          <text class="type-name">自定义打卡</text>
          <text class="type-desc">上传图片或文字记录</text>
        </view>
        <view class="type-arrow">
          <text class="arrow-icon">›</text>
        </view>
      </view>
    </view>

    <!-- 刷题打卡表单 -->
    <view class="form-section" v-if="checkinType === 'study'">
      <view class="form-card">
        <view class="form-title">输入刷题数量</view>
        <view class="input-box">
          <input 
            class="num-input" 
            type="number" 
            v-model="studyCount" 
            placeholder="0"
            focusable="true"
          />
          <text class="input-suffix">道</text>
        </view>
        <view class="quick-nums">
          <text 
            v-for="num in [10, 20, 30, 50, 100]" 
            :key="num"
            class="num-tag"
            :class="{ active: studyCount == num }"
            @click="studyCount = num"
          >{{ num }}</text>
        </view>
      </view>
    </view>

    <!-- 自定义打卡表单 -->
    <view class="form-section" v-if="checkinType === 'custom'">
      <view class="form-card">
        <view class="form-title">写下你的打卡内容</view>
        <textarea 
          class="content-input" 
          v-model="content" 
          placeholder="今天学习了什么？有什么收获？"
          maxlength="500"
        />
        <view class="input-footer">
          <text class="char-count">{{ content.length }}/500</text>
        </view>
      </view>

      <view class="form-card">
        <view class="form-title">添加图片（可选）</view>
        <view class="image-grid">
          <view class="img-item" v-for="(img, index) in images" :key="index">
            <image class="img" :src="img" mode="aspectFill" />
            <view class="img-del" @click="images.splice(index, 1)">
              <text class="del-icon">×</text>
            </view>
          </view>
          <view class="img-add" @click="chooseImage" v-if="images.length < 9">
            <text class="add-icon">+</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 今日已打卡记录 -->
    <view class="records-section" v-if="todayStatus.todayRecords && todayStatus.todayRecords.length > 0">
      <view class="section-header">
        <text class="section-title">今日打卡</text>
      </view>
      
      <view class="record-card" v-for="record in todayStatus.todayRecords" :key="record.id">
        <view class="record-top">
          <view class="record-user">
            <view class="user-avatar">
              <text class="avatar-text">我</text>
            </view>
            <view class="user-info">
              <text class="user-name">我的打卡</text>
              <text class="record-time">{{ formatTime(record.checkinTime) }}</text>
            </view>
          </view>
        </view>
        
        <view class="record-body" v-if="record.studyCount > 0">
          <text class="record-text">今日刷了 <text class="highlight">{{ record.studyCount }}</text> 道题 💪</text>
        </view>
        
        <view class="record-body" v-if="record.content">
          <text class="record-text">{{ record.content }}</text>
        </view>
        
        <view class="record-images" v-if="record.images && record.images.length > 0">
          <image 
            v-for="(img, idx) in record.images" 
            :key="idx"
            class="record-img" 
            :src="img" 
            mode="aspectFill"
            @click="previewImage(record.images, idx)"
          />
        </view>
        
        <view class="record-bottom">
          <view class="like-btn" @click="likeRecord(record)">
            <text class="like-icon">♡</text>
            <text class="like-count">{{ record.likeCount || 0 }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部打卡按钮 -->
    <view class="bottom-bar">
      <button 
        class="checkin-btn" 
        :class="{ disabled: !canSubmit }"
        :disabled="!canSubmit"
        @click="submitCheckin"
      >
        {{ todayStatus.hasCheckedIn ? '已打卡' : '打卡' }}
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, getCurrentInstance } from 'vue';
import { onShow } from '@dcloudio/uni-app';

const instance = getCurrentInstance();

const checkinType = ref('study');
const studyCount = ref('');
const content = ref('');
const images = ref([]);
const consecutiveDays = ref(0);
const totalCheckins = ref(0);
const todayStatus = ref({
  hasCheckedIn: false,
  todayRecords: []
});

const canSubmit = computed(() => {
  if (todayStatus.value.hasCheckedIn) return false;
  if (checkinType.value === 'study') {
    return studyCount.value && parseInt(studyCount.value) > 0;
  }
  return content.value.trim().length > 0 || images.value.length > 0;
});

const chooseImage = () => {
  uni.chooseImage({
    count: 9 - images.value.length,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      uploadImages(res.tempFilePaths);
    }
  });
};

const uploadImages = async (filePaths) => {
  for (const filePath of filePaths) {
    try {
      const uploadRes = await uni.uploadFile({
        url: `${instance.appContext.config.globalProperties.$api.baseUrl}/upload`,
        filePath: filePath,
        name: 'file'
      });
      
      const data = JSON.parse(uploadRes.data);
      if (data.code === 0) {
        images.value.push(data.data.url);
      }
    } catch (error) {
      console.error('上传图片失败:', error);
      uni.showToast({ title: '上传失败', icon: 'none' });
    }
  }
};

const submitCheckin = async () => {
  if (!canSubmit.value) return;
  
  try {
    const res = await instance.appContext.config.globalProperties.$api.checkinApi.customCheckin({
      checkinType: checkinType.value,
      studyCount: checkinType.value === 'study' ? parseInt(studyCount.value) : 0,
      content: content.value,
      images: images.value
    });
    
    if (res.code === 0) {
      uni.showToast({ title: '打卡成功！', icon: 'success' });
      studyCount.value = '';
      content.value = '';
      images.value = [];
      loadTodayStatus();
    }
  } catch (error) {
    console.error('打卡失败:', error);
    uni.showToast({ title: error.message || '打卡失败', icon: 'none' });
  }
};

const loadTodayStatus = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.checkinApi.getTodayCheckinStatus();
    if (res.code === 0) {
      todayStatus.value = res.data;
      consecutiveDays.value = res.data.consecutiveDays;
    }
  } catch (error) {
    console.error('获取打卡状态失败:', error);
  }
};

const loadCheckinRecords = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.checkinApi.getCustomCheckinRecords({
      page: 1,
      limit: 1
    });
    if (res.code === 0) {
      totalCheckins.value = res.data.total;
    }
  } catch (error) {
    console.error('获取打卡记录失败:', error);
  }
};

const previewImage = (urls, current) => {
  uni.previewImage({
    urls: urls,
    current: urls[current]
  });
};

const likeRecord = (record) => {
  uni.showToast({ title: '感谢支持~', icon: 'none' });
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${min}`;
};

const goBack = () => {
  uni.navigateBack();
};

const goToHistory = () => {
  uni.navigateTo({
    url: '/pages/checkin/checkin-history'
  });
};

onMounted(() => {
  loadTodayStatus();
  loadCheckinRecords();
});

onShow(() => {
  loadTodayStatus();
});
</script>

<style scoped>
.checkin-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 140rpx;
}

/* 导航栏 */
.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 30rpx;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 100;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
}

.right-btn {
  padding: 10rpx 20rpx;
}

.history-text {
  font-size: 28rpx;
  color: #6366f1;
}

/* Banner */
.banner {
  margin: 20rpx 30rpx;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 20rpx;
  padding: 40rpx 30rpx;
}

.banner-content {
  display: flex;
  justify-content: space-around;
}

.banner-left, .banner-right {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.banner-day, .banner-total {
  font-size: 56rpx;
  font-weight: 700;
  color: #fff;
}

.banner-label {
  font-size: 24rpx;
  color: rgba(255,255,255,0.8);
  margin-top: 8rpx;
}

/* 类型选择 */
.type-section {
  padding: 0 30rpx;
}

.type-card {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 25rpx 30rpx;
  margin-bottom: 16rpx;
  border: 2rpx solid transparent;
  transition: all 0.3s;
}

.type-card.active {
  border-color: #6366f1;
  background: rgba(99,102,241,0.03);
}

.type-icon-wrap {
  width: 90rpx;
  height: 90rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
}

.type-icon-wrap.study {
  background: #ede9fe;
}

.type-icon-wrap.custom {
  background: #fef3c7;
}

.type-emoji {
  font-size: 44rpx;
}

.type-info {
  flex: 1;
}

.type-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 6rpx;
}

.type-desc {
  font-size: 24rpx;
  color: #999;
}

.type-arrow {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.arrow-icon {
  font-size: 32rpx;
  color: #ccc;
}

/* 表单 */
.form-section {
  padding: 0 30rpx;
  margin-top: 20rpx;
}

.form-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 16rpx;
}

.form-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
}

.input-box {
  display: flex;
  align-items: center;
  border: 2rpx solid #eee;
  border-radius: 12rpx;
  padding: 10rpx 20rpx;
}

.num-input {
  flex: 1;
  height: 70rpx;
  font-size: 36rpx;
  font-weight: 600;
  color: #6366f1;
  text-align: center;
}

.input-suffix {
  font-size: 28rpx;
  color: #999;
  margin-left: 10rpx;
}

.quick-nums {
  display: flex;
  gap: 15rpx;
  margin-top: 20rpx;
  flex-wrap: wrap;
}

.num-tag {
  padding: 12rpx 28rpx;
  background: #f5f5f5;
  border-radius: 30rpx;
  font-size: 26rpx;
  color: #666;
}

.num-tag.active {
  background: #6366f1;
  color: #fff;
}

.content-input {
  width: 100%;
  height: 200rpx;
  background: #fafafa;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  box-sizing: border-box;
  line-height: 1.6;
}

.input-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 10rpx;
}

.char-count {
  font-size: 22rpx;
  color: #bbb;
}

/* 图片 */
.image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 15rpx;
}

.img-item {
  position: relative;
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  overflow: hidden;
}

.img {
  width: 100%;
  height: 100%;
}

.img-del {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 36rpx;
  height: 36rpx;
  background: rgba(0,0,0,0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.del-icon {
  color: #fff;
  font-size: 24rpx;
}

.img-add {
  width: 160rpx;
  height: 160rpx;
  border: 2rpx dashed #ddd;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafafa;
}

.add-icon {
  font-size: 56rpx;
  color: #ccc;
}

/* 记录 */
.records-section {
  padding: 0 30rpx;
  margin-top: 30rpx;
}

.section-header {
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}

.record-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 25rpx;
  margin-bottom: 16rpx;
}

.record-top {
  margin-bottom: 16rpx;
}

.record-user {
  display: flex;
  align-items: center;
}

.user-avatar {
  width: 70rpx;
  height: 70rpx;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
}

.avatar-text {
  color: #fff;
  font-size: 26rpx;
  font-weight: 600;
}

.user-info {
  flex: 1;
}

.user-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  display: block;
}

.record-time {
  font-size: 22rpx;
  color: #999;
}

.record-body {
  margin-bottom: 16rpx;
}

.record-text {
  font-size: 28rpx;
  color: #555;
  line-height: 1.6;
}

.highlight {
  color: #6366f1;
  font-weight: 600;
}

.record-images {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-bottom: 16rpx;
}

.record-img {
  width: 180rpx;
  height: 180rpx;
  border-radius: 10rpx;
}

.record-bottom {
  display: flex;
  justify-content: flex-end;
}

.like-btn {
  display: flex;
  align-items: center;
  padding: 8rpx 20rpx;
}

.like-icon {
  font-size: 32rpx;
  color: #999;
  margin-right: 6rpx;
}

.like-count {
  font-size: 24rpx;
  color: #999;
}

/* 底部按钮 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.05);
}

.checkin-btn {
  width: 200rpx;
  height: 80rpx;
  background: #f59e0b;
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
  border-radius: 40rpx;
  border: none;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkin-btn.disabled {
  background: #d1d5db;
}
</style>
