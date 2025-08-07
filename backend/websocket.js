const googleSpeech = require('./google-speech');
const translation = require('./translation');
const languages = require('./languages');
const sttProviders = require('./stt-providers');
const aiPunctuation = require('./ai-punctuation');

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
    
    // Initialize client connection with default languages and punctuation preferences
    clientConnections.set(socket.id, {
      audioBuffer: Buffer.alloc(0),
      isTranscribing: false,
      lastTranscriptionTime: 0,
      lastTranscript: '', // Track last transcript to prevent duplicates
      lastTranslation: '', // Track last translation to prevent duplicates
      speechLanguage: 'cs-CZ', // Default to Czech (original vision)
      translationFrom: 'cs',
      translationTo: 'en',
      aiPunctuationEnabled: true, // Default punctuation enabled
      punctuationStyle: 'formal' // Default punctuation style
    });

    // Handle language configuration
    socket.on('set-languages', (config) => {
      console.log('🌍 Language configuration from:', socket.id, config);
      
      const clientConnection = clientConnections.get(socket.id);
      if (clientConnection && config) {
        // Validate and set speech language
        if (config.speechLanguage && languages.isValidSpeechLanguage(config.speechLanguage)) {
          clientConnection.speechLanguage = config.speechLanguage;
          console.log('🎤 Speech language set to:', config.speechLanguage);
        }
        
        // Validate and set translation languages
        if (config.translationFrom && languages.isValidTranslationLanguage(config.translationFrom)) {
          clientConnection.translationFrom = config.translationFrom;
          console.log('📝 Translation source set to:', config.translationFrom);
        }
        
        if (config.translationTo && languages.isValidTranslationLanguage(config.translationTo)) {
          clientConnection.translationTo = config.translationTo;
          console.log('🌍 Translation target set to:', config.translationTo);
        }
        
        // Send confirmation back to client
        socket.emit('languages-updated', {
          speechLanguage: clientConnection.speechLanguage,
          translationFrom: clientConnection.translationFrom,
          translationTo: clientConnection.translationTo,
          speechDisplay: languages.getLanguageDisplay(clientConnection.speechLanguage, 'speech'),
          translationDisplay: `${languages.getLanguageDisplay(clientConnection.translationFrom, 'translation')} → ${languages.getLanguageDisplay(clientConnection.translationTo, 'translation')}`
        });
      }
    });

    // Handle STT provider switching
    socket.on('set-stt-provider', (config) => {
      console.log('🎤 STT Provider switch request from:', socket.id, 'to:', config.provider);
      
      try {
        sttProviders.setSTTProvider(config.provider);
        const providerConfig = sttProviders.getProviderConfig();
        
        socket.emit('stt-provider-updated', {
          provider: config.provider,
          config: providerConfig,
          supportedLanguages: sttProviders.getSupportedLanguages()
        });
        
        console.log(`✅ STT Provider switched to: ${providerConfig.name} for client: ${socket.id}`);
      } catch (error) {
        console.error('❌ STT Provider switch failed:', error);
        socket.emit('stt-provider-error', {
          error: error.message,
          availableProviders: Object.values(sttProviders.STT_PROVIDERS)
        });
      }
    });

    // Handle punctuation preferences configuration
    socket.on('set-punctuation-preferences', (config) => {
      console.log('🤖 Punctuation preferences from:', socket.id, config);
      
      const clientConnection = clientConnections.get(socket.id);
      if (clientConnection && config) {
        if (typeof config.enabled === 'boolean') {
          clientConnection.aiPunctuationEnabled = config.enabled;
        }
        if (config.style && ['formal', 'casual', 'technical'].includes(config.style)) {
          clientConnection.punctuationStyle = config.style;
        }
        
        socket.emit('punctuation-preferences-updated', {
          enabled: clientConnection.aiPunctuationEnabled,
          style: clientConnection.punctuationStyle
        });
        
        console.log(`✅ Punctuation preferences updated for client: ${socket.id}`);
      }
    });

    // Handle transcription start
    socket.on('start-transcription', () => {
      console.log('🎙️ Start transcription request from:', socket.id);
      
      const clientConnection = clientConnections.get(socket.id);
      if (clientConnection) {
        clientConnection.isTranscribing = true;
        clientConnection.audioBuffer = Buffer.alloc(0);
        clientConnection.lastTranscriptionTime = Date.now();
        clientConnection.lastTranscript = ''; // Reset tracking variables
        clientConnection.lastTranslation = ''; // Reset tracking variables
        
        // Send current language configuration to client
        socket.emit('transcription-started', {
          speechLanguage: clientConnection.speechLanguage,
          translationFrom: clientConnection.translationFrom,
          translationTo: clientConnection.translationTo
        });
        console.log(`✅ Transcription started for client: ${socket.id} (${clientConnection.speechLanguage} → ${clientConnection.translationFrom}→${clientConnection.translationTo})`);
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

        // Convert array back to Buffer (correct way for Int16 PCM data)
        const audioChunk = Buffer.allocUnsafe(audioData.length * 2); // 2 bytes per Int16 sample
        for (let i = 0; i < audioData.length; i++) {
          audioChunk.writeInt16LE(audioData[i], i * 2); // Little-endian Int16
        }
        clientConnection.audioBuffer = Buffer.concat([clientConnection.audioBuffer, audioChunk]);
        
        // Process audio in chunks for real-time transcription
        const now = Date.now();
        const timeSinceLastTranscription = now - clientConnection.lastTranscriptionTime;
        const bufferSizeThreshold = 16000 * 2; // 2 seconds of audio at 16kHz (larger chunks to reduce frequency)
        const minAudioDuration = 1000; // Wait 1 second between transcriptions to reduce duplicates
        
        console.log('🎵 Buffer status:', {
          bufferLength: clientConnection.audioBuffer.length,
          threshold: bufferSizeThreshold,
          timeSince: timeSinceLastTranscription,
          minDuration: minAudioDuration
        });
        
        // Send for transcription if buffer is large enough and enough time has passed
        if (clientConnection.audioBuffer.length >= bufferSizeThreshold && timeSinceLastTranscription >= minAudioDuration) {
          console.log('🎯 Triggering transcription...');
          await processBatchTranscription(socket, clientConnection);
        }
        
      } catch (error) {
        console.error('❌ Error processing audio data:', error);
        console.error('❌ Stack trace:', error.stack);
        socket.emit('transcription-error', { error: 'Audio processing failed: ' + error.message });
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
             // Use current STT provider for final buffer processing with dynamic language
             const result = await sttProviders.transcribeBuffer(clientConnection.audioBuffer, clientConnection.speechLanguage);
             
             if (result && result.transcript && result.transcript.trim()) {
              const finalRawTranscript = result.transcript.trim();
              console.log('📝 Final transcript:', finalRawTranscript);
              
              // Check if this final transcript is significantly different from the last interim
              const isFinalDifferent = !clientConnection.lastTranscript || 
                finalRawTranscript.length > clientConnection.lastTranscript.length * 1.1 || // 10% longer for final
                finalRawTranscript.length < clientConnection.lastTranscript.length * 0.9 || // 10% shorter for final
                !finalRawTranscript.includes(clientConnection.lastTranscript) && !clientConnection.lastTranscript.includes(finalRawTranscript);
              
              if (!isFinalDifferent) {
                console.log('🔄 Final transcript too similar to last interim, skipping');
                return;
              }
              
              // Apply AI punctuation to the transcript (if enabled)
              let punctuatedTranscript = finalRawTranscript;
              if (clientConnection.aiPunctuationEnabled) {
                try {
                  console.log('🤖 Applying AI punctuation to final transcript...');
                  const punctuationResult = await aiPunctuation.addPunctuation(
                    result.transcript, 
                    clientConnection.translationFrom, 
                    { style: clientConnection.punctuationStyle, isTranslation: false }
                  );
                  
                  if (punctuationResult.processed) {
                    punctuatedTranscript = punctuationResult.text;
                    console.log(`✅ Final transcript punctuated (${punctuationResult.method}):`, punctuatedTranscript);
                  } else {
                    console.log('⚠️ Final transcript punctuation skipped');
                  }
                } catch (punctuationError) {
                  console.error('❌ Final transcript punctuation failed:', punctuationError);
                  // Continue with original transcript
                }
              } else {
                console.log('⚠️ AI punctuation disabled for user, using original transcript');
              }
              
              // Translate the punctuated final result with dynamic languages
              let translatedText = '';
              let punctuatedTranslation = '';
              try {
                const translationResult = await translation.translateText(punctuatedTranscript, clientConnection.translationFrom, clientConnection.translationTo);
                
                if (translationResult && typeof translationResult === 'object') {
                  translatedText = translationResult.translatedText || punctuatedTranscript;
                } else {
                  translatedText = translationResult || punctuatedTranscript;
                }
                
                // Apply punctuation to translation if it's different from original and punctuation is enabled
                if (translatedText && translatedText !== punctuatedTranscript && clientConnection.aiPunctuationEnabled) {
                  try {
                    const translationPunctuationResult = await aiPunctuation.addPunctuation(
                      translatedText, 
                      clientConnection.translationTo, 
                      { style: clientConnection.punctuationStyle, isTranslation: true }
                    );
                    
                    if (translationPunctuationResult.processed) {
                      punctuatedTranslation = translationPunctuationResult.text;
                      console.log(`✅ Final translation punctuated (${translationPunctuationResult.method}):`, punctuatedTranslation);
                    } else {
                      punctuatedTranslation = translatedText;
                    }
                  } catch (translationPunctuationError) {
                    console.error('❌ Final translation punctuation failed:', translationPunctuationError);
                    punctuatedTranslation = translatedText;
                  }
                } else {
                  punctuatedTranslation = translatedText;
                }
                
                console.log(`🌍 Final translation (${clientConnection.translationFrom}→${clientConnection.translationTo}):`, punctuatedTranslation);
              } catch (translationError) {
                console.error('❌ Final translation failed:', translationError);
                punctuatedTranslation = punctuatedTranscript; // Fallback to punctuated transcript
              }
              
              // Send final result with AI punctuation
              socket.emit('transcription-result', {
                transcript: punctuatedTranscript,
                translation: punctuatedTranslation,
                confidence: result.confidence || 0.9,
                isFinal: true,
                timestamp: new Date().toISOString(),
                speaker: 'Speaker',
                punctuated: true // Flag to indicate AI punctuation was applied
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
      
      // Check if audio contains actual sound (not just silence)
      const audioArray = new Int16Array(clientConnection.audioBuffer.buffer);
      const hasSound = audioArray.some(sample => Math.abs(sample) > 100);
      
      if (!hasSound) {
        console.log('🔇 Audio is mostly silence, skipping transcription');
        clientConnection.lastTranscriptionTime = Date.now();
        clientConnection.audioBuffer = Buffer.alloc(0);
        return;
      }
      
      console.log('🔊 Audio contains sound, processing with STT provider...');
      console.log('🔄 Starting STT transcription...');
      
      // Use current STT provider for transcription with dynamic language
      const result = await sttProviders.transcribeBuffer(clientConnection.audioBuffer, clientConnection.speechLanguage);
      console.log('✅ STT transcription completed:', result?.transcript?.length || 0, 'characters');
      console.log('📥 STT API response:', result);
      
      if (result && result.transcript && result.transcript.trim()) {
        const rawTranscript = result.transcript.trim();
        
        // Check if this transcript is significantly different from the last one
        const isSignificantlyDifferent = !clientConnection.lastTranscript || 
          rawTranscript.length > clientConnection.lastTranscript.length * 1.2 || // 20% longer
          rawTranscript.length < clientConnection.lastTranscript.length * 0.8 || // 20% shorter
          !rawTranscript.includes(clientConnection.lastTranscript) && !clientConnection.lastTranscript.includes(rawTranscript);
        
        if (!isSignificantlyDifferent) {
          console.log('🔄 Transcript too similar to last one, skipping:', rawTranscript);
          clientConnection.lastTranscriptionTime = Date.now();
          return;
        }
        
        console.log('📝 Transcript received:', rawTranscript);
        
        // Apply AI punctuation to the interim transcript (if enabled)
        let punctuatedTranscript = rawTranscript;
        if (clientConnection.aiPunctuationEnabled) {
          try {
            console.log('🤖 Applying AI punctuation to interim transcript...');
            const punctuationResult = await aiPunctuation.addPunctuation(
              result.transcript, 
              clientConnection.translationFrom, 
              { style: clientConnection.punctuationStyle, isTranslation: false }
            );
            
            if (punctuationResult.processed) {
              punctuatedTranscript = punctuationResult.text;
              console.log(`✅ Interim transcript punctuated (${punctuationResult.method}):`, punctuatedTranscript);
            } else {
              console.log('⚠️ Interim transcript punctuation skipped');
            }
          } catch (punctuationError) {
            console.error('❌ Interim transcript punctuation failed:', punctuationError);
            // Continue with original transcript
          }
        } else {
          console.log('⚠️ AI punctuation disabled for user, using original transcript');
        }
        
        // Translate the punctuated text with dynamic languages
        let translatedText = '';
        let punctuatedTranslation = '';
        let translationFailed = false;
        try {
          console.log(`🌍 Starting translation: "${punctuatedTranscript}" (${clientConnection.translationFrom}→${clientConnection.translationTo})`);
          const translationResult = await translation.translateText(punctuatedTranscript, clientConnection.translationFrom, clientConnection.translationTo);
          
          if (translationResult && typeof translationResult === 'object') {
            translatedText = translationResult.translatedText || punctuatedTranscript;
            translationFailed = translationResult.translationFailed || false;
            if (translationFailed) {
              console.warn(`⚠️ Translation failed, using original text: ${translationResult.error}`);
            }
          } else {
            translatedText = translationResult || punctuatedTranscript; // Fallback
          }
          
          // Apply punctuation to translation if it's different from original and punctuation is enabled
          if (translatedText && translatedText !== punctuatedTranscript && !translationFailed && clientConnection.aiPunctuationEnabled) {
            try {
              const translationPunctuationResult = await aiPunctuation.addPunctuation(
                translatedText, 
                clientConnection.translationTo, 
                { style: clientConnection.punctuationStyle, isTranslation: true }
              );
              
              if (translationPunctuationResult.processed) {
                punctuatedTranslation = translationPunctuationResult.text;
                console.log(`✅ Interim translation punctuated (${translationPunctuationResult.method}):`, punctuatedTranslation);
              } else {
                punctuatedTranslation = translatedText;
              }
            } catch (translationPunctuationError) {
              console.error('❌ Interim translation punctuation failed:', translationPunctuationError);
              punctuatedTranslation = translatedText;
            }
          } else {
            punctuatedTranslation = translatedText;
          }
          
          console.log(`🌍 Translation ${translationFailed ? 'FAILED (using original)' : 'SUCCESS'}: "${punctuatedTranslation}"`);
        } catch (translationError) {
          console.error('❌ Translation FAILED:', translationError);
          console.error('❌ Translation error details:', translationError.message);
          punctuatedTranslation = punctuatedTranscript; // Fallback to punctuated transcript
          translationFailed = true;
        }
        
        // Check if translation is significantly different from last one
        const isTranslationDifferent = !clientConnection.lastTranslation || 
          punctuatedTranslation !== clientConnection.lastTranslation;
        
        if (!isTranslationDifferent) {
          console.log('🔄 Translation too similar to last one, skipping:', punctuatedTranslation);
        } else {
          // Send transcription result with AI punctuation
          console.log('📤 Sending transcription result to client...');
          socket.emit('transcription-result', {
            transcript: punctuatedTranscript,
            translation: punctuatedTranslation,
            confidence: result.confidence || 0.9,
            isFinal: false, // This is an interim result
            timestamp: new Date().toISOString(),
            speaker: 'Speaker',
            punctuated: true // Flag to indicate AI punctuation was applied
          });
        }
        
        // Update tracking variables
        clientConnection.lastTranscriptionTime = Date.now();
        clientConnection.lastTranscript = punctuatedTranscript;
        clientConnection.lastTranslation = punctuatedTranslation;
        
        // Clear processed audio (keep only recent audio)
        const keepBufferSize = 16000; // Keep ~0.5 seconds for context
        if (clientConnection.audioBuffer.length > keepBufferSize) {
          clientConnection.audioBuffer = clientConnection.audioBuffer.slice(-keepBufferSize);
        }
      } else {
        console.log('🔇 No transcript detected in audio - Google Speech returned empty');
      }
      
    } catch (error) {
      console.error('❌ Batch transcription failed:', error);
      socket.emit('transcription-error', { 
        error: `Transcription failed: ${error.message}` 
      });
    }
  }
}; 