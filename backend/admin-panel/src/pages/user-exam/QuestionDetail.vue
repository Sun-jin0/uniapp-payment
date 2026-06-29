<template>
  <div class="question-detail-page">
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>
    
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <el-button @click="loadQuestion">重新加载</el-button>
    </div>
    
    <div v-else-if="question" class="question-container">
      <!-- 题目头部 -->
      <div class="question-header">
        <div class="header-left">
          <span class="question-id">ID: {{ question.QuestionID }}</span>
          <span class="question-type">{{ question.QuestionType }}</span>
          <span class="question-difficulty">难度: <span v-html="renderStars(question.Difficulty)"></span></span>
        </div>
        <div class="header-right">
          <el-button v-if="!editing" type="warning" plain @click="enterEditMode">编辑</el-button>
          <el-button @click="goBack">返回列表</el-button>
          <el-button type="primary" @click="toggleBasket">
            {{ isInBasket ? '移出试题篮' : '加入试题篮' }}
          </el-button>
        </div>
      </div>
      
      <!-- 题目内容 -->
      <div class="question-content">
        <h3>题目内容</h3>
        <div v-if="editing" class="edit-field" style="margin-bottom: 16px;">
          <label style="font-weight: bold; margin-right: 8px;">题型：</label>
          <el-select v-model="editForm.questionType" style="width: 150px;">
            <el-option v-for="t in questionTypes" :key="t" :label="t" :value="t" />
          </el-select>
        </div>
        <div v-if="!editing" class="question-body" v-html="renderLatex(question.QuestionText)"></div>
        <div v-else class="edit-field">
          <el-input
            type="textarea"
            v-model="editForm.questionText"
            :rows="6"
            placeholder="输入题目内容（支持 LaTeX 公式）"
          />
          <div class="preview-box">
            <div class="preview-label">实时预览</div>
            <div class="preview-body" v-html="renderLatex(editForm.questionText)"></div>
          </div>
        </div>
        <img v-if="question.QuestionImg" :src="question.QuestionImg" class="question-img" />
      </div>
      
      <!-- 答案 -->
      <div class="answer-section" v-if="question.Answer || question.OriginalAnswerText">
        <h3>答案</h3>
        <div v-if="!editing" class="answer-content" v-html="renderLatex(question.Answer || question.OriginalAnswerText)"></div>
        <div v-else class="edit-field">
          <el-input
            type="textarea"
            v-model="editForm.answerText"
            :rows="4"
            placeholder="输入答案内容（支持 LaTeX 公式）"
          />
          <div class="preview-box">
            <div class="preview-label">实时预览</div>
            <div class="preview-body" v-html="renderLatex(editForm.answerText)"></div>
          </div>
        </div>
      </div>
      
      <!-- 解析详情 -->
      <div class="analysis-section" v-if="details.length > 0">
        <h3>解析详情</h3>
        <div class="analysis-tabs">
          <div 
            v-for="(detail, idx) in details" 
            :key="idx"
            class="analysis-tab"
            :class="{ active: activeTab === idx }"
            @click="activeTab = idx"
          >
            {{ detail.BusType || `详情${idx + 1}` }}
            <span v-if="detail.LinkedKnowledgePointID && getLinkedKP(detail.LinkedKnowledgePointID)" class="kp-badge">
              考点
            </span>
          </div>
        </div>
        <div class="analysis-content" v-if="details[activeTab]">
          <div class="analysis-header" v-if="details[activeTab].LinkedKnowledgePointID && getLinkedKP(details[activeTab].LinkedKnowledgePointID)">
            <span class="kp-link">
              <el-icon><Link /></el-icon>
              关联考点: {{ getLinkedKP(details[activeTab].LinkedKnowledgePointID).KPTitle || getLinkedKP(details[activeTab].LinkedKnowledgePointID).KPContent }}
            </span>
          </div>
          <div v-if="!editing" class="analysis-body" v-html="renderLatex(transformAnalysisText(getDetailContent(details[activeTab])))"></div>
          <div v-else class="edit-field">
            <el-input
              type="textarea"
              v-model="editForm.details[activeTab].Context"
              :rows="6"
              :placeholder="`输入${details[activeTab].BusType || '详情'}内容（支持 LaTeX 公式）`"
            />
            <div class="preview-box">
              <div class="preview-label">实时预览</div>
              <div class="preview-body" v-html="renderLatex(transformAnalysisText(editForm.details[activeTab].Context || ''))"></div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 编辑模式操作按钮 -->
      <div v-if="editing" class="edit-actions">
        <el-button type="primary" :loading="saving" @click="saveEdits">保存修改</el-button>
        <el-button :disabled="saving" @click="cancelEdits">取消</el-button>
      </div>

      <!-- 相似题 -->
      <div class="related-section" v-if="relatedQuestions.length > 0">
        <h3>相似题目</h3>
        <div class="related-list">
          <div v-for="(rq, idx) in relatedQuestions" :key="rq.QuestionID" class="related-item">
            <div class="related-header">
              <span class="related-num">{{ idx + 1 }}.</span>
              <span class="related-type">{{ rq.QuestionType }}</span>
            </div>
            <div class="related-body" v-html="renderLatex(rq.QuestionText)"></div>
            <div class="related-footer">
              <el-button size="small" @click="viewRelatedDetail(rq.QuestionID)">查看详情</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Loading, Link } from '@element-plus/icons-vue'
import { adminApi } from '../../api'
import katex from 'katex'
import 'katex/dist/katex.min.css'

const route = useRoute()
const router = useRouter()

const question = ref(null)
const details = ref([])
const knowledgePoints = ref([])
const relatedQuestions = ref([])
const loading = ref(true)
const error = ref('')
const activeTab = ref(0)

const basket = ref(JSON.parse(localStorage.getItem('question_basket') || '[]'))
const editing = ref(false)
const saving = ref(false)
const editForm = ref({ questionText: '', answerText: '', details: [] })

const isInBasket = computed(() => {
  return basket.value.some(q => q.QuestionID === question.value?.QuestionID)
})

const renderLatex = (text) => {
  if (!text) return ''

  const MATH_PH_PREFIX = '__MATH_ONLY_PH_'

  let currentText = text.trim().replace(/\t/g, ' ').replace(/ {2,}/g, ' ')

  // 第一步：完全提取所有数学公式，从文本中移除
  const mathStore = []
  let mathRegex
  try {
    mathRegex = /(\$\$[\s\S]*?\$\$)|((?<!\\)\$([\s\S]+?)(?<!\\)\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))/g
  } catch (e) {
    mathRegex = /(\$\$[\s\S]*?\$\$)|(\$([\s\S]+?)\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))/g
  }

  currentText = currentText.replace(mathRegex, (match) => {
    const id = mathStore.length
    mathStore.push(match)
    return MATH_PH_PREFIX + id + '__'
  })

  // 第二步：对非公式文本进行 HTML 实体解码和文本替换
  currentText = currentText
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")

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

  currentText = currentText
    .replace(/\\color\{#([0-9A-Fa-f]{6})\}\{([^}]+)\}/g, '<span style="color:#$1;">$2</span>')
    .replace(/\\bold\{([^}]+)\}/g, '<b>$1</b>')
    .replace(/\\mathbf\{([^}]+)\}/g, '<b>$1</b>')

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

  currentText = currentText.replace(
    /(https?:\/\/[^\s<>"]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp))(?:_yjs|_thumb|_small|_medium|_large)?(?!["'])/gi,
    (match, url) => {
      const cleanUrl = url.replace(/(_yjs|_thumb|_small|_medium|_large)$/i, '')
      return `<img src="${cleanUrl}" style="max-width:100%;height:auto;display:block;margin:10px 0;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" onerror="this.style.display='none'" />`
    }
  )

  // 第三步：渲染每个公式（使用原始未修改的公式文本）
  for (let i = 0; i < mathStore.length; i++) {
    const match = mathStore[i]
    let expression = ''
    let displayMode = false

    if (match.startsWith('$$') && match.endsWith('$$')) {
      expression = match.slice(2, -2)
      displayMode = true
    } else if (match.startsWith('\\[') && match.endsWith('\\]')) {
      expression = match.slice(2, -2)
      displayMode = true
    } else if (match.startsWith('$') && match.endsWith('$')) {
      expression = match.slice(1, -1)
      displayMode = false
    } else if (match.startsWith('\\(') && match.endsWith('\\)')) {
      expression = match.slice(2, -2)
      displayMode = false
    }

    let rendered
    if (expression.trim()) {
      try {
        rendered = katex.renderToString(expression, {
          throwOnError: true,
          displayMode: displayMode,
          strict: false
        })
      } catch (e) {
        if (!displayMode) {
          try {
            rendered = katex.renderToString(expression, {
              throwOnError: false,
              displayMode: true,
              strict: false
            })
          } catch (e2) {
            console.warn('KaTeX render error:', e2)
            rendered = `<span class="katex-error" style="color:#ff4d4f;border-bottom:1px dashed #ff4d4f;" title="${e2.message.replace(/"/g, '&quot;')}">${match.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`
          }
        } else {
          console.warn('KaTeX render error:', e)
          rendered = `<span class="katex-error" style="color:#ff4d4f;border-bottom:1px dashed #ff4d4f;" title="${e.message.replace(/"/g, '&quot;')}">${match.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`
        }
      }
    } else {
      rendered = ''
    }

    const ph = MATH_PH_PREFIX + i + '__'
    currentText = currentText.replace(ph, rendered)
  }

  // 第四步：处理非公式文本中的特殊符号
  currentText = currentText.replace(/\\neq?(?!\s*[a-zA-Z])/g, (match) => {
    try {
      return katex.renderToString('\\neq', { throwOnError: false, displayMode: false })
    } catch (e) {
      return match
    }
  })

  currentText = currentText.replace(/≠/g, (match) => {
    try {
      return katex.renderToString('\\neq', { throwOnError: false, displayMode: false })
    } catch (e) {
      return match
    }
  })

  currentText = currentText.replace(/≤/g, (match) => {
    try {
      return katex.renderToString('\\leq', { throwOnError: false, displayMode: false })
    } catch (e) {
      return match
    }
  })

  currentText = currentText.replace(/≥/g, (match) => {
    try {
      return katex.renderToString('\\geq', { throwOnError: false, displayMode: false })
    } catch (e) {
      return match
    }
  })

  // 第五步：隔离 SVG 后转义换行
  const svgPlaceholders = []
  currentText = currentText.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, (match) => {
    const p = `__SVG_PH_${svgPlaceholders.length}__`
    svgPlaceholders.push({ p, content: match })
    return p
  })

  currentText = currentText.replace(/\n/g, '<br>')

  svgPlaceholders.forEach(({ p, content }) => {
    currentText = currentText.replace(p, content)
  })

  return currentText
}

const renderStars = (difficulty) => {
  const val = difficulty || 0.5
  const fullStars = Math.floor(val * 5)
  const stars = []
  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push('★')
    } else {
      stars.push('☆')
    }
  }
  return `<span style="color: #f59e0b;">${stars.join('')}</span>`
}

const transformAnalysisText = (text) => {
  if (!text) return ''
  
  let content = text.trim()
    .replace(/／/g, '/')
    .replace(/\．/g, '.')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n(?![a-zA-Z])/g, '\n')
  
  content = content.replace(/\\\\\(/g, '\\(').replace(/\\\\\)/g, '\\)')
  content = content.replace(/\\\\\[/g, '\\[').replace(/\\\\\]/g, '\\]')
  
  const latexBlocks = []
  
  content = content.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
    latexBlocks.push(match)
    return `__LATEX_BLOCK_${latexBlocks.length - 1}__`
  })
  
  content = content.replace(/\$[^\$]+\$/g, (match) => {
    latexBlocks.push(match)
    return `__LATEX_INLINE_${latexBlocks.length - 1}__`
  })
  
  content = content.replace(/\\\([\s\S]*?\\\)/g, (match) => {
    latexBlocks.push(match)
    return `__LATEX_PAREN_${latexBlocks.length - 1}__`
  })
  
  content = content.replace(/\\\[[\s\S]*?\\\]/g, (match) => {
    latexBlocks.push(match)
    return `__LATEX_BRACKET_${latexBlocks.length - 1}__`
  })
  
  content = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    let cleanUrl = url.replace(/(_yjs|_thumb|_small|_medium|_large)(\?.*)?$/i, '$2')
    return `<div style="width:50%;"><img src="${cleanUrl}" style="max-width:100%;height:auto;display:block;margin:5px 0;" alt="${alt}" /></div>`
  })
  
  const answerLabelStyle = 'color:#fff;background-color:#009688;padding:1px 6px;margin-right:6px;border-radius:4px;font-size:12px;'
  const analysisLabelStyle = 'color:#fff;background-color:#009688;padding:1px 6px;margin-right:6px;border-radius:4px;font-size:12px;'
  
  content = content.replace(/《答案》\s*【答案】\s*《\/答案》/g, `<span style="${answerLabelStyle}">答案</span>`)
  content = content.replace(/《答案》\s*【证明】\s*《\/答案》/g, `<span style="${answerLabelStyle}">证明</span>`)
  content = content.replace(/《答案》\s*【解析】\s*《\/答案》/g, `<span style="${answerLabelStyle}">答案</span>`)
  content = content.replace(/《答案》([\s\S]*?)《\/答案》/g, `<span style="${answerLabelStyle}">答案</span>$1`)
  
  content = content.replace(/《分析》\s*【解析】\s*《\/分析》/g, `<span style="${analysisLabelStyle}">解析</span>`)
  content = content.replace(/《分析》\s*【思路分析】\s*《\/分析》/g, `<span style="${analysisLabelStyle}">思路分析</span>`)
  content = content.replace(/《分析》([\s\S]*?)《\/分析》/g, `<span style="${analysisLabelStyle}">分析</span><span style="color:#009688;">$1</span>`)
  
  content = content.replace(/《注释》([\s\S]*?)《\/注释》/g, '<span style="color:#009688;">$1</span>')
  content = content.replace(/《步骤》([\s\S]*?)《\/步骤》/g, '<span style="color:#FF9800;font-weight:bold;">$1</span>')
  content = content.replace(/《点评》[\s\S]*?《\/点评》/g, '')
  content = content.replace(/【欧几里得[^】]*?】/g, '')
  content = content.replace(/【命题人[^】]*?】/g, '')
  
  content = content.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  content = content.replace(/^## (.+)$/gm, '<h3>$1</h3>')
  content = content.replace(/^# (.+)$/gm, '<h3>$1</h3>')
  
  content = content.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
  content = content.replace(/`([^`]+)`/g, '<code>$1</code>')
  
  content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  
  content = content.replace(/__LATEX_BLOCK_(\d+)__/g, (match, index) => latexBlocks[index])
  content = content.replace(/__LATEX_INLINE_(\d+)__/g, (match, index) => latexBlocks[index])
  content = content.replace(/__LATEX_PAREN_(\d+)__/g, (match, index) => latexBlocks[index])
  content = content.replace(/__LATEX_BRACKET_(\d+)__/g, (match, index) => latexBlocks[index])
  
  return content
}

// 获取关联的知识点
const getLinkedKP = (kpId) => {
  if (!kpId) return null
  return knowledgePoints.value.find(kp => String(kp.KnowledgePointID) === String(kpId))
}

// 获取详情内容（如果Context为空，使用知识点的KPContent）
const getDetailContent = (detail) => {
  if (detail.Context) return detail.Context
  if (detail.LinkedKnowledgePointID) {
    const kp = getLinkedKP(detail.LinkedKnowledgePointID)
    if (kp && kp.KPContent) return kp.KPContent
  }
  return ''
}

const loadQuestion = async () => {
  const questionId = route.params.id
  if (!questionId) {
    error.value = '题目ID不存在'
    loading.value = false
    return
  }
  
  loading.value = true
  error.value = ''
  
  try {
    const res = await adminApi.getMathQuestionDetail(questionId)
    if (res.code === 0 && res.data) {
      question.value = res.data.question || null
      // 排序详情：题目详解 → 一题多解 → 考点 → 其他
      const rawDetails = res.data.details || []
      const sortedDetails = rawDetails.sort((a, b) => {
        const getOrder = (d) => {
          if (d.BusType === '题目详解') return 1
          if (d.BusType === '一题多解') return 2
          if (d.LinkedKnowledgePointID) return 3
          return 4
        }
        return getOrder(a) - getOrder(b)
      })
      details.value = sortedDetails
      knowledgePoints.value = res.data.knowledgePoints || []
      
      // 加载相似题
      loadRelatedQuestions(questionId)
    } else {
      error.value = '题目不存在'
    }
  } catch (err) {
    console.error('加载题目失败:', err)
    error.value = '加载题目失败'
  } finally {
    loading.value = false
  }
}

const loadRelatedQuestions = async (questionId) => {
  try {
    const res = await adminApi.getRelatedQuestions(questionId)
    if (res.code === 0 && res.data) {
      relatedQuestions.value = res.data
    }
  } catch (err) {
    console.error('加载相似题失败:', err)
  }
}

const toggleBasket = () => {
  if (!question.value) return
  
  if (isInBasket.value) {
    basket.value = basket.value.filter(q => q.QuestionID !== question.value.QuestionID)
    ElMessage.success('已从试题篮移除')
  } else {
    basket.value.push(question.value)
    ElMessage.success('已加入试题篮')
  }
  
  localStorage.setItem('question_basket', JSON.stringify(basket.value))
}

const goBack = () => {
  router.back()
}

const viewRelatedDetail = (questionId) => {
  router.push(`/questions/math-paper-select/${questionId}`)
}

// 编辑模式
const questionTypes = ['选择题', '多选题', '填空题', '解答题', '判断题']

const enterEditMode = () => {
  editForm.value = {
    questionText: question.value.QuestionText || '',
    answerText: question.value.Answer || question.value.OriginalAnswerText || '',
    questionType: question.value.QuestionType || '选择题',
    details: details.value.map(d => ({ 
      ID: d.ID, 
      Context: d.Context || '', 
      BusType: d.BusType,
      LinkedKnowledgePointID: d.LinkedKnowledgePointID,
      Give: d.Give || 0
    }))
  }
  editing.value = true
}

const saveEdits = async () => {
  saving.value = true
  try {
    const updateData = {
      questionText: editForm.value.questionText,
      answerText: editForm.value.answerText,
      questionType: editForm.value.questionType,
      details: editForm.value.details.map(d => ({
        ID: d.ID,
        Context: d.Context,
        LinkedKnowledgePointID: d.LinkedKnowledgePointID,
        BusType: d.BusType,
        Give: d.Give
      }))
    }
    await adminApi.updateMathQuestion(question.value.QuestionID, updateData)
    ElMessage.success('修改已保存')
    editing.value = false
    await loadQuestion()
  } catch (err) {
    console.error('保存失败:', err)
    ElMessage.error('保存失败，请重试')
  } finally {
    saving.value = false
  }
}

const cancelEdits = () => {
  editing.value = false
}

onMounted(() => {
  loadQuestion()
})
</script>

<style scoped>
.question-detail-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.question-detail-page :deep(.question-body),
.question-detail-page :deep(.answer-content),
.question-detail-page :deep(.analysis-body),
.question-detail-page :deep(.related-body),
.question-detail-page :deep(.preview-body) {
  font-family: 'Times New Roman', 'SimSun', serif;
}

.question-detail-page :deep(.question-body .katex),
.question-detail-page :deep(.answer-content .katex),
.question-detail-page :deep(.analysis-body .katex),
.question-detail-page :deep(.related-body .katex),
.question-detail-page :deep(.preview-body .katex) {
  font-family: 'Times New Roman', serif;
}

.question-detail-page :deep(.katex .mord),
.question-detail-page :deep(.katex .mbin),
.question-detail-page :deep(.katex .mrel),
.question-detail-page :deep(.katex .mopen),
.question-detail-page :deep(.katex .mclose),
.question-detail-page :deep(.katex .mpunct),
.question-detail-page :deep(.katex .minner) {
  font-family: 'Times New Roman', serif;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  gap: 20px;
  color: #666;
}

.question-container {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
  background: #f8f9fa;
  border-radius: 8px 8px 0 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.question-id {
  color: #666;
  font-size: 13px;
}

.question-type {
  background: #1890ff;
  color: #fff;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
}

.question-difficulty {
  color: #666;
  font-size: 13px;
}

.header-right {
  display: flex;
  gap: 10px;
}

.question-content,
.answer-section,
.analysis-section,
.related-section {
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.question-content h3,
.answer-section h3,
.analysis-section h3,
.related-section h3 {
  color: #1890ff;
  margin-bottom: 15px;
  font-size: 16px;
  border-left: 3px solid #1890ff;
  padding-left: 10px;
}

.question-body {
  line-height: 1.8;
  font-size: 15px;
}

.question-img {
  max-width: 100%;
  max-height: 300px;
  margin-top: 15px;
  border-radius: 4px;
}

.answer-content {
  background: #f0f9ff;
  padding: 15px;
  border-radius: 4px;
  line-height: 1.8;
}

.analysis-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 15px;
}

.analysis-tab {
  padding: 8px 16px;
  background: #f0f0f0;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 13px;
}

.analysis-tab:hover {
  background: #e0e0e0;
}

.analysis-tab.active {
  background: #1890ff;
  color: #fff;
}

.kp-badge {
  display: inline-block;
  background: #ff9800;
  color: #fff;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 10px;
  margin-left: 5px;
}

.analysis-content {
  background: #fafafa;
  padding: 15px;
  border-radius: 4px;
}

.analysis-header {
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px dashed #e0e0e0;
}

.kp-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #009688;
  font-size: 13px;
  background: #e8f5f3;
  padding: 5px 10px;
  border-radius: 4px;
}

.analysis-body {
  line-height: 1.8;
}

.related-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.related-item {
  padding: 15px;
  background: #f8f8f8;
  border-radius: 4px;
}

.related-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.related-num {
  font-weight: bold;
  color: #333;
}

.related-type {
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
  color: #666;
}

.related-body {
  line-height: 1.8;
  margin-bottom: 10px;
}

.related-footer {
  display: flex;
  justify-content: flex-end;
}

/* 编辑模式 */
.edit-field {
  margin-bottom: 15px;
}

.edit-field .el-textarea {
  margin-bottom: 10px;
}

.preview-box {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 12px;
  background: #fafafa;
}

.preview-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px dashed #e0e0e0;
}

.preview-body {
  line-height: 1.8;
  min-height: 30px;
}

.edit-actions {
  padding: 20px;
  display: flex;
  gap: 10px;
  justify-content: center;
  border-bottom: 1px solid #eee;
}

.edit-actions .el-button {
  min-width: 120px;
}

.question-detail-page :deep(.edit-field .el-textarea__inner) {
  font-family: 'Times New Roman', Times, serif;
  font-size: 14px;
  line-height: 1.8;
}

.custom-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: bold;
  margin: 0 2px;
}
.custom-tag.answer {
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  color: #2e7d32;
  border: 1px solid #a5d6a7;
}
.custom-tag.analysis {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  color: #1565c0;
  border: 1px solid #90caf9;
}
.custom-tag.commentary {
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  color: #e65100;
  border: 1px solid #ffcc80;
}
.custom-tag.note {
  background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
  color: #616161;
  font-style: italic;
  border: 1px solid #bdbdbd;
}
.custom-tag.step {
  background: linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%);
  color: #c2185b;
  border: 1px solid #f48fb1;
}

</style>
