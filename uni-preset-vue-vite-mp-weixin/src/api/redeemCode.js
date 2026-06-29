import { request } from './request.js'

export default {
  generateRedeemCode: (data) => {
    return request({
      url: '/redeem-codes/generate',
      method: 'POST',
      data: data
    })
  },

  getRedeemCodeList: (params) => {
    return request({
      url: '/redeem-codes',
      method: 'GET',
      data: params
    })
  },

  verifyRedeemCode: (data) => {
    return request({
      url: '/redeem-codes/verify',
      method: 'POST',
      data: data
    })
  }
}
