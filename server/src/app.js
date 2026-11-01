const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const fileRoutes = require('./routes/files');
const chatRoutes = require('./routes/chats');
const { errorHandler } = require('./lib/http');

function createApp() {
  const app = express();
  app.use(cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/rooms', fileRoutes);
  app.use('/api/chats', chatRoutes);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
