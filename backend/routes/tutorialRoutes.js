const express = require('express');
const router = express.Router();
const tutorialController = require('../controllers/tutorialController');

// 教辅列表
router.get('/computer/tutorials', tutorialController.getTutorials);

// 导入教辅数据（必须在 :id 路由之前）
router.post('/computer/tutorials/import', tutorialController.importTutorialData);

// 重置教辅ID（需要管理员权限，必须在 :id 路由之前）
router.post('/computer/tutorials/reset-ids', tutorialController.resetTutorialIds);

// 创建教辅
router.post('/computer/tutorials', tutorialController.createTutorial);

// 教辅详情
router.get('/computer/tutorials/:id', tutorialController.getTutorialDetail);

// 章节题目
router.get('/computer/tutorial-chapters/:chapterId/questions', tutorialController.getChapterQuestions);

// 教辅题目关联
router.get('/computer/tutorials/:tutorialId/questions', tutorialController.getTutorialQuestions);
router.post('/computer/tutorial-questions', tutorialController.addTutorialQuestion);
router.delete('/computer/tutorials/:tutorialId/questions/:questionId', tutorialController.removeTutorialQuestion);
router.put('/computer/tutorial-questions/order', tutorialController.updateTutorialQuestionOrder);

// 更新教辅
router.put('/computer/tutorials/:id', tutorialController.updateTutorial);

// 删除教辅
router.delete('/computer/tutorials/:id', tutorialController.deleteTutorial);

// 教辅章节管理
// 获取章节列表
router.get('/computer/tutorials/:tutorialId/chapters', tutorialController.getChapters);
// 创建章节
router.post('/computer/tutorials/:tutorialId/chapters', tutorialController.createChapter);
// 更新章节
router.put('/computer/tutorial-chapters/:id', tutorialController.updateChapter);
// 删除章节
router.delete('/computer/tutorial-chapters/:id', tutorialController.deleteChapter);
// 替换题目
router.put('/computer/tutorial-chapters/:chapterId/replace-question', tutorialController.replaceChapterQuestion);

// ==================== 合集管理 ====================
// 合集列表
router.get('/computer/tutorial-collections', tutorialController.getCollections);
// 合集详情
router.get('/computer/tutorial-collections/:id', tutorialController.getCollectionDetail);
// 创建合集
router.post('/computer/tutorial-collections', tutorialController.createCollection);
// 更新合集
router.put('/computer/tutorial-collections/:id', tutorialController.updateCollection);
// 删除合集
router.delete('/computer/tutorial-collections/:id', tutorialController.deleteCollection);

module.exports = router;
