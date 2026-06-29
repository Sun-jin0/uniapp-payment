import { request } from './request.js'

export default {
  login: (data) => {
    return request({
      url: '/user/login',
      method: 'POST',
      data: data
    })
  },

  wechatLogin: (data) => {
    return request({
      url: '/user/wechat-login',
      method: 'POST',
      data: data
    })
  },

  register: (data) => {
    return request({
      url: '/user/register',
      method: 'POST',
      data: data
    })
  },

  getUserInfo: () => {
    return request({
      url: '/user/info',
      method: 'GET'
    })
  },

  updateUserInfo: (data) => {
    return request({
      url: '/user/info',
      method: 'PUT',
      data: data
    })
  },

  changePassword: (data) => {
    return request({
      url: '/user/change-password',
      method: 'POST',
      data: data
    })
  },

  getUserSettings: () => {
    return request({
      url: '/user/settings',
      method: 'GET'
    })
  },

  updateUserSettings: (data) => {
    return request({
      url: '/user/settings',
      method: 'PUT',
      data: data
    })
  },

  increaseQuestionCount: (data) => {
    return request({
      url: '/user/increase-question-count',
      method: 'POST',
      data: data
    })
  },

  uploadAvatar: (data) => {
    return request({
      url: '/user/upload-avatar',
      method: 'POST',
      data: data,
      header: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  getUserAvatarFrames: () => {
    return request({
      url: '/user/avatar-frames',
      method: 'GET'
    })
  },

  setUserAvatarFrame: (data) => {
    return request({
      url: '/user/avatar-frame',
      method: 'PUT',
      data: data
    })
  }
}
