// @math-item-os/db - Prisma 클라이언트 싱글턴
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 개발 환경에서 HMR 시 중복 인스턴스 방지
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Re-export Prisma types and enums for consumers
export { PrismaClient } from "@prisma/client";
export type { Prisma } from "@prisma/client";
export {
  SchoolLevel,
  SemesterType,
  ItemType,
  FormulaType,
  AnswerFormat,
  QualityStatus,
  UsagePurpose,
  EdgeStrength,
  SolutionMethod,
  RecType,
  AuditAction,
  ReviewTaskType,
  ReviewStatus,
  AssignmentPurpose,
  UserRole,
} from "@prisma/client";
