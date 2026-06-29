<template>
  <div class="avatar-frame-manage">
    <div class="page-header">
      <h2>头像框管理</h2>
      <p class="subtitle">管理用户头像框，支持上传、排序、权限设置和启用禁用</p>
    </div>

    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <!-- 头像框管理 Tab -->
      <el-tab-pane label="头像框" name="frames">
        <div class="toolbar">
          <el-input
            v-model="searchQuery"
            placeholder="搜索头像框名称..."
            clearable
            style="width: 200px"
            @input="fetchAvatarFrames"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-select v-model="filterActive" placeholder="状态筛选" clearable style="width: 120px; margin-left: 10px" @change="fetchAvatarFrames">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
          <el-button type="primary" @click="handleAdd" style="margin-left: 10px">
            <el-icon><Plus /></el-icon>添加头像框
          </el-button>
        </div>

        <el-table :data="filteredFrames" v-loading="loading" style="width: 100%" row-key="id">
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column label="预览" width="100">
            <template #default="scope">
              <div class="frame-preview">
                <img :src="scope.row.image_url || defaultAvatar" alt="头像框" />
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="名称" min-width="120" />
          <el-table-column label="权限要求" min-width="200">
            <template #default="scope">
              <div class="permission-info">
                <el-tag v-if="scope.row.allowed_user_type === 0" type="success" size="small">所有用户</el-tag>
                <el-tag v-else-if="scope.row.allowed_user_type === 1" size="small">仅账号密码</el-tag>
                <el-tag v-else-if="scope.row.allowed_user_type === 2" type="warning" size="small">仅微信</el-tag>
                <el-tag v-else-if="scope.row.allowed_user_type === 3" type="danger" size="small">仅管理员</el-tag>
                <span v-if="scope.row.required_question_count > 0" class="permission-text">
                  做题 {{ scope.row.required_question_count }} 题
                </span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="sort_order" label="排序" width="100" sortable>
            <template #default="scope">
              <el-input-number
                v-model="scope.row.sort_order"
                :min="0"
                :max="999"
                size="small"
                controls-position="right"
                @change="(val) => handleSortChange(scope.row, val)"
                style="width: 80px"
              />
            </template>
          </el-table-column>
          <el-table-column prop="is_active" label="状态" width="80">
            <template #default="scope">
              <el-switch
                v-model="scope.row.is_active"
                :active-value="1"
                :inactive-value="0"
                @change="(val) => handleStatusChange(scope.row, val)"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="scope">
              <el-button size="small" @click="handleEdit(scope.row)">编辑</el-button>
              <el-button size="small" type="danger" @click="handleDelete(scope.row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 添加/编辑头像框对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑头像框' : '添加头像框'" width="700px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="头像框名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入头像框名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="请输入描述" />
        </el-form-item>
        <el-form-item label="头像框图片" prop="image_url">
          <div class="upload-container">
            <el-input v-model="form.image_url" placeholder="请输入图片URL或上传图片" />
            <el-upload
              :action="uploadUrl"
              :headers="uploadHeaders"
              name="image"
              :show-file-list="false"
              :on-success="handleUploadSuccess"
              :before-upload="beforeUpload"
              accept="image/*"
            >
              <el-button type="primary" style="margin-left: 10px">上传图片</el-button>
            </el-upload>
          </div>
          <div v-if="form.image_url" class="image-preview">
            <img :src="form.image_url" alt="预览" />
          </div>
        </el-form-item>
        
        <el-divider content-position="left">权限设置</el-divider>
        
        <el-form-item label="允许用户类型">
          <el-select v-model="form.allowed_user_type" placeholder="选择用户类型" style="width: 100%">
            <el-option label="所有用户" :value="0" />
            <el-option label="仅账号密码用户" :value="1" />
            <el-option label="仅微信用户(WX开头)" :value="2" />
            <el-option label="仅管理员" :value="3" />
          </el-select>
          <div class="form-tip">
            <span v-if="form.allowed_user_type === 0">所有用户均可使用</span>
            <span v-else-if="form.allowed_user_type === 1">仅通过账号密码登录的用户可用</span>
            <span v-else-if="form.allowed_user_type === 2">仅student_id以WX开头的微信用户可用</span>
            <span v-else-if="form.allowed_user_type === 3">仅管理员可用</span>
          </div>
        </el-form-item>
        
        <el-form-item label="做题数量要求">
          <el-input-number v-model="form.required_question_count" :min="0" :max="99999" controls-position="right" style="width: 100%" />
          <div class="form-tip">用户需要完成指定数量的题目才能使用此头像框，0表示无限制</div>
        </el-form-item>
        
        <el-form-item label="排序">
          <el-input-number v-model="form.sort_order" :min="0" :max="999" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.is_active" :active-value="1" :inactive-value="0" />
          <span class="status-hint">{{ form.is_active ? '启用' : '禁用' }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Plus, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const activeTab = ref('frames')
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const searchQuery = ref('')
const filterActive = ref('')
const formRef = ref(null)

const defaultAvatar = 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'

const avatarFrames = ref([])

const form = ref({
  id: null,
  name: '',
  description: '',
  image_url: '',
  required_question_count: 0,
  allowed_user_type: 0,
  sort_order: 0,
  is_active: 1
})

const rules = {
  name: [{ required: true, message: '请输入头像框名称', trigger: 'blur' }],
  image_url: [{ required: true, message: '请输入头像框图片URL', trigger: 'blur' }]
}

const uploadUrl = '/api/upload/image'
const uploadHeaders = computed(() => ({
  Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`
}))

const filteredFrames = computed(() => {
  let result = avatarFrames.value
  if (searchQuery.value) {
    result = result.filter(f => f.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
  }
  if (filterActive.value !== '') {
    result = result.filter(f => f.is_active === filterActive.value)
  }
  return result
})

const handleTabChange = (tab) => {
  if (tab === 'frames') {
    fetchAvatarFrames()
  }
}

const fetchAvatarFrames = async () => {
  loading.value = true
  try {
    const res = await fetch('/api/admin/avatar-frames', {
      headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}` }
    })
    const data = await res.json()
    if (data.code === 0) {
      avatarFrames.value = data.data || []
    } else {
      ElMessage.error(data.message || '获取头像框列表失败')
    }
  } catch (error) {
    console.error('获取头像框列表失败:', error)
    ElMessage.error('获取头像框列表失败')
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  isEdit.value = false
  form.value = {
    id: null,
    name: '',
    description: '',
    image_url: '',
    required_question_count: 0,
    allowed_user_type: 0,
    sort_order: 0,
    is_active: 1
  }
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  form.value = { 
    ...row,
    required_question_count: row.required_question_count || 0,
    allowed_user_type: row.allowed_user_type || 0
  }
  dialogVisible.value = true
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除头像框 "${row.name}" 吗？`,
      '警告',
      { type: 'warning' }
    )
    
    const res = await fetch(`/api/admin/avatar-frames/${row.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}` }
    })
    const data = await res.json()
    
    if (data.code === 0) {
      ElMessage.success('删除成功')
      fetchAvatarFrames()
    } else {
      ElMessage.error(data.message || '删除失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除头像框失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      
      try {
        const url = isEdit.value ? `/api/admin/avatar-frames/${form.value.id}` : '/api/admin/avatar-frames'
        const method = isEdit.value ? 'PUT' : 'POST'
        
        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`
          },
          body: JSON.stringify(form.value)
        })
        const data = await res.json()
        
        if (data.code === 0) {
          ElMessage.success(isEdit.value ? '更新成功' : '添加成功')
          dialogVisible.value = false
          fetchAvatarFrames()
        } else {
          ElMessage.error(data.message || '操作失败')
        }
      } catch (error) {
        console.error('操作失败:', error)
        ElMessage.error('操作失败')
      } finally {
        submitting.value = false
      }
    }
  })
}

const handleSortChange = async (row, newOrder) => {
  try {
    const res = await fetch(`/api/admin/avatar-frames/${row.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`
      },
      body: JSON.stringify({ sort_order: newOrder })
    })
    const data = await res.json()
    if (data.code !== 0) {
      ElMessage.error(data.message || '更新排序失败')
      fetchAvatarFrames()
    }
  } catch (error) {
    console.error('更新排序失败:', error)
    ElMessage.error('更新排序失败')
    fetchAvatarFrames()
  }
}

const handleStatusChange = async (row, newStatus) => {
  try {
    const res = await fetch(`/api/admin/avatar-frames/${row.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`
      },
      body: JSON.stringify({ is_active: newStatus })
    })
    const data = await res.json()
    if (data.code !== 0) {
      ElMessage.error(data.message || '更新状态失败')
      fetchAvatarFrames()
    }
  } catch (error) {
    console.error('更新状态失败:', error)
    ElMessage.error('更新状态失败')
    fetchAvatarFrames()
  }
}

const handleUploadSuccess = (response) => {
  if (response.code === 0) {
    form.value.image_url = response.data.url
    ElMessage.success('上传成功')
  } else {
    ElMessage.error(response.message || '上传失败')
  }
}

const beforeUpload = (file) => {
  const isImage = file.type.startsWith('image/')
  const isLt5M = file.size / 1024 / 1024 < 5
  
  if (!isImage) {
    ElMessage.error('只能上传图片文件')
    return false
  }
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB')
    return false
  }
  return true
}

onMounted(() => {
  fetchAvatarFrames()
})
</script>

<style scoped>
.avatar-frame-manage {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0 0 10px 0;
  font-size: 24px;
  font-weight: 600;
}

.subtitle {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.toolbar {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
}

.frame-preview {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.frame-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.permission-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.permission-text {
  font-size: 12px;
  color: #909399;
}

.upload-container {
  display: flex;
  align-items: center;
}

.image-preview {
  margin-top: 10px;
  width: 100px;
  height: 100px;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.image-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

.status-hint {
  margin-left: 10px;
  color: #909399;
  font-size: 14px;
}
</style>
