# REV — The Ruby Enigma Vault

Designed and developed by: **Jamar Brown**

🔗 Link to deployed app: [ADD AFTER DEPLOYMENT]

## About

### Description and Purpose

REV is a Steam-inspired gaming portfolio and analytics platform that serves two purposes:

1. **Public-facing portfolio:** A dark-themed, modern web app where visitors can browse my gaming library, read reviews, explore my dev projects, and learn about my work as a full-stack developer and data analyst.

2. **Private admin dashboard:** A protected analytics dashboard that tracks review trends, game ratings, category distribution, and generates downloadable PDF reports using a Python microservice and Puppeteer.

The project demonstrates full-stack development with React, Node.js/Express, MongoDB, and a Python FastAPI analytics microservice. It is designed to be a real, deployed product that doubles as both a class capstone and a freelance client showcase.

### Inspiration

The design is inspired by the Steam client—dark blue/gray palette, horizontal shelves, capsule cards, sidebar navigation, and a featured carousel. Steam's UI is iconic, complex, and product-level. Building something similar proves the ability to handle real-world, high-traffic application design.

The three-column hero layout—with video game characters switching on both sides, a manual center carousel, and a cinematic gaming background—was inspired by modern streaming platforms and game launcher UIs that prioritize visual storytelling.

The analytics dashboard and Python microservice were inspired by the need for small businesses to understand their data. Most web developers can't do data analysis, and most data analysts can't build applications. REV bridges that gap.

## Tech Stack

**Frontend:**
- React
- React Router
- CSS (Steam-inspired dark theme)
- Recharts (for dashboard visualizations)

**Backend:**
- Node.js
- Express
- MongoDB (via Mongoose)
- MongoDB Atlas (cloud database)

**Analytics Microservice:**
- Python
- FastAPI
- PyMongo
- Pandas
- NumPy

**PDF Generation:**
- Puppeteer

**Deployment:**
- Netlify (frontend)
- Render (backend + microservice)
- MongoDB Atlas (database)

## Features

### Feature 1: Steam-Inspired Homepage with Three-Column Hero

A cinematic homepage with a fixed navbar (main links with sub-labels underneath), a three-column hero section, and a killer gaming background. The left and right columns display video game characters that switch every 20–30 seconds with a smooth fade transition. The center column contains the title, tagline, manual carousel with swipe navigation, and a CTA button.

### Feature 2: Dynamic Game Library with Filtering and Sorting

A fully dynamic games page that fetches data from the Node API and displays games in a Steam-style grid. Users can filter by platform, genre, and release year, and sort by rating, title, or playtime. Each game card opens a detail page with cover art, description, categories, and reviews.

### Feature 3: Admin Analytics Dashboard

A protected admin dashboard that visualizes key metrics from the database:
- Games by platform (bar chart)
- Average rating by genre (bar chart)
- Reviews over time (line chart)
- Top 5 highest-rated games (table)
- Category distribution (pie chart)
- Variance and standard deviation of ratings (via Python microservice)

### Feature 4: Python FastAPI Analytics Microservice

A separate Python FastAPI service that handles statistical analysis:
- `POST /analyze/variance` — Calculate variance and standard deviation of ratings
- `POST /analyze/forecast` — Predict future review trends
- `POST /analyze/correlation` — Find patterns in data

The Node.js API gateway calls this microservice and returns the results to the React frontend.

### Feature 5: Automated PDF Report Generation

Admin users can click "Download Report" to generate a pixel-perfect PDF containing dashboard charts, key metrics, and review summaries. The PDF is generated using Puppeteer, which opens a headless Chrome browser, navigates to a print-view route, and captures the content.

### Feature 6: Full CRUD for Games, Reviews, and Projects

Admin users can create, read, update, and delete games, reviews, and projects. All operations are handled through RESTful API routes and reflect immediately in the public-facing pages.

### Feature 7: Protected Admin Routes with Authentication

Admin routes are protected using session-based authentication. Only logged-in admin users can access the dashboard, manage content, or generate reports.

### Feature 8: Error Handling and User Feedback

The app gracefully handles errors with custom 404 pages, form validation messages, toast notifications, and loading spinners. Buttons are disabled during form submission to prevent duplicate requests.

## Installation Instructions

### Prerequisites

- Node.js (v18 or higher)
- Python (v3.10 or higher)
- MongoDB Atlas account (free tier)
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/rev-ruby-enigma-vault.git
cd rev-ruby-enigma-vault
