const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host:'localhost', user:'root', password:'123456', database:'quizmaster' });

  // 获取所有唯一的 LinkNames
  const [allNames] = await conn.query(`
    SELECT DISTINCT LinkNames FROM math_questions 
    WHERE LinkNames IS NOT NULL AND LinkNames != ''
  `);
  const uniqueNames = new Set();
  for (const row of allNames) {
    const names = row.LinkNames.split(',').map(n => n.trim()).filter(Boolean);
    for (const n of names) {
      uniqueNames.add(n);
    }
  }

  // 获取所有 KPTitle
  const [kps] = await conn.query('SELECT KnowledgePointID, KPTitle, KPContent FROM math_knowledgepoints ORDER BY KPTitle');
  const kpTitles = kps.map(k => k.KPTitle ? k.KPTitle.trim() : '');

  console.log('=== 所有 math_knowledgepoints 的 KPTitle ===');
  for (const kp of kps) {
    console.log(`  KPID=${kp.KnowledgePointID}  KPTitle="${kp.KPTitle}"`);
  }

  // 找出无法匹配的名称，逐个检查
  console.log('\n\n=== 无法匹配的 LinkNames 详情 ===');
  let unmatchedCount = 0;
  for (const name of uniqueNames) {
    const trimmed = name.trim();
    let found = kps.find(k => k.KPTitle && k.KPTitle.trim() === trimmed);
    if (!found) found = kps.find(k => k.KPTitle && k.KPTitle.includes(trimmed));
    if (!found) found = kps.find(k => k.KPTitle && trimmed.includes(k.KPTitle.trim()));
    
    if (!found) {
      unmatchedCount++;
      // 检查最接近的匹配（最长公共子串）
      let bestScore = 0;
      let bestKp = null;
      for (const kp of kps) {
        if (!kp.KPTitle) continue;
        const t1 = trimmed.replace(/[\s,，、]/g, '');
        const t2 = kp.KPTitle.replace(/[\s,，、]/g, '');
        let lcsLen = 0;
        for (let i = 0; i < t1.length; i++) {
          for (let j = i + 1; j <= t1.length; j++) {
            const sub = t1.substring(i, j);
            if (t2.includes(sub) && sub.length > lcsLen) {
              lcsLen = sub.length;
            }
          }
        }
        const score = lcsLen / Math.max(t1.length, t2.length);
        if (score > bestScore) {
          bestScore = score;
          bestKp = kp;
        }
      }
      if (bestKp && bestScore > 0.3) {
        console.log(`  ❌ "${trimmed}" → 最接近: "${bestKp.KPTitle}" (相似度: ${bestScore.toFixed(2)}) KPID=${bestKp.KnowledgePointID}`);
      } else {
        console.log(`  ❌ "${trimmed}" → 无接近匹配`);
      }
    }
  }
  console.log(`\n共 ${unmatchedCount} 个无法匹配`);

  await conn.end();
})();