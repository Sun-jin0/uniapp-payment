<template>
  <div class="dashboard" :class="{ 'dark-mode': isDarkMode }">
    <!-- 顶部导航栏 -->
    <div class="nav-bar">
      <div class="nav-title">管理员后台</div>
      <div class="nav-actions">
        <div class="role-badge">{{ roleText }}</div>
        <div class="action-btn" @click="logout">退出登录</div>
      </div>
    </div>

    <!-- 欢迎头部 -->
    <div class="welcome-header">
      <h2>欢迎回来, 管理员</h2>
      <p class="subtitle">{{ currentTime }}</p>
    </div>

    <el-row :gutter="20">
      <el-col :span="6" v-for="item in stats" :key="item.title">
        <el-card shadow="hover" class="stats-card">
          <div class="stats-icon" :style="{ color: item.color }">
            <el-icon><component :is="item.icon" /></el-icon>
          </div>
          <div class="stats-info">
            <div class="stats-title">{{ item.title }}</div>
            <div class="stats-value">{{ item.value }}</div>
            <div class="stats-footer">
              <span class="unit">{{ item.unit }}</span>
              <span class="trend" :class="item.trend > 0 ? 'up' : 'down'" v-if="item.trend">
                {{ item.trend > 0 ? '+' : '' }}{{ item.trend }}%
                <el-icon><component :is="item.trend > 0 ? 'CaretTop' : 'CaretBottom'" /></el-icon>
              </span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt-20">
      <el-col :span="16">
        <el-card class="activity-card">
          <template #header>
            <div class="card-header">
              <span>最近活动</span>
              <el-button link type="primary">查看全部</el-button>
            </div>
          </template>
          <el-table :data="recentActivities" style="width: 100%">
            <el-table-column prop="time" label="时间" width="180">
              <template #default="scope">
                <span class="time-text">{{ formatTime(scope.row.time) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="user" label="用户" width="120">
              <template #default="scope">
                <el-tag size="small">{{ scope.row.user }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="action" label="操作内容" />
            <el-table-column label="状态" width="100">
              <template #default="scope">
                <el-tag :type="scope.row.status === 'success' ? 'success' : 'info'" size="small">
                  {{ scope.row.status === 'success' ? '已完成' : '进行中' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="system-card">
          <template #header>系统状态</template>
          <div class="status-item">
            <span>服务器状态</span>
            <el-tag type="success">正常运行</el-tag>
          </div>
          <div class="status-item">
            <span>数据库连接</span>
            <el-tag type="success">已连接</el-tag>
          </div>
          <div class="status-item">
            <span>缓存服务</span>
            <el-tag type="success">正常</el-tag>
          </div>
          <div class="status-item">
            <span>存储空间</span>
            <el-progress :percentage="45" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 管理员功能菜单 -->
    <div class="admin-section">
      <!-- 用户管理 - 超级管理员和普通管理员可见 -->
      <div class="menu-group" v-if="checkPermission(PERMISSIONS.USER_VIEW)">
        <div class="group-title">用户管理</div>
        <div class="menu-item" @click="goToUserManage">
          <div class="menu-icon" :style="{ backgroundColor: '#43e97b' }">👥</div>
          <div class="menu-content">
            <div class="menu-title">用户管理</div>
            <div class="menu-desc">查看和管理用户信息</div>
          </div>
          <div class="menu-arrow"></div>
        </div>
      </div>
      
      <!-- 公共题库管理 -->
      <div class="menu-group" v-if="checkPermission(PERMISSIONS.CONTENT_VIEW)">
        <div class="group-title">公共题库管理</div>
        <div class="menu-item" @click="goToPublicImport">
          <div class="menu-icon" :style="{ backgroundColor: '#6666ff' }">📚</div>
          <div class="menu-content">
            <div class="menu-title">公共题库导入</div>
            <div class="menu-desc">导入 26 版 JSON 题库数据</div>
          </div>
          <div class="menu-arrow"></div>
        </div>
        <div class="menu-item" @click="goToPublicBulkImport">
          <div class="menu-icon" :style="{ backgroundColor: '#6666ff' }">📂</div>
          <div class="menu-content">
            <div class="menu-title">公共题库批量导入</div>
            <div class="menu-desc">批量导入多本书籍与结构</div>
          </div>
          <div class="menu-arrow"></div>
        </div>
        <div class="menu-item" @click="goToPublicManagement">
          <div class="menu-icon" :style="{ backgroundColor: '#2b5cff' }">📝</div>
          <div class="menu-content">
            <div class="menu-title">公共题库管理</div>
            <div class="menu-desc">处理纠错反馈、试题管理与书目管理</div>
          </div>
          <div class="menu-arrow"></div>
        </div>
        <div class="menu-item" @click="goToMedImport">
          <div class="menu-icon" :style="{ backgroundColor: '#00bcd4' }">🏥</div>
          <div class="menu-content">
            <div class="menu-title">西医题库导入</div>
            <div class="menu-desc">导入西医综合 JSON 试题</div>
          </div>
          <div class="menu-arrow"></div>
        </div>
      </div>

      <!-- 首页内容管理 - 内容管理员及以上可见 -->
      <div class="menu-group" v-if="checkPermission(PERMISSIONS.CONTENT_VIEW)">
        <div class="group-title">首页装修管理</div>
        <div class="menu-item" @click="goToBannerManage">
          <div class="menu-icon" :style="{ backgroundColor: '#6666ff' }">{{ bannerIcon }}</div>
          <div class="menu-content">
            <div class="menu-title">轮播图管理</div>
            <div class="menu-desc">管理首页顶部轮播图片及其跳转链接</div>
          </div>
          <div class="menu-arrow"></div>
        </div>
        <div class="menu-item" @click="goToConfigManage">
          <div class="menu-icon" :style="{ backgroundColor: '#ff9900' }">&#9881;</div>
          <div class="menu-content">
            <div class="menu-title">全局系统配置</div>
            <div class="menu-desc">管理首页倒计时天数、考研目标日期及全局设置</div>
          </div>
          <div class="menu-arrow"></div>
        </div>
        <div class="menu-item" @click="goToContentManage">
          <div class="menu-icon" :style="{ backgroundColor: '#7b4397' }">&#128221;</div>
          <div class="menu-content">
            <div class="menu-title">内容管理 (新)</div>
            <div class="menu-desc">统一管理公告、广告及文章内容</div>
          </div>
          <div class="menu-arrow"></div>
        </div>
        
      </div>

      <!-- 业务内容管理 - 内容管理员及以上可见 -->
      <div class="menu-group" v-if="checkPermission(PERMISSIONS.CONTENT_VIEW)">
        <div class="group-title">题库与业务管理</div>
        <div class="menu-item" @click="goToVideoAdmin">
          <div class="menu-icon" :style="{ backgroundColor: '#ff5252' }">&#127917;</div>
          <div class="menu-content">
            <div class="menu-title">视频课程管理</div>
            <div class="menu-desc">管理视频分类、资源、兑换码与权限</div>
          </div>
          <div class="menu-arrow"></div>
        </div>
        <div class="menu-item" @click="goToHomepageCardManage">
          <div class="menu-icon" :style="{ backgroundColor: '#4facfe' }">&#128218;</div>
          <div class="menu-content">
            <div class="menu-title">首页科目卡片</div>
            <div class="menu-desc">管理首页精选刷题卡片的内容、颜色和高度</div>
          </div>
          <div class="menu-arrow"></div>
        </div>
        <div class="menu-item" @click="goToNavManagement">
          <div class="menu-icon" :style="{ backgroundColor: '#673ab7' }">&#129516;</div>
          <div class="menu-content">
            <div class="menu-title">练习页科目管理</div>
            <div class="menu-desc">管理练习页左侧科目树及分类导航</div>
          </div>
          <div class="menu-arrow"></div>
        </div>
        <div class="menu-item" @click="goToPoliticsManagement">
          <div class="menu-icon" :style="{ backgroundColor: '#e91e63' }">&#127989;</div>
          <div class="menu-content">
            <div class="menu-title">政治内容管理</div>
            <div class="menu-desc">管理政治刷题页的内容分类与书籍</div>
          </div>
          <div class="menu-arrow"></div>
        </div>
        <div class="menu-item" @click="goToMathManagement">
          <div class="menu-icon" :style="{ backgroundColor: '#009688' }">{{ mathIcon }}</div>
          <div class="menu-content">
            <div class="menu-title">数学题库管理</div>
            <div class="menu-desc">数学公式可视化编辑与纠错</div>
          </div>
          <div class="menu-arrow"></div>
        </div>
        <div class="menu-item" @click="goToComputerManagement">
          <div class="menu-icon" :style="{ backgroundColor: '#1e88e5' }">{{ computerIcon }}</div>
          <div class="menu-content">
            <div class="menu-title">计算机题库管理</div>
            <div class="menu-desc">计算机题目、纠错与导入</div>
          </div>
          <div class="menu-arrow"></div>
        </div>
        <div class="menu-item" @click="goToMedManagement">
          <div class="menu-icon" :style="{ backgroundColor: '#00bcd4' }">{{ medIcon }}</div>
          <div class="menu-content">
            <div class="menu-title">西医纠错管理</div>
            <div class="menu-desc">西医综合题目纠错反馈处理</div>
          </div>
          <div class="menu-arrow"></div>
        </div>
        <div class="menu-item" @click="goToPanManagement">
          <div class="menu-icon" :style="{ backgroundColor: '#4facfe' }">&#128227;</div>
          <div class="menu-content">
            <div class="menu-title">网盘资源管理</div>
            <div class="menu-desc">管理百度/夸克网盘资源与批量获取</div>
          </div>
          <div class="menu-arrow"></div>
        </div>
        <div class="menu-item" @click="goToQQGroupManage">
          <div class="menu-icon" :style="{ backgroundColor: '#12B7F5' }">&#128172;</div>
          <div class="menu-content">
            <div class="menu-title">QQ群管理</div>
            <div class="menu-desc">管理QQ群信息、置顶设置和标签分类</div>
          </div>
          <div class="menu-arrow"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { adminApi } from '../api'
import { 
  User, 
  VideoPlay, 
  Warning, 
  Picture,
  CaretTop,
  CaretBottom
} from '@element-plus/icons-vue'
import { ROLES, PERMISSIONS, hasPermission, getUserRole } from '@/utils/permission'

// Router
const router = useRouter()

// 主题状态
const isDarkMode = ref(false)

// 图标
const mathIcon = ref('🧮')
const computerIcon = ref('💻')
const medIcon = ref('🏥')
const bannerIcon = ref('🖼️')

// 用户角色
const userRole = ref(getUserRole())

// 角色文本
const roleText = computed(() => {
  const roleMap = {
    [ROLES.SUPER_ADMIN]: '超级管理员',
    [ROLES.ADMIN]: '管理员',
    [ROLES.CONTENT_ADMIN]: '内容管理员'
  }
  return roleMap[userRole.value] || '管理员'
})

// 检查权限
const checkPermission = (permission) => {
  return hasPermission(userRole.value, permission)
}

const currentTime = ref(new Date().toLocaleString())
let timer = null

const stats = ref([
  { title: '总用户数', value: '0', unit: '人', type: '', icon: User, color: '#409EFF', trend: 12 },
  { title: '今日活跃', value: '0', unit: '人', type: 'success', icon: User, color: '#67C23A', trend: 5 },
  { title: '视频课程', value: '0', unit: '门', type: 'warning', icon: VideoPlay, color: '#E6A23C', trend: 0 },
  { title: '待处理纠错', value: '0', unit: '条', type: 'danger', icon: Warning, color: '#F56C6C', trend: -2 }
])

const recentActivities = ref([
  { time: new Date().toISOString(), user: 'admin', action: '登录系统', status: 'success' },
  { time: new Date().toISOString(), user: 'admin', action: '查看了仪表盘', status: 'success' }
])

const formatTime = (timeStr) => {
  const date = new Date(timeStr)
  return date.toLocaleString()
}

const fetchStats = async () => {
  try {
    const res = await adminApi.getDashboardStats()
    if (res.code === 0 && res.data) {
      const data = res.data
      stats.value[0].value = data.totalUsers || '0'
      stats.value[1].value = data.activeToday || '0'
      stats.value[2].value = data.totalVideos || '0'
      stats.value[3].value = data.pendingFeedbacks || '0'
      
      if (data.recentActivities) {
        recentActivities.value = data.recentActivities || []
      }
    }
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    // Fallback to some defaults if API fails
    recentActivities.value = []
  }
}

// 导航函数
const goToUserManage = () => {
  router.push('/user/list')
}

const goToPublicImport = () => {
  router.push('/questions/public')
}

const goToPublicBulkImport = () => {
  router.push('/questions/public')
}

const goToPublicManagement = () => {
  router.push('/questions/public-manage')
}

const goToMedImport = () => {
  router.push('/questions/med')
}

const goToBannerManage = () => {
  router.push('/banner')
}

const goToConfigManage = () => {
  router.push('/system/config')
}

const goToContentManage = () => {
  router.push('/content/notice')
}

const goToVideoAdmin = () => {
  router.push('/video/list')
}

const goToHomepageCardManage = () => {
  router.push('/homepage-card')
}

const goToNavManagement = () => {
  router.push('/nav')
}

const goToPoliticsManagement = () => {
  router.push('/questions/politics-manage')
}

const goToMathManagement = () => {
  router.push('/questions/math-manage')
}

const goToComputerManagement = () => {
  router.push('/questions/computer-manage')
}

const goToMedManagement = () => {
  router.push('/questions/med-manage')
}

const goToPanManagement = () => {
  router.push('/system/pan')
}

const goToQQGroupManage = () => {
  router.push('/qq-groups')
}

// 退出登录
const logout = () => {
  if (confirm('确定要退出管理员登录吗？')) {
    alert('已退出登录')
    // 这里应该调用退出登录的API
    // 然后跳转到登录页面
    // window.location.href = '/login'
  }
}

onMounted(() => {
  // 初始化主题
  const currentTheme = localStorage.getItem('themeMode') || 'light'
  isDarkMode.value = currentTheme === 'dark'
  
  fetchStats()
  timer = setInterval(() => {
    currentTime.value = new Date().toLocaleString()
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.dashboard {
  padding: 10px;
}

.welcome-header {
  margin-bottom: 30px;
}

.welcome-header h2 {
  margin: 0;
  font-size: 24px;
  color: #303133;
}

.subtitle {
  margin: 5px 0 0;
  color: #909399;
  font-size: 14px;
}

.stats-card {
  display: flex;
  align-items: center;
  padding: 10px;
}

:deep(.el-card__body) {
  width: 100%;
  display: flex;
  align-items: center;
}

.stats-icon {
  font-size: 48px;
  margin-right: 20px;
  background: rgba(0, 0, 0, 0.02);
  padding: 15px;
  border-radius: 12px;
}

.stats-info {
  flex: 1;
}

.stats-title {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

.stats-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 4px;
}

.stats-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.unit {
  font-size: 12px;
  color: #C0C4CC;
}

.trend {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 2px;
}

.trend.up {
  color: #67C23A;
}

.trend.down {
  color: #F56C6C;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mt-20 {
  margin-top: 20px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.status-item span {
  color: #606266;
  font-size: 14px;
}

.time-text {
  font-size: 13px;
  color: #909399;
}

/* 顶部导航栏 */
.nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  background-color: #ffffff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  margin: -20px -20px 20px;
  position: relative;
  z-index: 10;
}

.nav-title {
  font-size: 24px;
  font-weight: bold;
  color: #333333;
  transition: all 0.3s ease;
}

.nav-actions {
  display: flex;
  gap: 15px;
  align-items: center;
}

.role-badge {
  padding: 8px 16px;
  background-color: #6666ff;
  color: #ffffff;
  font-size: 14px;
  border-radius: 12px;
  font-weight: bold;
  transition: all 0.3s ease;
}

.action-btn {
  padding: 8px 16px;
  background-color: #ff6b35;
  color: #ffffff;
  font-size: 14px;
  border-radius: 6px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.action-btn:hover {
  opacity: 0.9;
}

.action-btn:active {
  transform: scale(0.98);
}

/* 管理员功能菜单 */
.admin-section {
  margin-top: 30px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 12px;
}

.menu-group {
  background-color: #ffffff;
  border-radius: 12px;
  margin-bottom: 20px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.group-title {
  font-size: 16px;
  font-weight: bold;
  color: #999999;
  padding: 15px 20px;
  background-color: #f0f0f0;
  transition: all 0.3s ease;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 20px;
  transition: all 0.3s ease;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:hover {
  background-color: #f0f4ff;
}

.menu-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  margin-right: 15px;
}

.menu-content {
  flex: 1;
}

.menu-title {
  font-size: 16px;
  font-weight: bold;
  color: #333333;
  margin-bottom: 6px;
  transition: all 0.3s ease;
}

.menu-desc {
  font-size: 12px;
  color: #999999;
  transition: all 0.3s ease;
}

.menu-arrow {
  width: 12px;
  height: 12px;
  border-top: 2px solid #999999;
  border-right: 2px solid #999999;
  transform: rotate(45deg);
  transition: all 0.3s ease;
}

/* 深色模式样式 */
.dark-mode {
  background-color: #1a1a1a;
}

.dark-mode .dashboard {
  background-color: #1a1a1a;
}

.dark-mode .nav-bar {
  background-color: #2d2d2d;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.dark-mode .nav-title {
  color: #ffffff;
}

.dark-mode .welcome-header h2 {
  color: #ffffff;
}

.dark-mode .welcome-header .subtitle {
  color: #cccccc;
}

.dark-mode .menu-group {
  background-color: #2d2d2d;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.dark-mode .group-title {
  color: #cccccc;
  background-color: #3a3a3a;
}

.dark-mode .menu-item {
  border-bottom: 1px solid #404040;
}

.dark-mode .menu-item:hover {
  background-color: #3a3a7a;
}

.dark-mode .menu-title {
  color: #ffffff;
}

.dark-mode .menu-desc {
  color: #cccccc;
}

.dark-mode .menu-arrow {
  border-top: 2px solid #cccccc;
  border-right: 2px solid #cccccc;
}

.dark-mode .stats-card {
  background-color: #2d2d2d;
}

.dark-mode .stats-value {
  color: #ffffff;
}

.dark-mode .activity-card,
.dark-mode .system-card {
  background-color: #2d2d2d;
}

.dark-mode .activity-card .card-header span,
.dark-mode .system-card .el-card__header {
  color: #ffffff;
}

.dark-mode .status-item span {
  color: #cccccc;
}

.dark-mode .time-text {
  color: #cccccc;
}
</style>
