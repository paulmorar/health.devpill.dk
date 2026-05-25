import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Use the direct (unpooled) connection for migrations
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
  casing: "snake_case",
  strict: true,
  verbose: true,
});
