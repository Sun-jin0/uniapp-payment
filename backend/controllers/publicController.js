const Banner = require('../models/Banner');
const Notice = require('../models/Notice');
const Exam = require('../models/Exam');
const Subject = require('../models/Subject');
const ExamType = require('../models/ExamType');
const PublicCategory = require('../models/PublicCategory');
const PublicBook = require('../models/PublicBook');
const PublicQuestion = require('../models/PublicQuestion');
const PublicChapter = require('../models/PublicChapter');
const { successResponse, errorResponse } = require('../utils/response');
const pool = require('../config/mysql');

// Banner methods
exports.getBanners = async (req, res) => {
  try {
    const banners = await Banner.find({ status: 1 });
    res.json(successResponse(banners));
  } catch (error) {
    console.error('获取轮播图失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// Notice methods
exports.getNotices = async (req, res) => {
  try {
    const { type, noticeType, category, keyword, sort, page = 1, size = 2 } = req.query;
    const query = { isActive: 1 };
    
    // 兼容 type 和 noticeType
    const actualType = type || noticeType;
    if (actualType) query.noticeType = actualType;
    if (category) query.category = category;
    if (keyword) query.keyword = keyword;
    if (sort) query.sort = sort;
    
    const skip = (parseInt(page) - 1) * parseInt(size);
    query.skip = skip;
    query.limit = parseInt(size);
    
    const notices = await Notice.find(query);
    res.json(successResponse(notices));
  } catch (error) {
    console.error('获取公告失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.getNoticeById = async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json(errorResponse('内容不存在'));
    }
    res.json(successResponse(notice));
  } catch (error) {
    console.error('获取公告详情失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.incrementNoticeViewCount = async (req, res) => {
  try {
    await pool.query('UPDATE notices SET viewCount = viewCount + 1 WHERE id = ?', [req.params.id]);
    res.json(successResponse({ success: true }));
  } catch (error) {
    console.error('更新浏览量失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// Exam methods
exports.getExams = async (req, res) => {
  try {
    const { subjectId, type, status = 1 } = req.query;
    const query = { status };
    if (subjectId) query.subjectId = subjectId;
    if (type) query.type = type;
    
    const exams = await Exam.find(query);
    res.json(successResponse(exams));
  } catch (error) {
    console.error('获取试卷列表失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// Subject methods
exports.getSubjects = async (req, res) => {
  try {
    // 1. 获取导航科目 (从 nav_subjects 表获取，统一管理)
    const [navSubjects] = await pool.query(
      'SELECT id, name, subject_code as code, page_path, icon, text_icon, color, category_type, description FROM nav_subjects WHERE status = 1 ORDER BY sort ASC, id ASC'
    );

    // 2. 为每个科目获取其分类或子项
    const subjectsWithItems = await Promise.all(navSubjects.map(async (subject) => {
      let items = [];

      // 1. 如果有 subject_code，获取公共题库科目 (如 politics, english, math, computer)
      if (subject.code) {
        // 获取该科目下的二级类目 (如 "习题册", "模拟卷", "真题卷")
        const [secondLevelCats] = await pool.query(
          'SELECT id, name, sort FROM public_categories WHERE subject = ? AND level = 2 ORDER BY sort ASC, id ASC',
          [subject.code]
        );

        if (secondLevelCats.length > 0) {
          const publicItems = secondLevelCats.map(cat => ({
            id: `public_${cat.id}`,
            name: cat.name,
            url: `/pages/public/public-book-list?subject=${subject.code}&categoryId=${cat.id}&title=${encodeURIComponent(cat.name)}`,
            is_public: true,
            sort: cat.sort || 0
          }));
          items = [...items, ...publicItems];
        }
      }

      // 2. 获取用户在 nav_categories 中自建的子项
      const [navCats] = await pool.query(
        'SELECT id, name, page_path as url, sort FROM nav_categories WHERE subject_id = ? AND (status = 1 OR status IS NULL) ORDER BY sort ASC',
        [subject.id]
      );

      if (navCats.length > 0) {
        const navItems = navCats.map(cat => {
          // 统一处理路径格式，将旧路径转换为新路径
          let url = cat.url || cat.page_path;
          if (url) {
            // 处理双层路径变为单层路径
            url = url.replace('/pages/public/public-book-list/public-book-list', '/pages/public/public-book-list');
            url = url.replace('/pages/public/public-book-detail/public-book-detail', '/pages/public/public-book-detail');
            url = url.replace('/pages/public/public-practice/public-practice', '/pages/public/public-practice');
            url = url.replace('/pages/public/public-category-list/public-category-list', '/pages/public/public-category-list');
            // 处理旧单层路径变为新单层路径
            url = url.replace('/pages/public-book-list/', '/pages/public/public-book-list');
            url = url.replace('/pages/public-book-detail/', '/pages/public/public-book-detail');
            url = url.replace('/pages/public-practice/', '/pages/public/public-practice');
            url = url.replace('/pages/public-category-list/', '/pages/public/public-category-list');
          }
          return {
            ...cat,
            url: url,
            is_public: false,
            sort: cat.sort || 0
          };
        });
        items = [...items, ...navItems];
      }

      // 3. 按 sort 统一排序，公共和非公共混排
      items.sort((a, b) => {
        // 先按 sort 排序
        if ((a.sort || 0) !== (b.sort || 0)) {
          return (a.sort || 0) - (b.sort || 0);
        }
        // sort 相同时，公共的排在前面
        if (a.is_public !== b.is_public) {
          return a.is_public ? -1 : 1;
        }
        return 0;
      });

      // 3. 如果都没有，查找传统科目 chapters (保留原有兜底逻辑)
      if (items.length === 0) {
        const [chapters] = await pool.query(
          'SELECT id, title as name, sort FROM chapters WHERE subjectId = ? AND status = 1 ORDER BY sort ASC',
          [subject.id]
        );
        
        if (chapters.length > 0) {
          items = chapters.map(c => {
            let page_path = '';
            if (subject.name.includes('计算机')) {
              page_path = `/pages/computer/computer-question-list?majorId=${subject.id}&chapterId=${c.id}&title=${encodeURIComponent(c.name)}`;
            } else {
              page_path = `/pages/math/math-book-detail?bookId=${subject.id}&bookTitle=${encodeURIComponent(subject.name)}`;
            }
            return {
              id: c.id,
              name: c.name,
              url: page_path,
              is_public: false,
              sort: c.sort || 0
            };
          });
        }
      }

      return {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        page_path: subject.page_path,
        icon: subject.icon,
        text_icon: subject.text_icon,
        color: subject.color,
        category_type: subject.category_type,
        description: subject.description,
        categories: items
      };
    }));

    res.json(successResponse(subjectsWithItems));
  } catch (error) {
    console.error('获取科目列表失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// Exam Type methods
exports.getExamTypes = async (req, res) => {
  try {
    const types = await ExamType.find({ status: 1 });
    res.json(successResponse(types));
  } catch (error) {
    console.error('获取考试类型失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// --- Public Question Bank Methods (New) ---

exports.getCategories = async (req, res) => {
  try {
    const { subject, parentId, level } = req.query;
    const categories = await PublicCategory.find({ subject, parentId, level });
    res.json(successResponse(categories));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

exports.getBooks = async (req, res) => {
  try {
    const { subject, categoryId, level, includeInactive } = req.query;
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (includeInactive !== 'true') {
      whereClause += ' AND b.status = 1';
    }

    if (subject && subject !== 'all') {
      whereClause += ' AND b.subject = ?';
      params.push(subject);
    }

    if (categoryId && level) {
      const levelColumn = level === '1' ? 'first_category_id' : (level === '2' ? 'second_category_id' : 'third_category_id');
      whereClause += ` AND b.${levelColumn} = ?`;
      params.push(categoryId);
    }

    // 同时获取题目数量和三级分类名称
    const sql = `
      SELECT b.*, COUNT(q.id) as questionCount, c.name as third_category_name
      FROM public_books b
      LEFT JOIN public_questions q ON b.id = q.bookId
      LEFT JOIN public_categories c ON b.third_category_id = c.id
      ${whereClause}
      GROUP BY b.id, c.name
      ORDER BY b.sort ASC, b.id ASC
    `;

    const [books] = await pool.query(sql, params);
    res.json(successResponse(books));
  } catch (error) {
    console.error('getBooks Error:', error);
    res.status(500).json(errorResponse(error.message));
  }
};

exports.getQuestions = async (req, res) => {
  try {
    const { bookId, page, pageSize = 20, chapterId, type, mode } = req.query;
    const userId = req.userId; // 已经通过 auth 中间件
    
    if (!bookId) {
      return res.json(successResponse([], 'bookId is required'));
    }

    let chapterRange = null;
    if (chapterId && mode !== 'wrong' && mode !== 'favorite') {
      const [chapter] = await pool.query(
        'SELECT start_index, end_index FROM public_chapters WHERE id = ?',
        [chapterId]
      );
      if (chapter.length > 0) {
        chapterRange = chapter[0];
      }
    }

    // 基础 SQL 逻辑构建
    let baseSql = `
      SELECT q.*, s.averageScore, s.totalAttempts, 
             IF(f.id IS NOT NULL, 1, 0) as isFavorite
      FROM public_questions q
      LEFT JOIN public_question_stats s ON q.id = s.questionId
      LEFT JOIN public_favorite_questions f ON q.id = f.questionId AND f.userId = ?
    `;

    const params = [userId];
    const bId = parseInt(bookId);
    
    // 验证 bookId 是否为有效数字
    if (isNaN(bId)) {
      return res.json(successResponse([], 'Invalid bookId'));
    }

    if (mode === 'wrong') {
      baseSql += ` INNER JOIN public_wrong_questions w ON q.id = w.questionId AND w.userId = ? `;
      params.push(userId);
    } else if (mode === 'favorite') {
      baseSql = `
        SELECT q.*, s.averageScore, s.totalAttempts, 1 as isFavorite
        FROM public_questions q
        INNER JOIN public_favorite_questions f ON q.id = f.questionId AND f.userId = ?
        LEFT JOIN public_question_stats s ON q.id = s.questionId
      `;
      params[0] = userId;
    }

    baseSql += ` WHERE q.bookId = ? `;
    params.push(bId);

    // 处理章节范围
    if (chapterRange) {
      baseSql += ' AND q.sort BETWEEN ? AND ?';
      params.push(chapterRange.start_index, chapterRange.end_index);
    }

    // 处理题型过滤
    if (type && type !== 'null' && !isNaN(parseInt(type))) {
      baseSql += ' AND q.type = ?';
      params.push(parseInt(type));
    }

    baseSql += ` ORDER BY q.sort ASC, q.id ASC`;

    // 处理分页
    if (page) {
      const limit = parseInt(pageSize);
      const offset = (parseInt(page) - 1) * limit;
      baseSql += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
    }

    const [rows] = await pool.query(baseSql, params);

    // 获取总数
    let countSql = `SELECT COUNT(*) as total FROM public_questions q `;
    const countParams = [];

    if (mode === 'wrong') {
      countSql += ` INNER JOIN public_wrong_questions w ON q.id = w.questionId AND w.userId = ? `;
      countParams.push(userId);
    } else if (mode === 'favorite') {
      countSql += ` INNER JOIN public_favorite_questions f ON q.id = f.questionId AND f.userId = ? `;
      countParams.push(userId);
    }

    countSql += ` WHERE q.bookId = ? `;
    countParams.push(bId);
    
    if (chapterRange) {
      countSql += ' AND q.sort BETWEEN ? AND ?';
      countParams.push(chapterRange.start_index, chapterRange.end_index);
    }
    
    if (type && type !== 'null' && !isNaN(parseInt(type))) {
      countSql += ' AND q.type = ?';
      countParams.push(parseInt(type));
    }
    
    const [countResult] = await pool.query(countSql, countParams);
    const total = countResult[0].total;

    // 获取上次进度
    let lastIndex = 0;
    if (!page || parseInt(page) === 1) {
      const [progress] = await pool.query(
        'SELECT lastIndex FROM public_user_progress WHERE userId = ? AND bookId = ?',
        [userId, bookId]
      );
      if (progress.length > 0) {
        lastIndex = progress[0].lastIndex;
      }
    }

    const questions = rows.map(row => {
      let options = row.options;
      if (typeof options === 'string') {
        try {
          options = JSON.parse(options);
        } catch (e) {
          options = null;
        }
      }
      return {
        ...row,
        options,
        isFavorite: !!row.isFavorite
      };
    });

    res.json(successResponse({
      list: questions,
      total,
      lastIndex,
      page: page ? parseInt(page) : 1,
      pageSize: page ? parseInt(pageSize) : total
    }));
  } catch (error) {
    console.error('CRITICAL getQuestions Error:', error);
    res.status(500).json(errorResponse(`Backend Error: ${error.message}`));
  }
};

exports.updatePracticeProgress = async (req, res) => {
  try {
    const { bookId, lastIndex } = req.body;
    const userId = req.userId;

    if (!bookId) {
      return res.status(400).json(errorResponse('bookId is required'));
    }

    await pool.query(
      `INSERT INTO public_user_progress (userId, bookId, lastIndex) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       lastIndex = ?, 
       updatedAt = CURRENT_TIMESTAMP`,
      [userId, bookId, lastIndex, lastIndex]
    );

    res.json(successResponse(null, '进度保存成功'));
  } catch (error) {
    console.error('updatePracticeProgress error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.toggleFavorite = async (req, res) => {
  try {
    const { questionId } = req.body;
    const userId = req.userId;

    const [existing] = await pool.query(
      'SELECT id FROM public_favorite_questions WHERE userId = ? AND questionId = ?',
      [userId, questionId]
    );

    if (existing.length > 0) {
      await pool.query('DELETE FROM public_favorite_questions WHERE userId = ? AND questionId = ?', [userId, questionId]);
      return res.json(successResponse({ isFavorite: false }, '取消收藏成功'));
    } else {
      await pool.query('INSERT INTO public_favorite_questions (userId, questionId) VALUES (?, ?)', [userId, questionId]);
      return res.json(successResponse({ isFavorite: true }, '收藏成功'));
    }
  } catch (error) {
    console.error('toggleFavorite error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.submitAnswer = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { questionId, isCorrect } = req.body;
    const userId = req.userId;

    // 1. 记录答题记录
    await connection.query(
      'INSERT INTO public_answer_records (userId, questionId, isCorrect) VALUES (?, ?, ?)',
      [userId, questionId, isCorrect ? 1 : 0]
    );

    // 2. 更新题目统计 (更新 public_questions 表)
    await connection.query(`
      UPDATE public_questions 
      SET answers_number = answers_number + 1,
          answers_correct_number = answers_correct_number + ?
      WHERE id = ?
    `, [isCorrect ? 1 : 0, questionId]);

    // 重新计算题目准确率
    await connection.query(`
      UPDATE public_questions 
      SET answer_accuracy = (answers_correct_number / answers_number) * 100
      WHERE id = ?
    `, [questionId]);

    // 3. 更新题目统计 (更新 public_question_stats 表，保持兼容)
    await connection.query(`
      INSERT INTO public_question_stats (questionId, totalAttempts, totalCorrect)
      VALUES (?, 1, ?)
      ON DUPLICATE KEY UPDATE
      totalAttempts = totalAttempts + 1,
      totalCorrect = totalCorrect + ?
    `, [questionId, isCorrect ? 1 : 0, isCorrect ? 1 : 0]);

    // 4. 重新计算平均分
    await connection.query(`
      UPDATE public_question_stats 
      SET averageScore = (totalCorrect / totalAttempts) * 100
      WHERE questionId = ?
    `, [questionId]);

    // 5. 错题本逻辑
    if (!isCorrect) {
      // 答错：加入或更新错题本
      await connection.query(`
        INSERT INTO public_wrong_questions (userId, questionId, errorCount)
        VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE
        errorCount = errorCount + 1
      `, [userId, questionId]);
    } else {
      // 答对：检查是否需要自动移出错题本
      const [settings] = await connection.query('SELECT autoRemoveWrong FROM user_settings WHERE userId = ?', [userId]);
      const autoRemove = settings.length > 0 ? settings[0].autoRemoveWrong : 1;
      
      if (autoRemove) {
        await connection.query('DELETE FROM public_wrong_questions WHERE userId = ? AND questionId = ?', [userId, questionId]);
      }
    }

    // 6. 更新用户总统计数据
    const subjectName = '公共课刷题';
    
    // 插入全局答题记录
    await connection.query(
      'INSERT INTO answer_records (userId, subjectId, subjectName, totalQuestions, correctQuestions, createdAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [userId, 1, subjectName, 1, isCorrect ? 1 : 0]
    );

    // 更新用户总统计数据（level 由数据库生成列自动计算）
    await connection.query(
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
      [isCorrect ? 1 : 0, userId]
    );

    await connection.commit();
    res.json(successResponse(null, '提交成功'));
  } catch (error) {
    await connection.rollback();
    console.error('submitAnswer error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  } finally {
    connection.release();
  }
};

exports.clearPracticeRecord = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { bookId } = req.body;
    const userId = req.userId;

    if (!bookId) {
      return res.status(400).json(errorResponse('bookId is required'));
    }

    // 1. 清空答题记录
    // 获取该书所有题目ID
    const [questions] = await connection.query('SELECT id FROM public_questions WHERE bookId = ?', [bookId]);
    const questionIds = questions.map(q => q.id);

    if (questionIds.length > 0) {
      // 清空答题历史
      await connection.query(
        'DELETE FROM public_answer_records WHERE userId = ? AND questionId IN (?)',
        [userId, questionIds]
      );
      // 清空错题本
      await connection.query(
        'DELETE FROM public_wrong_questions WHERE userId = ? AND questionId IN (?)',
        [userId, questionIds]
      );
    }

    // 2. 清空学习进度
    await connection.query(
      'DELETE FROM public_user_progress WHERE userId = ? AND bookId = ?',
      [userId, bookId]
    );

    await connection.commit();
    res.json(successResponse(null, '练习记录已清空'));
  } catch (error) {
    await connection.rollback();
    console.error('clearPracticeRecord error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  } finally {
    connection.release();
  }
};// 章节管理
exports.adminGetChapters = async (req, res) => {
  try {
    const { bookId, book_id } = req.query;
    const bookIdValue = bookId || book_id;
    if (!bookIdValue) {
      return res.json(successResponse([]));
    }
    const [chapters] = await pool.query(
      'SELECT * FROM public_chapters WHERE book_id = ? ORDER BY sort_order ASC, id ASC',
      [bookIdValue]
    );
    res.json(successResponse(chapters));
  } catch (error) {
    console.error('adminGetChapters error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.adminAddChapter = async (req, res) => {
  try {
    const { book_id, name, parent_id = null, level = 1, sort_order = 0, start_index = 0, end_index = 0 } = req.body;
    
    // 尝试添加可能缺失的字段
    try {
      await pool.query('ALTER TABLE public_chapters ADD COLUMN start_index INT DEFAULT 0 AFTER sort_order');
      await pool.query('ALTER TABLE public_chapters ADD COLUMN end_index INT DEFAULT 0 AFTER start_index');
    } catch (e) {
      // 字段可能已存在
    }

    const [result] = await pool.query(
      'INSERT INTO public_chapters (book_id, name, parent_id, level, sort_order, start_index, end_index) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [book_id, name, parent_id, level, sort_order, start_index, end_index]
    );
    res.json(successResponse({ id: result.insertId }));
  } catch (error) {
    console.error('adminAddChapter error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.adminUpdateChapter = async (req, res) => {
  try {
    const { id, name, parent_id, level, sort_order, start_index, end_index } = req.body;
    
    // 尝试添加可能缺失的字段
    try {
      await pool.query('ALTER TABLE public_chapters ADD COLUMN start_index INT DEFAULT 0 AFTER sort_order');
      await pool.query('ALTER TABLE public_chapters ADD COLUMN end_index INT DEFAULT 0 AFTER start_index');
    } catch (e) {
      // 字段可能已存在
    }

    await pool.query(
      'UPDATE public_chapters SET name = ?, parent_id = ?, level = ?, sort_order = ?, start_index = ?, end_index = ? WHERE id = ?',
      [name, parent_id, level, sort_order, start_index, end_index, id]
    );
    res.json(successResponse(null, '更新成功'));
  } catch (error) {
    console.error('adminUpdateChapter error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.adminDeleteChapter = async (req, res) => {
  try {
    const { id } = req.body;
    // 检查是否有题目关联
    const [questions] = await pool.query('SELECT id FROM public_questions WHERE chapterId = ? LIMIT 1', [id]);
    if (questions.length > 0) {
      return res.json(errorResponse('该章节下有关联题目，无法删除'));
    }
    await pool.query('DELETE FROM public_chapters WHERE id = ?', [id]);
    res.json(successResponse(null, '删除成功'));
  } catch (error) {
    console.error('adminDeleteChapter error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 反馈相关
exports.submitFeedback = async (req, res) => {
  try {
    const { questionId, content, type } = req.body;
    const userId = req.userId;

    if (!content) {
      return res.status(400).json(errorResponse('反馈内容不能为空'));
    }

    // 检查表是否存在，如果不存在则创建 (简单处理)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public_feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        questionId INT,
        content TEXT NOT NULL,
        type VARCHAR(50) DEFAULT '题目纠错',
        status INT DEFAULT 0,
        adminRemark TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await pool.query(
      'INSERT INTO public_feedback (userId, questionId, content, type) VALUES (?, ?, ?, ?)',
      [userId, questionId, content, type || '题目纠错']
    );

    res.json(successResponse(null, '反馈提交成功'));
  } catch (error) {
    console.error('submitFeedback error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 管理员接口 - 获取反馈列表
exports.adminGetFeedbacks = async (req, res) => {
  try {
    const { status, subject, page = 1, pageSize = 10 } = req.query;

    // 确保表存在
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public_questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bookId INT NOT NULL,
        chapterId INT,
        type INT,
        title TEXT,
        options JSON,
        answer TEXT,
        explanation TEXT,
        difficulty INT DEFAULT 1,
        sort INT DEFAULT 0,
        score DECIMAL(5,2) DEFAULT 0,
        year VARCHAR(20),
        status INT DEFAULT 1,
        pic_url TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 尝试添加可能缺失的字段（针对已存在的表）
    try {
      const [cols] = await pool.query('DESC public_questions');
      const fieldNames = cols.map(c => c.Field);
      if (!fieldNames.includes('chapterId')) await pool.query('ALTER TABLE public_questions ADD COLUMN chapterId INT AFTER bookId');
      if (!fieldNames.includes('explanation')) await pool.query('ALTER TABLE public_questions ADD COLUMN explanation TEXT AFTER answer');
      if (!fieldNames.includes('score')) await pool.query('ALTER TABLE public_questions ADD COLUMN score DECIMAL(5,2) DEFAULT 0 AFTER sort');
      if (!fieldNames.includes('year')) await pool.query('ALTER TABLE public_questions ADD COLUMN year VARCHAR(20) AFTER score');
      if (!fieldNames.includes('status')) await pool.query('ALTER TABLE public_questions ADD COLUMN status INT DEFAULT 1 AFTER year');
      if (!fieldNames.includes('pic_url')) await pool.query('ALTER TABLE public_questions ADD COLUMN pic_url TEXT AFTER status');
    } catch (e) {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS public_feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        questionId INT,
        content TEXT NOT NULL,
        type VARCHAR(50) DEFAULT '题目纠错',
        status INT DEFAULT 0,
        adminRemark TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 尝试添加 nickname 字段到 users 表（如果不存在）
    try {
      await pool.query('ALTER TABLE users ADD COLUMN nickname VARCHAR(100) AFTER username');
    } catch (e) {
      // 字段可能已存在，忽略错误
    }

    let sql = `
      SELECT f.*, COALESCE(u.nickname, u.username) as userNickname, q.title as questionTitle, b.subject
      FROM public_feedback f
      LEFT JOIN users u ON f.userId = u.id
      LEFT JOIN public_questions q ON f.questionId = q.id
      LEFT JOIN public_books b ON q.bookId = b.id
      WHERE 1=1
    `;
    const params = [];

    if (status !== undefined && status !== '') {
      sql += ' AND f.status = ?';
      params.push(parseInt(status));
    }

    if (subject) {
      sql += ' AND b.subject = ?';
      params.push(subject);
    }

    sql += ' ORDER BY f.createdAt DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [feedbacks] = await pool.query(sql, params);
    
    // 构建计数查询
    let countSql = `
      SELECT COUNT(*) as total 
      FROM public_feedback f
      LEFT JOIN public_questions q ON f.questionId = q.id
      LEFT JOIN public_books b ON q.bookId = b.id
      WHERE 1=1
    `;
    const countParams = [];
    if (status !== undefined && status !== '') {
      countSql += ' AND f.status = ?';
      countParams.push(parseInt(status));
    }
    if (subject) {
      countSql += ' AND b.subject = ?';
      countParams.push(subject);
    }
    const [countResult] = await pool.query(countSql, countParams);

    res.json(successResponse({
      list: feedbacks,
      total: countResult[0].total
    }));
  } catch (error) {
    console.error('adminGetFeedbacks error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 管理员接口 - 更新反馈状态
exports.adminUpdateFeedbackStatus = async (req, res) => {
  try {
    const { id, status, adminRemark } = req.body;
    await pool.query(
      'UPDATE public_feedback SET status = ?, adminRemark = ? WHERE id = ?',
      [status, adminRemark, id]
    );
    res.json(successResponse(null, '状态更新成功'));
  } catch (error) {
    console.error('adminUpdateFeedbackStatus error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 管理员接口 - 获取分类
exports.adminGetCategories = async (req, res) => {
  try {
    const { subject, parentId, level } = req.query;
    
    // 如果 level=1，从 nav_subjects 获取公共题库科目
    if (level === '1') {
      const [subjects] = await pool.query(
        'SELECT id, name, subject_code as subject, sort, 1 as level FROM nav_subjects WHERE is_public = 1 OR is_public IS NULL ORDER BY sort ASC, id ASC'
      );
      return res.json(successResponse(subjects));
    }
    
    // 其他情况从 public_categories 获取
    let sql = 'SELECT * FROM public_categories WHERE 1=1';
    const params = [];

    if (subject) {
      sql += ' AND subject = ?';
      params.push(subject);
    }

    if (parentId) {
      sql += ' AND parentId = ?';
      params.push(parentId);
    }

    if (level) {
      sql += ' AND level = ?';
      params.push(level);
    }

    sql += ' ORDER BY sort ASC, id ASC';

    const [categories] = await pool.query(sql, params);
    res.json(successResponse(categories));
  } catch (error) {
    console.error('adminGetCategories error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 管理员接口 - 添加分类
exports.adminAddCategory = async (req, res) => {
  try {
    const { name, parent_id, level, sort, subject, is_public } = req.body;
    
    if (!name) {
      return res.status(400).json(errorResponse('分类名称不能为空'));
    }

    // 尝试添加 is_public 字段（如果不存在）
    try {
      await pool.query('ALTER TABLE public_categories ADD COLUMN is_public TINYINT DEFAULT 1');
    } catch (e) {
      // 字段已存在，忽略错误
    }

    const [result] = await pool.query(
      'INSERT INTO public_categories (name, parentId, level, sort, subject, is_public) VALUES (?, ?, ?, ?, ?, ?)',
      [name, parent_id || null, level || 1, sort || 0, subject || '', is_public !== undefined ? is_public : 1]
    );

    res.json(successResponse({ id: result.insertId }, '创建成功'));
  } catch (error) {
    console.error('adminAddCategory error:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 管理员接口 - 更新分类
exports.adminUpdateCategory = async (req, res) => {
  try {
    const { id, name, parent_id, level, sort, subject, is_public } = req.body;
    
    console.log('更新分类接收到的数据:', { id, name, parent_id, level, sort, subject, is_public });
    
    if (!id) {
      return res.status(400).json(errorResponse('ID不能为空'));
    }

    // 尝试添加 is_public 字段（如果不存在）
    try {
      await pool.query('ALTER TABLE public_categories ADD COLUMN is_public TINYINT DEFAULT 1');
    } catch (e) {
      // 字段已存在，忽略错误
    }

    const updateResult = await pool.query(
      'UPDATE public_categories SET name = ?, parentId = ?, level = ?, sort = ?, subject = ?, is_public = ? WHERE id = ?',
      [name, parent_id || null, level || 1, sort || 0, subject || '', is_public !== undefined ? is_public : 1, id]
    );
    
    console.log('更新结果:', updateResult);

    res.json(successResponse(null, '更新成功'));
  } catch (error) {
    console.error('adminUpdateCategory error:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 管理员接口 - 删除分类
exports.adminDeleteCategory = async (req, res) => {
  try {
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json(errorResponse('ID不能为空'));
    }

    await pool.query('DELETE FROM public_categories WHERE id = ?', [id]);
    res.json(successResponse(null, '删除成功'));
  } catch (error) {
    console.error('adminDeleteCategory error:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 管理员接口 - 搜索题目
exports.adminSearchQuestions = async (req, res) => {
  try {
    const { id, keyword, subject, bookId, chapterId, categoryId, firstCategoryId, secondCategoryId, page = 1, pageSize = 20 } = req.query;

    let sql = `
      SELECT q.*, COALESCE(b.name, b.title) as bookName, c.name as chapterName 
      FROM public_questions q
      LEFT JOIN public_books b ON q.bookId = b.id
      LEFT JOIN public_chapters c ON q.chapterId = c.id
      WHERE 1=1
    `;
    const params = [];

    if (keyword) {
      sql += ' AND (q.title LIKE ? OR q.explanation LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (id) {
      sql += ' AND q.id = ?';
      params.push(id);
    }

    if (subject && subject !== 'all') {
      sql += ' AND b.subject = ?';
      params.push(subject);
    }

    if (bookId) {
      sql += ' AND q.bookId = ?';
      params.push(bookId);
    }

    // 根据章节范围筛选（使用 start_index 和 end_index）
    if (chapterId) {
      // 先查询章节的范围
      const [chapterRows] = await pool.query(
        'SELECT start_index, end_index FROM public_chapters WHERE id = ?',
        [chapterId]
      );
      if (chapterRows.length > 0) {
        const chapter = chapterRows[0];
        sql += ' AND q.sort BETWEEN ? AND ?';
        params.push(chapter.start_index, chapter.end_index);
      }
    }

    // 使用 firstCategoryId 和 secondCategoryId 精确匹配
    if (firstCategoryId) {
      sql += ' AND b.first_category_id = ?';
      params.push(firstCategoryId);
    }

    if (secondCategoryId) {
      sql += ' AND b.second_category_id = ?';
      params.push(secondCategoryId);
    }

    sql += ' ORDER BY q.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [questions] = await pool.query(sql, params);
    
    // 获取总数用于分页
    let countSql = 'SELECT COUNT(*) as total FROM public_questions q LEFT JOIN public_books b ON q.bookId = b.id WHERE 1=1';
    const countParams = [];
    if (keyword) {
      countSql += ' AND (q.title LIKE ? OR q.explanation LIKE ?)';
      countParams.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (id) {
      countSql += ' AND q.id = ?';
      countParams.push(id);
    }
    if (subject && subject !== 'all') {
      countSql += ' AND b.subject = ?';
      countParams.push(subject);
    }
    if (bookId) {
      countSql += ' AND q.bookId = ?';
      countParams.push(bookId);
    }
    // 根据章节范围筛选（使用 start_index 和 end_index）
    if (chapterId) {
      // 先查询章节的范围
      const [chapterRowsForCount] = await pool.query(
        'SELECT start_index, end_index FROM public_chapters WHERE id = ?',
        [chapterId]
      );
      if (chapterRowsForCount.length > 0) {
        const chapterForCount = chapterRowsForCount[0];
        countSql += ' AND q.sort BETWEEN ? AND ?';
        countParams.push(chapterForCount.start_index, chapterForCount.end_index);
      }
    }
    // 使用 firstCategoryId 和 secondCategoryId 精确匹配
    if (firstCategoryId) {
      countSql += ' AND b.first_category_id = ?';
      countParams.push(firstCategoryId);
    }

    if (secondCategoryId) {
      countSql += ' AND b.second_category_id = ?';
      countParams.push(secondCategoryId);
    }
    const [countResult] = await pool.query(countSql, countParams);

    res.json(successResponse({
      list: questions.map(q => ({
        ...q,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || [])
      })),
      total: countResult[0].total
    }));
  } catch (error) {
    console.error('adminSearchQuestions error:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

exports.importData = async (req, res) => {
  try {
    const { bookData, questions, answers, chapterData, subject } = req.body;
    
    if (!bookData || !questions || !answers || !subject) {
      return res.status(400).json(errorResponse('导入数据不完整'));
    }

    // 1. 处理分类
    let firstCat, secondCat, thirdCat;
    if (bookData.first_category_name) {
      firstCat = await PublicCategory.getOrCreate({
        name: bookData.first_category_name,
        level: 1,
        parentId: 0,
        subject: subject
      });
    }
    if (bookData.second_category_name) {
      secondCat = await PublicCategory.getOrCreate({
        name: bookData.second_category_name,
        level: 2,
        parentId: firstCat ? firstCat.id : 0,
        subject: subject
      });
    }
    if (bookData.third_category_name) {
      thirdCat = await PublicCategory.getOrCreate({
        name: bookData.third_category_name,
        level: 3,
        parentId: secondCat ? secondCat.id : (firstCat ? firstCat.id : 0),
        subject: subject
      });
    }

    // 2. 创建书籍/试卷记录
    const book = await PublicBook.create({
      title: bookData.title || bookData.name,
      short_name: bookData.short_name || bookData.name,
      type: bookData.type_str || (bookData.type === 1 ? 'exam' : 'book'),
      subject: subject,
      first_category_id: firstCat?.id,
      second_category_id: secondCat?.id,
      third_category_id: thirdCat?.id,
      description: bookData.description || '',
      pic_url: bookData.pic_url || '',
      status: 1,
      sort: bookData.sort || 0,
      remark: bookData.remark || ''
    });

    // 3. 准备题目数据
    const questionsToCreate = questions.map((q, index) => {
      // 寻找对应的答案和解析
      // JSON 文件中的 id 是匹配的，answers.json 中的解析字段是 comments
      const answerData = answers.find(a => a.id === q.id) || {};
      
      // 从 original_book_number 解析编号，如 "单-1" → 1, "多-10" → 10
      let sortValue = index;
      if (q.original_book_number) {
        const match = q.original_book_number.match(/(\d+)/);
        if (match) {
          sortValue = parseInt(match[1]);
        }
      }
      
      return {
        bookId: book.id,
        title: q.title,
        title_richtext: q.title_richtext || '',
        type: q.type, // 1: 单选, 2: 多选, 3: 判断, 10: 知识卡
        options: q.options || [],
        // 优先使用 questions.json 中的 answer，如果没用则看 answers.json
        answer: q.answer || answerData.answer || '',
        answer_richtext: q.answer_richtext || answerData.answer_richtext || '',
        // 优先使用 answers.json 中的 comments (这是目前 JSON 的实际字段)，其次是 explanation
        explanation: answerData.comments || answerData.explanation || q.explanation || '',
        mnemonic: q.mnemonic || '', // 口诀
        difficulty: q.difficulty || answerData.difficulty || 3,
        media: q.media || '',
        media_type: q.media_type || 1,
        isKnowledgeCard: q.type === 10,
        original_book_number: q.original_book_number,
        original_book_title_page: q.original_book_title_page || '',
        original_book_comment_page: q.original_book_comment_page || '',
        sort: q.sort !== undefined ? q.sort : sortValue, // 从 original_book_number 解析编号
        answers_correct_number: q.answers_correct_number || answerData.answers_correct_number || 0,
        answers_number: q.answers_number || answerData.answers_number || 0,
        answer_accuracy: parseFloat(q.answer_accuracy || answerData.answer_accuracy || 0),
        question_source: q.question_source || 0,
        eid: q.eid || null, // 章节ID，用于直接匹配章节
        cid: q.cid || null // 分类ID
      };
    });

    // 4. 批量创建题目
    const result = await PublicQuestion.bulkCreate(questionsToCreate);

    res.json(successResponse({
      bookId: book.id,
      firstCategoryId: firstCat?.id,
      secondCategoryId: secondCat?.id,
      thirdCategoryId: thirdCat?.id,
      questionCount: result.affectedRows
    }));
  } catch (error) {
    console.error('Import Error:', error);
    res.status(500).json(errorResponse(error.message));
  }
};

/**
 * 预览导入数据，不写入数据库
 */
exports.previewImport = async (req, res) => {
  try {
    const { bookData, questions, answers, chapterData, subject } = req.body;
    
    if (!bookData || !questions || !answers || !subject) {
      return res.status(400).json(errorResponse('预览数据不完整'));
    }

    if (!Array.isArray(questions) || !Array.isArray(answers)) {
      return res.status(400).json(errorResponse('数据格式错误'));
    }

    // 计算题目数量和分类
    const preview = {
      title: bookData.title || bookData.name,
      short_name: bookData.short_name || bookData.name,
      type: bookData.type_str || (bookData.type === 1 ? 'exam' : 'book'),
      subject: subject,
      categories: [
        bookData.first_category_name,
        bookData.second_category_name,
        bookData.third_category_name
      ].filter(Boolean),
      questionCount: questions.length,
      hasStructure: !!chapterData && (chapterData.list || (chapterData.data && chapterData.data.list))?.length > 0,
      structureCount: 0
    };

    if (preview.hasStructure) {
      const list = chapterData.list || (chapterData.data && chapterData.data.list);
      preview.structureCount = list.length;
    }

    res.json(successResponse(preview));
  } catch (error) {
    console.error('Preview Error:', error);
    res.status(500).json(errorResponse(error.message));
  }
};

// 管理员接口 - 获取题目详情
exports.adminGetQuestionDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) return res.status(400).json(errorResponse('ID不能为空'));

    // 查询题目基本信息
    const [questionRows] = await pool.query(
      'SELECT * FROM public_questions WHERE id = ?',
      [id]
    );
    
    if (questionRows.length === 0) {
      return res.status(404).json(errorResponse('题目不存在'));
    }
    
    const question = questionRows[0];
    
    // 查询书籍和分类信息
    if (question.bookId) {
      const [bookRows] = await pool.query(
        `SELECT b.id, b.name, b.subject,
                c1.id as first_category_id, c1.name as first_category_name,
                c2.id as second_category_id, c2.name as second_category_name
         FROM public_books b
         LEFT JOIN public_categories c1 ON b.first_category_id = c1.id
         LEFT JOIN public_categories c2 ON b.second_category_id = c2.id
         WHERE b.id = ?`,
        [question.bookId]
      );
      
      if (bookRows.length > 0) {
        const book = bookRows[0];
        question.bookName = book.name;
        question.firstCategoryId = book.first_category_id;
        question.firstCategoryName = book.first_category_name;
        question.secondCategoryId = book.second_category_id;
        question.secondCategoryName = book.second_category_name;
      }
    }
    
    // 查询章节信息
    if (question.chapterId) {
      const [chapterRows] = await pool.query(
        'SELECT id, name FROM public_chapters WHERE id = ?',
        [question.chapterId]
      );
      
      if (chapterRows.length > 0) {
        question.chapterName = chapterRows[0].name;
      }
    }
    
    res.json(successResponse(question));
  } catch (error) {
    console.error('adminGetQuestionDetail error:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 管理员接口 - 更新题目
exports.adminUpdateQuestion = async (req, res) => {
  try {
    const { 
      id, title, type, options, answer, explanation, 
      bookId, chapterId, sort, year, status, score, pic_url,
      difficulty, mnemonic, question_source, isKnowledgeCard
    } = req.body;
    
    if (!id) return res.status(400).json(errorResponse('ID不能为空'));

    const optionsStr = typeof options === 'string' ? options : JSON.stringify(options);
    
    await pool.query(
      `UPDATE public_questions SET 
        title = ?, type = ?, options = ?, answer = ?, 
        explanation = ?, bookId = ?, chapterId = ?, sort = ?, 
        year = ?, status = ?, score = ?, pic_url = ?,
        difficulty = ?, mnemonic = ?, question_source = ?, isKnowledgeCard = ?,
        updatedAt = NOW()
       WHERE id = ?`,
      [
        title, type, optionsStr, answer, explanation, 
        bookId, chapterId, sort, year, status, score, pic_url,
        difficulty || 3, mnemonic, question_source, isKnowledgeCard || 0,
        id
      ]
    );
    
    res.json(successResponse(null, '更新成功'));
  } catch (error) {
    console.error('adminUpdateQuestion error:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 管理员接口 - 添加题目
exports.adminAddQuestion = async (req, res) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    const { 
      title, type, options, answer, explanation, 
      bookId, chapterId, sort, year, status, score, pic_url,
      difficulty, mnemonic, question_source, isKnowledgeCard,
      isManualCreate
    } = req.body;
    
    const optionsStr = typeof options === 'string' ? options : JSON.stringify(options);
    
    let questionId;
    let nextCode = null; // 用于存储书籍的下一个题目编码（即题目序号）
    
    // 如果是手动创建，使用特殊编码系统
    if (isManualCreate && bookId) {
      // 获取书籍的编码前缀和下一个题目编码
      const [bookRows] = await connection.query(
        'SELECT code_prefix, next_question_code FROM public_books WHERE id = ?',
        [bookId]
      );
      
      if (bookRows.length > 0) {
        const book = bookRows[0];
        nextCode = book.next_question_code || 1;
        
        // 生成题目ID：使用书籍ID * 100000 + 序号
        // 这样每本书可以有最多99999道题目
        // 书籍ID限制在20000以内，生成的ID最大为 2000099999 < INT_MAX(2147483647)
        questionId = bookId * 100000 + nextCode;
        
        console.log('生成题目ID:', { bookId, nextCode, questionId });
        
        // 检查ID是否已存在
        if (!questionId || isNaN(questionId) || questionId > 2147483647) {
          await connection.rollback();
          connection.release();
          return res.status(400).json(errorResponse('生成的题目ID无效或超出范围'));
        }
        
        const [existingRows] = await connection.query(
          'SELECT id FROM public_questions WHERE id = ?',
          [questionId]
        );
        
        if (existingRows.length > 0) {
          await connection.rollback();
          connection.release();
          return res.status(400).json(errorResponse('题目ID冲突，请重新创建书籍或使用其他编码前缀'));
        }
        
        // 更新书籍的下一个题目编码
        await connection.query(
          'UPDATE public_books SET next_question_code = ? WHERE id = ?',
          [nextCode + 1, bookId]
        );
      }
    }
    
    // 如果有指定ID，使用指定ID；否则使用自增ID
    // 排序使用 nextCode（每本书的题目序号，从1开始）
    const questionSort = nextCode || sort || 0;
    
    if (questionId) {
      await connection.query(
        `INSERT INTO public_questions (
          id, title, type, options, answer, explanation, 
          bookId, chapterId, sort, year, status, score, pic_url,
          difficulty, mnemonic, question_source, isKnowledgeCard
        )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          questionId, title, type, optionsStr, answer, explanation, 
          bookId, chapterId, questionSort, year, status || 1, score || 0, pic_url,
          difficulty || 3, mnemonic, question_source, isKnowledgeCard || 0
        ]
      );
    } else {
      const [result] = await connection.query(
        `INSERT INTO public_questions (
          title, type, options, answer, explanation, 
          bookId, chapterId, sort, year, status, score, pic_url,
          difficulty, mnemonic, question_source, isKnowledgeCard
        )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title, type, optionsStr, answer, explanation, 
          bookId, chapterId, questionSort, year, status || 1, score || 0, pic_url,
          difficulty || 3, mnemonic, question_source, isKnowledgeCard || 0
        ]
      );
      questionId = result.insertId;
    }
    
    await connection.commit();
    res.json(successResponse({ id: questionId }, '添加成功'));
  } catch (error) {
    await connection.rollback();
    console.error('adminAddQuestion error:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  } finally {
    connection.release();
  }
};

// 管理员接口 - 删除题目
exports.adminDeleteQuestion = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json(errorResponse('ID不能为空'));

    await connection.beginTransaction();
    
    try {
      // 1. 删除用户收藏
      await connection.query('DELETE FROM public_favorite_questions WHERE questionId = ?', [id]);
      
      // 2. 删除错题记录
      await connection.query('DELETE FROM public_wrong_questions WHERE questionId = ?', [id]);
      
      // 3. 删除答题记录
      await connection.query('DELETE FROM public_answer_records WHERE questionId = ?', [id]);
      
      // 4. 删除题目统计
      await connection.query('DELETE FROM public_question_stats WHERE questionId = ?', [id]);
      
      // 5. 删除用户进度
      await connection.query('DELETE FROM public_user_progress WHERE questionId = ?', [id]);
      
      // 6. 删除反馈记录
      await connection.query('DELETE FROM public_feedback WHERE questionId = ?', [id]);
      
      // 7. 删除笔记及笔记相关数据
      // 先删除笔记的点赞
      await connection.query('DELETE FROM public_note_likes WHERE noteId IN (SELECT id FROM public_notes WHERE questionId = ?)', [id]);
      // 再删除笔记
      await connection.query('DELETE FROM public_notes WHERE questionId = ?', [id]);
      
      // 8. 最后删除题目本身
      await connection.query('DELETE FROM public_questions WHERE id = ?', [id]);
      
      await connection.commit();
      res.json(successResponse(null, '删除成功'));
    } catch (err) {
      await connection.rollback();
      throw err;
    }
  } catch (error) {
    console.error('adminDeleteQuestion error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  } finally {
    connection.release();
  }
};

// 管理员接口 - 更新书目
exports.adminUpdateBook = async (req, res) => {
  try {
    const { id, name, title, short_name, subject, description, pic_url, sort, status, first_category_id, second_category_id, third_category_id } = req.body;
    if (!id) return res.status(400).json(errorResponse('ID不能为空'));

    const bookName = name || title;

    // 尝试添加可能缺失的字段
    try {
      await pool.query('ALTER TABLE public_books ADD COLUMN name VARCHAR(255) AFTER id');
      await pool.query('ALTER TABLE public_books ADD COLUMN short_name VARCHAR(100) AFTER name');
      await pool.query('ALTER TABLE public_books ADD COLUMN subject VARCHAR(50) AFTER short_name');
      await pool.query('ALTER TABLE public_books ADD COLUMN description TEXT AFTER subject');
      await pool.query('ALTER TABLE public_books ADD COLUMN pic_url TEXT AFTER description');
      await pool.query('ALTER TABLE public_books ADD COLUMN sort INT DEFAULT 0 AFTER pic_url');
      await pool.query('ALTER TABLE public_books ADD COLUMN status INT DEFAULT 1 AFTER sort');
      await pool.query('ALTER TABLE public_books ADD COLUMN first_category_id INT AFTER status');
      await pool.query('ALTER TABLE public_books ADD COLUMN second_category_id INT AFTER first_category_id');
      await pool.query('ALTER TABLE public_books ADD COLUMN third_category_id INT AFTER second_category_id');
    } catch (e) {
      // 字段可能已存在
    }

    await pool.query(
      `UPDATE public_books SET 
        name = ?, short_name = ?, subject = ?, description = ?, 
        pic_url = ?, sort = ?, status = ?, 
        first_category_id = ?, second_category_id = ?, third_category_id = ?,
        updatedAt = NOW()
       WHERE id = ?`,
      [bookName, short_name, subject, description, pic_url, sort, status, first_category_id, second_category_id, third_category_id, id]
    );

    res.json(successResponse(null, '更新成功'));
  } catch (error) {
    console.error('adminUpdateBook error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 管理员接口 - 获取书目列表
exports.adminGetBooks = async (req, res) => {
  try {
    const { subject, status, keyword, categoryId, level, firstCategoryId, secondCategoryId } = req.query;
    
    // 尝试添加可能缺失的字段，确保查询不报错
    try {
      await pool.query('ALTER TABLE public_books ADD COLUMN name VARCHAR(255) AFTER id');
      await pool.query('ALTER TABLE public_books ADD COLUMN short_name VARCHAR(100) AFTER name');
    } catch (e) {}

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (subject) {
      whereClause += ' AND b.subject = ?';
      params.push(subject);
    }

    if (status !== undefined && status !== '') {
      whereClause += ' AND b.status = ?';
      params.push(status);
    }

    if (categoryId && level) {
      const levelColumn = level === '1' ? 'b.first_category_id' : (level === '2' ? 'b.second_category_id' : 'b.third_category_id');
      whereClause += ` AND ${levelColumn} = ?`;
      params.push(categoryId);
    }

    // 支持一级和二级分类筛选
    if (firstCategoryId) {
      whereClause += ' AND b.first_category_id = ?';
      params.push(firstCategoryId);
    }

    if (secondCategoryId) {
      whereClause += ' AND b.second_category_id = ?';
      params.push(secondCategoryId);
    }

    if (keyword) {
      whereClause += ' AND (b.name LIKE ? OR b.short_name LIKE ? OR b.title LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    // 同时获取题目数量和分类名称
    const query = `
      SELECT b.*, 
             COUNT(q.id) as questionCount,
             c1.name as firstCategoryName,
             c2.name as secondCategoryName
      FROM public_books b
      LEFT JOIN public_questions q ON b.id = q.bookId
      LEFT JOIN public_categories c1 ON b.first_category_id = c1.id
      LEFT JOIN public_categories c2 ON b.second_category_id = c2.id
      ${whereClause}
      GROUP BY b.id, c1.name, c2.name
      ORDER BY b.sort ASC, b.id DESC
    `;

    const [books] = await pool.query(query, params);
    // 兼容性处理：如果 name 为空则使用 title
    const processedBooks = books.map(b => ({
      ...b,
      name: b.name || b.title || ''
    }));
    res.json(successResponse(processedBooks));
  } catch (error) {
    console.error('adminGetBooks error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 管理员接口 - 添加书目
exports.adminAddBook = async (req, res) => {
  try {
    const { name, title, short_name, subject, description, pic_url, sort, status, type, first_category_id, second_category_id, third_category_id, code_prefix } = req.body;
    
    const bookName = name || title;

    // 尝试添加可能缺失的字段（逐个尝试，忽略错误）
    const alterStatements = [
      'ALTER TABLE public_books ADD COLUMN name VARCHAR(255) AFTER id',
      'ALTER TABLE public_books ADD COLUMN short_name VARCHAR(100) AFTER name',
      'ALTER TABLE public_books ADD COLUMN subject VARCHAR(50) AFTER short_name',
      'ALTER TABLE public_books ADD COLUMN description TEXT AFTER subject',
      'ALTER TABLE public_books ADD COLUMN pic_url TEXT AFTER description',
      'ALTER TABLE public_books ADD COLUMN sort INT DEFAULT 0 AFTER pic_url',
      'ALTER TABLE public_books ADD COLUMN status INT DEFAULT 1 AFTER sort',
      'ALTER TABLE public_books ADD COLUMN first_category_id INT AFTER status',
      'ALTER TABLE public_books ADD COLUMN second_category_id INT AFTER first_category_id',
      'ALTER TABLE public_books ADD COLUMN third_category_id INT AFTER second_category_id',
      'ALTER TABLE public_books ADD COLUMN code_prefix VARCHAR(20) AFTER third_category_id',
      'ALTER TABLE public_books ADD COLUMN next_question_code INT DEFAULT 1 AFTER code_prefix'
    ];
    
    for (const sql of alterStatements) {
      try {
        await pool.query(sql);
      } catch (e) {
        // 字段可能已存在，忽略错误
      }
    }

    console.log('执行添加书籍，参数:', { bookName, short_name, subject, first_category_id, second_category_id, code_prefix });
    
    const [result] = await pool.query(
      `INSERT INTO public_books 
        (name, title, short_name, subject, description, pic_url, sort, status, type, first_category_id, second_category_id, third_category_id, code_prefix, next_question_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [bookName, bookName, short_name || bookName, subject, description || '', pic_url || '', sort || 0, status || 1, type || 'book', first_category_id, second_category_id, third_category_id, code_prefix || '', 1]
    );
    
    console.log('添加书籍成功，ID:', result.insertId);

    res.json(successResponse({ id: result.insertId }, '添加成功'));
  } catch (error) {
    console.error('adminAddBook error:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 管理员接口 - 删除书目
exports.adminDeleteBook = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json(errorResponse('ID不能为空'));

    // 开启事务进行级联删除
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. 删除该书籍下的所有题目
      await connection.query('DELETE FROM public_questions WHERE bookId = ?', [id]);
      
      // 2. 删除该书籍下的所有章节
      await connection.query('DELETE FROM public_chapters WHERE book_id = ?', [id]);
      
      // 3. 删除书籍本身
      await connection.query('DELETE FROM public_books WHERE id = ?', [id]);
      
      await connection.commit();
      res.json(successResponse(null, '删除成功，已级联删除该书籍下的所有章节和题目'));
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('adminDeleteBook error:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 管理员接口 - 切换书目状态
exports.adminToggleBookStatus = async (req, res) => {
  try {
    const { id, status } = req.body;
    if (!id) return res.status(400).json(errorResponse('ID不能为空'));

    await pool.query('UPDATE public_books SET status = ? WHERE id = ?', [status, id]);
    res.json(successResponse(null, '状态更新成功'));
  } catch (error) {
    console.error('adminToggleBookStatus error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.getRelatedArticles = async (req, res) => {
  try {
    // 1. 获取热门 5 篇 (按阅读量)
    const [popular] = await pool.query(
      "SELECT id, title, createdAt, viewCount, imageUrl FROM notices WHERE noticeType IN ('article', 'wechat') AND isActive = 1 ORDER BY viewCount DESC, createdAt DESC LIMIT 5"
    );

    // 2. 获取最新 5 篇 (排除热门中的)
    const popularIds = popular.map(a => a.id);
    let newestSql = "SELECT id, title, createdAt, viewCount, imageUrl FROM notices WHERE noticeType IN ('article', 'wechat') AND isActive = 1";
    const params = [];
    if (popularIds.length > 0) {
      newestSql += ` AND id NOT IN (${popularIds.join(',')})`;
    }
    newestSql += " ORDER BY createdAt DESC LIMIT 5";
    
    const [newest] = await pool.query(newestSql, params);

    res.json(successResponse({
      popular,
      newest
    }));
  } catch (error) {
    console.error('getRelatedArticles error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.getQuestionNotes = async (req, res) => {
  try {
    const { questionId, sortBy = 'time' } = req.query;
    const userId = req.userId;

    if (!questionId) {
      return res.status(400).json(errorResponse('questionId is required'));
    }

    // 获取所有公开笔记，以及当前用户的私有笔记
    // 排除回复笔记 (parentId IS NULL)，回复笔记单独获取或通过关联获取
    // 排序逻辑
    const orderBy = sortBy === 'likes' ? 'likeCount DESC, n.createdAt DESC' : 'n.createdAt DESC';
    
    let sql = `
      SELECT n.*, u.username, u.avatar,
             (SELECT COUNT(*) FROM public_note_likes WHERE noteId = n.id) as likeCount,
             EXISTS(SELECT 1 FROM public_note_likes WHERE noteId = n.id AND userId = ?) as isLiked,
             (SELECT COUNT(*) FROM public_question_notes WHERE parentId = n.id) as replyCount
      FROM public_question_notes n
      LEFT JOIN users u ON n.userId = u.id
      WHERE n.questionId = ? AND n.parentId IS NULL AND (n.isPublic = 1 OR n.userId = ?)
      ORDER BY ${orderBy}
    `;
    const params = [userId, questionId, userId];

    const [notes] = await pool.query(sql, params);
    res.json(successResponse(notes));
  } catch (error) {
    console.error('getQuestionNotes error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.getNoteReplies = async (req, res) => {
  try {
    const { noteId } = req.query;
    const userId = req.userId;

    if (!noteId) {
      return res.status(400).json(errorResponse('noteId is required'));
    }

    let sql = `
      SELECT n.*, u.username, u.avatar,
             (SELECT COUNT(*) FROM public_note_likes WHERE noteId = n.id) as likeCount,
             EXISTS(SELECT 1 FROM public_note_likes WHERE noteId = n.id AND userId = ?) as isLiked
      FROM public_question_notes n
      LEFT JOIN users u ON n.userId = u.id
      WHERE n.parentId = ?
      ORDER BY n.createdAt ASC
    `;
    
    const [replies] = await pool.query(sql, [userId, noteId]);
    res.json(successResponse(replies));
  } catch (error) {
    console.error('getNoteReplies error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.addQuestionNote = async (req, res) => {
  try {
    const { questionId, content, isPublic = 1, province = '未知', parentId = null } = req.body;
    const userId = req.userId;

    if (!questionId || !content) {
      return res.status(400).json(errorResponse('questionId and content are required'));
    }

    const [result] = await pool.query(
      'INSERT INTO public_question_notes (userId, questionId, content, isPublic, province, parentId) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, questionId, content, isPublic, province, parentId]
    );

    res.json(successResponse({ id: result.insertId }, '发布成功'));
  } catch (error) {
    console.error('addQuestionNote error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.structureBook = async (req, res) => {
  let connection = null;
  const log = (step) => {
    console.log(`[structureBook:${req.body.bookId}] ${step} - ${Date.now()}`);
  };
  try {
    const { bookId, chapterData } = req.body;
    log('start');

    // 兼容不同的 JSON 结构
    let chapterList = [];
    if (chapterData.list) {
      chapterList = chapterData.list;
    } else if (chapterData.data && chapterData.data.list) {
      chapterList = chapterData.data.list;
    }

    if (!bookId || !chapterList || chapterList.length === 0) {
      return res.status(400).json(errorResponse('参数不完整，需要 bookId 和有效的章节列表数据'));
    }

    // 步骤1：先删除旧章节（独立事务，避免与后续插入产生死锁）
    log('getConnection');
    connection = await pool.getConnection();
    log('begin delete');
    await connection.beginTransaction();
    await connection.query('DELETE FROM public_chapters WHERE book_id = ?', [bookId]);
    await connection.commit();
    connection.release();
    connection = null;
    log('delete done');

    // 步骤2：构建内存中的树结构
    const map = {};
    const tree = [];
    chapterList.forEach(item => {
      map[item.id] = { ...item, children: [] };
    });
    chapterList.forEach(item => {
      if (item.parent_id && map[item.parent_id]) {
        map[item.parent_id].children.push(map[item.id]);
      } else {
        tree.push(map[item.id]);
      }
    });

    let currentIndex = 0;
    const chaptersToInsert = [];

    // 步骤3：递归处理树以计算 start_index 和 end_index
    function processNode(node) {
      const currentChapter = {
        book_id: bookId,
        name: node.name,
        level: node.level,
        question_count: 0,
        start_index: 0,
        end_index: 0,
        sort_order: chaptersToInsert.length,
        original_id: node.id,
        original_parent_id: node.parent_id
      };

      if (node.children && node.children.length > 0) {
        const startIndex = currentIndex;
        const chapterIndex = chaptersToInsert.length;
        chaptersToInsert.push(currentChapter);

        node.children.forEach(child => {
          processNode(child);
        });

        const lastChild = chaptersToInsert[chaptersToInsert.length - 1];
        chaptersToInsert[chapterIndex].start_index = startIndex;
        chaptersToInsert[chapterIndex].end_index = lastChild.end_index;
        chaptersToInsert[chapterIndex].question_count = chaptersToInsert[chapterIndex].end_index - startIndex + 1;
      } else {
        const count = node.count || 0;
        currentChapter.start_index = currentIndex;
        currentChapter.end_index = currentIndex + count - 1;
        currentChapter.question_count = count;
        currentIndex += count;
        chaptersToInsert.push(currentChapter);
      }
    }

    tree.forEach(rootNode => processNode(rootNode));
    log(`build tree done, chapters: ${chaptersToInsert.length}`);

    // 步骤4：批量插入章节，使用 bulkCreate（单条 INSERT 语句，避免多次持有锁）
    await PublicChapter.bulkCreate(chaptersToInsert);
    log('bulkCreate done');

    // 步骤5：重新查询章节，建立 original_id -> db_id 映射
    const chaptersInDb = await PublicChapter.findByBookId(bookId);
    const idMap = {};
    chaptersInDb.forEach(ch => {
      idMap[ch.original_id] = ch.id;
    });
    log('find chapters done');

    // 步骤6：批量更新 parent_id（使用 CASE WHEN 一次性更新）
    const parentCases = [];
    for (const chapter of chaptersToInsert) {
      const dbId = idMap[chapter.original_id];
      const parentDbId = idMap[chapter.original_parent_id] || null;
      if (dbId && chapter.original_parent_id) {
        parentCases.push(`WHEN id = ${dbId} THEN ${parentDbId}`);
      }
    }
    if (parentCases.length > 0) {
      await pool.query(`
        UPDATE public_chapters 
        SET parent_id = CASE ${parentCases.join(' ')} END
        WHERE book_id = ? AND parent_id IS NULL
      `, [bookId]);
    }
    log('update parent done');

    // 步骤7：批量更新题目的 chapterId（根据 eid 直接匹配）
    if (chaptersToInsert.length > 0) {
      const updateCases = [];
      for (const chapter of chaptersToInsert) {
        const dbId = idMap[chapter.original_id];
        if (!dbId) continue;
        updateCases.push(`WHEN eid = ${chapter.original_id} THEN ${dbId}`);
      }
      if (updateCases.length > 0) {
        await pool.query(`
          UPDATE public_questions 
          SET chapterId = CASE ${updateCases.join(' ')} END
          WHERE bookId = ? AND eid IS NOT NULL
        `, [bookId]);
      }
    }
    log('update questions done');

    res.json(successResponse(null, '章节结构化处理成功'));
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
      connection.release();
    }
    console.error('structureBook error:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

exports.updateQuestionNote = async (req, res) => {
  try {
    const { noteId, content, isPublic } = req.body;
    const userId = req.userId;

    if (!noteId || !content) {
      return res.status(400).json(errorResponse('noteId and content are required'));
    }

    const [result] = await pool.query(
      'UPDATE public_question_notes SET content = ?, isPublic = ? WHERE id = ? AND userId = ?',
      [content, isPublic, noteId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(403).json(errorResponse('无权修改该笔记'));
    }

    res.json(successResponse(null, '更新成功'));
  } catch (error) {
    console.error('updateQuestionNote error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.deleteQuestionNote = async (req, res) => {
  try {
    const { noteId } = req.body;
    const userId = req.userId;

    // 先检查权限
    const [note] = await pool.query('SELECT userId FROM public_question_notes WHERE id = ?', [noteId]);
    if (note.length === 0) {
      return res.status(404).json(errorResponse('笔记不存在'));
    }
    if (note[0].userId !== userId) {
      return res.status(403).json(errorResponse('无权删除该笔记'));
    }

    // 删除笔记及其所有回复
    await pool.query('DELETE FROM public_question_notes WHERE id = ? OR parentId = ?', [noteId, noteId]);
    // 同时删除相关的点赞记录
    await pool.query('DELETE FROM public_note_likes WHERE noteId = ?', [noteId]);

    res.json(successResponse(null, '删除成功'));
  } catch (error) {
    console.error('deleteQuestionNote error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.toggleNoteLike = async (req, res) => {
  try {
    const { noteId } = req.body;
    const userId = req.userId;

    const [existing] = await pool.query(
      'SELECT id FROM public_note_likes WHERE userId = ? AND noteId = ?',
      [userId, noteId]
    );

    if (existing.length > 0) {
      await pool.query('DELETE FROM public_note_likes WHERE userId = ? AND noteId = ?', [userId, noteId]);
      await pool.query('UPDATE public_question_notes SET likeCount = GREATEST(0, likeCount - 1) WHERE id = ?', [noteId]);
      return res.json(successResponse({ isLiked: false }, '取消点赞成功'));
    } else {
      await pool.query('INSERT INTO public_note_likes (userId, noteId) VALUES (?, ?)', [userId, noteId]);
      await pool.query('UPDATE public_question_notes SET likeCount = likeCount + 1 WHERE id = ?', [noteId]);
      return res.json(successResponse({ isLiked: true }, '点赞成功'));
    }
  } catch (error) {
    console.error('toggleNoteLike error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

/**
 * 获取书籍章节列表 (树形结构)
 */
exports.getBookChapters = async (req, res) => {
  const { bookId } = req.query;
  const userId = req.userId;

  if (!bookId) {
    return res.status(400).json(errorResponse('需要 bookId 参数'));
  }

  try {
    // 1. 获取所有章节
    const chapters = await PublicChapter.findByBookId(bookId);
    
    // 2. 获取用户的练习进度 (按题目统计)
    // 这里的进度统计可以根据需求优化，目前我们先按章节返回
    const [progressRows] = await pool.query(
      `SELECT q.id, ar.isCorrect 
       FROM public_questions q
       LEFT JOIN public_answer_records ar ON q.id = ar.questionId AND ar.userId = ?
       WHERE q.bookId = ?`,
      [userId, bookId]
    );

    // 3. 构建树形结构并计算进度
    const tree = [];
    const map = {};

    chapters.forEach(c => {
      map[c.id] = {
        ...c,
        doneCount: 0,
        correctCount: 0,
        totalCount: c.question_count || 0,
        children: []
      };
    });

    // 计算每个题目的完成情况 (如果需要精确到章节进度)
    // 注意：这里的进度计算逻辑依赖于 start_index 和 end_index
    progressRows.forEach(row => {
      // 找到包含该题目索引的章节并增加 doneCount
      // 实际上更好的做法是查询每个章节已做的题目数
    });

    // 重新获取每个章节的已做题目数
    // 修复：如果题目 sort 都是 0，这里会统计错误。
    // 但目前逻辑依赖于 sort 字段。如果数据不正确，我们需要先确保 sort 字段已正确填充。
    // 为了兼容性，我们先保留逻辑，并在发现 0/0 时提示用户可能需要重新结构化。
    const [chapterStats] = await pool.query(
      `SELECT c.id, COUNT(DISTINCT ar.questionId) as doneCount, 
              COUNT(DISTINCT CASE WHEN ar.isCorrect = 1 THEN ar.questionId END) as correctCount
       FROM public_chapters c
       JOIN public_questions q ON q.bookId = c.book_id AND q.sort BETWEEN c.start_index AND c.end_index
       JOIN public_answer_records ar ON q.id = ar.questionId AND ar.userId = ?
       WHERE c.book_id = ?
       GROUP BY c.id`,
      [userId, bookId]
    );

    chapterStats.forEach(stat => {
      if (map[stat.id]) {
        map[stat.id].doneCount = stat.doneCount;
        map[stat.id].correctCount = stat.correctCount;
      }
    });

    chapters.forEach(c => {
      if (c.parent_id && map[c.parent_id]) {
        map[c.parent_id].children.push(map[c.id]);
      } else {
        tree.push(map[c.id]);
      }
    });

    // 4. 获取全书统计信息
    const [bookInfoRows] = await pool.query(
      'SELECT id, title, description, pic_url FROM public_books WHERE id = ?',
      [bookId]
    );
    const bookBasicInfo = bookInfoRows[0] || {};

    const [bookStatsRows] = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM public_questions WHERE bookId = ?) as questionCount,
        (SELECT COUNT(DISTINCT questionId) FROM public_answer_records ar 
         JOIN public_questions q ON ar.questionId = q.id 
         WHERE q.bookId = ? AND ar.userId = ?) as doneCount,
        (SELECT COUNT(DISTINCT ar.questionId) FROM public_answer_records ar 
         JOIN public_questions q ON ar.questionId = q.id 
         WHERE q.bookId = ? AND ar.userId = ? AND ar.isCorrect = 1) as correctCount,
        (SELECT COUNT(DISTINCT questionId) FROM public_wrong_questions w 
         JOIN public_questions q ON w.questionId = q.id 
         WHERE q.bookId = ? AND w.userId = ?) as wrongCount,
        (SELECT COUNT(*) FROM public_favorite_questions f 
         JOIN public_questions q ON f.questionId = q.id 
         WHERE q.bookId = ? AND f.userId = ?) as favoriteCount,
        (SELECT lastIndex FROM public_user_progress WHERE userId = ? AND bookId = ?) as lastIndex
      `,
      [bookId, bookId, userId, bookId, userId, bookId, userId, bookId, userId, userId, bookId]
    );
    const bookStats = bookStatsRows[0];

    res.json(successResponse({
      chapters: tree,
      bookInfo: { ...bookBasicInfo, ...bookStats }
    }));
  } catch (err) {
    console.error('获取章节失败:', err);
    res.status(500).json(errorResponse('获取章节失败: ' + err.message));
  }
};

/**
 * 获取书籍包含的所有题型
 */
exports.getBookTypes = async (req, res) => {
  const { bookId } = req.query;
  if (!bookId) {
    return res.status(400).json(errorResponse('需要 bookId 参数'));
  }

  try {
    const [rows] = await pool.query(
      `SELECT type, COUNT(*) as count 
       FROM public_questions 
       WHERE bookId = ? 
       GROUP BY type 
       ORDER BY type ASC`,
      [bookId]
    );

    // 映射题型名称
    const typeNames = {
      1: '单选题',
      2: '多选题',
      3: '判断题',
      4: '填空题',
      5: '简答题',
      6: '分析题',
      10: '知识卡'
    };

    const types = rows.map(row => ({
      type: row.type,
      name: typeNames[row.type] || `其他题型(${row.type})`,
      count: row.count
    }));

    res.json(successResponse(types));
  } catch (err) {
    console.error('获取书籍题型失败:', err);
    res.status(500).json(errorResponse('获取书籍题型失败: ' + err.message));
  }
};
