<template>
  <!-- 隐私协议同意弹窗 -->
  <view class="privacy-modal" v-if="visible" @click="handleBackdropClick">
    <view class="privacy-content" @click.stop>
      <view class="privacy-title">隐私保护指引</view>
      <view class="privacy-body">
        <text class="privacy-text">
          在使用复制功能前，请您仔细阅读并同意{{ privacyContractName }}。
        </text>
        <view class="privacy-items">
          <view class="privacy-item">
            <text class="item-dot">•</text>
            <text class="item-text">我们需要使用您的剪贴板，用于复制分享码、链接、QQ群号等信息</text>
          </view>
        </view>
        <text class="privacy-link" @click="openPrivacyContract">查看完整隐私协议</text>
      </view>
      <view class="privacy-actions">
        <button class="privacy-btn disagree" @click="handleDisagree">不同意</button>
        <button
          class="privacy-btn agree"
          open-type="agreePrivacyAuthorization"
          @agreeprivacyauthorization="handleAgree"
        >同意</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const visible = ref(false);
const privacyContractName = ref('《小程序隐私保护指引》');
let resolvePromise = null;

// 显示隐私协议弹窗
const show = (name = '《小程序隐私保护指引》') => {
  privacyContractName.value = name;
  visible.value = true;
  return new Promise((resolve) => {
    resolvePromise = resolve;
  });
};

// 隐藏隐私协议弹窗
const hide = () => {
  visible.value = false;
  if (resolvePromise) {
    resolvePromise(false);
    resolvePromise = null;
  }
};

// 点击背景关闭
const handleBackdropClick = () => {
  hide();
};

// 不同意
const handleDisagree = () => {
  uni.showModal({
    title: '提示',
    content: '您需要同意隐私保护指引才能使用复制功能。',
    showCancel: false,
    confirmText: '知道了'
  });
  hide();
};

// 同意隐私协议
const handleAgree = () => {
  console.log('用户同意隐私协议');
  visible.value = false;
  if (resolvePromise) {
    resolvePromise(true);
    resolvePromise = null;
  }
};

// 打开官方隐私协议页面
const openPrivacyContract = () => {
  // #ifdef MP-WEIXIN
  wx.openPrivacyContract({
    success: () => {
      console.log('打开隐私协议成功');
    },
    fail: (err) => {
      console.error('打开隐私协议失败', err);
    }
  });
  // #endif
};

// 暴露方法给外部
defineExpose({
  show,
  hide
});
</script>

<style scoped>
.privacy-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.privacy-content {
  background: #fff;
  border-radius: 16rpx;
  width: 80%;
  max-width: 600rpx;
  padding: 40rpx;
}

.privacy-title {
  font-size: 36rpx;
  font-weight: 700;
  text-align: center;
  margin-bottom: 30rpx;
  color: #333;
}

.privacy-body {
  max-height: 600rpx;
  overflow-y: auto;
  margin-bottom: 30rpx;
}

.privacy-text {
  font-size: 28rpx;
  color: #666;
  line-height: 1.6;
  display: block;
  margin-bottom: 20rpx;
}

.privacy-items {
  margin-bottom: 20rpx;
}

.privacy-item {
  display: flex;
  margin-bottom: 16rpx;
}

.item-dot {
  font-size: 28rpx;
  color: #333;
  margin-right: 10rpx;
  flex-shrink: 0;
}

.item-text {
  font-size: 28rpx;
  color: #666;
  line-height: 1.5;
  flex: 1;
}

.privacy-link {
  font-size: 28rpx;
  color: #4a90e2;
  text-decoration: underline;
  display: block;
  text-align: center;
}

.privacy-actions {
  display: flex;
  gap: 20rpx;
}

.privacy-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  margin: 0;
  padding: 0;
  line-height: 80rpx;
}

.privacy-btn.disagree {
  background: #f5f5f5;
  color: #666;
}

.privacy-btn.agree {
  background: #4a90e2;
  color: #fff;
}

.privacy-btn.agree::after {
  border: none;
}
</style>