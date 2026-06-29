import { request } from './request.js'

export default {
  getQuestions: (params) => {
    return request({
      url: '/questions',
      method: 'GET',
      data: params
    })
  },

  getQuestionById: (id) => {
    return request({
      url: `/questions/${id}`,
      method: 'GET'
    })
  },

  submitPractice: (data) => {
    return request({
      url: '/practice/submit',
      method: 'POST',
      data: data
    })
  },

  submitExam: (data) => {
    return request({
      url: '/exam/submit',
      method: 'POST',
      data: data
    })
  },

  getExamResult: (params) => {
    return request({
      url: '/exam/result',
      method: 'GET',
      data: params
    })
  }
}
