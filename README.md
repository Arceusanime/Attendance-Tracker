# Attendance Tracker

A beautiful React application for tracking and managing your college attendance percentage.

## Quick Start

### Option 1: Instant Preview (No Installation Required)
1. Open `standalone.html` in your web browser - this shows setup instructions
2. Follow the steps to install Node.js

### Option 2: Full Development Setup

#### Prerequisites
- **Node.js** (includes npm) - Download from [nodejs.org](https://nodejs.org)

#### Setup Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```
   This will open the app in your browser (usually at `http://localhost:3000`)

3. **Build for Production**
   ```bash
  npm run build
   ```

## Deploy on Vercel with GitHub

1. Push this project to a GitHub repository.
2. Sign in to [Vercel](https://vercel.com) and choose **Add New -> Project**.
3. Import the GitHub repository.
4. Keep the default settings for a Vite app:
  - Build Command: `npm run build`
  - Output Directory: `dist`
5. Click **Deploy**.

Vercel will automatically redeploy whenever you push new commits to the connected GitHub branch.

### Optional local Git setup

If this folder is not yet connected to GitHub, you can initialize and push it first:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Project Structure

```
.
├── package.json           # Project dependencies and scripts
├── vite.config.js        # Vite build configuration
├── index.html            # HTML entry point
├── standalone.html       # Standalone HTML version
└── src/
    ├── main.jsx          # React entry point
    ├── App.css           # App styling
    └── index.jsx         # Main App component
```

## Features

- **3-Step Wizard Interface**
  1. Set your weekly class schedule
  2. Enter semester details and attendance data
  3. Get instant attendance analysis

- **Smart Calculations**
  - Current attendance percentage
  - Classes you must attend to reach target
  - Classes you can safely skip
  - Day-by-day breakdown

- **College Holiday Management**
  - Browse and load college holiday presets
  - Add custom holidays
  - Save your college's holiday calendar

- **Theme Support**
  - Light and Dark modes
  - Responsive design for all devices

## Technologies Used

- **React 18** - UI framework
- **Vite** - Lightning-fast build tool
- **DM Sans & DM Mono** - Custom fonts
- **CSS Variables** - Dynamic theming

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## Troubleshooting

### npm command not found
- Make sure Node.js is installed: `node --version`
- Restart your terminal after installation
- Try using `npm` instead of `npm run`

### Port 3000 already in use
- The dev server will automatically try another port
- Or specify a custom port: `npm run dev -- --port 3001`

### Module not found errors
- Delete `node_modules` folder and `package-lock.json`
- Run `npm install` again

## Features Overview

### Schedule Setup
Configure your weekly class timetable across 6 working days (Mon-Sat). Sunday is automatically excluded.

### Semester Configuration
- Semester start and end dates
- Current attendance count
- Total classes conducted so far
- Target attendance percentage (typically 75%)

### Results & Analysis
Get comprehensive insights:
- Your current attendance percentage
- Minimum classes to attend to hit target
- Maximum classes you can skip
- Day-by-day projections
- Visual progress indicators

### Holiday Management
- Integrated holiday calendar with college presets
- Search and load existing college holiday data
- Save your college's holidays for future use
- Manual holiday date entry

---

Made with ❤️ by Arceus
