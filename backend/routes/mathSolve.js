const express = require('express');
const router = express.Router();

router.get('/solve', (req, res) => {
  res.json({ code: 0, message: 'Math solve API is available' });
});

module.exports = router;
