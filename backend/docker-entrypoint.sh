#!/bin/sh
set -e

echo "Starting container initialization..."

echo "Waiting for database to be ready..."
max_retries=30
retry_count=0

until node -e "
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('rds.amazonaws.com')
    ? { rejectUnauthorized: false }
    : false
});
client.connect()
  .then(() => {
    console.log('Database connection successful');
    client.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });
" || [ $retry_count -eq $max_retries ]; do
  retry_count=$((retry_count + 1))
  echo "Database not ready yet (attempt $retry_count/$max_retries)..."
  sleep 2
done

if [ $retry_count -eq $max_retries ]; then
  echo "Failed to connect to database after $max_retries attempts"
  exit 1
fi

echo "Database is ready!"

echo "Running database migrations..."
if npm run migrate; then
  echo "Migrations completed successfully!"
else
  echo "Migration failed, but continuing..."
fi

echo "Starting application..."
exec "$@"
