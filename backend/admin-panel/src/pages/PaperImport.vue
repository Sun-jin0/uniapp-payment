<template>
  <div class="paper-import">
    <div class="page-header">
      <h2>试卷导入（去重题库 → 数学题库）</h2>
      <p class="desc">将去重合集中的试卷按科目导入数学题库，每套试卷作为一个章节</p>
    </div>

    <el-card class="step-card">
      <template #header><span>第一步：选择数据文件</span></template>
      <el-form label-width="120px">
        <el-form-item label="题目数据文件">
          <div class="file-upload-area">
            <input type="file" accept=".json" ref="questionsFileInput" style="display:none" @change="e => handleFileSelect(e, 'questions')" />
            <el-button type="primary" @click="$refs.questionsFileInput.click()">
              选择 去重合集.json
            </el-button>
            <el-tag v-if="questionsFileName" type="success" closable @close="clearFile('questions')">
              {{ questionsFileName }}
            </el-tag>
            <span v-else class="file-hint">请选择包含题目数据的 JSON 文件</span>
          </div>
        </el-form-item>
        <el-form-item label="索引映射文件">
          <div class="file-upload-area">
            <input type="file" accept=".json" ref="indexFileInput" style="display:none" @change="e => handleFileSelect(e, 'index')" />
            <el-button type="primary" @click="$refs.indexFileInput.click()">
              选择 去重索引.json
            </el-button>
            <el-tag v-if="indexFileName" type="success" closable @close="clearFile('index')">
              {{ indexFileName }}
            </el-tag>
            <span v-else class="file-hint">请选择包含索引映射的 JSON 文件</span>
          </div>
        </el-form-item>
        <el-form-item v-if="questionsFile && indexFile">
          <el-button type="success" @click="parseFiles" :loading="parsing">
            解析并预览数据
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="previewData" class="step-card">
      <template #header>
        <span>第二步：预览与科目映射</span>
        <el-tag type="info" style="margin-left: 12px;">
          共 {{ totalSubjects }} 个科目，{{ totalPapers }} 套试卷，{{ totalQuestions }} 道不重复题目
        </el-tag>
      </template>

      <el-form label-width="120px">
        <el-form-item label="科目映射">
          <el-table :data="subjectMappingTable" border stripe size="small">
            <el-table-column prop="source" label="来源科目" width="120" />
            <el-table-column label="映射到题库科目" width="220">
              <template #default="{ row, $index }">
                <el-select v-model="subjectMappingArr[$index].target" filterable style="width: 180px">
                  <el-option v-for="s in availableSubjects" :key="s.SubjectID" :label="s.SubjectName" :value="s.SubjectName" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column prop="paperCount" label="试卷数" width="80" align="center" />
            <el-table-column prop="questionCount" label="题目数" width="80" align="center" />
          </el-table>
        </el-form-item>

        <el-form-item label="试卷预览">
          <el-tree :data="previewTreeComputed" :props="treeProps" default-expand-all node-key="key" highlight-current>
            <template #default="{ node, data }">
              <span v-if="data.type === 'subject'">
                <el-tag size="small" color="#409eff" style="color:#fff;margin-right:6px;">{{ data.label }}</el-tag>
                <strong>{{ data.name }}</strong>
                <el-tag size="small" type="info" style="margin-left:8px">{{ data.children.length }} 套试卷</el-tag>
              </span>
              <span v-else-if="data.type === 'paper'">
                <el-tag size="small" type="warning" style="margin-right:6px;">试卷</el-tag>
                <span class="paper-name-text">{{ paperNameOverrides[data.key] || data.name }}</span>
                <el-icon class="edit-name-btn" @click.stop="editPaperName(data.key, paperNameOverrides[data.key] || data.name)" style="cursor:pointer;margin:0 8px;color:#409eff;font-size:14px;vertical-align:middle;"><Edit /></el-icon>
                <el-tag size="small" type="info" style="margin-left:8px">{{ data.children.length }} 题</el-tag>
              </span>
              <span v-else>
                <el-tag size="small" type="success" style="margin-right:6px;">第{{ data.sort }}题</el-tag>
                <span class="question-preview" v-html="truncateText(data.text, 80)"></span>
                <el-tag size="small" style="margin-left:6px">{{ data.qType }}</el-tag>
              </span>
            </template>
          </el-tree>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="previewData" class="step-card">
      <template #header><span>第三步：执行导入</span></template>
      <el-form label-width="120px">
        <el-form-item label="导入选项">
          <el-checkbox v-model="importOptions.dryRun">仅预览（不实际写入数据库）</el-checkbox>
        </el-form-item>
        <el-form-item>
          <el-button type="danger" size="large" @click="confirmImport" :loading="importing" :disabled="!previewData">
            <el-icon style="margin-right:6px"><Upload /></el-icon>
            开始导入
          </el-button>
          <span class="import-hint">导入将在事务中执行，若出错会自动回滚</span>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="importResult" class="step-card result-card" :class="{ success: importResult.success, error: !importResult.success }">
      <template #header>
        <span :style="{ color: importResult.success ? '#67c23a' : '#f56c6c' }">
          {{ importResult.success ? '导入成功' : '导入失败' }}
        </span>
      </template>
      <pre class="result-content">{{ importResult.message }}</pre>
      <div v-if="importResult.stats" class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">{{ importResult.stats.booksCreated }}</div>
          <div class="stat-label">创建书籍</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ importResult.stats.chaptersCreated }}</div>
          <div class="stat-label">新增章节</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ importResult.stats.questionsImported }}</div>
          <div class="stat-label">导入题目</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ importResult.stats.questionsSkipped }}</div>
          <div class="stat-label">跨章节引用</div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminApi } from '../api'
import { Upload, Edit } from '@element-plus/icons-vue'

const questionsFileInput = ref(null)
const indexFileInput = ref(null)
const questionsFile = ref(null)
const indexFile = ref(null)
const questionsFileName = ref('')
const indexFileName = ref('')
const questionsData = ref(null)
const indexData = ref(null)
const parsing = ref(false)
const importing = ref(false)
const previewData = ref(null)
const importResult = ref(null)
const rawTotalCount = ref(0)
const paperNameOverrides = ref({})
const availableSubjects = ref([])
const subjectMappingArr = reactive([])

const importOptions = reactive({
  dryRun: false
})

const handleFileSelect = (event, type) => {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result)
      if (type === 'questions') {
        questionsFile.value = file
        questionsFileName.value = file.name
        questionsData.value = data
        ElMessage.success(`已加载 ${Array.isArray(data) ? data.length : Object.keys(data).length} 条数据`)
      } else {
        indexFile.value = file
        indexFileName.value = file.name
        indexData.value = data
        ElMessage.success('已加载索引文件')
      }
    } catch (err) {
      ElMessage.error('JSON 解析失败: ' + err.message)
    }
  }
  reader.readAsText(file)
}

const clearFile = (type) => {
  if (type === 'questions') {
    questionsFile.value = null
    questionsFileName.value = ''
    questionsData.value = null
  } else {
    indexFile.value = null
    indexFileName.value = ''
    indexData.value = null
  }
  previewData.value = null
  importResult.value = null
  subjectMappingArr.length = 0
  paperNameOverrides.value = {}
}

const fetchSubjects = async () => {
  try {
    const res = await adminApi.getMathSubjects()
    availableSubjects.value = res.data || []
  } catch {
    availableSubjects.value = []
  }
}

const parseFiles = async () => {
  if (!questionsData.value || !indexData.value) {
    ElMessage.warning('请先选择两个 JSON 文件')
    return
  }
  parsing.value = true
  await fetchSubjects()

  try {
    const questions = Array.isArray(questionsData.value) ? questionsData.value : []
    const forwardIndex = indexData.value['正向索引'] || {}

    const subjectMap = new Map()

    for (const [qIdStr, refs] of Object.entries(forwardIndex)) {
      const qIndex = parseInt(qIdStr) - 1
      const question = questions[qIndex]
      if (!question) continue

      for (const ref of refs) {
        const match = ref.match(/^(.+?第[一二三四五六七八九十\d]+套)#(\d+)$/)
        if (!match) continue
        const fullName = match[1]
        const sort = parseInt(match[2])
        const subMatch = fullName.match(/^(数[一二三])/)
        if (!subMatch) continue
        const subjectCode = subMatch[1]

        const subjectNames = { '数一': '数学一', '数二': '数学二', '数三': '数学三' }

        if (!subjectMap.has(subjectCode)) {
          subjectMap.set(subjectCode, { subjectCode, targetSubject: subjectNames[subjectCode] || subjectCode, papers: new Map() })
        }
        const subjectInfo = subjectMap.get(subjectCode)
        if (!subjectInfo.papers.has(fullName)) {
          subjectInfo.papers.set(fullName, { name: fullName, questions: [] })
        }
        subjectInfo.papers.get(fullName).questions.push({
          sort,
          text: question.QuestionText || '',
          qType: question.QuestionType || '未知',
          answer: question.OriginalAnswerText || ''
        })
      }
    }

    // 浏览器端简单哈希（用于去重计数，与后端 MD5 结果可能不一致，仅用于前端展示）
    const hashText = (text) => {
      let hash = 0
      const str = text || ''
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
      }
      return 'h' + hash
    }

    const previewTree = []
    let totalPapers = 0
    let totalQuestions = 0
    const uniqueQuestions = new Set()

    subjectMappingArr.length = 0

    for (const [subjectCode, info] of subjectMap) {
      const sortedPapers = Array.from(info.papers.entries())
        .map(([, p]) => {
          p.questions.sort((a, b) => a.sort - b.sort)
          totalPapers++
          for (const q of p.questions) {
            const hash = hashText(q.text)
            uniqueQuestions.add(hash)
          }
          return p
        })

      subjectMappingArr.push({
        source: subjectCode,
        target: info.targetSubject
      })

      previewTree.push({
        key: `subject-${subjectCode}`,
        type: 'subject',
        name: subjectCode,
        label: `科目`,
        children: sortedPapers.map((p, pi) => ({
          key: `paper-${subjectCode}-${pi}`,
          type: 'paper',
          name: p.name,
          children: p.questions.map((q, qi) => ({
            key: `q-${subjectCode}-${pi}-${qi}`,
            type: 'question',
            sort: q.sort,
            text: q.text,
            qType: q.qType,
            answer: q.answer
          }))
        }))
      })
    }

    previewData.value = {
      previewTree,
      subjectCount: subjectMap.size,
      paperCount: totalPapers,
      questionCount: uniqueQuestions.size
    }

    const rawTotal = [...subjectMap.values()].reduce((sum, info) => {
      return sum + [...info.papers.values()].reduce((s, p) => s + p.questions.length, 0)
    }, 0)
    const dedupSaved = rawTotal - uniqueQuestions.size
    rawTotalCount.value = rawTotal
    ElMessage.success(`解析完成：${subjectMap.size} 个科目，${totalPapers} 套试卷，${uniqueQuestions.size} 道不重复题目${dedupSaved > 0 ? `（去重减少 ${dedupSaved} 题）` : ''}`)
  } catch (err) {
    ElMessage.error('解析失败: ' + err.message)
  } finally {
    parsing.value = false
  }
}

const treeProps = { children: 'children', label: 'name' }

const truncateText = (text, maxLen) => {
  const cleaned = text.replace(/<[^>]*>/g, '').replace(/\$[\s\S]*?\$/g, '[公式]').replace(/\n/g, ' ')
  return cleaned.length > maxLen ? cleaned.substring(0, maxLen) + '...' : cleaned
}

const editPaperName = (paperKey, currentName) => {
  ElMessageBox.prompt('请输入试卷名称', '修改试卷名称', {
    inputValue: currentName,
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  }).then(({ value }) => {
    if (value && value.trim()) {
      paperNameOverrides.value[paperKey] = value.trim()
    }
  }).catch(() => {})
}

const totalSubjects = computed(() => previewData.value?.subjectCount || 0)
const totalPapers = computed(() => previewData.value?.paperCount || 0)
const totalQuestions = computed(() => previewData.value?.questionCount || 0)
const previewTreeComputed = computed(() => previewData.value?.previewTree || [])
const subjectMappingTable = computed(() => {
  if (!previewData.value) return []
  return subjectMappingArr.map((m, i) => {
    const paperCount = previewData.value.previewTree[i]?.children?.length || 0
    const questionCount = previewData.value.previewTree[i]?.children?.reduce((sum, p) => sum + (p.children?.length || 0), 0) || 0
    return { source: m.source, target: m.target, paperCount, questionCount }
  })
})

const confirmImport = async () => {
  try {
    const dedupCount = rawTotalCount.value - totalQuestions.value
    let msg = `确认将 ${totalPapers.value} 套试卷导入数学题库？`
    msg += `\n共 ${totalQuestions.value} 道不重复题目`
    if (dedupCount > 0) {
      msg += `\n（已去重，原始共计 ${rawTotalCount.value} 题，减少 ${dedupCount} 题）`
    }
    await ElMessageBox.confirm(msg, '确认导入',
      { confirmButtonText: '确认导入', cancelButtonText: '取消', type: 'warning' }
    )
    await startImport()
  } catch {}
}

const startImport = async () => {
  importing.value = true
  importResult.value = null
  try {
    const mapping = {}
    subjectMappingArr.forEach((m) => {
      mapping[m.source] = m.target
    })

    const payload = {
      questions: Array.isArray(questionsData.value) ? questionsData.value : [],
      indexMap: indexData.value,
      subjectMapping: mapping,
      paperNames: { ...paperNameOverrides.value },
      paperDefaults: {
        paperType: importOptions.dryRun ? 'preview' : 'mock_paper'
      }
    }

    const res = await adminApi.importMathPapersFromJson(payload)
    importResult.value = {
      success: true,
      message: res.message || '导入完成',
      stats: res.stats || {}
    }
    ElMessage.success('导入成功！')
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message || '导入失败'
    importResult.value = {
      success: false,
      message: errMsg
    }
    ElMessage.error('导入失败: ' + errMsg)
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.paper-import {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}
.page-header {
  margin-bottom: 24px;
}
.page-header h2 {
  margin: 0 0 8px;
  font-size: 22px;
  color: #303133;
}
.page-header .desc {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.edit-name-btn:hover {
  color: #1a73e8 !important;
  transform: scale(1.2);
}

.paper-name-text {
  vertical-align: middle;
}

.step-card {
  margin-bottom: 20px;
}
.file-upload-area {
  display: flex;
  align-items: center;
  gap: 12px;
}
.file-hint {
  color: #909399;
  font-size: 13px;
}
.import-hint {
  margin-left: 12px;
  color: #909399;
  font-size: 13px;
}
.question-preview {
  display: inline-block;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
.result-card {
  border-left: 4px solid;
}
.result-card.success {
  border-left-color: #67c23a;
}
.result-card.error {
  border-left-color: #f56c6c;
}
.result-content {
  white-space: pre-wrap;
  font-size: 14px;
  line-height: 1.6;
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
}
.stats-grid {
  display: flex;
  gap: 20px;
  margin-top: 16px;
}
.stat-item {
  flex: 1;
  text-align: center;
  padding: 16px;
  background: #f0f9eb;
  border-radius: 8px;
}
.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #67c23a;
}
.stat-label {
  font-size: 13px;
  color: #606266;
  margin-top: 4px;
}
</style>