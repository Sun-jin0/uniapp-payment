<template>
  <div class="paper-view-page">
    <!-- control bar -->
    <div class="control-bar">
      <div class="control-left">
        <el-button @click="goBack">
          <el-icon><ArrowLeft /></el-icon> 返回
        </el-button>
      </div>
      <div class="control-right">
        <el-button type="primary" @click="printPaper" native-type="button">
          打印 / 导出 PDF
        </el-button>
      </div>
    </div>

    <div class="paper-content" id="paperViewContent" ref="paperContentRef">
      <!-- title -->
      <div class="paper-title">{{ paperName }}</div>

      <!-- questions -->
      <div v-if="questions.length === 0" class="empty-state">
        <div class="empty-text">暂无题目</div>
      </div>

      <div v-else class="question-list">
        <div
          v-for="(q, index) in questions"
          :key="q.QuestionID"
          class="question-item"
        >
          <div class="question-body">
            <span class="q-num">{{ index + 1 }}.</span>
            <span v-html="renderLatex(getQuestionStem(q))"></span>
          </div>

          <div v-if="getQuestionOptions(q).length > 0" class="options-grid" :data-qid="q.QuestionID || q.id" :style="{ gridTemplateColumns: `repeat(${q.optionLayout || 4}, 1fr)` }">
            <div
              v-for="opt in getQuestionOptions(q)"
              :key="opt.label"
              class="option-item"
            >
              <span class="opt-label">{{ opt.label }}.</span>
              <span v-html="renderLatex(opt.text)"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'

const router = useRouter()
const route = useRoute()

const paperName = ref('试卷')
const questions = ref([])
const paperContentRef = ref(null)

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
        if (innerMatch) {
          label = innerMatch[1] || innerMatch[2] || innerMatch[3] || innerMatch[4]
        }
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
    if (optLines[i].label !== alpha[startIdx + i]) {
      valid = false
      break
    }
  }
  if (!valid) return null

  const stemLines = lines.slice(0, firstOptIdx)
  let stem = stemLines.join('\n')
  formulaPlaceholders.forEach(({ p, original }) => {
    stem = stem.replace(p, original)
  })

  const options = []
  for (let i = 0; i < optLines.length; i++) {
    let optText = optLines[i].text
    formulaPlaceholders.forEach(({ p, original }) => {
      optText = optText.replace(p, original)
    })
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

  if (q.options && typeof q.options === 'string' && q.options !== '{}') {
    try {
      const parsed = JSON.parse(q.options)
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        const options = Object.entries(parsed).map(([label, text]) => ({ label, text }))
        q._parsedOptions = options
        q._hasSeparateOptions = true
        return options
      }
    } catch (e) {}
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

const renderLatex = (text) => {
  if (!text) return ''
  const placeholders = []
  const createPlaceholder = (content, type = 'html') => {
    const p = `__LATEX_JS_${type.toUpperCase()}_PH_${placeholders.length}__`
    placeholders.push({ p, content, type })
    return p
  }

  let currentText = text.trim().replace(/\t/g, ' ').replace(/ {2,}/g, ' ')

  currentText = currentText
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")

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

  currentText = currentText.replace(/\\neq?(?!\s*[a-zA-Z])/g, (match) => {
    try {
      return katex.renderToString('\\neq', { throwOnError: false, displayMode: false })
    } catch (e) {
      return '≠'
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

  placeholders.forEach(({ p, content }) => {
    currentText = currentText.replace(p, content)
  })

  const svgPlaceholders = []
  currentText = currentText.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, (match) => {
    const p = `__SVG_PLACEHOLDER_${svgPlaceholders.length}__`
    svgPlaceholders.push({ p, content: match })
    return p
  })

  currentText = currentText.replace(/\n/g, '<br>')

  svgPlaceholders.forEach(({ p, content }) => {
    currentText = currentText.replace(p, content)
  })

  return currentText
}

const setQuestionOptionLayout = (question, layout) => {
  question.optionLayout = layout
}

const autoAdjustAllOptionLayouts = () => {
  const grids = document.querySelectorAll('.options-grid')
  if (!grids.length) return

  grids.forEach(grid => {
    const qid = grid.getAttribute('data-qid')
    if (!qid) return

    let question = questions.value.find(q => (q.QuestionID || q.id) === qid)
    if (!question || question._autoAdjusted) return

    const items = grid.querySelectorAll('.option-item')
    if (!items.length) return

    let hasOverflow = false
    items.forEach(item => {
      const label = item.querySelector('label')
      if (label && label.scrollHeight > label.clientHeight + 2) {
        hasOverflow = true
      }
    })

    const currentLayout = question.optionLayout || 4
    if (hasOverflow && currentLayout > 1) {
      question.optionLayout = currentLayout === 4 ? 2 : 1
    }
    question._autoAdjusted = true
  })
}

const goBack = () => {
  router.push('/user-exam/math-paper')
}

const printPaper = () => {
  window.print()
}

const renderMath = () => {
  const loadScripts = () => {
    if (!window.katex) {
      const katexScript = document.createElement('script')
      katexScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js'
      katexScript.onload = () => {
        const autoRenderScript = document.createElement('script')
        autoRenderScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js'
        autoRenderScript.onload = doRender
        document.head.appendChild(autoRenderScript)
      }
      document.head.appendChild(katexScript)
    } else if (!window.renderMathInElement) {
      const autoRenderScript = document.createElement('script')
      autoRenderScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js'
      autoRenderScript.onload = doRender
      document.head.appendChild(autoRenderScript)
    } else {
      doRender()
    }
  }

  const doRender = () => {
    const el = document.getElementById('paperViewContent')
    if (!el || !window.renderMathInElement) return

    window.renderMathInElement(el, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
      ],
      throwOnError: false,
      trust: true,
      strict: false
    })
  }

  if (!document.querySelector('#katex-css')) {
    const cssLink = document.createElement('link')
    cssLink.id = 'katex-css'
    cssLink.rel = 'stylesheet'
    cssLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css'
    document.head.appendChild(cssLink)
  }

  loadScripts()
}

onMounted(() => {
  const storedData = sessionStorage.getItem('paper_view_data')
  if (!storedData) {
    ElMessage.error('没有试卷数据')
    return
  }

  try {
    const data = JSON.parse(storedData)
    paperName.value = data.paperName || '试卷'
    questions.value = (data.questions || []).map(q => ({
      ...q,
      score: q.score || '5',
      area: q.area || 0
    }))

    questions.value.forEach(q => getQuestionOptions(q))

    setTimeout(() => {
      renderMath()
      autoAdjustAllOptionLayouts()
    }, 500)
  } catch (e) {
    console.error('加载试卷数据失败:', e)
    ElMessage.error('加载试卷数据失败')
  }
})
</script>

<style>
/* 打印隐藏控制栏 */
@media print {
  .control-bar {
    display: none !important;
  }
}

body, html {
  margin: 0;
  padding: 0;
  background: #f0f2f5;
  overflow-y: auto;
}

.paper-view-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.control-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.control-left,
.control-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.paper-content {
  width: 100%;
  max-width: 800px;
  margin: 80px auto 40px;
  padding: 40px 50px;
  background: white;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  border-radius: 4px;
  font-family: 'Times New Roman', 'SimSun', serif;
}

.paper-title {
  text-align: center;
  font-size: 22pt;
  font-weight: bold;
  font-family: 'SimHei', 'Heiti SC', sans-serif;
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 2px solid #333;
}

.empty-state {
  padding: 100px 0;
  text-align: center;
}

.empty-text {
  font-size: 18px;
  color: #999;
}

.question-list {
  width: 100%;
}

.question-item {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px dashed #e8e8e8;
}

.question-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.question-body {
  font-size: 14pt;
  line-height: 1.8;
  color: #333;
  font-family: 'Times New Roman', 'SimSun', serif;
}

.q-num {
  font-weight: bold;
  margin-right: 4px;
  color: #333;
}

.options-grid {
  display: grid;
  gap: 8px 30px;
  margin-top: 12px;
  margin-bottom: 8px;
}

.option-item {
  font-size: 13pt;
  line-height: 1.6;
  color: #444;
  font-family: 'Times New Roman', 'SimSun', serif;
}

.opt-label {
  font-weight: bold;
  margin-right: 2px;
}
</style>