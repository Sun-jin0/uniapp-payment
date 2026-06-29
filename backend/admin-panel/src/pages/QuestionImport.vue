<template>
  <div class="question-import">
    <el-tabs v-model="activeTab">
      <!-- 批量文件导入 -->
      <el-tab-pane label="批量文件导入" name="batch">
        <el-page-header @back="goBack" content="试题数据导入">
          <template #extra>
            <div class="header-actions">
              <el-select v-model="targetSubject" placeholder="选择目标科目" class="mr-10" style="width: 150px">
                <el-option label="西医综合" value="med" />
                <el-option label="数学" value="math" />
                <el-option label="政治" value="politics" />
                <el-option label="公共课" value="public" />
                <el-option label="计算机" value="computer" />
              </el-select>
              <el-button type="primary" :loading="importing" :disabled="selectedCount === 0" @click="importSelected">
                确认批量导入 ({{ selectedCount }})
              </el-button>
            </div>
          </template>
        </el-page-header>

        <div class="upload-area mt-20">
          <el-upload
            class="upload-dragger"
            drag
            action="#"
            multiple
            :auto-upload="false"
            :on-change="handleFileChange"
            accept=".json"
          >
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
              将 JSON 文件拖到此处，或 <em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                支持导入书籍、题目、答案及结构化 JSON 文件
              </div>
            </template>
          </el-upload>
        </div>

        <div class="file-list-header mt-20" v-if="files.length > 0">
          <div class="title">待处理文件 ({{ files.length }})</div>
          <el-checkbox :model-value="isAllSelected" :indeterminate="isIndeterminate" @change="toggleSelectAll">全选</el-checkbox>
        </div>

        <el-table v-if="files.length > 0" :data="files" border stripe class="mt-10">
          <el-table-column width="50" align="center">
            <template #default="{ row }">
              <el-checkbox v-model="row.selected" :disabled="row.status === 'success' || row.status === 'processing'" />
            </template>
          </el-table-column>
          <el-table-column prop="filename" label="文件名" min-width="200" />
          <el-table-column prop="size" label="大小" width="120" align="center" />
          <el-table-column label="识别类型" width="120" align="center">
            <template #default="{ row }">
              <el-tag :type="getFileTypeTag(row.type)">{{ getFileTypeText(row.type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="150" align="center">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.status)">
                {{ getStatusText(row.status, row.errorMsg) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center">
            <template #default="{ row, $index }">
              <el-button 
                link 
                type="primary" 
                :disabled="row.status === 'success' || row.status === 'processing'"
                @click="importSingleFile(row)"
              >
                导入
              </el-button>
              <el-button 
                link 
                type="danger" 
                @click="removeFile($index)"
                :disabled="row.status === 'processing'"
              >
                移除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div v-else class="empty-state mt-20">
          <el-empty description="暂无待导入文件，请点击上方区域上传" />
        </div>
      </el-tab-pane>

      <!-- 章节结构化 -->
      <el-tab-pane label="章节结构化处理" name="structure">
        <div class="structure-container">
          <el-form :model="structForm" label-width="120px" style="max-width: 600px" class="mt-20">
            <el-form-item label="选择科目" required>
              <el-select v-model="structForm.subject" placeholder="请选择科目" @change="handleStructSubjectChange">
                <el-option label="公共课" value="public" />
                <el-option label="西医综合" value="med" />
              </el-select>
            </el-form-item>
            <el-form-item label="选择大类" required>
              <el-select v-model="structForm.category" placeholder="请选择分类" :disabled="!categories.length">
                <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="cat.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="选择书籍" required>
              <el-select v-model="structForm.bookId" placeholder="请选择书籍" :disabled="!books.length">
                <el-option v-for="book in books" :key="book._id" :label="book.title" :value="book._id" />
              </el-select>
            </el-form-item>
            <el-form-item label="结构化文件" required>
              <el-upload
                class="struct-upload"
                action="#"
                :auto-upload="false"
                :on-change="handleStructFileChange"
                :limit="1"
                accept=".json"
              >
                <el-button type="primary">选择 JSON 文件</el-button>
              </el-upload>
            </el-form-item>
            <el-form-item>
              <el-button type="success" :loading="structuring" @click="startStructuring">生成章节结构</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 导入进度对话框 -->
    <el-dialog
      v-model="importing"
      title="正在导入数据"
      width="400px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
    >
      <div class="progress-content">
        <div class="current-file">{{ currentFileName }}</div>
        <el-progress :percentage="progress" status="success" />
        <div class="stats mt-10">
          已完成: {{ currentIndex }} / {{ totalFiles }}
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { adminApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'

const router = useRouter()
const activeTab = ref('batch')
const targetSubject = ref('med')

// 批量导入
const files = ref([])
const importing = ref(false)
const currentIndex = ref(0)
const progress = ref(0)
const currentFileName = ref('')

// 结构化处理
const structForm = ref({
  subject: 'public',
  category: '',
  bookId: '',
  file: null
})
const categories = ref([])
const books = ref([])
const structuring = ref(false)

const selectedCount = computed(() => files.value.filter(f => f.selected).length)
const totalFiles = computed(() => selectedCount.value)
const isAllSelected = computed(() => files.value.length > 0 && files.value.every(f => f.selected || f.status === 'success'))
const isIndeterminate = computed(() => {
  const selected = files.value.filter(f => f.selected).length
  return selected > 0 && selected < files.value.length
})

const goBack = () => router.back()

const handleFileChange = (file) => {
  const isJson = file.raw.type === 'application/json' || file.name.endsWith('.json')
  if (!isJson) {
    ElMessage.error('只能上传 JSON 文件')
    return
  }

  // 简单识别文件类型
  let type = 'unknown'
  const name = file.name.toLowerCase()
  if (name.includes('question')) type = 'questions'
  else if (name.includes('answer')) type = 'answers'
  else if (name.includes('book')) type = 'book'
  else if (name.includes('struct')) type = 'structure'

  files.value.push({
    raw: file.raw,
    filename: file.name,
    size: (file.size / 1024).toFixed(2) + ' KB',
    status: 'pending',
    selected: true,
    type,
    errorMsg: ''
  })
}

const getFileTypeTag = (type) => {
  const map = {
    questions: 'primary',
    answers: 'success',
    book: 'warning',
    structure: 'info',
    unknown: ''
  }
  return map[type] || ''
}

const getFileTypeText = (type) => {
  const map = {
    questions: '题目数据',
    answers: '答案数据',
    book: '书籍信息',
    structure: '章节结构',
    unknown: '未知'
  }
  return map[type] || '未知'
}

const getStatusTagType = (status) => {
  const map = {
    pending: 'info',
    processing: 'warning',
    success: 'success',
    error: 'danger'
  }
  return map[status] || 'info'
}

const getStatusText = (status, errorMsg) => {
  const map = {
    pending: '等待导入',
    processing: '正在导入...',
    success: '导入成功',
    error: errorMsg || '导入失败'
  }
  return map[status] || '未知'
}

const toggleSelectAll = (val) => {
  files.value.forEach(f => {
    if (f.status !== 'success' && f.status !== 'processing') {
      f.selected = val
    }
  })
}

const removeFile = (index) => {
  files.value.splice(index, 1)
}

const importSingleFile = async (file) => {
  file.status = 'processing'
  try {
    const reader = new FileReader()
    const content = await new Promise((resolve, reject) => {
      reader.onload = (e) => resolve(JSON.parse(e.target.result))
      reader.onerror = reject
      reader.readAsText(file.raw)
    })

    const res = await adminApi.importQuestions(targetSubject.value, {
      type: file.type,
      data: content
    })

    if (res.code === 0) {
      file.status = 'success'
      ElMessage.success(`${file.filename} 导入成功`)
    } else {
      file.status = 'error'
      file.errorMsg = res.msg
    }
  } catch (error) {
    file.status = 'error'
    file.errorMsg = error.message
    ElMessage.error(`${file.filename} 导入失败: ${error.message}`)
  }
}

const importSelected = async () => {
  const selectedFiles = files.value.filter(f => f.selected && f.status !== 'success')
  if (selectedFiles.length === 0) return

  importing.value = true
  currentIndex.value = 0
  
  for (const file of selectedFiles) {
    currentFileName.value = file.filename
    await importSingleFile(file)
    currentIndex.value++
    progress.value = Math.round((currentIndex.value / totalFiles.value) * 100)
  }
  
  importing.value = false
  ElMessage.success('批量导入完成')
}

// 结构化逻辑
const handleStructSubjectChange = async () => {
  structForm.value.category = ''
  structForm.value.bookId = ''
  await loadCategories()
}

const loadCategories = async () => {
  try {
    const res = await adminApi.getCourses(structForm.value.subject)
    if (res.code === 0) {
      categories.value = res.data || []
    }
  } catch (error) {
    console.error('加载分类失败:', error)
  }
}

const handleStructFileChange = (file) => {
  structForm.value.file = file.raw
}

const startStructuring = async () => {
  if (!structForm.value.bookId || !structForm.value.file) {
    ElMessage.warning('请选择书籍并上传结构化文件')
    return
  }

  structuring.value = true
  try {
    const reader = new FileReader()
    const content = await new Promise((resolve, reject) => {
      reader.onload = (e) => resolve(JSON.parse(e.target.result))
      reader.onerror = reject
      reader.readAsText(structForm.value.file)
    })

    const res = await adminApi.generateStructure({
      bookId: structForm.value.bookId,
      data: content
    })

    if (res.code === 0) {
      ElMessage.success('章节结构生成成功')
    } else {
      ElMessage.error(res.msg || '生成失败')
    }
  } catch (error) {
    ElMessage.error('处理失败: ' + error.message)
  } finally {
    structuring.value = false
  }
}

onMounted(() => {
  loadCategories()
})
</script>

<style scoped>
.question-import {
  padding: 20px;
}
.upload-area {
  max-width: 800px;
  margin: 0 auto;
}
.file-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
}
.title {
  font-size: 16px;
  font-weight: bold;
}
.mt-20 { margin-top: 20px; }
.mt-10 { margin-top: 10px; }
.mr-10 { margin-right: 10px; }
.progress-content {
  text-align: center;
  padding: 20px 0;
}
.current-file {
  margin-bottom: 15px;
  font-size: 14px;
  color: #606266;
}
.structure-container {
  display: flex;
  justify-content: center;
}
</style>
