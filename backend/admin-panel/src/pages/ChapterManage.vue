<template>
  <div class="chapter-manage">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>章节管理</span>
          <div class="header-actions">
            <el-select v-model="filterSubjectId" placeholder="筛选科目" clearable @change="loadChapters" style="margin-right: 10px">
              <el-option
                v-for="sub in subjects"
                :key="sub.id"
                :label="sub.name"
                :value="sub.id"
              />
            </el-select>
            <el-button type="primary" @click="openModal()">添加章节</el-button>
          </div>
        </div>
      </template>

      <el-table :data="chapters" v-loading="loading" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="章节名称" />
        <el-table-column prop="subject_name" label="所属科目" />
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="操作" width="150">
          <template #default="scope">
            <el-button link type="primary" @click="openModal(scope.row)">编辑</el-button>
            <el-button link type="danger" @click="confirmDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="showModal"
      :title="editingItem.id ? '编辑章节' : '添加章节'"
      width="500px"
    >
      <el-form :model="editingItem" label-width="100px">
        <el-form-item label="所属科目" required>
          <el-select v-model="editingItem.subject_id" placeholder="请选择科目">
            <el-option
              v-for="sub in subjects"
              :key="sub.id"
              :label="sub.name"
              :value="sub.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="章节名称" required>
          <el-input v-model="editingItem.name" placeholder="如：第一章 绪论" />
        </el-form-item>
        <el-form-item label="排序值">
          <el-input-number v-model="editingItem.sort" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showModal = false">取消</el-button>
          <el-button type="primary" @click="saveItem">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminApi as api } from '../api'

const chapters = ref([])
const subjects = ref([])
const filterSubjectId = ref(null)
const loading = ref(false)
const showModal = ref(false)
const editingItem = ref({
  id: null,
  name: '',
  subject_id: null,
  sort: 0
})

const loadSubjects = async () => {
  try {
    const res = await api.getAdminSubjects()
    subjects.value = res.data || []
  } catch (error) {
    console.error('加载科目失败:', error)
  }
}

const loadChapters = async () => {
  loading.value = true
  try {
    const params = {}
    if (filterSubjectId.value) {
      params.subject_id = filterSubjectId.value
    }
    const res = await api.getChapters(params)
    chapters.value = res.data || []
  } catch (error) {
    console.error('加载章节失败:', error)
    ElMessage.error('加载章节失败')
  } finally {
    loading.value = false
  }
}

const openModal = (row = null) => {
  if (row) {
    editingItem.value = { ...row }
  } else {
    editingItem.value = {
      id: null,
      name: '',
      subject_id: filterSubjectId.value,
      sort: 0
    }
  }
  showModal.value = true
}

const saveItem = async () => {
  if (!editingItem.value.subject_id || !editingItem.value.name) {
    ElMessage.warning('请填写完整信息')
    return
  }

  try {
    if (editingItem.value.id) {
      await api.updateChapter(editingItem.value.id, editingItem.value)
      ElMessage.success('更新成功')
    } else {
      await api.createChapter(editingItem.value)
      ElMessage.success('创建成功')
    }
    showModal.value = false
    loadChapters()
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

const confirmDelete = (row) => {
  ElMessageBox.confirm('确定要删除该章节吗？', '提示', {
    type: 'warning'
  }).then(async () => {
    try {
      await api.deleteChapter(row.id)
      ElMessage.success('删除成功')
      loadChapters()
    } catch (error) {
      ElMessage.error('删除失败')
    }
  })
}

onMounted(() => {
  loadSubjects()
  loadChapters()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-actions {
  display: flex;
  align-items: center;
}
</style>
