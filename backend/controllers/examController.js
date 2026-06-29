const Question = require('../models/Question');
const Exam = require('../models/Exam');
const AnswerRecord = require('../models/AnswerRecord');
const ExamQuestion = require('../models/ExamQuestion');
const WrongQuestion = require('../models/WrongQuestion');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/response');

const getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json(errorResponse('题目ID不能为空'));
    }
    
    const question = await Question.findById(id);
    
    if (!question) {
      return res.status(404).json(errorResponse('题目不存在'));
    }
    
    res.json(successResponse(question));
  } catch (error) {
    console.error('获取题目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getQuestions = async (req, res) => {
  try {
    const { subjectId, chapterId, type, difficulty, page = 1, size = 20 } = req.query;
    const query = { isActive: 1 };
    
    if (subjectId) {
      query.subjectId = subjectId;
    }
    if (chapterId) {
      query.chapterId = chapterId;
    }
    
    if (type !== undefined && type !== '') {
      const typeArray = type.split(',').map(t => {
        const typeMap = { 'single': 0, 'multiple': 1, 'judge': 2, 'essay': 3 };
        const trimmed = t.trim();
        return typeMap[trimmed] !== undefined ? typeMap[trimmed] : parseInt(trimmed);
      }).filter(t => !isNaN(t));
      
      if (typeArray.length > 0) {
        query.type = { $in: typeArray };
      }
    }
    
    if (difficulty !== undefined && difficulty !== '') {
      const difficultyArray = difficulty.split(',').map(d => {
        const difficultyMap = { 'easy': 1, 'medium': 2, 'hard': 3 };
        const trimmed = d.trim();
        return difficultyMap[trimmed] !== undefined ? difficultyMap[trimmed] : parseInt(trimmed);
      }).filter(d => !isNaN(d));
      
      if (difficultyArray.length > 0) {
        query.difficulty = { $in: difficultyArray };
      }
    }
    
    const skip = (page - 1) * size;
    query.skip = skip;
    query.limit = parseInt(size);

    const questions = await Question.find(query);
    const total = await Question.countDocuments(query);
    
    res.json(successResponse({ list: questions, total }));
  } catch (error) {
    console.error('获取题目失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const submitPractice = async (req, res) => {
  try {
    const { subjectId, questions } = req.body;
    const userId = req.userId;
    
    let correctCount = 0;
    let wrongCount = 0;
    const wrongQuestions = [];
    
    const answerRecords = [];
    for (const q of questions) {
      const question = await Question.findById(q.questionId);
      const isCorrect = q.userAnswer === question.answer;
      
      answerRecords.push({
        questionId: q.questionId,
        userAnswer: q.userAnswer,
        isCorrect: isCorrect ? 1 : 0,
      });
      
      if (isCorrect) {
        correctCount++;
      } else {
        wrongCount++;
        wrongQuestions.push(q.questionId);
        
        // 添加到错题本
        const existingWrong = await WrongQuestion.findOne({ userId, questionId: q.questionId });
        if (!existingWrong) {
          await WrongQuestion.create({
            userId,
            questionId: q.questionId,
            subjectId: subjectId || (question.subjectId ? (question.subjectId._id || question.subjectId) : null),
            chapterId: question.chapterId ? (question.chapterId._id || question.chapterId) : null,
            userAnswer: q.userAnswer,
          });
        }
      }
    }
    
    const score = Math.round((correctCount / questions.length) * 100);
    
    await AnswerRecord.create({
      userId,
      subjectId,
      score,
      totalQuestions: questions.length,
      correctQuestions: correctCount,
      answers: answerRecords,
    });
    
    // Update user total questions and stats
    const user = await User.findById(userId);
    if (user) {
      await User.updateById(userId, { 
        totalQuestions: (user.totalQuestions || 0) + questions.length,
        total_questions: (user.total_questions || 0) + questions.length,
        total_correct: (user.total_correct || 0) + correctCount,
        last_study_time: new Date()
      });
    }
    
    res.json(successResponse({ score, correctCount, wrongCount, wrongQuestions }));
  } catch (error) {
    console.error('提交练习失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const submitExam = async (req, res) => {
  try {
    const { examId, questions } = req.body;
    const userId = req.userId;
    
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json(errorResponse('试卷不存在'));
    }
    
    let correctCount = 0;
    let wrongCount = 0;
    const wrongQuestions = [];
    
    const answerRecords = [];
    for (const q of questions) {
      const question = await Question.findById(q.questionId);
      const isCorrect = q.userAnswer === question.answer;
      
      answerRecords.push({
        questionId: q.questionId,
        userAnswer: q.userAnswer,
        isCorrect: isCorrect ? 1 : 0,
      });
      
      if (isCorrect) {
        correctCount++;
      } else {
        wrongCount++;
        wrongQuestions.push(q.questionId);
        
        // 添加到错题本
        const existingWrong = await WrongQuestion.findOne({ userId, questionId: q.questionId });
        if (!existingWrong) {
          await WrongQuestion.create({
            userId,
            questionId: q.questionId,
            examId,
            subjectId: question.subjectId ? (question.subjectId._id || question.subjectId) : null,
            chapterId: question.chapterId ? (question.chapterId._id || question.chapterId) : null,
            userAnswer: q.userAnswer,
          });
        }
      }
    }
    
    const score = Math.round((correctCount / questions.length) * 100);
    
    await AnswerRecord.create({
      userId,
      examId,
      subjectId: exam.subjectId,
      score,
      totalQuestions: questions.length,
      correctQuestions: correctCount,
      answers: answerRecords,
    });
    
    // Update exam participant count
    await Exam.updateById(examId, { participantCount: (exam.participantCount || 0) + 1 });
    
    // Update user stats
    const user = await User.findById(userId);
    if (user) {
      await User.updateById(userId, { 
        totalQuestions: (user.totalQuestions || 0) + questions.length,
        total_questions: (user.total_questions || 0) + questions.length,
        total_correct: (user.total_correct || 0) + correctCount,
        last_study_time: new Date()
      });
    }
    
    const rank = await AnswerRecord.countDocuments({
      examId,
      mode: 1,
    });
    
    res.json(successResponse({ score, rank, correctCount, wrongCount, wrongQuestions }));
  } catch (error) {
    console.error('提交考试失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getExamResult = async (req, res) => {
  try {
    const { examId } = req.query;
    const userId = req.userId;
    
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json(errorResponse('试卷不存在'));
    }
    
    const records = await AnswerRecord.find({
      userId,
      examId,
      mode: 1,
    });
    
    // In MySQL version, we might need to manually populate or handle question details
    // For now, let's assume we need to fetch question details for each record
    const questions = [];
    let correctCount = 0;
    
    for (const r of records) {
      const question = await Question.findById(r.questionId);
      if (question) {
        if (r.isCorrect) correctCount++;
        questions.push({
          questionId: question.id,
          content: question.content,
          userAnswer: r.userAnswer,
          correctAnswer: question.answer,
          isCorrect: !!r.isCorrect,
          score: r.isCorrect ? 100 / records.length : 0,
        });
      }
    }
    
    const score = records.length > 0 ? Math.round((correctCount / records.length) * 100) : 0;
    
    res.json(successResponse({
      examId: exam.id,
      title: exam.title,
      score,
      rank: 1,
      correctRate: records.length > 0 ? correctCount / records.length : 0,
      questions,
    }));
  } catch (error) {
    console.error('获取考试结果失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

module.exports = {
  getQuestionById,
  getQuestions,
  submitPractice,
  submitExam,
  getExamResult,
};
