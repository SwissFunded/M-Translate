const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

// Import modules
const websocketHandler = require('./websocket');

const app = express();
const server = http.createServer(app);

// CORS configuration for HTTP requests
const corsOptions = {
  origin: function (origin, callback) {
    console.log('🌐 CORS request from origin:', origin);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost on any port for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      console.log('✅ CORS: Allowing localhost origin');
      return callback(null, true);
    }
    
    // Allow Vercel frontend deployments with dynamic subdomain matching
    if (origin.match(/^https:\/\/m-translate-frontend.*\.vercel\.app$/)) {
      console.log('✅ CORS: Allowing dynamic Vercel origin');
      return callback(null, true);
    }
    
    // Allow development and production domains
    const allowedDomains = [
      'https://m-translate-frontend.vercel.app',
      'https://m-translate-frontend-7kdh8hizd.vercel.app',
      'https://m-translate-frontend-h2t8zn8nn.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    if (allowedDomains.includes(origin)) {
      console.log('✅ CORS: Allowing approved domain');
      return callback(null, true);
    }
    
    console.log('❌ CORS: Rejecting origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  console.log('🏥 Health check requested');
  
  try {
    // Test database connection
    let databaseStatus = 'disconnected';
    try {
      const database = require('./database');
      await database.query('SELECT 1');
      databaseStatus = 'connected';
    } catch (dbError) {
      console.log('❌ Database check failed:', dbError.message);
    }
    
    // Test Google Speech API
    let googleSpeechStatus = 'disconnected';
    try {
      const googleSpeech = require('./google-speech');
      if (googleSpeech && googleSpeech.transcribeBuffer) {
        googleSpeechStatus = 'connected';
      }
    } catch (gsError) {
      console.log('❌ Google Speech check failed:', gsError.message);
    }
    

    
    // Test translation service
    let translationStatus = 'disconnected';
    try {
      const translation = require('./translation');
      if (translation && translation.translateText) {
        translationStatus = 'connected';
      }
    } catch (transError) {
      console.log('❌ Translation check failed:', transError.message);
      translationStatus = 'error';
    }
    
    const healthData = {
      status: 'healthy',
      database: databaseStatus,
      googleSpeech: googleSpeechStatus,
      translation: translationStatus,
      websocket: 'active',
      translationCache: {
        size: 0,
        maxSize: 1000,
        ttl: 24 * 60 * 60 * 1000, // 24 hours
        entries: []
      }
    };
    
    console.log('✅ Health check completed:', healthData);
    res.json(healthData);
  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(500).json({ 
      status: 'error', 
      error: error.message 
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'M-Translate Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      websocket: '/socket.io/'
    }
  });
});

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Initialize WebSocket handler
websocketHandler(io);

const port = process.env.PORT || 3001;

server.listen(port, () => {
  console.log(`🚀 M-Translate Backend Server running on port ${port}`);
  console.log(`🏥 Health check: http://localhost:${port}/health`);
  console.log(`🔌 WebSocket: http://localhost:${port}/socket.io/`);
});

module.exports = app; 