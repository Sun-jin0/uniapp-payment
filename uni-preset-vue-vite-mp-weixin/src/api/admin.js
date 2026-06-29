import { request } from './request.js'

export default {
  // ========== 会员卡类型管理 ==========

  getCardTypes: () => {
    return request({
      url: '/admin/membership/card-types',
      method: 'GET'
    })
  },

  createCardType: (data) => {
    return request({
      url: '/admin/membership/card-types',
      method: 'POST',
      data
    })
  },

  updateCardType: (id, data) => {
    return request({
      url: `/admin/membership/card-types/${id}`,
      method: 'PUT',
      data
    })
  },

  // ========== 折扣码管理 ==========

  getDiscounts: () => {
    return request({
      url: '/admin/membership/discounts',
      method: 'GET'
    })
  },

  createDiscount: (data) => {
    return request({
      url: '/admin/membership/discounts',
      method: 'POST',
      data
    })
  },

  updateDiscount: (id, data) => {
    return request({
      url: `/admin/membership/discounts/${id}`,
      method: 'PUT',
      data
    })
  },

  deleteDiscount: (id) => {
    return request({
      url: `/admin/membership/discounts/${id}`,
      method: 'DELETE'
    })
  },

  getDiscountUsage: (params) => {
    return request({
      url: '/admin/membership/discount-usage',
      method: 'GET',
      data: params
    })
  },

  // ========== 全局折扣管理（自动适用） ==========

  getGlobalDiscounts: () => {
    return request({
      url: '/admin/membership/global-discounts',
      method: 'GET'
    })
  },

  createGlobalDiscount: (data) => {
    return request({
      url: '/admin/membership/global-discounts',
      method: 'POST',
      data
    })
  },

  updateGlobalDiscount: (id, data) => {
    return request({
      url: `/admin/membership/global-discounts/${id}`,
      method: 'PUT',
      data
    })
  },

  deleteGlobalDiscount: (id) => {
    return request({
      url: `/admin/membership/global-discounts/${id}`,
      method: 'DELETE'
    })
  },

  // ========== 全局设置 ==========

  getSettings: () => {
    return request({
      url: '/admin/membership/settings',
      method: 'GET'
    })
  },

  updateSetting: (key, data) => {
    return request({
      url: `/admin/membership/settings/${key}`,
      method: 'PUT',
      data
    })
  },

  // ========== 统计 ==========

  getStats: () => {
    return request({
      url: '/admin/membership/stats',
      method: 'GET'
    })
  },

  // ========== 订单管理 ==========

  getOrders: (params) => {
    return request({
      url: '/admin/membership/orders',
      method: 'GET',
      data: params
    })
  },

  getOrderDetail: (orderId) => {
    return request({
      url: `/admin/membership/orders/${orderId}`,
      method: 'GET'
    })
  },

  updateOrderStatus: (orderId, data) => {
    return request({
      url: `/admin/membership/orders/${orderId}/status`,
      method: 'PUT',
      data
    })
  },

  refundOrder: (orderId, refundReason) => {
    return request({
      url: `/admin/membership/orders/${orderId}/refund`,
      method: 'POST',
      data: { refundReason }
    })
  },

  activateOrder: (orderId) => {
    return request({
      url: `/admin/membership/orders/${orderId}/activate`,
      method: 'POST'
    })
  },

  deleteOrder: (orderId) => {
    return request({
      url: `/admin/membership/orders/${orderId}`,
      method: 'DELETE'
    })
  },

  // ========== 激活码管理 ==========

  getActivationCodes: () => {
    return request({
      url: '/admin/membership/activation-codes',
      method: 'GET'
    })
  },

  createActivationCode: (data) => {
    return request({
      url: '/admin/membership/activation-codes',
      method: 'POST',
      data
    })
  },

  updateActivationCode: (id, data) => {
    return request({
      url: `/admin/membership/activation-codes/${id}`,
      method: 'PUT',
      data
    })
  },

  updateActivationCodeStatus: (id, status) => {
    return request({
      url: `/admin/membership/activation-codes/${id}/status`,
      method: 'PUT',
      data: { status }
    })
  },

  deleteActivationCode: (id) => {
    return request({
      url: `/admin/membership/activation-codes/${id}`,
      method: 'DELETE'
    })
  },

  // ========== 会员订阅管理 ==========

  getMemberships: (params) => {
    return request({
      url: '/admin/membership/memberships',
      method: 'GET',
      data: params
    })
  },

  adjustMembership: (userId, data) => {
    return request({
      url: `/admin/membership/memberships/${userId}/adjust`,
      method: 'POST',
      data
    })
  }
}