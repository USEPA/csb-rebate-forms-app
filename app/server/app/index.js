require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const history = require('connect-history-api-fallback');
const passport = require('passport');
const samlStrategy = require('./config/samlStrategy');

const baseRoutes = require('./routes');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();
const port = process.env.PORT || 3001;

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use(passport.initialize());
passport.use('saml', samlStrategy);

app.use('/', baseRoutes);
app.use('/', authRoutes);
app.use('/api', apiRoutes);

/*
 * Set up history fallback to provide direct access to react router routes
 * Note: must come AFTER api routes and BEFORE static serve of react files
 */
app.use(history());

// Serve static react-based front-end from build folder
app.use(express.static(path.resolve(__dirname, '../build')));

app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
