<template>
  <div class="preview-page-wrapper">
    <div class="preview-controls no-print">
      <h3>📄 试卷导出设置</h3>
      <div style="margin: 10px 0;">
        <label style="font-size: 12px; color: #666;">纸张大小</label>
        <el-select v-model="pageSize" style="width: 100%; margin-top: 4px;">
          <el-option label="A4" value="a4" />
          <el-option label="A3" value="a3" />
          <el-option label="B4" value="b4" />
          <el-option label="B5" value="b5" />
        </el-select>
      </div>
      <div style="margin: 10px 0;">
        <label style="font-size: 12px; color: #666;">纸张方向</label>
        <el-radio-group v-model="orientation" style="margin-top: 4px;">
          <el-radio value="portrait">纵向</el-radio>
          <el-radio value="landscape">横向</el-radio>
        </el-radio-group>
      </div>
      <el-button type="success" style="width: 100%; margin-top: 15px;" @click="handlePrint">
        🖨️ 打印 / 导出 PDF
      </el-button>
      <el-button style="width: 100%; margin-top: 8px;" @click="closeWindow">
        关闭
      </el-button>
    </div>

    <div class="preview-paper-area" ref="paperAreaRef">
      <div class="paper-content" id="paperContent" v-html="paperHtml"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const pageSize = ref('a4')
const orientation = ref('portrait')
const paperHtml = ref('')
const paperAreaRef = ref(null)

const transformText = (text) => {
  if (!text) return ''

  let content = text.trim()
    .replace(/＄/g, '$')
    .replace(/\.\$png/g, '.png')

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

  const latexCommands = []
  const latexCmdPattern = /\\\\?(neq?|nu|ni|not|nabla|neg|nmid|nparallel|nsubseteq|nsupseteq|ncong|nsim|napprox|nless|ngtr|nleq|ngeq|nprec|nsucc|nvdash|nVdash|ntriangleleft|ntriangleright)(?=[a-zA-Z{}\\\s$]|$)/g
  content = content.replace(latexCmdPattern, (match) => {
    latexCommands.push(match)
    return `__LATEX_CMD_${latexCommands.length - 1}__`
  })

  content = content.replace(/\\r\\n/g, '\n')
  content = content.replace(/\\n/g, '\n')

  content = content.replace(/__LATEX_CMD_(\d+)__/g, (match, index) => latexCommands[index])

  content = content.replace(/\\\\\(/g, '\\(').replace(/\\\\\)/g, '\\)')
  content = content.replace(/\\\\\[/g, '\\[').replace(/\\\\\]/g, '\\]')

  content = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(match, alt, url) {
    let cleanUrl = url.replace(/(_yjs|_thumb|_small|_medium|_large)(\?.*)?$/i, '$2')
    return '<div style="width:50%;"><img src="' + cleanUrl + '" style="max-width:100%;height:auto;display:block;margin:5px 0;" alt="' + alt + '" /></div>'
  })

  content = content.replace(/(https?:\/\/[^\s<>"]+?\.(?:png|jpg|jpeg|gif|webp))(?:_[a-zA-Z0-9]+)?(?![^<]*>)/gi, function(match, url) {
    if (match.includes('<img')) return match
    return '<div style="width:50%;"><img src="' + url + '" style="max-width:100%;height:auto;display:block;margin:5px 0;" alt="题目图片" /></div>'
  })

  const answerLabelStyle = 'color:#fff;background-color:#009688;padding:1px 6px;margin-right:6px;border-radius:4px;font-size:12px;'
  const analysisLabelStyle = 'color:#fff;background-color:#009688;padding:1px 6px;margin-right:6px;border-radius:4px;font-size:12px;'

  content = content.replace(/《答案》\s*【答案】\s*《\/答案》/g, `<span style="${answerLabelStyle}">答案</span>`)
  content = content.replace(/《答案》\s*【证明】\s*《\/答案》/g, `<span style="${answerLabelStyle}">证明</span>`)
  content = content.replace(/《答案》\s*【解析】\s*《\/答案》/g, `<span style="${answerLabelStyle}">答案</span>`)
  content = content.replace(/《答案》([\s\S]*?)《\/答案》/g, '<span style="' + answerLabelStyle + '">答案</span>$1')

  content = content.replace(/《分析》\s*【解析】\s*《\/分析》/g, `<span style="${analysisLabelStyle}">解析</span>`)
  content = content.replace(/《分析》\s*【思路分析】\s*《\/分析》/g, `<span style="${analysisLabelStyle}">思路分析</span>`)
  content = content.replace(/《分析》([\s\S]*?)《\/分析》/g, '<span style="' + analysisLabelStyle + '">分析</span><span style="color:#009688;">$1</span>')

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

  content = content.replace(/\n/g, '<br/>')

  content = content.replace(/__LATEX_BLOCK_(\d+)__/g, (match, index) => latexBlocks[index])
  content = content.replace(/__LATEX_INLINE_(\d+)__/g, (match, index) => latexBlocks[index])
  content = content.replace(/__LATEX_PAREN_(\d+)__/g, (match, index) => latexBlocks[index])
  content = content.replace(/__LATEX_BRACKET_(\d+)__/g, (match, index) => latexBlocks[index])

  return content
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
        if (innerMatch) {
          label = innerMatch[1] || innerMatch[2] || innerMatch[3] || innerMatch[4]
        }
      }
    }

    if (!label) {
      const bracketMatch = line.match(/^[（(]\s*([A-D])\s*[）)]/)
      if (bracketMatch) {
        label = bracketMatch[1]
      }
    }

    if (!label) {
      const dotMatch = line.match(/^([A-D])\s*[．.、]/)
      if (dotMatch) {
        label = dotMatch[1]
      }
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
    // Remove the label prefix (like "A．" or "A.") from option text
    optText = optText.replace(/^[A-D]\s*[．.、]\s*/, '')
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
  if (q._hasSeparateOptions) {
    return q.QuestionText || ''
  }
  if (q._parsedFromText) {
    return q._parsedStem || ''
  }
  if (q._parsedStem) {
    return q._parsedStem
  }
  const options = getQuestionOptions(q)
  if (q._parsedFromText) {
    return q._parsedStem || ''
  }
  return q.QuestionText || ''
}

const handlePrint = () => {
  window.print()
}

const closeWindow = () => {
  window.close()
}

onMounted(() => {
  try {
    const storedData = sessionStorage.getItem('paper_preview_data')
    if (!storedData) {
      ElMessage.error('没有试卷数据')
      return
    }

    const data = JSON.parse(storedData)

    if (data.pageSize) pageSize.value = data.pageSize
    if (data.orientation) orientation.value = data.orientation

    const isTeacher = data.version === 'teacher'
    const questions = data.questions || []
    const detailsMap = data.detailsMap || {}
    const paperForm = data.paperForm || {}

    const chineseNums = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

    let html = ''

    if (paperForm.showMarkTag && paperForm.markTag) {
      html += `<div class="paper-marktag">${paperForm.markTag}</div>`
    }

    html += `<div class="paper-title">${paperForm.mainTitle || '试卷'}</div>`

    if (paperForm.showSubtitle && paperForm.subtitle) {
      html += `<div class="paper-subtitle">${paperForm.subtitle}</div>`
    }

    if (paperForm.showTestInfo && paperForm.testInfo) {
      html += `<div class="paper-info">${paperForm.testInfo}</div>`
    }

    if (paperForm.showStudentInfo && paperForm.studentInfo) {
      html += `<div class="paper-studentinfo">${paperForm.studentInfo}</div>`
    }

    if (paperForm.showScore) {
      const typeNames = Object.keys(data.groupedQuestions || {})
      html += `<div class="paper-score"><table class="score-table"><tr><td>题号</td>`
      typeNames.forEach((typeName, idx) => {
        html += `<td>${chineseNums[idx] || (idx + 1)}</td>`
      })
      html += `<td>总分</td></tr><tr><td>得分</td>`
      typeNames.forEach(() => {
        html += `<td></td>`
      })
      html += `<td></td></tr></table></div>`
    }

    if (paperForm.showNotice && paperForm.noticeText) {
      html += `<div class="paper-notice"><div class="notice-title">注意事项：</div><div class="notice-content">${paperForm.noticeText.replace(/\n/g, '<br/>')}</div></div>`
    }

    let globalIndex = 1
    const groupedQuestions = data.groupedQuestions || {}
    const typeNames = Object.keys(groupedQuestions)

    typeNames.forEach((typeName, typeIdx) => {
      const group = groupedQuestions[typeName]
      if (!group || !Array.isArray(group)) return

      const typeScore = group.reduce((sum, q) => sum + (parseFloat(q.score) || 5), 0)

      html += `<div class="section-header">`
      html += `<span class="section-cn">${chineseNums[typeIdx] || (typeIdx + 1)}、${typeName}</span>`
      if (paperForm.showScore) {
        html += `<span class="section-cn">（共${group.length}小题，共${typeScore}分）</span>`
      }
      html += `</div>`

      group.forEach((q) => {
        const qid = q.QuestionID || q.id
        const options = getQuestionOptions(q)
        const stem = getQuestionStem(q)
        const layout = q.optionLayout || 4

        html += `<div class="question-item">`
        html += `<div class="question-body">${globalIndex}. ${paperForm.showSource && q.ShortTitle ? `（${q.ShortTitle}）` : ''}${transformText(stem || q.QuestionText || '')}</div>`

        if (options.length > 0) {
          html += `<div class="options-grid" style="grid-template-columns: repeat(${layout}, 1fr);">`
          options.forEach(opt => {
            html += `<div class="option-item">${transformText(opt.text)}</div>`
          })
          html += `</div>`
        }

        if (isTeacher) {
          const detailData = detailsMap[qid]

          const answerContent = detailData?.question?.Answer || detailData?.question?.OriginalAnswerText || q.Answer || q.OriginalAnswerText || ''
          if (answerContent) {
            html += `<div class="answer-section">${transformText(answerContent)}</div>`
          }

          if (detailData?.details && detailData.details.length > 0) {
            detailData.details.forEach(detail => {
              const content = detail.Context || ''
              if (content) {
                html += `<div class="analysis-section">${transformText(content)}</div>`
              }
            })
          } else if (q.OriginalAnswerText && q.OriginalAnswerText.trim()) {
            html += `<div class="analysis-section">${transformText(q.OriginalAnswerText)}</div>`
          }
        }

        html += `</div>`
        globalIndex++
      })
    })

    paperHtml.value = html

    setTimeout(() => {
      renderMath()
    }, 500)
  } catch (e) {
    console.error('加载预览数据失败:', e)
    ElMessage.error('加载预览数据失败')
  }
})

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
    const el = document.getElementById('paperContent')
    if (!el || !window.renderMathInElement) return

    window.renderMathInElement(el, {
      delimiters: [
        {left: "$$", right: "$$", display: true},
        {left: "$", right: "$", display: false},
        {left: "\\[", right: "\\]", display: true},
        {left: "\\(", right: "\\)", display: false}
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
</script>

<style>
body, html {
  margin: 0;
  padding: 0;
  overflow-y: auto;
  background: #f0f2f5;
}

.preview-page-wrapper {
  display: flex;
  min-height: 100vh;
}

.preview-controls {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 280px;
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.15);
  z-index: 999;
}

.preview-controls h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #333;
}

.preview-paper-area {
  flex: 1;
  margin-right: 320px;
  padding: 30px;
  display: flex;
  justify-content: center;
  overflow-y: auto;
}

.paper-content {
  background: white;
  width: 210mm;
  min-height: 297mm;
  padding: 15mm 20mm;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
  font-family: "Times New Roman", Times, "SimSun", serif;
  line-height: 1.8;
  color: #333;
}

.paper-marktag {
  text-align: center;
  font-size: 14pt;
  font-weight: bold;
  color: #c00;
  margin-bottom: 5mm;
  letter-spacing: 2px;
}

.paper-title {
  text-align: center;
  font-size: 22pt;
  font-weight: bold;
  font-family: "SimHei", "Heiti SC", sans-serif;
  margin-bottom: 3mm;
}

.paper-subtitle {
  text-align: center;
  font-size: 14pt;
  color: #666;
  margin-bottom: 3mm;
}

.paper-info, .paper-studentinfo {
  text-align: center;
  font-size: 11pt;
  color: #555;
  margin: 2mm 0;
}

.paper-score {
  margin: 5mm 0;
}

.score-table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 auto;
}

.score-table td {
  border: 1px solid #333;
  padding: 3mm 5mm;
  text-align: center;
  font-size: 11pt;
}

.paper-notice {
  margin: 5mm 0;
  padding: 3mm;
  background: #f9f9f9;
  border: 1px solid #ddd;
}

.notice-title {
  font-weight: bold;
  margin-bottom: 2mm;
}

.notice-content {
  font-size: 11pt;
  line-height: 1.8;
}

.section-header {
  font-size: 14pt;
  font-weight: bold;
  margin: 5mm 0 3mm 0;
  padding-bottom: 2mm;
  border-bottom: 1px solid #333;
}

.section-cn {
  font-family: "SimHei", "Heiti SC", sans-serif;
}

.question-item {
  margin-bottom: 5mm;
}

.question-body {
  font-size: 11pt;
  line-height: 1.8;
}

.options-grid {
  display: grid;
  gap: 8px 20px;
  margin-top: 3mm;
  margin-bottom: 2mm;
}

.option-item {
  font-size: 11pt;
  line-height: 1.8;
  color: #333;
  font-family: 'Times New Roman', 'SimSun', serif;
}

.answer-section {
  margin-top: 2mm;
  padding: 2mm;
  background: #e8f5e9;
  border-left: 3px solid #2e7d32;
  font-size: 11pt;
  color: #1b5e20;
}

.analysis-section {
  margin-top: 2mm;
  padding: 2mm;
  background: #e3f2fd;
  border-left: 3px solid #1565c0;
  font-size: 11pt;
  line-height: 1.7;
  color: #0d47a1;
}

img { max-width: 100%; height: auto; display: block; }

.katex { font-size: 1.05em !important; }
.katex-display { margin: 0.5em 0 !important; }

@media print {
  .no-print {
    display: none !important;
  }

  body, html {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
    overflow: visible !important;
  }

  .preview-page-wrapper {
    display: block !important;
  }

  .preview-paper-area {
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
  }

  .paper-content {
    width: 100% !important;
    max-width: 100% !important;
    padding: 0 !important;
    box-shadow: none !important;
    background: white !important;
    min-height: auto !important;
  }

  @page {
    size: A4;
    margin: 15mm 20mm;
  }
}
</style>
