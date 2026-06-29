import { request } from './request.js'

export default {
  submitEssay: (data) => {
    return request({
      url: '/essay/correct',
      method: 'POST',
      data: data
    })
  },

  getEssayRecords: (params) => {
    return request({
      url: '/essay/records',
      method: 'GET',
      data: params
    })
  }
}
