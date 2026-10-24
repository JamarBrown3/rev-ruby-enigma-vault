# Milestone 1 — Project Vision and Scope

Project: REV — The Ruby Enigma Vault  
Developer: Jamar Brown  
Status: Planning complete; feature implementation is tracked separately.

## Purpose and Inspiration

REV is my independent, gaming-inspired portfolio and community application. Visitors will explore my work and gaming content, members will publish reviews and discussions, and I will use a private administrator dashboard to understand the application's data.

The visual inspiration is a Steam-style gaming experience with my own identity: a manual featured-content carousel, moving character reels on both sides, and navigation labels with short descriptions. The professional goal is to demonstrate how I can build a website, authenticated administration tools, and data reporting together.

## Planned Scope

1. Public Home, About, and Services pages that introduce the community, my projects, and my development services.
2. Post cards that open dedicated detail views, with search and sorting.
3. Member-created reviews and discussions; only the author can update or delete their posts.
4. Saved comments, plus one like or dislike per signed-in account per post. Guests can browse but cannot vote.
5. Account registration, login, logout, server-side sessions, and secure password recovery.
6. An administrator-only dashboard with charts and summaries derived from stored records.
7. Python-based analytics and downloadable PDF reports after the core content workflows work.
8. Responsive layouts, accessible controls, loading/error feedback, and device-saved light/dark preferences.

Games, categories, and portfolio projects support the content and analytics. Administrators manage catalog and portfolio records. Deleting a post must also remove its related comments and votes through backend logic.

## Technology and Boundaries

- Frontend: React, JavaScript, React Router, and CSS.
- Backend: Node.js, Express, Mongoose, and MongoDB Atlas.
- Analytics: a separate Python FastAPI service; chart presentation in React.
- Authentication: session cookies and a persistent session store, not passwords saved in the browser.
- Preference storage: browser localStorage for non-sensitive settings such as theme.

This is a solo project targeting roughly two months of development, not a guarantee that every planned enhancement will fit. TypeScript migration and Shopify learning come afterward. Email newsletters and unsubscribe functionality are deferred until a later release, tentatively January 2027. The Services page describes capabilities; it does not require building an actual checkout or Shopify integration in this release.

## Checklist

- [x] Choose the project name and identify the developer in the [README](../README.md).
- [x] Describe the purpose, inspiration, and planned feature list.
- [x] Define Visitor, User, and Admin roles in the [user stories](../planning/user_stories.md).
- [x] Establish the initial technology stack and scope boundaries.
- [x] Complete the planning reflection below.

These checkmarks describe planning work, not completed application features. Earlier planning documents may need wording updates as the design evolves; the ownership and signed-in voting rules above reflect the current decisions.

## Reflection

### 1. What went well?

I settled on a project that connects my interest in games with my goal of building a professional portfolio. Rather than creating unrelated demonstrations, I can show public content, authenticated workflows, and an analytics dashboard in one coherent application. My earlier React and Express projects give me useful patterns to build on.

### 2. What were the main challenges?

The main challenge was choosing a realistic scope while keeping a distinctive gaming identity. I also needed to separate the public community experience from administrator tools and decide which features should wait. MongoDB is new compared with my SQL experience, so document relationships need deliberate planning.

### 3. What support will help next?

I need step-by-step explanations of Mongoose models, references, authentication, and testing so I understand the code I use. I will build and verify the core backend before connecting the frontend, then develop the analytics and reporting features from reliable data.
