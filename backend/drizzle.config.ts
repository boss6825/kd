import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit configuration.
 *
 * Migrations run DDL, so prefer the *direct* (unpooled) Neon connection string
 * via DIRECT_URL when available, falling back to DATABASE_URL. Generate SQL
 * with `npm run db:generate`, then apply with `npm run db:migrate` (or use
 * `npm run db:push` to sync the schema directly during early development).
 */
export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        url:
            process.env.DIRECT_URL ||
            process.env.DATABASE_URL ||
            "",
    },
});
