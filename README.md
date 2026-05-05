# MyLifeCall 📞

> **Ring my phone instantly from anywhere in the world.** When someone loads this website, my phone rings — and they can ring again with a button!

## Features

- 🔔 **Auto-ring on page load** — Phone rings when someone visits the site
- 📱 **Ring Again button** — Visitors can press to ring again after 30-second cooldown
- 💬 **Send Message** — Visitors can send custom text messages right to your phone
- 📥 **Interactive Replies** — Incoming messages from your phone are collected in a toggleable panel
- 💾 **Chat History** — Messages are automatically saved in the browser for 4 days so they aren't lost on refresh
- ⏳ **Cooldown timer** — Visual progress bar showing time until next ring
- 🔢 **Ring counter** — Shows how many times the phone has been rung this session
- 🎨 **Premium UI** — Glassmorphism design with animated gradients
- 📱 **Fully responsive** — Works on mobile, tablet, and desktop

## How It Works

1. Visitor opens the website
2. JavaScript sends a high-priority notification via [ntfy.sh](https://ntfy.sh)
3. The ntfy app on my phone receives it and **rings loudly** (even on silent/DND)
4. After 30 seconds, the visitor can tap "Ring Again" to ring once more
5. Visitors can also tap **Send Me a Message** to send custom texts directly to your phone
6. Any non-automated messages published to your topic will trigger a notification badge for the visitor to click and read

## Phone Setup (One-Time, 2 Minutes)

1. Install the **ntfy** app:
   - [Google Play (Android)](https://play.google.com/store/apps/details?id=io.heckel.ntfy)
   - [App Store (iOS)](https://apps.apple.com/us/app/ntfy/id1625396347)
2. Open the app → tap **"+"** → subscribe to topic: `mylifecall-ring-basitali-secret`
3. Done! Your phone will now ring when someone visits the site

## Customization

Edit `script.js` to change:
- `NTFY_TOPIC` — Your unique secret topic name
- `COOLDOWN_SECONDS` — Time between allowed rings (default: 30s)

## Deployment

This site is deployed on **Netlify**. Any push to the `main` branch auto-deploys.

## Tech Stack

- HTML5, CSS3, Vanilla JavaScript
- [ntfy.sh](https://ntfy.sh) — Free push notification service
- [Netlify](https://netlify.com) — Hosting
