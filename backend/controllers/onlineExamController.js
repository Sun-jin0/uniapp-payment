const mysqlPool = require('../config/mysql');
const { successResponse, errorResponse } = require('../utils/response');

// 生成唯一ID
const generateId = () => {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

// ==================== 管理员接口 ====================

// 创建考试
const createExam = async (req, res) => {
  try {
    const {
      title,
      description,
      majorId,
      majorName,
      paperType = 1, // 1=真题卷，2=模拟题卷，3=组卷
      sourcePaperId,
      sourcePaperName,
      startTime,
      endTime,
      duration = 120,
      isLimitedTime = 1,
      showResultImmediately = 1,
      allowReview = 1,
      passScore = 60,
      totalScore = 100,
      questionIds = [] // [{ questionId, score, sortOrder, questionType }]
    } = req.body;

    if (!title || !startTime || !endTime) {
      return res.status(400).json(errorResponse('考试名称、开始时间和结束时间不能为空'));
    }

    // 验证试卷类型
    if (![1, 2, 3].includes(parseInt(paperType))) {
      return res.status(400).json(errorResponse('试卷类型必须是1（真题卷）、2（模拟题卷）或3（组卷）'));
    }

    // 真题卷或模拟题卷必须指定来源试卷
    if ((paperType == 1 || paperType == 2) && !sourcePaperId) {
      return res.status(400).json(errorResponse('真题卷或模拟题卷必须指定来源试卷'));
    }

    // 组卷必须有题目
    if (paperType == 3 && (!questionIds || questionIds.length === 0)) {
      return res.status(400).json(errorResponse('组卷类型必须从题库中选择题目'));
    }

    const connection = await mysqlPool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. 创建考试
      const [examResult] = await connection.execute(
        `INSERT INTO online_exams 
         (title, description, paper_type, source_paper_id, source_paper_name, 
          start_time, end_time, duration, is_limited_time, show_result_immediately, allow_review, 
          pass_score, total_score, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, description || null, paperType, sourcePaperId || null, sourcePaperName || null,
         startTime, endTime, duration, isLimitedTime, showResultImmediately, allowReview,
         passScore, totalScore, req.userId]
      );

      const examId = examResult.insertId;

      // 2. 添加考试题目
      let finalQuestionIds = questionIds;
      
      // 如果是真题卷或模拟题卷，自动从来源试卷获取题目
      if ((paperType == 1 || paperType == 2) && sourcePaperId) {
        const [paperQuestions] = await connection.execute(
          `SELECT pq.question_id, q.total_score 
           FROM computer1_paper_question pq
           LEFT JOIN computer1_question q ON pq.question_id = q.question_id
           WHERE pq.paper_id = ? 
           ORDER BY pq.sort_order`,
          [sourcePaperId]
        );
        
        finalQuestionIds = paperQuestions.map((pq, index) => ({
          questionId: pq.question_id,
          score: pq.total_score || 0,
          sortOrder: index + 1,
          questionType: 'choice'
        }));
      }

      if (finalQuestionIds && finalQuestionIds.length > 0) {
        const questionValues = finalQuestionIds.map((q, index) => [
          examId, q.questionId, q.sortOrder || index + 1, q.score || 0, q.questionType || 'choice'
        ]);

        await connection.query(
          `INSERT INTO online_exam_questions 
           (exam_id, question_id, sort_order, score, question_type) 
           VALUES ?`,
          [questionValues]
        );

        // 初始化每题作答分析记录
        const analysisValues = finalQuestionIds.map((q, index) => [
          examId, q.questionId, q.questionType || 'choice', q.score || 0, q.sortOrder || index + 1
        ]);

        await connection.query(
          `INSERT INTO online_exam_question_analysis 
           (exam_id, question_id, question_type, question_score, sort_order) 
           VALUES ?`,
          [analysisValues]
        );
      }

      await connection.commit();
      res.json(successResponse({ examId }, '考试创建成功'));

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('创建考试失败:', error);
    res.status(500).json(errorResponse('创建考试失败: ' + error.message));
  }
};

// 更新考试
const updateExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const updateData = req.body;

    const connection = await mysqlPool.getConnection();
    await connection.beginTransaction();

    try {
      // 构建更新SQL
      const allowedFields = ['title', 'description', 'start_time', 'end_time', 'duration',
        'is_limited_time', 'show_result_immediately', 'allow_review', 
        'pass_score', 'total_score', 'is_published'];
      
      const updates = [];
      const params = [];

      for (const [key, value] of Object.entries(updateData)) {
        const dbField = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        if (allowedFields.includes(dbField)) {
          updates.push(`${dbField} = ?`);
          params.push(value);
        }
      }

      if (updates.length > 0) {
        params.push(examId);
        await connection.execute(
          `UPDATE online_exams SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
      }

      // 更新题目
      if (updateData.questionIds) {
        await connection.execute('DELETE FROM online_exam_questions WHERE exam_id = ?', [examId]);
        
        if (updateData.questionIds.length > 0) {
          const questionValues = updateData.questionIds.map((q, index) => [
            examId, q.questionId, q.sortOrder || index + 1, q.score || 0, q.questionType || 'choice'
          ]);

          await connection.query(
            `INSERT INTO online_exam_questions 
             (exam_id, question_id, sort_order, score, question_type) 
             VALUES ?`,
            [questionValues]
          );
        }
      }

      await connection.commit();
      res.json(successResponse(null, '考试更新成功'));

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('更新考试失败:', error);
    res.status(500).json(errorResponse('更新考试失败: ' + error.message));
  }
};

// 删除考试
const deleteExam = async (req, res) => {
  try {
    const { examId } = req.params;
    
    await mysqlPool.execute('DELETE FROM online_exams WHERE id = ?', [examId]);
    res.json(successResponse(null, '考试删除成功'));

  } catch (error) {
    console.error('删除考试失败:', error);
    res.status(500).json(errorResponse('删除考试失败: ' + error.message));
  }
};

// 获取考试列表（管理员）
const getExamList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const { majorId, isPublished, paperType } = req.query;
    const offset = (page - 1) * pageSize;

    let sql = `
      SELECT 
        e.id, e.title, e.description, e.paper_type, 
        e.source_paper_id, e.source_paper_name,
        e.start_time, e.end_time, e.duration,
        e.is_published, e.is_limited_time, 
        e.show_result_immediately, e.allow_review,
        e.pass_score, e.total_score, e.created_by, e.created_at,
        COUNT(DISTINCT er.user_id) as participant_count,
        COUNT(DISTINCT CASE WHEN er.status = 1 THEN er.user_id END) as submitted_count
      FROM online_exams e
      LEFT JOIN online_exam_records er ON e.id = er.exam_id
      WHERE 1=1
    `;
    const params = [];

    if (isPublished !== undefined) {
      sql += ' AND e.is_published = ?';
      params.push(isPublished);
    }

    if (paperType !== undefined) {
      sql += ' AND e.paper_type = ?';
      params.push(paperType);
    }

    sql += ' GROUP BY e.id ORDER BY e.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), parseInt(offset));

    const [exams] = await mysqlPool.query(sql, params);

    console.log('考试列表查询结果:', JSON.stringify(exams, null, 2));

    // 处理试卷类型显示
    const paperTypeMap = {
      1: '真题卷',
      2: '模拟题卷',
      3: '组卷'
    };

    const formattedExams = exams.map(exam => ({
      ...exam,
      paper_type_name: paperTypeMap[exam.paper_type] || '未知'
    }));

    console.log('formattedExams[0]:', JSON.stringify(formattedExams[0], null, 2));

    // 获取总数
    let countSql = 'SELECT COUNT(*) as total FROM online_exams WHERE 1=1';
    const countParams = [];
    
    if (majorId) {
      countSql += ' AND major_id = ?';
      countParams.push(majorId);
    }
    if (isPublished !== undefined) {
      countSql += ' AND is_published = ?';
      countParams.push(isPublished);
    }
    if (paperType !== undefined) {
      countSql += ' AND paper_type = ?';
      countParams.push(paperType);
    }

    const [countResult] = await mysqlPool.query(countSql, countParams);

    console.log('返回考试列表:', JSON.stringify(formattedExams[0], null, 2));

    res.json(successResponse({
      list: formattedExams,
      total: countResult[0].total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }));

  } catch (error) {
    console.error('获取考试列表失败:', error);
    res.status(500).json(errorResponse('获取考试列表失败: ' + error.message));
  }
};

// 获取考试详情（管理员）
const getExamDetail = async (req, res) => {
  try {
    const { examId } = req.params;

    // 获取考试基本信息
    const [exams] = await mysqlPool.execute(
      'SELECT * FROM online_exams WHERE id = ?',
      [examId]
    );

    if (exams.length === 0) {
      return res.status(404).json(errorResponse('考试不存在'));
    }

    // 获取考试题目
    const [questions] = await mysqlPool.execute(
      `SELECT 
        eq.*,
        q.exercise_type,
        q.exercise_type_name,
        q.stem,
        q.level,
        q.answer as correct_answer
      FROM online_exam_questions eq
      LEFT JOIN computer1_question q ON eq.question_id = q.question_id
      WHERE eq.exam_id = ?
      ORDER BY eq.sort_order`,
      [examId]
    );

    res.json(successResponse({
      ...exams[0],
      questions
    }));

  } catch (error) {
    console.error('获取考试详情失败:', error);
    res.status(500).json(errorResponse('获取考试详情失败: ' + error.message));
  }
};

// 获取考试题目列表（管理员）
const getExamQuestions = async (req, res) => {
  try {
    const { examId } = req.params;

    // 获取考试题目
    const [questions] = await mysqlPool.execute(
      `SELECT 
        eq.*,
        q.exercise_type,
        q.exercise_type_name,
        q.stem,
        q.level,
        q.answer as correct_answer
      FROM online_exam_questions eq
      LEFT JOIN computer1_question q ON eq.question_id = q.question_id
      WHERE eq.exam_id = ?
      ORDER BY eq.sort_order`,
      [examId]
    );

    // 获取每个题目的考点
    for (const question of questions) {
      const [knowledgePoints] = await mysqlPool.execute(
        `SELECT kt.tag_name 
         FROM computer1_question_tag_relation qtr
         LEFT JOIN computer1_knowledge_tag kt ON qtr.tag_id = kt.tag_id
         WHERE qtr.question_id = ?`,
        [question.question_id]
      );
      question.knowledge_points = knowledgePoints.map(kp => kp.tag_name);
    }

    res.json(successResponse(questions));

  } catch (error) {
    console.error('获取考试题目失败:', error);
    res.status(500).json(errorResponse('获取考试题目失败: ' + error.message));
  }
};

// 主观题评分
const gradeSubjectiveQuestion = async (req, res) => {
  try {
    const { recordId, questionId } = req.params;
    const { score, comment } = req.body;

    const connection = await mysqlPool.getConnection();
    await connection.beginTransaction();

    try {
      // 更新答案评分
      await connection.execute(
        `UPDATE online_exam_answers 
         SET score = ?, teacher_comment = ?, graded_by = ?, graded_at = NOW(), is_correct = 1
         WHERE record_id = ? AND question_id = ?`,
        [score, comment, req.userId, recordId, questionId]
      );

      // 重新计算总分
      const [answers] = await connection.execute(
        'SELECT SUM(score) as total FROM online_exam_answers WHERE record_id = ?',
        [recordId]
      );

      const totalScore = answers[0].total || 0;

      // 获取考试及格分
      const [record] = await connection.execute(
        `SELECT er.*, e.pass_score 
         FROM online_exam_records er
         JOIN online_exams e ON er.exam_id = e.id
         WHERE er.id = ?`,
        [recordId]
      );

      if (record.length > 0) {
        const isPassed = totalScore >= record[0].pass_score ? 1 : 0;
        
        await connection.execute(
          `UPDATE online_exam_records 
           SET subjective_score = subjective_score + ?, total_score = ?, is_passed = ?, is_graded = 1
           WHERE id = ?`,
          [score, totalScore, isPassed, recordId]
        );
      }

      await connection.commit();
      res.json(successResponse(null, '评分成功'));

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('评分失败:', error);
    res.status(500).json(errorResponse('评分失败: ' + error.message));
  }
};

// 获取考试统计数据
const getExamStatistics = async (req, res) => {
  try {
    const { examId } = req.params;

    // 获取考试基本信息
    const [examInfo] = await mysqlPool.execute(
      'SELECT total_score, pass_score FROM online_exams WHERE id = ?',
      [examId]
    );
    
    if (examInfo.length === 0) {
      return res.status(404).json(errorResponse('考试不存在'));
    }
    
    const totalScore = parseFloat(examInfo[0].total_score) || 150;
    const passScore = parseFloat(examInfo[0].pass_score) || 90;

    // 获取统计信息
    const [stats] = await mysqlPool.execute(
      `SELECT 
        COUNT(*) as total_participants,
        COUNT(CASE WHEN status = 1 THEN 1 END) as submitted_count,
        COUNT(CASE WHEN is_graded = 1 THEN 1 END) as graded_count,
        MAX(CAST(total_score AS DECIMAL(10,2))) as highest_score,
        MIN(CAST(total_score AS DECIMAL(10,2))) as lowest_score,
        AVG(CAST(total_score AS DECIMAL(10,2))) as average_score,
        COUNT(CASE WHEN is_passed = 1 THEN 1 END) as pass_count,
        AVG(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END) * 100 as pass_rate
      FROM online_exam_records
      WHERE exam_id = ? AND status = 1`,
      [examId]
    );

    // 根据总分动态计算分数段（5个区间）
    const scoreRanges = [];
    const rangeSize = totalScore / 5;
    for (let i = 0; i < 5; i++) {
      const min = Math.round(totalScore - (i + 1) * rangeSize);
      const max = Math.round(totalScore - i * rangeSize);
      scoreRanges.push({
        label: `${min}-${max}分`,
        min: min,
        max: max,
        key: `${min}-${max}`
      });
    }

    // 获取分数段分布（动态计算）
    let scoreDistributionQuery = `SELECT `;
    scoreRanges.forEach((range, index) => {
      if (index > 0) scoreDistributionQuery += ', ';
      // 第一个区间（最高分区间）包含等于最大值的情况
      if (index === 0) {
        scoreDistributionQuery += `SUM(CASE WHEN CAST(total_score AS DECIMAL(10,2)) >= ${range.min} AND CAST(total_score AS DECIMAL(10,2)) <= ${range.max} THEN 1 ELSE 0 END) as \`${range.key}\``;
      } else {
        scoreDistributionQuery += `SUM(CASE WHEN CAST(total_score AS DECIMAL(10,2)) >= ${range.min} AND CAST(total_score AS DECIMAL(10,2)) < ${range.max} THEN 1 ELSE 0 END) as \`${range.key}\``;
      }
    });
    scoreDistributionQuery += ` FROM online_exam_records WHERE exam_id = ? AND status = 1`;

    const [distributionResult] = await mysqlPool.execute(scoreDistributionQuery, [examId]);
    
    // 构建分数段分布对象
    const score_distribution = {};
    scoreRanges.forEach(range => {
      score_distribution[range.key] = distributionResult[0][range.key] || 0;
    });

    // 获取题型分布统计
    const [questionTypeStats] = await mysqlPool.execute(
      `SELECT 
        q.exercise_type,
        q.exercise_type_name,
        COUNT(*) as question_count,
        SUM(eq.score) as total_points,
        AVG(CAST(uqa.score AS DECIMAL(10,2))) as avg_score,
        AVG(CAST(qa.correct_rate AS DECIMAL(10,2))) as avg_correct_rate
      FROM online_exam_questions eq
      LEFT JOIN computer1_question q ON eq.question_id = q.question_id
      LEFT JOIN online_exam_user_question_analysis uqa ON eq.question_id = uqa.question_id
      LEFT JOIN online_exam_question_analysis qa ON eq.question_id = qa.question_id
      WHERE eq.exam_id = ?
      GROUP BY q.exercise_type, q.exercise_type_name`,
      [examId]
    );

    // 获取分数趋势（按提交时间）
    const [scoreTrend] = await mysqlPool.execute(
      `SELECT 
        DATE(submit_time) as date,
        COUNT(*) as count,
        AVG(CAST(total_score AS DECIMAL(10,2))) as avg_score
      FROM online_exam_records
      WHERE exam_id = ? AND status = 1 AND submit_time IS NOT NULL
      GROUP BY DATE(submit_time)
      ORDER BY date ASC
      LIMIT 30`,
      [examId]
    );

    // 获取及格/不及格分布
    const [passDistribution] = await mysqlPool.execute(
      `SELECT 
        SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN is_passed = 0 THEN 1 ELSE 0 END) as failed
      FROM online_exam_records
      WHERE exam_id = ? AND status = 1`,
      [examId]
    );

    res.json(successResponse({
      ...stats[0],
      total_score: totalScore,
      pass_score: passScore,
      score_distribution,
      score_ranges: scoreRanges.map(r => r.label),
      question_type_stats: questionTypeStats,
      score_trend: scoreTrend,
      pass_distribution: passDistribution[0]
    }));

  } catch (error) {
    console.error('获取考试统计失败:', error);
    res.status(500).json(errorResponse('获取考试统计失败: ' + error.message));
  }
};

// 获取考试记录列表（管理员）
const getExamRecords = async (req, res) => {
  try {
    const { examId } = req.params;
    const { page = 1, pageSize = 10, status } = req.query;

    let sql = `
      SELECT 
        er.*,
        u.username,
        u.nickname,
        e.title as exam_title,
        e.total_score as exam_total_score,
        e.pass_score
      FROM online_exam_records er
      LEFT JOIN users u ON er.user_id = u.id
      LEFT JOIN online_exams e ON er.exam_id = e.id
      WHERE er.exam_id = ?
    `;
    const params = [examId];

    if (status !== undefined) {
      sql += ' AND er.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY er.submit_time DESC, er.created_at DESC';

    // 分页
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [records] = await mysqlPool.query(sql, params);

    // 获取总数
    const [countResult] = await mysqlPool.execute(
      'SELECT COUNT(*) as total FROM online_exam_records WHERE exam_id = ?',
      [examId]
    );

    res.json(successResponse({
      list: records,
      total: countResult[0].total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }));

  } catch (error) {
    console.error('获取考试记录失败:', error);
    res.status(500).json(errorResponse('获取考试记录失败: ' + error.message));
  }
};

// 获取待批改的解答题列表（管理员）
const getPendingSubjectiveQuestions = async (req, res) => {
  try {
    const { examId } = req.params;
    console.log('获取待批改解答题, examId:', examId);

    // 先查询该考试下所有题目的类型（用于调试）
    const [debugTypes] = await mysqlPool.execute(
      `SELECT DISTINCT q.exercise_type, q.exercise_type_name, COUNT(*) as count
       FROM online_exam_questions eq
       LEFT JOIN computer1_question q ON eq.question_id = q.question_id
       WHERE eq.exam_id = ?
       GROUP BY q.exercise_type, q.exercise_type_name`,
      [examId]
    );
    console.log('考试题目类型分布:', debugTypes);

    // 放宽查询条件，获取所有主观题类型的答案
    const [questions] = await mysqlPool.execute(
      `SELECT 
        oea.id as answer_id,
        oea.record_id,
        oea.question_id,
        oea.user_answer,
        oea.score as current_score,
        oea.is_correct,
        er.user_id,
        u.username,
        u.nickname,
        q.stem,
        q.answer as correct_answer,
        q.analysis,
        q.exercise_type,
        q.exercise_type_name,
        eq.score as question_score,
        e.title as exam_title
      FROM online_exam_answers oea
      LEFT JOIN online_exam_records er ON oea.record_id = er.id
      LEFT JOIN users u ON er.user_id = u.id
      LEFT JOIN computer1_question q ON oea.question_id = q.question_id
      LEFT JOIN online_exam_questions eq ON oea.question_id = eq.question_id AND eq.exam_id = ?
      LEFT JOIN online_exams e ON er.exam_id = e.id
      WHERE er.exam_id = ? 
        AND (q.exercise_type = 4 OR q.exercise_type = '解答题' OR q.exercise_type_name LIKE '%解答%' OR q.exercise_type_name LIKE '%主观%')
        AND (oea.score IS NULL OR oea.score = 0)
        AND er.status = 1
      ORDER BY er.submit_time ASC`,
      [examId, examId]
    );

    console.log(`找到 ${questions.length} 道待批改解答题`);
    if (questions.length > 0) {
      console.log('第一题信息:', {
        question_id: questions[0].question_id,
        exercise_type: questions[0].exercise_type,
        exercise_type_name: questions[0].exercise_type_name,
        user_answer: questions[0].user_answer?.substring(0, 50)
      });
    }

    // 获取每个题目的小题
    for (const question of questions) {
      const [subs] = await mysqlPool.execute(
        'SELECT * FROM computer1_question_sub WHERE question_id = ? ORDER BY question_order ASC',
        [question.question_id]
      );
      question.subs = subs;
    }

    res.json(successResponse(questions));

  } catch (error) {
    console.error('获取待批改解答题失败:', error);
    res.status(500).json(errorResponse('获取待批改解答题失败: ' + error.message));
  }
};

// 获取所有解答题答案（用于调试）
const getAllSubjectiveAnswers = async (req, res) => {
  try {
    const { examId } = req.params;
    console.log('获取所有解答题答案, examId:', examId);

    // 查询所有解答题答案（包括已评分和未评分）
    const [answers] = await mysqlPool.execute(
      `SELECT 
        oea.id as answer_id,
        oea.record_id,
        oea.question_id,
        LEFT(oea.user_answer, 100) as user_answer_preview,
        oea.score,
        oea.is_correct,
        er.user_id,
        er.status as record_status,
        q.exercise_type,
        q.exercise_type_name
      FROM online_exam_answers oea
      LEFT JOIN online_exam_records er ON oea.record_id = er.id
      LEFT JOIN computer1_question q ON oea.question_id = q.question_id
      WHERE er.exam_id = ? 
        AND (q.exercise_type = 4 OR q.exercise_type = '解答题' OR q.exercise_type_name LIKE '%解答%' OR q.exercise_type_name LIKE '%主观%')
      ORDER BY oea.id DESC`,
      [examId]
    );

    console.log(`找到 ${answers.length} 道解答题答案记录`);

    res.json(successResponse({
      count: answers.length,
      answers: answers
    }));

  } catch (error) {
    console.error('获取所有解答题答案失败:', error);
    res.status(500).json(errorResponse('获取所有解答题答案失败: ' + error.message));
  }
};

// ==================== 用户接口 ====================

// 获取可参加的考试列表
const getAvailableExams = async (req, res) => {
  try {
    const { majorId, paperType, page = 1, pageSize = 10 } = req.query;
    const userId = req.userId;
    const now = new Date();
    const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');

    console.log('获取考试列表 - 用户ID:', userId, '当前时间:', nowStr);

    // 查询用户参与过的考试 + 所有已发布且未过期的考试
    let sql = `
      SELECT 
        e.id, e.title, e.description, e.paper_type, 
        e.source_paper_id, e.source_paper_name,
        e.start_time, e.end_time, e.duration,
        e.is_published, e.is_limited_time, 
        e.show_result_immediately, e.allow_review,
        e.pass_score, e.total_score,
        er.id as record_id,
        er.status as user_status,
        er.total_score as user_score,
        er.is_graded,
        (SELECT COUNT(DISTINCT user_id) FROM online_exam_records WHERE exam_id = e.id) as participant_count
      FROM online_exams e
      LEFT JOIN online_exam_records er ON e.id = er.exam_id AND er.user_id = ?
      WHERE e.is_published = 1
        AND (
          e.end_time > ?
          OR er.id IS NOT NULL
        )
    `;
    const params = [userId, nowStr];

    if (paperType !== undefined) {
      sql += ' AND e.paper_type = ?';
      params.push(paperType);
    }

    sql += ' ORDER BY e.start_time ASC';
    
    // 添加分页
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    console.log('执行SQL:', sql);
    console.log('SQL参数:', params);

    let exams;
    try {
      [exams] = await mysqlPool.query(sql, params);
      console.log('查询到的考试数量:', exams.length);
    } catch (sqlError) {
      console.error('SQL执行错误:', sqlError);
      throw sqlError;
    }

    // 试卷类型映射
    const paperTypeMap = {
      1: '真题卷',
      2: '模拟题卷',
      3: '组卷'
    };

    // 处理考试状态
    const processedExams = exams.map(exam => {
      const startTime = new Date(exam.start_time);
      const endTime = new Date(exam.end_time);
      
      let status = 'upcoming'; // upcoming, ongoing, completed, missed
      if (now < startTime) {
        status = 'upcoming';
      } else if (now >= startTime && now <= endTime) {
        status = exam.user_status === 1 ? 'completed' : 'ongoing';
      } else {
        status = exam.user_status === 1 ? 'completed' : 'missed';
      }

      return {
        ...exam,
        paper_type_name: paperTypeMap[exam.paper_type] || '未知',
        examStatus: status,
        isParticipated: !!exam.record_id,
        canJoin: status === 'ongoing' && !exam.record_id
      };
    });

    // 获取总数
    let countSql = `
      SELECT COUNT(*) as total 
      FROM online_exams e
      LEFT JOIN online_exam_records er ON e.id = er.exam_id AND er.user_id = ?
      WHERE e.is_published = 1
        AND (
          e.end_time > ?
          OR er.id IS NOT NULL
        )
    `;
    const countParams = [userId, nowStr];
    
    if (paperType !== undefined) {
      countSql += ' AND e.paper_type = ?';
      countParams.push(paperType);
    }
    
    const [countResult] = await mysqlPool.query(countSql, countParams);
    const total = countResult[0].total;
    
    console.log('考试总数:', total);

    res.json(successResponse({
      list: processedExams,
      total: total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }));

  } catch (error) {
    console.error('获取考试列表失败:', error);
    res.status(500).json(errorResponse('获取考试列表失败: ' + error.message));
  }
};

// 开始考试
const startExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.userId;

    // 检查考试是否存在且可参加
    const [exams] = await mysqlPool.execute(
      'SELECT * FROM online_exams WHERE id = ? AND is_published = 1',
      [examId]
    );

    if (exams.length === 0) {
      return res.status(404).json(errorResponse('考试不存在或未发布'));
    }

    const exam = exams[0];
    const now = new Date();
    const startTime = new Date(exam.start_time);
    const endTime = new Date(exam.end_time);

    // 检查时间
    if (now < startTime) {
      return res.status(400).json(errorResponse('考试尚未开始'));
    }

    if (now > endTime) {
      return res.status(400).json(errorResponse('考试已结束'));
    }

    const connection = await mysqlPool.getConnection();
    await connection.beginTransaction();

    try {
      // 检查是否已参加
      const [existing] = await connection.execute(
        'SELECT * FROM online_exam_records WHERE exam_id = ? AND user_id = ?',
        [examId, userId]
      );

      let recordId;

      if (existing.length > 0) {
        if (existing[0].status === 1) {
          return res.status(400).json(errorResponse('您已完成此考试'));
        }
        recordId = existing[0].id;
        // 更新开始时间
        await connection.execute(
          'UPDATE online_exam_records SET start_time = NOW() WHERE id = ?',
          [recordId]
        );
      } else {
        // 创建考试记录
        const [result] = await connection.execute(
          `INSERT INTO online_exam_records 
           (exam_id, user_id, start_time, status) 
           VALUES (?, ?, NOW(), 0)`,
          [examId, userId]
        );
        recordId = result.insertId;
      }

      // 获取考试题目（在事务内）
      const [questions] = await connection.execute(
        `SELECT 
          eq.question_id,
          eq.score as question_score,
          eq.question_type,
          q.exercise_type,
          q.exercise_type_name,
          q.stem,
          q.level
        FROM online_exam_questions eq
        LEFT JOIN computer1_question q ON eq.question_id = q.question_id
        WHERE eq.exam_id = ?
        ORDER BY eq.sort_order`,
        [examId]
      );

      // 获取每个题目的选项和小题（在事务内）
      for (const question of questions) {
        // 获取选项（数组格式，与 computer-question-detail.vue 一致）
        const [options] = await connection.execute(
          'SELECT option_key, option_value FROM computer1_question_option WHERE question_id = ? ORDER BY option_sort ASC',
          [question.question_id]
        );
        question.options = options;

        // 获取小题（解答题）
        const [subs] = await connection.execute(
          'SELECT * FROM computer1_question_sub WHERE question_id = ? ORDER BY question_order ASC',
          [question.question_id]
        );
        question.subs = subs;
      }

      await connection.commit();

      res.json(successResponse({
        recordId,
        exam: {
          id: exam.id,
          title: exam.title,
          duration: exam.duration,
          isLimitedTime: exam.is_limited_time,
          endTime: exam.end_time
        },
        questions
      }));

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('开始考试失败:', error);
    res.status(500).json(errorResponse('开始考试失败: ' + error.message));
  }
};

// 更新每题作答分析
const updateQuestionAnalysis = async (connection, examId, questionId) => {
  try {
    // 获取该题的所有答案
    const [answers] = await connection.execute(
      `SELECT 
        user_answer,
        is_correct,
        score,
        answer_time
      FROM online_exam_user_question_analysis
      WHERE exam_id = ? AND question_id = ?`,
      [examId, questionId]
    );

    if (answers.length === 0) return;

    const totalAttempts = answers.length;
    const correctCount = answers.filter(a => a.is_correct === 1).length;
    const wrongCount = answers.filter(a => a.is_correct === 0).length;
    const unansweredCount = answers.filter(a => a.is_correct === null).length;
    const correctRate = totalAttempts > 0 ? (correctCount / totalAttempts * 100).toFixed(2) : 0;

    // 计算平均得分
    const scores = answers.filter(a => a.score !== null).map(a => parseFloat(a.score));
    const averageScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;

    // 统计选项分布（选择题）
    const optionDistribution = {};
    const wrongAnswers = {};
    
    answers.forEach(a => {
      if (a.user_answer) {
        optionDistribution[a.user_answer] = (optionDistribution[a.user_answer] || 0) + 1;
        
        if (a.is_correct === 0) {
          wrongAnswers[a.user_answer] = (wrongAnswers[a.user_answer] || 0) + 1;
        }
      }
    });

    // 获取常见错误答案（Top 3）
    const commonWrongAnswers = Object.entries(wrongAnswers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {});

    // 更新分析表
    await connection.execute(
      `UPDATE online_exam_question_analysis 
       SET total_attempts = ?,
           correct_count = ?,
           wrong_count = ?,
           unanswered_count = ?,
           correct_rate = ?,
           average_score = ?,
           max_score = ?,
           min_score = ?,
           option_distribution = ?,
           common_wrong_answers = ?,
           updated_at = NOW()
       WHERE exam_id = ? AND question_id = ?`,
      [
        totalAttempts,
        correctCount,
        wrongCount,
        unansweredCount,
        correctRate,
        averageScore,
        maxScore,
        minScore,
        JSON.stringify(optionDistribution),
        JSON.stringify(commonWrongAnswers),
        examId,
        questionId
      ]
    );

  } catch (error) {
    console.error('更新题目分析失败:', error);
  }
};

// 提交答案
const submitAnswer = async (req, res) => {
  try {
    const { recordId } = req.params;
    const { questionId, answer, answerTime } = req.body; // answerTime: 答题用时（秒）
    const userId = req.userId;

    console.log('提交答案API被调用:', { recordId, questionId, answerLength: answer?.length, answerPreview: answer?.substring(0, 50), userId });

    // 验证考试记录
    const [records] = await mysqlPool.execute(
      `SELECT er.*, e.end_time, e.show_result_immediately 
       FROM online_exam_records er
       JOIN online_exams e ON er.exam_id = e.id
       WHERE er.id = ? AND er.user_id = ?`,
      [recordId, userId]
    );

    if (records.length === 0) {
      console.log('考试记录不存在:', { recordId, userId });
      return res.status(404).json(errorResponse('考试记录不存在'));
    }

    const record = records[0];
    const now = new Date();
    const endTime = new Date(record.end_time);

    if (now > endTime) {
      console.log('考试已结束:', { recordId, endTime });
      return res.status(400).json(errorResponse('考试已结束，无法提交答案'));
    }

    // 获取题目信息和正确答案
    const [questions] = await mysqlPool.execute(
      `SELECT eq.*, q.answer as correct_answer, q.exercise_type, q.exercise_type_name
       FROM online_exam_questions eq
       LEFT JOIN computer1_question q ON eq.question_id = q.question_id
       WHERE eq.exam_id = ? AND eq.question_id = ?`,
      [record.exam_id, questionId]
    );

    if (questions.length === 0) {
      console.log('题目不存在:', { exam_id: record.exam_id, questionId });
      return res.status(404).json(errorResponse('题目不存在'));
    }

    const question = questions[0];
    console.log('题目信息:', { 
      question_id: questionId, 
      exercise_type: question.exercise_type, 
      exercise_type_name: question.exercise_type_name,
      answer_length: answer?.length 
    });
    
    // 自动评分（客观题）
    // exercise_type: 1=单选题, 2=多选题, 3=判断题, 4=解答题
    let isCorrect = null;
    let score = 0;
    
    // 判断是否为客观题（可以自动评分）
    const isObjective = question.exercise_type === 1 || question.exercise_type === 2 || question.exercise_type === 3 ||
        question.exercise_type === '选择题' || question.exercise_type === '判断题' ||
        question.exercise_type_name === '单选题' || question.exercise_type_name === '多选题' || question.exercise_type_name === '判断题';
    
    if (isObjective) {
      isCorrect = answer === question.correct_answer ? 1 : 0;
      score = isCorrect ? question.score : 0;
      console.log('客观题自动评分:', { isCorrect, score });
    } else {
      console.log('主观题（解答题），暂不评分，等待批改');
    }

    const connection = await mysqlPool.getConnection();
    await connection.beginTransaction();

    try {
      console.log('准备保存答案到数据库:', { 
        recordId, 
        exam_id: record.exam_id, 
        userId, 
        questionId, 
        answer_length: answer?.length,
        is_correct: isCorrect,
        score 
      });
      
      // 保存或更新答案
      const [answerResult] = await connection.execute(
        `INSERT INTO online_exam_answers 
         (record_id, exam_id, user_id, question_id, user_answer, is_correct, score)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         user_answer = VALUES(user_answer),
         is_correct = VALUES(is_correct),
         score = VALUES(score)`,
        [recordId, record.exam_id, userId, questionId, answer, isCorrect, score]
      );
      
      console.log('答案保存结果:', { 
        insertId: answerResult.insertId, 
        affectedRows: answerResult.affectedRows 
      });

      // 保存用户每题作答详情
      const [analysisResult] = await connection.execute(
        `INSERT INTO online_exam_user_question_analysis 
         (record_id, exam_id, user_id, question_id, user_answer, is_correct, score, answer_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         user_answer = VALUES(user_answer),
         is_correct = VALUES(is_correct),
         score = VALUES(score),
         answer_time = VALUES(answer_time)`,
        [recordId, record.exam_id, userId, questionId, answer, isCorrect, score, answerTime || 0]
      );
      
      console.log('作答详情保存结果:', { 
        insertId: analysisResult.insertId, 
        affectedRows: analysisResult.affectedRows 
      });

      // 更新题目分析统计
      await updateQuestionAnalysis(connection, record.exam_id, questionId);

      await connection.commit();
      
      console.log('答案提交成功:', { questionId, isCorrect, score });

      res.json(successResponse({
        isCorrect,
        score: record.show_result_immediately ? score : null
      }));

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('提交答案失败:', error);
    res.status(500).json(errorResponse('提交答案失败: ' + error.message));
  }
};

// 提交考试
const submitExam = async (req, res) => {
  try {
    const { recordId } = req.params;
    const userId = req.userId;

    const connection = await mysqlPool.getConnection();
    await connection.beginTransaction();

    try {
      // 获取考试记录
      const [records] = await connection.execute(
        `SELECT er.*, e.end_time, e.pass_score, e.show_result_immediately
         FROM online_exam_records er
         JOIN online_exams e ON er.exam_id = e.id
         WHERE er.id = ? AND er.user_id = ?`,
        [recordId, userId]
      );

      if (records.length === 0) {
        return res.status(404).json(errorResponse('考试记录不存在'));
      }

      const record = records[0];

      if (record.status === 1) {
        return res.status(400).json(errorResponse('考试已提交'));
      }

      // 计算成绩
      const [answers] = await connection.execute(
        `SELECT 
          SUM(CASE WHEN is_correct IS NOT NULL THEN score ELSE 0 END) as objective_score,
          SUM(score) as total_score,
          COUNT(CASE WHEN is_correct IS NULL THEN 1 END) as ungraded_count
        FROM online_exam_answers
        WHERE record_id = ?`,
        [recordId]
      );

      const result = answers[0];
      const isPassed = result.total_score >= record.pass_score ? 1 : 0;
      const isGraded = result.ungraded_count === 0 ? 1 : 0;

      // 计算用时
      const startTime = new Date(record.start_time);
      const endTime = new Date();
      const duration = Math.floor((endTime - startTime) / 1000);

      // 更新考试记录
      await connection.execute(
        `UPDATE online_exam_records 
         SET status = 1,
             submit_time = NOW(),
             duration = ?,
             objective_score = ?,
             total_score = ?,
             is_passed = ?,
             is_graded = ?
         WHERE id = ?`,
        [duration, result.objective_score || 0, result.total_score || 0, isPassed, isGraded, recordId]
      );

      await connection.commit();

      res.json(successResponse({
        totalScore: result.total_score,
        objectiveScore: result.objective_score,
        isPassed,
        duration,
        showResult: record.show_result_immediately,
        hasUngradedQuestions: result.ungraded_count > 0
      }, '考试提交成功'));

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('提交考试失败:', error);
    res.status(500).json(errorResponse('提交考试失败: ' + error.message));
  }
};

// 获取考试结果
const getExamResult = async (req, res) => {
  try {
    const { recordId } = req.params;
    const userId = req.userId;

    // 获取考试记录
    const [records] = await mysqlPool.execute(
      `SELECT er.*, e.title, e.allow_review, e.show_result_immediately, e.paper_type, e.source_paper_name, e.pass_score, e.total_score as exam_total_score
       FROM online_exam_records er
       JOIN online_exams e ON er.exam_id = e.id
       WHERE er.id = ? AND er.user_id = ?`,
      [recordId, userId]
    );

    if (records.length === 0) {
      return res.status(404).json(errorResponse('考试记录不存在'));
    }

    const record = records[0];

    if (record.status !== 1) {
      return res.status(400).json({
        code: 1,
        message: '考试尚未完成',
        data: { exam_id: record.exam_id }
      });
    }

    // 获取所有考试题目（包括未作答的）
    const [allQuestions] = await mysqlPool.execute(
      `SELECT 
        eq.question_id,
        eq.score as question_score,
        eq.question_type,
        eq.sort_order,
        q.stem,
        q.answer as correct_answer,
        q.analysis,
        q.exercise_type,
        q.exercise_type_name
      FROM online_exam_questions eq
      LEFT JOIN computer1_question q ON eq.question_id = q.question_id
      WHERE eq.exam_id = ?
      ORDER BY eq.sort_order`,
      [record.exam_id]
    );

    // 获取用户答案
    const [userAnswers] = await mysqlPool.execute(
      `SELECT 
        ea.*,
        uqa.answer_time
      FROM online_exam_answers ea
      LEFT JOIN online_exam_user_question_analysis uqa ON ea.record_id = uqa.record_id AND ea.question_id = uqa.question_id
      WHERE ea.record_id = ?`,
      [recordId]
    );

    // 构建答案列表（包含所有题目）
    const answers = allQuestions.map(q => {
      const userAnswer = userAnswers.find(ua => ua.question_id === q.question_id);
      return {
        ...q,
        record_id: recordId,
        exam_id: record.exam_id,
        user_id: record.user_id,
        user_answer: userAnswer ? userAnswer.user_answer : null,
        is_correct: userAnswer ? userAnswer.is_correct : null,
        score: userAnswer ? userAnswer.score : 0,
        answer_time: userAnswer ? userAnswer.answer_time : 0
      };
    });

    // 获取每个题目的选项和小题
    for (const answer of answers) {
      const [options] = await mysqlPool.execute(
        'SELECT option_key, option_value FROM computer1_question_option WHERE question_id = ? ORDER BY option_sort ASC',
        [answer.question_id]
      );
      const optionsObj = {};
      options.forEach(opt => {
        optionsObj[opt.option_key] = opt.option_value;
      });
      answer.options = JSON.stringify(optionsObj);

      // 获取小题（解答题）
      const [subs] = await mysqlPool.execute(
        'SELECT * FROM computer1_question_sub WHERE question_id = ? ORDER BY question_order ASC',
        [answer.question_id]
      );
      answer.subs = subs;
    }

    // 获取每题的全局分析数据
    const [questionAnalysis] = await mysqlPool.execute(
      `SELECT 
        qa.*,
        q.stem,
        q.answer as correct_answer
      FROM online_exam_question_analysis qa
      LEFT JOIN computer1_question q ON qa.question_id = q.question_id
      WHERE qa.exam_id = ?
      ORDER BY qa.sort_order`,
      [record.exam_id]
    );

    // 获取排名
    const [rankResult] = await mysqlPool.execute(
      `SELECT COUNT(*) + 1 as \`rank\`
       FROM online_exam_records
       WHERE exam_id = ? AND status = 1 AND total_score > ?`,
      [record.exam_id, record.total_score]
    );

    // 计算各题型得分统计
    const questionTypeStats = {};
    answers.forEach(a => {
      const type = a.exercise_type_name || a.exercise_type || '其他';
      if (!questionTypeStats[type]) {
        questionTypeStats[type] = { total: 0, correct: 0, score: 0, fullScore: 0 };
      }
      questionTypeStats[type].total++;
      questionTypeStats[type].score += parseFloat(a.score || 0);
      questionTypeStats[type].fullScore += parseFloat(a.question_score || 0);
      if (a.is_correct === 1) {
        questionTypeStats[type].correct++;
      }
    });

    console.log('返回考试结果:', {
      recordId,
      allow_review: record.allow_review,
      answersCount: answers.length,
      firstAnswer: answers[0],
      questionAnalysisCount: questionAnalysis.length
    });

    res.json(successResponse({
      record: {
        ...record,
        rank: rankResult[0].rank
      },
      questionTypeStats,
      answers: record.allow_review ? answers : answers.map(a => ({
        ...a,
        correct_answer: undefined,
        analysis: undefined
      })),
      questionAnalysis: record.allow_review ? questionAnalysis : null
    }));

  } catch (error) {
    console.error('获取考试结果失败:', error);
    res.status(500).json(errorResponse('获取考试结果失败: ' + error.message));
  }
};

// 解析tag_name（如果tag_name是纯数字ID，则使用chapter_name）
const resolveTagName = async (tagName, chapterName) => {
  // 如果没有tagName，返回章节名称
  if (!tagName) {
    return chapterName || null;
  }
  
  // 如果tagName不是纯数字，直接返回
  if (!/^\d+$/.test(tagName)) {
    return tagName;
  }
  
  // tagName是纯数字ID，在本系统中查不到对应名称，使用章节名称
  return chapterName || null;
};

// 获取每题作答分析（管理员）
const getQuestionAnalysis = async (req, res) => {
  try {
    const { examId } = req.params;
    const { questionId } = req.query;

    let sql = `
      SELECT 
        qa.*,
        q.stem,
        q.answer as correct_answer,
        q.analysis,
        q.exercise_type,
        q.exercise_type_name
      FROM online_exam_question_analysis qa
      LEFT JOIN computer1_question q ON qa.question_id = q.question_id
      WHERE qa.exam_id = ?
    `;
    const params = [examId];

    if (questionId) {
      sql += ' AND qa.question_id = ?';
      params.push(questionId);
    }

    sql += ' ORDER BY qa.sort_order';

    const [analysis] = await mysqlPool.execute(sql, params);

    // 获取每个题目的选项、考点和章节信息
    for (const item of analysis) {
      const [options] = await mysqlPool.execute(
        'SELECT option_key, option_value FROM computer1_question_option WHERE question_id = ? ORDER BY option_sort ASC',
        [item.question_id]
      );
      const optionsObj = {};
      options.forEach(opt => {
        optionsObj[opt.option_key] = opt.option_value;
      });
      item.options = JSON.stringify(optionsObj);

      // 获取考点和章节信息
      const [knowledgePoints] = await mysqlPool.execute(
        `SELECT kt.tag_id, kt.tag_name, kt.chapter_id, c.chapter_name
         FROM computer1_question_tag_relation qtr
         LEFT JOIN computer1_knowledge_tag kt ON qtr.tag_id = kt.tag_id
         LEFT JOIN computer1_chapter c ON kt.chapter_id = c.chapter_id
         WHERE qtr.question_id = ?`,
        [item.question_id]
      );
      
      // 处理考点名称（递归查询真正的tag_name）
      const processedKPs = [];
      for (const kp of knowledgePoints) {
        let name = await resolveTagName(kp.tag_name, kp.chapter_name);
        if (name) {
          processedKPs.push(name);
        }
      }
      
      // 去重
      item.knowledge_points = [...new Set(processedKPs)];
      
      // 保存章节信息
      if (knowledgePoints.length > 0 && knowledgePoints[0].chapter_id) {
        item.chapter_id = knowledgePoints[0].chapter_id;
        item.chapter_name = knowledgePoints[0].chapter_name;
      }
      
      // 获取解答题的小题
      if (parseInt(item.exercise_type) === 4) {
        const [subQuestions] = await mysqlPool.execute(
          'SELECT * FROM computer1_question_sub WHERE question_id = ? ORDER BY question_order ASC',
          [item.question_id]
        );
        item.subs = subQuestions;
      } else {
        item.subs = [];
      }
    }

    // 确保返回的数据是可序列化的普通对象
    // 找到第一个解答题来检查
    const subjectiveQuestion = analysis.find(item => parseInt(item.exercise_type) === 4);
    console.log('sanitizedAnalysis之前，解答题数据:', subjectiveQuestion ? {
      question_id: subjectiveQuestion.question_id,
      exercise_type: subjectiveQuestion.exercise_type,
      subs: subjectiveQuestion.subs,
      subs_length: subjectiveQuestion.subs ? subjectiveQuestion.subs.length : 0
    } : '没有找到解答题');
    
    console.log('sanitizedAnalysis之前，analysis[0].subs:', analysis[0] ? {
      question_id: analysis[0].question_id,
      exercise_type: analysis[0].exercise_type,
      subs: analysis[0].subs,
      subs_length: analysis[0].subs ? analysis[0].subs.length : 0
    } : '无数据');
    
    const sanitizedAnalysis = analysis.map(item => JSON.parse(JSON.stringify(item)));

    console.log('getQuestionAnalysis 返回数据示例:', sanitizedAnalysis.length > 0 ? {
      question_id: sanitizedAnalysis[0].question_id,
      exercise_type: sanitizedAnalysis[0].exercise_type,
      exercise_type_name: sanitizedAnalysis[0].exercise_type_name,
      knowledge_points: sanitizedAnalysis[0].knowledge_points,
      sort_order: sanitizedAnalysis[0].sort_order,
      subs: sanitizedAnalysis[0].subs,
      subs_length: sanitizedAnalysis[0].subs ? sanitizedAnalysis[0].subs.length : 0
    } : '无数据');

    res.json(successResponse(sanitizedAnalysis));

  } catch (error) {
    console.error('获取题目分析失败:', error);
    res.status(500).json(errorResponse('获取题目分析失败: ' + error.message));
  }
};

// 获取用户每题作答详情
const getUserQuestionAnalysis = async (req, res) => {
  try {
    const { recordId } = req.params;
    const userId = req.userId;

    // 验证记录归属
    const [records] = await mysqlPool.execute(
      'SELECT * FROM online_exam_records WHERE id = ? AND user_id = ?',
      [recordId, userId]
    );

    if (records.length === 0) {
      return res.status(404).json(errorResponse('考试记录不存在'));
    }

    const [analysis] = await mysqlPool.execute(
      `SELECT 
        uqa.id,
        uqa.record_id,
        uqa.exam_id,
        uqa.question_id,
        uqa.user_answer,
        uqa.is_correct,
        uqa.score,
        uqa.answer_time,
        qa.correct_rate,
        qa.average_score,
        qa.option_distribution,
        q.stem,
        q.answer as correct_answer,
        q.analysis
      FROM online_exam_user_question_analysis uqa
      LEFT JOIN online_exam_question_analysis qa ON uqa.exam_id = qa.exam_id AND uqa.question_id = qa.question_id
      LEFT JOIN computer1_question q ON uqa.question_id = q.question_id
      WHERE uqa.record_id = ?
      ORDER BY qa.sort_order`,
      [recordId]
    );

    // 获取每个题目的选项
    for (const item of analysis) {
      const [options] = await mysqlPool.execute(
        'SELECT option_key, option_value FROM computer1_question_option WHERE question_id = ? ORDER BY option_sort ASC',
        [item.question_id]
      );
      item.options = options;
    }

    res.json(successResponse(analysis));

  } catch (error) {
    console.error('获取用户题目分析失败:', error);
    res.status(500).json(errorResponse('获取用户题目分析失败: ' + error.message));
  }
};

// 获取考试排名
const getExamRankings = async (req, res) => {
  try {
    const { examId } = req.params;
    const { page = 1, pageSize = 50 } = req.query;
    const offset = (page - 1) * pageSize;

    // 获取排名列表
    const [rankings] = await mysqlPool.query(
      `SELECT 
        er.id,
        er.user_id,
        er.total_score,
        er.duration,
        er.submit_time,
        u.username,
        u.avatar
      FROM online_exam_records er
      LEFT JOIN users u ON er.user_id = u.id
      WHERE er.exam_id = ? AND er.status = 1
      ORDER BY er.total_score DESC, er.duration ASC
      LIMIT ? OFFSET ?`,
      [examId, parseInt(pageSize), parseInt(offset)]
    );

    // 计算排名
    const startRank = (parseInt(page) - 1) * parseInt(pageSize) + 1;
    rankings.forEach((item, index) => {
      item.rank = startRank + index;
    });

    // 获取总数
    const [countResult] = await mysqlPool.execute(
      'SELECT COUNT(*) as total FROM online_exam_records WHERE exam_id = ? AND status = 1',
      [examId]
    );

    res.json(successResponse({
      list: rankings,
      total: countResult[0].total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }));

  } catch (error) {
    console.error('获取排名失败:', error);
    res.status(500).json(errorResponse('获取排名失败: ' + error.message));
  }
};

// 获取用户考试统计
const getUserExamStats = async (req, res) => {
  try {
    const userId = req.userId;

    // 获取用户参与的考试数量和及格次数
    const [participatedResult] = await mysqlPool.execute(
      'SELECT COUNT(*) as count FROM online_exam_records WHERE user_id = ? AND status IN (1, 2)',
      [userId]
    );

    const [passedResult] = await mysqlPool.execute(
      'SELECT COUNT(*) as count FROM online_exam_records WHERE user_id = ? AND is_passed = 1',
      [userId]
    );

    // 获取平均分
    const [avgScoreResult] = await mysqlPool.execute(
      'SELECT AVG(total_score) as avg_score FROM online_exam_records WHERE user_id = ? AND status IN (1, 2)',
      [userId]
    );

    // 获取最佳排名
    const [bestRankResult] = await mysqlPool.execute(
      `SELECT MIN(oer.user_rank) as best_rank 
       FROM online_exam_rankings oer
       WHERE oer.user_id = ?`,
      [userId]
    );

    res.json(successResponse({
      participatedCount: participatedResult[0].count || 0,
      passedCount: passedResult[0].count || 0,
      averageScore: Math.round(avgScoreResult[0].avg_score || 0),
      bestRank: bestRankResult[0].best_rank || null
    }));

  } catch (error) {
    console.error('获取用户考试统计失败:', error);
    res.status(500).json(errorResponse('获取用户考试统计失败: ' + error.message));
  }
};

module.exports = {
  // 管理员接口
  createExam,
  updateExam,
  deleteExam,
  getExamList,
  getExamDetail,
  getExamQuestions, // 获取考试题目列表
  getExamRecords, // 获取考试记录列表
  getPendingSubjectiveQuestions, // 获取待批改解答题列表
  getAllSubjectiveAnswers, // 获取所有解答题答案（调试）
  gradeSubjectiveQuestion,
  getExamStatistics,
  getQuestionAnalysis, // 获取每题作答分析
  
  // 用户接口
  getAvailableExams,
  startExam,
  submitAnswer,
  submitExam,
  getExamResult,
  getExamRankings,
  getUserQuestionAnalysis, // 获取用户每题作答详情
  getUserExamStats // 获取用户考试统计
};
