# Team Progress Tracker - Login Credentials

**Team-Based Access System**

This application uses a simplified 2-role authentication system:
- **Admin**: Full organization access
- **Team Leads**: Manage their team's consultants and commitments

**No Individual Consultant Logins** - Team leads manage all consultant commitments for their team.

---

## 🔐 Admin Account

**Email:** `admin@learnerseducation.com`  
**Password:** `admin123`

**Access:**
- View all 9 teams
- Access all commitments organization-wide
- Add admin comments visible to all
- View organization hierarchy
- Export all data

---

## 👔 Team Lead Accounts

### Team Tony
**Team Lead:** Tony  
**Email:** `tony@learnerseducation.com`  
**Password:** `teamlead123`

**Team Members (Consultants):**
- Tony
- Elizabeth
- Swetha
- Nimra
- Sulu
- Neelu

**Total:** 6 consultants

---

### Team Shaik
**Team Lead:** Shaik  
**Email:** `shaik@learnerseducation.com`  
**Password:** `teamlead123`

**Team Members:**
- Shaik
- Syed Faizaan
- Thanusree

**Total:** 3 consultants

---

### Team Shasin
**Team Lead:** Shasin  
**Email:** `shasin@learnerseducation.com`  
**Password:** `teamlead123`

**Team Members:**
- Shasin
- Linta
- Dipin
- Rahul
- Munashe

**Total:** 5 consultants

---

### Team Shakil
**Team Lead:** Shakil  
**Email:** `shakil@learnerseducation.com`  
**Password:** `teamlead123`

**Team Members:**
- Shakil
- Niwala
- Lijia
- Neha

**Total:** 4 consultants

---

### Team Anousha
**Team Lead:** Anousha  
**Email:** `anousha@learnerseducation.com`  
**Password:** `teamlead123`

**Team Members:**
- Anousha
- Farheen
- Arunima

**Total:** 3 consultants

---

### Team Jamshad
**Team Lead:** Jamshad  
**Email:** `jamshad@learnerseducation.com`  
**Password:** `teamlead123`

**Team Members:**
- Jamshad
- Arfas
- Rasanjali

**Total:** 3 consultants

---

### Team Manoj
**Team Lead:** Manoj  
**Email:** `manoj@learnerseducation.com`  
**Password:** `teamlead123`

**Team Members:**
- Manoj
- Shibil
- Eslam

**Total:** 3 consultants

---

### Team Bahrain
**Team Lead:** Bahrain  
**Email:** `bahrain@learnerseducation.com`  
**Password:** `teamlead123`

**Team Members:**
- Bahrain
- Aghin

**Total:** 2 consultants

---

### Team Arfath
**Team Lead:** Arfath  
**Email:** `arfath@learnerseducation.com`  
**Password:** `teamlead123`

**Team Members:**
- Arfath
- Lilian
- Aishwarya

**Total:** 3 consultants

---

## 📊 Database Statistics

- **Total Teams:** 9
- **Total Consultants:** 32 (as data, not login accounts)
- **Total Commitments:** 3,349 (full year 2025)
- **Weeks Covered:** 52 weeks of 2025

---

## 🚀 How to Login

1. Go to `http://localhost:3000/login`
2. Choose your role:
   - **Admin** → Use admin credentials above
   - **Team Lead** → Use your team's credentials above
3. Login redirects you to appropriate dashboard

---

## 🎯 What Team Leads Can Do

- ✅ View all team commitments
- ✅ Create commitments for ANY consultant in their team
- ✅ Edit commitments for any team member
- ✅ Add team lead comments (visible to admin & consultants)
- ✅ View consultant performance
- ✅ Export team data
- ✅ Use date range selectors
- ✅ Filter and search commitments

---

## 🛡️ What Admins Can Do

- ✅ Everything Team Leads can do
- ✅ View ALL teams organization-wide
- ✅ Add admin comments (visible to TLs & consultants)
- ✅ View organization hierarchy
- ✅ Export organization-wide data
- ✅ Access cross-team analytics

---

## 🔒 Security Notes

- All passwords are `admin123` or `teamlead123` for development
- Change passwords before production deployment
- Team leads can only access their own team's data
- Admins have full organization access

---

## 🆘 Troubleshooting

**Can't see your team's data?**
- Ensure you're logging in with the correct team lead email
- Check that commitments exist for your team

**Database empty?**
- Run seed script: `node server/utils/seedTeamBased2025.js`
- This creates all 9 teams and 2025 data

**Need to reset?**
- Run seed script again to flush and repopulate

---

**Last Updated:** November 2025  
**System:** Team-Based Access (2 roles: Admin, Team Lead)  
**Database:** 9 teams, 32 consultants, 3349 commitments
