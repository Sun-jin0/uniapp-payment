<template>
  <div class="homepage-card-manage">
    <div class="header-actions">
      <el-button type="primary" @click="openAddModal">
        <el-icon><Plus /></el-icon> 添加卡片
      </el-button>
    </div>

    <el-table :data="cards" v-loading="loading" border stripe style="width: 100%" class="mt-20">
      <el-table-column prop="id" label="ID" width="80" align="center" />
      <el-table-column label="图标/预览" width="100" align="center">
        <template #default="{ row }">
          <div v-if="row.icon" class="icon-preview">{{ row.icon }}</div>
          <div v-else-if="row.text_icon" class="text-icon-preview">{{ row.text_icon }}</div>
          <el-image v-else-if="row.image_url" :src="row.image_url" fit="cover" class="image-preview" />
          <el-icon v-else><Picture /></el-icon>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="120" />
      <el-table-column prop="category" label="分类" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="getCategoryType(row.category)">
            {{ getCategoryName(row.category) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="150" show-overflow-tooltip />
      <el-table-column prop="url" label="链接" min-width="200" show-overflow-tooltip />
      <el-table-column prop="color" label="颜色" width="100" align="center">
        <template #default="{ row }">
          <div class="color-preview-cell">
            <div class="color-box" :style="{ backgroundColor: row.color }"></div>
            <span>{{ row.color }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="sort_order" label="排序" width="80" align="center" />
      <el-table-column prop="height" label="高度" width="80" align="center">
        <template #default="{ row }">
          <span>{{ row.height || 100 }}rpx</span>
        </template>
      </el-table-column>
      <el-table-column prop="is_active" label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-switch
            :model-value="row.is_active"
            :active-value="1"
            :inactive-value="0"
            @change="(val) => handleStatusChange(row, val)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" align="center" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="editCard(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="deleteCard(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 添加/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingCard.id ? '编辑卡片' : '添加卡片'"
      width="600px"
    >
      <el-form :model="editingCard" label-width="120px">
        <el-form-item label="标题" required>
          <el-input v-model="editingCard.title" placeholder="请输入卡片标题" />
        </el-form-item>
        <el-form-item label="分类">
          <el-radio-group v-model="editingCard.category">
            <el-radio label="public">公共课</el-radio>
            <el-radio label="professional">专业课</el-radio>
            <el-radio label="selected">精选</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editingCard.description" placeholder="请输入描述" />
        </el-form-item>
        <el-form-item label="图标 (Emoji)">
          <el-input v-model="editingCard.icon" placeholder="例如: 💻" />
        </el-form-item>
        <el-form-item label="文字图标">
          <el-input v-model="editingCard.text_icon" placeholder="例如: 计" maxlength="1" />
        </el-form-item>
        <el-form-item label="图片 URL">
          <el-input v-model="editingCard.image_url" placeholder="图片链接 (替代图标)" />
        </el-form-item>
        <el-form-item label="跳转链接" required>
          <el-input v-model="editingCard.url" placeholder="跳转路径" />
          <div class="input-hint">格式: /pages/practice/practice-detail?id=科目ID</div>
        </el-form-item>
        <el-form-item label="背景颜色">
          <el-color-picker v-model="editingCard.color" />
          <span class="ml-10">{{ editingCard.color }}</span>
        </el-form-item>
        <el-form-item label="排序值">
          <el-input-number v-model="editingCard.sort_order" :min="0" />
        </el-form-item>
        <el-form-item label="卡片高度">
          <el-input-number v-model="editingCard.height" :min="50" :max="500" :step="10" />
          <span class="ml-10 text-gray">单位: rpx (默认100)</span>
        </el-form-item>
        <el-form-item label="Tab页跳转">
          <el-switch v-model="editingCard.is_tab" :active-value="1" :inactive-value="0" />
          <span class="ml-10 text-gray">如果是底部导航栏页面，必须开启此项</span>
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="editingCard.is_active" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCard">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Plus, Picture } from '@element-plus/icons-vue'
import { adminApi } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const cards = ref([])
const dialogVisible = ref(false)

const editingCard = ref({
  id: null,
  title: '',
  category: 'public',
  description: '',
  icon: '',
  text_icon: '',
  color: '#e3f2fd',
  url: '',
  image_url: '',
  height: 100,
  sort_order: 0,
  is_active: 1,
  is_tab: 0
})

const getCategoryName = (cat) => {
  const map = {
    'public': '公共课',
    'professional': '专业课',
    'selected': '精选'
  }
  return map[cat] || cat
}

const getCategoryType = (cat) => {
  const map = {
    'public': '',
    'professional': 'success',
    'selected': 'warning'
  }
  return map[cat] || ''
}

const loadCards = async () => {
  loading.value = true
  try {
    const res = await adminApi.getHomepageCards()
    cards.value = res.data || []
  } catch (error) {
    console.error('加载卡片失败:', error)
  } finally {
    loading.value = false
  }
}

const openAddModal = () => {
  editingCard.value = {
    id: null,
    title: '',
    category: 'public',
    description: '',
    icon: '',
    text_icon: '',
    color: '#e3f2fd',
    url: '/pages/public/public-book-detail?bookId=',
    image_url: '',
    height: 100,
    sort_order: cards.value.length,
    is_active: 1,
    is_tab: 0
  }
  dialogVisible.value = true
}

const editCard = (row) => {
  editingCard.value = { ...row }
  dialogVisible.value = true
}

const saveCard = async () => {
  if (!editingCard.value.title || !editingCard.value.url) {
    ElMessage.warning('请填写必填项')
    return
  }
  try {
    if (editingCard.value.id) {
      await adminApi.updateHomepageCard(editingCard.value.id, editingCard.value)
      ElMessage.success('更新成功')
    } else {
      await adminApi.createHomepageCard(editingCard.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadCards()
  } catch (error) {
    console.error('保存失败:', error)
  }
}

const handleStatusChange = async (row, val) => {
  try {
    await adminApi.updateHomepageCard(row.id, { is_active: val })
    ElMessage.success('状态更新成功')
    // API 调用成功，手动更新 row.is_active
    row.is_active = val
  } catch (error) {
    console.error('状态更新失败:', error)
    ElMessage.error('状态更新失败')
  }
}

const deleteCard = (row) => {
  ElMessageBox.confirm('确定要删除该卡片吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await adminApi.deleteHomepageCard(row.id)
      ElMessage.success('删除成功')
      loadCards()
    } catch (error) {
      console.error('删除失败:', error)
    }
  })
}

onMounted(() => {
  loadCards()
})
</script>

<style scoped>
.homepage-card-manage {
  padding: 20px;
}
.header-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 20px;
}
.mt-20 {
  margin-top: 20px;
}
.icon-preview {
  font-size: 24px;
}
.text-icon-preview {
  font-size: 18px;
  font-weight: bold;
  color: #666;
}
.image-preview {
  width: 40px;
  height: 40px;
  border-radius: 4px;
}
.color-preview-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}
.color-box {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  border: 1px solid #ddd;
}
.input-hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  line-height: 1;
}
.ml-10 {
  margin-left: 10px;
}
.text-gray {
  color: #999;
  font-size: 12px;
}
</style>
