const { createClient } = require('@deepgram/sdk');
require('dotenv').config();

// Initialize Deepgram client
let deepgram;
try {
  deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  console.log('✅ Deepgram client initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Deepgram client:', error.message);
}

// Deepgram configuration for speech-to-text with raw PCM
const getDeepgramConfig = () => ({
  model: 'nova-2',
  language: 'en-US', // Temporarily back to English for testing
  smart_format: true,
  punctuate: true,
  interim_results: true,
  endpointing: 300,
  channels: 1,
  sample_rate: 16000,
  encoding: 'linear16' // Raw PCM 16-bit
});

// Create live transcription connection
const createLiveTranscription = (onTranscript, onError) => {
  try {
    console.log('🎙️ Creating Deepgram live connection...');
    const connection = deepgram.listen.live(getDeepgramConfig());
    
    // Handle connection open
    connection.on('open', () => {
      console.log('✅ Deepgram connection opened successfully');
    });

    // Handle transcription results
    connection.on('Results', (data) => {
      console.log('📝 Raw Deepgram result:', JSON.stringify(data, null, 2));
      
      if (data.channel && data.channel.alternatives && data.channel.alternatives[0]) {
        const transcript = data.channel.alternatives[0].transcript;
        const confidence = data.channel.alternatives[0].confidence;
        const isFinal = data.is_final;
        
        console.log(`🎯 Transcript received: "${transcript}" (confidence: ${confidence}, final: ${isFinal})`);
        
        // Extract speaker information if available
        let speaker = 'Speaker';
        if (data.channel.alternatives[0].words && data.channel.alternatives[0].words.length > 0) {
          const firstWord = data.channel.alternatives[0].words[0];
          if (firstWord.speaker !== undefined) {
            speaker = `Speaker ${firstWord.speaker + 1}`;
          }
        }

        const result = {
          transcript,
          confidence,
          isFinal,
          speaker,
          timestamp: new Date().toISOString()
        };

        console.log('📤 Sending result to frontend:', result);
        onTranscript(result);
      } else {
        console.log('⚠️ Received Deepgram result but no transcript data');
      }
    });

    // Handle errors
    connection.on('error', (error) => {
      console.error('❌ Deepgram error:', error);
      onError(error);
    });

    // Handle connection close
    connection.on('close', () => {
      console.log('🔐 Deepgram connection closed');
    });

    // Handle metadata
    connection.on('Metadata', (data) => {
      console.log('📊 Deepgram metadata:', data);
    });

    return connection;
  } catch (error) {
    console.error('❌ Failed to create Deepgram connection:', error);
    onError(error);
    return null;
  }
};

// Create live connection (for direct use in websocket)
const createLiveConnection = () => {
  try {
    console.log('🎙️ Creating Deepgram live connection...');
    const connection = deepgram.listen.live(getDeepgramConfig());
    return connection;
  } catch (error) {
    console.error('❌ Failed to create Deepgram live connection:', error);
    throw error;
  }
};

// Process pre-recorded audio file
const transcribeFile = async (audioBuffer) => {
  try {
    console.log('🎵 Transcribing audio file...');
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        ...getDeepgramConfig(),
        interim_results: false // No interim results for file transcription
      }
    );

    if (error) {
      throw error;
    }

    console.log('✅ File transcription complete');
    return result;
  } catch (error) {
    console.error('❌ File transcription error:', error);
    throw error;
  }
};

// Validate API key
const validateApiKey = async () => {
  try {
    console.log('🔑 Validating Deepgram API key...');
    
    if (!process.env.DEEPGRAM_API_KEY || process.env.DEEPGRAM_API_KEY === 'your_deepgram_api_key_here') {
      console.log('⚠️ No valid Deepgram API key found');
      return false;
    }
    
    // Test with a very small request
    const testResponse = await deepgram.manage.getProjectBalances(process.env.DEEPGRAM_API_KEY);
    console.log('✅ Deepgram API key is valid');
    return true;
  } catch (error) {
    console.error('❌ Deepgram API key validation failed:', error.message);
    return false;
  }
};

module.exports = {
  createLiveTranscription,
  createLiveConnection,
  transcribeFile,
  validateApiKey,
  getDeepgramConfig
}; 