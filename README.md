🧭 Personal Development Plan (PDP) App

A modern, theme-aware, Firebase-powered personal development tracker.

📌 Overview

The Personal Development Plan (PDP) App is a modern, web-based system designed to help individuals track their personal and professional development through structured Goals → Sub-goals → Tasks.

It is built using:

Vanilla JavaScript, HTML, CSS

Firebase Authentication + Firestore

A fully responsive, animated UI

A custom 3-theme system (Light, Dark, and CWM company-branded theme)

A powerful Dashboard and Calendar view

Drag-and-drop reordering of goals, sub-goals, and tasks

Multi-user support (each user only sees their own PDP)

The app is designed to be deployed on GitHub Pages and can be used from desktop or mobile.

✨ Key Features
✅ Full PDP Structure

Create and manage Goals

Break goals down into Sub-goals

Add actionable Tasks under each sub-goal

Track timelines with Projected Start/End Dates

Progress auto-rolls up:

Task → Sub-goal

Sub-goal → Goal

Goal → Dashboard

🗓️ Calendar View (Timeline & Events)

A built-in calendar shows:

Goal timelines (mini-Gantt bars)

Sub-goal timelines

Task due dates

Click any event to open edit modal

Theme-aware, responsive, and clean.

📊 Dashboard Insights

The dashboard includes:

Quick overview of professional vs personal goals

Overall progress

Current Focus Goal

Tasks Due Soon

At-Risk Items

Recently Updated Activity Feed

This gives users a real snapshot of their PDP status the moment they open the app.

🎨 Advanced Theme System

Theme toggle cycles through:

🌞 Light mode (modern gradients)

🌙 Dark mode (deep slate UI)

🏗️ CWM Theme

Uses company brand colors

Neutral dark backgrounds

Branded yellow highlights

CWM logo as theme icon

CWM logo background image

A custom palette picker allows the user to select preset color schemes as well.

🔄 Drag-and-drop Everything

Reorder Goals

Reorder Sub-goals

Reorder Tasks

Changes are saved automatically to Firestore.

🔐 Firebase-Powered Authentication

Secure user login (email/password, extendable to Google/Microsoft OAuth)

Per-user Firestore storage

Real-time sync

🧱 Clean, Modular Code Structure

All logic centralized in main.js

All UI styling in styles.css

Semantic HTML layout in index.html

Designed for future expansion via VS Code + GitHub Copilot

🗂️ Project Structure
personal-dev-plan/
├── index.html
├── main.js
├── styles.css
├── assets/
│   ├── cwm-logo.png
│   ├── cwm-logo-icon.ico
│   └── any additional media…
└── dev-notes/
    ├── PDP_MASTER_SPEC.md
    ├── DASHBOARD_UPGRADE_SPEC.md
    └── QUOTE_BANNER_SPEC.md

🚀 Getting Started (Local Development)

You can run the PDP app locally using a simple Node-based static server.

1. Install a simple static server

If you don't have it:

npm install -g serve

2. Run the local dev server

From the project root:

serve .


Your app will be available at:

http://localhost:3000


Or use:

npx http-server

3. Firebase Setup

This app requires:

A Firebase project

Enabled Authentication (email/password or OAuth)

Firestore Database

Firebase Hosting NOT required if using GitHub Pages

You must create and include your Firebase config block in main.js:

const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};


Firestore rules should restrict access to authenticated users only.

🌐 Deployment (GitHub Pages)

This project is designed for GitHub Pages hosting.

To deploy:

Commit your code

Push to main

In GitHub repo settings:

Enable GitHub Pages

Select main branch → /root

Your app will be live at:

https://<yourusername>.github.io/personal-dev-plan/

🛣️ Roadmap (Future Enhancements)

The following features are planned but not yet implemented:

🔔 Reminders & Notifications

Task due reminders, progress nudges, and browser notifications.

📝 Mentorship & Notes Section

A place to log:

VP mentorship notes

Personal reflections

Spiritual learning (NMC University)

Attach to goals/sub-goals optionally

📎 Attachments

Upload documents, PDFs, images to goals/sub-goals/tasks.

🧾 Export Tools

Generate a printable or PDF summary of your entire PDP.

📉 Weekly Trend Tracking

Historical snapshots stored weekly, visualized as sparkline trend lines.

📡 Quote API Support

Pull inspirational quotes from external APIs or a Firestore collection.

🧪 Testing

Mobile responsiveness confirmed

Dark mode & CWM theme tested visually

All CRUD operations validated

Firestore security rules tested with authenticated users

Calendar events match timeline logic

🤝 Contributing

Pull requests are welcome!
This project is structured intentionally to make contributions easy through:

PDP_MASTER_SPEC.md

DASHBOARD_UPGRADE_SPEC.md

QUOTE_BANNER_SPEC.md

Feel free to propose new views, insights, or additional theming expansions.

👤 Author

Drew Coffey
Personal Development Plan App
Built with help from ChatGPT + VS Code Copilot
Designed for ongoing learning, leadership development, and personal growth.

⭐ License

MIT License.
You are free to use, modify, and adapt this for personal or professional development.