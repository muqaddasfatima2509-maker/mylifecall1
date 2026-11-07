# MyLifeCall 📞

> **Ring my phone instantly from anywhere in the world.** When someone loads this website, my phone rings — and they can ring again with a button!

## Features

- 🔔 **Auto-ring on page load** — Phone rings when someone visits the site
- 📱 **Ring Again button** — Visitors can press to ring again after 30-second cooldown
- 💬 **Live Chat** — Visitors can chat with real-time Firebase Firestore synchronization
- 📥 **Interactive Replies** — Incoming messages from the phone app are automatically posted to the chat
- 🔊 **Continuous Phone Call Alert** — Rings non-stop until dismissed, bypassing silent/Do Not Disturb
- ⏳ **Cooldown timer** — Visual progress bar showing time until next ring
- 🔢 **Ring counter** — Shows how many times the phone has been rung this session
- 🎨 **Premium UI** — Glassmorphism design with animated gradients
- 📱 **Fully responsive** — Works on mobile, tablet, and desktop

## How It Works

1. Visitor opens the website.
2. JavaScript sends a Priority 5 urgent alert via `https://ntfy.adminforge.de` (fully accessible worldwide and in Pakistan without VPN).
3. The ntfy app on the phone receives the alert and **rings loudly and continuously** (even on silent mode / DND).
4. Messages are synchronized live with Firebase Firestore.
5. After 30 seconds, the visitor can tap "Ring Again" to ring once more.

## Phone Setup (One-Time, 2 Minutes)

1. Install the **ntfy** app from [Google Play (Android)](https://play.google.com/store/apps/details?id=io.heckel.ntfy) or [App Store (iOS)](https://apps.apple.com/us/app/ntfy/id1625396347).
2. Open the app ➜ tap **"+"** (Subscribe).
3. Change **Server** to:
   ```text
   https://ntfy.adminforge.de
   ```
4. Enter **Topic name**:
   ```text
   mylifecall-ring-basit
   ```
5. Tap **Subscribe**.

### Enable Continuous Ringing (Like a Phone Call)
1. Open ntfy ➜ **Settings** ⚙️ ➜ **Notifications**.
2. Turn **ON** ➜ **"Keep alerting for highest priority"**.
3. Under Android Settings ➜ Apps ➜ ntfy ➜ Notifications ➜ Max Priority:
   - Ensure Sound is set to an Alarm/Ringtone.
   - Enable "Override Do Not Disturb / Ignore Silent Mode".

## Customization

Edit `script.js` to change:
- `NTFY_SERVERS` — Array of compatible ntfy servers
- `NTFY_TOPIC` — Your topic name
- `COOLDOWN_SECONDS` — Time between allowed rings (default: 30s)

## Tech Stack

- HTML5, CSS3, Vanilla JavaScript
- **ntfy** (`ntfy.adminforge.de`) — High-priority push notifications
- **Firebase Firestore** — Real-time persistent chat history & backup
- **GitHub Pages** — Hosting
