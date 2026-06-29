<template>
  <view class="float-button-container" :style="containerStyle">
    <view 
      class="float-button" 
      :class="{ 'dark-mode': isDarkMode }"
      :style="buttonStyle"
      @click="handleClick"
    >
      <text class="float-button-icon">{{ icon }}</text>
    </view>
    <view 
      v-if="showTooltip && tooltipText" 
      class="float-button-tooltip"
      :class="{ 'dark-mode': isDarkMode }"
    >
      {{ tooltipText }}
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  icon: {
    type: String,
    default: '+'
  },
  tooltipText: {
    type: String,
    default: ''
  },
  right: {
    type: String,
    default: '24px'
  },
  bottom: {
    type: String,
    default: '100px'
  },
  backgroundColor: {
    type: String,
    default: 'rgba(255, 255, 255, 0.4)' // 降低亮色模式不透明度，更透明
  },
  size: {
    type: Number,
    default: 56
  }
});

const emit = defineEmits(['click']);

const isDarkMode = ref(false);

const containerStyle = computed(() => ({
  right: props.right,
  bottom: props.bottom
}));

const buttonStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  backgroundColor: props.backgroundColor
}));

const showTooltip = ref(false);

const handleClick = () => {
  emit('click');
};

onMounted(() => {
  const currentTheme = uni.getStorageSync('themeMode') || 'light';
  isDarkMode.value = currentTheme === 'dark';
  
  uni.$on('themeChange', (darkMode) => {
    isDarkMode.value = darkMode;
  });
});

onUnmounted(() => {
  uni.$off('themeChange');
});
</script>

<style scoped>
.float-button-container {
  position: fixed;
  z-index: 9999;
  display: flex;
  align-items: center;
}

/* 核心：更透明的磨砂玻璃 + 圆形样式 */
.float-button {
  width: 56px;
  height: 56px;
  border-radius: 50%; /* 保持完美圆形 */
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); /* 弱化阴影，适配高透明 */
  transition: all 0.3s ease;
  /* 磨砂玻璃核心属性，模糊度适度降低，更显通透 */
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px); /* 兼容移动端/小程序 */
  border: 1px solid rgba(255, 255, 255, 0.5); /* 降低边框不透明度，同步透明感 */
}

.float-button:active {
  transform: scale(0.95);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

/* 深色模式：同步降低背景和边框不透明度，更透明 */
.float-button.dark-mode {
  background-color: rgba(40, 40, 40, 0.4); /* 深色模式也更透明 */
  border-color: rgba(60, 60, 60, 0.5); /* 边框同步透明 */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.float-button-icon {
  font-size: 28px;
  color: #333;
  font-weight: bold;
  transition: color 0.3s ease;
}

/* 深色模式图标颜色适配 */
.float-button.dark-mode .float-button-icon {
  color: #eee;
}

.float-button-tooltip {
  position: absolute;
  right: 100%;
  margin-right: 12px;
  padding: 8px 12px;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  transform: translateX(10px);
  transition: all 0.3s ease;
  pointer-events: none;
  /* 提示框同步更透明的磨砂玻璃样式 */
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.4); /* 提示框边框更透明 */
  background-color: rgba(255, 255, 255, 0.5); /* 提示框背景更透明 */
  color: #333;
  font-size: 12px;
}

.float-button-container:hover .float-button-tooltip {
  opacity: 1;
  transform: translateX(0);
}

/* 深色模式提示框：同步更透明 */
.float-button-tooltip.dark-mode {
  background-color: rgba(30, 30, 30, 0.5); /* 深色提示框更透明 */
  border-color: rgba(60, 60, 60, 0.4); /* 深色提示框边框更透明 */
  color: #eee;
}
</style>