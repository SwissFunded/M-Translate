const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Transcribe audio buffer using OpenAI Whisper API
 * @param {Buffer} audioBuffer - Raw PCM audio data (16kHz, 16-bit, mono)
 * @param {string} language - Language code (default: 'cs' for Czech)
 * @returns {Promise<Object>} Transcription result
 */
const transcribeBuffer = async (audioBuffer, language = 'cs') => {
  let tempFilePath = null;
  
  try {
    console.log('🎤 Whisper: Starting transcription...');
    console.log('🎤 Audio buffer size:', audioBuffer.length, 'bytes');
    console.log('🎤 Language:', language);
    
    // Validate audio buffer size
    const minBufferSize = 16000; // ~0.5 seconds at 16kHz 16-bit
    if (audioBuffer.length < minBufferSize) {
      throw new Error(`Audio buffer too small: ${audioBuffer.length} bytes (minimum: ${minBufferSize} bytes)`);
    }
    
    // Create WAV file from PCM buffer
    const wavBuffer = createWavFile(audioBuffer);
    
    // Create temporary file
    tempFilePath = path.join(__dirname, `temp_audio_${Date.now()}.wav`);
    fs.writeFileSync(tempFilePath, wavBuffer);
    
    console.log('🎤 Whisper: Created temporary WAV file:', tempFilePath);
    console.log('🎤 WAV file size:', wavBuffer.length, 'bytes');
    
    // Transcribe using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
      language: language,
      response_format: 'verbose_json',
      temperature: 0.1
    });
    
    console.log('✅ Whisper: Transcription successful');
    console.log('📝 Transcript:', transcription.text);
    
    // Clean up temporary file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      tempFilePath = null;
    }
    
    return {
      transcript: transcription.text?.trim() || '',
      confidence: 0.9, // Whisper doesn't provide confidence scores
      language: transcription.language || language,
      duration: transcription.duration || 0,
      metadata: {
        model: 'whisper-1',
        language: transcription.language || language,
        duration: transcription.duration || 0
      }
    };
    
  } catch (error) {
    console.error('❌ Whisper transcription error:', error);
    
    // Clean up temporary file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.error('❌ Error cleaning up temp file:', cleanupError);
      }
    }
    
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
 * Create WAV file from PCM buffer
 * @param {Buffer} pcmBuffer - Raw PCM audio data (16kHz, 16-bit, mono)
 * @returns {Buffer} WAV file buffer
 */
const createWavFile = (pcmBuffer) => {
  const sampleRate = 16000;
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const fileSize = 36 + dataSize;
  
  const wavBuffer = Buffer.alloc(44 + dataSize);
  let offset = 0;
  
  // RIFF header
  wavBuffer.write('RIFF', offset); offset += 4;
  wavBuffer.writeUInt32LE(fileSize, offset); offset += 4;
  wavBuffer.write('WAVE', offset); offset += 4;
  
  // fmt chunk
  wavBuffer.write('fmt ', offset); offset += 4;
  wavBuffer.writeUInt32LE(16, offset); offset += 4; // chunk size
  wavBuffer.writeUInt16LE(1, offset); offset += 2; // audio format (PCM)
  wavBuffer.writeUInt16LE(channels, offset); offset += 2;
  wavBuffer.writeUInt32LE(sampleRate, offset); offset += 4;
  wavBuffer.writeUInt32LE(byteRate, offset); offset += 4;
  wavBuffer.writeUInt16LE(blockAlign, offset); offset += 2;
  wavBuffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
  
  // data chunk
  wavBuffer.write('data', offset); offset += 4;
  wavBuffer.writeUInt32LE(dataSize, offset); offset += 4;
  
  // Copy PCM data
  pcmBuffer.copy(wavBuffer, offset);
  
  return wavBuffer;
};

/**
 * Test OpenAI Whisper API connection
 * @returns {Promise<boolean>} Connection status
 */
const testConnection = async () => {
  try {
    // Create a minimal test WAV file (silence)
    const testPcmBuffer = Buffer.alloc(32000); // 1 second of silence at 16kHz 16-bit
    const result = await transcribeBuffer(testPcmBuffer, 'en');
    
    console.log('✅ Whisper connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Whisper connection test failed:', error);
    return false;
  }
};

/**
 * Get supported languages for Whisper
 * @returns {Array} List of supported language codes
 */
const getSupportedLanguages = () => {
  return [
    'af', 'am', 'ar', 'as', 'az', 'ba', 'be', 'bg', 'bn', 'bo', 'br', 'bs', 'ca', 'cs', 'cy',
    'da', 'de', 'el', 'en', 'es', 'et', 'eu', 'fa', 'fi', 'fo', 'fr', 'gl', 'gu', 'ha', 'haw',
    'he', 'hi', 'hr', 'ht', 'hu', 'hy', 'id', 'is', 'it', 'ja', 'jw', 'ka', 'kk', 'km', 'kn',
    'ko', 'la', 'lb', 'ln', 'lo', 'lt', 'lv', 'mg', 'mi', 'mk', 'ml', 'mn', 'mr', 'ms', 'mt',
    'my', 'ne', 'nl', 'nn', 'no', 'oc', 'pa', 'pl', 'ps', 'pt', 'ro', 'ru', 'sa', 'sd', 'si',
    'sk', 'sl', 'sn', 'so', 'sq', 'sr', 'su', 'sv', 'sw', 'ta', 'te', 'tg', 'th', 'tk', 'tl',
    'tr', 'tt', 'uk', 'ur', 'uz', 'vi', 'yi', 'yo', 'zh'
  ];
};

module.exports = {
  transcribeBuffer,
  testConnection,
  getSupportedLanguages,
  createWavFile
}; 