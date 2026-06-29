<template>
  <view class="rich-text-content-wrapper">
    <rich-text v-if="!hasImages" :nodes="processedContent"></rich-text>
    <view v-else class="content-with-images">
      <view v-for="(part, index) in contentParts" :key="index" class="content-part">
        <rich-text v-if="part.type === 'text'" :nodes="part.content"></rich-text>
        <view 
          v-else-if="part.type === 'image'" 
          class="image-wrapper"
          @tap="handleImageTap(part.src)"
        >
          <image 
            :src="part.src" 
            class="content-image"
            mode="widthFix"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  content: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['previewImage']);

// 检查是否包含图片
const hasImages = computed(() => {
  return props.content && props.content.includes('<img');
});

// 处理内容，将图片和文本分开
const contentParts = computed(() => {
  if (!props.content) return [{ type: 'text', content: '' }];
  
  const parts = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let lastIndex = 0;
  let match;
  
  while ((match = imgRegex.exec(props.content)) !== null) {
    // 添加图片前的文本
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: props.content.substring(lastIndex, match.index)
      });
    }
    
    // 添加图片
    parts.push({
      type: 'image',
      src: match[1]
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // 添加剩余文本
  if (lastIndex < props.content.length) {
    parts.push({
      type: 'text',
      content: props.content.substring(lastIndex)
    });
  }
  
  return parts.length > 0 ? parts : [{ type: 'text', content: props.content }];
});

// 处理后的内容（不含图片点击功能时使用）
const processedContent = computed(() => {
  return props.content || '';
});

// 处理图片点击
const handleImageTap = (url) => {
  console.log('图片被点击:', url);
  emit('previewImage', url);
};
</script>

<style scoped>
.rich-text-content-wrapper {
  width: 100%;
}

.content-with-images {
  width: 100%;
}

.content-part {
  width: 100%;
}

.image-wrapper {
  display: inline-block;
  max-width: 100%;
  margin: 12rpx 0;
  cursor: pointer;
}

.content-image {
  max-width: 100%;
  height: auto;
  border-radius: 8rpx;
  display: block;
}
</style>
