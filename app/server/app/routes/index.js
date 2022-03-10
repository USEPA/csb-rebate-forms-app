const express = require('express');

const router = express.Router();

router.get('/status', (req, res, next) => {
  res.json({ running: true });
});

module.exports = router;
