# M-Translate - Real-Time Speech Transcription & Translation

A real-time speech-to-text transcription application that captures Czech speech and provides live transcriptions with translation capabilities.

## 🎯 Features

- **Real-time Audio Capture**: Live microphone recording with WebAudio API
- **Speech-to-Text**: Czech language transcription using Deepgram API
- **Live Transcription Display**: Real-time subtitle display with confidence scores
- **WebSocket Communication**: Low-latency audio streaming
- **Translation Ready**: Built-in support for DeepL translation API
- **Modern UI**: React-based responsive frontend
- **Cloud Deployment**: Ready for Vercel deployment

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
│   ├── deepgram.js      # Deepgram API integration
│   ├── translation.js   # DeepL translation service
│   └── package.json
└── README.md
```

## 🚀 Local Development

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Deepgram API key
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
cp .env.example .env
```

4. Add your API keys to `.env`:
```env
DEEPGRAM_API_KEY=your_deepgram_api_key_here
DEEPL_API_KEY=your_deepl_api_key_here  # Optional
PORT=3000
```

5. Start the backend server:
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

3. Create environment file:
```bash
echo "REACT_APP_BACKEND_URL=http://localhost:3000" > .env.local
```

4. Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:3001`

## 🌐 Deployment

### Vercel Deployment

#### Backend Deployment

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy backend:
```bash
cd backend
vercel --prod
```

3. Set environment variables in Vercel dashboard:
   - `DEEPGRAM_API_KEY`: Your Deepgram API key
   - `DEEPL_API_KEY`: Your DeepL API key (optional)

#### Frontend Deployment

1. Update frontend environment variable:
```bash
cd frontend-web
echo "REACT_APP_BACKEND_URL=https://your-backend-url.vercel.app" > .env.production
```

2. Deploy frontend:
```bash
vercel --prod
```

### Environment Variables

#### Backend (.env)
```env
DEEPGRAM_API_KEY=your_deepgram_api_key
DEEPL_API_KEY=your_deepl_api_key
PORT=3000
NODE_ENV=production
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
```

#### Frontend (.env.production)
```env
REACT_APP_BACKEND_URL=https://your-backend-url.vercel.app
```

## 🔧 API Configuration

### Deepgram Setup

1. Create account at [deepgram.com](https://deepgram.com)
2. Get API key from dashboard
3. Configure for Czech language transcription

### DeepL Setup (Optional)

1. Create account at [deepl.com](https://www.deepl.com/pro-api)
2. Get API key for translation services
3. Used for Czech to English translation

## 📱 Usage

1. **Access Application**: Open the deployed frontend URL
2. **Grant Permissions**: Allow microphone access when prompted
3. **Start Recording**: Click the microphone button to begin
4. **View Transcription**: See real-time Czech speech transcription
5. **Stop Recording**: Click stop button to end session

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
- **Primary**: Czech (cs-CZ)
- **Translation**: English (en-US)

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
   - Verify Deepgram API key
   - Check audio format compatibility
   - Test with clear speech

### Debug Mode

Enable detailed logging by setting:
```env
NODE_ENV=development
```

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

**Note**: This application requires HTTPS in production for microphone access. 