const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: '139.199.9.132',
    user: 'root',
    password: '4212b46b7c02ee61',
    database: 'quizmaster'
  });

  // 检查 QID=195832 的 math_questions 记录
  const [q] = await conn.query('SELECT QuestionID, LinksCount, LinkNames FROM math_questions WHERE QuestionID = 195832');
  console.log('=== QID=195832 在 math_questions 中 ===');
  console.log(`  LinksCount="${q[0]?.LinksCount}" LinkNames="${q[0]?.LinkNames}"`);

  if (!q[0]?.LinksCount) {
    // 没有 LinksCount - 看 math_questiondetails 的 Context 内容能否匹配
    const [details] = await conn.query(
      "SELECT ID, Title, Context FROM math_questiondetails WHERE QuestionID = 195832 AND BusType = '考点'"
    );
    console.log(`\n=== QID=195832 的考点详情 Context ===`);
    for (const d of details) {
      console.log(`\nID=${d.ID} Context:${d.Context?.substring(0, 200)}`);
    }

    // 尝试从 Context 提取关键词匹配 KPTitle
    const [allKps] = await conn.query('SELECT KnowledgePointID, KPTitle FROM math_knowledgepoints');
    
    for (const d of details) {
      if (!d.Context || d.Context.trim() === '') continue;
      const ctx = d.Context.replace(/[$\\{}()\[\]^_]/g, '').substring(0, 100);
      
      // 尝试匹配 - KPTitle 是否包含在 Context 中
      let matched = null;
      for (const kp of allKps) {
        if (!kp.KPTitle) continue;
        // 检查 KPTitle 中的关键词是否出现在 Context 中
        const keywords = kp.KPTitle.replace(/[？，、：；。！？\s,.!?;:]/g, '|').split('|').filter(k => k.length >= 2);
        for (const kw of keywords) {
          if (ctx.includes(kw)) {
            matched = { kp, keyword: kw };
            break;
          }
        }
        if (matched) break;
      }
      
      if (matched) {
        console.log(`\n  Context 包含关键词 "${matched.keyword}" → KPID=${matched.kp.KnowledgePointID} "${matched.kp.KPTitle}"`);
      } else {
        console.log(`\n  Context 无法匹配任何知识点`);
      }
    }
  }

  // 统计没有 LinksCount 但仍有关联记录的题目数
  const [stats] = await conn.query(`
    SELECT COUNT(DISTINCT qd.QuestionID) as qCount,
           COUNT(*) as detailCount
    FROM math_questiondetails qd
    LEFT JOIN math_questions q ON q.QuestionID = qd.QuestionID
    WHERE qd.BusType = '考点' 
      AND qd.LinkedKnowledgePointID IS NULL
      AND (q.LinksCount IS NULL OR q.LinksCount = '')
  `);
  console.log(`\n=== 无 LinksCount 的未关联考点统计 ===`);
  console.log(`涉及题目数: ${stats[0].qCount}`);
  console.log(`记录条数: ${stats[0].detailCount}`);

  await conn.end();
})();