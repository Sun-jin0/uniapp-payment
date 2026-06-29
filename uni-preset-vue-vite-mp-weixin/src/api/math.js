import { request } from './request';

export default {
  getSubjects: () => {
    return request({
      url: '/math/subjects',
      method: 'GET'
    });
  },

  getAllBooks: () => {
    return request({
      url: '/math/books/all',
      method: 'GET'
    });
  },

  getBooksBySubject: (subjectId) => {
    return request({
      url: '/math/books-by-subject',
      method: 'GET',
      data: { subjectId }
    });
  },

  getBookDetails: (bookId) => {
    return request({
      url: `/math/books/${bookId}`,
      method: 'GET'
    });
  },

  getQuestionsByBook: (bookId) => {
    return request({
      url: `/math/books/${bookId}/questions`,
      method: 'GET'
    });
  },

  getQuestionDetails: (questionId, bookId) => {
    return request({
      url: `/math/questions/${questionId}`,
      method: 'GET',
      data: { bookId }
    });
  }
};
