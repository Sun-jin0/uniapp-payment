<template>
  <div class="tutorial-chapter-manage">
    <el-page-header @back="goBack" :title="tutorial?.name || '教辅章节管理'" />
    
    <div class="content mt-20">
      <el-card>
        <template #header>
          <div class="card-header">
            <h3>{{ tutorial?.name }} - 章节管理</h3>
            <el-button type="primary" @click="openAddChapterModal">
              <el-icon><Plus /></el-icon> 添加章节
            </el-button>
          </div>
        </template>

        <!-- 章节树 -->
        <div class="chapter-tree-container">
          <div v-if="loadingChapters" class="loading-container">
            <el-icon class="is-loading"><Loading /></el-icon> 加载中...
          </div>
          <div v-else-if="chapterTree.length === 0" class="empty-container">
            <el-empty description="暂无章节" />
          </div>
          <div 
            v-for="chapter in chapterTree" 
            :key="chapter.id" 
            class="chapter-item"
          >
            <!-- 章 -->
            <div 
              class="chapter-header" 
              :class="{ 'expanded': expandedChapters.includes(chapter.id) }"
              @click="toggleChapter(chapter.id)"
            >
              <el-icon class="expand-icon">
                <ArrowRight v-if="!expandedChapters.includes(chapter.id)" />
                <ArrowDown v-else />
              </el-icon>
              <el-icon class="folder-icon"><Folder /></el-icon>
              <span class="chapter-name">{{ chapter.name }}</span>
              <span class="chapter-count">({{ chapter.children?.length || 0 }}节)</span>
              <span class="chapter-actions" @click.stop>
                <el-button size="small" type="primary" link @click="openAddSectionModal(chapter)">
                  添加节
                </el-button>
                <el-button size="small" type="primary" link @click="editChapter(chapter)">
                  编辑
                </el-button>
                <el-button size="small" type="danger" link @click="deleteChapter(chapter)">
                  删除
                </el-button>
              </span>
            </div>
            
            <!-- 节列表 -->
            <div v-if="expandedChapters.includes(chapter.id)" class="section-list">
              <div 
                v-for="section in chapter.children" 
                :key="section.id" 
                class="section-item"
              >
                <div 
                  class="section-header" 
                  :class="{ 'expanded': expandedSections.includes(section.id) }"
                  @click="toggleSection(section)"
                >
                  <el-icon class="expand-icon">
                    <ArrowRight v-if="!expandedSections.includes(section.id)" />
                    <ArrowDown v-else />
                  </el-icon>
                  <el-icon class="document-icon"><Document /></el-icon>
                  <span class="section-name">{{ section.name }}</span>
                  <span class="section-count">({{ section.question_count || 0 }}题)</span>
                  <span class="section-actions" @click.stop>
                    <el-button size="small" type="primary" link @click="openSelectQuestionsModal(section)">
                      选择题
                    </el-button>
                    <el-button size="small" type="success" link @click="openManualAddQuestionModal(section)">
                      手动录入
                    </el-button>
                    <el-button size="small" type="primary" link @click="editChapter(section)">
                      编辑
                    </el-button>
                    <el-button size="small" type="danger" link @click="deleteChapter(section)">
                      删除
                    </el-button>
                  </span>
                </div>
                
                <!-- 题目列表 -->
                <div v-if="expandedSections.includes(section.id)" class="question-list">
                  <div v-if="loadingSectionQuestions[section.id]" class="question-loading">
                    <el-icon class="is-loading"><Loading /></el-icon> 加载中...
                  </div>
                  <div v-else-if="!sectionQuestions[section.id] || sectionQuestions[section.id].length === 0" class="question-empty">
                    暂无题目
                  </div>
                  <div v-else>
                    <div class="question-toolbar">
                      <el-button 
                        v-if="questionOrderChanged[section.id]" 
                        type="success" 
                        size="small" 
                        @click="saveQuestionOrder(section)"
                      >
                        <el-icon><Check /></el-icon> 保存顺序
                      </el-button>
                    </div>
                    <el-scrollbar max-height="400px">
                      <draggable 
                        v-model="sectionQuestions[section.id]" 
                        item-key="question_id"
                        handle=".drag-handle"
                        @end="onQuestionDragEnd(section)"
                        class="question-drag-list"
                      >
                        <template #item="{ element: question, index }">
                          <div class="question-item">
                            <el-icon class="drag-handle"><Rank /></el-icon>
                            <span class="question-index">{{ index + 1 }}.</span>
                            <span class="question-type">[{{ question.exercise_type_name }}]</span>
                            <span class="question-stem" v-html="stripHtml(question.stem)"></span>
                            <span class="question-actions">
                              <el-button size="small" type="primary" link @click="viewQuestion(question)">
                                查看
                              </el-button>
                              <el-button size="small" type="warning" link @click="replaceQuestion(section, question, index)">
                                重选
                              </el-button>
                              <el-button size="small" type="danger" link @click="removeQuestionFromSection(section, question, index)">
                                删除
                              </el-button>
                            </span>
                          </div>
                        </template>
                      </draggable>
                    </el-scrollbar>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 添加/编辑章节对话框 -->
    <el-dialog v-model="chapterEditModalVisible" :title="chapterEditForm.id ? '编辑章节' : '添加章节'" width="500px">
      <el-form :model="chapterEditForm" label-width="100px">
        <el-form-item label="章节名称" required>
          <el-input v-model="chapterEditForm.name" placeholder="请输入章节名称" />
        </el-form-item>
        <el-form-item label="父章节" v-if="chapterEditForm.parentId">
          <el-input :value="chapterEditForm.parentName" disabled />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="chapterEditForm.sortOrder" :min="0" style="width: 100%;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="chapterEditModalVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmSaveChapter" :loading="savingChapter">保存</el-button>
      </template>
    </el-dialog>

    <!-- 选择题对话框 -->
    <el-dialog v-model="selectQuestionModalVisible" title="选择题目" width="900px">
      <div class="select-question-container">
        <div class="filter-bar mb-20">
          <el-input
            v-model="selectQuestionFilter.keyword"
            placeholder="搜索题目..."
            clearable
            style="width: 300px;"
            @keyup.enter="searchQuestionsForSelect"
          >
            <template #append>
              <el-button @click="searchQuestionsForSelect">
                <el-icon><Search /></el-icon>
              </el-button>
            </template>
          </el-input>
          <el-select v-model="selectQuestionFilter.type" placeholder="题型" clearable style="width: 150px; margin-left: 10px;">
            <el-option label="单选题" value="单选题" />
            <el-option label="多选题" value="多选题" />
            <el-option label="填空题" value="填空题" />
            <el-option label="解答题" value="解答题" />
            <el-option label="判断题" value="判断题" />
          </el-select>
        </div>

        <el-table :data="questionsForSelect" v-loading="loadingQuestionsForSelect" border stripe height="400">
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column prop="question_id" label="题目ID" width="150" show-overflow-tooltip />
          <el-table-column prop="exercise_type_name" label="题型" width="100" align="center" />
          <el-table-column prop="stem" label="题干" min-width="300" show-overflow-tooltip>
            <template #default="{ row }">
              <div v-html="stripHtml(row.stem)"></div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" align="center" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="confirmSelectQuestion(row)">选择</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-container mt-20">
          <el-pagination
            v-model:current-page="selectQuestionFilter.page"
            v-model:page-size="selectQuestionFilter.pageSize"
            :total="selectQuestionTotal"
            layout="total, prev, pager, next"
            @current-change="searchQuestionsForSelect"
          />
        </div>
      </div>
    </el-dialog>

    <!-- 手动录入题目对话框 - 与computer-manage编辑题目一致 -->
    <el-dialog
      v-model="manualAddQuestionModalVisible"
      :title="manualQuestionForm.id ? '编辑题目' : '手动录入题目'"
      width="1000px"
      top="3vh"
      destroy-on-close
      class="question-edit-dialog"
    >
      <el-form :model="manualQuestionForm" label-width="100px" class="question-edit-form">
        <!-- 基础信息行 -->
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="题型">
              <el-select v-model="manualQuestionForm.exercise_type" style="width: 100%;" @change="handleManualExerciseTypeChange">
                <el-option label="单选题" :value="1" />
                <el-option label="多选题" :value="2" />
                <el-option label="填空题" :value="3" />
                <el-option label="解答题" :value="4" />
                <el-option label="判断题" :value="5" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="分值">
              <el-input-number v-model="manualQuestionForm.total_score" :min="0" :max="100" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="难度">
              <el-rate v-model="manualQuestionForm.level" :max="5" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 科目章节考点行 -->
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="所属科目">
              <el-select v-model="manualQuestionForm.major_id" style="width: 100%" @change="handleMajorChange">
                <el-option v-for="s in subjects" :key="s.id" :label="s.name" :value="String(s.id)" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="所属章节">
              <el-select v-model="manualQuestionForm.chapter_id" style="width: 100%" @change="handleChapterChange">
                <el-option v-for="c in chapters" :key="c.id" :label="c.name" :value="String(c.id)" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="考点分类">
              <el-select 
                v-model="manualQuestionForm.tag_ids" 
                multiple 
                style="width: 100%" 
                placeholder="选择考点"
                :loading="loadingTags"
              >
                <el-option 
                  v-for="t in knowledgeTags" 
                  :key="String(t.tag_id)" 
                  :label="t.tag_name" 
                  :value="String(t.tag_id)" 
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 题干 -->
        <el-form-item label="题干" class="form-item-stem">
          <div class="editor-wrapper">
            <RichEditor v-model="manualQuestionForm.stem" placeholder="请输入题干" :height="120" />
          </div>
        </el-form-item>

        <!-- 选项 -->
        <el-form-item label="选项" v-if="[1, 2, 5].includes(manualQuestionForm.exercise_type)" class="form-item-options">
          <div class="options-list">
            <div v-for="(opt, idx) in manualQuestionForm.options" :key="idx" class="option-edit-row">
              <el-input v-model="opt.option_key" style="width: 50px;" placeholder="选项" size="small" />
              <div class="option-editor-wrapper">
                <RichEditor v-model="opt.option_value" placeholder="选项内容" :height="80" />
              </div>
              <el-button type="danger" size="small" @click="removeManualOption(idx)">删除</el-button>
            </div>
          </div>
          <el-button type="primary" size="small" @click="addManualOption" class="add-option-btn">
            <el-icon><Plus /></el-icon> 添加选项
          </el-button>
        </el-form-item>

        <!-- 解答题小题 -->
        <el-form-item label="小题列表" v-if="manualQuestionForm.exercise_type === 4">
          <div class="subs-list">
            <div v-for="(sub, idx) in (manualQuestionForm.subs || [])" :key="idx" class="sub-item-editor">
              <div class="sub-header">
                <span class="sub-index">小题 {{ idx + 1 }}</span>
                <el-input v-model="sub.score" placeholder="分值" style="width: 80px" size="small">
                  <template #append>分</template>
                </el-input>
                <el-button type="danger" size="small" @click="removeManualSub(idx)">删除</el-button>
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
          <el-button type="primary" size="small" @click="addManualSub" class="mt-10">
            <el-icon><Plus /></el-icon> 添加小题
          </el-button>
        </el-form-item>

        <!-- 答案 -->
        <el-form-item label="答案" class="form-item-answer">
          <div class="editor-wrapper">
            <RichEditor v-model="manualQuestionForm.answer" placeholder="请输入答案" :height="100" />
          </div>
        </el-form-item>

        <!-- 解析 -->
        <el-form-item label="解析" class="form-item-analysis">
          <div class="editor-wrapper">
            <RichEditor v-model="manualQuestionForm.analysis" placeholder="请输入解析" :height="120" />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="manualAddQuestionModalVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmSaveManualQuestion" :loading="savingManualQuestion">保存</el-button>
      </template>
    </el-dialog>

    <!-- 查看题目对话框 -->
    <el-dialog v-model="viewQuestionModalVisible" title="题目详情" width="800px">
      <template #header>
        <div class="dialog-header-with-action">
          <span>题目详情</span>
          <el-button type="primary" size="small" @click="openEditQuestionModal">
            <el-icon><Edit /></el-icon> 编辑题目
          </el-button>
        </div>
      </template>
      <div v-if="currentQuestion" class="question-detail">
        <div class="question-info">
          <p><strong>题型：</strong>{{ currentQuestion.exercise_type_name }}</p>
          <p><strong>题干：</strong></p>
          <div class="question-content" v-html="currentQuestion.stem"></div>
          <p v-if="currentQuestion.options && currentQuestion.options.length > 0"><strong>选项：</strong></p>
          <div v-if="currentQuestion.options && currentQuestion.options.length > 0" class="options-list">
            <div v-for="option in currentQuestion.options" :key="option.option_key" class="option-line">
              <strong>{{ option.option_key }}.</strong> <span v-html="option.option_value"></span>
            </div>
          </div>
          <p><strong>答案：</strong><span v-html="currentQuestion.answer"></span></p>
          <p v-if="currentQuestion.analysis"><strong>解析：</strong></p>
          <div v-if="currentQuestion.analysis" class="analysis-content" v-html="currentQuestion.analysis"></div>
        </div>
      </div>
      <template #footer>
        <el-button @click="viewQuestionModalVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, ArrowRight, ArrowDown, Folder, Document, Loading, Check, Rank, Edit } from '@element-plus/icons-vue'
import draggable from 'vuedraggable'
import RichEditor from '@/components/RichEditor.vue'

const route = useRoute()
const router = useRouter()
const tutorialId = route.params.id

// 教辅信息
const tutorial = ref(null)
const loadingChapters = ref(false)

// 章节树
const chapterTree = ref([])
const expandedChapters = ref([])
const expandedSections = ref([])

// 题目相关
const sectionQuestions = ref({})
const loadingSectionQuestions = ref({})
const questionOrderChanged = ref({})

// 章节编辑
const chapterEditModalVisible = ref(false)
const savingChapter = ref(false)
const chapterEditForm = reactive({
  id: null,
  name: '',
  parentId: null,
  parentName: '',
  sortOrder: 0,
  level: 1
})

// 选择题相关
const selectQuestionModalVisible = ref(false)
const currentSectionForSelectQuestion = ref(null)
const currentQuestionIndexForReplace = ref(-1)
const oldQuestionIdForReplace = ref(null)
const selectQuestionFilter = reactive({
  keyword: '',
  type: '',
  page: 1,
  pageSize: 10
})
const questionsForSelect = ref([])
const selectQuestionTotal = ref(0)
const loadingQuestionsForSelect = ref(false)

// 手动录入相关
const manualAddQuestionModalVisible = ref(false)
const currentSectionForManualAdd = ref(null)
const savingManualQuestion = ref(false)
const manualQuestionForm = reactive({
  exercise_type: 1, // 1=单选, 2=多选, 3=填空, 4=解答, 5=判断
  exercise_type_name: '单选题',
  stem: '',
  options: [
    { option_key: 'A', option_value: '' },
    { option_key: 'B', option_value: '' },
    { option_key: 'C', option_value: '' },
    { option_key: 'D', option_value: '' }
  ],
  answer: '',
  analysis: '',
  total_score: 2,
  subs: [], // 解答题小题
  major_id: '',
  chapter_id: '',
  tag_ids: []
})

// 科目章节考点相关
const subjects = ref([])
const chapters = ref([])
const knowledgeTags = ref([])
const loadingTags = ref(false)

// 查看题目
const viewQuestionModalVisible = ref(false)
const currentQuestion = ref(null)

// 获取教辅详情
const fetchTutorialDetail = async () => {
  try {
    const res = await adminApi.getTutorialDetail(tutorialId)
    tutorial.value = res.data
  } catch (error) {
    console.error('获取教辅详情失败:', error)
    ElMessage.error('获取教辅详情失败')
  }
}

// 获取章节列表
const fetchChapters = async () => {
  loadingChapters.value = true
  try {
    const res = await adminApi.getTutorialChapters(tutorialId)
    chapterTree.value = res.data || []
  } catch (error) {
    console.error('获取章节列表失败:', error)
    ElMessage.error('获取章节列表失败')
  } finally {
    loadingChapters.value = false
  }
}

// 切换章节展开
const toggleChapter = (chapterId) => {
  const index = expandedChapters.value.indexOf(chapterId)
  if (index > -1) {
    expandedChapters.value.splice(index, 1)
  } else {
    expandedChapters.value.push(chapterId)
  }
}

// 切换小节展开
const toggleSection = async (section) => {
  const index = expandedSections.value.indexOf(section.id)
  if (index > -1) {
    expandedSections.value.splice(index, 1)
  } else {
    expandedSections.value.push(section.id)
    // 加载题目
    if (!sectionQuestions.value[section.id]) {
      await loadSectionQuestions(section.id)
    }
  }
}

// 加载小节题目
const loadSectionQuestions = async (sectionId) => {
  loadingSectionQuestions.value[sectionId] = true
  try {
    const res = await adminApi.getChapterQuestions(sectionId)
    sectionQuestions.value[sectionId] = res.data || []
  } catch (error) {
    console.error('获取题目列表失败:', error)
    ElMessage.error('获取题目列表失败')
    sectionQuestions.value[sectionId] = []
  } finally {
    loadingSectionQuestions.value[sectionId] = false
  }
}

// 打开添加章节对话框
const openAddChapterModal = () => {
  chapterEditForm.id = null
  chapterEditForm.name = ''
  chapterEditForm.parentId = null
  chapterEditForm.parentName = ''
  chapterEditForm.sortOrder = 0
  chapterEditForm.level = 1
  chapterEditModalVisible.value = true
}

// 打开添加节对话框
const openAddSectionModal = (chapter) => {
  chapterEditForm.id = null
  chapterEditForm.name = ''
  chapterEditForm.parentId = chapter.id
  chapterEditForm.parentName = chapter.name
  chapterEditForm.sortOrder = 0
  chapterEditForm.level = 2
  chapterEditModalVisible.value = true
}

// 编辑章节
const editChapter = (chapter) => {
  chapterEditForm.id = chapter.id
  chapterEditForm.name = chapter.name
  chapterEditForm.parentId = chapter.parent_id
  chapterEditForm.parentName = chapter.parent_name || ''
  chapterEditForm.sortOrder = chapter.sort_order || 0
  chapterEditForm.level = chapter.level || 1
  chapterEditModalVisible.value = true
}

// 保存章节
const confirmSaveChapter = async () => {
  if (!chapterEditForm.name.trim()) {
    ElMessage.warning('请输入章节名称')
    return
  }
  
  savingChapter.value = true
  try {
    const data = {
      name: chapterEditForm.name,
      sort_order: chapterEditForm.sortOrder,
      level: chapterEditForm.level,
      parent_id: chapterEditForm.parentId
    }
    
    if (chapterEditForm.id) {
      await adminApi.updateTutorialChapter(chapterEditForm.id, data)
      ElMessage.success('更新成功')
    } else {
      await adminApi.createTutorialChapter(tutorialId, data)
      ElMessage.success('创建成功')
    }
    chapterEditModalVisible.value = false
    fetchChapters()
  } catch (error) {
    console.error('保存章节失败:', error)
    ElMessage.error('保存章节失败')
  } finally {
    savingChapter.value = false
  }
}

// 删除章节
const deleteChapter = async (chapter) => {
  try {
    await ElMessageBox.confirm(
      chapter.level === 1 ? '确定要删除该章节吗？将同时删除其下所有小节和题目关联。' : '确定要删除该小节吗？将同时删除其下的题目关联。',
      '警告',
      { type: 'warning' }
    )
    await adminApi.deleteTutorialChapter(chapter.id)
    ElMessage.success('删除成功')
    fetchChapters()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除章节失败:', error)
      ElMessage.error('删除章节失败')
    }
  }
}

// 打开选择题对话框
const openSelectQuestionsModal = (section, isReplace = false, index = -1, oldQuestionId = null) => {
  currentSectionForSelectQuestion.value = section
  currentQuestionIndexForReplace.value = isReplace ? index : -1
  oldQuestionIdForReplace.value = oldQuestionId
  selectQuestionFilter.keyword = ''
  selectQuestionFilter.type = ''
  selectQuestionFilter.page = 1
  searchQuestionsForSelect()
  selectQuestionModalVisible.value = true
}

// 搜索题目
const searchQuestionsForSelect = async () => {
  loadingQuestionsForSelect.value = true
  try {
    const res = await adminApi.getQuestions({
      keyword: selectQuestionFilter.keyword,
      type: selectQuestionFilter.type,
      page: selectQuestionFilter.page,
      pageSize: selectQuestionFilter.pageSize
    })
    questionsForSelect.value = res.data?.list || []
    selectQuestionTotal.value = res.data?.total || 0
  } catch (error) {
    console.error('搜索题目失败:', error)
    ElMessage.error('搜索题目失败')
  } finally {
    loadingQuestionsForSelect.value = false
  }
}

// 选择题目
const confirmSelectQuestion = async (question) => {
  const section = currentSectionForSelectQuestion.value
  
  try {
    if (currentQuestionIndexForReplace.value > -1 && oldQuestionIdForReplace.value) {
      // 替换模式：先删除旧题目，再添加新题目
      await adminApi.removeTutorialQuestion(tutorialId, oldQuestionIdForReplace.value)
    }
    
    // 添加新题目关联
    await adminApi.addTutorialQuestion({
      tutorial_id: tutorialId,
      chapter_id: section.id,
      question_id: question.question_id,
      sort_order: sectionQuestions.value[section.id]?.length || 0
    })
    
    // 刷新题目列表
    await loadSectionQuestions(section.id)
    
    // 更新题目数量
    section.question_count = (section.question_count || 0) + (oldQuestionIdForReplace.value ? 0 : 1)
    
    ElMessage.success(oldQuestionIdForReplace.value ? '替换成功' : '添加成功')
    selectQuestionModalVisible.value = false
  } catch (error) {
    console.error('选择题目失败:', error)
    ElMessage.error('选择题目失败')
  }
}

// 替换题目
const replaceQuestion = (section, question, index) => {
  openSelectQuestionsModal(section, true, index, question.question_id)
}

// 删除题目关联
const removeQuestionFromSection = async (section, question, index) => {
  try {
    await ElMessageBox.confirm('确定要删除该题目吗？', '提示', { type: 'warning' })
    await adminApi.removeTutorialQuestion(tutorialId, question.question_id)
    
    // 更新本地数据
    sectionQuestions.value[section.id].splice(index, 1)
    section.question_count = Math.max(0, (section.question_count || 0) - 1)
    
    ElMessage.success('删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除题目失败:', error)
      ElMessage.error('删除题目失败')
    }
  }
}

// 打开手动录入对话框
const openManualAddQuestionModal = (section) => {
  currentSectionForManualAdd.value = section
  manualQuestionForm.exercise_type = 1
  manualQuestionForm.exercise_type_name = '单选题'
  manualQuestionForm.stem = ''
  manualQuestionForm.options = [
    { option_key: 'A', option_value: '' },
    { option_key: 'B', option_value: '' },
    { option_key: 'C', option_value: '' },
    { option_key: 'D', option_value: '' }
  ]
  manualQuestionForm.answer = ''
  manualQuestionForm.analysis = ''
  manualQuestionForm.total_score = 2
  manualQuestionForm.subs = []
  manualAddQuestionModalVisible.value = true
}

// 题型切换处理
const handleManualExerciseTypeChange = (val) => {
  const typeMap = {
    1: '单选题',
    2: '多选题',
    3: '填空题',
    4: '解答题',
    5: '判断题'
  }
  manualQuestionForm.exercise_type_name = typeMap[val] || '单选题'
  
  // 判断题默认添加正确/错误选项
  if (val === 5 && manualQuestionForm.options.length === 0) {
    manualQuestionForm.options = [
      { option_key: 'A', option_value: '正确' },
      { option_key: 'B', option_value: '错误' }
    ]
  }
}

// 添加选项
const addManualOption = () => {
  const len = manualQuestionForm.options.length
  const nextChar = String.fromCharCode(65 + len) // A=65, B=66, ...
  manualQuestionForm.options.push({ option_key: nextChar, option_value: '' })
}

// 删除选项
const removeManualOption = (idx) => {
  if (manualQuestionForm.options.length > 2) {
    manualQuestionForm.options.splice(idx, 1)
    // 重新排序选项字母
    manualQuestionForm.options.forEach((opt, index) => {
      opt.option_key = String.fromCharCode(65 + index)
    })
  } else {
    ElMessage.warning('至少需要保留两个选项')
  }
}

// 添加解答题小题
const addManualSub = () => {
  if (!manualQuestionForm.subs) {
    manualQuestionForm.subs = []
  }
  manualQuestionForm.subs.push({
    stem: '',
    answer: '',
    analysis: '',
    score: ''
  })
}

// 删除解答题小题
const removeManualSub = (idx) => {
  if (manualQuestionForm.subs && manualQuestionForm.subs.length > 0) {
    manualQuestionForm.subs.splice(idx, 1)
  }
}

// 保存手动录入的题目
const confirmSaveManualQuestion = async () => {
  if (!manualQuestionForm.stem.trim()) {
    ElMessage.warning('请输入题干')
    return
  }
  if (!manualQuestionForm.answer.trim()) {
    ElMessage.warning('请输入答案')
    return
  }

  // 判断是编辑还是新增
  const isEdit = !!manualQuestionForm.id

  savingManualQuestion.value = true
  try {
    // 处理选项数据
    // 编辑模式需要数组格式，新增模式需要对象格式
    const optionsArray = [1, 2, 5].includes(manualQuestionForm.exercise_type) 
      ? manualQuestionForm.options.filter(opt => opt.option_key && opt.option_value)
      : []
    
    // 准备题目数据
    const questionData = {
      exercise_type_name: manualQuestionForm.exercise_type_name,
      stem: manualQuestionForm.stem,
      answer: manualQuestionForm.answer,
      analysis: manualQuestionForm.analysis,
      total_score: manualQuestionForm.total_score,
      level: manualQuestionForm.level,
      options: optionsArray,
      subs: manualQuestionForm.exercise_type === 4 ? manualQuestionForm.subs : null,
      major_id: manualQuestionForm.major_id,
      chapter_id: manualQuestionForm.chapter_id,
      tag_ids: manualQuestionForm.tag_ids
    }

    if (isEdit) {
      // 编辑现有题目
      await adminApi.updateQuestion('computer', manualQuestionForm.id, questionData)
      
      // 实时更新本地数据
      const questionId = manualQuestionForm.id
      for (const sectionId in sectionQuestions.value) {
        const questions = sectionQuestions.value[sectionId]
        const index = questions.findIndex(q => q.question_id === questionId)
        if (index !== -1) {
          // 更新本地题目数据
          sectionQuestions.value[sectionId][index] = {
            ...questions[index],
            stem: questionData.stem,
            answer: questionData.answer,
            analysis: questionData.analysis,
            total_score: questionData.total_score,
            exercise_type_name: questionData.exercise_type_name,
            options: questionData.options
          }
        }
      }
      
      // 同时更新当前查看的题目
      if (currentQuestion.value && currentQuestion.value.question_id === questionId) {
        currentQuestion.value = {
          ...currentQuestion.value,
          stem: questionData.stem,
          answer: questionData.answer,
          analysis: questionData.analysis,
          total_score: questionData.total_score,
          exercise_type_name: questionData.exercise_type_name,
          options: questionData.options
        }
      }
      
      ElMessage.success('编辑成功')
    } else {
      // 创建新题目
      const res = await adminApi.createQuestion(questionData)
      const newQuestionId = res.data?.question_id

      if (newQuestionId && currentSectionForManualAdd.value) {
        // 添加到小节
        await adminApi.addTutorialQuestion({
          tutorial_id: tutorialId,
          chapter_id: currentSectionForManualAdd.value.id,
          question_id: newQuestionId,
          sort_order: sectionQuestions.value[currentSectionForManualAdd.value.id]?.length || 0
        })

        // 刷新题目列表
        await loadSectionQuestions(currentSectionForManualAdd.value.id)

        // 更新题目数量
        currentSectionForManualAdd.value.question_count = (currentSectionForManualAdd.value.question_count || 0) + 1

        ElMessage.success('添加成功')
      }
    }

    manualAddQuestionModalVisible.value = false

    // 重置表单
    resetManualQuestionForm()
  } catch (error) {
    console.error(isEdit ? '编辑题目失败:' : '手动添加题目失败:', error)
    ElMessage.error(isEdit ? '编辑题目失败' : '手动添加题目失败')
  } finally {
    savingManualQuestion.value = false
  }
}

// 重置手动录入表单
const resetManualQuestionForm = () => {
  manualQuestionForm.id = null
  manualQuestionForm.exercise_type = 1
  manualQuestionForm.exercise_type_name = '单选题'
  manualQuestionForm.stem = ''
  manualQuestionForm.options = [
    { option_key: 'A', option_value: '' },
    { option_key: 'B', option_value: '' },
    { option_key: 'C', option_value: '' },
    { option_key: 'D', option_value: '' }
  ]
  manualQuestionForm.answer = ''
  manualQuestionForm.analysis = ''
  manualQuestionForm.total_score = 2
  manualQuestionForm.subs = []
  manualQuestionForm.level = 0
  manualQuestionForm.major_id = ''
  manualQuestionForm.chapter_id = ''
  manualQuestionForm.tag_ids = []
}

// 查看题目
const viewQuestion = (question) => {
  currentQuestion.value = question
  viewQuestionModalVisible.value = true
}

// 打开编辑题目弹窗
const openEditQuestionModal = async () => {
  if (!currentQuestion.value) return
  
  console.log('当前题目:', currentQuestion.value)
  console.log('选项数据:', currentQuestion.value.options)
  
  // 逐个属性赋值，确保响应式更新
  manualQuestionForm.id = currentQuestion.value.question_id
  manualQuestionForm.exercise_type = getExerciseTypeFromName(currentQuestion.value.exercise_type_name) || 1
  manualQuestionForm.exercise_type_name = currentQuestion.value.exercise_type_name || '单选题'
  manualQuestionForm.stem = currentQuestion.value.stem || ''
  manualQuestionForm.answer = currentQuestion.value.answer || ''
  manualQuestionForm.analysis = currentQuestion.value.analysis || ''
  manualQuestionForm.total_score = currentQuestion.value.total_score || 2
  manualQuestionForm.level = currentQuestion.value.level || 0
  
  // 处理科目章节考点
  manualQuestionForm.major_id = currentQuestion.value.major_id ? String(currentQuestion.value.major_id) : ''
  manualQuestionForm.chapter_id = currentQuestion.value.chapter_id ? String(currentQuestion.value.chapter_id) : ''
  
  // 加载科目列表
  if (subjects.value.length === 0) {
    await fetchSubjects()
  }
  
  // 如果有科目ID，加载章节列表
  if (manualQuestionForm.major_id) {
    await fetchComputerChapters(manualQuestionForm.major_id)
  }
  
  // 如果有章节ID，加载考点分类
  if (manualQuestionForm.chapter_id) {
    await fetchKnowledgeTags(manualQuestionForm.chapter_id)
  }
  
  // 处理考点分类ID
  if (currentQuestion.value.tags && Array.isArray(currentQuestion.value.tags)) {
    manualQuestionForm.tag_ids = currentQuestion.value.tags.map(t => String(t.tag_id || t.id))
  } else {
    manualQuestionForm.tag_ids = []
  }
  
  // 处理选项数据 - 需要替换整个数组
  if (currentQuestion.value.options && currentQuestion.value.options.length > 0) {
    manualQuestionForm.options = currentQuestion.value.options.map(opt => ({
      option_key: opt.option_key || '',
      option_value: opt.option_value || ''
    }))
  } else {
    manualQuestionForm.options = [
      { option_key: 'A', option_value: '' },
      { option_key: 'B', option_value: '' },
      { option_key: 'C', option_value: '' },
      { option_key: 'D', option_value: '' }
    ]
  }
  
  // 处理小题数据
  manualQuestionForm.subs = currentQuestion.value.subs 
    ? JSON.parse(JSON.stringify(currentQuestion.value.subs)) 
    : []
  
  console.log('表单选项:', manualQuestionForm.options)
  
  // 关闭查看弹窗，打开编辑弹窗
  viewQuestionModalVisible.value = false
  manualAddQuestionModalVisible.value = true
}

// 根据题型名称获取题型代码
const getExerciseTypeFromName = (typeName) => {
  const typeMap = {
    '单选题': 1,
    '多选题': 2,
    '填空题': 3,
    '解答题': 4,
    '判断题': 5
  }
  return typeMap[typeName] || 1
}

// 拖拽结束
const onQuestionDragEnd = (section) => {
  questionOrderChanged.value[section.id] = true
}

// 保存题目顺序
const saveQuestionOrder = async (section) => {
  const questions = sectionQuestions.value[section.id]
  if (!questions || questions.length === 0) return
  
  try {
    const orderData = questions.map((q, index) => ({
      question_id: q.question_id,
      sort_order: index + 1
    }))
    
    await adminApi.updateTutorialQuestionOrder({
      chapter_id: section.id,
      questions: orderData
    })
    ElMessage.success('顺序保存成功')
    questionOrderChanged.value[section.id] = false
  } catch (error) {
    console.error('保存顺序失败:', error)
    ElMessage.error('保存顺序失败')
  }
}

// 去除 HTML 标签
const stripHtml = (html) => {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, '')
}

// 返回
const goBack = () => {
  router.push('/computer/tutorials')
}

// 获取科目列表
const fetchSubjects = async () => {
  try {
    const res = await adminApi.getComputerSubjects()
    subjects.value = res.data || []
  } catch (error) {
    console.error('获取科目失败:', error)
  }
}

// 获取计算机章节列表（用于编辑题目时的科目章节选择）
const fetchComputerChapters = async (majorId) => {
  if (!majorId) {
    chapters.value = []
    return
  }
  try {
    const res = await adminApi.getComputerChapters({ majorId })
    let data = res.data
    if (data && data.chapters && Array.isArray(data.chapters)) {
      data = data.chapters
    }
    chapters.value = data || []
  } catch (error) {
    console.error('获取章节失败:', error)
  }
}

// 获取考点分类列表
const fetchKnowledgeTags = async (chapterId) => {
  if (!chapterId) {
    knowledgeTags.value = []
    return
  }
  loadingTags.value = true
  try {
    const res = await adminApi.getComputerKnowledgeTags({ chapterId })
    let data = res.data?.tags || res.data
    if (!Array.isArray(data)) {
      data = data?.list || data?.items || []
    }
    knowledgeTags.value = data
  } catch (error) {
    console.error('获取考点分类失败:', error)
  } finally {
    loadingTags.value = false
  }
}

// 处理科目变化
const handleMajorChange = async (majorId) => {
  manualQuestionForm.chapter_id = ''
  manualQuestionForm.tag_ids = []
  await fetchComputerChapters(majorId)
}

// 处理章节变化
const handleChapterChange = async (chapterId) => {
  manualQuestionForm.tag_ids = []
  await fetchKnowledgeTags(chapterId)
}

onMounted(() => {
  fetchTutorialDetail()
  fetchChapters()
})
</script>

<style scoped>
.tutorial-chapter-manage {
  padding: 20px;
}

.dialog-header-with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.mt-20 {
  margin-top: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
}

.loading-container,
.empty-container {
  padding: 40px;
  text-align: center;
}

.chapter-tree-container {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.chapter-item {
  border-bottom: 1px solid #e4e7ed;
}

.chapter-item:last-child {
  border-bottom: none;
}

.chapter-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.chapter-header:hover {
  background-color: #f5f7fa;
}

.chapter-header.expanded {
  background-color: #ecf5ff;
}

.expand-icon {
  margin-right: 8px;
  transition: transform 0.3s;
}

.folder-icon,
.document-icon {
  margin-right: 8px;
  color: #409eff;
}

.chapter-name,
.section-name {
  flex: 1;
  font-weight: 500;
}

.chapter-count,
.section-count {
  color: #909399;
  font-size: 12px;
  margin-left: 8px;
}

.chapter-actions,
.section-actions {
  margin-left: auto;
}

.section-list {
  background-color: #fafafa;
}

.section-item {
  border-top: 1px solid #ebeef5;
}

.section-header {
  display: flex;
  align-items: center;
  padding: 10px 16px 10px 40px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.section-header:hover {
  background-color: #f5f7fa;
}

.section-header.expanded {
  background-color: #e6f7ff;
}

.question-list {
  padding: 10px 16px 10px 80px;
  background-color: #fff;
  border-top: 1px solid #ebeef5;
}

.question-loading,
.question-empty {
  padding: 20px;
  text-align: center;
  color: #909399;
}

.question-toolbar {
  margin-bottom: 10px;
  text-align: right;
}

.question-drag-list {
  min-height: 50px;
}

.question-item {
  display: flex;
  align-items: center;
  padding: 10px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  margin-bottom: 8px;
  cursor: move;
}

.question-item:hover {
  background: #f5f7fa;
}

.drag-handle {
  margin-right: 8px;
  color: #909399;
  cursor: move;
}

.question-index {
  margin-right: 8px;
  color: #606266;
  font-weight: 500;
  min-width: 30px;
}

.question-type {
  margin-right: 8px;
  color: #409eff;
  font-size: 12px;
  min-width: 60px;
}

.question-stem {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 16px;
}

.question-actions {
  display: flex;
  gap: 8px;
}

.option-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.option-label {
  margin-right: 8px;
  font-weight: 500;
  min-width: 20px;
}

.option-actions {
  margin-top: 10px;
}

/* 题目编辑弹窗样式 - 与computer-manage一致 */
.question-edit-dialog :deep(.el-dialog__body) {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
}

.question-edit-form {
  .el-form-item {
    margin-bottom: 20px;
  }

  .form-item-stem,
  .form-item-answer,
  .form-item-analysis {
    .el-form-item__content {
      width: calc(100% - 100px);
    }
  }

  .editor-wrapper {
    width: 100%;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    overflow: hidden;
  }

  .options-list {
    .option-edit-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;

      .option-editor-wrapper {
        flex: 1;
        border: 1px solid #dcdfe6;
        border-radius: 4px;
        overflow: hidden;
      }
    }
  }

  .add-option-btn {
    margin-top: 10px;
  }

  .subs-list {
    .sub-item-editor {
      border: 1px solid #e4e7ed;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
      background-color: #fafafa;

      .sub-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 1px solid #e4e7ed;

        .sub-index {
          font-weight: 600;
          color: #409eff;
        }
      }

      .sub-content {
        .el-form-item {
          margin-bottom: 15px;

          &:last-child {
            margin-bottom: 0;
          }
        }
      }
    }
  }

  .mt-10 {
    margin-top: 10px;
  }
}

.question-detail {
  padding: 20px;
}

.question-info p {
  margin: 10px 0;
}

.question-content,
.options-list,
.analysis-content {
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
  margin: 10px 0;
}

.option-line {
  margin: 5px 0;
}

.filter-bar {
  display: flex;
  align-items: center;
}

.mb-20 {
  margin-bottom: 20px;
}

.mt-20 {
  margin-top: 20px;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
}
</style>
