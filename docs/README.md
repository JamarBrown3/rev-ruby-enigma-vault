# REV project documents

Planning, progress, and security records for REV (The Ruby Enigma Vault). For setup and the feature overview, start with the main [README](../README.md).

Status on November 15, 2026: the prototype is complete and runs locally. Deployment to Render with the domain `rubyenigmavault.com` is planned for November 16–22, ahead of the November 30 review.

## Milestones

| Milestone | Topic |
| --- | --- |
| [1. Vision and scope](milestones/milestone1.md) | Purpose, inspiration, roles, and planned features |
| [2. Wireframes and data design](milestones/milestone2.md) | Wireframes, MongoDB blueprint, and project pitch |
| [3. Core workflows](milestones/milestone3.md) | Day-by-day work log, October 19 to November 15 |
| [4. Integration and verification](milestones/milestone4.md) | Test results and what's still open |
| [5. Deployment and release](milestones/milestone5.md) | Hosting plan, production settings, and the release checklist |

Each milestone ends with reflection questions for my own notes.

## Planning

- [User stories](planning/user_stories.md), with a status table showing which stories were built, changed, or deferred
- [Wireframes](planning/wireframes.md), the nine [wireframe screenshots](planning/wireframes/), and what changed in the build
- [Data model (ERD)](planning/entity_relationship_diagram.md), with the [diagram](planning/REV_MongoDB_ERD.png) ([SVG](planning/REV_MongoDB_ERD.svg)) and an implementation status table
- Website process diagram: [light](planning/REV_website_process.png) · [dark](planning/REV_website_process_darkmode.png)

## Security

- [Backend authentication foundation](security/2026-10-23-backend-foundation.md) (October 23)
- [Security fixes and verification](security/2026-10-23-security-fixes.md) (October 23)

Both are historical records with a note at the top about what changed since. Weekly security reports live in `server/security-reports/`.

## Testing

Browser QA reports and their follow-up status are in [qa-reports/](../qa-reports/README.md).
