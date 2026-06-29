const express = require('express');
const router = express.Router();
const onlineExamController = require('../controllers/onlineExamController');
const { auth, adminAuth } = require('../middleware/auth');

// ==================== 管理员接口 ====================

// 创建考试
router.post('/admin/exams', adminAuth, onlineExamController.createExam);

// 更新考试
router.put('/admin/exams/:examId', adminAuth, onlineExamController.updateExam);

// 删除考试
router.delete('/admin/exams/:examId', adminAuth, onlineExamController.deleteExam);

// 获取考试列表（管理员）
router.get('/admin/exams', adminAuth, onlineExamController.getExamList);

// 获取考试详情（管理员）
router.get('/admin/exams/:examId', adminAuth, onlineExamController.getExamDetail);

// 获取考试题目列表（管理员）
router.get('/admin/exams/:examId/questions', adminAuth, onlineExamController.getExamQuestions);

// 主观题评分
router.post('/admin/records/:recordId/questions/:questionId/grade', adminAuth, onlineExamController.gradeSubjectiveQuestion);

// 获取考试统计数据
router.get('/admin/exams/:examId/statistics', adminAuth, onlineExamController.getExamStatistics);

// 获取考试记录列表（管理员）
router.get('/admin/exams/:examId/records', adminAuth, onlineExamController.getExamRecords);

// 获取待批改解答题列表（管理员）
router.get('/admin/exams/:examId/pending-subjective', adminAuth, onlineExamController.getPendingSubjectiveQuestions);

// 获取所有解答题答案（用于调试）
router.get('/admin/exams/:examId/all-subjective-answers', adminAuth, onlineExamController.getAllSubjectiveAnswers);

// 获取每题作答分析（管理员）
router.get('/admin/exams/:examId/question-analysis', adminAuth, onlineExamController.getQuestionAnalysis);

// ==================== 用户接口 ====================

// 获取用户考试统计
router.get('/user/stats', auth, onlineExamController.getUserExamStats);

// 获取可参加的考试列表
router.get('/exams/available', auth, onlineExamController.getAvailableExams);

// 开始考试
router.post('/exams/:examId/start', auth, onlineExamController.startExam);

// 提交答案
router.post('/records/:recordId/answers', auth, onlineExamController.submitAnswer);

// 提交考试
router.post('/records/:recordId/submit', auth, onlineExamController.submitExam);

// 获取考试结果
router.get('/records/:recordId/result', auth, onlineExamController.getExamResult);

// 获取用户每题作答详情
router.get('/records/:recordId/question-analysis', auth, onlineExamController.getUserQuestionAnalysis);

// 获取考试排名
router.get('/exams/:examId/rankings', auth, onlineExamController.getExamRankings);

module.exports = router;
