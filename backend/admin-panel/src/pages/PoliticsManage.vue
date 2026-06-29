<template>
  <div class="politics-manage">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>考研政治板块管理</span>
          <el-button type="primary" @click="openSectionModal()">添加板块</el-button>
        </div>
      </template>

      <el-skeleton :loading="loading" animated>
        <template #template>
          <div style="padding: 20px">
            <el-skeleton-item variant="p" style="width: 50%" />
            <el-skeleton-item variant="text" style="margin-top: 10px" />
            <el-skeleton-item variant="text" />
          </div>
        </template>
        <template #default>
          <div v-if="sections.length === 0" class="empty-state">
            <el-empty description="暂无自定义板块，请点击上方“添加板块”开始" />
          </div>
          
          <div v-for="section in sections" :key="section.id" class="section-item mb-20">
            <el-card shadow="hover">
              <template #header>
                <div class="section-header">
                  <div class="section-info">
                    <span class="section-title">{{ section.name }}</span>
                    <el-tag size="small" type="info" class="ml-10">显示 {{ section.display_rows }} 行</el-tag>
                    <el-tag size="small" type="warning" class="ml-10">排序: {{ section.sort }}</el-tag>
                  </div>
                  <div class="section-actions">
                    <el-button size="small" @click="editSection(section)">编辑板块</el-button>
                    <el-button size="small" type="primary" @click="showBookSelector(section)">分配书籍/试卷</el-button>
                    <el-button size="small" type="danger" @click="confirmDeleteSection(section)">删除</el-button>
                  </div>
                </div>
              </template>

              <div class="books-grid">
                <el-tag
                  v-for="book in sectionBooks[section.id]"
                  :key="book.id"
                  class="book-tag"
                  closable
                  @close="removeBookFromSection(section, book)"
                >
                  {{ book.title || book.name || '未命名书籍' }}
                </el-tag>
                <div v-if="!sectionBooks[section.id] || sectionBooks[section.id].length === 0" class="empty-hint">
                  该板块下暂无内容，请点击“分配书籍/试卷”添加
                </div>
              </div>
            </el-card>
          </div>
        </template>
      </el-skeleton>
    </el-card>

    <!-- 板块编辑对话框 -->
    <el-dialog
      v-model="sectionDialogVisible"
      :title="editingSection.id ? '编辑板块' : '添加板块'"
      width="500px"
    >
      <el-form :model="editingSection" label-width="100px">
        <el-form-item label="板块名称" required>
          <el-input v-model="editingSection.name" placeholder="如：重中之重" />
        </el-form-item>
        <el-form-item label="显示行数">
          <el-input-number v-model="editingSection.display_rows" :min="1" :max="10" />
        </el-form-item>
        <el-form-item label="排序值">
          <el-input-number v-model="editingSection.sort" />
          <div class="form-tip">值越小越靠前</div>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="editingSection.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="sectionDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveSection">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 书籍选择对话框 -->
    <el-dialog
      v-model="bookDialogVisible"
      title="分配内容"
      width="800px"
      top="5vh"
    >
      <div v-if="currentSection" class="mb-20">
        正在为板块 <strong>{{ currentSection.name }}</strong> 分配内容
      </div>
      
      <el-input
        v-model="searchQuery"
        placeholder="搜索书籍名称..."
        class="mb-20"
        clearable
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <div class="book-selector-container">
        <el-skeleton :loading="loadingBooks" animated>
          <div v-if="filteredOrganizedBooks.length === 0" class="empty-tip">暂无可选书籍</div>
          
          <el-collapse v-model="activeCategories">
            <el-collapse-item 
              v-for="c1 in filteredOrganizedBooks" 
              :key="c1.id" 
              :title="c1.name" 
              :name="c1.id"
            >
              <div v-for="c2 in c1.children" :key="c2.id" class="category-level-2">
                <div class="category-header-mini">{{ c2.name }}</div>
                
                <div class="books-list">
                  <div 
                    v-for="book in c2.books" 
                    :key="book.id" 
                    class="book-selection-item"
                    :class="{ selected: isBookInSection(book.id) }"
                    @click="toggleBookSelection(book)"
                  >
                    <el-checkbox :model-value="isBookInSection(book.id)" @click.stop />
                    <span class="book-name">{{ book.displayName }}</span>
                  </div>
                </div>

                <div v-for="c3 in c2.children" :key="c3.id" class="category-level-3">
                  <div class="category-header-mini">{{ c3.name }}</div>
                  <div class="books-list">
                    <div 
                      v-for="book in c3.books" 
                      :key="book.id" 
                      class="book-selection-item"
                      :class="{ selected: isBookInSection(book.id) }"
                      @click="toggleBookSelection(book)"
                    >
                      <el-checkbox :model-value="isBookInSection(book.id)" @click.stop />
                      <span class="book-name">{{ book.displayName }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </el-skeleton>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="bookDialogVisible = false">完成</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import { adminApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'

const loading = ref(false)
const loadingBooks = ref(false)
const sections = ref([])
const sectionBooks = ref({})
const availableBooks = ref([])
const categories = ref([])
const organizedBooks = ref([])
const searchQuery = ref('')
const activeCategories = ref([])

const sectionDialogVisible = ref(false)
const bookDialogVisible = ref(false)
const currentSection = ref(null)

const editingSection = reactive({
  id: null,
  name: '',
  display_rows: 1,
  sort: 0,
  status: 1
})

const fetchSections = async () => {
  loading.value = true
  try {
    const res = await adminApi.getPoliticsSections()
    sections.value = res.data || []
    for (const section of sections.value) {
      fetchBooksForSection(section.id)
    }
  } catch (error) {
    console.error('获取板块失败:', error)
  } finally {
    loading.value = false
  }
}

const fetchBooksForSection = async (sectionId) => {
  try {
    const res = await adminApi.getPoliticsSectionBooks(sectionId)
    sectionBooks.value[sectionId] = res.data || []
  } catch (error) {
    console.error(`获取板块 ${sectionId} 的书籍失败:`, error)
  }
}

const fetchAllData = async () => {
  loadingBooks.value = true
  try {
    // 获取公共课分类 (用于政治)
    const catRes = await adminApi.getPublicCategories({ subject: 'politics' })
    categories.value = catRes.data || []

    // 获取所有公共课书籍 (用于政治)
    const bookRes = await adminApi.getBooks({ subject: 'politics' })
    availableBooks.value = (bookRes.data || []).map(book => ({
      ...book,
      displayName: book.title || book.name || '未命名书籍'
    }))

    organizeBooks()
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loadingBooks.value = false
  }
}

const organizeBooks = () => {
  const level1 = categories.value.filter(c => c.level === 1)
  const level2 = categories.value.filter(c => c.level === 2)
  const level3 = categories.value.filter(c => c.level === 3)

  const result = level1.map(c1 => {
    const c2s = level2.filter(c => c.parentId === c1.id)
    return {
      ...c1,
      children: c2s.map(c2 => {
        const c3s = level3.filter(c => c.parentId === c2.id)
        const booksInC2 = availableBooks.value.filter(b => b.second_category_id === c2.id && !b.third_category_id)
        return {
          ...c2,
          books: booksInC2,
          children: c3s.map(c3 => {
            const booksInC3 = availableBooks.value.filter(b => b.third_category_id === c3.id)
            return {
              ...c3,
              books: booksInC3
            }
          }).filter(c3 => c3.books.length > 0)
        }
      }).filter(c2 => c2.books.length > 0 || c2.children.length > 0)
    }
  }).filter(c1 => c1.children.length > 0)

  organizedBooks.value = result
}

const filteredOrganizedBooks = computed(() => {
  if (!searchQuery.value) return organizedBooks.value

  const query = searchQuery.value.toLowerCase()
  return organizedBooks.value.map(c1 => {
    const filteredC2s = c1.children.map(c2 => {
      const filteredC3s = c2.children.map(c3 => {
        const filteredBooks = c3.books.filter(b => b.displayName.toLowerCase().includes(query))
        return { ...c3, books: filteredBooks }
      }).filter(c3 => c3.books.length > 0)

      const filteredBooks = c2.books.filter(b => b.displayName.toLowerCase().includes(query))
      return { ...c2, children: filteredC3s, books: filteredBooks }
    }).filter(c2 => c2.books.length > 0 || c2.children.length > 0)

    return { ...c1, children: filteredC2s }
  }).filter(c1 => c1.children.length > 0)
})

const openSectionModal = (section = null) => {
  if (section) {
    Object.assign(editingSection, section)
  } else {
    Object.assign(editingSection, {
      id: null,
      name: '',
      display_rows: 1,
      sort: 0,
      status: 1
    })
  }
  sectionDialogVisible.value = true
}

const editSection = (section) => {
  openSectionModal(section)
}

const saveSection = async () => {
  if (!editingSection.name) {
    ElMessage.warning('请输入板块名称')
    return
  }
  try {
    if (editingSection.id) {
      await adminApi.updatePoliticsSection(editingSection.id, editingSection)
      ElMessage.success('更新成功')
    } else {
      await adminApi.createPoliticsSection(editingSection)
      ElMessage.success('创建成功')
    }
    sectionDialogVisible.value = false
    fetchSections()
  } catch (error) {
    console.error('保存板块失败:', error)
  }
}

const confirmDeleteSection = (section) => {
  ElMessageBox.confirm(`确定要删除板块 "${section.name}" 吗？`, '提示', {
    type: 'warning'
  }).then(async () => {
    try {
      await adminApi.deletePoliticsSection(section.id)
      ElMessage.success('删除成功')
      fetchSections()
    } catch (error) {
      console.error('删除板块失败:', error)
    }
  })
}

const showBookSelector = (section) => {
  currentSection.value = section
  bookDialogVisible.value = true
}

const isBookInSection = (bookId) => {
  if (!currentSection.value || !sectionBooks.value[currentSection.value.id]) return false
  return sectionBooks.value[currentSection.value.id].some(b => b.id === bookId)
}

const toggleBookSelection = async (book) => {
  if (!currentSection.value) return
  
  const sectionId = currentSection.value.id
  const bookId = book.id
  
  try {
    if (isBookInSection(bookId)) {
      await adminApi.removePoliticsBookFromSection(sectionId, bookId)
      ElMessage.success('已移除')
    } else {
      await adminApi.addPoliticsBookToSection(sectionId, { bookId })
      ElMessage.success('已添加')
    }
    fetchBooksForSection(sectionId)
  } catch (error) {
    console.error('操作失败:', error)
  }
}

const removeBookFromSection = (section, book) => {
  ElMessageBox.confirm(`确定从板块 "${section.name}" 中移除 "${book.title || book.name}" 吗？`, '提示', {
    type: 'warning'
  }).then(async () => {
    try {
      await adminApi.removePoliticsBookFromSection(section.id, book.id)
      ElMessage.success('移除成功')
      fetchBooksForSection(section.id)
    } catch (error) {
      console.error('移除书籍失败:', error)
    }
  })
}

onMounted(() => {
  fetchSections()
  fetchAllData()
})
</script>

<style scoped>
.politics-manage {
  padding: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.section-title {
  font-weight: bold;
  font-size: 16px;
}
.books-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.book-tag {
  margin-bottom: 5px;
}
.empty-hint {
  color: #909399;
  font-size: 14px;
  padding: 10px 0;
}
.mb-20 {
  margin-bottom: 20px;
}
.ml-10 {
  margin-left: 10px;
}
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}
.book-selector-container {
  max-height: 500px;
  overflow-y: auto;
}
.category-level-2 {
  margin-bottom: 15px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
}
.category-header-mini {
  font-weight: bold;
  margin-bottom: 10px;
  color: #606266;
  border-left: 3px solid #409eff;
  padding-left: 8px;
}
.books-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.book-selection-item {
  display: flex;
  align-items: center;
  padding: 5px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  background: #fff;
}
.book-selection-item:hover {
  border-color: #409eff;
  color: #409eff;
}
.book-selection-item.selected {
  border-color: #409eff;
  background-color: #ecf5ff;
  color: #409eff;
}
.book-name {
  margin-left: 8px;
  font-size: 13px;
}
.category-level-3 {
  margin-top: 10px;
  margin-left: 20px;
}
</style>
