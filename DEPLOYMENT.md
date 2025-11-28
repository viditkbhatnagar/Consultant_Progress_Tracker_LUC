# Team Progress Tracker - Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Configuration](#database-configuration)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Production Considerations](#production-considerations)
7. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Prerequisites

### Required Software
- Node.js (v14 or higher)
- npm or yarn
- MongoDB Atlas account (or local MongoDB instance)
- Git

### Recommended Services
- **Backend Hosting**: Heroku, DigitalOcean, AWS EC2, or Railway
- **Frontend Hosting**: Vercel, Netlify, or AWS S3 + CloudFront
- **Database**: MongoDB Atlas (recommended for production)

---

## Environment Setup

### Backend Environment Variables

Create a `server/.env` file with the following variables:

```env
# Server Configuration
NODE_ENV=production
PORT=5001

# Database
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/team_progress_tracker?retryWrites=true&w=majority

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secure-random-jwt-secret-key-change-this-in-production
JWT_EXPIRE=30d

# Optional: Email Configuration for Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
```

### Frontend Environment Variables

Create a `client/.env.production` file:

```env
REACT_APP_API_URL=https://your-backend-api.com/api
```

---

## Database Configuration

### MongoDB Atlas Setup

1. **Create Cluster**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a free or paid cluster
   - Choose your preferred cloud provider and region

2. **Create Database User**
   - Database Access → Add New Database User
   - Create username and strong password
   - Grant read/write access

3. **Whitelist IP Addresses**
   - Network Access → Add IP Address
   - For development: Add your current IP
   - For production: Add `0.0.0.0/0` (allow from anywhere) or specific server IPs

4. **Get Connection String**
   - Clusters → Connect → Connect Your Application
   - Copy the connection string
   - Replace `<username>` and `<password>` with your credentials
   - Update database name to `team_progress_tracker`

5. **Seed Initial Data** (Optional)
   ```bash
   cd server
   node utils/seedUsers.js
   ```

---

## Backend Deployment

### Option 1: Heroku

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   ```

2. **Login and Create App**
   ```bash
   heroku login
   heroku create your-app-name
   ```

3. **Set Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set MONGODB_URI="your-mongodb-uri"
   heroku config:set JWT_SECRET="your-jwt-secret"
   heroku config:set JWT_EXPIRE=30d
   ```

4. **Deploy**
   ```bash
   cd server
   git init
   git add .
   git commit -m "Initial commit"
   git push heroku main
   ```

5. **Verify**
   ```bash
   heroku logs --tail
   heroku open
   ```

### Option 2: DigitalOcean / VPS

1. **SSH into Server**
   ```bash
   ssh root@your-server-ip
   ```

2. **Install Node.js and npm**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Clone Repository**
   ```bash
   git clone https://github.com/your-username/teamProgressTracker.git
   cd teamProgressTracker/server
   ```

4. **Install Dependencies**
   ```bash
   npm install --production
   ```

5. **Set Environment Variables**
   ```bash
   nano .env
   # Paste your production environment variables
   ```

6. **Install PM2 (Process Manager)**
   ```bash
   npm install -g pm2
   pm2 start server.js --name team-progress-api
   pm2 startup
   pm2 save
   ```

7. **Configure Nginx (Reverse Proxy)**
   ```bash
   sudo apt install nginx
   sudo nano /etc/nginx/sites-available/team-progress
   ```

   Add this configuration:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location /api {
           proxy_pass http://localhost:5001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   Enable the site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/team-progress /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

8. **Setup SSL with Let's Encrypt**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

---

## Frontend Deployment

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   cd client
   vercel
   ```

3. **Set Environment Variables** (in Vercel Dashboard)
   - Go to Project Settings → Environment Variables
   - Add: `REACT_APP_API_URL` = `https://your-backend-api.com/api`

4. **Redeploy with Production Settings**
   ```bash
   vercel --prod
   ```

### Option 2: Netlify

1. **Build the App**
   ```bash
   cd client
   npm run build
   ```

2. **Deploy via Netlify CLI**
   ```bash
   npm install -g netlify-cli
   netlify deploy --prod
   ```

   Or drag and drop the `build` folder to [Netlify](https://app.netlify.com/drop)

3. **Configure Environment Variables**
   - Site Settings → Build & Deploy → Environment
   - Add: `REACT_APP_API_URL`

### Option 3: AWS S3 + CloudFront

1. **Build the App**
   ```bash
   cd client
   npm run build
   ```

2. **Create S3 Bucket**
   - Go to AWS S3 Console
   - Create bucket with a unique name
   - Enable static website hosting

3. **Upload Build Files**
   ```bash
   aws s3 sync build/ s3://your-bucket-name --acl public-read
   ```

4. **Create CloudFront Distribution**
   - Go to CloudFront Console
   - Create distribution with S3 bucket as origin
   - Note the CloudFront URL

---

## Production Considerations

### Security
- [x] JWT secrets are strong and environment-specific
- [x] MongoDB connection uses authentication
- [x] CORS is configured properly
- [x] Passwords are hashed with bcrypt
- [x] API endpoints have proper authorization
- [ ] Enable HTTPS/SSL for all traffic
- [ ] Implement rate limiting for APIs
- [ ] Add helmet.js for security headers

### Performance
- [x] Frontend uses React production build
- [x] Database queries are optimized
- [x] Images and assets are optimized
- [ ] Enable gzip compression
- [ ] Implement CDN for static assets
- [ ] Add database indexing for frequent queries
- [ ] Consider caching strategy (Redis)

### Monitoring
- [ ] Setup error tracking (Sentry, Rollbar)
- [ ] Configure application monitoring (New Relic, DataDog)
- [ ] Setup uptime monitoring (Pingdom, UptimeRobot)
- [ ] Configure log aggregation (Papertrail, Loggly)

### Backup Strategy
- [ ] Enable MongoDB Atlas automatic backups
- [ ] Regular database exports
- [ ] Code backups via Git
- [ ] Document backup restoration procedure

---

## Monitoring & Maintenance

### Health Checks

Backend health endpoint:
```
GET https://your-api.com/api/health
```

### PM2 Monitoring Commands

```bash
# View running processes
pm2 list

# View logs
pm2 logs team-progress-api

# Restart application
pm2 restart team-progress-api

# Monitor in real-time
pm2 monit
```

### Database Maintenance

```bash
# Create backup
mongodump --uri="mongodb+srv://..." --out=./backup

# Restore backup
mongorestore --uri="mongodb+srv://..." ./backup
```

### Regular Updates

```bash
# Update dependencies
npm outdated
npm update

# Security audit
npm audit
npm audit fix
```

---

## Troubleshooting

### Common Issues

**Issue**: CORS errors in production
**Solution**: Update CORS configuration in `server/server.js` to include production frontend URL

**Issue**: MongoDB connection timeout
**Solution**: Check MongoDB Atlas whitelist IPs and connection string

**Issue**: Environment variables not working
**Solution**: Verify `.env` file exists and variables are properly set

**Issue**: Frontend can't connect to backend
**Solution**: Check `REACT_APP_API_URL` in frontend and CORS in backend

---

## Support & Maintenance

For ongoing support:
1. Monitor error logs regularly
2. Keep dependencies updated
3. Review security advisories
4. Backup database weekly
5. Test new features in staging before production

---

**Deployment Checklist:**
- [ ] MongoDB Atlas cluster created and configured
- [ ] Backend deployed with environment variables
- [ ] Frontend built and deployed
- [ ] HTTPS/SSL configured
- [ ] Test all features in production
- [ ] Monitoring tools configured
- [ ] Backup strategy implemented
- [ ] Documentation updated

Your Team Progress Tracker is now ready for production! 🚀
