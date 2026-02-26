const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/auth');
const certificateRoutes = require('./routes/certificates');
const publicRoutes = require('./routes/public');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(compression());
app.use(morgan(IS_PRODUCTION ? 'combined' : 'dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Lightweight health endpoint for platform checks (no DB/session dependency).
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

app.use(session({
  name: 'certi.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true, // add this
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI, ttl: 14 * 24 * 60 * 60 }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use((req, res, next) => {
  res.locals.currentAdmin = req.session.admin || null;
  res.locals.alert = req.session.alert || null;
  delete req.session.alert;
  next();
});

app.use('/', publicRoutes);
app.use('/admin', authRoutes);
app.use('/admin', certificateRoutes);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).render('error', {
    title: 'Server Error',
    message: 'Something went wrong. Please try again.'
  });
});

async function startServer() {
  if (
    !process.env.MONGODB_URI ||
    !process.env.SESSION_SECRET ||
    !process.env.ADMIN_USERNAME ||
    (!process.env.ADMIN_PASSWORD_HASH && !process.env.ADMIN_PASSWORD)
  ) {
    throw new Error('Missing required environment variables. Check .env.example');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
  });

  // Connect to MongoDB with retry; don't crash process before healthcheck succeeds.
  const connectWithRetry = async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection failed. Retrying in 5s:', error.message);
      setTimeout(connectWithRetry, 5000);
    }
  };

  connectWithRetry();
}

startServer().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
