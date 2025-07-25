const axios = require('axios');

// Google Speech REST API configuration
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const SPEECH_API_URL = `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_API_KEY}`;

/**
 * Transcribe audio buffer using Google Speech-to-Text API
 * @param {Buffer} audioBuffer - Raw PCM audio data (16kHz, 16-bit, mono)
 * @param {string} language - Language code (default: 'en-US' for English)
 * @returns {Promise<Object>} Transcription result
 */
const transcribeBuffer = async (audioBuffer, language = 'en-US') => {
  try {
    console.log('🎤 Google Speech: Starting transcription...');
    console.log('🎤 Audio buffer size:', audioBuffer.length, 'bytes');
    console.log('🎤 Language:', language);
    
    // Validate audio buffer size
    const minBufferSize = 16000; // ~0.5 seconds at 16kHz 16-bit
    if (audioBuffer.length < minBufferSize) {
      throw new Error(`Audio buffer too small: ${audioBuffer.length} bytes (minimum: ${minBufferSize} bytes)`);
    }
    
    // Convert raw PCM to base64 for Google API
    const audioBase64 = audioBuffer.toString('base64');
    
    // Prepare request configuration for REST API
    const requestBody = {
      audio: {
        content: audioBase64,
      },
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: language,
        alternativeLanguageCodes: ['en-US'], // Fallback to English
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
        useEnhanced: true,
        model: 'latest_long', // Best model for accuracy
        maxAlternatives: 1,
      },
    };
    
    console.log('🎤 Google Speech: Sending REST API request...');
    
    // Send transcription request via REST API
    const response = await axios.post(SPEECH_API_URL, requestBody, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });
    
    // Extract data from REST API response
    const result = response.data;
    
    if (!result || !result.results || result.results.length === 0) {
      console.log('⚠️ Google Speech: No transcription results');
      return {
        transcript: '',
        confidence: 0,
        language: language
      };
    }
    
    const transcription = result.results[0];
    const alternative = transcription.alternatives[0];
    
    if (!alternative) {
      console.log('⚠️ Google Speech: No alternatives in results');
      return {
        transcript: '',
        confidence: 0,
        language: language
      };
    }
    
    const transcript = alternative.transcript || '';
    const confidence = alternative.confidence || 0;
    
    console.log('✅ Google Speech: Transcription successful');
    console.log('📝 Transcript:', transcript);
    console.log('📊 Confidence:', confidence);
    
    return {
      transcript: transcript.trim(),
      confidence: confidence,
      language: language,
      words: alternative.words || [],
      metadata: {
        model: 'latest_long',
        language: language,
        totalBilledTime: result.totalBilledTime || 0
      }
    };
    
  } catch (error) {
    console.error('❌ Google Speech transcription error:', error);
    
    // Return empty result on error to prevent cascade failures
    return {
      transcript: '',
      confidence: 0,
      language: language,
      error: error.message
    };
  }
};

/**
 * Test Google Speech API connection
 * @returns {Promise<boolean>} Connection status
 */
const testConnection = async () => {
  try {
    // Create a minimal test audio buffer (silence)
    const testBuffer = Buffer.alloc(32000); // 1 second of silence at 16kHz 16-bit
    
    const result = await transcribeBuffer(testBuffer, 'en-US');
    console.log('✅ Google Speech connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Google Speech connection test failed:', error);
    return false;
  }
};

/**
 * Get supported languages for Google Speech
 * @returns {Array} List of supported language codes
 */
const getSupportedLanguages = () => {
  return [
    'cs-CZ', // Czech
    'en-US', // English (US)
    'en-GB', // English (UK)
    'sk-SK', // Slovak
    'de-DE', // German
    'fr-FR', // French
    'es-ES', // Spanish
    'it-IT', // Italian
    'pt-PT', // Portuguese
    'ru-RU', // Russian
    'pl-PL', // Polish
    'nl-NL', // Dutch
    'sv-SE', // Swedish
    'da-DK', // Danish
    'no-NO', // Norwegian
    'fi-FI', // Finnish
    'hu-HU', // Hungarian
    'ro-RO', // Romanian
    'bg-BG', // Bulgarian
    'hr-HR', // Croatian
    'sl-SI', // Slovenian
    'et-EE', // Estonian
    'lv-LV', // Latvian
    'lt-LT', // Lithuanian
    'mt-MT', // Maltese
    'ga-IE', // Irish
    'cy-GB', // Welsh
    'eu-ES', // Basque
    'ca-ES', // Catalan
    'gl-ES', // Galician
    'is-IS', // Icelandic
    'mk-MK', // Macedonian
    'sq-AL', // Albanian
    'sr-RS', // Serbian
    'bs-BA', // Bosnian
    'me-ME', // Montenegrin
  ];
};

module.exports = {
  transcribeBuffer,
  testConnection,
  getSupportedLanguages
}; 