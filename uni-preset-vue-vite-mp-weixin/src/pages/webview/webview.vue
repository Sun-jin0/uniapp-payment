<template>
  <view class="webview-container">
    <web-view :src="url"></web-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';

const url = ref('');

onLoad((options) => {
  if (options.url) {
    url.value = decodeURIComponent(options.url);
    // 设置标题
    if (options.title) {
      uni.setNavigationBarTitle({
        title: decodeURIComponent(options.title)
      });
    }
  }
});
</script>

<style scoped>
.webview-container {
  width: 100%;
  height: 100vh;
}
</style>
