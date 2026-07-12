# Amrutam Telemedicine — Setup Guide

Production-grade telemedicine backend: auth (TOTP MFA + refresh rotation), doctor booking saga, consultations, prescriptions, and admin analytics.

## Prerequisites

- [Docker](https://www.docker.com/) + Docker Compose
- [Node.js 20+](https://nodejs.org/) and npm
- Git

## 1. Clone the repository

```bash
git clone <your-repo-url>
cd amrutam-telemedicine
```

## 2. Configure environment variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://amrutam:amrutam@localhost:5432/amrutam_telemedicine
DIRECT_URL=postgresql://amrutam:amrutam@localhost:5432/amrutam_telemedicine
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me-in-production
NODE_ENV=development
PORT=3000
```

## 3. Start PostgreSQL and Redis with Docker

```bash
docker compose up -d postgres redis
```

Verify both are healthy:

```bash
docker compose ps
```

You should see `postgres` and `redis` listed as `healthy`.

## 4. Install dependencies

```bash
npm install
```

## 5. Run database migrations

```bash
npm run prisma:generate
npm run prisma:migrate
```

## 6. Seed the database with mock data

```bash
npm run seed
```

This creates:
- 1 admin, 15 doctors, 20 patients
- Availability slots, consultations, payments, and prescriptions across all status types
- **All seeded users share the password `Password123!`** for easy manual testing

## 7. Run the app

```bash
npm run dev
```

The API will be available at `http://localhost:3000`.

## One-shot setup (after step 2's `.env` is created)

```bash
docker compose up -d postgres redis && \
npm install && \
npm run prisma:generate && \
npm run prisma:migrate && \
npm run seed && \
npm run dev
```

## Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the app in watch mode |
| `npm run prisma:studio` | Open Prisma Studio (browse DB visually) |
| `npm run seed` | Re-seed mock data (clears existing data first) |
| `docker compose down` | Stop Postgres and Redis |
| `docker compose down -v` | Stop and wipe DB volume (fresh start) |

## Notes

- The seed script clears all tables before inserting mock data — do not run it against a shared or production database.
- If port `5432` or `6379` is already in use locally, adjust the port mappings in `docker-compose.yml` and update `.env` to match.