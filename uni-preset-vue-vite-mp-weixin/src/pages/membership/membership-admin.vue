<template>
  <view class="container" :class="{ 'dark-mode': isDarkMode }">
    <!-- 头部 -->
    <view class="header-section">
      <view class="header-content">
        <text class="header-title">会员管理后台</text>
        <text class="header-sub">会员卡 / 折扣 / 订单 / 设置</text>
      </view>
    </view>

    <!-- 统计卡片 -->
    <view class="stats-container">
      <view class="stats-card">
        <view class="stat-box">
          <text class="stat-num">{{ stats.totalMembers || 0 }}</text>
          <text class="stat-label">总会员</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-box">
          <text class="stat-num">{{ stats.activeMembers || 0 }}</text>
          <text class="stat-label">有效会员</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-box">
          <text class="stat-num">{{ stats.totalOrders || 0 }}</text>
          <text class="stat-label">总订单</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-box">
          <text class="stat-num">{{ stats.totalRevenue || 0 }}</text>
          <text class="stat-label">总收入</text>
        </view>
      </view>
    </view>

    <!-- Tab 切换 -->
    <view class="tab-bar">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-item"
        :class="{ active: activeTab === tab.key }"
        @tap="activeTab = tab.key"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>

    <!-- 会员卡管理 -->
    <view v-if="activeTab === 'cards'" class="tab-content">
      <view class="add-btn-row">
        <button class="add-btn" @tap="openCardAdd">+ 新增会员卡类型</button>
      </view>
      <view class="menu-group-card">
        <view
          v-for="(item, index) in cardTypes"
          :key="item.id"
          class="menu-item-row"
          :class="{ 'last-item': index === cardTypes.length - 1 }"
          @tap="openCardEdit(item)"
        >
          <view class="icon-box" style="background: #ff9800;">
            <text class="icon-text">{{ item.display_name?.charAt(0) }}</text>
          </view>
          <view class="item-info">
            <text class="item-label">{{ item.display_name }}</text>
            <text class="item-desc">
              <text class="price-current">¥{{ item.price }}</text>
              <text class="price-original" v-if="item.original_price && item.original_price > item.price">¥{{ item.original_price }}</text>
              <text class="price-discount" v-if="item.original_price && item.original_price > item.price">{{ Math.round((1 - item.price / item.original_price) * 100) }}%OFF</text>
              · {{ item.duration_days ? item.duration_days + '天' : '永久' }}
              <text v-if="!item.enabled" class="disabled-tag">已禁用</text>
            </text>
          </view>
          <view class="item-right">
            <view class="item-arrow"></view>
          </view>
        </view>
      </view>
    </view>

    <!-- 激活码管理 -->
    <view v-if="activeTab === 'activationCodes'" class="tab-content">
      <view class="add-btn-row">
        <button class="add-btn" @tap="openActivationCodeAdd">+ 新增激活码</button>
      </view>
      <view class="menu-group-card">
        <view v-if="activationCodes.length === 0" class="empty-tip">暂无激活码</view>
        <view
          v-for="(item, index) in activationCodes"
          :key="item.id"
          class="menu-item-row"
          :class="{ 'last-item': index === activationCodes.length - 1 }"
          @tap="openActivationCodeEdit(item)"
        >
          <view class="icon-box" style="background: #d1fae5;">
            <text class="icon-text" style="color: #10b981;">K</text>
          </view>
          <view class="item-info">
            <text class="item-label">{{ item.code }}</text>
            <text class="item-desc">
              {{ item.card_name }} · {{ item.duration_days ? item.duration_days + '天' : '永久' }}
              · 已用 {{ item.used_count }}/{{ item.max_uses }}
              <text v-if="!item.status" class="disabled-tag">已禁用</text>
            </text>
          </view>
          <view class="item-actions">
            <view class="copy-btn" @tap.stop="copyToClipboard(item.code)">复制</view>
            <switch :checked="item.status === 1" @change="toggleActivationCodeStatus(item, $event)" color="#10b981" />
            <view class="item-arrow delete" @tap.stop="deleteActivationCode(item)"></view>
          </view>
        </view>
      </view>
    </view>

    <!-- 折扣码管理 -->
    <view v-if="activeTab === 'discounts'" class="tab-content">
      <view class="add-btn-row">
        <button class="add-btn" @tap="openDiscountAdd">+ 新增折扣码</button>
      </view>
      <view class="menu-group-card">
        <view v-if="discounts.length === 0" class="empty-tip">暂无折扣码</view>
        <view
          v-for="(item, index) in discounts"
          :key="item.id"
          class="menu-item-row"
          :class="{ 'last-item': index === discounts.length - 1 }"
          @tap="openDiscountEdit(item)"
        >
          <view class="icon-box" style="background: #fef3c7;">
            <text class="icon-text" style="color: #f59e0b;">%</text>
          </view>
          <view class="item-info">
            <text class="item-label">{{ item.name }} ({{ item.code }})</text>
            <text class="item-desc">
              {{ item.discount_type === 'percentage' ? item.discount_value + '%' : '¥' + item.discount_value }}
              · 已用 {{ item.usage_count }}{{ item.usage_limit ? '/' + item.usage_limit : '' }}
              <text v-if="!item.status" class="disabled-tag">已禁用</text>
            </text>
          </view>
          <view class="item-actions">
            <view class="copy-btn" @tap.stop="copyToClipboard(item.code)">复制</view>
            <view class="item-arrow"></view>
          </view>
        </view>
      </view>
    </view>

    <!-- 订单管理 -->
    <view v-if="activeTab === 'orders'" class="tab-content">
      <!-- 筛选 -->
      <view class="filter-row">
        <picker mode="selector" :range="orderStatuses" range-key="label" @change="onStatusFilterChange">
          <view class="filter-picker">{{ currentStatusFilter?.label || '全部状态' }}</view>
        </picker>
      </view>

      <!-- 订单列表 -->
      <view class="menu-group-card">
        <view v-if="orders.length === 0" class="empty-tip">暂无订单</view>
        <view
          v-for="(item, index) in orders"
          :key="item.id"
          class="menu-item-row order-item"
          :class="{ 'last-item': index === orders.length - 1 }"
          @tap="openOrderDetail(item)"
        >
          <view class="icon-box" style="background: #ff9800;">
            <text class="icon-text">{{ item.card_name?.charAt(0) || 'V' }}</text>
          </view>
          <view class="item-info">
            <text class="item-label">{{ item.order_no }}</text>
            <text class="item-desc">
              {{ item.card_name }} · {{ item.username || '用户' + item.user_id }}
              · ¥{{ item.final_price }}
              <text :class="getStatusClass(item.status)">{{ getStatusText(item.status) }}</text>
            </text>
            <text class="item-time">{{ formatDate(item.created_at) }}</text>
          </view>
          <view class="item-right">
            <view class="item-arrow"></view>
          </view>
        </view>
      </view>

      <!-- 分页 -->
      <view class="pagination" v-if="orderTotal > orderPageSize">
        <button class="page-btn" :disabled="orderPage <= 1" @tap="prevOrderPage">上一页</button>
        <text class="page-info">{{ orderPage }} / {{ Math.ceil(orderTotal / orderPageSize) }}</text>
        <button class="page-btn" :disabled="orderPage >= Math.ceil(orderTotal / orderPageSize)" @tap="nextOrderPage">下一页</button>
      </view>
    </view>

    <!-- 会员订阅管理 -->
    <view v-if="activeTab === 'memberships'" class="tab-content">
      <view class="menu-group-card">
        <view v-if="memberships.length === 0" class="empty-tip">暂无会员订阅</view>
        <view
          v-for="(item, index) in memberships"
          :key="item.id"
          class="menu-item-row"
          :class="{ 'last-item': index === memberships.length - 1 }"
          @tap="openMembershipEdit(item)"
        >
          <view class="icon-box" style="background: #ff9800;">
            <text class="icon-text">V</text>
          </view>
          <view class="item-info">
            <text class="item-label">用户 {{ item.username || item.user_id }}</text>
            <text class="item-desc">
              {{ item.card_name || '会员' }}
              · {{ formatDate(item.expire_at) }}到期
              · 剩余 {{ calcRemainDays(item.expire_at) }} 天
              <text :class="item.status === 'active' ? 'status-active' : 'status-expired'">
                {{ item.status === 'active' ? '有效' : '已过期' }}
              </text>
            </text>
          </view>
          <view class="item-right">
            <view class="item-arrow"></view>
          </view>
        </view>
      </view>
    </view>

    <!-- 全局设置 -->
    <view v-if="activeTab === 'settings'" class="tab-content">
      <view class="menu-group-card">
        <view class="form-row">
          <text class="form-label">免费题目数</text>
          <input class="form-input" type="number" v-model="settings.free_question_limit" placeholder="默认20" />
        </view>
        <view class="menu-divider"></view>
        <view class="form-row">
          <text class="form-label">新用户试用天数</text>
          <input class="form-input" type="number" v-model="settings.trial_days" placeholder="0" />
        </view>
        <view class="menu-divider"></view>
        <view class="form-row">
          <text class="form-label">续费优惠%</text>
          <input class="form-input" type="number" v-model="settings.renewal_discount" placeholder="10" />
        </view>
        <view class="menu-divider"></view>
        <view class="form-row">
          <text class="form-label">横幅文字</text>
          <input class="form-input" v-model="settings.membership_banner_text" placeholder="横幅文字" />
        </view>
      </view>
      <view class="save-btn-row">
        <button class="save-btn" @tap="saveSettings">保存设置</button>
      </view>
    </view>

    <!-- 会员卡编辑弹窗 -->
    <view class="modal-mask" v-if="showCardModal" @tap="showCardModal = false">
      <view class="modal-content" @tap.stop>
        <view class="modal-title">{{ editingCard?.id ? '编辑' : '新增' }}会员卡</view>
        <view class="form-row" v-if="!editingCard?.id">
          <text class="form-label">名称</text>
          <input class="form-input" v-model="cardForm.display_name" placeholder="如：月卡" />
        </view>
        <view class="form-row" v-if="!editingCard?.id">
          <text class="form-label">标识key</text>
          <input class="form-input" v-model="cardForm.card_key" placeholder="如：monthly" />
        </view>
        <view class="form-row">
          <text class="form-label">当前价格</text>
          <input class="form-input" type="digit" v-model="cardForm.price" placeholder="如：9.9" />
        </view>
        <view class="form-row">
          <text class="form-label">原价</text>
          <input class="form-input" type="digit" v-model="cardForm.original_price" placeholder="如：29.9" />
        </view>
        <view class="form-row">
          <text class="form-label">有效期(天)</text>
          <input class="form-input" type="number" v-model="cardForm.duration_days" placeholder="如：30，0表示永久" />
        </view>
        <view class="form-row">
          <text class="form-label">描述</text>
          <input class="form-input" v-model="cardForm.description" placeholder="会员卡描述" />
        </view>
        <view class="form-row inline">
          <text class="form-label">启用</text>
          <switch :checked="cardForm.enabled" @change="e => cardForm.enabled = e.detail.value ? 1 : 0" />
        </view>
        <view class="modal-actions">
          <button class="modal-btn cancel" @tap="showCardModal = false">取消</button>
          <button class="modal-btn confirm" @tap="saveCard">保存</button>
        </view>
      </view>
    </view>

    <!-- 全局折扣编辑弹窗 -->
    <!-- 激活码弹窗 -->
    <view class="modal-mask" v-if="showActivationCodeModal" @tap="showActivationCodeModal = false">
      <view class="modal-content" @tap.stop>
        <view class="modal-title">{{ editingActivationCode?.id ? '编辑' : '新增' }}激活码</view>
        <view v-if="editingActivationCode?.id" class="form-row">
          <text class="form-label">激活码</text>
          <input class="form-input" v-model="activationCodeForm.code" disabled />
        </view>
        <view class="form-row">
          <text class="form-label">会员卡类型</text>
          <picker mode="selector" :range="cardTypes" range-key="display_name" :value="cardTypeIndex" @change="onCardTypeChange">
            <view class="picker">{{ cardTypes[cardTypeIndex]?.display_name || '请选择' }}</view>
          </picker>
        </view>
        <view class="form-row">
          <text class="form-label">会员时长(天)</text>
          <input class="form-input" v-model="activationCodeForm.durationDays" type="number" placeholder="如 30，0表示永久" />
        </view>
        <view class="form-row">
          <text class="form-label">可兑换次数</text>
          <input class="form-input" v-model="activationCodeForm.maxUses" type="number" placeholder="默认1次" />
        </view>
        <view class="form-row" v-if="!editingActivationCode?.id">
          <text class="form-label">生成数量</text>
          <input class="form-input" v-model="activationCodeForm.count" type="number" placeholder="批量生成数量" />
        </view>
        <view class="form-row" v-if="!editingActivationCode?.id">
          <text class="form-label">自定义码(可选)</text>
          <input class="form-input" v-model="activationCodeForm.code" placeholder="留空则自动生成7位码" />
        </view>
        <view class="form-row">
          <text class="form-label">备注</text>
          <input class="form-input" v-model="activationCodeForm.remark" placeholder="可选" />
        </view>
        <view class="modal-actions">
          <button class="modal-btn cancel" @tap="showActivationCodeModal = false">取消</button>
          <button class="modal-btn confirm" @tap="saveActivationCode">{{ editingActivationCode?.id ? '保存' : '生成' }}</button>
        </view>
      </view>
    </view>

    <view class="modal-mask" v-if="showGlobalDiscountModal" @tap="showGlobalDiscountModal = false">
      <view class="modal-content" @tap.stop>
        <view class="modal-title">{{ editingGlobalDiscount?.id ? '编辑' : '新增' }}全局折扣</view>
        <view class="form-row">
          <text class="form-label">名称</text>
          <input class="form-input" v-model="globalDiscountForm.name" placeholder="如 全场8折" />
        </view>
        <view class="form-row">
          <text class="form-label">类型</text>
          <picker mode="selector" :range="['百分比', '固定金额']" :value="globalDiscountForm.discount_type === 'fixed' ? 1 : 0" @change="e => globalDiscountForm.discount_type = e.detail.value === 1 ? 'fixed' : 'percentage'">
            <view class="picker">{{ globalDiscountForm.discount_type === 'fixed' ? '固定金额' : '百分比' }}</view>
          </picker>
        </view>
        <view class="form-row">
          <text class="form-label">折扣值</text>
          <input class="form-input" type="digit" v-model="globalDiscountForm.discount_value" placeholder="percentage填0-100" />
        </view>
        <view class="form-row">
          <text class="form-label">最低消费</text>
          <input class="form-input" type="digit" v-model="globalDiscountForm.min_amount" placeholder="0" />
        </view>
        <view class="form-row">
          <text class="form-label">最大优惠</text>
          <input class="form-input" type="digit" v-model="globalDiscountForm.max_discount" placeholder="留空表示不限制" />
        </view>
        <view class="form-row">
          <text class="form-label">适用卡类型</text>
          <input class="form-input" v-model="globalDiscountForm.applicable_cards" placeholder="all 或 1,2,3" />
        </view>
        <view class="form-row">
          <text class="form-label">开始时间</text>
          <input class="form-input" v-model="globalDiscountForm.start_time" placeholder="2026-01-01 00:00:00 或留空" />
        </view>
        <view class="form-row">
          <text class="form-label">结束时间</text>
          <input class="form-input" v-model="globalDiscountForm.end_time" placeholder="2026-12-31 23:59:59 或留空" />
        </view>
        <view class="form-row">
          <text class="form-label">优先级</text>
          <input class="form-input" type="number" v-model="globalDiscountForm.priority" placeholder="数字越大越优先" />
        </view>
        <view class="form-row inline">
          <text class="form-label">可与折扣码叠加</text>
          <switch :checked="globalDiscountForm.stackable" @change="e => globalDiscountForm.stackable = e.detail.value ? 1 : 0" />
        </view>
        <view class="form-row inline">
          <text class="form-label">启用</text>
          <switch :checked="globalDiscountForm.status" @change="e => globalDiscountForm.status = e.detail.value ? 1 : 0" />
        </view>
        <view class="modal-actions">
          <button class="modal-btn cancel" @tap="showGlobalDiscountModal = false">取消</button>
          <button v-if="editingGlobalDiscount?.id" class="modal-btn delete" @tap="deleteGlobalDiscount">删除</button>
          <button class="modal-btn confirm" @tap="saveGlobalDiscount">保存</button>
        </view>
      </view>
    </view>

    <!-- 折扣码编辑弹窗 -->
    <view class="modal-mask" v-if="showDiscountModal" @tap="showDiscountModal = false">
      <view class="modal-content" @tap.stop>
        <view class="modal-title">{{ editingDiscount?.id ? '编辑' : '新增' }}折扣码</view>
        <view class="form-row">
          <text class="form-label">优惠码</text>
          <input class="form-input" v-model="discountForm.code" placeholder="如 NEWUSER50" />
        </view>
        <view class="form-row">
          <text class="form-label">名称</text>
          <input class="form-input" v-model="discountForm.name" placeholder="如 新用户5折" />
        </view>
        <view class="form-row">
          <text class="form-label">类型</text>
          <picker mode="selector" :range="['百分比', '固定金额']" :value="discountForm.discount_type === 'fixed' ? 1 : 0" @change="e => discountForm.discount_type = e.detail.value === 1 ? 'fixed' : 'percentage'">
            <view class="picker">{{ discountForm.discount_type === 'fixed' ? '固定金额' : '百分比' }}</view>
          </picker>
        </view>
        <view class="form-row">
          <text class="form-label">折扣值</text>
          <input class="form-input" type="digit" v-model="discountForm.discount_value" placeholder="percentage填0-100" />
        </view>
        <view class="form-row">
          <text class="form-label">最低消费</text>
          <input class="form-input" type="digit" v-model="discountForm.min_amount" placeholder="0" />
        </view>
        <view class="form-row">
          <text class="form-label">总限次</text>
          <input class="form-input" type="number" v-model="discountForm.usage_limit" placeholder="留空表示无限" />
        </view>
        <view class="form-row">
          <text class="form-label">每用户限次</text>
          <input class="form-input" type="number" v-model="discountForm.per_user_limit" placeholder="默认1" />
        </view>
        <view class="form-row inline">
          <text class="form-label">启用</text>
          <switch :checked="discountForm.status" @change="e => discountForm.status = e.detail.value ? 1 : 0" />
        </view>
        <view class="modal-actions">
          <button class="modal-btn cancel" @tap="showDiscountModal = false">取消</button>
          <button v-if="editingDiscount?.id" class="modal-btn delete" @tap="deleteDiscount">删除</button>
          <button class="modal-btn confirm" @tap="saveDiscount">保存</button>
        </view>
      </view>
    </view>

    <!-- 订单详情弹窗 -->
    <view class="modal-mask" v-if="showOrderModal" @tap="showOrderModal = false">
      <view class="modal-content order-modal" @tap.stop>
        <view class="modal-title">订单详情</view>
        <view class="order-detail-info">
          <view class="detail-row">
            <text class="detail-label">订单号</text>
            <text class="detail-value">{{ orderDetail?.order_no }}</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">用户</text>
            <text class="detail-value">{{ orderDetail?.username || '用户' + orderDetail?.user_id }}</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">会员卡</text>
            <text class="detail-value">{{ orderDetail?.card_name }}</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">原价</text>
            <text class="detail-value">¥{{ orderDetail?.original_price }}</text>
          </view>
          <view class="detail-row" v-if="orderDetail?.discount_code">
            <text class="detail-label">优惠码</text>
            <text class="detail-value">{{ orderDetail?.discount_code }} (-¥{{ orderDetail?.discount_amount }})</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">实付</text>
            <text class="detail-value price">¥{{ orderDetail?.final_price }}</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">状态</text>
            <text :class="getStatusClass(orderDetail?.status)">{{ getStatusText(orderDetail?.status) }}</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">创建时间</text>
            <text class="detail-value">{{ formatDate(orderDetail?.created_at) }}</text>
          </view>
          <view class="detail-row" v-if="orderDetail?.membership_end">
            <text class="detail-label">会员到期</text>
            <text class="detail-value">{{ formatDate(orderDetail?.membership_end) }}</text>
          </view>
        </view>

        <!-- 操作按钮 -->
        <view class="order-actions">
          <button v-if="orderDetail?.status === 'pending'" class="action-btn activate" @tap="activateOrder">手动激活</button>
          <button v-if="orderDetail?.status === 'pending'" class="action-btn cancel" @tap="cancelOrder">取消订单</button>
          <button v-if="orderDetail?.status === 'paid' || orderDetail?.status === 'active'" class="action-btn refund" @tap="refundOrder">退款</button>
          <button class="action-btn delete" @tap="deleteOrder">删除订单</button>
          <button class="action-btn close" @tap="showOrderModal = false">关闭</button>
        </view>
      </view>
    </view>

    <!-- 会员调整弹窗 -->
    <view class="modal-mask" v-if="showMembershipModal" @tap="showMembershipModal = false">
      <view class="modal-content" @tap.stop>
        <view class="modal-title">调整会员状态</view>
        <view class="detail-row">
          <text class="detail-label">用户</text>
          <text class="detail-value">{{ editingMembership?.username || '用户' + editingMembership?.user_id }}</text>
        </view>
        <view class="detail-row">
          <text class="detail-label">当前到期</text>
          <text class="detail-value">{{ formatDate(editingMembership?.expire_at) }}</text>
        </view>
        <view class="form-row">
          <text class="form-label">操作</text>
          <picker mode="selector" :range="membershipActions" range-key="label" @change="onMembershipActionChange">
            <view class="picker">{{ membershipAction?.label || '选择操作' }}</view>
          </picker>
        </view>
        <view class="form-row" v-if="membershipAction?.value === 'extend' || membershipAction?.value === 'activate'">
          <text class="form-label">天数</text>
          <input class="form-input" type="number" v-model="membershipDays" placeholder="延长/激活天数" />
        </view>
        <view class="form-row" v-if="membershipAction?.value === 'setExpire'">
          <text class="form-label">新到期日</text>
          <picker mode="date" :value="membershipExpireDate" @change="onExpireDateChange">
            <view class="picker">{{ membershipExpireDate || '选择日期' }}</view>
          </picker>
        </view>
        <view class="modal-actions">
          <button class="modal-btn cancel" @tap="showMembershipModal = false">取消</button>
          <button class="modal-btn confirm" @tap="adjustMembership">确认</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import adminApi from '@/api/admin.js';

const isDarkMode = ref(false);
const activeTab = ref('orders');
const tabs = [
  { key: 'cards', label: '会员卡' },
  { key: 'activationCodes', label: '激活码' },
  { key: 'discounts', label: '折扣码' },
  { key: 'orders', label: '订单' },
  { key: 'memberships', label: '会员' },
  { key: 'settings', label: '设置' },
];

const cardTypes = ref([]);
const globalDiscounts = ref([]);
const discounts = ref([]);
const settings = ref({});
const stats = ref({});
const orders = ref([]);
const memberships = ref([]);
const activationCodes = ref([]);

// 订单筛选
const orderStatuses = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待支付' },
  { value: 'paid', label: '已支付' },
  { value: 'active', label: '已激活' },
  { value: 'refunded', label: '已退款' },
  { value: 'cancelled', label: '已取消' },
];
const currentStatusFilter = ref(orderStatuses[0]);
const orderPage = ref(1);
const orderPageSize = ref(20);
const orderTotal = ref(0);

// 会员卡编辑
const showCardModal = ref(false);
const editingCard = ref(null);
const cardForm = ref({});

// 全局折扣编辑
const showGlobalDiscountModal = ref(false);
const editingGlobalDiscount = ref(null);
const globalDiscountForm = ref({
  name: '', discount_type: 'percentage', discount_value: '',
  min_amount: 0, max_discount: '', applicable_cards: 'all',
  start_time: '', end_time: '', priority: 0, stackable: 0, status: 1
});

// 折扣码编辑
const showDiscountModal = ref(false);
const editingDiscount = ref(null);
const discountForm = ref({
  code: '', name: '', discount_type: 'percentage', discount_value: '',
  min_amount: 0, usage_limit: '', per_user_limit: 1, status: 1
});

// 激活码
const showActivationCodeModal = ref(false);
const editingActivationCode = ref(null);
const activationCodeForm = ref({
  code: '', cardTypeId: '', durationDays: 30, maxUses: 1, remark: '', count: 1
});

// 订单详情
const showOrderModal = ref(false);
const orderDetail = ref(null);

// 会员调整
const showMembershipModal = ref(false);
const editingMembership = ref(null);
const membershipActions = [
  { value: 'extend', label: '延长会员' },
  { value: 'setExpire', label: '修改到期时间' },
  { value: 'cancel', label: '取消会员' },
  { value: 'activate', label: '重新激活' },
];
const membershipAction = ref(null);
const membershipDays = ref(30);
const membershipExpireDate = ref('');

const getStatusClass = (status) => {
  const classes = {
    pending: 'status-pending',
    paid: 'status-paid',
    active: 'status-active',
    refunded: 'status-refunded',
    cancelled: 'status-cancelled',
    expired: 'status-expired'
  };
  return classes[status] || '';
};

const getStatusText = (status) => {
  const texts = {
    pending: '待支付',
    paid: '已支付',
    active: '已激活',
    refunded: '已退款',
    cancelled: '已取消',
    expired: '已过期'
  };
  return texts[status] || status;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const calcRemainDays = (dateStr) => {
  if (!dateStr) return 0;
  const expire = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.ceil((expire - now) / (24 * 60 * 60 * 1000)));
};

// 加载函数
const loadCardTypes = async () => {
  try {
    const res = await adminApi.getCardTypes();
    if (res.code === 0) cardTypes.value = res.data || [];
  } catch (e) { console.error('loadCardTypes error:', e); }
};

const loadActivationCodes = async () => {
  try {
    const res = await adminApi.getActivationCodes();
    if (res.code === 0) activationCodes.value = res.data || [];
  } catch (e) { console.error('loadActivationCodes error:', e); }
};

const copyToClipboard = (text) => {
  uni.setClipboardData({
    data: text,
    success: () => {
      uni.showToast({ title: '已复制', icon: 'success' });
    }
  });
};

const openActivationCodeAdd = () => {
  editingActivationCode.value = null;
  activationCodeForm.value = {
    code: '', cardTypeId: cardTypes.value[0]?.id || '', durationDays: 30, maxUses: 1, remark: '', count: 1
  };
  showActivationCodeModal.value = true;
};

const openActivationCodeEdit = (item) => {
  editingActivationCode.value = item;
  activationCodeForm.value = {
    code: item.code,
    cardTypeId: item.card_type_id,
    durationDays: item.duration_days || 0,
    maxUses: item.max_uses,
    remark: item.remark || '',
    count: 1
  };
  showActivationCodeModal.value = true;
};

const cardTypeIndex = computed(() => {
  const id = activationCodeForm.value.cardTypeId;
  return cardTypes.value.findIndex(c => c.id === id);
});

const onCardTypeChange = (e) => {
  const idx = e.detail.value;
  if (cardTypes.value[idx]) {
    activationCodeForm.value.cardTypeId = cardTypes.value[idx].id;
    activationCodeForm.value.durationDays = cardTypes.value[idx].duration_days;
  }
};

const saveActivationCode = async () => {
  try {
    const form = activationCodeForm.value;
    if (!form.cardTypeId) {
      uni.showToast({ title: '请选择会员卡类型', icon: 'none' });
      return;
    }
    const data = {
      cardTypeId: parseInt(form.cardTypeId),
      durationDays: parseInt(form.durationDays) || 0,
      maxUses: parseInt(form.maxUses) || 1,
      remark: form.remark
    };
    let res;
    if (editingActivationCode.value?.id) {
      res = await adminApi.updateActivationCode(editingActivationCode.value.id, data);
    } else {
      if (!form.durationDays || form.durationDays < 0) {
        uni.showToast({ title: '请输入有效时长', icon: 'none' });
        return;
      }
      data.code = form.code || undefined;
      data.count = parseInt(form.count) || 1;
      res = await adminApi.createActivationCode(data);
    }
    if (res.code === 0) {
      uni.showToast({ title: res.message || (editingActivationCode.value?.id ? '保存成功' : '创建成功'), icon: 'success' });
      showActivationCodeModal.value = false;
      loadActivationCodes();
    } else {
      uni.showToast({ title: res.message || '操作失败', icon: 'none' });
    }
  } catch (e) {
    uni.showToast({ title: '操作失败', icon: 'none' });
  }
};

const toggleActivationCodeStatus = async (item, e) => {
  try {
    const newStatus = e.detail.value ? 1 : 0;
    const res = await adminApi.updateActivationCodeStatus(item.id, newStatus);
    if (res.code === 0) {
      uni.showToast({ title: newStatus === 1 ? '已启用' : '已禁用', icon: 'success' });
      loadActivationCodes();
    }
  } catch (e) {
    uni.showToast({ title: '操作失败', icon: 'none' });
  }
};

const deleteActivationCode = async (item) => {
  uni.showModal({
    title: '确认删除',
    content: `确定删除激活码 ${item.code} 吗？`,
    confirmColor: '#ef4444',
    success: async (r) => {
      if (!r.confirm) return;
      try {
        const res = await adminApi.deleteActivationCode(item.id);
        if (res.code === 0) {
          uni.showToast({ title: '删除成功', icon: 'success' });
          loadActivationCodes();
        }
      } catch (e) {
        uni.showToast({ title: '删除失败', icon: 'none' });
      }
    }
  });
};

const loadGlobalDiscounts = async () => {
  try {
    const res = await adminApi.getGlobalDiscounts();
    if (res.code === 0) globalDiscounts.value = res.data || [];
  } catch (e) { console.error('loadGlobalDiscounts error:', e); }
};

const loadDiscounts = async () => {
  try {
    const res = await adminApi.getDiscounts();
    if (res.code === 0) discounts.value = res.data || [];
  } catch (e) { console.error('loadDiscounts error:', e); }
};

const loadSettings = async () => {
  try {
    const res = await adminApi.getSettings();
    if (res.code === 0) {
      const data = res.data || {};
      settings.value = {
        free_question_limit: data.free_question_limit || '20',
        trial_days: data.trial_days || '0',
        renewal_discount: data.renewal_discount || '10',
        membership_banner_text: data.membership_banner_text || '',
      };
    }
  } catch (e) { console.error('loadSettings error:', e); }
};

const loadStats = async () => {
  try {
    const res = await adminApi.getStats();
    if (res.code === 0) stats.value = res.data || {};
  } catch (e) { console.error('loadStats error:', e); }
};

const loadOrders = async () => {
  try {
    const res = await adminApi.getOrders({
      status: currentStatusFilter.value?.value || '',
      page: orderPage.value,
      pageSize: orderPageSize.value
    });
    if (res.code === 0) {
      orders.value = res.data?.list || [];
      orderTotal.value = res.data?.total || 0;
    }
  } catch (e) { console.error('loadOrders error:', e); }
};

const loadMemberships = async () => {
  try {
    const res = await adminApi.getMemberships({ pageSize: 100 });
    if (res.code === 0) memberships.value = res.data?.list || [];
  } catch (e) { console.error('loadMemberships error:', e); }
};

// 筛选
const onStatusFilterChange = (e) => {
  currentStatusFilter.value = orderStatuses[e.detail.value];
  orderPage.value = 1;
  loadOrders();
};

const prevOrderPage = () => {
  if (orderPage.value > 1) {
    orderPage.value--;
    loadOrders();
  }
};

const nextOrderPage = () => {
  if (orderPage.value < Math.ceil(orderTotal.value / orderPageSize.value)) {
    orderPage.value++;
    loadOrders();
  }
};

// 会员卡编辑
const openCardAdd = () => {
  editingCard.value = null;
  cardForm.value = {
    display_name: '',
    card_key: '',
    price: '',
    original_price: '',
    duration_days: '',
    description: '',
    enabled: 1
  };
  showCardModal.value = true;
};

const openCardEdit = (item) => {
  editingCard.value = item;
  cardForm.value = {
    price: String(item.price || ''),
    original_price: String(item.original_price || ''),
    duration_days: String(item.duration_days || ''),
    description: item.description || '',
    enabled: item.enabled ? 1 : 0
  };
  showCardModal.value = true;
};

const saveCard = async () => {
  try {
    const form = cardForm.value;
    const data = {
      price: parseFloat(form.price),
      original_price: parseFloat(form.original_price || 0),
      duration_days: parseInt(form.duration_days),
      description: form.description,
      enabled: form.enabled ? 1 : 0
    };
    let res;
    if (editingCard.value?.id) {
      res = await adminApi.updateCardType(editingCard.value.id, data);
    } else {
      if (!form.display_name || !form.card_key) {
        uni.showToast({ title: '名称和标识不能为空', icon: 'none' });
        return;
      }
      data.display_name = form.display_name;
      data.card_key = form.card_key;
      res = await adminApi.createCardType(data);
    }
    if (res.code === 0) {
      uni.showToast({ title: '保存成功', icon: 'success' });
      showCardModal.value = false;
      loadCardTypes();
    } else {
      uni.showToast({ title: res.message || '保存失败', icon: 'none' });
    }
  } catch (e) {
    uni.showToast({ title: '保存失败', icon: 'none' });
  }
};

// 全局折扣编辑
const openGlobalDiscountAdd = () => {
  editingGlobalDiscount.value = null;
  globalDiscountForm.value = {
    name: '', discount_type: 'percentage', discount_value: '',
    min_amount: 0, max_discount: '', applicable_cards: 'all',
    start_time: '', end_time: '', priority: 0, stackable: 0, status: 1
  };
  showGlobalDiscountModal.value = true;
};

const openGlobalDiscountEdit = (item) => {
  editingGlobalDiscount.value = item;
  globalDiscountForm.value = {
    name: item.name, discount_type: item.discount_type,
    discount_value: String(item.discount_value), min_amount: item.min_amount || 0,
    max_discount: item.max_discount !== null ? String(item.max_discount) : '',
    applicable_cards: item.applicable_cards || 'all',
    start_time: item.start_time || '', end_time: item.end_time || '',
    priority: String(item.priority || 0), stackable: item.stackable ? 1 : 0, status: item.status
  };
  showGlobalDiscountModal.value = true;
};

const saveGlobalDiscount = async () => {
  try {
    const data = {
      name: globalDiscountForm.value.name,
      discount_type: globalDiscountForm.value.discount_type,
      discount_value: parseFloat(globalDiscountForm.value.discount_value),
      min_amount: parseFloat(globalDiscountForm.value.min_amount || 0),
      max_discount: globalDiscountForm.value.max_discount ? parseFloat(globalDiscountForm.value.max_discount) : null,
      applicable_cards: globalDiscountForm.value.applicable_cards || 'all',
      start_time: globalDiscountForm.value.start_time || null,
      end_time: globalDiscountForm.value.end_time || null,
      priority: parseInt(globalDiscountForm.value.priority || 0),
      stackable: globalDiscountForm.value.stackable ? 1 : 0,
      status: globalDiscountForm.value.status ? 1 : 0
    };
    let res;
    if (editingGlobalDiscount.value?.id) {
      res = await adminApi.updateGlobalDiscount(editingGlobalDiscount.value.id, data);
    } else {
      res = await adminApi.createGlobalDiscount(data);
    }
    if (res.code === 0) {
      uni.showToast({ title: '保存成功', icon: 'success' });
      showGlobalDiscountModal.value = false;
      loadGlobalDiscounts();
    } else {
      uni.showToast({ title: res.message || '保存失败', icon: 'none' });
    }
  } catch (e) {
    uni.showToast({ title: '保存失败', icon: 'none' });
  }
};

const deleteGlobalDiscount = async () => {
  if (!editingGlobalDiscount.value?.id) return;
  uni.showModal({
    title: '确认删除',
    content: '确定删除该全局折扣吗？',
    success: async (r) => {
      if (!r.confirm) return;
      try {
        const res = await adminApi.deleteGlobalDiscount(editingGlobalDiscount.value.id);
        if (res.code === 0) {
          uni.showToast({ title: '删除成功', icon: 'success' });
          showGlobalDiscountModal.value = false;
          loadGlobalDiscounts();
        }
      } catch (e) {
        uni.showToast({ title: '删除失败', icon: 'none' });
      }
    }
  });
};

// 折扣码编辑
const openDiscountAdd = () => {
  editingDiscount.value = null;
  discountForm.value = {
    code: '', name: '', discount_type: 'percentage', discount_value: '',
    min_amount: 0, usage_limit: '', per_user_limit: 1, status: 1
  };
  showDiscountModal.value = true;
};

const openDiscountEdit = (item) => {
  editingDiscount.value = item;
  discountForm.value = {
    code: item.code, name: item.name, discount_type: item.discount_type,
    discount_value: String(item.discount_value), min_amount: item.min_amount,
    usage_limit: item.usage_limit !== null ? String(item.usage_limit) : '',
    per_user_limit: String(item.per_user_limit), status: item.status
  };
  showDiscountModal.value = true;
};

const saveDiscount = async () => {
  try {
    const data = {
      code: discountForm.value.code, name: discountForm.value.name,
      discount_type: discountForm.value.discount_type,
      discount_value: parseFloat(discountForm.value.discount_value),
      min_amount: parseFloat(discountForm.value.min_amount || 0),
      usage_limit: discountForm.value.usage_limit ? parseInt(discountForm.value.usage_limit) : null,
      per_user_limit: parseInt(discountForm.value.per_user_limit || 1),
      status: discountForm.value.status ? 1 : 0
    };
    let res;
    if (editingDiscount.value?.id) {
      res = await adminApi.updateDiscount(editingDiscount.value.id, data);
    } else {
      res = await adminApi.createDiscount(data);
    }
    if (res.code === 0) {
      uni.showToast({ title: '保存成功', icon: 'success' });
      showDiscountModal.value = false;
      loadDiscounts();
    } else {
      uni.showToast({ title: res.message || '保存失败', icon: 'none' });
    }
  } catch (e) {
    uni.showToast({ title: '保存失败', icon: 'none' });
  }
};

const deleteDiscount = async () => {
  if (!editingDiscount.value?.id) return;
  uni.showModal({
    title: '确认删除',
    content: '确定删除该折扣码吗？',
    success: async (r) => {
      if (!r.confirm) return;
      try {
        const res = await adminApi.deleteDiscount(editingDiscount.value.id);
        if (res.code === 0) {
          uni.showToast({ title: '删除成功', icon: 'success' });
          showDiscountModal.value = false;
          loadDiscounts();
        }
      } catch (e) {
        uni.showToast({ title: '删除失败', icon: 'none' });
      }
    }
  });
};

// 订单详情
const openOrderDetail = async (item) => {
  orderDetail.value = item;
  showOrderModal.value = true;
};

const activateOrder = async () => {
  if (!orderDetail.value?.id) return;
  uni.showModal({
    title: '确认激活',
    content: '确定手动激活该订单吗？',
    success: async (r) => {
      if (!r.confirm) return;
      try {
        const res = await adminApi.activateOrder(orderDetail.value.id);
        if (res.code === 0) {
          uni.showToast({ title: '激活成功', icon: 'success' });
          showOrderModal.value = false;
          loadOrders();
          loadStats();
          loadMemberships();
        }
      } catch (e) {
        uni.showToast({ title: '激活失败', icon: 'none' });
      }
    }
  });
};

const cancelOrder = async () => {
  if (!orderDetail.value?.id) return;
  uni.showModal({
    title: '确认取消',
    content: '确定取消该订单吗？',
    success: async (r) => {
      if (!r.confirm) return;
      try {
        const res = await adminApi.updateOrderStatus(orderDetail.value.id, { status: 'cancelled' });
        if (res.code === 0) {
          uni.showToast({ title: '已取消', icon: 'success' });
          showOrderModal.value = false;
          loadOrders();
          loadStats();
        }
      } catch (e) {
        uni.showToast({ title: '取消失败', icon: 'none' });
      }
    }
  });
};

const refundOrder = async () => {
  if (!orderDetail.value?.id) return;
  uni.showModal({
    title: '确认退款',
    content: '确定退款吗？退款后会员将被取消。',
    editable: true,
    placeholderText: '请输入退款原因',
    success: async (r) => {
      if (!r.confirm) return;
      try {
        const res = await adminApi.refundOrder(orderDetail.value.id, r.content || '管理员退款');
        if (res.code === 0) {
          uni.showToast({ title: '退款成功', icon: 'success' });
          showOrderModal.value = false;
          loadOrders();
          loadStats();
          loadMemberships();
        }
      } catch (e) {
        uni.showToast({ title: '退款失败', icon: 'none' });
      }
    }
  });
};

const deleteOrder = async () => {
  if (!orderDetail.value?.id) return;
  uni.showModal({
    title: '确认删除',
    content: '删除后订单将无法恢复，确定删除吗？',
    confirmColor: '#ef4444',
    success: async (r) => {
      if (!r.confirm) return;
      try {
        const res = await adminApi.deleteOrder(orderDetail.value.id);
        if (res.code === 0) {
          uni.showToast({ title: '已删除', icon: 'success' });
          showOrderModal.value = false;
          loadOrders();
          loadStats();
        }
      } catch (e) {
        uni.showToast({ title: '删除失败', icon: 'none' });
      }
    }
  });
};

// 会员调整
const openMembershipEdit = (item) => {
  editingMembership.value = item;
  membershipAction.value = membershipActions[0];
  membershipDays.value = 30;
  membershipExpireDate.value = formatDate(item.expire_at);
  showMembershipModal.value = true;
};

const onMembershipActionChange = (e) => {
  membershipAction.value = membershipActions[e.detail.value];
};

const onExpireDateChange = (e) => {
  membershipExpireDate.value = e.detail.value;
};

const adjustMembership = async () => {
  if (!editingMembership.value || !membershipAction.value) return;
  try {
    const params = {
      action: membershipAction.value.value,
      days: membershipDays.value
    };
    if (membershipAction.value.value === 'setExpire') {
      if (!membershipExpireDate.value) {
        uni.showToast({ title: '请选择到期日期', icon: 'none' });
        return;
      }
      params.expireDate = membershipExpireDate.value;
    }
    const res = await adminApi.adjustMembership(editingMembership.value.user_id, params);
    if (res.code === 0) {
      uni.showToast({ title: '操作成功', icon: 'success' });
      showMembershipModal.value = false;
      loadMemberships();
      loadStats();
    } else {
      uni.showToast({ title: res.message || '操作失败', icon: 'none' });
    }
  } catch (e) {
    uni.showToast({ title: '操作失败', icon: 'none' });
  }
};

// 设置保存
const saveSettings = async () => {
  try {
    const keys = Object.keys(settings.value);
    for (const key of keys) {
      await adminApi.updateSetting(key, { value: settings.value[key] });
    }
    uni.showToast({ title: '设置已保存', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: '保存失败', icon: 'none' });
  }
};

onMounted(() => {
  loadCardTypes();
  loadActivationCodes();
  loadGlobalDiscounts();
  loadDiscounts();
  loadSettings();
  loadStats();
  loadOrders();
  loadMemberships();
  const currentTheme = uni.getStorageSync('themeMode') || 'light';
  isDarkMode.value = currentTheme === 'dark';
});
</script>

<style scoped>
/* 样式与之前相同，略 */
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

.stats-container {
  margin-top: -40rpx;
  padding: 0 30rpx;
}

.stats-card {
  background: white;
  border-radius: 30rpx;
  padding: 30rpx 20rpx;
  display: flex;
  justify-content: space-around;
  align-items: center;
  box-shadow: 0 10rpx 20rpx rgba(0, 0, 0, 0.05);
  margin-bottom: 30rpx;
}

.stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 80rpx;
}

.stat-num {
  font-size: 36rpx;
  font-weight: bold;
  color: #ff9800;
  margin-bottom: 6rpx;
}

.stat-label {
  font-size: 24rpx;
  color: #9ca3af;
}

.stat-divider {
  width: 2rpx;
  height: 50rpx;
  background: #f3f4f6;
}

.tab-bar {
  display: flex;
  margin: 0 30rpx 20rpx;
  background: white;
  border-radius: 16rpx;
  padding: 6rpx;
  box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.02);
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  font-size: 26rpx;
  color: #6b7280;
  border-radius: 12rpx;
}

.tab-item.active {
  background: #ff9800;
  color: #fff;
  font-weight: 600;
}

.tab-content {
  padding: 0 30rpx;
}

.menu-group-card {
  background: white;
  border-radius: 30rpx;
  padding: 10rpx 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.02);
}

.menu-item-row {
  display: flex;
  align-items: center;
  padding: 28rpx 0;
  border-bottom: 1rpx solid #f9fafb;
}

.menu-item-row.last-item {
  border-bottom: none;
}

.icon-box {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
  flex-shrink: 0;
}

.icon-text {
  font-size: 28rpx;
  font-weight: bold;
  color: #fff;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.item-label {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
}

.copy-btn {
  font-size: 22rpx;
  color: #2563eb;
  background: #eff6ff;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  white-space: nowrap;
}

.item-desc {
  font-size: 24rpx;
  color: #9ca3af;
}

.item-time {
  font-size: 22rpx;
  color: #9ca3af;
  margin-top: 4rpx;
}

.disabled-tag {
  color: #ef4444;
  margin-left: 12rpx;
  font-size: 22rpx;
}

.item-right {
  display: flex;
  align-items: center;
}

.item-arrow {
  width: 16rpx;
  height: 16rpx;
  border-top: 3rpx solid #d1d5db;
  border-right: 3rpx solid #d1d5db;
  transform: rotate(45deg);
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.item-arrow.delete {
  width: 32rpx;
  height: 32rpx;
  border: none;
  transform: none;
  background: #fee2e2;
  border-radius: 50%;
  position: relative;
}

.item-arrow.delete::before,
.item-arrow.delete::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16rpx;
  height: 2rpx;
  background: #ef4444;
  transform: translate(-50%, -50%) rotate(45deg);
}

.item-arrow.delete::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.menu-divider {
  height: 1rpx;
  background: #f9fafb;
}

.empty-tip {
  text-align: center;
  padding: 40rpx;
  color: #9ca3af;
  font-size: 28rpx;
}

.status-pending { color: #f59e0b; margin-left: 12rpx; }
.status-paid { color: #3b82f6; margin-left: 12rpx; }
.status-active { color: #22c55e; margin-left: 12rpx; }
.status-refunded { color: #ef4444; margin-left: 12rpx; }
.status-cancelled { color: #6b7280; margin-left: 12rpx; }
.status-expired { color: #ef4444; margin-left: 12rpx; }

.filter-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.filter-picker {
  background: white;
  padding: 16rpx 24rpx;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #333;
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

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #374151;
  padding: 20rpx 30rpx 10rpx;
}

.price-current {
  color: #ef4444;
  font-weight: bold;
  font-size: 28rpx;
}

.price-original {
  color: #9ca3af;
  font-size: 24rpx;
  text-decoration: line-through;
  margin-left: 8rpx;
}

.price-discount {
  color: #ff9800;
  font-size: 22rpx;
  background: #fff7ed;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  margin-left: 8rpx;
}

.add-btn-row {
  margin-bottom: 20rpx;
}

.add-btn {
  background: #ff9800;
  color: white;
  font-size: 28rpx;
  border-radius: 16rpx;
  line-height: 80rpx;
}

.save-btn-row {
  margin-top: 20rpx;
}

.save-btn {
  background: #ff9800;
  color: white;
  font-size: 30rpx;
  border-radius: 16rpx;
  line-height: 88rpx;
}

.form-row {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f9fafb;
}

.form-row.inline {
  justify-content: space-between;
}

.form-row:last-child {
  border-bottom: none;
}

.form-label {
  font-size: 28rpx;
  color: #374151;
  width: 200rpx;
  flex-shrink: 0;
}

.form-input {
  flex: 1;
  font-size: 28rpx;
  color: #1f2937;
  text-align: right;
}

.picker {
  flex: 1;
  font-size: 28rpx;
  color: #1f2937;
  text-align: right;
}

.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 120rpx 30rpx 60rpx;
  overflow-y: auto;
}

.modal-content {
  width: 100%;
  max-height: none;
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
}

.modal-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 30rpx;
  text-align: center;
}

.modal-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 30rpx;
}

.modal-btn {
  flex: 1;
  font-size: 28rpx;
  border-radius: 12rpx;
  line-height: 76rpx;
  text-align: center;
  border: none;
}

.modal-btn.cancel {
  background: #f3f4f6;
  color: #6b7280;
}

.modal-btn.confirm {
  background: #ff9800;
  color: white;
}

.modal-btn.delete {
  background: #fee2e2;
  color: #ef4444;
}

.order-modal {
  max-width: 600rpx;
}

.order-detail-info {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
}

.detail-label {
  font-size: 26rpx;
  color: #666;
}

.detail-value {
  font-size: 26rpx;
  color: #333;
}

.detail-value.price {
  font-weight: bold;
  color: #ff9800;
}

.order-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 30rpx;
}

.action-btn {
  flex: 1;
  min-width: 140rpx;
  font-size: 26rpx;
  border-radius: 12rpx;
  line-height: 70rpx;
}

.action-btn.activate {
  background: #22c55e;
  color: white;
}

.action-btn.cancel {
  background: #f3f4f6;
  color: #6b7280;
}

.action-btn.refund {
  background: #fee2e2;
  color: #ef4444;
}

.action-btn.delete {
  background: #fee2e2;
  color: #ef4444;
}

.action-btn.close {
  background: #e5e7eb;
  color: #374151;
}

/* 夜间模式 */
.dark-mode.container {
  background: #1a1a1a;
}

.dark-mode .stats-card,
.dark-mode .menu-group-card,
.dark-mode .tab-bar,
.dark-mode .filter-picker,
.dark-mode .page-btn {
  background: #2c2c2c;
  box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.2);
}

.dark-mode .header-section {
  background: #e68a00;
}

.dark-mode .item-label,
.dark-mode .form-label,
.dark-mode .detail-label,
.dark-mode .filter-picker {
  color: #f0f0f0;
}

.dark-mode .item-desc,
.dark-mode .stat-label,
.dark-mode .item-time,
.dark-mode .empty-tip {
  color: #888;
}

.dark-mode .stat-divider,
.dark-mode .menu-divider,
.dark-mode .form-row,
.dark-mode .menu-item-row {
  border-bottom-color: #444;
}

.dark-mode .modal-content {
  background: #2c2c2c;
}

.dark-mode .modal-title,
.dark-mode .detail-value {
  color: #f0f0f0;
}

.dark-mode .form-input {
  color: #f0f0f0;
}
</style>