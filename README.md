# SQL Terminal

A premium, browser-based SQL terminal with an iOS-inspired dark theme. Execute SQL queries directly in your browser with full SQLite support via sql.js (WebAssembly).

## ✨ Features

- **Full SQL Support** — Powered by sql.js (SQLite compiled to WASM), supports all standard SQL operations: CREATE, INSERT, SELECT, UPDATE, DELETE, ALTER, DROP, JOINs, subqueries, aggregates, and more.
- **Persistent Storage** — All data is saved to browser localStorage. Your database persists across page refreshes and browser sessions.
- **iOS Dark Theme** — Stunning dark theme inspired by Apple's iOS design language with glassmorphism, smooth animations, and premium aesthetics.
- **Query History** — Keeps track of your last 50 queries with timestamps. Click any history item to re-run it.
- **Schema Browser** — View all tables and their schemas in the sidebar. Click any table to inspect its structure.
- **Export/Import** — Export your database as a downloadable .db file. Import existing SQLite databases.
- **Keyboard Shortcuts** — `Ctrl+Enter` (or `Cmd+Enter` on Mac) to execute queries instantly.
- **Responsive Design** — Works beautifully on desktop, tablet, and mobile devices.

## 🚀 Deployment

This is a static site, ready to deploy on Vercel:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Or connect this GitHub repo to Vercel for automatic deployments.

## 🛠️ Tech Stack

- **sql.js** — SQLite compiled to WebAssembly
- **localStorage** — Browser-native persistent storage
- **Vanilla HTML/CSS/JS** — No frameworks, no build step
- **Vercel** — Zero-config static hosting

## 📝 License

MIT
