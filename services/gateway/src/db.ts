import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/roomkit';

export const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});
