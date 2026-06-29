<template>
  <div class="checkin-manage">
    <el-tabs v-model="activeTab" class="manage-tabs">
      <el-tab-pane label="打卡类别" name="categories">
        <div class="header-actions">
          <el-button type="primary" @click="openCategoryModal()">
            <el-icon><Plus /></el-icon> 添加类别
          </el-button>
        </div>
        <el-table :data="categories" v-loading="loading" border stripe>
          <el-table-column prop="id" label="ID" width="60" align="center" />
          <el-table-column label="封面" width="80" align="center">
            <template #default="{ row }">
              <el-image 
                v-if="row.cover_image" 
                :src="row.cover_image" 
                :preview-src-list="[row.cover_image]"
                fit="cover"
                style="width: 50px; height: 50px; border-radius: 8px;"
              />
              <div v-else class="default-cover">
                <el-icon><Picture /></el-icon>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="类别名称" min-width="120" />
          <el-table-column label="打卡时间" min-width="180">
            <template #default="{ row }">
              <div v-if="row.start_time || row.end_time" class="time-range">
                <div v-if="row.start_time">开始: {{ formatDateTime(row.start_time) }}</div>
                <div v-if="row.end_time">结束: {{ formatDateTime(row.end_time) }}</div>
              </div>
              <span v-else class="text-muted">未设置</span>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="描述" min-width="150" show-overflow-tooltip />
          <el-table-column prop="pre_register_count" label="预报名" width="80" align="center">
            <template #default="{ row }">
              <el-button 
                v-if="row.pre_register_count > 0" 
                type="primary" 
                link 
                @click="showPreRegisters(row)"
              >
                {{ row.pre_register_count }}人
              </el-button>
              <span v-else>0</span>
            </template>
          </el-table-column>
          <el-table-column prop="join_count" label="参与人数" width="80" align="center" />
          <el-table-column prop="checkin_count" label="打卡次数" width="80" align="center" />
          <el-table-column prop="sort_order" label="排序" width="60" align="center" />
          <el-table-column prop="status" label="状态" width="70" align="center">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
                {{ row.status === 1 ? '启用' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" align="center" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" link @click="openCategoryModal(row)">编辑</el-button>
              <el-button size="small" type="danger" link @click="deleteCategory(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="打卡记录" name="records">
        <div class="header-actions">
          <el-select v-model="filterCategory" placeholder="选择类别" clearable style="width: 200px; margin-right: 10px;" @change="loadRecords">
            <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="cat.id" />
          </el-select>
          <el-input
            v-model="searchKeyword"
            placeholder="搜索用户名"
            style="width: 200px"
            clearable
            @clear="loadRecords"
            @keyup.enter="loadRecords"
          />
          <el-button type="primary" style="margin-left: 10px;" @click="loadRecords">搜索</el-button>
          <el-button type="success" style="margin-left: 10px;" @click="openExportModal">
            <el-icon><Download /></el-icon> 导出Excel
          </el-button>
        </div>
        <el-table :data="records" v-loading="recordsLoading" border stripe>
          <el-table-column prop="id" label="ID" width="60" align="center" />
          <el-table-column prop="username" label="用户" width="100">
            <template #default="{ row }">
              <el-button type="primary" link @click="showUserCalendar(row)">
                {{ row.username }}
              </el-button>
            </template>
          </el-table-column>
          <el-table-column prop="category_name" label="类别" width="120" />
          <el-table-column prop="title" label="标题" min-width="100" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.title || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="content" label="内容" min-width="180" show-overflow-tooltip />
          <el-table-column label="图片" width="60" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.images && row.images.length > 0" type="info" size="small">
                {{ row.images.length }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="like_count" label="点赞" width="60" align="center" />
          <el-table-column prop="comment_count" label="评论" width="60" align="center" />
          <el-table-column prop="checkin_time" label="打卡时间" width="150" align="center">
            <template #default="{ row }">
              {{ formatDateTime(row.checkin_time) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" align="center" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" link @click="viewRecordDetail(row)">详情</el-button>
              <el-button size="small" type="danger" link @click="deleteRecord(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-container">
          <el-pagination
            v-model:current-page="recordsPage"
            v-model:page-size="recordsPageSize"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            :total="recordsTotal"
            @size-change="loadRecords"
            @current-change="loadRecords"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="评论管理" name="comments">
        <div class="header-actions">
          <el-input
            v-model="commentSearchKeyword"
            placeholder="搜索评论内容"
            style="width: 200px"
            clearable
            @clear="loadComments"
            @keyup.enter="loadComments"
          />
          <el-button type="primary" style="margin-left: 10px;" @click="loadComments">搜索</el-button>
        </div>
        <el-table :data="comments" v-loading="commentsLoading" border stripe>
          <el-table-column prop="id" label="ID" width="60" align="center" />
          <el-table-column prop="username" label="评论用户" width="100" />
          <el-table-column prop="record_content" label="打卡内容" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.record_content || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="content" label="评论内容" min-width="200" show-overflow-tooltip />
          <el-table-column prop="created_at" label="评论时间" width="150" align="center">
            <template #default="{ row }">
              {{ formatDateTime(row.created_at) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="danger" link @click="deleteComment(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-container">
          <el-pagination
            v-model:current-page="commentsPage"
            v-model:page-size="commentsPageSize"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            :total="commentsTotal"
            @size-change="loadComments"
            @current-change="loadComments"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="showCategoryModal"
      :title="editingCategory.id ? '编辑类别' : '添加类别'"
      width="550px"
    >
      <el-form :model="editingCategory" label-width="90px">
        <el-form-item label="封面图片">
          <div class="cover-upload">
            <el-upload
              class="cover-uploader"
              :action="uploadUrl"
              :headers="uploadHeaders"
              :show-file-list="false"
              :on-success="handleCoverSuccess"
              :before-upload="beforeCoverUpload"
              accept="image/*"
            >
              <el-image 
                v-if="editingCategory.cover_image" 
                :src="editingCategory.cover_image" 
                fit="cover"
                class="cover-preview"
              />
              <el-icon v-else class="cover-uploader-icon"><Plus /></el-icon>
            </el-upload>
            <div class="cover-tip">建议尺寸: 200x200</div>
          </div>
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="editingCategory.name" placeholder="请输入类别名称" />
        </el-form-item>
        <el-form-item label="打卡时间">
          <el-date-picker
            v-model="editingCategory.timeRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editingCategory.description" type="textarea" :rows="3" placeholder="请输入描述" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="editingCategory.sort_order" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="editingCategory.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCategoryModal = false">取消</el-button>
        <el-button type="primary" @click="saveCategory">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showRecordDetail"
      title="打卡详情"
      width="650px"
      class="record-detail-dialog"
    >
      <div v-if="selectedRecord" class="record-detail">
        <div class="detail-header">
          <div class="user-info">
            <el-avatar :size="48" class="user-avatar">
              {{ selectedRecord.username?.charAt(0) }}
            </el-avatar>
            <div class="user-meta">
              <div class="username">{{ selectedRecord.username }}</div>
              <div class="category-tag">{{ selectedRecord.category_name }}</div>
            </div>
          </div>
          <div class="time-info">
            <el-icon><Clock /></el-icon>
            {{ formatDateTime(selectedRecord.checkin_time) }}
          </div>
        </div>
        
        <div v-if="selectedRecord.title" class="detail-title">
          {{ selectedRecord.title }}
        </div>
        
        <div class="detail-content">
          {{ selectedRecord.content }}
        </div>
        
        <div v-if="selectedRecord.images && selectedRecord.images.length > 0" class="detail-images">
          <el-image 
            v-for="(img, index) in selectedRecord.images" 
            :key="index"
            :src="img" 
            :preview-src-list="selectedRecord.images"
            :initial-index="index"
            fit="cover"
            class="detail-image"
          />
        </div>
        
        <div class="detail-stats">
          <div class="stat-item">
            <el-icon><Star /></el-icon>
            <span>{{ selectedRecord.like_count || 0 }}</span>
            <span class="stat-label">点赞</span>
          </div>
          <div class="stat-item">
            <el-icon><ChatDotRound /></el-icon>
            <span>{{ selectedRecord.comment_count || 0 }}</span>
            <span class="stat-label">评论</span>
          </div>
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="showUserCalendarModal"
      :title="`${calendarUser?.username} 的打卡日历`"
      width="800px"
      class="calendar-dialog"
    >
      <div class="calendar-container">
        <div class="calendar-header">
          <el-button @click="prevMonth" :icon="ArrowLeft" circle />
          <span class="calendar-title">{{ currentYear }}年{{ currentMonth }}月</span>
          <el-button @click="nextMonth" :icon="ArrowRight" circle />
        </div>
        <div class="calendar-grid">
          <div class="calendar-weekdays">
            <div v-for="day in weekdays" :key="day" class="weekday">{{ day }}</div>
          </div>
          <div class="calendar-days">
            <div 
              v-for="(day, index) in calendarDays" 
              :key="index"
              :class="['calendar-day', { 
                'other-month': day.otherMonth,
                'has-record': day.hasRecord,
                'today': day.isToday
              }]"
            >
              <span class="day-number">{{ day.day }}</span>
              <div v-if="day.hasRecord" class="record-dot"></div>
            </div>
          </div>
        </div>
        <div class="calendar-legend">
          <span class="legend-item"><span class="dot has"></span> 已打卡</span>
          <span class="legend-item"><span class="dot none"></span> 未打卡</span>
        </div>
        <div class="calendar-stats">
          <div class="stat">本月打卡: <strong>{{ monthCheckinCount }}</strong> 天</div>
          <div class="stat">总打卡: <strong>{{ totalCheckinCount }}</strong> 天</div>
        </div>
        <div class="calendar-actions">
          <el-button type="success" @click="exportUserRecords">
            <el-icon><Download /></el-icon> 导出该用户记录
          </el-button>
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="showPreRegistersModal"
      :title="`${selectedCategory?.name} - 预报名列表`"
      width="500px"
    >
      <el-table :data="preRegisters" v-loading="preRegistersLoading" border stripe max-height="400">
        <el-table-column prop="username" label="用户名" min-width="100" />
        <el-table-column prop="studentId" label="学号" min-width="120" />
        <el-table-column prop="created_at" label="预报名时间" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog
      v-model="showExportModal"
      title="导出打卡记录"
      width="500px"
    >
      <el-form label-width="100px">
        <el-form-item label="打卡类别">
          <el-select v-model="exportCategory" placeholder="全部类别" clearable style="width: 100%">
            <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="cat.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="exportDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 100%"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showExportModal = false">取消</el-button>
        <el-button type="primary" @click="doExport">确认导出</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Picture, Star, ChatDotRound, Clock, ArrowLeft, ArrowRight, Download } from '@element-plus/icons-vue'
import { adminApi } from '@/api'

const activeTab = ref('categories')
const loading = ref(false)
const categories = ref([])

const records = ref([])
const recordsLoading = ref(false)
const recordsPage = ref(1)
const recordsPageSize = ref(20)
const recordsTotal = ref(0)
const filterCategory = ref('')
const searchKeyword = ref('')

const comments = ref([])
const commentsLoading = ref(false)
const commentsPage = ref(1)
const commentsPageSize = ref(20)
const commentsTotal = ref(0)
const commentSearchKeyword = ref('')

const showCategoryModal = ref(false)
const editingCategory = ref({ id: null, name: '', description: '', cover_image: '', timeRange: null, sort_order: 0, status: 1 })

const showRecordDetail = ref(false)
const selectedRecord = ref(null)

const showUserCalendarModal = ref(false)
const calendarUser = ref(null)
const userRecords = ref([])
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)

const showPreRegistersModal = ref(false)
const selectedCategory = ref(null)
const preRegisters = ref([])
const preRegistersLoading = ref(false)

const showExportModal = ref(false)
const exportCategory = ref('')
const exportDateRange = ref(null)

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const uploadUrl = computed(() => {
  const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'
  return `${baseURL}/upload/image`
})

const uploadHeaders = computed(() => {
  const token = localStorage.getItem('admin_token')
  return { Authorization: `Bearer ${token}` }
})

const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const daysInMonth = lastDay.getDate()
  const startWeekday = firstDay.getDay()
  
  const days = []
  
  for (let i = startWeekday - 1; i >= 0; i--) {
    const prevMonthDay = new Date(year, month - 2, daysInMonth - i)
    days.push({
      day: prevMonthDay.getDate(),
      otherMonth: true,
      hasRecord: false,
      isToday: false
    })
  }
  
  const today = new Date()
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    const hasRecord = userRecords.value.some(r => {
      const recordDate = new Date(r.checkin_time)
      return recordDate.getFullYear() === year && 
             recordDate.getMonth() + 1 === month && 
             recordDate.getDate() === i
    })
    const isToday = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === i
    days.push({
      day: i,
      otherMonth: false,
      hasRecord,
      isToday
    })
  }
  
  const remainingDays = 42 - days.length
  for (let i = 1; i <= remainingDays; i++) {
    days.push({
      day: i,
      otherMonth: true,
      hasRecord: false,
      isToday: false
    })
  }
  
  return days
})

const monthCheckinCount = computed(() => {
  return calendarDays.value.filter(d => !d.otherMonth && d.hasRecord).length
})

const totalCheckinCount = computed(() => userRecords.value.length)

const loadCategories = async () => {
  loading.value = true
  try {
    const res = await adminApi.getCheckinCategories()
    categories.value = res.data
  } catch (error) {
    console.error('加载类别失败:', error)
    ElMessage.error('加载类别失败')
  } finally {
    loading.value = false
  }
}

const openCategoryModal = (category = null) => {
  if (category) {
    const timeRange = (category.start_time || category.end_time) 
      ? [category.start_time ? new Date(category.start_time) : null, category.end_time ? new Date(category.end_time) : null]
      : null
    editingCategory.value = { 
      ...category, 
      cover_image: category.cover_image || '', 
      timeRange 
    }
  } else {
    editingCategory.value = { id: null, name: '', description: '', cover_image: '', timeRange: null, sort_order: 0, status: 1 }
  }
  showCategoryModal.value = true
}

const beforeCoverUpload = (file) => {
  const isImage = file.type.startsWith('image/')
  const isLt2M = file.size / 1024 / 1024 < 2
  if (!isImage) {
    ElMessage.error('只能上传图片文件!')
    return false
  }
  if (!isLt2M) {
    ElMessage.error('图片大小不能超过 2MB!')
    return false
  }
  return true
}

const handleCoverSuccess = (response) => {
  if (response.code === 0 && response.data && response.data.url) {
    editingCategory.value.cover_image = response.data.url
    ElMessage.success('上传成功')
  } else {
    ElMessage.error(response.message || '上传失败')
  }
}

const saveCategory = async () => {
  try {
    const data = {
      name: editingCategory.value.name,
      description: editingCategory.value.description,
      cover_image: editingCategory.value.cover_image,
      start_time: editingCategory.value.timeRange?.[0] || null,
      end_time: editingCategory.value.timeRange?.[1] || null,
      sort_order: editingCategory.value.sort_order,
      status: editingCategory.value.status
    }
    if (editingCategory.value.id) {
      await adminApi.updateCheckinCategory(editingCategory.value.id, data)
    } else {
      await adminApi.createCheckinCategory(data)
    }
    ElMessage.success('保存成功')
    showCategoryModal.value = false
    loadCategories()
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error(error.response?.data?.message || '保存失败')
  }
}

const deleteCategory = async (category) => {
  try {
    await ElMessageBox.confirm('确定要删除该类别吗？删除后无法恢复', '提示', { type: 'warning' })
    await adminApi.deleteCheckinCategory(category.id)
    ElMessage.success('删除成功')
    loadCategories()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

const loadRecords = async () => {
  recordsLoading.value = true
  try {
    const params = {
      page: recordsPage.value,
      limit: recordsPageSize.value,
      categoryId: filterCategory.value,
      keyword: searchKeyword.value
    }
    const res = await adminApi.getCheckinRecords(params)
    records.value = res.data.list.map(record => {
      if (typeof record.images === 'string') {
        try {
          record.images = JSON.parse(record.images)
        } catch {
          record.images = []
        }
      }
      return record
    })
    recordsTotal.value = res.data.total
  } catch (error) {
    console.error('加载记录失败:', error)
    ElMessage.error('加载记录失败')
  } finally {
    recordsLoading.value = false
  }
}

const viewRecordDetail = (record) => {
  selectedRecord.value = record
  showRecordDetail.value = true
}

const deleteRecord = async (record) => {
  try {
    await ElMessageBox.confirm('确定要删除该打卡记录吗？', '提示', { type: 'warning' })
    await adminApi.deleteCheckinRecord(record.id)
    ElMessage.success('删除成功')
    loadRecords()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

const loadComments = async () => {
  commentsLoading.value = true
  try {
    const params = {
      page: commentsPage.value,
      limit: commentsPageSize.value,
      keyword: commentSearchKeyword.value
    }
    const res = await adminApi.getCheckinComments(params)
    comments.value = res.data.list
    commentsTotal.value = res.data.total
  } catch (error) {
    console.error('加载评论失败:', error)
    ElMessage.error('加载评论失败')
  } finally {
    commentsLoading.value = false
  }
}

const deleteComment = async (comment) => {
  try {
    await ElMessageBox.confirm('确定要删除该评论吗？', '提示', { type: 'warning' })
    await adminApi.deleteCheckinComment(comment.id)
    ElMessage.success('删除成功')
    loadComments()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

const showUserCalendar = async (record) => {
  calendarUser.value = record
  showUserCalendarModal.value = true
  try {
    const res = await adminApi.getUserRecordsByCategory(record.category_id, record.user_id)
    userRecords.value = res.data
  } catch (error) {
    console.error('加载用户记录失败:', error)
  }
}

const prevMonth = () => {
  if (currentMonth.value === 1) {
    currentMonth.value = 12
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

const nextMonth = () => {
  if (currentMonth.value === 12) {
    currentMonth.value = 1
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

const showPreRegisters = async (category) => {
  selectedCategory.value = category
  showPreRegistersModal.value = true
  preRegistersLoading.value = true
  try {
    const res = await adminApi.getPreRegisters(category.id)
    preRegisters.value = res.data
  } catch (error) {
    console.error('加载预报名列表失败:', error)
    ElMessage.error('加载预报名列表失败')
  } finally {
    preRegistersLoading.value = false
  }
}

const openExportModal = () => {
  exportCategory.value = filterCategory.value || ''
  showExportModal.value = true
}

const doExport = async () => {
  const params = {}
  if (exportCategory.value) {
    params.categoryId = exportCategory.value
  }
  if (exportDateRange.value && exportDateRange.value.length === 2) {
    params.startDate = exportDateRange.value[0]
    params.endDate = exportDateRange.value[1]
  }
  
  try {
    const response = await adminApi.exportRecords(params)
    const blob = new Blob([response], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `打卡记录_${new Date().toISOString().split('T')[0]}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    showExportModal.value = false
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('Export error:', error)
    ElMessage.error('导出失败')
  }
}

const exportUserRecords = async () => {
  if (!calendarUser.value) return
  const params = {
    targetUserId: calendarUser.value.user_id
  }
  if (calendarUser.value.category_id) {
    params.categoryId = calendarUser.value.category_id
  }
  
  try {
    const response = await adminApi.exportRecords(params)
    const blob = new Blob([response], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${calendarUser.value.username}_打卡记录_${new Date().toISOString().split('T')[0]}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('Export error:', error)
    ElMessage.error('导出失败')
  }
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  loadCategories()
  loadRecords()
  loadComments()
})
</script>

<style scoped>
.checkin-manage {
  padding: 20px;
}

.manage-tabs {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
}

.header-actions {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.default-cover {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
}

.text-muted {
  color: #909399;
  font-size: 12px;
}

.time-range {
  font-size: 12px;
  line-height: 1.6;
  color: #606266;
}

.cover-upload {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.cover-uploader {
  border: 1px dashed #d9d9d9;
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.3s;
}

.cover-uploader:hover {
  border-color: #409eff;
}

.cover-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 100px;
  height: 100px;
  text-align: center;
  line-height: 100px;
}

.cover-preview {
  width: 100px;
  height: 100px;
  display: block;
}

.cover-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}

.record-detail-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.record-detail {
  padding: 0;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  background: rgba(255,255,255,0.2);
  color: white;
}

.user-meta .username {
  font-size: 16px;
  font-weight: 500;
}

.user-meta .category-tag {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 4px;
}

.time-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  opacity: 0.9;
}

.detail-title {
  padding: 16px 20px;
  font-size: 16px;
  font-weight: 500;
  border-bottom: 1px solid #ebeef5;
}

.detail-content {
  padding: 20px;
  line-height: 1.8;
  color: #303133;
  background: #fafafa;
  margin: 16px 20px;
  border-radius: 8px;
}

.detail-images {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0 20px;
}

.detail-image {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  cursor: pointer;
}

.detail-stats {
  display: flex;
  gap: 30px;
  padding: 16px 20px;
  border-top: 1px solid #ebeef5;
  margin-top: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #606266;
}

.stat-item .el-icon {
  font-size: 18px;
  color: #f56c6c;
}

.stat-item span:first-of-type {
  font-weight: 500;
}

.stat-label {
  color: #909399;
  font-size: 12px;
}

.calendar-dialog .calendar-container {
  padding: 10px;
}

.calendar-header {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
}

.calendar-title {
  font-size: 18px;
  font-weight: 500;
  min-width: 120px;
  text-align: center;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: #f5f7fa;
  border-radius: 8px 8px 0 0;
}

.weekday {
  padding: 12px;
  text-align: center;
  font-weight: 500;
  color: #606266;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border: 1px solid #ebeef5;
  border-top: none;
  border-radius: 0 0 8px 8px;
}

.calendar-day {
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #ebeef5;
  border-bottom: 1px solid #ebeef5;
  position: relative;
}

.calendar-day:nth-child(7n) {
  border-right: none;
}

.calendar-day.other-month {
  color: #c0c4cc;
  background: #fafafa;
}

.calendar-day.today {
  background: #ecf5ff;
}

.calendar-day.today .day-number {
  background: #409eff;
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.calendar-day.has-record {
  background: #f0f9eb;
}

.day-number {
  font-size: 14px;
}

.record-dot {
  width: 6px;
  height: 6px;
  background: #67c23a;
  border-radius: 50%;
  margin-top: 4px;
}

.calendar-legend {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 16px;
  font-size: 13px;
  color: #606266;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-item .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-item .dot.has {
  background: #67c23a;
}

.legend-item .dot.none {
  background: #dcdfe6;
}

.calendar-stats {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-top: 16px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.calendar-stats .stat {
  font-size: 14px;
  color: #606266;
}

.calendar-stats strong {
  color: #409eff;
  font-size: 18px;
}

.calendar-actions {
  display: flex;
  justify-content: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}
</style>
