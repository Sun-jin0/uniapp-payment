<template>
  <div class="nav-manage">
    <el-container class="nav-container">
      <!-- 左侧科目列表 -->
      <el-aside width="300px" class="subject-aside">
        <div class="section-header">
          <span class="title">左侧科目</span>
          <el-button type="primary" size="small" @click="openSubjectModal()">
            <el-icon><Plus /></el-icon>添加
          </el-button>
        </div>
        <el-scrollbar>
          <div 
            v-for="subject in subjects" 
            :key="subject.id" 
            class="list-item"
            :class="{ active: selectedSubjectId === subject.id }"
            @click="selectSubject(subject.id)"
          >
            <div class="item-content">
              <div class="item-name">{{ subject.name }}</div>
              <div class="item-desc">{{ subject.page_path || '无路径' }}</div>
            </div>
            <div class="item-actions" v-if="selectedSubjectId === subject.id">
              <el-button size="small" circle @click.stop="openSubjectModal(subject)">
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button size="small" type="danger" circle @click.stop="confirmDeleteSubject(subject)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
          <el-empty v-if="subjects.length === 0" description="暂无科目" :image-size="60" />
        </el-scrollbar>
      </el-aside>

      <!-- 右侧子项列表 -->
      <el-main class="category-main">
        <div class="section-header">
          <span class="title">右侧子项 ({{ activeSubjectName }})</span>
          <el-button 
            type="primary" 
            size="small" 
            :disabled="!selectedSubjectId" 
            @click="openCategoryModal()"
          >
            <el-icon><Plus /></el-icon>添加子项
          </el-button>
        </div>
        <el-table :data="categories" v-loading="loadingCategories" border stripe style="width: 100%" class="mt-20">
          <el-table-column prop="id" label="ID" width="80" align="center" />
          <el-table-column prop="name" label="名称" min-width="120">
            <template #default="{ row }">
              <div class="name-cell">
                <span>{{ row.name }}</span>
                <el-tag v-if="row.is_public" size="small" type="warning" class="ml-5">公共题库</el-tag>
                <el-tag v-else size="small" type="info" class="ml-5">非公共</el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="page_path" label="跳转路径" min-width="200" show-overflow-tooltip />
          <el-table-column prop="sort" label="排序" width="80" align="center" />
          <el-table-column label="操作" width="150" align="center" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="openCategoryModal(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="confirmDeleteCategory(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!selectedSubjectId" description="请先选择左侧科目" />
      </el-main>
    </el-container>

    <!-- 科目弹窗 -->
    <el-dialog
      v-model="subjectDialogVisible"
      :title="editingSubject.id ? '编辑科目' : '添加科目'"
      width="500px"
    >
      <el-form :model="editingSubject" label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="editingSubject.name" placeholder="如：考研政治" />
        </el-form-item>
        <el-form-item label="代码" required>
          <el-input v-model="editingSubject.subject_code" placeholder="如：politics" />
        </el-form-item>
        <el-form-item label="跳转路径">
          <el-input v-model="editingSubject.page_path" placeholder="默认跳转路径" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editingSubject.description" placeholder="科目描述" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="editingSubject.icon" placeholder="icon名称" />
        </el-form-item>
        <el-form-item label="文字图标">
          <el-input v-model="editingSubject.text_icon" maxlength="1" placeholder="1个字" />
        </el-form-item>
        <el-form-item label="背景颜色">
          <el-color-picker v-model="editingSubject.color" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="editingSubject.sort" :min="0" />
        </el-form-item>
        <el-form-item label="公共题库">
          <el-switch v-model="editingSubject.is_public" active-text="是" inactive-text="否" />
          <div class="field-hint">公共题库使用 public_categories 表管理分类</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="subjectDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveSubject">保存</el-button>
      </template>
    </el-dialog>

    <!-- 子项弹窗 -->
    <el-dialog
      v-model="categoryDialogVisible"
      :title="editingCategory.id ? '编辑子项' : '添加子项'"
      width="500px"
    >
      <el-form :model="editingCategory" label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="editingCategory.name" placeholder="如：马原专题" />
        </el-form-item>
        <el-form-item label="跳转路径">
          <el-input v-model="editingCategory.page_path" placeholder="覆盖科目路径" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="editingCategory.sort" :min="0" />
        </el-form-item>
        <el-form-item label="所属科目">
          <el-select v-model="editingCategory.subject_id" placeholder="选择科目">
            <el-option 
              v-for="sub in subjects" 
              :key="sub.id" 
              :label="sub.name" 
              :value="sub.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="公共库" v-if="editingCategory.id">
          <el-switch v-model="editingCategory.is_public" />
          <span class="ml-10 text-gray">慎重修改</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCategory">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import { adminApi, publicApi } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'

const subjects = ref([])
const categories = ref([])
const selectedSubjectId = ref(null)
const loadingCategories = ref(false)

const subjectDialogVisible = ref(false)
const categoryDialogVisible = ref(false)

const editingSubject = ref({
  id: null,
  name: '',
  subject_code: '',
  description: '',
  page_path: '',
  sort: 0,
  icon: 'books',
  text_icon: '',
  color: '#ffffff',
  is_public: true
})

const editingCategory = ref({
  id: null,
  name: '',
  page_path: '',
  sort: 0,
  is_public: false,
  subject_id: null
})

// 监控 editingCategory 的变化
watch(() => editingCategory.value, (newVal) => {
  console.log('editingCategory 变化:', newVal)
}, { deep: true })

const activeSubjectName = computed(() => {
  const sub = subjects.value.find(s => s.id === selectedSubjectId.value)
  return sub ? sub.name : '未选择'
})

const loadSubjects = async () => {
  try {
    const res = await adminApi.getNavSubjects()
    subjects.value = res.data || []
    if (subjects.value.length > 0 && !selectedSubjectId.value) {
      selectSubject(subjects.value[0].id)
    }
  } catch (error) {
    console.error('加载科目失败:', error)
  }
}

const selectSubject = async (id) => {
  selectedSubjectId.value = id
  loadCategories(id)
}

const loadCategories = async (subjectId) => {
  loadingCategories.value = true
  try {
    const res = await adminApi.getNavCategories({ subjectId })
    categories.value = res.data || []
  } catch (error) {
    console.error('加载子项失败:', error)
  } finally {
    loadingCategories.value = false
  }
}

// Subject Actions
const openSubjectModal = (subject = null) => {
  if (subject) {
    editingSubject.value = { 
      ...subject,
      is_public: subject.is_public !== undefined ? subject.is_public : true
    }
  } else {
    editingSubject.value = {
      id: null,
      name: '',
      subject_code: '',
      description: '',
      page_path: '',
      sort: 0,
      icon: 'books',
      text_icon: '',
      color: '#ffffff',
      is_public: true
    }
  }
  subjectDialogVisible.value = true
}

const saveSubject = async () => {
  if (!editingSubject.value.name) {
    ElMessage.warning('请输入名称')
    return
  }
  if (!editingSubject.value.subject_code) {
    ElMessage.warning('请输入科目代码')
    return
  }
  try {
    if (editingSubject.value.id) {
      await adminApi.updateNavSubject(editingSubject.value.id, editingSubject.value)
      ElMessage.success('更新成功')
    } else {
      await adminApi.createNavSubject(editingSubject.value)
      ElMessage.success('创建成功')
    }
    subjectDialogVisible.value = false
    loadSubjects()
  } catch (error) {
    console.error('保存科目失败:', error)
  }
}

const confirmDeleteSubject = (subject) => {
  ElMessageBox.confirm(`确定要删除科目 "${subject.name}" 及其所有子项吗？`, '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'error'
  }).then(async () => {
    try {
      await adminApi.deleteNavSubject(subject.id)
      ElMessage.success('已删除')
      if (selectedSubjectId.value === subject.id) {
        selectedSubjectId.value = null
        categories.value = []
      }
      loadSubjects()
    } catch (error) {
      console.error('删除科目失败:', error)
    }
  })
}

// Category Actions
const openCategoryModal = (cat = null) => {
  if (cat) {
    // 确保 is_public 是布尔值
    const isPublic = cat.is_public === 1 || cat.is_public === true
    console.log('打开编辑弹窗，原始数据:', cat, 'is_public:', isPublic)
    editingCategory.value = { 
      ...cat,
      is_public: isPublic,
      subject_id: cat.subject_id || selectedSubjectId.value 
    }
  } else {
    editingCategory.value = { 
      id: null, 
      name: '', 
      page_path: '', 
      sort: 0, 
      is_public: false,
      subject_id: selectedSubjectId.value 
    }
  }
  categoryDialogVisible.value = true
}

const saveCategory = async () => {
  if (!editingCategory.value.name) {
    ElMessage.warning('请输入名称')
    return
  }
  try {
    // 获取当前选中的科目信息
    const currentSubject = subjects.value.find(s => s.id === selectedSubjectId.value)
    if (!currentSubject) {
      ElMessage.warning('请先选择科目')
      return
    }
    
    // 确保 is_public 是数字 0 或 1
    const isPublic = editingCategory.value.is_public ? 1 : 0
    const categoryData = {
      ...editingCategory.value,
      is_public: isPublic
    }
    
    console.log('保存分类数据:', categoryData)
    console.log('原始 source:', editingCategory.value.source)
    
    // 获取当前科目对应的一级分类ID
    let firstCategoryId = null
    try {
      const res = await publicApi.getPublicCategories({ level: 1 })
      const firstCategories = res.data || []
      const firstCat = firstCategories.find(cat => cat.subject === currentSubject.subject_code)
      if (firstCat) {
        firstCategoryId = firstCat.id
      }
    } catch (e) {
      console.error('获取一级分类失败:', e)
    }
    
    if (editingCategory.value.id) {
      // 检查是否在公共/非公共之间切换
      const originalIsPublic = editingCategory.value.source === 'public' || 
                               String(editingCategory.value.id).startsWith('public_')
      const newIsPublic = isPublic === 1
      
      console.log('originalIsPublic:', originalIsPublic, 'newIsPublic:', newIsPublic)
      
      if (originalIsPublic !== newIsPublic) {
        // 在公共和非公共之间切换
        if (newIsPublic) {
          // 从非公共切换到公共：先删除 nav_categories，再创建 public_categories
          await adminApi.deleteNavCategory(editingCategory.value.id)
          await adminApi.createPublicCategory({
            name: categoryData.name,
            level: 2,
            subject: currentSubject.subject_code,
            parent_id: firstCategoryId || 0,
            sort: categoryData.sort || 0,
            is_public: 1
          })
          ElMessage.success('已切换到公共题库')
        } else {
          // 从公共切换到非公共：先删除 public_categories，再创建 nav_categories
          const realId = String(editingCategory.value.id).replace('public_', '')
          await adminApi.deletePublicCategory(realId)
          await adminApi.createNavCategory({
            name: categoryData.name,
            description: categoryData.description || '',
            page_path: categoryData.page_path || '',
            sort: categoryData.sort || 0,
            subject_id: selectedSubjectId.value
          })
          ElMessage.success('已切换到非公共题库')
        }
      } else {
        // 没有切换，只是更新
        if (newIsPublic) {
          const realId = String(editingCategory.value.id).replace('public_', '')
          // 使用 parentId 而不是 parent_id，确保字段名称一致
          const updateData = {
            name: categoryData.name,
            level: 2,
            sort: categoryData.sort || 0,
            subject: currentSubject.subject_code,
            is_public: 1,
            parentId: firstCategoryId || categoryData.parentId || 0
          }
          await adminApi.updatePublicCategory(realId, updateData)
        } else {
          await adminApi.updateNavCategory(editingCategory.value.id, categoryData)
        }
        ElMessage.success('更新成功')
      }
    } else {
      // 新建分类
      if (isPublic === 1) {
        await adminApi.createPublicCategory({
          name: categoryData.name,
          level: 2,
          subject: currentSubject.subject_code,
          parent_id: firstCategoryId,
          sort: categoryData.sort || 0,
          is_public: 1
        })
      } else {
        await adminApi.createNavCategory({
          name: categoryData.name,
          description: categoryData.description || '',
          page_path: categoryData.page_path || '',
          sort: categoryData.sort || 0,
          subject_id: selectedSubjectId.value
        })
      }
      ElMessage.success('创建成功')
    }
    categoryDialogVisible.value = false
    loadCategories(selectedSubjectId.value)
  } catch (error) {
    console.error('保存子项失败:', error)
    ElMessage.error('保存失败: ' + (error.response?.data?.message || error.message))
  }
}

const confirmDeleteCategory = (cat) => {
  ElMessageBox.confirm(`确定要删除子项 "${cat.name}" 吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      if (cat.is_public) {
        // 公共题库分类的 ID 格式是 public_${id}，需要提取真实 ID
        const realId = String(cat.id).replace('public_', '')
        await adminApi.deletePublicCategory(realId)
      } else {
        await adminApi.deleteNavCategory(cat.id)
      }
      ElMessage.success('已删除')
      loadCategories(selectedSubjectId.value)
    } catch (error) {
      console.error('删除子项失败:', error)
      ElMessage.error('删除失败: ' + (error.response?.data?.message || error.message))
    }
  })
}

onMounted(() => {
  loadSubjects()
})
</script>

<style scoped>
.nav-manage {
  height: 100%;
}
.nav-container {
  height: calc(100vh - 100px);
  background: #fff;
}
.subject-aside {
  border-right: 1px solid #eee;
  display: flex;
  flex-direction: column;
}
.section-header {
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fafafa;
}
.section-header .title {
  font-weight: bold;
  font-size: 16px;
}
.list-item {
  padding: 15px 20px;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s;
}
.list-item:hover {
  background-color: #f0f7ff;
}
.list-item.active {
  background-color: #e6f7ff;
  border-right: 2px solid #1890ff;
}
.item-content {
  flex: 1;
}
.item-name {
  font-weight: 500;
  color: #333;
}
.item-desc {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}
.item-actions {
  display: flex;
  gap: 5px;
}
.category-main {
  padding: 0;
  display: flex;
  flex-direction: column;
}
.mt-20 {
  margin-top: 20px;
}
.ml-5 {
  margin-left: 5px;
}
.ml-10 {
  margin-left: 10px;
}
.name-cell {
  display: flex;
  align-items: center;
}
.text-gray {
  color: #999;
  font-size: 12px;
}
</style>
