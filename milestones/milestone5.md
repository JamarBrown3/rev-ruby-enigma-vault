# Milestone 5 — Deployment and Release Review

Project: REV — The Ruby Enigma Vault  
Status: Release checklist, not a statement that deployment is complete.

## Release Checklist

- [ ] Deploy the React frontend and Express backend, with MongoDB Atlas configured for the application.
- [ ] Deploy and connect the Python service if analytics are included in this release.
- [ ] Verify production configuration, allowed origins, HTTPS, session cookies, and restricted database access.
- [ ] Keep credentials and environment files out of version control and demo recordings.
- [ ] Add the working public URL and setup instructions to the [README](../README.md).
- [ ] Verify direct navigation and refresh on frontend routes.
- [ ] Test the public experience, member workflows, and private administrator experience on the deployed app.
- [ ] Update issue statuses and document unresolved limitations.
- [ ] Mark only implemented and verified features as complete below.
- [ ] Record a complete demo and add its link to the README.
- [ ] Complete the reflection.

Planned hosting: Netlify for the frontend, Render for backend services, and MongoDB Atlas for data. Confirm current service limits and configuration at deployment rather than assuming permanent free hosting.

## Feature Verification

Unchecked items are release targets to verify, not completed work.

### Core Application

- [ ] React frontend, Express API, and MongoDB/Mongoose persistence work together.
- [ ] Public Home, About, and Services pages work.
- [ ] Post cards open dedicated detail views through React Router.
- [ ] Posts support GET, POST, PATCH, and DELETE operations.
- [ ] Authors alone can update or delete their posts.
- [ ] Comments persist and their author permissions are enforced.
- [ ] Deleting a post also removes associated comments and votes.
- [ ] Signed-in accounts can like or dislike posts, with at most one vote per account per post.
- [ ] Game/category references and other model relationships are validated by application logic.
- [ ] Administrators can manage the intended catalog and portfolio records.
- [ ] Search, filtering, and sorting work for the content included in the release.
- [ ] Development seed/test procedures are documented and isolated from live user data.

### Authentication and Security

- [ ] Registration, login, logout, and session persistence work.
- [ ] Passwords are hashed and never returned in API responses.
- [ ] Administrator pages and APIs reject unauthorized accounts.
- [ ] Request validation, role assignment, and ownership checks are enforced server-side.
- [ ] Password recovery uses expiring, single-use tokens and a configured delivery service; if delivery is unavailable, clearly document that recovery is not release-ready.
- [ ] State-changing requests have appropriate CSRF protection and rate limits.

### Dashboard and Reporting

- [ ] The dashboard is accessible only to authorized administrators.
- [ ] Charts and summary metrics use real records rather than prototype sample values.
- [ ] Python analytics return verified results and handle missing or insufficient data.
- [ ] Downloadable PDF reports contain the intended data and readable charts.
- [ ] Loading, error, empty-data, and report-generation states are handled.

### Interface and Accessibility

- [ ] Shared navigation, footer, and reusable components work across pages.
- [ ] Featured-content carousel controls work without relying on automatic motion.
- [ ] Character reels can be paused, and reduced-motion preferences are respected.
- [ ] Layouts remain usable on desktop, tablet, and phone screens.
- [ ] Forms have labels, clear validation, and keyboard-accessible controls.
- [ ] Colors, focus indicators, image alternatives, and chart summaries are readable and useful.
- [ ] Loading indicators and disabled submission controls prevent duplicate requests.
- [ ] In-app feedback and confirmation UI replace unnecessary native alerts.
- [ ] Light/dark preferences persist locally without storing authentication secrets.

## Deferred Enhancements

These are not requirements for this release: newsletter subscriptions/unsubscribe, a TypeScript migration, Shopify integration, and additional analytics beyond the agreed dashboard. Revisit these after the core app is stable.

## Final Demo

Not recorded yet. Add a video or GIF link only after the recording exists. macOS QuickTime Player can be used for the screen recording. Demonstrate actual application behavior without showing credentials.

## Reflection

### 1. What went well during release preparation?

To be completed.

### 2. What challenges did I face?

To be completed.

### 3. Which achievements am I most proud of?

To be completed.

### 4. How have my development skills grown since starting REV?

To be completed.

### 5. What are my next learning and development goals?

To be completed.
