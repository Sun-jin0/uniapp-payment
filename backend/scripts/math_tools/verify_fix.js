const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: '139.199.9.132',
    user: 'root',
    password: '4212b46b7c02ee61',
    database: 'quizmaster'
  });

  // 验证问题 195832
  console.log('=== 问题 195832 的考点详情 ===');
  const [details] = await conn.query(
    "SELECT ID, Title, Context, LinkedKnowledgePointID FROM math_questiondetails WHERE QuestionID = 195832 AND BusType = '考点'"
  );
  for (const d of details) {
    if (d.LinkedKnowledgePointID) {
      const [kp] = await conn.query('SELECT KPTitle, KPContent FROM math_knowledgepoints WHERE KnowledgePointID = ?', [d.LinkedKnowledgePointID]);
      console.log(`  Title="${d.Title}" → KPID=${d.LinkedKnowledgePointID} 内容="${(kp[0]?.KPContent||'').substring(0,40)}"`);
    } else {
      console.log(`  Title="${d.Title}" → 未关联`);
    }
  }

  // 验证 函数的奇偶性
  console.log('\n=== 函数的奇偶性 考点关联情况 ===');
  const [qd] = await conn.query(`
    SELECT qd.QuestionID, qd.Title, qd.LinkedKnowledgePointID, kp.KPTitle
    FROM math_questiondetails qd
    JOIN math_knowledgepoints kp ON kp.KnowledgePointID = qd.LinkedKnowledgePointID
    WHERE qd.BusType = '考点' AND kp.KPTitle LIKE '%奇偶%'
    LIMIT 10
  `);
  for (const d of qd) {
    console.log(`  QID=${d.QuestionID} 详情Title="${d.Title}" → KPID=${d.LinkedKnowledgePointID} "${d.KPTitle}"`);
  }

  // 验证 函数的单调性
  console.log('\n=== 函数的单调性 考点关联情况 ===');
  const [dd] = await conn.query(`
    SELECT qd.QuestionID, qd.Title, qd.LinkedKnowledgePointID, kp.KPTitle
    FROM math_questiondetails qd
    JOIN math_knowledgepoints kp ON kp.KnowledgePointID = qd.LinkedKnowledgePointID
    WHERE qd.BusType = '考点' AND kp.KPTitle LIKE '%单调%'
    LIMIT 5
  `);
  for (const d of dd) {
    console.log(`  QID=${d.QuestionID} 详情Title="${d.Title}" → KPID=${d.LinkedKnowledgePointID} "${d.KPTitle}"`);
  }

  // 总统计
  const [total] = await conn.query("SELECT COUNT(*) as c FROM math_questions WHERE LinksCount IS NOT NULL AND LinksCount != ''");
  const [linked] = await conn.query(
    "SELECT COUNT(DISTINCT QuestionID) as c FROM math_questiondetails WHERE BusType = '考点' AND LinkedKnowledgePointID IS NOT NULL"
  );
  const [det] = await conn.query(
    "SELECT COUNT(*) as total, SUM(CASE WHEN LinkedKnowledgePointID IS NOT NULL THEN 1 ELSE 0 END) as linked FROM math_questiondetails WHERE BusType = '考点'"
  );
  console.log(`\n=== 远程数据库最终统计 ===`);
  console.log(`有 LinksCount 的题目: ${total[0].c}`);
  console.log(`已链接考点的题目: ${linked[0].c}`);
  console.log(`考点记录总数: ${det[0].total}`);
  console.log(`已关联考点记录: ${det[0].linked}`);
  console.log(`未关联考点记录: ${det[0].total - det[0].linked}`);

  await conn.end();
})();