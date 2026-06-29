const Membership = require('../models/Membership');
const Order = require('../models/Order');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/response');
const wechatPay = require('../utils/wechatPay');

/**
 * 用户端会员接口
 */

// 获取会员卡类型列表
const getCardTypes = async (req, res) => {
  try {
    const cards = await Membership.getCardTypes();
    res.json(successResponse(cards));
  } catch (error) {
    console.error('getCardTypes error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取用户会员状态
const getMyMembership = async (req, res) => {
  try {
    const userId = req.userId;
    const membership = await Membership.getUserMembership(userId);
    res.json(successResponse(membership));
  } catch (error) {
    console.error('getMyMembership error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 检查做题权限
const checkAccess = async (req, res) => {
  try {
    const userId = req.userId;
    const result = await Membership.checkQuestionAccess(userId);
    res.json(successResponse(result));
  } catch (error) {
    console.error('checkAccess error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 记录做题次数
const recordView = async (req, res) => {
  try {
    const userId = req.userId;
    await Membership.recordQuestionView(userId);
    res.json(successResponse(null));
  } catch (error) {
    console.error('recordView error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 计算折扣价格
const calculateDiscount = async (req, res) => {
  try {
    const userId = req.userId;
    const { cardTypeId, code } = req.body;

    if (!cardTypeId) {
      return res.status(400).json(errorResponse('请选择会员卡'));
    }

    const cardType = await Membership.getCardTypeById(cardTypeId);
    if (!cardType) {
      return res.status(400).json(errorResponse('会员卡不存在'));
    }

    const result = await Membership.validateDiscountCode(code, cardType.price, cardTypeId, userId);
    res.json(successResponse(result));
  } catch (error) {
    console.error('calculateDiscount error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 计算综合价格（全局折扣+折扣码）
const calculatePrice = async (req, res) => {
  try {
    const userId = req.userId;
    const { cardTypeId, discountCode } = req.body;

    if (!cardTypeId) {
      return res.status(400).json(errorResponse('请选择会员卡'));
    }

    const cardType = await Membership.getCardTypeById(cardTypeId);
    if (!cardType) {
      return res.status(400).json(errorResponse('会员卡不存在'));
    }

    const result = await Membership.calculateFinalPrice(cardTypeId, cardType.price, discountCode || null, userId);
    res.json(successResponse(result));
  } catch (error) {
    console.error('calculatePrice error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 创建订单
const createOrder = async (req, res) => {
  try {
    const userId = req.userId;
    const { cardTypeId, discountCode, remark } = req.body;

    if (!cardTypeId) {
      return res.status(400).json(errorResponse('请选择会员卡类型'));
    }

    const cardType = await Membership.getCardTypeById(cardTypeId);
    if (!cardType) {
      return res.status(400).json(errorResponse('会员卡类型不存在'));
    }
    if (!cardType.enabled) {
      return res.status(400).json(errorResponse('该会员卡暂未开放'));
    }

    // 使用新的综合折扣计算
    const priceResult = await Membership.calculateFinalPrice(cardTypeId, cardType.price, discountCode || null, userId);

    const orderData = {
      userId,
      cardTypeId,
      cardName: cardType.display_name,
      durationDays: cardType.duration_days,
      originalPrice: priceResult.originalPrice,
      discountCode: priceResult.discountCode,
      discountId: priceResult.codeDiscountId || priceResult.globalDiscountId || null,
      discountAmount: priceResult.totalDiscount,
      finalPrice: priceResult.finalPrice,
      remark
    };

    const result = await Order.createOrder(orderData);

    res.json(successResponse({
      orderId: result.orderId,
      orderNo: result.orderNo,
      cardName: cardType.display_name,
      durationDays: cardType.duration_days,
      originalPrice: priceResult.originalPrice,
      globalDiscountAmount: priceResult.globalDiscountAmount,
      codeDiscountAmount: priceResult.codeDiscountAmount,
      discountAmount: priceResult.totalDiscount,
      finalPrice: priceResult.finalPrice
    }, '订单创建成功'));
  } catch (error) {
    console.error('createOrder error:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 创建微信支付订单并返回支付参数（JSAPI/小程序）
// 参考: https://pay.weixin.qq.com/doc/v3/merchant/4012062524
const createPayment = async (req, res) => {
  try {
    const userId = req.userId;
    const { orderNo } = req.params;

    const order = await Order.getOrderByNo(orderNo);
    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }
    if (order.user_id !== userId) {
      return res.status(403).json(errorResponse('无权操作此订单'));
    }
    if (order.status !== 'pending') {
      return res.status(400).json(errorResponse('订单状态不正确'));
    }

    // 获取用户openid
    const user = await User.findById(userId);
    if (!user || !user.openid) {
      return res.status(400).json(errorResponse('未获取到用户微信openid，请重新登录'));
    }

    // 检查微信支付配置
    if (!wechatPay.isConfigured()) {
      return res.status(500).json(errorResponse('微信支付未配置'));
    }

    // 调用微信支付V3 JSAPI下单
    const totalFee = Math.round(order.final_price * 100); // 转为分
    const payResult = await wechatPay.createJsapiOrder({
      orderNo: order.order_no,
      totalFee,
      body: `开通${order.card_name}会员`,
      openId: user.openid,
      attach: order.order_no // 回调时带回订单号
    });

    res.json(successResponse({
      orderNo: order.order_no,
      prepayId: payResult.prepayId,
      payParams: payResult.payParams
    }, '支付参数生成成功'));
  } catch (error) {
    console.error('createPayment error:', error);
    res.status(500).json(errorResponse(error.message || '支付参数生成失败'));
  }
};

// 支付通知回调（微信支付异步通知）
// 参考: https://pay.weixin.qq.com/doc/v3/merchant/4012365342
const paymentNotify = async (req, res) => {
  try {
    // 验证签名
    const isValid = wechatPay.verifySignature(req.headers, req.body);
    if (!isValid) {
      console.error('微信支付回调签名验证失败');
      return res.status(401).json({ code: 'FAIL', message: '签名验证失败' });
    }

    // 解密回调数据
    const notifyData = wechatPay.decryptNotify(req.headers, req.body);
    console.log('微信支付回调数据:', notifyData);

    if (notifyData.trade_state === 'SUCCESS') {
      const orderNo = notifyData.out_trade_no || notifyData.attach;
      const transactionId = notifyData.transaction_id;

      const order = await Order.getOrderByNo(orderNo);
      if (order && order.status === 'pending') {
        // 更新订单为已支付
        await Order.payOrder(order.id, 'wechat', {
          paymentTime: new Date(),
          paymentTransactionId: transactionId,
          paymentMethod: 'wechat'
        });

        // 激活会员
        await Order.activateMembership(order.id);
        console.log(`✅ 订单 ${orderNo} 支付成功，会员已激活`);
      }
    }

    // 返回成功响应
    res.status(200).json({ code: 'SUCCESS', message: '成功' });
  } catch (error) {
    console.error('paymentNotify error:', error);
    res.status(500).json({ code: 'FAIL', message: '处理失败' });
  }
};

// 模拟支付订单（保留用于测试）
const payOrder = async (req, res) => {
  try {
    const userId = req.userId;
    const { orderNo } = req.params;
    const { paymentMethod = 'mock' } = req.body;

    const order = await Order.getOrderByNo(orderNo);
    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }
    if (order.user_id !== userId) {
      return res.status(403).json(errorResponse('无权操作此订单'));
    }
    if (order.status !== 'pending') {
      return res.status(400).json(errorResponse('订单状态不正确'));
    }

    await Order.payOrder(order.id, paymentMethod);
    const activateResult = await Order.activateMembership(order.id);

    res.json(successResponse({
      orderNo,
      status: 'active',
      membershipEnd: activateResult.membershipEnd
    }, '支付成功，会员已开通'));
  } catch (error) {
    console.error('payOrder error:', error);
    res.status(500).json(errorResponse(error.message || '支付失败'));
  }
};

// 取消订单
const cancelOrder = async (req, res) => {
  try {
    const userId = req.userId;
    const { orderNo } = req.params;

    const order = await Order.getOrderByNo(orderNo);
    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }
    if (order.user_id !== userId) {
      return res.status(403).json(errorResponse('无权操作此订单'));
    }

    // 如果已调用微信支付下单，先关闭微信订单
    if (order.status === 'pending') {
      try {
        await wechatPay.closeOrder(orderNo);
      } catch (err) {
        console.error('关闭微信订单失败:', err.message);
        // 不影响取消逻辑
      }
    }

    await Order.cancelOrder(order.id);
    res.json(successResponse(null, '订单已取消'));
  } catch (error) {
    console.error('cancelOrder error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 申请退款
const refundOrder = async (req, res) => {
  try {
    const userId = req.userId;
    const { orderNo } = req.params;
    const { reason } = req.body;

    const order = await Order.getOrderByNo(orderNo);
    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }
    if (order.user_id !== userId) {
      return res.status(403).json(errorResponse('无权操作此订单'));
    }

    await Order.refundOrder(order.id, reason || '用户申请退款');
    res.json(successResponse(null, '退款申请已提交'));
  } catch (error) {
    console.error('refundOrder error:', error);
    res.status(500).json(errorResponse(error.message || '退款失败'));
  }
};

// 获取用户订单列表
const getMyOrders = async (req, res) => {
  try {
    const userId = req.userId;
    const { status, page = 1, pageSize = 20 } = req.query;
    const result = await Order.getUserOrders(userId, status, parseInt(page), parseInt(pageSize));
    res.json(successResponse(result));
  } catch (error) {
    console.error('getMyOrders error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 删除订单
const deleteOrder = async (req, res) => {
  try {
    const userId = req.userId;
    const { orderNo } = req.params;

    const order = await Order.getOrderByNo(orderNo);
    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }
    if (order.user_id !== userId) {
      return res.status(403).json(errorResponse('无权操作此订单'));
    }

    await Order.deleteOrder(order.id);
    res.json(successResponse(null, '订单已删除'));
  } catch (error) {
    console.error('deleteOrder error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 使用激活码
const activateByCode = async (req, res) => {
  try {
    const userId = req.userId;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json(errorResponse('请输入激活码'));
    }

    const result = await Membership.activateByCode(userId, code);
    res.json(successResponse(result, '激活成功'));
  } catch (error) {
    console.error('activateByCode error:', error);
    res.status(400).json(errorResponse(error.message || '激活失败'));
  }
};

// 用户端获取当前有效全局折扣
const getActiveGlobalDiscounts = async (req, res) => {
  try {
    const { cardTypeId } = req.query;
    const discounts = await Membership.getActiveGlobalDiscounts(cardTypeId || null);
    res.json(successResponse(discounts));
  } catch (error) {
    console.error('getActiveGlobalDiscounts error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// ===================== 管理员接口 =====================

// 获取会员卡类型列表（管理员）
const adminGetCardTypes = async (req, res) => {
  try {
    const cards = await Membership.getAdminCardTypes();
    res.json(successResponse(cards));
  } catch (error) {
    console.error('adminGetCardTypes error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 创建会员卡类型
const adminCreateCardType = async (req, res) => {
  try {
    const cardData = req.body;
    const result = await Membership.createCardType(cardData);
    res.json(successResponse(result, '会员卡类型创建成功'));
  } catch (error) {
    console.error('adminCreateCardType error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 更新会员卡类型
const adminUpdateCardType = async (req, res) => {
  try {
    const { id } = req.params;
    const cardData = req.body;
    const result = await Membership.updateCardType(id, cardData);
    res.json(successResponse(result, '会员卡类型更新成功'));
  } catch (error) {
    console.error('adminUpdateCardType error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 删除会员卡类型
const adminDeleteCardType = async (req, res) => {
  try {
    const { id } = req.params;
    await Membership.deleteCardType(id);
    res.json(successResponse(null, '会员卡类型删除成功'));
  } catch (error) {
    console.error('adminDeleteCardType error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取折扣码列表
const adminGetDiscounts = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, cardTypeId } = req.query;
    const result = await Membership.getDiscountCodes({ cardTypeId }, parseInt(page), parseInt(pageSize));
    res.json(successResponse(result));
  } catch (error) {
    console.error('adminGetDiscounts error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 创建折扣码
const adminCreateDiscount = async (req, res) => {
  try {
    const discountData = req.body;
    const result = await Membership.createDiscountCode(discountData);
    res.json(successResponse(result, '折扣码创建成功'));
  } catch (error) {
    console.error('adminCreateDiscount error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 更新折扣码
const adminUpdateDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const discountData = req.body;
    const result = await Membership.updateDiscountCode(id, discountData);
    res.json(successResponse(result, '折扣码更新成功'));
  } catch (error) {
    console.error('adminUpdateDiscount error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 删除折扣码
const adminDeleteDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    await Membership.deleteDiscountCode(id);
    res.json(successResponse(null, '折扣码删除成功'));
  } catch (error) {
    console.error('adminDeleteDiscount error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取折扣码使用记录
const adminGetDiscountUsage = async (req, res) => {
  try {
    const { discountId, page = 1, pageSize = 20 } = req.query;
    const result = await Membership.getDiscountUsage(parseInt(discountId), parseInt(page), parseInt(pageSize));
    res.json(successResponse(result));
  } catch (error) {
    console.error('adminGetDiscountUsage error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取全局设置
const adminGetSettings = async (req, res) => {
  try {
    const settings = await Membership.getSettings();
    res.json(successResponse(settings));
  } catch (error) {
    console.error('adminGetSettings error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 更新全局设置
const adminUpdateSetting = async (req, res) => {
  try {
    const { key, value } = req.body;
    await Membership.updateSetting(key, value);
    res.json(successResponse(null, '设置更新成功'));
  } catch (error) {
    console.error('adminUpdateSetting error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取统计数据
const adminGetStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const stats = await Order.getOrderStats(startDate, endDate);
    const membershipStats = await Membership.getMembershipStats();

    res.json(successResponse({
      ...stats,
      ...membershipStats
    }));
  } catch (error) {
    console.error('adminGetStats error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取所有订单（管理员）
const adminGetOrders = async (req, res) => {
  try {
    const { status, userId, orderNo, startDate, endDate, page = 1, pageSize = 20 } = req.query;
    const filters = { status, userId, orderNo, startDate, endDate };
    const result = await Order.getAllOrders(filters, parseInt(page), parseInt(pageSize));
    res.json(successResponse(result));
  } catch (error) {
    console.error('adminGetOrders error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取订单详情（管理员）
const adminGetOrderDetail = async (req, res) => {
  try {
    const { orderNo } = req.params;
    const order = await Order.getOrderByNo(orderNo);
    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }
    res.json(successResponse(order));
  } catch (error) {
    console.error('adminGetOrderDetail error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 管理员更新订单状态
const adminUpdateOrderStatus = async (req, res) => {
  try {
    const { orderNo } = req.params;
    const { status, adminRemark } = req.body;

    const order = await Order.getOrderByNo(orderNo);
    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    await Order.updateOrderStatus(order.id, status, { adminRemark });
    res.json(successResponse(null, '订单状态更新成功'));
  } catch (error) {
    console.error('adminUpdateOrderStatus error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 管理员退款
const adminRefundOrder = async (req, res) => {
  try {
    const { orderNo } = req.params;
    const { reason } = req.body;

    const order = await Order.getOrderByNo(orderNo);
    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    await Order.refundOrder(order.id, reason || '管理员退款');
    res.json(successResponse(null, '退款成功'));
  } catch (error) {
    console.error('adminRefundOrder error:', error);
    res.status(500).json(errorResponse(error.message || '退款失败'));
  }
};

// 管理员手动激活订单
const adminActivateOrder = async (req, res) => {
  try {
    const { orderNo } = req.params;

    const order = await Order.getOrderByNo(orderNo);
    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    const result = await Order.activateMembership(order.id);
    res.json(successResponse(result, '订单已激活'));
  } catch (error) {
    console.error('adminActivateOrder error:', error);
    res.status(500).json(errorResponse(error.message || '激活失败'));
  }
};

// 管理员删除订单
const adminDeleteOrder = async (req, res) => {
  try {
    const { orderNo } = req.params;

    const order = await Order.getOrderByNo(orderNo);
    if (!order) {
      return res.status(404).json(errorResponse('订单不存在'));
    }

    await Order.deleteOrder(order.id);
    res.json(successResponse(null, '订单已删除'));
  } catch (error) {
    console.error('adminDeleteOrder error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取会员列表
const adminGetMemberships = async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const result = await Membership.getAllMemberships(parseInt(page), parseInt(pageSize));
    res.json(successResponse(result));
  } catch (error) {
    console.error('adminGetMemberships error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 调整会员到期时间
const adminAdjustMembership = async (req, res) => {
  try {
    const { userId } = req.params;
    const { endDate, reason } = req.body;

    if (!endDate) {
      return res.status(400).json(errorResponse('请输入到期时间'));
    }

    const result = await Membership.adjustMembershipEnd(userId, endDate, reason);
    res.json(successResponse(result, '会员到期时间已调整'));
  } catch (error) {
    console.error('adminAdjustMembership error:', error);
    res.status(500).json(errorResponse(error.message || '调整失败'));
  }
};

// 获取全局折扣列表
const adminGetGlobalDiscounts = async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const result = await Membership.getGlobalDiscounts({}, parseInt(page), parseInt(pageSize));
    res.json(successResponse(result));
  } catch (error) {
    console.error('adminGetGlobalDiscounts error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 创建全局折扣
const adminCreateGlobalDiscount = async (req, res) => {
  try {
    const discountData = req.body;
    const result = await Membership.createGlobalDiscount(discountData);
    res.json(successResponse(result, '全局折扣创建成功'));
  } catch (error) {
    console.error('adminCreateGlobalDiscount error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 更新全局折扣
const adminUpdateGlobalDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const discountData = req.body;
    const result = await Membership.updateGlobalDiscount(id, discountData);
    res.json(successResponse(result, '全局折扣更新成功'));
  } catch (error) {
    console.error('adminUpdateGlobalDiscount error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 删除全局折扣
const adminDeleteGlobalDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    await Membership.deleteGlobalDiscount(id);
    res.json(successResponse(null, '全局折扣删除成功'));
  } catch (error) {
    console.error('adminDeleteGlobalDiscount error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取激活码列表
const adminGetActivationCodes = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status } = req.query;
    const result = await Membership.getActivationCodes({ status }, parseInt(page), parseInt(pageSize));
    res.json(successResponse(result));
  } catch (error) {
    console.error('adminGetActivationCodes error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 创建激活码
const adminCreateActivationCode = async (req, res) => {
  try {
    const codeData = req.body;
    const result = await Membership.createActivationCode(codeData);
    res.json(successResponse(result, '激活码创建成功'));
  } catch (error) {
    console.error('adminCreateActivationCode error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 更新激活码
const adminUpdateActivationCode = async (req, res) => {
  try {
    const { id } = req.params;
    const codeData = req.body;
    const result = await Membership.updateActivationCode(id, codeData);
    res.json(successResponse(result, '激活码更新成功'));
  } catch (error) {
    console.error('adminUpdateActivationCode error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 更新激活码状态
const adminUpdateActivationCodeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await Membership.updateActivationCodeStatus(id, status);
    res.json(successResponse(null, '激活码状态更新成功'));
  } catch (error) {
    console.error('adminUpdateActivationCodeStatus error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 删除激活码
const adminDeleteActivationCode = async (req, res) => {
  try {
    const { id } = req.params;
    await Membership.deleteActivationCode(id);
    res.json(successResponse(null, '激活码删除成功'));
  } catch (error) {
    console.error('adminDeleteActivationCode error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

module.exports = {
  // 用户端
  getCardTypes,
  getMyMembership,
  checkAccess,
  recordView,
  calculateDiscount,
  calculatePrice,
  getMyOrders,
  createOrder,
  createPayment,
  paymentNotify,
  payOrder,
  cancelOrder,
  refundOrder,
  deleteOrder,
  activateByCode,
  getActiveGlobalDiscounts,

  // 管理员
  adminGetCardTypes,
  adminCreateCardType,
  adminUpdateCardType,
  adminDeleteCardType,
  adminGetDiscounts,
  adminCreateDiscount,
  adminUpdateDiscount,
  adminDeleteDiscount,
  adminGetDiscountUsage,
  adminGetSettings,
  adminUpdateSetting,
  adminGetStats,
  adminGetOrders,
  adminGetOrderDetail,
  adminUpdateOrderStatus,
  adminRefundOrder,
  adminActivateOrder,
  adminDeleteOrder,
  adminGetMemberships,
  adminAdjustMembership,
  adminGetGlobalDiscounts,
  adminCreateGlobalDiscount,
  adminUpdateGlobalDiscount,
  adminDeleteGlobalDiscount,
  adminGetActivationCodes,
  adminCreateActivationCode,
  adminUpdateActivationCode,
  adminUpdateActivationCodeStatus,
  adminDeleteActivationCode
};