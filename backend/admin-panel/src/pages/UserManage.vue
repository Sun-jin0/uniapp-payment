<template>
  <div class="user-manage">
    <div class="header-actions">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索用户名或学号"
        class="search-input"
        clearable
        @clear="handleSearch"
        @keyup.enter="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch">
            <el-icon><Search /></el-icon>
          </el-button>
        </template>
      </el-input>
      <div class="header-right">
        <el-tag v-if="isSuperAdmin" type="danger" style="margin-right: 10px;">超级管理员模式</el-tag>
        <el-tag v-else type="info" style="margin-right: 10px;">普通管理员</el-tag>
        <el-button type="primary" @click="openAddUserModal">
          <el-icon><Plus /></el-icon> 添加用户
        </el-button>
      </div>
    </div>

    <el-table :data="users" v-loading="loading" style="width: 100%" border stripe>
      <el-table-column prop="id" label="ID" width="60" align="center" />
      <el-table-column prop="username" label="用户名" min-width="100" />
      <el-table-column prop="studentId" label="学号" width="120" align="center" />
      <el-table-column label="密码" width="180" align="center">
        <template #default="{ row }">
          <div v-if="row.password" class="password-cell">
            <span class="password-text">{{ showPassword(row.password) }}</span>
            <el-button
              v-if="isSuperAdmin"
              size="small"
              type="primary"
              link
              class="copy-btn"
              @click="copyPassword(row.password)"
              title="复制密码"
            >
              <el-icon><CopyDocument /></el-icon>
            </el-button>
          </div>
          <span v-else class="no-password">未设置</span>
        </template>
      </el-table-column>
      <el-table-column prop="role" label="角色" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="getRoleTagType(row.role)">
            {{ getUserRoleText(row.role) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="registerDate" label="注册时间" width="150" align="center">
        <template #default="{ row }">
          {{ formatDate(row.registerDate) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" align="center" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="info" @click="viewUserDetail(row)">详情</el-button>
          <el-button size="small" @click="editUser(row)">编辑</el-button>
          <el-button 
            size="small" 
            :type="getStatusType(row.status) === 'success' ? 'danger' : 'success'" 
            @click="toggleUserStatus(row)"
          >
            {{ getStatusText(row.status) === '正常' ? '禁用' : '启用' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-container">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 用户编辑/添加对话框 -->
    <el-dialog
      v-model="showUserModal"
      :title="editingUser.id ? '编辑用户' : '添加用户'"
      width="500px"
    >
      <el-form :model="editingUser" label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="editingUser.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="学号">
          <el-input v-model="editingUser.studentId" placeholder="请输入学号" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="editingUser.password" placeholder="请输入密码（留空则不修改）" show-password />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="editingUser.role" placeholder="请选择角色" style="width: 100%">
            <el-option label="普通用户" :value="0" />
            <el-option label="超级管理员" :value="1" />
            <el-option label="管理员" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editingUser.status" placeholder="请选择状态" style="width: 100%">
            <el-option label="正常" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <!-- 超级管理员专属操作 -->
        <el-divider v-if="isSuperAdmin && editingUser.id" content-position="left">超级管理员操作</el-divider>
        <el-form-item v-if="isSuperAdmin && editingUser.id" label="修改权限">
          <el-select v-model="editingUser.role" placeholder="修改用户权限" style="width: 100%">
            <el-option label="普通用户" :value="0" />
            <el-option label="超级管理员" :value="1" />
            <el-option label="管理员" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="isSuperAdmin && editingUser.id">
          <el-button type="danger" @click="resetPasswordFromEdit" style="width: 100%">
            <el-icon><Refresh /></el-icon> 重置密码为 111111
          </el-button>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showUserModal = false">取消</el-button>
          <el-button type="primary" @click="saveUser">确认</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 用户详情对话框 -->
    <el-dialog
      v-model="showDetailModal"
      title="用户详情"
      width="800px"
      class="user-detail-dialog"
    >
      <div v-if="selectedUser" class="user-detail">
        <!-- 基本信息 -->
        <div class="detail-section">
          <h3>基本信息</h3>
          <el-descriptions :column="3" border>
            <el-descriptions-item label="ID">{{ selectedUser.id }}</el-descriptions-item>
            <el-descriptions-item label="用户名">{{ selectedUser.username }}</el-descriptions-item>
            <el-descriptions-item label="学号">{{ selectedUser.studentId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="角色">
              <el-tag :type="getRoleTagType(selectedUser.role)">
                {{ getUserRoleText(selectedUser.role) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="getStatusType(selectedUser.status)">
                {{ getStatusText(selectedUser.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="等级">Lv.{{ calcLevel(userStats.totalQuestions) }}</el-descriptions-item>
            <el-descriptions-item label="注册时间">{{ formatDate(selectedUser.registerDate) }}</el-descriptions-item>
            <el-descriptions-item label="最后登录">{{ formatDate(selectedUser.lastLoginDate) }}</el-descriptions-item>
            <el-descriptions-item label="积分">{{ selectedUser.points || 0 }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 学习统计 -->
        <div class="detail-section">
          <h3>学习统计</h3>
          <el-row :gutter="20">
            <el-col :span="6">
              <div class="stat-card">
                <div class="stat-value">{{ userStats.totalQuestions || 0 }}</div>
                <div class="stat-label">总刷题数</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-card">
                <div class="stat-value">{{ userStats.todayQuestions || 0 }}</div>
                <div class="stat-label">今日刷题</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-card">
                <div class="stat-value">{{ userStats.weekQuestions || 0 }}</div>
                <div class="stat-label">本周刷题</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-card">
                <div class="stat-value">{{ userStats.monthQuestions || 0 }}</div>
                <div class="stat-label">本月刷题</div>
              </div>
            </el-col>
          </el-row>
          <el-row :gutter="20" style="margin-top: 15px;">
            <el-col :span="6">
              <div class="stat-card">
                <div class="stat-value">{{ userStats.correctRate || 0 }}%</div>
                <div class="stat-label">正确率</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-card">
                <div class="stat-value">{{ userStats.studyDays || 0 }}</div>
                <div class="stat-label">学习天数</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-card">
                <div class="stat-value">{{ formatDuration(userStats.totalDuration) }}</div>
                <div class="stat-label">学习时长</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-card">
                <div class="stat-value">Lv.{{ calcLevel(userStats.totalQuestions) }}</div>
                <div class="stat-label">当前等级</div>
              </div>
            </el-col>
          </el-row>
        </div>

        <!-- 兑换视频 -->
        <div class="detail-section">
          <h3>兑换的视频</h3>
          <el-tabs v-model="activeDetailTab">
            <el-tab-pane label="合集" name="collections">
              <el-table :data="userRedeemed.collections" v-loading="detailLoading" size="small">
                <el-table-column prop="name" label="合集名称" min-width="200" />
                <el-table-column prop="video_count" label="视频数" width="80" align="center" />
                <el-table-column prop="access_time" label="兑换时间" width="150">
                  <template #default="{ row }">
                    {{ formatDate(row.access_time) }}
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="单个视频" name="videos">
              <el-table :data="userRedeemed.videos" v-loading="detailLoading" size="small">
                <el-table-column prop="title" label="视频标题" min-width="200" />
                <el-table-column prop="subject_name" label="科目" width="100" />
                <el-table-column prop="access_time" label="兑换时间" width="150">
                  <template #default="{ row }">
                    {{ formatDate(row.access_time) }}
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { adminApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const users = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const searchKeyword = ref('')

const showUserModal = ref(false)
const editingUser = ref({ id: '', username: '', studentId: '', phone: '', password: '', role: 0, status: 1 })

// 用户详情相关
const showDetailModal = ref(false)
const selectedUser = ref(null)
const userStats = ref({})
const userRedeemed = ref({ collections: [], videos: [] })
const detailLoading = ref(false)
const activeDetailTab = ref('collections')



// 当前登录用户角色（从localStorage获取）
const currentUserRole = computed(() => {
  // 从 permission.js 存储的 userRole 获取
  const role = localStorage.getItem('userRole')
  if (role) {
    return parseInt(role)
  }
  return 0
})

// 是否为超级管理员
const isSuperAdmin = computed(() => currentUserRole.value === 1)

// 当前登录用户ID
const currentUserId = computed(() => {
  // 从token中解析用户ID，或者从localStorage获取
  const token = localStorage.getItem('admin_token')
  if (token) {
    try {
      // JWT token 的第二部分是payload
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.userId || payload.id || 0
    } catch (e) {
      return 0
    }
  }
  return 0
})

const loadUsers = async () => {
  loading.value = true
  try {
    const res = await adminApi.getUserList({
      keyword: searchKeyword.value,
      page: currentPage.value,
      size: pageSize.value
    })
    if (res.code === 0) {
      users.value = res.data.list || []
      total.value = res.data.total || 0
    }
  } catch (error) {
    console.error('加载用户列表失败:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  loadUsers()
}

const handleSizeChange = (val) => {
  pageSize.value = val
  loadUsers()
}

const handleCurrentChange = (val) => {
  currentPage.value = val
  loadUsers()
}

const openAddUserModal = () => {
  editingUser.value = { id: '', username: '', studentId: '', phone: '', password: '', role: 0, status: 1 }
  showUserModal.value = true
}

const editUser = (user) => {
  editingUser.value = { ...user, password: '' }
  showUserModal.value = true
}

const saveUser = async () => {
  if (!editingUser.value.username) {
    ElMessage.warning('请填写用户名')
    return
  }

  try {
    let res
    if (editingUser.value.id) {
      res = await adminApi.updateUser(editingUser.value.id, editingUser.value)
    } else {
      res = await adminApi.createUser(editingUser.value)
    }

    if (res.code === 0) {
      ElMessage.success('保存成功')
      showUserModal.value = false
      loadUsers()
    }
  } catch (error) {
    console.error('保存用户失败:', error)
  }
}

const toggleUserStatus = async (user) => {
  // 数据库中 1=正常, 0=禁用
  const newStatus = user.status === 1 ? 0 : 1
  const actionText = newStatus === 1 ? '启用' : '禁用'
  
  try {
    await ElMessageBox.confirm(`确定要${actionText}该用户吗？`, '提示', {
      type: 'warning'
    })
    
    const res = await adminApi.updateUser(user.id, { ...user, status: newStatus })
    if (res.code === 0) {
      ElMessage.success(`${actionText}成功`)
      loadUsers()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('操作失败:', error)
    }
  }
}

// 重置密码
const resetPassword = async (user) => {
  try {
    await ElMessageBox.confirm(
      `确定要将用户 "${user.username}" 的密码重置为 "111111" 吗？`,
      '重置密码确认',
      {
        confirmButtonText: '确定重置',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const res = await adminApi.updateUser(user.id, { password: '111111' })
    if (res.code === 0) {
      ElMessage.success('密码重置成功，新密码为：111111')
      loadUsers()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('重置密码失败:', error)
      ElMessage.error('重置密码失败')
    }
  }
}

// 从编辑对话框重置密码
const resetPasswordFromEdit = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要将用户 "${editingUser.value.username}" 的密码重置为 "111111" 吗？`,
      '重置密码确认',
      {
        confirmButtonText: '确定重置',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const res = await adminApi.updateUser(editingUser.value.id, { password: '111111' })
    if (res.code === 0) {
      ElMessage.success('密码重置成功，新密码为：111111')
      // 更新当前编辑的用户密码显示
      editingUser.value.password = '111111'
      loadUsers()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('重置密码失败:', error)
      ElMessage.error('重置密码失败')
    }
  }
}

// 复制密码到剪贴板
const copyPassword = async (password) => {
  try {
    await navigator.clipboard.writeText(password)
    ElMessage.success('密码已复制到剪贴板')
  } catch (err) {
    // 如果 clipboard API 失败，使用传统方法
    const textArea = document.createElement('textarea')
    textArea.value = password
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    ElMessage.success('密码已复制到剪贴板')
  }
}

// 查看用户详情
const viewUserDetail = async (user) => {
  selectedUser.value = user
  showDetailModal.value = true
  detailLoading.value = true
  activeDetailTab.value = 'collections'
  
  try {
    // 获取用户学习统计
    const statsRes = await adminApi.getUserStats(user.id)
    if (statsRes.code === 0) {
      userStats.value = statsRes.data || {}
    }
    
    // 获取用户兑换的视频
    const redeemedRes = await adminApi.getUserRedeemedVideos(user.id)
    if (redeemedRes.code === 0) {
      userRedeemed.value = {
        collections: redeemedRes.data.collections || [],
        videos: redeemedRes.data.videos || []
      }
    }
  } catch (error) {
    console.error('加载用户详情失败:', error)
  } finally {
    detailLoading.value = false
  }
}

// 计算等级（参考profile页面的逻辑）
const calcLevel = (questions) => {
  if (!questions || questions < 200) {
    return Math.floor((questions || 0) / 20) + 1
  } else {
    return 10 + Math.floor((questions - 200) / 50)
  }
}

// 显示密码：超级管理员完全显示，其他用户隐藏
const showPassword = (password) => {
  // 确保密码是字符串类型
  const pwd = String(password || '')
  if (isSuperAdmin.value) {
    return pwd
  }
  // 非超级管理员显示部分隐藏
  if (!pwd || pwd.length <= 4) return '****'
  return pwd.substring(0, 2) + '****' + pwd.substring(pwd.length - 2)
}

// 角色显示
const getUserRoleText = (role) => {
  // role: 0=普通用户, 1=超级管理员, 2=管理员
  const roles = {
    0: '普通用户',
    1: '超级管理员',
    2: '管理员'
  }
  return roles[role] || '普通用户'
}

const getRoleTagType = (role) => {
  const types = {
    0: 'info',
    1: 'danger',
    2: 'warning'
  }
  return types[role] || 'info'
}

// 状态显示：数据库中 1=正常, 0=禁用
const getStatusText = (status) => {
  return status === 1 ? '正常' : '禁用'
}

const getStatusType = (status) => {
  return status === 1 ? 'success' : 'danger'
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString()
}

const formatDuration = (seconds) => {
  if (!seconds) return '0分钟'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  }
  return `${minutes}分钟`
}

onMounted(() => {
  // 如果 localStorage 中没有 userRole，尝试从 token 中解析
  if (!localStorage.getItem('userRole')) {
    const token = localStorage.getItem('admin_token')
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.role !== undefined) {
          localStorage.setItem('userRole', payload.role)
        }
      } catch (e) {
        console.log('无法从token解析role')
      }
    }
  }
  
  // 调试：输出当前角色信息
  console.log('当前用户角色:', currentUserRole.value)
  console.log('是否超级管理员:', isSuperAdmin.value)
  console.log('localStorage userRole:', localStorage.getItem('userRole'))
  
  loadUsers()
})
</script>

<style scoped>
.user-manage {
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
}
.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.search-input {
  width: 300px;
}
.header-right {
  display: flex;
  align-items: center;
}
.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

/* 密码显示 */
.password-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.password-text {
  font-family: monospace;
  color: #606266;
}
.copy-btn {
  padding: 2px 5px;
  font-size: 12px;
}
.no-password {
  color: #909399;
  font-size: 12px;
}

/* 用户详情样式 */
.user-detail-dialog :deep(.el-dialog__body) {
  padding: 10px 20px;
}
.user-detail {
  max-height: 600px;
  overflow-y: auto;
}
.detail-section {
  margin-bottom: 25px;
}
.detail-section h3 {
  margin: 0 0 15px 0;
  padding-bottom: 10px;
  border-bottom: 1px solid #e4e7ed;
  font-size: 16px;
  color: #303133;
}
.stat-card {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 15px;
  text-align: center;
}
.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #409EFF;
  margin-bottom: 5px;
}
.stat-label {
  font-size: 12px;
  color: #606266;
}
</style>
