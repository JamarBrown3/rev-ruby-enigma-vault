# Milestone 2 — Wireframes and Data Design

Project: REV — The Ruby Enigma Vault  
Developer: Jamar Brown  
Design documentation updated: October 24, 2026  
Status: Initial design documented; implementation details will continue to evolve.

## Design Deliverables

- [x] Document the five primary pages in [wireframes.md](../planning/wireframes.md).
- [x] Include the nine saved prototype screenshots from the [wireframes folder](../wireframes/).
- [x] Explain navigation, shared layout, intended interactions, and role restrictions.
- [x] Identify supporting views and missing states that need refinement before implementation.
- [x] Document the MongoDB collections and relationships in the [ERD notes](../planning/entity_relationship_diagram.md).
- [x] Include the existing [MongoDB diagram](../planning/REV_MongoDB_ERD.png).
- [x] Write a concise project pitch.
- [x] Complete the reflection below.

The screenshots establish the initial layout, not a completed frontend. They do not prove production authentication, database access, animations, or report generation.

## Primary Pages

| Page | Purpose | Initial wireframe evidence |
| --- | --- | --- |
| Home | Featured content, community post cards, search, and sorting | Hero and post-grid screenshots |
| About | Introduce Jamar, skills, projects, and contact links | Introduction and skills/project screenshots |
| Services | Present website, storefront, and dashboard services | Service cards and contact call to action |
| Login | Member access with a registration option and visitor browsing | Two login screenshots showing simulated role states |
| Dashboard | Private administrative analytics and report download | Dashboard screenshot with sample metrics and charts |

Post details and post creation/editing are supporting views. Registration, password-recovery screens, and mobile layouts still need their own detailed states; a visible Register tab is not evidence of a captured registration form.

## MongoDB Blueprint

The design includes users, posts, comments, votes, games, categories, projects, passwordResetTokens, and a library-managed sessions collection.

- Each post references its author; review posts also reference a game.
- Comments and votes reference their post and account.
- A unique compound vote index on postId and userId prevents multiple simultaneous votes by the same account on one post.
- Games reference categories through an array of ObjectIds rather than a SQL join table.
- Post deletion requires explicit cleanup of related comments and votes; MongoDB references do not perform automatic cascading deletion.
- Session storage and password-reset tokens support account security.
- Dashboard metrics are computed from existing records; there is no separate dashboard collection.
- Theme preferences belong in browser storage, not in authentication tokens.

The ERD is a design reference. Field names and rules should be checked against the actual Mongoose models as implementation develops.

## Project Pitch

REV — The Ruby Enigma Vault — combines a gaming community with my developer portfolio. Visitors can discover content and learn about my work without creating an account. Members can publish discussions and game reviews, comment, and react, while ownership rules protect their posts.

The interface uses a gaming background, a manually controlled featured-content carousel, and character reels framing the main content. About and Services pages connect that experience to the work I want to offer professionally.

Behind the interface, React communicates with an Express API backed by MongoDB. Session-based authentication protects member actions and administrator access. A private dashboard will turn the stored content into useful charts, with Python analytics and downloadable reports developed after the core workflows are reliable.

My aim is a focused, understandable full-stack application that demonstrates both user-facing development and business-oriented reporting.

## Reflection

### 1. What went well?

The wireframes turned my ideas into a consistent layout across all five main pages. The navigation subtitles, character reels, post cards, and dashboard now have visual references instead of existing only as descriptions. The MongoDB diagram also gives me a starting point for connecting the backend models.

### 2. What were the main challenges?

The prototype mixes realistic-looking content with simulated behavior. I need to keep those separate so a mock login or sample chart is not mistaken for a working feature. Translating SQL relationships into MongoDB references and keeping the dashboard within scope are additional challenges.

### 3. What support will help next?

I need help translating the design into small, testable backend and frontend tasks, with explanations along the way. Before building each workflow, I will define its data, permissions, validation, and failure states. The dashboard will follow the core workflows so its charts use meaningful, verified records.
