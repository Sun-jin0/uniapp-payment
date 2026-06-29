<template>
  <view class="float-action-menu" :style="{ right: position.right, bottom: position.bottom }">
    <transition name="fade">
      <view v-if="isExpanded && menuItems.length > 1" class="menu-overlay" @click="toggleMenu"></view>
    </transition>
    
    <view class="menu-items" :class="{ expanded: isExpanded && menuItems.length > 1 }">
      <view 
        v-for="(item, index) in menuItems" 
        :key="index"
        class="menu-item"
        :class="{ visible: isExpanded && menuItems.length > 1 }"
        :style="getItemStyle(index)"
        @click="handleItemClick(item, index)"
      >
        <view class="menu-item-content" :style="{ backgroundColor: item.color || '#007aff' }">
          <text class="menu-item-icon">{{ item.icon }}</text>
        </view>
        <text class="menu-item-label">{{ item.label }}</text>
      </view>
    </view>
    
    <view 
      class="main-button" 
      :class="{ expanded: isExpanded && menuItems.length > 1 }"
      :style="{ backgroundColor: mainButtonColor }"
      @click="handleMainClick"
    >
      <text class="main-button-icon">{{ isExpanded && menuItems.length > 1 ? '×' : mainIcon }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  menuItems: {
    type: Array,
    default: () => []
  },
  mainIcon: {
    type: String,
    default: '+'
  },
  mainButtonColor: {
    type: String,
    default: '#007aff'
  },
  position: {
    type: Object,
    default: () => ({ right: '20px', bottom: '100px' })
  }
});

const emit = defineEmits(['select', 'toggle']);

const isExpanded = ref(false);

const toggleMenu = () => {
  isExpanded.value = !isExpanded.value;
  emit('toggle', isExpanded.value);
};

const handleMainClick = () => {
  if (props.menuItems.length === 1) {
    emit('select', props.menuItems[0], 0);
  } else if (props.menuItems.length === 0) {
    emit('select', null, -1);
  } else {
    toggleMenu();
  }
};

const handleItemClick = (item, index) => {
  isExpanded.value = false;
  emit('select', item, index);
};

const getItemStyle = (index) => {
  if (!isExpanded.value || props.menuItems.length <= 1) return {};
  const total = props.menuItems.length;
  const angle = (index * (180 / (total - 1))) - 90;
  const radius = 70;
  const radian = (angle * Math.PI) / 180;
  const x = Math.cos(radian) * radius;
  const y = -Math.sin(radian) * radius;
  return {
    transform: `translate(${x}px, ${y}px) scale(1)`,
    opacity: 1
  };
};
</script>

<style scoped>
.float-action-menu {
  position: fixed;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent;
  z-index: -1;
}

.menu-items {
  position: absolute;
  bottom: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}

.menu-item {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translate(0, 0) scale(0);
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.menu-item.visible {
  pointer-events: auto;
}

.menu-item-content {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.menu-item-icon {
  color: #fff;
  font-size: 20px;
}

.menu-item-label {
  font-size: 10px;
  color: #666;
  margin-top: 4px;
  white-space: nowrap;
}

.main-button {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.main-button:active {
  transform: scale(0.95);
}

.main-button.expanded {
  transform: rotate(45deg);
}

.main-button-icon {
  color: #fff;
  font-size: 28px;
  font-weight: bold;
  transition: transform 0.3s ease;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
