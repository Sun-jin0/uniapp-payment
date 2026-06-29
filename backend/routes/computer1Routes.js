const express = require('express');
const router = express.Router();
const computer1Controller = require('../controllers/computer1Controller');
const { auth, adminAuth } = require('../middleware/auth');

// 基础数据
router.get('/computer1/subjects', computer1Controller.getSubjects);
router.get('/computer1/chapters', auth, computer1Controller.getChapters);
router.get('/computer1/chapters/:chapterId', auth, computer1Controller.getChapterById);
router.get('/computer1/tags', auth, computer1Controller.getKnowledgeTags);
router.get('/computer1/questions', computer1Controller.getQuestions);
router.get('/computer1/questions/batch-details', computer1Controller.getBatchQuestionDetails);
router.post('/computer1/questions/batch-details', computer1Controller.getBatchQuestionDetailsFull);
router.post('/computer1/questions/batch', computer1Controller.getQuestionsBatch);
router.get('/computer1/questions/:questionId', computer1Controller.getQuestionDetails);
router.get('/computer1/exams', computer1Controller.getExams);

// 收藏相关
router.post('/computer1/favorites/toggle', auth, computer1Controller.toggleFavorite);
router.get('/computer1/favorites', auth, computer1Controller.getFavorites);
router.get('/computer1/favorites/check', auth, computer1Controller.checkFavorite);

// 收藏分类
router.get('/computer1/favorite-categories', auth, computer1Controller.getFavoriteCategories);
router.post('/computer1/favorite-categories', auth, computer1Controller.createFavoriteCategory);
router.delete('/computer1/favorite-categories/:categoryId', auth, computer1Controller.deleteFavoriteCategory);

// 进度相关
router.post('/computer1/progress', auth, computer1Controller.updateProgress);
router.get('/computer1/progress', auth, computer1Controller.getUserProgress);
router.get('/computer1/progress/list', auth, computer1Controller.getProgressList);
router.post('/computer1/progress/reset', auth, computer1Controller.resetProgress);

// 智能组卷相关
router.post('/computer1/smart-papers', auth, computer1Controller.generateSmartPaper);
router.get('/computer1/smart-papers', auth, computer1Controller.getUserGeneratedPapers);
router.get('/computer1/smart-papers/:paperId', auth, computer1Controller.getGeneratedPaper);
router.get('/computer1/smart-papers/:paperId/print', computer1Controller.getPrintPaper);
router.put('/computer1/smart-papers/:paperId/title', auth, computer1Controller.updatePaperTitle);
router.delete('/computer1/smart-papers/:paperId', auth, computer1Controller.deleteGeneratedPaper);
router.post('/computer1/smart-papers/:paperId/replace-question', auth, computer1Controller.replacePaperQuestion);

// 导入
router.post('/computer1/import', auth, computer1Controller.importQuestions);
router.post('/computer1/import-paper', auth, computer1Controller.importPaper);

// 纠错与反馈
router.post('/computer1/corrections', auth, computer1Controller.submitCorrection);
router.post('/computer1/feedback', auth, computer1Controller.submitQuestionFeedback);
router.get('/computer1/feedbacks', adminAuth, computer1Controller.getFeedbacks);
router.put('/computer1/feedbacks/:id', adminAuth, computer1Controller.updateFeedbackStatus);

// 错题本相关
router.post('/computer1/wrong-book/toggle', auth, computer1Controller.toggleWrongBook);
router.get('/computer1/wrong-book/check', auth, computer1Controller.checkWrongBook);
router.get('/computer1/wrong-book', auth, computer1Controller.getWrongBook);
router.post('/computer1/wrong-book', auth, computer1Controller.addToWrongBook);
router.post('/computer1/wrong-book/remove', auth, computer1Controller.removeFromWrongBook);
router.post('/computer1/wrong-book/clear', auth, computer1Controller.clearWrongBook);
router.get('/computer1/wrong-book/stats', adminAuth, computer1Controller.getWrongBookStats);
router.post('/computer1/wrong-book/update-status', auth, computer1Controller.updateWrongBookStatus);

// 笔记相关
router.get('/computer1/notes', auth, computer1Controller.getNotes);
router.get('/computer1/notes/replies', auth, computer1Controller.getNoteReplies);
router.post('/computer1/notes', auth, computer1Controller.addNote);
router.post('/computer1/notes/toggle-like', auth, computer1Controller.toggleNoteLike);

// 模拟测试相关
router.get('/computer1/test/generate', auth, computer1Controller.generateTest);
router.post('/computer1/test/report', auth, computer1Controller.reportTestScore);

// 管理员科目管理
router.post('/computer1/admin/subjects', adminAuth, computer1Controller.createSubject);
router.put('/computer1/admin/subjects/:subjectId', adminAuth, computer1Controller.updateSubject);
router.delete('/computer1/admin/subjects/:subjectId', adminAuth, computer1Controller.deleteSubject);

// 管理员章节管理
router.post('/computer1/admin/chapters', adminAuth, computer1Controller.createChapter);
router.put('/computer1/admin/chapters/:chapterId', adminAuth, computer1Controller.updateChapter);
router.delete('/computer1/admin/chapters/:chapterId', adminAuth, computer1Controller.deleteChapter);

// 章节题集管理
router.get('/computer1/admin/chapters/:chapterId/question-set', adminAuth, computer1Controller.getChapterQuestionSet);
router.post('/computer1/admin/chapters/:chapterId/question-set', adminAuth, computer1Controller.addQuestionsToChapterSet);
router.delete('/computer1/admin/chapters/:chapterId/question-set/:questionId', adminAuth, computer1Controller.removeQuestionFromChapterSet);
router.put('/computer1/admin/question-set/:setId/sort', adminAuth, computer1Controller.updateChapterQuestionSetSort);

// 管理员题目管理
router.get('/computer1/admin/questions', adminAuth, computer1Controller.adminSearchQuestions);
router.post('/computer1/admin/questions', adminAuth, computer1Controller.adminCreateQuestion);
router.put('/computer1/admin/questions/:questionId', adminAuth, computer1Controller.adminUpdateQuestion);
router.delete('/computer1/admin/questions/:questionId', adminAuth, computer1Controller.adminDeleteQuestion);
router.post('/computer1/admin/batch-add-tags', adminAuth, computer1Controller.adminBatchAddTagsToQuestions);

// 管理员考点管理
router.get('/computer1/admin/tags', adminAuth, computer1Controller.adminGetTags);
router.get('/computer1/admin/tags/all', adminAuth, computer1Controller.getAllKnowledgeTags);
router.get('/computer1/admin/tags/by-name', adminAuth, computer1Controller.getKnowledgeTagByName);
router.get('/computer1/admin/tags/:tagId', adminAuth, computer1Controller.getKnowledgeTagById);
router.post('/computer1/admin/tags', adminAuth, computer1Controller.adminCreateTag);
router.put('/computer1/admin/tags/:tagId', adminAuth, computer1Controller.adminUpdateTag);
router.delete('/computer1/admin/tags/:tagId', adminAuth, computer1Controller.adminDeleteTag);
router.put('/computer1/admin/tags/:tagId/move', adminAuth, computer1Controller.adminMoveTag);
router.put('/computer1/admin/tags/batch-move', adminAuth, computer1Controller.adminBatchMoveTags);
router.delete('/computer1/admin/tags/batch-delete-unnamed', adminAuth, computer1Controller.adminBatchDeleteUnnamedTags);
router.delete('/computer1/admin/tags/clean-invalid', adminAuth, computer1Controller.adminCleanInvalidTags);
router.post('/computer1/admin/tags/proofread', adminAuth, computer1Controller.adminProofreadTags);
router.get('/computer1/admin/tags/:tagId/questions', adminAuth, computer1Controller.adminGetTagQuestions);

// 在线考试相关
router.get('/computer/admin/papers', adminAuth, computer1Controller.getAdminPapers);
router.get('/computer/admin/questions/all', adminAuth, computer1Controller.getAllQuestions);

// 试卷管理
router.get('/computer1/admin/papers', adminAuth, computer1Controller.getPaperList);
router.get('/computer1/admin/papers/:paperId', adminAuth, computer1Controller.getPaperDetail);
router.put('/computer1/admin/papers/:paperId', adminAuth, computer1Controller.updatePaper);
router.delete('/computer1/admin/papers/:paperId', adminAuth, computer1Controller.deletePaper);
router.put('/computer1/admin/papers/:paperId/questions', adminAuth, computer1Controller.updatePaperQuestions);

// 题目管理
router.put('/computer1/admin/questions/:questionId', adminAuth, computer1Controller.adminUpdateQuestion);

// 题目反馈 (重复定义的，移除或统一使用 adminAuth)
// router.post('/computer1/feedback', auth, computer1Controller.submitQuestionFeedback);
// router.get('/computer1/feedbacks', adminAuth, computer1Controller.getFeedbacks);
// router.put('/computer1/feedbacks/:id', adminAuth, computer1Controller.updateFeedbackStatus);

// 精选题库相关
router.get('/computer1/curated-banks', auth, computer1Controller.getCuratedBanks);
router.post('/computer1/curated-banks', auth, computer1Controller.createCuratedBank);
router.put('/computer1/curated-banks/:bankId', auth, computer1Controller.updateCuratedBank);
router.delete('/computer1/curated-banks/:bankId', auth, computer1Controller.deleteCuratedBank);

router.get('/computer1/curated-banks/:bankId/chapters', auth, computer1Controller.getCuratedChapters);
router.post('/computer1/curated-banks/:bankId/chapters', auth, computer1Controller.createCuratedChapter);
router.put('/computer1/curated-chapters/:chapterId', auth, computer1Controller.updateCuratedChapter);
router.delete('/computer1/curated-chapters/:chapterId', auth, computer1Controller.deleteCuratedChapter);

router.get('/computer1/curated-chapters/:chapterId/questions', auth, computer1Controller.getCuratedQuestions);
router.post('/computer1/curated-chapters/:chapterId/questions', auth, computer1Controller.addQuestionsToCuratedChapter);
router.delete('/computer1/curated-questions/:id', auth, computer1Controller.removeQuestionFromCurated);

module.exports = router;
