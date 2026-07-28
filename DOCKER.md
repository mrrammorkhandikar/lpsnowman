# Docker Development Environment

## Prerequisites
- Docker Desktop or Docker Engine with Docker Compose

## Configuration
- Optional: set OPENAI_API_KEY in your shell to enable AI features

## Build and Run
- From the Versionbuild directory:

```bash
docker compose up --build
```

## Services
- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- Database: localhost:5432 (postgres/postgres, database loadsmart)

## Database Initialization
- Schema is loaded from backend/migrations/0000_confused_the_liberteens.sql
- Session table is created automatically for connect-pg-simple
- Data is persisted in the db_data volume

## Stopping
```bash
docker compose down
```

## Resetting Data
```bash
docker compose down -v
```
