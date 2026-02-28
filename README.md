# 📅 Agendaly - Appointment Scheduling App

A modern appointment scheduling application built with Vue 3, inspired by Vagaro.

## 🚀 Tech Stack

- **Frontend**: Vue 3 + Vite + TypeScript + Tailwind CSS
- **State Management**: Pinia
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Router**: Vue Router 4
- **Date/Time**: date-fns

## 📦 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to your project's SQL Editor
3. Copy and paste the contents of `supabase-schema.sql` and run it
4. Get your project URL and anon key from Settings > API

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5173`

## 📂 Project Structure

```
src/
├── views/          # Page components
├── components/     # Reusable components
├── stores/         # Pinia stores
├── types/          # TypeScript types
├── lib/            # Utilities (Supabase client)
└── router/         # Vue Router config
```

## 🎯 MVP Features

### Customer Side
- Browse services
- Select date/time based on availability
- Book appointments
- Receive confirmation

### Admin Side
- Manage services (CRUD)
- Set business hours and availability
- View daily/weekly calendar
- Manually add/edit/cancel appointments

## 🗄️ Database Schema

- **services**: Services offered (name, duration, price, buffers)
- **staff**: Staff members and admins
- **availability**: Weekly recurring schedules
- **blocked_dates**: Vacations, holidays, time off
- **appointments**: Actual bookings

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## 📝 License

MIT
