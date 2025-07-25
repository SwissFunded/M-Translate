const googleSpeech = require('./google-speech');
const translation = require('./translation');

module.exports = (io) => {
  console.log('🔌 WebSocket server initialized');
  
  // Store client connections and their audio buffers
  const clientConnections = new Map();
  
  // Configure Socket.IO CORS
  io.engine.on("connection_error", (err) => {
    console.log('❌ WebSocket connection error:', err.req);      
    console.log('❌ Error code:', err.code);        
    console.log('❌ Error message:', err.message);  
    console.log('❌ Error context:', err.context);  
  });

  io.on('connection', (socket) => {
    console.log('🔗 Client connected:', socket.id);
    console.log('🌐 Client origin:', socket.handshake.headers.origin);
    
    // Initialize client connection
    clientConnections.set(socket.id, {
      audioBuffer: Buffer.alloc(0),
      isTranscribing: false,
      lastTranscriptionTime: 0
    });

    // Handle transcription start
    socket.on('start-transcription', () => {
      console.log('🎙️ Start transcription request from:', socket.id);
      
      const clientConnection = clientConnections.get(socket.id);
      if (clientConnection) {
        clientConnection.isTranscribing = true;
        clientConnection.audioBuffer = Buffer.alloc(0);
        clientConnection.lastTranscriptionTime = Date.now();
        
        socket.emit('transcription-started');
        console.log('✅ Transcription started for client:', socket.id);
      }
    });

    // Handle audio data
    socket.on('audio-data', async (audioData) => {
      try {
        const clientConnection = clientConnections.get(socket.id);
        
        if (!clientConnection || !clientConnection.isTranscribing) {
          console.log('⚠️ Ignoring audio data - client not transcribing');
          return;
        }
        
        console.log('🎵 Received audio data:', audioData?.length, 'samples from client:', socket.id);

      try {
        // Convert array back to Buffer and append to existing buffer
        const audioChunk = Buffer.from(new Int16Array(audioData).buffer);
        clientConnection.audioBuffer = Buffer.concat([clientConnection.audioBuffer, audioChunk]);
        
        // Process audio in chunks for real-time transcription
        const now = Date.now();
        const timeSinceLastTranscription = now - clientConnection.lastTranscriptionTime;
        const bufferSizeThreshold = 32000 * 1; // ~1 second of audio at 16kHz (much faster)
        const minAudioDuration = 3000; // Wait at least 3 seconds for better transcription
        
        // Send for transcription if buffer is large enough and enough time has passed
        if (clientConnection.audioBuffer.length >= bufferSizeThreshold && timeSinceLastTranscription >= minAudioDuration) {
          await processBatchTranscription(socket, clientConnection);
        }
        
      } catch (error) {
        console.error('❌ Error processing audio data:', error);
        socket.emit('transcription-error', { error: 'Audio processing failed' });
      }
      
      } catch (outerError) {
        console.error('❌ Critical error in audio-data handler:', outerError);
        console.error('❌ Stack trace:', outerError.stack);
        socket.emit('transcription-error', { error: 'Critical audio processing error' });
      }
    });

    // Handle transcription stop
    socket.on('stop-transcription', async () => {
      console.log('⏹️ Stop transcription request from:', socket.id);
      
      const clientConnection = clientConnections.get(socket.id);
      if (clientConnection) {
        clientConnection.isTranscribing = false;
        
        // Process any remaining audio buffer
        if (clientConnection.audioBuffer.length > 0) {
          console.log('🎵 Processing final audio buffer:', clientConnection.audioBuffer.length, 'bytes');
          
                     try {
             // Use Google Speech for final buffer processing
             const result = await googleSpeech.transcribeBuffer(clientConnection.audioBuffer, 'en-US');
             
             if (result && result.transcript && result.transcript.trim()) {
              console.log('📝 Final transcript:', result.transcript);
              
              // Translate the final result (English to Spanish for testing)
              let translatedText = '';
              try {
                translatedText = await translation.translateText(result.transcript, 'en', 'es');
                console.log('🌍 Final translation (EN→ES):', translatedText);
              } catch (translationError) {
                console.error('❌ Final translation failed:', translationError);
              }
              
              // Send final result
              socket.emit('transcription-result', {
                transcript: result.transcript,
                translation: translatedText,
                confidence: result.confidence || 0.9,
                isFinal: true,
                timestamp: new Date().toISOString(),
                speaker: 'Speaker'
              });
            }
          } catch (error) {
            console.error('❌ Final transcription failed:', error);
            socket.emit('transcription-error', { error: 'Final transcription failed' });
          }
        }
        
        // Clear buffer
        clientConnection.audioBuffer = Buffer.alloc(0);
        console.log('✅ Transcription stopped for client:', socket.id);
      }
    });

    // Handle client disconnect
    socket.on('disconnect', () => {
      console.log('👋 Client disconnected:', socket.id);
      clientConnections.delete(socket.id);
    });
  });

  // Process audio buffer for transcription
  async function processBatchTranscription(socket, clientConnection) {
    try {
      console.log('🎵 Processing audio buffer:', clientConnection.audioBuffer.length, 'bytes');
      console.log('🔄 Starting Google Speech transcription...');
      
      // Use Google Speech for transcription (highest accuracy)
      const result = await googleSpeech.transcribeBuffer(clientConnection.audioBuffer, 'en-US');
      console.log('✅ Google Speech transcription completed:', result?.transcript?.length || 0, 'characters');
      
      if (result && result.transcript && result.transcript.trim()) {
        console.log('📝 Transcript received:', result.transcript);
        
        // Translate the text (English to Spanish for testing)
        let translatedText = '';
        try {
          translatedText = await translation.translateText(result.transcript, 'en', 'es');
          console.log('🌍 Translation (EN→ES):', translatedText);
        } catch (translationError) {
          console.error('❌ Translation failed:', translationError);
        }
        
        // Send transcription result
        socket.emit('transcription-result', {
          transcript: result.transcript,
          translation: translatedText,
          confidence: result.confidence || 0.9,
          isFinal: false, // This is an interim result
          timestamp: new Date().toISOString(),
          speaker: 'Speaker'
        });
        
        // Update last transcription time
        clientConnection.lastTranscriptionTime = Date.now();
        
        // Clear processed audio (keep only recent audio)
        const keepBufferSize = 16000; // Keep ~0.5 seconds for context
        if (clientConnection.audioBuffer.length > keepBufferSize) {
          clientConnection.audioBuffer = clientConnection.audioBuffer.slice(-keepBufferSize);
        }
      }
      
    } catch (error) {
      console.error('❌ Batch transcription failed:', error);
      socket.emit('transcription-error', { 
        error: `Transcription failed: ${error.message}` 
      });
    }
  }
}; 