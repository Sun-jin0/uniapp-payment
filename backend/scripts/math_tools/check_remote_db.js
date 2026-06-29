const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: '139.199.9.132',
    user: 'root',
    password: '4212b46b7c02ee61',
    database: 'quizmaster'
  });
  console.log('✅ 成功连接远程数据库');

  // 1. 检查 math_knowledgepoints 表结构
  const [cols] = await conn.query('SHOW COLUMNS FROM math_knowledgepoints');
  console.log('\n=== math_knowledgepoints 表结构 ===');
  for (const c of cols) console.log(`  ${c.Field} (${c.Type})`);

  // 2. 检查 math_questions 样本 - LinksCount
  const [qSamples] = await conn.query(
    'SELECT QuestionID, LinksCount, LinkNames FROM math_questions WHERE LinksCount IS NOT NULL AND LinksCount != "" LIMIT 15'
  );
  console.log('\n=== math_questions LinksCount 样本 ===');
  for (const q of qSamples) {
    console.log(`  QID=${q.QuestionID}  LinksCount="${q.LinksCount}"  LinkNames="${q.LinkNames}"`);
  }

  // 3. 检查 math_knowledgepoints 中是否有这些ID作为 KnowledgePointID
  const linkCountValues = new Set();
  for (const q of qSamples) {
    if (q.LinksCount) {
      q.LinksCount.split(',').forEach(id => linkCountValues.add(parseInt(id.trim())));
    }
  }
  const ids = [...linkCountValues].filter(id => !isNaN(id));
  console.log(`\n=== 检查 LinksCount 中的ID (${ids.join(',')}) 是否存在于 math_knowledgepoints ===`);
  for (const id of ids) {
    const [rows] = await conn.query('SELECT KnowledgePointID, KPTitle, KPCode FROM math_knowledgepoints WHERE KnowledgePointID = ?', [id]);
    if (rows.length > 0) {
      console.log(`  ✅ KPID=${id} → KPTitle="${rows[0].KPTitle}" KPCode="${rows[0].KPCode}"`);
    } else {
      // 检查 KPCode
      const [byCode] = await conn.query('SELECT * FROM math_knowledgepoints WHERE KPCode = ?', [String(id)]);
      if (byCode.length > 0) {
        console.log(`  ✅ KPCode="${id}" → KPID=${byCode[0].KnowledgePointID} KPTitle="${byCode[0].KPTitle}"`);
      } else {
        console.log(`  ❌ ${id} → 不在 math_knowledgepoints 中`);
      }
    }
  }

  // 4. check KPTitles
  const [kps] = await conn.query('SELECT KnowledgePointID, KPTitle, KPCode FROM math_knowledgepoints ORDER BY KnowledgePointID LIMIT 30');
  console.log('\n=== math_knowledgepoints 前30条 ===');
  for (const kp of kps) {
    console.log(`  KPID=${kp.KnowledgePointID}  Title="${kp.KPTitle}"  Code="${kp.KPCode}"`);
  }

  // 5. math_knowledgepoints 总数
  const [count] = await conn.query('SELECT COUNT(*) as c FROM math_knowledgepoints');
  console.log(`\nmath_knowledgepoints 总数: ${count[0].c}`);

  // 6. check kp with min and max id
  const [minmax] = await conn.query('SELECT MIN(KnowledgePointID) as minId, MAX(KnowledgePointID) as maxId FROM math_knowledgepoints');
  console.log(`KnowledgePointID 范围: ${minmax[0].minId} ~ ${minmax[0].maxId}`);

  // 7. 查询 1917,1918,1924,1925,2428
  const oldIds = [1917, 1918, 1924, 1925, 2428];
  console.log('\n=== 查询特定ID (1917,1918,1924,1925,2428) ===');
  for (const id of oldIds) {
    const [rows] = await conn.query('SELECT KnowledgePointID, KPTitle, KPCode FROM math_knowledgepoints WHERE KnowledgePointID = ?', [id]);
    if (rows.length > 0) {
      console.log(`  ✅ KPID=${id} → Title="${rows[0].KPTitle}"`);
    } else {
      console.log(`  ❌ KPID=${id} → 不存在`);
    }
  }

  // 8. 检查 math_questiondetails 考点记录
  const [detStats] = await conn.query(
    "SELECT COUNT(*) as total, SUM(CASE WHEN LinkedKnowledgePointID IS NOT NULL THEN 1 ELSE 0 END) as linked FROM math_questiondetails WHERE BusType = '考点'"
  );
  console.log(`\nmath_questiondetails 考点: 总数=${detStats[0].total}, 已关联=${detStats[0].linked}, 未关联=${detStats[0].total-detStats[0].linked}`);

  // 9. 检查有 LinksCount 的题目数
  const [qCount] = await conn.query("SELECT COUNT(*) as c FROM math_questions WHERE LinksCount IS NOT NULL AND LinksCount != ''");
  console.log(`有 LinksCount 的题目数: ${qCount[0].c}`);

  await conn.end();
})();