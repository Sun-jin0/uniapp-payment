import { request } from './request.js'

export default {
  // 获取西医综合科目列表
  getMedCourses: (params) => {
    return request({
      url: '/med/courses',
      method: 'GET',
      data: params
    })
  },

  // 获取章节列表
  getMedChapters: (params) => {
    return request({
      url: '/med/chapters',
      method: 'GET',
      data: params
    })
  },

  // 获取年份列表
  getMedYears: () => {
    return request({
      url: '/med/years',
      method: 'GET'
    })
  },

  // 获取题目列表 (支持章节真题和历年真题模式)
  getMedQuestions: (params) => {
    return request({
      url: '/med/questions',
      method: 'GET',
      data: params
    })
  },

  // 提交答案
  submitMedAnswer: (data) => {
    return request({
      url: '/med/submit-answer',
      method: 'POST',
      data
    })
  },

  // 切换收藏状态
  toggleMedFavorite: (data) => {
    return request({
      url: '/med/toggle-favorite',
      method: 'POST',
      data
    })
  },

  // 更新练习进度
  updateMedPracticeProgress: (data) => {
    return request({
      url: '/med/update-progress',
      method: 'POST',
      data
    })
  },

  // 获取题目笔记
  getMedQuestionNotes: (params) => {
    return request({
      url: '/med/notes',
      method: 'GET',
      data: params
    })
  },

  // 获取笔记回复
  getMedNoteReplies: (params) => {
    return request({
      url: '/med/notes/replies',
      method: 'GET',
      data: params
    })
  },

  // 添加题目笔记
  addMedQuestionNote: (data) => {
    return request({
      url: '/med/notes',
      method: 'POST',
      data
    })
  },

  // 更新题目笔记
  updateMedQuestionNote: (data) => {
    return request({
      url: '/med/notes',
      method: 'PUT',
      data
    })
  },

  // 删除题目笔记
  deleteMedQuestionNote: (data) => {
    return request({
      url: '/med/notes',
      method: 'DELETE',
      data
    })
  },

  // 点赞笔记
  toggleMedNoteLike: (data) => {
    return request({
      url: '/med/notes/toggle-like',
      method: 'POST',
      data
    })
  },

  // 提交题目纠错
  submitQuestionFeedback: (data) => {
    return request({
      url: '/med/feedback',
      method: 'POST',
      data
    })
  }
}
