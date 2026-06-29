const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membershipController');
const { auth } = require('../middleware/auth');

// ========== 用户端接口 ==========

// 获取会员卡类型列表（公开）
router.get('/card-types', membershipController.getCardTypes);

// 获取用户会员状态
router.get('/my-membership', auth, membershipController.getMyMembership);

// 检查做题权限
router.get('/check-access', auth, membershipController.checkAccess);

// 记录做题次数
router.post('/record-view', auth, membershipController.recordView);

// 计算折扣价格
router.post('/calculate-discount', auth, membershipController.calculateDiscount);

// 计算综合价格（全局折扣+折扣码）
router.post('/calculate-price', auth, membershipController.calculatePrice);

// 获取当前有效全局折扣
router.get('/global-discounts', membershipController.getActiveGlobalDiscounts);

// 获取用户订单列表
router.get('/my-orders', auth, membershipController.getMyOrders);

// 创建订单
router.post('/create-order', auth, membershipController.createOrder);

// 创建微信支付订单并返回支付参数（JSAPI/小程序）
// 参考: https://pay.weixin.qq.com/doc/v3/merchant/4012062524
router.post('/payment/:orderNo', auth, membershipController.createPayment);

// 支付回调通知（微信支付异步通知，无需登录验证）
// 参考: https://pay.weixin.qq.com/doc/v3/merchant/4012365342
router.post('/payment/notify', express.raw({ type: 'application/json' }), membershipController.paymentNotify);

// 模拟支付订单（保留用于测试）
router.post('/pay-order/:orderNo', auth, membershipController.payOrder);

// 取消订单
router.post('/cancel-order/:orderNo', auth, membershipController.cancelOrder);

// 申请退款
router.post('/refund-order/:orderNo', auth, membershipController.refundOrder);

// 删除订单
router.delete('/orders/:orderNo', auth, membershipController.deleteOrder);

// 使用激活码
router.post('/activate-code', auth, membershipController.activateByCode);

module.exports = router;