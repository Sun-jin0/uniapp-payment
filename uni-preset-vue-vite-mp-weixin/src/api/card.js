import { request } from './request.js'

const cardApi = {
  // 获取奖池（公开接口）
  getPool() {
    return request({
      url: '/cards/pool',
      method: 'GET'
    })
  },

  // 获取所有卡片
  getAllCards() {
    return request({
      url: '/cards/list',
      method: 'GET'
    })
  },

  // 获取我的卡片
  getMyCards() {
    return request({
      url: '/cards/my',
      method: 'GET'
    })
  },

  // 检查今日是否已抽取
  checkTodayDraw() {
    return request({
      url: '/cards/check-today',
      method: 'GET'
    })
  },

  // 抽取卡片
  drawCard() {
    return request({
      url: '/cards/draw',
      method: 'POST'
    })
  },

  // 获取用户抽卡统计
  getUserStats() {
    return request({
      url: '/cards/stats',
      method: 'GET'
    })
  },

  // 获取抽卡历史
  getDrawHistory(limit = 30) {
    return request({
      url: '/cards/history',
      method: 'GET',
      data: { limit }
    })
  },

  // 获取剩余抽卡次数
  getRemainingDraws() {
    return request({
      url: '/cards/remaining',
      method: 'GET'
    })
  },

  // 增加抽卡次数
  addDrawCount(data) {
    return request({
      url: '/cards/add-count',
      method: 'POST',
      data
    })
  },

  // 管理员：创建卡片
  createCard(data) {
    return request({
      url: '/cards/create',
      method: 'POST',
      data
    })
  },

  // 管理员：更新卡片
  updateCard(id, data) {
    return request({
      url: `/cards/update/${id}`,
      method: 'PUT',
      data
    })
  },

  // 管理员：删除卡片
  deleteCard(id) {
    return request({
      url: `/cards/delete/${id}`,
      method: 'DELETE'
    })
  },

  // 管理员：获取卡片统计
  getCardStats() {
    return request({
      url: '/cards/stats',
      method: 'GET'
    })
  }
}

export default cardApi
