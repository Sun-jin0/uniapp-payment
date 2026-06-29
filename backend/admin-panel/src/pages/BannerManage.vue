<template>
  <div class="banner-manage">
    <div class="page-header">
      <div class="left">
        <h2>轮播图管理</h2>
        <p class="subtitle">管理首页顶部轮播图及其跳转链接</p>
      </div>
      <div class="right">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>添加轮播图
        </el-button>
      </div>
    </div>

    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="card-header">
          <el-input
            v-model="searchQuery"
            placeholder="搜索轮播图标题..."
            style="width: 300px"
            clearable
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button @click="fetchBanners">刷新</el-button>
        </div>
      </template>

      <el-table :data="filteredBanners" v-loading="loading" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="预览图" width="180">
          <template #default="scope">
            <el-image
              style="width: 140px; height: 70px; border-radius: 4px"
              :src="scope.row.imageUrl"
              :preview-src-list="[scope.row.imageUrl]"
              fit="cover"
              preview-teleported
            >
              <template #error>
                <div class="image-error">
                  <el-icon><Picture /></el-icon>
                </div>
              </template>
            </el-image>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="150" />
        <el-table-column prop="link" label="跳转链接" min-width="150" show-overflow-tooltip />
        <el-table-column prop="sort" label="排序" width="100" sortable />
        <el-table-column label="状态" width="120">
          <template #default="scope">
            <el-switch
              v-model="scope.row.status"
              :active-value="1"
              :inactive-value="0"
              @change="(val) => handleStatusChange(scope.row, val)"
            />
            <span class="status-label">{{ scope.row.status === 1 ? '启用' : '禁用' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="180">
          <template #default="scope">
            {{ formatTime(scope.row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="handleEdit(scope.row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑轮播图' : '添加轮播图'"
      width="500px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        class="banner-form"
      >
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入轮播图标题" />
        </el-form-item>
        
        <el-form-item label="轮播图片" prop="imageUrl">
          <el-upload
            class="banner-uploader"
            action="#"
            :show-file-list="false"
            :auto-upload="false"
            :on-change="handleImageUpload"
          >
            <img v-if="form.imageUrl" :src="form.imageUrl" class="banner-preview" />
            <el-icon v-else class="banner-uploader-icon"><Plus /></el-icon>
          </el-upload>
          <div class="upload-tip">建议尺寸: 750x350，点击图片更换</div>
          <el-input v-model="form.imageUrl" placeholder="或输入图片URL" class="mt-10" />
        </el-form-item>

        <el-form-item label="跳转链接" prop="link">
          <el-input v-model="form.link" placeholder="请输入页面路径或URL" />
        </el-form-item>

        <el-form-item label="排序值" prop="sort">
          <el-input-number v-model="form.sort" :min="0" />
        </el-form-item>

        <el-form-item label="启用状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio :label="1">启用</el-radio>
            <el-radio :label="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitForm" :loading="submitting">
            确定
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { adminApi } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Picture } from '@element-plus/icons-vue'

const loading = ref(false)
const submitting = ref(false)
const banners = ref([])
const searchQuery = ref('')
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)

const form = ref({
  id: null,
  title: '',
  imageUrl: '',
  link: '',
  sort: 0,
  status: 1
})

const rules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  imageUrl: [{ required: true, message: '请上传图片或输入图片URL', trigger: 'blur' }]
}

const filteredBanners = computed(() => {
  if (!searchQuery.value) return banners.value
  return banners.value.filter(b => 
    b.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    (b.id && b.id.toString().includes(searchQuery.value))
  )
})

const fetchBanners = async () => {
  loading.value = true
  try {
    const res = await adminApi.getBanners()
    if (res.code === 0) {
      banners.value = res.data.list || []
    }
  } catch (error) {
    console.error('Fetch banners failed:', error)
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  isEdit.value = false
  form.value = {
    id: null,
    title: '',
    imageUrl: '',
    link: '',
    sort: 0,
    status: 1
  }
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  form.value = { ...row }
  dialogVisible.value = true
}

const handleDelete = (row) => {
  ElMessageBox.confirm('确定要删除该轮播图吗?', '提示', {
    type: 'warning'
  }).then(async () => {
    try {
      const res = await adminApi.deleteBanner(row.id)
      if (res.code === 0) {
        ElMessage.success('删除成功')
        fetchBanners()
      }
    } catch (error) {
      console.error('Delete banner failed:', error)
    }
  })
}

const handleStatusChange = async (row, val) => {
  try {
    const res = await adminApi.updateBannerStatus(row.id, val)
    if (res.code === 0) {
      ElMessage.success(`已${val === 1 ? '启用' : '禁用'}`)
    } else {
      row.status = val === 1 ? 0 : 1
    }
  } catch (error) {
    row.status = val === 1 ? 0 : 1
    console.error('Update status failed:', error)
  }
}

const handleImageUpload = async (file) => {
  try {
    loading.value = true
    const res = await adminApi.uploadImage(file.raw)
    if (res.code === 0 && res.data.url) {
      form.value.imageUrl = res.data.url
      ElMessage.success('图片上传成功')
    }
  } catch (error) {
    console.error('Upload failed:', error)
    ElMessage.error('图片上传失败')
  } finally {
    loading.value = false
  }
}

const submitForm = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        let res
        if (isEdit.value) {
          res = await adminApi.updateBanner(form.value.id, form.value)
        } else {
          res = await adminApi.createBanner(form.value)
        }
        
        if (res.code === 0) {
          ElMessage.success(isEdit.value ? '修改成功' : '添加成功')
          dialogVisible.value = false
          fetchBanners()
        }
      } catch (error) {
        console.error('Save banner failed:', error)
      } finally {
        submitting.value = false
      }
    }
  })
}

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString()
}

onMounted(() => {
  fetchBanners()
})
</script>

<style scoped>
.banner-manage {
  padding: 10px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  color: #303133;
}

.subtitle {
  margin: 5px 0 0;
  color: #909399;
  font-size: 14px;
}

.table-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-label {
  margin-left: 8px;
  font-size: 13px;
  color: #606266;
}

.image-error {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background: #f5f7fa;
  color: #909399;
  font-size: 24px;
}

.banner-uploader {
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  width: 280px;
  height: 140px;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: border-color 0.3s;
}

.banner-uploader:hover {
  border-color: #409EFF;
}

.banner-uploader-icon {
  font-size: 28px;
  color: #8c939d;
}

.banner-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

.mt-10 {
  margin-top: 10px;
}

.mt-20 {
  margin-top: 20px;
}
</style>