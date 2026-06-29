const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { auth } = require('../middleware/auth');
const { loginValidation, registerValidation, changePasswordValidation } = require('../middleware/validation');
const upload = require('../middleware/upload');

router.post('/login', loginValidation, userController.login);
router.post('/wechat-login', userController.wechatLogin);
router.post('/register', registerValidation, userController.register);
router.get('/info', auth, userController.getUserInfo);
router.put('/info', auth, userController.updateUserInfo);
router.post('/change-password', auth, changePasswordValidation, userController.changePassword);
router.get('/answer-records', auth, userController.getAnswerRecords);
router.post('/selected-subject', auth, userController.updateSelectedSubject);
router.get('/progress-stats', auth, userController.getUserProgressStats);
router.get('/settings', auth, userController.getUserSettings);
router.put('/settings', auth, userController.updateUserSettings);
router.post('/increase-question-count', auth, userController.increaseQuestionCount);
router.post('/upload-avatar', auth, upload.single('avatar'), userController.uploadAvatar);

module.exports = router;
