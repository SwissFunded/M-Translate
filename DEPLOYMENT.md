# M-Translate Deployment Guide

## 🚀 Railway Backend Deployment

### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub account
3. Connect your GitHub repository

### Step 2: Deploy Backend
1. Click "New Project" in Railway dashboard
2. Choose "Deploy from GitHub repo"
3. Select your `M-Translate` repository
4. Choose "backend" as the source directory
5. Railway will auto-detect Node.js and deploy

### Step 3: Configure Environment Variables
In Railway dashboard, go to your project → Variables tab and add:

```
GOOGLE_API_KEY=your_google_speech_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
DEEPGRAM_API_KEY=your_deepgram_api_key_here
DEEPL_API_KEY=your_deepl_api_key_here
PORT=3001
NODE_ENV=production
```

### Step 4: Get Railway Backend URL
- After deployment, Railway will provide a URL like: `https://your-project-name.up.railway.app`
- Copy this URL for frontend configuration

## 🌐 Frontend Deployment

### Option 1: Vercel (Recommended)
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Choose `frontend-web` as the source directory
4. Add environment variable:
   ```
   REACT_APP_BACKEND_URL=https://your-railway-backend-url.up.railway.app
   ```
5. Deploy

### Option 2: Netlify
1. Go to [netlify.com](https://netlify.com)
2. Connect your GitHub repository
3. Set build command: `npm run build`
4. Set publish directory: `build`
5. Set base directory: `frontend-web`
6. Add environment variable:
   ```
   REACT_APP_BACKEND_URL=https://your-railway-backend-url.up.railway.app
   ```

## 🔧 Production Configuration

### Backend CORS Update
After getting your frontend URL, update `backend/index.js` CORS configuration:

```javascript
const allowedDomains = [
  'https://your-frontend-url.vercel.app',
  'https://your-frontend-url.netlify.app',
  'http://localhost:3000', // Keep for local testing
  'http://localhost:3001'
];
```

### API Keys Required for Production

**Essential:**
- `GOOGLE_API_KEY` - Primary speech-to-text service
- `OPENAI_API_KEY` - Fallback transcription (already configured)
- `DEEPGRAM_API_KEY` - Secondary transcription (already configured)

**Optional:**
- `DEEPL_API_KEY` - Professional translation (free tier: 500,000 chars/month)

### Getting Google Speech API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable "Speech-to-Text API"
4. Go to Credentials → Create Credentials → API Key
5. Copy the API key for Railway environment variables

## 🧪 Testing Production Deployment

### Backend Health Check
```bash
curl https://your-railway-backend-url.up.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "disconnected",
  "googleSpeech": "connected",
  "translation": "connected",
  "websocket": "active"
}
```

### Frontend Test
1. Open your deployed frontend URL
2. Click microphone button
3. Allow microphone access
4. Speak in English
5. Verify real-time transcription appears

## 🔄 Continuous Deployment

Both Railway and Vercel/Netlify will automatically redeploy when you push changes to your GitHub repository.

To update:
```bash
git add .
git commit -m "Your update description"
git push origin main
```

## 🚨 Troubleshooting

### Backend Issues
- Check Railway logs for errors
- Verify all environment variables are set
- Ensure CORS allows your frontend domain

### Frontend Issues
- Verify `REACT_APP_BACKEND_URL` points to Railway backend
- Check browser console for WebSocket connection errors
- Ensure HTTPS is used for microphone access

### WebSocket Connection
- Verify Railway backend URL in frontend environment
- Check that Railway backend supports WebSocket connections
- Test with browser developer tools Network tab

## 📊 Current Deployment Status

✅ **Code Committed**: All changes committed to git  
🔄 **GitHub Repository**: Ready to create and push  
📋 **Railway Backend**: Ready to deploy  
📋 **Frontend Deployment**: Ready after backend URL obtained  
✅ **Production Ready**: Environment variables configured  

---

**Next Steps:**
1. Create GitHub repository and push code
2. Deploy backend to Railway
3. Configure frontend with Railway backend URL  
4. Deploy frontend to Vercel/Netlify
5. Test complete production workflow 