# Team Progress Tracker - Single Service Deployment

Deploy both frontend and backend as a single service on Render.

## 🚀 Quick Start - Local Development

```bash
# Install all dependencies (root, server, client)
npm run install:all

# Run both frontend and backend together
npm run dev

# Or run separately:
npm run dev:server  # Backend only
npm run dev:client  # Frontend only
```

## 📦 Deployment on Render

### Prerequisites
- GitHub repository connected
- MongoDB Atlas database
- Render account

### Step 1: Create Web Service

1. Go to [render.com](https://render.com) → **New +** → **Web Service**
2. Connect repository: `viditkbhatnagar/Consultant_Progress_Tracker_LUC`
3. Configure service:

| Setting | Value |
|---------|-------|
| **Name** | `team-progress-tracker` |
| **Region** | Choose closest |
| **Branch** | `main` |
| **Root Directory** | *(leave empty)* |
| **Runtime** | `Node` |
| **Build Command** | `npm run install:all && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

### Step 2: Environment Variables

Click **Advanced** and add:

```
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/team_progress_tracker
JWT_SECRET=<generate with: openssl rand -base64 32>
JWT_EXPIRE=30d
PORT=10000
```

**MongoDB URI Setup:**
1. MongoDB Atlas → Connect → Connect your application
2. Copy connection string
3. Replace `<password>` and database name

### Step 3: Deploy

1. Click **Create Web Service**
2. Wait 10-15 minutes for deployment
3. Your app will be live at: `https://team-progress-tracker.onrender.com`

## 🔧 How It Works

### Development Mode
- `npm run dev` starts both services concurrently:
  - Backend: `http://localhost:5001`
  - Frontend: `http://localhost:3002`
- Frontend proxies API requests to backend

### Production Mode
- Backend serves built React app as static files
- Single URL for everything
- API routes at `/api/*`
- React app handles all other routes

## 📝 Available Scripts

```bash
npm run dev          # Run both frontend & backend
npm run install:all  # Install all dependencies
npm run build        # Build frontend for production
npm start            # Start production server
npm run seed         # Populate database with test data
```

## 🎯 Post-Deployment

### 1. Seed Database (Optional)
```bash
# In Render Shell or locally:
npm run seed
```

### 2. Test Deployment
- Visit your Render URL
- Login with credentials from `LOGIN_CREDENTIALS.md`

### 3. Monitor
- Check logs in Render dashboard
- Set up error tracking if needed

## ⚠️ Important Notes

### Free Tier Limitations
- Service spins down after 15 min inactivity
- ~30-60 sec cold start on first request
- 750 hours/month free

### API URL Configuration
Frontend automatically uses relative paths (`/api`) in production, so no URL configuration needed!

### Database Backups
Set up MongoDB Atlas automated backups for production data.

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Build fails** | Check build logs, verify all dependencies in package.json |
| **Database connection fails** | Verify MONGODB_URI, check MongoDB Atlas network access (allow 0.0.0.0/0) |
| **404 on routes** | Ensure React routing is properly configured in server.js |
| **Slow cold starts** | Expected on free tier, upgrade to paid tier ($7/mo) for instant starts |

## 🔗 Useful Commands

```bash
# Check if concurrently is installed
npm list concurrently

# Test production build locally
npm run build
cd server
NODE_ENV=production npm start
# Visit http://localhost:5001
```

## 📚 Architecture

```
Root/
├── package.json          # Monorepo orchestration
├── client/               # React frontend
│   ├── package.json
│   ├── public/
│   └── src/
└── server/               # Express backend  
    ├── package.json
    ├── models/
    ├── routes/
    └── server.js         # Serves React build in production
```

## ✅ Deployment Checklist

- [ ] MongoDB Atlas database created
- [ ] Environment variables configured
- [ ] JWT_SECRET generated
- [ ] Build command tested locally
- [ ] Render service created
- [ ] Deployment successful
- [ ] Test login functionality
- [ ] Database seeded (optional)
- [ ] Monitor logs for errors

---

**Your App URL:** `https://your-app-name.onrender.com`

🎉 **Single Service = Simpler Deployment!**
