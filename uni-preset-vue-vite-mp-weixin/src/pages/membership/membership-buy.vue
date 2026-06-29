<template>
  <view class="container" :class="{ 'dark-mode': isDarkMode }">
    <!-- 头部 -->
    <view class="header-section">
      <view class="header-content">
        <text class="header-title">开通会员</text>
        <text class="header-sub">畅刷全部题库，不受限制</text>
      </view>
    </view>

    <!-- 会员卡选择 -->
    <view class="section-card">
      <view class="section-title">选择会员卡</view>
      <view class="card-list">
        <view
          v-for="item in cardTypes"
          :key="item.id"
          class="card-item"
          :class="{ active: selectedCard?.id === item.id, disabled: !item.enabled }"
          @tap="item.enabled && selectCard(item)"
        >
          <view class="card-header">
            <text class="card-name">{{ item.display_name }}</text>
            <text class="card-duration">{{ item.duration_days ? item.duration_days + '天' : '永久' }}</text>
          </view>
          <view class="card-price-row">
            <text class="card-price">¥{{ item.price }}</text>
            <text class="card-original" v-if="item.original_price && item.original_price > item.price">¥{{ item.original_price }}</text>
            <text class="card-discount" v-if="item.original_price && item.original_price > item.price">{{ Math.round((1 - item.price / item.original_price) * 100) }}%OFF</text>
          </view>
          <text class="card-desc">{{ item.description }}</text>
          <view v-if="selectedCard?.id === item.id" class="card-badge">已选</view>
        </view>
      </view>
    </view>

    <!-- 全局折扣提示 -->
    <view class="section-card" v-if="priceResult?.globalDiscountAmount > 0">
      <view class="section-title">当前优惠</view>
      <view class="discount-success">
        <text class="success-icon">✓</text>
        <text class="success-text">{{ priceResult.globalDiscountName || '全局折扣' }}</text>
        <text class="success-amount">-¥{{ priceResult.globalDiscountAmount }}</text>
      </view>
    </view>

    <!-- 折扣码输入 -->
    <view class="section-card">
      <view class="section-title">优惠码</view>
      <view class="discount-input-row">
        <input
          class="discount-input"
          v-model="discountCode"
          placeholder="输入优惠码（可选）"
          :disabled="!selectedCard"
        />
        <button class="apply-btn" :disabled="!selectedCard || !discountCode" @tap="applyDiscount">
          应用
        </button>
      </view>
      <view v-if="discountResult" class="discount-result">
        <view v-if="discountResult.valid" class="discount-success">
          <text class="success-icon">✓</text>
          <text class="success-text">{{ discountResult.discountName }}</text>
          <text class="success-amount">-¥{{ discountResult.discountAmount }}</text>
        </view>
        <view v-else class="discount-error">
          <text class="error-icon">✗</text>
          <text class="error-text">{{ discountResult.message }}</text>
        </view>
      </view>
    </view>

    <!-- 订单确认 -->
    <view class="section-card" v-if="selectedCard">
      <view class="section-title">订单确认</view>
      <view class="order-summary">
        <view class="summary-row">
          <text class="summary-label">会员卡</text>
          <text class="summary-value">{{ selectedCard?.display_name }} ({{ selectedCard?.duration_days ? selectedCard?.duration_days + '天' : '永久' }})</text>
        </view>
        <view class="summary-row">
          <text class="summary-label">原价</text>
          <text class="summary-value">¥{{ originalPrice }}</text>
        </view>
        <view class="summary-row" v-if="discountAmount > 0">
          <text class="summary-label">优惠</text>
          <text class="summary-value discount">-¥{{ discountAmount }}</text>
        </view>
        <view class="summary-row total">
          <text class="summary-label">实付</text>
          <text class="summary-value price">¥{{ finalPrice }}</text>
        </view>
      </view>
    </view>

    <!-- 会员权益 -->
    <view class="section-card">
      <view class="section-title">会员权益</view>
      <view class="benefit-list">
        <view class="benefit-item">
          <text class="benefit-icon">✓</text>
          <text class="benefit-text">畅刷全部题库，不受每日限制</text>
        </view>
        <view class="benefit-item">
          <text class="benefit-icon">✓</text>
          <text class="benefit-text">会员专属错题本与收藏功能</text>
        </view>
        <view class="benefit-item">
          <text class="benefit-icon">✓</text>
          <text class="benefit-text">学习进度云端同步，换设备不丢失</text>
        </view>
      </view>
    </view>

    <!-- 购买按钮 -->
    <view class="buy-section" v-if="selectedCard">
      <button class="buy-btn" :loading="loading" :disabled="loading" @tap="createAndPay">
        立即开通 ¥{{ finalPrice }}
      </button>
      <text class="buy-tips">支付成功后立即生效</text>
    </view>

    <!-- 支付结果弹窗 -->
    <view class="modal-mask" v-if="showPayResult" @tap="showPayResult = false">
      <view class="modal-content success-modal" @tap.stop>
        <view class="success-icon-large">✓</view>
        <text class="success-title">支付成功</text>
        <text class="success-desc">会员已开通，有效期至 {{ formatDate(payResult.membershipEnd) }}</text>
        <button class="modal-btn" @tap="goBack">返回会员中心</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import membershipApi from '@/api/membership.js';

const isDarkMode = ref(false);
const cardTypes = ref([]);
const selectedCard = ref(null);
const discountCode = ref('');
const discountResult = ref(null);
const priceResult = ref(null);
const loading = ref(false);
const showPayResult = ref(false);
const payResult = ref(null);

const originalPrice = computed(() => {
  return selectedCard.value?.price || 0;
});

const discountAmount = computed(() => {
  let amount = 0;
  if (priceResult.value?.globalDiscountAmount > 0) amount += priceResult.value.globalDiscountAmount;
  if (discountResult.value?.valid) amount += discountResult.value.discountAmount;
  return amount;
});

const finalPrice = computed(() => {
  if (priceResult.value) {
    // 如果折扣码有效且已叠加，使用后端计算的最终价格
    if (discountResult.value?.valid && priceResult.value.codeDiscountAmount > 0) {
      return priceResult.value.finalPrice;
    }
    // 如果只有全局折扣
    if (!discountResult.value?.valid) {
      return priceResult.value.finalPrice;
    }
  }
  // 兜底计算
  return Math.max(0, originalPrice.value - discountAmount.value);
});

const selectCard = async (item) => {
  selectedCard.value = item;
  discountCode.value = '';
  discountResult.value = null;
  priceResult.value = null;
  await recalcPrice();
};

const recalcPrice = async () => {
  if (!selectedCard.value) return;
  try {
    const res = await membershipApi.calculatePrice({
      cardTypeId: selectedCard.value.id,
      discountCode: discountResult.value?.valid ? discountCode.value : null
    });
    if (res.code === 0) {
      priceResult.value = res.data;
    }
  } catch (e) {
    console.error('recalcPrice error:', e);
  }
};

const applyDiscount = async () => {
  if (!selectedCard.value || !discountCode.value) return;

  try {
    // 使用综合价格计算接口
    const res = await membershipApi.calculatePrice({
      cardTypeId: selectedCard.value.id,
      discountCode: discountCode.value
    });

    if (res.code === 0) {
      const data = res.data;
      if (data.codeDiscountAmount > 0 || data.codeDiscountId) {
        discountResult.value = {
          valid: true,
          discountId: data.codeDiscountId,
          discountAmount: data.codeDiscountAmount || 0,
          discountName: data.codeDiscountName || `优惠码 ${discountCode.value}`,
          message: '优惠码有效'
        };
      } else {
        discountResult.value = {
          valid: false,
          message: '优惠码无效或不可用'
        };
      }
      priceResult.value = data;
    } else {
      discountResult.value = {
        valid: false,
        message: res.message || '优惠码无效'
      };
    }
  } catch (e) {
    discountResult.value = {
      valid: false,
      message: '验证失败，请稍后重试'
    };
  }
};

// 创建订单并调起微信支付
// 参考: https://pay.weixin.qq.com/doc/v3/merchant/4012062524
const createAndPay = async () => {
  if (!selectedCard.value) return;

  loading.value = true;

  try {
    // 1. 创建订单
    const createRes = await membershipApi.createOrder({
      cardTypeId: selectedCard.value.id,
      discountCode: discountResult.value?.valid ? discountCode.value : null
    });

    if (createRes.code !== 0) {
      uni.showToast({ title: createRes.message || '创建订单失败', icon: 'none' });
      loading.value = false;
      return;
    }

    const orderNo = createRes.data.orderNo;
    const finalPrice = createRes.data.finalPrice || 0;

    // 测试模式：如果价格为0或需要模拟支付，使用原有模拟支付接口
    if (finalPrice === 0) {
      const payRes = await membershipApi.payOrder(orderNo);
      if (payRes.code === 0) {
        payResult.value = payRes.data;
        showPayResult.value = true;
      } else {
        uni.showToast({ title: payRes.message || '支付失败', icon: 'none' });
      }
      loading.value = false;
      return;
    }

    // 2. 获取微信支付参数
    const paymentRes = await membershipApi.createPayment(orderNo);

    if (paymentRes.code !== 0) {
      uni.showToast({ title: paymentRes.message || '获取支付参数失败', icon: 'none' });
      loading.value = false;
      return;
    }

    const { payParams } = paymentRes.data;

    // 3. 调起微信小程序支付
    uni.requestPayment({
      provider: 'wxpay',
      ...payParams,
      success: (res) => {
        // 支付成功，查询订单状态
        checkPayStatus(orderNo);
      },
      fail: (err) => {
        console.error('微信支付失败:', err);
        uni.showToast({ title: '支付已取消或失败', icon: 'none' });
        loading.value = false;
      }
    });
  } catch (e) {
    console.error('createAndPay error:', e);
    uni.showToast({ title: '支付失败，请稍后重试', icon: 'none' });
    loading.value = false;
  }
};

// 检查支付状态并显示结果
const checkPayStatus = async (orderNo) => {
  try {
    // 轮询查询订单状态（最多5次）
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const res = await membershipApi.getMyOrders({ status: 'active', page: 1, pageSize: 1 });

      // 查询最新订单状态
      const orderRes = await membershipApi.getMyOrders({ page: 1, pageSize: 1 });
      if (orderRes.code === 0 && orderRes.data.list.length > 0) {
        const order = orderRes.data.list.find(o => o.order_no === orderNo);
        if (order && order.status === 'active') {
          payResult.value = {
            orderNo: order.order_no,
            status: 'active',
            membershipEnd: order.membership_end
          };
          showPayResult.value = true;
          loading.value = false;
          return;
        }
      }
    }
    uni.showToast({ title: '支付处理中，请稍后查看', icon: 'none' });
  } catch (e) {
    console.error('checkPayStatus error:', e);
    uni.showToast({ title: '支付处理中，请稍后查看', icon: 'none' });
  }
  loading.value = false;
};

const goBack = () => {
  showPayResult.value = false;
  uni.navigateBack();
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const loadCardTypes = async () => {
  try {
    const res = await membershipApi.getCardTypes();
    if (res.code === 0) {
      cardTypes.value = (res.data || []).filter(c => c.enabled);
      if (cardTypes.value.length > 0) {
        selectedCard.value = cardTypes.value[0];
      }
    }
  } catch (e) {
    console.error('loadCardTypes error:', e);
  }
};

onMounted(() => {
  loadCardTypes();
  const currentTheme = uni.getStorageSync('themeMode') || 'light';
  isDarkMode.value = currentTheme === 'dark';
});
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 120rpx;
}

.header-section {
  background: #ff9800;
  padding: 60rpx 30rpx 80rpx;
}

.header-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.header-title {
  font-size: 44rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 12rpx;
}

.header-sub {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
}

.section-card {
  background: white;
  border-radius: 30rpx;
  margin: 30rpx;
  padding: 30rpx;
  box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.02);
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.card-item {
  padding: 28rpx 24rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
  border: 2rpx solid #e5e7eb;
  position: relative;
  overflow: hidden;
  transition: all 0.2s ease;
}

.card-item.active {
  background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
  border-color: #ff9800;
  box-shadow: 0 4rpx 16rpx rgba(255, 152, 0, 0.15);
}

.card-item.disabled {
  opacity: 0.5;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.card-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.card-duration {
  font-size: 24rpx;
  color: #ff9800;
  background: #fff7ed;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.card-price-row {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.card-price {
  font-size: 40rpx;
  font-weight: bold;
  color: #ff9800;
}

.card-original {
  font-size: 24rpx;
  color: #999;
  text-decoration: line-through;
}

.card-desc {
  font-size: 24rpx;
  color: #666;
}

.card-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  background: #ff9800;
  color: white;
  font-size: 20rpx;
  padding: 6rpx 16rpx;
  border-radius: 16rpx 0 16rpx 0;
  z-index: 1;
}

.card-discount {
  font-size: 20rpx;
  color: #fff;
  background: #ef4444;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  font-weight: bold;
}

.discount-input-row {
  display: flex;
  gap: 16rpx;
}

.discount-input {
  flex: 1;
  height: 80rpx;
  background: #f9fafb;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
}

.apply-btn {
  width: 120rpx;
  height: 80rpx;
  background: #ff9800;
  color: white;
  font-size: 28rpx;
  border-radius: 12rpx;
  line-height: 80rpx;
}

.apply-btn[disabled] {
  background: #ccc;
}

.discount-result {
  margin-top: 16rpx;
}

.discount-success {
  display: flex;
  align-items: center;
  background: #f0fdf4;
  padding: 16rpx;
  border-radius: 12rpx;
}

.success-icon {
  color: #22c55e;
  font-size: 28rpx;
  font-weight: bold;
  margin-right: 12rpx;
}

.success-text {
  flex: 1;
  font-size: 26rpx;
  color: #166534;
}

.success-amount {
  font-size: 28rpx;
  font-weight: bold;
  color: #22c55e;
}

.discount-error {
  display: flex;
  align-items: center;
  background: #fef2f2;
  padding: 16rpx;
  border-radius: 12rpx;
}

.error-icon {
  color: #ef4444;
  font-size: 28rpx;
  font-weight: bold;
  margin-right: 12rpx;
}

.error-text {
  font-size: 26rpx;
  color: #991b1b;
}

.order-summary {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
}

.summary-row.total {
  border-top: 1rpx solid #eee;
  padding-top: 20rpx;
  margin-top: 8rpx;
}

.summary-label {
  font-size: 28rpx;
  color: #666;
}

.summary-value {
  font-size: 28rpx;
  color: #333;
}

.summary-value.discount {
  color: #22c55e;
}

.summary-value.price {
  font-size: 36rpx;
  font-weight: bold;
  color: #ff9800;
}

.benefit-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.benefit-item {
  display: flex;
  align-items: center;
}

.benefit-icon {
  color: #22c55e;
  font-size: 28rpx;
  font-weight: bold;
  margin-right: 12rpx;
}

.benefit-text {
  font-size: 28rpx;
  color: #333;
}

.buy-section {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  padding: 30rpx;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.buy-btn {
  background: #ff9800;
  color: white;
  font-size: 32rpx;
  font-weight: bold;
  border-radius: 16rpx;
  line-height: 100rpx;
}

.buy-tips {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #999;
  margin-top: 12rpx;
}

/* 弹窗 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  width: 80%;
  background: #fff;
  border-radius: 24rpx;
  padding: 60rpx 40rpx;
}

.success-modal {
  text-align: center;
}

.success-icon-large {
  width: 100rpx;
  height: 100rpx;
  background: #22c55e;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 30rpx;
  font-size: 50rpx;
  color: white;
  font-weight: bold;
}

.success-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.success-desc {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 40rpx;
}

.modal-btn {
  background: #ff9800;
  color: white;
  font-size: 30rpx;
  border-radius: 12rpx;
  line-height: 80rpx;
}

/* 夜间模式 */
.dark-mode.container {
  background: #1a1a1a;
}

.dark-mode .section-card {
  background: #2c2c2c;
}

.dark-mode .section-title {
  color: #f0f0f0;
}

.dark-mode .card-item {
  background: #333;
}

.dark-mode .card-item.active {
  background: #3d2a1a;
}

.dark-mode .card-name {
  color: #f0f0f0;
}

.dark-mode .card-desc {
  color: #888;
}

.dark-mode .discount-input {
  background: #333;
  color: #f0f0f0;
}

.dark-mode .summary-label {
  color: #888;
}

.dark-mode .summary-value {
  color: #f0f0f0;
}

.dark-mode .benefit-text {
  color: #f0f0f0;
}

.dark-mode .buy-section {
  background: #2c2c2c;
}

.dark-mode .modal-content {
  background: #2c2c2c;
}

.dark-mode .success-title {
  color: #f0f0f0;
}

.dark-mode .success-desc {
  color: #888;
}
</style>