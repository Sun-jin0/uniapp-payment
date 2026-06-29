const mysql = require('mysql2/promise');

// 计算字符串相似度（最长公共子串比例）
function calcSimilarity(a, b) {
  if (!a || !b) return 0;
  const s1 = a.replace(/[\s,，、]/g, '');
  const s2 = b.replace(/[\s,，、]/g, '');
  if (s1 === s2) return 1;
  let maxLen = 0;
  const short = s1.length <= s2.length ? s1 : s2;
  const long = s1.length > s2.length ? s1 : s2;
  for (let i = 0; i < short.length; i++) {
    for (let j = i + 1; j <= short.length; j++) {
      const sub = short.substring(i, j);
      if (long.includes(sub)) maxLen = Math.max(maxLen, sub.length);
    }
  }
  return maxLen / Math.max(s1.length, s2.length);
}

// 8种匹配策略
function matchKPName(name, kpList) {
  if (!name || !kpList || kpList.length === 0) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;

  // 策略1: 精确匹配
  let found = kpList.find(kp => kp.KPTitle && kp.KPTitle.trim() === trimmed);
  if (found) return { kp: found, type: 'exact' };

  // 策略2: KPTitle 包含搜索词
  found = kpList.find(kp => kp.KPTitle && kp.KPTitle.includes(trimmed));
  if (found) return { kp: found, type: 'title-contains' };

  // 策略3: 搜索词包含 KPTitle
  found = kpList.find(kp => kp.KPTitle && trimmed.includes(kp.KPTitle.trim()));
  if (found) return { kp: found, type: 'name-contains' };

  // 策略4: 去掉标点空格后精确匹配
  const normVal = trimmed.replace(/[，、：；。！？\s,.!?;:]/g, '');
  found = kpList.find(kp => kp.KPTitle && kp.KPTitle.replace(/[，、：；。！？\s,.!?;:]/g, '') === normVal);
  if (found) return { kp: found, type: 'normalized' };

  // 策略5: 去掉尾部词
  for (const sfx of ['性', '问题', '题', '定理', '公式', '法', '关系', '概念']) {
    if (trimmed.endsWith(sfx)) {
      const base = trimmed.slice(0, -sfx.length);
      found = kpList.find(kp => kp.KPTitle && (
        kp.KPTitle.trim() === base || kp.KPTitle.includes(base) || base.includes(kp.KPTitle.trim())
      ));
      if (found) return { kp: found, type: `trim-${sfx}` };
    }
  }

  // 策略6: KPTitle包含搜索词（长度>=4）
  if (trimmed.length >= 4) {
    found = kpList.find(kp => kp.KPTitle && kp.KPTitle.includes(trimmed));
    if (found) return { kp: found, type: 'kp-has-name' };
  }

  // 策略7: 搜索词包含KPTitle（KPTitle长度>=4）
  found = kpList.find(kp => kp.KPTitle && kp.KPTitle.length >= 4 && trimmed.includes(kp.KPTitle));
  if (found) return { kp: found, type: 'name-has-kp' };

  // 策略8: 相似度匹配（阈值0.45）
  let bestScore = 0, bestKp = null;
  for (const kp of kpList) {
    if (!kp.KPTitle) continue;
    const score = calcSimilarity(trimmed, kp.KPTitle);
    if (score > bestScore) { bestScore = score; bestKp = kp; }
  }
  if (bestScore >= 0.45 && bestKp) return { kp: bestKp, type: `sim(${bestScore.toFixed(2)})` };

  return null;
}

(async () => {
  const conn = await mysql.createConnection({
    host: '139.199.9.132',
    user: 'root',
    password: '4212b46b7c02ee61',
    database: 'quizmaster'
  });

  console.log('=== 远程数据库考点自动匹配与链接修复 ===\n');

  // 1. 加载所有知识点
  const [allKps] = await conn.query('SELECT KnowledgePointID, KPTitle, KPCode, KPContent FROM math_knowledgepoints');
  console.log(`知识点总数: ${allKps.length}`);

  // 2. 获取所有有 LinksCount/LinkNames 的题目
  const [questions] = await conn.query(`
    SELECT QuestionID, LinksCount, LinkNames 
    FROM math_questions 
    WHERE LinksCount IS NOT NULL AND LinksCount != ''
    ORDER BY QuestionID
  `);
  console.log(`有 LinksCount 的题目数: ${questions.length}`);

  let totalLinked = 0, totalMatched = 0, totalFailed = 0;
  const failedQueue = [];
  const startTime = Date.now();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const names = (q.LinkNames || '').split(',').map(n => n.trim()).filter(Boolean);
    if (names.length === 0) continue;

    // 进度显示
    if ((i + 1) % 500 === 0 || i === questions.length - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`进度: ${i+1}/${questions.length} | 已处理 ${totalLinked} 条 | ${elapsed}s`);
    }

    // 获取该题已有的考点详情
    const [existingDetails] = await conn.query(
      'SELECT ID, Title, LinkedKnowledgePointID FROM math_questiondetails WHERE QuestionID = ? AND BusType = ?',
      [q.QuestionID, '考点']
    );

    let linkedCount = 0, matchedCount = 0;

    for (const name of names) {
      // 是否已有此考点且已关联
      const already = existingDetails.find(d =>
        d.LinkedKnowledgePointID !== null &&
        d.Title && (d.Title.trim() === name.trim() || d.Title.includes(name.trim()))
      );
      if (already) { linkedCount++; continue; }

      const match = matchKPName(name, allKps);
      if (!match) {
        totalFailed++;
        failedQueue.push({ qid: q.QuestionID, name });
        continue;
      }

      const kp = match.kp;

      // 已有同名记录（未关联）则更新
      const existing = existingDetails.find(d =>
        d.Title && (d.Title.trim() === name.trim() || d.Title.includes(name.trim()))
      );

      if (existing) {
        await conn.query(
          'UPDATE math_questiondetails SET LinkedKnowledgePointID = ?, Context = ? WHERE ID = ?',
          [kp.KnowledgePointID, kp.KPContent || '', existing.ID]
        );
      } else {
        await conn.query(
          `INSERT INTO math_questiondetails (QuestionID, BusType, Title, Context, LinkedKnowledgePointID)
           VALUES (?, '考点', ?, ?, ?)`,
          [q.QuestionID, name, kp.KPContent || '', kp.KnowledgePointID]
        );
      }
      linkedCount++; matchedCount++;
    }

    totalLinked += linkedCount;
    totalMatched += matchedCount;
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== 修复统计 ===`);
  console.log(`  处理题目: ${questions.length}`);
  console.log(`  成功链接: ${totalLinked}（其中新增/更新 ${totalMatched}）`);
  console.log(`  无法匹配: ${totalFailed}`);
  console.log(`  耗时: ${totalTime}s`);

  if (failedQueue.length > 0) {
    console.log(`\n=== 无法匹配的考点名称 (${failedQueue.length}个) ===`);
    const unique = [...new Set(failedQueue.map(f => f.name))];
    for (const name of unique) {
      const items = failedQueue.filter(f => f.name === name);
      console.log(`  "${name}" (${items.length}题)`);
    }
  }

  // 验证最终结果
  const [detStats] = await conn.query(
    "SELECT COUNT(*) as total, SUM(CASE WHEN LinkedKnowledgePointID IS NOT NULL THEN 1 ELSE 0 END) as linked FROM math_questiondetails WHERE BusType = '考点'"
  );
  console.log(`\n最终 math_questiondetails 考点: 总数=${detStats[0].total}, 已关联=${detStats[0].linked}, 未关联=${detStats[0].total-detStats[0].linked}`);

  await conn.end();
  console.log('完成！');
})();