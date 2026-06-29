import { request } from './request.js'

export default {
  // ========== 用户端订单接口 ==========
  
  // 创建订单
  createOrder: (data) => {
    return request({
      url: '/order/create',
      method: 'POST',
      data
    })
  },

  // 获取我的订单列表
  getMyOrders: (params) => {
    return request({
      url: '/order/my-orders',
      method: 'GET',
      data: params
    })
  },

  // 获取订单详情
  getOrderDetail: (orderNo) => {
    return request({
      url: `/order/detail/${orderNo}`,
      method: 'GET'
    })
  },

  // 支付订单（模拟支付）
  payOrder: (orderNo, paymentMethod = 'mock') => {
    return request({
      url: `/order/pay/${orderNo}`,
      method: 'POST',
      data: { paymentMethod }
    })
  },

  // 取消订单
  cancelOrder: (orderNo) => {
    return request({
      url: `/order/cancel/${orderNo}`,
      method: 'POST'
    })
  },

  // ========== 管理员订单接口 ==========
  
  // 获取所有订单
  adminGetOrders: (params) => {
    return request({
      url: '/admin/order/orders',
      method: 'GET',
      data: params
    })
  },

  // 获取订单详情
  adminGetOrderDetail: (orderId) => {
    return request({
      url: `/admin/order/orders/${orderId}`,
      method: 'GET'
    })
  },

  // 修改订单状态
  adminUpdateOrderStatus: (orderId, data) => {
    return request({
      url: `/admin/order/orders/${orderId}/status`,
      method: 'PUT',
      data
    })
  },

  // 退款
  adminRefundOrder: (orderId, refundReason) => {
    return request({
      url: `/admin/order/orders/${orderId}/refund`,
      method: 'POST',
      data: { refundReason }
    })
  },

  // 手动激活会员
  adminActivateOrder: (orderId) => {
    return request({
      url: `/admin/order/orders/${orderId}/activate`,
      method: 'POST'
    })
  },

  // 获取订单统计
  adminGetOrderStats: (params) => {
    return request({
      url: '/admin/order/stats',
      method: 'GET',
      data: params
    })
  },

  // 获取折扣使用记录
  adminGetDiscountUsage: (params) => {
    return request({
      url: '/admin/order/discount-usage',
      method: 'GET',
      data: params
    })
  },

  // 手动调整会员状态
  adminAdjustMembership: (userId, subjectKey, data) => {
    return request({
      url: `/admin/order/membership/${userId}/${subjectKey}`,
      method: 'POST',
      data
    })
  }
}