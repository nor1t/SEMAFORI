# 🚦 SEMAFORI - Traffic Control Command Center

**Professional Traffic Incident Management System for Real-time Traffic Control**

🚀 **Live Demo:** [https://semaf.vercel.app](https://semaf.vercel.app)

![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen) ![Vercel Deploy](https://img.shields.io/badge/Deployed-Vercel-black?logo=vercel) ![React](https://img.shields.io/badge/React-19.2.4-blue?logo=react) ![License](https://img.shields.io/badge/License-MIT-green)

---

## 📋 Overview

SEMAFORI is a comprehensive, production-ready traffic incident management system designed for traffic control officers and traffic management centers. The application provides real-time incident reporting, tracking, and management with AI-powered traffic analysis capabilities.

**Key Achievement:** Recently hardened and debugged for production deployment with comprehensive error handling, improved UX, and code optimization.

### ✨ Core Features

- 🔐 **Secure Authentication** – User registration and login with Supabase Auth
- 🚨 **Incident Management** – Create, update, and delete traffic incident reports
- 📊 **Real-time Dashboard** – Live statistics, incident overview, and traffic visualization
- 🤖 **AI-Powered Analysis** – Get intelligent traffic recommendations via Groq API
- 👤 **User Profiles** – Personal information management and incident history
- 📱 **Responsive Design** – Fully responsive for desktop, tablet, and mobile
- 🌙 **Professional Dark Theme** – Modern dark mode with accessibility support

---

## 🛠️ Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React.js | 19.2.4 |
| **Routing** | React Router | 7.13.2 |
| **Styling** | Tailwind CSS | 3.x |
| **Authentication** | Supabase Auth | 2.x |
| **Database** | PostgreSQL (Supabase) | Latest |
| **AI Integration** | Groq API | Mixtral-8x7B |
| **Build Tool** | Vite | 6.0+ |
| **Deployment** | Vercel | Auto-Deploy |
| **Version Control** | Git & GitHub | Latest |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher ([Download](https://nodejs.org))
- **npm** or **yarn** package manager
- **Git** for version control

### Environment Configuration

Create a `.env.local` file in the project root with these variables:

```env
# Supabase Configuration (Required)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Groq API Configuration (Required for AI features)
VITE_GROQ_API_KEY=gsk_j2fGgaCncrfYOizJrz2WXvLsSGR3PsOWf...
```

### Installation Steps

```bash
# 1. Clone the repository
git clone https://github.com/nor1t/SEMAFORI.git
cd SEMAFORI

# 2. Install dependencies
npm install

# 3. Create and configure .env.local
cp .env.example .env.local
# Edit .env.local with your API keys

# 4. Start development server
npm run dev

# 5. Open in browser
# Navigate to http://localhost:5173
```

### Available Commands

```bash
npm run dev       # Start development server with hot reload
npm run build     # Build for production
npm run preview   # Preview production build locally
npm run lint      # Run ESLint for code quality
```

---

## 📁 Project Structure

```
SEMAFORI/
├── src/
│   ├── components/
│   │   ├── AIAssistant.jsx       # AI chat interface and responses
│   │   ├── Header.jsx            # Navigation header with user menu
│   │   ├── Input.jsx             # Reusable form input component
│   │   ├── ProtectedRoute.jsx    # Route protection wrapper
│   │   └── Settings.jsx          # User settings and preferences modal
│   │
│   ├── context/
│   │   └── AuthContext.jsx       # Authentication state management
│   │
│   ├── hooks/
│   │   └── useAuth.js            # Custom authentication hook
│   │
│   ├── pages/
│   │   ├── Dashboard.jsx         # Main incident management dashboard
│   │   ├── Login.jsx             # User login page
│   │   ├── Profile.jsx           # User profile and statistics
│   │   └── Signup.jsx            # User registration page
│   │
│   ├── services/
│   │   ├── groqService.js        # Groq AI API integration
│   │   └── supabaseClient.js     # Supabase client configuration
│   │
│   ├── App.jsx                   # Root application component
│   ├── main.jsx                  # Application entry point
│   ├── App.css                   # Global styles
│   └── index.css                 # Base CSS configuration
│
├── public/                        # Static assets
├── .env.example                   # Environment variables template
├── .eslintrc.js                   # ESLint configuration
├── tailwind.config.js             # Tailwind CSS configuration
├── vite.config.js                 # Vite bundler configuration
├── package.json                   # Project dependencies and scripts
└── README.md                      # This file
```

---

## 🔧 Configuration & Setup

### Supabase Database Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Navigate to **Settings > API** and copy your Project URL and Anon Key
3. Create the `user_data` table using the SQL query below:

```sql
CREATE TABLE user_data (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX user_data_user_id_idx ON user_data(user_id);
CREATE INDEX user_data_created_at_idx ON user_data(created_at DESC);
```

### Groq API Configuration

1. Sign up at [groq.com/console](https://groq.com/console)
2. Navigate to API Keys section
3. Create a new API key
4. Add to `.env.local` as `VITE_GROQ_API_KEY`

### Authentication Flow

The application uses Supabase Authentication:

```
User Registration/Login
        ↓
Supabase Auth (Password + Email Verification)
        ↓
JWT Token Generated
        ↓
AuthContext Stores Session
        ↓
ProtectedRoute Validates Access
        ↓
Dashboard Available
```

---

## 📊 Recent Improvements (Latest Deployment)

### ✅ Bug Fixes

**Critical Issue: White Screen Dashboard**
- **Problem:** Dashboard rendered blank after successful login
- **Root Cause:** Circular useEffect dependency + missing dark mode class
- **Solution:** Fixed dependency chain and applied dark mode globally
- **Impact:** Dashboard now fully functional with all features visible

### ✅ UX Enhancements

1. **Loading States**
   - Clear spinning animation during data fetch
   - Prevents user confusion about application responsiveness

2. **Error Handling**
   - Comprehensive error messages in Albanian
   - Network error detection and auto-retry
   - Timeout handling (15 seconds)

3. **Form Feedback**
   - Required field validation
   - Visual focus states on inputs
   - Success/error message notifications

4. **User Guidance**
   - Loading indicators
   - Offline detection with helpful message
   - Clear confirmation on completed actions

### ✅ Code Refactoring

1. **Dependency Optimization**
   - Fixed useEffect circular dependencies
   - Proper useCallback implementation
   - Optimized render cycles

2. **Component Structure**
   - Clean separation of concerns
   - Reusable component patterns
   - Proper prop drilling elimination

3. **Error Handling**
   - Comprehensive try-catch blocks
   - Specific error messages for different scenarios
   - Graceful degradation

4. **Code Cleanup**
   - Removed development console logs
   - Production-ready logging
   - Cleaner codebase

---

## 🎤 Demo & Presentation

For the final presentation, please refer to **[`docs/demo-plan.md`](./docs/demo-plan.md)** which includes:

- ✅ **5-7 minute demo script** with clear talking points
- ✅ **Main demo flow:** Authentication → Dashboard → Create Incident → AI Analysis → Settings
- ✅ **Technical highlights** to explain during presentation
- ✅ **Pre-demo verification checklist** to ensure everything works
- ✅ **Plan B strategies** if live demo fails
- ✅ **Ready-made answers** to common technical questions

### Quick Demo Access

**Live URL:** https://semaf.vercel.app

**Demo Account:**
- **Email:** `demo@traffic.gov`
- **Password:** `Demo@123456`

**Expected Demo Duration:** 5-7 minutes with Q&A

---

## 🚀 Deployment

### Deploy to Vercel (Recommended)

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy
vercel

# 3. Add environment variables in Vercel dashboard
# Go to project settings and add:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - VITE_GROQ_API_KEY
```

### Build for Production

```bash
npm run build
npm run preview  # Preview the production build locally
```

The build output is optimized for production with:
- Code splitting
- Minification
- Asset optimization

---

## 🔒 Security Considerations

- **Environment Variables**: Never commit `.env.local` to version control
- **API Keys**: Keep API keys secret and rotate periodically
- **Authentication**: Use HTTPS in production (Vercel provides this automatically)
- **Database**: Use Supabase Row Level Security (RLS) policies
- **CORS**: Configure appropriate CORS settings in Supabase

---

## 📱 Responsive Design

The application is fully responsive and tested on:
- ✅ Desktop (1920px+)
- ✅ Laptop (1280px - 1919px)
- ✅ Tablet (768px - 1279px)
- ✅ Mobile (320px - 767px)

---

## 🎨 Theming

### Dark Mode (Default)

The application uses a professional dark theme with:
- Dark background: `#0f172a` (slate-950)
- Accent colors: Cyan, Sky Blue
- Text colors: Slate-100 for contrast
- Applied globally via Tailwind CSS `dark:` prefixes

### Customization

To modify theme colors, edit `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      // Add custom colors here
    }
  }
}
```

---

## 🧪 Testing

### Manual Testing Checklist

- ✅ Sign up with new email
- ✅ Log in with credentials
- ✅ Create incident report
- ✅ Update incident status
- ✅ Delete incident
- ✅ View dashboard statistics
- ✅ Use AI assistant
- ✅ Offline error handling
- ✅ Dark mode rendering

### Automated Testing

Run ESLint for code quality:

```bash
npm run lint
```

---

## 📖 API Integration

### Supabase Client

```javascript
import { supabase } from '../services/supabaseClient';

// Example: Fetch user data
const { data, error } = await supabase
  .from('user_data')
  .select('*')
  .eq('user_id', user.id);
```

### Groq API

```javascript
import { groqService } from '../services/groqService';

// Example: Get traffic analysis
const analysis = await groqService.getTrafficAnalysis(incidentData);
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Commit: `git commit -m 'feat: Add your feature'`
5. Push: `git push origin feature/your-feature`
6. Open a Pull Request

---

## 📋 Project Status

| Component | Status | Notes |
|-----------|--------|-------|
| Authentication | ✅ Complete | Supabase Auth configured |
| Dashboard | ✅ Complete | All features functional |
| Incident Reporting | ✅ Complete | CRUD operations working |
| AI Assistant | ✅ Complete | Groq API integrated |
| User Profiles | ✅ Complete | Full profile management |
| Responsive Design | ✅ Complete | All breakpoints tested |
| Error Handling | ✅ Complete | Comprehensive coverage |
| Documentation | ✅ Complete | Fully documented |

---

## 📞 Support & Contact

For issues, questions, or suggestions:

1. Open an issue on GitHub
2. Check existing documentation
3. Review the [Debugging & Hardening Report](./DEBUGGING_AND_HARDENING_REPORT.md)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- React.js team for the excellent framework
- Supabase for backend services
- Groq for AI API
- Vercel for deployment platform
- Tailwind CSS for styling

---

**Built with ❤️ for traffic management professionals**

**Current Version:** 1.0.0  
**Last Updated:** April 2026  
**Deployment:** [https://semaf.vercel.app](https://semaf.vercel.app)
