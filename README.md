# Goylo backend

NestJS REST API for footballers, teams, invitations, open matches, competition requests and tournaments.

## Run locally

1. Copy `.env.example` to `.env` and change `JWT_SECRET`.
2. Start PostgreSQL: `docker compose up -d`.
3. Install and prepare: `npm install && npm run prisma:generate && npm run prisma:migrate -- --name init`.
4. Start: `npm run start:dev`.

API: `http://localhost:3000/api`. Swagger UI: `http://localhost:3000/docs`.

The match creator must own the home team. A challenger must own a different team. Approving one request confirms the match and rejects its remaining pending requests. Tournament matches are created through `POST /api/matches` with `tournamentId`.
