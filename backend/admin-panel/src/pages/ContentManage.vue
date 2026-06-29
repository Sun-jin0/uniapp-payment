<template>
  <div class="content-manage">
    <el-card class="manage-card">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <el-icon><Document /></el-icon>
            <span>内容管理</span>
          </div>
          <div class="header-actions">
            <el-button 
              v-if="activeTab === 'notice'" 
              type="primary" 
              @click="handleAdd('notice')"
            >
              <el-icon><Plus /></el-icon>添加公告/广告
            </el-button>
            <el-button 
              v-if="activeTab === 'article'" 
              type="primary" 
              @click="handleAdd('article')"
            >
              <el-icon><Plus /></el-icon>发布新文章
            </el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab" class="content-tabs" @tab-change="handleTabChange">
        <el-tab-pane label="公告与广告" name="notice">
          <div class="tab-content">
            <el-table 
              v-loading="loading" 
              :data="notices" 
              style="width: 100%"
              border
              stripe
            >
              <el-table-column prop="id" label="ID" width="80" align="center" />
              <el-table-column label="标题" min-width="200">
                <template #default="{ row }">
                  <div class="title-cell">
                    <el-tag 
                      v-if="row.type === 'ad'" 
                      size="small" 
                      type="warning" 
                      effect="dark"
                      class="type-tag"
                    >广告</el-tag>
                    <el-tag 
                      v-else 
                      size="small" 
                      type="info" 
                      effect="dark"
                      class="type-tag"
                    >{{ row.noticeType === 'link' ? '链接' : '文章' }}</el-tag>
                    <span class="title-text">{{ row.title }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="category" label="分类" width="120" align="center" />
              <el-table-column label="创建时间" width="180" align="center">
                <template #default="{ row }">
                  {{ formatDate(row.createTime || row.createdAt) }}
                </template>
              </el-table-column>
              <el-table-column label="状态" width="100" align="center">
                <template #default="{ row }">
                  <el-switch
                    :model-value="row.isActive"
                    :active-value="true"
                    :inactive-value="false"
                    @change="(val) => handleToggleStatus(row, val)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="180" align="center" fixed="right">
                <template #default="{ row }">
                  <el-button-group>
                    <el-button 
                      type="primary" 
                      size="small" 
                      @click="handleEdit(row)"
                    >编辑</el-button>
                    <el-button 
                      type="danger" 
                      size="small" 
                      @click="handleDelete(row)"
                    >删除</el-button>
                  </el-button-group>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane label="文章管理" name="article">
          <div class="tab-content">
            <div class="filter-bar">
              <el-input
                v-model="searchKeyword"
                placeholder="搜索文章标题..."
                class="search-input"
                clearable
                @clear="handleSearch"
                @keyup.enter="handleSearch"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
              <el-select 
                v-model="selectedCategory" 
                placeholder="全部分类" 
                class="category-select"
                clearable
                @change="handleSearch"
              >
                <el-option 
                  v-for="cat in categories" 
                  :key="cat" 
                  :label="cat" 
                  :value="cat" 
                />
              </el-select>
              <el-checkbox 
                v-model="showDrafts" 
                label="仅看草稿" 
                border 
                class="draft-checkbox"
                @change="handleSearch"
              />
            </div>

            <el-table 
              v-loading="loading" 
              :data="articles" 
              style="width: 100%"
              border
              stripe
            >
              <el-table-column label="封面" width="100" align="center">
                <template #default="{ row }">
                  <el-image 
                    :src="row.imageUrl" 
                    class="article-cover"
                    fit="cover"
                    :preview-src-list="[row.imageUrl]"
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
              <el-table-column label="标题" min-width="200">
                <template #default="{ row }">
                  <div class="title-cell">
                    <el-tag 
                      v-if="row.noticeType === 'wechat'" 
                      size="small" 
                      type="success" 
                      class="type-tag"
                    >微信</el-tag>
                    <el-tag 
                      v-else-if="row.noticeType === 'link'" 
                      size="small" 
                      type="primary" 
                      class="type-tag"
                    >链接</el-tag>
                    <el-tag 
                      v-else-if="row.noticeType === 'pan_resource'" 
                      size="small" 
                      type="warning" 
                      class="type-tag"
                    >网盘</el-tag>
                    <span class="title-text">{{ row.title }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="category" label="分类" width="120" align="center" />
              <el-table-column prop="author" label="作者" width="120" align="center" />
              <el-table-column label="浏览量" width="100" align="center">
                <template #default="{ row }">
                  <el-icon><View /></el-icon>
                  <span style="margin-left: 4px">{{ row.viewCount || 0 }}</span>
                </template>
              </el-table-column>
              <el-table-column label="置顶" width="100" align="center">
                <template #default="{ row }">
                  <el-switch
                    v-model="row.isTop"
                    :active-value="1"
                    :inactive-value="0"
                    @change="(val) => handleTopChange(row, val)"
                    :loading="row._updatingTop"
                  />
                </template>
              </el-table-column>
              <el-table-column label="排序" width="120" align="center">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.sortOrder"
                    :min="0"
                    :max="999"
                    size="small"
                    style="width: 80px"
                    @change="(val) => handleSortChange(row, val)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="状态" width="100" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.isActive ? 'success' : 'info'">
                    {{ row.isActive ? '已发布' : '草稿' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="180" align="center" fixed="right">
                <template #default="{ row }">
                  <el-button-group>
                    <el-button 
                      type="primary" 
                      size="small" 
                      @click="handleEdit(row)"
                    >编辑</el-button>
                    <el-button 
                      type="danger" 
                      size="small" 
                      @click="handleDelete(row)"
                    >删除</el-button>
                  </el-button-group>
                </template>
              </el-table-column>
            </el-table>

            <div class="pagination-container">
              <el-pagination
                v-model:current-page="page"
                v-model:page-size="pageSize"
                :total="total"
                :page-sizes="[10, 20, 50, 100]"
                layout="total, sizes, prev, pager, next, jumper"
                @size-change="handleSizeChange"
                @current-change="handlePageChange"
              />
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, getCurrentInstance } from 'vue'
import { useRouter } from 'vue-router'
import { adminApi } from '../api'
import { 
  Document, 
  Plus, 
  Search, 
  View, 
  Picture 
} from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'

const router = useRouter()

// 状态
const activeTab = ref('notice')
const loading = ref(false)
const notices = ref([])
const articles = ref([])

// 文章分页与搜索
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const searchKeyword = ref('')
const selectedCategory = ref('')
const showDrafts = ref(false)
const categories = ['全部资料', '考研资料', '计算机资料', '医学资料', '其他', '备考经验', '政策动态', '考试技巧', '系统通知']

onMounted(() => {
  loadData()
})

const loadData = () => {
  if (activeTab.value === 'notice') {
    fetchNotices()
  } else {
    fetchArticles()
  }
}

const handleTabChange = () => {
  loadData()
}

// 获取公告/广告
const fetchNotices = async () => {
  loading.value = true
  try {
    const res = await adminApi.getNotices({ type: 'notice_ad' })
    if (res.code === 0) {
      const list = res.data.list || res.data || []
      // 确保 isActive 是布尔值
      notices.value = list.map(item => ({
        ...item,
        isActive: item.isActive === 1 || item.isActive === true
      }))
    }
  } catch (error) {
    console.error('Fetch notices error:', error)
  } finally {
    loading.value = false
  }
}

// 获取文章
const fetchArticles = async () => {
  loading.value = true
  try {
    const params = {
      page: page.value,
      size: pageSize.value,
      keyword: searchKeyword.value,
      status: showDrafts.value ? 0 : 1
      // 不再限制 noticeType，显示所有类型的文章（包括网盘资源）
    }
    if (selectedCategory.value && selectedCategory.value !== '全部资料') {
      params.category = selectedCategory.value
    }
    
    const res = await adminApi.getNotices(params)
    if (res.code === 0) {
      const list = res.data.list || res.data || []
      // 确保字段类型正确
      articles.value = list.map(item => ({
        ...item,
        isActive: item.isActive === 1 || item.isActive === true,
        isTop: item.isTop === 1 || item.isTop === true ? 1 : 0,
        sortOrder: item.sortOrder || 0
      }))
      total.value = res.data.total || articles.value.length
    }
  } catch (error) {
    console.error('Fetch articles error:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  page.value = 1
  fetchArticles()
}

const handlePageChange = (val) => {
  page.value = val
  fetchArticles()
}

const handleSizeChange = (val) => {
  pageSize.value = val
  page.value = 1
  fetchArticles()
}

const handleAdd = (type) => {
  router.push({
    name: 'ArticleEdit',
    query: { type }
  })
}

const handleEdit = (row) => {
  router.push({
    name: 'ArticleEdit',
    query: { 
      id: row._id || row.id,
      type: row.type || (activeTab.value === 'article' ? 'article' : 'notice')
    }
  })
}

const handleDelete = (row) => {
  const title = row.title || '该内容'
  ElMessageBox.confirm(
    `确定要删除 "${title}" 吗？`,
    '警告',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(async () => {
    try {
      const res = await adminApi.deleteNotice(row._id || row.id)
      if (res.code === 0) {
        ElMessage.success('删除成功')
        loadData()
      }
    } catch (error) {
      console.error('Delete error:', error)
    }
  }).catch(() => {})
}

const handleToggleStatus = async (row, val) => {
  try {
    const res = await adminApi.updateNoticeStatus(row._id || row.id, val)
    if (res.code === 0) {
      ElMessage.success(`${val ? '启用' : '禁用'}成功`)
      // API 调用成功，手动更新 row.isActive
      row.isActive = val
    } else {
      // API 返回错误
      ElMessage.error(res.message || '操作失败')
    }
  } catch (error) {
    console.error('Toggle status error:', error)
    ElMessage.error('网络错误，请重试')
  }
}

// 处理置顶状态变化
const handleTopChange = async (row, val) => {
  row._updatingTop = true
  console.log('handleTopChange called, row:', row._id || row.id, 'val:', val)
  try {
    // 确保发送正确的值（0 或 1）
    const isTopValue = val === 1 || val === true ? 1 : 0
    console.log('Sending update isTop:', isTopValue)
    const res = await adminApi.updateNotice(row._id || row.id, { isTop: isTopValue })
    console.log('Update response:', res)
    if (res.code === 0) {
      ElMessage.success(isTopValue ? '置顶成功' : '取消置顶成功')
      // 使用服务器返回的数据更新本地状态
      if (res.data && res.data.notice) {
        row.isTop = res.data.notice.isTop === 1 || res.data.notice.isTop === true ? 1 : 0
        row.sortOrder = res.data.notice.sortOrder || 0
      } else {
        row.isTop = isTopValue
      }
    } else {
      ElMessage.error(res.message || '操作失败')
      // 恢复原状态
      row.isTop = isTopValue ? 0 : 1
    }
  } catch (error) {
    console.error('Toggle top error:', error)
    ElMessage.error('网络错误，请重试')
    // 恢复原状态
    row.isTop = val === 1 ? 0 : 1
  } finally {
    row._updatingTop = false
  }
}

// 处理排序值变化
const handleSortChange = async (row, val) => {
  console.log('handleSortChange called, row:', row._id || row.id, 'val:', val)
  try {
    const res = await adminApi.updateNotice(row._id || row.id, { sortOrder: val })
    if (res.code === 0) {
      ElMessage.success('排序更新成功')
      // 更新本地状态
      row.sortOrder = val
    } else {
      ElMessage.error(res.message || '排序更新失败')
    }
  } catch (error) {
    console.error('Sort change error:', error)
    ElMessage.error('网络错误，请重试')
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString()
}
</script>

<style scoped>
.content-manage {
  padding: 20px;
}

.manage-card {
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: bold;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.tab-content {
  padding: 10px 0;
}

.filter-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  align-items: center;
}

.search-input {
  width: 260px;
}

.category-select {
  width: 160px;
}

.draft-checkbox {
  margin-left: 8px;
}

.title-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.type-tag {
  flex-shrink: 0;
}

.title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-cover {
  width: 60px;
  height: 45px;
  border-radius: 4px;
}

.image-error {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background: #f5f7fa;
  color: #909399;
  font-size: 20px;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.content-tabs :deep(.el-tabs__header) {
  margin-bottom: 20px;
}

:deep(.el-button-group .el-button) {
  margin: 0 4px;
}
</style>
