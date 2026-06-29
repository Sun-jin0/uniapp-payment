const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '139.199.9.132',
  user: 'root',
  password: '4212b46b7c02ee61',
  database: 'quizmaster'
});

/**
 * 检测是否包含 $({\rm A})$ $({\rm B})$ $({\rm C})$ $({\rm D})$ 格式的选项
 * 这是选择题选项的 LaTeX 表示法
 */
function hasChoiceOptions(text) {
  if (!text) return false

  const options = ['A', 'B', 'C', 'D']
  let count = 0

  for (const opt of options) {
    // 格式1: $({\rm A})$  →  ({\rm A})
    const pattern1 = new RegExp(`\\(\\{\\\\rm\\s*${opt}\\}\\)`, 'i')
    // 格式2: ${(\rm A)}$  →  {(\rm A)}
    const pattern2 = new RegExp(`\\{\\(\\\\rm\\s*${opt}\\)\\}`, 'i')

    if (pattern1.test(text) || pattern2.test(text)) {
      count++
    }
  }

  return count >= 4
}

async function refineChoiceQuestions() {
  console.log('开始从解答题中二次筛选选择题...\n')

  try {
    // 仅获取当前为"解答题"的题目
    console.log('正在获取当前标注为"解答题"的题目...')
    const [questions] = await pool.query(`
      SELECT QuestionID, QuestionText, QuestionType
      FROM math_questions
      WHERE QuestionType = '解答题' OR QuestionType IS NULL OR QuestionType = ''
    `)

    console.log(`共找到 ${questions.length} 条解答题\n`)

    if (questions.length === 0) {
      console.log('没有需要处理的题目')
      await pool.end()
      process.exit(0)
    }

    // 筛选出包含 $({\rm A})$ $({\rm B})$ $({\rm C})$ $({\rm D})$ 选项标记的题目
    const toUpdate = []

    questions.forEach(q => {
      if (hasChoiceOptions(q.QuestionText)) {
        toUpdate.push({
          QuestionID: q.QuestionID,
          text: q.QuestionText
        })
      }
    })

    console.log(`检测到包含 $({\\rm A})$ 选项标记的题目: ${toUpdate.length} 条\n`)

    if (toUpdate.length === 0) {
      console.log('没有发现需要修正为选择题的题目')
      await pool.end()
      process.exit(0)
    }

    // 显示前 20 条示例
    console.log('将要更新的示例（前20条）:')
    console.log('-'.repeat(80))
    toUpdate.slice(0, 20).forEach((item, index) => {
      const preview = item.text ? item.text.substring(0, 100).replace(/\n/g, ' ') : ''
      console.log(`\n${index + 1}. ID:${item.QuestionID}`)
      console.log(`   ${preview}...`)
    })

    if (toUpdate.length > 20) {
      console.log(`\n... 还有 ${toUpdate.length - 20} 条`)
    }

    // 批量更新
    console.log('\n' + '='.repeat(80))
    console.log('开始批量更新为"选择题"...\n')

    const batchSize = 1000
    let totalUpdated = 0

    for (let i = 0; i < toUpdate.length; i += batchSize) {
      const batch = toUpdate.slice(i, i + batchSize)
      const ids = batch.map(item => item.QuestionID)
      const placeholders = ids.map(() => '?').join(',')

      const [result] = await pool.query(`
        UPDATE math_questions
        SET QuestionType = '选择题'
        WHERE QuestionID IN (${placeholders})
      `, ids)

      totalUpdated += result.affectedRows
      console.log(`  批次 ${Math.floor(i / batchSize) + 1}: 更新 ${result.affectedRows} 条`)
    }

    console.log('\n' + '='.repeat(80))
    console.log(`✓ 完成！总共更新了 ${totalUpdated} 条记录，从解答题修正为选择题`)
    console.log(`  识别依据：包含 $({\\rm A})$ $({\\rm B})$ $({\\rm C})$ $({\\rm D})$ 格式的 LaTeX 选项标记`)

    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error('更新失败:', error)
    await pool.end()
    process.exit(1)
  }
}

refineChoiceQuestions()