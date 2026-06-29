const mysqlPool = require('../config/mysql');
const { successResponse, errorResponse } = require('../utils/response');
const fs = require('fs');
const path = require('path');

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

// 考点名称匹配逻辑 - 根据LinksCount/LinkNames自动匹配并链接知识点
async function linkKnowledgePointsForQuestion(connection, questionId, linksCount, linkNames) {
  if (!linksCount || !linkNames) return { matched: 0, failed: 0 };

  const names = linkNames.split(',').map(n => n.trim()).filter(Boolean);
  if (names.length === 0) return { matched: 0, failed: 0 };

  // 加载所有知识点
  const [allKps] = await connection.query(
    'SELECT KnowledgePointID, KPTitle, KPCode, KPContent FROM math_knowledgepoints'
  );

  let matched = 0;
  let failed = 0;

  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;

    // 检查是否已有此考点的记录且已关联
    const [existingDetails] = await connection.query(
      'SELECT ID, Title, LinkedKnowledgePointID FROM math_questiondetails WHERE QuestionID = ? AND BusType = ?',
      [questionId, '考点']
    );
    const existingLinked = existingDetails.find(d =>
      d.LinkedKnowledgePointID !== null &&
      d.Title && (d.Title.trim() === trimmed || d.Title.includes(trimmed))
    );
    if (existingLinked) continue;

    // 多策略匹配
    let kp = null;
    let matchType = '';

    // 策略1: 精确匹配
    kp = allKps.find(k => k.KPTitle && k.KPTitle.trim() === trimmed);
    if (kp) matchType = 'exact';

    // 策略2: KPTitle 包含搜索词
    if (!kp) {
      kp = allKps.find(k => k.KPTitle && k.KPTitle.includes(trimmed));
      if (kp) matchType = 'title-contains';
    }

    // 策略3: 搜索词包含 KPTitle
    if (!kp) {
      kp = allKps.find(k => k.KPTitle && trimmed.includes(k.KPTitle.trim()));
      if (kp) matchType = 'name-contains';
    }

    // 策略4: 去掉标点空格后精确匹配
    if (!kp) {
      const normalized = trimmed.replace(/[，、：；。！？\s,.!?;:]/g, '');
      kp = allKps.find(k => k.KPTitle && k.KPTitle.replace(/[，、：；。！？\s,.!?;:]/g, '') === normalized);
      if (kp) matchType = 'normalized-exact';
    }

    // 策略5: 搜索词去掉尾部词后匹配（如"函数的奇偶性"去掉"性"试配"函数的奇偶"）
    if (!kp) {
      for (const suffix of ['性', '问题', '题', '定理', '公式', '法', '关系', '概念']) {
        if (trimmed.endsWith(suffix)) {
          const base = trimmed.slice(0, -suffix.length);
          kp = allKps.find(k => k.KPTitle && (
            k.KPTitle.trim() === base ||
            k.KPTitle.includes(base) ||
            base.includes(k.KPTitle.trim())
          ));
          if (kp) { matchType = 'trim-suffix'; break; }
        }
      }
    }

    // 策略6: 搜索词作为KPTitle的一部分（反向包含，更宽松）
    if (!kp) {
      kp = allKps.find(k => k.KPTitle && trimmed.length >= 4 && k.KPTitle.includes(trimmed));
      if (kp) matchType = 'kptitle-has-name';
    }

    // 策略7: KPTitle作为搜索词的一部分
    if (!kp) {
      kp = allKps.find(k => k.KPTitle && k.KPTitle.length >= 4 && trimmed.includes(k.KPTitle));
      if (kp) matchType = 'name-has-kptitle';
    }

    // 策略8: 最长公共子串相似度匹配 (阈值0.5)
    if (!kp) {
      let bestScore = 0;
      let bestKp = null;
      for (const candidate of allKps) {
        if (!candidate.KPTitle) continue;
        const score = calcSimilarity(trimmed, candidate.KPTitle);
        if (score > bestScore) {
          bestScore = score;
          bestKp = candidate;
        }
      }
      if (bestScore >= 0.5 && bestKp) {
        kp = bestKp;
        matchType = `sim(${bestScore.toFixed(2)})`;
      }
    }

    if (!kp) {
      failed++;
      continue;
    }

    // 查找是否已有同名详情记录（未关联）
    const existingDetail = existingDetails.find(d =>
      d.Title && (d.Title.trim() === trimmed || d.Title.includes(trimmed))
    );

    if (existingDetail) {
      await connection.query(
        'UPDATE math_questiondetails SET LinkedKnowledgePointID = ?, Context = ? WHERE ID = ?',
        [kp.KnowledgePointID, kp.KPContent || '', existingDetail.ID]
      );
    } else {
      const ctx = kp.KPContent || '';
      await connection.query(
        `INSERT INTO math_questiondetails (QuestionID, BusType, Title, Context, LinkedKnowledgePointID)
         VALUES (?, '考点', ?, ?, ?)`,
        [questionId, trimmed, ctx, kp.KnowledgePointID]
      );
    }
    matched++;
  }

  return { matched, failed };
}

// 获取数学科目列表
const getSubjects = async (req, res) => {
  try {
    const [subjects] = await mysqlPool.query('SELECT SubjectID as id, SubjectName as name, exam_type_id as examTypeId, SubjectID, SubjectName, exam_type_id FROM math_subjects ORDER BY SubjectName ASC');
    res.json(successResponse(subjects));
  } catch (error) {
    console.error('获取科目列表失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取纠错列表 (支持过滤和分页)
const getCorrections = async (req, res) => {
  try {
    const { status, type, page = 1, pageSize = 20, sortBy = 'CreatedAt', sortOrder = 'DESC' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let baseQuery = `
      FROM math_corrections c
      LEFT JOIN math_questions q ON c.QuestionID = q.QuestionID
      LEFT JOIN math_books b ON c.BookID = b.BookID
      WHERE 1=1
    `;
    const params = [];
    
    if (status !== undefined && status !== '') {
      baseQuery += ` AND c.Status = ?`;
      params.push(status);
    }

    if (type !== undefined && type !== '') {
      baseQuery += ` AND c.Type = ?`;
      params.push(type);
    }
    
    // 获取总数
    const [countRows] = await mysqlPool.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
    const total = countRows[0].total;

    // 获取分页数据
    const allowedSortFields = ['CreatedAt', 'UpdatedAt', 'id', 'Status'];
    const finalSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'CreatedAt';
    const finalSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let dataQuery = `
      SELECT c.*, q.QuestionText, b.BookTitle 
      ${baseQuery}
      ORDER BY c.${finalSortBy} ${finalSortOrder}
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(pageSize), offset);
    
    const [rows] = await mysqlPool.query(dataQuery, params);
    
    const formattedRows = rows.map(row => ({
      ...row,
      ID: Number(row.ID || row.id),
      id: Number(row.id || row.ID),
      QuestionID: Number(row.QuestionID),
      Status: Number(row.Status)
    }));
    
    res.json(successResponse({
      list: formattedRows,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }));
  } catch (error) {
    console.error('获取纠错列表失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 搜索题目
const searchQuestions = async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) {
      return res.json(successResponse([]));
    }

    let query = 'SELECT QuestionID, QuestionText FROM math_questions WHERE ';
    const params = [];

    if (!isNaN(keyword)) {
      query += 'QuestionID = ? OR ';
      params.push(keyword);
    }
    
    query += 'QuestionText LIKE ? LIMIT 50';
    params.push(`%${keyword}%`);

    const [rows] = await mysqlPool.query(query, params);
    res.json(successResponse(rows));
  } catch (error) {
    console.error('搜索题目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 搜索考点
const searchKnowledgePoints = async (req, res) => {
  try {
    const { keyword } = req.query;
    const [rows] = await mysqlPool.query(
      'SELECT KnowledgePointID, KPTitle, KPType FROM math_knowledgepoints WHERE KPTitle LIKE ? OR KPCode LIKE ? LIMIT 20',
      [`%${keyword || ''}%`, `%${keyword || ''}%`]
    );
    res.json(successResponse(rows));
  } catch (error) {
    console.error('搜索考点失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取题目完整详情（用于编辑）
const getQuestionForEdit = async (req, res) => {
  try {
    const { questionId } = req.params;
    
    const [questions] = await mysqlPool.query('SELECT * FROM math_questions WHERE QuestionID = ?', [questionId]);
    const [details] = await mysqlPool.query('SELECT * FROM math_questiondetails WHERE QuestionID = ?', [questionId]);
    
    // 获取关联考点
    const [kpLinks] = await mysqlPool.query(`
      SELECT kp.* FROM math_knowledgepoints kp
      JOIN math_questiondetails qd ON qd.LinkedKnowledgePointID = kp.KnowledgePointID
      WHERE qd.QuestionID = ?
    `, [questionId]);
    
    // 获取题目关联的书籍和章节信息（从math_bookquestions表）
    const [bookQuestions] = await mysqlPool.query(`
      SELECT bq.BookID, bq.BookChapter, bq.QuestionPage, bq.QuestionSort, bq.ChapterSort, b.BookTitle
      FROM math_bookquestions bq
      JOIN math_books b ON bq.BookID = b.BookID
      WHERE bq.QuestionID = ?
      LIMIT 1
    `, [questionId]);
    
    if (questions.length === 0) {
      return res.status(404).json(errorResponse('题目不存在'));
    }
    
    // 合并书籍信息到题目数据中
    const questionData = questions[0];
    if (bookQuestions.length > 0) {
      questionData.LegacyOriginalBookID = bookQuestions[0].BookID;
      questionData.BookChapter = bookQuestions[0].BookChapter;
      questionData.BookTitle = bookQuestions[0].BookTitle;
      questionData.QuestionPage = bookQuestions[0].QuestionPage;
      questionData.QuestionSort = bookQuestions[0].QuestionSort;
      questionData.ChapterSort = bookQuestions[0].ChapterSort;
    }
    
    // 排序详情
    const sortedDetails = details.sort((a, b) => (a.Give || 0) - (b.Give || 0));
    
    res.json(successResponse({
      question: questionData,
      details: sortedDetails,
      knowledgePoints: kpLinks
    }));
  } catch (error) {
    console.error('获取题目详情失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 更新题目内容
const updateQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { 
      questionText, 
      answerText, 
      questionType,
      difficulty,
      bookId,
      bookChapter,
      questionPage,
      questionSort,
      chapterSort,
      details,
      correctionId,
      updaterName
    } = req.body;
    
    // 开始事务
    const connection = await mysqlPool.getConnection();
    await connection.beginTransaction();
    
    try {
      // 1. 动态构建 math_questions 更新语句（只更新提供的字段）
      const updateFields = [];
      const updateValues = [];
      
      if (questionText !== undefined) {
        updateFields.push('QuestionText = ?');
        updateValues.push(questionText);
      }
      if (answerText !== undefined) {
        updateFields.push('OriginalAnswerText = ?');
        updateValues.push(answerText);
      }
      if (questionType !== undefined) {
        updateFields.push('QuestionType = ?');
        updateValues.push(questionType || null);
        updateFields.push('IsTypeManuallySet = 1');
      }
      if (difficulty !== undefined) {
        updateFields.push('Difficulty = ?');
        updateValues.push(difficulty || 3);
      }
      if (bookId !== undefined) {
        updateFields.push('LegacyOriginalBookID = ?');
        updateValues.push(bookId || null);
      }
      
      // 只有在有字段需要更新时才执行更新
      if (updateFields.length > 0) {
        updateValues.push(questionId);
        const updateQuery = `UPDATE math_questions SET ${updateFields.join(', ')} WHERE QuestionID = ?`;
        await connection.query(updateQuery, updateValues);
      }
      
      // 2. 更新 math_bookquestions（书籍章节相关信息）- 只更新提供的字段
      if (bookId !== undefined) {
        // 检查是否已存在关联记录
        const [existingRecords] = await connection.query(
          'SELECT EntryID FROM math_bookquestions WHERE BookID = ? AND QuestionID = ?',
          [bookId || null, questionId]
        );
        
        if (existingRecords.length > 0) {
          // 动态构建更新语句
          const bookUpdateFields = [];
          const bookUpdateValues = [];
          
          if (bookChapter !== undefined) {
            bookUpdateFields.push('BookChapter = ?');
            bookUpdateValues.push(bookChapter || null);
          }
          if (questionPage !== undefined) {
            bookUpdateFields.push('QuestionPage = ?');
            bookUpdateValues.push(questionPage || null);
          }
          if (questionSort !== undefined) {
            bookUpdateFields.push('QuestionSort = ?');
            bookUpdateValues.push(questionSort || null);
          }
          if (chapterSort !== undefined) {
            bookUpdateFields.push('ChapterSort = ?');
            bookUpdateValues.push(chapterSort || null);
          }
          
          if (bookUpdateFields.length > 0) {
            bookUpdateValues.push(bookId || null, questionId);
            await connection.query(
              `UPDATE math_bookquestions SET ${bookUpdateFields.join(', ')} WHERE BookID = ? AND QuestionID = ?`,
              bookUpdateValues
            );
          }
        } else if (bookId) {
          // 获取最大EntryID
          const [maxEntryResult] = await connection.query(
            'SELECT MAX(EntryID) as maxEntry FROM math_bookquestions'
          );
          let nextEntryId = (maxEntryResult[0].maxEntry || 0) + 1;
          
          // 插入新记录
          await connection.query(
            `INSERT INTO math_bookquestions 
              (EntryID, BookID, QuestionID, BookChapter, QuestionPage, QuestionSort, ChapterSort) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              nextEntryId,
              bookId,
              questionId,
              bookChapter || null,
              questionPage || null,
              questionSort || null,
              chapterSort || null
            ]
          );
        }
      }
      
      // 2. 处理详情记录 (math_questiondetails) - 只在提供了 details 时才处理
      if (details !== undefined && Array.isArray(details)) {
        // 获取当前数据库中的所有详情 ID
        const [currentDetails] = await connection.query('SELECT ID FROM math_questiondetails WHERE QuestionID = ?', [questionId]);
        
        // 确保 ID 都是数字类型，以便进行准确比较
        const incomingIds = details.filter(d => d.ID).map(d => Number(d.ID));
        const dbIds = currentDetails.map(d => Number(d.ID));
        
        const idsToDelete = dbIds.filter(id => !incomingIds.includes(id));

        if (idsToDelete.length > 0) {
          await connection.query('DELETE FROM math_questiondetails WHERE ID IN (?)', [idsToDelete]);
        }
        
        // B. 更新或插入记录
        for (const detail of details) {
          // 将 ID 转换为数字类型
          const detailId = detail.ID ? Number(detail.ID) : null;
          
          console.log('处理详情记录:', {
            detailId,
            linkedKPID: detail.LinkedKnowledgePointID,
            busType: detail.BusType,
            title: detail.Title
          });
          
          if (detailId && dbIds.includes(detailId)) {
            // 更新已有记录
            console.log('更新详情记录 ID:', detailId, 'LinkedKnowledgePointID:', detail.LinkedKnowledgePointID || null);
            await connection.query(
              'UPDATE math_questiondetails SET Context = ?, Notes = ?, Title = ?, JsonData = ?, LinkedKnowledgePointID = ?, BusType = ?, Give = ? WHERE ID = ?',
              [detail.Context, detail.Notes, detail.Title, detail.JsonData, detail.LinkedKnowledgePointID || null, detail.BusType, detail.Give || 0, detailId]
            );
          } else {
            // 插入新记录
            console.log('插入新详情记录, LinkedKnowledgePointID:', detail.LinkedKnowledgePointID || null);
            await connection.query(
              'INSERT INTO math_questiondetails (QuestionID, Context, Notes, Title, JsonData, LinkedKnowledgePointID, BusType, Give) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [questionId, detail.Context, detail.Notes, detail.Title, detail.JsonData, detail.LinkedKnowledgePointID || null, detail.BusType, detail.Give || 0]
            );
          }
          
          // C. 如果有关联考点且考点内容有变化，更新考点表
          if (detail.LinkedKnowledgePointID && detail.Context !== undefined) {
            const kpId = Number(detail.LinkedKnowledgePointID);
            // 检查考点是否存在
            const [existingKPs] = await connection.query(
              'SELECT KnowledgePointID FROM math_knowledgepoints WHERE KnowledgePointID = ?',
              [kpId]
            );
            
            if (existingKPs.length > 0) {
              // 更新考点内容
              console.log('更新考点内容, KnowledgePointID:', kpId);
              await connection.query(
                'UPDATE math_knowledgepoints SET KPContent = ? WHERE KnowledgePointID = ?',
                [detail.Context, kpId]
              );
            }
          }
        }
      }
      
      // 3. 处理纠错记录
      if (correctionId) {
        await connection.query(
          'UPDATE math_corrections SET Status = 1, AdminNotes = ?, UpdaterName = ? WHERE id = ?',
          ['内容已根据反馈全面更新', updaterName || '管理员', correctionId]
        );
      }
      
      await connection.commit();
      res.json(successResponse(null, '题目及其所有详情已成功更新'));
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('更新题目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 创建题目
const createQuestion = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { 
      questionText, 
      answerText, 
      questionType,
      details,
      bookId,
      chapterName,
      questionSort
    } = req.body;
    
    if (!questionText || questionText.trim() === '') {
      return res.status(400).json(errorResponse('题干内容不能为空'));
    }
    
    await connection.beginTransaction();
    
    // 生成唯一的 QuestionID（手动录入的从 1000000000 开始自动递增）
    // 查找当前最大的手动录入ID（1000000000 及以上）
    const [manualIdResult] = await connection.query(
      "SELECT MAX(QuestionID) as maxManualId FROM math_questions WHERE QuestionID >= 1000000000"
    );
    const maxManualId = manualIdResult[0].maxManualId || 1000000000;
    const newQuestionId = maxManualId + 1;
    
    // 自动判断题型
    const finalQuestionType = questionType || detectQuestionType(questionText);
    
    // 1. 插入 math_questions（只包含题目基本信息）
    await connection.query(
      `INSERT INTO math_questions (
        QuestionID, QuestionText, QuestionType, OriginalAnswerText, Difficulty,
        LegacyOriginalBookID
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        newQuestionId, 
        questionText, 
        finalQuestionType, 
        answerText || '', 
        0.5,
        bookId || null
      ]
    );
    
    // 2. 处理详情 math_questiondetails
    if (details && Array.isArray(details)) {
      for (const detail of details) {
        await connection.query(
          'INSERT INTO math_questiondetails (QuestionID, BusType, Context, Notes, Title, JsonData, LinkedKnowledgePointID, Give) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            newQuestionId,
            detail.BusType || 'analysis',
            detail.Context || '',
            detail.Notes || '',
            detail.Title || '',
            detail.JsonData ? JSON.stringify(detail.JsonData) : null,
            detail.LinkedKnowledgePointID || null,
            detail.Give || 0
          ]
        );
      }
    }
    
    // 3. 如果提供了 bookId，关联到书籍 math_bookquestions
    if (bookId) {
      const [maxSortRows] = await connection.query(
        'SELECT MAX(Sort) as maxSort FROM math_bookquestions WHERE BookID = ?',
        [bookId]
      );
      const nextSort = (maxSortRows[0].maxSort || 0) + 1;
      
      // 获取最大的 EntryID
      const [maxEntryResult] = await connection.query(
        'SELECT MAX(EntryID) as maxEntry FROM math_bookquestions'
      );
      const nextEntryId = (maxEntryResult[0].maxEntry || 0) + 1;
      
      // 如果指定了章节，获取该章节的排序号
      let chapterSort = 0;
      if (chapterName) {
        const [maxChapterSortRows] = await connection.query(
          'SELECT MAX(ChapterSort) as maxSort FROM math_bookquestions WHERE BookID = ? AND BookChapter = ?',
          [bookId, chapterName]
        );
        chapterSort = maxChapterSortRows[0].maxSort || 0;
      }
      
      console.log('插入math_bookquestions:', {
        nextEntryId, bookId, newQuestionId, nextSort, chapterName, chapterSort, questionSort
      });
      
      await connection.query(
        'INSERT INTO math_bookquestions (EntryID, BookID, QuestionID, Sort, BookChapter, ChapterSort, QuestionSort) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nextEntryId, bookId, newQuestionId, nextSort, chapterName || null, chapterSort, questionSort || null]
      );
    }
    
    await connection.commit();
    res.json(successResponse({ 
      questionId: newQuestionId,
      message: '创建成功' 
    }));
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('创建题目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  } finally {
    if (connection) connection.release();
  }
};

// 忽略纠错
const ignoreCorrection = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    await mysqlPool.query(
      'UPDATE math_corrections SET Status = 1, AdminNotes = ? WHERE id = ?',
      [notes || '已忽略', id]
    );
    
    res.json(successResponse(null, '已标记为已处理'));
  } catch (error) {
    console.error('忽略纠错失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// --- 书籍管理 ---

// 获取书籍列表 (分页/过滤)
const getBooks = async (req, res) => {
  try {
    const { 
      page = 1, 
      pageSize = 20, 
      keyword = '', 
      contentType = '', 
      countType = '', 
      subjectId = '',
      sortBy = 'SortOrder', 
      sortOrder = 'ASC' 
    } = req.query;
    const offset = (page - 1) * pageSize;
    
    let baseQuery = 'FROM math_books b WHERE 1=1';
    const params = [];
    
    if (subjectId && subjectId !== '') {
      baseQuery = `FROM math_books b 
                   JOIN math_book_subjects mbs_filter ON b.BookID = mbs_filter.BookID 
                   WHERE mbs_filter.SubjectID = ?`;
      params.push(subjectId);
    }
    
    if (contentType && contentType !== '') {
      baseQuery += ' AND b.ContentType = ?';
      params.push(contentType);
    }

    if (countType && countType !== '') {
      baseQuery += ' AND b.CountType = ?';
      params.push(countType);
    }
    
    if (keyword) {
      baseQuery += ' AND (b.BookTitle LIKE ? OR b.BookID = ?)';
      params.push(`%${keyword}%`, keyword);
    }
    
    // 获取总数
    const [countRows] = await mysqlPool.query(`SELECT COUNT(DISTINCT b.BookID) as total ${baseQuery}`, params);
    const total = countRows[0].total;
    
    // 允许排序的字段
    const allowedSortFields = ['SortOrder', 'BookID', 'LearnerCount', 'CreationTimestamp'];
    const finalSortBy = allowedSortFields.includes(sortBy) ? `b.${sortBy}` : 'b.SortOrder';
    const finalSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    let sql = `
      SELECT b.*, (
        SELECT GROUP_CONCAT(SubjectID) 
        FROM math_book_subjects 
        WHERE BookID = b.BookID
      ) as SubjectIDs,
      (
        SELECT GROUP_CONCAT(ms.SubjectName SEPARATOR ', ') 
        FROM math_book_subjects mbs2
        JOIN math_subjects ms ON mbs2.SubjectID = ms.SubjectID
        WHERE mbs2.BookID = b.BookID
      ) as SubjectNames,
      (
        SELECT COUNT(*) 
        FROM math_bookquestions 
        WHERE BookID = b.BookID
      ) as QuestionCount
      ${baseQuery}
      ORDER BY ${finalSortBy} ${finalSortOrder}, b.BookID DESC 
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(pageSize), offset);
    
    const [books] = await mysqlPool.query(sql, params);
    
    // 格式化数据，将 SubjectIDs 转为数组
    const formattedBooks = books.map(book => ({
      ...book,
      SubjectIDs: book.SubjectIDs ? book.SubjectIDs.split(',').map(Number) : [],
      SubjectNames: book.SubjectNames || '',
      QuestionCount: parseInt(book.QuestionCount) || 0
    }));
    
    console.log('getBooks返回数据示例:', formattedBooks.slice(0, 2).map(b => ({ BookID: b.BookID, BookTitle: b.BookTitle, QuestionCount: b.QuestionCount })));
    
    res.json(successResponse({
      list: formattedBooks,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }));
  } catch (error) {
    console.error('获取管理端书籍列表失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 更新书籍
const updateBook = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { bookId } = req.params;
    const updateData = req.body;
    
    if (!bookId) {
      return res.status(400).json(errorResponse('书籍ID不能为空'));
    }
    
    await connection.beginTransaction();
    
    // 1. 更新 math_books 表
    const allowedFields = [
      'BookTitle', 'VersionInfo', 'LearnerCount', 
      'StyleType', 'IsNew', 'OverlayBannerText', 'ThumbnailText', 
      'ContentType', 'CountType', 'SortOrder', 'Description', 'UpdaterName'
    ];
    
    const updates = [];
    const params = [];
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(updateData[field]);
      }
    }
    
    if (updates.length > 0) {
      params.push(bookId);
      await connection.query(
        `UPDATE math_books SET ${updates.join(', ')} WHERE BookID = ?`,
        params
      );
    }
    
    // 2. 更新 math_book_subjects 关联表
    if (updateData.SubjectIDs && Array.isArray(updateData.SubjectIDs)) {
      // 先删除旧关联
      await connection.query('DELETE FROM math_book_subjects WHERE BookID = ?', [bookId]);
      
      // 插入新关联
      if (updateData.SubjectIDs.length > 0) {
        const values = updateData.SubjectIDs.map(subjectId => [bookId, subjectId]);
        await connection.query(
          'INSERT INTO math_book_subjects (BookID, SubjectID) VALUES ?',
          [values]
        );
      }
    }
    
    await connection.commit();
    res.json(successResponse({ message: '更新成功' }));
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('更新书籍失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  } finally {
    if (connection) connection.release();
  }
};

// 删除书籍
const deleteBook = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { bookId } = req.params;
    if (!bookId) {
      return res.status(400).json(errorResponse('书籍ID不能为空'));
    }
    
    await connection.beginTransaction();
    
    // 1. 删除书籍关联的题目链接 (不删除题目本身，除非是孤儿题目，这里暂不处理题目删除)
    await connection.query('DELETE FROM math_bookquestions WHERE BookID = ?', [bookId]);
    
    // 2. 从用户书架中移除
    await connection.query('DELETE FROM math_user_books WHERE BookID = ?', [bookId]);
    
    // 3. 删除科目关联
    await connection.query('DELETE FROM math_book_subjects WHERE BookID = ?', [bookId]);
    
    // 4. 删除书籍主表记录
    await connection.query('DELETE FROM math_books WHERE BookID = ?', [bookId]);
    
    await connection.commit();
    res.json(successResponse({ message: '书籍及其关联数据已成功删除' }));
  } catch (error) {
    await connection.rollback();
    console.error('删除书籍失败:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  } finally {
    connection.release();
  }
};

// 获取书籍下的题目列表
const getBookQuestions = async (req, res) => {
  try {
    const { bookId } = req.params;
    
    const [questions] = await mysqlPool.query(`
      SELECT q.*, 
        bq.Sort, bq.BookChapter, bq.QuestionPage, bq.QuestionSort, bq.ChapterSort,
        (SELECT GROUP_CONCAT(kp.KPTitle SEPARATOR ', ') FROM math_questiondetails qd JOIN math_knowledgepoints kp ON qd.LinkedKnowledgePointID = kp.KnowledgePointID WHERE qd.QuestionID = q.QuestionID) as KPTitles
      FROM math_questions q
      JOIN math_bookquestions bq ON q.QuestionID = bq.QuestionID
      WHERE bq.BookID = ?
      ORDER BY bq.Sort ASC
    `, [bookId]);
    
    res.json(successResponse(questions));
  } catch (error) {
    console.error('获取书籍题目列表失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 创建书籍
const createBook = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const bookData = req.body;
    
    if (!bookData.BookTitle) {
      return res.status(400).json(errorResponse('书籍标题不能为空'));
    }
    
    await connection.beginTransaction();
    
    // 生成唯一的 BookID（从 100001 开始）
    const [maxBookIdResult] = await connection.query('SELECT MAX(BookID) as maxId FROM math_books');
    const maxBookId = maxBookIdResult[0].maxId || 0;
    const newBookId = Math.max(maxBookId + 1, 100001);
    
    // 1. 插入 math_books 表
    const fields = [
      'BookTitle', 'VersionInfo', 'LearnerCount', 
      'StyleType', 'IsNew', 'OverlayBannerText', 'ThumbnailText', 
      'ContentType', 'CountType', 'SortOrder', 'Description', 'UpdaterName'
    ];
    
    const activeFields = ['BookID'];
    const values = [newBookId];
    const placeholders = ['?'];
    
    for (const field of fields) {
      if (bookData[field] !== undefined) {
        activeFields.push(field);
        values.push(bookData[field]);
        placeholders.push('?');
      }
    }
    
    // 添加 SubjectID 字段（使用第一个选中的科目）
    if (bookData.SubjectIDs && Array.isArray(bookData.SubjectIDs) && bookData.SubjectIDs.length > 0) {
      activeFields.push('SubjectID');
      values.push(bookData.SubjectIDs[0]);
      placeholders.push('?');
    }
    
    if (activeFields.length === 0) {
      return res.status(400).json(errorResponse('没有提供数据'));
    }
    
    const sql = `INSERT INTO math_books (${activeFields.join(', ')}) VALUES (${placeholders.join(', ')})`;
    await connection.query(sql, values);
    const bookId = newBookId;
    
    // 2. 插入 math_book_subjects 关联表
    if (bookData.SubjectIDs && Array.isArray(bookData.SubjectIDs) && bookData.SubjectIDs.length > 0) {
      const subjectValues = bookData.SubjectIDs.map(subjectId => [bookId, subjectId]);
      await connection.query(
        'INSERT INTO math_book_subjects (BookID, SubjectID) VALUES ?',
        [subjectValues]
      );
    }
    
    await connection.commit();
    res.json(successResponse({ 
      message: '创建成功', 
      bookId: bookId 
    }));
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('创建书籍失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  } finally {
    if (connection) connection.release();
  }
};

// 获取考点详情
const getKnowledgePointDetail = async (req, res) => {
  try {
    const { kpId } = req.params;
    const [rows] = await mysqlPool.query('SELECT * FROM math_knowledgepoints WHERE KnowledgePointID = ?', [kpId]);
    if (rows.length === 0) {
      return res.status(404).json(errorResponse('考点不存在'));
    }
    res.json(successResponse(rows[0]));
  } catch (error) {
    console.error('获取考点详情失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 更新考点内容
const updateKnowledgePoint = async (req, res) => {
  try {
    const { kpId } = req.params;
    const { KPTitle, KPContent, KPNotes, KPType } = req.body;
    await mysqlPool.query(
      'UPDATE math_knowledgepoints SET KPTitle = ?, KPContent = ?, KPNotes = ?, KPType = ? WHERE KnowledgePointID = ?',
      [KPTitle, KPContent, KPNotes, KPType, kpId]
    );
    res.json(successResponse(null, '考点更新成功'));
  } catch (error) {
    console.error('更新考点失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取所有考点列表（用于管理页面显示所有考点）
const getAllKnowledgePoints = async (req, res) => {
  try {
    // 添加分页支持，默认获取前500条，避免超时
    const limit = parseInt(req.query.limit) || 500;
    const offset = parseInt(req.query.offset) || 0;
    
    const [rows] = await mysqlPool.query(`
      SELECT 
        KnowledgePointID,
        KPTitle,
        KPContent,
        KPNotes,
        KPType,
        KPCode
      FROM math_knowledgepoints
      ORDER BY KnowledgePointID DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    
    // 简化：直接返回考点列表，题目数量通过单独API获取
    rows.forEach(kp => {
      kp.QuestionCount = 0; // 先设置为0，后续通过单独API获取
    });
    
    res.json(successResponse(rows));
  } catch (error) {
    console.error('获取所有考点失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 删除题目
const deleteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    
    const connection = await mysqlPool.getConnection();
    await connection.beginTransaction();
    
    try {
      // 1. 删除题目详情
      await connection.query('DELETE FROM math_questiondetails WHERE QuestionID = ?', [questionId]);
      
      // 2. 删除题目本身
      await connection.query('DELETE FROM math_questions WHERE QuestionID = ?', [questionId]);
      
      // 3. 删除相关的纠错记录 (可选，或者标记为已忽略)
      await connection.query('DELETE FROM math_corrections WHERE QuestionID = ?', [questionId]);
      
      await connection.commit();
      res.json(successResponse(null, '题目已永久删除'));
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('删除题目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 删除纠错记录
const deleteCorrection = async (req, res) => {
  try {
    const { id } = req.params;
    await mysqlPool.query('DELETE FROM math_corrections WHERE id = ?', [id]);
    res.json(successResponse(null, '反馈记录已删除'));
  } catch (error) {
    console.error('删除反馈记录失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 辅助函数：处理图片 URL
const preprocessImageUrl = (url) => {
  if (url && url.endsWith('_yjs')) {
    return url.substring(0, url.length - 4);
  }
  return url;
};

// 辅助函数：根据题目内容自动判断题型
const detectQuestionType = (text) => {
  if (!text) return '解答题';

  // 1. 选择题判断逻辑：必须同时出现 A 和 B 的选项标记，或者出现典型的 LaTeX 选项格式
  const hasA = /[A][\.\s\、\)\:]|\([A]\)|（[A]）|\\mathrm\{A\}|\\rm\{A\}/i.test(text);
  const hasB = /[B][\.\s\、\)\:]|\([B]\)|（[B]）|\\mathrm\{B\}|\\rm\{B\}/i.test(text);
  
  // 特殊的 LaTeX 选项占位符，如果出现也认为是选择题
  const hasOptionPlaceholder = /\(\s*\\quad\s*\\;\s*\\;\s*\)|\(\s*\\quad\s*\)|\(\s*\\qquad\s*\)|\(\s*\\;\s*\)/.test(text);

  if ((hasA && hasB) || hasOptionPlaceholder) {
    return '选择题';
  }

  // 2. 填空题判断逻辑：下划线、括号中间有空格等
  const fillRegex = /\\underline\{[\s\S]*?\}|\\underline\{\s*(?:\\;|\\quad|\\qquad|\s)+\s*\}|_{3,}|（\s*）|\(\s*\)/;
  if (fillRegex.test(text)) {
    return '填空题';
  }

  return '解答题';
};

// 批量导入题目
const importQuestions = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { questions, bookId } = req.body;
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json(errorResponse('无效的题目数据'));
    }

    await connection.beginTransaction();

    let successCount = 0;
    let failCount = 0;

    for (const q of questions) {
      try {
        const questionType = q.QuestionType || detectQuestionType(q.QuestionText);

        // 检查题目是否已存在，存在则跳过（不替换原有内容）
        const [existingQ] = await connection.query(
          'SELECT QuestionID FROM math_questions WHERE QuestionID = ?',
          [q.QuestionID]
        );

        if (existingQ.length > 0) {
          console.log(`Question ${q.QuestionID}: 已存在，跳过导入`);
          successCount++;
          continue;
        }

        await connection.query(
          `INSERT INTO math_questions (QuestionID, QuestionText, QuestionType, OriginalAnswerText, Difficulty, LinksCount, LinkNames) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [q.QuestionID, q.QuestionText, questionType, '', 0.5, q.LinksCount || null, q.LinkNames || null]
        );

        if (q.details && Array.isArray(q.details)) {
          for (const detail of q.details) {
            // 检查详情是否已存在
            const [existingD] = await connection.query(
              'SELECT ID FROM math_questiondetails WHERE QuestionID = ? AND BusType = ?',
              [q.QuestionID, detail.BusType || 'analysis']
            );
            if (existingD.length === 0) {
              await connection.query(
                `INSERT INTO math_questiondetails (QuestionID, BusType, Context, JsonData) 
                 VALUES (?, ?, ?, ?)`,
                [q.QuestionID, detail.BusType || 'analysis', detail.Context, JSON.stringify(detail.JsonData || {})]
              );
            }
          }
        }

        if (bookId) {
          const [maxSortRows] = await connection.query(
            'SELECT MAX(Sort) as maxSort FROM math_bookquestions WHERE BookID = ?',
            [bookId]
          );
          const nextSort = (maxSortRows[0].maxSort || 0) + 1;

          await connection.query(
            `INSERT IGNORE INTO math_bookquestions (BookID, QuestionID, Sort) 
             VALUES (?, ?, ?)`,
            [bookId, q.QuestionID, nextSort]
          );
        }

        if (q.LinksCount && q.LinkNames) {
          const result = await linkKnowledgePointsForQuestion(
            connection, q.QuestionID, q.LinksCount, q.LinkNames
          );
          if (result.matched > 0) {
            console.log(`题目 ${q.QuestionID}: 自动链接了 ${result.matched} 个考点`);
          }
        }

        successCount++;
      } catch (err) {
        console.error(`导入题目 ID ${q.QuestionID} 失败:`, err);
        failCount++;
      }
    }

    await connection.commit();
    res.json(successResponse({ 
      successCount, 
      failCount
    }));
  } catch (error) {
    await connection.rollback();
    console.error('批量导入失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  } finally {
    connection.release();
  }
};

// 复合导入 (映射 + 详情)
const importComplexQuestions = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { mapping, details, questions, config } = req.body;
    console.log('导入请求数据:', {
      hasMapping: !!mapping,
      mappingLength: mapping ? (Array.isArray(mapping) ? mapping.length : Object.keys(mapping).length) : 0,
      hasDetails: !!details,
      detailsLength: details ? Object.keys(details).length : 0,
      hasQuestions: !!questions,
      questionsLength: questions ? (Array.isArray(questions) ? questions.length : 0) : 0,
      config
    });
    if (!mapping && !details && !questions) {
      return res.status(400).json(errorResponse('缺少导入数据 (需要 mapping、questions 或 details)'));
    }

    await connection.beginTransaction();

    let mappingSuccessCount = 0;
    let mappingSkipCount = 0;
    let mappingFailCount = 0;
    let detailsSuccessCount = 0;
    let detailsSkipCount = 0;
    let detailsFailCount = 0;
    let questionsCreated = 0;
    let questionsSkipCount = 0;

    // --- 1. 处理映射文件 (处理书籍和基础关联) ---
    if (mapping) {
      console.log('开始处理映射数据...');
      // 映射文件通常是一个嵌套列表，外层是书籍，内层是该书的题目关联
      const booksMapping = Array.isArray(mapping[0]) ? mapping : [mapping];
      
      // 收集所有唯一的书籍
      const uniqueBooks = new Map();
      const uniqueQuestionIds = new Set();
      const bookQuestionLinks = [];

      for (const bookList of booksMapping) {
        if (!Array.isArray(bookList)) continue;
        for (const item of bookList) {
          const bid = item.BookID;
          const bname = item.BookName;
          const qid = item.QuestionID;
          const entryId = item.ID;

          if (bid && !uniqueBooks.has(bid)) {
            // 自动判断科目 ID
            let sid = (config && config.subjectId) || item.SubjectID;
            if (!sid) {
              if (bname && (bname.includes('数一') || bname.includes('数学一'))) sid = 1;
              else if (bname && (bname.includes('数二') || bname.includes('数学二'))) sid = 2;
              else if (bname && (bname.includes('数三') || bname.includes('数学三'))) sid = 3;
              else sid = 1;
            }

            // 使用传入的配置或原始数据
            const vInfo = (config && config.versionInfo) || item.VersionInfo || null;
            const cType = (config && config.contentType) || 'book';
            const isNew = (config && config.isNew !== undefined) ? (config.isNew ? 1 : 0) : (item.IsNew ? 1 : 0);

            uniqueBooks.set(bid, {
              BookID: bid,
              BookTitle: bname || `未命名书籍 ${bid}`,
              SubjectID: sid,
              VersionInfo: vInfo,
              ContentType: cType,
              LearnerCount: item.LearnerCount || 0,
              StyleType: item.StyleType || null,
              IsNew: isNew,
              OverlayBannerText: item.OverlayBannerText || null,
              ThumbnailText: item.ThumbnailText || (bname ? bname.substring(0, 20) : null)
            });
          }

          if (qid) {
            uniqueQuestionIds.add(qid);
            if (bid && entryId) {
              bookQuestionLinks.push({
                EntryID: entryId,
                BookID: bid,
                QuestionID: qid,
                QuestionPage: item.QuestionPage || null,
                QuestionSort: item.QuestionSort || null,
                Sort: item.Sort || 0,
                ChapterName: item.ChapterName || null,
                BookChapter: item.BookChapter || null,
                ChapterSort: item.ChapterSort || 0,
                QuestionImg: preprocessImageUrl(item.QuestionImg)
              });
            }
          }
        }
      }

      // A. 批量插入/更新书籍
      for (const book of uniqueBooks.values()) {
        await connection.query(
          `INSERT INTO math_books (
            BookID, BookTitle, SubjectID, VersionInfo, ContentType, LearnerCount, 
            StyleType, IsNew, OverlayBannerText, ThumbnailText
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          BookTitle = VALUES(BookTitle), SubjectID = VALUES(SubjectID), 
          VersionInfo = VALUES(VersionInfo), ContentType = VALUES(ContentType),
          LearnerCount = VALUES(LearnerCount), StyleType = VALUES(StyleType), 
          IsNew = VALUES(IsNew), OverlayBannerText = VALUES(OverlayBannerText), 
          ThumbnailText = VALUES(ThumbnailText)`,
          [
            book.BookID, book.BookTitle, book.SubjectID, book.VersionInfo, book.ContentType, 
            book.LearnerCount, book.StyleType, book.IsNew, book.OverlayBannerText, book.ThumbnailText
          ]
        );
      }

      // B. 预先确保题目主表中有这些 ID
      if (uniqueQuestionIds.size > 0) {
        const qidArray = Array.from(uniqueQuestionIds);
        for (const qid of qidArray) {
          await connection.query(
            'INSERT IGNORE INTO math_questions (QuestionID, QuestionText) VALUES (?, NULL)',
            [qid]
          );
        }
      }

      // C. 批量插入书籍题目关联（跳过已存在的）
      for (const link of bookQuestionLinks) {
        try {
          const [existing] = await connection.query(
            'SELECT EntryID FROM math_bookquestions WHERE EntryID = ?',
            [link.EntryID]
          );
          if (existing.length === 0) {
            await connection.query(
              `INSERT INTO math_bookquestions (
                EntryID, BookID, QuestionID, QuestionPage, QuestionSort, 
                Sort, ChapterName, BookChapter, ChapterSort, QuestionImg
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                link.EntryID, link.BookID, link.QuestionID, link.QuestionPage, link.QuestionSort,
                link.Sort, link.ChapterName, link.BookChapter, link.ChapterSort, link.QuestionImg
              ]
            );
            mappingSuccessCount++;
          } else {
            mappingSkipCount++;
          }
        } catch (err) {
          console.error(`映射记录 EntryID ${link.EntryID} 导入失败:`, err);
          mappingFailCount++;
        }
      }
      console.log(`映射数据处理完成: 成功 ${mappingSuccessCount}, 跳过 ${mappingSkipCount}, 失败 ${mappingFailCount}`);
    }

    // --- 2. 处理题目文件 (直接导入题目基础数据) ---
    if (questions && Array.isArray(questions)) {
      console.log('开始处理题目数据...', questions.length, '道题目');
      console.log('第一道题:', questions[0]);
      for (const q of questions) {
        try {
          // 支持两种字段名格式
          const qid = q.QuestionID || q.ID;
          if (!qid) {
            console.log('跳过无ID题目:', q);
            continue;
          }

          const qText = q.QuestionText || q.QuestionTxt || '';
          const qType = q.QuestionType || detectQuestionType(qText);
          const originalAnswer = q.OriginalAnswerText || q.AnswerText || q.AnswerTxt || '';
          const difficulty = q.Difficulty || 0.5;
          const linksCount = q.LinksCount || null;
          const linkNames = q.LinkNames || null;

          console.log('准备插入题目:', qid, '内容长度:', qText.length);
          // 先检查题目是否已存在，已存在则跳过以避免覆盖修改
          const [existingQ] = await connection.query(
            'SELECT QuestionID FROM math_questions WHERE QuestionID = ?',
            [qid]
          );
          if (existingQ.length === 0) {
            await connection.query(
              `INSERT INTO math_questions (
                QuestionID, QuestionText, QuestionType, OriginalAnswerText, 
                Difficulty, LinksCount, LinkNames
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [qid, qText, qType, originalAnswer, difficulty, linksCount, linkNames]
            );
            questionsCreated++;
          } else {
            questionsSkipCount++;
          }
        } catch (err) {
          console.error(`题目 ${q.QuestionID} 导入失败:`, err);
        }
      }
      console.log(`题目数据处理完成: 创建 ${questionsCreated}, 跳过 ${questionsSkipCount}`);
    }

    // --- 3. 处理详情文件 (处理题目详情、考点、关联题目) ---
    if (details) {
      console.log('开始处理详情数据...');
      for (const qidStr in details) {
        const qid = parseInt(qidStr);
        if (isNaN(qid)) continue;

        try {
          const qContent = details[qidStr];
          let detailCount = 0;
          
          // 支持两种格式：
          // 1. 旧格式：{ first_request: [...], second_request: [...], third_request: [...] }
          // 2. 新格式：[ { BusType: '考点', ... }, { BusType: '题目详解', ... } ]
          
          if (Array.isArray(qContent)) {
            // 新格式：直接是数组
            for (const item of qContent) {
              if (typeof item === 'string' || !item.ID) continue;
              
              // 处理考点 (BusType为"考点"且包含_question_code)
              if (item.BusType === '考点' && item._question_code && item._question_code.Code) {
                const qc = item._question_code;
                await connection.query(
                  `INSERT IGNORE INTO math_knowledgepoints (
                    KPCode, KPTitle, KPContent, KPType, KPBusType, KPPCode, KPNotes, KPOutlineType, KPDifficultyType
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    qc.Code, qc.Title || `KP ${qc.Code}`, qc.Content || null, qc.Type || null,
                    qc.BusType || null, qc.PCode || null, qc.Notes || null, 
                    qc.OutlineType || null, qc.DifficultyType || null
                  ]
                );
              }
              
              // 处理详情记录（先检查是否已存在）
              const [existingDetail] = await connection.query(
                'SELECT ID FROM math_questiondetails WHERE QuestionID = ? AND SourceDetailID = ?',
                [qid, item.ID]
              );
              if (existingDetail.length === 0) {
                await connection.query(
                  `INSERT INTO math_questiondetails (
                    QuestionID, BusType, SourceDetailID, Context, Give, Notes, JsonData, Title, IsProductBook, LinkedKnowledgePointID
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    qid, 
                    item.BusType || 'analysis', 
                    item.ID, 
                    item.Context || null,
                    item.Give || 0, 
                    item.Notes || null, 
                    item.Json ? JSON.stringify(item.Json) : null,
                    item.Title || null, 
                    item.IsProductBook ? 1 : 0, 
                    null
                  ]
                );
                detailCount++;
              } else {
                detailsSkipCount++;
              }
            }
          } else {
            // 旧格式处理（保留原有逻辑）
            if (qContent.second_request) {
              const secondReq = Array.isArray(qContent.second_request) ? qContent.second_request : [qContent.second_request];
              for (const srItem of secondReq) {
                if (typeof srItem === 'string' || !srItem.ID) continue;
                
                if (srItem._question_code && srItem._question_code.Code) {
                  const qc = srItem._question_code;
                  await connection.query(
                  `INSERT IGNORE INTO math_knowledgepoints (
                    KPCode, KPTitle, KPContent, KPType, KPBusType, KPPCode, KPNotes, KPOutlineType, KPDifficultyType
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    qc.Code, qc.Title || `KP ${qc.Code}`, qc.Content || null, qc.Type || null,
                    qc.BusType || null, qc.PCode || null, qc.Notes || null, 
                    qc.OutlineType || null, qc.DifficultyType || null
                  ]
                );
                }
                
                // 处理详情记录（先检查是否已存在）
                const [existingOldDetail] = await connection.query(
                  'SELECT ID FROM math_questiondetails WHERE QuestionID = ? AND SourceDetailID = ?',
                  [qid, srItem.ID]
                );
                if (existingOldDetail.length === 0) {
                  await connection.query(
                    `INSERT INTO math_questiondetails (
                      QuestionID, BusType, SourceDetailID, Context, Give, Notes, JsonData, Title, IsProductBook, LinkedKnowledgePointID
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                      qid, srItem.BusType || 'analysis', srItem.ID, srItem.Context || null,
                      srItem.Give || 0, srItem.Notes || null, 
                      srItem.Json ? JSON.stringify(srItem.Json) : null,
                      srItem.Title || null, srItem.IsProductBook ? 1 : 0, null
                    ]
                  );
                  detailCount++;
                } else {
                  detailsSkipCount++;
                }
              }
            }
          }
          
          if (detailCount > 0) {
            detailsSuccessCount++;
          }
        } catch (err) {
          console.error(`导入题目 ID ${qidStr} 详情失败:`, err);
          detailsFailCount++;
        }
      }
      console.log(`详情数据处理完成: 成功 ${detailsSuccessCount}, 跳过 ${detailsSkipCount}, 失败 ${detailsFailCount}`);
    }

    await connection.commit();
    res.json(successResponse({ 
      mappingSuccessCount, 
      mappingSkipCount,
      mappingFailCount, 
      questionsCreated,
      questionsSkipCount,
      detailsSuccessCount, 
      detailsSkipCount,
      detailsFailCount 
    }));
  } catch (error) {
    await connection.rollback();
    console.error('复合导入失败:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  } finally {
    connection.release();
  }
};


// 创建科目
const createSubject = async (req, res) => {
  try {
    const { SubjectName, description } = req.body;
    if (!SubjectName) {
      return res.status(400).json(errorResponse('科目名称不能为空'));
    }
    
    const [result] = await mysqlPool.query(
      'INSERT INTO math_subjects (SubjectName, description) VALUES (?, ?)',
      [SubjectName, description || null]
    );
    
    res.json(successResponse({ SubjectID: result.insertId }, '科目创建成功'));
  } catch (error) {
    console.error('创建科目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 更新科目
const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { SubjectName, description } = req.body;
    
    await mysqlPool.query(
      'UPDATE math_subjects SET SubjectName = ?, description = ? WHERE SubjectID = ?',
      [SubjectName, description || null, id]
    );
    
    res.json(successResponse(null, '科目更新成功'));
  } catch (error) {
    console.error('更新科目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 删除科目
const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    await mysqlPool.query('DELETE FROM math_subjects WHERE SubjectID = ?', [id]);
    res.json(successResponse(null, '科目删除成功'));
  } catch (error) {
    console.error('删除科目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 管理员搜索题目
const adminSearchQuestions = async (req, res) => {
  try {
    const { keyword, subjectId, questionType, categoryId, categoryIds, selectMode, difficulty, year, contentType, page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let baseQuery = 'FROM math_questions q WHERE 1=1';
    const params = [];
    
    // 知识点分类筛选 - 支持多选
    const categoryIdsList = categoryIds ? categoryIds.split(',').map(Number) : (categoryId ? [parseInt(categoryId)] : []);
    
    if (categoryIdsList.length > 0) {
      // 检查是否包含"未分类"（id = -1）
      const hasUnclassified = categoryIdsList.includes(-1);
      const regularCatIds = categoryIdsList.filter(id => id !== -1);
      
      const kpConditionsArray = [];
      
      if (hasUnclassified) {
        kpConditionsArray.push(`NOT EXISTS (SELECT 1 FROM math_questiondetails qd WHERE qd.QuestionID = q.QuestionID AND qd.LinkedKnowledgePointID IS NOT NULL)`);
      }
      
      if (regularCatIds.length > 0) {
        const allKpNames = [];
        
        for (const catId of regularCatIds) {
          const [categories] = await mysqlPool.query(
            'SELECT * FROM math_knowledge_categories WHERE id = ?',
            [catId]
          );
          
          if (categories.length > 0) {
            const category = categories[0];
            const level = category.CategoryCode.split('-').length;
            let kpNames = [];
            
            if (level === 4) {
              kpNames = [category.CategoryName];
            } else if (level === 3) {
              kpNames = [category.CategoryName];
              const [childCategories] = await mysqlPool.query(
                `SELECT CategoryName FROM math_knowledge_categories WHERE CategoryCode LIKE ?`,
                [`${category.CategoryCode}-%`]
              );
              childCategories.forEach(c => kpNames.push(c.CategoryName));
            } else {
              const [childCategories] = await mysqlPool.query(
                `SELECT CategoryName, CategoryCode FROM math_knowledge_categories WHERE CategoryCode LIKE ?`,
                [`${category.CategoryCode}%`]
              );
              kpNames = childCategories
                .filter(c => {
                  const childLevel = c.CategoryCode.split('-').length;
                  return childLevel >= 3 && childLevel <= 4;
                })
                .map(c => c.CategoryName);
            }
            
            allKpNames.push(...kpNames);
          }
        }
        
        if (allKpNames.length > 0) {
          const uniqueKpNames = [...new Set(allKpNames)];
          const kpConditions = uniqueKpNames.map(() => 'KPTitle LIKE ?').join(' OR ');
          const [kps] = await mysqlPool.query(
            `SELECT KnowledgePointID FROM math_knowledgepoints WHERE ${kpConditions}`,
            uniqueKpNames.map(name => `%${name}%`)
          );
          
          if (kps.length > 0) {
            const kpIds = kps.map(kp => kp.KnowledgePointID);
            if (selectMode === 'intersection' && regularCatIds.length > 1) {
              for (const kpId of kpIds) {
                kpConditionsArray.push(`EXISTS (SELECT 1 FROM math_questiondetails qd WHERE qd.QuestionID = q.QuestionID AND qd.LinkedKnowledgePointID = ${kpId})`);
              }
            } else {
              kpConditionsArray.push(`EXISTS (SELECT 1 FROM math_questiondetails qd WHERE qd.QuestionID = q.QuestionID AND qd.LinkedKnowledgePointID IN (${kpIds.join(',')}))`);
            }
          } else {
            const conditions = uniqueKpNames.map(() => 'q.LinkNames LIKE ?').join(' OR ');
            const values = uniqueKpNames.map(name => `%${name}%`);
            kpConditionsArray.push(`(${conditions})`);
            params.push(...values);
          }
        }
      }
      
      if (kpConditionsArray.length > 0) {
        baseQuery += ' AND (' + kpConditionsArray.join(' OR ') + ')';
      }
    }
    
    if (keyword) {
      baseQuery += ' AND (q.QuestionText LIKE ? OR q.QuestionID = ?)';
      params.push(`%${keyword}%`, keyword);
    }
    
    if (subjectId) {
      baseQuery += ' AND EXISTS (SELECT 1 FROM math_bookquestions bq JOIN math_book_subjects bs ON bq.BookID = bs.BookID WHERE bq.QuestionID = q.QuestionID AND bs.SubjectID = ?)';
      params.push(subjectId);
    }
    
    if (questionType) {
      if (questionType === '单选题') {
        baseQuery += " AND (q.QuestionType = '选择题' OR q.QuestionType = '单选题')";
      } else {
        baseQuery += ' AND q.QuestionType = ?';
        params.push(questionType);
      }
    }
    
    if (difficulty) {
      const diffVal = parseFloat(difficulty);
      baseQuery += ' AND q.Difficulty >= ? AND q.Difficulty <= ?';
      params.push(diffVal - 0.15, diffVal + 0.15);
    }
    
    if (year) {
      if (year === 'older') {
        baseQuery += ` AND EXISTS (SELECT 1 FROM math_bookquestions bq_year JOIN math_books b_year ON bq_year.BookID = b_year.BookID WHERE bq_year.QuestionID = q.QuestionID AND (b_year.VersionInfo LIKE '%2021%' OR b_year.VersionInfo LIKE '%2020%' OR b_year.VersionInfo LIKE '%2019%' OR (b_year.VersionInfo IS NOT NULL AND b_year.VersionInfo REGEXP '^(19|20[0-1][0-9])')))`;
      } else {
        baseQuery += ` AND EXISTS (SELECT 1 FROM math_bookquestions bq_year JOIN math_books b_year ON bq_year.BookID = b_year.BookID WHERE bq_year.QuestionID = q.QuestionID AND (b_year.VersionInfo LIKE ? OR b_year.ShortTitle LIKE ?))`;
        params.push(`%${year}%`, `%${year}%`);
      }
    }
    
    if (contentType) {
      baseQuery += ` AND EXISTS (SELECT 1 FROM math_bookquestions bq_filter JOIN math_books b_filter ON bq_filter.BookID = b_filter.BookID WHERE bq_filter.QuestionID = q.QuestionID AND b_filter.ContentType = ?)`;
      params.push(contentType);
    }
    
    // 获取总数
    const [countRows] = await mysqlPool.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
    const total = countRows[0].total;
    
    // 获取数据
    const shortTitleSub = `(SELECT b.ShortTitle FROM math_books b JOIN math_bookquestions bq ON b.BookID = bq.BookID WHERE bq.QuestionID = q.QuestionID LIMIT 1)`;
    const contentTypeSub = `(SELECT b.ContentType FROM math_books b JOIN math_bookquestions bq ON b.BookID = bq.BookID WHERE bq.QuestionID = q.QuestionID LIMIT 1)`;
    const bookIdSub = `(SELECT bq.BookID FROM math_bookquestions bq WHERE bq.QuestionID = q.QuestionID LIMIT 1)`;
    const kpNamesSub = `(SELECT GROUP_CONCAT(kp.KPTitle SEPARATOR ', ') FROM math_questiondetails qd JOIN math_knowledgepoints kp ON qd.LinkedKnowledgePointID = kp.KnowledgePointID WHERE qd.QuestionID = q.QuestionID)`;
    const dataQuery = `SELECT q.*, ${shortTitleSub} as ShortTitle, ${contentTypeSub} as ContentType, ${bookIdSub} as BookID, ${kpNamesSub} as KPTitles ${baseQuery} ORDER BY q.QuestionID DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(pageSize), offset);
    
    const [rows] = await mysqlPool.query(dataQuery, params);
    
    // 为每个题目添加 analysis 字段
    const list = rows.map(q => ({
      ...q,
      analysis: q.OriginalAnswerText || q.analysis || ''
    }));
    
    res.json(successResponse({
      list,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }));
  } catch (error) {
    console.error('搜索题目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 添加题目到书籍
const addQuestionsToBook = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { bookId } = req.params;
    const { questionIds, chapterName } = req.body;
    
    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json(errorResponse('请提供题目ID列表'));
    }
    
    await connection.beginTransaction();
    
    // 获取当前书籍的最大排序号
    const [maxSortRows] = await connection.query(
      'SELECT MAX(Sort) as maxSort FROM math_bookquestions WHERE BookID = ?',
      [bookId]
    );
    let nextSort = (maxSortRows[0].maxSort || 0) + 1;
    
    // 如果指定了章节，获取该章节的最大章节排序号
    let chapterSort = 0;
    if (chapterName) {
      const [maxChapterSortRows] = await connection.query(
        'SELECT MAX(ChapterSort) as maxSort FROM math_bookquestions WHERE BookID = ? AND BookChapter = ?',
        [bookId, chapterName]
      );
      chapterSort = maxChapterSortRows[0].maxSort || 0;
    }
    
    // 获取最大EntryID
    const [maxEntryResult] = await connection.query(
      'SELECT MAX(EntryID) as maxEntry FROM math_bookquestions'
    );
    let nextEntryId = (maxEntryResult[0].maxEntry || 0) + 1;

    for (const questionId of questionIds) {
      if (chapterName) {
        // 指定了章节，使用INSERT IGNORE避免重复
        await connection.query(
          `INSERT INTO math_bookquestions (EntryID, BookID, QuestionID, Sort, BookChapter, ChapterSort) 
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE BookChapter = ?, ChapterSort = ?`,
          [nextEntryId++, bookId, questionId, nextSort++, chapterName, chapterSort, chapterName, chapterSort]
        );
      } else {
        await connection.query(
          'INSERT IGNORE INTO math_bookquestions (EntryID, BookID, QuestionID, Sort) VALUES (?, ?, ?, ?)',
          [nextEntryId++, bookId, questionId, nextSort++]
        );
      }
    }
    
    await connection.commit();
    res.json(successResponse(null, '题目添加成功'));
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('添加题目到书籍失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  } finally {
    if (connection) connection.release();
  }
};

// 获取书籍章节列表
const getBookChapters = async (req, res) => {
  try {
    const { bookId } = req.params;
    
    const [chapters] = await mysqlPool.query(
      `SELECT 
         bq.BookChapter as name, 
         COUNT(*) as questionCount 
       FROM math_bookquestions bq
       WHERE bq.BookID = ? AND bq.BookChapter IS NOT NULL
       GROUP BY bq.BookChapter 
       ORDER BY MIN(bq.ChapterSort) ASC, bq.BookChapter ASC`,
      [bookId]
    );
    
    res.json(successResponse(chapters));
  } catch (error) {
    console.error('获取书籍章节列表失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 添加章节（创建一个占位题目来标识章节存在）
const addBookChapter = async (req, res) => {
  try {
    const { bookId } = req.params;
    const { chapterName } = req.body;
    
    if (!chapterName) {
      return res.status(400).json(errorResponse('章节名称不能为空'));
    }
    
    // 检查章节是否已存在
    const [existing] = await mysqlPool.query(
      'SELECT COUNT(*) as count FROM math_bookquestions WHERE BookID = ? AND BookChapter = ?',
      [bookId, chapterName]
    );
    
    if (existing[0].count > 0) {
      return res.status(400).json(errorResponse('该章节已存在'));
    }
    
    // 获取最大章节排序号
    const [maxSortRows] = await mysqlPool.query(
      'SELECT MAX(ChapterSort) as maxSort FROM math_bookquestions WHERE BookID = ?',
      [bookId]
    );
    const chapterSort = (maxSortRows[0].maxSort || 0) + 1;
    
    // 获取最大Sort值
    const [maxSort] = await mysqlPool.query(
      'SELECT MAX(Sort) as maxSort FROM math_bookquestions WHERE BookID = ?',
      [bookId]
    );
    const nextSort = (maxSort[0].maxSort || 0) + 1;
    
    // 获取最大EntryID
    const [maxEntryResult] = await mysqlPool.query(
      'SELECT MAX(EntryID) as maxEntry FROM math_bookquestions'
    );
    const placeholderEntryId = (maxEntryResult[0].maxEntry || 0) + 1;
    
    // 先创建一个占位题目到math_questions表
    // 使用一个特殊的QuestionID（负数）来标识占位题
    const [maxQuestionResult] = await mysqlPool.query(
      'SELECT MIN(QuestionID) as minQuestionID FROM math_questions'
    );
    const placeholderQuestionId = Math.min((maxQuestionResult[0].minQuestionID || 0) - 1, -1000000);
    
    await mysqlPool.query(
      `INSERT INTO math_questions (QuestionID, QuestionText, QuestionType, Difficulty) 
       VALUES (?, ?, '占位题', 0)`,
      [placeholderQuestionId, `[章节占位] ${chapterName}`]
    );
    
    // 创建math_bookquestions关联记录
    await mysqlPool.query(
      `INSERT INTO math_bookquestions 
       (EntryID, BookID, QuestionID, Sort, BookChapter, ChapterSort, QuestionSort) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [placeholderEntryId, bookId, placeholderQuestionId, nextSort, chapterName, chapterSort, '0']
    );
    
    res.json(successResponse({ chapterName, chapterSort }, '章节添加成功'));
  } catch (error) {
    console.error('添加章节失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 更新章节名称
const updateBookChapter = async (req, res) => {
  try {
    const { bookId, chapterName } = req.params;
    const { newName } = req.body;
    
    if (!newName) {
      return res.status(400).json(errorResponse('新章节名称不能为空'));
    }
    
    await mysqlPool.query(
      'UPDATE math_bookquestions SET BookChapter = ? WHERE BookID = ? AND BookChapter = ?',
      [newName, bookId, chapterName]
    );
    
    res.json(successResponse(null, '章节名称更新成功'));
  } catch (error) {
    console.error('更新章节名称失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 删除章节（删除该章节下的所有题目关联）
const deleteBookChapter = async (req, res) => {
  try {
    const { bookId, chapterName } = req.params;
    
    await mysqlPool.query(
      'DELETE FROM math_bookquestions WHERE BookID = ? AND BookChapter = ?',
      [bookId, chapterName]
    );
    
    res.json(successResponse(null, '章节删除成功'));
  } catch (error) {
    console.error('删除章节失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取章节题目列表
const getBookChapterQuestions = async (req, res) => {
  try {
    const { bookId, chapterName } = req.params;
    
    const [questions] = await mysqlPool.query(
      `SELECT bq.*, q.QuestionText, q.QuestionType, q.Difficulty
       FROM math_bookquestions bq
       JOIN math_questions q ON bq.QuestionID = q.QuestionID
       WHERE bq.BookID = ? AND bq.BookChapter = ?
       ORDER BY bq.QuestionSort ASC, bq.Sort ASC`,
      [bookId, chapterName]
    );
    
    res.json(successResponse(questions));
  } catch (error) {
    console.error('获取章节题目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 更新书籍题目信息
const updateBookQuestion = async (req, res) => {
  try {
    const { bookId, questionId } = req.params;
    const { BookChapter, QuestionPage, QuestionSort, ChapterSort } = req.body;
    
    const updates = [];
    const params = [];
    
    if (BookChapter !== undefined) {
      updates.push('BookChapter = ?');
      params.push(BookChapter);
    }
    if (QuestionPage !== undefined) {
      updates.push('QuestionPage = ?');
      params.push(QuestionPage);
    }
    if (QuestionSort !== undefined) {
      updates.push('QuestionSort = ?');
      params.push(QuestionSort);
    }
    if (ChapterSort !== undefined) {
      updates.push('ChapterSort = ?');
      params.push(ChapterSort);
    }
    
    if (updates.length === 0) {
      return res.status(400).json(errorResponse('没有要更新的字段'));
    }
    
    params.push(bookId, questionId);
    
    await mysqlPool.query(
      `UPDATE math_bookquestions SET ${updates.join(', ')} WHERE BookID = ? AND QuestionID = ?`,
      params
    );
    
    res.json(successResponse(null, '更新成功'));
  } catch (error) {
    console.error('更新书籍题目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 删除书籍题目
const deleteBookQuestion = async (req, res) => {
  try {
    const { bookId, questionId } = req.params;
    
    await mysqlPool.query(
      'DELETE FROM math_bookquestions WHERE BookID = ? AND QuestionID = ?',
      [bookId, questionId]
    );
    
    res.json(successResponse(null, '删除成功'));
  } catch (error) {
    console.error('删除书籍题目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 批量删除书籍题目
const batchDeleteBookQuestions = async (req, res) => {
  try {
    const { bookId } = req.params;
    const { questionIds } = req.body;
    
    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json(errorResponse('请提供题目ID列表'));
    }
    
    await mysqlPool.query(
      'DELETE FROM math_bookquestions WHERE BookID = ? AND QuestionID IN (?)',
      [bookId, questionIds]
    );
    
    res.json(successResponse(null, '批量删除成功'));
  } catch (error) {
    console.error('批量删除书籍题目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 保存相关题关系
const saveRelatedQuestions = async (req, res) => {
  const { questionId, relatedIds } = req.body;
  
  if (!questionId || !relatedIds || !Array.isArray(relatedIds)) {
    return res.status(400).json(errorResponse('参数错误：需要 questionId 和 relatedIds 数组'));
  }
  
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    
    // 查询该题目已存在的相关题关系
    const [existingRelations] = await connection.query(
      'SELECT RelatedQuestionID FROM math_relatedquestions WHERE SourceQuestionID = ?',
      [parseInt(questionId)]
    );
    const existingRelatedIds = new Set(existingRelations.map(r => r.RelatedQuestionID));
    
    // 插入新的相关题关系（只插入不存在的）
    let insertedCount = 0;
    let skippedCount = 0;
    for (const relatedId of relatedIds) {
      if (!relatedId) continue;
      
      const relatedIdInt = parseInt(relatedId);
      
      // 如果关系已存在，跳过
      if (existingRelatedIds.has(relatedIdInt)) {
        skippedCount++;
        continue;
      }
      
      try {
        await connection.query(
          `INSERT INTO math_relatedquestions (SourceQuestionID, RelatedQuestionID) VALUES (?, ?)`,
          [parseInt(questionId), relatedIdInt]
        );
        insertedCount++;
      } catch (err) {
        // 忽略重复键错误
        if (err.code !== 'ER_DUP_ENTRY') {
          throw err;
        }
        skippedCount++;
      }
    }
    
    await connection.commit();
    res.json(successResponse({ 
      questionId, 
      relatedCount: insertedCount,
      skippedCount: skippedCount
    }, `相关题关系保存成功，新增 ${insertedCount} 条，跳过 ${skippedCount} 条已存在`));
  } catch (error) {
    await connection.rollback();
    console.error('保存相关题关系失败:', error);
    res.status(500).json(errorResponse('保存相关题关系失败: ' + error.message));
  } finally {
    connection.release();
  }
};

const importFromFiles = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { structData, questionsData, detailsData, subjectId, contentType } = req.body;
    
    console.log('导入数据:', {
      structDataCount: structData ? (Array.isArray(structData) ? structData.length : 'not array') : 0,
      questionsDataCount: questionsData ? (Array.isArray(questionsData) ? questionsData.length : 'not array') : 0,
      detailsDataCount: detailsData ? Object.keys(detailsData).length : 0,
      subjectId,
      contentType
    });
    
    if (!structData && !questionsData) {
      return res.status(400).json(errorResponse('至少需要提供结构数据或题目数据'));
    }
    
    await connection.beginTransaction();
    
    const stats = {
      booksCreated: 0,
      questionsCreated: 0,
      questionsUpdated: 0,
      detailsCreated: 0,
      linksCreated: 0,
      errors: []
    };
    
    const bookMap = new Map();
    const questionIdSet = new Set();
    
    if (structData && Array.isArray(structData)) {
      const flatStruct = structData.flat ? structData.flat() : structData;
      
      for (const item of flatStruct) {
        if (!item.BookID || !item.QuestionID) continue;
        
        const bookId = parseInt(item.BookID);
        const questionId = parseInt(item.QuestionID);
        if (isNaN(bookId) || isNaN(questionId)) {
          console.log(`Struct: 无效的BookID ${item.BookID} 或 QuestionID ${item.QuestionID}`);
          continue;
        }
        questionIdSet.add(questionId);
        
        if (!bookMap.has(bookId)) {
          bookMap.set(bookId, {
            BookID: bookId,
            BookTitle: item.BookName || `书籍${bookId}`,
            questions: []
          });
        }
        
        bookMap.get(bookId).questions.push({
          EntryID: item.ID,
          QuestionID: questionId,
          QuestionPage: item.QuestionPage,
          QuestionSort: item.QuestionSort,
          Sort: item.Sort,
          ChapterName: item.ChapterName,
          BookChapter: item.BookChapter,
          ChapterSort: item.ChapterSort,
          QuestionImg: preprocessImageUrl(item.QuestionImg)
        });
      }
      
      for (const [bookId, book] of bookMap) {
        const [existingBook] = await connection.query(
          'SELECT BookID FROM math_books WHERE BookID = ?',
          [bookId]
        );
        
        if (existingBook.length === 0) {
          await connection.query(
            `INSERT INTO math_books (BookID, BookTitle, SubjectID, ContentType) VALUES (?, ?, ?, ?)`,
            [bookId, book.BookTitle, subjectId || 1, contentType || 'book']
          );
          stats.booksCreated++;
          
          if (subjectId) {
            await connection.query(
              'INSERT IGNORE INTO math_book_subjects (BookID, SubjectID) VALUES (?, ?)',
              [bookId, subjectId]
            );
          }
        }
        
        for (const q of book.questions) {
          try {
            // 检查关联是否已存在
            const [existingLink] = await connection.query(
              'SELECT EntryID FROM math_bookquestions WHERE EntryID = ?',
              [q.EntryID]
            );
            
            if (existingLink.length === 0) {
              await connection.query(
                `INSERT INTO math_bookquestions (
                  EntryID, BookID, QuestionID, QuestionPage, QuestionSort, 
                  Sort, ChapterName, BookChapter, ChapterSort, QuestionImg
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [q.EntryID, bookId, q.QuestionID, q.QuestionPage, q.QuestionSort,
                 q.Sort, q.ChapterName, q.BookChapter, q.ChapterSort, q.QuestionImg]
              );
              stats.linksCreated++;
            } else {
              // 关联已存在，跳过
              console.log(`Link EntryID ${q.EntryID}: 已存在，跳过导入`);
            }
          } catch (err) {
            stats.errors.push(`Link EntryID ${q.EntryID}: ${err.message}`);
          }
        }
      }
    }
    
    if (questionsData && Array.isArray(questionsData)) {
      console.log(`开始处理 ${questionsData.length} 道题目`);
      for (const q of questionsData) {
        if (!q.ID) {
          console.log('Question: 跳过没有ID的题目');
          continue;
        }
        
        const questionId = parseInt(q.ID);
        if (isNaN(questionId)) {
          console.log(`Question: 无效的ID ${q.ID}`);
          continue;
        }
        questionIdSet.add(questionId);
        
        const questionType = q.QuestionType || detectQuestionType(q.QuestionTxt);
        
        try {
          const [existing] = await connection.query(
            'SELECT QuestionID FROM math_questions WHERE QuestionID = ?',
            [questionId]
          );
          
          if (existing.length === 0) {
            console.log(`Question ${questionId}: 准备插入新题目`);
            await connection.query(
              `INSERT INTO math_questions (
                QuestionID, QuestionText, QuestionImg, QuestionType, 
                OriginalAnswerText, Difficulty, LinksCount, LinkNames
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [questionId, q.QuestionTxt || '', q.QuestionImg || null, questionType,
               q.AnswerTxt || '', 0.5, q.LinksCount || '', q.LinkNames || '']
            );
            stats.questionsCreated++;
            console.log(`Question ${questionId}: 插入成功`);
          } else {
            // 题目已存在，跳过不更新
            console.log(`Question ${questionId}: 已存在，跳过导入`);
            stats.errors.push(`Question ${questionId}: 已存在，跳过导入`);
          }
        } catch (err) {
          console.error(`Question ${questionId}: 插入失败 - ${err.message}`);
          stats.errors.push(`Question ${questionId}: ${err.message}`);
        }
      }
    }
    
    if (detailsData && typeof detailsData === 'object') {
      const allDetailKeys = Object.keys(detailsData);
      console.log(`详情数据: 共 ${allDetailKeys.length} 个题目的详情`);
      console.log(`详情数据keys: ${allDetailKeys.slice(0, 10).join(', ')}...`);
      console.log(`questionIdSet: ${Array.from(questionIdSet).slice(0, 10).join(', ')}...`);
      
      for (const questionIdStr in detailsData) {
        const questionId = parseInt(questionIdStr);
        if (isNaN(questionId)) {
          console.log(`Detail: 无效的questionId ${questionIdStr}`);
          continue;
        }
        
        // 只处理本次导入的题目相关的详情
        if (!questionIdSet.has(questionId)) {
          console.log(`Detail Q${questionId}: 不在本次导入的题目列表中，跳过`);
          continue;
        }
        
        const details = detailsData[questionIdStr];
        if (!Array.isArray(details)) {
          console.log(`Detail Q${questionId}: 详情数据不是数组，类型: ${typeof details}`);
          continue;
        }
        
        console.log(`Detail Q${questionId}: 开始导入 ${details.length} 条详情`);
        
        for (const detail of details) {
          try {
            console.log(`Detail Q${questionId}: 处理详情`, Object.keys(detail));
            
            let linkedKpId = null;
            
            if (detail._question_code && detail._question_code.Code) {
              const qc = detail._question_code;
              await connection.query(
                `INSERT INTO math_knowledgepoints (
                  KPCode, KPTitle, KPContent, KPType, KPBusType, KPPCode, KPNotes
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                KPTitle = VALUES(KPTitle), KPContent = VALUES(KPContent),
                KPType = VALUES(KPType), KPNotes = VALUES(KPNotes)`,
                [qc.Code, qc.Title || `KP ${qc.Code}`, qc.Content || null,
                 qc.Type || null, qc.BusType || null, qc.PCode || null, qc.Notes || null]
              );
              
              const [kpRows] = await connection.query(
                'SELECT KnowledgePointID FROM math_knowledgepoints WHERE KPCode = ?',
                [qc.Code]
              );
              if (kpRows.length > 0) linkedKpId = kpRows[0].KnowledgePointID;
            }
            
            // 获取详情ID（支持 ID、id、Id 或 detail.ID 等字段）
            const detailId = detail.ID || detail.id || detail.Id || detail.detailId;
            console.log(`Detail Q${questionId}: detailId=${detailId}, 可用字段:`, Object.keys(detail).filter(k => k.toLowerCase().includes('id')));
            
            if (detailId) {
              // 检查详情是否已存在（使用ID字段作为主键）
              const [existingDetail] = await connection.query(
                'SELECT ID FROM math_questiondetails WHERE QuestionID = ? AND SourceDetailID = ?',
                [questionId, detailId]
              );
              
              if (existingDetail.length === 0) {
                await connection.query(
                  `INSERT INTO math_questiondetails (
                    QuestionID, BusType, SourceDetailID, Context, Give, 
                    Notes, JsonData, Title, IsProductBook, LinkedKnowledgePointID
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [questionId, detail.BusType || 'analysis', detailId, 
                   detail.Context || null, detail.Give || 0, detail.Notes || null,
                   detail.Json ? JSON.stringify(detail.Json) : null,
                   detail.Title || null, detail.IsProductBook ? 1 : 0, linkedKpId]
                );
                stats.detailsCreated++;
                console.log(`Detail Q${questionId} ID${detailId}: 插入成功`);
              } else {
                // 详情已存在，跳过
                console.log(`Detail Q${questionId} ID${detailId}: 已存在，跳过导入`);
              }
            } else {
              console.log(`Detail Q${questionId}: 缺少ID字段，跳过`);
            }
          } catch (err) {
            console.error(`Detail Q${questionId}: 插入失败 - ${err.message}`);
            stats.errors.push(`Detail Q${questionId}: ${err.message}`);
          }
        }
      }
    }
    
    await connection.commit();
    
    res.json(successResponse({
      ...stats,
      totalQuestions: questionIdSet.size,
      totalBooks: bookMap.size
    }, '导入完成'));
    
  } catch (error) {
    await connection.rollback();
    console.error('文件导入失败:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  } finally {
    connection.release();
  }
};

// 扫描 books 文件夹获取可用的书籍数据
const scanBooksFolder = async (req, res) => {
  try {
    const booksPath = path.join(__dirname, '..', '..', 'books');
    
    // 检查 books 文件夹是否存在
    if (!fs.existsSync(booksPath)) {
      return res.json(successResponse({
        available: false,
        message: '未找到 books 文件夹',
        books: []
      }));
    }

    const books = [];
    const structPath = path.join(booksPath, 'books_struct');
    const questionsPath = path.join(booksPath, 'books_questions');
    const detailsPath = path.join(booksPath, 'books_details');

    // 读取结构文件夹中的文件
    if (fs.existsSync(structPath)) {
      const structFiles = fs.readdirSync(structPath).filter(f => f.endsWith('.json'));
      
      for (const file of structFiles) {
        const bookName = file.replace('.json', '');
        const structFile = path.join(structPath, file);
        const questionsFile = path.join(questionsPath, file);
        const detailsFile = path.join(detailsPath, bookName + '_详情.json');

        // 检查对应的题目和详情文件是否存在
        const hasQuestions = fs.existsSync(questionsFile);
        const hasDetails = fs.existsSync(detailsFile);

        // 读取结构文件获取题目数量
        let questionCount = 0;
        let chapterCount = 0;
        try {
          const structData = JSON.parse(fs.readFileSync(structFile, 'utf8'));
          if (Array.isArray(structData) && structData.length > 0) {
            // 统计章节数
            const chapters = new Set();
            structData.forEach(item => {
              if (item.BookChapter) {
                chapters.add(item.BookChapter);
              }
            });
            chapterCount = chapters.size;
            questionCount = structData.length;
          }
        } catch (e) {
          console.error(`读取 ${file} 失败:`, e.message);
        }

        books.push({
          name: bookName,
          structFile: file,
          hasQuestions,
          hasDetails,
          questionCount,
          chapterCount,
          complete: hasQuestions && hasDetails
        });
      }
    }

    res.json(successResponse({
      available: true,
      path: booksPath,
      books: books.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    }));
  } catch (error) {
    console.error('扫描 books 文件夹失败:', error);
    res.status(500).json(errorResponse('扫描失败: ' + error.message));
  }
};

// 从 books 文件夹导入指定书籍
const importFromBooksFolder = async (req, res) => {
  try {
    const { bookName, subjectId, contentType = 'book' } = req.body;
    
    if (!bookName) {
      return res.status(400).json(errorResponse('请指定书籍名称'));
    }

    const booksPath = path.join(__dirname, '..', '..', 'books');
    const structFile = path.join(booksPath, 'books_struct', `${bookName}.json`);
    const questionsFile = path.join(booksPath, 'books_questions', `${bookName}.json`);
    const detailsFile = path.join(booksPath, 'books_details', `${bookName}_详情.json`);

    // 检查文件是否存在
    if (!fs.existsSync(structFile)) {
      return res.status(404).json(errorResponse(`未找到书籍 "${bookName}" 的结构文件`));
    }
    if (!fs.existsSync(questionsFile)) {
      return res.status(404).json(errorResponse(`未找到书籍 "${bookName}" 的题目文件`));
    }

    // 读取文件内容
    const structData = JSON.parse(fs.readFileSync(structFile, 'utf8'));
    const questionsData = JSON.parse(fs.readFileSync(questionsFile, 'utf8'));
    let detailsData = {};
    
    if (fs.existsSync(detailsFile)) {
      detailsData = JSON.parse(fs.readFileSync(detailsFile, 'utf8'));
    }

    // 调用导入逻辑
    req.body = {
      structData,
      questionsData,
      detailsData,
      subjectId,
      contentType
    };

    // 复用 importFromFiles 逻辑
    await importFromFiles(req, res);
    
  } catch (error) {
    console.error('从 books 文件夹导入失败:', error);
    res.status(500).json(errorResponse('导入失败: ' + error.message));
  }
};

// 获取考点分类列表
const getKnowledgeCategories = async (req, res) => {
  try {
    const [rows] = await mysqlPool.query(`
      SELECT * FROM math_knowledge_categories
      WHERE IsActive = 1
      ORDER BY CategoryCode ASC
    `);

    res.json(successResponse(rows));
  } catch (error) {
    console.error('获取考点分类失败:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 创建考点分类
const createKnowledgeCategory = async (req, res) => {
  try {
    const { CategoryName, CategoryCode, Description, SortOrder, IsActive } = req.body;

    const [result] = await mysqlPool.query(
      'INSERT INTO math_knowledge_categories (CategoryName, CategoryCode, Description, SortOrder, IsActive) VALUES (?, ?, ?, ?, ?)',
      [CategoryName, CategoryCode, Description || '', SortOrder || 0, IsActive !== undefined ? IsActive : 1]
    );

    res.json(successResponse({ id: result.insertId }, '创建成功'));
  } catch (error) {
    console.error('创建考点分类失败:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 更新考点分类
const updateKnowledgeCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { CategoryName, CategoryCode, IsActive, QuestionCount } = req.body;

    // 如果只更新 QuestionCount，单独处理
    if (QuestionCount !== undefined && CategoryName === undefined) {
      await mysqlPool.query('UPDATE math_knowledge_categories SET QuestionCount = ? WHERE id = ?', [QuestionCount, id]);
      return res.json(successResponse(null, '更新成功'));
    }

    // 否则更新完整信息
    const query = 'UPDATE math_knowledge_categories SET CategoryName = ?, CategoryCode = ?, IsActive = ?, QuestionCount = ? WHERE id = ?';
    const params = [CategoryName, CategoryCode, IsActive, QuestionCount, id];

    await mysqlPool.query(query, params);

    res.json(successResponse(null, '更新成功'));
  } catch (error) {
    console.error('更新考点分类失败:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 删除考点分类
const deleteKnowledgeCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    await mysqlPool.query('DELETE FROM math_knowledge_categories WHERE id = ?', [id]);
    
    res.json(successResponse(null, '删除成功'));
  } catch (error) {
    console.error('删除考点分类失败:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 获取分类下的题目
const getQuestionsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    // 获取分类信息 - 使用 id 字段（表的主键）
    const [categories] = await mysqlPool.query(
      'SELECT * FROM math_knowledge_categories WHERE id = ?',
      [categoryId]
    );
    
    if (categories.length === 0) {
      return res.status(404).json(errorResponse('分类不存在'));
    }

    const category = categories[0];
    const level = category.CategoryCode.split('-').length;

    let kpNames = [];

    if (level === 4) {
      // 4级，直接使用当前分类名称
      kpNames = [category.CategoryName];
    } else if (level === 3) {
      // 3级，包含当前分类名称和所有子级（4级）的分类名称
      kpNames = [category.CategoryName];
      
      // 查找所有4级子分类
      const [childCategories] = await mysqlPool.query(
        `SELECT CategoryName FROM math_knowledge_categories WHERE CategoryCode LIKE ?`,
        [`${category.CategoryCode}-%`]
      );
      
      childCategories.forEach(c => {
        kpNames.push(c.CategoryName);
      });
    } else {
      // 1-2级，找所有子级（3级和4级）
      const [childCategories] = await mysqlPool.query(
        `SELECT CategoryName, CategoryCode FROM math_knowledge_categories WHERE CategoryCode LIKE ?`,
        [`${category.CategoryCode}%`]
      );
      // 过滤出3级和4级分类
      kpNames = childCategories
        .filter(c => {
          const childLevel = c.CategoryCode.split('-').length;
          return childLevel >= 3 && childLevel <= 4;
        })
        .map(c => c.CategoryName);
    }

    if (kpNames.length === 0) {
      return res.json(successResponse([]));
    }

    const conditions = kpNames.map(() => 'q.LinkNames LIKE ?').join(' OR ');
    const params = kpNames.map(name => `%${name}%`);

    const [questions] = await mysqlPool.query(`
      SELECT DISTINCT q.*,
        bq.BookID as BookID,
        bq.BookChapter,
        bq.QuestionPage,
        bq.QuestionSort,
        bk.BookTitle,
        ms.SubjectName
      FROM math_questions q
      LEFT JOIN math_bookquestions bq ON q.QuestionID = bq.QuestionID
      LEFT JOIN math_books bk ON bq.BookID = bk.BookID
      LEFT JOIN math_book_subjects mbs ON bk.BookID = mbs.BookID
      LEFT JOIN math_subjects ms ON mbs.SubjectID = ms.SubjectID
      WHERE (${conditions})
      ORDER BY q.QuestionID DESC
    `, params);

    res.json(successResponse(questions));
  } catch (error) {
    console.error('获取分类题目失败:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 从分类中移除题目
const removeQuestionFromCategory = async (req, res) => {
  try {
    const { categoryId, questionId } = req.params;
    
    // 获取分类信息 - 使用 id 字段
    const [categories] = await mysqlPool.query(
      'SELECT * FROM math_knowledge_categories WHERE id = ?',
      [categoryId]
    );
    
    if (categories.length === 0) {
      return res.status(404).json(errorResponse('分类不存在'));
    }
    
    const category = categories[0];
    
    // 获取该分类下的考点
    const [knowledgePoints] = await mysqlPool.query(
      'SELECT KnowledgePointID FROM math_knowledgepoints WHERE KPCode LIKE ?',
      [`${category.CategoryCode}%`]
    );
    
    const kpIds = knowledgePoints.map(kp => kp.KnowledgePointID);
    
    if (kpIds.length > 0) {
      // 解除题目与这些考点的关联
      await mysqlPool.query(
        `UPDATE math_questiondetails SET LinkedKnowledgePointID = NULL 
         WHERE QuestionID = ? AND LinkedKnowledgePointID IN (${kpIds.map(() => '?').join(',')})`,
        [questionId, ...kpIds]
      );
    }
    
    res.json(successResponse(null, '移除成功'));
  } catch (error) {
    console.error('从分类移除题目失败:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 批量修复题目考点关联
// 根据LinksCount/LinkNames自动匹配并链接考点（可单独调用，也用于导入后处理）
const linkQuestionKnowledgePoints = async (req, res) => {
  try {
    const { questionIds, allUnlinked } = req.body;
    const connection = await mysqlPool.getConnection();

    try {
      let questions;
      if (allUnlinked) {
        // 处理所有有LinksCount但考点未关联的题目
        [questions] = await connection.query(`
          SELECT q.QuestionID, q.LinksCount, q.LinkNames
          FROM math_questions q
          WHERE q.LinksCount IS NOT NULL AND q.LinksCount != ''
          AND NOT EXISTS (
            SELECT 1 FROM math_questiondetails qd 
            WHERE qd.QuestionID = q.QuestionID 
            AND qd.BusType = '考点' 
            AND qd.LinkedKnowledgePointID IS NOT NULL
          )
        `);
      } else if (questionIds && Array.isArray(questionIds)) {
        // 处理指定ID列表
        [questions] = await connection.query(
          'SELECT QuestionID, LinksCount, LinkNames FROM math_questions WHERE QuestionID IN (?)',
          [questionIds]
        );
      } else {
        return res.status(400).json(errorResponse('请提供 questionIds 或设置 allUnlinked=true'));
      }

      let totalMatched = 0;
      let totalFailed = 0;
      const results = [];

      for (const q of questions) {
        const result = await linkKnowledgePointsForQuestion(
          connection, q.QuestionID, q.LinksCount, q.LinkNames
        );
        totalMatched += result.matched;
        totalFailed += result.failed;
        if (result.matched > 0 || result.failed > 0) {
          results.push({
            questionId: q.QuestionID,
            matched: result.matched,
            failed: result.failed
          });
        }
      }

      res.json(successResponse({
        processed: questions.length,
        totalMatched,
        totalFailed,
        details: results.slice(0, 100)
      }, `处理了 ${questions.length} 道题目，成功链接 ${totalMatched} 个考点${totalFailed > 0 ? `，${totalFailed} 个匹配失败` : ''}`));

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('链接考点失败:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

const fixQuestionKnowledgePointLinks = async (req, res) => {
  try {
    const { dryRun = true } = req.body;
    const connection = await mysqlPool.getConnection();

    try {
      // 获取所有有 LinksCount/LinkNames 的题目
      const [questions] = await connection.query(`
        SELECT q.QuestionID, q.LinksCount, q.LinkNames
        FROM math_questions q
        WHERE q.LinksCount IS NOT NULL AND q.LinksCount != ''
        ORDER BY q.QuestionID
      `);

      let totalMatched = 0;
      let totalFailed = 0;
      const fixes = [];

      for (const q of questions) {
        if (!dryRun) {
          // 实际执行：使用 linkKnowledgePointsForQuestion 函数
          const result = await linkKnowledgePointsForQuestion(
            connection, q.QuestionID, q.LinksCount, q.LinkNames
          );
          totalMatched += result.matched;
          totalFailed += result.failed;
          if (result.matched > 0 || result.failed > 0) {
            fixes.push({ questionId: q.QuestionID, matched: result.matched, failed: result.failed });
          }
        } else {
          // 预览模式：只统计可匹配数
          const names = (q.LinkNames || '').split(',').map(n => n.trim()).filter(Boolean);
          if (names.length === 0) continue;

          const [existingDetails] = await connection.query(
            'SELECT ID, Title, LinkedKnowledgePointID FROM math_questiondetails WHERE QuestionID = ? AND BusType = ?',
            [q.QuestionID, '考点']
          );

          let matched = 0;
          let failed = 0;

          for (const name of names) {
            const already = existingDetails.find(d =>
              d.LinkedKnowledgePointID !== null &&
              d.Title && (d.Title.trim() === name.trim() || d.Title.includes(name.trim()))
            );
            if (already) {
              matched++;
              continue;
            }
            failed++;
          }

          if (matched > 0 || failed > 0) {
            fixes.push({ questionId: q.QuestionID, matched, failed });
          }
          totalMatched += matched;
          totalFailed += failed;
        }
      }

      res.json(successResponse({
        dryRun,
        totalQuestions: questions.length,
        totalMatched,
        totalFailed,
        fixes: fixes.slice(0, 200)
      }, dryRun ? '预览模式：可匹配 ' + totalMatched + ' 个考点' : '修复完成，成功链接 ' + totalMatched + ' 个考点'));

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('修复题目考点关联失败:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 根据考点名称获取题目数量
const getQuestionCountByKnowledgePoint = async (req, res) => {
  try {
    const { kpTitle } = req.query;
    
    if (!kpTitle) {
      return res.status(400).json(errorResponse('考点名称不能为空'));
    }
    
    // 使用LIKE查询匹配包含该考点名称的题目
    const [rows] = await mysqlPool.query(`
      SELECT COUNT(*) as count
      FROM math_questions mq
      WHERE mq.LinkNames IS NOT NULL 
        AND mq.LinkNames != ''
        AND mq.LinkNames LIKE ?
    `, [`%${kpTitle}%`]);
    
    const count = rows[0]?.count || 0;
    
    res.json(successResponse({ count, kpTitle }));
  } catch (error) {
    console.error('获取考点题目数量失败:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 批量获取考点题目数量
const getQuestionCountsBatch = async (req, res) => {
  try {
    const { kpTitles } = req.body;
    
    if (!Array.isArray(kpTitles) || kpTitles.length === 0) {
      return res.status(400).json(errorResponse('考点名称列表不能为空'));
    }
    
    // 限制批量查询数量
    const titles = kpTitles.slice(0, 100);
    const counts = {};
    
    // 逐个查询每个考点的题目数量
    for (const kpTitle of titles) {
      const [rows] = await mysqlPool.query(`
        SELECT COUNT(*) as count
        FROM math_questions mq
        WHERE mq.LinkNames IS NOT NULL 
          AND mq.LinkNames != ''
          AND mq.LinkNames LIKE ?
      `, [`%${kpTitle}%`]);
      
      counts[kpTitle] = rows[0]?.count || 0;
    }
    
    res.json(successResponse(counts));
  } catch (error) {
    console.error('批量获取考点题目数量失败:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 提交纠错
const submitCorrection = async (req, res) => {
  try {
    const { QuestionID, ErrorType, Description, CorrectContent } = req.body;
    
    if (!QuestionID || !ErrorType || !Description) {
      return res.status(400).json(errorResponse('缺少必要参数'));
    }
    
    // 组合内容：错误类型 + 错误描述 + 正确内容
    let content = `错误类型: ${ErrorType}\n错误描述: ${Description}`;
    if (CorrectContent) {
      content += `\n正确内容: ${CorrectContent}`;
    }
    
    // 插入纠错记录
    await mysqlPool.query(
      `INSERT INTO math_corrections (QuestionID, Type, Content, Status, CreatedAt)
       VALUES (?, ?, ?, 0, NOW())`,
      [QuestionID, ErrorType, content]
    );
    
    res.json(successResponse(null, '纠错提交成功'));
  } catch (error) {
    console.error('提交纠错失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 保存试卷提取页面中题目的编辑
const savePaperQuestion = async (req, res) => {
  try {
    const { questionId, questionData } = req.body;
    if (questionId === undefined || !questionData) {
      return res.status(400).json(errorResponse('缺少参数'));
    }

    // 读取去重合集.json
    const jsonPath = path.join(__dirname, '..', 'admin-panel', 'public', '去重合集.json');
    const srcPath = path.join(__dirname, '..', 'admin-panel', 'src', 'pages', 'user-exam', '去重合集.json');

    let filePath = jsonPath;
    if (!fs.existsSync(jsonPath)) {
      filePath = srcPath;
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json(errorResponse('找不到去重合集.json文件'));
    }

    const rawData = fs.readFileSync(filePath, 'utf-8');
    // 移除 BOM 字符
    const cleanData = rawData.charCodeAt(0) === 0xFEFF ? rawData.slice(1) : rawData;
    let questions = JSON.parse(cleanData);

    // questionId 是数组中的 1-based 索引
    const index = parseInt(questionId) - 1;
    if (index < 0 || index >= questions.length) {
      return res.status(404).json(errorResponse(`未找到题目索引: ${questionId}`));
    }

    // 更新字段
    if (questionData.QuestionText !== undefined) questions[index].QuestionText = questionData.QuestionText;
    if (questionData.OriginalAnswerText !== undefined) questions[index].OriginalAnswerText = questionData.OriginalAnswerText;
    if (questionData.Difficulty !== undefined) questions[index].Difficulty = questionData.Difficulty;
    if (questionData.QuestionType !== undefined) questions[index].QuestionType = questionData.QuestionType;
    if (questionData.details !== undefined) questions[index].details = questionData.details;
    if (questionData.QuestionSort !== undefined) questions[index].QuestionSort = questionData.QuestionSort;
    if (questionData.Sort !== undefined) questions[index].Sort = questionData.Sort;
    if (questionData.options !== undefined) questions[index].options = questionData.options;

    // 写回文件
    fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), 'utf-8');

    console.log(`试卷题目已更新: questionId=${questionId}, index=${index}, file=${filePath}`);
    res.json(successResponse({ questionId, updated: true }));
  } catch (error) {
    console.error('保存试卷题目失败:', error);
    res.status(500).json(errorResponse('保存失败: ' + error.message));
  }
};

// 从JSON导入试卷（去重合集.json + 去重索引.json）
const importPapersFromJson = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { questions, indexMap, subjectMapping, paperDefaults, paperNames } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json(errorResponse('题目数据不能为空'));
    }
    if (!indexMap || !indexMap['正向索引']) {
      return res.status(400).json(errorResponse('索引数据不能为空'));
    }

    await connection.beginTransaction();

    const forwardIndex = indexMap['正向索引'];
    
    // 解析索引，按科目+试卷名分组
    // paperKey: "数一第一套" -> { subject: "数一", paperName: "第一套", fullName: "数一第一套" }
    const paperMap = new Map(); // key: "subject|paperName" -> { subject, paperName, questions: [{qIndex, sort}] }

    for (const [qIdStr, paperRefs] of Object.entries(forwardIndex)) {
      const qIndex = parseInt(qIdStr);
      const questionData = questions[qIndex - 1]; // 索引从1开始
      if (!questionData) continue;

      for (const ref of paperRefs) {
        const match = ref.match(/^(.+?第[一二三四五六七八九十\d]+套)#(\d+)$/);
        if (!match) continue;

        const fullPaperName = match[1]; // e.g., "数一第一套"
        const sortInPaper = parseInt(match[2]);

        // 提取科目名（数一/数二/数三）
        const subjectMatch = fullPaperName.match(/^(数[一二三])/);
        if (!subjectMatch) continue;
        const subjectName = subjectMatch[1];

        // 提取序号部分
        const paperOrdinal = fullPaperName.substring(subjectName.length); // "第一套"

        const key = `${subjectName}|${paperOrdinal}`;
        if (!paperMap.has(key)) {
          paperMap.set(key, {
            subject: subjectName,
            paperOrdinal,
            fullPaperName,
            questions: []
          });
        }
        paperMap.get(key).questions.push({
          qIndex,
          sort: sortInPaper,
          questionData
        });
      }
    }

    // 科目名映射：数一 -> 数学一 (对应math_subjects表中的SubjectName)
    const defaultSubjectMapping = {
      '数一': '数学一',
      '数二': '数学二',
      '数三': '数学三'
    };
    const effectiveMapping = { ...defaultSubjectMapping, ...(subjectMapping || {}) };

    // 获取现有的数学科目
    const [existingSubjects] = await connection.query(
      'SELECT SubjectID, SubjectName FROM math_subjects'
    );
    const subjectNameToId = {};
    for (const s of existingSubjects) {
      subjectNameToId[s.SubjectName] = s.SubjectID;
    }

    // 获取可用BookID起始值
    const [maxBookResult] = await connection.query('SELECT MAX(BookID) as maxId FROM math_books');
    let nextBookId = Math.max((maxBookResult[0].maxId || 0) + 1, 100001);

    // 获取最大QuestionID
    const [maxQResult] = await connection.query('SELECT MAX(QuestionID) as maxId FROM math_questions');
    let nextQuestionId = (maxQResult[0].maxId || 0) + 1;

    // 获取最大EntryID
    const [maxEntryResult] = await connection.query('SELECT MAX(EntryID) as maxEntry FROM math_bookquestions');
    let nextEntryId = (maxEntryResult[0].maxEntry || 0) + 1;

    const stats = {
      subjectsFound: 0,
      booksCreated: 0,
      chaptersCreated: 0,
      questionsImported: 0,
      questionsSkipped: 0
    };

    // 按subject分组 paperMap
    const subjectGroups = new Map();
    for (const [key, paperInfo] of paperMap) {
      const { subject } = paperInfo;
      if (!subjectGroups.has(subject)) {
        subjectGroups.set(subject, []);
      }
      subjectGroups.get(subject).push(paperInfo);
    }

    // 获取已导入记录（去重）
    const processedQuestionIds = new Map(); // 用于追踪本次已处理的问题ID (hash → questionId)

    // 预加载数据库中已有的题目，防止跨运行重复
    const [existingQuestions] = await connection.query(
      'SELECT QuestionID, QuestionText FROM math_questions WHERE QuestionText IS NOT NULL'
    );
    for (const eq of existingQuestions) {
      const hash = require('crypto').createHash('md5').update(eq.QuestionText || '').digest('hex');
      if (!processedQuestionIds.has(hash)) {
        processedQuestionIds.set(hash, eq.QuestionID);
      }
    }

    // 对每个科目创建或复用一本书
    for (const [subjectCode, papers] of subjectGroups) {
      const targetSubjectName = effectiveMapping[subjectCode];
      if (!targetSubjectName) {
        console.warn(`跳过未知科目映射: ${subjectCode}`);
        continue;
      }

      const subjectId = subjectNameToId[targetSubjectName];
      if (!subjectId) {
        console.warn(`跳过不存在的科目: ${targetSubjectName}`);
        continue;
      }

      stats.subjectsFound++;

      // 查找或创建该科目下的书籍 - 使用 ContentType='mock_paper'
      const bookTitle = `${targetSubjectName}模拟卷合集`;
      let [existingBooks] = await connection.query(
        'SELECT BookID FROM math_books WHERE BookTitle = ? AND ContentType = ?',
        [bookTitle, 'mock_paper']
      );

      let bookId;
      if (existingBooks.length > 0) {
        bookId = existingBooks[0].BookID;
      } else {
        bookId = nextBookId++;
        await connection.query(
          `INSERT INTO math_books (BookID, BookTitle, ContentType, CountType, SubjectID, SortOrder)
           VALUES (?, ?, 'mock_paper', 'set', ?, 0)`,
          [bookId, bookTitle, subjectId]
        );
        await connection.query(
          'INSERT INTO math_book_subjects (BookID, SubjectID) VALUES (?, ?)',
          [bookId, subjectId]
        );
        stats.booksCreated++;
      }

      // 获取该书籍现有的章节（占位题）
      const [existingChapters] = await connection.query(
        'SELECT DISTINCT BookChapter FROM math_bookquestions WHERE BookID = ? AND BookChapter IS NOT NULL',
        [bookId]
      );
      const existingChapterNames = new Set(existingChapters.map(c => c.BookChapter));

      // 每套试卷作为一个章节
      for (const paper of papers) {
        const chapterName = (paperNames && paperNames[paper.fullPaperName]) || paper.fullPaperName;

        // 如果章节不存在，标记已存在（无需创建占位题）
        if (!existingChapterNames.has(chapterName)) {
          existingChapterNames.add(chapterName);
          stats.chaptersCreated++;
        }

        // 对该试卷的题目按 sort 排序
        paper.questions.sort((a, b) => a.sort - b.sort);

        // 获取当前章节的最大QuestionSort
        const [maxQS] = await connection.query(
          'SELECT MAX(QuestionSort) as maxQS FROM math_bookquestions WHERE BookID = ? AND BookChapter = ?',
          [bookId, chapterName]
        );
        let nextQuestionSort = (maxQS[0].maxQS || 0) + 1;

        // 获取当前书籍最大Sort
        const [maxBookSort] = await connection.query(
          'SELECT MAX(Sort) as maxSort FROM math_bookquestions WHERE BookID = ?',
          [bookId]
        );
        let nextBookSort = (maxBookSort[0].maxSort || 0) + 1;

        for (const { qIndex, questionData, sort: sortInPaper } of paper.questions) {
          const textHash = require('crypto').createHash('md5').update(questionData.QuestionText || '').digest('hex');

          let questionId;
          let isNewQuestion = false;

          if (processedQuestionIds.has(textHash)) {
            // 已存在的题目: 从map中获取已有QuestionID，仅创建章节关联
            questionId = processedQuestionIds.get(textHash);
            stats.questionsSkipped++;
          } else {
            // 新题目: 创建题目记录
            questionId = nextQuestionId++;
            isNewQuestion = true;
            const questionType = questionData.QuestionType || '单选题';
            const difficulty = questionData.Difficulty !== undefined ? questionData.Difficulty : 0.5;
            const answerText = questionData.OriginalAnswerText || '';
            const linksCount = questionData.LinksCount || null;
            const linkNames = questionData.LinkNames || null;

            await connection.query(
              `INSERT INTO math_questions (QuestionID, QuestionText, QuestionType, OriginalAnswerText, Difficulty, LinksCount, LinkNames)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [questionId, questionData.QuestionText, questionType, answerText, difficulty, linksCount, linkNames]
            );

            // 导入详情（解析等）
            if (questionData.details && Array.isArray(questionData.details)) {
              for (const detail of questionData.details) {
                const busType = detail.BusType || '题目详解';
                if (busType === '考点') {
                  // 考点不在此处插入，由 linkKnowledgePointsForQuestion 统一处理
                  continue;
                }
                await connection.query(
                  `INSERT INTO math_questiondetails (QuestionID, BusType, Context, Title)
                   VALUES (?, ?, ?, ?)`,
                  [questionId, busType, detail.Context || '', detail.Title || '']
                );
              }
            }

            // 自动匹配并链接考点
            if (linksCount || linkNames) {
              await linkKnowledgePointsForQuestion(connection, questionId, linksCount, linkNames);
            }

            processedQuestionIds.set(textHash, questionId);
            stats.questionsImported++;
          }

          // 关联到书籍章节（无论是新题还是重复题都要关联）
          await connection.query(
            `INSERT INTO math_bookquestions
             (EntryID, BookID, QuestionID, Sort, BookChapter, ChapterSort, QuestionSort)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [nextEntryId++, bookId, questionId, nextBookSort++, chapterName, 0, nextQuestionSort++]
          );
        }
      }
    }

    await connection.commit();
    res.json(successResponse({
      stats,
      message: `导入完成：${stats.booksCreated} 本书, ${stats.chaptersCreated} 个章节, ${stats.questionsImported} 道不重复题目${stats.questionsSkipped > 0 ? `, ${stats.questionsSkipped} 道跨章节引用` : ''}`
    }));
  } catch (error) {
    await connection.rollback();
    console.error('导入试卷失败:', error);
    res.status(500).json(errorResponse('导入失败: ' + error.message));
  } finally {
    connection.release();
  }
};

// 从试卷提取页导入单个试卷到题库
const importExtractedPaper = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { subjectCode, paperName, questions } = req.body;

    if (!subjectCode || !paperName || !questions || !Array.isArray(questions)) {
      return res.status(400).json(errorResponse('参数不完整'));
    }
    if (questions.length === 0) {
      return res.status(400).json(errorResponse('没有题目可导入'));
    }

    await connection.beginTransaction();

    // 科目映射
    const subjectMapping = { '数一': '数学一', '数二': '数学二', '数三': '数学三' };
    const targetSubjectName = subjectMapping[subjectCode] || subjectCode;

    const [existingSubjects] = await connection.query(
      'SELECT SubjectID, SubjectName FROM math_subjects'
    );
    const subjectNameToId = {};
    for (const s of existingSubjects) {
      subjectNameToId[s.SubjectName] = s.SubjectID;
    }

    const subjectId = subjectNameToId[targetSubjectName];
    if (!subjectId) {
      await connection.rollback();
      return res.status(400).json(errorResponse(`科目 ${targetSubjectName} 不存在`));
    }

    // 查找或创建书籍
    const bookTitle = `${targetSubjectName}模拟卷合集`;
    let [existingBooks] = await connection.query(
      'SELECT BookID FROM math_books WHERE BookTitle = ? AND ContentType = ?',
      [bookTitle, 'mock_paper']
    );

    let bookId;
    let bookCreated = false;
    if (existingBooks.length > 0) {
      bookId = existingBooks[0].BookID;
    } else {
      const [maxBookResult] = await connection.query('SELECT MAX(BookID) as maxId FROM math_books');
      bookId = Math.max((maxBookResult[0].maxId || 0) + 1, 100001);
      await connection.query(
        `INSERT INTO math_books (BookID, BookTitle, ContentType, CountType, SubjectID, SortOrder)
         VALUES (?, ?, 'mock_paper', 'set', ?, 0)`,
        [bookId, bookTitle, subjectId]
      );
      await connection.query(
        'INSERT INTO math_book_subjects (BookID, SubjectID) VALUES (?, ?)',
        [bookId, subjectId]
      );
      bookCreated = true;
    }

    // 检查章节是否已存在
    const [existingChapter] = await connection.query(
      'SELECT COUNT(*) as count FROM math_bookquestions WHERE BookID = ? AND BookChapter = ?',
      [bookId, paperName]
    );

    let chapterCreated = false;
    if (existingChapter[0].count === 0) {
      const [maxEntryResult] = await connection.query('SELECT MAX(EntryID) as maxEntry FROM math_bookquestions');
      let nextEntryId = (maxEntryResult[0].maxEntry || 0) + 1;

      const [maxSortRows] = await connection.query(
        'SELECT MAX(ChapterSort) as maxSort FROM math_bookquestions WHERE BookID = ?',
        [bookId]
      );
      const chapterSort = (maxSortRows[0].maxSort || 0) + 1;

      const [maxSort] = await connection.query(
        'SELECT MAX(Sort) as maxSort FROM math_bookquestions WHERE BookID = ?',
        [bookId]
      );
      const nextSort = (maxSort[0].maxSort || 0) + 1;

      const placeholderQuestionId = -(bookId * 1000 + chapterSort);
      await connection.query(
        `INSERT INTO math_questions (QuestionID, QuestionText, QuestionType, Difficulty)
         VALUES (?, ?, '占位题', 0)`,
        [placeholderQuestionId, `[章节占位] ${paperName}`]
      );

      await connection.query(
        `INSERT INTO math_bookquestions
         (EntryID, BookID, QuestionID, Sort, BookChapter, ChapterSort, QuestionSort)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [nextEntryId, bookId, placeholderQuestionId, nextSort, paperName, chapterSort, '0']
      );
      chapterCreated = true;
    }

    // 获取最大QuestionID
    const [maxQResult] = await connection.query('SELECT MAX(QuestionID) as maxId FROM math_questions');
    let nextQuestionId = (maxQResult[0].maxId || 0) + 1;

    // 获取现有EntryID
    const [maxEntryResult2] = await connection.query('SELECT MAX(EntryID) as maxEntry FROM math_bookquestions');
    let nextEntryId = (maxEntryResult2[0].maxEntry || 0) + 1;

    // 获取当前章节最大QuestionSort
    const [maxQS] = await connection.query(
      'SELECT MAX(QuestionSort) as maxQS FROM math_bookquestions WHERE BookID = ? AND BookChapter = ?',
      [bookId, paperName]
    );
    let nextQuestionSort = (maxQS[0].maxQS || 0) + 1;

    // 获取当前书籍最大Sort
    const [maxBookSort] = await connection.query(
      'SELECT MAX(Sort) as maxSort FROM math_bookquestions WHERE BookID = ?',
      [bookId]
    );
    let nextBookSort = (maxBookSort[0].maxSort || 0) + 1;

    let importedCount = 0;
    let skipCount = 0;
    const processedTexts = new Set();

    for (const q of questions) {
      const textHash = require('crypto').createHash('md5').update(q.QuestionText || '').digest('hex');
      if (processedTexts.has(textHash)) {
        skipCount++;
        continue;
      }

      const questionId = nextQuestionId++;
      const questionType = q.QuestionType || '单选题';
      const difficulty = q.Difficulty !== undefined ? q.Difficulty : 0.5;
      const answerText = q.OriginalAnswerText || '';
      const linksCount = q.LinksCount || null;
      const linkNames = q.LinkNames || null;

      await connection.query(
        `INSERT INTO math_questions (QuestionID, QuestionText, QuestionType, OriginalAnswerText, Difficulty, LinksCount, LinkNames)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [questionId, q.QuestionText, questionType, answerText, difficulty, linksCount, linkNames]
      );

      if (q.details && Array.isArray(q.details)) {
        for (const detail of q.details) {
          const busType = detail.BusType || '题目详解';
          if (busType === '考点') {
            continue;
          }
          await connection.query(
            `INSERT INTO math_questiondetails (QuestionID, BusType, Context, Title)
             VALUES (?, ?, ?, ?)`,
            [questionId, busType, detail.Context || '', detail.Title || '']
          );
        }
      }

      // 自动匹配并链接考点
      if (linksCount || linkNames) {
        await linkKnowledgePointsForQuestion(connection, questionId, linksCount, linkNames);
      }

      // 关联到章节
      await connection.query(
        `INSERT INTO math_bookquestions
         (EntryID, BookID, QuestionID, Sort, BookChapter, ChapterSort, QuestionSort)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [nextEntryId++, bookId, questionId, nextBookSort++, paperName, 0, nextQuestionSort++]
      );

      processedTexts.add(textHash);
      importedCount++;
    }

    await connection.commit();
    res.json(successResponse({
      bookId,
      bookTitle,
      paperName,
      bookCreated,
      chapterCreated,
      importedCount,
      skipCount,
      message: `导入完成：${bookCreated ? '创建书籍，' : ''}${chapterCreated ? '新增章节，' : ''}导入 ${importedCount} 题${skipCount > 0 ? `，${skipCount} 题重复跳过` : ''}`
    }));
  } catch (error) {
    await connection.rollback();
    console.error('导入提取试卷失败:', error);
    res.status(500).json(errorResponse('导入失败: ' + error.message));
  } finally {
    connection.release();
  }
};

module.exports = {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getCorrections,
  submitCorrection,
  searchQuestions,
  adminSearchQuestions,
  searchKnowledgePoints,
  getKnowledgePointDetail,
  updateKnowledgePoint,
  getAllKnowledgePoints,
  getQuestionForEdit,
  updateQuestion,
  createQuestion,
  ignoreCorrection,
  deleteQuestion,
  deleteCorrection,
  importQuestions,
  importComplexQuestions,
  importFromFiles,
  getBooks,
  getBookQuestions,
  createBook,
  updateBook,
  deleteBook,
  addQuestionsToBook,
  getBookChapters,
  addBookChapter,
  updateBookChapter,
  deleteBookChapter,
  getBookChapterQuestions,
  updateBookQuestion,
  deleteBookQuestion,
  batchDeleteBookQuestions,
  saveRelatedQuestions,
  scanBooksFolder,
  importFromBooksFolder,
  getKnowledgeCategories,
  createKnowledgeCategory,
  updateKnowledgeCategory,
  deleteKnowledgeCategory,
  getQuestionsByCategory,
  removeQuestionFromCategory,
  linkQuestionKnowledgePoints,
  fixQuestionKnowledgePointLinks,
  getQuestionCountByKnowledgePoint,
  getQuestionCountsBatch,
  savePaperQuestion,
  importPapersFromJson,
  importExtractedPaper
};
