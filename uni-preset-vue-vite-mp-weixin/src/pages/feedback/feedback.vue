<template>
  <view class="container" :class="{ 'dark-mode': isDarkMode }">
    
    
    <!-- 反馈表单 -->
    <view class="feedback-form">
      <view class="form-group">
        <view class="form-label">反馈类型</view>
        <view class="form-content">
          <view class="feedback-type" v-for="type in feedbackTypes" :key="type.id" @click="selectType(type.id)" :class="{ active: selectedType === type.id }">
            <text class="type-text">{{ type.name }}</text>
          </view>
        </view>
      </view>
      
      <view class="form-group">
        <view class="form-label">反馈内容</view>
        <view class="form-content">
          <textarea class="feedback-textarea" v-model="feedbackContent" placeholder="请详细描述您遇到的问题或建议..." :maxlength="500" auto-height></textarea>
          <view class="textarea-counter">{{ feedbackContent.length }}/500</view>
        </view>
      </view>
      
      <view class="form-group">
        <view class="form-label">联系方式</view>
        <view class="form-content">
          <input class="feedback-input" type="text" v-model="contactInfo" placeholder="请留下您的联系方式，方便我们与您联系" />
        </view>
      </view>
      
      <view class="form-group">
        <view class="form-label">上传图片（可选）</view>
        <view class="form-content">
          <view class="image-uploader">
            <view class="upload-item" v-for="(item, index) in images" :key="index">
              <image class="upload-image" :src="item" mode="aspectFill"></image>
              <view class="remove-btn" @click="removeImage(index)">
                <text class="remove-icon">✕</text>
              </view>
            </view>
            <view class="upload-btn" @click="chooseImage" v-if="images.length < 3">
              <text class="upload-icon">+</text>
              <text class="upload-text">添加图片</text>
            </view>
          </view>
          <view class="upload-hint">最多可上传3张图片</view>
        </view>
      </view>
      
      <view class="submit-section">
        <button class="submit-btn" @click="submitFeedback" :disabled="!canSubmit">
          <text class="btn-text">提交反馈</text>
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { checkUserContent } from '@/utils/contentSecurity.js';

// 主题状态
const isDarkMode = ref(false);

// 返回上一页
const goBack = () => {
  uni.navigateBack();
};

// 反馈类型
const feedbackTypes = ref([
  { id: 1, name: '功能建议' },
  { id: 2, name: 'bug反馈' },
  { id: 3, name: '界面优化' },
  { id: 4, name: '其他问题' }
]);

// 表单数据
const selectedType = ref(1);
const feedbackContent = ref('');
const contactInfo = ref('');
const images = ref([]);

// 计算是否可以提交
const canSubmit = computed(() => {
  return feedbackContent.value.trim().length > 0;
});

// 选择反馈类型
const selectType = (id) => {
  selectedType.value = id;
};

// 选择图片
const chooseImage = () => {
  uni.chooseImage({
    count: 3 - images.value.length,
    success: (res) => {
      images.value = [...images.value, ...res.tempFilePaths];
    }
  });
};

// 移除图片
const removeImage = (index) => {
  images.value.splice(index, 1);
};

// 提交反馈
const submitFeedback = async () => {
  if (!canSubmit.value) {
    return;
  }
  
  uni.showLoading({
    title: '内容检测中...'
  });
  
  try {
    // 内容安全检测
    const checkResult = await checkUserContent({
      text: feedbackContent.value + ' ' + contactInfo.value,
      images: images.value
    });
    
    if (!checkResult.isSafe) {
      uni.hideLoading();
      uni.showToast({
        title: checkResult.message,
        icon: 'none',
        duration: 3000
      });
      return;
    }
    
    // 检测通过，提交反馈
    uni.showLoading({
      title: '提交中...'
    });
    
    // TODO: 调用实际的提交接口
    setTimeout(() => {
      uni.hideLoading();
      uni.showToast({
        title: '反馈提交成功',
        icon: 'success',
        duration: 1500
      });
      
      // 重置表单
      setTimeout(() => {
        selectedType.value = 1;
        feedbackContent.value = '';
        contactInfo.value = '';
        images.value = [];
      }, 1500);
    }, 1000);
  } catch (error) {
    uni.hideLoading();
    console.error('提交反馈错误:', error);
    uni.showToast({
      title: '提交失败，请重试',
      icon: 'none'
    });
  }
};

// 初始化主题状态
onMounted(() => {
  // 从本地存储获取当前主题模式，默认白天模式
  const currentTheme = uni.getStorageSync('themeMode') || 'light';
  isDarkMode.value = currentTheme === 'dark';
  
  // 监听主题变化事件
  uni.$on('themeChange', (darkMode) => {
    isDarkMode.value = darkMode;
  });
});
</script>

<style>
.container {
  background-color: var(--background);
  min-height: 100vh;
  transition: all 0.3s ease;
}

/* 顶部导航栏 */
.nav-bar {
  display: flex;
  align-items: center;
  padding: 20rpx 30rpx;
  background-color: var(--card-background);
  box-shadow: 0 2rpx 10rpx var(--shadow-color);
  position: sticky;
  top: 0;
  z-index: 100;
  transition: all 0.3s ease;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--border-color);
  border-radius: 50%;
  transition: all 0.3s ease;
}

.back-icon {
  font-size: 32rpx;
  color: var(--text-primary);
  font-weight: bold;
  transition: all 0.3s ease;
}

.nav-title {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--text-primary);
  transition: all 0.3s ease;
}

/* 反馈表单 */
.feedback-form {
  padding: 20rpx;
}

.form-group {
  background-color: var(--card-background);
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  padding: 30rpx;
  box-shadow: 0 2rpx 8rpx var(--light-shadow-color);
  transition: all 0.3s ease;
}

.form-label {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 20rpx;
  transition: all 0.3s ease;
}

.form-content {
  display: flex;
  flex-direction: column;
}

/* 反馈类型 */
.feedback-type {
  display: inline-block;
  padding: 16rpx 32rpx;
  background-color: var(--inactive-color);
  border-radius: 24rpx;
  margin-right: 20rpx;
  margin-bottom: 20rpx;
  transition: all 0.3s ease;
  font-size: 24rpx;
  color: var(--text-secondary);
}

.feedback-type.active {
  background-color: var(--primary-color);
  color: #ffffff;
}

.feedback-type:active {
  transform: scale(0.95);
}

/* 反馈内容 */
.feedback-textarea {
  width: 100%;
  min-height: 200rpx;
  font-size: 26rpx;
  color: var(--text-primary);
  border: none;
  outline: none;
  resize: none;
  line-height: 1.6;
  background-color: transparent;
  transition: all 0.3s ease;
}

.feedback-textarea::placeholder {
  color: var(--text-tertiary);
}

.textarea-counter {
  align-self: flex-end;
  font-size: 22rpx;
  color: var(--text-tertiary);
  margin-top: 10rpx;
  transition: all 0.3s ease;
}

/* 联系方式 */
.feedback-input {
  width: 100%;
  height: 80rpx;
  font-size: 26rpx;
  color: var(--text-primary);
  border: none;
  outline: none;
  background-color: var(--inactive-color);
  border-radius: 12rpx;
  padding: 0 20rpx;
  box-sizing: border-box;
  transition: all 0.3s ease;
}

.feedback-input::placeholder {
  color: var(--text-tertiary);
}

/* 图片上传 */
.image-uploader {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
  margin-bottom: 10rpx;
}

.upload-item {
  position: relative;
  width: 200rpx;
  height: 200rpx;
  border-radius: 12rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 8rpx var(--shadow-color);
  transition: all 0.3s ease;
}

.upload-image {
  width: 100%;
  height: 100%;
}

.remove-btn {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  width: 40rpx;
  height: 40rpx;
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.remove-btn:active {
  transform: scale(0.9);
}

.remove-icon {
  font-size: 24rpx;
  color: #ffffff;
  font-weight: bold;
}

.upload-btn {
  width: 200rpx;
  height: 200rpx;
  background-color: var(--inactive-color);
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  transition: all 0.3s ease;
  border: 2rpx dashed var(--border-color);
}

.upload-btn:active {
  transform: scale(0.95);
}

.upload-icon {
  font-size: 48rpx;
  color: var(--text-tertiary);
  transition: all 0.3s ease;
}

.upload-text {
  font-size: 24rpx;
  color: var(--text-tertiary);
  transition: all 0.3s ease;
}

.upload-hint {
  font-size: 22rpx;
  color: var(--text-tertiary);
  transition: all 0.3s ease;
}

/* 提交按钮 */
.submit-section {
  padding: 40rpx 20rpx;
}

.submit-btn {
  width: 100%;
  height: 90rpx;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  color: #ffffff;
  font-size: 28rpx;
  font-weight: bold;
  border: none;
  border-radius: 45rpx;
  box-shadow: 0 4rpx 12rpx rgba(102, 102, 255, 0.3);
  transition: all 0.3s ease;
}

.submit-btn:disabled {
  background: var(--border-color);
  box-shadow: none;
}

.submit-btn:active:not(:disabled) {
  transform: scale(0.98);
  box-shadow: 0 2rpx 6rpx rgba(102, 102, 255, 0.2);
}

/* 夜间模式样式 */
.dark-mode .container {
  background-color: #1a1a1a;
}

.dark-mode .nav-bar {
  background-color: #2d2d2d;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.3);
}

.dark-mode .back-btn {
  background-color: #404040;
}

.dark-mode .back-icon {
  color: #ffffff;
}

.dark-mode .nav-title {
  color: #ffffff;
}

.dark-mode .form-group {
  background-color: #2d2d2d;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.3);
}

.dark-mode .form-label {
  color: #ffffff;
}

.dark-mode .feedback-type {
  background-color: #404040;
  color: #cccccc;
}

.dark-mode .feedback-type.active {
  background-color: #6666ff;
  color: #ffffff;
}

.dark-mode .feedback-textarea {
  color: #ffffff;
}

.dark-mode .feedback-input {
  background-color: #404040;
  color: #ffffff;
}

.dark-mode .textarea-counter {
  color: #999999;
}

.dark-mode .upload-btn {
  background-color: #404040;
  border-color: #555555;
}

.dark-mode .upload-icon,
.dark-mode .upload-text,
.dark-mode .upload-hint {
  color: #999999;
}
</style>