const express = require('express');
const http = require('http');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

// Import modules
const websocketHandler = require('./websocket');
const translation = require('./translation');
const languages = require('./languages');
const sttProviders = require('./stt-providers');
const { initializeDatabase, checkAuthTables } = require('./db-init');
const authRoutes = require('./auth-routes');

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://m-translate-frontend.vercel.app',
    'https://voxmiro.com',
    'https://www.voxmiro.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept']
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting (temporarily increased due to connection loop bug)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // temporarily increased from 100 to 1000
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Authentication rate limiting (temporarily increased due to connection loop bug)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // temporarily increased from 10 to 100
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/auth/', authLimiter);

// Initialize database on startup
const initializeApp = async () => {
  console.log('🚀 VoxMiro Backend Server starting...');
  
  // Initialize database schema (optional - may fail on Railway)
  try {
    const dbInitialized = await initializeDatabase();
    if (dbInitialized) {
      const tableCheck = await checkAuthTables();
      console.log('📋 Authentication tables status:', tableCheck);
    }
  } catch (error) {
    console.log('⚠️ Database initialization skipped (will retry later):', error.message);
  }
  
  // Initialize WebSocket with Socket.IO
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: corsOptions,
    transports: ['websocket', 'polling'],
    allowEIO3: true
  });
  
  // Initialize WebSocket handler
  websocketHandler(io);
  console.log('🔌 WebSocket server initialized');
  
  console.log('✅ VoxMiro initialization complete');
};

// Routes

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'VoxMiro Backend Server',
    version: '2.0.0',
    status: 'running',
    features: [
      'Real-time speech-to-text',
      'Multi-language translation', 
      'Audio waveform visualization',
      'User authentication',
      'Multiple STT providers (Google Speech, OpenAI Whisper, Deepgram Nova-3)',
      'Theme system (dark/light mode)',
      'User preferences management'
    ],
    endpoints: {
      auth: '/api/auth/*',
      languages: '/api/languages/*',
      stt: '/api/stt/*',
      health: '/health',
      websocket: '/socket.io/'
    }
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    authentication: 'enabled'
  });
});

// Language configuration endpoints
// Get all supported speech languages
app.get('/api/languages/speech', (req, res) => {
  console.log('🗣️ Speech languages requested');
  res.json({
    languages: languages.SPEECH_LANGUAGES,
    count: Object.keys(languages.SPEECH_LANGUAGES).length
  });
});

// Get all supported translation languages
app.get('/api/languages/translation', (req, res) => {
  console.log('🌍 Translation languages requested');
  res.json({
    languages: languages.TRANSLATION_LANGUAGES,
    count: Object.keys(languages.TRANSLATION_LANGUAGES).length
  });
});

// Get popular language combinations
app.get('/api/languages/popular', (req, res) => {
  console.log('⭐ Popular language combinations requested');
  res.json({
    combinations: languages.POPULAR_COMBINATIONS,
    count: languages.POPULAR_COMBINATIONS.length
  });
});

// Get language configuration for a specific speech language
app.get('/api/languages/config/:speechLang', (req, res) => {
  const { speechLang } = req.params;
  console.log(`🔧 Language config requested for: ${speechLang}`);
  
  if (!languages.isValidSpeechLanguage(speechLang)) {
    return res.status(400).json({
      error: 'Invalid speech language',
      supportedLanguages: Object.keys(languages.SPEECH_LANGUAGES)
    });
  }
  
  const translationLang = languages.speechToTranslationLang(speechLang);
  const alternatives = languages.getAlternativeLanguages(speechLang);
  
  res.json({
    speechLanguage: {
      code: speechLang,
      ...languages.SPEECH_LANGUAGES[speechLang]
    },
    translationLanguage: {
      code: translationLang,
      ...languages.TRANSLATION_LANGUAGES[translationLang]
    },
    alternatives: alternatives.map(alt => ({
      code: alt,
      ...languages.SPEECH_LANGUAGES[alt]
    })),
    display: {
      speech: languages.getLanguageDisplay(speechLang, 'speech'),
      translation: languages.getLanguageDisplay(translationLang, 'translation')
    }
  });
});

// STT Provider endpoints
// Get all available STT providers
app.get('/api/stt/providers', (req, res) => {
  console.log('🎤 STT providers requested');
  res.json({
    providers: sttProviders.getAllProviders(),
    current: sttProviders.getCurrentProvider(),
    currentConfig: sttProviders.getProviderConfig()
  });
});

// Get current STT provider
app.get('/api/stt/provider/current', (req, res) => {
  const current = sttProviders.getCurrentProvider();
  const config = sttProviders.getProviderConfig();
  
  res.json({
    provider: current,
    config: config,
    supportedLanguages: sttProviders.getSupportedLanguages()
  });
});

// Switch STT provider
app.post('/api/stt/provider/switch', (req, res) => {
  const { provider } = req.body;
  
  if (!provider) {
    return res.status(400).json({
      error: 'Provider name required',
      availableProviders: Object.values(sttProviders.STT_PROVIDERS)
    });
  }
  
  try {
    sttProviders.setSTTProvider(provider);
    const newConfig = sttProviders.getProviderConfig();
    
    console.log(`🔄 STT Provider switched to: ${provider}`);
    
    res.json({
      success: true,
      provider: provider,
      config: newConfig,
      message: `Switched to ${newConfig.name}`
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
      availableProviders: Object.values(sttProviders.STT_PROVIDERS)
    });
  }
});

// Test STT provider connection
app.get('/api/stt/provider/:provider/test', async (req, res) => {
  const { provider } = req.params;
  
  try {
    const isConnected = await sttProviders.testConnection(provider);
    const config = sttProviders.getProviderConfig(provider);
    
    res.json({
      provider: provider,
      config: config,
      connected: isConnected,
      status: isConnected ? 'Connected' : 'Failed'
    });
  } catch (error) {
    res.status(500).json({
      provider: provider,
      connected: false,
      error: error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 VoxMiro Backend Server running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket: http://localhost:${PORT}/socket.io/`);
  console.log(`🔒 Authentication: http://localhost:${PORT}/api/auth/`);
  
  // Initialize the application
  initializeApp();
});

module.exports = app; 