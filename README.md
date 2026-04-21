# SEMAFORI - Traffic Control Command Center

🚀 **Live Demo:** [https://semaf.vercel.app](https://semaf.vercel.app)

![Vercel Deploy](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel)
![React](https://img.shields.io/badge/React-19.2.4-blue?logo=react)
![Status](https://img.shields.io/badge/Status-Live-brightgreen)

## 📋 Description

SEMAFORI is a comprehensive traffic incident management system designed for traffic control officers. The application allows users to report, track, and manage traffic incidents in real-time, featuring AI-powered assistance for traffic analysis and recommendations.

### ✨ Key Features

- 🔐 **Secure Authentication** – User registration and login with Supabase
- 🚨 **Incident Reporting** – Create detailed traffic incident reports with categorization
- 📊 **Real-time Dashboard** – Monitor active incidents, statistics, and traffic patterns
- 🤖 **AI Assistant** – Get traffic analysis and advice powered by Groq AI
- 👤 **User Profiles** – Manage personal information and view incident statistics
- 📱 **Responsive Design** – Fully responsive interface for desktop and mobile devices
- 🌙 **Dark Mode** – Modern dark theme with customizable settings

## 🛠️ Technologies Used

| Category | Technology |
|----------|------------|
| Frontend | React.js 19.2.4 |
| Styling | Tailwind CSS |
| Authentication | Supabase Auth |
| Database | Supabase PostgreSQL |
| AI Integration | Groq API (Mixtral-8x7B) |
| Deployment | Vercel |
| Version Control | Git & GitHub |
| Build Tool | Vite |

## 📸 Screenshots

### Dashboard Overview
![Dashboard](https://via.placeholder.com/800x600/1a1a1a/ffffff?text=Dashboard+Screenshot)

### Incident Reporting
![Incident Form](https://via.placeholder.com/800x600/1a1a1a/ffffff?text=Incident+Form+Screenshot)

### AI Assistant
![AI Chat](https://via.placeholder.com/800x600/1a1a1a/ffffff?text=AI+Assistant+Screenshot)

## 🚀 Local Development Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Git

### Environment Variables
Create a `.env.local` file in the root directory with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GROQ_API_KEY=your_groq_api_key
```

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/semaf.git
   cd semaf
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env.local`
   - Fill in your API keys

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   - Navigate to `http://localhost:5173`

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── AIAssistant.jsx  # AI chat interface
│   ├── Header.jsx       # Navigation header
│   ├── Input.jsx        # Form input component
│   ├── ProtectedRoute.jsx # Route protection
│   └── Settings.jsx     # User settings modal
├── context/            # React context providers
│   └── AuthContext.jsx # Authentication context
├── hooks/              # Custom React hooks
│   └── useAuth.js      # Authentication hook
├── pages/              # Page components
│   ├── Dashboard.jsx   # Main dashboard
│   ├── Login.jsx       # Login page
│   ├── Profile.jsx     # User profile
│   └── Signup.jsx      # Registration page
├── services/           # API and external services
│   ├── groqService.js  # Groq AI integration
│   └── supabaseClient.js # Supabase client
└── main.jsx           # Application entry point
```

## 🔧 Configuration

### Supabase Setup
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your URL and anon key
3. Create a table called `user_data` with the following schema:
   ```sql
   CREATE TABLE user_data (
     id SERIAL PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id),
     title TEXT NOT NULL,
     description TEXT,
     type TEXT NOT NULL,
     severity TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'active',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

### Groq API Setup
1. Sign up at [groq.com](https://groq.com)
2. Get your API key from the dashboard
3. Add it to your environment variables

## 🚀 Deployment

This project is configured for deployment on Vercel:

1. **Connect Repository**: Link your GitHub repository to Vercel
2. **Environment Variables**: Add the same environment variables in Vercel dashboard
3. **Deploy**: Vercel will automatically build and deploy on every push to main branch

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

Built with ❤️ for traffic management professionals.

**Live URL:** [[Your Vercel URL]](https://your-project-name.vercel.app)

## 🔧 Installation & Local Setup

Follow these steps to run the project locally:

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/[your-username]/[your-repo-name].git
   cd [your-repo-name]