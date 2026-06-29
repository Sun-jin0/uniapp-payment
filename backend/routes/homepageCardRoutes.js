const express = require('express');
const router = express.Router();
const homepageCardController = require('../controllers/homepageCardController');
const { auth, adminAuth } = require('../middleware/auth');

// Public route
router.get('/homepage-cards', homepageCardController.getPublicCards);

// Admin routes
router.get('/admin/homepage-cards', auth, adminAuth, homepageCardController.getAdminCards);
router.post('/admin/homepage-cards', auth, adminAuth, homepageCardController.createCard);
router.put('/admin/homepage-cards/:id', auth, adminAuth, homepageCardController.updateCard);
router.delete('/admin/homepage-cards/:id', auth, adminAuth, homepageCardController.deleteCard);

module.exports = router;
