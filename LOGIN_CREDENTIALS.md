# Team Progress Tracker - Login Credentials

This document contains all login credentials for testing and accessing the Team Progress Tracker application.

---

## � Admin Account

The admin has full access to all features, including user management, viewing all teams and commitments across the organization.

**Email:** `admin@learnerseducation.com`  
**Password:** `admin123`

**Access Level:** 
- View all teams and consultants
- Manage users (create, edit, delete)
- Access all commitments across the organization
- View organization-wide analytics

---

## � Team Lead Accounts

Team leads can view and manage their team's commitments, provide corrective actions, and rate prospects.

### North Region Team

**Name:** Shagun Kumar  
**Email:** `shagun.kumar@learnerseducation.com`  
**Password:** `teamlead123`

**Team Members:**
- Linta Joseph
- Rahul Verma
- Anjali Desai

**Access Level:**
- View team commitments
- Add corrective actions
- Rate prospect potential
- Export team data
- View individual consultant performance

---

### South Region Team

**Name:** Priya Singh  
**Email:** `priya.singh@learnerseducation.com`  
**Password:** `teamlead123`

**Team Members:**
- Arjun Reddy
- Kavya Nair

**Access Level:**
- View team commitments
- Add corrective actions
- Rate prospect potential
- Export team data
- View individual consultant performance

---

## 👨‍💼 Consultant Accounts

Consultants can manage their own commitments, track meetings, and update lead stages.

### North Region Team Consultants

#### 1. Linta Joseph
**Email:** `linta.joseph@learnerseducation.com`  
**Password:** `consultant123`  
**Team Lead:** Shagun Kumar (North Region Team)

#### 2. Rahul Verma
**Email:** `rahul.verma@learnerseducation.com`  
**Password:** `consultant123`  
**Team Lead:** Shagun Kumar (North Region Team)

#### 3. Anjali Desai
**Email:** `anjali.desai@learnerseducation.com`  
**Password:** `consultant123`  
**Team Lead:** Shagun Kumar (North Region Team)

---

### South Region Team Consultants

#### 4. Arjun Reddy
**Email:** `arjun.reddy@learnerseducation.com`  
**Password:** `consultant123`  
**Team Lead:** Priya Singh (South Region Team)

#### 5. Kavya Nair
**Email:** `kavya.nair@learnerseducation.com`  
**Password:** `consultant123`  
**Team Lead:** Priya Singh (South Region Team)

**Access Level:** (All Consultants)
- Create and manage own commitments
- Update meeting counts
- Mark admissions as closed
- Track lead stages
- View own performance analytics
- Export own commitment data

---

## 📊 Test Data Overview

The database is populated with:
- **506 commitments** across **52 weeks of 2025**
- **5 consultants** in **2 teams**
- Each consultant has **1-3 commitments per week**
- Realistic data with varied lead stages, statuses, and achievement percentages
- Multiple admissions closed for testing

---

## 🚀 Quick Login Guide

1. Navigate to `http://localhost:3000` (or your deployed URL)
2. Click on "Login"
3. Enter email and password from above
4. Click "Sign In"
5. You will be automatically redirected to your role-specific dashboard

---

## 🔒 Security Notes

- **For Development Only:** These credentials are for development and testing purposes
- **Production:** Change all passwords before deploying to production
- **Password Policy:** All passwords use simple values for testing convenience
- **Environment Variables:** Sensitive configuration is stored in `.env` files (not in version control)

---

## � Role-Based Dashboard Features

### Admin Dashboard
- Organization-wide metrics
- All team performance overview
- User management interface
- All commitments table
- Global analytics and charts

### Team Lead Dashboard
- Team metrics and performance
- Consultant performance cards (clickable for details)
- Team commitments table
- Lead stage distribution charts
- Activity heatmap
- Date range selector (Current Week/Month/Last 3 Months/Custom)
- Export functionality (Excel/CSV)
- Search and filter capabilities

### Consultant Dashboard
- Personal performance metrics
- Own commitments management
- Analytics charts
- Create new commitments
- Update meetings and lead stages
- Mark admissions as closed
- Export own data

---

## 🆘 Troubleshooting

**Login Failed?**
- Ensure you're using the correct email domain: `@learnerseducation.com`
- Passwords are case-sensitive
- Clear browser cache and try again
- Verify the backend server is running on port 5001

**Database Empty?**
- Run the seed script: `node server/utils/seed2025.js`
- This will populate the database with full year 2025 data

**Need Fresh Data?**
- Run the seed script again to reset all data
- This will clear existing data and create new test data

---

## 📞 Support

For issues or questions:
1. Check `HOW_TO_RUN.md` for setup instructions
2. Check `README.md` for project overview
3. Review `DEPLOYMENT.md` for deployment guide

---

**Last Updated:** November 2025  
**Database Version:** 2025 Full Year Data (52 weeks, 506 commitments)
