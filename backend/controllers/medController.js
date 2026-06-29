
const pool = require('../config/mysql');
const { successResponse, errorResponse } = require('../utils/response');

const medController = {
  // 获取课程列表
  getCourses: async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT course_id as courseId, name as courseName FROM med_courses WHERE status = 1 ORDER BY id ASC');
      res.json(successResponse(rows));
    } catch (error) {
      console.error('getCourses error:', error);
      res.status(500).json(errorResponse('获取课程列表失败'));
    }
  },

  // 获取章节列表
  getChapters: async (req, res) => {
    const { course_id } = req.query;
    if (!course_id) return res.status(400).json(errorResponse('课程ID不能为空'));

    try {
      const [rows] = await pool.query(
        `SELECT 
          c.chapter_id as chapterId, 
          c.course_id as courseId,
          c.name as chapterName,
          (SELECT COUNT(*) FROM med_questions q WHERE q.chapter_id = c.chapter_id AND q.status = 1) as questionCount
        FROM med_chapters c 
        WHERE c.course_id = ? AND c.status = 1 
        ORDER BY c.id ASC`,
        [course_id]
      );
      res.json(successResponse(rows));
    } catch (error) {
      console.error('getChapters error:', error);
      res.status(500).json(errorResponse('获取章节列表失败'));
    }
  },

  // 获取年份列表
  getYears: async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT year, COUNT(*) as questionCount FROM med_questions WHERE year IS NOT NULL AND year != "" AND status = 1 GROUP BY year ORDER BY year DESC'
      );
      res.json(successResponse(rows));
    } catch (error) {
      console.error('getYears error:', error);
      res.status(500).json(errorResponse('获取年份列表失败'));
    }
  },

  // 获取题目列表
  getQuestions: async (req, res) => {
    let { chapter_id, year, limit = 10, offset = 0 } = req.query;
    
    // 容错处理：过滤字符串形式的 'undefined'
    if (chapter_id === 'undefined') chapter_id = null;
    if (year === 'undefined') year = null;
    
    try {
      let whereClause = 'WHERE status = 1';
      const params = [];

      if (chapter_id) {
        whereClause += ' AND chapter_id = ?';
        params.push(chapter_id);
      } else if (year) {
        whereClause += ' AND year = ?';
        params.push(year);
      }
      
      // 如果既没有 chapter_id 也没有 year，可能需要根据业务逻辑决定是否返回空或者报错
      // 目前保持原样，即不加这两个过滤条件


      // 获取总数
      const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM med_questions ${whereClause}`, params);
      const total = countResult[0].total;

      // 获取列表
      const query = `
        SELECT 
          question_id as questionId,
          course_id as courseId,
          chapter_id as chapterId,
          type as questionBankType,
          topic,
          topic_image as topicImage,
          content,
          answer,
          analysis as examCenterRestore,
          basic_analysis as basicAnalysis,
          basic_analysis_image as basicAnalysisImage,
          itemize_analysis as itemizeAnalysis,
          itemize_analysis_image as itemizeAnalysisImage,
          video_url as videoAnalysis,
          comparison_summary as comparisonSummary,
          comparison_images as comparisonImages,
          mind_map as mindMap,
          mind_map_image as mindMapImage,
          knowledge_image as knowledgeImage,
          year,
          number,
          score,
          score_describe as scoreDescribe,
          question_type_option as questionTypeOption,
          column_id as columnId,
          sort as sortNumber
        FROM med_questions 
        ${whereClause}
        ORDER BY sort ASC, id ASC LIMIT ? OFFSET ?
      `;
      const queryParams = [...params, parseInt(limit), parseInt(offset)];

      const [rows] = await pool.query(query, queryParams);
      
      // 解析 JSON 字段并格式化 content
      const processedRows = rows.map(row => {
        let content = row.content;
        
        // 1. 基础解析 (如果 content 是字符串)
        if (typeof content === 'string') {
          try {
            content = JSON.parse(content);
          } catch (e) {
            content = [];
          }
        }
        
        // 2. 如果 content 是数组，检查元素是否为 JSON 字符串 (处理双重编码)
        if (Array.isArray(content)) {
          content = {
            options: content.map(item => {
              let processedItem = item;
              // 如果元素是字符串且看起来像 JSON，尝试再次解析
              if (typeof item === 'string' && (item.startsWith('{') || item.startsWith('\"'))) {
                try {
                  // 处理可能存在的转义
                  const unescaped = item.replace(/\\"/g, '"');
                  processedItem = JSON.parse(unescaped);
                } catch (e) {
                  // 如果解析失败，保持原样
                }
              }
              
              // 提取 content 字段
              if (typeof processedItem === 'object' && processedItem !== null && processedItem.content) {
                return processedItem.content;
              }
              return processedItem;
            })
          };
        }

        return {
          ...row,
          content
        };
      });

      res.json(successResponse({
        list: processedRows,
        total
      }));
    } catch (error) {
      console.error('getQuestions error:', error);
      res.status(500).json(errorResponse('获取题目列表失败'));
    }
  },

  // 提交答案
  submitAnswer: async (req, res) => {
    const { questionId, userAnswer, isCorrect } = req.body;
    const userId = req.userId || 1; // 临时默认用户ID
    try {
      await pool.query(
        'INSERT INTO med_user_answers (user_id, question_id, user_answer, is_correct) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE user_answer = ?, is_correct = ?',
        [userId, questionId, userAnswer, isCorrect, userAnswer, isCorrect]
      );
      
      // 获取题目信息，用于记录学习历史
      const [qInfo] = await pool.query(
        'SELECT course_id, chapter_id FROM med_questions WHERE question_id = ?',
        [questionId]
      );
      
      let subjectName = '西医综合';
      let chapterName = null;
      let chapterId = null;

      if (qInfo.length > 0) {
        chapterId = qInfo[0].chapter_id;
        
        // 获取科目名称
        const [courseInfo] = await pool.query(
          'SELECT name FROM med_courses WHERE course_id = ?',
          [qInfo[0].course_id]
        );
        if (courseInfo.length > 0) {
          subjectName = courseInfo[0].name;
        }

        // 获取章节名称
        if (chapterId) {
          const [chapterInfo] = await pool.query(
            'SELECT name FROM med_chapters WHERE chapter_id = ?',
            [chapterId]
          );
          if (chapterInfo.length > 0) {
            chapterName = chapterInfo[0].name;
          }
        }
      }

      // 插入全局答题记录
      await pool.query(
        'INSERT INTO answer_records (userId, subjectId, subjectName, chapterId, chapterName, totalQuestions, correctQuestions, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [userId, 17, subjectName, chapterId, chapterName, 1, isCorrect ? 1 : 0]
      );

      // 更新用户总统计数据（level 由数据库生成列自动计算）
      await pool.query(
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

      res.json(successResponse({}));
    } catch (error) {
      console.error('submitAnswer error:', error);
      res.status(500).json(errorResponse('提交答案失败'));
    }
  },

  // 切换收藏
  toggleFavorite: async (req, res) => {
    const { questionId } = req.body;
    const userId = req.userId || 1;
    try {
      const [rows] = await pool.query('SELECT id FROM med_user_favorites WHERE user_id = ? AND question_id = ?', [userId, questionId]);
      if (rows.length > 0) {
        await pool.query('DELETE FROM med_user_favorites WHERE user_id = ? AND question_id = ?', [userId, questionId]);
        res.json(successResponse({ isFavorite: false }));
      } else {
        await pool.query('INSERT INTO med_user_favorites (user_id, question_id) VALUES (?, ?)', [userId, questionId]);
        res.json(successResponse({ isFavorite: true }));
      }
    } catch (error) {
      console.error('toggleFavorite error:', error);
      res.status(500).json(errorResponse('操作失败'));
    }
  },

  // 更新进度
  updateProgress: async (req, res) => {
    const { questionId, isCorrect, userAnswer } = req.body;
    const userId = req.userId || 1;
    try {
      await pool.query(
        'INSERT INTO med_user_progress (user_id, question_id, is_correct, last_answer) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE is_correct = ?, last_answer = ?, update_time = CURRENT_TIMESTAMP',
        [userId, questionId, isCorrect, userAnswer, isCorrect, userAnswer]
      );
      
      // 获取题目信息，用于记录学习历史
      const [qInfo] = await pool.query(
        'SELECT course_id, chapter_id FROM med_questions WHERE question_id = ?',
        [questionId]
      );
      
      let subjectName = '西医综合';
      let chapterName = null;
      let chapterId = null;

      if (qInfo.length > 0) {
        chapterId = qInfo[0].chapter_id;
        
        // 获取科目名称
        const [courseInfo] = await pool.query(
          'SELECT name FROM med_courses WHERE course_id = ?',
          [qInfo[0].course_id]
        );
        if (courseInfo.length > 0) {
          subjectName = courseInfo[0].name;
        }

        // 获取章节名称
        if (chapterId) {
          const [chapterInfo] = await pool.query(
            'SELECT name FROM med_chapters WHERE chapter_id = ?',
            [chapterId]
          );
          if (chapterInfo.length > 0) {
            chapterName = chapterInfo[0].name;
          }
        }
      }

      // 记录到全局答题记录
      await pool.query(
        'INSERT INTO answer_records (userId, subjectId, subjectName, chapterId, chapterName, totalQuestions, correctQuestions, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [userId, 17, subjectName, chapterId, chapterName, 1, isCorrect ? 1 : 0]
      );

      // 更新用户总统计数据（level 由数据库生成列自动计算）
      await pool.query(
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

      res.json(successResponse({}));
    } catch (error) {
      console.error('updateProgress error:', error);
      res.status(500).json(errorResponse('更新进度失败'));
    }
  },

  // 获取笔记
  getNotes: async (req, res) => {
    const { questionId } = req.query;
    const userId = req.userId || 1;
    try {
      const [rows] = await pool.query(
        `SELECT 
          n.*, 
          u.username as username, 
          u.avatar,
          (SELECT COUNT(*) FROM med_note_likes WHERE note_id = n.id) as likeCount,
          (SELECT COUNT(*) FROM med_note_likes WHERE note_id = n.id AND user_id = ?) as isLiked
        FROM med_notes n
        LEFT JOIN users u ON n.user_id = u.id
        WHERE n.question_id = ? AND (n.is_public = 1 OR n.user_id = ?) AND n.parent_id = 0
        ORDER BY n.create_time DESC`,
        [userId, questionId, userId]
      );
      res.json(successResponse(rows));
    } catch (error) {
      console.error('getNotes error:', error);
      res.status(500).json(errorResponse('获取笔记失败'));
    }
  },

  // 获取笔记回复
  getReplies: async (req, res) => {
    const { noteId } = req.query;
    try {
      const [rows] = await pool.query(
        `SELECT 
          n.*, 
          u.username as username, 
          u.avatar
        FROM med_notes n
        LEFT JOIN users u ON n.user_id = u.id
        WHERE n.parent_id = ?
        ORDER BY n.create_time ASC`,
        [noteId]
      );
      res.json(successResponse(rows));
    } catch (error) {
      console.error('getReplies error:', error);
      res.status(500).json(errorResponse('获取回复失败'));
    }
  },

  // 添加笔记
  addNote: async (req, res) => {
    const { questionId, content, isPublic, parentId } = req.body;
    const userId = req.userId || 1;
    try {
      const [result] = await pool.query(
        'INSERT INTO med_notes (user_id, question_id, content, is_public, parent_id) VALUES (?, ?, ?, ?, ?)',
        [userId, questionId, content, isPublic, parentId || 0]
      );
      res.json(successResponse({ id: result.insertId }));
    } catch (error) {
      console.error('addNote error:', error);
      res.status(500).json(errorResponse('添加笔记失败'));
    }
  },

  // 更新笔记
  updateNote: async (req, res) => {
    const { id, content, isPublic } = req.body;
    const userId = req.userId || 1;
    try {
      await pool.query(
        'UPDATE med_notes SET content = ?, is_public = ? WHERE id = ? AND user_id = ?',
        [content, isPublic, id, userId]
      );
      res.json(successResponse({}));
    } catch (error) {
      console.error('updateNote error:', error);
      res.status(500).json(errorResponse('更新笔记失败'));
    }
  },

  // 删除笔记
  deleteNote: async (req, res) => {
    const { id } = req.body;
    const userId = req.userId || 1;
    try {
      await pool.query('DELETE FROM med_notes WHERE id = ? AND user_id = ?', [id, userId]);
      res.json(successResponse({}));
    } catch (error) {
      console.error('deleteNote error:', error);
      res.status(500).json(errorResponse('删除笔记失败'));
    }
  },

  // 点赞笔记
  toggleNoteLike: async (req, res) => {
    const { noteId } = req.body;
    const userId = req.userId || 1;
    try {
      const [rows] = await pool.query('SELECT id FROM med_note_likes WHERE user_id = ? AND note_id = ?', [userId, noteId]);
      if (rows.length > 0) {
        await pool.query('DELETE FROM med_note_likes WHERE user_id = ? AND note_id = ?', [userId, noteId]);
        res.json(successResponse({ isLiked: false }));
      } else {
        await pool.query('INSERT INTO med_note_likes (user_id, note_id) VALUES (?, ?)', [userId, noteId]);
        res.json(successResponse({ isLiked: true }));
      }
    } catch (error) {
      console.error('toggleNoteLike error:', error);
      res.status(500).json(errorResponse('操作失败'));
    }
  },

  // 题目反馈
  submitQuestionFeedback: async (req, res) => {
    try {
      const { questionId, type, content } = req.body;
      const userId = req.userId || 1;
      
      if (!questionId || !content) {
        return res.status(400).json(errorResponse('参数不完整'));
      }

      await pool.query(
        'INSERT INTO med_feedback (UserID, QuestionID, Type, Content, Status) VALUES (?, ?, ?, ?, 1)',
        [userId, questionId, type || '题目纠错', content]
      );
      
      res.json(successResponse(null, '感谢您的反馈，我们将尽快处理'));
    } catch (error) {
      console.error('提交反馈失败:', error);
      res.status(500).json(errorResponse('服务器错误'));
    }
  },

  getFeedbacks: async (req, res) => {
    try {
      const { status, page = 1, size = 20 } = req.query;
      let query = 'SELECT f.*, q.topic as stem FROM med_feedback f JOIN med_questions q ON f.QuestionID = q.question_id WHERE 1=1';
      const params = [];

      if (status !== undefined && status !== '') {
        query += ' AND f.Status = ?';
        params.push(status);
      }

      query += ' ORDER BY f.CreatedAt DESC LIMIT ? OFFSET ?';
      params.push(parseInt(size), (parseInt(page) - 1) * parseInt(size));

      const [feedbacks] = await pool.query(query, params);
      const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM med_feedback');

      res.json(successResponse({ list: feedbacks, total }));
    } catch (error) {
      console.error('获取反馈列表失败:', error);
      res.status(500).json(errorResponse('服务器错误'));
    }
  },

  updateFeedbackStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, admin_remark } = req.body;
      
      await pool.query(
        'UPDATE med_feedback SET Status = ?, AdminRemark = ?, ProcessedAt = CURRENT_TIMESTAMP WHERE id = ?',
        [status, admin_remark, id]
      );
      
      res.json(successResponse(null, '反馈已更新'));
    } catch (error) {
      console.error('更新反馈状态失败:', error);
      res.status(500).json(errorResponse('服务器错误'));
    }
  },

  // 管理员搜索题目
  adminSearchQuestions: async (req, res) => {
    try {
      const { keyword, course_id, chapter_id, status, page = 1, size = 20 } = req.query;
      let query = `
        SELECT q.*, c.name as chapter_name, crs.name as course_name 
        FROM med_questions q 
        LEFT JOIN med_chapters c ON q.chapter_id = c.chapter_id 
        LEFT JOIN med_courses crs ON q.course_id = crs.course_id
        WHERE 1=1
      `;
      const params = [];

      if (keyword) {
        query += ' AND (q.topic LIKE ? OR q.question_id LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`);
      }

      if (course_id) {
        query += ' AND q.course_id = ?';
        params.push(course_id);
      }

      if (chapter_id) {
        query += ' AND q.chapter_id = ?';
        params.push(chapter_id);
      }

      if (status !== undefined && status !== '') {
        query += ' AND q.status = ?';
        params.push(status);
      }

      query += ' ORDER BY q.id DESC LIMIT ? OFFSET ?';
      params.push(parseInt(size), (parseInt(page) - 1) * parseInt(size));

      const [questions] = await pool.query(query, params);

      // 获取总数
      let countQuery = 'SELECT COUNT(*) as total FROM med_questions WHERE 1=1';
      const countParams = [];
      if (keyword) {
        countQuery += ' AND (topic LIKE ? OR question_id LIKE ?)';
        countParams.push(`%${keyword}%`, `%${keyword}%`);
      }
      if (course_id) {
        countQuery += ' AND course_id = ?';
        countParams.push(course_id);
      }
      if (chapter_id) {
        countQuery += ' AND chapter_id = ?';
        countParams.push(chapter_id);
      }
      if (status !== undefined && status !== '') {
        countQuery += ' AND status = ?';
        countParams.push(status);
      }
      const [[{ total }]] = await pool.query(countQuery, countParams);

      // 解析 JSON 字段
      const processedQuestions = questions.map(q => {
        if (typeof q.content === 'string') {
          try { q.content = JSON.parse(q.content); } catch (e) { q.content = []; }
        }
        return q;
      });

      res.json(successResponse({ list: processedQuestions, total }));
    } catch (error) {
      console.error('管理员搜索题目失败:', error);
      res.status(500).json(errorResponse('服务器错误'));
    }
  },

  // 管理员获取所有科目（包含未启用的）
  adminGetCourses: async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT course_id as courseId, name as courseName, status FROM med_courses ORDER BY id ASC');
      res.json(successResponse(rows));
    } catch (error) {
      console.error('adminGetCourses error:', error);
      res.status(500).json(errorResponse('获取科目列表失败'));
    }
  },

  // 管理员获取所有章节（包含未启用的）
  adminGetChapters: async (req, res) => {
    try {
      const { course_id } = req.query;
      let query = 'SELECT chapter_id as chapterId, course_id as courseId, name as chapterName, status FROM med_chapters';
      const params = [];
      if (course_id) {
        query += ' WHERE course_id = ?';
        params.push(course_id);
      }
      query += ' ORDER BY id ASC';
      const [rows] = await pool.query(query, params);
      res.json(successResponse(rows));
    } catch (error) {
      console.error('adminGetChapters error:', error);
      res.status(500).json(errorResponse('获取章节列表失败'));
    }
  },

  // 更新科目
  updateCourse: async (req, res) => {
    try {
      const { courseId } = req.params;
      const { courseName, status } = req.body;
      await pool.query(
        'UPDATE med_courses SET name = ?, status = ? WHERE course_id = ?',
        [courseName, status, courseId]
      );
      res.json(successResponse(null, '科目更新成功'));
    } catch (error) {
      console.error('更新科目失败:', error);
      res.status(500).json(errorResponse('服务器错误'));
    }
  },

  // 添加科目
  addCourse: async (req, res) => {
    try {
      const { courseId, courseName, status = 1 } = req.body;
      await pool.query(
        'INSERT INTO med_courses (course_id, name, status) VALUES (?, ?, ?)',
        [courseId, courseName, status]
      );
      res.json(successResponse(null, '科目添加成功'));
    } catch (error) {
      console.error('添加科目失败:', error);
      res.status(500).json(errorResponse('服务器错误'));
    }
  },

  // 更新章节
  updateChapter: async (req, res) => {
    try {
      const { chapterId } = req.params;
      const { chapterName, status, courseId } = req.body;
      await pool.query(
        'UPDATE med_chapters SET name = ?, status = ?, course_id = ? WHERE chapter_id = ?',
        [chapterName, status, courseId, chapterId]
      );
      res.json(successResponse(null, '章节更新成功'));
    } catch (error) {
      console.error('更新章节失败:', error);
      res.status(500).json(errorResponse('服务器错误'));
    }
  },

  // 添加章节
  addChapter: async (req, res) => {
    try {
      const { chapterId, chapterName, courseId, status = 1 } = req.body;
      await pool.query(
        'INSERT INTO med_chapters (chapter_id, name, course_id, status) VALUES (?, ?, ?, ?)',
        [chapterId, chapterName, courseId, status]
      );
      res.json(successResponse(null, '章节添加成功'));
    } catch (error) {
      console.error('添加章节失败:', error);
      res.status(500).json(errorResponse('服务器错误'));
    }
  },

  // 获取题目详情 (管理员用)
  getQuestionDetail: async (req, res) => {
    try {
      const { questionId } = req.params;
      const query = `
        SELECT q.*, c.name as chapter_name, crs.name as course_name 
        FROM med_questions q 
        LEFT JOIN med_chapters c ON q.chapter_id = c.chapter_id 
        LEFT JOIN med_courses crs ON q.course_id = crs.course_id
        WHERE q.question_id = ?
      `;
      const [rows] = await pool.query(query, [questionId]);
      
      if (rows.length === 0) {
        return res.status(404).json(errorResponse('题目不存在'));
      }

      const row = rows[0];
      // 解析 JSON 字段
      if (typeof row.content === 'string') {
        try { row.content = JSON.parse(row.content); } catch (e) { row.content = []; }
      }
      if (typeof row.comparison_images === 'string') {
        try { row.comparison_images = JSON.parse(row.comparison_images); } catch (e) { row.comparison_images = []; }
      }

      res.json(successResponse(row));
    } catch (error) {
      console.error('获取题目详情失败:', error);
      res.status(500).json(errorResponse('服务器错误'));
    }
  },

  // 更新题目数据
  updateQuestion: async (req, res) => {
    try {
      const { questionId } = req.params;
      const updateData = req.body;
      
      // 构建动态更新 SQL
      const fields = [];
      const values = [];
      
      // 允许更新的字段
      const allowedFields = [
        'topic', 'topic_image', 'content', 'answer', 'analysis', 
        'basic_analysis', 'basic_analysis_image', 'itemize_analysis', 
        'itemize_analysis_image', 'video_url', 'comparison_summary', 
        'comparison_images', 'mind_map', 'mind_map_image', 'knowledge_image', 
        'year', 'number', 'score', 'score_describe', 'question_type_option', 
        'column_id', 'sort', 'status', 'course_id', 'chapter_id', 'type'
      ];

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          fields.push(`${field} = ?`);
          // 如果是对象/数组，转为 JSON 字符串
          const val = (typeof updateData[field] === 'object' && updateData[field] !== null) 
            ? JSON.stringify(updateData[field]) 
            : updateData[field];
          values.push(val);
        }
      }

      if (fields.length === 0) {
        return res.status(400).json(errorResponse('没有提供更新数据'));
      }

      values.push(questionId);
      const sql = `UPDATE med_questions SET ${fields.join(', ')} WHERE question_id = ?`;
      
      await pool.query(sql, values);
      
      res.json(successResponse(null, '题目更新成功'));
    } catch (error) {
      console.error('更新题目失败:', error);
      res.status(500).json(errorResponse('服务器错误'));
    }
  },

  // 删除题目 (管理员用) - 级联删除
  deleteQuestion: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const { questionId } = req.params;
      
      await connection.beginTransaction();
      
      try {
        // 1. 删除用户收藏
        await connection.query('DELETE FROM med_user_favorites WHERE question_id = ?', [questionId]);
        
        // 2. 删除用户答案记录
        await connection.query('DELETE FROM med_user_answers WHERE question_id = ?', [questionId]);
        
        // 3. 删除用户进度
        await connection.query('DELETE FROM med_user_progress WHERE question_id = ?', [questionId]);
        
        // 4. 删除相关笔记的点赞
        await connection.query('DELETE FROM med_note_likes WHERE note_id IN (SELECT id FROM med_notes WHERE question_id = ?)', [questionId]);
        
        // 5. 删除相关笔记
        await connection.query('DELETE FROM med_notes WHERE question_id = ?', [questionId]);
        
        // 6. 删除反馈记录
        await connection.query('DELETE FROM med_feedback WHERE QuestionID = ?', [questionId]);
        
        // 7. 最后删除题目本身
        await connection.query('DELETE FROM med_questions WHERE question_id = ?', [questionId]);
        
        await connection.commit();
        res.json(successResponse(null, '题目删除成功'));
      } catch (err) {
        await connection.rollback();
        throw err;
      }
    } catch (error) {
      console.error('删除题目失败:', error);
      res.status(500).json(errorResponse('删除题目失败: ' + error.message));
    } finally {
      connection.release();
    }
  }
};

module.exports = medController;
