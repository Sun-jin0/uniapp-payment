<template>
  <div class="question-manage">
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <el-tab-pane label="试题管理" name="questions">
        <div class="header-actions">
          <div class="left">
            <el-input
              v-model="filters.keyword"
              placeholder="搜索题目内容..."
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
            <el-select v-model="filters.course_id" placeholder="选择科目" clearable @change="handleCourseChange" class="filter-select">
              <el-option v-for="item in courses" :key="item.id || item.course_id" :label="item.courseName || item.name" :value="item.id || item.course_id" />
            </el-select>

            <!-- 公共课题库额外筛选 -->
            <template v-if="type === 'public'">
              <el-select v-model="filters.parentSubject" placeholder="一级科目" clearable @change="handleParentSubjectChange" class="filter-select">
                <el-option v-for="item in parentSubjects" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
              <el-select v-model="filters.subject" placeholder="二级科目" clearable @change="handleSubjectChange" class="filter-select" :disabled="!filters.parentSubject">
                <el-option v-for="item in subSubjects" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
              <el-select v-model="filters.bookId" placeholder="选择书目" clearable @change="handleBookChange" class="filter-select" :disabled="!filters.subject">
                <el-option v-for="item in books" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </template>

            <el-select v-model="filters.chapter_id" placeholder="选择章节" clearable @change="handleSearch" class="filter-select" :disabled="type === 'public' && !filters.bookId">
              <el-option v-for="item in chapters" :key="item.id || item.chapter_id" :label="item.chapterName || item.name" :value="item.id || item.chapter_id" />
            </el-select>

            <!-- 计算机题库特有筛选：没有考点的题 -->
            <el-checkbox 
              v-if="type === 'computer'" 
              v-model="filters.noKnowledgeTag" 
              @change="handleSearch"
              class="filter-checkbox"
            >
              没有考点的题
            </el-checkbox>

            <!-- 动态生成字段筛选器 -->
            <template v-for="field in fieldConfig.fields.filter(f => f.filter)" :key="field.key">
              <el-select 
                v-if="field.type === 'select'"
                v-model="filters[field.key]"
                :placeholder="'筛选' + field.label"
                clearable
                @change="handleSearch"
                class="filter-select"
              >
                <el-option v-for="opt in field.options" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
              <el-input
                v-else
                v-model="filters[field.key]"
                :placeholder="'筛选' + field.label"
                clearable
                @change="handleSearch"
                class="filter-select"
                style="width: 120px"
              />
            </template>
          </div>
          <div class="right">
            <el-button type="primary" @click="openAddModal">
              <el-icon><Plus /></el-icon> 新增试题
            </el-button>
          </div>
        </div>

        <el-table :data="questions" v-loading="loading" border stripe style="width: 100%" class="mt-20">
          <el-table-column label="ID" width="120" align="center">
            <template #default="{ row }">
              {{ row[fieldConfig.idField] || row.id }}
            </template>
          </el-table-column>
          <el-table-column prop="topic" label="题干" min-width="300">
            <template #default="{ row }">
              <div class="topic-text" v-html="renderContent(row.topic || row.QuestionText || row.title)"></div>
            </template>
          </el-table-column>
          <el-table-column :label="fieldConfig.courseLabel" width="120" align="center">
            <template #default="{ row }">
              {{ row[fieldConfig.courseNameKey] || row.courseName }}
            </template>
          </el-table-column>
          <el-table-column :label="fieldConfig.chapterLabel" width="150" align="center">
            <template #default="{ row }">
              {{ row[fieldConfig.chapterNameKey] || row.chapterName }}
            </template>
          </el-table-column>
          <el-table-column prop="year" label="年份" width="80" align="center" />
          <el-table-column prop="status" label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'info'">
                {{ row.status === 1 ? '启用' : '下架' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" align="center" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="editQuestion(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="deleteQuestion(row)">删除</el-button>
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
      </el-tab-pane>

      <el-tab-pane label="纠错反馈" name="feedback">
        <el-table :data="feedbacks" v-loading="loadingFeedback" border stripe style="width: 100%">
          <el-table-column prop="id" label="ID" width="80" align="center" />
          <el-table-column prop="QuestionID" label="题目ID" width="100" align="center" />
          <el-table-column prop="Type" label="反馈类型" width="120" align="center" />
          <el-table-column prop="Content" label="反馈内容" min-width="200" />
          <el-table-column prop="Status" label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.Status === 2 ? 'success' : 'warning'">
                {{ row.Status === 2 ? '已处理' : '待处理' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="CreatedAt" label="反馈时间" width="180" align="center">
            <template #default="{ row }">
              {{ formatDate(row.CreatedAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" @click="handleFeedback(row)">处理</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 反馈处理对话框 -->
    <el-dialog
      v-model="showFeedbackModal"
      title="处理纠错反馈"
      width="500px"
    >
      <div v-if="currentFeedback" class="feedback-detail">
        <div class="detail-item">
          <span class="label">题目ID:</span>
          <span>{{ currentFeedback.QuestionID }}</span>
        </div>
        <div class="detail-item">
          <span class="label">反馈类型:</span>
          <span>{{ currentFeedback.Type }}</span>
        </div>
        <div class="detail-item">
          <span class="label">反馈内容:</span>
          <div class="content-box">{{ currentFeedback.Content }}</div>
        </div>
        <el-divider />
        <el-form label-position="top">
          <el-form-item label="管理员备注">
            <el-input v-model="feedbackForm.remark" type="textarea" :rows="3" placeholder="内部可见备注..." />
          </el-form-item>
          <el-form-item label="回复用户 (可选)">
            <el-input v-model="feedbackForm.reply" type="textarea" :rows="3" placeholder="用户将收到此回复..." />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showFeedbackModal = false">取消</el-button>
          <el-button type="success" @click="submitFeedback(2)">标记为已处理</el-button>
          <el-button type="primary" @click="submitFeedback(currentFeedback.Status)">保存修改</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 试题编辑/新增对话框 -->
    <el-dialog
      v-model="showEditModal"
      :title="editingQuestion.id || editingQuestion.question_id || editingQuestion.QuestionID ? '编辑试题' : '新增试题'"
      width="80%"
      top="5vh"
    >
      <el-form :model="editingQuestion" label-width="120px">
        <!-- 如果是 med，使用 Tabs 布局 -->
        <template v-if="fieldConfig.hasTabs">
          <el-tabs type="border-card">
            <el-tab-pane label="基本信息">
              <el-row :gutter="20">
                <el-col :span="8">
                  <el-form-item :label="fieldConfig.courseLabel">
                    <el-select v-model="editingQuestion[fieldConfig.courseKey]" :placeholder="'选择' + fieldConfig.courseLabel" style="width: 100%" @change="onEditCourseChange">
                      <el-option v-for="item in courses" :key="item.id || item.course_id || item.SubjectID || item.major_id" :label="item.courseName || item.name || item.SubjectName || item.subject_name" :value="item.id || item.course_id || item.SubjectID || item.major_id" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item :label="fieldConfig.chapterLabel">
                    <el-select v-model="editingQuestion[fieldConfig.chapterKey]" :placeholder="'选择' + fieldConfig.chapterLabel" style="width: 100%">
                      <el-option v-for="item in editChapters" :key="item.id || item.chapter_id || item.BookID" :label="item.chapterName || item.name || item.BookTitle" :value="item.id || item.chapter_id || item.BookID" />
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>
              <!-- 遍历基本字段 -->
              <template v-for="field in fieldConfig.fields.filter(f => !f.tab)" :key="field.key">
                <el-form-item :label="field.label">
                  <el-input v-if="field.type === 'textarea'" v-model="editingQuestion[field.key]" type="textarea" :rows="3" />
                  <el-input-number v-else-if="field.type === 'number'" v-model="editingQuestion[field.key]" style="width: 100%" />
                  <el-input v-else v-model="editingQuestion[field.key]" />
                </el-form-item>
              </template>

              <el-form-item label="选项" v-if="hasOptions">
                <div v-for="(opt, index) in editingQuestion.content" :key="index" class="option-row mb-10">
                  <el-tag class="option-tag">{{ String.fromCharCode(65 + index) }}</el-tag>
                  <el-input v-model="editingQuestion.content[index]" class="option-input" />
                </div>
                <el-button link type="primary" @click="addOption" v-if="editingQuestion.content && editingQuestion.content.length < 8">+ 添加选项</el-button>
              </el-form-item>
            </el-tab-pane>

            <!-- 动态生成其它标签页 -->
            <el-tab-pane v-for="tabName in [...new Set(fieldConfig.fields.filter(f => f.tab).map(f => f.tab))]" :key="tabName" :label="tabName">
              <template v-for="field in fieldConfig.fields.filter(f => f.tab === tabName)" :key="field.key">
                <el-form-item :label="field.label">
                  <el-input v-if="field.type === 'textarea'" v-model="editingQuestion[field.key]" type="textarea" :rows="3" />
                  <el-input v-else v-model="editingQuestion[field.key]" />
                </el-form-item>
              </template>
            </el-tab-pane>
          </el-tabs>
        </template>

        <!-- 非 med 类型，常规布局 -->
        <template v-else>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item :label="fieldConfig.courseLabel">
                <el-select v-model="editingQuestion[fieldConfig.courseKey]" :placeholder="'选择' + fieldConfig.courseLabel" style="width: 100%" @change="onEditCourseChange">
                  <el-option v-for="item in courses" :key="item.id || item.course_id || item.SubjectID || item.major_id" :label="item.courseName || item.name || item.SubjectName || item.subject_name" :value="item.id || item.course_id || item.SubjectID || item.major_id" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="fieldConfig.chapterLabel">
                <el-select v-model="editingQuestion[fieldConfig.chapterKey]" :placeholder="'选择' + fieldConfig.chapterLabel" style="width: 100%">
                  <el-option v-for="item in editChapters" :key="item.id || item.chapter_id || item.BookID" :label="item.chapterName || item.name || item.BookTitle" :value="item.id || item.chapter_id || item.BookID" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <template v-for="field in fieldConfig.fields" :key="field.key">
            <el-form-item :label="field.label">
              <el-input v-if="field.type === 'textarea'" v-model="editingQuestion[field.key]" type="textarea" :rows="3" />
              <el-input-number v-else-if="field.type === 'number'" v-model="editingQuestion[field.key]" style="width: 100%" />
              <el-input v-else v-model="editingQuestion[field.key]" />
            </el-form-item>
          </template>
          <el-form-item label="选项" v-if="hasOptions">
            <div v-for="(opt, index) in editingQuestion.content" :key="index" class="option-row mb-10">
              <el-tag class="option-tag">{{ String.fromCharCode(65 + index) }}</el-tag>
              <el-input v-model="editingQuestion.content[index]" class="option-input" />
            </div>
            <el-button link type="primary" @click="addOption" v-if="editingQuestion.content && editingQuestion.content.length < 8">+ 添加选项</el-button>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showEditModal = false">取消</el-button>
          <el-button type="primary" @click="saveQuestion">确认保存</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { adminApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const type = computed(() => route.meta.type || 'med')

const activeTab = ref('questions')
const loading = ref(false)
const loadingFeedback = ref(false)
const questions = ref([])
const feedbacks = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const courses = ref([])
const chapters = ref([])
const editChapters = ref([])

// 公共课专用数据
const parentSubjects = ref([])
const subSubjects = ref([])
const books = ref([])

const filters = ref({
  keyword: '',
  course_id: '',
  chapter_id: '',
  parentSubject: '',
  subject: '',
  bookId: '',
  noKnowledgeTag: false
})

const showFeedbackModal = ref(false)
const currentFeedback = ref(null)
const feedbackForm = reactive({
  remark: '',
  reply: ''
})

const showEditModal = ref(false)
const editingQuestion = ref({
  id: '',
  question_id: '',
  topic: '',
  content: ['', '', '', ''],
  answer: '',
  analysis: '',
  course_id: '',
  chapter_id: '',
  year: '',
  number: '',
  question_type_option: '',
  column_id: '',
  score: 1,
  score_describe: '',
  sort: 0,
  type: '',
  status: 1,
  basic_analysis: '',
  itemize_analysis: '',
  comparison_summary: '',
  mind_map: '',
  video_url: '',
  topic_image: '',
  basic_analysis_image: '',
  itemize_analysis_image: '',
  mind_map_image: '',
  knowledge_image: ''
})

const hasOptions = computed(() => ['med', 'public', 'computer'].includes(type.value))

// 动态获取字段配置
const fieldConfig = computed(() => {
  const configs = {
  med: {
    idField: 'question_id',
    courseLabel: '科目',
    chapterLabel: '章节',
    courseKey: 'course_id',
    chapterKey: 'chapter_id',
    courseNameKey: 'course_name',
    chapterNameKey: 'chapter_name',
    hasTabs: true,
    fields: [
      { key: 'topic', label: '题干', type: 'textarea', filter: true },
      { key: 'answer', label: '正确答案', type: 'input' },
      { key: 'year', label: '年份', type: 'input', filter: true },
      { key: 'number', label: '题号', type: 'input' },
      { key: 'score', label: '分值', type: 'number' },
      { key: 'score_describe', label: '分值描述', type: 'input' },
      { key: 'question_type_option', label: '题型标识', type: 'input', filter: true },
      { key: 'column_id', label: '栏目ID', type: 'input', filter: true },
      { key: 'type', label: '题库类型', type: 'input', filter: true },
      { key: 'status', label: '状态', type: 'select', options: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }], filter: true },
      { key: 'analysis', label: '考点解析', type: 'textarea', tab: '解析详情' },
      { key: 'basic_analysis', label: '基础解析', type: 'textarea', tab: '解析详情' },
      { key: 'itemize_analysis', label: '分项解析', type: 'textarea', tab: '解析详情' },
      { key: 'comparison_summary', label: '比较总结', type: 'textarea', tab: '解析详情' },
      { key: 'mind_map', label: '思维导图文本', type: 'textarea', tab: '解析详情' },
      { key: 'video_url', label: '视频链接', type: 'input', tab: '解析详情' },
      { key: 'topic_image', label: '题干图片', type: 'image', tab: '图片资源' },
      { key: 'basic_analysis_image', label: '基础解析图片', type: 'image', tab: '图片资源' },
      { key: 'itemize_analysis_image', label: '分项解析图片', type: 'image', tab: '图片资源' },
      { key: 'mind_map_image', label: '思维导图图片', type: 'image', tab: '图片资源' },
      { key: 'knowledge_image', label: '知识点图片', type: 'image', tab: '图片资源' }
    ]
  },
    math: {
      idField: 'QuestionID',
      courseLabel: '科目',
      chapterLabel: '书籍',
      courseKey: 'SubjectID',
      chapterKey: 'BookID',
      courseNameKey: 'SubjectName',
      chapterNameKey: 'BookTitle',
      hasTabs: false,
      fields: [
        { key: 'QuestionText', label: '题干', type: 'textarea' },
        { key: 'Answer', label: '答案', type: 'textarea' },
        { key: 'Explanation', label: '解析', type: 'textarea' },
        { key: 'Difficulty', label: '难度', type: 'number' }
      ]
    },
    public: {
      idField: 'id',
      courseLabel: '科目',
      chapterLabel: '章节',
      courseKey: 'bookId',
      chapterKey: 'chapterId',
      courseNameKey: 'bookName',
      chapterNameKey: 'chapterName',
      hasTabs: false,
      fields: [
        { key: 'title', label: '题干', type: 'textarea' },
        { key: 'answer', label: '答案', type: 'input' },
        { key: 'explanation', label: '解析', type: 'textarea' },
        { key: 'difficulty', label: '难度', type: 'number' },
        { key: 'mnemonic', label: '助记词', type: 'textarea' }
      ]
    },
    computer: {
      idField: 'question_id',
      courseLabel: '科目',
      chapterLabel: '章节',
      courseKey: 'major_id',
      chapterKey: 'chapter_id',
      courseNameKey: 'majorName',
      chapterNameKey: 'chapterName',
      hasTabs: false,
      fields: [
        { key: 'topic', label: '题干', type: 'textarea' },
        { key: 'answer', label: '答案', type: 'input' },
        { key: 'analysis', label: '解析', type: 'textarea' }
      ]
    }
  }
  return configs[type.value] || configs.med
})

const loadQuestions = async () => {
  loading.value = true
  try {
    // 构造请求参数，包含所有 filters
    const params = {
      page: currentPage.value,
      size: pageSize.value,
      ...filters.value
    }
    
    // 将 noKnowledgeTag 映射为 noTags（后端使用的参数名）
    if (params.noKnowledgeTag) {
      params.noTags = 'true'
      delete params.noKnowledgeTag
    }
    
    // 清理空值
    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null || params[key] === undefined || params[key] === false) {
        delete params[key]
      }
    })

    const res = await adminApi.getQuestions(type.value, params)
    if (res.code === 0) {
      questions.value = res.data?.list || []
      total.value = res.data?.total || 0
    }
  } catch (error) {
    console.error('加载题目失败:', error)
    questions.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const loadFeedbacks = async () => {
  loadingFeedback.value = true
  try {
    const res = await adminApi.getFeedbacks(type.value)
    if (res.code === 0) {
      feedbacks.value = res.data?.list || res.data || []
    }
  } catch (error) {
    console.error('加载反馈失败:', error)
    feedbacks.value = []
  } finally {
    loadingFeedback.value = false
  }
}

const loadCourses = async () => {
  try {
    const res = await adminApi.getCourses(type.value)
    if (res.code === 0) {
      courses.value = res.data || []
    }
    if (type.value === 'public') {
      const subRes = await adminApi.getNavSubjects()
      if (subRes.code === 0) {
        parentSubjects.value = subRes.data.filter(s => s.parent_id === 0)
      }
    }
  } catch (error) {
    console.error('加载科目失败:', error)
  }
}

const handleParentSubjectChange = async (val) => {
  filters.value.subject = ''
  filters.value.bookId = ''
  filters.value.chapter_id = ''
  subSubjects.value = []
  books.value = []
  chapters.value = []

  if (val) {
    const res = await adminApi.getNavSubjects()
    if (res.code === 0) {
      subSubjects.value = res.data.filter(s => s.parent_id === val)
    }
  }
  handleSearch()
}

const handleSubjectChange = async (val) => {
  filters.value.bookId = ''
  filters.value.chapter_id = ''
  books.value = []
  chapters.value = []

  if (val) {
    const res = await adminApi.getBooks({ subjectId: val })
    if (res.code === 0) {
      books.value = res.data
    }
  }
  handleSearch()
}

const handleBookChange = async (val) => {
  filters.value.chapter_id = ''
  chapters.value = []

  if (val) {
    const res = await adminApi.getCourseChapters(type.value, val)
    if (res.code === 0) {
      chapters.value = res.data
    }
  }
  handleSearch()
}

const handleCourseChange = async (val) => {
  filters.value.chapter_id = ''
  if (!val) {
    chapters.value = []
    return
  }
  try {
    const res = await adminApi.getCourseChapters(type.value, val)
    if (res.code === 0) {
      chapters.value = res.data || []
    }
  } catch (error) {
    console.error('加载章节失败:', error)
  }
  handleSearch()
}

const onEditCourseChange = async (val) => {
  editingQuestion.value.chapter_id = ''
  if (!val) {
    editChapters.value = []
    return
  }
  try {
    const res = await adminApi.getCourseChapters(type.value, val)
    if (res.code === 0) {
      editChapters.value = res.data || []
    }
  } catch (error) {
    console.error('加载编辑章节失败:', error)
  }
}

const handleSearch = () => {
  currentPage.value = 1
  loadQuestions()
}

const handleSizeChange = (val) => {
  pageSize.value = val
  loadQuestions()
}

const handleCurrentChange = (val) => {
  currentPage.value = val
  loadQuestions()
}

const handleTabChange = (val) => {
  if (val === 'questions') {
    loadQuestions()
  } else {
    loadFeedbacks()
  }
}

const openAddModal = () => {
  editingQuestion.value = {
    id: '',
    question_id: '',
    topic: '',
    content: hasOptions.value ? ['', '', '', ''] : null,
    answer: '',
    analysis: '',
    course_id: '',
    chapter_id: '',
    year: new Date().getFullYear().toString(),
    number: '',
    question_type_option: '',
    column_id: '',
    score: 1,
    score_describe: '',
    sort: 0,
    type: '',
    status: 1,
    basic_analysis: '',
    itemize_analysis: '',
    comparison_summary: '',
    mind_map: '',
    video_url: '',
    topic_image: '',
    basic_analysis_image: '',
    itemize_analysis_image: '',
    mind_map_image: '',
    knowledge_image: ''
  }
  showEditModal.value = true
}

const editQuestion = async (row) => {
  editingQuestion.value = { ...row }
  // 确保 snake_case 映射正确
  if (row.courseId && !row.course_id) editingQuestion.value.course_id = row.courseId
  if (row.chapterId && !row.chapter_id) editingQuestion.value.chapter_id = row.chapterId
  
  // 处理 med 模块的 question_id 映射到 id (如果后端接口需要)
  if (type.value === 'med' && row.question_id && !row.id) {
    editingQuestion.value.id = row.question_id
  }

  if (editingQuestion.value.course_id) {
    await onEditCourseChange(editingQuestion.value.course_id)
    // 确保章节 ID 被正确设置
    if (row.chapterId) editingQuestion.value.chapter_id = row.chapterId
  }
  showEditModal.value = true
}

const deleteQuestion = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除这道题吗？', '警告', {
      type: 'warning'
    })
    // med 模块使用 question_id
    const id = (type.value === 'med') ? (row.question_id || row.id) : row.id
    const res = await adminApi.deleteQuestion(type.value, id)
    if (res.code === 0) {
      ElMessage.success('删除成功')
      loadQuestions()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

const saveQuestion = async () => {
  try {
    let res
    const id = (type.value === 'med') ? (editingQuestion.value.question_id || editingQuestion.value.id) : editingQuestion.value.id
    
    if (id) {
      res = await adminApi.updateQuestion(type.value, id, editingQuestion.value)
    } else {
      res = await adminApi.createQuestion(type.value, editingQuestion.value)
    }

    if (res.code === 0) {
      ElMessage.success('保存成功')
      showEditModal.value = false
      loadQuestions()
    }
  } catch (error) {
    console.error('保存失败:', error)
  }
}

const handleFeedback = (row) => {
  currentFeedback.value = row
  feedbackForm.remark = row.AdminRemark || ''
  feedbackForm.reply = row.ReplyContent || ''
  showFeedbackModal.value = true
}

const submitFeedback = async (status) => {
  try {
    const res = await adminApi.updateFeedback(type.value, currentFeedback.value.id, {
      status,
      admin_remark: feedbackForm.remark
    })
    
    if (type.value !== 'med' && feedbackForm.reply) {
      await adminApi.replyFeedback(type.value, currentFeedback.value.id, {
        content: feedbackForm.reply
      })
    }

    if (res.code === 0) {
      ElMessage.success('处理成功')
      showFeedbackModal.value = false
      loadFeedbacks()
    }
  } catch (error) {
    console.error('处理反馈失败:', error)
  }
}

const addOption = () => {
  if (!editingQuestion.value.content) {
    editingQuestion.value.content = []
  }
  editingQuestion.value.content.push('')
}

const renderContent = (text) => {
  if (!text) return ''
  // 简单的内容渲染，可以根据需要添加 LaTeX 支持
  return text.replace(/\n/g, '<br>')
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

watch(() => route.meta.type, () => {
  loadCourses()
  handleSearch()
}, { immediate: true })

onMounted(() => {
  loadCourses()
  loadQuestions()
})
</script>

<style scoped>
.question-manage {
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
.filter-select {
  width: 150px;
}
.mt-20 {
  margin-top: 20px;
}
.mb-10 {
  margin-bottom: 10px;
}
.option-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.option-tag {
  width: 30px;
  text-align: center;
}
.topic-text {
  max-height: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
