<template>
  <view class="modal-mask" v-if="visible" @tap="handleMaskTap">
    <view class="modal-content" @tap.stop>
      <!-- 关闭按钮 -->
      <view class="modal-close" @tap="handleClose">
        <text class="close-x">×</text>
      </view>

      <!-- 标题区 -->
      <view class="modal-title-row">
        <text class="modal-title">开通{{ priceInfo?.displayName || '' }}会员</text>
      </view>

      <!-- 提示文字 -->
      <view class="tip-block">
        <text class="tip-text">前{{ freeLimit }}题免费，开通后解锁全部题库</text>
      </view>

      <!-- 价格卡片 -->
      <view class="price-card" v-if="priceInfo">
        <view class="price-left">
          <text class="price-symbol">¥</text>
          <text class="price-num">{{ priceInfo.price }}</text>
        </view>
        <view class="price-right">
          <text class="original-price">原价 ¥{{ priceInfo.originalPrice }}</text>
          <text class="duration-tag">{{ priceInfo.durationDays }}天有效</text>
        </view>
      </view>

      <!-- 权益列表 -->
      <view class="benefit-list">
        <view class="benefit-item">
          <view class="benefit-dot"></view>
          <text class="benefit-text">解锁全部{{ priceInfo?.displayName || '' }}题目</text>
        </view>
        <view class="benefit-item">
          <view class="benefit-dot"></view>
          <text class="benefit-text">无限次刷题练习</text>
        </view>
        <view class="benefit-item">
          <view class="benefit-dot"></view>
          <text class="benefit-text">有效期{{ priceInfo?.durationDays || 30 }}天</text>
        </view>
      </view>

      <!-- 开通按钮 -->
      <button 
        class="open-btn" 
        :class="{ loading: subscribing }"
        :disabled="subscribing"
        @tap="handleSubscribe"
      >
        <text>{{ subscribing ? '处理中...' : '立即开通' }}</text>
      </button>

      <view class="bottom-note">
        <text>支付后即时生效</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { subscribeMembership, getFreeLimit } from '@/composables/useMembershipCheck.js'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  subjectKey: {
    type: String,
    default: ''
  },
  priceInfo: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'success', 'login-required'])

const subscribing = ref(false)
const freeLimit = getFreeLimit()

const handleClose = () => {
  emit('close')
}

const handleMaskTap = () => {
  handleClose()
}

const handleSubscribe = async () => {
  const token = uni.getStorageSync('token')
  if (!token) {
    emit('login-required')
    return
  }

  if (subscribing.value) return
  subscribing.value = true

  try {
    const result = await subscribeMembership(props.subjectKey, props.priceInfo)

    if (result.success) {
      uni.showToast({
        title: result.message || '开通成功',
        icon: 'success'
      })
      
      setTimeout(() => {
        emit('success', result.data)
      }, 1200)
    } else {
      uni.showToast({
        title: result.message || '开通失败',
        icon: 'none'
      })
    }
  } catch (error) {
    console.error('订阅失败:', error)
    uni.showToast({
      title: '开通失败，请重试',
      icon: 'none'
    })
  } finally {
    subscribing.value = false
  }
}
</script>

<style scoped>
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.modal-content {
  width: 100%;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 40rpx 32rpx 48rpx;
  position: relative;
  animation: slideUp 0.25s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.modal-close {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  width: 52rpx;
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 50%;
}

.close-x {
  font-size: 28rpx;
  color: #999;
  line-height: 1;
}

.modal-title-row {
  margin-bottom: 20rpx;
  padding-top: 8rpx;
}

.modal-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #333;
}

.tip-block {
  margin-bottom: 24rpx;
}

.tip-text {
  font-size: 26rpx;
  color: #888;
}

.price-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fffbf0;
  border: 2rpx solid #ffe0b2;
  border-radius: 16rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 28rpx;
}

.price-left {
  display: flex;
  align-items: baseline;
}

.price-symbol {
  font-size: 28rpx;
  color: #ff9800;
  font-weight: bold;
}

.price-num {
  font-size: 52rpx;
  color: #ff9800;
  font-weight: bold;
  line-height: 1;
}

.price-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6rpx;
}

.original-price {
  font-size: 22rpx;
  color: #bbb;
  text-decoration: line-through;
}

.duration-tag {
  font-size: 22rpx;
  color: #fff;
  background: #ff9800;
  padding: 4rpx 16rpx;
  border-radius: 12rpx;
}

.benefit-list {
  margin-bottom: 32rpx;
}

.benefit-item {
  display: flex;
  align-items: center;
  padding: 10rpx 0;
}

.benefit-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #ff9800;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.benefit-text {
  font-size: 26rpx;
  color: #555;
}

.open-btn {
  width: 100%;
  height: 88rpx;
  background: #ff9800;
  color: #fff;
  font-size: 30rpx;
  font-weight: bold;
  border-radius: 44rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
}

.open-btn::after {
  border: none;
}

.open-btn.loading {
  opacity: 0.6;
}

.open-btn[disabled] {
  opacity: 0.4;
}

.bottom-note {
  text-align: center;
}

.bottom-note text {
  font-size: 22rpx;
  color: #bbb;
}
</style>
