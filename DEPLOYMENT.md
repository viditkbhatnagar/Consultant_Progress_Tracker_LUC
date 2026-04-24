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

---

## Docs RAG Feature — Render Deploy Cutover

The program-docs chatbot (LUC-only) ships with an in-memory embedding index,
two generation providers, and a persisted query log. Everything runs on the
existing Render web service — no new services required.

### New env vars to set in Render dashboard

| Key | Example value | Notes |
|---|---|---|
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | 1536-dim, $0.02/M tokens |
| `OPENAI_CHAT_MODEL` | `gpt-4o-mini` | fallback generation model |
| `GROQ_API_KEY` | `gsk_…` | obtain at console.groq.com |
| `GROQ_CHAT_MODEL` | `llama-3.3-70b-versatile` | primary generation model |
| `LLM_PRIMARY` | `groq` | `groq` or `openai` |
| `LLM_FALLBACK` | `openai` | fallback when primary errors |
| `DOCS_RAG_ENABLED` | `true` | feature flag (future use) |
| `DOCS_RAG_TOPK` | `5` | retrieval top-K |
| `DOCS_RAG_MIN_SCORE` | `0.35` | refusal threshold (cosine) |
| `DOCS_RAG_EXACT_MATCH_THRESHOLD` | `0.82` | Tier 1 cutoff |
| `DOCS_RAG_CACHE_TTL_SECONDS` | `86400` | 24h cache |

`OPENAI_API_KEY`, `MONGODB_URI`, `JWT_SECRET` are already set from the
tracker deploy — don't duplicate.

### Atlas region caveat

The in-memory index ships ~5 MB of embeddings over the wire at every boot
(215 chunks × 2 × 1536 floats, JSON-encoded). On **remote** Atlas (different
region from Render) boot takes ~25 s. On **colocated** Atlas (same region)
boot completes in under 2 s. Before merging, confirm the Render service
region matches the Atlas cluster region. If they diverge, either move the
Atlas cluster or plan for the ~25 s unavailability window at each cold boot.

### Step-by-step deploy runbook

1. **Pre-flight** (local)
   ```
   npm run ingest:docs:force    # ~$0.02, 2–3 min; verifies script + content
   ```
   Then spot-check via the existing Phase 1–3 tests in PRs.
2. **Set env vars** in the Render dashboard for both staging and prod
   services (see table above). Restart is NOT needed yet.
3. **Merge to main.** Render auto-deploys.
4. **Wait for "Live"** on the Render dashboard. Then:
   ```
   curl https://<render-host>/api/docs-chat/health
   ```
   Expected: HTTP 200 with `ok:true, chunksLoaded:215`. If 503, the Mongo
   query is still running — wait up to 30 s and re-hit.
5. **Ingest the corpus on prod** (first deploy only — subsequent deploys
   find the chunks already in Atlas):
   - Open the Docs RAG admin dashboard (`/admin/docs-rag`) as an admin user.
   - Click **Force re-ingest**. Wait ~2–3 min for the green success banner.
   - Refresh the page — "Chunks loaded" should read 215.
6. **Smoke tests** against prod (swap in a real LUC admin JWT):
   ```
   # Tier 1 exact match
   curl -N -H "Authorization: Bearer $LUC" -H 'Content-Type: application/json' \
     -X POST https://<host>/api/docs-chat \
     -d '{"query":"What accreditations does the DBA have?"}'

   # Skillhub 403
   curl -s -o /dev/null -w "HTTP %{http_code}\n" \
     -H "Authorization: Bearer $SKILLHUB" -H 'Content-Type: application/json' \
     -X POST https://<host>/api/docs-chat -d '{"query":"test"}'

   # PDF static auth gate
   curl -s -o /dev/null -w "HTTP %{http_code}\n" \
     https://<host>/program-docs/ssm-dba/DBA.pdf     # 401
   curl -s -o /dev/null -w "HTTP %{http_code}\n" \
     -H "Authorization: Bearer $LUC" \
     https://<host>/program-docs/ssm-dba/DBA.pdf     # 200
   ```
7. **Announce to the team.** Share the LUC walkthrough: ask a docs question
   in the chat drawer, click a source chip, PDF opens.

### Rollback procedure

If anything breaks post-deploy:

1. **Non-LUC users impacted?** Very unlikely — the Phase 2/3 changes are
   all gated behind `orgGate('luc')` or `isLuc` client checks. Skillhub &
   manager paths are untouched. If you see Skillhub breakage, that's the
   flag to rollback.
2. **Quick disable** (no redeploy): set `DOCS_RAG_ENABLED=false` in Render
   and restart the service. Note: the env var is loaded but not enforced
   as a kill-switch yet — a first-class toggle is a future phase. For a
   hard disable today, rollback or delete `DocChunk` rows.
3. **Full rollback**: in Render, "Manual deploy" → pick the last green
   commit before this branch merged. Takes ~3 min. No DB migration to
   reverse — `DocChunk` / `QueryCache` / `DocsChatLog` collections sit
   idle.
4. **Data cleanup** (optional, only if rolling back permanently):
   ```
   # from a shell connected to prod Atlas
   db.docchunks.drop();
   db.querycaches.drop();
   db.docschatlogs.drop();
   ```

### Content updates (future-you)

To refresh a PDF or add a new program:
1. Replace / add PDFs at `client/public/program-docs/<slug>/`.
2. For a new slug, update `PROGRAMS` in `server/models/DocChunk.js` (8
   entries today → 9+) and `DOC_TYPE_MAP` in
   `server/scripts/ingestProgramDocs.js`.
3. Locally run `npm run ingest:docs:force` to verify.
4. Commit, push, deploy.
5. On prod, admin → Docs RAG → **Force re-ingest**.

