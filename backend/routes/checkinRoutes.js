const express = require('express');
const router = express.Router();
const checkinController = require('../controllers/checkinController');
const { auth } = require('../middleware/auth');

router.post('/', auth, checkinController.checkin);
router.get('/records', auth, checkinController.getCheckinRecords);

// 自定义打卡相关路由
router.post('/custom', auth, checkinController.customCheckin);
router.get('/custom/records', auth, checkinController.getCustomCheckinRecords);
router.get('/custom/today', auth, checkinController.getTodayCheckinStatus);
router.post('/custom/:checkinId/share', auth, checkinController.shareCheckin);

module.exports = router;
