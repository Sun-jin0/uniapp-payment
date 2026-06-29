<template>
  <div class="card-manage">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>卡牌管理</span>
          <el-button type="primary" @click="handleAdd">添加卡牌</el-button>
        </div>
      </template>

      <!-- 搜索栏 -->
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="卡牌名称">
          <el-input v-model="searchForm.name" placeholder="请输入卡牌名称" clearable />
        </el-form-item>
        <el-form-item label="稀有度">
          <el-select v-model="searchForm.rarity" placeholder="请选择稀有度" clearable @change="handleSearch" style="width: 120px">
            <el-option label="普通" value="common" />
            <el-option label="稀有" value="rare" />
            <el-option label="史诗" value="epic" />
            <el-option label="传说" value="legendary" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="searchForm.is_reward" placeholder="请选择类型" clearable @change="handleSearch" style="width: 120px">
            <el-option label="奖励卡" :value="1" />
            <el-option label="安慰奖" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.is_active" placeholder="请选择状态" clearable @change="handleSearch" style="width: 120px">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 数据表格 -->
      <el-table :data="cardList" v-loading="loading" border>
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column label="卡牌图片" width="120">
          <template #default="{ row }">
            <el-image 
              :src="row.image_url" 
              :preview-src-list="[row.image_url]"
              style="width: 80px; height: 80px; object-fit: cover;"
              fit="cover"
            />
          </template>
        </el-table-column>
        <el-table-column prop="name" label="卡牌名称" min-width="150" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="稀有度" width="100">
          <template #default="{ row }">
            <el-tag :type="getRarityType(row.rarity)">{{ getRarityText(row.rarity) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="probability" label="概率" width="100">
          <template #default="{ row }">
            {{ (row.probability * 100).toFixed(2) }}%
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_reward ? 'success' : 'info'">
              {{ row.is_reward ? '奖励卡' : '安慰奖' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch 
              v-model="row.is_active" 
              :active-value="1" 
              :inactive-value="0"
              @change="(val) => handleStatusChange(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 添加/编辑对话框 -->
    <el-dialog 
      v-model="dialogVisible" 
      :title="dialogTitle" 
      width="600px"
      destroy-on-close
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="卡牌名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入卡牌名称" />
        </el-form-item>
        <el-form-item label="卡牌描述" prop="description">
          <el-input 
            v-model="form.description" 
            type="textarea" 
            :rows="3"
            placeholder="请输入卡牌描述" 
          />
        </el-form-item>
        <el-form-item label="卡牌图片" prop="image_url">
          <el-upload
            class="avatar-uploader"
            action=""
            :show-file-list="false"
            :before-upload="beforeUpload"
            :http-request="customUpload"
          >
            <img v-if="form.image_url" :src="form.image_url" class="avatar" />
            <el-icon v-else class="avatar-uploader-icon"><Plus /></el-icon>
          </el-upload>
        </el-form-item>
        <el-form-item label="稀有度" prop="rarity">
          <el-select v-model="form.rarity" placeholder="请选择稀有度">
            <el-option label="普通" value="common" />
            <el-option label="稀有" value="rare" />
            <el-option label="史诗" value="epic" />
            <el-option label="传说" value="legendary" />
          </el-select>
        </el-form-item>
        <el-form-item label="抽取概率" prop="probability">
          <el-input-number 
            v-model="form.probability" 
            :min="0" 
            :max="1" 
            :step="0.01"
            :precision="4"
            style="width: 200px"
          />
          <span class="tip">范围：0-1，例如0.1表示10%</span>
        </el-form-item>
        <el-form-item label="卡牌类型">
          <el-radio-group v-model="form.is_reward">
            <el-radio :label="1">奖励卡</el-radio>
            <el-radio :label="0">安慰奖</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch 
            v-model="form.is_active" 
            :active-value="1" 
            :inactive-value="0"
            active-text="启用"
            inactive-text="禁用"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import axios from 'axios'

// 创建带 token 的 axios 实例
const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://yizhancs.cn'
})

// 请求拦截器添加 token
request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器处理 401
request.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      ElMessage.error('登录已过期，请重新登录')
      localStorage.removeItem('admin_token')
      window.location.href = '/#/login'
    }
    return Promise.reject(error)
  }
)

const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const dialogTitle = ref('添加卡牌')
const formRef = ref(null)
const isEdit = ref(false)
const currentId = ref(null)

// 搜索表单
const searchForm = reactive({
  name: '',
  rarity: '',
  is_reward: null,
  is_active: null
})

// 分页
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

// 卡牌列表
const cardList = ref([])

// 表单
const form = reactive({
  name: '',
  description: '',
  image_url: '',
  rarity: 'common',
  probability: 0.1,
  is_reward: 1,
  is_active: 1
})

// 表单规则
const rules = {
  name: [{ required: true, message: '请输入卡牌名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入卡牌描述', trigger: 'blur' }],
  image_url: [{ required: true, message: '请上传卡牌图片', trigger: 'blur' }],
  rarity: [{ required: true, message: '请选择稀有度', trigger: 'change' }],
  probability: [{ required: true, message: '请输入抽取概率', trigger: 'blur' }]
}

// 获取稀有度类型
const getRarityType = (rarity) => {
  const types = {
    common: '',
    rare: 'primary',
    epic: 'warning',
    legendary: 'danger'
  }
  return types[rarity] || ''
}

// 获取稀有度文本
const getRarityText = (rarity) => {
  const texts = {
    common: '普通',
    rare: '稀有',
    epic: '史诗',
    legendary: '传说'
  }
  return texts[rarity] || rarity
}

// 获取卡牌列表
const fetchCardList = async () => {
  loading.value = true
  try {
    // 使用管理员接口获取所有卡牌（包括安慰奖和奖励卡）
    const res = await request.get('/api/cards/admin/list')
    if (res.data.code === 0) {
      // 前端分页和筛选
      let list = res.data.data || []

      // 按名称筛选
      if (searchForm.name) {
        list = list.filter(item => item.name.includes(searchForm.name))
      }

      // 按稀有度筛选
      if (searchForm.rarity) {
        list = list.filter(item => item.rarity === searchForm.rarity)
      }

      // 按类型筛选（奖励卡/安慰奖）
      if (searchForm.is_reward !== null && searchForm.is_reward !== undefined && searchForm.is_reward !== '') {
        list = list.filter(item => item.is_reward === searchForm.is_reward)
      }

      // 按状态筛选（启用/禁用）
      if (searchForm.is_active !== null && searchForm.is_active !== undefined && searchForm.is_active !== '') {
        list = list.filter(item => {
          // 将后端返回的值转换为布尔值
          const itemActive = item.is_active === true || item.is_active === 1
          // 将筛选条件转换为布尔值
          const searchActive = searchForm.is_active === 1 || searchForm.is_active === true
          return itemActive === searchActive
        })
      }
      
      total.value = list.length
      
      // 分页
      const start = (page.value - 1) * pageSize.value
      const end = start + pageSize.value
      cardList.value = list.slice(start, end)
    }
  } catch (error) {
    console.error('获取卡牌列表失败:', error)
    ElMessage.error('获取卡牌列表失败')
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  page.value = 1
  fetchCardList()
}

// 重置
const handleReset = () => {
  searchForm.name = ''
  searchForm.rarity = ''
  searchForm.is_reward = null
  searchForm.is_active = null
  page.value = 1
  fetchCardList()
}

// 添加
const handleAdd = () => {
  isEdit.value = false
  currentId.value = null
  dialogTitle.value = '添加卡牌'
  Object.assign(form, {
    name: '',
    description: '',
    image_url: '',
    rarity: 'common',
    probability: 0.1,
    is_reward: 1,
    is_active: 1
  })
  dialogVisible.value = true
}

// 编辑
const handleEdit = (row) => {
  isEdit.value = true
  currentId.value = row.id
  dialogTitle.value = '编辑卡牌'
  Object.assign(form, {
    name: row.name,
    description: row.description,
    image_url: row.image_url,
    rarity: row.rarity,
    probability: row.probability,
    is_reward: row.is_reward,
    is_active: row.is_active
  })
  dialogVisible.value = true
}

// 删除
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除该卡牌吗？', '提示', {
      type: 'warning'
    })
    const res = await request.delete(`/api/cards/delete/${row.id}`)
    if (res.data.code === 0) {
      ElMessage.success('删除成功')
      fetchCardList()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

// 状态变更
const handleStatusChange = async (row, val) => {
  try {
    // 状态变更通过更新接口实现
    const res = await request.put(`/api/cards/update/${row.id}`, { is_active: val })
    if (res.data.code === 0) {
      ElMessage.success('状态更新成功')
    } else {
      row.is_active = val === 1 ? 0 : 1
    }
  } catch (error) {
    console.error('状态更新失败:', error)
    row.is_active = val === 1 ? 0 : 1
    ElMessage.error('状态更新失败')
  }
}

// 提交
const handleSubmit = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitLoading.value = true
  try {
    const url = isEdit.value ? `/api/cards/update/${currentId.value}` : '/api/cards/create'
    const method = isEdit.value ? 'put' : 'post'
    const res = await request[method](url, form)
    if (res.data.code === 0) {
      ElMessage.success(isEdit.value ? '编辑成功' : '添加成功')
      dialogVisible.value = false
      fetchCardList()
    }
  } catch (error) {
    console.error('提交失败:', error)
    ElMessage.error('提交失败')
  } finally {
    submitLoading.value = false
  }
}

// 上传前检查
const beforeUpload = (file) => {
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

// 自定义上传
const customUpload = async (options) => {
  const { file } = options
  const formData = new FormData()
  formData.append('image', file)

  try {
    const res = await request.post('/api/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    if (res.data.code === 0) {
      form.image_url = res.data.data.url
      ElMessage.success('上传成功')
    }
  } catch (error) {
    console.error('上传失败:', error)
    ElMessage.error('上传失败')
  }
}

// 分页
const handleSizeChange = (val) => {
  pageSize.value = val
  fetchCardList()
}

const handleCurrentChange = (val) => {
  page.value = val
  fetchCardList()
}

onMounted(() => {
  fetchCardList()
})
</script>

<style scoped>
.card-manage {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-form {
  margin-bottom: 20px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.avatar-uploader {
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: var(--el-transition-duration-fast);
  width: 178px;
  height: 178px;
}

.avatar-uploader:hover {
  border-color: var(--el-color-primary);
}

.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 178px;
  height: 178px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar {
  width: 178px;
  height: 178px;
  display: block;
  object-fit: cover;
}

.tip {
  margin-left: 10px;
  color: #999;
  font-size: 12px;
}
</style>
