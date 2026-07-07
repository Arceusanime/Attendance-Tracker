# Firebase + Vercel Setup Guide

## What you need
- Node.js 18+ (https://nodejs.org)
- VS Code
- A free Google account (for Firebase)
- A free GitHub account (for Vercel deployment)

---

## Part 1 — Install dependencies

Open your project folder in VS Code terminal and run:

```bash
npm install
```

That installs the official Firebase v9 modular SDK. No CDN links, no
hacks — tree-shakeable and production-ready.

---

## Part 2 — Create your Firebase project (free, 5 min)

### Step 1 — Create project
1. Go to https://console.firebase.google.com
2. Click **Add project**
3. Enter a name, e.g. `attendance-tracker`
4. Disable Google Analytics (not needed) → **Create project**

### Step 2 — Create Firestore database
1. Left sidebar → **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** → **Next**
4. Pick the server location closest to you (e.g. `asia-south1` for India) → **Enable**

### Step 3 — Get your config
1. Click the gear icon (top-left) → **Project settings**
2. Scroll to **Your apps** → click the **</>** (Web) icon
3. Enter any app nickname → **Register app**
4. Copy the firebaseConfig object shown on screen

### Step 4 — Paste config into index.jsx
Find this block near the top of src/index.jsx:

```js
const firebaseConfig = {
  apiKey: "AIzaSyA8O-eoAJ3SqF5zDh66iLF_h7VGNIdiJaw",
  authDomain: "attendence-f0cbd.firebaseapp.com",
  projectId: "attendence-f0cbd",
  storageBucket: "attendence-f0cbd.firebasestorage.app",
  messagingSenderId: "897068110536",
  appId: "1:897068110536:web:15c7a49f5de8c9ef44cbfd"
};
```

Replace every "YOUR_..." placeholder with your actual values. Save.

### Step 5 — Set Firestore security rules (for production)
Firebase Console → Firestore Database → Rules → replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /college_presets/{docId} {
      allow read: if true;
      allow write: if request.resource.data.keys().hasAll(['name','holidays','updatedAt'])
                   && request.resource.data.name is string
                   && request.resource.data.name.size() < 200
                   && request.resource.data.holidays is list
                   && request.resource.data.holidays.size() < 400;
    }
  }
}
```

Click Publish.

---

## Part 3 — Run locally

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

Test the preset system:
1. Go to Setup → Holidays and Leaves
2. Add a few holiday dates manually
3. Click "Save my college" → enter a name → Save
4. Open in an incognito window or another device
5. Click "Browse saved colleges" — your entry should appear

---

## Part 4 — Deploy to Vercel (free)

### Option A — Via GitHub (recommended, auto-deploys on push)

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Then:
1. Go to https://vercel.com/new
2. Click Import Git Repository → select your repo
3. Framework preset: Vite (auto-detected)
4. Click Deploy

Any future git push automatically redeploys.

### Option B — Vercel CLI

```bash
npm install -g vercel
npm run build
vercel --prod
```

---

## File structure

```
your-project/
├── src/
│   ├── main.jsx        <- entry point (unchanged)
│   └── index.jsx       <- entire app component
├── index.html
├── package.json
└── vite.config.js
```

---

## Firestore data shape

Collection: college_presets
Document ID: slugified college name (e.g. anna-university)

Fields:
  name        : "Anna University"
  description : "2025-26 Academic Year"
  holidays    : ["2025-01-14", "2025-01-26", "2025-04-14"]
  updatedAt   : "2025-06-19"

---

## Firebase free tier limits (Spark plan)

| Resource       | Free allowance  |
|----------------|-----------------|
| Reads          | 50,000 / day    |
| Writes         | 20,000 / day    |
| Storage        | 1 GiB total     |
| Network egress | 10 GiB / month  |

More than enough for hundreds of college users.

---

## Quick troubleshooting

| Problem | Fix |
|---|---|
| "Firebase not configured" banner | Haven't replaced YOUR_API_KEY placeholders |
| "Could not load presets" error | Check Firestore rules are published and API key is correct |
| npm run dev fails | Run npm install, then run npm run dev again |
| Vercel build fails | Ensure vite.config.js exists and "type":"module" is in package.json |
