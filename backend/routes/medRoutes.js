
const express = require('express');
const router = express.Router();
const medController = require('../controllers/medController');
const { auth, adminAuth } = require('../middleware/auth');

// 公开接口
router.get('/courses', medController.getCourses);
router.get('/chapters', medController.getChapters);
router.get('/years', medController.getYears);
router.get('/questions', medController.getQuestions);

// 需要登录的接口
router.post('/submit-answer', auth, medController.submitAnswer);
router.post('/toggle-favorite', auth, medController.toggleFavorite);
router.post('/update-progress', auth, medController.updateProgress);

// 纠错与反馈
router.post('/feedback', auth, medController.submitQuestionFeedback);
router.get('/feedbacks', adminAuth, medController.getFeedbacks);
router.put('/feedbacks/:id', adminAuth, medController.updateFeedbackStatus);

// 题目管理接口
router.get('/admin/questions', adminAuth, medController.adminSearchQuestions);
router.get('/questions/:questionId', adminAuth, medController.getQuestionDetail);
router.put('/questions/:questionId', adminAuth, medController.updateQuestion);
router.delete('/questions/:questionId', adminAuth, medController.deleteQuestion);

// 科目与章节管理接口
router.get('/admin/courses', adminAuth, medController.adminGetCourses);
router.post('/admin/courses', adminAuth, medController.addCourse);
router.put('/admin/courses/:courseId', adminAuth, medController.updateCourse);
router.get('/admin/chapters', adminAuth, medController.adminGetChapters);
router.post('/admin/chapters', adminAuth, medController.addChapter);
router.put('/admin/chapters/:chapterId', adminAuth, medController.updateChapter);

// 笔记相关
router.get('/notes', medController.getNotes);
router.get('/notes/replies', medController.getReplies);
router.post('/notes', auth, medController.addNote);
router.put('/notes', auth, medController.updateNote);
router.delete('/notes', auth, medController.deleteNote);
router.post('/notes/toggle-like', auth, medController.toggleNoteLike);

module.exports = router;
