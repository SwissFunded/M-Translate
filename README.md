# M-Translate - Real-Time Speech Transcription & Translation

A real-time speech-to-text transcription application that captures English speech and provides live transcriptions with Spanish translation capabilities.

## 🎯 Features

- **Real-time Audio Capture**: Live microphone recording with WebAudio API
- **Speech-to-Text**: English language transcription using Google Speech-to-Text API
- **Live Transcription Display**: Real-time subtitle display with confidence scores
- **WebSocket Communication**: Low-latency audio streaming
- **Translation Ready**: Built-in support for DeepL translation API (English → Spanish)
- **Modern UI**: React-based responsive frontend
- **Cloud Deployment**: Ready for Railway deployment

## 🏗️ Architecture

```
├── frontend-web/          # React frontend application
│   ├── src/
│   │   ├── App.js        # Main application component
│   │   └── ...
│   └── package.json
├── backend/              # Node.js backend server
│   ├── index.js         # Express server entry point
│   ├── websocket.js     # WebSocket handling
│   ├── google-speech.js # Google Speech API integration
│   ├── translation.js   # DeepL translation service
│   └── package.json
└── README.md
```

## 🚀 Local Development

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Google Speech-to-Text API key
- (Optional) DeepL API key for translation

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
# Create backend/.env with:
GOOGLE_API_KEY=your_google_speech_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
DEEPGRAM_API_KEY=your_deepgram_api_key_here
DEEPL_API_KEY=your_deepl_api_key_here  # Optional
PORT=3001
NODE_ENV=development
```

4. Start the backend server:
```bash
npm start
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend-web
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
REACT_APP_BACKEND_URL="http://localhost:3001" npm start
```

The application will be available at `http://localhost:3000`

## 🌐 Deployment

### Railway Backend Deployment

1. Create Railway account and new project
2. Connect your GitHub repository
3. Set environment variables in Railway dashboard:
   - `GOOGLE_API_KEY`: Your Google Speech API key
   - `OPENAI_API_KEY`: Your OpenAI API key (fallback)
   - `DEEPGRAM_API_KEY`: Your Deepgram API key (fallback)
   - `DEEPL_API_KEY`: Your DeepL API key (optional)
   - `PORT`: 3001

### Frontend Deployment

1. Update frontend environment for production:
```bash
cd frontend-web
echo "REACT_APP_BACKEND_URL=https://your-railway-backend-url.railway.app" > .env.production
```

2. Deploy to Vercel/Netlify:
```bash
npm run build
# Deploy dist/ folder to your hosting provider
```

## 🔧 API Configuration

### Google Speech-to-Text Setup

1. Create project at [Google Cloud Console](https://console.cloud.google.com)
2. Enable Speech-to-Text API
3. Create service account and download JSON key
4. Set API key in environment variables

### DeepL Setup (Optional)

1. Create account at [deepl.com](https://www.deepl.com/pro-api)
2. Get API key from dashboard
3. Used for English to Spanish translation

## 📱 Usage

1. **Access Application**: Open the deployed frontend URL
2. **Grant Permissions**: Allow microphone access when prompted
3. **Start Recording**: Click the microphone button to begin
4. **View Transcription**: See real-time English speech transcription
5. **See Translation**: View Spanish translation (if DeepL key configured)
6. **Stop Recording**: Click stop button to end session

## 🛠️ Technical Details

### Audio Processing
- **Sample Rate**: 16kHz (configurable)
- **Bit Depth**: 16-bit PCM
- **Channels**: Mono
- **Buffer Size**: 2048 samples

### WebSocket Events
- `start-transcription`: Begin audio streaming
- `audio-data`: Stream audio chunks
- `stop-transcription`: End streaming
- `transcript-result`: Receive transcription results

### Supported Languages
- **Primary**: English (en-US)
- **Translation**: Spanish (es-ES)

## 🔍 Troubleshooting

### Common Issues

1. **No Audio Detected**
   - Check microphone permissions
   - Verify browser supports WebAudio API
   - Test with different browsers

2. **Connection Errors**
   - Verify backend URL in frontend environment
   - Check CORS configuration
   - Ensure WebSocket support

3. **Empty Transcriptions**
   - Verify Google Speech API key
   - Check audio format compatibility
   - Test with clear speech

### Debug Mode

Enable detailed logging by setting:
```env
NODE_ENV=development
```

## 🎉 Current Status

✅ **English Speech Recognition**: Working with Google Speech API  
✅ **Real-time WebSocket Communication**: Functional  
✅ **Modern React Frontend**: Complete with dual subtitle display  
✅ **Multiple STT Fallbacks**: Google Speech, OpenAI Whisper, Deepgram  
🔄 **Spanish Translation**: Ready (requires DeepL API key)  
🚀 **Deployment Ready**: Configured for Railway backend hosting  

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
- Check troubleshooting section
- Review logs for errors
- Verify API key configuration
- Test with minimal setup

---

**Note**: This application requires HTTPS in production for microphone access. Local development works with HTTP on localhost. 