/**
 * Drizzle database client backed by a node-postgres connection pool.
 *
 * The backend is a long-running Node server (not edge/serverless), so a single
 * shared pool against Neon's *pooled* endpoint is the right model. Use the
 * pooled connection string (host contains `-pooler`) for DATABASE_URL; the
 * direct (unpooled) string is only needed for migrations (see drizzle.config).
 */

import "dotenv/config";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error(
        "DATABASE_URL is not set. Add the Neon pooled connection string to backend/.env",
    );
}

// Neon requires TLS. Its certs are publicly trusted, but `rejectUnauthorized:
// false` keeps this robust across local/CI environments that don't carry the
// full chain (matches the previous Supabase setup).
const ssl = /sslmode=disable/.test(connectionString)
    ? false
    : { rejectUnauthorized: false };

export const pool = new Pool({
    connectionString,
    ssl,
    max: Number.parseInt(process.env.DATABASE_POOL_MAX ?? "10", 10),
});

export const db = drizzle(pool, { schema });

export type Db = NodePgDatabase<typeof schema>;

export { schema };
