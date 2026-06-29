
const express = require('express');
const router = express.Router();
const AdminVideoController = require('../controllers/adminVideoController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware.adminAuth);

// Subjects
router.get('/subjects', AdminVideoController.getSubjects);
router.post('/subjects', AdminVideoController.createSubject);
router.put('/subjects/:id', AdminVideoController.updateSubject);
router.delete('/subjects/:id', AdminVideoController.deleteSubject);

// Categories
router.get('/categories', AdminVideoController.getCategories);
router.post('/categories', AdminVideoController.createCategory);
router.put('/categories/:id', AdminVideoController.updateCategory);
router.delete('/categories/:id', AdminVideoController.deleteCategory);

// Resources
router.get('/resources', AdminVideoController.getResources);
router.get('/resources/:id', AdminVideoController.getResourceDetail);
router.post('/resources', AdminVideoController.createResource);
router.put('/resources/:id', AdminVideoController.updateResource);
router.delete('/resources/:id', AdminVideoController.deleteResource);

// Batch
router.post('/resources/batch-update', AdminVideoController.batchUpdateResources);
router.post('/resources/batch-delete', AdminVideoController.batchDeleteResources);
router.post('/resources/batch-update-subject', AdminVideoController.batchUpdateBySubject);
router.post('/resources/batch-update-category', AdminVideoController.batchUpdateByCategory);

// Codes
router.post('/codes/generate', AdminVideoController.generateCodes);
router.get('/codes', AdminVideoController.getCodes);
router.delete('/codes/:id', AdminVideoController.deleteCode);

// Collections
router.get('/collections', AdminVideoController.getCollections);
router.get('/collections/:id', AdminVideoController.getCollectionDetail);
router.post('/collections', AdminVideoController.createCollection);
router.put('/collections/:id', AdminVideoController.updateCollection);
router.delete('/collections/:id', AdminVideoController.deleteCollection);
router.post('/collections/add-video', AdminVideoController.addVideoToCollection);
router.post('/collections/remove-video', AdminVideoController.removeVideoFromCollection);
router.post('/collections/update-videos', AdminVideoController.updateCollectionVideos);
router.post('/collections/generate-codes', AdminVideoController.generateCollectionCodes);

// Feedbacks & Recommendations
router.get('/feedbacks', AdminVideoController.getFeedbacks);
router.get('/recommendations', AdminVideoController.getRecommendations);
router.post('/recommendations/handle', AdminVideoController.handleRecommendation);

// Batch Import
router.post('/batch-import', AdminVideoController.batchImportVideos);

module.exports = router;
