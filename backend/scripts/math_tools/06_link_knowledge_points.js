const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

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
      if (long.includes(sub)) {
        maxLen = Math.max(maxLen, sub.length);
      }
    }
  }
  return maxLen / Math.max(s1.length, s2.length);
}

// 考点名称匹配逻辑（8种策略）
function matchKPName(name, kpList) {
  if (!name || !kpList || kpList.length === 0) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;

  // 策略1: 精确匹配
  let found = kpList.find(kp => kp.KPTitle && kp.KPTitle.trim() === trimmed);
  if (found) return { kp: found, type: 'exact' };

  // 策略2: KPTitle包含搜索词
  found = kpList.find(kp => kp.KPTitle && kp.KPTitle.includes(trimmed));
  if (found) return { kp: found, type: 'title-contains' };

  // 策略3: 搜索词包含KPTitle
  found = kpList.find(kp => kp.KPTitle && trimmed.includes(kp.KPTitle.trim()));
  if (found) return { kp: found, type: 'name-contains' };

  // 策略4: 去掉标点空格后精确匹配
  const normalized = trimmed.replace(/[，、：；。！？\s,.!?;:]/g, '');
  found = kpList.find(kp => kp.KPTitle && kp.KPTitle.replace(/[，、：；。！？\s,.!?;:]/g, '') === normalized);
  if (found) return { kp: found, type: 'normalized-exact' };

  // 策略5: 搜索词去掉尾部词后匹配（如"函数的奇偶性"去掉"性"试配）
  for (const suffix of ['性', '问题', '题', '定理', '公式', '法', '关系', '概念']) {
    if (trimmed.endsWith(suffix)) {
      const base = trimmed.slice(0, -suffix.length);
      found = kpList.find(kp => kp.KPTitle && (
        kp.KPTitle.trim() === base ||
        kp.KPTitle.includes(base) ||
        base.includes(kp.KPTitle.trim())
      ));
      if (found) return { kp: found, type: 'trim-suffix' };
    }
  }

  // 策略6: 搜索词作为KPTitle的一部分（反向包含）
  if (trimmed.length >= 4) {
    found = kpList.find(kp => kp.KPTitle && kp.KPTitle.includes(trimmed));
    if (found) return { kp: found, type: 'kptitle-has-name' };
  }

  // 策略7: KPTitle作为搜索词的一部分
  found = kpList.find(kp => kp.KPTitle && kp.KPTitle.length >= 4 && trimmed.includes(kp.KPTitle));
  if (found) return { kp: found, type: 'name-has-kptitle' };

  // 策略8: 最长公共子串相似度匹配 (阈值0.5)
  let bestScore = 0;
  let bestKp = null;
  for (const candidate of kpList) {
    if (!candidate.KPTitle) continue;
    const score = calcSimilarity(trimmed, candidate.KPTitle);
    if (score > bestScore) {
      bestScore = score;
      bestKp = candidate;
    }
  }
  if (bestScore >= 0.5 && bestKp) {
    return { kp: bestKp, type: `sim(${bestScore.toFixed(2)})` };
  }

  return null;
}

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '123456',
    database: process.env.MYSQL_DATABASE || 'quizmaster'
  });

  console.log('=== 考点自动匹配与链接修复脚本（增强版）===\n');

  // 1. 加载所有知识点
  const [allKps] = await conn.query('SELECT KnowledgePointID, KPTitle, KPCode, KPContent FROM math_knowledgepoints');
  console.log(`知识点总数: ${allKps.length}`);

  // 显示所有 KPTitle 帮助诊断
  console.log('\n所有KPTitle列表:');
  for (const kp of allKps) {
    console.log(`  KPID=${kp.KnowledgePointID}  "${kp.KPTitle}"`);
  }

  // 2. 获取所有有LinksCount的题目
  const [questions] = await conn.query(`
    SELECT QuestionID, LinksCount, LinkNames 
    FROM math_questions 
    WHERE LinksCount IS NOT NULL AND LinksCount != ''
    ORDER BY QuestionID
  `);
  console.log(`\n有LinksCount的题目数: ${questions.length}`);

  let totalLinked = 0;
  let totalMatched = 0;
  let totalFailed = 0;
  const failedQueue = [];

  for (const q of questions) {
    const names = (q.LinkNames || '').split(',').map(n => n.trim()).filter(Boolean);
    if (names.length === 0) continue;

    // 检查已有哪些考点详情
    const [existingDetails] = await conn.query(
      'SELECT ID, Title, LinkedKnowledgePointID FROM math_questiondetails WHERE QuestionID = ? AND BusType = ?',
      [q.QuestionID, '考点']
    );

    let linkedCount = 0;
    let matchedCount = 0;

    for (const name of names) {
      // 检查是否已有此考点的记录且已关联
      const existingLinked = existingDetails.find(d => 
        d.LinkedKnowledgePointID !== null && 
        d.Title && (d.Title.trim() === name.trim() || d.Title.includes(name.trim()))
      );
      if (existingLinked) {
        linkedCount++;
        continue;
      }

      // 匹配考点
      const match = matchKPName(name, allKps);
      if (!match) {
        totalFailed++;
        failedQueue.push({ qid: q.QuestionID, name });
        continue;
      }

      const kp = match.kp;

      // 查找是否已有此名称的详情记录（未关联）
      const existingDetail = existingDetails.find(d => 
        d.Title && (d.Title.trim() === name.trim() || d.Title.includes(name.trim()))
      );

      if (existingDetail) {
        await conn.query(
          'UPDATE math_questiondetails SET LinkedKnowledgePointID = ? WHERE ID = ?',
          [kp.KnowledgePointID, existingDetail.ID]
        );
        console.log(`  ✅ 更新: QID=${q.QuestionID} "${name}" → KPID=${kp.KnowledgePointID} (${match.type})`);
      } else {
        const ctx = kp.KPContent || '';
        await conn.query(
          `INSERT INTO math_questiondetails (QuestionID, BusType, Title, Context, LinkedKnowledgePointID)
           VALUES (?, '考点', ?, ?, ?)`,
          [q.QuestionID, name, ctx, kp.KnowledgePointID]
        );
        console.log(`  ✅ 新增: QID=${q.QuestionID} "${name}" → KPID=${kp.KnowledgePointID} (${match.type})`);
      }

      linkedCount++;
      matchedCount++;
    }

    totalLinked += linkedCount;
    totalMatched += matchedCount;
  }

  console.log(`\n=== 修复统计 ===`);
  console.log(`  处理题目: ${questions.length}`);
  console.log(`  成功链接: ${totalLinked}（其中新增${totalMatched}）`);
  console.log(`  无法匹配: ${totalFailed}`);

  if (failedQueue.length > 0) {
    console.log(`\n=== 无法匹配的考点名称 (${failedQueue.length}个) ===`);
    for (const f of failedQueue) {
      console.log(`  QID=${f.qid}  名称="${f.name}"`);
    }
  }

  // 验证
  const [remaining] = await conn.query(`
    SELECT COUNT(*) as c FROM math_questiondetails 
    WHERE BusType = '考点' AND LinkedKnowledgePointID IS NULL
  `);
  console.log(`\n修复后仍无关联的考点记录: ${remaining[0].c}`);

  await conn.end();
})();