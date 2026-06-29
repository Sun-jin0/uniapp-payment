<template>
  <view class="search-bar" :class="{ 'dark-mode': isDarkMode }">
    <view class="search-input-wrapper">
      <!-- 移除放大镜图标：直接删除原search-icon标签，无需保留占位 -->
      <input 
        class="search-input" 
        :type="inputType" 
        :placeholder="placeholder" 
        :value="modelValue"
        @input="handleInput"
        @confirm="handleConfirm"
      />
    </view>
    <button class="search-btn" @click="handleSearch" type="primary">搜索</button>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: '搜索'
  },
  inputType: {
    type: String,
    default: 'text'
  }
});

const emit = defineEmits(['update:modelValue', 'search', 'confirm']);

const isDarkMode = ref(false);

onMounted(() => {
  const currentTheme = uni.getStorageSync('themeMode') || 'light';
  isDarkMode.value = currentTheme === 'dark';
  
  uni.$on('themeChange', (darkMode) => {
    isDarkMode.value = darkMode;
  });
});

const handleInput = (event) => {
  emit('update:modelValue', event.detail.value);
};

const handleSearch = () => {
  emit('search', props.modelValue);
};

const handleConfirm = () => {
  emit('confirm', props.modelValue);
};
</script>

<style>
.search-bar {
  display: flex;
  padding: 20rpx;
  gap: 20rpx;
  /* 替换为磨砂玻璃样式：高透明背景 + 模糊效果 */
  background-color: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 2rpx solid rgba(255, 255, 255, 0.5);
  margin: 20rpx;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 8rpx var(--light-shadow-color, rgba(0, 0, 0, 0.06));
  transition: all 0.3s ease;
}

.search-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  /* 输入框容器也改为磨砂玻璃样式 */
  background-color: rgba(245, 245, 245, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 2rpx solid rgba(255, 255, 255, 0.4);
  border-radius: 30rpx;
  padding: 0 20rpx;
  transition: all 0.3s ease;
}

.search-input {
  flex: 1;
  height: 60rpx;
  background-color: transparent;
  border: none;
  font-size: 26rpx;
  color: var(--text-primary, #333333);
  transition: all 0.3s ease;
  /* 移除图标后，无需给输入框预留间距，保持原有内边距即可 */
  outline: none;
}

.search-input::placeholder {
  color: var(--text-tertiary, #999999);
  transition: all 0.3s ease;
}

.search-btn {
  padding: 0 20rpx;
  height: auto;
  min-height: auto;
  line-height: 1.4;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: bold;
  /* 按钮同步磨砂玻璃风格：高透明渐变背景 */
  background: rgba(102, 126, 234, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  color: white;
  border: none;
  border-radius: 30rpx;
  transition: all 0.3s ease;
}

.search-btn:active {
  opacity: 0.85;
  transform: scale(0.98);
  /* 点击态加深背景透明度，保留交互反馈 */
  background: rgba(102, 126, 234, 0.8);
}

/* 深色模式样式适配：同步磨砂玻璃透明质感 */
.dark-mode .search-bar {
  background-color: rgba(45, 45, 45, 0.4);
  border-color: rgba(64, 64, 64, 0.5);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.3);
}

.dark-mode .search-input-wrapper {
  background-color: rgba(61, 61, 61, 0.6);
  border-color: rgba(64, 64, 64, 0.4);
}

.dark-mode .search-input {
  color: #ffffff;
}

.dark-mode .search-input::placeholder {
  color: #888888;
}

.dark-mode .search-btn {
  background: rgba(102, 126, 234, 0.7);
}

.dark-mode .search-btn:active {
  background: rgba(102, 126, 234, 0.9);
}
</style>