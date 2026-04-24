# NGO Community Connect 🤝

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-12-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Gemini](https://img.shields.io/badge/Gemini_AI-API-4285F4?logo=google-gemini&logoColor=white)](https://deepmind.google/technologies/gemini/)

**NGO Community Connect** is a modern, high-performance platform designed to bridge the gap between Non-Governmental Organizations (NGOs) and passionate volunteers. By leveraging deterministic matchmaking and AI-driven insights, the platform ensures that the right help reaches the right place at the right time.

---

## ✨ Key Features

-   **🎯 Deterministic Skill Matchmaking**: A robust 100-point scoring system that matches volunteers to emergencies based on skills, experience, and urgency.
-   **🤖 AI-Powered Insights**: Integration with Google Gemini for intelligent task suggestions and community engagement analysis.
-   **⚡ Real-time Collaboration**: Powered by Firebase Firestore for instant updates on emergencies and volunteer assignments.
-   **📊 Interactive Dashboards**: Beautiful data visualizations using Recharts to track impact and resource allocation.
-   **🎨 Premium UI/UX**: A state-of-the-art interface built with Tailwind CSS 4 and smooth animations powered by Framer Motion.
-   **🔒 Secure Authentication**: Seamless Google OAuth integration for both frontend and backend services.

---

## 🛠️ Tech Stack

-   **Frontend**: React 19, Vite, Tailwind CSS 4, Framer Motion
-   **Backend**: Node.js, Express, TSX
-   **Database/Auth**: Firebase (Firestore, Authentication)
-   **AI**: Google Generative AI (Gemini Pro)
-   **Form Management**: React Hook Form + Zod
-   **Routing**: React Router 7

---

## 🚀 Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or higher recommended)
-   [npm](https://www.npmjs.com/) (installed with Node.js)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/PaulLovesCode/ngo-connect.git
    cd ngo-community-connect
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    Create a `.env` file in the root directory and add your credentials:
    ```env
    # Google OAuth
    GOOGLE_CLIENT_ID=your_client_id
    GOOGLE_CLIENT_SECRET=your_client_secret
    VITE_GOOGLE_CLIENT_ID=your_client_id

    # Firebase
    VITE_FIREBASE_API_KEY=your_firebase_key

    # Gemini AI
    VITE_GEMINI_API_KEY=your_gemini_key
    ```

### Running the App

Start the development server (runs both frontend and backend proxy via `server.ts`):

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

---

## 🏗️ Project Structure

-   `/src`: Frontend React application source code.
-   `/backend`: Node.js/Express backend for deterministic matching logic.
-   `/server.ts`: Development server entry point.
-   `firestore.rules`: Security rules for the Firebase database.

---

## 📄 License

This project is private and intended for internal use within the NGO Community Connect ecosystem.

---

*Built with ❤️ by the NGO Community Connect Team.*
