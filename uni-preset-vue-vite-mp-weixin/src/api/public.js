import { request } from './request.js'

export default {
  getBanners: () => {
    return request({
      url: '/banners',
      method: 'GET'
    })
  },

  getNotices: (params) => {
    return request({
      url: '/notices',
      method: 'GET',
      data: params
    })
  },

  getNoticeById: (id) => {
    return request({
      url: `/notices/${id}`,
      method: 'GET'
    })
  },

  getPanCategories: () => {
    return request({
      url: '/pan-resources/categories',
      method: 'GET'
    })
  },

  incrementNoticeViewCount: (id) => {
    return request({
      url: `/notices/${id}/view`,
      method: 'POST'
    })
  },

  getExams: (params) => {
    return request({
      url: '/exams',
      method: 'GET',
      data: params
    })
  },

  getSubjects: (params) => {
    return request({
      url: '/subjects',
      method: 'GET',
      data: params
    })
  },

  getExamTypes: () => {
    return request({
      url: '/exam-types',
      method: 'GET'
    })
  },

  getHomepageCards: (params) => {
    return request({
      url: '/homepage-cards',
      method: 'GET',
      data: params
    })
  },

  getCountdownConfig: () => {
    return request({
      url: '/public/config/countdown',
      method: 'GET'
    })
  },

  // 网盘资源相关
  getPanResources: (params) => {
    return request({
      url: '/public/pan-resources',
      method: 'GET',
      data: params
    })
  },

  getPanCategories: () => {
    return request({
      url: '/public/pan-resources/categories',
      method: 'GET'
    })
  },

  syncPanResources: (data) => {
    return request({
      url: '/public/pan-resources/sync',
      method: 'POST',
      data
    })
  },

  // 公共题库相关
  getPublicCategories: (params) => {
    return request({
      url: '/public/question-bank/categories',
      method: 'GET',
      data: params
    })
  },

  getPublicCategories: (params) => {
    return request({
      url: '/public/question-bank/categories',
      method: 'GET',
      data: params
    })
  },

  getPublicBooks: (params) => {
    return request({
      url: '/public/question-bank/books',
      method: 'GET',
      data: params
    })
  },

  getPublicQuestions: (params) => {
    return request({
      url: '/question-bank/questions',
      method: 'GET',
      data: params
    })
  },

  submitAnswer: (data) => {
    return request({
      url: '/question-bank/submit-answer',
      method: 'POST',
      data
    })
  },

  toggleFavorite: (data) => {
    return request({
      url: '/question-bank/toggle-favorite',
      method: 'POST',
      data
    })
  },

  updatePracticeProgress: (data) => {
    return request({
      url: '/question-bank/update-progress',
      method: 'POST',
      data
    })
  },

  getRelatedArticles: () => {
    return request({
      url: '/question-bank/related-articles',
      method: 'GET'
    })
  },

  getQuestionNotes: (params) => {
    return request({
      url: '/question-bank/notes',
      method: 'GET',
      data: params
    })
  },

  getNoteReplies: (params) => {
    return request({
      url: '/question-bank/notes/replies',
      method: 'GET',
      data: params
    })
  },

  addQuestionNote: (data) => {
    return request({
      url: '/question-bank/notes',
      method: 'POST',
      data
    })
  },

  updateQuestionNote: (data) => {
    return request({
      url: '/question-bank/notes',
      method: 'PUT',
      data
    })
  },

  deleteQuestionNote: (data) => {
    return request({
      url: '/question-bank/notes',
      method: 'DELETE',
      data
    })
  },

  toggleNoteLike: (data) => {
    return request({
      url: '/question-bank/notes/toggle-like',
      method: 'POST',
      data
    })
  },

  submitFeedback: (data) => {
    return request({
      url: '/public/feedback',
      method: 'POST',
      data
    })
  },

  // 政治板块相关
  getPoliticsSections: () => {
    return request({
      url: '/politics/sections',
      method: 'GET'
    })
  },
  // 管理端接口
  adminGetFeedbacks: (params) => {
    return request({
      url: '/admin/question-bank/feedbacks',
      method: 'GET',
      data: params
    })
  },
  adminUpdateFeedbackStatus: (data) => {
    return request({
      url: '/admin/question-bank/feedbacks/status',
      method: 'POST',
      data
    })
  },
  adminSearchQuestions: (params) => {
    return request({
      url: '/admin/question-bank/questions/search',
      method: 'GET',
      data: params
    })
  },
  adminUpdateQuestion: (data) => {
    return request({
      url: '/admin/question-bank/questions/update',
      method: 'POST',
      data
    })
  },
  adminAddQuestion: (data) => {
    return request({
      url: '/admin/question-bank/questions/add',
      method: 'POST',
      data
    })
  },
  adminDeleteQuestion: (data) => {
    return request({
      url: '/admin/question-bank/questions/delete',
      method: 'POST',
      data
    })
  },
  adminUpdateBook: (data) => {
    return request({
      url: '/admin/question-bank/books/update',
      method: 'POST',
      data
    })
  },
  adminAddBook: (data) => {
    return request({
      url: '/admin/question-bank/books/add',
      method: 'POST',
      data
    })
  },
  adminDeleteBook: (data) => {
    return request({
      url: '/admin/question-bank/books/delete',
      method: 'POST',
      data
    })
  },
  adminToggleBookStatus: (data) => {
    return request({
      url: '/admin/question-bank/books/toggle-status',
      method: 'POST',
      data
    })
  },
  adminGetChapters: (params) => {
    return request({
      url: '/admin/question-bank/chapters',
      method: 'GET',
      data: params
    })
  },
  adminAddChapter: (data) => {
    return request({
      url: '/admin/question-bank/chapters/add',
      method: 'POST',
      data
    })
  },
  adminUpdateChapter: (data) => {
    return request({
      url: '/admin/question-bank/chapters/update',
      method: 'POST',
      data
    })
  },
  adminDeleteChapter: (data) => {
    return request({
      url: '/admin/question-bank/chapters/delete',
      method: 'POST',
      data
    })
  },
  adminGetBooks: (params) => {
    return request({
      url: '/admin/question-bank/books',
      method: 'GET',
      data: params
    })
  },
  adminGetCategories: (params) => {
    return request({
      url: '/question-bank/categories',
      method: 'GET',
      params
    })
  },

  importPublicData: (data) => {
    return request({
      url: '/public/question-bank/import',
      method: 'POST',
      data
    })
  },

  previewImportPublicData: (data) => {
    return request({
      url: '/public/question-bank/preview-import',
      method: 'POST',
      data
    })
  },

  structureBook: (data) => {
    return request({
      url: '/public/question-bank/structure',
      method: 'POST',
      data
    })
  },
  
  getBookChapters: (params) => {
    return request({
      url: '/public/question-bank/chapters',
      method: 'GET',
      data: params
    })
  },

  getBookTypes: (params) => {
    return request({
      url: '/public/question-bank/book-types',
      method: 'GET',
      data: params
    })
  },

  clearPracticeRecord: (data) => {
    return request({
      url: '/public/question-bank/clear-record',
      method: 'POST',
      data
    })
  },
  // 管理端资料管理
  adminGetResources: (params) => {
    return request({
      url: '/admin/pan-resources',
      method: 'GET',
      data: params
    })
  },
  adminAddResource: (data) => {
    return request({
      url: '/admin/pan-resources/add',
      method: 'POST',
      data
    })
  },
  adminUpdateResource: (data) => {
    return request({
      url: '/admin/pan-resources/update',
      method: 'POST',
      data
    })
  },
  adminDeleteResource: (data) => {
    return request({
      url: '/admin/pan-resources/delete',
      method: 'POST',
      data
    })
  }
}
