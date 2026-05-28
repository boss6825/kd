/**
 * Apply every .sql file in backend/migrations/ to the database at
 * SUPABASE_DB_URL, in lexicographic filename order. Each file is run
 * inside a transaction; failure rolls back and aborts.
 *
 * Usage:
 *   npm run migrate --prefix backend
 *
 * Re-runs are safe as long as every migration uses `if not exists` /
 * idempotent DDL (the ones in this repo do).
 */
import "dotenv/config";
import { Client } from "pg";
import { readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";

async function main() {
    const url = process.env.SUPABASE_DB_URL;
    if (!url) {
        console.error(
            "[migrate] SUPABASE_DB_URL is not set. Add it to backend/.env (Project Settings → Database → Connection string).",
        );
        process.exit(1);
    }

    const dir = resolve(__dirname, "..", "migrations");
    const files = readdirSync(dir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
    if (files.length === 0) {
        console.log("[migrate] no .sql files in", dir);
        return;
    }

    // Supabase requires TLS. `rejectUnauthorized: false` matches what the
    // dashboard / supabase-js client do — the cert is signed by a root the
    // node runtime doesn't always carry.
    const client = new Client({
        connectionString: url,
        ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    try {
        for (const f of files) {
            const sql = readFileSync(join(dir, f), "utf8");
            console.log(`[migrate] applying ${f} ...`);
            await client.query("begin");
            try {
                await client.query(sql);
                await client.query("commit");
                console.log(`[migrate] ✓ ${f}`);
            } catch (err) {
                await client.query("rollback");
                console.error(`[migrate] ✗ ${f} — rolled back`);
                throw err;
            }
        }
    } finally {
        await client.end();
    }
    console.log("[migrate] done");
}

main().catch((err) => {
    console.error("[migrate] failed:", err instanceof Error ? err.message : err);
    process.exit(1);
});
