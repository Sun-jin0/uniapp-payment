const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '139.199.9.132',
  user: 'root',
  password: '4212b46b7c02ee61',
  database: 'quizmaster'
});

/**
 * 题型判断函数（基于Python逻辑移植到JS）
 * 优先级：选择题 -> 填空题 -> 解答题
 * @param {string} text - 题目文本
 * @returns {string} - 题型：选择题/填空题/解答题
 */
function detectQuestionType(text) {
  if (!text) {
    return '解答题';
  }

  // 1. 选择题判断：同时出现A/B/C/D中的至少两个选项标记
  const optionPatterns = [
    { name: 'A', regex: /[A][\.\s\、\)\:]|\$\s*A\s*\$|（\s*A\s*）|\\mathrm\{\s*A\s*\}|\\rm\{\s*A\s*\}/i },
    { name: 'B', regex: /[B][\.\s\、\)\:]|\$\s*B\s*\$|（\s*B\s*）|\\mathrm\{\s*B\s*\}|\\rm\{\s*B\s*\}/i },
    { name: 'C', regex: /[C][\.\s\、\)\:]|\$\s*C\s*\$|（\s*C\s*）|\\mathrm\{\s*C\s*\}|\\rm\{\s*C\s*\}/i },
    { name: 'D', regex: /[D][\.\s\、\)\:]|\$\s*D\s*\$|（\s*D\s*）|\\mathrm\{\s*D\s*\}|\\rm\{\s*D\s*\}/i }
  ];

  // 统计出现的选项数量
  let optionCount = 0;
  for (const opt of optionPatterns) {
    if (opt.regex.test(text)) {
      optionCount++;
    }
  }

  // A/B/C/D 四个选项都出现才是选择题
  if (optionCount >= 4) {
    return '选择题';
  }

  // 2. 填空题判断：不是选择题，且有下划线或括号
  const hasUnderline = /\\underline\{[\s\S]*?\}|\\underline\{\s*(?:\\;|\\quad|\\qquad|\s)+\s*\}/.test(text);
  const hasBrackets = /（\s*）/.test(text);
  const hasUnderscores = /_{3,}/.test(text);

  if (hasUnderline || hasBrackets || hasUnderscores) {
    return '填空题';
  }

  // 3. 解答题：既不是选择题也不是填空题
  return '解答题';
}

async function updateQuestionTypes() {
  console.log('开始批量更新题型...\n');

  try {
    // 1. 获取所有题目
    console.log('正在获取所有题目...');
    const [questions] = await pool.query(`
      SELECT QuestionID, QuestionText, QuestionType 
      FROM math_questions
    `);

    console.log(`共找到 ${questions.length} 条题目\n`);

    // 2. 分析每道题并统计
    let stats = {
      '选择题': 0,
      '填空题': 0,
      '解答题': 0
    };

    let needUpdate = [];

    questions.forEach(q => {
      const detectedType = detectQuestionType(q.QuestionText);
      stats[detectedType]++;

      // 如果检测到的类型与当前类型不同，则需要更新
      if (detectedType !== (q.QuestionType || '')) {
        needUpdate.push({
          QuestionID: q.QuestionID,
          oldType: q.QuestionType || '(空)',
          newType: detectedType,
          text: q.QuestionText
        });
      }
    });

    // 3. 显示统计结果
    console.log('题型检测结果统计:');
    console.log('-'.repeat(50));
    console.log(`  选择题: ${stats['选择题']} 条`);
    console.log(`  填空题: ${stats['填空题']} 条`);
    console.log(`  解答题: ${stats['解答题']} 条`);
    console.log(`\n需要更新的记录: ${needUpdate.length} 条\n`);

    if (needUpdate.length === 0) {
      console.log('所有题目题型已正确，无需更新');
      await pool.end();
      process.exit(0);
    }

    // 4. 显示部分需要更新的示例
    console.log('需要更新的示例（前10条）:');
    console.log('-'.repeat(80));
    needUpdate.slice(0, 10).forEach((item, index) => {
      const preview = item.text ? item.text.substring(0, 60).replace(/\n/g, ' ') : '';
      console.log(`\n${index + 1}. ID:${item.QuestionID}`);
      console.log(`   ${item.oldType} → ${item.newType}`);
      console.log(`   ${preview}...`);
    });

    // 5. 按类型批量更新
    console.log('\n' + '='.repeat(80));
    console.log('开始批量更新...\n');

    let totalUpdated = 0;

    for (const type of ['选择题', '填空题', '解答题']) {
      const idsToUpdate = needUpdate
        .filter(item => item.newType === type)
        .map(item => item.QuestionID);

      if (idsToUpdate.length === 0) continue;

      console.log(`更新为"${type}": ${idsToUpdate.length} 条`);

      // 分批更新，每批1000条
      const batchSize = 1000;
      for (let i = 0; i < idsToUpdate.length; i += batchSize) {
        const batch = idsToUpdate.slice(i, i + batchSize);
        const placeholders = batch.map(() => '?').join(',');

        const [result] = await pool.query(`
          UPDATE math_questions 
          SET QuestionType = ?
          WHERE QuestionID IN (${placeholders})
        `, [type, ...batch]);

        totalUpdated += result.affectedRows;
        console.log(`  批次 ${Math.floor(i / batchSize) + 1}: 更新 ${result.affectedRows} 条`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`✓ 完成！总共更新了 ${totalUpdated} 条记录`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('更新失败:', error);
    await pool.end();
    process.exit(1);
  }
}

updateQuestionTypes();
