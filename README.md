
=======


# NGO Community Connect 🤝

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-12-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Gemini](https://img.shields.io/badge/Gemini_AI-API-4285F4?logo=google-gemini&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Private-red)](./LICENSE)

**NGO Community Connect** is a modern, high-performance platform that bridges the gap between Non-Governmental Organizations (NGOs) and passionate volunteers. Powered by deterministic skill matchmaking, real-time AI assistance, and a premium UI, the platform ensures that the right help reaches the right place — fast.

---


## ✨ Feature Overview
=======


### 🆕 Latest Additions (April 2026)

#### 🔍 Emergency Detail Popup
Clicking any emergency card in the **Available** feed opens a rich detail modal:
- **AI-Generated Incident Narrative** — If the reporter's description is brief (< 100 chars), Gemini AI automatically expands it into a detailed, believable 3–5 paragraph field report. The narrative is cached in Firestore so it only needs to be generated once.
- **Full Address Display** — Complete location string with a one-click "Open in Map" button that launches the interactive Leaflet map modal.
- **Skill Matching Highlights** — Required skills are displayed as badges; any skill that matches your own profile is highlighted in indigo with a checkmark.
- **Pick Up Task & Smart Match** — Action buttons are available directly in the modal footer so volunteers can respond without leaving the popup.

#### 💸 Crowdfunding & Donation Support
Emergency reporters can now attach donation information when filing a report via **Manual Entry**:
- **UPI / Google Pay Link** — A direct clickable link for instant digital payments.
- **QR Code** — Paste an image URL; the QR code renders in the detail popup for on-screen scanning.
- **Bank Transfer Details** — Bank name, IFSC code, account number, and account holder name are shown in a structured grid inside the detail popup.
- A **"DONATIONS OPEN"** badge appears on cards that have donation info attached.

#### 🤖 AI Narrative Generation (`generateDetailedNarrative`)
A new Gemini-powered function in `src/lib/gemini.ts` converts short emergency descriptions into compassionate, factual field reports modelled after real NGO documentation — without inventing specific real-world names or organisations.

---

### Core Features

| Feature | Description |
|---|---|
| 🎯 **Deterministic Matchmaking** | 100-point scoring engine (skills · experience · workload · urgency) served by a Node.js/Express backend |
| 🤖 **AI Emergency Analysis** | Gemini extracts urgency, location, and required skills from free-text reports |
| 🖼️ **OCR Image Reporting** | Upload a photo of a handwritten note; Gemini extracts the text automatically |
| 🗺️ **Interactive Location Map** | Leaflet + OpenStreetMap for pinpointing & verifying emergency locations |
| 📅 **Emergency Archive Calendar** | Browse all historical incidents by date in a calendar view |
| 💬 **Community Chat** | Real-time WhatsApp-style messaging with unread badge tracking |
| 🧑‍💼 **Role-Based Access** | Admins get Smart Match / auto-assign; volunteers self-assign via Pick Up Task |
| 📊 **Profile & Stats** | Personal dashboard tracking tasks completed, skills, and volunteer history |
| 🔒 **Google OAuth** | Secure sign-in for both frontend and the Express backend |
| ⚡ **Real-Time Sync** | Firestore `onSnapshot` listeners keep all data live without refreshing |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 6, Tailwind CSS 4, Motion (Framer Motion v12) |
| **UI Components** | shadcn/ui, Radix UI, Lucide React icons |
| **Backend** | Node.js, Express 4, TSX (TypeScript runner) |
| **Database / Auth** | Firebase Firestore v12, Firebase Authentication |
| **AI** | Google Generative AI SDK — Gemini Flash Preview |
| **Mapping** | React Leaflet + OpenStreetMap (Nominatim geocoding) |
| **Forms** | React Hook Form + Zod validation |
| **Charts** | Recharts |
| **Typography** | Geist Variable font (@fontsource-variable/geist) |
| **Routing** | React Router DOM 7 |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A [Firebase](https://console.firebase.google.com/) project with Firestore and Authentication enabled
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)
- A [Google Cloud OAuth 2.0 Client](https://console.cloud.google.com/apis/credentials)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/PaulLovesCode/ngo-connect.git
cd ngo-community-connect

# 2. Install all dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Then open .env and fill in your real API keys
```

### Environment Variables

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (backend) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret (backend) |
| `VITE_GOOGLE_CLIENT_ID` | Same client ID, exposed to Vite frontend |
| `VITE_FIREBASE_API_KEY` | Firebase Web API key |
| `VITE_GEMINI_API_KEY` | Google Gemini AI API key |

### Running the App

```bash
# Starts both the frontend (localhost:3000) and the backend (localhost:5000) simultaneously
npm run dev:all
```

Open **http://localhost:3000** in your browser.

> **Note:** The matchmaking backend runs on `localhost:5000`. The app degrades gracefully — the "Engine Offline" indicator appears in the header if it cannot be reached, and client-side fallback matching is used instead.

### Other Scripts

```bash
npm run build    # Production bundle → /dist
npm run preview  # Preview the production build locally
npm run lint     # TypeScript type-check (no-emit)
```

---

## 🏗️ Project Structure

```
ngo-community-connect/
├── backend/              # Express matchmaking API (deterministic scoring)
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx       # Main volunteer dashboard + all modals
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   ├── Calendar.tsx        # Emergency archive calendar view
│   │   ├── CommunityChat.tsx   # Real-time group chat
│   │   ├── LocationMap.tsx     # Leaflet map modal + input map
│   │   ├── Profile.tsx         # Volunteer profile & stats
│   │   ├── Settings.tsx        # Account settings
│   │   ├── Auth.tsx            # Google OAuth login/register flow
│   │   ├── LandingPage.tsx     # Public landing page
│   │   ├── FeedbackModal.tsx   # User feedback submission
│   │   └── ShapeGrid.jsx       # Animated background grid component
│   ├── lib/
│   │   ├── firebase.ts         # Firebase app + Firestore init
│   │   ├── gemini.ts           # Gemini AI functions (analyze, OCR, narrative)
│   │   ├── matchmaking.ts      # Backend API client (findMatches, findBestMatch)
│   │   └── utils.ts            # cn() utility helper
│   ├── types/
│   │   └── index.ts            # Shared TypeScript interfaces (Emergency, Volunteer, Task)
│   └── constants/
│       └── assets.ts           # Static asset paths
├── firestore.rules       # Firestore security rules
├── server.ts             # Dev server entry point (Vite proxy + Express)
├── .env.example          # Environment variable template
└── vite.config.ts        # Vite configuration
```

---

## 🗄️ Data Model

### `Emergency` (Firestore collection: `emergencies`)

| Field | Type | Description |
|---|---|---|
| `reporterUid` | string | UID of the user who filed the report |
| `reporterName` | string | Display name of the reporter |
| `description` | string | Short or AI-expanded incident description |
| `detailedNarrative` | string? | Full AI-generated field report (cached) |
| `location` | string | Address / PIN code string |
| `urgency` | `low\|medium\|high\|critical` | Priority level |
| `status` | `pending\|assigned\|resolved` | Current state |
| `requiredSkills` | string[] | Skills volunteers need to help |
| `processedByAi` | boolean? | Whether Gemini processed this report |
| `donationUpiLink` | string? | UPI / Google Pay deep-link |
| `donationQrCodeUrl` | string? | URL to QR code image |
| `bankName` | string? | Bank name for transfers |
| `ifscCode` | string? | Bank IFSC code |
| `accountNumber` | string? | Bank account number |
| `accountHolderName` | string? | Name on the bank account |
| `createdAt` | Timestamp | Firestore server timestamp |

### `Volunteer` (Firestore collection: `volunteers`)

| Field | Type | Description |
|---|---|---|
| `uid` | string | Firebase Auth UID |
| `name` | string | Display name |
| `email` | string | Email address |
| `skills` | string[] | Self-declared skill tags |
| `role` | `volunteer\|admin` | Access role |
| `yearsVolunteering` | number? | Experience level |
| `photoURL` | string? | Profile photo URL |

### `Task` (Firestore collection: `tasks`)

| Field | Type | Description |
|---|---|---|
| `emergencyId` | string | References the `emergencies` document |
| `assignedVolunteerUid` | string | Volunteer assigned to this task |
| `status` | `open\|in-progress\|completed` | Task state |
| `matchScore` | number? | Backend match score (0–100) |
| `createdAt` | Timestamp | Firestore server timestamp |

---

## 🔐 Security

- **`.env` is git-ignored** — never commit API keys or OAuth secrets.
- **`firebase-applet-config.json` is git-ignored** — contains project-level Firebase credentials.
- **`serviceAccountKey.json` is git-ignored** — Firebase Admin SDK private key.
- Firestore security rules are defined in `firestore.rules` and should be reviewed before deploying to production.

---

## 📄 License

This project is private and intended for internal use within the NGO Community Connect ecosystem.

---

*Built with ❤️ by the NGO Community Connect Team.*
