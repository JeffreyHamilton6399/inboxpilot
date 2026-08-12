import { PrismaClient } from '@prisma/client'

// Reuse a single PrismaClient across hot reloads in dev to avoid exhausting
// DB connections. In production (Vercel), each serverless function gets its own
// instance, which is fine with Supabase's connection pooler (pgbouncer).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
