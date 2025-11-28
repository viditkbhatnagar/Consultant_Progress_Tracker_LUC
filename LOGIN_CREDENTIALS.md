# Team Progress Tracker - Login Credentials

## 🔐 All User Login Credentials

All passwords are: The role name followed by `@123` (e.g., `Admin@123`, `TeamLead@123`, `Consultant@123`)

---

## 👤 ADMIN

**Name:** Bhanu Prakash  
**Email:** `bhanu@learnerseducation.com`  
**Password:** `Admin@123`  
**Role:** Administrator  
**Access:** Full system access, all teams, user management

---

## 👥 TEAM LEADS

### 1. North Region Team Lead

**Name:** Shasin Kumar  
**Email:** `shasin@learnerseducation.com`  
**Password:** `TeamLead@123`  
**Team:** North Region Team  
**Team Size:** 3 Consultants

### 2. South Region Team Lead

**Name:** Priya Sharma  
**Email:** `priya@learnerseducation.com`  
**Password:** `TeamLead@123`  
**Team:** South Region Team  
**Team Size:** 2 Consultants

---

## 💼 CONSULTANTS

### North Region Team (Team Lead: Shasin Kumar)

#### 1. Linta Joseph
- **Email:** `linta@learnerseducation.com`
- **Password:** `Consultant@123`
- **Commitments this week:** 3

#### 2. Rahul Verma
- **Email:** `rahul@learnerseducation.com`
- **Password:** `Consultant@123`
- **Commitments this week:** 2

#### 3. Anjali Desai
- **Email:** `anjali@learnerseducation.com`
- **Password:** `Consultant@123`
- **Commitments this week:** 2

### South Region Team (Team Lead: Priya Sharma)

#### 4. Vikram Singh
- **Email:** `vikram@learnerseducation.com`
- **Password:** `Consultant@123`
- **Commitments this week:** 2

#### 5. Meera Patel
- **Email:** `meera@learnerseducation.com`
- **Password:** `Consultant@123`
- **Commitments this week:** 2

---

## 📊 Database Summary

- **Week:** 48, Year: 2025 (November 24-30, 2025)
- **Total Users:** 8 (1 Admin, 2 Team Leads, 5 Consultants)
- **Total Commitments:** 11 active commitments
- **Teams:** 2 teams (North Region, South Region)
- **Admissions Closed:** 3 successful closures this week

---

## 🎯 Quick Test Logins

**To test Consultant view:**
```
Email: linta@learnerseducation.com
Password: Consultant@123
```

**To test Team Lead view:**
```
Email: shasin@learnerseducation.com
Password: TeamLead@123
```

**To test Admin view:**
```
Email: bhanu@learnerseducation.com
Password: Admin@123
```

---

## 🔄 Re-seeding the Database

To re-seed the database with fresh data, run:

```bash
cd server
node utils/seedUsers.js
```

This will:
1. Clear all existing users and commitments
2. Create new users with the emails above
3. Create 11 sample commitments for Week 48, 2025
4. Display login credentials in the console

---

**Note:** All data is for Week 48, 2025 (November 24-30, 2025) - the current week at the time of seeding.
