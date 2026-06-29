const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host:'localhost', user:'root', password:'123456', database:'quizmaster' });

  // 1. 查看 math_questions 表中的 LinkNames 样本
  const [samples] = await conn.query(`
    SELECT QuestionID, LinksCount, LinkNames 
    FROM math_questions 
    WHERE LinksCount IS NOT NULL AND LinksCount != ''
    LIMIT 20
  `);
  console.log('=== 有 LinksCount 的题目样本 ===');
  for (const s of samples) {
    console.log(`QID=${s.QuestionID}  LinksCount=${s.LinksCount}  LinkNames=${s.LinkNames}`);
  }

  // 2. 收集所有唯一的 LinkNames 值
  const [allNames] = await conn.query(`
    SELECT DISTINCT LinkNames FROM math_questions 
    WHERE LinkNames IS NOT NULL AND LinkNames != ''
  `);
  console.log('\n=== 所有唯一的 LinkNames 值 ===');
  const uniqueNames = new Set();
  for (const row of allNames) {
    const names = row.LinkNames.split(',').map(n => n.trim()).filter(Boolean);
    for (const n of names) {
      uniqueNames.add(n);
    }
  }
  console.log(`共有 ${uniqueNames.size} 个唯一的考点名称`);
  
  // 3. 检查 math_knowledgepoints 表中的 KPTitle
  const [kps] = await conn.query('SELECT KnowledgePointID, KPTitle FROM math_knowledgepoints ORDER BY KPTitle');
  console.log(`\n=== math_knowledgepoints 表 (共 ${kps.length} 条) ===`);
  const kpTitles = new Set(kps.map(k => k.KPTitle ? k.KPTitle.trim() : ''));
  
  // 4. 逐一检查每个 LinkNames 值能否匹配到
  console.log('\n=== 逐一检查匹配 ===');
  let matched = 0;
  let unmatched = 0;
  const unmatchedList = [];
  
  for (const name of uniqueNames) {
    const trimmed = name.trim();
    // 精确匹配
    let found = kps.find(k => k.KPTitle && k.KPTitle.trim() === trimmed);
    // 包含匹配
    if (!found) found = kps.find(k => k.KPTitle && k.KPTitle.includes(trimmed));
    if (!found) found = kps.find(k => k.KPTitle && trimmed.includes(k.KPTitle.trim()));
    
    if (found) {
      matched++;
    } else {
      unmatched++;
      unmatchedList.push(trimmed);
    }
  }
  
  console.log(`  匹配成功: ${matched}`);
  console.log(`  匹配失败: ${unmatched}`);
  
  if (unmatchedList.length > 0) {
    console.log('\n=== 无法匹配的考点名称 ===');
    for (const name of unmatchedList) {
      console.log(`  "${name}"`);
    }
  }

  await conn.end();
})();