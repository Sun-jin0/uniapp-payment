const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membershipController');
const { auth, adminAuth } = require('../middleware/auth');

// ========== 管理员接口 ==========

// 会员卡类型管理
router.get('/card-types', auth, adminAuth, membershipController.adminGetCardTypes);
router.post('/card-types', auth, adminAuth, membershipController.adminCreateCardType);
router.put('/card-types/:id', auth, adminAuth, membershipController.adminUpdateCardType);
router.delete('/card-types/:id', auth, adminAuth, membershipController.adminDeleteCardType);

// 折扣码管理
router.get('/discounts', auth, adminAuth, membershipController.adminGetDiscounts);
router.post('/discounts', auth, adminAuth, membershipController.adminCreateDiscount);
router.put('/discounts/:id', auth, adminAuth, membershipController.adminUpdateDiscount);
router.delete('/discounts/:id', auth, adminAuth, membershipController.adminDeleteDiscount);
router.get('/discount-usage', auth, adminAuth, membershipController.adminGetDiscountUsage);

// 全局折扣管理（自动适用，无需输入码）
router.get('/global-discounts', auth, adminAuth, membershipController.adminGetGlobalDiscounts);
router.post('/global-discounts', auth, adminAuth, membershipController.adminCreateGlobalDiscount);
router.put('/global-discounts/:id', auth, adminAuth, membershipController.adminUpdateGlobalDiscount);
router.delete('/global-discounts/:id', auth, adminAuth, membershipController.adminDeleteGlobalDiscount);

// 全局设置
router.get('/settings', auth, adminAuth, membershipController.adminGetSettings);
router.put('/settings/:key', auth, adminAuth, membershipController.adminUpdateSetting);

// 统计
router.get('/stats', auth, adminAuth, membershipController.adminGetStats);

// 订单管理
router.get('/orders', auth, adminAuth, membershipController.adminGetOrders);
router.get('/orders/:orderId', auth, adminAuth, membershipController.adminGetOrderDetail);
router.put('/orders/:orderId/status', auth, adminAuth, membershipController.adminUpdateOrderStatus);
router.post('/orders/:orderId/refund', auth, adminAuth, membershipController.adminRefundOrder);
router.post('/orders/:orderId/activate', auth, adminAuth, membershipController.adminActivateOrder);
router.delete('/orders/:orderId', auth, adminAuth, membershipController.adminDeleteOrder);

// 会员订阅管理
router.get('/memberships', auth, adminAuth, membershipController.adminGetMemberships);
router.post('/memberships/:userId/adjust', auth, adminAuth, membershipController.adminAdjustMembership);

// 激活码管理
router.get('/activation-codes', auth, adminAuth, membershipController.adminGetActivationCodes);
router.post('/activation-codes', auth, adminAuth, membershipController.adminCreateActivationCode);
router.put('/activation-codes/:id', auth, adminAuth, membershipController.adminUpdateActivationCode);
router.put('/activation-codes/:id/status', auth, adminAuth, membershipController.adminUpdateActivationCodeStatus);
router.delete('/activation-codes/:id', auth, adminAuth, membershipController.adminDeleteActivationCode);

module.exports = router;