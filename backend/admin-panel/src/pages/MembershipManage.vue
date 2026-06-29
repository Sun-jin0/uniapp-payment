<template>
  <div class="membership-manage">
    <div class="page-header">
      <div class="left">
        <h2>会员管理</h2>
        <p class="subtitle">管理会员卡、激活码、折扣码、订单与会员状态</p>
      </div>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-value">{{ stats.totalMembers || 0 }}</div>
          <div class="stat-label">总订阅数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card active">
          <div class="stat-value">{{ stats.activeMembers || 0 }}</div>
          <div class="stat-label">有效订阅</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card revenue">
          <div class="stat-value">¥{{ (stats.totalRevenue || 0).toFixed(2) }}</div>
          <div class="stat-label">总收入</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-value">{{ stats.totalOrders || 0 }}</div>
          <div class="stat-label">总订单</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Tab 管理 -->
    <el-card shadow="never" v-loading="loading">
      <template #header>
        <div class="card-header">
          <el-tabs v-model="activeTab" type="card" @tab-change="onTabChange">
            <el-tab-pane label="会员卡" name="cards" />
            <el-tab-pane label="激活码" name="activationCodes" />
            <el-tab-pane label="折扣码" name="discounts" />
            <el-tab-pane label="订单" name="orders" />
            <el-tab-pane label="会员" name="memberships" />
            <el-tab-pane label="设置" name="settings" />
          </el-tabs>
          <el-button type="primary" size="small" @click="handleAdd">
            + {{ addButtonText }}
          </el-button>
        </div>
      </template>

      <!-- 会员卡 -->
      <div v-if="activeTab === 'cards'">
        <el-table :data="cardTypes" border stripe>
          <el-table-column prop="display_name" label="名称" width="120" />
          <el-table-column prop="card_key" label="标识" width="120" />
          <el-table-column prop="price" label="现价" width="120">
            <template #default="{ row }">¥{{ row.price }}</template>
          </el-table-column>
          <el-table-column prop="original_price" label="原价" width="120">
            <template #default="{ row }">¥{{ row.original_price }}</template>
          </el-table-column>
          <el-table-column prop="duration_days" label="有效期" width="100">
            <template #default="{ row }">{{ row.duration_days ? row.duration_days + '天' : '永久' }}</template>
          </el-table-column>
          <el-table-column prop="description" label="描述" show-overflow-tooltip />
          <el-table-column prop="enabled" label="状态" width="100">
            <template #default="{ row }">
              <el-switch v-model="row.enabled" :active-value="1" :inactive-value="0" @change="(val) => toggleCardStatus(row, val)" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="editCard(row)">编辑</el-button>
              <el-button type="danger" size="small" @click="deleteCard(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 激活码 -->
      <div v-if="activeTab === 'activationCodes'">
        <el-table :data="activationCodes" border stripe>
          <el-table-column prop="code" label="激活码" width="150">
            <template #default="{ row }">
              <div class="code-cell">
                <span>{{ row.code }}</span>
                <el-button link type="primary" size="small" @click.stop="copyText(row.code)">复制</el-button>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="card_name" label="会员卡" width="120" />
          <el-table-column prop="duration_days" label="时长" width="100">
            <template #default="{ row }">{{ row.duration_days ? row.duration_days + '天' : '永久' }}</template>
          </el-table-column>
          <el-table-column prop="max_uses" label="可兑换次数" width="110" />
          <el-table-column prop="used_count" label="已使用" width="90" />
          <el-table-column prop="remark" label="备注" show-overflow-tooltip />
          <el-table-column prop="status" label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="editActivationCode(row)">编辑</el-button>
              <el-button size="small" @click="toggleActivationCodeStatus(row)">{{ row.status === 1 ? '禁用' : '启用' }}</el-button>
              <el-button type="danger" size="small" @click="deleteActivationCode(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 折扣码 -->
      <div v-if="activeTab === 'discounts'">
        <el-table :data="discounts" border stripe>
          <el-table-column prop="code" label="折扣码" width="160">
            <template #default="{ row }">
              <div class="code-cell">
                <span>{{ row.code }}</span>
                <el-button link type="primary" size="small" @click.stop="copyText(row.code)">复制</el-button>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="名称" width="140" />
          <el-table-column prop="discount_value" label="优惠" width="110">
            <template #default="{ row }">{{ row.discount_type === 'percentage' ? row.discount_value + '%' : '¥' + row.discount_value }}</template>
          </el-table-column>
          <el-table-column prop="usage_count" label="已用" width="80" />
          <el-table-column prop="usage_limit" label="上限" width="90" />
          <el-table-column prop="min_amount" label="最低金额" width="100">
            <template #default="{ row }">¥{{ row.min_amount || 0 }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="editDiscount(row)">编辑</el-button>
              <el-button size="small" @click="toggleDiscountStatus(row)">{{ row.status === 1 ? '禁用' : '启用' }}</el-button>
              <el-button type="danger" size="small" @click="deleteDiscount(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 订单 -->
      <div v-if="activeTab === 'orders'">
        <el-row :gutter="10" class="filter-row">
          <el-col :span="6">
            <el-select v-model="orderStatusFilter" placeholder="订单状态" clearable @change="loadOrders">
              <el-option label="全部" value="" />
              <el-option label="待支付" value="pending" />
              <el-option label="已支付" value="paid" />
              <el-option label="已激活" value="active" />
              <el-option label="已退款" value="refunded" />
              <el-option label="已取消" value="cancelled" />
            </el-select>
          </el-col>
        </el-row>
        <el-table :data="orders" border stripe v-loading="ordersLoading">
          <el-table-column prop="order_no" label="订单号" width="180" />
          <el-table-column prop="username" label="用户" width="120">
            <template #default="{ row }">{{ row.username || '用户' + row.user_id }}</template>
          </el-table-column>
          <el-table-column prop="card_name" label="会员卡" width="120" />
          <el-table-column prop="original_price" label="原价" width="100">
            <template #default="{ row }">¥{{ row.original_price }}</template>
          </el-table-column>
          <el-table-column prop="final_price" label="实付" width="100">
            <template #default="{ row }">¥{{ row.final_price }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getOrderStatusType(row.status)" size="small">{{ getOrderStatusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="创建时间" width="170">
            <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="viewOrder(row)">详情</el-button>
              <el-button v-if="row.status === 'paid'" type="warning" size="small" @click="refundOrder(row)">退款</el-button>
              <el-button type="danger" size="small" @click="deleteOrder(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="orderPage"
          :page-size="orderPageSize"
          :total="orderTotal"
          layout="total, prev, pager, next"
          small
          class="pagination"
          @current-change="loadOrders"
        />
      </div>

      <!-- 会员 -->
      <div v-if="activeTab === 'memberships'">
        <el-table :data="memberships" border stripe v-loading="membershipsLoading">
          <el-table-column prop="user_id" label="用户ID" width="90" />
          <el-table-column prop="username" label="用户名" width="120">
            <template #default="{ row }">{{ row.username || '用户' + row.user_id }}</template>
          </el-table-column>
          <el-table-column prop="card_name" label="会员卡" width="120" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">{{ row.status === 'active' ? '有效' : row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="expire_at" label="到期时间" width="170">
            <template #default="{ row }">{{ formatTime(row.expire_at) }}</template>
          </el-table-column>
          <el-table-column prop="total_paid" label="累计支付" width="110">
            <template #default="{ row }">¥{{ Number(row.total_paid || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="total_renewals" label="续费次数" width="100" />
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="adjustMembership(row)">调整</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="membershipPage"
          :page-size="membershipPageSize"
          :total="membershipTotal"
          layout="total, prev, pager, next"
          small
          class="pagination"
          @current-change="loadMemberships"
        />
      </div>

      <!-- 设置 -->
      <div v-if="activeTab === 'settings'">
        <el-form label-width="140px" class="settings-form">
          <el-form-item label="免费题目数">
            <el-input-number v-model="settings.free_question_limit" :min="0" />
          </el-form-item>
          <el-form-item label="新用户试用天数">
            <el-input-number v-model="settings.trial_days" :min="0" />
          </el-form-item>
          <el-form-item label="续费优惠%">
            <el-input-number v-model="settings.renewal_discount" :min="0" :max="100" />
          </el-form-item>
          <el-form-item label="横幅文字">
            <el-input v-model="settings.membership_banner_text" style="width: 400px;" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveSettings">保存设置</el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-card>

    <!-- 会员卡弹窗 -->
    <el-dialog v-model="cardDialogVisible" :title="editingCard ? '编辑会员卡' : '新增会员卡'" width="500px">
      <el-form :model="cardForm" label-width="100px">
        <el-form-item label="名称" v-if="!editingCard">
          <el-input v-model="cardForm.display_name" placeholder="如：月卡" />
        </el-form-item>
        <el-form-item label="标识" v-if="!editingCard">
          <el-input v-model="cardForm.card_key" placeholder="如：monthly" />
        </el-form-item>
        <el-form-item label="现价">
          <el-input-number v-model="cardForm.price" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="原价">
          <el-input-number v-model="cardForm.original_price" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="有效期(天)">
          <el-input-number v-model="cardForm.duration_days" :min="0" />
          <span class="form-tip">0 表示永久</span>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="cardForm.description" type="textarea" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="cardForm.enabled" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cardDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCard">保存</el-button>
      </template>
    </el-dialog>

    <!-- 激活码弹窗 -->
    <el-dialog v-model="activationCodeDialogVisible" :title="editingActivationCode ? '编辑激活码' : '新增激活码'" width="500px">
      <el-form :model="activationCodeForm" label-width="110px">
        <el-form-item label="会员卡类型">
          <el-select v-model="activationCodeForm.cardTypeId" placeholder="请选择" style="width: 100%;">
            <el-option v-for="c in cardTypes" :key="c.id" :label="c.display_name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="会员时长(天)">
          <el-input-number v-model="activationCodeForm.durationDays" :min="0" />
          <span class="form-tip">0 表示永久</span>
        </el-form-item>
        <el-form-item label="可兑换次数">
          <el-input-number v-model="activationCodeForm.maxUses" :min="1" />
        </el-form-item>
        <el-form-item label="生成数量" v-if="!editingActivationCode">
          <el-input-number v-model="activationCodeForm.count" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="自定义码" v-if="!editingActivationCode">
          <el-input v-model="activationCodeForm.code" placeholder="留空则自动生成7位码" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="activationCodeForm.remark" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="activationCodeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveActivationCode">保存</el-button>
      </template>
    </el-dialog>

    <!-- 折扣码弹窗 -->
    <el-dialog v-model="discountDialogVisible" :title="editingDiscount ? '编辑折扣码' : '新增折扣码'" width="500px">
      <el-form :model="discountForm" label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="discountForm.name" />
        </el-form-item>
        <el-form-item label="折扣码">
          <el-input v-model="discountForm.code" :disabled="!!editingDiscount" />
        </el-form-item>
        <el-form-item label="折扣类型">
          <el-radio-group v-model="discountForm.discount_type">
            <el-radio label="percentage">百分比</el-radio>
            <el-radio label="fixed">固定金额</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="discountForm.discount_type === 'percentage' ? '折扣%' : '减免金额'">
          <el-input-number v-model="discountForm.discount_value" :min="0" :precision="discountForm.discount_type === 'percentage' ? 0 : 2" />
        </el-form-item>
        <el-form-item label="最低金额">
          <el-input-number v-model="discountForm.min_amount" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="使用上限">
          <el-input-number v-model="discountForm.usage_limit" :min="0" />
          <span class="form-tip">0 表示无限制</span>
        </el-form-item>
        <el-form-item label="每用户限制">
          <el-input-number v-model="discountForm.per_user_limit" :min="0" />
          <span class="form-tip">0 表示无限制</span>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="discountForm.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="discountDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveDiscount">保存</el-button>
      </template>
    </el-dialog>

    <!-- 订单详情弹窗 -->
    <el-dialog v-model="orderDialogVisible" title="订单详情" width="500px">
      <el-descriptions :column="1" border v-if="orderDetail">
        <el-descriptions-item label="订单号">{{ orderDetail.order_no }}</el-descriptions-item>
        <el-descriptions-item label="用户">{{ orderDetail.username || '用户' + orderDetail.user_id }}</el-descriptions-item>
        <el-descriptions-item label="会员卡">{{ orderDetail.card_name }}</el-descriptions-item>
        <el-descriptions-item label="原价">¥{{ orderDetail.original_price }}</el-descriptions-item>
        <el-descriptions-item label="实付">¥{{ orderDetail.final_price }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ getOrderStatusText(orderDetail.status) }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatTime(orderDetail.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="支付时间">{{ formatTime(orderDetail.paid_at) }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <!-- 会员调整弹窗 -->
    <el-dialog v-model="membershipDialogVisible" title="调整会员" width="500px">
      <el-form :model="membershipForm" label-width="100px" v-if="editingMembership">
        <el-form-item label="用户">
          <span>{{ editingMembership.username || '用户' + editingMembership.user_id }}</span>
        </el-form-item>
        <el-form-item label="当前到期">
          <span>{{ formatTime(editingMembership.expire_at) }}</span>
        </el-form-item>
        <el-form-item label="操作">
          <el-select v-model="membershipForm.action" placeholder="请选择" style="width: 100%;">
            <el-option label="延长会员" value="extend" />
            <el-option label="修改到期时间" value="setExpire" />
            <el-option label="取消会员" value="cancel" />
            <el-option label="重新激活" value="activate" />
          </el-select>
        </el-form-item>
        <el-form-item label="天数" v-if="membershipForm.action === 'extend' || membershipForm.action === 'activate'">
          <el-input-number v-model="membershipForm.days" :min="1" />
        </el-form-item>
        <el-form-item label="新到期日" v-if="membershipForm.action === 'setExpire'">
          <el-date-picker v-model="membershipForm.expireDate" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 100%;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="membershipDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveMembershipAdjust">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminApi } from '@/api'

const activeTab = ref('cards')
const loading = ref(false)

// 数据
const stats = ref({})
const cardTypes = ref([])
const activationCodes = ref([])
const discounts = ref([])
const orders = ref([])
const orderPage = ref(1)
const orderPageSize = ref(20)
const orderTotal = ref(0)
const orderStatusFilter = ref('')
const ordersLoading = ref(false)
const memberships = ref([])
const membershipPage = ref(1)
const membershipPageSize = ref(20)
const membershipTotal = ref(0)
const membershipsLoading = ref(false)
const settings = ref({
  free_question_limit: 20,
  trial_days: 0,
  renewal_discount: 10,
  membership_banner_text: ''
})

// 弹窗
const cardDialogVisible = ref(false)
const editingCard = ref(null)
const cardForm = reactive({
  display_name: '', card_key: '', price: 0, original_price: 0, duration_days: 30, description: '', enabled: 1
})

const activationCodeDialogVisible = ref(false)
const editingActivationCode = ref(null)
const activationCodeForm = reactive({
  code: '', cardTypeId: '', durationDays: 30, maxUses: 1, remark: '', count: 1
})

const discountDialogVisible = ref(false)
const editingDiscount = ref(null)
const discountForm = reactive({
  name: '', code: '', discount_type: 'percentage', discount_value: 0,
  min_amount: 0, usage_limit: 0, per_user_limit: 1, status: 1
})

const orderDialogVisible = ref(false)
const orderDetail = ref(null)

const membershipDialogVisible = ref(false)
const editingMembership = ref(null)
const membershipForm = reactive({
  action: 'extend', days: 30, expireDate: ''
})

const addButtonText = computed(() => {
  const map = {
    cards: '会员卡',
    activationCodes: '激活码',
    discounts: '折扣码',
    orders: '订单',
    memberships: '会员',
    settings: '设置'
  }
  return map[activeTab.value] || ''
})

const formatTime = (timeStr) => {
  if (!timeStr) return '-'
  const d = new Date(timeStr)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const getOrderStatusType = (status) => {
  const map = { pending: 'info', paid: 'warning', active: 'success', refunded: 'info', cancelled: 'info' }
  return map[status] || 'info'
}

const getOrderStatusText = (status) => {
  const map = { pending: '待支付', paid: '已支付', active: '已激活', refunded: '已退款', cancelled: '已取消' }
  return map[status] || status
}

const onTabChange = () => {
  switch (activeTab.value) {
    case 'cards': loadCardTypes(); break
    case 'activationCodes': loadActivationCodes(); break
    case 'discounts': loadDiscounts(); break
    case 'orders': loadOrders(); break
    case 'memberships': loadMemberships(); break
    case 'settings': loadSettings(); break
  }
}

const handleAdd = () => {
  switch (activeTab.value) {
    case 'cards': openCardAdd(); break
    case 'activationCodes': openActivationCodeAdd(); break
    case 'discounts': openDiscountAdd(); break
  }
}

const copyText = (text) => {
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('已复制')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

// 加载数据
const loadStats = async () => {
  try {
    const res = await adminApi.getMembershipStats()
    stats.value = res.data || {}
  } catch (e) { console.error(e) }
}

const loadCardTypes = async () => {
  try {
    const res = await adminApi.getCardTypes()
    cardTypes.value = res.data || []
  } catch (e) { console.error(e) }
}

const loadActivationCodes = async () => {
  try {
    const res = await adminApi.getActivationCodes()
    activationCodes.value = res.data || []
  } catch (e) { console.error(e) }
}

const loadDiscounts = async () => {
  try {
    const res = await adminApi.getDiscounts()
    discounts.value = res.data || []
  } catch (e) { console.error(e) }
}

const loadOrders = async () => {
  ordersLoading.value = true
  try {
    const res = await adminApi.getMembershipOrders({
      page: orderPage.value,
      pageSize: orderPageSize.value,
      status: orderStatusFilter.value
    })
    orders.value = res.data?.list || []
    orderTotal.value = res.data?.total || 0
  } catch (e) { console.error(e) }
  ordersLoading.value = false
}

const loadMemberships = async () => {
  membershipsLoading.value = true
  try {
    const res = await adminApi.getMemberships({
      page: membershipPage.value,
      pageSize: membershipPageSize.value
    })
    memberships.value = res.data?.list || []
    membershipTotal.value = res.data?.total || 0
  } catch (e) { console.error(e) }
  membershipsLoading.value = false
}

const loadSettings = async () => {
  try {
    const res = await adminApi.getMembershipSettings()
    const data = res.data || {}
    settings.value = {
      free_question_limit: data.free_question_limit ?? 20,
      trial_days: data.trial_days ?? 0,
      renewal_discount: data.renewal_discount ?? 10,
      membership_banner_text: data.membership_banner_text ?? ''
    }
  } catch (e) { console.error(e) }
}

// 会员卡操作
const openCardAdd = () => {
  editingCard.value = null
  Object.assign(cardForm, { display_name: '', card_key: '', price: 0, original_price: 0, duration_days: 30, description: '', enabled: 1 })
  cardDialogVisible.value = true
}

const editCard = (row) => {
  editingCard.value = row
  Object.assign(cardForm, {
    price: row.price,
    original_price: row.original_price,
    duration_days: row.duration_days || 0,
    description: row.description || '',
    enabled: row.enabled
  })
  cardDialogVisible.value = true
}

const saveCard = async () => {
  try {
    const data = {
      price: cardForm.price,
      original_price: cardForm.original_price,
      duration_days: cardForm.duration_days,
      description: cardForm.description,
      enabled: cardForm.enabled
    }
    if (editingCard.value) {
      await adminApi.updateCardType(editingCard.value.id, data)
    } else {
      data.display_name = cardForm.display_name
      data.card_key = cardForm.card_key
      await adminApi.createCardType(data)
    }
    ElMessage.success('保存成功')
    cardDialogVisible.value = false
    loadCardTypes()
    loadStats()
  } catch (e) { ElMessage.error('保存失败') }
}

const toggleCardStatus = async (row, val) => {
  try {
    await adminApi.updateCardType(row.id, { enabled: val })
    ElMessage.success('操作成功')
    loadCardTypes()
  } catch (e) { ElMessage.error('操作失败') }
}

const deleteCard = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该会员卡类型吗？', '提示', { type: 'warning' })
    await adminApi.deleteCardType(row.id)
    ElMessage.success('删除成功')
    loadCardTypes()
  } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败') }
}

// 激活码操作
const openActivationCodeAdd = () => {
  editingActivationCode.value = null
  Object.assign(activationCodeForm, {
    code: '', cardTypeId: cardTypes.value[0]?.id || '', durationDays: 30, maxUses: 1, remark: '', count: 1
  })
  activationCodeDialogVisible.value = true
}

const editActivationCode = (row) => {
  editingActivationCode.value = row
  Object.assign(activationCodeForm, {
    code: row.code,
    cardTypeId: row.card_type_id,
    durationDays: row.duration_days || 0,
    maxUses: row.max_uses,
    remark: row.remark || '',
    count: 1
  })
  activationCodeDialogVisible.value = true
}

const saveActivationCode = async () => {
  try {
    const data = {
      cardTypeId: activationCodeForm.cardTypeId,
      durationDays: activationCodeForm.durationDays,
      maxUses: activationCodeForm.maxUses,
      remark: activationCodeForm.remark
    }
    if (editingActivationCode.value) {
      await adminApi.updateActivationCode(editingActivationCode.value.id, data)
    } else {
      data.code = activationCodeForm.code || undefined
      data.count = activationCodeForm.count
      await adminApi.createActivationCode(data)
    }
    ElMessage.success('保存成功')
    activationCodeDialogVisible.value = false
    loadActivationCodes()
  } catch (e) { ElMessage.error('保存失败') }
}

const toggleActivationCodeStatus = async (row) => {
  try {
    await adminApi.updateActivationCodeStatus(row.id, row.status === 1 ? 0 : 1)
    ElMessage.success('操作成功')
    loadActivationCodes()
  } catch (e) { ElMessage.error('操作失败') }
}

const deleteActivationCode = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该激活码吗？', '提示', { type: 'warning' })
    await adminApi.deleteActivationCode(row.id)
    ElMessage.success('删除成功')
    loadActivationCodes()
  } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败') }
}

// 折扣码操作
const openDiscountAdd = () => {
  editingDiscount.value = null
  Object.assign(discountForm, { name: '', code: '', discount_type: 'percentage', discount_value: 0, min_amount: 0, usage_limit: 0, per_user_limit: 1, status: 1 })
  discountDialogVisible.value = true
}

const editDiscount = (row) => {
  editingDiscount.value = row
  Object.assign(discountForm, {
    name: row.name,
    code: row.code,
    discount_type: row.discount_type,
    discount_value: row.discount_value,
    min_amount: row.min_amount || 0,
    usage_limit: row.usage_limit || 0,
    per_user_limit: row.per_user_limit || 1,
    status: row.status
  })
  discountDialogVisible.value = true
}

const saveDiscount = async () => {
  try {
    if (editingDiscount.value) {
      await adminApi.updateDiscount(editingDiscount.value.id, discountForm)
    } else {
      await adminApi.createDiscount(discountForm)
    }
    ElMessage.success('保存成功')
    discountDialogVisible.value = false
    loadDiscounts()
  } catch (e) { ElMessage.error('保存失败') }
}

const toggleDiscountStatus = async (row) => {
  try {
    await adminApi.updateDiscount(row.id, { status: row.status === 1 ? 0 : 1 })
    ElMessage.success('操作成功')
    loadDiscounts()
  } catch (e) { ElMessage.error('操作失败') }
}

const deleteDiscount = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该折扣码吗？', '提示', { type: 'warning' })
    await adminApi.deleteDiscount(row.id)
    ElMessage.success('删除成功')
    loadDiscounts()
  } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败') }
}

// 订单操作
const viewOrder = async (row) => {
  try {
    const res = await adminApi.getMembershipOrderDetail(row.order_no)
    orderDetail.value = res.data
    orderDialogVisible.value = true
  } catch (e) { ElMessage.error('加载失败') }
}

const refundOrder = async (row) => {
  try {
    await ElMessageBox.confirm('确定对该订单进行退款吗？', '提示', { type: 'warning' })
    await adminApi.refundMembershipOrder(row.order_no)
    ElMessage.success('退款成功')
    loadOrders()
    loadStats()
  } catch (e) { if (e !== 'cancel') ElMessage.error('退款失败') }
}

const deleteOrder = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该订单吗？', '提示', { type: 'warning' })
    await adminApi.deleteMembershipOrder(row.order_no)
    ElMessage.success('删除成功')
    loadOrders()
    loadStats()
  } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败') }
}

// 会员调整
const adjustMembership = (row) => {
  editingMembership.value = row
  Object.assign(membershipForm, { action: 'extend', days: 30, expireDate: '' })
  membershipDialogVisible.value = true
}

const saveMembershipAdjust = async () => {
  try {
    const data = { action: membershipForm.action }
    if (membershipForm.action === 'extend' || membershipForm.action === 'activate') {
      data.days = membershipForm.days
    }
    if (membershipForm.action === 'setExpire') {
      if (!membershipForm.expireDate) {
        ElMessage.warning('请选择到期日期')
        return
      }
      data.expireDate = membershipForm.expireDate
    }
    await adminApi.adjustMembership(editingMembership.value.user_id, data)
    ElMessage.success('操作成功')
    membershipDialogVisible.value = false
    loadMemberships()
    loadStats()
  } catch (e) { ElMessage.error('操作失败') }
}

// 设置保存
const saveSettings = async () => {
  try {
    for (const [key, value] of Object.entries(settings.value)) {
      await adminApi.updateMembershipSetting(key, value)
    }
    ElMessage.success('保存成功')
  } catch (e) { ElMessage.error('保存失败') }
}

onMounted(() => {
  loadStats()
  onTabChange()
})
</script>

<style scoped>
.membership-manage {
  padding: 0;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0;
  font-size: 22px;
  color: #303133;
}

.page-header .subtitle {
  margin: 4px 0 0;
  font-size: 14px;
  color: #909399;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  text-align: center;
}

.stat-card .stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #409eff;
}

.stat-card.active .stat-value {
  color: #67c23a;
}

.stat-card.revenue .stat-value {
  color: #e6a23c;
}

.stat-card .stat-label {
  margin-top: 8px;
  font-size: 13px;
  color: #909399;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-header :deep(.el-tabs__header) {
  margin: 0;
}

.code-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-row {
  margin-bottom: 16px;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

.form-tip {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}

.settings-form {
  max-width: 600px;
}
</style>
