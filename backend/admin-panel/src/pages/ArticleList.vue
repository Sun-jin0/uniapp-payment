<template>
  <div class="article-list">
    <div class="header-actions">
      <div class="left">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索文章标题..."
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
        <el-select v-model="selectedCategory" placeholder="选择分类" @change="handleSearch" class="category-select">
          <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
        </el-select>
        <el-checkbox v-model="showDrafts" @change="handleSearch" border>仅看草稿</el-checkbox>
      </div>
      <el-button type="primary" @click="goToAdd">
        <el-icon><Plus /></el-icon> 发布文章
      </el-button>
    </div>

    <el-table :data="articles" v-loading="loading" style="width: 100%" border stripe>
      <el-table-column label="封面" width="120" align="center">
        <template #default="{ row }">
          <el-image 
            v-if="row.imageUrl" 
            :src="row.imageUrl" 
            fit="cover" 
            class="article-cover"
            :preview-src-list="[row.imageUrl]"
            preview-teleported
          />
          <span v-else>无</span>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="200">
        <template #default="{ row }">
          <div class="title-cell">
            <el-tag v-if="row.linkUrl" size="small" type="success" class="mr-5">微信</el-tag>
            <span>{{ row.title }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="category" label="分类" width="120" align="center" />
      <el-table-column prop="author" label="作者" width="120" align="center">
        <template #default="{ row }">
          {{ row.author || '管理员' }}
        </template>
      </el-table-column>
      <el-table-column prop="viewCount" label="阅读量" width="100" align="center" sortable />
      <el-table-column prop="isActive" label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.isActive === 1 ? 'success' : 'info'">
            {{ row.isActive === 1 ? '已发布' : '草稿' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="置顶" width="100" align="center">
        <template #default="{ row }">
          <el-switch 
            v-model="row.isTop" 
            :active-value="1" 
            :inactive-value="0"
            @change="handleTopChange(row)"
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
            style="width: 80px;"
            @change="handleSortChange(row)"
          />
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180" align="center">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" align="center" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="goToEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="deleteArticle(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-container">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { adminApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const articles = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const searchKeyword = ref('')
const selectedCategory = ref('全部')
const showDrafts = ref(false)
const categories = ['全部', '资料', '备考经验', '政策动态', '考试技巧', '系统通知']

const loadArticles = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      size: pageSize.value,
      keyword: searchKeyword.value,
      status: showDrafts.value ? 0 : 1,
      noticeType: 'article'
    }
    if (selectedCategory.value !== '全部') {
      params.category = selectedCategory.value
    }

    const res = await adminApi.getNotices(params)
    if (res.code === 0) {
      if (res.data && res.data.list) {
        articles.value = res.data.list
        total.value = res.data.total || 0
      } else if (Array.isArray(res.data)) {
        articles.value = res.data
        total.value = res.data.length
      }
    }
  } catch (error) {
    console.error('加载文章列表失败:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  loadArticles()
}

const handleSizeChange = (val) => {
  pageSize.value = val
  loadArticles()
}

const handleCurrentChange = (val) => {
  currentPage.value = val
  loadArticles()
}

const goToAdd = () => {
  router.push('/article/edit')
}

const goToEdit = (item) => {
  router.push(`/article/edit?id=${item._id}`)
}

const deleteArticle = async (item) => {
  try {
    await ElMessageBox.confirm('确定要删除这篇文章吗？', '提示', {
      type: 'warning'
    })
    const res = await adminApi.deleteNotice(item._id)
    if (res.code === 0) {
      ElMessage.success('删除成功')
      loadArticles()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

// 处理置顶状态变化
const handleTopChange = async (row) => {
  try {
    const res = await adminApi.updateNotice(row._id, { isTop: row.isTop })
    if (res.code === 0) {
      ElMessage.success(row.isTop ? '置顶成功' : '取消置顶成功')
      loadArticles()
    }
  } catch (error) {
    ElMessage.error('操作失败')
    row.isTop = row.isTop ? 0 : 1 // 恢复原状态
  }
}

// 处理排序值变化
const handleSortChange = async (row) => {
  try {
    const res = await adminApi.updateNotice(row._id, { sortOrder: row.sortOrder })
    if (res.code === 0) {
      ElMessage.success('排序更新成功')
      loadArticles()
    }
  } catch (error) {
    ElMessage.error('排序更新失败')
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString()
}

onMounted(() => {
  loadArticles()
})
</script>

<style scoped>
.article-list {
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
}
.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.left {
  display: flex;
  gap: 15px;
  align-items: center;
}
.search-input {
  width: 250px;
}
.category-select {
  width: 150px;
}
.article-cover {
  width: 80px;
  height: 45px;
  border-radius: 4px;
}
.title-cell {
  display: flex;
  align-items: center;
}
.mr-5 {
  margin-right: 5px;
}
.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
