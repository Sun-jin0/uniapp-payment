const mysqlPool = require('../config/mysql');
const crypto = require('crypto');

const successResponse = (data, message = '操作成功') => ({
  code: 0,
  message,
  data
});

const errorResponse = (message, code = 1) => ({
  code,
  message,
  data: null
});

// 获取教辅列表
const getTutorials = async (req, res) => {
  try {
    const { status, keyword, noCollection, page, pageSize } = req.query;
    
    let sql = 'SELECT * FROM computer1_tutorial WHERE 1=1';
    const params = [];
    
    if (status !== undefined) {
      sql += ' AND status = ?';
      params.push(parseInt(status));
    }
    
    if (keyword) {
      sql += ' AND (name LIKE ? OR subject LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    if (noCollection === 'true') {
      sql += ' AND (collection_id IS NULL OR collection_id = 0)';
    }
    
    // 获取总数
    const [countResult] = await mysqlPool.query(`SELECT COUNT(*) as total FROM computer1_tutorial WHERE 1=1 ${sql.replace('SELECT * FROM computer1_tutorial WHERE 1=1', '')}`, params);
    const total = countResult[0].total;
    
    sql += ' ORDER BY sort_order ASC, id ASC';
    
    // 分页
    if (page && pageSize) {
      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      sql += ' LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize), offset);
    }
    
    const [tutorials] = await mysqlPool.query(sql, params);
    res.json(successResponse({
      list: tutorials,
      total,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || tutorials.length
    }));
  } catch (error) {
    console.error('获取教辅列表失败:', error);
    res.status(500).json(errorResponse('获取教辅列表失败'));
  }
};

// 获取教辅详情（含章节结构）
const getTutorialDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取教辅信息
    const [tutorials] = await mysqlPool.query(
      'SELECT * FROM computer1_tutorial WHERE id = ?',
      [id]
    );
    
    if (tutorials.length === 0) {
      return res.status(404).json(errorResponse('教辅不存在'));
    }
    
    const tutorial = tutorials[0];
    
    // 获取章节结构
    const [chapters] = await mysqlPool.query(
      'SELECT * FROM computer1_tutorial_chapter WHERE tutorial_id = ? ORDER BY level ASC, sort_order ASC, id ASC',
      [id]
    );
    
    // 获取所有小节的题目ID和类型
    const sectionIds = chapters.filter(c => c.level === 2).map(c => c.id);
    let sectionQuestions = {};
    if (sectionIds.length > 0) {
      // 先获取关联表数据
      const [questionLinks] = await mysqlPool.query(
        'SELECT chapter_id, question_id FROM computer1_tutorial_question WHERE chapter_id IN (?) ORDER BY sort_order ASC',
        [sectionIds]
      );
      
      // 获取所有题目ID
      const questionIds = [...new Set(questionLinks.map(l => l.question_id))];
      
      // 再查询题目类型
      let questionTypes = {};
      if (questionIds.length > 0) {
        const [questions] = await mysqlPool.query(
          'SELECT question_id, exercise_type_name FROM computer1_question WHERE question_id IN (?)',
          [questionIds]
        );
        questions.forEach(q => {
          questionTypes[q.question_id] = q.exercise_type_name;
        });
      }
      
      questionLinks.forEach(link => {
        if (!sectionQuestions[link.chapter_id]) {
          sectionQuestions[link.chapter_id] = {
            question_ids: [],
            question_types: []
          };
        }
        sectionQuestions[link.chapter_id].question_ids.push(link.question_id);
        sectionQuestions[link.chapter_id].question_types.push(questionTypes[link.question_id] || '单选题');
      });
    }
    
    // 构建树形结构
    const chapterMap = {};
    const rootChapters = [];
    
    chapters.forEach(chapter => {
      const chapterData = { ...chapter, children: [] };
      // 如果是小节(level=2)，添加题目ID列表
      if (chapter.level === 2 && sectionQuestions[chapter.id]) {
        chapterData.question_ids = sectionQuestions[chapter.id].question_ids;
        chapterData.question_types = [...new Set(sectionQuestions[chapter.id].question_types)];
      }
      chapterMap[chapter.id] = chapterData;
    });
    
    chapters.forEach(chapter => {
      const node = chapterMap[chapter.id];
      if (chapter.parent_id === 0) {
        rootChapters.push(node);
      } else if (chapterMap[chapter.parent_id]) {
        chapterMap[chapter.parent_id].children.push(node);
      }
    });
    
    tutorial.chapters = rootChapters;
    
    res.json(successResponse(tutorial));
  } catch (error) {
    console.error('获取教辅详情失败:', error);
    res.status(500).json(errorResponse('获取教辅详情失败'));
  }
};

// 获取章节下的题目列表
const getChapterQuestions = async (req, res) => {
  try {
    const { chapterId } = req.params;
    
    // 先获取关联的题目ID列表
    const [links] = await mysqlPool.query(
      'SELECT question_id FROM computer1_tutorial_question WHERE chapter_id = ? ORDER BY sort_order ASC',
      [chapterId]
    );
    
    if (links.length === 0) {
      return res.json(successResponse([]));
    }
    
    const questionIds = links.map(l => l.question_id);
    
    // 再获取题目详情
    const [questions] = await mysqlPool.query(
      'SELECT * FROM computer1_question WHERE question_id IN (?) ORDER BY FIELD(question_id, ?)',
      [questionIds, questionIds]
    );
    
    // 获取选项数据
    const [options] = await mysqlPool.query(
      'SELECT question_id, option_key, option_value FROM computer1_question_option WHERE question_id IN (?) ORDER BY option_sort ASC',
      [questionIds]
    );
    
    // 获取小题数据
    const [subs] = await mysqlPool.query(
      'SELECT * FROM computer1_question_sub WHERE question_id IN (?) ORDER BY question_order ASC',
      [questionIds]
    );
    
    // 将选项和小题关联到对应的题目
    const questionsWithOptions = questions.map(q => {
      const qOptions = options.filter(opt => opt.question_id === q.question_id);
      const qSubs = subs.filter(sub => sub.question_id === q.question_id);
      console.log(`[Tutorial] Question ${q.question_id}: ${qOptions.length} options, ${qSubs.length} subs`);
      return {
        ...q,
        options: qOptions,
        subs: qSubs
      };
    });
    
    console.log(`[Tutorial] Total questions: ${questionsWithOptions.length}`);
    res.json(successResponse(questionsWithOptions));
  } catch (error) {
    console.error('获取章节题目失败:', error);
    res.status(500).json(errorResponse('获取章节题目失败'));
  }
};

// 创建教辅
const createTutorial = async (req, res) => {
  const { name, version, year, cover_url, description, sort_order } = req.body;
  
  if (!name || !version) {
    return res.status(400).json(errorResponse('教辅名称和版本不能为空'));
  }
  
  try {
    const [result] = await mysqlPool.query(
      'INSERT INTO computer1_tutorial (name, version, year, cover_url, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [name, version, year || null, cover_url || null, description || null, sort_order || 0]
    );
    
    res.json(successResponse({ id: result.insertId }, '创建成功'));
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json(errorResponse('该教辅版本已存在'));
    }
    console.error('创建教辅失败:', error);
    res.status(500).json(errorResponse('创建教辅失败'));
  }
};

// 更新教辅
const updateTutorial = async (req, res) => {
  const { id } = req.params;
  const { name, version, year, cover_url, description, sort_order, status, collection_id } = req.body;
  
  try {
    // 构建动态更新SQL
    const updates = [];
    const params = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (version !== undefined) {
      updates.push('version = ?');
      params.push(version);
    }
    if (year !== undefined) {
      updates.push('year = ?');
      params.push(year);
    }
    if (cover_url !== undefined) {
      updates.push('cover_url = ?');
      params.push(cover_url);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      params.push(sort_order);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (collection_id !== undefined) {
      updates.push('collection_id = ?');
      params.push(collection_id);
    }
    
    if (updates.length === 0) {
      return res.status(400).json(errorResponse('没有要更新的字段'));
    }
    
    params.push(id);
    
    await mysqlPool.query(
      `UPDATE computer1_tutorial SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    res.json(successResponse(null, '更新成功'));
  } catch (error) {
    console.error('更新教辅失败:', error);
    res.status(500).json(errorResponse('更新教辅失败'));
  }
};

// 删除教辅（同时删除章节和题目关联）
const deleteTutorial = async (req, res) => {
  const { id } = req.params;
  const connection = await mysqlPool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // 1. 获取该教辅下的所有题目ID
    const [tutorialQuestions] = await connection.query(
      'SELECT DISTINCT question_id FROM computer1_tutorial_question WHERE tutorial_id = ?',
      [id]
    );
    const questionIds = tutorialQuestions.map(tq => tq.question_id);
    
    // 2. 删除题目关联
    await connection.query('DELETE FROM computer1_tutorial_question WHERE tutorial_id = ?', [id]);
    
    // 3. 删除章节
    await connection.query('DELETE FROM computer1_tutorial_chapter WHERE tutorial_id = ?', [id]);
    
    // 4. 删除教辅
    await connection.query('DELETE FROM computer1_tutorial WHERE id = ?', [id]);
    
    // 5. 级联删除题目及其相关数据
    if (questionIds.length > 0) {
      // 删除选项
      await connection.query(
        'DELETE FROM computer1_question_option WHERE question_id IN (?)',
        [questionIds]
      );
      
      // 删除小题
      await connection.query(
        'DELETE FROM computer1_question_sub WHERE question_id IN (?)',
        [questionIds]
      );
      
      // 删除考点关联
      await connection.query(
        'DELETE FROM computer1_question_tag_relation WHERE question_id IN (?)',
        [questionIds]
      );
      
      // 删除题目
      await connection.query(
        'DELETE FROM computer1_question WHERE question_id IN (?)',
        [questionIds]
      );
    }
    
    await connection.commit();
    res.json(successResponse(null, '删除成功'));
  } catch (error) {
    await connection.rollback();
    console.error('删除教辅失败:', error);
    res.status(500).json(errorResponse('删除教辅失败'));
  } finally {
    connection.release();
  }
};

// 计算题目内容哈希（用于去重）
const calculateQuestionHash = (question) => {
  const content = JSON.stringify({
    stem: (question.stem || '').trim(),
    answer: (question.answer || '').trim()
  });
  return crypto.createHash('md5').update(content).digest('hex');
};

// 导入教辅数据
const importTutorialData = async (req, res) => {
  let { version, year, data } = req.body;

  console.log('导入教辅数据请求:', { version, year, dataType: typeof data, isArray: Array.isArray(data), dataLength: Array.isArray(data) ? data.length : 'N/A' });

  if (!data) {
    console.error('数据为空，req.body:', req.body);
    return res.status(400).json(errorResponse('数据为空'));
  }

  // 处理数据格式：如果 data 是对象且有 data 属性，则提取内部数组
  if (data && typeof data === 'object' && !Array.isArray(data) && data.data) {
    console.log('检测到嵌套 data 属性，提取内部数组');
    data = data.data;
  }

  if (!Array.isArray(data) || data.length === 0) {
    console.error('数据验证失败: data 不是数组或为空，实际类型:', typeof data, '值:', data);
    return res.status(400).json(errorResponse('数据格式错误或为空数组'));
  }

  // 版本默认为当前年份
  if (!version || typeof version !== 'string' || version.trim() === '') {
    console.log('版本为空，使用默认值');
    version = new Date().getFullYear().toString() + '版';
  }

  const connection = await mysqlPool.getConnection();

  try {
    await connection.beginTransaction();

    // 统计数据
    const globalStats = {
      tutorialsCreated: 0,
      tutorialsUpdated: 0,
      chaptersCreated: 0,
      questionsCreated: 0,
      questionsReused: 0,
      linksCreated: 0
    };

    // 为 data 数组中的每本书创建独立的教辅
    for (const book of data) {
      const tutorialName = book?.name || '未命名教辅';
      const subject = tutorialName;

      console.log('处理教辅:', tutorialName, '版本:', version);

      // 1. 创建或获取教辅
      let tutorialId;
      const [existingTutorial] = await connection.query(
        'SELECT id FROM computer1_tutorial WHERE name = ? AND version = ?',
        [tutorialName, version]
      );

      if (existingTutorial.length > 0) {
        tutorialId = existingTutorial[0].id;
        globalStats.tutorialsUpdated++;
        // 更新科目
        await connection.query(
          'UPDATE computer1_tutorial SET subject = ? WHERE id = ?',
          [subject, tutorialId]
        );
        // 删除旧的章节和题目关联
        await connection.query('DELETE FROM computer1_tutorial_question WHERE tutorial_id = ?', [tutorialId]);
        await connection.query('DELETE FROM computer1_tutorial_chapter WHERE tutorial_id = ?', [tutorialId]);
      } else {
        const [result] = await connection.query(
          'INSERT INTO computer1_tutorial (name, version, year, subject) VALUES (?, ?, ?, ?)',
          [tutorialName, version, year || null, subject]
        );
        tutorialId = result.insertId;
        globalStats.tutorialsCreated++;
      }
    
    // 2. 遍历书籍的章节创建章节和题目
    for (let chapterIndex = 0; chapterIndex < (book.children || []).length; chapterIndex++) {
      const chapter = book.children[chapterIndex];
      // chapter 是章（如"第一章 绪论"）
      const [chapterResult] = await connection.query(
        'INSERT INTO computer1_tutorial_chapter (tutorial_id, parent_id, name, level, sort_order, subject) VALUES (?, 0, ?, 1, ?, ?)',
        [tutorialId, chapter.name, chapter.id || chapterIndex + 1, subject || tutorialName]
      );
      const chapterId = chapterResult.insertId;
      globalStats.chaptersCreated++;

      // 检测数据结构：三层结构（章->节->题目）或两层结构（章->题目）
      // 三层结构：章有children（节），且章本身没有question_banks或question_banks为空
      const hasSections = chapter.children && chapter.children.length > 0 && 
                          (!chapter.question_banks || chapter.question_banks.length === 0);
        
        if (hasSections) {
          // 三层结构：章 -> 节 -> 题目
          for (let sectionIndex = 0; sectionIndex < (chapter.children || []).length; sectionIndex++) {
            const section = chapter.children[sectionIndex];
            // section 是节（如"1.1 数据结构的基本概念"）
            const [sectionResult] = await connection.query(
              'INSERT INTO computer1_tutorial_chapter (tutorial_id, parent_id, name, level, sort_order, subject) VALUES (?, ?, ?, 2, ?, ?)',
              [tutorialId, chapterId, section.name, section.id || sectionIndex + 1, subject || tutorialName]
            );
            const sectionId = sectionResult.insertId;
            globalStats.chaptersCreated++;
            
            // 遍历题库中的题目
            for (const questionBank of (section.question_banks || [])) {
              for (const question of (questionBank.questions || [])) {
              // 计算题目哈希
              const questionHash = calculateQuestionHash(question);
              
              let questionId;
              
              // 通过 content_hash 字段查找是否已存在
              const [existingQuestions] = await connection.query(
                'SELECT question_id FROM computer1_question WHERE content_hash = ? LIMIT 1',
                [questionHash]
              );
              
              // 映射题型 (与前端保持一致)
              let exerciseType = 1; // 默认单选
              const typeName = question.exerciseType || '单选题';
              if (typeName.includes('单选')) exerciseType = 1;
              else if (typeName.includes('多选')) exerciseType = 2;
              else if (typeName.includes('填空')) exerciseType = 3;
              else if (typeName.includes('解答') || typeName.includes('综合')) exerciseType = 4;
              else if (typeName.includes('判断')) exerciseType = 5;
              
              // 解析 knowledgeTags 获取科目和章节
              let majorId = null;
              let chapterIdForQuestion = null;
              const knowledgeTags = question.knowledgeTags || [];
              
              if (knowledgeTags.length > 0) {
                // 模式二：knowledgeTags 全部是考点组ID
                const firstTagId = knowledgeTags.find(tag => tag && (typeof tag === 'number' || (typeof tag === 'string' && tag.length > 10 && /^\d+$/.test(tag))));
                
                if (firstTagId) {
                  try {
                    const [tagRows] = await connection.query(
                      `SELECT kt.chapter_id, c.major_id 
                       FROM computer1_knowledge_tag kt 
                       LEFT JOIN computer1_chapter c ON kt.chapter_id = c.chapter_id 
                       WHERE kt.tag_id = ? OR kt.exam_group_id = ?
                       LIMIT 1`,
                      [firstTagId, firstTagId]
                    );
                    
                    if (tagRows.length > 0) {
                      chapterIdForQuestion = tagRows[0].chapter_id;
                      majorId = tagRows[0].major_id;
                    }
                  } catch (err) {
                    console.error('根据考点组ID查询章节信息失败:', err);
                  }
                }
              }
              
              if (existingQuestions.length > 0) {
                // 复用现有题目
                questionId = existingQuestions[0].question_id;
                globalStats.questionsReused++;
                
                // 更新现有题目的科目和章节信息（如果之前没有）
                try {
                  await connection.query(
                    'UPDATE computer1_question SET major_id = COALESCE(major_id, ?), chapter_id = COALESCE(chapter_id, ?) WHERE question_id = ?',
                    [majorId, chapterIdForQuestion, questionId]
                  );
                } catch (err) {
                  console.error('更新题目科目章节失败:', err);
                }
              } else {
                // 创建新题目
                questionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                
                await connection.query(`
                  INSERT INTO computer1_question (
                    question_id, content_hash, exercise_type, exercise_type_name, stem, 
                    answer, analysis, from_school, exam_time, exam_code, 
                    exam_full_name, exercise_number, total_score, major_id, chapter_id, create_time
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                `, [
                  questionId,
                  questionHash,
                  exerciseType,
                  typeName,
                  question.stem,
                  question.answer,
                  question.analysis,
                  question.fromSchool || null,
                  question.examTime || null,
                  question.examCode || null,
                  question.examFullName || null,
                  question.exerciseNumber || 0,
                  question.totalScore || 0,
                  majorId,
                  chapterIdForQuestion
                ]);
                
                globalStats.questionsCreated++;
              }
              
              // 保存选项（选择题）- 无论题目是否已存在都执行
              const options = question.options;
              if (options && typeof options === 'object' && !Array.isArray(options)) {
                // 先检查是否已有选项
                const [existingOptions] = await connection.query(
                  'SELECT COUNT(*) as count FROM computer1_question_option WHERE question_id = ?',
                  [questionId]
                );
                
                // 如果没有选项，则添加
                if (existingOptions[0].count === 0) {
                  const optionEntries = Object.entries(options);
                  for (let i = 0; i < optionEntries.length; i++) {
                    const [key, value] = optionEntries[i];
                    let sortVal = i + 1;
                    if (key && typeof key === 'string') {
                      sortVal = key.charCodeAt(0);
                    }
                    try {
                      await connection.query(
                        'INSERT INTO computer1_question_option (question_id, option_key, option_value, option_sort) VALUES (?, ?, ?, ?)',
                        [questionId, key, value, sortVal]
                      );
                    } catch (err) {
                      if (err.code !== 'ER_DUP_ENTRY') {
                        console.error('创建选项失败:', err);
                      }
                    }
                  }
                }
              }
              
              // 保存小题（解答题）- 无论题目是否已存在都执行
              if (exerciseType === 4 && question.subs && Array.isArray(question.subs)) {
                // 先检查是否已有小题
                const [existingSubs] = await connection.query(
                  'SELECT COUNT(*) as count FROM computer1_question_sub WHERE question_id = ?',
                  [questionId]
                );
                
                // 如果没有小题，则添加
                if (existingSubs[0].count === 0) {
                  for (let i = 0; i < question.subs.length; i++) {
                    const sub = question.subs[i];
                    try {
                      await connection.query(
                        'INSERT INTO computer1_question_sub (question_id, stem, answer, analysis, question_order, score) VALUES (?, ?, ?, ?, ?, ?)',
                        [
                          questionId,
                          sub.stem || sub.sub_stem || '',
                          sub.answer || sub.sub_answer || '',
                          sub.analysis || sub.sub_analysis || '',
                          i + 1,
                          sub.score || sub.totalScore || 0
                        ]
                      );
                    } catch (err) {
                      if (err.code !== 'ER_DUP_ENTRY') {
                        console.error('创建小题失败:', err);
                      }
                    }
                  }
                }
              }
              
              // 保存 knowledgeTags 关联 - 无论题目是否已存在都执行
              if (knowledgeTags.length > 0) {
                for (const tagId of knowledgeTags) {
                  if (tagId && (typeof tagId === 'number' || (typeof tagId === 'string' && tagId.length > 10 && /^\d+$/.test(tagId)))) {
                    try {
                      // 检查考点是否存在
                      const [existingTag] = await connection.query(
                        'SELECT tag_id FROM computer1_knowledge_tag WHERE tag_id = ? OR exam_group_id = ?',
                        [tagId, tagId]
                      );
                      
                      if (existingTag.length > 0) {
                        // 创建题目与考点的关联（忽略重复）
                        await connection.query(
                          'INSERT IGNORE INTO computer1_question_tag_relation (question_id, tag_id) VALUES (?, ?)',
                          [questionId, existingTag[0].tag_id]
                        );
                      }
                    } catch (err) {
                      console.error('创建考点关联失败:', err);
                    }
                  }
                }
              }
              
              // 创建题目关联（允许重复）
              await connection.query(
                'INSERT INTO computer1_tutorial_question (tutorial_id, chapter_id, question_id, sort_order) VALUES (?, ?, ?, ?)',
                [tutorialId, sectionId, questionId, question.exerciseNumber || 0]
              );
              globalStats.linksCreated++;
            }
          }
          
          // 更新节的题目数量
          const [sectionCount] = await connection.query(
            'SELECT COUNT(*) as count FROM computer1_tutorial_question WHERE chapter_id = ?',
            [sectionId]
          );
          await connection.query(
            'UPDATE computer1_tutorial_chapter SET question_count = ? WHERE id = ?',
            [sectionCount[0].count, sectionId]
          );
        }
        
        // 更新章的题目数量（三层结构：汇总所有节的题目）
        const [chapterCount] = await connection.query(
          'SELECT COALESCE(SUM(question_count), 0) as count FROM computer1_tutorial_chapter WHERE parent_id = ?',
          [chapterId]
        );
        await connection.query(
          'UPDATE computer1_tutorial_chapter SET question_count = ? WHERE id = ?',
          [chapterCount[0].count, chapterId]
        );
        } else {
          // 两层结构：章 -> 题目（没有节）
          // 为两层结构创建一个默认的小节，以便前端统一显示
          const [defaultSectionResult] = await connection.query(
            'INSERT INTO computer1_tutorial_chapter (tutorial_id, parent_id, name, level, sort_order, subject) VALUES (?, ?, ?, 2, ?, ?)',
            [tutorialId, chapterId, '本章习题', 1, subject || tutorialName]
          );
          const defaultSectionId = defaultSectionResult.insertId;
          globalStats.chaptersCreated++;
          
          for (const questionBank of (chapter.question_banks || [])) {
            for (const question of (questionBank.questions || [])) {
              // 计算题目哈希
              const questionHash = calculateQuestionHash(question);
              
              let questionId;
              
              // 通过 content_hash 字段查找是否已存在
              const [existingQuestions] = await connection.query(
                'SELECT question_id FROM computer1_question WHERE content_hash = ? LIMIT 1',
                [questionHash]
              );
              
              // 映射题型
              let exerciseType = 1;
              const typeName = question.exerciseType || '单选题';
              if (typeName.includes('单选')) exerciseType = 1;
              else if (typeName.includes('多选')) exerciseType = 2;
              else if (typeName.includes('填空')) exerciseType = 3;
              else if (typeName.includes('解答') || typeName.includes('综合')) exerciseType = 4;
              else if (typeName.includes('判断')) exerciseType = 5;
              
              // 解析 knowledgeTags 获取科目和章节
              let majorId = null;
              let chapterIdForQuestion = null;
              const knowledgeTags = question.knowledgeTags || [];
              
              if (knowledgeTags.length > 0) {
                const firstTagId = knowledgeTags.find(tag => tag && (typeof tag === 'number' || (typeof tag === 'string' && tag.length > 10 && /^\d+$/.test(tag))));
                
                if (firstTagId) {
                  try {
                    const [tagRows] = await connection.query(
                      `SELECT kt.chapter_id, c.major_id 
                       FROM computer1_knowledge_tag kt 
                       LEFT JOIN computer1_chapter c ON kt.chapter_id = c.chapter_id 
                       WHERE kt.tag_id = ? OR kt.exam_group_id = ?
                       LIMIT 1`,
                      [firstTagId, firstTagId]
                    );
                    
                    if (tagRows.length > 0) {
                      chapterIdForQuestion = tagRows[0].chapter_id;
                      majorId = tagRows[0].major_id;
                    }
                  } catch (err) {
                    console.error('根据考点组ID查询章节信息失败:', err);
                  }
                }
              }
              
              if (existingQuestions.length > 0) {
                questionId = existingQuestions[0].question_id;
                globalStats.questionsReused++;
                
                try {
                  await connection.query(
                    'UPDATE computer1_question SET major_id = COALESCE(major_id, ?), chapter_id = COALESCE(chapter_id, ?) WHERE question_id = ?',
                    [majorId, chapterIdForQuestion, questionId]
                  );
                } catch (err) {
                  console.error('更新题目科目章节失败:', err);
                }
              } else {
                questionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                
                await connection.query(`
                  INSERT INTO computer1_question (
                    question_id, content_hash, exercise_type, exercise_type_name, stem, 
                    answer, analysis, from_school, exam_time, exam_code, 
                    exam_full_name, exercise_number, total_score, major_id, chapter_id, create_time
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                `, [
                  questionId,
                  questionHash,
                  exerciseType,
                  typeName,
                  question.stem,
                  question.answer,
                  question.analysis,
                  question.fromSchool || null,
                  question.examTime || null,
                  question.examCode || null,
                  question.examFullName || null,
                  question.exerciseNumber || 0,
                  question.totalScore || 0,
                  majorId,
                  chapterIdForQuestion
                ]);
                
                globalStats.questionsCreated++;
              }
              
              // 保存选项
              const options = question.options;
              if (options && typeof options === 'object' && !Array.isArray(options)) {
                const [existingOptions] = await connection.query(
                  'SELECT COUNT(*) as count FROM computer1_question_option WHERE question_id = ?',
                  [questionId]
                );
                
                if (existingOptions[0].count === 0) {
                  const optionEntries = Object.entries(options);
                  for (let i = 0; i < optionEntries.length; i++) {
                    const [key, value] = optionEntries[i];
                    let sortVal = i + 1;
                    if (key && typeof key === 'string') {
                      sortVal = key.charCodeAt(0);
                    }
                    try {
                      await connection.query(
                        'INSERT INTO computer1_question_option (question_id, option_key, option_value, option_sort) VALUES (?, ?, ?, ?)',
                        [questionId, key, value, sortVal]
                      );
                    } catch (err) {
                      if (err.code !== 'ER_DUP_ENTRY') {
                        console.error('创建选项失败:', err);
                      }
                    }
                  }
                }
              }
              
              // 保存小题
              if (exerciseType === 4 && question.subs && Array.isArray(question.subs)) {
                const [existingSubs] = await connection.query(
                  'SELECT COUNT(*) as count FROM computer1_question_sub WHERE question_id = ?',
                  [questionId]
                );
                
                if (existingSubs[0].count === 0) {
                  for (let i = 0; i < question.subs.length; i++) {
                    const sub = question.subs[i];
                    try {
                      await connection.query(
                        'INSERT INTO computer1_question_sub (question_id, stem, answer, analysis, question_order, score) VALUES (?, ?, ?, ?, ?, ?)',
                        [
                          questionId,
                          sub.stem || sub.sub_stem || '',
                          sub.answer || sub.sub_answer || '',
                          sub.analysis || sub.sub_analysis || '',
                          i + 1,
                          sub.score || sub.totalScore || 0
                        ]
                      );
                    } catch (err) {
                      if (err.code !== 'ER_DUP_ENTRY') {
                        console.error('创建小题失败:', err);
                      }
                    }
                  }
                }
              }
              
              // 保存 knowledgeTags 关联
              if (knowledgeTags.length > 0) {
                for (const tagId of knowledgeTags) {
                  if (tagId && (typeof tagId === 'number' || (typeof tagId === 'string' && tagId.length > 10 && /^\d+$/.test(tagId)))) {
                    try {
                      const [existingTag] = await connection.query(
                        'SELECT tag_id FROM computer1_knowledge_tag WHERE tag_id = ? OR exam_group_id = ?',
                        [tagId, tagId]
                      );
                      
                      if (existingTag.length > 0) {
                        await connection.query(
                          'INSERT IGNORE INTO computer1_question_tag_relation (question_id, tag_id) VALUES (?, ?)',
                          [questionId, existingTag[0].tag_id]
                        );
                      }
                    } catch (err) {
                      console.error('创建考点关联失败:', err);
                    }
                  }
                }
              }
              
              // 创建题目关联（使用默认小节ID作为chapter_id）
              await connection.query(
                'INSERT INTO computer1_tutorial_question (tutorial_id, chapter_id, question_id, sort_order) VALUES (?, ?, ?, ?)',
                [tutorialId, defaultSectionId, questionId, question.exerciseNumber || 0]
              );
              globalStats.linksCreated++;
            }
          }
          
          // 更新默认小节的题目数量
          const [sectionCount] = await connection.query(
            'SELECT COUNT(*) as count FROM computer1_tutorial_question WHERE chapter_id = ?',
            [defaultSectionId]
          );
          await connection.query(
            'UPDATE computer1_tutorial_chapter SET question_count = ? WHERE id = ?',
            [sectionCount[0].count, defaultSectionId]
          );
          
          // 更新章的题目数量（汇总默认小节的题目）
          const [chapterCount] = await connection.query(
            'SELECT COALESCE(SUM(question_count), 0) as count FROM computer1_tutorial_chapter WHERE parent_id = ?',
            [chapterId]
          );
          await connection.query(
            'UPDATE computer1_tutorial_chapter SET question_count = ? WHERE id = ?',
            [chapterCount[0].count, chapterId]
          );
        }
      }
      
      // 更新当前教辅总题数（使用关联数，不去重）
      const [tutorialCount] = await connection.query(
        'SELECT COUNT(*) as count FROM computer1_tutorial_question WHERE tutorial_id = ?',
        [tutorialId]
      );
      await connection.query(
        'UPDATE computer1_tutorial SET total_questions = ? WHERE id = ?',
        [tutorialCount[0].count, tutorialId]
      );
    }
    
    await connection.commit();
    res.json(successResponse({
      ...globalStats
    }, `导入成功：创建${globalStats.tutorialsCreated}个新教辅，更新${globalStats.tutorialsUpdated}个教辅`));
    
  } catch (error) {
    await connection.rollback();
    console.error('导入教辅数据失败:', error);
    res.status(500).json(errorResponse('导入失败: ' + error.message));
  } finally {
    connection.release();
  }
};

// 获取章节列表
const getChapters = async (req, res) => {
  try {
    const { tutorialId } = req.params;
    
    // 获取所有章节
    const [chapters] = await mysqlPool.query(
      'SELECT * FROM computer1_tutorial_chapter WHERE tutorial_id = ? ORDER BY sort_order ASC, id ASC',
      [tutorialId]
    );
    
    // 构建树形结构
    const chapterMap = {};
    const tree = [];
    
    chapters.forEach(chapter => {
      chapterMap[chapter.id] = { ...chapter, children: [] };
    });
    
    chapters.forEach(chapter => {
      if (chapter.parent_id && chapterMap[chapter.parent_id]) {
        chapterMap[chapter.parent_id].children.push(chapterMap[chapter.id]);
      } else if (!chapter.parent_id || chapter.parent_id === 0) {
        tree.push(chapterMap[chapter.id]);
      }
    });
    
    res.json(successResponse(tree));
  } catch (error) {
    console.error('获取章节列表失败:', error);
    res.status(500).json(errorResponse('获取章节列表失败'));
  }
};

// 创建章节
const createChapter = async (req, res) => {
  try {
    const { tutorialId } = req.params;
    const { name, parent_id, level, sort_order } = req.body;
    
    if (!name) {
      return res.status(400).json(errorResponse('章节名称不能为空'));
    }
    
    const [result] = await mysqlPool.query(
      `INSERT INTO computer1_tutorial_chapter (tutorial_id, name, parent_id, level, sort_order, question_count) 
       VALUES (?, ?, ?, ?, ?, 0)`,
      [tutorialId, name, parent_id || 0, level || 1, sort_order || 0]
    );
    
    res.json(successResponse({ 
      id: result.insertId,
      tutorial_id: tutorialId,
      name,
      parent_id: parent_id || 0,
      level: level || 1,
      sort_order: sort_order || 0
    }, '创建章节成功'));
  } catch (error) {
    console.error('创建章节失败:', error);
    res.status(500).json(errorResponse('创建章节失败'));
  }
};

// 更新章节
const updateChapter = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parent_id, sort_order } = req.body;
    
    const updates = [];
    const params = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (parent_id !== undefined) {
      updates.push('parent_id = ?');
      params.push(parent_id);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      params.push(sort_order);
    }
    
    if (updates.length === 0) {
      return res.status(400).json(errorResponse('没有要更新的字段'));
    }
    
    params.push(id);
    
    await mysqlPool.query(
      `UPDATE computer1_tutorial_chapter SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    res.json(successResponse(null, '更新章节成功'));
  } catch (error) {
    console.error('更新章节失败:', error);
    res.status(500).json(errorResponse('更新章节失败'));
  }
};

// 删除章节
const deleteChapter = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    
    // 获取章节信息
    const [chapters] = await connection.query(
      'SELECT * FROM computer1_tutorial_chapter WHERE id = ?',
      [id]
    );
    
    if (chapters.length === 0) {
      await connection.rollback();
      return res.status(404).json(errorResponse('章节不存在'));
    }
    
    const chapter = chapters[0];
    
    if (chapter.level === 1) {
      // 如果是章，先删除其下的所有节
      const [sections] = await connection.query(
        'SELECT id FROM computer1_tutorial_chapter WHERE parent_id = ?',
        [id]
      );
      
      for (const section of sections) {
        // 删除节的题目关联
        await connection.query(
          'DELETE FROM computer1_tutorial_question WHERE chapter_id = ?',
          [section.id]
        );
        // 删除节
        await connection.query(
          'DELETE FROM computer1_tutorial_chapter WHERE id = ?',
          [section.id]
        );
      }
    }
    
    // 删除当前章节的题目关联
    await connection.query(
      'DELETE FROM computer1_tutorial_question WHERE chapter_id = ?',
      [id]
    );
    
    // 删除章节
    await connection.query(
      'DELETE FROM computer1_tutorial_chapter WHERE id = ?',
      [id]
    );
    
    // 更新教辅总题数
    const tutorialId = chapter.tutorial_id;
    const [tutorialCount] = await connection.query(
      'SELECT COUNT(*) as count FROM computer1_tutorial_question WHERE tutorial_id = ?',
      [tutorialId]
    );
    await connection.query(
      'UPDATE computer1_tutorial SET total_questions = ? WHERE id = ?',
      [tutorialCount[0].count, tutorialId]
    );
    
    await connection.commit();
    res.json(successResponse(null, '删除章节成功'));
  } catch (error) {
    await connection.rollback();
    console.error('删除章节失败:', error);
    res.status(500).json(errorResponse('删除章节失败'));
  } finally {
    connection.release();
  }
};

// 替换章节题目
const replaceChapterQuestion = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { chapterId } = req.params;
    const { old_question_id, new_question_id } = req.body;
    
    if (!old_question_id || !new_question_id) {
      await connection.rollback();
      return res.status(400).json(errorResponse('原题目ID和新题目ID不能为空'));
    }
    
    // 获取原记录的 sort_order
    const [oldLinks] = await connection.query(
      'SELECT sort_order, tutorial_id FROM computer1_tutorial_question WHERE chapter_id = ? AND question_id = ?',
      [chapterId, old_question_id]
    );
    
    if (oldLinks.length === 0) {
      await connection.rollback();
      return res.status(404).json(errorResponse('原题目关联不存在'));
    }
    
    const sortOrder = oldLinks[0].sort_order;
    const tutorialId = oldLinks[0].tutorial_id;
    
    // 删除旧关联
    await connection.query(
      'DELETE FROM computer1_tutorial_question WHERE chapter_id = ? AND question_id = ?',
      [chapterId, old_question_id]
    );
    
    // 创建新关联
    await connection.query(
      'INSERT INTO computer1_tutorial_question (tutorial_id, chapter_id, question_id, sort_order) VALUES (?, ?, ?, ?)',
      [tutorialId, chapterId, new_question_id, sortOrder]
    );
    
    await connection.commit();
    res.json(successResponse(null, '替换题目成功'));
  } catch (error) {
    await connection.rollback();
    console.error('替换题目失败:', error);
    res.status(500).json(errorResponse('替换题目失败'));
  } finally {
    connection.release();
  }
};

// 获取教辅的所有题目关联（包含完整题目信息）
const getTutorialQuestions = async (req, res) => {
  try {
    const { tutorialId } = req.params;
    
    // 获取关联关系
    const [links] = await mysqlPool.query(
      'SELECT * FROM computer1_tutorial_question WHERE tutorial_id = ? ORDER BY chapter_id, sort_order',
      [tutorialId]
    );
    
    if (links.length === 0) {
      return res.json(successResponse([]));
    }
    
    // 获取所有题目ID
    const questionIds = links.map(link => link.question_id);
    
    // 获取题目详情
    const [questions] = await mysqlPool.query(
      `SELECT q.*, c.name as chapter_name, tc.name as section_name
       FROM computer1_question q
       LEFT JOIN computer1_tutorial_chapter tc ON tc.id = (
         SELECT chapter_id FROM computer1_tutorial_question 
         WHERE tutorial_id = ? AND question_id = q.question_id LIMIT 1
       )
       LEFT JOIN computer1_tutorial_chapter c ON c.id = tc.parent_id
       WHERE q.question_id IN (?)`,
      [tutorialId, questionIds]
    );
    
    // 获取选项
    const [options] = await mysqlPool.query(
      'SELECT * FROM computer1_question_option WHERE question_id IN (?) ORDER BY question_id, option_sort',
      [questionIds]
    );
    
    // 获取小题
    const [subs] = await mysqlPool.query(
      'SELECT * FROM computer1_question_sub WHERE question_id IN (?) ORDER BY question_id, question_order',
      [questionIds]
    );
    
    // 获取考点关联
    const [tagRelations] = await mysqlPool.query(
      'SELECT * FROM computer1_question_tag_relation WHERE question_id IN (?)',
      [questionIds]
    );
    
    // 获取考点详情
    let tags = [];
    if (tagRelations.length > 0) {
      const tagIds = [...new Set(tagRelations.map(r => r.tag_id))];
      const [tagRows] = await mysqlPool.query(
        `SELECT kt.*, c.chapter_name, c.major_id, s.subject_name as major_name
         FROM computer1_knowledge_tag kt
         LEFT JOIN computer1_chapter c ON kt.chapter_id = c.chapter_id
         LEFT JOIN computer1_subject s ON c.major_id = s.major_id
         WHERE kt.tag_id IN (?)`,
        [tagIds]
      );
      tags = tagRows;
    }
    
    // 组装数据
    const questionMap = {};
    questions.forEach(q => {
      questionMap[q.question_id] = {
        ...q,
        options: [],
        subs: [],
        tags: []
      };
    });
    
    options.forEach(opt => {
      if (questionMap[opt.question_id]) {
        questionMap[opt.question_id].options.push(opt);
      }
    });
    
    subs.forEach(sub => {
      if (questionMap[sub.question_id]) {
        questionMap[sub.question_id].subs.push(sub);
      }
    });
    
    tagRelations.forEach(rel => {
      if (questionMap[rel.question_id]) {
        const tag = tags.find(t => t.tag_id === rel.tag_id);
        if (tag) {
          questionMap[rel.question_id].tags.push(tag);
        }
      }
    });
    
    // 按关联顺序返回
    const result = links.map(link => questionMap[link.question_id]).filter(Boolean);
    
    res.json(successResponse(result));
  } catch (error) {
    console.error('获取教辅题目关联失败:', error);
    res.status(500).json(errorResponse('获取教辅题目关联失败'));
  }
};

// 添加题目关联
const addTutorialQuestion = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { tutorial_id, chapter_id, question_id, sort_order } = req.body;
    
    if (!tutorial_id || !chapter_id || !question_id) {
      await connection.rollback();
      return res.status(400).json(errorResponse('参数不完整'));
    }
    
    // 添加关联
    await connection.query(
      'INSERT INTO computer1_tutorial_question (tutorial_id, chapter_id, question_id, sort_order) VALUES (?, ?, ?, ?)',
      [tutorial_id, chapter_id, question_id, sort_order || 0]
    );
    
    // 更新章节题目数
    await connection.query(
      'UPDATE computer1_tutorial_chapter SET question_count = question_count + 1 WHERE id = ?',
      [chapter_id]
    );
    
    // 更新教辅总题数
    await connection.query(
      'UPDATE computer1_tutorial SET total_questions = total_questions + 1 WHERE id = ?',
      [tutorial_id]
    );
    
    await connection.commit();
    res.json(successResponse(null, '添加题目关联成功'));
  } catch (error) {
    await connection.rollback();
    console.error('添加题目关联失败:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json(errorResponse('该题目已存在于本章节'));
    } else {
      res.status(500).json(errorResponse('添加题目关联失败'));
    }
  } finally {
    connection.release();
  }
};

// 删除题目关联
const removeTutorialQuestion = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { tutorialId, questionId } = req.params;
    
    // 获取关联信息
    const [links] = await connection.query(
      'SELECT chapter_id FROM computer1_tutorial_question WHERE tutorial_id = ? AND question_id = ?',
      [tutorialId, questionId]
    );
    
    if (links.length === 0) {
      await connection.rollback();
      return res.status(404).json(errorResponse('题目关联不存在'));
    }
    
    const chapterId = links[0].chapter_id;
    
    // 删除关联
    await connection.query(
      'DELETE FROM computer1_tutorial_question WHERE tutorial_id = ? AND question_id = ?',
      [tutorialId, questionId]
    );
    
    // 更新章节题目数
    await connection.query(
      'UPDATE computer1_tutorial_chapter SET question_count = question_count - 1 WHERE id = ?',
      [chapterId]
    );
    
    // 更新教辅总题数
    await connection.query(
      'UPDATE computer1_tutorial SET total_questions = total_questions - 1 WHERE id = ?',
      [tutorialId]
    );
    
    await connection.commit();
    res.json(successResponse(null, '删除题目关联成功'));
  } catch (error) {
    await connection.rollback();
    console.error('删除题目关联失败:', error);
    res.status(500).json(errorResponse('删除题目关联失败'));
  } finally {
    connection.release();
  }
};

// 更新题目顺序
const updateTutorialQuestionOrder = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { chapter_id, questions } = req.body;
    
    if (!chapter_id || !questions || !Array.isArray(questions)) {
      await connection.rollback();
      return res.status(400).json(errorResponse('参数不完整'));
    }
    
    // 批量更新题目顺序
    for (const item of questions) {
      await connection.query(
        'UPDATE computer1_tutorial_question SET sort_order = ? WHERE chapter_id = ? AND question_id = ?',
        [item.sort_order, chapter_id, item.question_id]
      );
    }
    
    await connection.commit();
    res.json(successResponse(null, '更新顺序成功'));
  } catch (error) {
    await connection.rollback();
    console.error('更新题目顺序失败:', error);
    res.status(500).json(errorResponse('更新题目顺序失败'));
  } finally {
    connection.release();
  }
};

// ==================== 合集管理 ====================

// 获取合集列表
const getCollections = async (req, res) => {
  try {
    const { status, keyword, page, pageSize } = req.query;

    let sql = 'SELECT * FROM computer1_tutorial_collection WHERE 1=1';
    const params = [];

    if (status !== undefined && status !== '' && status !== null) {
      const statusNum = parseInt(status);
      if (!isNaN(statusNum)) {
        sql += ' AND status = ?';
        params.push(statusNum);
      }
    }
    
    if (keyword) {
      sql += ' AND name LIKE ?';
      params.push(`%${keyword}%`);
    }
    
    // 获取总数
    const [countResult] = await mysqlPool.query(
      `SELECT COUNT(*) as total FROM computer1_tutorial_collection WHERE 1=1 ${sql.replace('SELECT * FROM computer1_tutorial_collection WHERE 1=1', '')}`,
      [...params]
    );
    const total = countResult[0].total;

    sql += ' ORDER BY sort_order ASC, id ASC';
    
    // 分页
    if (page && pageSize) {
      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      sql += ' LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize), offset);
    }

    const [collections] = await mysqlPool.query(sql, params);

    // 获取每个合集的科目列表
    for (const collection of collections) {
      const [subjects] = await mysqlPool.query(
        'SELECT id, name, subject, total_questions FROM computer1_tutorial WHERE collection_id = ? AND status = 1 ORDER BY sort_order ASC',
        [collection.id]
      );
      collection.subjects = subjects;
    }

    res.json(successResponse({
      list: collections,
      total,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || collections.length
    }));
  } catch (error) {
    console.error('获取合集列表失败:', error);
    res.status(500).json(errorResponse('获取合集列表失败'));
  }
};

// 获取合集详情
const getCollectionDetail = async (req, res) => {
  try {
    const { id } = req.params;

    // 获取合集信息
    const [collections] = await mysqlPool.query(
      'SELECT * FROM computer1_tutorial_collection WHERE id = ?',
      [id]
    );

    if (collections.length === 0) {
      return res.status(404).json(errorResponse('合集不存在'));
    }

    const collection = collections[0];

    // 获取合集的科目列表
    const [subjects] = await mysqlPool.query(
      'SELECT * FROM computer1_tutorial WHERE collection_id = ? ORDER BY sort_order ASC',
      [id]
    );

    // 获取每个科目的章节
    for (const subject of subjects) {
      const [chapters] = await mysqlPool.query(
        'SELECT * FROM computer1_tutorial_chapter WHERE tutorial_id = ? ORDER BY level ASC, sort_order ASC',
        [subject.id]
      );
      subject.chapters = chapters;
    }

    collection.subjects = subjects;

    res.json(successResponse(collection));
  } catch (error) {
    console.error('获取合集详情失败:', error);
    res.status(500).json(errorResponse('获取合集详情失败'));
  }
};

// 创建合集
const createCollection = async (req, res) => {
  try {
    const { name, version, year, description } = req.body;

    if (!name || !version) {
      return res.status(400).json(errorResponse('合集名称和版本不能为空'));
    }

    const [result] = await mysqlPool.query(
      'INSERT INTO computer1_tutorial_collection (name, version, year, description, status) VALUES (?, ?, ?, ?, 1)',
      [name, version, year, description]
    );

    res.json(successResponse({
      id: result.insertId,
      name,
      version,
      year,
      description
    }, '创建合集成功'));
  } catch (error) {
    console.error('创建合集失败:', error);
    if (error.message.includes('Duplicate entry')) {
      res.status(400).json(errorResponse('该合集名称和版本已存在'));
    } else {
      res.status(500).json(errorResponse('创建合集失败'));
    }
  }
};

// 更新合集
const updateCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, version, year, description, status } = req.body;

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (version !== undefined) {
      updates.push('version = ?');
      params.push(version);
    }
    if (year !== undefined) {
      updates.push('year = ?');
      params.push(year);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json(errorResponse('没有要更新的字段'));
    }

    params.push(id);

    await mysqlPool.query(
      `UPDATE computer1_tutorial_collection SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json(successResponse(null, '更新合集成功'));
  } catch (error) {
    console.error('更新合集失败:', error);
    res.status(500).json(errorResponse('更新合集失败'));
  }
};

// 删除合集
const deleteCollection = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // 获取合集中的所有教辅ID
    const [tutorials] = await connection.query(
      'SELECT id FROM computer1_tutorial WHERE collection_id = ?',
      [id]
    );

    const tutorialIds = tutorials.map(t => t.id);

    // 删除所有教辅关联的题目
    if (tutorialIds.length > 0) {
      await connection.query(
        'DELETE FROM computer1_tutorial_question WHERE tutorial_id IN (?)',
        [tutorialIds]
      );
    }

    // 删除所有章节
    await connection.query(
      'DELETE FROM computer1_tutorial_chapter WHERE tutorial_id IN (SELECT id FROM computer1_tutorial WHERE collection_id = ?)',
      [id]
    );

    // 删除所有教辅
    await connection.query(
      'DELETE FROM computer1_tutorial WHERE collection_id = ?',
      [id]
    );

    // 删除合集
    await connection.query(
      'DELETE FROM computer1_tutorial_collection WHERE id = ?',
      [id]
    );

    await connection.commit();
    res.json(successResponse(null, '删除合集成功'));
  } catch (error) {
    await connection.rollback();
    console.error('删除合集失败:', error);
    res.status(500).json(errorResponse('删除合集失败'));
  } finally {
    connection.release();
  }
};

// 重置教辅ID
const resetTutorialIds = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();

    // 只重置教辅表的ID
    const [tutorialMax] = await connection.query('SELECT MAX(id) as max_id FROM computer1_tutorial');
    const maxTutorialId = tutorialMax[0].max_id || 0;

    if (maxTutorialId > 0) {
      // 获取所有教辅，按id排序
      const [tutorials] = await connection.query('SELECT id FROM computer1_tutorial ORDER BY id');
      for (let i = 0; i < tutorials.length; i++) {
        const oldId = tutorials[i].id;
        const newId = i + 1;
        if (oldId !== newId) {
          // 更新教辅ID（需要处理外键约束）
          // 先更新外键关联表
          await connection.query('UPDATE computer1_tutorial_chapter SET tutorial_id = ? WHERE tutorial_id = ?', [newId + 1000000, oldId]);
          await connection.query('UPDATE computer1_tutorial_question SET tutorial_id = ? WHERE tutorial_id = ?', [newId + 1000000, oldId]);
          // 更新主表
          await connection.query('UPDATE computer1_tutorial SET id = ? WHERE id = ?', [newId + 1000000, oldId]);
        }
      }
      // 第二次遍历，将临时ID改回正确ID
      for (let i = 0; i < tutorials.length; i++) {
        const newId = i + 1;
        await connection.query('UPDATE computer1_tutorial_chapter SET tutorial_id = ? WHERE tutorial_id = ?', [newId, newId + 1000000]);
        await connection.query('UPDATE computer1_tutorial_question SET tutorial_id = ? WHERE tutorial_id = ?', [newId, newId + 1000000]);
        await connection.query('UPDATE computer1_tutorial SET id = ? WHERE id = ?', [newId, newId + 1000000]);
      }
    }

    // 重置教辅表的自增计数器
    const [tutorialCount] = await connection.query('SELECT COUNT(*) as count FROM computer1_tutorial');
    if (tutorialCount[0].count > 0) {
      await connection.query('ALTER TABLE computer1_tutorial AUTO_INCREMENT = ?', [tutorialCount[0].count + 1]);
    } else {
      await connection.query('ALTER TABLE computer1_tutorial AUTO_INCREMENT = 1');
    }

    await connection.commit();
    res.json(successResponse(null, '教辅ID重置成功，从1开始编号'));
  } catch (error) {
    await connection.rollback();
    console.error('重置ID失败:', error);
    res.status(500).json(errorResponse('重置ID失败: ' + error.message));
  } finally {
    connection.release();
  }
};

module.exports = {
  getTutorials,
  getTutorialDetail,
  getChapters,
  getChapterQuestions,
  createTutorial,
  updateTutorial,
  deleteTutorial,
  importTutorialData,
  createChapter,
  updateChapter,
  deleteChapter,
  replaceChapterQuestion,
  // 教辅题目关联
  getTutorialQuestions,
  addTutorialQuestion,
  removeTutorialQuestion,
  updateTutorialQuestionOrder,
  // 合集管理
  getCollections,
  getCollectionDetail,
  createCollection,
  updateCollection,
  deleteCollection,
  // 重置ID
  resetTutorialIds
};
