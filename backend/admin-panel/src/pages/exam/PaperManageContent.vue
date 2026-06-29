<template>
  <div class="computer-paper-manage">
    <h2>计算机试卷管理</h2>
    
    <!-- 搜索栏 -->
    <div class="filter-bar mb-20">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索试卷名称/学校/考试名称"
        style="width: 300px"
        clearable
        @keyup.enter="searchPapers"
      />
      <el-select 
        v-model="searchPaperType" 
        placeholder="试卷类型" 
        clearable 
        style="width: 150px; margin-left: 10px;"
        @change="searchPapers"
      >
        <el-option label="真题卷" :value="1" />
        <el-option label="模拟卷" :value="2" />
        <el-option label="组卷" :value="3" />
      </el-select>
      <el-select 
        v-model="searchMajorId" 
        placeholder="科目" 
        clearable 
        style="width: 150px; margin-left: 10px;"
        @change="searchPapers"
      >
        <el-option v-for="subject in subjects" :key="subject.id" :label="subject.name" :value="subject.id" />
      </el-select>
      <el-button type="primary" @click="searchPapers" style="margin-left: 10px;">搜索</el-button>
      <el-button @click="resetSearch">重置</el-button>
    </div>
    
    <!-- 试卷列表 -->
    <el-table :data="paperList" border v-loading="loading">
      <el-table-column type="index" label="序号" width="60" align="center" />
      <el-table-column prop="title" label="试卷名称" min-width="200" show-overflow-tooltip />
      <el-table-column prop="exam_full_name" label="考试全称" min-width="200" show-overflow-tooltip />
      <el-table-column prop="year" label="年份" width="80" align="center" />
      <el-table-column prop="school" label="学校/来源" width="120" show-overflow-tooltip />
      <el-table-column prop="paper_type" label="类型" width="80" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.paper_type === 1" type="success">真题卷</el-tag>
          <el-tag v-else-if="row.paper_type === 2" type="warning">模拟卷</el-tag>
          <el-tag v-else type="info">组卷</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="exam_code" label="科目" width="80" align="center" />
      <el-table-column prop="question_count" label="题目数" width="80" align="center" />
      <el-table-column prop="total_score" label="总分" width="80" align="center" />
      <el-table-column prop="duration" label="时长(分)" width="80" align="center" />
      <el-table-column prop="difficulty" label="难度" width="80" align="center" />
      <el-table-column prop="created_at" label="创建时间" width="160">
        <template #default="{ row }">
          {{ formatDate(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="viewDetail(row)">详情</el-button>
          <el-button type="warning" size="small" @click="editPaper(row)">编辑</el-button>
          <el-button type="danger" size="small" @click="deletePaper(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    
    <!-- 分页 -->
    <div class="pagination-container mt-20">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </div>
    
    <!-- 编辑试卷对话框 -->
    <el-dialog v-model="editDialogVisible" title="编辑试卷" width="600px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="试卷名称">
          <el-input v-model="editForm.title" />
        </el-form-item>
        <el-form-item label="考试全称">
          <el-input v-model="editForm.exam_full_name" />
        </el-form-item>
        <el-form-item label="年份">
          <el-input v-model="editForm.year" />
        </el-form-item>
        <el-form-item label="学校/来源">
          <el-input v-model="editForm.school" />
        </el-form-item>
        <el-form-item label="试卷类型">
          <el-radio-group v-model="editForm.paper_type">
            <el-radio-button :label="1">真题卷</el-radio-button>
            <el-radio-button :label="2">模拟卷</el-radio-button>
            <el-radio-button :label="3">组卷</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="总分">
          <el-input-number v-model="editForm.total_score" :min="0" :max="300" />
        </el-form-item>
        <el-form-item label="考试时长">
          <el-input-number v-model="editForm.duration" :min="0" :max="300" />
        </el-form-item>
        <el-form-item label="难度">
          <el-select v-model="editForm.difficulty" placeholder="选择难度" style="width: 100%;">
            <el-option label="简单" value="简单" />
            <el-option label="中等" value="中等" />
            <el-option label="困难" value="困难" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePaper" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
    
    <!-- 试卷详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="试卷详情" width="95%" top="3vh" :fullscreen="isFullscreen">
      <template #header>
        <div class="dialog-header">
          <span>试卷详情</span>
          <el-button type="primary" size="small" @click="isFullscreen = !isFullscreen">
            {{ isFullscreen ? '退出全屏' : '全屏' }}
          </el-button>
        </div>
      </template>
      <div v-if="currentPaper" class="paper-detail">
        <el-descriptions :column="4" border>
          <el-descriptions-item label="试卷名称">
            <el-input v-model="currentPaper.title" size="small" placeholder="试卷名称" />
          </el-descriptions-item>
          <el-descriptions-item label="考试全称">
            <el-input v-model="currentPaper.exam_full_name" size="small" placeholder="考试全称" />
          </el-descriptions-item>
          <el-descriptions-item label="年份">
            <el-input v-model="currentPaper.year" size="small" placeholder="如：2024年" />
          </el-descriptions-item>
          <el-descriptions-item label="学校/来源">
            <el-input v-model="currentPaper.school" size="small" placeholder="如：全国统考" />
          </el-descriptions-item>
          <el-descriptions-item label="类型">
            <el-select v-model="currentPaper.paper_type" size="small" style="width: 100%;">
              <el-option label="真题卷" :value="1" />
              <el-option label="模拟卷" :value="2" />
              <el-option label="组卷" :value="3" />
            </el-select>
          </el-descriptions-item>
          <el-descriptions-item label="科目">
            <el-input v-model="currentPaper.exam_code" size="small" placeholder="如：408" />
          </el-descriptions-item>
          <el-descriptions-item label="总分">
            <el-input-number v-model="currentPaper.total_score" size="small" :min="0" :max="300" style="width: 100%;" />
          </el-descriptions-item>
          <el-descriptions-item label="时长">
            <el-input-number v-model="currentPaper.duration" size="small" :min="0" :max="300" style="width: 100%;" />
          </el-descriptions-item>
        </el-descriptions>
        
        <div class="mt-10 flex-end">
          <el-button type="primary" size="small" @click="savePaperInfo" :loading="savingPaperInfo">保存试卷信息</el-button>
        </div>
        
        <div class="mt-20 flex-between">
          <h3>题目列表（共 {{ currentPaper.questions?.length || 0 }} 题）</h3>
          <div>
            <el-button type="danger" @click="syncPaperInfoToQuestions" :loading="syncingQuestions">
              <el-icon><DocumentChecked /></el-icon> 统一题目信息
            </el-button>
            <el-button type="primary" @click="saveQuestionsOrder" :loading="savingQuestions">保存题目修改</el-button>
          </div>
        </div>
        
        <div class="questions-list mt-10">
          <div v-for="(q, index) in currentPaper.questions" :key="q.question_id" class="question-item">
            <div class="question-header">
              <span class="question-index">第 {{ q.sort_order || index + 1 }} 题</span>
              <span class="question-type">{{ q.exercise_type_name }}</span>
              <span class="question-score">分值: {{ q.paper_score || q.total_score }}分</span>
              <el-button type="primary" size="small" @click.stop="handleEditQuestion(q)">编辑</el-button>
            </div>
            
            <!-- 题干 -->
            <div class="question-content math-content" v-html="renderMath(q.stem)"></div>
            
            <!-- 选项（单选/多选） -->
            <div v-if="q.options && q.options.length > 0" class="question-options">
              <div v-for="opt in q.options" :key="opt.option_key" class="option-item-inline">
                <span class="option-label">{{ opt.option_key }}.</span>
                <span class="math-content" v-html="renderMath(opt.option_value)"></span>
              </div>
            </div>
            
            <!-- 解答题小题 -->
            <div v-if="q.subs && q.subs.length > 0" class="question-subs">
              <div v-for="(sub, subIdx) in q.subs" :key="subIdx" class="sub-item">
                <div class="sub-header">({{ String.fromCharCode(97 + subIdx) }})</div>
                <div class="sub-content math-content" v-html="renderMath(sub.stem || sub.sub_stem)"></div>
                <div v-if="sub.answer || sub.sub_answer" class="sub-answer">
                  <strong>答案：</strong><span class="math-content" v-html="renderMath(sub.answer || sub.sub_answer)"></span>
                </div>
              </div>
            </div>
            
            <!-- 答案 -->
            <div class="question-answer">
              <strong>答案：</strong><span class="math-content" v-html="renderMath(q.answer)"></span>
            </div>
            
            <!-- 解析 -->
            <div v-if="q.analysis" class="question-analysis">
              <strong>解析：</strong><span class="math-content" v-html="renderMath(q.analysis)"></span>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
    
    <!-- 编辑题目对话框 -->
    <el-dialog v-model="questionEditVisible" title="编辑题目" width="1000px" top="3vh" class="question-edit-dialog">
      <el-form :model="questionEditForm" label-width="100px" class="question-edit-form">
        <!-- 基础信息行 -->
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="题型">
              <el-select v-model="questionEditForm.exercise_type" style="width: 100%;" @change="handleExerciseTypeChange">
                <el-option label="单选题" :value="1" />
                <el-option label="多选题" :value="2" />
                <el-option label="填空题" :value="3" />
                <el-option label="解答题" :value="4" />
                <el-option label="判断题" :value="5" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="难度">
              <el-rate v-model="questionEditForm.level" :max="5" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="分值">
              <el-input-number v-model="questionEditForm.total_score" :min="0" :max="100" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 科目章节行 -->
        <el-row :gutter="20">
          <el-col :span="6">
            <el-form-item label="所属科目">
              <el-select 
                v-model="questionEditForm.major_id" 
                style="width: 100%;" 
                placeholder="请选择科目" 
                @change="handleSubjectChange"
                :loading="loadingSubjectList"
              >
                <el-option 
                  v-for="s in subjectList" 
                  :key="s.major_id || s.id" 
                  :label="s.subject_name || s.name" 
                  :value="String(s.major_id || s.id)" 
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属章节">
              <div style="display: flex; gap: 8px;">
                <el-select 
                  v-model="questionEditForm.chapter_id" 
                  style="flex: 1; min-width: 200px;" 
                  placeholder="请选择章节"
                  :loading="loadingChapterList"
                >
                  <el-option 
                    v-for="c in chapterList" 
                    :key="c.chapter_id || c.id" 
                    :label="getChapterDisplayName(c)" 
                    :value="String(c.chapter_id || c.id)" 
                  />
                </el-select>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="题号">
              <el-input-number v-model="questionEditForm.exercise_number" :min="1" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 考试信息行 -->
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="考试年份">
              <el-input v-model="questionEditForm.exam_time" placeholder="如：2025年" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="学校/来源">
              <el-input v-model="questionEditForm.from_school" placeholder="如：全国统考" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="科目代码">
              <el-input v-model="questionEditForm.exam_code" placeholder="如：408" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 知识点标签 -->
        <el-form-item label="知识点标签">
          <div class="tags-list">
            <el-tag
              v-for="(tag, idx) in questionEditForm.knowledgeTags"
              :key="idx"
              closable
              @close="removeKnowledgeTag(idx)"
              class="tag-item"
            >
              {{ tag.tag_name || tag }}
            </el-tag>
            <el-button-group>
              <el-button type="primary" link size="small" @click="openSelectTagModal">
                <el-icon><Search /></el-icon> 从考点选择
              </el-button>
              <el-button type="success" link size="small" @click="addKnowledgeTagByInput">
                <el-icon><Plus /></el-icon> 输入添加
              </el-button>
            </el-button-group>
          </div>
        </el-form-item>
        
        <el-form-item label="题干" class="form-item-stem">
          <div class="editor-wrapper">
            <RichEditor v-model="questionEditForm.stem" placeholder="请输入题干" :height="120" />
          </div>
        </el-form-item>
        
        <el-form-item label="选项" v-if="questionEditForm.exercise_type === 1 || questionEditForm.exercise_type === 2 || questionEditForm.exercise_type === 5" class="form-item-options">
          <div class="options-list">
            <div v-for="(opt, idx) in questionEditForm.options" :key="idx" class="option-edit-row">
              <el-input v-model="opt.option_key" style="width: 50px;" placeholder="选项" size="small" />
              <div class="option-editor-wrapper">
                <RichEditor v-model="opt.option_value" placeholder="选项内容" :height="80" />
              </div>
              <el-button type="danger" size="small" @click="removeOption(idx)">删除</el-button>
            </div>
          </div>
          <el-button type="primary" size="small" @click="addOption" class="add-option-btn">
            <el-icon><Plus /></el-icon> 添加选项
          </el-button>
        </el-form-item>
        
        <!-- 解答题小题部分 -->
        <el-form-item label="小题列表" v-if="questionEditForm.exercise_type === 4">
          <div class="subs-list">
            <div v-for="(sub, idx) in questionEditForm.subs" :key="idx" class="sub-item-editor">
              <div class="sub-header">
                <span class="sub-index">小题 {{ idx + 1 }}</span>
                <el-input v-model="sub.score" placeholder="分值" style="width: 80px" size="small">
                  <template #append>分</template>
                </el-input>
                <el-button type="danger" size="small" @click="removeSub(idx)">删除</el-button>
              </div>
              <div class="sub-content">
                <el-form-item label="小题题干">
                  <RichEditor v-model="sub.stem" placeholder="请输入小题题干" :height="80" />
                </el-form-item>
                <el-form-item label="小题答案">
                  <RichEditor v-model="sub.answer" placeholder="请输入小题答案" :height="80" />
                </el-form-item>
                <el-form-item label="小题解析">
                  <RichEditor v-model="sub.analysis" placeholder="请输入小题解析" :height="80" />
                </el-form-item>
              </div>
            </div>
          </div>
          <el-button type="primary" size="small" @click="addSub" class="mt-10">
            <el-icon><Plus /></el-icon> 添加小题
          </el-button>
        </el-form-item>
        
        <el-form-item label="答案" class="form-item-answer">
          <div class="editor-wrapper">
            <RichEditor v-model="questionEditForm.answer" placeholder="请输入答案" :height="100" />
          </div>
        </el-form-item>
        
        <el-form-item label="解析" class="form-item-analysis">
          <div class="editor-wrapper">
            <RichEditor v-model="questionEditForm.analysis" placeholder="请输入解析" :height="120" />
          </div>
        </el-form-item>
        
        <el-form-item label="试卷分值" class="form-item-score">
          <el-input-number v-model="questionEditForm.paper_score" :min="0" :max="100" />
        </el-form-item>
        
        <el-form-item label="考试全称">
          <el-input v-model="questionEditForm.exam_full_name" placeholder="如：计算机学科基础综合" />
        </el-form-item>
        
        <el-form-item label="视频URL">
          <el-input v-model="questionEditForm.video_url" placeholder="请输入视频链接（如有）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="questionEditVisible = false">取消</el-button>
        <el-button type="primary" @click="saveQuestionEdit" :loading="savingQuestion">保存</el-button>
      </template>
    </el-dialog>

    <!-- 选择考点弹窗 -->
    <el-dialog
      v-model="selectTagModalVisible"
      title="选择考点"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form label-width="80px">
        <el-form-item label="选择科目">
          <el-select 
            v-model="selectTagForm.major_id" 
            placeholder="请选择科目" 
            clearable 
            style="width: 100%"
            @change="onSelectTagMajorChange"
          >
            <el-option v-for="s in subjectList" :key="s.id" :label="s.name" :value="String(s.id)" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="选择章节">
          <el-select 
            v-model="selectTagForm.chapter_id" 
            placeholder="请选择章节" 
            clearable 
            style="width: 100%"
            @change="onSelectTagChapterChange"
            :disabled="!selectTagForm.major_id"
          >
            <el-option v-for="c in selectTagChapters" :key="c.id" :label="c.name" :value="String(c.id)" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="选择考点">
          <el-select 
            v-model="selectTagForm.tag_id" 
            placeholder="请选择考点" 
            clearable 
            style="width: 100%"
            :disabled="!selectTagForm.chapter_id"
            filterable
          >
            <el-option 
              v-for="t in selectTagList" 
              :key="t.tag_id" 
              :label="t.tag_name" 
              :value="String(t.tag_id)"
            />
          </el-select>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="selectTagModalVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmSelectTag" :disabled="!selectTagForm.tag_id">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import { adminApi } from '@/api'
import RichEditor from '@/components/RichEditor.vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'

// 搜索条件
const searchKeyword = ref('')
const searchPaperType = ref('')
const searchMajorId = ref('')

// 列表数据
const paperList = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

// 科目列表
const subjects = ref([])

// 题目编辑用科目章节列表
const subjectList = ref([])
const chapterList = ref([])
const inferredChapterName = ref('') // 从考点推断的章节名称
const displayChapterName = ref('') // 显示的章节名称
const loadingSubjectList = ref(false)
const loadingChapterList = ref(false)

// 选择考点弹窗相关
const selectTagModalVisible = ref(false)
const selectTagForm = ref({
  major_id: '',
  chapter_id: '',
  tag_id: ''
})
const selectTagChapters = ref([])
const selectTagList = ref([])

// 编辑对话框
const editDialogVisible = ref(false)
const saving = ref(false)
const editForm = ref({
  id: '',
  title: '',
  exam_full_name: '',
  year: '',
  school: '',
  paper_type: 1,
  total_score: 150,
  duration: 180,
  difficulty: '中等'
})

// 详情对话框
const detailDialogVisible = ref(false)
const currentPaper = ref(null)
const isFullscreen = ref(false)
const savingQuestions = ref(false)
const calibratingPaper = ref(false)
const syncingQuestions = ref(false)
const savingPaperInfo = ref(false)

// 题目编辑对话框
const questionEditVisible = ref(false)
const savingQuestion = ref(false)
const questionEditForm = ref({
  question_id: '',
  exercise_type: 1,
  exercise_type_name: '',
  stem: '',
  options: [],
  answer: '',
  analysis: '',
  paper_score: 2,
  subs: []
})

// 渲染数学公式和图片
const renderMath = (content) => {
  if (!content) return ''
  let html = content
  
  // 处理 Markdown 图片 ![alt](url) -> <img src="url" alt="alt">
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;height:auto;display:block;margin:10px 0;">')
  
  // 处理 $...$ 行内公式 - 使用 katex 渲染
  html = html.replace(/\$([^$]+)\$/g, (match, formula) => {
    try {
      const rendered = katex.renderToString(formula, {
        throwOnError: false,
        displayMode: false,
        strict: false
      })
      return rendered
    } catch (e) {
      console.warn('KaTeX render error:', e)
      return match
    }
  })
  
  // 处理 $$...$$ 块级公式
  html = html.replace(/\$\$([^$]+)\$\$/g, (match, formula) => {
    try {
      const rendered = katex.renderToString(formula, {
        throwOnError: false,
        displayMode: true,
        strict: false
      })
      return rendered
    } catch (e) {
      console.warn('KaTeX render error:', e)
      return match
    }
  })
  
  // 处理代码块
  html = html.replace(/<code>([\s\S]*?)<\/code>/g, '<code class="code-block">$1</code>')
  
  // 处理段落换行
  html = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  
  // 保护已渲染的 HTML 元素（图片、代码块、公式等）
  const renderedElements = []
  
  // 保护图片
  html = html.replace(/<img[^>]*>/gi, (match) => {
    const placeholder = `__RENDERED_ELEMENT_${renderedElements.length}__`
    renderedElements.push({ placeholder, content: match })
    return placeholder
  })
  
  // 保护代码块
  html = html.replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, (match) => {
    const placeholder = `__RENDERED_ELEMENT_${renderedElements.length}__`
    renderedElements.push({ placeholder, content: match })
    return placeholder
  })
  
  // 保护已渲染的 katex 公式
  html = html.replace(/<span[^>]*class="katex"[^>]*>[\s\S]*?<\/span>/gi, (match) => {
    const placeholder = `__RENDERED_ELEMENT_${renderedElements.length}__`
    renderedElements.push({ placeholder, content: match })
    return placeholder
  })
  
  // 按段落分割并处理
  if (!html.includes('<p') && !html.includes('<div')) {
    const paragraphs = html.split(/\n{2,}/).filter(p => p.trim())
    if (paragraphs.length > 1) {
      html = paragraphs.map(p => {
        const withBr = p.replace(/\n/g, '<br>')
        return `<p style="margin: 0 0 8px 0; line-height: 1.6;">${withBr}</p>`
      }).join('')
    } else if (paragraphs.length === 1) {
      html = paragraphs[0].replace(/\n/g, '<br>')
    }
  } else {
    html = html.replace(/\n/g, '<br>')
  }
  
  // 恢复被保护的元素
  renderedElements.forEach(({ placeholder, content }) => {
    html = html.replace(placeholder, content)
  })
  
  return html
}

// 获取科目列表
const fetchSubjects = async () => {
  try {
    const res = await adminApi.getComputerSubjects({ admin: 1 })
    subjects.value = res.data || []
  } catch (error) {
    console.error('获取科目列表失败:', error)
  }
}

// 获取试卷列表
const fetchPaperList = async () => {
  loading.value = true
  try {
    const res = await adminApi.getComputerPaperList({
      page: page.value,
      pageSize: pageSize.value,
      keyword: searchKeyword.value,
      paperType: searchPaperType.value,
      majorId: searchMajorId.value
    })
    const data = res.data || {}
    paperList.value = data.list || []
    total.value = data.total || 0
  } catch (error) {
    console.error('获取试卷列表失败:', error)
    ElMessage.error('获取试卷列表失败')
  } finally {
    loading.value = false
  }
}

// 搜索
const searchPapers = () => {
  page.value = 1
  fetchPaperList()
}

// 重置搜索
const resetSearch = () => {
  searchKeyword.value = ''
  searchPaperType.value = ''
  searchMajorId.value = ''
  page.value = 1
  fetchPaperList()
}

// 分页
const handleSizeChange = (val) => {
  pageSize.value = val
  fetchPaperList()
}

const handlePageChange = (val) => {
  page.value = val
  fetchPaperList()
}

// 查看详情
const viewDetail = async (row) => {
  try {
    const res = await adminApi.getComputerPaperDetail(row.id)
    currentPaper.value = res.data || null
    detailDialogVisible.value = true
    isFullscreen.value = false
  } catch (error) {
    console.error('获取试卷详情失败:', error)
    ElMessage.error('获取试卷详情失败')
  }
}

// 校准试卷信息（根据题目信息推断）
const calibratePaperInfo = async () => {
  if (!currentPaper.value || !currentPaper.value.questions || currentPaper.value.questions.length === 0) {
    ElMessage.warning('试卷中没有题目，无法校准')
    return
  }
  
  calibratingPaper.value = true
  try {
    const questions = currentPaper.value.questions
    
    // 统计字段出现频率
    const stats = {
      exam_time: {},
      from_school: {},
      exam_code: {},
      exam_full_name: {},
      major_id: {}
    }
    
    questions.forEach(q => {
      // 统计考试年份
      if (q.exam_time) {
        stats.exam_time[q.exam_time] = (stats.exam_time[q.exam_time] || 0) + 1
      }
      // 统计学校/来源
      if (q.from_school) {
        stats.from_school[q.from_school] = (stats.from_school[q.from_school] || 0) + 1
      }
      // 统计科目代码
      if (q.exam_code) {
        stats.exam_code[q.exam_code] = (stats.exam_code[q.exam_code] || 0) + 1
      }
      // 统计考试全称
      if (q.exam_full_name) {
        stats.exam_full_name[q.exam_full_name] = (stats.exam_full_name[q.exam_full_name] || 0) + 1
      }
      // 统计科目ID
      if (q.major_id) {
        stats.major_id[q.major_id] = (stats.major_id[q.major_id] || 0) + 1
      }
    })
    
    // 找出出现频率最高的值
    const getMostFrequent = (obj) => {
      let maxCount = 0
      let maxValue = ''
      for (const [key, count] of Object.entries(obj)) {
        if (count > maxCount) {
          maxCount = count
          maxValue = key
        }
      }
      return { value: maxValue, count: maxCount }
    }
    
    const updates = {}
    let updateCount = 0
    
    // 推断年份
    const yearResult = getMostFrequent(stats.exam_time)
    if (yearResult.value && yearResult.count >= Math.ceil(questions.length * 0.3)) {
      updates.year = yearResult.value
      updateCount++
    }
    
    // 推断学校/来源
    const schoolResult = getMostFrequent(stats.from_school)
    if (schoolResult.value && schoolResult.count >= Math.ceil(questions.length * 0.3)) {
      updates.school = schoolResult.value
      updateCount++
    }
    
    // 推断科目代码
    const codeResult = getMostFrequent(stats.exam_code)
    if (codeResult.value && codeResult.count >= Math.ceil(questions.length * 0.3)) {
      updates.exam_code = codeResult.value
      updateCount++
    }
    
    // 推断考试全称
    const fullNameResult = getMostFrequent(stats.exam_full_name)
    if (fullNameResult.value && fullNameResult.count >= Math.ceil(questions.length * 0.3)) {
      updates.exam_full_name = fullNameResult.value
      updateCount++
    }
    
    // 如果没有试卷名称，使用考试全称或生成默认名称
    if (!currentPaper.value.title || currentPaper.value.title === '') {
      if (updates.exam_full_name) {
        updates.title = updates.exam_full_name
      } else if (updates.year && updates.school) {
        updates.title = `${updates.year} ${updates.school}`
      }
      if (updates.title) {
        updateCount++
      }
    }
    
    if (updateCount === 0) {
      ElMessage.info('无法从题目中推断出有效的试卷信息')
      return
    }
    
    // 确认更新
    const updateFields = Object.keys(updates).map(key => {
      const fieldNames = {
        year: '年份',
        school: '学校/来源',
        exam_code: '科目代码',
        exam_full_name: '考试全称',
        title: '试卷名称'
      }
      return `${fieldNames[key]}: ${updates[key]}`
    }).join('\n')
    
    await ElMessageBox.confirm(
      `根据题目信息推断出以下字段：\n\n${updateFields}\n\n是否更新试卷信息？`,
      '确认校准',
      {
        confirmButtonText: '更新',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 确保 title 有值
    const updateData = {
      ...updates,
      title: updates.title || currentPaper.value.title || '未命名试卷',
      paper_type: currentPaper.value.paper_type,
      total_score: currentPaper.value.total_score,
      duration: currentPaper.value.duration,
      difficulty: currentPaper.value.difficulty
    }
    
    // 执行更新
    await adminApi.updateComputerPaper(currentPaper.value.id, updateData)
    
    // 更新本地数据
    Object.assign(currentPaper.value, updates)
    
    ElMessage.success('试卷信息已校准')
    
    // 刷新试卷列表
    fetchPaperList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('校准试卷信息失败:', error)
      ElMessage.error('校准失败: ' + (error.response?.data?.message || error.message))
    }
  } finally {
    calibratingPaper.value = false
  }
}

// 统一题目信息（将试卷信息同步到所有题目）
const syncPaperInfoToQuestions = async () => {
  if (!currentPaper.value || !currentPaper.value.questions || currentPaper.value.questions.length === 0) {
    ElMessage.warning('试卷中没有题目，无需同步')
    return
  }

  const questions = currentPaper.value.questions
  const paper = currentPaper.value

  // 检查哪些题目需要更新
  const questionsToUpdate = []
  questions.forEach(q => {
    const needsUpdate =
      q.exam_time !== paper.year ||
      q.from_school !== paper.school ||
      q.exam_code !== paper.exam_code ||
      q.exam_full_name !== paper.exam_full_name

    if (needsUpdate) {
      questionsToUpdate.push(q)
    }
  })

  if (questionsToUpdate.length === 0) {
    ElMessage.info('所有题目信息已与试卷一致，无需更新')
    return
  }

  try {
    await ElMessageBox.confirm(
      `检测到 ${questionsToUpdate.length} 道题目需要更新：\n\n` +
      `试卷年份: ${paper.year || '未设置'}\n` +
      `试卷学校/来源: ${paper.school || '未设置'}\n` +
      `试卷科目代码: ${paper.exam_code || '未设置'}\n` +
      `试卷考试全称: ${paper.exam_full_name || '未设置'}\n\n` +
      `是否将这些信息同步到所有题目？`,
      '确认统一题目信息',
      {
        confirmButtonText: '同步更新',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    syncingQuestions.value = true

    // 批量更新题目
    let successCount = 0
    let failCount = 0

    for (const q of questionsToUpdate) {
      try {
        await adminApi.updateComputerQuestion(q.question_id, {
          ...q,
          exam_time: paper.year,
          from_school: paper.school,
          exam_code: paper.exam_code,
          exam_full_name: paper.exam_full_name
        })
        successCount++
      } catch (error) {
        console.error(`更新题目 ${q.question_id} 失败:`, error)
        failCount++
      }
    }

    if (failCount === 0) {
      ElMessage.success(`成功更新 ${successCount} 道题目`)
    } else {
      ElMessage.warning(`更新完成：成功 ${successCount} 道，失败 ${failCount} 道`)
    }

    // 刷新试卷详情
    await viewDetail({ id: paper.id })
  } catch (error) {
    if (error !== 'cancel') {
      console.error('同步题目信息失败:', error)
      ElMessage.error('同步失败: ' + (error.response?.data?.message || error.message))
    }
  } finally {
    syncingQuestions.value = false
  }
}

// 编辑试卷
const editPaper = (row) => {
  editForm.value = {
    id: row.id,
    title: row.title || '',
    exam_full_name: row.exam_full_name || '',
    year: row.year || '',
    school: row.school || '',
    paper_type: row.paper_type || 1,
    total_score: row.total_score || 150,
    duration: row.duration || 180,
    difficulty: row.difficulty || '中等'
  }
  editDialogVisible.value = true
}

// 保存试卷
const savePaper = async () => {
  if (!editForm.value.title) {
    ElMessage.warning('请输入试卷名称')
    return
  }
  
  saving.value = true
  try {
    await adminApi.updateComputerPaper(editForm.value.id, {
      title: editForm.value.title,
      exam_full_name: editForm.value.exam_full_name,
      year: editForm.value.year,
      school: editForm.value.school,
      paper_type: editForm.value.paper_type,
      total_score: editForm.value.total_score,
      duration: editForm.value.duration,
      difficulty: editForm.value.difficulty
    })
    ElMessage.success('保存成功')
    editDialogVisible.value = false
    fetchPaperList()
  } catch (error) {
    console.error('保存试卷失败:', error)
    ElMessage.error('保存失败: ' + (error.response?.data?.message || error.message))
  } finally {
    saving.value = false
  }
}

// 删除试卷
const deletePaper = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除试卷"${row.title}"吗？此操作将同时删除试卷与题目的关联关系，但不会删除题目本身。`,
      '确认删除',
      { type: 'warning' }
    )
    
    await adminApi.deleteComputerPaper(row.id)
    ElMessage.success('删除成功')
    fetchPaperList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除试卷失败:', error)
      ElMessage.error('删除失败: ' + (error.response?.data?.message || error.message))
    }
  }
}

// 处理编辑按钮点击
const handleEditQuestion = async (q) => {
  console.log('点击编辑按钮:', q)
  await editQuestion(q)
}

// 编辑题目
const editQuestion = async (q) => {
  console.log('编辑题目:', q.question_id)
  
  try {
    // 加载科目列表
    await fetchSubjectList()
    
    // 调用 API 获取完整的题目详情（包括小题）
    const res = await adminApi.getComputerQuestionDetail(q.question_id)
    const questionData = res.data
    
    // 如果没有科目或章节，尝试从知识点标签推断
    let inferredMajorId = questionData.major_id
    let inferredChapterId = questionData.chapter_id
    
    // 如果没有科目或章节，尝试从知识点标签推断
    if ((!inferredMajorId || !inferredChapterId) && questionData.tags && questionData.tags.length > 0) {
      const inferred = await inferSubjectAndChapterFromTags(questionData.tags)
      if (inferred) {
        inferredMajorId = inferred.major_id
        inferredChapterId = inferred.chapter_id
        console.log('从标签推断:', inferred)
      }
    }
    
    // 如果有章节ID，尝试获取章节详细信息（用于显示）
    if (questionData.chapter_id) {
      const chapterInfo = await fetchChapterInfoById(questionData.chapter_id)
      if (chapterInfo) {
        inferredChapterName.value = chapterInfo.chapter_name
        // 如果没有科目ID，从章节信息中获取
        if (!inferredMajorId && chapterInfo.major_id) {
          inferredMajorId = chapterInfo.major_id
        }
      }
    }
    
    // 加载章节列表
    if (inferredMajorId) {
      await fetchChapterList(inferredMajorId)
    }
    
    // 重置显示状态
    inferredChapterName.value = ''
    displayChapterName.value = ''
    
    // 如果有章节ID，获取章节显示名称
    if (inferredChapterId) {
      // 先从已加载的章节列表中查找
      const foundChapter = chapterList.value.find(c => 
        String(c.chapter_id || c.id) === String(inferredChapterId)
      )
      if (foundChapter) {
        const parts = []
        const subject = subjectList.value.find(s => String(s.major_id || s.id) === String(inferredMajorId))
        if (subject) parts.push(subject.subject_name || subject.name)
        if (foundChapter.parent_name || foundChapter.parent_chapter_name) {
          parts.push(foundChapter.parent_name || foundChapter.parent_chapter_name)
        }
        parts.push(foundChapter.chapter_name || foundChapter.name)
        displayChapterName.value = parts.join(' > ')
      } else {
        // 如果列表中没有，尝试从考点API获取
        const chapterInfo = await fetchChapterInfoById(inferredChapterId)
        if (chapterInfo) {
          displayChapterName.value = chapterInfo.chapter_name
        }
      }
    }
    
    questionEditForm.value = {
      question_id: questionData.question_id,
      exercise_type: questionData.exercise_type,
      exercise_type_name: questionData.exercise_type_name,
      stem: questionData.stem || '',
      options: questionData.options ? (typeof questionData.options === 'string' ? JSON.parse(questionData.options) : questionData.options) : [],
      answer: questionData.answer || '',
      analysis: questionData.analysis || '',
      paper_score: q.paper_score || questionData.total_score || 2,
      subs: questionData.subs || [],
      // 保留其他重要字段，避免保存时丢失
      knowledgeTags: questionData.tags || [],
      major_id: inferredMajorId ? String(inferredMajorId) : null,
      chapter_id: inferredChapterId ? String(inferredChapterId) : null,
      exam_group_id: questionData.exam_group_id,
      level: questionData.level || 1,
      total_score: questionData.total_score || 0,
      exam_id: questionData.exam_id,
      category_id: questionData.category_id,
      from_school: questionData.from_school || '',
      exam_time: questionData.exam_time || '',
      exam_code: questionData.exam_code || '',
      exam_full_name: questionData.exam_full_name || '',
      exercise_number: questionData.exercise_number || 1,
      video_url: questionData.video_url || ''
    }
    questionEditVisible.value = true
    console.log('对话框状态:', questionEditVisible.value)
    console.log('题目详情（含小题）:', questionEditForm.value)
  } catch (error) {
    console.error('获取题目详情失败:', error)
    ElMessage.error('获取题目详情失败')
  }
}

// 获取科目列表（用于编辑题目）
const fetchSubjectList = async () => {
  loadingSubjectList.value = true
  try {
    const res = await adminApi.getComputerSubjects()
    subjectList.value = res.data || []
  } catch (error) {
    console.error('获取科目列表失败:', error)
    subjectList.value = []
  } finally {
    loadingSubjectList.value = false
  }
}

// 获取章节列表（用于编辑题目）
const fetchChapterList = async (majorId) => {
  if (!majorId) {
    chapterList.value = []
    return
  }
  loadingChapterList.value = true
  try {
    const res = await adminApi.getComputerChapters({ majorId: String(majorId) })
    // 确保返回的是数组
    if (Array.isArray(res.data)) {
      chapterList.value = res.data
    } else if (res.data && Array.isArray(res.data.list)) {
      chapterList.value = res.data.list
    } else if (res.data && Array.isArray(res.data.data)) {
      chapterList.value = res.data.data
    } else {
      chapterList.value = []
    }
  } catch (error) {
    console.error('获取章节列表失败:', error)
    chapterList.value = []
  } finally {
    loadingChapterList.value = false
  }
}

// 获取章节显示名称（包含父章节）
const getChapterDisplayName = (chapter) => {
  if (!chapter) return ''
  const parts = []
  // 如果有父章节名称，先添加父章节
  if (chapter.parent_name || chapter.parent_chapter_name) {
    parts.push(chapter.parent_name || chapter.parent_chapter_name)
  }
  // 添加当前章节名称
  parts.push(chapter.chapter_name || chapter.name)
  return parts.join(' > ')
}

// 根据知识点标签自动推断科目和章节
const inferSubjectAndChapterFromTags = async (tags) => {
  if (!tags || tags.length === 0) return null
  
  try {
    // 获取标签ID列表
    const tagIds = tags
      .map(t => typeof t === 'string' ? t : t.tag_id)
      .filter(id => id && /^\d+$/.test(String(id)))
    
    const tagNames = tags
      .map(t => typeof t === 'string' ? t : t.tag_name)
      .filter(name => name && !/^\d+$/.test(String(name)))
    
    // 如果有标签ID，使用ID查询
    if (tagIds.length > 0) {
      const res = await adminApi.getComputerTags({ keyword: tagIds.join(','), pageSize: tagIds.length })
      const tagList = res.data?.list || []
      
      for (const tag of tagList) {
        if (tag.chapter_id) {
          // 构建章节完整路径名称
          const parts = []
          if (tag.major_name) parts.push(tag.major_name)
          if (tag.parent_chapter_name) parts.push(tag.parent_chapter_name)
          if (tag.chapter_name) parts.push(tag.chapter_name)
          
          inferredChapterName.value = parts.length > 0 ? parts.join(' > ') : '未分配章节'
          
          return {
            major_id: tag.major_id || tag.chapter_id,
            chapter_id: tag.chapter_id,
            chapter_name: inferredChapterName.value
          }
        }
      }
    }
    
    // 如果没有ID只有名称，使用名称查询
    if (tagNames.length > 0) {
      for (const tagName of tagNames) {
        const res = await adminApi.getComputerTags({ keyword: tagName, pageSize: 1 })
        const tagList = res.data?.list || []
        
        if (tagList.length > 0) {
          const tag = tagList[0]
          if (tag.chapter_id) {
            // 构建章节完整路径名称
            const parts = []
            if (tag.major_name) parts.push(tag.major_name)
            if (tag.parent_chapter_name) parts.push(tag.parent_chapter_name)
            if (tag.chapter_name) parts.push(tag.chapter_name)
            
            inferredChapterName.value = parts.length > 0 ? parts.join(' > ') : '未分配章节'
            
            return {
              major_id: tag.major_id || tag.chapter_id,
              chapter_id: tag.chapter_id,
              chapter_name: inferredChapterName.value
            }
          }
        }
      }
    }
    
    inferredChapterName.value = ''
    return null
  } catch (error) {
    console.error('推断科目章节失败:', error)
    inferredChapterName.value = ''
    return null
  }
}

// 添加选项
const addOption = () => {
  const key = String.fromCharCode(65 + questionEditForm.value.options.length)
  questionEditForm.value.options.push({
    option_key: key,
    option_value: ''
  })
}

// 删除选项
const removeOption = (idx) => {
  questionEditForm.value.options.splice(idx, 1)
  questionEditForm.value.options.forEach((opt, i) => {
    opt.option_key = String.fromCharCode(65 + i)
  })
}

// 科目变化处理
const handleSubjectChange = async (majorId) => {
  // 清空当前章节选择和显示名称
  questionEditForm.value.chapter_id = null
  displayChapterName.value = ''
  inferredChapterName.value = ''
  // 重新加载章节列表
  await fetchChapterList(majorId)
}

// 校准科目和章节（根据知识点标签）
const calibrateSubjectAndChapter = async () => {
  const tags = questionEditForm.value.knowledgeTags
  if (!tags || tags.length === 0) {
    ElMessage.warning('请先添加知识点标签')
    return
  }

  try {
    ElMessage.info('正在根据知识点标签校准...')
    const inferred = await inferSubjectAndChapterFromTags(tags)

    if (inferred) {
      let updated = false

      // 更新科目
      if (inferred.major_id && inferred.major_id !== questionEditForm.value.major_id) {
        questionEditForm.value.major_id = inferred.major_id
        // 加载新科目的章节列表
        await fetchChapterList(inferred.major_id)
        const subjectName = subjectList.value.find(s => (s.major_id || s.id) === inferred.major_id)?.subject_name || subjectList.value.find(s => (s.major_id || s.id) === inferred.major_id)?.name || inferred.major_id
        ElMessage.success(`科目已校准为: ${subjectName}`)
        updated = true
      }

      // 更新章节
      if (inferred.chapter_id && inferred.chapter_id !== questionEditForm.value.chapter_id) {
        questionEditForm.value.chapter_id = inferred.chapter_id
        ElMessage.success(`章节已校准为: ${inferred.chapter_name || inferred.chapter_id}`)
        updated = true
      }

      if (!updated) {
        ElMessage.info('科目和章节已是最优匹配')
      }
    } else {
      ElMessage.warning('无法从当前标签推断科目和章节，请检查标签是否关联了考点')
    }
  } catch (error) {
    console.error('校准失败:', error)
    ElMessage.error('校准失败: ' + (error.message || '未知错误'))
  }
}

// 从章节ID获取章节详细信息
const fetchChapterInfoById = async (chapterId) => {
  if (!chapterId) return null
  try {
    // 尝试通过考点API获取章节信息
    const res = await adminApi.getComputerTags({ keyword: chapterId, pageSize: 1 })
    const tags = res.data?.list || []
    if (tags.length > 0) {
      const tag = tags[0]
      const parts = []
      if (tag.major_name) parts.push(tag.major_name)
      if (tag.parent_chapter_name) parts.push(tag.parent_chapter_name)
      if (tag.chapter_name) parts.push(tag.chapter_name)
      return {
        chapter_name: parts.join(' > '),
        major_id: tag.major_id,
        major_name: tag.major_name
      }
    }
    return null
  } catch (error) {
    console.warn('获取章节信息失败:', error)
    return null
  }
}

// 题型变化处理
const handleExerciseTypeChange = (val) => {
  const typeMap = {
    1: '单选题',
    2: '多选题',
    3: '填空题',
    4: '解答题',
    5: '判断题'
  }
  questionEditForm.value.exercise_type_name = typeMap[val] || ''
  
  // 切换到选择题/判断题时，初始化选项
  if ((val === 1 || val === 2 || val === 5) && (!questionEditForm.value.options || questionEditForm.value.options.length === 0)) {
    questionEditForm.value.options = [
      { option_key: 'A', option_value: '' },
      { option_key: 'B', option_value: '' },
      { option_key: 'C', option_value: '' },
      { option_key: 'D', option_value: '' }
    ]
  }
  
  // 切换到解答题时，初始化小题
  if (val === 4 && (!questionEditForm.value.subs || questionEditForm.value.subs.length === 0)) {
    questionEditForm.value.subs = []
  }
}

// 添加小题
const addSub = () => {
  if (!questionEditForm.value.subs) {
    questionEditForm.value.subs = []
  }
  questionEditForm.value.subs.push({
    stem: '',
    answer: '',
    analysis: '',
    score: 0
  })
}

// 删除小题
const removeSub = (idx) => {
  questionEditForm.value.subs.splice(idx, 1)
}

// 添加知识点标签 - 支持输入ID或名称
const addKnowledgeTag = async () => {
  ElMessageBox.prompt('请输入知识点标签名称或ID', '添加标签', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputValidator: (value) => {
      if (!value || value.trim() === '') {
        return '标签名称或ID不能为空'
      }
      return true
    }
  }).then(async ({ value }) => {
    const input = value.trim()
    
    try {
      // 尝试获取标签信息（可能是ID或名称）
      let tagInfo = null
      
      // 先尝试作为ID查询
      if (/^\d+$/.test(input)) {
        try {
          const res = await adminApi.getKnowledgeTagById(input)
          if (res.data) {
            tagInfo = res.data
          }
        } catch (e) {
          // ID查询失败，继续尝试名称查询
        }
      }
      
      // 如果ID查询失败，尝试作为名称查询
      if (!tagInfo) {
        const res = await adminApi.getKnowledgeTagByName(input)
        if (res.data) {
          tagInfo = res.data
        }
      }
      
      // 如果找到了标签信息，自动填充科目和章节
      if (tagInfo && tagInfo.chapter_id) {
        const chapterRes = await adminApi.getChapterById(tagInfo.chapter_id)
        const chapter = chapterRes.data
        
        if (chapter) {
          // 自动填充科目
          if (chapter.major_id && !questionEditForm.value.major_id) {
            questionEditForm.value.major_id = chapter.major_id
            // 加载对应章节列表
            await fetchChapterList(chapter.major_id)
          }
          
          // 自动填充章节
          if (!questionEditForm.value.chapter_id) {
            questionEditForm.value.chapter_id = chapter.chapter_id
          }
          
          ElMessage.success(`已自动关联科目和章节：${chapter.chapter_name}`)
        }
      }
      
      // 添加标签到列表
      if (!questionEditForm.value.knowledgeTags) {
        questionEditForm.value.knowledgeTags = []
      }
      
      // 检查是否已存在
      const exists = questionEditForm.value.knowledgeTags.some(
        t => (typeof t === 'string' ? t : t.tag_name) === (tagInfo?.tag_name || input)
      )
      
      if (exists) {
        ElMessage.warning('该标签已存在')
        return
      }
      
      questionEditForm.value.knowledgeTags.push({
        tag_id: tagInfo?.tag_id,
        tag_name: tagInfo?.tag_name || input
      })
      
      ElMessage.success('添加成功')
    } catch (error) {
      console.error('添加标签失败:', error)
      // 即使查询失败，也允许添加标签
      if (!questionEditForm.value.knowledgeTags) {
        questionEditForm.value.knowledgeTags = []
      }
      questionEditForm.value.knowledgeTags.push({
        tag_name: input
      })
      ElMessage.success('添加成功（未找到对应考点信息）')
    }
  }).catch(() => {})
}

// 删除知识点标签
const removeKnowledgeTag = (idx) => {
  questionEditForm.value.knowledgeTags.splice(idx, 1)
}

// 打开选择考点弹窗
const openSelectTagModal = () => {
  selectTagForm.value = {
    major_id: questionEditForm.value.major_id || '',
    chapter_id: questionEditForm.value.chapter_id || '',
    tag_id: ''
  }
  selectTagChapters.value = []
  selectTagList.value = []
  
  // 如果当前有科目，加载章节列表
  if (selectTagForm.value.major_id) {
    fetchChaptersForSelectTag(selectTagForm.value.major_id)
  }
  
  // 如果当前有章节，加载考点列表
  if (selectTagForm.value.chapter_id) {
    fetchTagsForSelectTag(selectTagForm.value.chapter_id)
  }
  
  selectTagModalVisible.value = true
}

// 选择考点弹窗 - 科目变化
const onSelectTagMajorChange = async (majorId) => {
  selectTagForm.value.chapter_id = ''
  selectTagForm.value.tag_id = ''
  selectTagChapters.value = []
  selectTagList.value = []
  
  if (majorId) {
    await fetchChaptersForSelectTag(majorId)
  }
}

// 选择考点弹窗 - 章节变化
const onSelectTagChapterChange = async (chapterId) => {
  selectTagForm.value.tag_id = ''
  selectTagList.value = []
  
  if (chapterId) {
    await fetchTagsForSelectTag(chapterId)
  }
}

// 获取章节列表（用于选择考点弹窗）
const fetchChaptersForSelectTag = async (majorId) => {
  try {
    const res = await adminApi.getComputerChapters({ majorId })
    console.log('获取章节列表:', res.data)
    // 处理数据结构：res.data = { code: 0, message: 'success', data: [...] }
    const responseData = res.data?.data || res.data || []
    const chapters = Array.isArray(responseData) ? responseData : (responseData.chapters || [])
    selectTagChapters.value = chapters.map(c => ({
      id: c.id || c.chapter_id,
      name: c.name || c.chapter_name || '未命名章节'
    }))
  } catch (error) {
    console.error('获取章节列表失败:', error)
    selectTagChapters.value = []
  }
}

// 获取考点列表（用于选择考点弹窗）
const fetchTagsForSelectTag = async (chapterId) => {
  try {
    const res = await adminApi.getComputerTags({ chapterId, pageSize: 1000 })
    console.log('获取考点列表:', res.data)
    // 处理数据结构：res.data = { code: 0, message: 'success', data: { list: [...], total: ... } }
    const responseData = res.data?.data || res.data || {}
    const tags = responseData.list || responseData || []
    selectTagList.value = tags.map(t => ({
      tag_id: t.tag_id || t.id,
      tag_name: t.tag_name || t.name || '未命名考点'
    }))
  } catch (error) {
    console.error('获取考点列表失败:', error)
    selectTagList.value = []
  }
}

// 确认选择考点
const confirmSelectTag = async () => {
  const tagId = selectTagForm.value.tag_id
  if (!tagId) return
  
  const selectedTag = selectTagList.value.find(t => String(t.tag_id) === String(tagId))
  if (!selectedTag) {
    ElMessage.error('未找到选中的考点')
    return
  }
  
  // 检查是否已存在
  const exists = questionEditForm.value.knowledgeTags?.some(
    t => String(t.tag_id || t) === String(tagId)
  )
  
  if (exists) {
    ElMessage.warning('该标签已存在')
    selectTagModalVisible.value = false
    return
  }
  
  // 获取考点详细信息（用于检查科目章节）
  try {
    const res = await adminApi.getKnowledgeTagById(tagId)
    const tagInfo = res.data?.data || res.data
    
    if (tagInfo && tagInfo.chapter_id) {
      const chapterRes = await adminApi.getChapterById(tagInfo.chapter_id)
      const chapter = chapterRes.data?.data || chapterRes.data
      
      if (chapter) {
        const currentMajorId = questionEditForm.value.major_id
        const currentChapterId = questionEditForm.value.chapter_id
        const newMajorId = String(chapter.major_id)
        const newChapterId = String(chapter.chapter_id)
        
        // 如果当前没有科目和章节，直接填充
        if (!currentMajorId && !currentChapterId) {
          questionEditForm.value.major_id = newMajorId
          await fetchChapterList(newMajorId)
          questionEditForm.value.chapter_id = newChapterId
          ElMessage.success(`已自动关联科目和章节：${chapter.chapter_name}`)
        } else if (currentMajorId !== newMajorId || currentChapterId !== newChapterId) {
          // 如果科目或章节不一致，提示用户
          const currentMajorName = subjectList.value.find(s => String(s.id) === String(currentMajorId))?.name || currentMajorId || '无'
          const currentChapterName = chapterList.value.find(c => String(c.chapter_id) === String(currentChapterId))?.chapter_name || currentChapterId || '无'
          
          try {
            await ElMessageBox.confirm(
              `考点的所属信息与您当前设置不一致：\n\n` +
              `当前：${currentMajorName} / ${currentChapterName}\n` +
              `考点：${chapter.subject_name || newMajorId} / ${chapter.chapter_name}\n\n` +
              `是否更新为考点的所属科目和章节？`,
              '科目章节不一致',
              {
                confirmButtonText: '更新',
                cancelButtonText: '保持当前',
                type: 'warning',
                dangerouslyUseHTMLString: false
              }
            )
            // 用户选择更新
            questionEditForm.value.major_id = newMajorId
            await fetchChapterList(newMajorId)
            questionEditForm.value.chapter_id = newChapterId
            ElMessage.success(`已更新为：${chapter.chapter_name}`)
          } catch {
            // 用户选择保持当前，不做任何操作
            ElMessage.info('保持当前科目章节设置')
          }
        }
      }
    }
  } catch (error) {
    console.error('获取考点信息失败:', error)
  }
  
  // 添加标签到列表
  if (!questionEditForm.value.knowledgeTags) {
    questionEditForm.value.knowledgeTags = []
  }
  
  questionEditForm.value.knowledgeTags.push({
    tag_id: selectedTag.tag_id,
    tag_name: selectedTag.tag_name
  })
  
  ElMessage.success('添加成功')
  selectTagModalVisible.value = false
}

// 输入添加标签（原addKnowledgeTag方法重命名）
const addKnowledgeTagByInput = async () => {
  ElMessageBox.prompt('请输入知识点标签名称或ID', '添加标签', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputValidator: (value) => {
      if (!value || value.trim() === '') {
        return '标签名称或ID不能为空'
      }
      return true
    }
  }).then(async ({ value }) => {
    const input = value.trim()
    
    try {
      // 尝试获取标签信息（可能是ID或名称）
      let tagInfo = null
      
      // 先尝试作为ID查询
      if (/^\d+$/.test(input)) {
        try {
          const res = await adminApi.getKnowledgeTagById(input)
          if (res.data) {
            tagInfo = res.data
          }
        } catch (e) {
          // ID查询失败，继续尝试名称查询
        }
      }
      
      // 如果ID查询失败，尝试作为名称查询
      if (!tagInfo) {
        const res = await adminApi.getKnowledgeTagByName(input)
        if (res.data) {
          tagInfo = res.data
        }
      }
      
      // 如果找到了标签信息，自动填充科目和章节
      if (tagInfo && tagInfo.chapter_id) {
        const chapterRes = await adminApi.getChapterById(tagInfo.chapter_id)
        const chapter = chapterRes.data
        
        if (chapter) {
          // 自动填充科目
          if (chapter.major_id && !questionEditForm.value.major_id) {
            questionEditForm.value.major_id = chapter.major_id
            // 加载对应章节列表
            await fetchChapterList(chapter.major_id)
          }
          
          // 自动填充章节
          if (!questionEditForm.value.chapter_id) {
            questionEditForm.value.chapter_id = chapter.chapter_id
          }
          
          ElMessage.success(`已自动关联科目和章节：${chapter.chapter_name}`)
        }
      }
      
      // 添加标签到列表
      if (!questionEditForm.value.knowledgeTags) {
        questionEditForm.value.knowledgeTags = []
      }
      
      // 检查是否已存在
      const exists = questionEditForm.value.knowledgeTags.some(
        t => (typeof t === 'string' ? t : t.tag_name) === (tagInfo?.tag_name || input)
      )
      
      if (exists) {
        ElMessage.warning('该标签已存在')
        return
      }
      
      questionEditForm.value.knowledgeTags.push({
        tag_id: tagInfo?.tag_id,
        tag_name: tagInfo?.tag_name || input
      })
      
      ElMessage.success('添加成功')
    } catch (error) {
      console.error('添加标签失败:', error)
      // 即使查询失败，也允许添加标签
      if (!questionEditForm.value.knowledgeTags) {
        questionEditForm.value.knowledgeTags = []
      }
      questionEditForm.value.knowledgeTags.push({
        tag_name: input
      })
      ElMessage.success('添加成功（未找到对应考点信息）')
    }
  }).catch(() => {})
}

// 保存题目编辑
const saveQuestionEdit = async () => {
  savingQuestion.value = true
  try {
    // 构建完整的保存数据，保留所有原有字段
    const saveData = {
      stem: questionEditForm.value.stem,
      answer: questionEditForm.value.answer,
      analysis: questionEditForm.value.analysis,
      options: questionEditForm.value.options,
      subs: questionEditForm.value.subs,
      exercise_type: questionEditForm.value.exercise_type,
      exercise_type_name: questionEditForm.value.exercise_type_name,
      // 保留其他字段
      knowledgeTags: questionEditForm.value.knowledgeTags,
      major_id: questionEditForm.value.major_id,
      chapter_id: questionEditForm.value.chapter_id,
      exam_group_id: questionEditForm.value.exam_group_id,
      level: questionEditForm.value.level,
      total_score: questionEditForm.value.total_score,
      exam_id: questionEditForm.value.exam_id,
      category_id: questionEditForm.value.category_id,
      from_school: questionEditForm.value.from_school,
      exam_time: questionEditForm.value.exam_time,
      exam_code: questionEditForm.value.exam_code,
      exam_full_name: questionEditForm.value.exam_full_name,
      exercise_number: questionEditForm.value.exercise_number,
      video_url: questionEditForm.value.video_url
    }
    
    await adminApi.updateComputerQuestion(questionEditForm.value.question_id, saveData)
    
    const qIndex = currentPaper.value.questions.findIndex(q => q.question_id === questionEditForm.value.question_id)
    if (qIndex !== -1) {
      currentPaper.value.questions[qIndex].stem = questionEditForm.value.stem
      currentPaper.value.questions[qIndex].answer = questionEditForm.value.answer
      currentPaper.value.questions[qIndex].analysis = questionEditForm.value.analysis
      currentPaper.value.questions[qIndex].options = questionEditForm.value.options
      currentPaper.value.questions[qIndex].subs = questionEditForm.value.subs
      currentPaper.value.questions[qIndex].paper_score = questionEditForm.value.paper_score
      currentPaper.value.questions[qIndex].exercise_type = questionEditForm.value.exercise_type
      currentPaper.value.questions[qIndex].exercise_type_name = questionEditForm.value.exercise_type_name
    }
    
    ElMessage.success('保存成功')
    questionEditVisible.value = false
    inferredChapterName.value = '' // 清空推断的章节名称
  } catch (error) {
    console.error('保存题目失败:', error)
    ElMessage.error('保存失败: ' + (error.response?.data?.message || error.message))
  } finally {
    savingQuestion.value = false
  }
}

// 保存题目顺序和分值
const saveQuestionsOrder = async () => {
  savingQuestions.value = true
  try {
    const questions = currentPaper.value.questions.map((q, index) => ({
      question_id: q.question_id,
      sort_order: index + 1,
      score: q.paper_score || q.total_score || 2
    }))
    
    await adminApi.updateComputerPaperQuestions(currentPaper.value.id, { questions })
    ElMessage.success('保存成功')
  } catch (error) {
    console.error('保存题目顺序失败:', error)
    ElMessage.error('保存失败: ' + (error.response?.data?.message || error.message))
  } finally {
    savingQuestions.value = false
  }
}

// 保存试卷信息
const savePaperInfo = async () => {
  if (!currentPaper.value) return
  
  savingPaperInfo.value = true
  try {
    const updateData = {
      title: currentPaper.value.title,
      exam_full_name: currentPaper.value.exam_full_name,
      year: currentPaper.value.year,
      school: currentPaper.value.school,
      paper_type: currentPaper.value.paper_type,
      exam_code: currentPaper.value.exam_code,
      total_score: currentPaper.value.total_score,
      duration: currentPaper.value.duration
    }
    
    await adminApi.updateComputerPaper(currentPaper.value.id, updateData)
    ElMessage.success('试卷信息保存成功')
    
    // 刷新列表
    await fetchPaperList()
  } catch (error) {
    console.error('保存试卷信息失败:', error)
    ElMessage.error('保存失败: ' + (error.response?.data?.message || error.message))
  } finally {
    savingPaperInfo.value = false
  }
}

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

onMounted(() => {
  fetchSubjects()
  fetchPaperList()
})
</script>

<style scoped>
.computer-paper-manage {
  padding: 20px;
}

.filter-bar {
  display: flex;
  align-items: center;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
}

.paper-detail {
  max-height: 80vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-right: 30px;
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.question-item {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 15px;
  background: #f5f7fa;
}

.question-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px dashed #dcdfe6;
}

.question-index {
  font-weight: bold;
  color: #409eff;
  font-size: 16px;
}

.question-type {
  background: #e6a23c;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.question-score {
  color: #67c23a;
  font-weight: bold;
}

.question-content {
  margin-bottom: 10px;
  line-height: 1.6;
}

.question-content :deep(p) {
  margin: 0 0 8px 0;
  line-height: 1.6;
}

.question-content :deep(p):last-child {
  margin-bottom: 0;
}

.question-options {
  margin: 10px 0;
  padding: 10px;
  background: white;
  border-radius: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.option-item-inline {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.option-label {
  font-weight: bold;
  color: #409eff;
  min-width: 20px;
}

.question-subs {
  margin: 10px 0;
  padding: 10px;
  background: white;
  border-radius: 4px;
}

.sub-item {
  margin: 10px 0;
  padding: 10px;
  border-left: 3px solid #67c23a;
  background: #f0f9eb;
  border-radius: 0 4px 4px 0;
}

.sub-header {
  font-weight: bold;
  color: #67c23a;
  margin-bottom: 5px;
}

.sub-content {
  margin-bottom: 5px;
}

.sub-answer {
  margin-top: 5px;
  padding: 5px;
  background: #ecf5ff;
  border-radius: 4px;
}

/* 小题编辑器样式 */
.subs-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
  width: 100%;
}

.sub-item-editor {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 15px;
  background: #fafafa;
}

.sub-item-editor .sub-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ebeef5;
}

.sub-item-editor .sub-index {
  font-weight: bold;
  color: #409eff;
  font-size: 14px;
}

.sub-item-editor .sub-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sub-item-editor .el-form-item {
  margin-bottom: 10px;
}

.sub-item-editor .el-form-item__label {
  font-size: 13px;
  color: #606266;
}

.question-answer {
  margin-top: 10px;
  padding: 10px;
  background: #f0f9ff;
  border-radius: 4px;
  border-left: 3px solid #409eff;
}

.question-analysis {
  margin-top: 10px;
  padding: 10px;
  background: #fdf6ec;
  border-radius: 4px;
  border-left: 3px solid #e6a23c;
}

/* 数学公式样式 */
.math-inline {
  font-family: 'Times New Roman', serif;
  font-style: italic;
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
  color: #333;
}

.math-block {
  font-family: 'Times New Roman', serif;
  font-style: italic;
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  margin: 10px 0;
  text-align: center;
  color: #333;
}

.code-block {
  background: #2d2d2d;
  color: #f8f8f2;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

/* 编辑题目对话框样式 */
.question-edit-dialog :deep(.el-dialog__body) {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
}

.question-edit-form .el-form-item {
  margin-bottom: 15px;
}

.editor-wrapper {
  width: 100%;
}

.form-item-options .options-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
}

.option-edit-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
}

.option-editor-wrapper {
  flex: 1;
  min-width: 0;
}

.add-option-btn {
  margin-top: 5px;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mt-10 {
  margin-top: 10px;
}

.mt-20 {
  margin-top: 20px;
}

.mb-20 {
  margin-bottom: 20px;
}

.chapter-hint {
  margin-top: 5px;
  font-size: 12px;
}
</style>
