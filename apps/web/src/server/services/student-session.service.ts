// 학생 풀이 세션 서비스 - 토큰 기반 과제 접근, 세션 생성/관리, 응답 제출
import { TRPCError } from "@trpc/server";
import { prisma } from "@math-item-os/db";
import type { Prisma } from "@math-item-os/db";
import { randomBytes } from "crypto";

/** 인터랙티브 트랜잭션 클라이언트 타입 */
type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// -------------------------------------------------
// 관계 포함 공통 include 정의
// -------------------------------------------------

/** 과제 상세 조회 시 문항 정보 포함 (풀이용) */
const ASSIGNMENT_SOLVE_INCLUDE = {
  items: {
    include: {
      item: {
        select: {
          id: true,
          bodyLatex: true,
          bodyHtml: true,
          choices: true,
          itemType: true,
          formulaType: true,
          answerFormat: true,
        },
      },
    },
    orderBy: { position: "asc" as const },
  },
} satisfies Prisma.AssignmentInclude;

/** 세션 상세 조회 시 전체 관계 포함 */
const SESSION_DETAIL_INCLUDE = {
  assignment: {
    include: {
      items: {
        include: {
          item: {
            select: {
              id: true,
              bodyLatex: true,
              bodyHtml: true,
              choices: true,
              answer: true,
              itemType: true,
              formulaType: true,
              answerFormat: true,
            },
          },
        },
        orderBy: { position: "asc" as const },
      },
    },
  },
  responses: true,
} satisfies Prisma.StudentSessionInclude;

// -------------------------------------------------
// 1. 과제 조회 (학생용, 토큰 기반)
// -------------------------------------------------

/** solveToken으로 공개된 과제를 조회한다. 문항 정보 포함. */
export async function getAssignmentBySolveToken(solveToken: string) {
  const assignment = await prisma.assignment.findFirst({
    where: {
      solveToken,
      isPublished: true,
    },
    include: ASSIGNMENT_SOLVE_INCLUDE,
  });

  if (!assignment) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "공개된 과제를 찾을 수 없거나 유효하지 않은 토큰입니다",
    });
  }

  return { assignment };
}

// -------------------------------------------------
// 2. 풀이 세션 시작
// -------------------------------------------------

/** 새 풀이 세션을 생성한다. solveToken 유효성 검증 포함. */
export async function createStudentSession(input: {
  readonly assignmentId: string;
  readonly solveToken: string;
  readonly studentName: string;
}) {
  // 과제 존재 + solveToken 일치 + 공개 상태 검증
  const assignment = await prisma.assignment.findUnique({
    where: { id: input.assignmentId },
    select: { id: true, solveToken: true, isPublished: true },
  });

  if (!assignment) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `과제를 찾을 수 없습니다: ${input.assignmentId}`,
    });
  }

  if (!assignment.isPublished) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "공개되지 않은 과제입니다",
    });
  }

  if (assignment.solveToken !== input.solveToken) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "유효하지 않은 풀이 토큰입니다",
    });
  }

  // 고유 세션 토큰 생성
  const token = randomBytes(16).toString("hex");

  const session = await prisma.studentSession.create({
    data: {
      assignmentId: input.assignmentId,
      studentName: input.studentName,
      token,
      status: "in_progress",
    },
  });

  return { session };
}

// -------------------------------------------------
// 3. 세션 조회 (토큰 기반)
// -------------------------------------------------

/** 세션 토큰으로 세션 상세를 조회한다. 과제/문항/응답 포함. */
export async function getSessionByToken(token: string) {
  const session = await prisma.studentSession.findUnique({
    where: { token },
    include: SESSION_DETAIL_INCLUDE,
  });

  if (!session) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "풀이 세션을 찾을 수 없습니다",
    });
  }

  return { session };
}

// -------------------------------------------------
// 4. 문항 응답 제출
// -------------------------------------------------

/** 개별 문항 응답을 제출(또는 갱신)한다. 세션/문항 유효성 검증 포함. */
export async function submitStudentResponse(input: {
  readonly sessionToken: string;
  readonly assignmentItemId: string;
  readonly studentAnswer: Record<string, unknown>;
  readonly timeTakenSec?: number;
}) {
  return prisma.$transaction(async (tx: TxClient) => {
    // 세션 조회 + 상태 검증
    const session = await tx.studentSession.findUnique({
      where: { token: input.sessionToken },
      select: { id: true, assignmentId: true, status: true },
    });

    if (!session) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "풀이 세션을 찾을 수 없습니다",
      });
    }

    if (session.status !== "in_progress") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "이미 제출된 세션에는 응답을 추가할 수 없습니다",
      });
    }

    // assignmentItemId가 해당 과제에 속하는지 검증
    const assignmentItem = await tx.assignmentItem.findUnique({
      where: { id: input.assignmentItemId },
      select: { id: true, assignmentId: true },
    });

    if (!assignmentItem) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `과제 문항을 찾을 수 없습니다: ${input.assignmentItemId}`,
      });
    }

    if (assignmentItem.assignmentId !== session.assignmentId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "해당 문항은 이 과제에 속하지 않습니다",
      });
    }

    // Upsert: 이미 응답이 있으면 갱신, 없으면 생성
    const response = await tx.studentResponse.upsert({
      where: {
        sessionId_assignmentItemId: {
          sessionId: session.id,
          assignmentItemId: input.assignmentItemId,
        },
      },
      create: {
        sessionId: session.id,
        assignmentItemId: input.assignmentItemId,
        studentAnswer: input.studentAnswer as Prisma.InputJsonValue,
        result: "pending",
        ...(input.timeTakenSec != null && {
          timeTakenSec: input.timeTakenSec,
        }),
      },
      update: {
        studentAnswer: input.studentAnswer as Prisma.InputJsonValue,
        result: "pending",
        score: null,
        ...(input.timeTakenSec != null && {
          timeTakenSec: input.timeTakenSec,
        }),
      },
    });

    return { response };
  });
}

// -------------------------------------------------
// 5. 세션 전체 제출 (채점 트리거)
// -------------------------------------------------

/** 세션을 제출 완료 상태로 전환하고 자동 채점을 트리거한다. */
export async function submitSession(sessionToken: string) {
  // 세션 조회 + 상태 검증
  const session = await prisma.studentSession.findUnique({
    where: { token: sessionToken },
    select: { id: true, status: true },
  });

  if (!session) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "풀이 세션을 찾을 수 없습니다",
    });
  }

  if (session.status !== "in_progress") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "이미 제출된 세션입니다",
    });
  }

  // 상태 전환: submitted
  await prisma.studentSession.update({
    where: { id: session.id },
    data: {
      status: "submitted",
      submittedAt: new Date(),
    },
  });

  // 자동 채점 트리거 (동적 import로 순환 참조 방지)
  const { gradeSession } = await import("./grading.service");
  const gradedSession = await gradeSession(session.id);

  return { session: gradedSession };
}
