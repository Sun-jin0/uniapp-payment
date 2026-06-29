import { request } from './request.js'

const qqGroupApi = {
  getQQGroups: () => {
    return request({
      url: '/qq-group/list',
      method: 'GET'
    })
  },

  getOrganizations: () => {
    return request({
      url: '/qq-group/organizations',
      method: 'GET'
    })
  },

  togglePin: (groupId) => {
    return request({
      url: '/qq-group/toggle-pin',
      method: 'POST',
      data: { groupId }
    })
  }
}

export default qqGroupApi
