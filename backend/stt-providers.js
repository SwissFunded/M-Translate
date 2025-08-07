const googleSpeech = require('./google-speech');
const whisper = require('./whisper');
const deepgram = require('./deepgram');
const languages = require('./languages');

/**
 * Available STT (Speech-to-Text) providers
 */
const STT_PROVIDERS = {
  GOOGLE_SPEECH: 'google-speech',
    OPENAI_WHISPER: 'openai-whisper',
    DEEPGRAM_NOVA3: 'deepgram-nova-3'
};

/**
 * Provider configurations and capabilities
 */
const PROVIDER_CONFIG = {
  [STT_PROVIDERS.GOOGLE_SPEECH]: {
    name: 'Google Speech-to-Text',
    description: 'Google Cloud Speech-to-Text API with real-time processing',
    realtime: true,
    confidence: true,
    wordTimestamps: true,
    speakerDiarization: true,
    maxLanguages: 125,
    icon: '🔍'
  },
  [STT_PROVIDERS.OPENAI_WHISPER]: {
    name: 'OpenAI Whisper V3',
    description: 'OpenAI Whisper with enhanced accuracy and multilingual support',
    realtime: false,
    confidence: false,
    wordTimestamps: true,
    speakerDiarization: false,
    maxLanguages: 99,
    icon: '🎵'
    },
    [STT_PROVIDERS.DEEPGRAM_NOVA3]: {
      name: 'Deepgram Nova-3',
      description: 'Deepgram Nova-3 real-time and batch transcription',
      realtime: true,
      confidence: true,
      wordTimestamps: true,
      speakerDiarization: true,
      maxLanguages: 50,
      icon: '🎧'
    }
};

/**
 * Current default STT provider
 */
let currentProvider = STT_PROVIDERS.GOOGLE_SPEECH;

/**
 * Set the current STT provider
 * @param {string} provider - Provider name from STT_PROVIDERS
 */
const setSTTProvider = (provider) => {
  if (!STT_PROVIDERS[provider.toUpperCase().replace('-', '_')]) {
    throw new Error(`Unknown STT provider: ${provider}`);
  }
  currentProvider = STT_PROVIDERS[provider.toUpperCase().replace('-', '_')];
  console.log(`🎤 STT Provider switched to: ${PROVIDER_CONFIG[currentProvider].name}`);
};

/**
 * Get current STT provider
 * @returns {string} Current provider name
 */
const getCurrentProvider = () => currentProvider;

/**
 * Get provider configuration
 * @param {string} provider - Provider name (optional, defaults to current)
 * @returns {Object} Provider configuration
 */
const getProviderConfig = (provider = null) => {
  const targetProvider = provider || currentProvider;
  return PROVIDER_CONFIG[targetProvider];
};

/**
 * Get all available providers
 * @returns {Object} All provider configurations
 */
const getAllProviders = () => {
  return Object.keys(STT_PROVIDERS).map(key => ({
    id: STT_PROVIDERS[key],
    ...PROVIDER_CONFIG[STT_PROVIDERS[key]]
  }));
};

/**
 * Transcribe audio buffer using the current STT provider
 * @param {Buffer} audioBuffer - Raw PCM audio data
 * @param {string} language - Language code
 * @returns {Promise<Object>} Transcription result
 */
const transcribeBuffer = async (audioBuffer, language = 'en-US') => {
  try {
    console.log(`🎤 Using ${PROVIDER_CONFIG[currentProvider].name} for transcription`);
    
    switch (currentProvider) {
      case STT_PROVIDERS.GOOGLE_SPEECH:
        return await googleSpeech.transcribeBuffer(audioBuffer, language);
        
      case STT_PROVIDERS.OPENAI_WHISPER:
        // Convert speech language code to Whisper format (remove region)
        const whisperLang = languages.speechToTranslationLang(language);
        return await whisper.transcribeBuffer(audioBuffer, whisperLang);
      case STT_PROVIDERS.DEEPGRAM_NOVA3:
        // Map language to Deepgram format (use translation lang, e.g., en-US -> en)
        const dgLang = languages.speechToTranslationLang(language);
        return await deepgram.transcribeBuffer(audioBuffer, dgLang, 'nova-3');
        
      default:
        throw new Error(`Provider ${currentProvider} not implemented`);
    }
  } catch (error) {
    console.error(`❌ STT transcription failed with ${currentProvider}:`, error);
    
    // Return empty result to prevent cascade failures
    return {
      transcript: '',
      confidence: 0,
      language: language,
      error: error.message,
      provider: currentProvider
    };
  }
};

/**
 * Test connection for current or specified STT provider
 * @param {string} provider - Provider to test (optional, defaults to current)
 * @returns {Promise<boolean>} Connection status
 */
const testConnection = async (provider = null) => {
  const targetProvider = provider || currentProvider;
  
  try {
    console.log(`🧪 Testing ${PROVIDER_CONFIG[targetProvider].name} connection...`);
    
    switch (targetProvider) {
      case STT_PROVIDERS.GOOGLE_SPEECH:
        return await googleSpeech.testConnection ? await googleSpeech.testConnection() : true;
        
      case STT_PROVIDERS.OPENAI_WHISPER:
        return await whisper.testConnection();
      case STT_PROVIDERS.DEEPGRAM_NOVA3:
        return await deepgram.validateApiKey();
        
      default:
        return false;
    }
  } catch (error) {
    console.error(`❌ Connection test failed for ${targetProvider}:`, error);
    return false;
  }
};

/**
 * Get supported languages for current or specified provider
 * @param {string} provider - Provider to check (optional, defaults to current)
 * @returns {Array} Supported language codes
 */
const getSupportedLanguages = (provider = null) => {
  const targetProvider = provider || currentProvider;
  
  switch (targetProvider) {
    case STT_PROVIDERS.GOOGLE_SPEECH:
      return Object.keys(languages.SPEECH_LANGUAGES);
      
    case STT_PROVIDERS.OPENAI_WHISPER:
      return whisper.getSupportedLanguages();
    case STT_PROVIDERS.DEEPGRAM_NOVA3:
      // Assume same speech languages for simplicity; adjust if needed
      return Object.keys(languages.SPEECH_LANGUAGES);
      
    default:
      return [];
  }
};

module.exports = {
  STT_PROVIDERS,
  PROVIDER_CONFIG,
  setSTTProvider,
  getCurrentProvider,
  getProviderConfig,
  getAllProviders,
  transcribeBuffer,
  testConnection,
  getSupportedLanguages
};