# Deployment Guide - Render

This guide will walk you through deploying the Team Progress Tracker application on Render.

## Prerequisites

- ✅ GitHub repository with your code (already done)
- ✅ MongoDB Atlas account with database set up
- ✅ Render account (free tier works fine)

---

## Part 1: Deploy Backend (Node.js API)

### Step 1: Create Web Service on Render

1. Go to [render.com](https://render.com) and sign in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository: `viditkbhatnagar/Consultant_Progress_Tracker_LUC`
4. Click **"Connect"** next to your repository

### Step 2: Configure Backend Service

Fill in the following settings:

| Field | Value |
|-------|-------|
| **Name** | `team-progress-tracker-api` (or your choice) |
| **Region** | Choose closest to you |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

### Step 3: Add Environment Variables

Click **"Advanced"** and add these environment variables:

| Key | Value | Notes |
|-----|-------|-------|
| `NODE_ENV` | `production` | |
| `PORT` | `5001` | Or leave blank (Render auto-assigns) |
| `MONGODB_URI` | `your_mongodb_atlas_connection_string` | From MongoDB Atlas |
| `JWT_SECRET` | Generate a random string | Use: `openssl rand -base64 32` |
| `JWT_EXPIRE` | `30d` | Token expiration |
| `FRONTEND_URL` | `https://your-frontend-url.onrender.com` | Add after frontend deployment |

**Getting MongoDB URI:**
- Go to MongoDB Atlas → Clusters → Connect
- Choose "Connect your application"
- Copy the connection string
- Replace `<password>` with your database password
- Replace `<dbname>` with `team_progress_tracker`

Example: `mongodb+srv://username:password@cluster.mongodb.net/team_progress_tracker?retryWrites=true&w=majority`

### Step 4: Deploy Backend

1. Click **"Create Web Service"**
2. Wait for deployment (5-10 minutes)
3. Once deployed, copy your backend URL (e.g., `https://team-progress-tracker-api.onrender.com`)

---

## Part 2: Deploy Frontend (React App)

### Step 1: Update Frontend API URL

Before deploying frontend, update the API URL in your code:

1. Open `client/src/utils/constants.js`
2. Update `API_BASE_URL` to point to your deployed backend:

```javascript
export const API_BASE_URL = process.env.REACT_APP_API_URL || 
  'https://team-progress-tracker-api.onrender.com/api'; // Replace with your backend URL
```

3. Commit and push changes:
```bash
git add client/src/utils/constants.js
git commit -m "Update API URL for production"
git push origin main
```

### Step 2: Create Frontend Web Service

1. On Render, click **"New +"** → **"Web Service"**
2. Select the same repository
3. Click **"Connect"**

### Step 3: Configure Frontend Service

| Field | Value |
|-------|-------|
| **Name** | `team-progress-tracker-app` |
| **Region** | Same as backend |
| **Branch** | `main` |
| **Root Directory** | `client` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npx serve -s build -l 3000` |
| **Instance Type** | `Free` |

### Step 4: Add Frontend Environment Variables

Click **"Advanced"** and add:

| Key | Value |
|-----|-------|
| `REACT_APP_API_URL` | `https://team-progress-tracker-api.onrender.com/api` |
| `NODE_ENV` | `production` |

### Step 5: Deploy Frontend

1. Click **"Create Web Service"**
2. Wait for deployment (5-10 minutes)
3. Once deployed, copy your frontend URL (e.g., `https://team-progress-tracker-app.onrender.com`)

---

## Part 3: Update CORS Settings

### Update Backend Environment Variable

1. Go to your **backend service** on Render
2. Go to **"Environment"** tab
3. Update or add `FRONTEND_URL` with your actual frontend URL:
   - `https://team-progress-tracker-app.onrender.com`
4. Click **"Save Changes"**
5. The backend will automatically redeploy

---

## Part 4: Seed Database (Optional)

If you want to populate the database with initial data:

### Option 1: Run Seed Script Locally

```bash
cd server
node scripts/seedDatabase.js
```

### Option 2: Add as One-Time Job on Render

1. In backend service, go to **"Shell"** tab
2. Run:
```bash
node scripts/seedDatabase.js
```

---

## Part 5: Test Your Deployment

1. **Visit your frontend URL**: `https://team-progress-tracker-app.onrender.com`
2. **Test login** with credentials from `LOGIN_CREDENTIALS.md`
3. **Check all features** work correctly

---

## Common Issues & Fixes

### ❌ CORS Errors

**Fix:** Ensure `FRONTEND_URL` environment variable is set correctly in backend

### ❌ API Connection Failed

**Fix:** 
- Check `REACT_APP_API_URL` in frontend environment variables
- Verify backend is running (check Render logs)

### ❌ Database Connection Failed

**Fix:**
- Verify MongoDB Atlas connection string is correct
- Ensure MongoDB Atlas allows connections from anywhere (0.0.0.0/0) for Render IPs

### ❌ Build Failures

**Fix:**
- Check Render logs for specific errors
- Ensure `package.json` has all dependencies
- Verify build commands are correct

---

## Free Tier Limitations

⚠️ **Render Free Tier:**
- Services spin down after 15 minutes of inactivity
- First request after sleep takes ~30-60 seconds
- 750 hours/month free

💡 **Tip:** For production, consider upgrading to paid tier ($7/month per service)

---

## Environment Variables Summary

### Backend
```
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_random_secret
JWT_EXPIRE=30d
FRONTEND_URL=https://your-frontend.onrender.com
```

### Frontend
```
REACT_APP_API_URL=https://your-backend.onrender.com/api
NODE_ENV=production
```

---

## Next Steps

✅ Deployment complete!

**Recommended actions:**
1. Set up custom domain (optional)
2. Monitor application health on Render dashboard
3. Set up error tracking (Sentry, LogRocket, etc.)
4. Configure MongoDB backups
5. Share application URL with your team

---

## Support

If you encounter issues:
- Check Render logs: Service → Logs tab
- Verify environment variables
- Test API endpoints directly: `https://your-backend.onrender.com/api/health`
- Review MongoDB Atlas network access settings

---

**Your Application URLs:**
- **Frontend:** Will be `https://team-progress-tracker-app.onrender.com` (or your chosen name)
- **Backend API:** Will be `https://team-progress-tracker-api.onrender.com` (or your chosen name)

🎉 **Happy Deploying!**
