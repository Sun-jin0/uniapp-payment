import axios from 'axios'
import { ElMessage } from 'element-plus'

const getBaseURL = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  if (import.meta.env.DEV) {
    return '/api'
  }
  return 'https://yizhancs.cn/api'
}

const service = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000
})

// 请求拦截器
service.interceptors.request.use(
  config => {
    // 可以在这里添加 token
    const token = localStorage.getItem('admin_token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  response => {
    if (response.config.responseType === 'blob') {
      return response.data
    }
    const res = response.data
    if (res.code !== 0 && res.code !== 200) {
      ElMessage.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    return res
  },
  error => {
    // 忽略 401 错误，防止重复提示
    if (error.response && error.response.status === 401) {
       // optional: redirect to login
    } else {
       ElMessage.error(error.message || '网络错误')
    }
    return Promise.reject(error)
  }
)

export const adminApi = {
  // 用户管理
  getUserList: (params) => service.get('/admin/users', { params }),
  updateUser: (id, data) => service.put(`/admin/users/${id}`, data),
  createUser: (data) => service.post('/admin/users', data),
  
  // 文章管理
  getNotices: (params) => service.get('/admin/notices', { params }),
  getNoticeDetail: (id) => service.get(`/admin/notices/${id}`),
  updateNotice: (id, data) => service.put(`/admin/notices/${id}`, data),
  updateNoticeStatus: (id, status) => service.put(`/admin/notices/${id}/status`, { status }),
  createNotice: (data) => service.post('/admin/notices', data),
  deleteNotice: (id) => service.delete(`/admin/notices/${id}`),
  
  // 公告分类管理
  getNoticeCategories: () => service.get('/admin/notices/categories'),
  createNoticeCategory: (data) => service.post('/admin/notices/categories', data),
  updateNoticeCategory: (id, data) => service.put(`/admin/notices/categories/${id}`, data),
  deleteNoticeCategory: (id) => service.delete(`/admin/notices/categories/${id}`),
  parseWechatUrl: (url) => service.post('/admin/articles/parse-link', { url }),
  uploadImage: (file) => {
    const formData = new FormData()
    formData.append('image', file)
    return service.post('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  
  // 视频管理 (VideoAdmin 已经在使用之前的逻辑，这里为了统一也加上)
  getVideoResources: (params) => service.get('/admin/video-resources', { params }),
  updateVideoResource: (id, data) => service.put(`/admin/video-resources/${id}`, data),
  createVideoResource: (data) => service.post('/admin/video-resources', data),
  deleteVideoResource: (id) => service.delete(`/admin/video-resources/${id}`),
  
  // 轮播图管理
  getBanners: () => service.get('/admin/banners'),
  updateBanner: (id, data) => service.put(`/admin/banners/${id}`, data),
  updateBannerStatus: (id, status) => service.put(`/admin/banners/${id}/status`, { status }),
  createBanner: (data) => service.post('/admin/banners', data),
  deleteBanner: (id) => service.delete(`/admin/banners/${id}`),
  
  // 首页卡片
  getHomepageCards: () => service.get('/admin/homepage-cards'),
  updateHomepageCard: (id, data) => service.put(`/admin/homepage-cards/${id}`, data),
  createHomepageCard: (data) => service.post('/admin/homepage-cards', data),
  deleteHomepageCard: (id) => service.delete(`/admin/homepage-cards/${id}`),
  
  // 公共题库分类管理
  updatePublicCategory: (id, data) => service.post('/admin/question-bank/categories/update', { id, ...data }),
  createPublicCategory: (data) => service.post('/admin/question-bank/categories/add', data),
  deletePublicCategory: (id) => service.post('/admin/question-bank/categories/delete', { id }),
  
  // 题库管理 (通用 dispatcher)
  getQuestions: (type, params) => {
    const map = {
      'math': '/math/admin/search-questions',
      'computer': '/computer1/admin/questions',
      'public': '/admin/question-bank/questions/search',
      'med': '/med/admin/questions',
      'politics': '/admin/questions'
    }
    return service.get(map[type] || '/admin/questions', { params })
  },
  updateQuestion: (type, id, data) => {
    const map = {
      'math': `/math/admin/questions/${id}`,
      'computer': `/computer1/admin/questions/${id}`,
      'public': `/admin/question-bank/questions/update`, // Public uses POST for update usually based on publicRoutes
      'med': `/med/questions/${id}`
    }
    if (type === 'public') {
      return service.post(map[type], { id, ...data })
    }
    return service.put(map[type] || `/admin/questions/${id}`, data)
  },
  createQuestion: (type, data) => {
    const map = {
      'math': '/math/admin/questions',
      'computer': '/computer1/admin/questions', // Computer might not have create yet or uses import
      'public': '/admin/question-bank/questions/add',
      'med': '/med/admin/questions'
    }
    return service.post(map[type] || '/admin/questions', data)
  },
  deleteQuestion: (type, id) => {
    const map = {
      'math': `/math/admin/questions/${id}`,
      'computer': `/computer1/admin/questions/${id}`,
      'public': `/admin/question-bank/questions/delete`,
      'med': `/med/questions/${id}`
    }
    if (type === 'public') {
      return service.post(map[type], { id })
    }
    return service.delete(map[type] || `/admin/questions/${id}`)
  },
  importQuestions: (subject, data) => {
    // 根据科目分发到不同的导入接口
    const importMap = {
      'med': '/admin/med/import',
      'math': '/math/admin/import-questions',
      'computer': '/computer1/import',
      'politics': '/admin/politics/import', 
      'public': '/admin/question-bank/import'
    }
    const url = importMap[subject] || `/admin/questions/${subject}/import`
    
    // 适配不同后端的参数结构
    let payload = data
    if (subject === 'med') {
      payload = { filename: data.filename, jsonData: data.data }
    } else if (subject === 'math') {
      payload = { questions: data.data, bookId: data.bookId }
    } else if (subject === 'computer') {
      payload = { questions: data.data }
    }
    
    return service.post(url, payload)
  },
  getMedFiles: () => service.get('/admin/med/files'), // adminRoutes -> /med/files
  importMedFile: (data) => service.post('/admin/med/import', data), // adminRoutes -> /med/import

  // Dashboard
  getDashboardStats: () => service.get('/admin/stats'),

  // Configs
  getConfigs: () => service.get('/admin/configs'),
  saveConfigs: (data) => service.post('/admin/configs', data),

  // Public Management (Shared)
  getPublicCategories: (params) => service.get('/admin/question-bank/categories', { params }),
  
  // Politics Management
  getPoliticsSectionBooks: (sectionId) => service.get(`/admin/politics/sections/${sectionId}/books`),

  // Math Management
  getMathCorrections: (params) => service.get('/math/admin/corrections', { params }),
  ignoreMathCorrection: (id) => service.put(`/math/admin/corrections/${id}`, { status: 'ignored' }),
  updateMathCorrectionStatus: (id, data) => service.put(`/math/admin/corrections/${id}`, data),
  getMathBooks: (params) => service.get('/math/admin/books', { params }),
  getMathBookChapters: (bookId) => service.get(`/math/admin/books/${bookId}/chapters`),
  addMathBookChapter: (bookId, data) => service.post(`/math/admin/books/${bookId}/chapters`, data),
  updateMathBookChapter: (bookId, chapterName, data) => service.put(`/math/admin/books/${bookId}/chapters/${encodeURIComponent(chapterName)}`, data),
  deleteMathBookChapter: (bookId, chapterName) => service.delete(`/math/admin/books/${bookId}/chapters/${encodeURIComponent(chapterName)}`),
  getMathBookQuestions: (bookId) => service.get(`/math/admin/books/${bookId}/questions`),
  getMathBookChapterQuestions: (bookId, chapterName) => service.get(`/math/admin/books/${bookId}/chapters/${encodeURIComponent(chapterName)}/questions`),
  deleteMathBookQuestion: (bookId, questionId) => service.delete(`/math/admin/books/${bookId}/questions/${questionId}`),
  batchDeleteMathBookQuestions: (bookId, questionIds) => service.post(`/math/admin/books/${bookId}/questions/batch-delete`, { questionIds }),
  addQuestionsToMathBook: (bookId, data) => service.post(`/math/admin/books/${bookId}/add-questions`, data),
  getMathSubjects: () => service.get('/math/subjects'),
  searchMathQuestions: (params) => service.get('/math/admin/search-questions', { params }),
  getMathQuestionDetail: (id) => service.get(`/math/admin/questions/${id}/detail`),
  updateMathQuestion: (id, data) => service.put(`/math/admin/questions/${id}`, data),
  submitMathCorrection: (data) => service.post('/math/admin/corrections', data),
  createMathQuestion: (data) => service.post('/math/admin/questions', data),
  deleteMathQuestion: (id) => service.delete(`/math/admin/questions/${id}`),
  createMathBook: (data) => service.post('/math/admin/books', data),
  updateMathBook: (id, data) => service.put(`/math/admin/books/${id}`, data),
  deleteMathBook: (id) => service.delete(`/math/admin/books/${id}`),
  // Math Knowledge Points
  getMathKnowledgeCategories: () => service.get('/math/admin/knowledge-categories'),
  createKnowledgeCategory: (data) => service.post('/math/admin/knowledge-categories', data),
  updateKnowledgeCategory: (id, data) => service.put(`/math/admin/knowledge-categories/${id}`, data),
  getAllMathKnowledgePoints: () => service.get('/math/admin/knowledge-points/all'),
  getQuestionsByKnowledgeCategory: (categoryId) => service.get(`/math/admin/knowledge-categories/${categoryId}/questions`),
  removeQuestionFromCategory: (categoryId, questionId) => service.delete(`/math/admin/knowledge-categories/${categoryId}/questions/${questionId}`),
  getRelatedQuestions: (questionId) => service.get(`/math/related-questions/${questionId}`),
  fixMathKnowledgePointLinks: (dryRun = true) => service.post('/math/admin/fix-knowledge-point-links', { dryRun }, { timeout: 300000 }),
  getKnowledgePointQuestionCount: (kpTitle) => service.get('/math/admin/knowledge-point-question-count', { params: { kpTitle } }),
  getKnowledgePointQuestionCountsBatch: (kpTitles) => service.post('/math/admin/knowledge-point-question-counts', { kpTitles }),
  searchKnowledgePoints: (keyword) => service.get('/math/admin/knowledge-points/search', { params: { keyword } }),
  
  // Math Import
  importMathFromFiles: (data) => {
    // 将前端参数映射到后端 importComplexQuestions 需要的格式
    const payload = {
      mapping: data.structData || [],
      details: data.detailsData || {},
      questions: data.questionsData || [],
      config: {
        subjectId: data.subjectId,
        contentType: data.contentType
      }
    }
    console.log('API 发送数据:', payload)
    return service.post('/math/admin/import-complex-questions', payload, { timeout: 0 })
  },
  // 从JSON导入试卷（去重合集.json + 去重索引.json）
  importMathPapersFromJson: (data) => {
    return service.post('/math/admin/import-papers-from-json', data, { timeout: 300000 })
  },
  // 从试卷提取页导入单个试卷
  importMathExtractedPaper: (data) => {
    return service.post('/math/admin/import-extracted-paper', data)
  },

  // Med Management Aliases (Specific to Med Module)
  getMedCourses: () => service.get('/med/admin/courses'),
  getMedChapters: (params) => service.get('/med/admin/chapters', { params }),
  getMedFeedbacks: (params) => service.get('/med/feedbacks', { params }),
  searchMedQuestions: (params) => service.get('/med/admin/questions', { params }),
  updateMedFeedbackStatus: (id, data) => service.put(`/med/feedbacks/${id}`, data),
  getMedQuestionDetail: (id) => service.get(`/med/questions/${id}`),
  updateMedQuestion: (id, data) => service.put(`/med/questions/${id}`, data),
  updateMedCourse: (id, data) => service.put(`/med/admin/courses/${id}`, data),
  updateMedChapter: (id, data) => service.put(`/med/admin/chapters/${id}`, data),

  // Question Management (Courses/Subjects dispatcher)
  getCourses: (type) => {
    const map = {
      'math': '/math/subjects',
      'computer': '/computer1/subjects',
      'public': '/subjects', // publicRoutes -> /subjects
      'med': '/med/admin/courses',
      'politics': '/politics/sections' // politicsRoutes -> /politics/sections
    }
    // Default to /admin/subjects if type is undefined or empty
    return service.get(map[type] || '/admin/subjects')
  },
  getFeedbacks: (type, params) => {
    const map = {
      'math': '/math/admin/corrections',
      'computer': '/computer1/feedbacks', // computer1Routes -> /computer1/feedbacks
      'public': '/admin/question-bank/feedbacks', // publicRoutes -> /admin/question-bank/feedbacks
      'med': '/med/feedbacks'
    }
    return service.get(map[type] || '/admin/question-bank/feedbacks', { params })
  },
  updateFeedback: (type, id, data) => {
    const map = {
      'computer': `/computer1/feedbacks/${id}`,
      'public': `/admin/question-bank/feedbacks/status`,
      'med': `/med/feedbacks/${id}`
    }
    if (type === 'public') {
      return service.post(map[type], { ids: [id], status: data.status })
    }
    return service.put(map[type] || `/admin/question-bank/feedbacks/${id}`, data)
  },
  replyFeedback: (type, id, data) => service.post(`/admin/questions/${type}/feedbacks/${id}/reply`, data),
  
  // Nav Subjects (Shared)
  getNavSubjects: () => service.get('/admin/nav-subjects'),
  // Alias for legacy calls
  getSubjects: () => service.get('/admin/nav-subjects'),
  getAdminSubjects: () => service.get('/admin/subjects'),
  
  // Missing methods restoration
  getBooks: (params) => service.get('/admin/question-bank/books', { params }), // publicRoutes -> /admin/question-bank/books
  getChapters: (params) => service.get('/admin/chapters', { params }), // adminRoutes -> /chapters
  createChapter: (data) => service.post('/admin/chapters', data),
  updateChapter: (id, data) => service.put(`/admin/chapters/${id}`, data),
  deleteChapter: (id) => service.delete(`/admin/chapters/${id}`),
  
  getCourseChapters: (type, courseId) => {
    const map = {
      'math': `/math/admin/books/${courseId}/chapters`,
      'computer': '/computer1/chapters', // computer1Routes -> /computer1/chapters
      'public': '/question-bank/chapters', // publicRoutes -> /question-bank/chapters
      'med': '/med/admin/chapters'
    }
    // If specific math chapters endpoint doesn't exist, we might need to fallback or use book details
    return service.get(map[type] || '/admin/chapters', { params: { courseId, subjectId: courseId, course_id: courseId } })
  },

  // Computer Management
  getComputerSubjects: () => service.get('/computer1/subjects'),
  getComputerChapters: (params) => service.get('/computer1/chapters', { params }),
  getComputerFeedbacks: (params) => service.get('/computer1/feedbacks', { params }),
  searchComputerQuestions: (params) => service.get('/computer1/admin/questions', { params }),
  getComputerQuestionDetail: (id) => service.get(`/computer1/questions/${id}`),
  updateComputerQuestion: (id, data) => service.put(`/computer1/admin/questions/${id}`, data),
  deleteComputerQuestion: (id) => service.delete(`/computer1/admin/questions/${id}`),
  updateComputerFeedbackStatus: (id, data) => service.put(`/computer1/feedbacks/${id}`, data),
  importComputerPaper: (data) => service.post('/computer1/import-paper', data, { timeout: 300000 }),
  // 考点分类管理
  getComputerKnowledgeTags: (params) => service.get('/computer1/admin/tags', { params }),
  getAllComputerKnowledgeTags: () => service.get('/computer1/admin/tags/all'),
  createComputerKnowledgeTag: (data) => service.post('/computer1/admin/tags', data),
  updateComputerKnowledgeTag: (id, data) => service.put(`/computer1/admin/tags/${id}`, data),
  deleteComputerKnowledgeTag: (id) => service.delete(`/computer1/admin/tags/${id}`),
  getComputerTagQuestions: (tagId) => service.get(`/computer1/admin/tags/${tagId}/questions`),
  
  // 计算机试卷管理
  getComputerPaperList: (params) => service.get('/computer1/admin/papers', { params }),
  getComputerPaperDetail: (id) => service.get(`/computer1/admin/papers/${id}`),
  updateComputerPaper: (id, data) => service.put(`/computer1/admin/papers/${id}`, data),
  updateComputerPaperQuestions: (id, data) => service.put(`/computer1/admin/papers/${id}/questions`, data),
  deleteComputerPaper: (id, deleteQuestions = false) => service.delete(`/computer1/admin/papers/${id}`, { params: { deleteQuestions } }),
  calibrateComputerPaper: (id) => service.post(`/computer1/admin/papers/${id}/calibrate`),
  syncComputerPaperInfo: (id) => service.post(`/computer1/admin/papers/${id}/sync`),

  // 教辅管理
  getTutorials: (params) => service.get('/computer/tutorials', { params }),
  getTutorialDetail: (id) => service.get(`/computer/tutorials/${id}`),
  createTutorial: (data) => service.post('/computer/tutorials', data),
  updateTutorial: (id, data) => service.put(`/computer/tutorials/${id}`, data),
  deleteTutorial: (id) => service.delete(`/computer/tutorials/${id}`),
  getTutorialChapters: (tutorialId) => service.get(`/computer/tutorials/${tutorialId}/chapters`),
  createTutorialChapter: (tutorialId, data) => service.post(`/computer/tutorials/${tutorialId}/chapters`, data),
  updateTutorialChapter: (chapterId, data) => service.put(`/computer/tutorial-chapters/${chapterId}`, data),
  deleteTutorialChapter: (chapterId) => service.delete(`/computer/tutorial-chapters/${chapterId}`),
  getChapterQuestions: (chapterId) => service.get(`/computer/tutorial-chapters/${chapterId}/questions`),
  getTutorialQuestions: (tutorialId) => service.get(`/computer/tutorials/${tutorialId}/questions`),
  addTutorialQuestion: (data) => service.post('/computer/tutorial-questions', data),
  importTutorial: (data) => service.post('/computer/tutorials/import', data),
  resetTutorialIds: () => service.post('/computer/tutorials/reset-ids'),
  // 教辅合集管理
  getTutorialCollections: (params) => service.get('/computer/tutorial-collections', { params }),
  getTutorialCollectionDetail: (id) => service.get(`/computer/tutorial-collections/${id}`),
  createTutorialCollection: (data) => service.post('/computer/tutorial-collections', data),
  updateTutorialCollection: (id, data) => service.put(`/computer/tutorial-collections/${id}`, data),
  deleteTutorialCollection: (id) => service.delete(`/computer/tutorial-collections/${id}`),
  
  // 图片管理
  getImageStats: () => service.get('/admin/images/stats'),
  getImageList: (params) => service.get('/admin/images', { params }),
  deleteImage: (id) => service.delete(`/admin/images/${id}`),
  getImageDetail: (id) => service.get(`/admin/images/${id}`),
  updateImageUsage: (id, data) => service.put(`/admin/images/${id}/usage`, data),
  scanAllImages: (data) => service.post('/admin/images/scan', data),
  
  // 打卡管理
  getCheckinCategories: () => service.get('/checkin-category/admin/categories'),
  createCheckinCategory: (data) => service.post('/checkin-category/categories', data),
  updateCheckinCategory: (id, data) => service.put(`/checkin-category/categories/${id}`, data),
  deleteCheckinCategory: (id) => service.delete(`/checkin-category/categories/${id}`),
  getCheckinRecords: (params) => service.get('/checkin-category/admin/records', { params }),
  deleteCheckinRecord: (id) => service.delete(`/checkin-category/admin/records/${id}`),
  getCheckinComments: (params) => service.get('/checkin-category/admin/comments', { params }),
  deleteCheckinComment: (id) => service.delete(`/checkin-category/admin/comments/${id}`),
  getPreRegisters: (categoryId) => service.get(`/checkin-category/admin/categories/${categoryId}/pre-registers`),
  getUserRecordsByCategory: (categoryId, userId) => service.get(`/checkin-category/admin/categories/${categoryId}/users/${userId}/records`),
  exportRecords: (params) => service.get('/checkin-category/admin/export', { params, responseType: 'blob' }),
}

export const publicApi = {
  getPublicCategories: (params) => service.get('/question-bank/categories', { params }),
  getPublicBooks: (params) => service.get('/admin/question-bank/books', { params }),
  createBook: (data) => service.post('/admin/question-bank/books/add', data),
  updateBook: (id, data) => service.post('/admin/question-bank/books/update', { id, ...data }),
  deleteBook: (id) => service.post('/admin/question-bank/books/delete', { id }),
  getChapters: (params) => service.get('/admin/question-bank/chapters', { params }),
  createChapter: (data) => service.post('/admin/question-bank/chapters/add', data),
  updateChapter: (id, data) => service.post('/admin/question-bank/chapters/update', { id, ...data }),
  deleteChapter: (id) => service.post('/admin/question-bank/chapters/delete', { id }),
  updatePublicCategory: (id, data) => service.post('/admin/question-bank/categories/update', { id, ...data }),
  createPublicCategory: (data) => service.post('/admin/question-bank/categories/add', data),
  deletePublicCategory: (id) => service.post('/admin/question-bank/categories/delete', { id }),
  importPublicData: (data) => service.post('/question-bank/import', data),
  previewImportPublicData: (data) => service.post('/question-bank/preview-import', data),
  structureBook: (data) => service.post('/question-bank/structure', data),
  getFeedbacks: (params) => service.get('/admin/question-bank/feedbacks', { params }),
  replyFeedback: (id, data) => service.post(`/admin/question-bank/feedbacks/status`, { ids: [id], ...data }),
  updateFeedbackStatus: (id, status) => service.post(`/admin/question-bank/feedbacks/status`, { ids: [id], status }),
  batchUpdateFeedbackStatus: (ids, status) => service.post('/admin/question-bank/feedbacks/status', { ids, status }),
  getQuestions: (params) => service.get('/admin/question-bank/questions/search', { params }),
  getQuestionDetail: (id) => service.get(`/admin/question-bank/questions/${id}`),
  updateQuestion: (id, data) => service.post(`/admin/question-bank/questions/update`, { id, ...data }),
  createQuestion: (data) => service.post('/admin/question-bank/questions/add', data),
  deleteQuestion: (id) => service.post(`/admin/question-bank/questions/delete`, { id }),
  batchDeleteQuestions: (ids) => service.post('/admin/question-bank/questions/delete', { ids }),
  getResources: (params) => service.get('/admin/pan-resources', { params }),
  createResource: (data) => service.post('/admin/pan-resources/add', data),
  updateResource: (id, data) => service.post(`/admin/pan-resources/update`, { id, ...data }),
  deleteResource: (id) => service.post(`/admin/pan-resources/delete`, { id }),
}

export const adminVideoApi = {
  getSubjects: () => service.get('/admin/video/subjects'),
  createSubject: (data) => service.post('/admin/video/subjects', data),
  updateSubject: (id, data) => service.put(`/admin/video/subjects/${id}`, data),
  deleteSubject: (id) => service.delete(`/admin/video/subjects/${id}`),
  
  createCategory: (data) => service.post('/admin/video/categories', data),
  updateCategory: (id, data) => service.put(`/admin/video/categories/${id}`, data),
  deleteCategory: (id) => service.delete(`/admin/video/categories/${id}`),

  getResources: (params) => service.get('/admin/video/resources', { params }),
  getResourceDetail: (id) => service.get(`/admin/video/resources/${id}`),
  createResource: (data) => service.post('/admin/video/resources', data),
  updateResource: (id, data) => service.put(`/admin/video/resources/${id}`, data),
  deleteResource: (id) => service.delete(`/admin/video/resources/${id}`),
  batchUpdateResources: (ids, data) => service.post('/admin/video/resources/batch-update', { ids, ...data }),
  batchDeleteResources: (ids) => service.post('/admin/video/resources/batch-delete', { ids }),
  batchUpdateBySubject: (subjectId, data) => service.post(`/admin/video/subjects/${subjectId}/batch-update`, data),
  batchUpdateByCategory: (categoryId, data) => service.post(`/admin/video/categories/${categoryId}/batch-update`, data),

  getCodes: (params) => service.get('/admin/video/codes', { params }),
  generateCodes: (data) => service.post('/admin/video/codes/generate', data),
  
  getFeedbacks: (params) => service.get('/admin/video/feedbacks', { params }),
  parseBiliLink: (url) => service.post('/admin/video/parse-bili', { url }),
}

// Combine all into adminApi for default export (backward compatibility)
Object.assign(adminApi, {
  // Politics Section
  getPoliticsSections: () => service.get('/admin/politics/sections'),
  getSectionBooks: (sectionId) => service.get(`/admin/politics/sections/${sectionId}/books`),
  createPoliticsSection: (data) => service.post('/admin/politics/sections', data),
  updatePoliticsSection: (id, data) => service.put(`/admin/politics/sections/${id}`, data),
  deletePoliticsSection: (id) => service.delete(`/admin/politics/sections/${id}`),
  addPoliticsBookToSection: (sectionId, data) => service.post(`/admin/politics/sections/${sectionId}/books`, data),
  removePoliticsBookFromSection: (sectionId, bookId) => service.delete(`/admin/politics/sections/${sectionId}/books/${bookId}`),

  // 试卷提取
  savePaperQuestion: (questionId, questionData) => service.post('/admin/math/paper-extract/save-question', { questionId, questionData }),

  // Pan Resources
  getPanResources: (params) => service.get('/admin/pan-resources', { params }),
  getPanCategories: (full = false) => service.get('/admin/pan-categories', { params: { full } }),
  createPanCategory: (data) => service.post('/admin/pan-categories', data),
  updatePanCategory: (id, data) => service.put(`/admin/pan-categories/${id}`, data),
  deletePanCategory: (id) => service.delete(`/admin/pan-categories/${id}`),
  createPanResource: (data) => service.post('/admin/pan-resources', data),
  updatePanResource: (id, data) => service.put(`/admin/pan-resources/${id}`, data),
  deletePanResource: (id) => service.delete(`/admin/pan-resources/${id}`),
  parsePanResources: (data) => service.post('/admin/pan-resources/parse', data),
  batchDeletePanResources: (data) => service.post('/admin/pan-resources/batch-delete', data),

  // Nav Management
  getNavSubjects: () => service.get('/admin/nav-subjects'),
  getNavCategories: (params) => service.get('/admin/nav-categories', { params }),
  createNavSubject: (data) => service.post('/admin/nav-subjects', data),
  updateNavSubject: (id, data) => service.put(`/admin/nav-subjects/${id}`, data),
  deleteNavSubject: (id) => service.delete(`/admin/nav-subjects/${id}`),
  createNavCategory: (data) => service.post('/admin/nav-categories', data),
  updateNavCategory: (id, data) => service.put(`/admin/nav-categories/${id}`, data),
  deleteNavCategory: (id) => service.delete(`/admin/nav-categories/${id}`),

  // 会员管理 (membership-admin 同款功能)
  getMembershipStats: () => service.get('/admin/membership/stats'),
  getCardTypes: () => service.get('/admin/membership/card-types'),
  createCardType: (data) => service.post('/admin/membership/card-types', data),
  updateCardType: (id, data) => service.put(`/admin/membership/card-types/${id}`, data),
  deleteCardType: (id) => service.delete(`/admin/membership/card-types/${id}`),

  getActivationCodes: () => service.get('/admin/membership/activation-codes'),
  createActivationCode: (data) => service.post('/admin/membership/activation-codes', data),
  updateActivationCode: (id, data) => service.put(`/admin/membership/activation-codes/${id}`, data),
  updateActivationCodeStatus: (id, status) => service.put(`/admin/membership/activation-codes/${id}/status`, { status }),
  deleteActivationCode: (id) => service.delete(`/admin/membership/activation-codes/${id}`),

  getDiscounts: () => service.get('/admin/membership/discounts'),
  createDiscount: (data) => service.post('/admin/membership/discounts', data),
  updateDiscount: (id, data) => service.put(`/admin/membership/discounts/${id}`, data),
  deleteDiscount: (id) => service.delete(`/admin/membership/discounts/${id}`),

  getGlobalDiscounts: () => service.get('/admin/membership/global-discounts'),
  createGlobalDiscount: (data) => service.post('/admin/membership/global-discounts', data),
  updateGlobalDiscount: (id, data) => service.put(`/admin/membership/global-discounts/${id}`, data),
  deleteGlobalDiscount: (id) => service.delete(`/admin/membership/global-discounts/${id}`),

  getMembershipOrders: (params) => service.get('/admin/membership/orders', { params }),
  getMembershipOrderDetail: (orderNo) => service.get(`/admin/membership/orders/${orderNo}`),
  updateMembershipOrderStatus: (orderNo, status) => service.put(`/admin/membership/orders/${orderNo}/status`, { status }),
  refundMembershipOrder: (orderNo) => service.post(`/admin/membership/orders/${orderNo}/refund`),
  deleteMembershipOrder: (orderNo) => service.delete(`/admin/membership/orders/${orderNo}`),

  getMemberships: (params) => service.get('/admin/membership/memberships', { params }),
  adjustMembership: (userId, data) => service.post(`/admin/membership/memberships/${userId}/adjust`, data),

  getMembershipSettings: () => service.get('/admin/membership/settings'),
  updateMembershipSetting: (key, value) => service.put(`/admin/membership/settings/${key}`, { value }),
})

export { service }
export default adminApi
