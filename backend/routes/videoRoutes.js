
const express = require('express');
const router = express.Router();
const VideoController = require('../controllers/videoController');
const VideoCollection = require('../models/VideoCollection');
const authMiddleware = require('../middleware/auth');

// Public
router.get('/subjects', VideoController.getSubjects);
router.get('/list', authMiddleware.optionalAuth, VideoController.getVideos);
router.get('/proxy', VideoController.proxyVideo);
router.get('/parse-bili', VideoController.parseBiliLink);

// Collections
router.get('/collections', VideoController.getCollections);
router.get('/collections/:id', VideoController.getCollectionDetail);
router.get('/collection/:id/videos', authMiddleware.auth, VideoController.getCollectionVideos);
router.post('/progress', authMiddleware.auth, VideoController.updateProgress);

// User
router.get('/detail/:vid', authMiddleware.optionalAuth, VideoController.getVideoDetail);
router.get('/play-url/:vid/:index', authMiddleware.auth, VideoController.getPlayUrl);
router.post('/redeem', authMiddleware.auth, VideoController.redeem);
router.post('/favorite', authMiddleware.auth, VideoController.toggleFavorite);
router.post('/feedback', authMiddleware.auth, VideoController.submitFeedback);
router.get('/my-videos', authMiddleware.auth, VideoController.getMyVideos);
router.get('/my-collections', authMiddleware.auth, VideoController.getMyCollections);
router.post('/recommend', authMiddleware.auth, VideoController.recommendVideo);

module.exports = router;
