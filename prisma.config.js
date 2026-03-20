import { defineConfig } from "@prisma/client";

export default defineConfig({
  // Prisma Client configuration
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["error"],

  errorFormat: "pretty",

  // Connection pool settings
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  earlyAccess: true,
  schema: "prisma/schema.prisma", // Path to your schema file
  // migrate: {
  //   async adapter(env) {
  //     const { PrismaPg } = await import("@prisma/adapter-pg");
  //     return new PrismaPg({ connectionString: env.DATABASE_URL });
  //   },
  // },
  migrations: {
    directory: "prisma/migrations", // Directory for migration files
    seed: "npx tsx scripts/seed.ts", // Command to run seed script
  },
});
