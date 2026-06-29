const express = require('express');
const router = express.Router();
const adminMathController = require('../controllers/adminMathController');

// 科目列表
router.get('/math/subjects', adminMathController.getSubjects);
router.post('/math/admin/subjects', adminMathController.createSubject);
router.put('/math/admin/subjects/:id', adminMathController.updateSubject);
router.delete('/math/admin/subjects/:id', adminMathController.deleteSubject);

// 纠错管理 (使用不同的路径避免与mathRoutes冲突)
router.get('/math/admin/corrections', adminMathController.getCorrections);
router.get('/admin/math/corrections', adminMathController.getCorrections);
router.put('/math/admin/corrections/:id', adminMathController.ignoreCorrection);
router.put('/admin/math/corrections/:id', adminMathController.ignoreCorrection);
router.delete('/math/admin/corrections/:id', adminMathController.deleteCorrection);
router.delete('/admin/math/corrections/:id', adminMathController.deleteCorrection);

// 题目管理
router.get('/math/admin/questions', adminMathController.adminSearchQuestions);
router.get('/math/admin/questions/:questionId/detail', adminMathController.getQuestionForEdit);
router.post('/math/admin/questions', adminMathController.createQuestion);
router.put('/math/admin/questions/:questionId', adminMathController.updateQuestion);
router.delete('/math/admin/questions/:questionId', adminMathController.deleteQuestion);

// 纠错
router.post('/math/admin/corrections', adminMathController.submitCorrection);

// 兼容路由 - 与参考页面保持一致
router.get('/admin/math/questions', adminMathController.adminSearchQuestions);
router.get('/admin/math/questions/:questionId/detail', adminMathController.getQuestionForEdit);
router.post('/admin/math/questions', adminMathController.createQuestion);
router.put('/admin/math/questions/:questionId', adminMathController.updateQuestion);
router.delete('/admin/math/questions/:questionId', adminMathController.deleteQuestion);

// 搜索 (兼容两种路径格式)
router.get('/admin/math/search-questions', adminMathController.searchQuestions);
router.get('/math/admin/search-questions', adminMathController.adminSearchQuestions);
router.get('/admin/math/search-kp', adminMathController.searchKnowledgePoints);
router.get('/math/admin/search-kp', adminMathController.searchKnowledgePoints);
router.get('/admin/math/kp/:kpId', adminMathController.getKnowledgePointDetail);
router.get('/math/admin/kp/:kpId', adminMathController.getKnowledgePointDetail);
router.put('/admin/math/kp/:kpId', adminMathController.updateKnowledgePoint);
router.put('/math/admin/kp/:kpId', adminMathController.updateKnowledgePoint);

// 考点分类管理 (兼容两种路径格式)
router.get('/admin/math/knowledge-categories', adminMathController.getKnowledgeCategories);
router.get('/math/admin/knowledge-categories', adminMathController.getKnowledgeCategories);
router.post('/admin/math/knowledge-categories', adminMathController.createKnowledgeCategory);
router.post('/math/admin/knowledge-categories', adminMathController.createKnowledgeCategory);
router.put('/admin/math/knowledge-categories/:id', adminMathController.updateKnowledgeCategory);
router.put('/math/admin/knowledge-categories/:id', adminMathController.updateKnowledgeCategory);
router.delete('/admin/math/knowledge-categories/:id', adminMathController.deleteKnowledgeCategory);
router.delete('/math/admin/knowledge-categories/:id', adminMathController.deleteKnowledgeCategory);
router.get('/admin/math/knowledge-categories/:categoryId/questions', adminMathController.getQuestionsByCategory);
router.get('/math/admin/knowledge-categories/:categoryId/questions', adminMathController.getQuestionsByCategory);
router.delete('/admin/math/knowledge-categories/:categoryId/questions/:questionId', adminMathController.removeQuestionFromCategory);
router.delete('/math/admin/knowledge-categories/:categoryId/questions/:questionId', adminMathController.removeQuestionFromCategory);

// 修复题目考点关联
router.post('/admin/math/fix-knowledge-point-links', adminMathController.fixQuestionKnowledgePointLinks);
router.post('/math/admin/fix-knowledge-point-links', adminMathController.fixQuestionKnowledgePointLinks);

// 书籍/试卷管理 - 注意：更具体的路由要放在前面 (兼容两种路径格式)
router.get('/math/admin/books', adminMathController.getBooks);
router.get('/admin/math/books', adminMathController.getBooks);
router.post('/math/admin/books', adminMathController.createBook);
router.post('/admin/math/books', adminMathController.createBook);

// 书籍章节管理 (放在 /:bookId 之前，避免被解析为bookId)
router.get('/math/admin/books/:bookId/chapters', adminMathController.getBookChapters);
router.get('/admin/math/books/:bookId/chapters', adminMathController.getBookChapters);
router.post('/math/admin/books/:bookId/chapters', adminMathController.addBookChapter);
router.post('/admin/math/books/:bookId/chapters', adminMathController.addBookChapter);
router.get('/math/admin/books/:bookId/chapters/:chapterName/questions', adminMathController.getBookChapterQuestions);
router.get('/admin/math/books/:bookId/chapters/:chapterName/questions', adminMathController.getBookChapterQuestions);
router.put('/math/admin/books/:bookId/chapters/:chapterName', adminMathController.updateBookChapter);
router.put('/admin/math/books/:bookId/chapters/:chapterName', adminMathController.updateBookChapter);
router.delete('/math/admin/books/:bookId/chapters/:chapterName', adminMathController.deleteBookChapter);
router.delete('/admin/math/books/:bookId/chapters/:chapterName', adminMathController.deleteBookChapter);

// 书籍题目管理
router.get('/math/admin/books/:bookId/questions', adminMathController.getBookQuestions);
router.get('/admin/math/books/:bookId/questions', adminMathController.getBookQuestions);
router.put('/math/admin/books/:bookId/questions/:questionId', adminMathController.updateBookQuestion);
router.put('/admin/math/books/:bookId/questions/:questionId', adminMathController.updateBookQuestion);
router.delete('/math/admin/books/:bookId/questions/:questionId', adminMathController.deleteBookQuestion);
router.delete('/admin/math/books/:bookId/questions/:questionId', adminMathController.deleteBookQuestion);
router.post('/math/admin/books/:bookId/questions/batch-delete', adminMathController.batchDeleteBookQuestions);
router.post('/admin/math/books/:bookId/questions/batch-delete', adminMathController.batchDeleteBookQuestions);
router.post('/math/admin/books/:bookId/add-questions', adminMathController.addQuestionsToBook);
router.post('/admin/math/books/:bookId/add-questions', adminMathController.addQuestionsToBook);

// 书籍基本操作 (放在最后，避免捕获其他路由)
router.put('/math/admin/books/:bookId', adminMathController.updateBook);
router.put('/admin/math/books/:bookId', adminMathController.updateBook);
router.delete('/math/admin/books/:bookId', adminMathController.deleteBook);
router.delete('/admin/math/books/:bookId', adminMathController.deleteBook);

// 批量导入
router.post('/math/admin/import-questions', adminMathController.importQuestions);
router.post('/admin/math/import-questions', adminMathController.importQuestions);
router.post('/math/admin/import-complex-questions', adminMathController.importComplexQuestions);
router.post('/admin/math/import-complex-questions', adminMathController.importComplexQuestions);
router.post('/math/admin/import-from-files', adminMathController.importFromFiles);
router.post('/admin/math/import-from-files', adminMathController.importFromFiles);

// 从本地 books 文件夹扫描和导入
router.get('/math/admin/scan-books-folder', adminMathController.scanBooksFolder);
router.get('/admin/math/scan-books-folder', adminMathController.scanBooksFolder);
router.post('/math/admin/import-from-books-folder', adminMathController.importFromBooksFolder);
router.post('/admin/math/import-from-books-folder', adminMathController.importFromBooksFolder);

// 相关题管理
router.post('/math/admin/related-questions', adminMathController.saveRelatedQuestions);
router.post('/admin/math/related-questions', adminMathController.saveRelatedQuestions);

// 获取所有考点列表
router.get('/math/admin/knowledge-points', adminMathController.getAllKnowledgePoints);
router.get('/math/admin/knowledge-points/all', adminMathController.getAllKnowledgePoints);

// 搜索考点
router.get('/math/admin/knowledge-points/search', adminMathController.searchKnowledgePoints);

// 获取考点题目数量
router.get('/math/admin/knowledge-point-question-count', adminMathController.getQuestionCountByKnowledgePoint);
router.get('/admin/math/knowledge-point-question-count', adminMathController.getQuestionCountByKnowledgePoint);
router.post('/math/admin/knowledge-point-question-counts', adminMathController.getQuestionCountsBatch);
router.post('/admin/math/knowledge-point-question-counts', adminMathController.getQuestionCountsBatch);

// 试卷提取保存
router.post('/math/admin/paper-extract/save-question', adminMathController.savePaperQuestion);
router.post('/admin/math/paper-extract/save-question', adminMathController.savePaperQuestion);

// 从JSON导入试卷（去重合集.json + 去重索引.json）
router.post('/math/admin/import-papers-from-json', adminMathController.importPapersFromJson);
router.post('/admin/math/import-papers-from-json', adminMathController.importPapersFromJson);

// 从试卷提取页导入单个试卷到题库
router.post('/math/admin/import-extracted-paper', adminMathController.importExtractedPaper);
router.post('/admin/math/import-extracted-paper', adminMathController.importExtractedPaper);

// 自动链接考点（基于LinksCount/LinkNames）
router.post('/math/admin/link-question-kps', adminMathController.linkQuestionKnowledgePoints);
router.post('/admin/math/link-question-kps', adminMathController.linkQuestionKnowledgePoints);

module.exports = router;
