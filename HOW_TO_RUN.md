# How to Run the Team Progress Tracker

## 🚀 Quick Start Guide

### Prerequisites
- Node.js installed (v14+)
- MongoDB Atlas connection configured in `server/.env`
- Two terminal windows

---

## 📝 Step-by-Step Instructions

### 1. Kill Any Running Servers

```bash
# Kill backend (port 5001)
lsof -ti:5001 | xargs kill -9

# Kill frontend (port 3000)
lsof -ti:3000 | xargs kill -9
```

### 2. Start Backend Server

Open **Terminal 1**:

```bash
cd /Users/viditkbhatnagar/codes/teamProgressTracker/server
npm run dev
```

**Expected Output:**
```
Server running in development mode on port 5001
MongoDB Connected: <your-cluster-url>
```

**If you see errors:**
- Check that `server/.env` file exists and has correct MongoDB URI
- Verify MongoDB Atlas connection
- Check if packages are installed: `npm install`

### 3. Start Frontend

Open **Terminal 2**:

```bash
cd /Users/viditkbhatnagar/codes/teamProgressTracker/client
npm start
```

**Expected Output:**
```
Compiled successfully!
You can now view client in the browser.
Local: http://localhost:3000
```

---

## 🗑️ Flush Database & Import CSV Data

### Option 1: Flush and Seed with Sample Data

```bash
cd /Users/viditkbhatnagar/codes/teamProgressTracker/server
node utils/seedUsers.js
```

This will:
- Delete all existing users and commitments
- Create 8 test users (1 admin, 2 team leads, 5 consultants)
- Create 11 sample commitments for Week 48, 2025

### Option 2: Import from CSV Files

**Place your CSV files in:** `server/data/`

Required CSV format:

**users.csv:**
```csv
name,email,password,role,teamName,teamLead,phone
Bhanu Prakash,bhanu@learnerseducation.com,Admin@123,admin,,,+91-9876543210
Shasin Kumar,shasin@learnerseducation.com,TeamLead@123,team_lead,North Region Team,,+91-9876543211
Linta Joseph,linta@learnerseducation.com,Consultant@123,consultant,North Region Team,shasin@learnerseducation.com,+91-9876543213
```

**commitments.csv:**
```csv
consultantEmail,weekNumber,year,dayCommitted,studentName,commitmentMade,leadStage,conversionProbability,followUpDate,followUpNotes,meetingsDone,achievementPercentage,status,admissionClosed
linta@learnerseducation.com,48,2025,Monday,Arjun Mehta,Follow up for MBA admission,Hot,85,2025-11-29,Student very interested,2,75,in_progress,false
```

**Then run:**
```bash
cd /Users/viditkbhatnagar/codes/teamProgressTracker/server
node utils/importCSV.js
```

---

## 🔍 Troubleshooting Login Issues

### Issue: "Login Failed" or "Network Error"

**Cause:** Backend server not running

**Solution:**
1. Check if backend is running on http://localhost:5001
2. Test backend health:
   ```bash
   curl http://localhost:5001/api/health
   ```
3. Check backend terminal for errors

### Issue: "Invalid Credentials"

**Cause:** Incorrect email/password or database not seeded

**Solution:**
1. Re-seed the database:
   ```bash
   cd server
   node utils/seedUsers.js
   ```
2. Use correct credentials (see LOGIN_CREDENTIALS.md)
3. Make sure email is exact (case-sensitive)

### Issue: "Cannot connect to MongoDB"

**Cause:** MongoDB URI incorrect or IP not whitelisted

**Solution:**
1. Check `server/.env` has correct MONGODB_URI
2. In MongoDB Atlas, whitelist your IP (0.0.0.0/0 for all)
3. Verify connection string format

---

## ✅ Verification Checklist

- [ ] Backend running on port 5001 ✓
- [ ] Frontend running on port 3000 ✓
- [ ] MongoDB connected (check backend terminal) ✓
- [ ] Database seeded with users ✓
- [ ] Can access http://localhost:3000 ✓
- [ ] Login page loads ✓
- [ ] Can login with test credentials ✓

---

## 🔑 Test Login

**Quick Test:**
1. Go to http://localhost:3000
2. Login with:
   - Email: `bhanu@learnerseducation.com`
   - Password: `Admin@123`
3. Should redirect to Admin Dashboard

---

## 📊 Viewing Logs

**Backend logs:**
- Running in terminal 1
- Shows API requests, database queries, errors

**Frontend logs:**
- Running in terminal 2
- Shows compilation status, warnings

**Browser console:**
- Open Developer Tools (F12)
- Check Console tab for JavaScript errors
- Check Network tab for API call failures

---

## 🔄 Complete Reset

If everything is broken, do a complete reset:

```bash
# 1. Kill all processes
lsof -ti:5001 | xargs kill -9
lsof -ti:3000 | xargs kill -9

# 2. Clear database
cd /Users/viditkbhatnagar/codes/teamProgressTracker/server
node utils/seedUsers.js

# 3. Restart backend
cd /Users/viditkbhatnagar/codes/teamProgressTracker/server
npm run dev

# 4. In new terminal, restart frontend
cd /Users/viditkbhatnagar/codes/teamProgressTracker/client
npm start
```

---

## 📁 File Locations

- **Backend .env:** `/Users/viditkbhatnagar/codes/teamProgressTracker/server/.env`
- **Frontend .env:** `/Users/viditkbhatnagar/codes/teamProgressTracker/client/.env`
- **Seed script:** `/Users/viditkbhatnagar/codes/teamProgressTracker/server/utils/seedUsers.js`
- **CSV import:** `/Users/viditkbhatnagar/codes/teamProgressTracker/server/utils/importCSV.js`

---

**Need help?** Check the logs in both terminals for specific error messages.
