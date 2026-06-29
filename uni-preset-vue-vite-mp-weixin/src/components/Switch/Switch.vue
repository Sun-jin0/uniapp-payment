<template>
  <view 
    class="switch-container" 
    :class="{ 'disabled': disabled, 'dark-mode': isDarkMode }"
    @click="handleClick"
  >
    <view class="switch-track" :class="{ 'checked': modelValue }">
      <view class="switch-thumb" :class="{ 'checked': modelValue }"></view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: 'default'
  }
});

const emit = defineEmits(['update:modelValue', 'change']);

const isDarkMode = ref(false);

onMounted(() => {
  const currentTheme = uni.getStorageSync('themeMode') || 'light';
  isDarkMode.value = currentTheme === 'dark';
  
  uni.$on('themeChange', (darkMode) => {
    isDarkMode.value = darkMode;
  });
});

const handleClick = () => {
  if (props.disabled) return;
  const newValue = !props.modelValue;
  emit('update:modelValue', newValue);
  emit('change', newValue);
};
</script>

<style scoped>
.switch-container {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.switch-container.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.switch-track {
  position: relative;
  width: 44px;
  height: 24px;
  background-color: #e0e0e0;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.switch-track.checked {
  background-color: #667eea;
}

.switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background-color: #ffffff;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.switch-thumb.checked {
  transform: translateX(20px);
}

.dark-mode .switch-track {
  background-color: #3d3d3d;
}

.dark-mode .switch-track.checked {
  background-color: #667eea;
}

.dark-mode .switch-thumb {
  background-color: #ffffff;
}
</style>
