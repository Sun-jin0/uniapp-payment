const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: '139.199.9.132',
    user: 'root',
    password: '4212b46b7c02ee61',
    database: 'quizmaster'
  });

  // 1. 直接检查几个具体的题的考点详情
  const testIds = [195832, 1546, 20637, 51034, 74582];
  console.log('=== 验证具体题目的考点链接 ===');
  for (const qid of testIds) {
    const [details] = await conn.query(
      "SELECT ID, Title, Context, LinkedKnowledgePointID FROM math_questiondetails WHERE QuestionID = ? AND BusType = '考点'",
      [qid]
    );
    console.log(`\nQID=${qid} (${details.length}条记录):`);
    for (const d of details) {
      if (d.LinkedKnowledgePointID) {
        const [kp] = await conn.query('SELECT KPTitle, KPContent FROM math_knowledgepoints WHERE KnowledgePointID = ?', [d.LinkedKnowledgePointID]);
        console.log(`  ✅ ID=${d.ID} Title="${d.Title}" → KPID=${d.LinkedKnowledgePointID} KPContent="${(kp[0]?.KPContent||'').substring(0,60)}"`);
      } else {
        console.log(`  ❌ ID=${d.ID} Title="${d.Title}" → 未关联`);
      }
    }
  }

  // 2. 检查是否有重复的考点记录（同一个题同一个考点有多条记录）
  const [dups] = await conn.query(`
    SELECT qd1.QuestionID, qd1.Title, qd1.LinkedKnowledgePointID, COUNT(*) as cnt
    FROM math_questiondetails qd1
    WHERE qd1.BusType = '考点' AND qd1.LinkedKnowledgePointID IS NOT NULL
    GROUP BY qd1.QuestionID, qd1.Title, qd1.LinkedKnowledgePointID
    HAVING cnt > 1
    LIMIT 20
  `);
  if (dups.length > 0) {
    console.log(`\n=== 发现重复的考点记录 ===`);
    for (const d of dups) {
      console.log(`  QID=${d.QuestionID} Title="${d.Title}" KPID=${d.LinkedKnowledgePointID} 重复${d.cnt}次`);
    }
  } else {
    console.log('\n没有重复记录 ✅');
  }

  // 3. 检查 math_questiondetails 中考点记录的 Context 是否确实有内容
  const [noContent] = await conn.query(`
    SELECT COUNT(*) as c FROM math_questiondetails 
    WHERE BusType = '考点' 
      AND LinkedKnowledgePointID IS NOT NULL 
      AND (Context IS NULL OR Context = '' OR Context = 'null')
  `);
  console.log(`\n已关联但无 Context 内容的记录: ${noContent[0].c}`);

  // 4. 检查完整的统计
  const [allStats] = await conn.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN LinkedKnowledgePointID IS NOT NULL THEN 1 ELSE 0 END) as linked,
      SUM(CASE WHEN LinkedKnowledgePointID IS NULL THEN 1 ELSE 0 END) as unlinked
    FROM math_questiondetails WHERE BusType = '考点'
  `);
  console.log(`\n=== 远程 DB 考点统计 ===`);
  console.log(`总数: ${allStats[0].total}`);
  console.log(`已关联: ${allStats[0].linked}`);
  console.log(`未关联: ${allStats[0].unlinked}`);

  // 5. 检查 fix_knowledge_point_links 这个 API 的前端调用 - 看看哪个接口在超时
  const [frontendKps] = await conn.query(`
    SELECT qd.QuestionID, kp.KPTitle, kp.KPContent
    FROM math_questiondetails qd
    JOIN math_knowledgepoints kp ON kp.KnowledgePointID = qd.LinkedKnowledgePointID
    WHERE qd.BusType = '考点'
    AND qd.QuestionID IN (1546, 3887, 26493, 51034)
  `);
  console.log('\n=== 前端应该显示的考点数据 ===');
  for (const d of frontendKps) {
    console.log(`QID=${d.QuestionID} → ${d.KPTitle}: ${(d.KPContent||'').substring(0,40)}`);
  }

  await conn.end();
})();