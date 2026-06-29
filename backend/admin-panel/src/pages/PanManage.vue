<template>
  <div class="pan-manage">
    <div class="header-actions">
      <div class="left">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索资源标题..."
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
        <el-select v-model="selectedCategory" placeholder="全部分类" @change="handleSearch" clearable class="category-select">
          <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
        </el-select>
        <el-button type="primary" @click="openAddModal">
          <el-icon><Plus /></el-icon> 添加资源
        </el-button>
        <el-button type="info" @click="showCategoryManage = true">
          <el-icon><Folder /></el-icon> 分类管理
        </el-button>
        <el-button type="warning" @click="showTemplateEdit = true">
          <el-icon><Document /></el-icon> 模板设置
        </el-button>
        <el-button type="success" @click="showBatchImport = true">
          <el-icon><Upload /></el-icon> 批量导入
        </el-button>
      </div>
      <div class="right">
        <el-button type="warning" @click="handleBatchRefreshContent" :loading="refreshLoading">
          <el-icon><Refresh /></el-icon> 批量刷新内容
        </el-button>
        <el-dropdown v-if="selectedIds.length > 0" split-button type="danger" @click="handleBatchDelete">
          批量删除 ({{ selectedIds.length }})
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="handleBatchStatusChange(1)">批量启用</el-dropdown-item>
              <el-dropdown-item @click="handleBatchStatusChange(0)">批量禁用</el-dropdown-item>
              <el-dropdown-item divided @click="showBatchCategoryDialog = true">批量修改分类</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <el-table 
      :data="resources" 
      v-loading="loading" 
      border 
      stripe 
      style="width: 100%"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="55" />
      <el-table-column label="置顶" width="80" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.isTop" :active-value="1" :inactive-value="0" @change="(val) => handleTopChange(row, val)" />
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.isActive" :active-value="1" :inactive-value="0" @change="(val) => handleStatusChange(row, val)" />
        </template>
      </el-table-column>
      <el-table-column label="资源标题" min-width="200">
        <template #default="{ row }">
          <div class="title-cell">
            <el-tag v-if="row.isTop" size="small" type="danger" effect="dark" class="mr-5">置顶</el-tag>
            <span class="title-text">{{ row.title }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="category" label="分类" width="120" align="center" />
      <el-table-column label="网盘链接" min-width="250">
        <template #default="{ row }">
          <div v-if="extractPanLinks(row.content).quark" class="link-item">
            <el-tag size="small" class="link-tag quark">夸克</el-tag>
            <el-link :href="extractPanLinks(row.content).quark" target="_blank" type="primary" :underline="false" class="link-text">
              {{ extractPanLinks(row.content).quark }}
            </el-link>
          </div>
          <div v-if="extractPanLinks(row.content).baidu" class="link-item">
            <el-tag size="small" type="warning" class="link-tag baidu">百度</el-tag>
            <el-link :href="extractPanLinks(row.content).baidu" target="_blank" type="primary" :underline="false" class="link-text">
              {{ extractPanLinks(row.content).baidu }}
            </el-link>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="发布时间" width="180" align="center">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" align="center" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openEditModal(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-container">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </div>

    <!-- 添加/编辑资源弹窗 -->
    <el-dialog
      v-model="editDialogVisible"
      :title="isEditing ? '编辑资源' : '添加资源'"
      width="700px"
    >
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="资源标题" required>
          <el-input v-model="editForm.title" placeholder="请输入资源标题" />
        </el-form-item>
        <el-form-item label="分类" required>
          <el-select v-model="editForm.category" placeholder="请选择分类" style="width: 100%">
            <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
          </el-select>
        </el-form-item>
        <el-form-item label="夸克链接">
          <el-input v-model="editForm.quarkUrl" placeholder="https://pan.quark.cn/s/xxxx" />
        </el-form-item>
        <el-form-item label="百度链接">
          <el-input v-model="editForm.baiduUrl" placeholder="https://pan.baidu.com/s/xxxx" />
        </el-form-item>
        <el-form-item label="发布状态">
          <el-switch v-model="editForm.isActive" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 分类管理弹窗 -->
    <el-dialog v-model="showCategoryManage" title="分类管理" width="500px">
      <div class="category-manage">
        <div class="category-list-manage">
          <div 
            v-for="(cat, index) in editableCategories" 
            :key="cat.id" 
            class="category-item-manage"
            draggable="true"
            @dragstart="handleDragStart($event, index)"
            @dragover.prevent
            @drop="handleDrop($event, index)"
          >
            <el-icon class="drag-handle" style="cursor: move; margin-right: 8px;"><Rank /></el-icon>
            <el-input 
              v-model="cat.name" 
              size="small" 
              style="flex: 1; margin-right: 10px;"
              placeholder="分类名称"
            />
            <el-button type="danger" size="small" circle @click="removeCategory(index)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
        <div class="add-category">
          <el-input v-model="newCategory" placeholder="输入新分类名称" size="small" @keyup.enter="addCategory">
            <template #append>
              <el-button @click="addCategory">添加</el-button>
            </template>
          </el-input>
        </div>
      </div>
      <template #footer>
        <el-button @click="showCategoryManage = false">取消</el-button>
        <el-button type="primary" @click="saveCategories">保存排序</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入弹窗 -->
    <el-dialog v-model="showBatchImport" title="批量导入网盘资源" width="800px">
      <div class="batch-import">
        <el-alert
          title="批量导入说明"
          type="info"
          :closable="false"
          style="margin-bottom: 20px;"
        >
          <template #default>
            <div>支持两种格式：</div>
            <div>1. 智能识别：直接粘贴「标题」和「链接：URL」格式的文本</div>
            <div>2. 传统格式：资源标题 | 分类 | 夸克链接 | 百度链接</div>
          </template>
        </el-alert>
        <el-form label-width="80px" style="margin-bottom: 15px;">
          <el-form-item label="资源分类">
            <el-select v-model="batchImportCategory" placeholder="请选择分类" style="width: 100%">
              <el-option 
                v-for="cat in categories.filter(c => c !== '全部资料')" 
                :key="cat" 
                :label="cat" 
                :value="cat" 
              />
            </el-select>
          </el-form-item>
        </el-form>
        <el-input
          v-model="batchImportText"
          type="textarea"
          :rows="15"
          placeholder="示例（智能识别）：
「27石磊《雷必雷选择技巧》」
链接：https://pan.quark.cn/s/92d4ca7ee080

「26新东方《基础预热宝典》」
链接：https://pan.quark.cn/s/2ad7a915816a

或传统格式：
27考研英语红宝书 | 考研英语 | https://pan.quark.cn/s/xxxx | https://pan.baidu.com/s/xxxx"
        />
        <div class="import-preview" v-if="parsedImportList.length > 0">
          <h4>预览（共 {{ parsedImportList.length }} 条）</h4>
          <el-table :data="parsedImportList.slice(0, 5)" size="small" border>
            <el-table-column prop="title" label="标题" min-width="150" />
            <el-table-column prop="category" label="分类" width="100" />
            <el-table-column prop="quarkUrl" label="夸克链接" min-width="150" />
            <el-table-column prop="baiduUrl" label="百度链接" min-width="150" />
          </el-table>
          <p v-if="parsedImportList.length > 5" class="more-tip">还有 {{ parsedImportList.length - 5 }} 条...</p>
        </div>
      </div>
      <template #footer>
        <el-button @click="showBatchImport = false">取消</el-button>
        <el-button type="primary" @click="handleBatchImport" :loading="batchImportLoading">
          确认导入 ({{ parsedImportList.length }} 条)
        </el-button>
      </template>
    </el-dialog>

    <!-- 模板编辑弹窗 -->
    <el-dialog v-model="showTemplateEdit" title="编辑网盘文章模板" width="1200px" :fullscreen="false">
      <div class="template-edit-container">
        <el-alert
          title="模板变量说明"
          type="info"
          :closable="false"
          style="margin-bottom: 20px;"
        >
          <template #default>
            <span class="template-var"><code>{{title}}</code> - 资源标题</span>
            <span class="template-var"><code>{{category}}</code> - 资源分类</span>
            <span class="template-var"><code>{{quarkUrl}}</code> - 夸克网盘链接</span>
            <span class="template-var"><code>{{baiduUrl}}</code> - 百度网盘链接</span>
            <span class="template-var"><code>{{description}}</code> - 资源描述</span>
          </template>
        </el-alert>
        <div class="template-edit-layout">
          <div class="template-editor">
            <div class="editor-header">
              <span>模板编辑</span>
              <el-radio-group v-model="editMode" size="small" @change="handleEditModeChange">
                 <el-radio-button label="code">代码</el-radio-button>
                 <el-radio-button label="visual">可视化</el-radio-button>
               </el-radio-group>
            </div>
            <!-- 代码编辑模式 -->
            <el-input
              v-if="editMode === 'code'"
              v-model="articleTemplate"
              type="textarea"
              :rows="25"
              placeholder="请输入HTML模板..."
              class="template-textarea"
            />
            <!-- 可视化模式 - 编辑填充了示例数据的HTML -->
            <div v-else class="visual-editor">
              <RichEditor v-model="visualEditContent" height="520px" />
            </div>
          </div>
          <div class="template-preview">
            <div class="preview-header">实时预览</div>
            <div class="preview-content" v-html="templatePreview"></div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showTemplateEdit = false">取消</el-button>
        <el-button type="primary" @click="saveTemplate">保存模板</el-button>
        <el-button @click="resetTemplate">恢复默认</el-button>
      </template>
    </el-dialog>

    <!-- 批量修改分类弹窗 -->
    <el-dialog v-model="showBatchCategoryDialog" title="批量修改分类" width="400px">
      <div class="batch-category-dialog">
        <p class="batch-category-tip">已选择 {{ selectedIds.length }} 条资源</p>
        <el-form label-width="80px">
          <el-form-item label="新分类">
            <el-select v-model="batchCategoryValue" placeholder="请选择分类" style="width: 100%">
              <el-option v-for="cat in categories.filter(c => c !== '全部资料')" :key="cat" :label="cat" :value="cat" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="showBatchCategoryDialog = false">取消</el-button>
        <el-button type="primary" @click="handleBatchCategoryChange" :loading="batchCategoryLoading">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { adminApi } from '@/api'
import RichEditor from '@/components/RichEditor.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Delete, Folder, Upload, Rank, Document, Refresh } from '@element-plus/icons-vue'

const loading = ref(false)
const saving = ref(false)
const resources = ref([])

// 从数据库获取分类列表
const categories = ref(['全部资料'])
const categoryList = ref([]) // 完整的分类对象列表（包含id）

// 加载分类列表
const fetchCategories = async () => {
  try {
    const res = await adminApi.getPanCategories(true)
    if (res.code === 0 && res.data) {
      // 后端返回完整对象数组（包含CategoryID, CategoryName, SortOrder）
      categoryList.value = res.data.map(c => ({
        id: c.CategoryID || c.id,
        name: c.CategoryName || c.name,
        sortOrder: c.SortOrder || c.sortOrder || 0
      }))
      const categoryNames = categoryList.value.map(c => c.name)
      categories.value = ['全部资料', ...categoryNames]
    }
  } catch (error) {
    console.error('获取分类失败:', error)
  }
}
const selectedCategory = ref('')
const searchKeyword = ref('')
const selectedIds = ref([])

// 分页
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

// 编辑
const editDialogVisible = ref(false)
const isEditing = ref(false)
const editForm = ref({
  id: null,
  title: '',
  category: '全部资料',
  quarkUrl: '',
  baiduUrl: '',
  description: '',
  isActive: 0
})

// 分类管理
const showCategoryManage = ref(false)
const editableCategories = ref([])
const newCategory = ref('')

// 批量导入
const showBatchImport = ref(false)
const batchImportText = ref('')
const batchImportLoading = ref(false)
const batchImportCategory = ref('')

// 批量修改分类
const showBatchCategoryDialog = ref(false)
const batchCategoryValue = ref('')
const batchCategoryLoading = ref(false)
const refreshLoading = ref(false)

// 模板编辑
const showTemplateEdit = ref(false)
const editMode = ref('code') // 'code' 或 'visual'
const defaultTemplate = `<div style="font-size: 14px; line-height: 1.8; color: #333;">
  {{#if description}}
  <p style="margin-bottom: 16px;">{{description}}</p>
  {{/if}}
  <p style="margin-bottom: 16px;"><strong>资源分类：</strong>{{category}}</p>
  <p style="margin-bottom: 16px;"><strong>网盘链接：</strong></p>
  <ul style="margin-bottom: 16px; padding-left: 20px;">
    {{#if quarkUrl}}
    <li style="margin-bottom: 8px;">夸克网盘：<a href="{{quarkUrl}}" target="_blank" style="color: #409eff; text-decoration: none;">{{quarkUrl}}</a></li>
    {{/if}}
    {{#if baiduUrl}}
    <li style="margin-bottom: 8px;">百度网盘：<a href="{{baiduUrl}}" target="_blank" style="color: #409eff; text-decoration: none;">{{baiduUrl}}</a></li>
    {{/if}}
  </ul>
  <div style="background: #f5f7fa; padding: 12px 16px; border-left: 4px solid #409eff; margin-top: 16px; color: #666;">
    <strong>温馨提示：</strong>点击链接即可访问网盘资源，建议及时保存。
  </div>
</div>`
const articleTemplate = ref('')

// 可视化编辑的示例数据
const visualEditData = ref({
  title: '27石磊《雷必雷选择技巧》',
  category: '考研政治',
  quarkUrl: 'https://pan.quark.cn/s/92d4ca7ee080',
  baiduUrl: 'https://pan.baidu.com/s/1xxxxx',
  description: '石磊老师政治选择题技巧讲解'
})

// 可视化编辑内容（填充了示例数据的HTML）
const visualEditContent = ref('')

// 将模板转换为可视化编辑内容（填充示例数据）
const templateToVisualContent = (template) => {
  let content = template
  content = content.replace(/\{\{title\}\}/g, visualEditData.value.title)
  content = content.replace(/\{\{category\}\}/g, visualEditData.value.category)
  content = content.replace(/\{\{quarkUrl\}\}/g, visualEditData.value.quarkUrl)
  content = content.replace(/\{\{baiduUrl\}\}/g, visualEditData.value.baiduUrl)
  content = content.replace(/\{\{description\}\}/g, visualEditData.value.description)
  // 移除条件语句标记
  content = content.replace(/\{\{#if \w+\}\}/g, '')
  content = content.replace(/\{\{\/if\}\}/g, '')
  return content
}

// 将可视化编辑内容转换回模板
const visualContentToTemplate = (content) => {
  let template = content
  // 转义特殊字符用于正则
  const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  
  template = template.replace(new RegExp(escapeRegExp(visualEditData.value.title), 'g'), '{{title}}')
  template = template.replace(new RegExp(escapeRegExp(visualEditData.value.category), 'g'), '{{category}}')
  template = template.replace(new RegExp(escapeRegExp(visualEditData.value.quarkUrl), 'g'), '{{quarkUrl}}')
  template = template.replace(new RegExp(escapeRegExp(visualEditData.value.baiduUrl), 'g'), '{{baiduUrl}}')
  template = template.replace(new RegExp(escapeRegExp(visualEditData.value.description), 'g'), '{{description}}')
  
  return template
}

// 切换到可视化模式时初始化内容
const initVisualEdit = () => {
  visualEditContent.value = templateToVisualContent(articleTemplate.value)
}

// 从可视化编辑保存回模板
const saveFromVisualEdit = () => {
  articleTemplate.value = visualContentToTemplate(visualEditContent.value)
}

// 处理编辑模式切换
const handleEditModeChange = (mode) => {
  if (mode === 'visual') {
    // 切换到可视化模式：将模板转换为填充了示例数据的内容
    visualEditContent.value = templateToVisualContent(articleTemplate.value)
  } else {
    // 切换到代码模式：将可视化编辑的内容转换回模板
    saveFromVisualEdit()
  }
}

// 加载保存的模板
const loadTemplate = () => {
  const saved = localStorage.getItem('panArticleTemplate')
  // 如果保存的模板包含标题，则使用默认模板（去掉标题的新模板）
  if (saved && saved.includes('<h2')) {
    articleTemplate.value = defaultTemplate
    localStorage.setItem('panArticleTemplate', defaultTemplate)
  } else {
    articleTemplate.value = saved || defaultTemplate
  }
}

// 保存模板
const saveTemplate = () => {
  // 如果当前是可视化模式，先转换回模板
  if (editMode.value === 'visual') {
    saveFromVisualEdit()
  }
  localStorage.setItem('panArticleTemplate', articleTemplate.value)
  ElMessage.success('模板保存成功')
  showTemplateEdit.value = false
}

// 恢复默认模板
const resetTemplate = () => {
  articleTemplate.value = defaultTemplate
  localStorage.removeItem('panArticleTemplate')
  ElMessage.success('已恢复默认模板')
}

// 模板预览计算属性 - 使用 visualEditData 作为预览数据
const templatePreview = computed(() => {
  return generateContentFromTemplate(visualEditData.value)
})

// 使用模板生成内容
const generateContentFromTemplate = (form) => {
  let content = articleTemplate.value || defaultTemplate
  content = content.replace(/\{\{title\}\}/g, form.title || '')
  content = content.replace(/\{\{category\}\}/g, form.category || '')
  content = content.replace(/\{\{quarkUrl\}\}/g, form.quarkUrl || '')
  content = content.replace(/\{\{baiduUrl\}\}/g, form.baiduUrl || '')
  content = content.replace(/\{\{description\}\}/g, form.description || '')
  
  // 处理条件语句 {{#if variable}}...{{/if}}
  content = content.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, varName, innerContent) => {
    const value = form[varName]
    return value ? innerContent : ''
  })
  
  return content
}

// 智能解析批量导入数据（支持新格式）
const parsedImportList = computed(() => {
  if (!batchImportText.value.trim()) return []
  
  const text = batchImportText.value.trim()
  const list = []
  
  // 检查是否是新格式（包含链接：）
  if (text.includes('链接：') || text.includes('链接:')) {
    // 新格式解析：链接上方一行就是标题
    const blocks = text.split(/\n\s*\n|\r\n\s*\r\n/)
    
    for (const block of blocks) {
      if (!block.trim()) continue
      
      const lines = block.trim().split('\n').map(l => l.trim()).filter(l => l)
      if (lines.length < 2) continue
      
      // 第一行是标题
      const title = lines[0]
      
      // 查找包含链接的行
      let quarkUrl = ''
      for (const line of lines) {
        // 支持多种格式：链接：URL、`链接：URL`、链接：`URL` 等
        const linkMatch = line.match(/链接[：:]\s*`?(https?:\/\/[^\s`]+)`?/)
        if (linkMatch) {
          quarkUrl = linkMatch[1].trim()
          break
        }
      }
      
      if (title && quarkUrl) {
        list.push({
          title: title,
          category: batchImportCategory.value || '考研资料',
          quarkUrl: quarkUrl,
          baiduUrl: '',
          description: ''
        })
      }
    }
  } else {
    // 传统格式解析（|分隔）
    const lines = text.split('\n')
    for (const line of lines) {
      if (!line.trim()) continue
      
      const parts = line.split('|').map(p => p.trim())
      if (parts.length >= 3) {
        list.push({
          title: parts[0] || '',
          category: parts[1] || '考研资料',
          quarkUrl: parts[2] || '',
          baiduUrl: parts[3] || '',
          description: parts[4] || ''
        })
      }
    }
  }
  
  return list
})

// 打开分类管理时复制当前分类
watch(showCategoryManage, (val) => {
  if (val) {
    // 复制分类列表，排除"全部资料"
    editableCategories.value = categoryList.value.map(c => ({ ...c }))
  }
})

// 添加分类
const addCategory = async () => {
  if (!newCategory.value.trim()) {
    ElMessage.warning('请输入分类名称')
    return
  }
  if (editableCategories.value.some(c => c.name === newCategory.value.trim())) {
    ElMessage.warning('分类已存在')
    return
  }
  
  try {
    const res = await adminApi.createPanCategory({
      name: newCategory.value.trim(),
      sortOrder: editableCategories.value.length
    })
    if (res.code === 0) {
      editableCategories.value.push({
        id: res.data.id,
        name: res.data.name,
        sortOrder: res.data.sortOrder
      })
      newCategory.value = ''
      ElMessage.success('添加成功')
    }
  } catch (error) {
    console.error('添加分类失败:', error)
    ElMessage.error('添加失败')
  }
}

// 删除分类
const removeCategory = async (index) => {
  const category = editableCategories.value[index]
  if (!category) return
  
  try {
    const res = await adminApi.deletePanCategory(category.id)
    if (res.code === 0) {
      editableCategories.value.splice(index, 1)
      ElMessage.success('删除成功')
    }
  } catch (error) {
    console.error('删除分类失败:', error)
    ElMessage.error('删除失败')
  }
}

// 拖拽相关
let dragIndex = null

const handleDragStart = (e, index) => {
  dragIndex = index
  e.dataTransfer.effectAllowed = 'move'
}

const handleDrop = (e, dropIndex) => {
  if (dragIndex === null || dragIndex === dropIndex) return
  
  // 交换位置
  const item = editableCategories.value.splice(dragIndex, 1)[0]
  editableCategories.value.splice(dropIndex, 0, item)
  
  dragIndex = null
}

// 保存分类（更新名称和排序）
const saveCategories = async () => {
  try {
    // 获取原始分类列表用于对比
    const originalCategories = categoryList.value
    
    // 收集需要更新分类名称的资源
    const resourcesToUpdate = []
    
    // 更新每个分类
    for (let i = 0; i < editableCategories.value.length; i++) {
      const cat = editableCategories.value[i]
      const originalCat = originalCategories.find(c => c.id === cat.id)
      
      // 检查名称或排序是否有变化
      const nameChanged = originalCat && originalCat.name !== cat.name
      const sortChanged = cat.sortOrder !== i
      
      if (nameChanged || sortChanged) {
        await adminApi.updatePanCategory(cat.id, { 
          name: cat.name,
          sortOrder: i 
        })
        
        // 如果名称改变了，记录需要更新资源分类
        if (nameChanged && originalCat) {
          resourcesToUpdate.push({
            oldName: originalCat.name,
            newName: cat.name
          })
        }
      }
    }
    
    // 更新所有使用该分类的资源
    if (resourcesToUpdate.length > 0) {
      // 获取所有网盘资源
      const allRes = await adminApi.getNotices({ noticeType: 'pan_resource', size: 1000 })
      const allResources = allRes.data.list || allRes.data || []
      
      // 更新每个资源的分类
      for (const item of resourcesToUpdate) {
        const resourcesWithOldCategory = allResources.filter(r => r.category === item.oldName)
        
        for (const resource of resourcesWithOldCategory) {
          await adminApi.updateNotice(resource._id || resource.id, {
            ...resource,
            category: item.newName
          })
        }
      }
    }
    
    // 重新加载分类列表和资源列表
    await fetchCategories()
    await fetchResources()
    showCategoryManage.value = false
    ElMessage.success('分类保存成功')
  } catch (error) {
    console.error('保存分类失败:', error)
    ElMessage.error('保存失败')
  }
}

// 批量导入
const handleBatchImport = async () => {
  if (parsedImportList.value.length === 0) {
    ElMessage.warning('没有可导入的数据')
    return
  }
  
  batchImportLoading.value = true
  try {
    let successCount = 0
    let updateCount = 0
    let failCount = 0
    
    // 获取所有现有资源用于检查重复
    const allRes = await adminApi.getNotices({ noticeType: 'pan_resource', size: 1000 })
    const existingResources = allRes.data.list || allRes.data || []
    
    for (const item of parsedImportList.value) {
      try {
        // 检查是否已存在相同标题的资源
        const existing = existingResources.find(r => r.title === item.title)
        
        const articleData = {
          title: item.title,
          category: item.category,
          content: generateContent({
            title: item.title,
            category: item.category,
            quarkUrl: item.quarkUrl,
            baiduUrl: item.baiduUrl,
            description: item.description
          }),
          description: item.description,
          author: '管理员',
          isActive: 1,
          noticeType: 'pan_resource'
        }
        
        if (existing) {
          // 已存在，更新链接
          await adminApi.updateNotice(existing._id || existing.id, articleData)
          updateCount++
        } else {
          // 不存在，创建新资源
          await adminApi.createNotice(articleData)
          successCount++
        }
        
        // 如果是新分类，添加到分类列表
        if (!categories.value.includes(item.category)) {
          categories.value.push(item.category)
        }
      } catch (error) {
        console.error('导入失败:', item.title, error)
        failCount++
      }
    }
    
    const msg = `导入完成：新增 ${successCount} 条，更新 ${updateCount} 条，失败 ${failCount} 条`
    ElMessage.success(msg)
    showBatchImport.value = false
    batchImportText.value = ''
    fetchResources()
  } catch (error) {
    console.error('批量导入失败:', error)
    ElMessage.error('批量导入失败')
  } finally {
    batchImportLoading.value = false
  }
}

// 从内容中提取网盘链接
const extractPanLinks = (content) => {
  if (!content) return { quark: '', baidu: '' }
  const quarkMatch = content.match(/https:\/\/pan\.quark\.cn\/s\/[a-zA-Z0-9]+/)
  const baiduMatch = content.match(/https:\/\/pan\.baidu\.com\/s\/[a-zA-Z0-9_-]+/)
  return {
    quark: quarkMatch ? quarkMatch[0] : '',
    baidu: baiduMatch ? baiduMatch[0] : ''
  }
}

// 生成文章内容（使用模板）
const generateContent = (form) => {
  return generateContentFromTemplate(form)
}

// 解析文章内容为表单数据
const parseContent = (content, title, category) => {
  const links = extractPanLinks(content)
  const descMatch = content.match(/<p style="margin-bottom: 16px;">(.*?)<\/p>/)
  return {
    quarkUrl: links.quark,
    baiduUrl: links.baidu,
    description: descMatch && descMatch[1] !== `资源分类：${category}` ? descMatch[1] : ''
  }
}

const fetchResources = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      size: pageSize.value,
      keyword: searchKeyword.value,
      noticeType: 'pan_resource'
    }
    if (selectedCategory.value && selectedCategory.value !== '全部资料') {
      params.category = selectedCategory.value
    }
    
    const res = await adminApi.getNotices(params)
    console.log('API Response:', res)
    if (res.code === 0) {
      const list = res.data.list || res.data || []
      console.log('Data list:', list)
      resources.value = list.map(item => ({
        ...item,
        id: item._id || item.id,
        isActive: item.isActive === 1 || item.isActive === true ? 1 : 0,
        isTop: item.isTop === 1 || item.isTop === true ? 1 : 0
      }))
      total.value = res.data.total || list.length
      console.log('Resources:', resources.value)
    }
  } catch (error) {
    console.error('获取资源失败:', error)
    ElMessage.error('获取资源失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchResources()
}

const handlePageChange = (val) => {
  currentPage.value = val
  fetchResources()
}

const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
  fetchResources()
}

const handleSelectionChange = (val) => {
  selectedIds.value = val.map(item => item.id)
}

const openAddModal = () => {
  editForm.value = {
    id: null,
    title: '',
    category: (selectedCategory.value && selectedCategory.value !== '全部资料') ? selectedCategory.value : '考研资料',
    quarkUrl: '',
    baiduUrl: '',
    description: '',
    isActive: 0
  }
  isEditing.value = false
  editDialogVisible.value = true
}

const openEditModal = (row) => {
  const parsed = parseContent(row.content, row.title, row.category)
  editForm.value = {
    id: row.id,
    title: row.title,
    category: row.category || '全部资料',
    quarkUrl: parsed.quarkUrl,
    baiduUrl: parsed.baiduUrl,
    description: parsed.description,
    isActive: row.isActive
  }
  isEditing.value = true
  editDialogVisible.value = true
}

const handleSave = async () => {
  if (!editForm.value.title.trim()) {
    return ElMessage.warning('请输入资源标题')
  }
  
  saving.value = true
  try {
    const articleData = {
      title: editForm.value.title,
      category: editForm.value.category,
      content: generateContent(editForm.value),
      description: editForm.value.description,
      author: '管理员',
      isActive: editForm.value.isActive,
      noticeType: 'pan_resource'
    }
    
    let res
    if (isEditing.value) {
      res = await adminApi.updateNotice(editForm.value.id, articleData)
    } else {
      res = await adminApi.createNotice(articleData)
    }
    
    if (res.code === 0) {
      ElMessage.success(isEditing.value ? '更新成功' : '添加成功')
      editDialogVisible.value = false
      fetchResources()
    } else {
      ElMessage.error(res.message || '操作失败')
    }
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除资源"${row.title}"吗？`, '提示', {
    type: 'warning'
  }).then(async () => {
    try {
      const res = await adminApi.deleteNotice(row.id)
      if (res.code === 0) {
        ElMessage.success('删除成功')
        fetchResources()
      }
    } catch (error) {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

const handleBatchDelete = () => {
  ElMessageBox.confirm(`确定要批量删除选中的 ${selectedIds.value.length} 条资源吗？`, '警告', {
    type: 'danger'
  }).then(async () => {
    try {
      for (const id of selectedIds.value) {
        await adminApi.deleteNotice(id)
      }
      ElMessage.success('批量删除成功')
      selectedIds.value = []
      fetchResources()
    } catch (error) {
      ElMessage.error('批量删除失败')
    }
  }).catch(() => {})
}

// 批量刷新内容 - 使用新模板重新生成所有网盘资源的内容
const handleBatchRefreshContent = async () => {
  refreshLoading.value = true
  try {
    // 获取所有网盘资源
    const res = await adminApi.getNotices({ noticeType: 'pan_resource', page: 1, size: 100 })
    const list = res.data.list || res.data || []
    let updatedCount = 0

    for (const item of list) {
      const links = extractPanLinks(item.content)
      const newContent = generateContentFromTemplate({
        title: item.title,
        category: item.category,
        quarkUrl: links.quark,
        baiduUrl: links.baidu,
        description: ''
      })

      await adminApi.updateNotice(item._id || item.id, {
        ...item,
        content: newContent
      })
      updatedCount++
    }

    ElMessage.success(`成功刷新 ${updatedCount} 条资源的内容`)
    fetchResources()
  } catch (error) {
    console.error('批量刷新内容失败:', error)
    ElMessage.error('批量刷新内容失败')
  } finally {
    refreshLoading.value = false
  }
}

const handleStatusChange = async (row, val) => {
  try {
    const res = await adminApi.updateNoticeStatus(row.id, val)
    if (res.code === 0) {
      ElMessage.success(val ? '启用成功' : '禁用成功')
      row.isActive = val
    } else {
      row.isActive = val ? 0 : 1
    }
  } catch (error) {
    ElMessage.error('操作失败')
    row.isActive = val ? 0 : 1
  }
}

const handleBatchStatusChange = async (status) => {
  try {
    for (const id of selectedIds.value) {
      await adminApi.updateNoticeStatus(id, status)
    }
    ElMessage.success(status ? '批量启用成功' : '批量禁用成功')
    selectedIds.value = []
    fetchResources()
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

// 批量修改分类
const handleBatchCategoryChange = async () => {
  if (!batchCategoryValue.value) {
    ElMessage.warning('请选择分类')
    return
  }
  
  batchCategoryLoading.value = true
  try {
    await adminApi.batchUpdatePanResourcesCategory({
      ids: selectedIds.value,
      category: batchCategoryValue.value
    })
    ElMessage.success('批量修改分类成功')
    showBatchCategoryDialog.value = false
    batchCategoryValue.value = ''
    selectedIds.value = []
    fetchResources()
  } catch (error) {
    console.error('批量修改分类失败:', error)
    ElMessage.error('批量修改分类失败')
  } finally {
    batchCategoryLoading.value = false
  }
}

const handleTopChange = async (row, val) => {
  try {
    const res = await adminApi.updateNotice(row.id, { isTop: val })
    if (res.code === 0) {
      ElMessage.success(val ? '置顶成功' : '取消置顶成功')
      row.isTop = val
    } else {
      row.isTop = val ? 0 : 1
    }
  } catch (error) {
    ElMessage.error('操作失败')
    row.isTop = val ? 0 : 1
  }
}

const formatDate = (date) => {
  if (!date) return '-'
  const d = new Date(date)
  return d.toLocaleString('zh-CN')
}

onMounted(() => {
  loadTemplate()
  fetchCategories()
  fetchResources()
})
</script>

<style scoped>
.pan-manage {
  padding: 20px;
}
.header-actions {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}
.header-actions .left {
  display: flex;
  gap: 10px;
}
.search-input {
  width: 250px;
}
.category-select {
  width: 150px;
}
.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
.title-cell {
  display: flex;
  align-items: center;
  gap: 5px;
}
.mr-5 {
  margin-right: 5px;
}
.link-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}
.link-tag {
  flex-shrink: 0;
}
.link-tag.quark {
  background-color: #e6f7ff;
  color: #1890ff;
  border-color: #91d5ff;
}
.link-tag.baidu {
  background-color: #fff7e6;
  color: #fa8c16;
  border-color: #ffd591;
}
.link-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

/* 分类管理样式 */
.category-manage {
  max-height: 400px;
  overflow-y: auto;
}
.category-list-manage {
  margin-bottom: 20px;
}
.category-item-manage {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.category-input {
  flex: 1;
}
.category-name {
  flex: 1;
  padding: 0 12px;
  font-size: 14px;
  color: #606266;
}
.add-category {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px dashed #dcdfe6;
}

/* 批量导入样式 */
.batch-import {
  max-height: 600px;
  overflow-y: auto;
}
.import-preview {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px dashed #dcdfe6;
}
.import-preview h4 {
  margin-bottom: 10px;
  color: #606266;
}
.more-tip {
  text-align: center;
  color: #909399;
  margin-top: 10px;
}

/* 批量修改分类样式 */
.batch-category-dialog {
  padding: 10px 0;
}
.batch-category-tip {
  margin-bottom: 20px;
  color: #606266;
  font-size: 14px;
}

/* 模板编辑样式 */
.template-edit-container {
  padding: 0;
}

.template-var {
  display: inline-block;
  margin-right: 20px;
  margin-bottom: 5px;
}

.template-var code {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 4px;
  color: #409eff;
}

.template-edit-layout {
  display: flex;
  gap: 20px;
  height: 600px;
}

.template-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

.editor-header {
  padding: 10px 15px;
  background: #f5f7fa;
  border-bottom: 1px solid #dcdfe6;
  font-weight: bold;
  color: #606266;
}

.template-textarea {
  flex: 1;
}

.template-textarea :deep(.el-textarea__inner) {
  height: 100% !important;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
}

.visual-editor {
  flex: 1;
  overflow: auto;
}

.visual-editor :deep(.rich-editor) {
  height: 100%;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.template-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

.preview-header {
  padding: 10px 15px;
  background: #f5f7fa;
  border-bottom: 1px solid #dcdfe6;
  font-weight: bold;
  color: #606266;
}

.preview-content {
  flex: 1;
  padding: 20px;
  overflow: auto;
  background: #fff;
}
</style>
