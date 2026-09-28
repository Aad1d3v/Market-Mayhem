import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client for the whole server.
 * Trading operations use `prisma.$transaction` for atomicity.
 */
export const prisma = new PrismaClient();
