const express = require('express');
const { ensureAuthenticated } = require('../middleware');

const router = express.Router();

router.get('/user', ensureAuthenticated, function (req, res) {
  res.json(req.user);
});

module.exports = router;
