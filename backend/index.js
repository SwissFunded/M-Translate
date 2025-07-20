const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { authenticateToken, registerUser, loginUser } = require('./auth');
const { createCustomer, createSubscription, getUserSubscription, handleWebhook } = require('./stripe');
const { validateApiKey } = require('./deepgram');
const { initializeTranslator, validateDeepLKey, translateText, getCacheStats } = require('./translation');
const { initializeWebSocket } = require('./websocket');
const { testConnection } = require('./database');
const pool = require('./database');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;

// Initialize translation service
console.log('🌐 Initializing translation service...');
const translationInitialized = initializeTranslator();
if (translationInitialized) {
  console.log('✅ Translation service ready');
} else {
  console.warn('⚠️ Translation service not available - DeepL API key missing');
}

// Initialize WebSocket
const io = initializeWebSocket(server);

// Security middleware
app.use(helmet());

// CORS configuration for production and development
const corsOptions = {
  origin: [
    'http://localhost:3001', // Local development
    'https://m-translate-frontend.vercel.app', // Production frontend
    'https://m-translate-frontend-d0nh1z3vj.vercel.app', // Previous deployment
    'https://m-translate-frontend-hvddco4qf.vercel.app', // Previous deployment
    'https://m-translate-frontend-e4mb8soe6.vercel.app', // Previous deployment
    'https://m-translate-frontend-fyjhhnwva.vercel.app', // Previous deployment
    'https://m-translate-frontend-du07pf985.vercel.app', // Current deployment
    /^https:\/\/m-translate-frontend.*\.vercel\.app$/ // All preview deployments
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'M-Translate Backend API', version: '1.0.0' });
});

// Health check
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    database: 'disconnected',
    deepgram: 'disconnected',
    translation: 'disconnected',
    websocket: 'inactive'
  };

  // Test database connection
  try {
    const dbConnected = await testConnection();
    health.database = 'connected';
  } catch (error) {
    health.database = 'error';
  }

  // Test Deepgram connection
  try {
    validateApiKey();
    health.deepgram = 'connected';
  } catch (error) {
    health.deepgram = 'error';
  }

  // Test DeepL translation
  try {
    const translationStatus = await validateDeepLKey();
    health.translation = translationStatus.valid ? 'connected' : 'error';
    if (translationStatus.usage) {
      health.translationUsage = translationStatus.usage;
    }
    health.translationCache = getCacheStats();
  } catch (error) {
    health.translation = 'error';
  }

  // WebSocket is active if server is running
  health.websocket = 'active';

  res.json(health);
});

// STT Configuration endpoint
app.get('/stt/config', (req, res) => {
  const hasValidKey = process.env.DEEPGRAM_API_KEY && 
                     process.env.DEEPGRAM_API_KEY !== 'your_deepgram_api_key_here';
  
  res.json({
    available: hasValidKey,
    language: 'cs',
    features: {
      realTime: true,
      speakerDiarization: true,
      punctuation: true,
      smartFormatting: true
    }
  });
});

// Test Deepgram connection endpoint
app.post('/stt/test', async (req, res) => {
  try {
    console.log('🧪 Testing Deepgram connection...');
    
    // Create a simple test audio buffer (silence)
    const sampleRate = 16000;
    const duration = 1; // 1 second
    const samples = sampleRate * duration;
    const testBuffer = Buffer.alloc(samples * 2); // 16-bit audio
    
    // Add some test tone to make sure there's audio data
    for (let i = 0; i < samples; i++) {
      const value = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.1; // 440Hz tone
      const sample = Math.round(value * 32767);
      testBuffer.writeInt16LE(sample, i * 2);
    }
    
    const { transcribeFile } = require('./deepgram');
    const result = await transcribeFile(testBuffer);
    
    console.log('✅ Deepgram test successful:', result);
    res.json({ 
      success: true, 
      message: 'Deepgram connection working',
      testResult: result 
    });
  } catch (error) {
    console.error('❌ Deepgram test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test transcription endpoint
app.get('/test-transcript', (req, res) => {
  console.log('🧪 Testing transcription display...');
  
  // Send a fake transcript to all connected clients
  if (io) {
    io.emit('transcription-result', {
      transcript: 'Hello, this is a test transcript',
      confidence: 0.95,
      isFinal: false,
      speaker: 'Speaker',
      timestamp: new Date().toISOString()
    });
    
    setTimeout(() => {
      io.emit('transcription-result', {
        transcript: 'Hello, this is a test transcript',
        confidence: 0.95,
        isFinal: true,
        speaker: 'Speaker',
        timestamp: new Date().toISOString()
      });
    }, 1000);
    
    res.json({ message: 'Test transcript sent' });
  } else {
    res.status(500).json({ error: 'WebSocket not initialized' });
  }
});

// Auth routes
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const user = await registerUser(email, password);
    res.status(201).json({ message: 'User created successfully', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await loginUser(email, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Protected routes (require authentication)
app.get('/user/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, created_at FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Subscription routes
app.post('/subscription/create', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { email } = result.rows[0];
    
    // Create Stripe customer
    const customer = await createCustomer(email, req.userId);
    
    // Create subscription
    const subscription = await createSubscription(customer.id);
    
    res.json({ 
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
      subscriptionId: subscription.id 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/subscription/status', authenticateToken, async (req, res) => {
  try {
    const subscription = await getUserSubscription(req.userId);
    res.json({ subscription });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stripe webhook endpoint
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    // In production, verify the webhook signature here
    const event = JSON.parse(req.body);
    
    await handleWebhook(event);
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// Transcripts routes
app.get('/transcripts', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transcripts WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]);
    res.json({ transcripts: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save transcript (for completed sessions)
app.post('/transcripts', authenticateToken, async (req, res) => {
  try {
    const { original_text, translated_text, speakers, session_id } = req.body;
    
    const result = await pool.query(
      'INSERT INTO transcripts (user_id, original_text, translated_text, speakers, session_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.userId, original_text, translated_text, JSON.stringify(speakers), session_id]
    );
    
    res.status(201).json({ transcript: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test translation endpoint
app.post('/test-translation', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await translateText(text, 'EN-US');
    
    res.json({
      success: true,
      original: text,
      translation: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cache statistics endpoint
app.get('/cache-stats', (req, res) => {
  const stats = getCacheStats();
  res.json({
    success: true,
    cache: stats
  });
});

// Test transcript endpoint (for testing frontend display)
app.get('/test-transcript', (req, res) => {
  console.log('🧪 Testing transcription display...');
  
  // Emit test transcript to all connected clients
  io.emit('transcription-result', {
    transcript: 'Ahoj, toto je test transkripce.',
    confidence: 0.95,
    isFinal: true,
    speaker: 'Test Speaker',
    timestamp: new Date().toISOString(),
    translation: {
      text: 'Hello, this is a test transcription.',
      sourceLanguage: 'cs',
      targetLanguage: 'en',
      timestamp: new Date().toISOString()
    }
  });
  
  res.json({ message: 'Test transcript with translation sent' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
}); 