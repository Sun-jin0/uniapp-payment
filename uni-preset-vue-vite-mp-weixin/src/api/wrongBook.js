import { request } from './request.js'

export default {
  getWrongQuestions: (params) => {
    return request({
      url: '/wrong-questions',
      method: 'GET',
      data: params
    })
  },

  deleteWrongQuestion: (id) => {
    return request({
      url: `/wrong-questions/${id}`,
      method: 'DELETE'
    })
  },

  getFavorites: (params) => {
    return request({
      url: '/favorites',
      method: 'GET',
      data: params
    })
  },

  addFavorite: (data) => {
    return request({
      url: '/favorites',
      method: 'POST',
      data: data
    })
  },

  removeFavorite: (id) => {
    return request({
      url: `/favorites/${id}`,
      method: 'DELETE'
    })
  },

  getStudyStats: () => {
    return request({
      url: '/study/stats',
      method: 'GET'
    })
  },

  getLeaderboard: (type, period) => {
    return request({
      url: '/study/leaderboard',
      method: 'GET',
      data: { type, period }
    })
  },

  getRecentLearning: (limit) => {
    return request({
      url: '/study/recent',
      method: 'GET',
      data: { limit }
    })
  },

  getStudyHistory: (period) => {
    return request({
      url: '/study/history',
      method: 'GET',
      data: { period }
    })
  },

  getHomeOverview: () => {
    return request({
      url: '/study/overview',
      method: 'GET'
    })
  },

  // 获取参与排行榜设置
  getParticipateRanking: () => {
    return request({
      url: '/study/participate-ranking',
      method: 'GET'
    })
  },

  // 更新参与排行榜设置
  updateParticipateRanking: (participate) => {
    return request({
      url: '/study/participate-ranking',
      method: 'PUT',
      data: { participate }
    })
  }
}
