const express = require('express');
const router = express.Router();
const redeemCodeController = require('../controllers/redeemCodeController');
const { auth, adminAuth } = require('../middleware/auth');
const { generateRedeemCodeValidation, verifyRedeemCodeValidation, paginationValidation } = require('../middleware/validation');

router.post('/generate', adminAuth, generateRedeemCodeValidation, redeemCodeController.generateCodes);
router.get('/', adminAuth, paginationValidation, redeemCodeController.getRedeemCodes);
router.post('/verify', auth, verifyRedeemCodeValidation, redeemCodeController.verifyCode);

module.exports = router;
