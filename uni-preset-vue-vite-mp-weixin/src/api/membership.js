import { request } from './request.js'

export default {
  // ========== 用户端接口 ==========

  // 获取会员卡类型列表
  getCardTypes: () => {
    return request({
      url: '/membership/card-types',
      method: 'GET'
    })
  },

  // 获取用户会员状态
  getMyMembership: () => {
    return request({
      url: '/membership/my-membership',
      method: 'GET'
    })
  },

  // 检查做题权限
  checkAccess: () => {
    return request({
      url: '/membership/check-access',
      method: 'GET'
    })
  },

  // 记录做题次数
  recordView: () => {
    return request({
      url: '/membership/record-view',
      method: 'POST'
    })
  },

  // 计算折扣价格（仅折扣码）
  calculateDiscount: (data) => {
    return request({
      url: '/membership/calculate-discount',
      method: 'POST',
      data
    })
  },

  // 计算综合价格（全局折扣+折扣码）
  calculatePrice: (data) => {
    return request({
      url: '/membership/calculate-price',
      method: 'POST',
      data
    })
  },

  // 获取用户订单列表
  getMyOrders: (params) => {
    return request({
      url: '/membership/my-orders',
      method: 'GET',
      data: params
    })
  },

  // 创建订单
  createOrder: (data) => {
    return request({
      url: '/membership/create-order',
      method: 'POST',
      data
    })
  },

  // 创建微信支付订单并获取支付参数（JSAPI/小程序）
  // 参考: https://pay.weixin.qq.com/doc/v3/merchant/4012062524
  createPayment: (orderNo) => {
    return request({
      url: `/membership/payment/${orderNo}`,
      method: 'POST'
    })
  },

  // 模拟支付订单（保留用于测试）
  payOrder: (orderNo) => {
    return request({
      url: `/membership/pay-order/${orderNo}`,
      method: 'POST'
    })
  },

  // 取消订单
  cancelOrder: (orderNo) => {
    return request({
      url: `/membership/cancel-order/${orderNo}`,
      method: 'POST'
    })
  },

  // 申请退款
  refundOrder: (orderNo, refundReason) => {
    return request({
      url: `/membership/refund-order/${orderNo}`,
      method: 'POST',
      data: { refundReason }
    })
  },

  // 删除订单
  deleteOrder: (orderNo) => {
    return request({
      url: `/membership/orders/${orderNo}`,
      method: 'DELETE'
    })
  },

  // 使用激活码
  activateByCode: (code) => {
    return request({
      url: '/membership/activate-code',
      method: 'POST',
      data: { code }
    })
  }
}