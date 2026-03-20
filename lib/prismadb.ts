import { PrismaClient } from "@prisma/client";
import config from "@/prisma.config";

declare global {
  var prisma: PrismaClient | undefined;
}

const prismadb = globalThis.prisma || new PrismaClient(config);
if (process.env.NODE_ENV !== "production") globalThis.prisma = prismadb;

export default prismadb;
