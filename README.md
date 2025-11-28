# Team Progress Tracker - Development Setup

## Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn

## Installation

### 1. Clone and Install Dependencies

```bash
# Navigate to project directory
cd teamProgressTracker

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Environment Variables

**Server (.env):**
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/team-progress-tracker
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d
```

**Client (.env):**
```env
REACT_APP_API_URL=http://localhost:5000/api
```

### 3. Start MongoDB

If using local MongoDB:
```bash
# macOS (Homebrew)
brew services start mongodb-community

# Or start manually
mongod --config /usr/local/etc/mongod.conf
```

If using MongoDB Atlas, update the MONGODB_URI in server/.env with your connection string.

### 4. Seed Test Users

```bash
cd server
node utils/seedUsers.js
```

This creates:
- **Admin**: bhanu@company.com / Admin@123
- **Team Lead**: shasin@company.com / TeamLead@123
- **Consultants**: linta@company.com, dipin@company.com, munashe@company.com, rahul@company.com / Consultant@123

### 5. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```
Server runs on: http://localhost:5000

**Terminal 2 - Frontend:**
```bash
cd client
npm start
```
React app runs on: http://localhost:3000

# Team Progress Tracker

A comprehensive full-stack web application for tracking team commitments, progress, and performance metrics. Built with the MERN stack (MongoDB, Express.js, React, Node.js) and Material-UI.

## 🚀 Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (Admin, Team Lead, Consultant)
- Secure password hashing with bcrypt
- Protected routes and API endpoints

### Role-Specific Dashboards

#### Consultant Dashboard
- Personal commitment tracking
- Weekly commitment creation and management
- Performance metrics (achievement rate, meetings, admissions)
- Interactive analytics charts (Pie, Bar, Line charts)
- Lead stage tracking with color coding
- Follow-up reminders
- Export capabilities (Excel, CSV)
- Search and filter commitments

#### Team Lead Dashboard
- Team overview with consultant performance cards
- All team commitments in one view
- Add corrective actions to commitments
- Prospect rating (1-10 scale)
- Team metrics aggregation
- Performance comparison charts

#### Admin Dashboard
- Organization-wide metrics
- Team performance overview
- User management interface
- Multi-team analytics
- Comprehensive data export

### Analytics & Reporting
- Interactive charts using Recharts
  - Lead Stage Distribution (Pie Chart)
  - Achievement vs Target (Bar Chart)
  - Meetings Tracking (Bar Chart)
  - Weekly Trends (Line Chart)
  - Consultant Performance Comparison
- Excel export with multiple sheets
- CSV export for data analysis
- Auto-sized columns and formatted data

### Notifications & Reminders
- Notification bell with badge count
- Follow-up reminders for commitments
- Auto-refresh notifications (every 60 seconds)
- Mark as read/unread functionality
- Delete notifications

### Search & Filter
- Real-time search by student name or commitment
- Filter by lead stage
- Filter by status
- Clear all filters option

### Commitment Management
- Create, Read, Update, Delete operations
- Weekly workflow tracking
- Lead stage progression
- Conversion probability tracking
- Meeting count tracking
- Admission closure tracking
- Corrective actions by team leads

---

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MongoDB Atlas account (or local MongoDB)

---

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/teamProgressTracker.git
cd teamProgressTracker
```

### 2. Backend Setup
```bash
cd server
npm install
```

Create `server/.env` file:
```env
NODE_ENV=development
PORT=5001
MONGODB_URI=mongodb+srv://your-username:your-password@cluster.mongodb.net/team_progress_tracker?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRE=30d
```

### 3. Frontend Setup
```bash
cd ../client
npm install
```

Create `client/.env` file:
```env
REACT_APP_API_URL=http://localhost:5001/api
```

### 4. Seed Database (Optional)
```bash
cd ../server
node utils/seedUsers.js
```

**Test Credentials:**
- Admin: `bhanu@company.com` / `Admin@123`
- Team Lead: `shasin@company.com` / `TeamLead@123`
- Consultant: `linta@company.com` / `Consultant@123`

### 5. Run the Application

**Start Backend:**
```bash
cd server
npm run dev
```

**Start Frontend** (in new terminal):
```bash
cd client
npm start
```

Access the application at `http://localhost:3000`

---

## 📁 Project Structure

```
teamProgressTracker/
├── server/                 # Backend (Node.js/Express)
│   ├── config/            # Database configuration
│   ├── models/            # Mongoose models (User, Commitment, Notification, WeeklySummary)
│   ├── controllers/       # Route controllers
│   ├── routes/            # API routes
│   ├── middleware/        # Auth, error handling middleware
│   ├── utils/             # Utility functions, seed scripts
│   └── server.js          # Express app entry point
│
├── client/                # Frontend (React/Material-UI)
│   ├── public/            # Static files
│   └── src/
│       ├── components/    # Reusable components
│       │   ├── Charts.js
│       │   ├── CommitmentFilters.js
│       │   ├── CommitmentFormDialog.js
│       │   ├── NotificationBell.js
│       │   └── PrivateRoute.js
│       ├── context/       # React context (AuthContext)
│       ├── pages/         # Page components (dashboards, login)
│       ├── services/      # API services
│       ├── utils/         # Utility functions, constants
│       └── App.js         # Main app component
│
├── DEPLOYMENT.md          # Deployment guide
├── README.md              # This file
└── .gitignore
```

---

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/register      - Register new user (Admin only)
POST   /api/auth/login         - Login
GET    /api/auth/me            - Get current user
POST   /api/auth/logout        - Logout
PUT    /api/auth/updatepassword - Update password
```

### Commitments
```
GET    /api/commitments                    - Get commitments (role-filtered)
POST   /api/commitments                    - Create commitment
GET    /api/commitments/:id                - Get single commitment
PUT    /api/commitments/:id                - Update commitment
DELETE /api/commitments/:id                - Delete commitment
PATCH  /api/commitments/:id/close          - Mark admission closed
PATCH  /api/commitments/:id/meetings       - Update meeting count
GET    /api/commitments/week/:num/:year    - Get week commitments
```

### Notifications
```
GET    /api/notifications                   - Get user notifications
PATCH  /api/notifications/:id/read          - Mark as read
PATCH  /api/notifications/read-all          - Mark all as read
DELETE /api/notifications/:id               - Delete notification
POST   /api/notifications/generate-reminders - Generate follow-up reminders
```

### Users
```
GET    /api/users                  - Get all users (Admin)
GET    /api/users/:id              - Get user by ID
PUT    /api/users/:id              - Update user
DELETE /api/users/:id              - Delete user
GET    /api/users/teamlead/:id/consultants - Get consultants by team lead
```

---

## 🎨 Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **express-validator** - Input validation
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment variables

### Frontend
- **React** - UI library
- **Material-UI** - Component library
- **React Router** - Routing
- **Axios** - HTTP client
- **Recharts** - Data visualization
- **XLSX** - Excel export
- **file-saver** - File downloads
- **date-fns** - Date utilities

---

## 🚀 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive deployment instructions including:
- MongoDB Atlas setup
- Heroku deployment
- DigitalOcean/VPS deployment
- Vercel/Netlify frontend deployment
- Production configuration
- Monitoring and maintenance

---

## 🧪 Testing

**Manual Testing Checklist:**
- [ ] User registration and login
- [ ] Role-based dashboard access
- [ ] Create commitments
- [ ] Update commitments
- [ ] Filter and search
- [ ] Export to Excel/CSV
- [ ] Notifications
- [ ] Charts rendering
- [ ] Responsive design

---

## 📊 Database Models

### User
- Authentication fields (email, password)
- Role (admin, team_lead, consultant)
- Team information
- Profile data

### Commitment
- Student information
- Commitment details
- Lead stage tracking
- Progress metrics
- Team lead oversight

### Notification
- Recipient
- Message
- Type (follow_up, weekly_summary, system)
- Read status

### WeeklySummary
- Aggregated metrics
- Weekly reports
- Team/consultant statistics

---

## 🔒 Security

- JWT token-based authentication
- Password hashing with bcrypt (salt rounds: 10)
- Role-based authorization middleware
- Protected API routes
- Input validation
- CORS configuration
- Environment variable protection

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👨‍💻 Author

**Your Name**
- GitHub: [@your-username](https://github.com/your-username)
- Email: your-email@example.com

---

## 🙏 Acknowledgments

- Material-UI for the component library
- Recharts for data visualization
- MongoDB Atlas for database hosting
- The open-source community

---

## 📞 Support

For support, email your-support@email.com or open an issue in the repository.

---

**Made with ❤️ for team progress tracking**

## Project Structure

```
teamProgressTracker/
├── server/                  # Backend
│   ├── config/             # DB connection
│   ├── controllers/        # Business logic
│   ├── middleware/         # Auth & error handling
│   ├── models/             # MongoDB models
│   ├── routes/             # API routes
│   ├── utils/              # Helper functions & seeds
│   ├── .env                # Environment variables
│   └── server.js           # Entry point
└── client/                 # Frontend
    ├── public/
    ├── src/
    │   ├── components/     # Reusable components
    │   ├── context/        # State management
    │   ├── pages/          # Page components
    │   ├── services/       # API services
    │   ├── utils/          # Helper functions
    │   └── App.js          # Main app
    └── .env                # Environment variables
```

## Available API Endpoints

### Authentication
- POST /api/auth/register - Register user (Admin only)
- POST /api/auth/login - Login
- GET /api/auth/logout - Logout
- GET /api/auth/me - Get current user
- PUT /api/auth/updatepassword - Update password

### Users
- GET /api/users - Get all users (role-based)
- GET /api/users/:id - Get single user
- PUT /api/users/:id - Update user
- DELETE /api/users/:id - Delete user (Admin only)
- GET /api/users/team/:teamLeadId - Get team consultants

## Testing the Setup

1. Start both servers (backend and frontend)
2. Open http://localhost:3000
3. Login with any test user credentials
4. You should be redirected to the appropriate dashboard based on role

## Next Steps - Phase 2

Phase 1 (Foundation) is complete! Next steps:
- Implement commitment CRUD operations
- Create commitment forms
- Build weekly workflow logic
- Add commitment management features

## Troubleshooting

**MongoDB Connection Error:**
- Ensure MongoDB is running
- Check MONGODB_URI in .env
- Verify database permissions

**Port Already in Use:**
- Change PORT in server/.env
- Update REACT_APP_API_URL in client/.env accordingly

**CORS Issues:**
- Ensure backend CORS is properly configured
- Check that API_BASE_URL matches your backend

## Production Deployment (Future)

When ready to deploy:
1. Set up MongoDB Atlas
2. Create Render web service
3. Configure environment variables
4. Deploy backend to Render
5. Build frontend and deploy to Render static site
6. Update REACT_APP_API_URL to production URL
