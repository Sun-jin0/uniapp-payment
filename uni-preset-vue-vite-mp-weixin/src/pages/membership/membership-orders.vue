<template>
  <view class="container" :class="{ 'dark-mode': isDarkMode }">
    <!-- 头部 -->
    <view class="header-section">
      <view class="header-content">
        <text class="header-title">我的会员</text>
        <text class="header-sub">会员状态与订单记录</text>
      </view>
    </view>

    <!-- 会员状态卡片 -->
    <view class="membership-card" v-if="membership">
      <view class="membership-card-body">
        <view class="membership-icon">
          <text class="membership-icon-text">VIP</text>
        </view>
        <view class="membership-info">
          <text class="membership-name">{{ membership.card_name || '会员' }}</text>
          <text class="membership-status" :class="{ active: membership.status === 'active' }">
            {{ membership.status === 'active' ? '会员生效中' : '会员已过期' }}
          </text>
          <text class="membership-expire">有效期至 {{ formatDateOnly(membership.expire_at) }} · 剩余 {{ remainDays }} 天</text>
        </view>
      </view>
      <button class="renew-btn" @tap="goToBuy">{{ membership.status === 'active' ? '续费会员' : '重新开通' }}</button>
    </view>
    <view class="membership-card empty" v-else>
      <view class="membership-empty-text">您还不是会员</view>
      <button class="renew-btn" @tap="goToBuy">立即开通</button>
    </view>

    <!-- 订单列表标题 -->
    <view class="section-title">订单记录</view>

    <!-- 订单列表 -->
    <view class="order-list">
      <view v-if="orders.length === 0" class="empty-tip">暂无订单记录</view>
      <view
        v-for="item in orders"
        :key="item.id"
        class="order-card"
        @tap="showOrderDetail(item)"
      >
        <view class="order-header">
          <text class="order-no">{{ item.order_no }}</text>
          <text :class="getStatusClass(item.status)">{{ getStatusText(item.status) }}</text>
        </view>
        <view class="order-body">
          <view class="order-info-row">
            <text class="order-label">会员卡</text>
            <text class="order-value">{{ item.card_name }} ({{ item.duration_days }}天)</text>
          </view>
          <view class="order-info-row">
            <text class="order-label">实付金额</text>
            <text class="order-value price">¥{{ item.final_price }}</text>
          </view>
          <view class="order-info-row" v-if="item.discount_code">
            <text class="order-label">优惠码</text>
            <text class="order-value">{{ item.discount_code }} (-¥{{ item.discount_amount }})</text>
          </view>
          <view class="order-info-row">
            <text class="order-label">创建时间</text>
            <text class="order-value">{{ formatDate(item.created_at) }}</text>
          </view>
          <view class="order-info-row" v-if="item.membership_end">
            <text class="order-label">会员到期</text>
            <text class="order-value">{{ formatDate(item.membership_end) }}</text>
          </view>
          <view class="order-info-row" v-if="item.refund_reason">
            <text class="order-label">退款原因</text>
            <text class="order-value">{{ item.refund_reason }}</text>
          </view>
        </view>
        <view class="order-footer" v-if="item.status === 'pending'">
          <button class="pay-btn" @tap.stop="payOrder(item)">立即支付</button>
          <button class="cancel-btn" @tap.stop="cancelOrder(item)">取消订单</button>
        </view>
        <view class="order-footer" v-if="canRefund(item)">
          <button class="refund-btn" @tap.stop="refundOrder(item)">申请退款</button>
        </view>
        <view class="order-footer" v-if="canDelete(item)">
          <button class="delete-btn" @tap.stop="deleteOrder(item)">删除订单</button>
        </view>
      </view>
    </view>

    <!-- 分页 -->
    <view class="pagination" v-if="total > pageSize">
      <button class="page-btn" :disabled="page <= 1" @tap="prevPage">上一页</button>
      <text class="page-info">{{ page }} / {{ Math.ceil(total / pageSize) }}</text>
      <button class="page-btn" :disabled="page >= Math.ceil(total / pageSize)" @tap="nextPage">下一页</button>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import membershipApi from '@/api/membership.js';

const isDarkMode = ref(false);
const orders = ref([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const membership = ref(null);

const getStatusClass = (status) => {
  const classes = {
    pending: 'status-pending',
    paid: 'status-paid',
    active: 'status-active',
    refunded: 'status-refunded',
    cancelled: 'status-cancelled'
  };
  return classes[status] || '';
};

const getStatusText = (status) => {
  const texts = {
    pending: '待支付',
    paid: '已支付',
    active: '已激活',
    refunded: '已退款',
    cancelled: '已取消'
  };
  return texts[status] || status;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const remainDays = computed(() => {
  if (!membership.value || membership.value.status !== 'active') return 0;
  const expire = new Date(membership.value.expire_at);
  const now = new Date();
  return Math.max(0, Math.ceil((expire - now) / (24 * 60 * 60 * 1000)));
});

const formatDateOnly = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const loadMembership = async () => {
  try {
    const res = await membershipApi.getMyMembership();
    if (res.code === 0) {
      membership.value = res.data;
    }
  } catch (e) {
    console.error('loadMembership error:', e);
  }
};

const goToBuy = () => {
  uni.navigateTo({ url: '/pages/membership/membership-buy' });
};

const canRefund = (item) => {
  return item.status === 'paid' || item.status === 'active';
};

const canDelete = (item) => {
  return item.status === 'cancelled' || item.status === 'refunded';
};

const deleteOrder = async (item) => {
  uni.showModal({
    title: '确认删除',
    content: '删除后订单将无法恢复，确定删除吗？',
    confirmColor: '#ef4444',
    success: async (r) => {
      if (!r.confirm) return;
      try {
        const res = await membershipApi.deleteOrder(item.order_no);
        if (res.code === 0) {
          uni.showToast({ title: '已删除', icon: 'success' });
          loadOrders();
        } else {
          uni.showToast({ title: res.message || '删除失败', icon: 'none' });
        }
      } catch (e) {
        uni.showToast({ title: '删除失败', icon: 'none' });
      }
    }
  });
};

const refundOrder = async (item) => {
  uni.showModal({
    title: '申请退款',
    editable: true,
    placeholderText: '请输入退款原因',
    success: async (r) => {
      if (!r.confirm || !r.content) return;
      try {
        const res = await membershipApi.refundOrder(item.order_no, r.content);
        if (res.code === 0) {
          uni.showToast({ title: '退款成功', icon: 'success' });
          loadOrders();
          loadMembership();
        } else {
          uni.showToast({ title: res.message || '退款失败', icon: 'none' });
        }
      } catch (e) {
        uni.showToast({ title: '退款失败', icon: 'none' });
      }
    }
  });
};

const loadOrders = async () => {
  try {
    const res = await membershipApi.getMyOrders({ page: page.value, pageSize: pageSize.value });
    if (res.code === 0) {
      orders.value = res.data?.list || [];
      total.value = res.data?.total || 0;
    }
  } catch (e) {
    console.error('loadOrders error:', e);
  }
};

const prevPage = () => {
  if (page.value > 1) {
    page.value--;
    loadOrders();
  }
};

const nextPage = () => {
  if (page.value < Math.ceil(total.value / pageSize.value)) {
    page.value++;
    loadOrders();
  }
};

const payOrder = async (item) => {
  uni.showModal({
    title: '确认支付',
    content: `支付 ¥${item.final_price} 开通会员？`,
    success: async (r) => {
      if (!r.confirm) return;
      try {
        const res = await membershipApi.payOrder(item.order_no);
        if (res.code === 0) {
          uni.showToast({ title: '支付成功', icon: 'success' });
          loadOrders();
        } else {
          uni.showToast({ title: res.message || '支付失败', icon: 'none' });
        }
      } catch (e) {
        uni.showToast({ title: '支付失败', icon: 'none' });
      }
    }
  });
};

const cancelOrder = async (item) => {
  uni.showModal({
    title: '确认取消',
    content: '确定取消该订单吗？',
    success: async (r) => {
      if (!r.confirm) return;
      try {
        const res = await membershipApi.cancelOrder(item.order_no);
        if (res.code === 0) {
          uni.showToast({ title: '已取消', icon: 'success' });
          loadOrders();
        } else {
          uni.showToast({ title: res.message || '取消失败', icon: 'none' });
        }
      } catch (e) {
        uni.showToast({ title: '取消失败', icon: 'none' });
      }
    }
  });
};

const showOrderDetail = (item) => {
  // 可以跳转到详情页或显示弹窗
  uni.showToast({ title: item.order_no, icon: 'none' });
};

onMounted(() => {
  loadOrders();
  loadMembership();
  const currentTheme = uni.getStorageSync('themeMode') || 'light';
  isDarkMode.value = currentTheme === 'dark';
});
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 40rpx;
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

/* 会员状态卡片 */
.membership-card {
  background: white;
  border-radius: 20rpx;
  padding: 30rpx;
  margin: -40rpx 30rpx 20rpx;
  box-shadow: 0 8rpx 30rpx rgba(0, 0, 0, 0.06);
  position: relative;
  z-index: 1;
}

.membership-card.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
}

.membership-empty-text {
  font-size: 28rpx;
  color: #9ca3af;
}

.membership-card-body {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-bottom: 20rpx;
}

.membership-icon {
  width: 80rpx;
  height: 80rpx;
  background: #ff9800;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.membership-icon-text {
  font-size: 28rpx;
  font-weight: bold;
  color: #fff;
}

.membership-info {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.membership-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.membership-status {
  font-size: 24rpx;
  color: #ef4444;
}

.membership-status.active {
  color: #22c55e;
}

.membership-expire {
  font-size: 24rpx;
  color: #666;
}

.renew-btn {
  width: 100%;
  background: #ff9800;
  color: white;
  font-size: 28rpx;
  border-radius: 12rpx;
  line-height: 80rpx;
}

/* 区块标题 */
.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  padding: 20rpx 30rpx 10rpx;
}

.order-list {
  padding: 20rpx 30rpx 30rpx;
}

.empty-tip {
  text-align: center;
  padding: 60rpx;
  color: #9ca3af;
  font-size: 28rpx;
}

.order-card {
  background: white;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.02);
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.order-no {
  font-size: 26rpx;
  color: #666;
}

.status-pending { color: #f59e0b; font-size: 26rpx; }
.status-paid { color: #3b82f6; font-size: 26rpx; }
.status-active { color: #22c55e; font-size: 26rpx; }
.status-refunded { color: #ef4444; font-size: 26rpx; }
.status-cancelled { color: #6b7280; font-size: 26rpx; }

.order-body {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.order-info-row {
  display: flex;
  justify-content: space-between;
}

.order-label {
  font-size: 26rpx;
  color: #666;
}

.order-value {
  font-size: 26rpx;
  color: #333;
}

.order-value.price {
  font-weight: bold;
  color: #ff9800;
}

.order-footer {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #eee;
}

.pay-btn {
  flex: 1;
  background: #ff9800;
  color: white;
  font-size: 26rpx;
  border-radius: 12rpx;
  line-height: 70rpx;
}

.cancel-btn {
  flex: 1;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 26rpx;
  border-radius: 12rpx;
  line-height: 70rpx;
}

.refund-btn {
  flex: 1;
  background: #fef2f2;
  color: #ef4444;
  font-size: 26rpx;
  border-radius: 12rpx;
  line-height: 70rpx;
}

.delete-btn {
  flex: 1;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 26rpx;
  border-radius: 12rpx;
  line-height: 70rpx;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20rpx;
  margin-top: 20rpx;
}

.page-btn {
  padding: 12rpx 24rpx;
  font-size: 26rpx;
  background: white;
  border-radius: 12rpx;
}

.page-btn[disabled] {
  opacity: 0.5;
}

.page-info {
  font-size: 26rpx;
  color: #666;
}

/* 夜间模式 */
.dark-mode.container {
  background: #1a1a1a;
}

.dark-mode .order-card {
  background: #2c2c2c;
}

.dark-mode .order-no,
.dark-mode .order-label {
  color: #888;
}

.dark-mode .order-value {
  color: #f0f0f0;
}

.dark-mode .order-footer {
  border-top-color: #444;
}

.dark-mode .page-btn {
  background: #2c2c2c;
}
</style>