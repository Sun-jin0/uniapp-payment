<template>
  <div class="med-manage-container">
    <el-tabs v-model="activeTab" type="border-card">
      <!-- 纠错反馈 -->
      <el-tab-pane label="纠错反馈" name="feedback">
        <div class="tab-header">
          <el-form :inline="true" :model="feedbackFilter">
            <el-form-item label="状态">
              <el-select v-model="feedbackFilter.status" placeholder="选择状态" clearable @change="fetchFeedbacks">
                <el-option label="待处理" :value="1" />
                <el-option label="已处理" :value="2" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="fetchFeedbacks">刷新</el-button>
            </el-form-item>
          </el-form>
        </div>

        <el-table :data="feedbacks" style="width: 100%" v-loading="loading">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column label="状态" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.Status === 2 ? 'success' : 'danger'">
                {{ scope.row.Status === 2 ? '已处理' : '待处理' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="Type" label="类型" width="120" />
          <el-table-column prop="Content" label="反馈内容" show-overflow-tooltip />
          <el-table-column prop="QuestionID" label="题目ID" width="100" />
          <el-table-column label="提交时间" width="180">
            <template #default="scope">
              {{ formatDate(scope.row.CreatedAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="scope">
              <el-button size="small" type="primary" link @click="handleEditFeedback(scope.row)">处理</el-button>
              <el-button size="small" type="success" link @click="handleEditQuestionFromFeedback(scope.row)">编辑题目</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination">
          <el-pagination
            v-model:current-page="feedbackFilter.page"
            :page-size="feedbackFilter.limit"
            layout="total, prev, pager, next"
            :total="feedbackTotal"
            @current-change="fetchFeedbacks"
          />
        </div>
      </el-tab-pane>

      <!-- 试题管理 -->
      <el-tab-pane label="试题管理" name="question">
        <div class="tab-header">
          <el-form :inline="true" :model="questionFilter" size="small">
            <el-form-item label="关键字">
              <el-input v-model="questionFilter.keyword" placeholder="搜索题干或ID" clearable @keyup.enter="fetchQuestions" style="width: 180px" />
            </el-form-item>
            <el-form-item label="科目">
              <el-select v-model="questionFilter.course_id" placeholder="选择科目" clearable @change="handleCourseChange" style="width: 150px">
                <el-option v-for="c in courses" :key="c.courseId" :label="c.courseName" :value="c.courseId" />
              </el-select>
            </el-form-item>
            <el-form-item label="章节">
              <el-select v-model="questionFilter.chapter_id" placeholder="选择章节" clearable @change="fetchQuestions" style="width: 180px">
                <el-option v-for="ch in chapters" :key="ch.chapterId" :label="ch.chapterName" :value="ch.chapterId" />
              </el-select>
            </el-form-item>
            <el-form-item label="年份">
              <el-input v-model="questionFilter.year" placeholder="年份" style="width: 100px" clearable @change="fetchQuestions" />
            </el-form-item>
            <el-form-item label="题型">
              <el-input v-model="questionFilter.question_type_option" placeholder="题型标识" style="width: 120px" clearable @change="fetchQuestions" />
            </el-form-item>
            <el-form-item label="状态">
              <el-select v-model="questionFilter.status" placeholder="状态" clearable style="width: 100px" @change="fetchQuestions">
                <el-option label="有效" :value="1" />
                <el-option label="下架" :value="0" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="fetchQuestions">查询</el-button>
            </el-form-item>
          </el-form>
        </div>

        <el-table :data="questions" style="width: 100%" v-loading="loading" border size="small">
          <el-table-column prop="question_id" label="题目ID" width="120" />
          <el-table-column prop="course_name" label="科目" width="120" />
          <el-table-column prop="chapter_name" label="章节" width="150" show-overflow-tooltip />
          <el-table-column prop="topic" label="题干" show-overflow-tooltip min-width="200" />
          <el-table-column prop="year" label="年份" width="80" align="center" />
          <el-table-column prop="question_type_option" label="题型" width="100" />
          <el-table-column label="状态" width="80" align="center">
            <template #default="scope">
              <el-tag :type="scope.row.status === 1 ? 'success' : 'info'" size="small">
                {{ scope.row.status === 1 ? '有效' : '下架' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="scope">
              <el-button size="small" type="primary" link @click="handleEditQuestion(scope.row)">编辑</el-button>
              <el-button size="small" type="danger" link @click="handleDeleteQuestion(scope.row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination">
          <el-pagination
            v-model:current-page="questionFilter.page"
            :page-size="questionFilter.size"
            layout="total, prev, pager, next"
            :total="questionTotal"
            @current-change="fetchQuestions"
          />
        </div>
      </el-tab-pane>

      <!-- 科目章节管理 -->
      <el-tab-pane label="科目章节管理" name="course">
        <div class="course-chapter-manage">
          <div class="filter-bar">
            <el-form :inline="true" size="small">
              <el-form-item label="所属科目">
                <el-select v-model="chapterFilter.course_id" placeholder="请选择科目筛选" clearable @change="fetchChaptersForManage" style="width: 200px">
                  <el-option v-for="c in courses" :key="c.courseId" :label="c.courseName" :value="c.courseId" />
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="fetchChaptersForManage">刷新</el-button>
              </el-form-item>
            </el-form>
          </div>
          <el-table :data="manageChapters" style="width: 100%" border size="small" v-loading="loadingChapters">
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column prop="courseId" label="科目ID" width="100" />
            <el-table-column prop="courseName" label="科目名称" width="150" />
            <el-table-column prop="chapterId" label="章节ID" width="100" />
            <el-table-column prop="chapterName" label="章节名称" min-width="200" show-overflow-tooltip />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="scope">
                <el-button size="small" type="primary" link @click="handleEditCourseName(scope.row)">编辑科目</el-button>
                <el-button size="small" type="primary" link @click="handleEditChapterName(scope.row)">编辑章节</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="manageChapters.length === 0 && !loadingChapters" class="empty-data">
            <el-empty description="暂无数据，请选择科目或刷新" />
          </div>
        </div>
      </el-tab-pane>

      <!-- 试题导入 -->
      <el-tab-pane label="试题导入" name="import">
        <div class="import-container">
          <!-- 上传区域 - 卡片式设计 -->
          <div class="upload-card" @click="triggerFileUpload">
            <div class="upload-icon-box">
              <el-icon :size="48" color="#409EFF"><Upload /></el-icon>
            </div>
            <div class="upload-text-box">
              <div class="upload-main-text">点击上传 JSON 文件</div>
              <div class="upload-sub-text">支持单选或多选 JSON 格式试题包</div>
            </div>
            <input 
              type="file" 
              ref="fileInput" 
              style="display: none" 
              accept=".json" 
              multiple
              @change="handleFileSelect"
            />
          </div>

          <!-- 文件列表 -->
          <div v-if="importFiles.length > 0" class="import-list">
            <div class="list-header">
              <span class="list-title">待导入文件 ({{ importFiles.length }})</span>
              <el-button 
                type="primary" 
                size="small" 
                @click="importAllFiles"
                :disabled="!hasPendingFiles"
              >
                批量导入
              </el-button>
            </div>
            <el-table :data="importFiles" style="width: 100%" size="small">
              <el-table-column type="index" label="序号" width="60" align="center" />
              <el-table-column prop="filename" label="文件名" min-width="200" show-overflow-tooltip />
              <el-table-column prop="size" label="大小" width="100" align="center" />
              <el-table-column label="状态" width="100" align="center">
                <template #default="scope">
                  <el-tag :type="getStatusType(scope.row.status)" size="small">
                    {{ getStatusText(scope.row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150" align="center">
                <template #default="scope">
                  <el-button 
                    size="small" 
                    type="primary" 
                    link
                    @click="handleImport(scope.row)"
                    :loading="scope.row.status === 'importing'"
                    :disabled="scope.row.status === 'success'"
                  >导入</el-button>
                  <el-button 
                    size="small" 
                    type="danger" 
                    link
                    @click="removeImportFile(scope.$index)"
                    :disabled="scope.row.status === 'importing'"
                  >删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
          
          <div v-else class="empty-import">
            <el-empty description="请上传需要导入的 JSON 文件" />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 题目编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="90%" top="3vh" destroy-on-close class="edit-dialog">
      <div class="edit-dialog-container" v-if="editForm">
        <!-- 左侧导航栏 -->
        <div class="edit-sidebar">
          <div 
            v-for="item in sidebarItems" 
            :key="item.key"
            class="sidebar-item"
            :class="{ active: activeEditTab === item.key }"
            @click="activeEditTab = item.key"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </div>
        </div>
        
        <!-- 右侧内容区 -->
        <div class="edit-content">
          <el-form :model="editForm" label-width="100px" size="small">
            <!-- 基本信息 -->
            <div v-show="activeEditTab === 'basic'" class="tab-panel">
              <h3 class="panel-title">基本信息</h3>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="所属科目">
                    <el-select v-model="editForm.course_id" style="width: 100%" @change="handleDialogCourseChange">
                      <el-option v-for="c in courses" :key="c.courseId" :label="c.courseName" :value="c.courseId" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="所属章节">
                    <el-select v-model="editForm.chapter_id" style="width: 100%">
                      <el-option v-for="ch in dialogChapters" :key="ch.chapterId" :label="ch.chapterName" :value="ch.chapterId" />
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="年份">
                    <el-input v-model="editForm.year" placeholder="如: 2024" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="题号">
                    <el-input v-model="editForm.number" placeholder="题号" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="题干">
                <el-input 
                  v-model="editForm.topic" 
                  type="textarea" 
                  :autosize="{ minRows: 4, maxRows: 10 }"
                  placeholder="题目正文内容，支持 LaTeX 公式（$...$ 或 $$...$$）和图片 URL" 
                />
              </el-form-item>
              <!-- 题干预览 -->
              <div class="preview-section" v-if="editForm.topic">
                <div class="preview-title">题干预览</div>
                <div class="preview-content" v-html="renderLatex(editForm.topic)"></div>
              </div>
              <el-form-item label="题干图片">
                <el-input v-model="editForm.topic_image" placeholder="图片URL or 路径" />
              </el-form-item>
              
              <!-- 选项编辑 -->
              <div class="options-section">
                <div class="section-title">选项设置</div>
                <div v-for="(opt, index) in editForm.options" :key="index" class="option-item">
                  <div class="option-header">
                    <el-radio v-model="editForm.answer" :label="opt.label" class="option-radio">
                      <span class="option-label">{{ opt.label }}</span>
                    </el-radio>
                    <el-button type="danger" link size="small" @click="editForm.options.splice(index, 1)">
                      <el-icon><Delete /></el-icon> 删除
                    </el-button>
                  </div>
                  <el-input
                    v-model="editForm.options[index].content"
                    type="textarea"
                    :autosize="{ minRows: 2, maxRows: 6 }"
                    placeholder="选项内容，支持 LaTeX 公式"
                    class="option-input"
                  />
                </div>
                <el-button type="primary" plain size="small" @click="addOption">
                  <el-icon><Plus /></el-icon> 添加选项
                </el-button>
              </div>

              <!-- 选项预览 -->
              <div class="preview-section" v-if="editForm.options && editForm.options.length > 0">
                <div class="preview-title">选项预览</div>
                <div class="preview-content">
                  <div v-for="(opt, index) in editForm.options" :key="index" class="preview-option">
                    <el-radio v-model="editForm.answer" :label="opt.label" disabled>
                      <strong>{{ opt.label }}.</strong>
                      <span v-html="renderLatex(opt.content)"></span>
                    </el-radio>
                  </div>
                </div>
              </div>
              
              <el-row :gutter="20" style="margin-top: 20px;">
                <el-col :span="12">
                  <el-form-item label="正确答案">
                    <el-input v-model="editForm.answer" placeholder="例如: A 或 A,B" readonly>
                      <template #append>
                        <el-tooltip content="点击选项左侧的单选按钮选择答案">
                          <el-icon><InfoFilled /></el-icon>
                        </el-tooltip>
                      </template>
                    </el-input>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="题目类型">
                    <el-select v-model="editForm.type" placeholder="选择题型" style="width: 100%">
                      <el-option label="单选题" value="单选题" />
                      <el-option label="多选题" value="多选题" />
                      <el-option label="判断题" value="判断题" />
                      <el-option label="填空题" value="填空题" />
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>
            </div>

            <!-- 解析详情 -->
            <div v-show="activeEditTab === 'analysis'" class="tab-panel">
              <h3 class="panel-title">解析详情</h3>
              
              <el-form-item label="考点还原">
                <div class="editor-container">
                  <Editor
                    v-model="editForm.analysis"
                    :defaultConfig="editorConfig"
                    mode="default"
                    class="auto-height-editor"
                  />
                </div>
              </el-form-item>
              
              <el-form-item label="基础解析">
                <div class="editor-container">
                  <Editor
                    v-model="editForm.basic_analysis"
                    :defaultConfig="editorConfig"
                    mode="default"
                    class="auto-height-editor"
                  />
                </div>
              </el-form-item>
              
              <el-form-item label="基础解析图片">
                <el-input v-model="editForm.basic_analysis_image" />
              </el-form-item>
              
              <el-form-item label="分项解析">
                <div class="editor-container">
                  <Editor
                    v-model="editForm.itemize_analysis"
                    :defaultConfig="editorConfig"
                    mode="default"
                    class="auto-height-editor"
                  />
                </div>
              </el-form-item>
              
              <el-form-item label="分项解析图片">
                <el-input v-model="editForm.itemize_analysis_image" />
              </el-form-item>
              
              <el-form-item label="视频解析链接">
                <el-input v-model="editForm.video_url" placeholder="视频URL" />
              </el-form-item>
            </div>

            <!-- 资源与图谱 -->
            <div v-show="activeEditTab === 'resource'" class="tab-panel">
              <h3 class="panel-title">资源与图谱</h3>
              <el-form-item label="比较总结">
                <el-input v-model="editForm.comparison_summary" type="textarea" :rows="3" />
              </el-form-item>
              <!-- 比较总结表格预览 -->
              <div class="preview-section" v-if="editForm.comparison_summary">
                <div class="preview-title">比较总结预览</div>
                <div class="preview-content table-preview" v-html="renderMarkdownTable(editForm.comparison_summary)"></div>
              </div>
              <el-form-item label="比较总结图片">
                <el-input v-model="editForm.comparison_images" placeholder="JSON数组字符串" />
              </el-form-item>
              <el-form-item label="思维导图文本">
                <el-input v-model="editForm.mind_map" type="textarea" :rows="3" />
              </el-form-item>
              <el-form-item label="思维导图图片">
                <el-input v-model="editForm.mind_map_image" />
              </el-form-item>
              <el-form-item label="知识点图片">
                <el-input v-model="editForm.knowledge_image" />
              </el-form-item>
            </div>

            <!-- 其他设置 -->
            <div v-show="activeEditTab === 'settings'" class="tab-panel">
              <h3 class="panel-title">其他设置</h3>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="年份">
                    <el-input v-model="editForm.year" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="题号">
                    <el-input v-model="editForm.number" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="分值">
                    <el-input-number v-model="editForm.score" :min="0" :precision="1" style="width: 100%" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="分值描述">
                    <el-input v-model="editForm.score_describe" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="题型标识">
                    <el-input v-model="editForm.question_type_option" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="栏目ID">
                    <el-input v-model="editForm.column_id" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="排序值">
                    <el-input-number v-model="editForm.sort" style="width: 100%" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="状态">
                    <el-switch v-model="editForm.status" :active-value="1" :inactive-value="0" active-text="有效" inactive-text="下架" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="题目内部ID">
                <el-input v-model="editForm.question_id" disabled />
              </el-form-item>
            </div>
          </el-form>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveQuestion">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 反馈处理对话框 -->
    <el-dialog v-model="feedbackVisible" title="处理纠错反馈" width="60%">
      <div v-if="currentFeedback" class="feedback-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="题目ID">{{ currentFeedback.QuestionID }}</el-descriptions-item>
          <el-descriptions-item label="反馈类型">{{ currentFeedback.Type }}</el-descriptions-item>
          <el-descriptions-item label="反馈内容" :span="2">{{ currentFeedback.Content }}</el-descriptions-item>
        </el-descriptions>
        <div class="admin-remark">
          <p>管理员备注：</p>
          <el-input v-model="adminRemark" type="textarea" :rows="3" placeholder="输入处理备注..." />
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="feedbackVisible = false">取消</el-button>
          <el-button type="success" @click="updateFeedback(2)">标记为已处理</el-button>
          <el-button type="primary" @click="updateFeedback(1)">仅保存备注</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, Delete, Plus, InfoFilled, Document, DataAnalysis, Collection, Setting } from '@element-plus/icons-vue'
import adminApi from '../api'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { Editor } from '@wangeditor/editor-for-vue'
import '@wangeditor/editor/dist/css/style.css'

const activeTab = ref('feedback')

// 编辑对话框左侧导航
const activeEditTab = ref('basic')
const sidebarItems = [
  { key: 'basic', label: '基本信息', icon: 'Document' },
  { key: 'analysis', label: '解析详情', icon: 'DataAnalysis' },
  { key: 'resource', label: '资源与图谱', icon: 'Collection' },
  { key: 'settings', label: '其他设置', icon: 'Setting' }
]

// 富文本编辑器配置
const editorConfig = {
  placeholder: '请输入内容...',
  MENU_CONF: {
    uploadImage: {
      server: '/api/upload/image',
      fieldName: 'file',
      maxFileSize: 5 * 1024 * 1024,
      maxNumberOfFiles: 10,
      allowedFileTypes: ['image/*'],
      metaWithUrl: true,
      customInsert(res, insertFn) {
        insertFn(res.url, res.alt || '', res.href || '')
      }
    }
  }
}
const loading = ref(false)
const feedbacks = ref([])
const feedbackTotal = ref(0)
const feedbackFilter = reactive({
  page: 1,
  limit: 10,
  status: 1
})

const questions = ref([])
const questionTotal = ref(0)
const questionFilter = reactive({
  page: 1,
  size: 10,
  keyword: '',
  course_id: '',
  chapter_id: '',
  year: '',
  question_type_option: '',
  status: ''
})

const courses = ref([])
const chapters = ref([])
const dialogChapters = ref([])
const manageChapters = ref([])
const loadingChapters = ref(false)
const chapterFilter = reactive({
  course_id: ''
})

const dialogVisible = ref(false)
const dialogTitle = ref('编辑题目')
const editForm = ref(null)

const feedbackVisible = ref(false)
const currentFeedback = ref(null)
const adminRemark = ref('')

const importFiles = ref([])

onMounted(() => {
  fetchCourses()
  fetchFeedbacks()
  fetchQuestions()
})

const fetchCourses = async () => {
  try {
    const res = await adminApi.getMedCourses()
    if (res.code === 0) {
      courses.value = res.data
      if (courses.value.length > 0) {
        chapterFilter.course_id = courses.value[0].courseId
        fetchChaptersForManage()
      }
    }
  } catch (error) {
    ElMessage.error('获取科目失败')
  }
}

const handleCourseChange = async (val) => {
  questionFilter.chapter_id = ''
  if (!val) {
    chapters.value = []
    fetchQuestions()
    return
  }
  try {
    const res = await adminApi.getMedChapters({ course_id: val })
    if (res.code === 0) {
      chapters.value = res.data
    }
    fetchQuestions()
  } catch (error) {
    ElMessage.error('获取章节失败')
  }
}

const handleDialogCourseChange = async (val) => {
  if (!val) {
    dialogChapters.value = []
    return
  }
  try {
    const res = await adminApi.getMedChapters({ course_id: val })
    if (res.code === 0) {
      dialogChapters.value = res.data
    }
  } catch (error) {
    console.error('获取章节失败:', error)
  }
}

const fetchChaptersForManage = async () => {
  loadingChapters.value = true
  try {
    const res = await adminApi.getMedChapters({ course_id: chapterFilter.course_id })
    if (res.code === 0) {
      // 为每个章节添加科目名称
      manageChapters.value = res.data.map(chapter => {
        const course = courses.value.find(c => c.courseId === chapter.courseId)
        return {
          ...chapter,
          courseName: course ? course.courseName : ''
        }
      })
    }
  } catch (error) {
    ElMessage.error('获取章节失败')
  } finally {
    loadingChapters.value = false
  }
}

const fetchFeedbacks = async () => {
  loading.value = true
  try {
    const res = await adminApi.getMedFeedbacks(feedbackFilter)
    if (res.code === 0) {
      feedbacks.value = res.data.list
      feedbackTotal.value = res.data.total
    }
  } catch (error) {
    ElMessage.error('获取反馈失败')
  } finally {
    loading.value = false
  }
}

const fetchQuestions = async () => {
  loading.value = true
  try {
    const res = await adminApi.searchMedQuestions(questionFilter)
    if (res.code === 0) {
      questions.value = res.data.list
      questionTotal.value = res.data.total
    }
  } catch (error) {
    ElMessage.error('获取题目失败')
  } finally {
    loading.value = false
  }
}

const handleEditFeedback = (row) => {
  currentFeedback.value = row
  adminRemark.value = row.AdminRemark || ''
  feedbackVisible.value = true
}

const updateFeedback = async (status) => {
  try {
    const res = await adminApi.updateMedFeedbackStatus(currentFeedback.value.id, {
      status,
      adminRemark: adminRemark.value
    })
    if (res.code === 0) {
      ElMessage.success('更新成功')
      feedbackVisible.value = false
      fetchFeedbacks()
    }
  } catch (error) {
    ElMessage.error('更新失败')
  }
}

const handleEditQuestion = async (row) => {
  try {
    const res = await adminApi.getMedQuestionDetail(row.question_id)
    if (res.code === 0) {
      editForm.value = parseQuestionData(res.data)
      // 获取对话框中的章节列表
      if (editForm.value.course_id) {
        await handleDialogCourseChange(editForm.value.course_id)
      }
      dialogVisible.value = true
    }
  } catch (error) {
    ElMessage.error('获取题目详情失败')
  }
}

const handleDeleteQuestion = (row) => {
  ElMessageBox.confirm('确定要删除该题目吗？', '提示', {
    type: 'warning'
  }).then(async () => {
    try {
      const res = await adminApi.deleteQuestion('med', row.question_id)
      if (res.code === 0) {
        ElMessage.success('删除成功')
        fetchQuestions()
      }
    } catch (error) {
      ElMessage.error('删除失败')
    }
  })
}

// 从错题反馈中编辑题目
const handleEditQuestionFromFeedback = async (row) => {
  if (!row.QuestionID) {
    ElMessage.warning('该反馈没有关联的题目ID')
    return
  }
  try {
    const res = await adminApi.getMedQuestionDetail(row.QuestionID)
    if (res.code === 0) {
      editForm.value = parseQuestionData(res.data)
      // 获取对话框中的章节列表
      if (editForm.value.course_id) {
        await handleDialogCourseChange(editForm.value.course_id)
      }
      dialogVisible.value = true
    }
  } catch (error) {
    ElMessage.error('获取题目详情失败')
  }
}

// 解析题目数据，处理 content 字段的特殊结构
const parseQuestionData = (data) => {
  const parsed = { ...data }
  
  // 解析 content 字段
  if (typeof parsed.content === 'string') {
    try {
      // 第一次解析：将 JSON 字符串解析为数组
      const contentArr = JSON.parse(parsed.content)
      
      if (Array.isArray(contentArr) && contentArr.length > 0) {
        // 第二次解析：解析数组中的每个元素
        parsed.options = contentArr.map((item, index) => {
          try {
            // 每个元素是一个 JSON 字符串，需要再次解析
            const opt = typeof item === 'string' ? JSON.parse(item) : item
            return {
              label: opt.choose || String.fromCharCode(65 + index),
              content: opt.content || '',
              answer: opt.answer || '',
              isCorrect: opt.right === 'true' || opt.right === true
            }
          } catch (e) {
            // 解析失败，返回原始内容
            return { 
              label: String.fromCharCode(65 + index), 
              content: typeof item === 'string' ? item : JSON.stringify(item), 
              answer: '', 
              isCorrect: false 
            }
          }
        })
        
        // 从第一个选项中提取答案
        try {
          const firstOpt = typeof contentArr[0] === 'string' ? JSON.parse(contentArr[0]) : contentArr[0]
          parsed.parsedAnswer = firstOpt.answer || ''
        } catch (e) {
          parsed.parsedAnswer = parsed.answer || ''
        }
      } else {
        parsed.options = []
        parsed.parsedAnswer = parsed.answer || ''
      }
    } catch (e) {
      // 如果解析失败，尝试作为普通字符串处理
      parsed.options = [{
        label: 'A',
        content: parsed.content,
        answer: parsed.answer || '',
        isCorrect: false
      }]
      parsed.parsedAnswer = parsed.answer || ''
    }
  } else if (Array.isArray(parsed.content)) {
    // content 已经是数组
    parsed.options = parsed.content.map((item, index) => {
      try {
        const opt = typeof item === 'string' ? JSON.parse(item) : item
        return {
          label: opt.choose || String.fromCharCode(65 + index),
          content: opt.content || '',
          answer: opt.answer || '',
          isCorrect: opt.right === 'true' || opt.right === true
        }
      } catch (e) {
        return { 
          label: String.fromCharCode(65 + index), 
          content: typeof item === 'string' ? item : JSON.stringify(item), 
          answer: '', 
          isCorrect: false 
        }
      }
    })
    
    try {
      const firstOpt = typeof parsed.content[0] === 'string' ? JSON.parse(parsed.content[0]) : parsed.content[0]
      parsed.parsedAnswer = firstOpt.answer || parsed.answer || ''
    } catch (e) {
      parsed.parsedAnswer = parsed.answer || ''
    }
  } else {
    parsed.options = []
    parsed.parsedAnswer = parsed.answer || ''
  }
  
  // 确保 answer 字段正确
  if (parsed.parsedAnswer && !parsed.answer) {
    parsed.answer = parsed.parsedAnswer
  }
  
  return parsed
}

// 添加新选项
const addOption = () => {
  if (!editForm.value.options) {
    editForm.value.options = []
  }
  const nextLabel = String.fromCharCode(65 + editForm.value.options.length)
  editForm.value.options.push({
    label: nextLabel,
    content: '',
    answer: editForm.value.answer || '',
    isCorrect: false
  })
}

// 将选项转换为后端存储格式
const formatOptionsForSave = (options, answer) => {
  return options.map(opt => ({
    answer: answer,
    choose: opt.label,
    right: answer.includes(opt.label) ? 'true' : 'false',
    content: opt.content
  }))
}

// 将富文本 HTML 转换为纯文本
const htmlToText = (html) => {
  if (!html) return ''
  // 创建一个临时 div 来解析 HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  // 获取纯文本内容
  let text = tempDiv.textContent || tempDiv.innerText || ''
  
  // 去除多余的空白字符
  text = text.replace(/\s+/g, ' ').trim()
  
  return text
}

// 从富文本中提取图片 URL
const extractImagesFromHtml = (html) => {
  if (!html) return ''
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  const images = tempDiv.querySelectorAll('img')
  const imageUrls = Array.from(images).map(img => img.src).filter(src => src)
  return imageUrls.length > 0 ? JSON.stringify(imageUrls) : ''
}

const saveQuestion = async () => {
  try {
    // 构建保存数据
    const saveData = { ...editForm.value }
    
    // 将 options 转换为 content 字段的格式
    if (saveData.options && saveData.options.length > 0) {
      saveData.content = JSON.stringify(formatOptionsForSave(saveData.options, saveData.answer))
    }
    
    // 将富文本解析内容转换为纯文本
    if (saveData.analysis) {
      saveData.analysis = htmlToText(saveData.analysis)
    }
    if (saveData.basic_analysis) {
      saveData.basic_analysis = htmlToText(saveData.basic_analysis)
      // 同时提取图片保存到 basic_analysis_image
      const images = extractImagesFromHtml(editForm.value.basic_analysis)
      if (images) {
        saveData.basic_analysis_image = images
      }
    }
    if (saveData.itemize_analysis) {
      saveData.itemize_analysis = htmlToText(saveData.itemize_analysis)
      // 同时提取图片保存到 itemize_analysis_image
      const images = extractImagesFromHtml(editForm.value.itemize_analysis)
      if (images) {
        saveData.itemize_analysis_image = images
      }
    }
    
    // 删除前端使用的临时字段
    delete saveData.options
    delete saveData.parsedAnswer
    
    const res = await adminApi.updateMedQuestion(saveData.question_id, saveData)
    if (res.code === 0) {
      ElMessage.success('保存成功')
      dialogVisible.value = false
      fetchQuestions()
    }
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

const fileInput = ref(null)

const triggerFileUpload = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event) => {
  const files = event.target.files
  if (!files || files.length === 0) return
  
  Array.from(files).forEach(file => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        importFiles.value.push({
          filename: file.name,
          size: (file.size / 1024).toFixed(2) + ' KB',
          status: 'pending',
          data: data
        })
      } catch (err) {
        ElMessage.error(`解析 ${file.name} 失败: ${err.message}`)
      }
    }
    reader.readAsText(file)
  })
  
  // 清空 input 以便可以重复选择相同文件
  event.target.value = ''
}

const removeImportFile = (index) => {
  importFiles.value.splice(index, 1)
}

const hasPendingFiles = computed(() => {
  return importFiles.value.some(f => f.status === 'pending')
})

const importAllFiles = async () => {
  const pendingFiles = importFiles.value.filter(f => f.status === 'pending')
  if (pendingFiles.length === 0) return
  
  for (const file of pendingFiles) {
    await handleImport(file)
  }
}

const handleImport = async (file) => {
  file.status = 'importing'
  try {
    const res = await adminApi.importMedFile({
      filename: file.filename,
      jsonData: file.data
    })
    if (res.code === 0) {
      file.status = 'success'
      ElMessage.success(`${file.filename} 导入成功`)
      fetchCourses()
    } else {
      file.status = 'error'
      ElMessage.error(`${file.filename} 导入失败: ${res.message}`)
    }
  } catch (error) {
    file.status = 'error'
    ElMessage.error(`${file.filename} 导入出错`)
  }
}

const getStatusType = (status) => {
  const map = {
    pending: 'info',
    importing: 'warning',
    success: 'success',
    error: 'danger'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    pending: '待导入',
    importing: '导入中',
    success: '导入成功',
    error: '导入失败'
  }
  return map[status] || status
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString()
}

// 编辑科目名称
const handleEditCourseName = (row) => {
  ElMessageBox.prompt('请输入新的科目名称', '编辑科目', {
    inputValue: row.courseName,
    confirmButtonText: '保存',
    cancelButtonText: '取消',
  }).then(async ({ value }) => {
    if (!value || value.trim() === '') {
      ElMessage.warning('科目名称不能为空')
      return
    }
    try {
      const res = await adminApi.updateMedCourse(row.courseId, { courseName: value.trim() })
      if (res.code === 0) {
        ElMessage.success('科目修改成功')
        // 更新本地数据
        const course = courses.value.find(c => c.courseId === row.courseId)
        if (course) {
          course.courseName = value.trim()
        }
        // 更新表格中的科目名称
        manageChapters.value.forEach(ch => {
          if (ch.courseId === row.courseId) {
            ch.courseName = value.trim()
          }
        })
      }
    } catch (error) {
      ElMessage.error('修改失败')
    }
  })
}

// 编辑章节名称
const handleEditChapterName = (row) => {
  ElMessageBox.prompt('请输入新的章节名称', '编辑章节', {
    inputValue: row.chapterName,
    confirmButtonText: '保存',
    cancelButtonText: '取消',
  }).then(async ({ value }) => {
    if (!value || value.trim() === '') {
      ElMessage.warning('章节名称不能为空')
      return
    }
    try {
      const res = await adminApi.updateMedChapter(row.chapterId, { chapterName: value.trim() })
      if (res.code === 0) {
        ElMessage.success('章节修改成功')
        // 更新本地数据
        const chapter = manageChapters.value.find(c => c.chapterId === row.chapterId)
        if (chapter) {
          chapter.chapterName = value.trim()
        }
      }
    } catch (error) {
      ElMessage.error('修改失败')
    }
  })
}

// 保留旧函数以兼容其他可能的使用
const handleEditCourse = handleEditCourseName
const handleEditChapter = handleEditChapterName

// 渲染 Markdown 表格
const renderMarkdownTable = (text) => {
  if (!text) return ''
  
  const lines = text.trim().split('\n')
  if (lines.length < 2) return text
  
  // 检查是否是表格格式
  const hasTableFormat = lines.some(line => line.includes('|'))
  if (!hasTableFormat) return text
  
  // 处理 Markdown 加粗语法 **text**
  const processBold = (cell) => {
    return cell.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  }
  
  let html = '<table class="markdown-table">'
  let isFirstRow = true
  let hasHeader = false
  
  lines.forEach((line, index) => {
    line = line.trim()
    if (!line) return
    
    // 跳过分隔行 (|---|---|...)
    if (line.match(/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/)) {
      hasHeader = true
      return
    }
    
    if (line.includes('|')) {
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell)
      
      if (cells.length > 0) {
        if (isFirstRow) {
          // 表头
          html += '<thead><tr>'
          cells.forEach(cell => {
            html += `<th>${processBold(cell)}</th>`
          })
          html += '</tr></thead><tbody>'
          isFirstRow = false
        } else {
          // 表格内容
          html += '<tr>'
          cells.forEach(cell => {
            html += `<td>${processBold(cell)}</td>`
          })
          html += '</tr>'
        }
      }
    }
  })
  
  if (!isFirstRow) {
    html += '</tbody></table>'
    return html
  }
  
  return text
}

// 渲染LaTeX（支持图片、Markdown和自定义样式）
const renderLatex = (text) => {
  if (!text) return ''

  const placeholders = []
  const createPlaceholder = (content, type = 'html') => {
    const p = `__LATEX_JS_${type.toUpperCase()}_PH_${placeholders.length}__`
    placeholders.push({ p, content, type })
    return p
  }

  let currentText = text.trim().replace(/\t/g, ' ').replace(/ {2,}/g, ' ')
  
  // 0. 预处理：将公式内的换行符替换为空格，避免破坏 KaTeX 渲染
  const formulaPlaceholders = []
  let formulaRegex
  try {
    formulaRegex = /(\$\$[\s\S]*?\$\$)|((?<!\\)\$([\s\S]+?)(?<!\\)\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))/g
  } catch (e) {
    formulaRegex = /(\$\$[\s\S]*?\$\$)|(\$([\s\S]+?)\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))/g
  }
  
  currentText = currentText.replace(formulaRegex, (match) => {
    const cleanedFormula = match.replace(/\n/g, ' ')
    const p = `__FORMULA_TEMP_${formulaPlaceholders.length}__`
    formulaPlaceholders.push({ p, original: match, cleaned: cleanedFormula })
    return p
  })
  
  formulaPlaceholders.forEach(({ p, cleaned }) => {
    currentText = currentText.replace(p, cleaned)
  })
  
  // 1. 提取并保护所有数学公式
  let mathRegex
  try {
    mathRegex = /(\$\$[\s\S]*?\$\$)|((?<!\\)\$([\s\S]+?)(?<!\\)\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))/g
  } catch (e) {
    mathRegex = /(\$\$[\s\S]*?\$\$)|(\$([\s\S]+?)\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))/g
  }
  
  currentText = currentText.replace(mathRegex, (match, p1, p2, p3, p4, p5) => {
    let expression = ''
    let displayMode = false
    
    if (p1) {
      expression = p1.slice(2, -2)
      displayMode = true
    } else if (p2) {
      expression = p3
      displayMode = false
    } else if (p4) {
      expression = p4.slice(2, -2)
      displayMode = true
    } else if (p5) {
      expression = p5.slice(2, -2)
      displayMode = false
    }
    
    if (!expression.trim()) return match
    
    try {
      const rendered = katex.renderToString(expression, {
        throwOnError: false,
        displayMode: displayMode,
        strict: false
      })
      return createPlaceholder(rendered, 'math')
    } catch (e) {
      console.warn('KaTeX render error:', e)
      return match
    }
  })

  // 2. 反转义 HTML 实体
  currentText = currentText
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")

  // 3. 处理 《答案》等自定义标签
  currentText = currentText
    .replace(/《答案》/g, '<span class="custom-tag answer">【答案】</span>')
    .replace(/《\/答案》/g, '')
    .replace(/《分析》/g, '<span class="custom-tag analysis">【思路分析】</span>')
    .replace(/《\/分析》/g, '')
    .replace(/《点评》/g, '<span class="custom-tag commentary">【点评】</span>')
    .replace(/《\/点评》/g, '')
    .replace(/《注释》/g, '<span class="custom-tag note">')
    .replace(/《\/注释》/g, '</span>')
    .replace(/《步骤》/g, '<span class="custom-tag step">【步骤】</span>')
    .replace(/《\/步骤》/g, '')

  // 4. 处理 \color 和 \bold 命令
  currentText = currentText
    .replace(/\\color\{#([0-9A-Fa-f]{6})\}\{([^}]+)\}/g, '<span style="color:#$1;">$2</span>')
    .replace(/\\bold\{([^}]+)\}/g, '<b>$1</b>')
    .replace(/\\mathbf\{([^}]+)\}/g, '<b>$1</b>')

  // 5. 处理 Markdown 格式图片 ![alt](url)
  currentText = currentText.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt, url) => {
      let decodedUrl = url
      try {
        decodedUrl = decodeURIComponent(url)
      } catch (e) {}
      const cleanUrl = decodedUrl.replace(/(_yjs|_thumb|_small|_medium|_large)(\?.*)?$/i, '$2')
      return `<img src="${cleanUrl}" alt="${alt}" style="max-width:100%;height:auto;display:block;margin:10px 0;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" onerror="this.style.display='none'" />`
    }
  )

  // 5.1 处理 ! `url` 格式
  currentText = currentText.replace(
    /!\s*`\s*(https?:\/\/[^\s`]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp)(?:_yjs|_thumb|_small|_medium|_large)?)\s*`/gi,
    (match, url) => {
      let decodedUrl = url
      try {
        decodedUrl = decodeURIComponent(url)
      } catch (e) {}
      const cleanUrl = decodedUrl.replace(/(_yjs|_thumb|_small|_medium|_large)(\?.*)?$/i, '$2')
      return `<img src="${cleanUrl}" alt="" style="max-width:100%;height:auto;display:block;margin:10px 0;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" onerror="this.style.display='none'" />`
    }
  )

  // 6. 处理图片URL
  currentText = currentText.replace(
    /(https?:\/\/[^\s<>"]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp))(?:_yjs|_thumb|_small|_medium|_large)?(?!["'])/gi,
    (match, url) => {
      const cleanUrl = url.replace(/(_yjs|_thumb|_small|_medium|_large)$/i, '')
      return `<img src="${cleanUrl}" style="max-width:100%;height:auto;display:block;margin:10px 0;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" onerror="this.style.display='none'" />`
    }
  )

  // 7. 还原占位符
  placeholders.forEach(({ p, content }) => {
    currentText = currentText.replace(p, content)
  })

  // 8. 将换行符转换为 <br>
  currentText = currentText.replace(/\n/g, '<br>')

  return currentText
}
</script>

<style scoped>
.med-manage-container {
  padding: 20px;
}
.tab-header {
  margin-bottom: 20px;
}
.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
.course-manage-layout {
  display: flex;
  gap: 20px;
}
.course-list, .chapter-list {
  flex: 1;
}
.import-container {
  padding: 20px;
}
.import-actions {
  margin-bottom: 20px;
}
.upload-tip {
  margin-left: 15px;
  color: #909399;
  font-size: 14px;
}
.option-item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
.option-label {
  width: 30px;
  font-weight: bold;
}
.form-section {
  margin-bottom: 25px;
  padding: 15px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}
.form-section h4 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #409eff;
  border-bottom: 1px solid #ebeef5;
  padding-bottom: 10px;
}
.feedback-detail {
  margin-bottom: 20px;
}
.admin-remark {
  margin-top: 20px;
}

/* 科目章节管理样式 */
.course-chapter-manage {
  padding: 10px;
}
.course-chapter-manage .filter-bar {
  margin-bottom: 15px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
}
.course-chapter-manage .empty-data {
  margin-top: 40px;
}

/* 选项编辑区域样式 */
.options-section {
  margin: 20px 0;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 8px;
}
.options-section .section-title {
  font-weight: bold;
  color: #409eff;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e4e7ed;
}
.option-item {
  margin-bottom: 15px;
  padding: 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
}
.option-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.option-radio {
  margin-right: 10px;
}
.option-label {
  font-weight: bold;
  font-size: 16px;
  color: #303133;
}
.option-input {
  width: 100%;
}
.preview-option {
  margin-bottom: 10px;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
}
.preview-option :deep(.el-radio__input.is-disabled + span.el-radio__label) {
  color: #303133;
}
.preview-option :deep(.el-radio__input.is-disabled.is-checked .el-radio__inner) {
  background-color: #409eff;
  border-color: #409eff;
}

/* 上传卡片样式 */
.upload-card {
  border: 2px dashed #dcdfe6;
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #fafafa;
  margin-bottom: 20px;
}
.upload-card:hover {
  border-color: #409eff;
  background: #f0f9ff;
}
.upload-icon-box {
  margin-bottom: 16px;
}
.upload-main-text {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 8px;
}
.upload-sub-text {
  font-size: 13px;
  color: #909399;
}

/* 列表头部样式 */
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px 0;
  border-bottom: 1px solid #ebeef5;
}
.list-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

/* 自定义标签样式 */
:deep(.custom-tag) {
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
  margin-right: 5px;
}
:deep(.custom-tag.answer) {
  color: #009688;
}
:deep(.custom-tag.analysis) {
  color: #009688;
}
:deep(.custom-tag.commentary) {
  color: #FF5405;
}
:deep(.custom-tag.step) {
  color: #FF5405;
}
:deep(.custom-tag.note) {
  color: #666;
  font-style: italic;
}

/* 预览区域样式 */
.preview-section {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 15px;
  margin-top: 10px;
}
.preview-title {
  font-weight: bold;
  color: #409eff;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e4e7ed;
}
.preview-content {
  background: white;
  padding: 15px;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
  min-height: 100px;
  max-height: 400px;
  overflow-y: auto;
  line-height: 1.6;
}
.preview-content :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 10px 0;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* Markdown 表格样式 */
.markdown-table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 12px;
}

.markdown-table thead {
  background-color: #f5f7fa;
}

.markdown-table th,
.markdown-table td {
  border: 1px solid #dcdfe6;
  padding: 6px 8px;
  text-align: left;
}

.markdown-table th {
  font-weight: 600;
  color: #303133;
  background-color: #f5f7fa;
}

.markdown-table td {
  color: #606266;
}

.markdown-table tbody tr:hover {
  background-color: #f5f7fa;
}

/* 编辑对话框样式 */
.edit-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.edit-dialog-container {
  display: flex;
  min-height: 600px;
  max-height: 70vh;
}

/* 左侧导航栏 */
.edit-sidebar {
  width: 140px;
  background: #f5f7fa;
  border-right: 1px solid #e4e7ed;
  padding: 20px 0;
  flex-shrink: 0;
}

.sidebar-item {
  display: flex;
  align-items: center;
  padding: 15px 20px;
  cursor: pointer;
  transition: all 0.3s;
  color: #606266;
  font-size: 14px;
}

.sidebar-item:hover {
  background: #e6f2ff;
  color: #409eff;
}

.sidebar-item.active {
  background: #409eff;
  color: white;
}

.sidebar-item .el-icon {
  margin-right: 8px;
  font-size: 16px;
}

/* 右侧内容区 */
.edit-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  max-height: 70vh;
}

.tab-panel {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.panel-title {
  margin: 0 0 20px 0;
  padding-bottom: 15px;
  border-bottom: 2px solid #409eff;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
}

/* 富文本编辑器容器 */
.editor-container {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  width: 100%;
}

/* 自适应高度编辑器 */
.auto-height-editor {
  height: auto !important;
}

.auto-height-editor :deep([data-w-e-textarea="true"]) {
  height: auto !important;
  min-height: 80px;
}

.editor-container :deep(.w-e-text-container) {
  min-height: 80px;
  height: auto !important;
}

.editor-container :deep(.w-e-text-container .w-e-scroll) {
  min-height: 80px;
  height: auto !important;
  overflow-y: visible;
}

.editor-container :deep(.w-e-text-container .w-e-scroll div[data-slate-editor="true"]) {
  min-height: 60px;
  padding: 10px;
}


</style>
