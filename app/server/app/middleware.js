const jwt = require('jsonwebtoken');
const { createJwt } = require('./utils');

// Middleware to check for JWT, add user object to request, and create new JWT to keep alive for 15 minutes from request
const ensureAuthenticated = (req, res, next) => {
  // If no JWT passed in token cookie, send Unauthorized response or redirect
  if (!req.cookies.token) {
    return rejectRequest(req, res);
  }
  jwt.verify(req.cookies.token, process.env.JWT_PUBLIC_KEY, {}, function (err, user) {
    if (err) {
      console.error(err);
      return rejectRequest(req, res);
    }

    // Add user to the request object
    req.user = user;

    // Create new token to update expiration to 15 min from now (delete JWT-specific fields before creating new)
    delete user.iat;
    delete user.exp;
    const newToken = createJwt(user);

    // Add JWT in cookie and proceed with request
    res.cookie('token', newToken, { httpOnly: true, overwrite: true });
    next();
  });
};

const rejectRequest = (req, res) => {
  // Clear token cookie if there was an error verifying (e.g. expired)
  res.clearCookie('token');

  if (req.originalUrl.includes('/api')) {
    // Send JSON Unauthorized message if request is for an API endpoint
    return res.status(401).json({ message: 'Unauthorized' });
  }
  // For non-API requests (e.g. on logout), redirect to base URL if token is non-existent or invalid
  return res.redirect(`${process.env.CLIENT_URL || ''}/login?RelayState=${req.originalUrl}`);
};

module.exports = { ensureAuthenticated };
