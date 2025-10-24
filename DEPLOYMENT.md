# SideKick - Deployment Guide

Complete guide to deploying SideKick to production.

---

## 🚀 Quick Deploy (Vercel - Recommended)

### Option 1: One-Click Deploy
1. Go to https://vercel.com/new
2. Select **GitHub** and connect your account
3. Import the `SideKIckOS_V2` repository
4. Add environment variables:
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `TAVILY_API_KEY` - Your Tavily API key (optional)
5. Click **Deploy**
6. Done! Your app is live at `your-app.vercel.app`

### Option 2: Vercel CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from project directory
cd SideKick
vercel

# For production
vercel --prod
```

---

## 🐳 Docker Deployment

### Build Docker Image
```bash
docker build -t sidekick:latest .
```

### Run Locally
```bash
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk-your-key \
  -e TAVILY_API_KEY=tvly-your-key \
  sidekick:latest
```

### Deploy to Docker Hub
```bash
# Tag image
docker tag sidekick:latest yourusername/sidekick:latest

# Login and push
docker login
docker push yourusername/sidekick:latest
```

### Deploy to Cloud Services

**AWS (using ECS)**
```bash
aws ecr create-repository --repository-name sidekick
aws ecr get-login-password | docker login --username AWS --password-stdin <your-account-id>.dkr.ecr.us-east-1.amazonaws.com
docker tag sidekick:latest <your-account-id>.dkr.ecr.us-east-1.amazonaws.com/sidekick:latest
docker push <your-account-id>.dkr.ecr.us-east-1.amazonaws.com/sidekick:latest
```

**Google Cloud Run**
```bash
gcloud run deploy sidekick \
  --source . \
  --platform managed \
  --region us-central1 \
  --set-env-vars OPENAI_API_KEY=sk-your-key
```

**Azure Container Instances**
```bash
az containerapp create \
  --name sidekick \
  --resource-group myResourceGroup \
  --image yourusername/sidekick:latest \
  --environment-variables OPENAI_API_KEY=sk-your-key
```

---

## 💻 Manual VPS/Server Deployment

### Prerequisites
- Node.js 18+ installed
- npm or yarn
- Linux server (Ubuntu 20.04+ recommended)

### 1. Clone Repository
```bash
git clone https://github.com/Quintusnz/SideKIckOS_V2.git
cd SideKick
```

### 2. Install Dependencies
```bash
npm install --production
```

### 3. Build for Production
```bash
npm run build
```

### 4. Set Environment Variables
```bash
# Create .env.production file
cat > .env.production << EOF
OPENAI_API_KEY=sk-your-key
TAVILY_API_KEY=tvly-your-key
NODE_ENV=production
EOF
```

### 5. Start Server
```bash
npm start
# Server will run on http://localhost:3000
```

### 6. Use Process Manager (PM2 Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start npm --name "sidekick" -- start

# Enable auto-restart on server reboot
pm2 startup
pm2 save

# Monitor
pm2 monit
```

### 7. Setup Nginx Reverse Proxy
```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/sidekick

# Add this configuration:
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/sidekick /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 8. Setup HTTPS with Let's Encrypt
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --nginx -d your-domain.com

# Update Nginx config to use HTTPS
# Certbot can do this automatically:
sudo certbot --nginx -d your-domain.com
```

---

## 📋 Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `OPENAI_API_KEY` | ✅ Yes | - | OpenAI API key for GPT-5 |
| `TAVILY_API_KEY` | ❌ No | - | Tavily API key for web search |
| `NODE_ENV` | ❌ No | `development` | Set to `production` for prod |
| `NEXT_PUBLIC_API_URL` | ❌ No | - | Public API URL (if behind proxy) |

---

## ✅ Pre-Deployment Checklist

- [ ] All tests passing: `npm run test`
- [ ] No linting errors: `npm run lint`
- [ ] Environment variables configured
- [ ] `.env.local` is in `.gitignore` (never commit secrets)
- [ ] Build successful: `npm run build`
- [ ] Application runs locally: `npm start`
- [ ] Git repository is clean: `git status`
- [ ] Latest commits pushed to GitHub

---

## 🔍 Monitoring & Logging

### Vercel Monitoring
- Dashboard: https://vercel.com/dashboard
- View logs: Click on deployment → Logs tab
- Analytics: Built-in performance monitoring

### Docker Monitoring
```bash
# View logs
docker logs <container-id>

# View with follow
docker logs -f <container-id>

# Monitor resources
docker stats
```

### Server Monitoring
```bash
# With PM2
pm2 monit
pm2 logs sidekick

# System resources
top
htop
free -h
```

---

## 🚨 Troubleshooting Deployment

### Issue: "OPENAI_API_KEY is not set"
**Solution:** Ensure environment variable is set in your deployment platform's settings.

### Issue: "502 Bad Gateway" (Nginx)
**Solution:** 
```bash
# Check if Node app is running
pm2 status
pm2 logs sidekick

# Restart if needed
pm2 restart sidekick
```

### Issue: "Cannot find module" after deployment
**Solution:** Rebuild and install dependencies:
```bash
npm install --production
npm run build
npm start
```

### Issue: "Chat endpoint timing out"
**Solution:**
- Check OpenAI API status: https://status.openai.com
- Verify API key is valid
- Check network connectivity
- Increase timeout in `next.config.ts` if needed

---

## 📊 Performance Optimization

### Build Optimization
```bash
# Check build size
npm run build
du -sh .next

# Analyze bundle
npm install --save-dev @next/bundle-analyzer
# Add to next.config.ts: withBundleAnalyzer()
```

### Runtime Optimization
- Enable caching headers in `next.config.ts`
- Use Vercel Edge Runtime for API routes
- Implement rate limiting for API endpoints
- Use CDN for static assets

### Database Optimization (if added)
- Use connection pooling
- Add query indexes
- Cache frequently accessed data

---

## 🔐 Security Checklist

- [ ] Never commit `.env.local` to GitHub
- [ ] Use HTTPS in production
- [ ] Enable CORS if needed: `next.config.ts`
- [ ] Set secure cookies
- [ ] Validate all user inputs
- [ ] Rate limit API endpoints
- [ ] Monitor for suspicious activity
- [ ] Keep dependencies updated: `npm audit`

---

## 🆘 Getting Help

- **Vercel Issues:** https://vercel.com/support
- **Node.js Issues:** https://nodejs.org/en/docs/
- **Next.js Issues:** https://github.com/vercel/next.js/discussions
- **OpenAI Issues:** https://community.openai.com

---

## 📝 Additional Resources

- [Vercel Deployment Documentation](https://vercel.com/docs)
- [Next.js Production Checklist](https://nextjs.org/learn/nodejs-react-fullstack/production)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/pm2-doc-single-page/)

---

**Last Updated:** October 24, 2025
