# GymPortal backend

The Express API stores gym members in MongoDB. Copy `.env.example` to `.env`,
set `MONGO_URI` to your MongoDB connection string, then run `npm run dev` from
the project root. Special characters in MongoDB usernames or passwords must be
percent-encoded.

The API listens on `127.0.0.1:5000` by default. Configure `HOST`, `PORT`, and
`CORS_ORIGIN` in `backend/.env` as needed.

## Endpoints

- `GET /api/health` — API and database status
- `GET /api/members` — list the latest 100 members
- `GET /api/members/:id` — get a member
- `POST /api/members` — create a member (`name`, `email`, `membershipType`)
- `PATCH /api/members/:id` — update one or more member fields
- `DELETE /api/members/:id` — delete a member

The `members` collection is created when the backend connects if it does not
already exist. Add authentication before making member-management endpoints
available outside a trusted local development environment.
