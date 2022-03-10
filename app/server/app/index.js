require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
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

app.use(express.static(path.join(__dirname, 'app', 'public')));

app.use('/', baseRoutes);
app.use('/', authRoutes);
app.use('/api', apiRoutes);

app.get('*', (req, res, next) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
