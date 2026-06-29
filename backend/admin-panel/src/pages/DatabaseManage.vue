<template>
  <div class="database-manage">
    <el-container class="db-container">
      <!-- 左侧集合列表 -->
      <el-aside width="250px" class="collection-aside">
        <div class="section-header">
          <span class="title">数据集合 (Collections)</span>
          <el-button link type="primary" @click="loadCollections">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </div>
        <el-scrollbar>
          <div 
            v-for="col in collections" 
            :key="col.name" 
            class="collection-item"
            :class="{ active: selectedCollectionName === col.name }"
            @click="selectCollection(col)"
          >
            <div class="col-name">{{ col.name }}</div>
            <div class="col-count">{{ col.count }} 条记录</div>
          </div>
          <el-empty v-if="collections.length === 0" description="暂无集合" :image-size="60" />
        </el-scrollbar>
      </el-aside>

      <!-- 右侧数据管理 -->
      <el-main class="data-main">
        <template v-if="selectedCollectionName">
          <div class="header-actions">
            <div class="left">
              <el-input
                v-model="searchQuery"
                placeholder="搜索记录..."
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
              <el-button type="primary" @click="showAddModal">
                <el-icon><Plus /></el-icon> 添加记录
              </el-button>
            </div>
            <div class="right">
              <el-button type="danger" plain @click="clearCollection">
                <el-icon><Delete /></el-icon> 清空集合
              </el-button>
            </div>
          </div>

          <el-table 
            :data="documents" 
            v-loading="loading" 
            border 
            stripe 
            style="width: 100%"
            height="calc(100vh - 280px)"
          >
            <el-table-column 
              v-for="field in fields" 
              :key="field" 
              :prop="field" 
              :label="field" 
              min-width="150"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                {{ formatValue(row[field]) }}
              </template>
            </el-table-column>
            
            <el-table-column label="操作" width="150" align="center" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="editDocument(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="deleteDocument(row._id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-container">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :page-sizes="[20, 50, 100]"
              layout="total, sizes, prev, pager, next, jumper"
              :total="total"
              @size-change="handleSizeChange"
              @current-change="handleCurrentChange"
            />
          </div>
        </template>
        <div v-else class="welcome-container">
          <el-empty description="请从左侧选择一个集合开始管理" :image-size="200" />
        </div>
      </el-main>
    </el-container>

    <!-- 编辑/添加记录弹窗 -->
    <el-dialog
      v-model="editDialogVisible"
      :title="isEditing ? '编辑记录' : '添加记录'"
      width="600px"
      destroy-on-close
    >
      <el-form :model="editingDocument" label-width="120px" class="edit-form">
        <el-form-item 
          v-for="field in fields" 
          :key="field" 
          :label="field"
          v-show="field !== '_id' && field !== 'createdAt' && field !== 'updatedAt'"
        >
          <el-input 
            v-model="editingDocument[field]" 
            :placeholder="`请输入 ${field}`" 
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 4 }"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveDocument" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const collections = ref([])
const selectedCollectionName = ref('')
const documents = ref([])
const fields = ref([])
const loading = ref(false)
const saving = ref(false)
const searchQuery = ref('')

// 分页
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

// 编辑
const editDialogVisible = ref(false)
const isEditing = ref(false)
const editingDocument = ref({})

const loadCollections = async () => {
  try {
    const res = await adminApi.getCollections()
    if (res.code === 0) {
      collections.value = res.data || []
    }
  } catch (error) {
    console.error('加载集合列表失败:', error)
  }
}

const selectCollection = async (col) => {
  selectedCollectionName.value = col.name
  currentPage.value = 1
  searchQuery.value = ''
  await loadDocuments()
  await loadFields()
}

const loadDocuments = async () => {
  if (!selectedCollectionName.value) return
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      limit: pageSize.value,
      query: searchQuery.value
    }
    // 注意：这里需要后端支持根据集合名获取数据的接口
    const res = await adminApi.getCollectionData(selectedCollectionName.value, params)
    if (res.code === 0) {
      documents.value = res.data.documents || []
      total.value = res.data.pagination?.total || documents.value.length
    }
  } catch (error) {
    console.error('加载文档失败:', error)
  } finally {
    loading.value = false
  }
}

const loadFields = async () => {
  try {
    const res = await adminApi.getCollectionFields(selectedCollectionName.value)
    if (res.code === 0) {
      fields.value = res.data || []
    }
  } catch (error) {
    console.error('加载字段失败:', error)
  }
}

const handleSearch = () => {
  currentPage.value = 1
  loadDocuments()
}

const handleSizeChange = (val) => {
  pageSize.value = val
  loadDocuments()
}

const handleCurrentChange = (val) => {
  currentPage.value = val
  loadDocuments()
}

const showAddModal = () => {
  editingDocument.value = {}
  fields.value.forEach(f => {
    if (f !== '_id') editingDocument.value[f] = ''
  })
  isEditing.value = false
  editDialogVisible.value = true
}

const editDocument = (doc) => {
  editingDocument.value = { ...doc }
  isEditing.value = true
  editDialogVisible.value = true
}

const saveDocument = async () => {
  saving.value = true
  try {
    let res
    if (isEditing.value) {
      res = await adminApi.updateCollectionDoc(selectedCollectionName.value, editingDocument.value._id, editingDocument.value)
    } else {
      res = await adminApi.createCollectionDoc(selectedCollectionName.value, editingDocument.value)
    }
    
    if (res.code === 0) {
      ElMessage.success('保存成功')
      editDialogVisible.value = false
      loadDocuments()
    }
  } catch (error) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const deleteDocument = (id) => {
  ElMessageBox.confirm('确定要删除这条记录吗？', '提示', {
    type: 'warning'
  }).then(async () => {
    try {
      const res = await adminApi.deleteCollectionDoc(selectedCollectionName.value, id)
      if (res.code === 0) {
        ElMessage.success('删除成功')
        loadDocuments()
      }
    } catch (error) {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

const clearCollection = () => {
  ElMessageBox.confirm(`确定要清空 ${selectedCollectionName.value} 集合吗？此操作不可恢复！`, '警告', {
    type: 'danger',
    confirmButtonText: '确定清空',
    confirmButtonClass: 'el-button--danger'
  }).then(async () => {
    try {
      const res = await adminApi.clearCollection(selectedCollectionName.value)
      if (res.code === 0) {
        ElMessage.success('集合已清空')
        loadDocuments()
        loadCollections()
      }
    } catch (error) {
      ElMessage.error('清空失败')
    }
  }).catch(() => {})
}

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? '是' : '否'
  return String(value)
}

onMounted(() => {
  loadCollections()
})
</script>

<style scoped>
.database-manage {
  height: calc(100vh - 120px);
  padding: 20px;
}
.db-container {
  height: 100%;
  background-color: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
}
.collection-aside {
  border-right: 1px solid #eee;
  display: flex;
  flex-direction: column;
}
.section-header {
  padding: 15px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.section-header .title {
  font-weight: bold;
  font-size: 14px;
}
.collection-item {
  padding: 12px 15px;
  cursor: pointer;
  transition: all 0.3s;
  border-bottom: 1px solid #f9f9f9;
}
.collection-item:hover {
  background-color: #f5f7fa;
}
.collection-item.active {
  background-color: #ecf5ff;
  border-left: 4px solid #409eff;
}
.col-name {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}
.col-count {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.data-main {
  padding: 20px;
  display: flex;
  flex-direction: column;
}
.header-actions {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}
.header-actions .left {
  display: flex;
  gap: 15px;
}
.search-input {
  width: 300px;
}
.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
.welcome-container {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.edit-form {
  max-height: 500px;
  overflow-y: auto;
}
</style>
