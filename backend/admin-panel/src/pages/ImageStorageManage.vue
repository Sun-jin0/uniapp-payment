<template>
  <div class="image-storage-manage">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-value">{{ stats.total_images || 0 }}</div>
          <div class="stats-label">总图片数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-value">{{ stats.oss_success_count || 0 }}</div>
          <div class="stats-label">OSS成功</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-value">{{ stats.imgbb_success_count || 0 }}</div>
          <div class="stats-label">ImgBB成功</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-value">{{ formatFileSize(stats.total_size || 0) }}</div>
          <div class="stats-label">总大小</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 搜索栏 -->
    <el-card class="search-card">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="搜索文件名" clearable />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="searchForm.sourceType" placeholder="选择分类" clearable style="width: 140px;">
            <el-option label="题目图片" value="question" />
            <el-option label="用户头像" value="avatar" />
            <el-option label="轮播图" value="banner" />
            <el-option label="考试答题" value="exam_answer" />
            <el-option label="文章内容" value="article" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="使用状态">
          <el-select v-model="searchForm.usageStatus" placeholder="使用状态" clearable style="width: 120px;">
            <el-option label="已使用" value="used" />
            <el-option label="未使用" value="unused" />
          </el-select>
        </el-form-item>
        <el-form-item label="图床状态">
          <el-select v-model="searchForm.storageStatus" placeholder="图床状态" clearable style="width: 130px;">
            <el-option label="OSS成功" value="oss_success" />
            <el-option label="ImgBB成功" value="imgbb_success" />
            <el-option label="OSS失败" value="oss_failed" />
            <el-option label="ImgBB失败" value="imgbb_failed" />
          </el-select>
        </el-form-item>
        <el-form-item label="上传时间">
          <el-date-picker
            v-model="searchForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 操作栏 -->
    <el-card class="table-card">
      <template #header>
        <div class="table-header">
          <span>图片列表</span>
          <div class="table-actions">
            <el-button type="primary" @click="uploadDialogVisible = true">
              <el-icon><Upload /></el-icon> 上传图片
            </el-button>
            <el-button type="danger" @click="handleBatchDelete" :disabled="selectedImages.length === 0">
              批量删除
            </el-button>
            <el-button type="warning" @click="handleCleanUnused">
              清理未使用图片
            </el-button>
            <el-button type="info" @click="handleScanAllImages">
              扫描所有图片
            </el-button>
            <el-button @click="loadStats">刷新统计</el-button>
          </div>
        </div>
      </template>

      <!-- 图片表格 -->
      <el-table
        v-loading="loading"
        :data="imageList"
        @selection-change="handleSelectionChange"
        stripe
      >
        <el-table-column type="selection" width="55" />
        <el-table-column label="预览" width="100">
          <template #default="{ row }">
            <el-image
              :src="row.oss_url || row.imgbb_url"
              :preview-src-list="[row.oss_url || row.imgbb_url]"
              fit="cover"
              style="width: 60px; height: 60px; border-radius: 4px;"
            />
          </template>
        </el-table-column>
        <el-table-column prop="image_name" label="文件名" min-width="150" show-overflow-tooltip />
        <el-table-column label="分类" width="100">
          <template #default="{ row }">
            <el-tag :type="getSourceTypeType(row.source_type)">
              {{ getSourceTypeLabel(row.source_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="大小" width="100">
          <template #default="{ row }">
            {{ formatFileSize(row.image_size) }}
          </template>
        </el-table-column>
        <el-table-column label="OSS状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.oss_status === 1 ? 'success' : 'danger'" size="small">
              {{ row.oss_status === 1 ? '✓ 成功' : '✗ 失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="ImgBB状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.imgbb_status === 1 ? 'success' : 'danger'" size="small">
              {{ row.imgbb_status === 1 ? '✓ 成功' : '✗ 失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="使用状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.usage_count > 0 ? 'success' : 'info'" size="small">
              {{ row.usage_count > 0 ? `已使用(${row.usage_count})` : '未使用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="上传时间" width="160" />
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button type="warning" size="small" @click="handleEdit(row)">修改</el-button>
            <el-button type="info" size="small" @click="handleReplace(row)">替换</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 查看详情弹窗 -->
    <el-dialog v-model="viewDialogVisible" title="图片详情" width="700px">
      <div v-if="currentImage" class="image-detail">
        <el-image
          :src="currentImage.oss_url || currentImage.imgbb_url"
          fit="contain"
          style="width: 100%; max-height: 300px; margin-bottom: 20px;"
        />
        <el-descriptions :column="2" border>
          <el-descriptions-item label="文件名">{{ currentImage.image_name }}</el-descriptions-item>
          <el-descriptions-item label="文件类型">{{ currentImage.image_type }}</el-descriptions-item>
          <el-descriptions-item label="文件大小">{{ formatFileSize(currentImage.image_size) }}</el-descriptions-item>
          <el-descriptions-item label="MD5">{{ currentImage.image_hash }}</el-descriptions-item>
          <el-descriptions-item label="分类">{{ getSourceTypeLabel(currentImage.source_type) }}</el-descriptions-item>
          <el-descriptions-item label="上传时间">{{ currentImage.created_at }}</el-descriptions-item>
          <el-descriptions-item label="OSS URL" :span="2">
            <div class="url-item">
              <el-link type="primary" :href="currentImage.oss_url" target="_blank">{{ currentImage.oss_url }}</el-link>
              <el-button type="primary" size="small" @click="copyUrl(currentImage.oss_url)">复制</el-button>
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="ImgBB URL" :span="2">
            <div class="url-item">
              <el-link type="primary" :href="currentImage.imgbb_url" target="_blank">{{ currentImage.imgbb_url }}</el-link>
              <el-button type="primary" size="small" @click="copyUrl(currentImage.imgbb_url)">复制</el-button>
            </div>
          </el-descriptions-item>
        </el-descriptions>

        <!-- 使用记录 -->
        <div class="usage-section" v-if="currentImage.usageLog && currentImage.usageLog.length > 0">
          <h4>使用记录</h4>
          <el-table :data="currentImage.usageLog" size="small">
            <el-table-column prop="usage_type" label="使用类型" />
            <el-table-column prop="usage_id" label="对象ID" />
            <el-table-column prop="created_at" label="使用时间" />
          </el-table>
        </div>
      </div>
    </el-dialog>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editDialogVisible" title="修改图片信息" width="600px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="文件名">
          <el-input v-model="editForm.image_name" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="editForm.source_type" style="width: 100%;">
            <el-option label="题目图片" value="question" />
            <el-option label="用户头像" value="avatar" />
            <el-option label="轮播图" value="banner" />
            <el-option label="考试答题" value="exam_answer" />
            <el-option label="文章内容" value="article" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="OSS URL">
          <el-input v-model="editForm.oss_url" />
        </el-form-item>
        <el-form-item label="ImgBB URL">
          <el-input v-model="editForm.imgbb_url" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.remark" type="textarea" rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleUpdate" :loading="updateLoading">保存</el-button>
      </template>
    </el-dialog>

    <!-- 上传图片弹窗 -->
    <el-dialog v-model="uploadDialogVisible" title="上传图片" width="500px">
      <el-upload
        class="upload-demo"
        drag
        action="/api/upload/image"
        :headers="uploadHeaders"
        :data="uploadData"
        name="image"
        :on-success="handleUploadSuccess"
        :on-error="handleUploadError"
        accept="image/*"
        multiple
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          拖拽文件到此处或 <em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持同时上传到OSS和ImgBB两个图床，自动去重
          </div>
        </template>
      </el-upload>
    </el-dialog>

    <!-- 扫描所有图片弹窗 -->
    <el-dialog v-model="scanDialogVisible" title="扫描数据库中的所有图片链接" width="800px">
      <div v-loading="scanLoading" :element-loading-text="scanLoadingText">
        <el-alert
          title="此功能会扫描数据库所有表中的所有图片链接，帮助您发现模糊或需要替换的图片"
          type="info"
          :closable="false"
          class="mb-20"
        />
        
        <div class="scan-actions mb-20">
          <el-select
            v-model="scanTableFilter"
            placeholder="选择数据表"
            clearable
            style="width: 200px; margin-right: 10px;"
          >
            <el-option label="computer1_question" value="computer1_question" />
            <el-option label="computer1_question_option" value="computer1_question_option" />
            <el-option label="computer1_question_sub" value="computer1_question_sub" />
            <el-option label="math_questiondetails" value="math_questiondetails" />
            <el-option label="math_knowledgepoints" value="math_knowledgepoints" />
          </el-select>
          <el-select
            v-model="scanUrlPrefixFilter"
            placeholder="选择URL前缀"
            clearable
            style="width: 250px; margin-right: 10px;"
            v-if="urlPrefixes.length > 0"
          >
            <el-option 
              v-for="prefix in urlPrefixes" 
              :key="prefix" 
              :label="prefix" 
              :value="prefix" 
            />
          </el-select>
          <el-input
            v-model="scanUrlFilter"
            placeholder="筛选图片URL关键词..."
            clearable
            style="width: 200px; margin-right: 10px;"
          />
          <el-button type="primary" @click="startScanAllImages" :loading="scanLoading">
            开始扫描
          </el-button>
          <el-button @click="exportScanResults" :disabled="filteredScanResults.length === 0">
            导出结果
          </el-button>
        </div>
        
        <div v-if="scanResults.length > 0" class="scan-stats mb-10">
          <el-tag type="success">共发现 {{ scanResults.length }} 个图片链接</el-tag>
          <el-tag type="info" class="ml-10">显示 {{ filteredScanResults.length }} 个</el-tag>
        </div>
        
        <el-table
          :data="filteredScanResults"
          border
          stripe
          height="400"
          v-if="filteredScanResults.length > 0"
        >
          <el-table-column label="预览" width="80">
            <template #default="{ row }">
              <el-image
                :src="row.url"
                fit="cover"
                style="width: 50px; height: 50px; border-radius: 4px;"
                :preview-src-list="[row.url]"
              />
            </template>
          </el-table-column>
          <el-table-column prop="url" label="图片URL" min-width="250" show-overflow-tooltip />
          <el-table-column prop="tableName" label="所在表" width="120" />
          <el-table-column prop="fieldName" label="所在字段" width="120" />
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="handleReplaceFromScan(row)">替换</el-button>
              <el-button type="success" size="small" @click="copyUrl(row.url)">复制</el-button>
            </template>
          </el-table-column>
        </el-table>
        
        <el-empty v-else-if="!scanLoading && scanResults.length === 0" description="点击「开始扫描」按钮开始扫描数据库中的图片链接" />
      </div>
    </el-dialog>

    <!-- 替换图片弹窗 -->
    <el-dialog v-model="replaceDialogVisible" title="替换图片" width="500px">
      <div v-if="currentReplaceImage" class="replace-info">
        <p>正在替换: <strong>{{ currentReplaceImage.image_name }}</strong></p>
        <p class="replace-tip">上传新图片将替换原图片，所有引用链接将自动更新</p>
      </div>
      <el-upload
        ref="replaceUploadRef"
        class="upload-demo"
        drag
        action="#"
        :auto-upload="false"
        :on-change="handleReplaceFileChange"
        accept="image/*"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          拖拽文件到此处或 <em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持 jpg/png/gif/webp 格式，单个文件不超过5MB
          </div>
        </template>
      </el-upload>
      <template #footer>
        <el-button @click="replaceDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReplace" :loading="replaceLoading">确认替换</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UploadFilled, Upload } from '@element-plus/icons-vue'
import axios from 'axios'
import { adminApi, service } from '../api'

// 统计数据
const stats = ref({})
const loading = ref(false)
const imageList = ref([])
const selectedImages = ref([])

// 搜索表单
const searchForm = reactive({
  keyword: '',
  sourceType: '',
  usageStatus: '',
  storageStatus: '',
  dateRange: []
})

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 当前查看的图片
const currentImage = ref(null)
const viewDialogVisible = ref(false)

// 编辑表单
const editDialogVisible = ref(false)
const updateLoading = ref(false)
const editForm = reactive({
  id: null,
  image_name: '',
  source_type: '',
  oss_url: '',
  imgbb_url: '',
  remark: ''
})

// 上传图片
const uploadDialogVisible = ref(false)
const uploadData = {
  sourceType: 'other'
}

// 替换图片
const replaceDialogVisible = ref(false)
const replaceLoading = ref(false)
const currentReplaceImage = ref(null)
const replaceUploadRef = ref(null)
const replaceFile = ref(null)
const uploadHeaders = {
  'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
}

// 扫描所有图片
const scanDialogVisible = ref(false)
const scanLoading = ref(false)
const scanLoadingText = ref('')
const scanResults = ref([])
const filteredScanResults = ref([])
const scanTableFilter = ref('')
const scanUrlFilter = ref('')
const scanUrlPrefixFilter = ref('')
const urlPrefixes = ref([])

// 分类标签映射
const sourceTypeMap = {
  question: { label: '题目图片', type: 'primary' },
  avatar: { label: '用户头像', type: 'success' },
  banner: { label: '轮播图', type: 'warning' },
  exam_answer: { label: '考试答题', type: 'danger' },
  article: { label: '文章内容', type: 'info' },
  other: { label: '其他', type: '' }
}

const getSourceTypeLabel = (type) => {
  return sourceTypeMap[type]?.label || type || '其他'
}

const getSourceTypeType = (type) => {
  return sourceTypeMap[type]?.type || ''
}

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 加载统计
const loadStats = async () => {
  try {
    const res = await adminApi.getImageStats()
    if (res.code === 0) {
      stats.value = res.data.total
    }
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

// 加载图片列表
const loadImages = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: searchForm.keyword,
      sourceType: searchForm.sourceType,
      usageStatus: searchForm.usageStatus
    }
    
    if (searchForm.dateRange && searchForm.dateRange.length === 2) {
      params.startDate = searchForm.dateRange[0]
      params.endDate = searchForm.dateRange[1]
    }
    
    const res = await adminApi.getImageList(params)
    
    if (res.code === 0) {
      imageList.value = res.data.list
      pagination.total = res.data.total
    }
  } catch (error) {
    ElMessage.error('加载图片列表失败')
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadImages()
}

// 重置
const handleReset = () => {
  searchForm.keyword = ''
  searchForm.sourceType = ''
  searchForm.usageStatus = ''
  searchForm.storageStatus = ''
  searchForm.dateRange = []
  handleSearch()
}

// 分页
const handleSizeChange = (size) => {
  pagination.pageSize = size
  loadImages()
}

const handlePageChange = (page) => {
  pagination.page = page
  loadImages()
}

// 选择变化
const handleSelectionChange = (selection) => {
  selectedImages.value = selection
}

// 查看详情
const handleView = async (row) => {
  try {
    const res = await adminApi.getImageDetail(row.id)
    if (res.code === 0) {
      currentImage.value = res.data
      viewDialogVisible.value = true
    }
  } catch (error) {
    ElMessage.error('加载详情失败')
  }
}

// 编辑
const handleEdit = (row) => {
  editForm.id = row.id
  editForm.image_name = row.image_name
  editForm.source_type = row.source_type
  editForm.oss_url = row.oss_url
  editForm.imgbb_url = row.imgbb_url
  editForm.remark = row.remark
  editDialogVisible.value = true
}

// 更新
const handleUpdate = async () => {
  updateLoading.value = true
  try {
    // TODO: 调用更新API
    // 更新所有引用此图片的地方
    await updateImageReferences(editForm.id, {
      oss_url: editForm.oss_url,
      imgbb_url: editForm.imgbb_url
    })
    
    ElMessage.success('更新成功')
    editDialogVisible.value = false
    loadImages()
  } catch (error) {
    ElMessage.error('更新失败: ' + error.message)
  } finally {
    updateLoading.value = false
  }
}

// 更新图片引用
const updateImageReferences = async (imageId, newUrls) => {
  // 获取图片的使用记录
  const response = await axios.get(`/api/admin/images/${imageId}`, {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') }
  })
  
  if (response.data.code === 0) {
    const usageLog = response.data.data.usageLog || []
    
    // 根据使用类型更新对应的表
    for (const usage of usageLog) {
      switch (usage.usage_type) {
        case 'user_avatar':
          await axios.put(`/api/admin/users/${usage.usage_id}/avatar`, {
            avatar: newUrls.oss_url || newUrls.imgbb_url
          })
          break
        case 'banner':
          await axios.put(`/api/admin/banners/${usage.usage_id}`, {
            image_url: newUrls.oss_url || newUrls.imgbb_url
          })
          break
        case 'question':
          // 更新题目中的图片URL
          await updateQuestionImage(usage.usage_id, newUrls)
          break
        // 其他类型...
      }
    }
  }
}

// 删除
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除这张图片吗？', '提示', {
      type: 'warning'
    })
    
    const res = await adminApi.deleteImage(row.id)
    
    if (res.code === 0) {
      ElMessage.success('删除成功')
      loadImages()
      loadStats()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 批量删除
const handleBatchDelete = async () => {
  if (selectedImages.value.length === 0) return
  
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedImages.value.length} 张图片吗？`, '提示', {
      type: 'warning'
    })
    
    const ids = selectedImages.value.map(img => img.id)
    const res = await service.post('/admin/images/batch-delete', { ids })
    
    if (res.data.code === 0) {
      ElMessage.success(res.data.message || '批量删除成功')
      selectedImages.value = []
      loadImages()
      loadStats()
    } else {
      ElMessage.error(res.data.message || '批量删除失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量删除失败:', error)
      ElMessage.error('批量删除失败')
    }
  }
}

// 清理未使用图片
const handleCleanUnused = async () => {
  try {
    await ElMessageBox.confirm('确定要清理所有未使用的图片吗？此操作不可恢复！', '警告', {
      type: 'danger'
    })
    
    // TODO: 清理未使用图片API
    ElMessage.success('清理完成')
    loadImages()
    loadStats()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清理失败')
    }
  }
}

// 复制URL
const copyUrl = (url) => {
  navigator.clipboard.writeText(url).then(() => {
    ElMessage.success('URL已复制')
  })
}

// 上传成功
const handleUploadSuccess = (response) => {
  if (response.code === 0) {
    ElMessage.success(response.message || '图片上传成功')
    uploadDialogVisible.value = false
    loadImages()
    loadStats()
  } else {
    ElMessage.error(response.message || '上传失败')
  }
}

// 上传失败
const handleUploadError = (error) => {
  console.error('上传失败:', error)
  ElMessage.error('图片上传失败')
}

// 打开扫描弹窗
const handleScanAllImages = () => {
  scanDialogVisible.value = true
  scanResults.value = []
  filteredScanResults.value = []
  scanTableFilter.value = ''
  scanUrlFilter.value = ''
  scanUrlPrefixFilter.value = ''
  urlPrefixes.value = []
}

// 提取URL前缀（域名部分）
const extractUrlPrefixes = (urls) => {
  const prefixSet = new Set()
  urls.forEach(item => {
    try {
      const url = new URL(item.url)
      // 提取协议+域名+端口（如果有）
      const prefix = `${url.protocol}//${url.host}`
      prefixSet.add(prefix)
    } catch (e) {
      // 如果URL解析失败，尝试提取前50个字符
      const prefix = item.url.substring(0, Math.min(50, item.url.indexOf('/', 8) > 0 ? item.url.indexOf('/', 8) : 50))
      if (prefix) prefixSet.add(prefix)
    }
  })
  return Array.from(prefixSet).sort()
}

// 开始扫描所有图片
const startScanAllImages = async () => {
  scanLoading.value = true
  scanLoadingText.value = '正在扫描数据库中的所有图片链接...'
  
  try {
    const params = {}
    if (scanTableFilter.value) {
      params.tableFilter = scanTableFilter.value
    }
    if (scanUrlFilter.value) {
      params.urlFilter = scanUrlFilter.value
    }
    
    const res = await adminApi.scanAllImages(params)
    
    if (res.code === 0) {
      scanResults.value = res.data?.images || []
      // 提取URL前缀
      urlPrefixes.value = extractUrlPrefixes(scanResults.value)
      // 应用前缀筛选
      applyFilters()
      ElMessage.success(`扫描完成，共发现 ${scanResults.value.length} 个图片链接，${urlPrefixes.value.length} 个不同前缀`)
    } else {
      ElMessage.error(res.message || '扫描失败')
    }
  } catch (error) {
    console.error('扫描失败:', error)
    ElMessage.error('扫描失败: ' + (error.message || '未知错误'))
  } finally {
    scanLoading.value = false
    scanLoadingText.value = ''
  }
}

// 应用筛选
const applyFilters = () => {
  let results = [...scanResults.value]
  
  // 根据URL前缀筛选
  if (scanUrlPrefixFilter.value) {
    results = results.filter(item => item.url.startsWith(scanUrlPrefixFilter.value))
  }
  
  // 根据URL关键词筛选
  if (scanUrlFilter.value) {
    const keyword = scanUrlFilter.value.toLowerCase()
    results = results.filter(item => item.url.toLowerCase().includes(keyword))
  }
  
  filteredScanResults.value = results
}

// 从扫描结果中替换图片
const handleReplaceFromScan = (row) => {
  // 查找是否已有该图片在图床中
  const existingImage = imageList.value.find(img => 
    img.oss_url === row.url || img.imgbb_url === row.url
  )
  
  if (existingImage) {
    // 如果已存在，直接打开替换弹窗
    currentReplaceImage.value = existingImage
    replaceFile.value = null
    replaceDialogVisible.value = true
  } else {
    // 如果不存在，提示用户先上传到图床
    ElMessageBox.confirm(
      '该图片不在图床管理中，是否先上传到图床？',
      '提示',
      {
        confirmButtonText: '上传',
        cancelButtonText: '取消',
        type: 'warning'
      }
    ).then(() => {
      // 打开上传弹窗
      uploadDialogVisible.value = true
    })
  }
}

// 导出扫描结果
const exportScanResults = () => {
  const data = filteredScanResults.value.map(item => ({
    '图片URL': item.url,
    '所在表': item.tableName,
    '所在字段': item.fieldName
  }))
  
  // 转换为CSV
  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
  ].join('\n')
  
  // 下载文件
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `图片链接扫描结果_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  
  ElMessage.success('导出成功')
}

// 打开替换弹窗
const handleReplace = (row) => {
  currentReplaceImage.value = row
  replaceFile.value = null
  replaceDialogVisible.value = true
}

// 文件选择变化
const handleReplaceFileChange = (file) => {
  replaceFile.value = file.raw
}

// 提交替换
const submitReplace = async () => {
  if (!replaceFile.value) {
    ElMessage.warning('请选择要上传的图片')
    return
  }

  replaceLoading.value = true
  try {
    const formData = new FormData()
    formData.append('image', replaceFile.value)

    const res = await adminApi.replaceImage(currentReplaceImage.value.id, formData)

    if (res.code === 0) {
      const data = res.data
      let msg = '图片替换成功'
      if (data.updatedReferences?.success?.length > 0) {
        msg += `，已更新 ${data.updatedReferences.success.length} 处引用`
      }
      ElMessage.success(msg)
      replaceDialogVisible.value = false
      replaceFile.value = null
      if (replaceUploadRef.value) {
        replaceUploadRef.value.clearFiles()
      }
      // 保存新数据用于后续更新
      const newOssUrl = data.oss?.url
      const newImgbbUrl = data.imgbb?.url
      const newFilename = data.filename
      const replacedId = currentReplaceImage.value.id
      
      // 延迟后重新加载完整数据，然后更新为新URL
      setTimeout(async () => {
        await loadImages()
        await loadStats()
        
        // 重新加载后，再次更新被替换的图片URL（避免被旧数据覆盖）
        const cacheBuster = `?v=${Date.now()}`
        imageList.value = imageList.value.map(img => {
          if (img.id === replacedId) {
            return {
              ...img,
              oss_url: newOssUrl ? `${newOssUrl}${cacheBuster}` : img.oss_url,
              imgbb_url: newImgbbUrl ? `${newImgbbUrl}${cacheBuster}` : img.imgbb_url,
              image_name: newFilename || img.image_name
            }
          }
          return img
        })
      }, 500)
    } else {
      ElMessage.error(res.message || '替换失败')
    }
  } catch (error) {
    console.error('替换失败:', error)
    ElMessage.error('图片替换失败: ' + (error.message || '未知错误'))
  } finally {
    replaceLoading.value = false
  }
}

onMounted(() => {
  loadStats()
  loadImages()
})

// 监听筛选条件变化
watch([scanUrlPrefixFilter, scanUrlFilter], () => {
  applyFilters()
})
</script>

<style scoped>
.image-storage-manage {
  padding: 20px;
}

.stats-row {
  margin-bottom: 20px;
}

.stats-card {
  text-align: center;
}

.stats-value {
  font-size: 32px;
  font-weight: bold;
  color: #667eea;
  margin-bottom: 8px;
}

.stats-label {
  font-size: 14px;
  color: #666;
}

.search-card {
  margin-bottom: 20px;
}

.table-card {
  margin-bottom: 20px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.table-actions {
  display: flex;
  gap: 10px;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.image-detail {
  .url-item {
    display: flex;
    gap: 10px;
    align-items: center;
  }
}

.usage-section {
  margin-top: 20px;
  
  h4 {
    margin-bottom: 10px;
  }
}

.replace-info {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f5f7fa;
  border-radius: 4px;
  
  p {
    margin: 0;
    line-height: 1.8;
  }
  
  .replace-tip {
    color: #e6a23c;
    font-size: 13px;
    margin-top: 5px;
  }
}
</style>
