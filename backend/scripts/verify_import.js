const mysqlPool = require('../config/mysql');
const crypto = require('crypto');
const fs = require('fs');

const calculateQuestionHash = (question) => {
  const content = JSON.stringify({
    stem: (question.stem || '').trim(),
    answer: (question.answer || '').trim()
  });
  return crypto.createHash('md5').update(content).digest('hex');
};

async function verifyImport() {
  try {
    // 读取 JSON 文件
    const rawData = JSON.parse(fs.readFileSync('F:/Code/uniapp/demo/cskaoyan_questions_converted.json', 'utf8'));
    const dataArray = rawData.data || rawData;
    
    // 统计每个科目的题目
    const subjectStats = {};
    
    for (const book of dataArray) {
      const subjectName = book.name;
      let questionCount = 0;
      const questionHashes = [];
      
      for (const chapter of (book.children || [])) {
        for (const section of (chapter.children || [])) {
          for (const qb of (section.question_banks || [])) {
            for (const question of (qb.questions || [])) {
              const hash = calculateQuestionHash(question);
              questionHashes.push(hash);
              questionCount++;
            }
          }
        }
      }
      
      subjectStats[subjectName] = {
        count: questionCount,
        hashes: questionHashes
      };
    }
    
    console.log('JSON 文件中的题目统计:');
    console.log('================');
    for (const [name, stats] of Object.entries(subjectStats)) {
      console.log(`${name}: ${stats.count} 题`);
    }
    
    // 查询数据库中的实际数量
    console.log('\n数据库中的实际数量:');
    console.log('================');
    
    for (const [name, stats] of Object.entries(subjectStats)) {
      const [tutorialRows] = await mysqlPool.query(
        'SELECT id, total_questions FROM computer1_tutorial WHERE name = ?',
        [name]
      );
      
      if (tutorialRows.length > 0) {
        const tutorialId = tutorialRows[0].id;
        
        // 查询实际关联的题目数
        const [linkRows] = await mysqlPool.query(
          'SELECT COUNT(*) as count FROM computer1_tutorial_question WHERE tutorial_id = ?',
          [tutorialId]
        );
        
        const dbCount = linkRows[0].count;
        const expectedCount = stats.count;
        const diff = expectedCount - dbCount;
        
        console.log(`${name}:`);
        console.log(`  预期: ${expectedCount} 题`);
        console.log(`  实际: ${dbCount} 题`);
        console.log(`  差异: ${diff} 题`);
        
        if (diff > 0) {
          // 查询该教辅关联的所有题目ID
          const [linkRows] = await mysqlPool.query(
            'SELECT question_id FROM computer1_tutorial_question WHERE tutorial_id = ?',
            [tutorialId]
          );
          
          const questionIds = linkRows.map(r => r.question_id);
          
          if (questionIds.length > 0) {
            // 查询这些题目的哈希
            const [questionRows] = await mysqlPool.query(
              'SELECT question_id, content_hash FROM computer1_question WHERE question_id IN (?) AND content_hash IS NOT NULL',
              [questionIds]
            );
            
            const existingHashes = new Set(questionRows.map(q => q.content_hash));
            const missingHashes = stats.hashes.filter(h => !existingHashes.has(h));
            
            console.log(`  缺失的题目哈希数: ${missingHashes.length}`);
          }
        }
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('查询失败:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

verifyImport();
