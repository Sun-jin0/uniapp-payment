<template>
  <view class="app-container" :class="{ 'dark-mode': isDarkMode }">
    <slot></slot>
    <!-- 全局隐私协议弹窗 -->
    <PrivacyAgreement ref="privacyAgreementRef" />
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import PrivacyAgreement from '@/components/PrivacyAgreement/PrivacyAgreement.vue';
import { setPrivacyAgreementRef } from '@/utils/clipboard.js';

// 当前主题状态
const isDarkMode = ref(false);

// 全局分享配置
// 微信小程序分享功能已在 main.js 中通过全局 mixin 配置

// 更新导航栏样式
const updateNavigationBarStyle = () => {
  if (isDarkMode.value) {
    // 添加try-catch避免页面未找到等错误
    try {
      uni.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: '#1a1a1a',
        animation: {
          duration: 200,
          timingFunc: 'easeInOut'
        }
      });
    } catch (error) {
      console.log('setNavigationBarColor error:', error);
    }
    try {
      uni.setTabBarStyle({
        color: '#cccccc',
        selectedColor: '#8888ff',
        backgroundColor: '#2d2d2d',
        borderStyle: 'white'
      });
    } catch (error) {
      console.log('setTabBarStyle error:', error);
    }
  } else {
    try {
      uni.setNavigationBarColor({
        frontColor: '#000000',
        backgroundColor: '#f5f5f5',
        animation: {
          duration: 200,
          timingFunc: 'easeInOut'
        }
      });
    } catch (error) {
      console.log('setNavigationBarColor error:', error);
    }
    try {
      uni.setTabBarStyle({
        color: '#666666',
        selectedColor: '#3366FF',
        backgroundColor: '#FFFFFF',
        borderStyle: 'black'
      });
    } catch (error) {
      console.log('setTabBarStyle error:', error);
    }
  }
};

// 切换主题模式
const toggleTheme = (darkMode) => {
  isDarkMode.value = darkMode;
  // 保存主题状态到本地存储
  uni.setStorageSync('themeMode', darkMode ? 'dark' : 'light');
  // 更新导航栏样式
  updateNavigationBarStyle();
};

// 隐私协议弹窗引用
const privacyAgreementRef = ref(null);

// 初始化主题
onMounted(() => {
  // 首次加载强制使用白天模式，后续通过本地存储保存用户选择
  const currentTheme = 'light'; // 强制默认白天模式
  // uni.getStorageSync('themeMode') || 'light'; // 注释掉旧的读取逻辑
  isDarkMode.value = currentTheme === 'dark';
  // 保存默认主题到本地存储
  uni.setStorageSync('themeMode', currentTheme);
  // 更新导航栏样式
  updateNavigationBarStyle();

  // 监听主题变化事件
  uni.$on('themeChange', (darkMode) => {
    toggleTheme(darkMode);
  });

  // 设置隐私协议弹窗引用
  if (privacyAgreementRef.value) {
    setPrivacyAgreementRef(privacyAgreementRef.value);
  }
});
</script>

<style>
/* #ifdef MP-WEIXIN */
@import "../node_modules/@rojer/katex-mini/dist/index.wxss";
/* #endif */

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition: all 0.3s ease;
}

/* 代码块样式 */
pre {
  background-color: #f6f8fa;
  border-radius: 8rpx;
  padding: 20rpx;
  margin: 20rpx 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  font-family: 'Courier New', Courier, monospace;
  font-size: inherit;
  border: 1rpx solid #e1e4e8;
  line-height: 1.5;
  white-space: pre;
  word-break: normal;
  word-wrap: normal;
  display: block;
  max-width: 100%;
}

/* 代码块外层容器 - 确保可以横向滚动 */
.code-block-wrapper,
pre {
  overflow-x: auto !important;
  -webkit-overflow-scrolling: touch !important;
}

/* 代码块滚动容器 - 微信小程序兼容 */
.code-scroll-wrapper,
.code-scroll-container {
  width: 100% !important;
  overflow-x: auto !important;
  -webkit-overflow-scrolling: touch !important;
  box-sizing: border-box;
  touch-action: pan-x pan-y !important;
  user-select: text !important;
  -webkit-user-select: text !important;
  position: relative !important;
}

.code-scroll-wrapper pre,
.code-scroll-container pre {
  min-width: fit-content !important;
  white-space: pre !important;
  word-break: normal !important;
  overflow-x: visible !important;
  pointer-events: auto !important;
}

/* 代码块横向滚动提示 */
.code-scroll-container::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 30px;
  background: linear-gradient(to right, transparent, rgba(224, 242, 241, 0.8));
  pointer-events: none;
}

/* 富文本中的代码块 */
.rich-text pre,
.wxParse pre,
.h2w__pre {
  overflow-x: auto !important;
  -webkit-overflow-scrolling: touch !important;
  white-space: pre !important;
  word-break: normal !important;
  word-wrap: normal !important;
  max-width: 100% !important;
}

/* 微信小程序 rich-text 组件中的代码块样式 */
rich-text pre,
rich-text .code-scroll-wrapper {
  overflow-x: scroll !important;
  -webkit-overflow-scrolling: touch !important;
}

code {
  background-color: #f6f8fa;
  padding: 4rpx 8rpx;
  border-radius: 4rpx;
  font-family: 'Courier New', Courier, monospace;
  color: #d73a49; /* 稍微给行内代码一点颜色 */
  font-size: inherit;
}

pre code {
  background-color: transparent;
  padding: 0;
  color: inherit;
  font-size: inherit;
}

.dark-mode pre {
  background-color: #2d2d2d;
  border-color: #444;
  color: #e6edf3;
}

.dark-mode code {
  background-color: #2d2d2d;
  color: #ff7b72;
}

.dark-mode pre code {
  background-color: transparent;
}

/* 下划线/填空位样式优化 */
span[style*="text-decoration: underline"],
span[style*="text-decoration:underline"] {
  display: inline-block;
  min-width: 120rpx;
  text-align: center;
  border-bottom: 2rpx solid #333;
  text-decoration: none !important; /* 取消原生的下划线，改用 border-bottom 效果更好 */
  margin: 0 8rpx;
  padding: 0 10rpx;
  vertical-align: bottom;
  line-height: 1.2;
}

.dark-mode span[style*="text-decoration: underline"],
.dark-mode span[style*="text-decoration:underline"] {
  border-bottom-color: #eee;
}

/* 应用容器 */
.app-container {
  min-height: 100vh;
  background-color: #f5f5f5;
  transition: all 0.3s ease;
}

/* 夜间模式 */
.dark-mode {
  background-color: #1a1a1a;
}

/* 页面容器 */
page {
  background-color: transparent;
}

/* 输入框默认样式 */
input, textarea {
  color: #333333;
  background-color: #ffffff;
  border: 1px solid #f0f0f0;
}

input::placeholder, textarea::placeholder {
  color: #999999;
}

/* 夜间模式输入框样式 */
.dark-mode input, .dark-mode textarea {
  color: #ffffff;
  background-color: #2d2d2d;
  border: 1px solid #404040;
}

.dark-mode input::placeholder, .dark-mode textarea::placeholder {
  color: #999999;
}
</style>
