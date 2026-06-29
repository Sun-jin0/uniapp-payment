<template>
  <view class="webview-container">
    <web-view :src="webUrl"></web-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const webUrl = ref('')

onLoad((options) => {
  const token = uni.getStorageSync('token')
  const baseUrl = 'http://localhost:5175'
  
  if (token) {
    webUrl.value = `${baseUrl}/?token=${token}`
  } else {
    webUrl.value = baseUrl
  }
})
</script>

<style>
.webview-container {
  width: 100%;
  height: 100vh;
}
</style>
