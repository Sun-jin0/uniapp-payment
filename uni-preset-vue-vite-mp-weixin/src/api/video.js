
import request from './request';

export default {
  // Get Subjects Tree
  getSubjects() {
    return request.get('/video/subjects');
  },
  // Get Video List
  getVideos(params) {
    return request.get('/video/list', params);
  },
  // Get Detail
  getVideoDetail(id) {
    return request.get(`/video/detail/${id}`);
  },
  // Get Play URL
  getPlayUrl(id, index) {
    return request.get(`/video/play-url/${id}/${index}`);
  },
  // Redeem
  redeem(data) {
    return request.post('/video/redeem', data);
  },
  // Favorite
  toggleFavorite(resourceId) {
    return request.post('/video/favorite', { resourceId });
  },
  // Feedback
  submitFeedback(data) {
    return request.post('/video/feedback', data);
  },
  // My Videos
  getMyVideos(type) {
    return request.get('/video/my-videos', { type });
  },
  // Get Collection Videos
  getCollectionVideos(collectionId) {
    return request.get(`/video/collection/${collectionId}/videos`);
  },
  // Update Video Progress
  updateProgress(data) {
    return request.post('/video/progress', data);
  },
  recommendVideo(data) {
    return request.post('/video/recommend', data);
  },
};
