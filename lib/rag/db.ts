import { Pool } from "pg";

export const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "vector_db",
  password: "12345",
  port: 5433,
});