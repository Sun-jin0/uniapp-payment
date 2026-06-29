const express = require('express');
const router = express.Router();
const cardController = require('../controllers/cardController');
const { auth, adminAuth } = require('../middleware/auth');

// 公开接口
router.get('/pool', cardController.getPool);

// 用户接口（需要登录）
router.get('/list', auth, cardController.getAllCards);
router.get('/my', auth, cardController.getMyCards);
router.get('/check-today', auth, cardController.checkTodayDraw);
router.post('/draw', auth, cardController.drawCard);
router.get('/stats', auth, cardController.getUserStats);
router.get('/history', auth, cardController.getDrawHistory);
router.get('/remaining', auth, cardController.getRemainingDraws);
router.post('/add-count', auth, cardController.addDrawCount);

// 管理员接口
console.log('注册管理员接口: /admin/list');
router.get('/admin/list', auth, adminAuth, cardController.getAllCardsAdmin);
router.post('/create', auth, adminAuth, cardController.createCard);
router.put('/update/:id', auth, adminAuth, cardController.updateCard);
router.delete('/delete/:id', auth, adminAuth, cardController.deleteCard);
router.get('/admin-stats', auth, adminAuth, cardController.getCardStats);

module.exports = router;
