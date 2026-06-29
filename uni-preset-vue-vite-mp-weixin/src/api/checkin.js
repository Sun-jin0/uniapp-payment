import { request } from './request.js'

export default {
  // 每日签到
  dailyCheckin: () => {
    return request({
      url: '/checkin',
      method: 'POST',
      noToast: true
    })
  },

  getCheckinRecords: () => {
    return request({
      url: '/checkin/records',
      method: 'GET',
      noToast: true
    })
  },

  // 自定义打卡
  customCheckin: (data) => {
    return request({
      url: '/checkin/custom',
      method: 'POST',
      data,
      noToast: true
    })
  },

  // 获取自定义打卡记录
  getCustomCheckinRecords: (params = {}) => {
    return request({
      url: '/checkin/custom/records',
      method: 'GET',
      data: params,
      noToast: true
    })
  },

  // 获取今日打卡状态
  getTodayCheckinStatus: () => {
    return request({
      url: '/checkin/custom/today',
      method: 'GET',
      noToast: true
    })
  },

  // 分享打卡
  shareCheckin: (checkinId) => {
    return request({
      url: `/checkin/custom/${checkinId}/share`,
      method: 'POST',
      noToast: true
    })
  }
}
