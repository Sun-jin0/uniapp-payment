<template>
  <div class="qq-group-manage">
    <div class="page-header">
      <h2>QQ群管理</h2>
      <p class="subtitle">管理QQ群信息，支持添加、编辑、删除和置顶设置</p>
    </div>

    <div class="toolbar">
      <el-input
        v-model="searchQuery"
        placeholder="搜索群名称或群号..."
        clearable
        style="width: 250px"
        @input="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-select v-model="filterOrg" placeholder="机构筛选" clearable style="width: 150px; margin-left: 10px" @change="handleSearch">
        <el-option v-for="org in orgOptions" :key="org" :label="org" :value="org" />
      </el-select>
      <el-select v-model="filterPinned" placeholder="置顶筛选" clearable style="width: 120px; margin-left: 10px" @change="handleSearch">
        <el-option label="已置顶" :value="1" />
        <el-option label="未置顶" :value="0" />
      </el-select>
      <el-button type="primary" @click="handleAdd" style="margin-left: 10px">
        <el-icon><Plus /></el-icon>添加QQ群
      </el-button>
    </div>

    <el-table :data="filteredGroups" v-loading="loading" style="width: 100%">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="群名称" min-width="150" />
      <el-table-column prop="group_number" label="群号" width="120" />
      <el-table-column prop="org_name" label="所属机构" width="120" />
      <el-table-column label="标签" min-width="200">
        <template #default="scope">
          <el-tag v-for="(tag, index) in parseTags(scope.row.tags)" :key="index" size="small" style="margin-right: 5px; margin-bottom: 3px">
            {{ tag }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="sort_order" label="排序" width="80" />
      <el-table-column prop="is_pinned" label="置顶" width="80">
        <template #default="scope">
          <el-switch
            v-model="scope.row.is_pinned"
            :active-value="1"
            :inactive-value="0"
            @change="(val) => handlePinnedChange(scope.row, val)"
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

    <!-- 添加/编辑QQ群对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑QQ群' : '添加QQ群'" width="600px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="群名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入群名称" />
        </el-form-item>
        <el-form-item label="群号" prop="group_number">
          <el-input v-model="form.group_number" placeholder="请输入QQ群号" />
        </el-form-item>
        <el-form-item label="所属机构" prop="org_name">
          <el-select v-model="form.org_name" placeholder="选择或输入机构" filterable allow-create style="width: 100%">
            <el-option v-for="org in orgOptions" :key="org" :label="org" :value="org" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-select
            v-model="form.tags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="请输入标签"
            style="width: 100%"
          >
            <el-option v-for="tag in commonTags" :key="tag" :label="tag" :value="tag" />
          </el-select>
          <div class="form-tip">多个标签用于分类和搜索，可自定义输入</div>
        </el-form-item>
        <el-form-item label="群介绍">
          <el-input v-model="form.description" type="textarea" :rows="4" placeholder="请输入群介绍（可选）" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort_order" :min="0" :max="999" controls-position="right" style="width: 100%" />
          <div class="form-tip">数字越小排序越靠前</div>
        </el-form-item>
        <el-form-item label="置顶">
          <el-switch v-model="form.is_pinned" :active-value="1" :inactive-value="0" />
          <span class="status-hint">{{ form.is_pinned ? '置顶' : '不置顶' }}</span>
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
import axios from 'axios'

const API_BASE_URL = '/api/qq-group/admin'

// 创建带认证的 axios 实例
const authAxios = axios.create()
authAxios.interceptors.request.use(config => {
  const token = localStorage.getItem('admin_token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const searchQuery = ref('')
const filterOrg = ref('')
const filterPinned = ref('')
const formRef = ref(null)

const qqGroups = ref([])
const orgOptions = ref(['考研', '考研数学', '考研英语', '考研政治'])
const commonTags = ref(['数学一', '数学二', '数学三', '英语一', '英语二', '政治', '答疑', '刷题', '每日一练', '词汇', '作文', '时政'])

const form = ref({
  id: null,
  name: '',
  group_number: '',
  org_name: '',
  tags: [],
  description: '',
  sort_order: 0,
  is_pinned: 0,
  is_active: 1
})

const rules = {
  name: [{ required: true, message: '请输入群名称', trigger: 'blur' }],
  group_number: [{ required: true, message: '请输入QQ群号', trigger: 'blur' }],
  org_name: [{ required: true, message: '请输入所属机构', trigger: 'blur' }]
}

// 解析标签
const parseTags = (tags) => {
  if (!tags) return []
  if (Array.isArray(tags)) return tags
  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags)
      return Array.isArray(parsed) ? parsed : [tags]
    } catch {
      return tags.split(',').filter(t => t.trim())
    }
  }
  return []
}

// 获取QQ群列表
const fetchQQGroups = async () => {
  loading.value = true
  try {
    const response = await authAxios.get(`${API_BASE_URL}/list`)
    if (response.data.code === 0) {
      qqGroups.value = response.data.data || []
      // 提取机构选项
      const orgs = new Set(qqGroups.value.map(g => g.org_name).filter(Boolean))
      orgOptions.value = [...new Set([...orgOptions.value, ...orgs])]
    } else {
      ElMessage.error(response.data.message || '获取QQ群列表失败')
    }
  } catch (error) {
    console.error('获取QQ群列表失败:', error)
    ElMessage.error('获取QQ群列表失败')
  } finally {
    loading.value = false
  }
}

// 过滤后的列表
const filteredGroups = computed(() => {
  let result = qqGroups.value
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(g => 
      g.name.toLowerCase().includes(query) || 
      g.group_number.includes(query)
    )
  }
  
  if (filterOrg.value) {
    result = result.filter(g => g.org_name === filterOrg.value)
  }
  
  if (filterPinned.value !== '') {
    result = result.filter(g => g.is_pinned === filterPinned.value)
  }
  
  // 按置顶和排序排序
  return result.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) {
      return b.is_pinned - a.is_pinned
    }
    return a.sort_order - b.sort_order
  })
})

// 搜索
const handleSearch = () => {
  // 计算属性自动处理
}

// 添加
const handleAdd = () => {
  isEdit.value = false
  form.value = {
    id: null,
    name: '',
    group_number: '',
    org_name: '',
    tags: [],
    description: '',
    sort_order: 0,
    is_pinned: 0,
    is_active: 1
  }
  dialogVisible.value = true
}

// 编辑
const handleEdit = (row) => {
  isEdit.value = true
  form.value = {
    ...row,
    tags: parseTags(row.tags)
  }
  dialogVisible.value = true
}

// 删除
const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除QQ群 "${row.name}" 吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      const response = await authAxios.delete(`${API_BASE_URL}/${row.id}`)
      if (response.data.code === 0) {
        ElMessage.success('删除成功')
        fetchQQGroups()
      } else {
        ElMessage.error(response.data.message || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

// 置顶切换
const handlePinnedChange = async (row, val) => {
  try {
    const response = await authAxios.put(`${API_BASE_URL}/${row.id}`, {
      ...row,
      is_pinned: val
    })
    if (response.data.code === 0) {
      ElMessage.success(val ? '已置顶' : '已取消置顶')
      fetchQQGroups()
    } else {
      ElMessage.error(response.data.message || '操作失败')
      row.is_pinned = val === 1 ? 0 : 1
    }
  } catch (error) {
    console.error('操作失败:', error)
    ElMessage.error('操作失败')
    row.is_pinned = val === 1 ? 0 : 1
  }
}

// 状态切换
const handleStatusChange = async (row, val) => {
  try {
    const response = await authAxios.put(`${API_BASE_URL}/${row.id}`, {
      ...row,
      is_active: val
    })
    if (response.data.code === 0) {
      ElMessage.success(val ? '已启用' : '已禁用')
    } else {
      ElMessage.error(response.data.message || '操作失败')
      row.is_active = val === 1 ? 0 : 1
    }
  } catch (error) {
    console.error('操作失败:', error)
    ElMessage.error('操作失败')
    row.is_active = val === 1 ? 0 : 1
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    submitting.value = true
    try {
      const submitData = {
        ...form.value,
        tags: JSON.stringify(form.value.tags)
      }
      
      let response
      if (isEdit.value) {
        response = await authAxios.put(`${API_BASE_URL}/${form.value.id}`, submitData)
      } else {
        response = await authAxios.post(`${API_BASE_URL}`, submitData)
      }
      
      if (response.data.code === 0) {
        ElMessage.success(isEdit.value ? '编辑成功' : '添加成功')
        dialogVisible.value = false
        fetchQQGroups()
      } else {
        ElMessage.error(response.data.message || (isEdit.value ? '编辑失败' : '添加失败'))
      }
    } catch (error) {
      console.error(isEdit.value ? '编辑失败:' : '添加失败:', error)
      ElMessage.error(isEdit.value ? '编辑失败' : '添加失败')
    } finally {
      submitting.value = false
    }
  })
}

onMounted(() => {
  fetchQQGroups()
})
</script>

<style scoped>
.qq-group-manage {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: #303133;
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

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

.status-hint {
  margin-left: 10px;
  color: #606266;
}
</style>
