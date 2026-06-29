<template>
  <div class="paper-extract">
    <div class="top-nav">
      <div class="nav-left">
        <a class="back-btn" href="#/user-exam/math-paper">← 返回选题</a>
      </div>
      <div class="nav-title">试卷提取预览</div>
      <div class="nav-right"></div>
    </div>

    <div class="extract-container" v-loading="loading">
      <div class="import-banner">
        <span class="banner-icon">📥</span>
        <span>如需将试卷批量导入题库（自动分科目、分章节、去重），请使用</span>
        <a href="#/questions/paper-import" class="banner-link">试卷导入页面</a>
      </div>

      <div class="step-bar">
        <div class="step active">
          <span class="step-num">1</span>
          <span class="step-text">选择科目</span>
        </div>
        <div class="step-line"></div>
        <div class="step" :class="{ active: selectedSubject }">
          <span class="step-num">2</span>
          <span class="step-text">选择套数</span>
        </div>
        <div class="step-line"></div>
        <div class="step" :class="{ active: selectedSubject && selectedSet }">
          <span class="step-num">3</span>
          <span class="step-text">预览题目</span>
        </div>
      </div>

      <div class="selector-section">
        <div class="section-label">选择科目</div>
        <div class="subject-tabs">
          <div v-for="sub in subjects" :key="sub" class="subject-tab" :class="{ active: selectedSubject === sub }" @click="selectSubject(sub)">
            {{ sub }}
          </div>
        </div>
      </div>

      <div class="selector-section" v-if="selectedSubject">
        <div class="section-label">选择套数</div>
        <div class="set-tabs">
          <div v-for="set in availableSets" :key="set" class="set-tab" :class="{ active: selectedSet === set }" @click="selectSet(set)">
            第{{ set }}套
          </div>
        </div>
      </div>

      <div class="paper-section" v-if="selectedSubject && selectedSet">
        <div class="paper-header">
          <div class="paper-title">{{ selectedSubject }} 第{{ selectedSet }}套</div>
          <div class="paper-meta">
            共 {{ paperQuestions.length }} 题
            <span class="meta-sep">|</span>
            <span v-for="stat in typeStats" :key="stat.type" class="meta-item">{{ stat.type }} {{ stat.count }} 题</span>
          </div>
        </div>

        <div class="question-list">
          <div v-for="(item, index) in paperQuestions" :key="item.questionId" class="question-item">
            <!-- 编辑模式 -->
            <template v-if="editingId === item.questionId">
              <div class="edit-mode">
                <div class="edit-field">
                  <label>题干</label>
                  <textarea v-model="editForm.QuestionText" rows="4" class="edit-textarea"></textarea>
                </div>
                <div class="edit-field" v-if="item.question.options && item.question.options.length">
                  <label>选项</label>
                  <div v-for="(opt, oi) in editForm.options" :key="oi" class="edit-option-row">
                    <span class="opt-label">{{ opt.label }}.</span>
                    <input v-model="opt.text" class="edit-input" />
                  </div>
                </div>
                <div class="edit-field">
                  <label>答案（支持LaTeX）</label>
                  <textarea v-model="editForm.OriginalAnswerText" rows="2" class="edit-textarea"></textarea>
                </div>
                <div class="edit-field">
                  <label>难度：{{ editForm.Difficulty }}</label>
                  <input type="range" v-model.number="editForm.Difficulty" min="0" max="1" step="0.1" class="edit-range" />
                </div>
                <div class="edit-field">
                  <label>题型</label>
                  <select v-model="editForm.QuestionType" class="edit-select">
                    <option value="单选题">单选题</option>
                    <option value="多选题">多选题</option>
                    <option value="填空题">填空题</option>
                    <option value="解答题">解答题</option>
                  </select>
                </div>
                <div class="edit-field">
                  <label>解析详情</label>
                  <div v-for="(detail, di) in editForm.details" :key="di" class="edit-detail-row">
                    <select v-model="detail.BusType" class="edit-select-small">
                      <option value="题目详解">题目详解</option>
                      <option value="考点">考点</option>
                      <option value="疑难点">疑难点</option>
                      <option value="一题多解">一题多解</option>
                      <option value="答疑">答疑</option>
                      <option value="其他">其他</option>
                    </select>
                    <input v-model="detail.Title" placeholder="标题（可选）" class="edit-input" style="width:120px" />
                    <textarea v-model="detail.Context" rows="2" class="edit-textarea" style="flex:1"></textarea>
                    <button class="edit-btn-del" @click="removeDetail(di)">×</button>
                  </div>
                  <button class="edit-btn-add" @click="addDetail">+ 添加详情</button>
                </div>
                <div class="edit-actions">
                  <button class="save-btn" @click="saveEdit(item)" :disabled="saving">保存</button>
                  <button class="cancel-btn" @click="cancelEdit">取消</button>
                  <span v-if="saving" class="saving-hint">保存中...</span>
                </div>
              </div>
            </template>

            <!-- 显示模式 -->
            <template v-else>
              <div class="question-body">
                <span class="question-num">{{ index + 1 }}.</span>
                <span v-if="item.sharedWith.length" class="q-shared" title="该题在其他科目套数中也有使用">共享</span>
                <span class="question-text" v-html="renderLatex(getQuestionStem(item.question))"></span>
              </div>

              <div v-if="getQuestionOptions(item.question).length > 0" class="options-grid" :style="{ gridTemplateColumns: `repeat(${item.question.optionLayout || 4}, 1fr)` }">
                <div v-for="opt in getQuestionOptions(item.question)" :key="opt.label" class="option-item">
                  <template v-if="item.question._parsedFromText">
                    <span v-html="renderLatex(opt.text)"></span>
                  </template>
                  <template v-else>
                    <span class="opt-label">{{ opt.label }}.</span>
                    <span v-html="renderLatex(opt.text)"></span>
                  </template>
                </div>
              </div>

              <div class="question-footer">
                <div class="footer-left">
                  <span class="q-type-badge" :class="getTypeClass(item.question.QuestionType)">{{ item.question.QuestionType }}</span>
                  <span>难度: <span v-html="renderStars(item.question.Difficulty)"></span></span>
                  <span v-if="item.question.ShortTitle" class="q-source">({{ item.question.ShortTitle }})</span>
                </div>
                <div class="footer-right">
                  <a @click="toggleDetails(index)">{{ expandedIndex === index ? '收起解析' : '解析' }}</a>
                  <a v-if="isAdmin" class="edit-link" @click="startEdit(item)">编辑</a>
                  <button class="add-btn" :class="{ added: isInBasket(item) }" @click="toggleBasket(item)">
                    {{ isInBasket(item) ? '✓ 已加入' : '+ 试题篮' }}
                  </button>
                </div>
              </div>

              <div v-if="expandedIndex === index" class="parse-panel open">
                <div class="answer-section">
                  <span class="answer-label">答案：</span>
                  <span class="answer-text" v-html="renderLatex(item.question.OriginalAnswerText)"></span>
                </div>
                <div v-for="(detail, di) in item.question.details" :key="di" class="detail-section">
                  <div v-if="detail.Title" class="detail-title" v-html="renderLatex(detail.Title)"></div>
                  <div class="detail-bus-type" v-if="detail.BusType && !detail.Title">【{{ detail.BusType }}】</div>
                  <div class="detail-context" v-html="renderLatex(detail.Context)"></div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { adminApi } from '../../api'
import { ElMessage } from 'element-plus'
import katex from 'katex'
import 'katex/dist/katex.min.css'

const loading = ref(true)
const selectedSubject = ref('')
const selectedSet = ref('')
const expandedIndex = ref(-1)
const editingId = ref(null)
const saving = ref(false)
const isAdmin = ref(true)

const subjects = ref([])
const paperMap = ref({})
const questions = ref([])
const forwardIndex = ref(null)

const editForm = ref({
  QuestionText: '',
  OriginalAnswerText: '',
  Difficulty: 0.5,
  QuestionType: '',
  options: [],
  details: []
})

const basket = ref([])

const availableSets = computed(() => {
  if (!selectedSubject.value || !paperMap.value[selectedSubject.value]) return []
  const order = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8 }
  return Object.keys(paperMap.value[selectedSubject.value]).sort((a, b) => (order[a] || 0) - (order[b] || 0))
})

const paperQuestions = computed(() => {
  if (!selectedSubject.value || !selectedSet.value) return []
  const setData = paperMap.value[selectedSubject.value]?.[selectedSet.value]
  if (!setData) return []
  const numbers = Object.keys(setData).map(Number).sort((a, b) => a - b)
  const result = []
  for (const num of numbers) {
    const qid = setData[num]
    const question = questions.value[qid - 1]
    if (!question) continue
    question.optionLayout = question.optionLayout || 4
    const sharedWith = []
    const refs = forwardIndex.value?.[String(qid)] || []
    for (const ref of refs) {
      const [label] = ref.split('#')
      const setMatch = label.match(/第([\u4e00-\u9fa5]+)套/)
      const refSub = label.replace(/第.+$/, '')
      if (setMatch && refSub !== selectedSubject.value) {
        sharedWith.push(`${refSub}第${setMatch[1]}套`)
      }
    }
    result.push({ questionId: qid, question, number: num, sharedWith })
  }
  return result
})

const typeStats = computed(() => {
  const stats = {}
  for (const item of paperQuestions.value) {
    const type = item.question.QuestionType || '未知'
    if (!stats[type]) stats[type] = 0
    stats[type]++
  }
  return Object.entries(stats).map(([type, count]) => ({ type, count }))
})

const selectSubject = (sub) => {
  selectedSubject.value = sub
  selectedSet.value = ''
  selectedSets.value = []
  expandedIndex.value = -1
  editingId.value = null
}

const selectSet = (set) => {
  selectedSet.value = set
  expandedIndex.value = -1
  editingId.value = null
}

const toggleDetails = (index) => {
  expandedIndex.value = expandedIndex.value === index ? -1 : index
}

const getTypeClass = (type) => {
  const map = { '单选题': 'choice', '多选题': 'choice', '填空题': 'fill', '解答题': 'answer' }
  return map[type] || ''
}

const isInBasket = (item) => {
  return basket.value.some(b => b.questionId === item.questionId)
}

const toggleBasket = (item) => {
  const idx = basket.value.findIndex(b => b.questionId === item.questionId)
  if (idx > -1) {
    basket.value.splice(idx, 1)
    ElMessage.success('已从试题篮移除')
  } else {
    basket.value.push(item)
    ElMessage.success('已添加到试题篮')
  }
}

const parseOptionsFromText = (text) => {
  if (!text) return null
  const formulaPlaceholders = []
  let protectedText = text
  const formulaRe = /(\$\$[\s\S]*?\$\$)|(\$[\s\S]+?\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))/g
  protectedText = protectedText.replace(formulaRe, (match) => {
    const p = `__FORMULA_PH_${formulaPlaceholders.length}__`
    formulaPlaceholders.push({ p, original: match })
    return p
  })
  const lines = protectedText.split('\n').map(l => l.trim())
  let firstOptIdx = -1
  const optLines = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    let label = null
    const formulaMatch = line.match(/^(__FORMULA_PH_\d+__)/)
    if (formulaMatch) {
      const ph = formulaMatch[1]
      const phData = formulaPlaceholders.find(f => f.p === ph)
      if (phData && phData.original) {
        const innerMatch = phData.original.match(/\\rm\s*\{?\s*([A-D])|\\mathrm\s*\{?\s*([A-D])|\(([A-D])\)|（([A-D])）/)
        if (innerMatch) label = innerMatch[1] || innerMatch[2] || innerMatch[3] || innerMatch[4]
      }
    }
    if (!label) {
      const bracketMatch = line.match(/^[（(]\s*([A-D])\s*[）)]/)
      if (bracketMatch) label = bracketMatch[1]
    }
    if (!label) {
      const dotMatch = line.match(/^([A-D])\s*[．.、]/)
      if (dotMatch) label = dotMatch[1]
    }
    if (label) {
      if (firstOptIdx < 0) firstOptIdx = i
      optLines.push({ idx: i, label, text: lines[i] })
    }
  }
  if (optLines.length < 3) return null
  const alpha = 'ABCDEFGH'
  const startIdx = alpha.indexOf(optLines[0].label)
  if (startIdx < 0) return null
  let valid = true
  for (let i = 1; i < optLines.length; i++) {
    if (optLines[i].label !== alpha[startIdx + i]) { valid = false; break }
  }
  if (!valid) return null
  const stemLines = lines.slice(0, firstOptIdx)
  let stem = stemLines.join('\n')
  formulaPlaceholders.forEach(({ p, original }) => { stem = stem.replace(p, original) })
  const options = []
  for (let i = 0; i < optLines.length; i++) {
    let optText = optLines[i].text
    formulaPlaceholders.forEach(({ p, original }) => { optText = optText.replace(p, original) })
    options.push({ label: optLines[i].label, text: optText })
  }
  return { stem: stem || '', options }
}

const getQuestionOptions = (q) => {
  if (q._parsedOptions) return q._parsedOptions
  if (q.options && Array.isArray(q.options) && q.options.length > 0) {
    q._parsedOptions = q.options
    q._hasSeparateOptions = true
    return q.options
  }
  const parsed = parseOptionsFromText(q.QuestionText)
  if (parsed) {
    q._parsedOptions = parsed.options
    q._parsedStem = parsed.stem
    q._parsedFromText = true
    return parsed.options
  }
  return []
}

const getQuestionStem = (q) => {
  if (q._hasSeparateOptions) return q.QuestionText || ''
  if (q._parsedFromText) return q._parsedStem || ''
  if (q._parsedStem) return q._parsedStem
  const options = getQuestionOptions(q)
  if (q._parsedFromText) return q._parsedStem || ''
  return q.QuestionText || ''
}

const renderStars = (difficulty) => {
  const count = Math.ceil((difficulty || 0.5) * 5)
  return '★'.repeat(count) + '☆'.repeat(5 - count)
}

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
  currentText = currentText.replace(/\\neq?(?!\s*[a-zA-Z])/g, () => {
    try {
      return katex.renderToString('\\neq', { throwOnError: false, displayMode: false })
    } catch (e) {
      return '≠'
    }
  })

  currentText = currentText.replace(/≠/g, () => {
    try {
      return katex.renderToString('\\neq', { throwOnError: false, displayMode: false })
    } catch (e) {
      return '≠'
    }
  })

  currentText = currentText.replace(/≤/g, () => {
    try {
      return katex.renderToString('\\leq', { throwOnError: false, displayMode: false })
    } catch (e) {
      return '≤'
    }
  })

  currentText = currentText.replace(/≥/g, () => {
    try {
      return katex.renderToString('\\geq', { throwOnError: false, displayMode: false })
    } catch (e) {
      return '≥'
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

const startEdit = (item) => {
  const q = item.question
  editingId.value = item.questionId
  const opts = (q.options && Array.isArray(q.options)) ? q.options.map(o => ({ ...o })) : []
  editForm.value = {
    QuestionText: q.QuestionText || '',
    OriginalAnswerText: q.OriginalAnswerText || '',
    Difficulty: q.Difficulty || 0.5,
    QuestionType: q.QuestionType || '',
    options: opts,
    details: (q.details || []).map(d => ({ ...d }))
  }
}

const saveEdit = async (item) => {
  saving.value = true
  try {
    const questionData = {
      QuestionText: editForm.value.QuestionText,
      OriginalAnswerText: editForm.value.OriginalAnswerText,
      Difficulty: editForm.value.Difficulty,
      QuestionType: editForm.value.QuestionType,
      details: editForm.value.details,
      QuestionSort: item.question.QuestionSort,
      Sort: item.question.Sort
    }
    if (editForm.value.options.length > 0) {
      questionData.options = editForm.value.options
    }
    const res = await adminApi.savePaperQuestion(item.questionId, questionData)
    if (res.code === 0 || res.code === 200) {
      ElMessage.success('保存成功')
      Object.assign(item.question, questionData)
      editingId.value = null
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } catch (err) {
    console.error('保存失败:', err)
    ElMessage.error('保存失败，请检查网络或控制台错误')
  } finally {
    saving.value = false
  }
}

const cancelEdit = () => {
  editingId.value = null
}

const addDetail = () => {
  editForm.value.details.push({ BusType: '题目详解', Title: '', Context: '' })
}

const removeDetail = (index) => {
  editForm.value.details.splice(index, 1)
}

onMounted(async () => {
  try {
    const userInfo = localStorage.getItem('admin_user_info')
    if (userInfo) {
      try {
        const info = JSON.parse(userInfo)
        isAdmin.value = info.role === 'admin' || info.isAdmin === true
      } catch (e) {}
    }

    const [idxRes, qRes] = await Promise.all([
      fetch('去重索引.json'),
      fetch('去重合集.json')
    ])
    const idx = await idxRes.json()
    const qList = await qRes.json()

    forwardIndex.value = idx['正向索引']
    questions.value = qList

    const map = {}
    const subjectOrder = []
    for (const [qid, refs] of Object.entries(idx['正向索引'])) {
      for (const ref of refs) {
        const [label, numStr] = ref.split('#')
        const num = parseInt(numStr)
        const sub = label.replace(/第.+$/, '')
        const setMatch = label.match(/第([\u4e00-\u9fa5]+)套/)
        if (!setMatch) continue
        const set = setMatch[1]
        if (!map[sub]) {
          map[sub] = {}
          subjectOrder.push(sub)
        }
        if (!map[sub][set]) map[sub][set] = {}
        map[sub][set][num] = parseInt(qid)
      }
    }
    paperMap.value = map
    subjects.value = subjectOrder
  } catch (e) {
    console.error('加载数据失败:', e)
    alert('加载试卷数据失败，请检查 JSON 文件是否存在')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.paper-extract {
  min-height: 100vh;
  background: #f0f2f5;
}

.top-nav {
  background: linear-gradient(135deg, #1a73e8, #1557b0);
  padding: 0 30px;
  height: 60px;
  display: flex;
  align-items: center;
  color: white;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,.15);
}

.nav-left {
  flex: 0 0 150px;
}

.back-btn {
  color: rgba(255,255,255,.85);
  text-decoration: none;
  font-size: 14px;
  cursor: pointer;
}
.back-btn:hover {
  color: white;
}

.nav-title {
  flex: 1;
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 2px;
}

.nav-right {
  flex: 0 0 150px;
}

.extract-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 20px;
}

.import-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 8px;
  font-size: 14px;
  color: #333;
  margin-bottom: 20px;
}

.import-banner .banner-icon {
  font-size: 20px;
}

.import-banner .banner-link {
  color: #1a73e8;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}

.import-banner .banner-link:hover {
  color: #0d47a1;
}

.step-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
  gap: 0;
}

.step {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #999;
  font-size: 14px;
}
.step.active {
  color: #1a73e8;
}

.step-num {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid #d9d9d9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  background: white;
}

.step.active .step-num {
  background: #1a73e8;
  color: white;
  border-color: #1a73e8;
}

.step-line {
  width: 60px;
  height: 2px;
  background: #e8e8e8;
  margin: 0 12px;
}

.selector-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,.08);
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.subject-tabs,
.set-tabs {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.subject-tab,
.set-tab {
  padding: 8px 28px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  transition: all .2s;
  background: #fafafa;
  user-select: none;
}

.subject-tab:hover,
.set-tab:hover {
  border-color: #1a73e8;
  color: #1a73e8;
}

.subject-tab.active,
.set-tab.active {
  background: #1a73e8;
  color: white;
  border-color: #1a73e8;
  font-weight: 600;
}

.paper-section {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,.08);
  overflow: hidden;
}

.paper-header {
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
  background: linear-gradient(135deg, #fafafa, #f5f7fa);
}

.paper-title {
  font-size: 20px;
  font-weight: 700;
  color: #1a73e8;
  margin-bottom: 6px;
}

.paper-meta {
  font-size: 13px;
  color: #888;
}

.meta-sep {
  margin: 0 10px;
  color: #ddd;
}

.meta-item {
  margin-right: 8px;
}

.meta-sep {
  margin: 0 10px;
  color: #ddd;
}

.meta-item {
  margin-right: 8px;
}

.question-list {
  padding: 0;
}

.question-item {
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
  position: relative;
}
.question-item:last-child {
  border-bottom: none;
}

.question-num {
  color: #1890ff;
  font-weight: bold;
  font-size: 15px;
  margin-right: 4px;
}

.q-shared {
  display: inline-block;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  background: #fffbe6;
  color: #faad14;
  border: 1px solid #ffe58f;
  vertical-align: middle;
  margin-right: 6px;
  cursor: help;
}

.question-body {
  font-size: 15px;
  line-height: 1.8;
  color: #333;
  margin-bottom: 12px;
  font-family: 'Times New Roman', 'SimSun', serif;
}

.question-body .question-text {
  display: inline;
}

.question-body :deep(.katex) {
  font-family: 'Times New Roman', serif;
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 10px 40px;
  margin-bottom: 15px;
}

.option-item {
  font-size: 14px;
  line-height: 1.8;
  color: #333;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 3px;
  transition: background .2s;
  word-break: break-word;
  white-space: normal;
  border: 1px solid transparent;
  font-family: 'Times New Roman', 'SimSun', serif;
}

.option-item:hover {
  background: #f5f5f5;
}

.option-item .opt-label {
  font-weight: bold;
  margin-right: 5px;
}

.question-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px dashed #e8e8e8;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 15px;
  font-size: 12px;
  color: #999;
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.footer-right a {
  font-size: 13px;
  color: #1890ff;
  cursor: pointer;
  user-select: none;
  padding: 2px 4px;
  border-radius: 3px;
  transition: background .2s;
}
.footer-right a:hover {
  background: #e6f7ff;
}

.footer-right .edit-link {
  color: #52c41a;
}
.footer-right .edit-link:hover {
  background: #f6ffed;
}

.q-type-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 3px;
  font-weight: 500;
}
.q-type-badge.choice {
  background: #e6f7ff;
  color: #1890ff;
}
.q-type-badge.fill {
  background: #f6ffed;
  color: #52c41a;
}
.q-type-badge.answer {
  background: #fff7e6;
  color: #fa8c16;
}

.q-source {
  color: #1890ff;
  font-size: 13px;
}

.add-btn {
  background: #ff8c00;
  color: white;
  padding: 5px 12px;
  border-radius: 4px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  border: none;
  transition: background .2s;
  user-select: none;
}
.add-btn:hover {
  background: #ff7a00;
}
.add-btn.added {
  background: #52c41a;
}

.parse-panel {
  padding: 15px;
  margin-top: 10px;
  background: #fafafa;
  border-radius: 4px;
  border: 1px solid #f0f0f0;
}

.answer-section {
  padding: 8px 12px;
  background: #f6ffed;
  border-radius: 4px;
  border-left: 3px solid #52c41a;
  margin-bottom: 10px;
}

.answer-label {
  font-weight: 600;
  color: #52c41a;
  font-size: 13px;
}

.answer-text {
  font-size: 14px;
  color: #333;
}

.detail-section {
  margin-bottom: 10px;
}
.detail-section:last-child {
  margin-bottom: 0;
}

.detail-title {
  font-size: 13px;
  font-weight: 600;
  color: #1a73e8;
  margin-bottom: 4px;
}

.detail-bus-type {
  font-size: 13px;
  font-weight: 600;
  color: #1a73e8;
  margin-bottom: 4px;
}

.detail-context {
  font-size: 14px;
  line-height: 1.7;
  color: #555;
}

/* 编辑模式 */
.edit-mode {
  padding: 16px;
  background: #f8f9fb;
  border: 2px solid #52c41a;
  border-radius: 8px;
}

.edit-field {
  margin-bottom: 12px;
}

.edit-field label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.edit-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  font-family: 'Times New Roman', 'SimSun', monospace;
  line-height: 1.6;
  resize: vertical;
  box-sizing: border-box;
}
.edit-textarea:focus {
  border-color: #1a73e8;
  outline: none;
  box-shadow: 0 0 0 2px rgba(26,115,232,.1);
}

.edit-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}
.edit-input:focus {
  border-color: #1a73e8;
  outline: none;
}

.edit-range {
  width: 100%;
  max-width: 300px;
  accent-color: #1a73e8;
}

.edit-select {
  padding: 6px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  background: white;
}

.edit-option-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.edit-option-row .opt-label {
  font-weight: bold;
  font-size: 14px;
  min-width: 24px;
}

.edit-detail-row {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  align-items: flex-start;
}

.edit-select-small {
  padding: 4px 6px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 12px;
  background: white;
}

.edit-btn-del {
  background: #ff4d4f;
  color: white;
  border: none;
  border-radius: 4px;
  width: 26px;
  height: 26px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 2px;
}

.edit-btn-add {
  background: #f0f0f0;
  border: 1px dashed #d9d9d9;
  border-radius: 4px;
  padding: 6px 16px;
  cursor: pointer;
  font-size: 13px;
  color: #666;
}
.edit-btn-add:hover {
  border-color: #1a73e8;
  color: #1a73e8;
}

.edit-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #e8e8e8;
}

.save-btn {
  background: #52c41a;
  color: white;
  border: none;
  padding: 8px 24px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}
.save-btn:hover {
  background: #45a818;
}
.save-btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.cancel-btn {
  background: #f5f5f5;
  color: #666;
  border: 1px solid #d9d9d9;
  padding: 8px 24px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
.cancel-btn:hover {
  border-color: #999;
  color: #333;
}

.saving-hint {
  font-size: 13px;
  color: #1a73e8;
}

/* 自定义标签 */
:deep(.custom-tag) {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 13px;
  font-weight: 600;
  margin-right: 4px;
}
:deep(.custom-tag.answer) {
  background: #f6ffed;
  color: #52c41a;
}
:deep(.custom-tag.analysis) {
  background: #e6f7ff;
  color: #1890ff;
}
:deep(.custom-tag.commentary) {
  background: #fff7e6;
  color: #fa8c16;
}
:deep(.custom-tag.note) {
  background: #f0f0f0;
  color: #888;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 13px;
}
:deep(.custom-tag.step) {
  background: #f9f0ff;
  color: #722ed1;
}

:deep(.katex) {
  font-family: 'Times New Roman', serif;
}
:deep(.katex .mord),
:deep(.katex .mbin),
:deep(.katex .mrel),
:deep(.katex .mopen),
:deep(.katex .mclose),
:deep(.katex .mpunct),
:deep(.katex .minner) {
  font-family: 'Times New Roman', serif;
}
</style>