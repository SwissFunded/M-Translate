const { Server } = require('socket.io');
const { createLiveConnection, getDeepgramConfig } = require('./deepgram');
const { translateText } = require('./translation');

// Initialize WebSocket server
const initializeWebSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:3001', // Local development
        'https://m-translate-frontend.vercel.app', // Production frontend
        'https://m-translate-frontend-d0nh1z3vj.vercel.app', // Previous deployment
        'https://m-translate-frontend-hvddco4qf.vercel.app', // Current deployment
        /^https:\/\/m-translate-frontend.*\.vercel\.app$/ // All preview deployments
      ],
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Store connections per client
  const clientConnections = new Map();

  io.on('connection', (socket) => {
    console.log('🔗 Client connected:', socket.id);

    // Validate Deepgram API key on connection
    socket.on('validate-api-key', async () => {
      console.log('🔑 Validating Deepgram API key...');
      try {
        // Test by creating a connection
        const testConnection = createLiveConnection();
        testConnection.on('open', () => {
          console.log('🔑 Deepgram API key is valid');
          testConnection.finish();
          socket.emit('api-key-valid');
        });
        testConnection.on('error', (error) => {
          console.error('❌ Deepgram API key validation failed:', error);
          socket.emit('api-key-invalid', { error: error.message });
        });
      } catch (error) {
        console.error('❌ Deepgram API key validation failed:', error);
        socket.emit('api-key-invalid', { error: error.message });
      }
      
      console.log('✅ Deepgram API key is valid');
    });

    // Start transcription
    socket.on('start-transcription', () => {
      console.log('🎙️ Starting transcription for client:', socket.id);
      
      // Check if client already has a connection
      const existingConnection = clientConnections.get(socket.id);
      if (existingConnection && existingConnection.deepgramConnection) {
        console.log('⚠️ Client already has an active transcription connection');
        socket.emit('transcription-error', { error: 'Transcription already active' });
        return;
      }
      
      let deepgramConnection = null;
      
      try {
        console.log('🎙️ Creating Deepgram live connection...');
        deepgramConnection = createLiveConnection();
        
        // Store connection for this client
        clientConnections.set(socket.id, {
          deepgramConnection,
          audioDataCount: 0,
          transcriptBuffer: []
        });
        
        // Handle successful connection
        deepgramConnection.on('open', () => {
          console.log('✅ Deepgram connection opened successfully');
        });

        // Handle transcription results
        deepgramConnection.on('results', async (result) => {
          console.log('📝 Raw Deepgram result:', JSON.stringify(result, null, 2));
          
          if (result.channel && result.channel.alternatives && result.channel.alternatives.length > 0) {
            const transcript = result.channel.alternatives[0].transcript;
            const confidence = result.channel.alternatives[0].confidence;
            const isFinal = result.is_final;
            
            console.log(`🎯 Transcript received: "${transcript}" (confidence: ${confidence}, final: ${isFinal})`);
            
            if (transcript && transcript.trim().length > 0) {
              // Create transcription result
              const transcriptionResult = {
                transcript: transcript,
                confidence: confidence,
                isFinal: isFinal,
                speaker: 'Speaker', // TODO: Add speaker diarization
                timestamp: new Date().toISOString(),
                translation: null // Will be populated if translation succeeds
              };
              
              // Translate to English if this is a final result
              if (isFinal && transcript.trim().length > 0) {
                try {
                  console.log('🌐 Translating final transcript to English...');
                  const translationResult = await translateText(transcript, 'EN-US');
                  
                  if (translationResult && !translationResult.error) {
                    transcriptionResult.translation = {
                      text: translationResult.translatedText,
                      sourceLanguage: 'cs',
                      targetLanguage: 'en',
                      timestamp: translationResult.timestamp
                    };
                    console.log(`✅ Translation: "${transcript}" → "${translationResult.translatedText}"`);
                  } else {
                    console.warn('⚠️ Translation failed:', translationResult?.error);
                  }
                } catch (error) {
                  console.error('❌ Translation error:', error);
                }
              }
              
              console.log('📤 Sending result to frontend:', transcriptionResult);
              socket.emit('transcription-result', transcriptionResult);
              console.log('📝 Transcript result for client', socket.id, ':', transcriptionResult);
            } else {
              console.log('🔍 Empty transcript received');
            }
          }
        });

        // Handle errors
        deepgramConnection.on('error', (error) => {
          console.error('❌ Deepgram connection error:', error);
          socket.emit('transcription-error', { error: error.message });
        });

        // Handle connection close
        deepgramConnection.on('close', () => {
          console.log('🔐 Deepgram connection closed');
        });

        // Handle metadata
        deepgramConnection.on('metadata', (metadata) => {
          console.log('📊 Deepgram metadata:', metadata);
        });
        
        console.log('✅ Deepgram connection created, emitting transcription-started');
        socket.emit('transcription-started');
        
      } catch (error) {
        console.error('❌ Failed to start transcription:', error);
        socket.emit('transcription-error', { error: error.message });
      }
    });

    // Handle audio data
    socket.on('audio-data', (audioData) => {
      const clientConnection = clientConnections.get(socket.id);
      if (!clientConnection) {
        console.log('⚠️ No client connection found for audio data');
        return;
      }
      
      const { deepgramConnection } = clientConnection;
      clientConnection.audioDataCount++;
      
      if (deepgramConnection && audioData) {
        try {
          console.log(`🎵 Received audio data #${clientConnection.audioDataCount} from client:`, socket.id);
          
          let audioBuffer;
          
          // Handle different audio data formats
          if (Buffer.isBuffer(audioData)) {
            audioBuffer = audioData;
            console.log('🔄 Using existing buffer:', audioBuffer.length, 'bytes');
          } else if (Array.isArray(audioData)) {
            // Convert array of numbers to 16-bit PCM buffer
            const int16Array = new Int16Array(audioData);
            audioBuffer = Buffer.from(int16Array.buffer);
            console.log('🔄 Converted array to 16-bit PCM buffer:', audioBuffer.length, 'bytes');
          } else if (audioData instanceof ArrayBuffer) {
            audioBuffer = Buffer.from(audioData);
            console.log('🔄 Using ArrayBuffer directly:', audioBuffer.length, 'bytes');
          } else if (audioData.buffer && audioData.buffer instanceof ArrayBuffer) {
            audioBuffer = Buffer.from(audioData.buffer);
            console.log('🔄 Using buffer from TypedArray:', audioBuffer.length, 'bytes');
          } else if (audioData instanceof Uint8Array || audioData instanceof Int16Array || audioData instanceof Float32Array) {
            audioBuffer = Buffer.from(audioData.buffer);
            console.log('🔄 Using TypedArray buffer:', audioBuffer.length, 'bytes');
          } else {
            // Fallback: try to convert whatever we have to a buffer
            audioBuffer = Buffer.from(audioData);
            console.log('🔄 Fallback conversion to buffer:', audioBuffer.length, 'bytes');
          }
          
          // Send audio to Deepgram if we have valid data
          if (audioBuffer && audioBuffer.length > 0) {
            console.log('📡 Sending audio buffer to Deepgram:', audioBuffer.length, 'bytes');
            deepgramConnection.send(audioBuffer);
          } else {
            console.log('⚠️ Empty or invalid audio buffer, skipping');
          }
        } catch (error) {
          console.error('❌ Error processing audio data:', error);
          socket.emit('transcription-error', { error: 'Failed to process audio data' });
        }
      } else {
        if (!deepgramConnection) {
          console.log('⚠️ No Deepgram connection available for audio data');
        }
        if (!audioData) {
          console.log('⚠️ No audio data received');
        }
      }
    });

    // Stop transcription
    socket.on('stop-transcription', () => {
      console.log('⏹️ Stopping transcription for client:', socket.id);
      
      const clientConnection = clientConnections.get(socket.id);
      if (clientConnection) {
        console.log('📊 Total audio chunks processed:', clientConnection.audioDataCount);
        
        if (clientConnection.deepgramConnection) {
          console.log('🔐 Finishing Deepgram connection...');
          
          // Send any buffered transcripts
          if (clientConnection.transcriptBuffer && clientConnection.transcriptBuffer.length > 0) {
            console.log('📝 Sending buffered transcripts:', clientConnection.transcriptBuffer.length);
            clientConnection.transcriptBuffer.forEach(transcript => {
              socket.emit('transcription-result', transcript);
            });
          } else {
            console.log('⚠️ No transcripts in buffer to send');
          }
          
          clientConnection.deepgramConnection.finish();
          clientConnection.deepgramConnection = null;
        }
        
        // Clean up client connection
        clientConnections.delete(socket.id);
      }
      
      socket.emit('transcription-stopped');
    });

    // Handle client disconnect
    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected:', socket.id);
      
      const clientConnection = clientConnections.get(socket.id);
      if (clientConnection && clientConnection.deepgramConnection) {
        clientConnection.deepgramConnection.finish();
      }
      clientConnections.delete(socket.id);
    });
  });

  console.log('WebSocket server initialized');
  return io;
};

module.exports = { initializeWebSocket }; 