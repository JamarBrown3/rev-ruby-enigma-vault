# User Stories

## Outline User Roles

**Visitor:** A user who browses the public-facing site without an account. Can view games, read reviews, and explore dev projects. Cannot write reviews, rate games, or make any changes.

**User:** A registered user who creates an account with a username and password. Can write reviews, rate games, and manage their own content. Can edit or delete only their own reviews and profile. Cannot access the admin dashboard or modify other users' content.

**Admin:** The site owner. Can create, edit, and delete any content on the site. Has exclusive access to the analytics dashboard, user management, and PDF report generation.

## Draft User Stories

### Visitor Stories

1. As a **visitor**, I want to browse a Steam-inspired library of games, so that I can explore the developer's gaming taste and review style.

2. As a **visitor**, I want to filter games by platform, genre, and release year, so that I can find games that match my interests.

3. As a **visitor**, I want to sort games by rating, title, or playtime, so that I can quickly find the highest-rated or most-played games.

4. As a **visitor**, I want to click on a game card to view its detail page, so that I can read the full description, categories, and reviews.

5. As a **visitor**, I want to read reviews written by users and the admin, so that I can understand different perspectives on each game.

6. As a **visitor**, I want to browse the developer's projects page, so that I can see what applications they have built and the technologies they used.

7. As a **visitor**, I want to navigate using a fixed navbar with clear labels, so that I can move between pages without confusion.

8. As a **visitor**, I want to see a three-column hero section with character visuals and a manual carousel, so that the site feels modern, cinematic, and engaging.

9. As a **visitor**, I want to view the site on my phone, so that I can browse the portfolio on any device.

10. As a **visitor**, I want to be prompted to sign up when I try to write a review, so that I understand an account is required to participate.

### User Stories

11. As a **user**, I want to create an account with a username and password, so that I can write reviews and rate games.

12. As a **user**, I want to log in securely, so that I can access my account and manage my content.

13. As a **user**, I want to write a review for a game, so that I can share my opinion with other visitors.

14. As a **user**, I want to rate a game on a scale of 1–10, so that my score contributes to the overall rating.

15. As a **user**, I want to edit my own review, so that I can fix typos or update my opinion after replaying a game.

16. As a **user**, I want to delete my own review, so that I can remove content I no longer want public.

17. As a **user**, I want to view my profile page, so that I can see all the reviews I have written.

18. As a **user**, I want to log out of my account, so that my session is secure on shared devices.

19. As a **user**, I want to receive error messages when I submit invalid forms, so that I know what to fix.

20. As a **user**, I want to be redirected to the login page if I try to access protected routes without an account, so that my experience is clear.

### Admin Stories

21. As an **admin**, I want to log in with elevated privileges, so that I can access the dashboard and management tools.

22. As an **admin**, I want to create new game entries, so that I can expand the library without touching the database directly.

23. As an **admin**, I want to edit any game, review, or project, so that I can fix errors or update information.

24. As an **admin**, I want to delete any game, review, or project—including other users' reviews—so that I can moderate content and remove inappropriate material.

25. As an **admin**, I want to view a list of all registered users, so that I can manage accounts and monitor activity.

26. As an **admin**, I want to ban or remove a user, so that I can protect the platform from spam or abuse.

27. As an **admin**, I want to view an analytics dashboard with charts and KPIs, so that I can understand trends in ratings, reviews, and categories.

28. As an **admin**, I want to see the variance and standard deviation of ratings, so that I can identify which genres or platforms are most consistent or most volatile.

29. As an **admin**, I want to download a PDF report of the dashboard, so that I can share insights with clients or save them for later.

30. As an **admin**, I want to see loading indicators during data fetches, so that I know the system is working and not frozen.