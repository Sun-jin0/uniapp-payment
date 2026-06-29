<template>
  <div class="collection-manage">
    <el-card>
      <template #header>
        <div class="card-header">
          <h3>教辅合集管理</h3>
          <el-button type="primary" @click="openCreateModal">
            <el-icon><Plus /></el-icon> 创建合集
          </el-button>
        </div>
      </template>

      <!-- 筛选栏 -->
      <div class="filter-bar mb-20">
        <el-input
          v-model="filter.keyword"
          placeholder="搜索合集名称"
          clearable
          style="width: 250px"
          @keyup.enter="fetchCollections"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="filter.status" placeholder="状态" clearable style="width: 120px" @change="fetchCollections">
          <el-option label="全部" value="" />
          <el-option label="启用" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
        <el-button type="primary" @click="fetchCollections">搜索</el-button>
        <el-button @click="resetFilter">重置</el-button>
      </div>

      <!-- 合集列表 -->
      <el-table :data="collections" v-loading="loading" border stripe>
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column label="封面" width="100" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.cover_url"
              :src="row.cover_url"
              style="width: 60px; height: 80px; object-fit: cover"
              fit="cover"
            />
            <div v-else class="no-cover">无封面</div>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="合集名称" min-width="150" />
        <el-table-column prop="version" label="版本" width="100" align="center" />
        <el-table-column prop="year" label="年份" width="80" align="center" />
        <el-table-column label="包含科目" min-width="200">
          <template #default="{ row }">
            <div v-if="row.subjects && row.subjects.length > 0">
              <el-tag
                v-for="subject in row.subjects"
                :key="subject.id"
                size="small"
                class="mr-5 mb-5"
              >
                {{ subject.subject || subject.name }}
              </el-tag>
            </div>
            <span v-else class="text-gray">暂无科目</span>
          </template>
        </el-table-column>
        <el-table-column prop="total_questions" label="总题数" width="100" align="center" />
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              :active-value="1"
              :inactive-value="0"
              @change="(val) => toggleStatus(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDetail(row)">
              详情
            </el-button>
            <el-button type="primary" link size="small" @click="openEditModal(row)">
              编辑
            </el-button>
            <el-button type="success" link size="small" @click="manageSubjects(row)">
              管理科目
            </el-button>
            <el-button type="danger" link size="small" @click="deleteCollection(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @size-change="fetchCollections"
          @current-change="fetchCollections"
        />
      </div>
    </el-card>

    <!-- 创建/编辑合集对话框 -->
    <el-dialog
      v-model="modalVisible"
      :title="isEdit ? '编辑合集' : '创建合集'"
      width="600px"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="合集名称" prop="name">
          <el-input v-model="form.name" placeholder="如：王道考研" />
        </el-form-item>
        <el-form-item label="版本" prop="version">
          <el-input v-model="form.version" placeholder="如：2026版" />
        </el-form-item>
        <el-form-item label="年份" prop="year">
          <el-input-number v-model="form.year" :min="2000" :max="2100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="封面图">
          <el-upload
            class="cover-uploader"
            :action="uploadUrl"
            :headers="uploadHeaders"
            :show-file-list="false"
            :on-success="handleUploadSuccess"
            :before-upload="beforeUpload"
          >
            <img v-if="form.cover_url" :src="form.cover_url" class="cover-image" />
            <el-icon v-else class="cover-uploader-icon"><Plus /></el-icon>
          </el-upload>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="请输入合集描述"
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort_order" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :label="1">启用</el-radio>
            <el-radio :label="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="modalVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveCollection">保存</el-button>
      </template>
    </el-dialog>

    <!-- 管理科目对话框 -->
    <el-dialog
      v-model="subjectsModalVisible"
      :title="(currentCollection?.name || '合集') + ' - 管理科目'"
      width="800px"
    >
      <div class="subjects-manage">
        <div class="toolbar mb-20">
          <el-button type="primary" size="small" @click="openAddSubjectModal">
            <el-icon><Plus /></el-icon> 添加科目
          </el-button>
        </div>

        <el-table :data="collectionSubjects" border stripe>
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column prop="name" label="教辅名称" min-width="150" />
          <el-table-column prop="subject" label="科目" width="120" align="center" />
          <el-table-column prop="total_questions" label="题目数" width="100" align="center" />
          <el-table-column label="操作" width="150" align="center">
            <template #default="{ row, $index }">
              <el-button type="primary" link size="small" @click="viewSubjectDetail(row)">
                查看
              </el-button>
              <el-button type="danger" link size="small" @click="removeSubject(row, $index)">
                移除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <!-- 添加科目对话框 -->
    <el-dialog
      v-model="addSubjectModalVisible"
      title="添加科目到合集"
      width="700px"
    >
      <div class="available-tutorials">
        <div class="toolbar mb-20">
          <el-input
            v-model="tutorialSearchKeyword"
            placeholder="搜索教辅名称"
            clearable
            style="width: 250px"
            @input="filterTutorials"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" size="small" @click="refreshTutorials">刷新</el-button>
        </div>
        
        <div v-if="!loadingTutorials && filteredTutorials.length === 0" class="empty-tutorials">
          <el-empty description="暂无可添加的教辅" />
        </div>
        <el-table 
          v-else
          :data="filteredTutorials" 
          border 
          stripe 
          max-height="400"
          v-loading="loadingTutorials"
        >
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column prop="name" label="教辅名称" min-width="150" />
          <el-table-column prop="subject" label="科目" width="120" align="center" />
          <el-table-column prop="total_questions" label="题目数" width="100" align="center" />
          <el-table-column label="操作" width="100" align="center" fixed="right">
            <template #default="{ row }">
              <el-button 
                type="primary" 
                size="small" 
                :loading="addingSubjectId === row.id"
                @click="confirmAddSubject(row)"
              >
                添加
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { adminApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'

const router = useRouter()

// 列表数据
const collections = ref([])
const loading = ref(false)
const filter = reactive({
  keyword: '',
  status: ''
})
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

// 创建/编辑
const modalVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)
const saving = ref(false)
const form = reactive({
  id: null,
  name: '',
  version: '',
  year: new Date().getFullYear(),
  cover_url: '',
  description: '',
  sort_order: 0,
  status: 1
})

const rules = {
  name: [{ required: true, message: '请输入合集名称', trigger: 'blur' }],
  version: [{ required: true, message: '请输入版本', trigger: 'blur' }]
}

// 上传配置
const uploadUrl = '/api/upload/image'
const uploadHeaders = {
  Authorization: `Bearer ${localStorage.getItem('admin_token')}`
}

// 科目管理
const subjectsModalVisible = ref(false)
const currentCollection = ref(null)
const collectionSubjects = ref([])

// 添加科目
const addSubjectModalVisible = ref(false)
const availableTutorials = ref([])
const filteredTutorials = ref([])
const tutorialSearchKeyword = ref('')
const loadingTutorials = ref(false)
const addingSubjectId = ref(null)

// 获取合集列表
const fetchCollections = async () => {
  loading.value = true
  try {
    const res = await adminApi.getTutorialCollections({
      keyword: filter.keyword,
      status: filter.status,
      page: pagination.page,
      pageSize: pagination.pageSize
    })
    collections.value = res.data?.list || []
    pagination.total = res.data?.total || 0
  } catch (error) {
    console.error('获取合集列表失败:', error)
    ElMessage.error('获取合集列表失败')
  } finally {
    loading.value = false
  }
}

// 重置筛选
const resetFilter = () => {
  filter.keyword = ''
  filter.status = ''
  pagination.page = 1
  fetchCollections()
}

// 打开创建对话框
const openCreateModal = () => {
  isEdit.value = false
  form.id = null
  form.name = ''
  form.version = ''
  form.year = new Date().getFullYear()
  form.cover_url = ''
  form.description = ''
  form.sort_order = 0
  form.status = 1
  modalVisible.value = true
}

// 打开编辑对话框
const openEditModal = (row) => {
  isEdit.value = true
  Object.assign(form, row)
  modalVisible.value = true
}

// 保存合集
const saveCollection = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    saving.value = true
    try {
      if (isEdit.value) {
        await adminApi.updateTutorialCollection(form.id, form)
        ElMessage.success('更新成功')
      } else {
        await adminApi.createTutorialCollection(form)
        ElMessage.success('创建成功')
      }
      modalVisible.value = false
      fetchCollections()
    } catch (error) {
      console.error('保存合集失败:', error)
      ElMessage.error('保存合集失败')
    } finally {
      saving.value = false
    }
  })
}

// 切换状态
const toggleStatus = async (row, val) => {
  try {
    await adminApi.updateTutorialCollection(row.id, { status: val })
    ElMessage.success('状态更新成功')
  } catch (error) {
    console.error('更新状态失败:', error)
    ElMessage.error('更新状态失败')
    row.status = val === 1 ? 0 : 1
  }
}

// 删除合集
const deleteCollection = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除该合集吗？', '警告', { type: 'warning' })
    await adminApi.deleteTutorialCollection(row.id)
    ElMessage.success('删除成功')
    fetchCollections()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除合集失败:', error)
      ElMessage.error('删除合集失败')
    }
  }
}

// 查看详情
const viewDetail = (row) => {
  router.push(`/tutorial-collections/${row.id}`)
}

// 上传相关
const beforeUpload = (file) => {
  const isJPG = file.type === 'image/jpeg'
  const isPNG = file.type === 'image/png'
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!isJPG && !isPNG) {
    ElMessage.error('只支持 JPG/PNG 格式!')
    return false
  }
  if (!isLt2M) {
    ElMessage.error('图片大小不能超过 2MB!')
    return false
  }
  return true
}

const handleUploadSuccess = (res) => {
  if (res.code === 0 || res.code === 200) {
    form.cover_url = res.data.url
    ElMessage.success('上传成功')
  } else {
    ElMessage.error(res.message || '上传失败')
  }
}

// 管理科目
const manageSubjects = async (row) => {
  currentCollection.value = row
  subjectsModalVisible.value = true
  await fetchCollectionSubjects(row.id)
}

// 获取合集的科目列表
const fetchCollectionSubjects = async (collectionId) => {
  try {
    const res = await adminApi.getTutorialCollectionDetail(collectionId)
    collectionSubjects.value = res.data?.subjects || []
  } catch (error) {
    console.error('获取科目列表失败:', error)
    ElMessage.error('获取科目列表失败')
  }
}

// 打开添加科目对话框
const openAddSubjectModal = async () => {
  tutorialSearchKeyword.value = ''
  addSubjectModalVisible.value = true
  await loadAvailableTutorials()
}

// 加载可选教辅列表
const loadAvailableTutorials = async () => {
  loadingTutorials.value = true
  try {
    const res = await adminApi.getTutorials({
      noCollection: true, // 只搜索未关联合集的教辅
      page: 1,
      pageSize: 100 // 加载较多数据
    })
    availableTutorials.value = res.data?.list || []
    filteredTutorials.value = [...availableTutorials.value]
  } catch (error) {
    console.error('加载教辅列表失败:', error)
    ElMessage.error('加载教辅列表失败')
  } finally {
    loadingTutorials.value = false
  }
}

// 刷新教辅列表
const refreshTutorials = async () => {
  tutorialSearchKeyword.value = ''
  await loadAvailableTutorials()
}

// 筛选教辅
const filterTutorials = () => {
  const keyword = tutorialSearchKeyword.value.toLowerCase()
  if (!keyword) {
    filteredTutorials.value = [...availableTutorials.value]
    return
  }
  filteredTutorials.value = availableTutorials.value.filter(t => 
    t.name.toLowerCase().includes(keyword) || 
    (t.subject && t.subject.toLowerCase().includes(keyword))
  )
}

// 确认添加科目
const confirmAddSubject = async (row) => {
  addingSubjectId.value = row.id
  try {
    await adminApi.updateTutorial(row.id, {
      collection_id: currentCollection.value.id
    })
    ElMessage.success('添加成功')
    
    // 从列表中移除已添加的
    const index = availableTutorials.value.findIndex(t => t.id === row.id)
    if (index > -1) {
      availableTutorials.value.splice(index, 1)
      filterTutorials()
    }
    
    await fetchCollectionSubjects(currentCollection.value.id)
    fetchCollections() // 刷新列表
  } catch (error) {
    console.error('添加科目失败:', error)
    ElMessage.error('添加科目失败')
  } finally {
    addingSubjectId.value = null
  }
}

// 移除科目
const removeSubject = async (row, index) => {
  try {
    await ElMessageBox.confirm('确定要将该教辅从合集中移除吗？', '提示', { type: 'warning' })
    await adminApi.updateTutorial(row.id, {
      collection_id: null
    })
    ElMessage.success('移除成功')
    collectionSubjects.value.splice(index, 1)
    fetchCollections() // 刷新列表
  } catch (error) {
    if (error !== 'cancel') {
      console.error('移除科目失败:', error)
      ElMessage.error('移除科目失败')
    }
  }
}

// 查看科目详情
const viewSubjectDetail = (row) => {
  router.push(`/computer/manage?tutorialId=${row.id}`)
}

onMounted(() => {
  fetchCollections()
})
</script>

<style scoped>
.collection-manage {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
}

.filter-bar {
  display: flex;
  gap: 10px;
  align-items: center;
}

.mb-20 {
  margin-bottom: 20px;
}

.mr-5 {
  margin-right: 5px;
}

.mb-5 {
  margin-bottom: 5px;
}

.text-gray {
  color: #909399;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.no-cover {
  width: 60px;
  height: 80px;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 12px;
}

/* 封面上传样式 */
.cover-uploader {
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  width: 120px;
  height: 160px;
}

.cover-uploader:hover {
  border-color: #409eff;
}

.cover-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 120px;
  height: 160px;
  text-align: center;
  line-height: 160px;
}

.cover-image {
  width: 120px;
  height: 160px;
  display: block;
  object-fit: cover;
}

.subjects-manage {
  padding: 10px;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.available-tutorials {
  padding: 10px;
}

.available-tutorials .toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.empty-tutorials {
  padding: 40px 0;
}
</style>
