const mysqlPool = require('../config/mysql');
const { successResponse, errorResponse } = require('../utils/response');
const crypto = require('crypto');

// 生成唯一ID
const generateId = () => {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

// 获取科目列表
const getSubjects = async (req, res) => {
  try {
    const { admin } = req.query;
    
    // 管理员接口返回所有科目，普通接口只返回上架的
    let sql = 'SELECT major_id as id, subject_name as name, subject_code as code, is_on_shelf FROM computer1_subject';
    const params = [];
    
    if (!admin) {
      sql += ' WHERE is_on_shelf = 1';
    }
    
    sql += ' ORDER BY sort ASC, subject_name ASC';
    
    const [subjects] = await mysqlPool.query(sql, params);
    res.json(successResponse(subjects));
  } catch (error) {
    console.error('获取计算机科目列表失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 创建科目
const createSubject = async (req, res) => {
  try {
    const { subject_name, subject_code, sort = 0, category_name, is_on_shelf = 1 } = req.body;
    
    if (!subject_name) {
      return res.status(400).json(errorResponse('科目名称不能为空'));
    }
    
    const major_id = generateId();
    
    await mysqlPool.query(
      'INSERT INTO computer1_subject (major_id, subject_name, subject_code, sort, is_on_shelf, category_name) VALUES (?, ?, ?, ?, ?, ?)',
      [major_id, subject_name, subject_code || null, sort, is_on_shelf, category_name || null]
    );
    
    res.json(successResponse({ id: major_id }, '科目创建成功'));
  } catch (error) {
    console.error('创建科目失败:', error);
    res.status(500).json(errorResponse('创建科目失败: ' + error.message));
  }
};

// 更新科目
const updateSubject = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { subject_name, subject_code, sort, category_name, is_on_shelf } = req.body;
    
    // 构建动态更新SQL
    const updates = [];
    const params = [];
    
    if (subject_name !== undefined) {
      updates.push('subject_name = ?');
      params.push(subject_name);
    }
    if (subject_code !== undefined) {
      updates.push('subject_code = ?');
      params.push(subject_code);
    }
    if (sort !== undefined) {
      updates.push('sort = ?');
      params.push(sort);
    }
    if (is_on_shelf !== undefined) {
      updates.push('is_on_shelf = ?');
      params.push(is_on_shelf);
    }
    if (category_name !== undefined) {
      updates.push('category_name = ?');
      params.push(category_name);
    }
    
    if (updates.length === 0) {
      return res.status(400).json(errorResponse('没有要更新的字段'));
    }
    
    params.push(subjectId);
    
    await mysqlPool.query(
      `UPDATE computer1_subject SET ${updates.join(', ')} WHERE major_id = ?`,
      params
    );
    
    res.json(successResponse(null, '科目更新成功'));
  } catch (error) {
    console.error('更新科目失败:', error);
    res.status(500).json(errorResponse('更新科目失败: ' + error.message));
  }
};

// 删除科目
const deleteSubject = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { subjectId } = req.params;
    
    await connection.beginTransaction();
    
    // 删除相关数据
    await connection.query('DELETE FROM computer1_question WHERE major_id = ?', [subjectId]);
    await connection.query('DELETE FROM computer1_chapter WHERE major_id = ?', [subjectId]);
    await connection.query('DELETE FROM computer1_subject WHERE major_id = ?', [subjectId]);
    
    await connection.commit();
    res.json(successResponse(null, '科目删除成功'));
  } catch (error) {
    await connection.rollback();
    console.error('删除科目失败:', error);
    res.status(500).json(errorResponse('删除科目失败: ' + error.message));
  } finally {
    connection.release();
  }
};

// 获取章节列表
const getChapters = async (req, res) => {
  try {
    const { majorId, pageSize } = req.query;
    const userId = req.userId;
    
    // 如果没有 majorId 但有 pageSize，说明是管理界面获取所有章节
    if (!majorId && pageSize) {
      const [chapters] = await mysqlPool.query(
        `SELECT 
          chapter_id as id, 
          chapter_name as name, 
          chapter_code as code, 
          parent_id as parentId,
          major_id as majorId
        FROM computer1_chapter 
        ORDER BY major_id, sort ASC
        LIMIT ?`,
        [parseInt(pageSize)]
      );
      return res.json(successResponse(chapters));
    }
    
    if (!majorId) return res.status(400).json(errorResponse('科目ID不能为空'));

    // 1. 获取基本章节信息
    const [chapters] = await mysqlPool.query(
      `SELECT 
        chapter_id as id, 
        chapter_name as name, 
        chapter_code as code, 
        parent_id as parentId,
        complete_people_number as completePeople
      FROM computer1_chapter 
      WHERE major_id = ? 
      ORDER BY sort ASC`,
      [majorId]
    );

    if (chapters.length === 0) {
      return res.json(successResponse([]));
    }

    const chapterIds = chapters.map(c => c.id);

    // 2. 批量获取总题数
    // 对于父章节，统计其下所有知识点关联的题目数之和
    // 对于叶子章节（知识点），统计直接关联的题目数
    
    // 2.1 获取所有章节的层级关系（找出哪些是父章节）
    const parentChapterIds = new Set();
    chapters.forEach(c => {
      if (c.parentId) {
        parentChapterIds.add(c.parentId);
      }
    });
    
    // 2.2 获取每个章节直接关联的题目数（用于叶子章节/知识点）
    // 只统计当前科目的题目，且只统计有名称的考点（tag_name不为空且不为纯数字）
    const [directCounts] = await mysqlPool.query(`
      SELECT chapter_id, COUNT(DISTINCT question_id) as total
      FROM (
        -- 直接关联到章节的题目
        SELECT chapter_id, question_id FROM computer1_question WHERE major_id = ?
        UNION ALL
        -- 通过考点关联的题目，但要确保：
        -- 1. 题目属于当前科目
        -- 2. 考点有名称（tag_name不为空且不为纯数字）
        SELECT kt.chapter_id, r.question_id 
        FROM computer1_question_tag_relation r 
        JOIN computer1_knowledge_tag kt ON r.tag_id = kt.tag_id
        JOIN computer1_question q ON r.question_id = q.question_id
        WHERE q.major_id = ? 
          AND kt.chapter_id IN (?)
          AND kt.tag_name IS NOT NULL 
          AND kt.tag_name != ''
          AND kt.tag_name NOT REGEXP '^[0-9]+$'
      ) t
      GROUP BY chapter_id
    `, [majorId, majorId, chapterIds]);

    const directMap = {};
    directCounts.forEach(row => {
      directMap[row.chapter_id] = row.total;
    });
    
    // 2.3 对于父章节，计算其下所有子章节（知识点）的题目数之和
    // 首先获取所有子章节ID映射
    const chapterChildrenMap = {};
    chapters.forEach(c => {
      if (c.parentId) {
        if (!chapterChildrenMap[c.parentId]) {
          chapterChildrenMap[c.parentId] = [];
        }
        chapterChildrenMap[c.parentId].push(c.id);
      }
    });
    
    // 计算每个章节的最终题目数
    const totalMap = {};
    chapters.forEach(c => {
      if (parentChapterIds.has(c.id)) {
        // 父章节：累加所有子章节的题目数
        const childrenIds = chapterChildrenMap[c.id] || [];
        let sum = 0;
        childrenIds.forEach(childId => {
          sum += directMap[childId] || 0;
        });
        totalMap[c.id] = sum;
      } else {
        // 叶子章节：使用直接关联的题目数
        totalMap[c.id] = directMap[c.id] || 0;
      }
    });

    // 3. 批量获取用户刷题数
    // 3.1 获取每个章节直接关联的刷题数
    // 只统计当前科目的题目，且只统计有名称的考点
    const [directBrushedCounts] = await mysqlPool.query(`
      SELECT chapter_id, COUNT(DISTINCT question_id) as brushed
      FROM (
        -- 直接关联到章节的题目
        SELECT q.chapter_id, p.QuestionID as question_id
        FROM computer1_user_progress p
        JOIN computer1_question q ON p.QuestionID = q.question_id
        WHERE p.UserID = ? AND p.Status = 1 AND q.major_id = ?
        UNION ALL
        -- 通过考点关联的题目，但要确保：
        -- 1. 题目属于当前科目
        -- 2. 考点有名称（tag_name不为空且不为纯数字）
        SELECT kt.chapter_id, p.QuestionID as question_id
        FROM computer1_user_progress p
        JOIN computer1_question_tag_relation r ON p.QuestionID = r.question_id
        JOIN computer1_knowledge_tag kt ON r.tag_id = kt.tag_id
        JOIN computer1_question q ON r.question_id = q.question_id
        WHERE p.UserID = ? AND p.Status = 1 AND q.major_id = ? AND kt.chapter_id IN (?)
          AND kt.tag_name IS NOT NULL 
          AND kt.tag_name != ''
          AND kt.tag_name NOT REGEXP '^[0-9]+$'
      ) t
      GROUP BY chapter_id
    `, [userId, majorId, userId, majorId, chapterIds]);

    const directBrushedMap = {};
    directBrushedCounts.forEach(row => {
      directBrushedMap[row.chapter_id] = row.brushed;
    });
    
    // 3.2 对于父章节，计算其下所有子章节的刷题数之和
    const brushedMap = {};
    chapters.forEach(c => {
      if (parentChapterIds.has(c.id)) {
        // 父章节：累加所有子章节的刷题数
        const childrenIds = chapterChildrenMap[c.id] || [];
        let sum = 0;
        childrenIds.forEach(childId => {
          sum += directBrushedMap[childId] || 0;
        });
        brushedMap[c.id] = sum;
      } else {
        // 叶子章节：使用直接关联的刷题数
        brushedMap[c.id] = directBrushedMap[c.id] || 0;
      }
    });

    // 4. 获取子章节（知识点）数量
    const [subCounts] = await mysqlPool.query(`
      SELECT chapter_id, COUNT(*) as count 
      FROM computer1_knowledge_tag 
      WHERE chapter_id IN (?)
      GROUP BY chapter_id
    `, [chapterIds]);

    const subMap = {};
    subCounts.forEach(row => {
      subMap[row.chapter_id] = row.count;
    });

    // 5. 获取章节题集中的题目数量（仅用于显示，不重复计算totalQuestions）
    const [questionSetCounts] = await mysqlPool.query(`
      SELECT chapter_id, COUNT(*) as count 
      FROM computer1_chapter_question_set 
      WHERE chapter_id IN (?)
      GROUP BY chapter_id
    `, [chapterIds]);

    const questionSetMap = {};
    questionSetCounts.forEach(row => {
      questionSetMap[row.chapter_id] = row.count;
    });

    // 6. 合并数据
    // totalMap 已经包含了所有关联到该章节的题目（包括通过题集添加的复制题目）
    // 所以不需要再加 questionSetMap
    const result = chapters.map(c => ({
      ...c,
      totalQuestions: totalMap[c.id] || 0,
      questionSetCount: questionSetMap[c.id] || 0,
      brushedCount: brushedMap[c.id] || 0,
      subChapterCount: subMap[c.id] || 0
    }));

    // 7. 计算科目总题目数（只统计叶子章节，避免重复计算）
    // 同时获取科目总题目数用于顶部进度条显示
    const [subjectTotalResult] = await mysqlPool.query(`
      SELECT COUNT(DISTINCT question_id) as total
      FROM computer1_question
      WHERE major_id = ?
    `, [majorId]);
    
    const subjectTotalQuestions = subjectTotalResult[0]?.total || 0;

    res.json(successResponse({
      chapters: result,
      subjectTotal: subjectTotalQuestions
    }));
  } catch (error) {
    console.error('获取章节列表失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 创建章节
const createChapter = async (req, res) => {
  try {
    const { major_id, chapter_name, chapter_code, parent_id, sort = 0 } = req.body;
    
    if (!major_id || !chapter_name) {
      return res.status(400).json(errorResponse('科目ID和章节名称不能为空'));
    }
    
    const chapter_id = generateId();
    
    await mysqlPool.query(
      'INSERT INTO computer1_chapter (chapter_id, major_id, chapter_name, chapter_code, parent_id, sort) VALUES (?, ?, ?, ?, ?, ?)',
      [chapter_id, major_id, chapter_name, chapter_code || null, parent_id || null, sort]
    );
    
    res.json(successResponse({ id: chapter_id }, '章节创建成功'));
  } catch (error) {
    console.error('创建章节失败:', error);
    res.status(500).json(errorResponse('创建章节失败: ' + error.message));
  }
};

// 更新章节
const updateChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { chapter_name, chapter_code, parent_id, sort } = req.body;
    
    await mysqlPool.query(
      'UPDATE computer1_chapter SET chapter_name = ?, chapter_code = ?, parent_id = ?, sort = ? WHERE chapter_id = ?',
      [chapter_name, chapter_code || null, parent_id || null, sort || 0, chapterId]
    );
    
    res.json(successResponse(null, '章节更新成功'));
  } catch (error) {
    console.error('更新章节失败:', error);
    res.status(500).json(errorResponse('更新章节失败: ' + error.message));
  }
};

// 删除章节
const deleteChapter = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { chapterId } = req.params;
    
    await connection.beginTransaction();
    
    // 删除相关数据
    await connection.query('DELETE FROM computer1_question WHERE chapter_id = ?', [chapterId]);
    await connection.query('DELETE FROM computer1_knowledge_tag WHERE chapter_id = ?', [chapterId]);
    await connection.query('DELETE FROM computer1_chapter WHERE chapter_id = ?', [chapterId]);
    
    await connection.commit();
    res.json(successResponse(null, '章节删除成功'));
  } catch (error) {
    await connection.rollback();
    console.error('删除章节失败:', error);
    res.status(500).json(errorResponse('删除章节失败: ' + error.message));
  } finally {
    connection.release();
  }
};

// 获取知识点列表
const getKnowledgeTags = async (req, res) => {
  try {
    const { chapterId } = req.query;
    const userId = req.userId;
    if (!chapterId) return res.status(400).json(errorResponse('章节ID不能为空'));

    const [tags] = await mysqlPool.query(
      `SELECT 
        kt.tag_id as id, 
        kt.tag_name as name, 
        kt.exam_group_id as examGroupId,
        (SELECT COUNT(DISTINCT r.question_id) FROM computer1_question_tag_relation r JOIN computer1_question q ON r.question_id = q.question_id WHERE r.tag_id = kt.tag_id) as totalQuestions,
        (SELECT COUNT(DISTINCT p.QuestionID) 
         FROM computer1_user_progress p 
         JOIN computer1_question_tag_relation r ON p.QuestionID = r.question_id 
         JOIN computer1_question q ON r.question_id = q.question_id
         WHERE p.UserID = ? AND r.tag_id = kt.tag_id AND p.Status = 1) as brushedCount,
        (SELECT COUNT(DISTINCT p.QuestionID) 
         FROM computer1_user_progress p 
         JOIN computer1_question_tag_relation r ON p.QuestionID = r.question_id 
         JOIN computer1_question q ON r.question_id = q.question_id
         WHERE p.UserID = ? AND r.tag_id = kt.tag_id AND p.Status = 1 AND p.IsCorrect = 0) as wrongCount
      FROM computer1_knowledge_tag kt 
      WHERE kt.chapter_id = ? 
      ORDER BY kt.sort ASC`,
      [userId, userId, chapterId]
    );

    // 计算错误率
    const processedTags = tags.map(tag => {
      const errorRate = tag.brushedCount > 0 ? Math.round((tag.wrongCount / tag.brushedCount) * 100) : 0;
      return {
        ...tag,
        errorRate
      };
    });

    res.json(successResponse(processedTags));
  } catch (error) {
    console.error('获取知识点列表失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取所有知识点标签（不分页，用于自动推断）
const getAllKnowledgeTags = async (req, res) => {
  try {
    const [tags] = await mysqlPool.query(
      `SELECT 
        tag_id,
        tag_name,
        chapter_id,
        exam_group_id
      FROM computer1_knowledge_tag 
      ORDER BY tag_name ASC`
    );

    res.json(successResponse(tags));
  } catch (error) {
    console.error('获取所有知识点标签失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 根据ID获取知识点标签
const getKnowledgeTagById = async (req, res) => {
  try {
    const { tagId } = req.params;
    
    const [tags] = await mysqlPool.query(
      `SELECT 
        tag_id,
        tag_name,
        chapter_id,
        exam_group_id
      FROM computer1_knowledge_tag 
      WHERE tag_id = ?`,
      [tagId]
    );

    if (tags.length === 0) {
      return res.status(404).json(errorResponse('标签不存在'));
    }

    res.json(successResponse(tags[0]));
  } catch (error) {
    console.error('获取知识点标签失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 根据名称获取知识点标签
const getKnowledgeTagByName = async (req, res) => {
  try {
    const { name } = req.query;
    
    if (!name) {
      return res.status(400).json(errorResponse('标签名称不能为空'));
    }
    
    const [tags] = await mysqlPool.query(
      `SELECT 
        tag_id,
        tag_name,
        chapter_id,
        exam_group_id
      FROM computer1_knowledge_tag 
      WHERE tag_name = ?
      LIMIT 1`,
      [name]
    );

    if (tags.length === 0) {
      return res.status(404).json(errorResponse('标签不存在'));
    }

    res.json(successResponse(tags[0]));
  } catch (error) {
    console.error('获取知识点标签失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 根据ID获取章节详情
const getChapterById = async (req, res) => {
  try {
    const { chapterId } = req.params;
    
    const [chapters] = await mysqlPool.query(
      `SELECT 
        chapter_id,
        chapter_name,
        chapter_code,
        major_id,
        parent_id,
        sort
      FROM computer1_chapter 
      WHERE chapter_id = ?`,
      [chapterId]
    );

    if (chapters.length === 0) {
      return res.status(404).json(errorResponse('章节不存在'));
    }

    res.json(successResponse(chapters[0]));
  } catch (error) {
    console.error('获取章节详情失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取题目列表（按章节或知识点）
const getQuestions = async (req, res) => {
  try {
    const { chapterId, tagId, majorId, examGroupId, mode } = req.query;
    let query = `SELECT q.question_id, q.exercise_type, q.exercise_type_name, q.stem, q.level, q.total_score, q.from_school, q.exam_time, q.exam_code, q.exam_full_name, c.chapter_name, s.subject_name as major_name, p_info.paper_name as exam_paper_name 
      FROM computer1_question q 
      LEFT JOIN computer1_chapter c ON q.chapter_id = c.chapter_id 
      LEFT JOIN computer1_subject s ON q.major_id = s.major_id 
      LEFT JOIN (
        SELECT pq.question_id, MAX(p.title) as paper_name 
        FROM computer1_paper_question pq 
        JOIN computer1_paper p ON pq.paper_id = p.id 
        GROUP BY pq.question_id
      ) p_info ON q.question_id = p_info.question_id`;
    const params = [];

    if (tagId) {
      query += ' JOIN computer1_question_tag_relation r ON q.question_id = r.question_id WHERE r.tag_id = ?';
      params.push(tagId);
    } else if (chapterId) {
      query += ' WHERE q.chapter_id = ?';
      params.push(chapterId);
    } else if (majorId) {
      query += ' WHERE q.major_id = ?';
      params.push(majorId);
    } else if (examGroupId) {
      // 检查是否是试卷 ID (支持真题卷和模拟卷)
      const [paperExists] = await mysqlPool.query('SELECT id, title, paper_type FROM computer1_paper WHERE id = ?', [examGroupId]);

      if (paperExists.length > 0) {
        // 如果是试卷 ID，从关联表获取题目，并按 sort_order 排序
        query = `SELECT q.question_id, q.exercise_type, q.exercise_type_name, q.stem, q.level, q.total_score, q.from_school, q.exam_time, q.exam_code, q.exam_full_name, c.chapter_name, s.subject_name as major_name, ? as exam_paper_name 
          FROM computer1_question q 
          LEFT JOIN computer1_chapter c ON q.chapter_id = c.chapter_id 
          LEFT JOIN computer1_subject s ON q.major_id = s.major_id`;
        query += ' JOIN computer1_paper_question pq ON q.question_id = pq.question_id WHERE pq.paper_id = ? ORDER BY pq.sort_order ASC';
        params.push(paperExists[0].title, examGroupId);
        const [questions] = await mysqlPool.query(query, params);
        return res.json(successResponse(questions));
      } else if (examGroupId.includes('::')) {
        // 处理旧的复合 ID 逻辑 (向下兼容)
        query += ' WHERE 1=1';
        const [fromSchool, examTime, examCode, examFullName] = examGroupId.split('::');
        if (fromSchool) {
          query += ' AND q.from_school = ?';
          params.push(fromSchool);
        }
        if (examTime) {
          query += ' AND q.exam_time = ?';
          params.push(examTime);
        }
        if (examCode) {
          query += ' AND q.exam_code = ?';
          params.push(examCode);
        }
        if (examFullName) {
          query += ' AND q.exam_full_name = ?';
          params.push(examFullName);
        }
      } else {
        query += ' WHERE q.exam_group_id = ?';
        params.push(examGroupId);
      }
    } else {
      query += ' WHERE 1=1';
    }

    query += ' ORDER BY q.exercise_number ASC';
    const [questions] = await mysqlPool.query(query, params);
    res.json(successResponse(questions));
  } catch (error) {
    console.error('获取题目列表失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取题目详情
const getQuestionDetails = async (req, res) => {
  try {
    const { questionId } = req.params;
    if (!questionId) return res.status(400).json(errorResponse('题目ID不能为空'));

    // 1. 获取主表信息
    const [questions] = await mysqlPool.query(`
      SELECT q.*, c.chapter_name, s.subject_name as major_name, p_info.paper_name as exam_paper_name
      FROM computer1_question q
      LEFT JOIN computer1_chapter c ON q.chapter_id = c.chapter_id
      LEFT JOIN computer1_subject s ON q.major_id = s.major_id
      LEFT JOIN (
        SELECT pq.question_id, MAX(p.title) as paper_name 
        FROM computer1_paper_question pq 
        JOIN computer1_paper p ON pq.paper_id = p.id
        GROUP BY pq.question_id
      ) p_info ON q.question_id = p_info.question_id
      WHERE q.question_id = ?
      LIMIT 1
    `, [questionId]);
    if (questions.length === 0) return res.status(404).json(errorResponse('题目不存在'));
    const question = questions[0];

    // 2. 获取选项（如果是选择题）
    const [options] = await mysqlPool.query(
      'SELECT option_key, option_value FROM computer1_question_option WHERE question_id = ? ORDER BY option_sort ASC',
      [questionId]
    );
    question.options = options;

    // 3. 获取小题（如果是解答题）
    const [subs] = await mysqlPool.query(
      'SELECT * FROM computer1_question_sub WHERE question_id = ? ORDER BY question_order ASC',
      [questionId]
    );
    question.subs = subs;

    // 4. 获取知识点标签 (包含从章节和科目表中获取名称作为兜底)
    const [tags] = await mysqlPool.query(
      `SELECT 
         r.tag_id, 
         COALESCE(t.tag_name, c.chapter_name, s.subject_name) as tag_name
       FROM computer1_question_tag_relation r
       LEFT JOIN computer1_knowledge_tag t ON r.tag_id = t.tag_id
       LEFT JOIN computer1_chapter c ON r.tag_id = c.chapter_id
       LEFT JOIN computer1_subject s ON r.tag_id = s.major_id
       WHERE r.question_id = ?`,
      [questionId]
    );
    question.tags = tags;

    res.json(successResponse(question));
  } catch (error) {
    console.error('获取题目详情失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 收藏相关
const toggleFavorite = async (req, res) => {
  try {
    const { questionId, categoryId } = req.body;
    const userId = req.userId;

    const [existing] = await mysqlPool.query(
      'SELECT * FROM computer1_favorites WHERE UserID = ? AND QuestionID = ?',
      [userId, questionId]
    );

    if (existing.length > 0) {
      await mysqlPool.query('DELETE FROM computer1_favorites WHERE UserID = ? AND QuestionID = ?', [userId, questionId]);
      res.json(successResponse({ isFavorite: false }, '已取消收藏'));
    } else {
      await mysqlPool.query(
        'INSERT INTO computer1_favorites (UserID, QuestionID, CategoryID) VALUES (?, ?, ?)',
        [userId, questionId, categoryId || null]
      );
      res.json(successResponse({ isFavorite: true }, '收藏成功'));
    }
  } catch (error) {
    console.error('切换收藏状态失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getFavorites = async (req, res) => {
  try {
    const userId = req.userId;
    const { categoryId } = req.query;

    let query = `
      SELECT f.*, q.stem, q.exercise_type_name, q.major_id, s.subject_name
      FROM computer1_favorites f
      JOIN computer1_question q ON f.QuestionID = q.question_id
      JOIN computer1_subject s ON q.major_id = s.major_id
      WHERE f.UserID = ?
    `;
    const params = [userId];

    if (categoryId) {
      query += ' AND f.CategoryID = ?';
      params.push(categoryId);
    }

    query += ' ORDER BY f.CreatedAt DESC';
    const [favorites] = await mysqlPool.query(query, params);
    res.json(successResponse(favorites));
  } catch (error) {
    console.error('获取收藏列表失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const checkFavorite = async (req, res) => {
  try {
    const { questionId } = req.query;
    const userId = req.userId;

    const [existing] = await mysqlPool.query(
      'SELECT * FROM computer1_favorites WHERE UserID = ? AND QuestionID = ?',
      [userId, questionId]
    );

    res.json(successResponse({ isFavorite: existing.length > 0 }));
  } catch (error) {
    console.error('检查收藏状态失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 收藏分类
const getFavoriteCategories = async (req, res) => {
  try {
    const userId = req.userId;
    const [categories] = await mysqlPool.query(
      'SELECT * FROM computer1_favorite_categories WHERE UserID = ? ORDER BY CreatedAt DESC',
      [userId]
    );
    res.json(successResponse(categories));
  } catch (error) {
    console.error('获取收藏分类失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const createFavoriteCategory = async (req, res) => {
  try {
    const { title } = req.body;
    const userId = req.userId;
    if (!title) return res.status(400).json(errorResponse('分类标题不能为空'));

    const [result] = await mysqlPool.query(
      'INSERT INTO computer1_favorite_categories (UserID, Title) VALUES (?, ?)',
      [userId, title]
    );
    res.json(successResponse({ categoryId: result.insertId }, '分类创建成功'));
  } catch (error) {
    console.error('创建收藏分类失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const deleteFavoriteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const userId = req.userId;

    await mysqlPool.query('DELETE FROM computer1_favorite_categories WHERE CategoryID = ? AND UserID = ?', [categoryId, userId]);
    // 将该分类下的题目设为未分类
    await mysqlPool.query('UPDATE computer1_favorites SET CategoryID = NULL WHERE CategoryID = ? AND UserID = ?', [categoryId, userId]);

    res.json(successResponse(null, '分类已删除'));
  } catch (error) {
    console.error('删除收藏分类失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 用户进度
const updateProgress = async (req, res) => {
  try {
    const { questionId, status, lastAnswer, isCorrect } = req.body;
    const userId = req.userId;

    console.log('更新进度请求:', { userId, questionId, status, lastAnswer, isCorrect });

    // 状态映射：将字符串 'completed' 映射为 1，其他为 0
    const statusInt = status === 'completed' ? 1 : 0;
    // 确保 isCorrect 是数字 (0 或 1)
    const isCorrectInt = isCorrect ? 1 : 0;
    // 确保 lastAnswer 为字符串或 null
    const finalLastAnswer = lastAnswer !== undefined ? String(lastAnswer) : null;

    console.log('映射后的数据:', { statusInt, isCorrectInt, finalLastAnswer });

    const [existing] = await mysqlPool.query(
      'SELECT * FROM computer1_user_progress WHERE UserID = ? AND QuestionID = ?',
      [userId, questionId]
    );

    if (existing.length > 0) {
      await mysqlPool.query(
        'UPDATE computer1_user_progress SET Status = ?, LastAnswer = ?, IsCorrect = ? WHERE UserID = ? AND QuestionID = ?',
        [statusInt, finalLastAnswer, isCorrectInt, userId, questionId]
      );
    } else {
      await mysqlPool.query(
        'INSERT INTO computer1_user_progress (UserID, QuestionID, Status, LastAnswer, IsCorrect) VALUES (?, ?, ?, ?, ?)',
        [userId, questionId, statusInt, finalLastAnswer, isCorrectInt]
      );
    }

    // 记录到学习统计 (answer_records)
    try {
      // 获取题目基本信息，用于标识学习记录
      const [qInfo] = await mysqlPool.query(
        'SELECT major_id, chapter_id FROM computer1_question WHERE question_id = ?',
        [questionId]
      );
      
      const [sInfo] = await mysqlPool.query(
        'SELECT subject_name FROM computer1_subject WHERE major_id = ?',
        [qInfo[0]?.major_id]
      );

      const [cInfo] = await mysqlPool.query(
        'SELECT chapter_name FROM computer1_chapter WHERE chapter_id = ?',
        [qInfo[0]?.chapter_id]
      );

      const subjectName = sInfo[0]?.subject_name || '计算机';
      const chapterName = cInfo[0]?.chapter_name || null;
      const chapterId = qInfo[0]?.chapter_id || null;
      
      // 增加一条答题记录
      await mysqlPool.query(
        'INSERT INTO answer_records (userId, subjectId, subjectName, chapterId, chapterName, totalQuestions, correctQuestions, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [userId, 17, subjectName, chapterId, chapterName, 1, isCorrectInt]
      );

      // 更新用户表的总统计数据（level 由数据库生成列自动计算）
      await mysqlPool.query(
        `UPDATE users SET 
          total_questions = total_questions + 1,
          total_correct = total_correct + ?,
          last_study_time = NOW(),
          study_days = CASE 
            WHEN last_study_time IS NULL OR DATE(last_study_time) != CURDATE() 
            THEN study_days + 1 
            ELSE study_days 
          END
        WHERE id = ?`,
        [isCorrectInt, userId]
      );
    } catch (err) {
      console.error('记录刷题统计失败:', err);
    }

    res.json(successResponse(null, '进度已更新'));
  } catch (error) {
    console.error('更新进度失败:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

const getUserProgress = async (req, res) => {
  try {
    const userId = req.userId;
    const [progress] = await mysqlPool.query(
      'SELECT * FROM computer1_user_progress WHERE UserID = ?',
      [userId]
    );
    res.json(successResponse(progress));
  } catch (error) {
    console.error('获取用户进度失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取真题试卷列表
const getExams = async (req, res) => {
  try {
    const { majorId } = req.query;
    let query = `
      SELECT 
        id,
        school as from_school,
        title, 
        year,
        exam_code,
        paper_type,
        CASE 
          WHEN paper_type = 1 THEN '真题卷'
          WHEN paper_type = 2 THEN '模拟卷'
          WHEN school = '全国统考' THEN '统考'
          ELSE '名校真题' 
        END as type,
        (SELECT COUNT(*) FROM computer1_paper_question WHERE paper_id = p.id) as questionCount,
        difficulty
      FROM computer1_paper p
      WHERE 1=1
    `;
    const params = [];
    
    // if (majorId) {
    //   query += ' AND major_id = ?';
    //   params.push(majorId);
    // }
    
    query += `
      ORDER BY 
        paper_type ASC,
        CASE WHEN school = '全国统考' THEN 0 ELSE 1 END,
        year DESC, 
        school ASC,
        title ASC
    `;
    
    const [exams] = await mysqlPool.query(query, params);
    res.json(successResponse(exams));
  } catch (error) {
    console.error('获取真题列表失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 智能组卷相关
const generateSmartPaper = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const { subjectId, scope, counts, title, mode, manualQuestions: manualInputQuestions } = req.body;
    const userId = req.userId;

    let selectedQuestions = [];
    const selectedIds = new Set();

    if (mode === 'manual' && manualInputQuestions && manualInputQuestions.length > 0) {
      // 手动组卷模式
      const questionIds = manualInputQuestions.map(q => q.id);
      
      // 批量查询题目详情
      const [questions] = await connection.query(
        `SELECT question_id, exercise_type_name, level, major_id, chapter_id
         FROM computer1_question
         WHERE question_id IN (?)`,
        [questionIds]
      );

      const questionMap = {};
      questions.forEach(q => {
        questionMap[q.question_id] = q;
      });

      selectedQuestions = manualInputQuestions.map(mq => {
        const q = questionMap[mq.id];
        return {
          ...q,
          question_id: mq.id,
          paperType: q ? q.exercise_type_name : '未知'
        };
      });
    } else {
      // 智能组卷模式
      if (!scope || scope.length === 0) {
        return res.status(400).json(errorResponse('请选择组卷范围'));
      }

      // 辅助函数：从特定池子中选择指定数量的题目
      const selectFromPool = (pool, targetCounts) => {
        const typeMap = {
          '单选题': targetCounts.choice || 0,
          '多选题': targetCounts.multiple || 0,
          '填空题': targetCounts.fill || 0,
          '解答题': targetCounts.analysis || 0,
          '判断题': targetCounts.judge || 0
        };

        for (const [type, count] of Object.entries(typeMap)) {
          if (count <= 0) continue;
          
          let typePool = pool.filter(q => q.exercise_type_name === type && !selectedIds.has(q.question_id));
          if (typePool.length === 0) continue;

          // 排序：难度均衡 > 随机微调
          typePool.sort((a, b) => {
            const scoreA = (a.level || 3);
            const scoreB = (b.level || 3);
            if (scoreB !== scoreA) return scoreB - scoreA;
            return Math.random() - 0.5;
          });

          let typeSelected = 0;
          for (const q of typePool) {
            if (typeSelected >= count) break;
            selectedQuestions.push({ ...q, paperType: type });
            selectedIds.add(q.question_id);
            typeSelected++;
          }
        }
      };

      // 1. 统计并优先处理每个范围项的自定义题量 (科目级或章节级)
      const customTotals = { choice: 0, multiple: 0, fill: 0, analysis: 0, judge: 0 };
      let allPoolQuestions = []; 
      
      for (const item of scope) {
        const { majorId, chapters, counts: itemCounts } = item;
        
        let query = `SELECT question_id, exercise_type_name, level, major_id, chapter_id
                     FROM computer1_question
                     WHERE major_id = ?`;
        const params = [majorId];
        
        // 如果没有指定章节，则获取整个科目的题目
        const [poolQuestions] = await connection.query(query, params);
        allPoolQuestions = allPoolQuestions.concat(poolQuestions);

        if (chapters && chapters.length > 0) {
          for (const chap of chapters) {
            if (chap.counts) {
              customTotals.choice += (chap.counts.choice || 0);
              customTotals.multiple += (chap.counts.multiple || 0);
              customTotals.fill += (chap.counts.fill || 0);
              customTotals.analysis += (chap.counts.analysis || 0);
              customTotals.judge += (chap.counts.judge || 0);
              
              const chapPool = poolQuestions.filter(q => q.chapter_id === chap.id);
              selectFromPool(chapPool, chap.counts);
            }
          }
        } else if (itemCounts) {
          customTotals.choice += (itemCounts.choice || 0);
          customTotals.multiple += (itemCounts.multiple || 0);
          customTotals.fill += (itemCounts.fill || 0);
          customTotals.analysis += (itemCounts.analysis || 0);
          customTotals.judge += (itemCounts.judge || 0);
          selectFromPool(poolQuestions, itemCounts);
        }
      }

      // 2. 处理全局补充题量 (全局题量 counts 是目标总数，减去已通过自定义方式选出的题量)
      const remainingCounts = {
        choice: Math.max(0, (counts.choice || 0) - customTotals.choice),
        multiple: Math.max(0, (counts.multiple || 0) - customTotals.multiple),
        fill: Math.max(0, (counts.fill || 0) - customTotals.fill),
        analysis: Math.max(0, (counts.analysis || 0) - customTotals.analysis),
        judge: Math.max(0, (counts.judge || 0) - customTotals.judge)
      };

      if (Object.values(remainingCounts).some(c => c > 0)) {
        // 从选定范围的联合池中抽取剩余题目
        selectFromPool(allPoolQuestions, remainingCounts);
      }
    }

    if (selectedQuestions.length === 0) {
      throw new Error('未能选出符合条件的题目，请调整组卷范围或题量');
    }

    // 计算试卷平均难度
    const totalLevel = selectedQuestions.reduce((sum, q) => sum + (Number(q.level) || 3), 0);
    const avgDifficulty = selectedQuestions.length > 0 ? totalLevel / selectedQuestions.length : 3;

    // 保存试卷主表
    const crypto = require('crypto');
    const printToken = crypto.randomBytes(24).toString('hex');
    const [paperResult] = await connection.query(
      'INSERT INTO computer1_generated_papers (user_id, title, major_id, config, average_difficulty, print_token) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, title || '智能组卷', subjectId, JSON.stringify({ scope, counts }), avgDifficulty, printToken]
    );
    const paperId = paperResult.insertId;

    // 保存题目关联表
    const typeOrder = { '单选题': 1, '多选题': 2, '填空题': 3, '解答题': 4, '判断题': 5 };
    selectedQuestions.sort((a, b) => {
      const typeDiff = (typeOrder[a.paperType] || 99) - (typeOrder[b.paperType] || 99);
      if (typeDiff !== 0) return typeDiff;
      return 0;
    });

    const values = selectedQuestions.map((q, index) => [
      paperId, q.question_id, index + 1
    ]);

    if (values.length > 0) {
      await connection.query(
        'INSERT INTO computer1_generated_paper_questions (paper_id, question_id, sort_order) VALUES ?',
        [values]
      );
    }

    await connection.commit();
    res.json(successResponse({ paperId, questionCount: selectedQuestions.length }));
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('智能组卷失败:', error);
    res.status(500).json(errorResponse('组卷失败: ' + error.message));
  } finally {
    if (connection) connection.release();
  }
};

const getUserGeneratedPapers = async (req, res) => {
  try {
    const userId = req.userId;
    const [papers] = await mysqlPool.query(
      `SELECT p.id, p.title, p.major_id, p.average_difficulty, p.create_time, p.print_token,
              (SELECT COUNT(*) FROM computer1_generated_paper_questions q WHERE q.paper_id = p.id) as question_count
       FROM computer1_generated_papers p 
       WHERE p.user_id = ? 
       ORDER BY p.create_time DESC`,
      [userId]
    );
    res.json(successResponse(papers));
  } catch (error) {
    console.error('获取用户组卷列表失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getGeneratedPaper = async (req, res) => {
  try {
    const { paperId } = req.params;
    const userId = req.userId;

    const [papers] = await mysqlPool.query(
      'SELECT *, title as exam_paper_name FROM computer1_generated_papers WHERE id = ? AND user_id = ?',
      [paperId, userId]
    );
    if (papers.length === 0) return res.status(404).json(errorResponse('试卷不存在'));

    const paper = papers[0];
    const [questions] = await mysqlPool.query(
      `SELECT gpq.sort_order, q.*
       FROM computer1_generated_paper_questions gpq
       JOIN computer1_question q ON gpq.question_id = q.question_id
       WHERE gpq.paper_id = ?
       ORDER BY gpq.sort_order ASC`,
      [paperId]
    );

    // 获取题目详情（选项、小题、标签）
    for (let q of questions) {
      const [options] = await mysqlPool.query(
        'SELECT option_key, option_value FROM computer1_question_option WHERE question_id = ? ORDER BY option_sort ASC',
        [q.question_id]
      );
      q.options = options;

      const [subs] = await mysqlPool.query(
        'SELECT * FROM computer1_question_sub WHERE question_id = ? ORDER BY question_order ASC',
        [q.question_id]
      );
      q.subs = subs;

      const [tags] = await mysqlPool.query(
        `SELECT t.tag_id, t.tag_name 
         FROM computer1_knowledge_tag t
         JOIN computer1_question_tag_relation r ON t.tag_id = r.tag_id
         WHERE r.question_id = ?`,
        [q.question_id]
      );
      q.tags = tags;
    }

    res.json(successResponse({ ...paper, questions }));
  } catch (error) {
    console.error('获取组卷详情失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getPrintPaper = async (req, res) => {
  try {
    const { paperId } = req.params; // 这里可以是 ID 或 Token
    
    // 优先按 Token 查找
    let [papers] = await mysqlPool.query('SELECT * FROM computer1_generated_papers WHERE print_token = ?', [paperId]);
    
    if (papers.length === 0) {
      // 如果按 Token 没找到，且 paperId 是数字，尝试按 ID 查找
      if (!isNaN(paperId)) {
        [papers] = await mysqlPool.query('SELECT * FROM computer1_generated_papers WHERE id = ?', [paperId]);
      }
    }

    if (papers.length === 0) {
      return res.status(404).send('试卷不存在或链接已失效');
    }

    const paper = papers[0];
    const [questions] = await mysqlPool.query(
      `SELECT gpq.sort_order, q.*
       FROM computer1_generated_paper_questions gpq
       JOIN computer1_question q ON gpq.question_id = q.question_id
       WHERE gpq.paper_id = ?
       ORDER BY gpq.sort_order ASC`,
      [paper.id]
    );

    // 获取题目详情（选项、小题）
    for (let q of questions) {
      const [options] = await mysqlPool.query(
        'SELECT option_key, option_value FROM computer1_question_option WHERE question_id = ? ORDER BY option_sort ASC',
        [q.question_id]
      );
      q.options = options;

      const [subs] = await mysqlPool.query(
        'SELECT * FROM computer1_question_sub WHERE question_id = ? ORDER BY question_order ASC',
        [q.question_id]
      );
      q.subs = subs;
    }

    // 返回专门的打印 HTML 页面
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${paper.title || '智能练习卷'}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
    <style>
        body {
            font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .paper-container {
            max-width: 800px;
            margin: 0 auto;
            background-color: #fff;
            padding: 40px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        .paper-header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
        }
        .paper-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .paper-info {
            font-size: 14px;
            color: #666;
        }
        .question-item {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        .question-header {
            font-weight: bold;
            margin-bottom: 10px;
            display: flex;
            align-items: baseline;
        }
        .question-num {
            margin-right: 10px;
        }
        .question-type {
            font-size: 12px;
            color: #666;
            border: 1px solid #ccc;
            padding: 1px 5px;
            border-radius: 3px;
            margin-right: 10px;
        }
        .question-body {
            margin-bottom: 15px;
        }
        .options-list {
            display: flex;
            flex-wrap: wrap;
            margin-top: 10px;
        }
        .option-item {
            width: 50%;
            margin-bottom: 8px;
            display: flex;
        }
        .option-key {
            font-weight: bold;
            margin-right: 8px;
        }
        .sub-questions {
            margin-top: 15px;
            padding-left: 20px;
        }
        .sub-item {
            margin-bottom: 15px;
        }
        .print-footer {
            margin-top: 50px;
            text-align: center;
            font-size: 12px;
            color: #999;
            border-top: 1px dashed #ccc;
            padding-top: 10px;
        }
        .action-bar {
            position: fixed;
            top: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .btn {
            padding: 10px 20px;
            background-color: #007aff;
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        .btn-secondary {
            background-color: #6c757d;
        }
        @media print {
            body {
                background-color: #fff;
                padding: 0;
            }
            .paper-container {
                box-shadow: none;
                max-width: none;
                width: 100%;
                padding: 0;
            }
            .action-bar {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="action-bar">
        <button class="btn" onclick="window.print()">打印试卷</button>
        <button class="btn btn-secondary" onclick="toggleAnalysis()">显示/隐藏解析</button>
    </div>

    <div class="paper-container">
        <div class="paper-header">
            <div class="paper-title">${paper.title}</div>
            <div class="paper-info">
                <span>题目数量：${questions.length}</span>
                <span style="margin-left: 20px;">生成时间：${new Date(paper.create_time).toLocaleString()}</span>
            </div>
        </div>

        <div class="questions-list">
            ${questions.map((q, index) => `
                <div class="question-item">
                    <div class="question-header">
                        <span class="question-num">${index + 1}.</span>
                        <span class="question-type">${q.exercise_type_name}</span>
                        <div class="question-stem">${q.stem}</div>
                    </div>
                    
                    ${q.options && q.options.length > 0 ? `
                        <div class="options-list">
                            ${q.options.map(opt => `
                                <div class="option-item">
                                    <span class="option-key">${opt.option_key}.</span>
                                    <div class="option-value">${opt.option_value}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    ${q.subs && q.subs.length > 0 ? `
                        <div class="sub-questions">
                            ${q.subs.map(sub => `
                                <div class="sub-item">
                                    <div class="sub-stem">(${sub.question_order}) ${sub.stem}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    <div class="analysis-box" style="display: none; margin-top: 15px; padding: 10px; background: #f9f9f9; border-left: 4px solid #007aff;">
                        <div style="font-weight: bold; color: #007aff; margin-bottom: 5px;">【答案】</div>
                        <div>${q.answer || '暂无答案'}</div>
                        ${q.analysis ? `
                            <div style="font-weight: bold; color: #28a745; margin-top: 10px; margin-bottom: 5px;">【解析】</div>
                            <div>${q.analysis}</div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="print-footer">
            本试卷由智能组卷系统生成
        </div>
    </div>

    <script>
        function toggleAnalysis() {
            const boxes = document.querySelectorAll('.analysis-box');
            boxes.forEach(box => {
                box.style.display = box.style.display === 'none' ? 'block' : 'none';
            });
        }

        document.addEventListener("DOMContentLoaded", function() {
            renderMathInElement(document.body, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\\\(', right: '\\\\)', display: false},
                    {left: '\\\\[', right: '\\\\]', display: true}
                ],
                throwOnError : false
            });
        });
    </script>
</body>
</html>
    `;
    res.send(html);
  } catch (error) {
    console.error('获取打印试卷失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const updatePaperTitle = async (req, res) => {
  try {
    const { paperId } = req.params;
    const { title } = req.body;
    const userId = req.userId;

    if (!title) return res.status(400).json(errorResponse('标题不能为空'));

    const [result] = await mysqlPool.query(
      'UPDATE computer1_generated_papers SET title = ? WHERE id = ? AND user_id = ?',
      [title, paperId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json(errorResponse('试卷不存在或无权操作'));
    }

    res.json(successResponse(null, '修改成功'));
  } catch (error) {
    console.error('修改试卷标题失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const deleteGeneratedPaper = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const { paperId } = req.params;
    const userId = req.userId;

    // 验证所有权
    const [papers] = await connection.query('SELECT id FROM computer1_generated_papers WHERE id = ? AND user_id = ?', [paperId, userId]);
    if (papers.length === 0) return res.status(404).json(errorResponse('试卷不存在或无权操作'));

    // 删除关联题目
    await connection.query('DELETE FROM computer1_generated_paper_questions WHERE paper_id = ?', [paperId]);
    // 删除主表
    await connection.query('DELETE FROM computer1_generated_papers WHERE id = ?', [paperId]);

    await connection.commit();
    res.json(successResponse({ message: '试卷已删除' }));
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('删除试卷失败:', error);
    res.status(500).json(errorResponse('删除失败'));
  } finally {
    if (connection) connection.release();
  }
};

const replacePaperQuestion = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const { paperId } = req.params;
    const { oldQuestionId, sortOrder } = req.body;

    // 获取试卷配置，用于寻找替换题目
    const [papers] = await connection.query('SELECT config, major_id FROM computer1_generated_papers WHERE id = ?', [paperId]);
    if (papers.length === 0) throw new Error('试卷不存在');
    
    const paper = papers[0];
    const config = typeof paper.config === 'string' ? JSON.parse(paper.config) : paper.config;
    const { scope } = config;

    // 获取当前已有的题目ID，避免重复
    const [currentQuestions] = await connection.query('SELECT question_id FROM computer1_generated_paper_questions WHERE paper_id = ?', [paperId]);
    const currentIds = currentQuestions.map(q => q.question_id);

    // 获取原题型
    const [oldQ] = await connection.query('SELECT exercise_type_name FROM computer1_question WHERE question_id = ?', [oldQuestionId]);
    const targetType = oldQ[0]?.exercise_type_name || '单选题';

    // 寻找备选题目
    let pool = [];
    for (const item of scope) {
      const { majorId, chapters } = item;
      let query = `SELECT question_id, major_id, chapter_id
                   FROM computer1_question
                   WHERE major_id = ? AND exercise_type_name = ? AND question_id NOT IN (?)`;
      const params = [majorId, targetType, currentIds];
      
      if (chapters && chapters.length > 0) {
        query += ' AND chapter_id IN (?)';
        params.push(chapters.map(c => c.id));
      }
      
      query += ' ORDER BY RAND() LIMIT 10';
      
      const [questions] = await connection.query(query, params);
      pool = pool.concat(questions);
    }

    if (pool.length === 0) throw new Error('没有更多符合条件的题目可更换');

    const newQ = pool[Math.floor(Math.random() * pool.length)];

    // 执行替换
    await connection.query(
      'UPDATE computer1_generated_paper_questions SET question_id = ? WHERE paper_id = ? AND sort_order = ?',
      [newQ.question_id, paperId, sortOrder]
    );

    await connection.commit();
    res.json(successResponse({ 
      message: '换题成功',
      newQuestionId: newQ.question_id
    }));
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('换题失败:', error);
    res.status(500).json(errorResponse(error.message));
  } finally {
    if (connection) connection.release();
  }
};

const importPaper = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const { paperInfo: manualPaperInfo, questions } = req.body;

    if (!Array.isArray(questions)) {
      throw new Error('导入数据格式错误，题目应为数组');
    }

    // URL替换函数：替换图片URL和格式
    const replaceUrls = (text) => {
      if (!text || typeof text !== 'string') return text;
      return text
        .replace(/HTTP:\/\/CHEESE\.YANZHISHI\.CN\/EXERCISEIMAGES/gi, 'http://cheese.yanzhishi.cn/exerciseImages')
        .replace(/\.PNG/gi, '.png');
    };

    // 递归处理对象中的所有字符串值
    const processObject = (obj) => {
      if (typeof obj === 'string') {
        return replaceUrls(obj);
      }
      if (Array.isArray(obj)) {
        return obj.map(item => processObject(item));
      }
      if (obj && typeof obj === 'object') {
        const result = {};
        for (const key in obj) {
          result[key] = processObject(obj[key]);
        }
        return result;
      }
      return obj;
    };

    // 处理所有题目数据，替换URL
    const processedQuestions = questions.map(q => processObject(q));

    // 获取试卷类型 (1-真题卷, 2-模拟卷)
    const paperType = (manualPaperInfo && manualPaperInfo.paperType) || 1;
    
    // 获取知识点解析模式 (1-标准模式: 科目/章节/考点, 2-考点模式: 全部是考点组ID)
    const tagParseMode = (manualPaperInfo && manualPaperInfo.tagParseMode) || 1;

    // 1. 根据题目中的元数据进行分组
    const paperGroups = new Map();

    processedQuestions.forEach((q) => {
      const school = q.fromSchool || (manualPaperInfo && manualPaperInfo.school) || '未知学校';
      const year = q.examTime || (manualPaperInfo && manualPaperInfo.year) || '未知年份';
      const code = q.examCode || (manualPaperInfo && manualPaperInfo.examCode) || '';
      const fullName = q.examFullName || (manualPaperInfo && manualPaperInfo.title) || '未命名试卷';
      
      const groupKey = `${school}-${year}-${code}-${fullName}`;
      if (!paperGroups.has(groupKey)) {
        paperGroups.set(groupKey, {
          info: {
            school,
            year,
            examCode: code,
            title: fullName,
            majorId: q.majorId || (manualPaperInfo && manualPaperInfo.majorId) || null,
            totalScore: (manualPaperInfo && manualPaperInfo.totalScore) || 150,
            difficulty: (manualPaperInfo && manualPaperInfo.difficulty) || '中等',
            paperType: paperType
          },
          questions: []
        });
      }
      paperGroups.get(groupKey).questions.push(q);
    });

    let totalPapers = 0;
    let totalRelations = 0;
    let importedQuestions = 0;

    console.log(`开始导入试卷: 共 ${processedQuestions.length} 道题目, 分为 ${paperGroups.size} 张试卷`);

    const typeMap = {
      '单选题': 1,
      '多选题': 2,
      '填空题': 3,
      '解答题': 4,
      '判断题': 5
    };

    const toNum = (val, defaultVal = 0) => {
      const n = parseFloat(val);
      return isNaN(n) ? defaultVal : n;
    };

    for (const [groupKey, group] of paperGroups.entries()) {
      const { info, questions: groupQuestions } = group;
      
      // 生成唯一的试卷 ID
      const paperId = manualPaperInfo?.id && paperGroups.size === 1 
        ? manualPaperInfo.id 
        : crypto.createHash('md5').update(groupKey).digest('hex');

      // 2. 插入或更新试卷主表
      await connection.query(
        `REPLACE INTO computer1_paper 
         (id, title, year, school, exam_code, major_id, total_score, difficulty, paper_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          paperId,
          info.title,
          info.year,
          info.school,
          info.examCode,
          info.majorId,
          info.totalScore,
          info.difficulty,
          info.paperType
        ]
      );

      // 3. 清理旧的试卷题目关联
      await connection.query('DELETE FROM computer1_paper_question WHERE paper_id = ?', [paperId]);

      for (let i = 0; i < groupQuestions.length; i++) {
        const q = groupQuestions[i];
        const sortOrder = q.exerciseNumber || (i + 1);
        
        // 4. 导入/更新题目（无论是否存在都使用 REPLACE INTO）
        const {
          exerciseId, examId, categoryId, majorId, chapterId, examGroupId,
          exerciseType, stem, exerciseStem, answer, exerciseAnswer,
          analysis, exerciseAnalysis, videoUrl, fromSchool, examTime,
          examCode, examFullName, exerciseNumber, level, totalScore,
          options, knowledgeTags
        } = q;

        // 生成题目ID：优先使用提供的ID，否则自动生成（与录入试题保持一致）
        const finalId = exerciseId || Date.now() + Math.floor(Math.random() * 1000).toString();
        
        // 题目分值：选择题默认2分，其他默认0分
        let score = toNum(totalScore, null);
        if (score === null || score === undefined) {
          if (exerciseType === '单选题' || exerciseType === '多选题' || exerciseType === '判断题') {
            score = 2;
          } else {
            score = 0;
          }
        }
        const finalStem = stem || exerciseStem || '';
        let finalAnswer = answer || exerciseAnswer || '';
        const finalAnalysis = analysis || exerciseAnalysis || '';

        // 特殊处理填空题
        if (exerciseType === '填空题' && Array.isArray(options) && options.length > 0) {
          const blankAnswers = options.map(opt => opt.content || opt.answer || '');
          finalAnswer = JSON.stringify(blankAnswers);
        }

        // 从 knowledgeTags 中提取分类 ID (如果请求中没有直接提供)
        let extractedMajorId = majorId || info.majorId || null;
        let extractedChapterId = chapterId || null;
        let extractedExamGroupId = examGroupId || null;

        // 如果有 knowledgeTags，根据解析模式处理
        console.log(`题目 ${finalId} 处理 knowledgeTags:`, knowledgeTags, `模式: ${tagParseMode}`);
        
        if (Array.isArray(knowledgeTags) && knowledgeTags.length > 0) {
          // 判断是否为ID格式
          const isPotentialId = (val) => val && (typeof val === 'number' || (typeof val === 'string' && val.length > 10 && /^\d+$/.test(val)));
          
          if (tagParseMode === 2) {
            // 模式二：knowledgeTags 全部是考点组ID，取第一个有效ID
            const firstTagId = knowledgeTags.find(tag => isPotentialId(tag));
            console.log(`  模式二 - 第一个有效TagID: ${firstTagId}`);
            if (firstTagId && !examGroupId) {
              extractedExamGroupId = firstTagId;
              // 根据考点组ID反查科目和章节
              try {
                const [tagRows] = await connection.query(
                  `SELECT kt.tag_id, kt.chapter_id, kt.exam_group_id, c.major_id 
                   FROM computer1_knowledge_tag kt 
                   LEFT JOIN computer1_chapter c ON kt.chapter_id = c.chapter_id 
                   WHERE kt.tag_id = ? OR kt.exam_group_id = ?
                   LIMIT 1`,
                  [firstTagId, firstTagId]
                );
                console.log(`  查询结果:`, tagRows);
                if (tagRows.length > 0) {
                  extractedChapterId = tagRows[0].chapter_id;
                  extractedMajorId = tagRows[0].major_id;
                  // 如果传入的是tag_id，更新exam_group_id
                  if (tagRows[0].exam_group_id) {
                    extractedExamGroupId = tagRows[0].exam_group_id;
                  }
                } else {
                  console.log(`  ⚠️ 未找到TagID ${firstTagId} 的对应信息`);
                }
              } catch (err) {
                console.error('根据考点组ID查询章节信息失败:', err);
              }
            }
          } else {
            // 模式一（默认）：标准模式，knowledgeTags[0]=科目ID, [1]=章节ID, [3]=考点组ID
            console.log(`  模式一 - 解析 knowledgeTags`);
            if (!majorId && isPotentialId(knowledgeTags[0])) extractedMajorId = knowledgeTags[0];
            if (!chapterId && isPotentialId(knowledgeTags[1])) extractedChapterId = knowledgeTags[1];
            if (!examGroupId && isPotentialId(knowledgeTags[3])) extractedExamGroupId = knowledgeTags[3];
          }
        } else {
          console.log(`  ⚠️ 没有 knowledgeTags`);
        }
        
        console.log(`  提取结果 - majorId: ${extractedMajorId}, chapterId: ${extractedChapterId}, examGroupId: ${extractedExamGroupId}`);

        // 插入/更新题目（REPLACE INTO 会自动替换已存在的记录）
        await connection.query(
          `REPLACE INTO computer1_question 
           (question_id, exam_id, category_id, major_id, chapter_id, exam_group_id, 
            exercise_type, exercise_type_name, stem, answer, analysis, video_url, 
            from_school, exam_time, exam_code, exam_full_name, exercise_number, level, total_score)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            finalId, examId || null, categoryId || null, extractedMajorId || null,
            extractedChapterId || null, extractedExamGroupId || null, typeMap[exerciseType] || 1,
            exerciseType, finalStem, finalAnswer, finalAnalysis, videoUrl || null,
            fromSchool || info.school || null, examTime || info.year || null,
            examCode || info.examCode || null, examFullName || info.title || null,
            toNum(exerciseNumber, null), toNum(level, 3), score
          ]
        );

        // 处理选项 (针对单选/多选/判断/填空)
        if (exerciseType === '单选题' || exerciseType === '多选题' || exerciseType === '判断题' || exerciseType === '填空题') {
          // 先删除旧选项
          await connection.query('DELETE FROM computer1_question_option WHERE question_id = ?', [finalId]);
          
          if (exerciseType === '填空题' && Array.isArray(options)) {
            // 填空题的 options 存入选项表，方便详情页展示和校验
            for (let i = 0; i < options.length; i++) {
              const opt = options[i];
              const val = opt.content || opt.answer || '';
              await connection.query(
                'INSERT INTO computer1_question_option (question_id, option_key, option_value, option_sort) VALUES (?, ?, ?, ?)',
                [finalId, (i + 1).toString(), val, i + 1]
              );
            }
          } else if (options && typeof options === 'object' && !Array.isArray(options)) {
            const optionEntries = Object.entries(options);
            for (let j = 0; j < optionEntries.length; j++) {
              const [key, value] = optionEntries[j];
              let sortVal = j + 1;
              if (key && typeof key === 'string') {
                sortVal = key.charCodeAt(0);
              }
              await connection.query(
                'INSERT INTO computer1_question_option (question_id, option_key, option_value, option_sort) VALUES (?, ?, ?, ?)',
                [finalId, key, value, sortVal]
              );
            }
          }
        }

        // 处理小题 (针对解答题)
        if (exerciseType === '解答题') {
          // 先删除旧小题
          await connection.query('DELETE FROM computer1_question_sub WHERE question_id = ?', [finalId]);
          
          // 支持两种格式：subs数组 或 options数组
          const subsData = q.subs || (Array.isArray(options) ? options : null);
          
          if (Array.isArray(subsData) && subsData.length > 0) {
            for (const sub of subsData) {
              await connection.query(
                'INSERT INTO computer1_question_sub (question_id, stem, answer, analysis, question_order, score) VALUES (?, ?, ?, ?, ?, ?)',
                [
                  finalId, 
                  sub.questionStem || sub.stem || sub.sub_stem || '', 
                  sub.questionAnswer || sub.answer || sub.sub_answer || '', 
                  sub.questionAnalysis || sub.analysis || sub.sub_analysis || '', 
                  toNum(sub.questionOrder || sub.order || sub.question_order, 1),
                  toNum(sub.questionScore || sub.score || sub.totalScore, 0)
                ]
              );
            }
          }
        }

        // 处理标签
        if (Array.isArray(knowledgeTags) && knowledgeTags.length > 0) {
          for (const tag of knowledgeTags) {
            if (!tag) continue;
            let tagId = null;
            
            // 如果tag是数字ID格式，先查询是否存在
            if (/^\d+$/.test(tag)) {
              const [rows] = await connection.query('SELECT tag_id FROM computer1_knowledge_tag WHERE tag_id = ?', [tag]);
              if (rows.length > 0) {
                tagId = rows[0].tag_id;
              }
            }
            
            // 如果tagId还没找到，按名称查询
            if (!tagId && typeof tag === 'string') {
              const [rows] = await connection.query('SELECT tag_id FROM computer1_knowledge_tag WHERE tag_name = ?', [tag]);
              if (rows.length > 0) {
                tagId = rows[0].tag_id;
              }
            }
            
            // 如果还没找到，创建新标签
            if (!tagId && typeof tag === 'string') {
              // 生成新的tag_id
              tagId = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
              await connection.query(
                'INSERT INTO computer1_knowledge_tag (tag_id, tag_name, chapter_id, exam_group_id) VALUES (?, ?, ?, ?)',
                [tagId, tag, extractedChapterId || null, extractedExamGroupId || null]
              );
            }
            
            if (tagId) {
              await connection.query('INSERT IGNORE INTO computer1_question_tag_relation (question_id, tag_id) VALUES (?, ?)', [finalId, tagId]);
            }
          }
        }

        importedQuestions++;

        // 5. 建立试卷题目关联
        await connection.query(
          'INSERT INTO computer1_paper_question (paper_id, question_id, sort_order, score) VALUES (?, ?, ?, ?)',
          [paperId, finalId, sortOrder, score]
        );
        totalRelations++;
        console.log(`  试卷题目关联建立: paperId=${paperId}, questionId=${finalId}`);
      }
      totalPapers++;
    }

    await connection.commit();
    
    let message = `批量组卷成功：共创建 ${totalPapers} 张试卷，导入 ${importedQuestions} 道新题目，关联 ${totalRelations} 道题目。`;

    res.json(successResponse({ totalPapers, importedQuestions, totalRelations }, message));
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('试卷导入失败:', error);
    res.status(500).json(errorResponse('导入失败: ' + error.message));
  } finally {
    if (connection) connection.release();
  }
};

const importQuestions = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    let questions = req.body; // 期望是一个数组

    if (!Array.isArray(questions)) {
      throw new Error('导入数据格式错误，期望数组');
    }

    // URL替换函数：替换图片URL和格式
    const replaceUrls = (text) => {
      if (!text || typeof text !== 'string') return text;
      return text
        .replace(/HTTP:\/\/CHEESE\.YANZHISHI\.CN\/EXERCISEIMAGES/gi, 'http://cheese.yanzhishi.cn/exerciseImages')
        .replace(/\.PNG/gi, '.png');
    };

    // 递归处理对象中的所有字符串值
    const processObject = (obj) => {
      if (typeof obj === 'string') {
        return replaceUrls(obj);
      }
      if (Array.isArray(obj)) {
        return obj.map(item => processObject(item));
      }
      if (obj && typeof obj === 'object') {
        const result = {};
        for (const key in obj) {
          result[key] = processObject(obj[key]);
        }
        return result;
      }
      return obj;
    };

    // 处理所有题目数据，替换URL
    questions = questions.map(q => processObject(q));

    const typeMap = {
      '单选题': 1,
      '多选题': 2,
      '填空题': 3,
      '解答题': 4,
      '判断题': 5
    };

    let successCount = 0;
    const toNum = (val, defaultVal = 0) => {
      const n = parseFloat(val);
      return isNaN(n) ? defaultVal : n;
    };

    for (const q of questions) {
      const {
        exerciseId,
        examId,
        categoryId,
        majorId,
        chapterId,
        examGroupId,
        exerciseType,
        stem,
        exerciseStem,
        answer,
        exerciseAnswer,
        analysis,
        exerciseAnalysis,
        videoUrl,
        fromSchool,
        examTime,
        examCode,
        examFullName,
        exerciseNumber,
        level,
        totalScore,
        options,
        knowledgeTags
      } = q;

      // 自动生成 ID 如果缺失
      const finalId = exerciseId || Date.now() + Math.floor(Math.random() * 1000).toString();
      const finalStem = stem || exerciseStem || '';
      let finalAnswer = answer || exerciseAnswer || '';
      const finalAnalysis = analysis || exerciseAnalysis || '';

      // 特殊处理填空题：如果 options 中有答案，则合并为 JSON 字符串保存到 answer 字段
      if (exerciseType === '填空题' && Array.isArray(options) && options.length > 0) {
        const blankAnswers = options.map(opt => opt.content || opt.answer || '');
        finalAnswer = JSON.stringify(blankAnswers);
      }

      // 从 knowledgeTags 中提取分类 ID (如果请求中没有直接提供)
      let extractedMajorId = majorId || null;
      let extractedChapterId = chapterId || null;
      let extractedExamGroupId = examGroupId || null;

      // 如果有 knowledgeTags，尝试从中提取 ID
      if (Array.isArray(knowledgeTags) && knowledgeTags.length > 0) {
        // 只有当 knowledgeTags 的内容看起来像 ID (数字或长字符串) 时才尝试提取
        const isPotentialId = (val) => val && (typeof val === 'number' || (typeof val === 'string' && val.length > 10 && /^\d+$/.test(val)));
        
        if (!majorId && isPotentialId(knowledgeTags[0])) extractedMajorId = knowledgeTags[0];
        if (!chapterId && isPotentialId(knowledgeTags[1])) extractedChapterId = knowledgeTags[1];
        if (!examGroupId && isPotentialId(knowledgeTags[3])) extractedExamGroupId = knowledgeTags[3];
      }
      
      // 题目分值：选择题默认2分，其他默认0分
      let finalScore = toNum(totalScore, null);
      if (finalScore === null || finalScore === undefined) {
        if (exerciseType === '单选题' || exerciseType === '多选题' || exerciseType === '判断题') {
          finalScore = 2;
        } else {
          finalScore = 0;
        }
      }

      // 1. 插入或更新主题目表
      await connection.query(
        `REPLACE INTO computer1_question 
         (question_id, exam_id, category_id, major_id, chapter_id, exam_group_id, 
          exercise_type, exercise_type_name, stem, answer, analysis, video_url, 
          from_school, exam_time, exam_code, exam_full_name, exercise_number, level, total_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          finalId, 
          examId || null,
          categoryId || null,
          extractedMajorId || null,
          extractedChapterId || null,
          extractedExamGroupId || null,
          typeMap[exerciseType] || 1,
          exerciseType, 
          finalStem, 
          finalAnswer, 
          finalAnalysis, 
          videoUrl || null,
          fromSchool || null, 
          examTime || null, 
          examCode || null,
          examFullName || null,
          toNum(exerciseNumber, null),
          toNum(level, 3), 
          finalScore
        ]
      );

      // 2. 处理选项 (针对单选/多选/判断/填空)
      if (exerciseType === '单选题' || exerciseType === '多选题' || exerciseType === '判断题' || exerciseType === '填空题') {
        // 先删除旧选项
        await connection.query('DELETE FROM computer1_question_option WHERE question_id = ?', [finalId]);
        
        if (exerciseType === '填空题' && Array.isArray(options)) {
          // 填空题的 options 存入选项表，方便详情页展示和校验
          for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            const val = opt.content || opt.answer || '';
            await connection.query(
              'INSERT INTO computer1_question_option (question_id, option_key, option_value, option_sort) VALUES (?, ?, ?, ?)',
              [finalId, (i + 1).toString(), val, i + 1]
            );
          }
        } else if (options && typeof options === 'object' && !Array.isArray(options)) {
          const optionEntries = Object.entries(options);
          for (let i = 0; i < optionEntries.length; i++) {
            const [key, value] = optionEntries[i];
            // 优先使用字符编码作为排序依据（兼容 A, B, C...），否则使用索引
            let sortVal = i + 1;
            if (key && typeof key === 'string') {
              sortVal = key.charCodeAt(0);
            }
            
            await connection.query(
              'INSERT INTO computer1_question_option (question_id, option_key, option_value, option_sort) VALUES (?, ?, ?, ?)',
              [finalId, key, value, sortVal]
            );
          }
        }
      }

      // 3. 处理小题 (针对解答题/综合题)
      if (exerciseType === '解答题' || Array.isArray(options)) {
        // 先删除旧小题
        await connection.query('DELETE FROM computer1_question_sub WHERE question_id = ?', [finalId]);
        
        if (Array.isArray(options)) {
          for (const sub of options) {
            await connection.query(
              'INSERT INTO computer1_question_sub (question_id, stem, answer, analysis, question_order, score) VALUES (?, ?, ?, ?, ?, ?)',
              [
                finalId, 
                sub.questionStem || sub.stem || '', 
                sub.questionAnswer || sub.answer || '', 
                sub.questionAnalysis || sub.analysis || '', 
                toNum(sub.questionOrder || sub.order, 1),
                toNum(sub.questionScore || sub.score, 0)
              ]
            );
          }
        }
      }

      // 4. 处理标签 (支持多个考点)
      if (Array.isArray(knowledgeTags) && knowledgeTags.length > 0) {
        // 先删除旧关联
        await connection.query('DELETE FROM computer1_question_tag_relation WHERE question_id = ?', [finalId]);
        
        // 过滤空值并去重
        const uniqueTags = [...new Set(knowledgeTags.filter(Boolean))];
        
        for (const tag of uniqueTags) {
          let tagId = null;
          
          // 1. 如果是数字或数字字符串，先尝试按 ID 查找
          if (/^\d+$/.test(tag)) {
            const [rows] = await connection.query(
              'SELECT tag_id FROM computer1_knowledge_tag WHERE tag_id = ?',
              [tag]
            );
            if (rows.length > 0) {
              tagId = rows[0].tag_id;
            }
          }
          
          // 2. 如果按 ID 没找到，或者是纯字符串名称，则按名称查找或创建
          if (!tagId && typeof tag === 'string') {
            // 先尝试按名称查找
            const [rows] = await connection.query(
              'SELECT tag_id FROM computer1_knowledge_tag WHERE tag_name = ?',
              [tag]
            );
            
            if (rows.length > 0) {
              tagId = rows[0].tag_id;
            } else if (!/^\d+$/.test(tag)) {
              // 如果不是纯数字字符串，说明是新名称，创建它
              // 自动分配一个关联的章节和科目 (取题目的章节和科目)
              await connection.query(
                'INSERT INTO computer1_knowledge_tag (tag_name, chapter_id) VALUES (?, ?)',
                [tag, extractedChapterId || null]
              );
              const [insertRes] = await connection.query(
                'SELECT tag_id FROM computer1_knowledge_tag WHERE tag_name = ?',
                [tag]
              );
              if (insertRes.length > 0) {
                tagId = insertRes[0].tag_id;
              }
            }
          }
          
          // 3. 建立关联
          if (tagId) {
            await connection.query(
              'INSERT IGNORE INTO computer1_question_tag_relation (question_id, tag_id) VALUES (?, ?)',
              [finalId, tagId]
            );
          }
        }
      }

      successCount++;
    }

    await connection.commit();
    res.json(successResponse({ successCount }, `成功导入 ${successCount} 条试题`));
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('导入试题失败:', error);
    res.status(500).json(errorResponse('导入失败: ' + error.message));
  } finally {
    if (connection) connection.release();
  }
};

const submitCorrection = async (req, res) => {
  try {
    const { questionId, majorId, type, content } = req.body;
    
    if (!questionId || !type || !content) {
      return res.status(400).json(errorResponse('缺少必要参数'));
    }
    
    await mysqlPool.query(
      'INSERT INTO computer1_corrections (question_id, major_id, type, content) VALUES (?, ?, ?, ?)',
      [questionId, majorId || null, type, content]
    );
    
    res.json(successResponse(null, '反馈提交成功'));
  } catch (error) {
    console.error('提交纠错失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 重置进度
const resetProgress = async (req, res) => {
  try {
    const { chapterId, tagId } = req.body;
    const userId = req.userId;

    if (!chapterId && !tagId) {
      return res.status(400).json(errorResponse('章节ID或考点ID不能为空'));
    }

    let query = '';
    let params = [userId];

    if (tagId) {
      query = `
        DELETE p FROM computer1_user_progress p
        JOIN computer1_question_tag_relation r ON p.QuestionID = r.question_id
        WHERE p.UserID = ? AND r.tag_id = ?
      `;
      params.push(tagId);
    } else {
      query = `
        DELETE p FROM computer1_user_progress p
        JOIN computer1_question q ON p.QuestionID = q.question_id
        WHERE p.UserID = ? AND q.chapter_id = ?
      `;
      params.push(chapterId);
    }

    await mysqlPool.query(query, params);
    res.json(successResponse(null, '进度已重置'));
  } catch (error) {
    console.error('重置进度失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 题目反馈
const submitQuestionFeedback = async (req, res) => {
  try {
    const { questionId, type, content } = req.body;
    const userId = req.userId;
    
    if (!questionId || !content) {
      return res.status(400).json(errorResponse('参数不完整'));
    }

    await mysqlPool.query(
      'INSERT INTO computer1_feedback (UserID, QuestionID, Type, Content, Status) VALUES (?, ?, ?, ?, 1)',
      [userId, questionId, type || '题目纠错', content]
    );
    
    res.json(successResponse(null, '感谢您的反馈，我们将尽快处理'));
  } catch (error) {
    console.error('提交反馈失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getFeedbacks = async (req, res) => {
  try {
    const { status, page = 1, size = 20 } = req.query;
    let query = 'SELECT f.*, q.stem FROM computer1_feedback f JOIN computer1_question q ON f.QuestionID = q.question_id WHERE 1=1';
    const params = [];

    if (status !== undefined) {
      query += ' AND f.Status = ?';
      params.push(status);
    }

    query += ' ORDER BY f.CreatedAt DESC LIMIT ? OFFSET ?';
    params.push(parseInt(size), (parseInt(page) - 1) * parseInt(size));

    const [feedbacks] = await mysqlPool.query(query, params);
    const [[{ total }]] = await mysqlPool.query('SELECT COUNT(*) as total FROM computer1_feedback');

    res.json(successResponse({ list: feedbacks, total }));
  } catch (error) {
    console.error('获取反馈列表失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const updateFeedbackStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_remark } = req.body;
    
    await mysqlPool.query(
      'UPDATE computer1_feedback SET Status = ?, AdminRemark = ?, ProcessedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [status, admin_remark, id]
    );
    
    res.json(successResponse(null, '反馈已更新'));
  } catch (error) {
    console.error('更新反馈状态失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 错题本相关
const toggleWrongBook = async (req, res) => {
  try {
    const { questionId } = req.body;
    const userId = req.userId;

    const [existing] = await mysqlPool.query(
      'SELECT * FROM computer1_wrong_book WHERE UserID = ? AND QuestionID = ?',
      [userId, questionId]
    );

    if (existing.length > 0) {
      await mysqlPool.query('DELETE FROM computer1_wrong_book WHERE UserID = ? AND QuestionID = ?', [userId, questionId]);
      res.json(successResponse({ added: false }, '已从错题本移除'));
    } else {
      await mysqlPool.query(
        'INSERT INTO computer1_wrong_book (UserID, QuestionID) VALUES (?, ?)',
        [userId, questionId]
      );
      res.json(successResponse({ added: true }, '已加入错题本'));
    }
  } catch (error) {
    console.error('操作错题本失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const checkWrongBook = async (req, res) => {
  try {
    const { questionId } = req.query;
    const userId = req.userId;

    const [existing] = await mysqlPool.query(
      'SELECT * FROM computer1_wrong_book WHERE UserID = ? AND QuestionID = ?',
      [userId, questionId]
    );

    res.json(successResponse({ exists: existing.length > 0 }));
  } catch (error) {
    console.error('检查错题本状态失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getWrongBook = async (req, res) => {
  try {
    const userId = req.userId;
    const { isRemoved = 0 } = req.query; // 默认获取未移除的
    
    // 获取错题本中的题目
    let query = `
      SELECT w.QuestionID as question_id, w.CreatedAt, w.is_correct, w.attempt_count, w.is_removed, w.last_attempt_at,
             q.stem, q.exercise_type, q.exercise_type_name
       FROM computer1_wrong_book w 
       JOIN computer1_question q ON w.QuestionID = q.question_id 
       WHERE w.UserID = ?
    `;
    const params = [userId];

    if (isRemoved !== 'all') {
      query += ' AND w.is_removed = ?';
      params.push(isRemoved);
    }

    query += ' ORDER BY w.CreatedAt DESC';
    
    const [list] = await mysqlPool.query(query, params);

    // 计算已掌握的题目数量（重做正确的题目）
    const [masteredStats] = await mysqlPool.query(
      'SELECT COUNT(*) as count FROM computer1_wrong_book WHERE UserID = ? AND is_correct = 1',
      [userId]
    );

    res.json(successResponse({
      questions: list,
      masteredCount: masteredStats[0].count
    }));
  } catch (error) {
    console.error('获取错题本失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const addToWrongBook = async (req, res) => {
  try {
    const { questionId } = req.body;
    const userId = req.userId;

    if (!questionId) {
      return res.status(400).json(errorResponse('题目ID不能为空'));
    }

    const [existing] = await mysqlPool.query(
      'SELECT * FROM computer1_wrong_book WHERE UserID = ? AND QuestionID = ?',
      [userId, questionId]
    );

    if (existing.length > 0) {
      return res.json(successResponse({ added: false }, '题目已在错题本中'));
    }

    await mysqlPool.query(
      'INSERT INTO computer1_wrong_book (UserID, QuestionID) VALUES (?, ?)',
      [userId, questionId]
    );

    res.json(successResponse({ added: true }, '已加入错题本'));
  } catch (error) {
    console.error('添加错题失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const removeFromWrongBook = async (req, res) => {
  try {
    const { questionId } = req.body;
    const userId = req.userId;

    if (!questionId) {
      return res.status(400).json(errorResponse('题目ID不能为空'));
    }

    // 软删除：标记为已移除
    await mysqlPool.query(
      'UPDATE computer1_wrong_book SET is_removed = 1 WHERE UserID = ? AND QuestionID = ?',
      [userId, questionId]
    );

    res.json(successResponse({ removed: true }, '已从错题本移除'));
  } catch (error) {
    console.error('移除错题失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 更新错题重做状态
const updateWrongBookStatus = async (req, res) => {
  try {
    const { questionId, isCorrect, removeFromWrongBook: shouldRemove } = req.body;
    const userId = req.userId;

    if (!questionId) {
      return res.status(400).json(errorResponse('题目ID不能为空'));
    }

    const isCorrectInt = isCorrect ? 1 : 0;
    const isRemovedInt = (isCorrect && shouldRemove) ? 1 : 0;

    await mysqlPool.query(
      `UPDATE computer1_wrong_book 
       SET is_correct = ?, 
           attempt_count = attempt_count + 1, 
           is_removed = CASE WHEN ? = 1 THEN 1 ELSE is_removed END,
           last_attempt_at = CURRENT_TIMESTAMP
       WHERE UserID = ? AND QuestionID = ?`,
      [isCorrectInt, isRemovedInt, userId, questionId]
    );

    res.json(successResponse(null, '错题状态已更新'));
  } catch (error) {
    console.error('更新错题状态失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取错题统计（管理员用）
const getWrongBookStats = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const [stats] = await mysqlPool.query(
      `SELECT 
        q.question_id as QuestionID, 
        q.stem, 
        q.exercise_type_name,
        COUNT(w.UserID) as error_count,
        SUM(w.attempt_count) as total_attempts,
        SUM(CASE WHEN w.is_correct = 1 THEN 1 ELSE 0 END) as master_count
       FROM computer1_wrong_book w
       JOIN computer1_question q ON w.QuestionID = q.question_id
       GROUP BY q.question_id
       ORDER BY error_count DESC
       LIMIT ?`,
      [parseInt(limit)]
    );

    res.json(successResponse(stats));
  } catch (error) {
    console.error('获取错题统计失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// module.exports moved to end of file


const clearWrongBook = async (req, res) => {
  try {
    const userId = req.userId;

    await mysqlPool.query(
      'DELETE FROM computer1_wrong_book WHERE UserID = ?',
      [userId]
    );

    res.json(successResponse({ cleared: true }, '错题本已清空'));
  } catch (error) {
    console.error('清空错题本失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const generateTest = async (req, res) => {
  try {
    const { subjectId, count = 20 } = req.query;
    if (!subjectId) return res.status(400).json(errorResponse('科目ID不能为空'));

    // 随机获取指定数量的题目
    const [questions] = await mysqlPool.query(
      `SELECT question_id, exercise_type, exercise_type_name, stem, answer, analysis, level, total_score 
       FROM computer1_question 
       WHERE major_id = ? 
       ORDER BY RAND() 
       LIMIT ?`,
      [subjectId, parseInt(count)]
    );

    // 为每个题目获取选项和小题
    for (const q of questions) {
      // 获取选项
      const [options] = await mysqlPool.query(
        'SELECT option_key, option_value FROM computer1_question_option WHERE question_id = ? ORDER BY option_sort ASC',
        [q.question_id]
      );
      q.options = options;

      // 获取小题 (针对解答题等)
      const [subs] = await mysqlPool.query(
        'SELECT * FROM computer1_question_sub WHERE question_id = ? ORDER BY question_order ASC',
        [q.question_id]
      );
      q.subs = subs;
    }

    res.json(successResponse(questions));
  } catch (error) {
    console.error('生成测试题目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const reportTestScore = async (req, res) => {
  try {
    const { score, stats, answers } = req.body;
    const userId = req.userId;

    // 这里可以根据需要将成绩存入数据库
    // 目前先简单返回成功，后续可以扩展成绩统计功能
    console.log(`用户 ${userId} 提交测试成绩: ${score}`, stats);

    res.json(successResponse(null, '成绩提交成功'));
  } catch (error) {
    console.error('提交测试成绩失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 笔记相关
const getNotes = async (req, res) => {
  try {
    const { questionId, tab = 'public', sort = 'time' } = req.query;
    const userId = req.userId;
    
    let query = `
      SELECT 
        n.id as note_id, 
        n.content, 
        n.create_time, 
        n.user_id,
        n.is_public,
        u.username, 
        u.avatar,
        (SELECT COUNT(*) FROM computer1_note_likes WHERE note_id = n.id) as like_count,
        (SELECT COUNT(*) FROM computer1_note_likes WHERE note_id = n.id AND user_id = ?) as is_liked
      FROM computer1_notes n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.question_id = ? AND n.parent_id = 0
    `;
    
    if (tab === 'private') {
      query += ` AND n.user_id = ${userId}`;
    } else {
      query += ` AND (n.is_public = 1 OR n.user_id = ${userId})`;
    }
    
    if (sort === 'like') {
      query += ` ORDER BY like_count DESC, n.create_time DESC`;
    } else {
      query += ` ORDER BY n.create_time DESC`;
    }
    
    const [notes] = await mysqlPool.query(query, [userId, questionId]);
    res.json(successResponse(notes));
  } catch (error) {
    console.error('获取计算机题目笔记失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getNoteReplies = async (req, res) => {
  try {
    const { noteId } = req.query;
    const userId = req.userId;
    
    if (!noteId) return res.status(400).json(errorResponse('笔记ID不能为空'));
    
    const [replies] = await mysqlPool.query(
      `SELECT 
        n.id as note_id, 
        n.content, 
        n.create_time, 
        n.user_id,
        u.username, 
        u.avatar,
        (SELECT COUNT(*) FROM computer1_note_likes WHERE note_id = n.id) as like_count,
        (SELECT COUNT(*) FROM computer1_note_likes WHERE note_id = n.id AND user_id = ?) as is_liked
      FROM computer1_notes n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.parent_id = ?
      ORDER BY n.create_time ASC`,
      [userId, noteId]
    );
    
    res.json(successResponse(replies));
  } catch (error) {
    console.error('获取笔记回复失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const addNote = async (req, res) => {
  try {
    const { questionId, content, isPublic = 1, parentId = 0 } = req.body;
    const userId = req.userId;
    
    if (!questionId || !content) {
      return res.status(400).json(errorResponse('参数不完整'));
    }
    
    const [result] = await mysqlPool.query(
      'INSERT INTO computer1_notes (user_id, question_id, content, is_public, parent_id) VALUES (?, ?, ?, ?, ?)',
      [userId, questionId, content, isPublic, parentId]
    );
    
    res.json(successResponse({ id: result.insertId }, '笔记发布成功'));
  } catch (error) {
    console.error('发布笔记失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const toggleNoteLike = async (req, res) => {
  try {
    const { noteId } = req.body;
    const userId = req.userId;
    
    if (!noteId) return res.status(400).json(errorResponse('笔记ID不能为空'));
    
    const [existing] = await mysqlPool.query(
      'SELECT * FROM computer1_note_likes WHERE user_id = ? AND note_id = ?',
      [userId, noteId]
    );
    
    if (existing.length > 0) {
      await mysqlPool.query('DELETE FROM computer1_note_likes WHERE user_id = ? AND note_id = ?', [userId, noteId]);
      const [stats] = await mysqlPool.query('SELECT COUNT(*) as count FROM computer1_note_likes WHERE note_id = ?', [noteId]);
      res.json(successResponse({ isLiked: false, likeCount: stats[0].count }));
    } else {
      await mysqlPool.query(
        'INSERT INTO computer1_note_likes (user_id, note_id) VALUES (?, ?)',
        [userId, noteId]
      );
      const [stats] = await mysqlPool.query('SELECT COUNT(*) as count FROM computer1_note_likes WHERE note_id = ?', [noteId]);
      res.json(successResponse({ isLiked: true, likeCount: stats[0].count }));
    }
  } catch (error) {
    console.error('操作点赞失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const adminUpdateQuestion = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { questionId } = req.params;
    const { 
      stem, answer, analysis, level, total_score, options, subs, knowledgeTags,
      exam_id, category_id, major_id, chapter_id, exam_group_id, 
      exercise_type, exercise_type_name, from_school, exam_time, 
      exam_code, exam_full_name, exercise_number, video_url
    } = req.body;

    await connection.beginTransaction();

    // 更新主表 - 支持所有字段
    await connection.query(
      `UPDATE computer1_question 
       SET stem = ?, answer = ?, analysis = ?, level = ?, total_score = ?,
           exam_id = ?, category_id = ?, major_id = ?, chapter_id = ?, 
           exam_group_id = ?, exercise_type = ?, exercise_type_name = ?, 
           from_school = ?, exam_time = ?, exam_code = ?, exam_full_name = ?, 
           exercise_number = ?, video_url = ?
       WHERE question_id = ?`,
      [
        stem, answer, analysis, level || 1, total_score || 0,
        exam_id || null, category_id || null, major_id || null, chapter_id || null,
        exam_group_id || null, exercise_type || 1, exercise_type_name || '单选题',
        from_school || null, exam_time || null, exam_code || null, exam_full_name || null,
        exercise_number || null, video_url || null,
        questionId
      ]
    );

    // 更新选项
    await connection.query('DELETE FROM computer1_question_option WHERE question_id = ?', [questionId]);
    if (options && options.length > 0) {
      const optionValues = options.map((opt, index) => [
        questionId, opt.option_key, opt.option_value, index + 1
      ]);
      await connection.query(
        'INSERT INTO computer1_question_option (question_id, option_key, option_value, option_sort) VALUES ?',
        [optionValues]
      );
    }

    // 更新小题
    await connection.query('DELETE FROM computer1_question_sub WHERE question_id = ?', [questionId]);
    if (subs && subs.length > 0) {
      const subValues = subs.map((sub, index) => [
        questionId, sub.sub_stem || sub.stem, sub.sub_answer || sub.answer, sub.sub_analysis || sub.analysis, index + 1
      ]);
      await connection.query(
        'INSERT INTO computer1_question_sub (question_id, stem, answer, analysis, question_order) VALUES ?',
        [subValues]
      );
    }

    // 更新知识点标签
    await connection.query('DELETE FROM computer1_question_tag_relation WHERE question_id = ?', [questionId]);
    if (knowledgeTags && Array.isArray(knowledgeTags) && knowledgeTags.length > 0) {
      for (const tag of knowledgeTags) {
        let tagName = typeof tag === 'string' ? tag : tag.tag_name;
        if (!tagName) continue;
        
        // 先确保标签存在
        await connection.query(
          'INSERT IGNORE INTO computer1_knowledge_tag (tag_name, chapter_id) VALUES (?, ?)',
          [tagName, chapter_id || null]
        );
        // 获取标签ID
        const [tagRes] = await connection.query(
          'SELECT tag_id FROM computer1_knowledge_tag WHERE tag_name = ?',
          [tagName]
        );
        if (tagRes.length > 0) {
          const tagId = tagRes[0].tag_id;
          // 建立关联
          await connection.query(
            'INSERT IGNORE INTO computer1_question_tag_relation (question_id, tag_id) VALUES (?, ?)',
            [questionId, tagId]
          );
        }
      }
    }

    await connection.commit();
    res.json(successResponse(null, '题目更新成功'));
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('更新题目失败:', error);
    res.status(500).json(errorResponse('更新题目失败: ' + error.message));
  } finally {
    if (connection) connection.release();
  }
};

// 创建题目
const adminCreateQuestion = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { 
      stem, answer, analysis, level, total_score, 
      options, subs, knowledgeTags,
      exam_id, category_id, major_id, chapter_id, exam_group_id, 
      exercise_type, exercise_type_name, from_school, exam_time, 
      exam_code, exam_full_name, exercise_number, video_url
    } = req.body;

    if (!stem || !exercise_type_name) {
      return res.status(400).json(errorResponse('题干和题型不能为空'));
    }

    await connection.beginTransaction();

    // 生成题目ID
    const questionId = generateId();
    
    // 如果没有提供 exam_group_id，生成一个默认值
    const finalExamGroupId = exam_group_id || generateId();

    // 插入主表
    await connection.query(
      `INSERT INTO computer1_question 
       (question_id, stem, answer, analysis, level, total_score,
        exam_id, category_id, major_id, chapter_id, exam_group_id, 
        exercise_type, exercise_type_name, from_school, exam_time, 
        exam_code, exam_full_name, exercise_number, video_url, create_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        questionId, stem, answer || null, 
        analysis || null, level || 1, total_score || 0,
        exam_id || null, category_id || null, major_id || null, chapter_id || null,
        finalExamGroupId, exercise_type || 1, exercise_type_name || '单选题',
        from_school || null, exam_time || null, exam_code || null, exam_full_name || null,
        exercise_number || null, video_url || null
      ]
    );

    // 插入选项
    if (options && options.length > 0) {
      const optionValues = options.map((opt, index) => [
        questionId, opt.option_key, opt.option_value, index + 1
      ]);
      await connection.query(
        'INSERT INTO computer1_question_option (question_id, option_key, option_value, option_sort) VALUES ?',
        [optionValues]
      );
    }

    // 插入小题
    if (subs && subs.length > 0) {
      const subValues = subs.map((sub, index) => [
        questionId, sub.sub_stem || sub.stem, sub.sub_answer || sub.answer, sub.sub_analysis || sub.analysis, index + 1
      ]);
      await connection.query(
        'INSERT INTO computer1_question_sub (question_id, stem, answer, analysis, question_order) VALUES ?',
        [subValues]
      );
    }

    // 处理知识点标签
    if (knowledgeTags && knowledgeTags.length > 0) {
      for (const tagName of knowledgeTags) {
        await connection.query(
          'INSERT IGNORE INTO computer1_knowledge_tag (tag_name, chapter_id) VALUES (?, ?)',
          [tagName, chapter_id || null]
        );
        const [tagRes] = await connection.query(
          'SELECT tag_id FROM computer1_knowledge_tag WHERE tag_name = ?',
          [tagName]
        );
        if (tagRes.length > 0) {
          await connection.query(
            'INSERT IGNORE INTO computer1_question_tag_relation (question_id, tag_id) VALUES (?, ?)',
            [questionId, tagRes[0].tag_id]
          );
        }
      }
    }

    await connection.commit();
    res.json(successResponse({ question_id: questionId }, '题目创建成功'));
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('创建题目失败:', error);
    res.status(500).json(errorResponse('创建题目失败: ' + error.message));
  } finally {
    if (connection) connection.release();
  }
};

const adminDeleteQuestion = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { questionId } = req.params;
    await connection.beginTransaction();

    await connection.query('DELETE FROM computer1_question WHERE question_id = ?', [questionId]);
    await connection.query('DELETE FROM computer1_question_option WHERE question_id = ?', [questionId]);
    await connection.query('DELETE FROM computer1_question_sub WHERE question_id = ?', [questionId]);
    await connection.query('DELETE FROM computer1_question_tag_relation WHERE question_id = ?', [questionId]);
    await connection.query('DELETE FROM computer1_feedback WHERE QuestionID = ?', [questionId]);
    await connection.query('DELETE FROM computer1_chapter_question_set WHERE question_id = ?', [questionId]);

    await connection.commit();
    res.json(successResponse(null, '题目删除成功'));
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('删除题目失败:', error);
    res.status(500).json(errorResponse('删除题目失败: ' + error.message));
  } finally {
    if (connection) connection.release();
  }
};

// 批量为题目添加考点
const adminBatchAddTagsToQuestions = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { major_id, data } = req.body;
    
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json(errorResponse('数据格式错误，必须提供题目和考点数组'));
    }
    
    await connection.beginTransaction();
    
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    
    for (const item of data) {
      const { question_id, knowledgeTags } = item;
      
      if (!question_id || !Array.isArray(knowledgeTags) || knowledgeTags.length === 0) {
        failCount++;
        errors.push({ question_id, error: '题目ID或考点数组无效' });
        continue;
      }
      
      try {
        // 验证题目是否存在
        const [questions] = await connection.query(
          'SELECT question_id, major_id FROM computer1_question WHERE question_id = ?',
          [question_id]
        );
        
        if (questions.length === 0) {
          failCount++;
          errors.push({ question_id, error: '题目不存在' });
          continue;
        }
        
        // 如果指定了科目，验证题目是否属于该科目
        if (major_id && String(questions[0].major_id) !== String(major_id)) {
          failCount++;
          errors.push({ question_id, error: '题目不属于指定科目' });
          continue;
        }
        
        // 删除该题目现有的考点关联
        await connection.query(
          'DELETE FROM computer1_question_tag_relation WHERE question_id = ?',
          [question_id]
        );
        
        // 添加新的考点关联
        for (const tagId of knowledgeTags) {
          if (!tagId) continue;
          
          // 验证考点是否存在
          const [tags] = await connection.query(
            'SELECT tag_id FROM computer1_knowledge_tag WHERE tag_id = ?',
            [tagId]
          );
          
          if (tags.length === 0) {
            console.warn(`考点 ${tagId} 不存在，跳过`);
            continue;
          }
          
          // 插入关联关系
          await connection.query(
            'INSERT INTO computer1_question_tag_relation (question_id, tag_id) VALUES (?, ?)',
            [question_id, tagId]
          );
        }
        
        successCount++;
      } catch (error) {
        failCount++;
        errors.push({ question_id, error: error.message });
        console.error(`为题目 ${question_id} 添加考点失败:`, error);
      }
    }
    
    await connection.commit();
    
    res.json(successResponse({
      successCount,
      failCount,
      errors: errors.slice(0, 10) // 只返回前10个错误
    }, `成功为 ${successCount} 道题目添加考点，失败 ${failCount} 道`));
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('批量添加考点失败:', error);
    res.status(500).json(errorResponse('批量添加考点失败: ' + error.message));
  } finally {
    if (connection) connection.release();
  }
};

// 管理员获取考点列表
const adminGetTags = async (req, res) => {
  try {
    const { chapterId, keyword, showUnnamed, showInvalid, page = 1, pageSize = 20 } = req.query;
    
    let query = `
      SELECT 
        kt.tag_id,
        kt.tag_name,
        kt.chapter_id,
        c.chapter_name,
        c.parent_id as chapter_parent_id,
        pc.chapter_name as parent_chapter_name,
        s.subject_name as major_name,
        COUNT(DISTINCT r.question_id) as question_count
      FROM computer1_knowledge_tag kt
      LEFT JOIN computer1_chapter c ON kt.chapter_id = c.chapter_id
      LEFT JOIN computer1_chapter pc ON c.parent_id = pc.chapter_id
      LEFT JOIN computer1_subject s ON c.major_id = s.major_id
      LEFT JOIN computer1_question_tag_relation r ON kt.tag_id = r.tag_id
      WHERE 1=1
    `;
    const params = [];
    
    if (chapterId) {
      query += ' AND kt.chapter_id = ?';
      params.push(chapterId);
    }
    
    if (keyword) {
      // 支持逗号分隔的多个tagId查询
      if (keyword.includes(',')) {
        const tagIds = keyword.split(',').map(id => id.trim()).filter(Boolean);
        if (tagIds.length > 0) {
          query += ` AND kt.tag_id IN (${tagIds.map(() => '?').join(',')})`;
          params.push(...tagIds);
        }
      } else {
        query += ' AND (kt.tag_name LIKE ? OR kt.tag_id LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`);
      }
    }
    
    if (showUnnamed === 'true') {
      query += ' AND (kt.tag_name IS NULL OR kt.tag_name = "" OR kt.tag_name REGEXP "^[0-9]+$")';
    }
    
    if (showInvalid === 'true') {
      // 显示tag_name为纯数字且无法解析为有效tag_id或chapter_id的考点
      query += ' AND kt.tag_name REGEXP "^[0-9]+$"';
      query += ' AND NOT EXISTS (SELECT 1 FROM computer1_knowledge_tag t2 WHERE t2.tag_id = kt.tag_name)';
      query += ' AND NOT EXISTS (SELECT 1 FROM computer1_chapter ch WHERE ch.chapter_id = kt.tag_name)';
    }
    
    query += ' GROUP BY kt.tag_id ORDER BY kt.chapter_id, kt.sort';
    
    // 分页
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);
    
    const [tags] = await mysqlPool.query(query, params);
    
    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM computer1_knowledge_tag kt WHERE 1=1';
    const countParams = [];
    
    if (chapterId) {
      countQuery += ' AND kt.chapter_id = ?';
      countParams.push(chapterId);
    }
    
    if (keyword) {
      // 支持逗号分隔的多个tagId查询
      if (keyword.includes(',')) {
        const tagIds = keyword.split(',').map(id => id.trim()).filter(Boolean);
        if (tagIds.length > 0) {
          countQuery += ` AND kt.tag_id IN (${tagIds.map(() => '?').join(',')})`;
          countParams.push(...tagIds);
        }
      } else {
        countQuery += ' AND (kt.tag_name LIKE ? OR kt.tag_id LIKE ?)';
        countParams.push(`%${keyword}%`, `%${keyword}%`);
      }
    }
    
    if (showUnnamed === 'true') {
      countQuery += ' AND (kt.tag_name IS NULL OR kt.tag_name = "" OR kt.tag_name REGEXP "^[0-9]+$")';
    }
    
    if (showInvalid === 'true') {
      // 显示tag_name为纯数字且无法解析为有效tag_id或chapter_id的考点
      countQuery += ' AND kt.tag_name REGEXP "^[0-9]+$"';
      countQuery += ' AND NOT EXISTS (SELECT 1 FROM computer1_knowledge_tag t2 WHERE t2.tag_id = kt.tag_name)';
      countQuery += ' AND NOT EXISTS (SELECT 1 FROM computer1_chapter ch WHERE ch.chapter_id = kt.tag_name)';
    }
    
    const [countResult] = await mysqlPool.query(countQuery, countParams);
    
    res.json(successResponse({
      list: tags,
      total: countResult[0].total
    }));
  } catch (error) {
    console.error('获取考点列表失败:', error);
    res.status(500).json(errorResponse('获取考点列表失败: ' + error.message));
  }
};

// 管理员创建考点
const adminCreateTag = async (req, res) => {
  try {
    const { tag_name, chapter_id } = req.body;
    
    if (!tag_name || !chapter_id) {
      return res.status(400).json(errorResponse('考点名称和所属章节不能为空'));
    }
    
    // 生成唯一ID
    const tag_id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    // 生成 exam_group_id
    const exam_group_id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    await mysqlPool.query(
      'INSERT INTO computer1_knowledge_tag (tag_id, tag_name, chapter_id, exam_group_id) VALUES (?, ?, ?, ?)',
      [tag_id, tag_name, chapter_id, exam_group_id]
    );
    
    res.json(successResponse({ tag_id, tag_name, chapter_id, exam_group_id }, '考点创建成功'));
  } catch (error) {
    console.error('创建考点失败:', error);
    res.status(500).json(errorResponse('创建考点失败: ' + error.message));
  }
};

// 管理员更新考点
const adminUpdateTag = async (req, res) => {
  try {
    const { tagId } = req.params;
    const { tag_name } = req.body;
    
    await mysqlPool.query(
      'UPDATE computer1_knowledge_tag SET tag_name = ? WHERE tag_id = ?',
      [tag_name, tagId]
    );
    
    res.json(successResponse(null, '考点更新成功'));
  } catch (error) {
    console.error('更新考点失败:', error);
    res.status(500).json(errorResponse('更新考点失败: ' + error.message));
  }
};

// 管理员删除考点
const adminDeleteTag = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { tagId } = req.params;
    await connection.beginTransaction();
    
    // 删除考点与题目的关联
    await connection.query('DELETE FROM computer1_question_tag_relation WHERE tag_id = ?', [tagId]);
    // 删除考点
    await connection.query('DELETE FROM computer1_knowledge_tag WHERE tag_id = ?', [tagId]);
    
    await connection.commit();
    res.json(successResponse(null, '考点删除成功'));
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('删除考点失败:', error);
    res.status(500).json(errorResponse('删除考点失败: ' + error.message));
  } finally {
    if (connection) connection.release();
  }
};

// 管理员移动考点到其他章节
const adminMoveTag = async (req, res) => {
  try {
    const { tagId } = req.params;
    const { chapter_id } = req.body;
    
    await mysqlPool.query(
      'UPDATE computer1_knowledge_tag SET chapter_id = ? WHERE tag_id = ?',
      [chapter_id, tagId]
    );
    
    res.json(successResponse(null, '考点移动成功'));
  } catch (error) {
    console.error('移动考点失败:', error);
    res.status(500).json(errorResponse('移动考点失败: ' + error.message));
  }
};

// 管理员批量删除未命名考点
const adminBatchDeleteUnnamedTags = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    
    // 查找所有未命名的考点（名称为空或为纯数字）
    const [unnamedTags] = await connection.query(
      'SELECT tag_id FROM computer1_knowledge_tag WHERE tag_name IS NULL OR tag_name = "" OR tag_name REGEXP "^[0-9]+$"'
    );
    
    const tagIds = unnamedTags.map(t => t.tag_id);
    
    if (tagIds.length === 0) {
      return res.json(successResponse({ deletedCount: 0 }, '没有未命名的考点需要删除'));
    }
    
    // 删除关联关系
    await connection.query(
      'DELETE FROM computer1_question_tag_relation WHERE tag_id IN (?)',
      [tagIds]
    );
    
    // 删除考点
    await connection.query(
      'DELETE FROM computer1_knowledge_tag WHERE tag_id IN (?)',
      [tagIds]
    );
    
    await connection.commit();
    res.json(successResponse({ deletedCount: tagIds.length }, `成功删除 ${tagIds.length} 个未命名考点`));
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('批量删除未命名考点失败:', error);
    res.status(500).json(errorResponse('批量删除失败: ' + error.message));
  } finally {
    if (connection) connection.release();
  }
};

// 管理员清理无效考点（tag_name为纯数字且无法解析的考点）
const adminCleanInvalidTags = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    
    // 查找所有tag_name为纯数字的考点
    const [numericTags] = await connection.query(
      'SELECT tag_id, tag_name, chapter_id FROM computer1_knowledge_tag WHERE tag_name REGEXP "^[0-9]+$"'
    );
    
    const invalidTagIds = [];
    
    // 检查每个数字tag_name是否能在系统中找到对应记录
    for (const tag of numericTags) {
      const tagName = tag.tag_name;
      
      // 尝试作为tag_id查询
      const [tagResult] = await connection.query(
        'SELECT tag_id FROM computer1_knowledge_tag WHERE tag_id = ?',
        [tagName]
      );
      
      // 尝试作为chapter_id查询
      const [chapterResult] = await connection.query(
        'SELECT chapter_id FROM computer1_chapter WHERE chapter_id = ?',
        [tagName]
      );
      
      // 如果都查不到，说明是无效考点
      if (tagResult.length === 0 && chapterResult.length === 0) {
        invalidTagIds.push(tag.tag_id);
      }
    }
    
    if (invalidTagIds.length === 0) {
      await connection.commit();
      return res.json(successResponse({ deletedCount: 0 }, '没有无效考点需要清理'));
    }
    
    // 删除关联关系
    await connection.query(
      'DELETE FROM computer1_question_tag_relation WHERE tag_id IN (?)',
      [invalidTagIds]
    );
    
    // 删除无效考点
    await connection.query(
      'DELETE FROM computer1_knowledge_tag WHERE tag_id IN (?)',
      [invalidTagIds]
    );
    
    await connection.commit();
    res.json(successResponse({ deletedCount: invalidTagIds.length }, `成功清理 ${invalidTagIds.length} 个无效考点`));
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('清理无效考点失败:', error);
    res.status(500).json(errorResponse('清理无效考点失败: ' + error.message));
  } finally {
    if (connection) connection.release();
  }
};

// 管理员校对考点名称（将纯数字tag_name替换为对应的chapter_name）
const adminProofreadTags = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    
    // 查找所有tag_name为纯数字的考点
    const [numericTags] = await connection.query(
      'SELECT tag_id, tag_name, chapter_id FROM computer1_knowledge_tag WHERE tag_name REGEXP "^[0-9]+$"'
    );
    
    let updatedCount = 0;
    
    // 检查每个数字tag_name是否能在chapter表中找到对应记录
    for (const tag of numericTags) {
      const tagName = tag.tag_name;
      
      // 尝试作为chapter_id查询
      const [chapterResult] = await connection.query(
        'SELECT chapter_name FROM computer1_chapter WHERE chapter_id = ?',
        [tagName]
      );
      
      // 如果找到对应的章节，更新tag_name
      if (chapterResult.length > 0 && chapterResult[0].chapter_name) {
        await connection.query(
          'UPDATE computer1_knowledge_tag SET tag_name = ? WHERE tag_id = ?',
          [chapterResult[0].chapter_name, tag.tag_id]
        );
        updatedCount++;
      }
    }
    
    await connection.commit();
    res.json(successResponse({ updatedCount }, `成功校对 ${updatedCount} 个考点名称`));
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('校对考点名称失败:', error);
    res.status(500).json(errorResponse('校对考点名称失败: ' + error.message));
  } finally {
    if (connection) connection.release();
  }
};

// 管理员批量移动考点
const adminBatchMoveTags = async (req, res) => {
  try {
    const { tagIds, chapter_id } = req.body;
    
    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      return res.status(400).json(errorResponse('请选择要移动的考点'));
    }
    
    if (!chapter_id) {
      return res.status(400).json(errorResponse('请选择目标章节'));
    }
    
    await mysqlPool.query(
      'UPDATE computer1_knowledge_tag SET chapter_id = ? WHERE tag_id IN (?)',
      [chapter_id, tagIds]
    );
    
    res.json(successResponse({ movedCount: tagIds.length }, `成功移动 ${tagIds.length} 个考点`));
  } catch (error) {
    console.error('批量移动考点失败:', error);
    res.status(500).json(errorResponse('批量移动失败: ' + error.message));
  }
};

// 管理员获取考点下的题目列表
const adminGetTagQuestions = async (req, res) => {
  try {
    const { tagId } = req.params;
    
    const [questions] = await mysqlPool.query(
      `SELECT 
        q.question_id,
        q.stem,
        q.exercise_type_name,
        q.answer,
        q.analysis,
        q.exam_full_name,
        q.exam_time,
        c.chapter_name
      FROM computer1_question q
      JOIN computer1_question_tag_relation r ON q.question_id = r.question_id
      LEFT JOIN computer1_chapter c ON q.chapter_id = c.chapter_id
      WHERE r.tag_id = ?
      ORDER BY q.create_time DESC`,
      [tagId]
    );
    
    // 为每个题目获取选项和所有考点
    for (let q of questions) {
      // 获取选项
      const [options] = await mysqlPool.query(
        `SELECT option_key, option_value 
         FROM computer1_question_option 
         WHERE question_id = ? 
         ORDER BY option_sort ASC`,
        [q.question_id]
      );
      q.options = options;
      
      // 获取该题目的所有考点
      const [tags] = await mysqlPool.query(
        `SELECT kt.tag_id, kt.tag_name
         FROM computer1_knowledge_tag kt
         JOIN computer1_question_tag_relation r ON kt.tag_id = r.tag_id
         WHERE r.question_id = ?`,
        [q.question_id]
      );
      q.all_tags = tags;
    }
    
    res.json(successResponse(questions));
  } catch (error) {
    console.error('获取考点题目失败:', error);
    res.status(500).json(errorResponse('获取题目失败: ' + error.message));
  }
};

const adminSearchQuestions = async (req, res) => {
  try {
    const { keyword, type, major_id, chapter_id, noValidTags, noChapter, noTags, noMajor, page = 1, size = 20 } = req.query;
    let query = `
      SELECT q.*, c.chapter_name, s.subject_name as major_name
      FROM computer1_question q
      LEFT JOIN computer1_chapter c ON q.chapter_id = c.chapter_id
      LEFT JOIN computer1_subject s ON q.major_id = s.major_id
      WHERE 1=1
    `;
    const params = [];

    if (keyword) {
      query += ' AND (q.stem LIKE ? OR q.question_id LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (type && type !== '全部') {
      query += ' AND q.exercise_type_name = ?';
      params.push(type);
    }

    if (major_id) {
      query += ' AND q.major_id = ?';
      params.push(major_id);
    }

    if (chapter_id) {
      query += ' AND q.chapter_id = ?';
      params.push(chapter_id);
    }

    // 筛选无科目的题目
    if (noMajor === 'true') {
      query += ' AND (q.major_id IS NULL OR q.major_id = "")';
    }

    // 筛选无章节的题目
    if (noChapter === 'true') {
      query += ' AND (q.chapter_id IS NULL OR q.chapter_id = "")';
    }

    // 筛选无考点的题目
    if (noTags === 'true') {
      query += ' AND NOT EXISTS (SELECT 1 FROM computer1_question_tag_relation r WHERE r.question_id = q.question_id)';
    }

    query += ' ORDER BY q.create_time DESC LIMIT ?, ?';
    params.push((parseInt(page) - 1) * parseInt(size), parseInt(size));

    const [questions] = await mysqlPool.query(query, params);

    // 为每个题目获取选项、小题和标签
    for (let q of questions) {
      const [options] = await mysqlPool.query(
        'SELECT option_key, option_value FROM computer1_question_option WHERE question_id = ? ORDER BY option_sort ASC',
        [q.question_id]
      );
      q.options = options;

      const [subs] = await mysqlPool.query(
        'SELECT * FROM computer1_question_sub WHERE question_id = ? ORDER BY question_order ASC',
        [q.question_id]
      );
      q.subs = subs;

      const [tags] = await mysqlPool.query(
        `SELECT t.tag_id, t.tag_name 
         FROM computer1_knowledge_tag t
         JOIN computer1_question_tag_relation r ON t.tag_id = r.tag_id
         WHERE r.question_id = ?`,
        [q.question_id]
      );
      q.knowledgeTags = tags;
      q.knowledgeTagNames = tags.map(t => t.tag_name);
    }

    // 筛选无有效考点的题目（所有考点都是未命名/纯数字）
    let filteredQuestions = questions;
    if (noValidTags === 'true') {
      filteredQuestions = questions.filter(q => {
        // 如果没有考点，或者所有考点都是纯数字（未命名）
        if (!q.knowledgeTags || q.knowledgeTags.length === 0) return false;
        return q.knowledgeTags.every(t => !t.tag_name || /^\d+$/.test(t.tag_name));
      });
    }

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM computer1_question q WHERE 1=1';
    const countParams = [];
    if (keyword) {
      countQuery += ' AND (q.stem LIKE ? OR q.question_id LIKE ?)';
      countParams.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (type && type !== '全部') {
      countQuery += ' AND q.exercise_type_name = ?';
      countParams.push(type);
    }
    if (major_id) {
      countQuery += ' AND q.major_id = ?';
      countParams.push(major_id);
    }
    if (chapter_id) {
      countQuery += ' AND q.chapter_id = ?';
      countParams.push(chapter_id);
    }
    if (noMajor === 'true') {
      countQuery += ' AND (q.major_id IS NULL OR q.major_id = "")';
    }
    if (noChapter === 'true') {
      countQuery += ' AND (q.chapter_id IS NULL OR q.chapter_id = "")';
    }
    if (noTags === 'true') {
      countQuery += ' AND NOT EXISTS (SELECT 1 FROM computer1_question_tag_relation r WHERE r.question_id = q.question_id)';
    }
    const [[{ total }]] = await mysqlPool.query(countQuery, countParams);

    res.json(successResponse({ questions: filteredQuestions, total }));
  } catch (error) {
    console.error('搜索题目失败:', error);
    res.status(500).json(errorResponse('搜索题目失败'));
  }
};

const getProgressList = async (req, res) => {
  try {
    const userId = req.userId;
    const [progress] = await mysqlPool.query(
      'SELECT QuestionID, IsCorrect FROM computer1_user_progress WHERE UserID = ? AND Status = 1',
      [userId]
    );
    res.json(successResponse(progress));
  } catch (error) {
    console.error('管理员删除题目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// --- 精选题库相关 ---

const getCuratedBanks = async (req, res) => {
  try {
    const userId = req.userId;
    const { subjectId } = req.query;
    
    let query = 'SELECT * FROM computer1_curated_banks WHERE UserID = ?';
    const params = [userId];
    
    if (subjectId) {
      query += ' AND SubjectID = ?';
      params.push(subjectId);
    }
    
    query += ' ORDER BY CreatedAt DESC';
    
    const [banks] = await mysqlPool.query(query, params);
    res.json(successResponse(banks));
  } catch (error) {
    console.error('获取计算机精选题库失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const createCuratedBank = async (req, res) => {
  try {
    const userId = req.userId;
    const { title, description, subjectId } = req.body;
    
    if (!title || !subjectId) {
      return res.status(400).json(errorResponse('标题和科目不能为空'));
    }
    
    const [result] = await mysqlPool.query(
      'INSERT INTO computer1_curated_banks (UserID, SubjectID, Title, Description) VALUES (?, ?, ?, ?)',
      [userId, subjectId, title, description || '']
    );
    
    res.json(successResponse({ bankId: result.insertId }, '题库创建成功'));
  } catch (error) {
    console.error('创建计算机精选题库失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const updateCuratedBank = async (req, res) => {
  try {
    const userId = req.userId;
    const { bankId } = req.params;
    const { title, description } = req.body;
    
    const [result] = await mysqlPool.query(
      'UPDATE computer1_curated_banks SET Title = ?, Description = ? WHERE BankID = ? AND UserID = ?',
      [title, description, bankId, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json(errorResponse('题库不存在或无权操作'));
    }
    
    res.json(successResponse(null, '题库更新成功'));
  } catch (error) {
    console.error('更新计算机精选题库失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const deleteCuratedBank = async (req, res) => {
  try {
    const userId = req.userId;
    const { bankId } = req.params;
    
    const [result] = await mysqlPool.query(
      'DELETE FROM computer1_curated_banks WHERE BankID = ? AND UserID = ?',
      [bankId, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json(errorResponse('题库不存在或无权操作'));
    }
    
    res.json(successResponse(null, '题库已删除'));
  } catch (error) {
    console.error('删除计算机精选题库失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getCuratedChapters = async (req, res) => {
  try {
    const { bankId } = req.params;
    
    const [chapters] = await mysqlPool.query(
      'SELECT ChapterID, BankID, ChapterName as Title, SortOrder, CreatedAt FROM computer1_curated_chapters WHERE BankID = ? ORDER BY SortOrder ASC, CreatedAt ASC',
      [bankId]
    );
    
    res.json(successResponse(chapters));
  } catch (error) {
    console.error('获取计算机题库章节失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const createCuratedChapter = async (req, res) => {
  try {
    const { bankId } = req.params;
    const { title, sortOrder } = req.body;
    
    if (!title) {
      return res.status(400).json(errorResponse('章节标题不能为空'));
    }
    
    const [result] = await mysqlPool.query(
      'INSERT INTO computer1_curated_chapters (BankID, ChapterName, SortOrder) VALUES (?, ?, ?)',
      [bankId, title, sortOrder || 0]
    );
    
    res.json(successResponse({ chapterId: result.insertId }, '章节创建成功'));
  } catch (error) {
    console.error('创建计算机题库章节失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const updateCuratedChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { title, sortOrder } = req.body;
    
    const [result] = await mysqlPool.query(
      'UPDATE computer1_curated_chapters SET ChapterName = ?, SortOrder = ? WHERE ChapterID = ?',
      [title, sortOrder, chapterId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json(errorResponse('章节不存在'));
    }
    
    res.json(successResponse(null, '章节更新成功'));
  } catch (error) {
    console.error('更新计算机题库章节失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const deleteCuratedChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;
    
    const [result] = await mysqlPool.query(
      'DELETE FROM computer1_curated_chapters WHERE ChapterID = ?',
      [chapterId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json(errorResponse('章节不存在'));
    }
    
    res.json(successResponse(null, '章节已删除'));
  } catch (error) {
    console.error('删除计算机题库章节失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getCuratedQuestions = async (req, res) => {
  try {
    const { chapterId } = req.params;
    
    const [questions] = await mysqlPool.query(
      `SELECT cq.ID, cq.QuestionID, cq.SortOrder, q.exercise_type_name as QuestionType, q.stem as QuestionText, q.level as Difficulty
       FROM computer1_curated_questions cq
       JOIN computer1_question q ON cq.QuestionID = q.question_id
       WHERE cq.ChapterID = ?
       ORDER BY cq.SortOrder ASC, cq.CreatedAt ASC`,
      [chapterId]
    );
    
    res.json(successResponse(questions));
  } catch (error) {
    console.error('获取计算机章节题目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const addQuestionsToCuratedChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { questionIds } = req.body;
    
    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json(errorResponse('题目列表不能为空'));
    }
    
    const values = questionIds.map(id => [chapterId, id]);
    
    await mysqlPool.query(
      'INSERT IGNORE INTO computer1_curated_questions (ChapterID, QuestionID) VALUES ?',
      [values]
    );
    
    res.json(successResponse(null, '题目已成功加入精选题库'));
  } catch (error) {
    console.error('添加题目到计算机精选题库失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const removeQuestionFromCurated = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await mysqlPool.query(
      'DELETE FROM computer1_curated_questions WHERE ID = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json(errorResponse('记录不存在'));
    }
    
    res.json(successResponse(null, '题目已从精选题库移除'));
  } catch (error) {
    console.error('移除计算机精选题库题目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// --- 批量获取题目详情 (用于精选题库搜索等) ---
const getBatchQuestionDetails = async (req, res) => {
  try {
    const { questionIds } = req.query;
    if (!questionIds) return res.status(400).json(errorResponse('题目IDs不能为空'));

    const ids = questionIds.split(',').map(id => id.trim()).filter(id => id);
    if (ids.length === 0) return res.status(400).json(errorResponse('无效的题目IDs'));

    const allQuestionsData = {};

    // 1. 获取主表信息
    const [questions] = await mysqlPool.query('SELECT * FROM computer1_question WHERE question_id IN (?)', [ids]);
    
    // 2. 获取选项
    const [options] = await mysqlPool.query(
      'SELECT question_id, option_key, option_value FROM computer1_question_option WHERE question_id IN (?) ORDER BY option_sort ASC',
      [ids]
    );

    // 3. 获取小题
    const [subs] = await mysqlPool.query(
      'SELECT * FROM computer1_question_sub WHERE question_id IN (?) ORDER BY question_order ASC',
      [ids]
    );

    // 4. 获取标签 (包含从章节和科目表中获取名称作为兜底)
    const [tags] = await mysqlPool.query(
      `SELECT 
         r.question_id, 
         r.tag_id, 
         COALESCE(t.tag_name, c.chapter_name, s.subject_name) as tag_name
       FROM computer1_question_tag_relation r
       LEFT JOIN computer1_knowledge_tag t ON r.tag_id = t.tag_id
       LEFT JOIN computer1_chapter c ON r.tag_id = c.chapter_id
       LEFT JOIN computer1_subject s ON r.tag_id = s.major_id
       WHERE r.question_id IN (?)`,
      [ids]
    );

    // 组装数据
    for (const id of ids) {
      const q = questions.find(item => item.question_id === id);
      if (!q) continue;

      const qOptions = options.filter(opt => opt.question_id === id);
      const qSubs = subs.filter(sub => sub.question_id === id);
      const qTags = tags.filter(tag => tag.question_id === id);

      allQuestionsData[id] = {
        first_request: [{
          ...q,
          options: qOptions,
          subs: qSubs,
          tags: qTags
        }],
        second_request: [], // 计算机暂无 math 那样的 detail 表，预留结构
        third_request: []
      };
    }

    res.json(successResponse(allQuestionsData));
  } catch (error) {
    console.error('批量获取计算机题目详情失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 批量获取题目详情 (POST, 返回完整数组, 用于练习页)
const getBatchQuestionDetailsFull = async (req, res) => {
  try {
    const { questionIds } = req.body;
    if (!questionIds || !Array.isArray(questionIds)) {
      return res.status(400).json(errorResponse('题目IDs必须是数组'));
    }

    if (questionIds.length === 0) {
      return res.json(successResponse([]));
    }

    // 1. 获取主表信息
    const [questions] = await mysqlPool.query(`
      SELECT q.*, c.chapter_name, s.subject_name as major_name, p_info.paper_name as exam_paper_name
      FROM computer1_question q 
      LEFT JOIN computer1_chapter c ON q.chapter_id = c.chapter_id 
      LEFT JOIN computer1_subject s ON q.major_id = s.major_id
      LEFT JOIN (
        SELECT pq.question_id, MAX(p.title) as paper_name 
        FROM computer1_paper_question pq 
        JOIN computer1_paper p ON pq.paper_id = p.id
        GROUP BY pq.question_id
      ) p_info ON q.question_id = p_info.question_id
      WHERE q.question_id IN (?)
    `, [questionIds]);
    
    if (questions.length === 0) {
      return res.json(successResponse([]));
    }

    const ids = questions.map(q => q.question_id);

    // 2. 获取选项
    const [options] = await mysqlPool.query(
      'SELECT question_id, option_key, option_value FROM computer1_question_option WHERE question_id IN (?) ORDER BY option_sort ASC',
      [ids]
    );

    // 3. 获取小题
    const [subs] = await mysqlPool.query(
      'SELECT * FROM computer1_question_sub WHERE question_id IN (?) ORDER BY question_order ASC',
      [ids]
    );

    // 4. 获取标签 (包含从章节和科目表中获取名称作为兜底)
    const [tags] = await mysqlPool.query(
      `SELECT 
         r.question_id, 
         r.tag_id, 
         COALESCE(t.tag_name, c.chapter_name, s.subject_name) as tag_name
       FROM computer1_question_tag_relation r
       LEFT JOIN computer1_knowledge_tag t ON r.tag_id = t.tag_id
       LEFT JOIN computer1_chapter c ON r.tag_id = c.chapter_id
       LEFT JOIN computer1_subject s ON r.tag_id = s.major_id
       WHERE r.question_id IN (?)`,
      [ids]
    );

    // 组装数据，保持原始 questionIds 的顺序
    const fullQuestions = questionIds.map(id => {
      const q = questions.find(item => String(item.question_id) === String(id));
      if (!q) return null;

      return {
        ...q,
        options: options.filter(opt => String(opt.question_id) === String(id)),
        subs: subs.filter(sub => String(sub.question_id) === String(id)),
        tags: tags.filter(tag => String(tag.question_id) === String(id))
      };
    }).filter(q => q !== null);

    res.json(successResponse(fullQuestions));
  } catch (error) {
    console.error('批量获取计算机题目详情全量失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 批量获取题目 (用于手动组卷等)
const getQuestionsBatch = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json(errorResponse('IDs必须是数组'));
    }

    if (ids.length === 0) {
      return res.json(successResponse([]));
    }

    const [questions] = await mysqlPool.query(
      'SELECT question_id, exercise_type, exercise_type_name, stem, level, total_score, from_school, exam_time, exam_code FROM computer1_question WHERE question_id IN (?)',
      [ids]
    );

    res.json(successResponse(questions));
  } catch (error) {
    console.error('批量获取计算机题目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取章节的题集
const getChapterQuestionSet = async (req, res) => {
  try {
    const { chapterId } = req.params;
    
    const [questions] = await mysqlPool.query(`
      SELECT q.*, cqs.sort, cqs.remark, cqs.id as set_id
      FROM computer1_chapter_question_set cqs
      JOIN computer1_question q ON cqs.question_id = q.question_id
      WHERE cqs.chapter_id = ?
      ORDER BY cqs.sort ASC, cqs.create_time ASC
    `, [chapterId]);
    
    // 获取选项
    for (let q of questions) {
      const [options] = await mysqlPool.query(
        'SELECT option_key, option_value FROM computer1_question_option WHERE question_id = ? ORDER BY option_sort ASC',
        [q.question_id]
      );
      q.options = options;
    }
    
    res.json(successResponse(questions));
  } catch (error) {
    console.error('获取章节题集失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 从章节题集中移除题目（同时删除复制的题目数据）
const removeQuestionFromChapterSet = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { chapterId, questionId } = req.params;
    
    await connection.beginTransaction();
    
    // 1. 从题集关联表中删除
    await connection.query(
      'DELETE FROM computer1_chapter_question_set WHERE chapter_id = ? AND question_id = ?',
      [chapterId, questionId]
    );
    
    // 2. 删除题目数据（包括选项、小题、标签等）
    // 先删除关联数据
    await connection.query('DELETE FROM computer1_question_option WHERE question_id = ?', [questionId]);
    await connection.query('DELETE FROM computer1_question_sub WHERE question_id = ?', [questionId]);
    await connection.query('DELETE FROM computer1_question_tag_relation WHERE question_id = ?', [questionId]);
    
    // 再删除题目本身
    await connection.query('DELETE FROM computer1_question WHERE question_id = ?', [questionId]);
    
    await connection.commit();
    
    res.json(successResponse(null, '移除成功'));
  } catch (error) {
    await connection.rollback();
    console.error('从章节题集移除题目失败:', error);
    res.status(500).json(errorResponse('移除失败'));
  } finally {
    connection.release();
  }
};

// 添加题目到章节题集（复制题目数据，生成新ID）
const addQuestionsToChapterSet = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { chapterId } = req.params;
    const { questionIds, remark, targetMajorId, targetChapterId } = req.body;
    
    console.log('添加题目到章节:', { chapterId, questionIds, remark, targetMajorId, targetChapterId });
    
    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json(errorResponse('请选择要添加的题目'));
    }
    
    // 获取目标章节信息
    const [targetChapter] = await connection.query(
      'SELECT major_id FROM computer1_chapter WHERE chapter_id = ?',
      [chapterId]
    );
    
    console.log('目标章节:', targetChapter);
    
    if (targetChapter.length === 0) {
      return res.status(404).json(errorResponse('目标章节不存在'));
    }
    
    const finalMajorId = targetMajorId || targetChapter[0].major_id;
    const finalChapterId = targetChapterId || chapterId;
    
    console.log('最终目标:', { finalMajorId, finalChapterId });
    
    await connection.beginTransaction();
    
    let addedCount = 0;
    
    for (const sourceQuestionId of questionIds) {
      console.log('处理题目:', sourceQuestionId);
      
      // 1. 获取原题目数据
      const [questions] = await connection.query(
        'SELECT * FROM computer1_question WHERE question_id = ?',
        [sourceQuestionId]
      );
      
      console.log('找到原题目:', questions.length);
      
      if (questions.length === 0) continue;
      
      const sourceQuestion = questions[0];
      
      // 2. 生成新题目ID
      const newQuestionId = generateId();
      console.log('生成新题目ID:', newQuestionId, '原题目ID:', sourceQuestionId);
      console.log('使用科目:', finalMajorId, '章节:', finalChapterId);
      
      // 3. 插入新题目（复制数据，修改章节和科目）
      console.log('插入新题目参数:', {
        newQuestionId,
        finalMajorId,
        finalChapterId,
        sourceMajorId: sourceQuestion.major_id,
        sourceChapterId: sourceQuestion.chapter_id
      });
      
      await connection.query(
        `INSERT INTO computer1_question 
         (question_id, stem, answer, analysis, level, total_score,
          exam_id, category_id, major_id, chapter_id, exam_group_id, 
          exercise_type, exercise_type_name, from_school, exam_time, 
          exam_code, exam_full_name, exercise_number, video_url, create_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          newQuestionId,
          sourceQuestion.stem,
          sourceQuestion.answer,
          sourceQuestion.analysis,
          sourceQuestion.level,
          sourceQuestion.total_score,
          sourceQuestion.exam_id,
          sourceQuestion.category_id,
          finalMajorId,
          finalChapterId,
          sourceQuestion.exam_group_id,
          sourceQuestion.exercise_type,
          sourceQuestion.exercise_type_name,
          sourceQuestion.from_school,
          sourceQuestion.exam_time,
          sourceQuestion.exam_code,
          sourceQuestion.exam_full_name,
          sourceQuestion.exercise_number,
          sourceQuestion.video_url
        ]
      );
      
      // 4. 复制选项
      const [options] = await connection.query(
        'SELECT * FROM computer1_question_option WHERE question_id = ?',
        [sourceQuestionId]
      );
      
      for (const opt of options) {
        await connection.query(
          `INSERT INTO computer1_question_option 
           (question_id, option_key, option_value, option_sort)
           VALUES (?, ?, ?, ?)`,
          [newQuestionId, opt.option_key, opt.option_value, opt.option_sort]
        );
      }
      
      // 5. 复制小题（如果是复合题）
      const [subs] = await connection.query(
        'SELECT * FROM computer1_question_sub WHERE question_id = ?',
        [sourceQuestionId]
      );
      
      for (const sub of subs) {
        const newSubId = generateId();
        await connection.query(
          `INSERT INTO computer1_question_sub 
           (sub_id, question_id, question_order, stem, answer, analysis, score)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newSubId, newQuestionId, sub.question_order, sub.stem, sub.answer, sub.analysis, sub.score]
        );
      }
      
      // 6. 不复制知识点标签，因为标签属于原章节的知识体系
      // 新题目只通过 computer1_chapter_question_set 表关联到目标章节
      
      // 7. 添加到章节题集关联表
      await connection.query(
        'INSERT INTO computer1_chapter_question_set (chapter_id, question_id, remark) VALUES (?, ?, ?)',
        [chapterId, newQuestionId, remark || '复制添加']
      );
      
      console.log('题目添加成功:', newQuestionId);
      addedCount++;
    }
    
    await connection.commit();
    console.log('事务提交成功，共添加:', addedCount);
    
    res.json(successResponse({ addedCount }, `成功添加 ${addedCount} 道题目`));
  } catch (error) {
    await connection.rollback();
    console.error('添加题目到章节题集失败:', error);
    res.status(500).json(errorResponse('添加失败: ' + error.message));
  } finally {
    connection.release();
  }
};

// 更新章节题集中题目的排序
const updateChapterQuestionSetSort = async (req, res) => {
  try {
    const { setId } = req.params;
    const { sort } = req.body;
    
    await mysqlPool.query(
      'UPDATE computer1_chapter_question_set SET sort = ? WHERE id = ?',
      [sort, setId]
    );
    
    res.json(successResponse(null, '排序更新成功'));
  } catch (error) {
    console.error('更新排序失败:', error);
    res.status(500).json(errorResponse('更新失败'));
  }
};

// 获取试卷列表（管理员）
const getAdminPapers = async (req, res) => {
  try {
    const { type, page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (type === 'real') {
      whereClause += ' AND paper_type = 1';
    } else if (type === 'mock') {
      whereClause += ' AND paper_type = 2';
    }
    
    const countQuery = `SELECT COUNT(*) as total FROM computer1_paper ${whereClause}`;
    const [countResult] = await mysqlPool.query(countQuery, params);
    const total = countResult[0].total;
    
    const listQuery = `
      SELECT 
        id, 
        title as name, 
        exam_full_name,
        school as from_school,
        year,
        exam_code,
        paper_type,
        difficulty,
        (SELECT COUNT(*) FROM computer1_paper_question WHERE paper_id = p.id) as question_count
      FROM computer1_paper p
      ${whereClause}
      ORDER BY year DESC, id DESC
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(pageSize), offset);
    
    const [list] = await mysqlPool.query(listQuery, params);
    
    res.json(successResponse({
      list,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }));
  } catch (error) {
    console.error('获取试卷列表失败:', error);
    res.status(500).json(errorResponse('获取试卷列表失败'));
  }
};

// 获取所有题目（管理员，用于组卷选择）
const getAllQuestions = async (req, res) => {
  try {
    const { keyword, type, chapterId, page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (keyword) {
      whereClause += ' AND (q.stem LIKE ? OR q.question_id LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    if (type) {
      whereClause += ' AND q.exercise_type_name = ?';
      params.push(type);
    }
    
    if (chapterId) {
      whereClause += ' AND q.chapter_id = ?';
      params.push(chapterId);
    }
    
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM computer1_question q
      ${whereClause}
    `;
    const [countResult] = await mysqlPool.query(countQuery, params);
    const total = countResult[0].total;
    
    const listQuery = `
      SELECT 
        q.question_id,
        q.stem,
        q.exercise_type,
        q.exercise_type_name,
        q.level,
        q.total_score,
        q.chapter_id,
        c.chapter_name
      FROM computer1_question q
      LEFT JOIN computer1_chapter c ON q.chapter_id = c.chapter_id
      ${whereClause}
      ORDER BY q.question_id DESC
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(pageSize), offset);
    
    const [list] = await mysqlPool.query(listQuery, params);
    
    res.json(successResponse({
      list,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }));
  } catch (error) {
    console.error('获取题目列表失败:', error);
    res.status(500).json(errorResponse('获取题目列表失败'));
  }
};

// ==================== 试卷管理功能 ====================

// 获取试卷列表（管理员）
const getPaperList = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword = '', paperType = '', majorId = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (keyword) {
      whereClause += ' AND (p.title LIKE ? OR p.school LIKE ? OR p.exam_full_name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    
    if (paperType) {
      whereClause += ' AND p.paper_type = ?';
      params.push(paperType);
    }
    
    if (majorId) {
      whereClause += ' AND p.major_id = ?';
      params.push(majorId);
    }
    
    // 查询总数
    const [countResult] = await mysqlPool.query(
      `SELECT COUNT(*) as total FROM computer1_paper p ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    
    // 查询列表
    const [papers] = await mysqlPool.query(
      `SELECT p.*, s.subject_name as major_name,
        (SELECT COUNT(*) FROM computer1_paper_question pq WHERE pq.paper_id = p.id) as question_count
       FROM computer1_paper p
       LEFT JOIN computer1_subject s ON p.major_id = s.major_id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT ${parseInt(pageSize)} OFFSET ${offset}`,
      params
    );
    
    res.json(successResponse({
      list: papers,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }));
  } catch (error) {
    console.error('获取试卷列表失败:', error);
    res.status(500).json(errorResponse('获取试卷列表失败'));
  }
};

// 获取试卷详情
const getPaperDetail = async (req, res) => {
  try {
    const { paperId } = req.params;
    
    // 获取试卷基本信息
    const [papers] = await mysqlPool.query(
      `SELECT p.*, s.subject_name as major_name
       FROM computer1_paper p
       LEFT JOIN computer1_subject s ON p.major_id = s.major_id
       WHERE p.id = ?`,
      [paperId]
    );
    
    if (papers.length === 0) {
      return res.status(404).json(errorResponse('试卷不存在'));
    }
    
    const paper = papers[0];
    
    // 获取试卷题目
    const [questions] = await mysqlPool.query(
      `SELECT q.*, pq.sort_order, pq.score as paper_score,
        c.chapter_name, s.subject_name as major_name
       FROM computer1_paper_question pq
       JOIN computer1_question q ON pq.question_id = q.question_id
       LEFT JOIN computer1_chapter c ON q.chapter_id = c.chapter_id
       LEFT JOIN computer1_subject s ON q.major_id = s.major_id
       WHERE pq.paper_id = ?
       ORDER BY pq.sort_order ASC`,
      [paperId]
    );
    
    // 获取题目选项和小题
    for (let q of questions) {
      // 根据 exercise_type_name 判断题型
      const typeName = q.exercise_type_name || '';
      
      // 单选题、多选题、判断题获取选项
      if (typeName === '单选题' || typeName === '多选题' || typeName === '判断题') {
        const [options] = await mysqlPool.query(
          'SELECT option_key, option_value FROM computer1_question_option WHERE question_id = ? ORDER BY option_sort ASC',
          [q.question_id]
        );
        q.options = options;
      }
      
      // 解答题获取小题
      if (typeName === '解答题') {
        const [subs] = await mysqlPool.query(
          'SELECT * FROM computer1_question_sub WHERE question_id = ? ORDER BY question_order ASC',
          [q.question_id]
        );
        q.subs = subs;
      }
    }
    
    paper.questions = questions;
    
    res.json(successResponse(paper));
  } catch (error) {
    console.error('获取试卷详情失败:', error);
    res.status(500).json(errorResponse('获取试卷详情失败'));
  }
};

// 更新试卷
const updatePaper = async (req, res) => {
  try {
    const { paperId } = req.params;
    const { title, year, school, exam_code, major_id, total_score, duration, difficulty, paper_type, exam_full_name } = req.body;
    
    // 检查试卷是否存在
    const [existing] = await mysqlPool.query('SELECT id FROM computer1_paper WHERE id = ?', [paperId]);
    if (existing.length === 0) {
      return res.status(404).json(errorResponse('试卷不存在'));
    }
    
    // 更新试卷
    await mysqlPool.query(
      `UPDATE computer1_paper SET
        title = ?, year = ?, school = ?, exam_code = ?, major_id = ?,
        total_score = ?, duration = ?, difficulty = ?, paper_type = ?, exam_full_name = ?
       WHERE id = ?`,
      [title, year || null, school || null, exam_code || null, major_id || null,
       total_score || 150, duration || 180, difficulty || '中等', paper_type || 1, exam_full_name || null, paperId]
    );
    
    res.json(successResponse(null, '试卷更新成功'));
  } catch (error) {
    console.error('更新试卷失败:', error);
    res.status(500).json(errorResponse('更新试卷失败'));
  }
};

// 删除试卷
const deletePaper = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { paperId } = req.params;
    const { deleteQuestions } = req.query;
    
    await connection.beginTransaction();
    
    // 检查试卷是否存在
    const [existing] = await connection.query('SELECT id FROM computer1_paper WHERE id = ?', [paperId]);
    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json(errorResponse('试卷不存在'));
    }
    
    // 如果需要同时删除题目
    if (deleteQuestions === 'true') {
      // 获取试卷中的所有题目ID
      const [questions] = await connection.query(
        'SELECT question_id FROM computer1_paper_question WHERE paper_id = ?',
        [paperId]
      );
      
      if (questions.length > 0) {
        const questionIds = questions.map(q => q.question_id);
        
        // 删除题目的关联数据
        await connection.query(
          'DELETE FROM computer1_question_tag_relation WHERE question_id IN (?)',
          [questionIds]
        );
        await connection.query(
          'DELETE FROM computer1_question_option WHERE question_id IN (?)',
          [questionIds]
        );
        await connection.query(
          'DELETE FROM computer1_question_sub WHERE question_id IN (?)',
          [questionIds]
        );
        await connection.query(
          'DELETE FROM computer1_feedback WHERE QuestionID IN (?)',
          [questionIds]
        );
        await connection.query(
          'DELETE FROM computer1_chapter_question_set WHERE question_id IN (?)',
          [questionIds]
        );
        
        // 删除题目
        await connection.query(
          'DELETE FROM computer1_question WHERE question_id IN (?)',
          [questionIds]
        );
      }
    }
    
    // 删除试卷题目关联
    await connection.query('DELETE FROM computer1_paper_question WHERE paper_id = ?', [paperId]);
    
    // 删除试卷
    await connection.query('DELETE FROM computer1_paper WHERE id = ?', [paperId]);
    
    await connection.commit();
    
    res.json(successResponse(null, '试卷删除成功'));
  } catch (error) {
    await connection.rollback();
    console.error('删除试卷失败:', error);
    res.status(500).json(errorResponse('删除试卷失败'));
  } finally {
    connection.release();
  }
};

// 更新试卷题目排序和分值
const updatePaperQuestions = async (req, res) => {
  const connection = await mysqlPool.getConnection();
  try {
    const { paperId } = req.params;
    const { questions } = req.body;
    
    await connection.beginTransaction();
    
    // 检查试卷是否存在
    const [existing] = await connection.query('SELECT id FROM computer1_paper WHERE id = ?', [paperId]);
    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json(errorResponse('试卷不存在'));
    }
    
    // 删除旧的关联
    await connection.query('DELETE FROM computer1_paper_question WHERE paper_id = ?', [paperId]);
    
    // 插入新的关联
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await connection.query(
        'INSERT INTO computer1_paper_question (paper_id, question_id, sort_order, score) VALUES (?, ?, ?, ?)',
        [paperId, q.question_id, q.sort_order || (i + 1), q.score || 2]
      );
    }
    
    await connection.commit();
    
    res.json(successResponse(null, '试卷题目更新成功'));
  } catch (error) {
    await connection.rollback();
    console.error('更新试卷题目失败:', error);
    res.status(500).json(errorResponse('更新试卷题目失败'));
  } finally {
    connection.release();
  }
};

module.exports = {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getChapters,
  createChapter,
  updateChapter,
  deleteChapter,
  getChapterById,
  getKnowledgeTags,
  getAllKnowledgeTags,
  getKnowledgeTagById,
  getKnowledgeTagByName,
  getQuestions,
  getQuestionDetails,
  getBatchQuestionDetails,
  getBatchQuestionDetailsFull,
  getQuestionsBatch,
  toggleFavorite,
  getFavorites,
  checkFavorite,
  getFavoriteCategories,
  createFavoriteCategory,
  deleteFavoriteCategory,
  updateProgress,
  getUserProgress,
  getProgressList,
  getExams,
  generateSmartPaper,
  getUserGeneratedPapers,
  getGeneratedPaper,
  getPrintPaper,
  updatePaperTitle,
  deleteGeneratedPaper,
  replacePaperQuestion,
  importPaper,
  importQuestions,
  submitCorrection,
  resetProgress,
  submitQuestionFeedback,
  getFeedbacks,
  updateFeedbackStatus,
  toggleWrongBook,
  checkWrongBook,
  getWrongBook,
  addToWrongBook,
  removeFromWrongBook,
  clearWrongBook,
  updateWrongBookStatus,
  getWrongBookStats,
  generateTest,
  reportTestScore,
  adminSearchQuestions,
  adminCreateQuestion,
  adminUpdateQuestion,
  adminDeleteQuestion,
  adminBatchAddTagsToQuestions,
  // 笔记相关
  getNotes,
  getNoteReplies,
  addNote,
  toggleNoteLike,
  // 精选题库
  getCuratedBanks,
  createCuratedBank,
  updateCuratedBank,
  deleteCuratedBank,
  getCuratedChapters,
  createCuratedChapter,
  updateCuratedChapter,
  deleteCuratedChapter,
  getCuratedQuestions,
  addQuestionsToCuratedChapter,
  removeQuestionFromCurated,
  // 章节题集
  getChapterQuestionSet,
  addQuestionsToChapterSet,
  removeQuestionFromChapterSet,
  updateChapterQuestionSetSort,
  // 考点管理
  adminGetTags,
  adminCreateTag,
  adminUpdateTag,
  adminDeleteTag,
  adminMoveTag,
  adminBatchMoveTags,
  adminBatchDeleteUnnamedTags,
  adminCleanInvalidTags,
  adminProofreadTags,
  adminGetTagQuestions,
  // 在线考试相关
  getAdminPapers,
  getAllQuestions,
  // 试卷管理
  getPaperList,
  getPaperDetail,
  updatePaper,
  deletePaper,
  updatePaperQuestions
};
