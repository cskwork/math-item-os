// 수학 문항 CRUD 핵심 비즈니스 로직 서비스
// 3중 변환(LaTeX -> MathML/SymPy/HTML), 버전 관리, 감사 로그 연동
import { TRPCError } from "@trpc/server";
import { prisma } from "@math-item-os/db";
import type {
  QualityStatus,
  ItemType,
  SchoolLevel,
  AnswerFormat,
  FormulaType,
  SemesterType,
  UsagePurpose,
  Prisma,
} from "@math-item-os/db";
import { convertLatex } from "./conversion.service";
import type { FullConversionResult } from "./conversion.service";
import { indexItem } from "./meilisearch.service";
import { runAutoReview } from "./auto-review.service";

/** 인터랙티브 트랜잭션 클라이언트 타입 */
type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// -------------------------------------------------
// 입력 타입 정의
// -------------------------------------------------

export interface CreateItemInput {
  readonly bodyLatex: string;
  readonly bodyBlocks?: unknown;
  readonly choices?: ReadonlyArray<Record<string, unknown>>;
  readonly answer: Record<string, unknown>;
  readonly schoolLevel: SchoolLevel;
  readonly grade: number;
  readonly semester?: SemesterType;
  readonly itemType: ItemType;
  readonly formulaType?: FormulaType;
  readonly answerFormat: AnswerFormat;
  readonly solutionSteps?: number;
  readonly usagePurposes?: UsagePurpose[];
  readonly difficultyAuthor?: number;
  readonly skillIds?: string[];
  readonly standardIds?: string[];
  readonly misconceptionIds?: string[];
  readonly passageId?: string;
}

export interface UpdateItemInput {
  readonly id: string;
  readonly bodyLatex?: string;
  readonly bodyBlocks?: unknown;
  readonly choices?: ReadonlyArray<Record<string, unknown>>;
  readonly answer?: Record<string, unknown>;
  readonly schoolLevel?: SchoolLevel;
  readonly grade?: number;
  readonly semester?: SemesterType;
  readonly itemType?: ItemType;
  readonly formulaType?: FormulaType;
  readonly answerFormat?: AnswerFormat;
  readonly solutionSteps?: number;
  readonly usagePurposes?: UsagePurpose[];
  readonly difficultyAuthor?: number;
  readonly skillIds?: string[];
  readonly standardIds?: string[];
  readonly misconceptionIds?: string[];
  readonly passageId?: string;
  readonly changeSummary?: string;
}

export interface ListItemsParams {
  readonly page: number;
  readonly limit: number;
  readonly status?: QualityStatus[];
  readonly schoolLevel?: SchoolLevel;
  readonly grade?: number;
  readonly skillId?: string;
  readonly itemType?: ItemType;
  readonly difficultyMin?: number;
  readonly difficultyMax?: number;
  readonly sortBy?: string;
  readonly sortOrder?: "asc" | "desc";
}

// -------------------------------------------------
// 반환 타입 정의
// -------------------------------------------------

export interface CreateItemResult {
  readonly item: Awaited<ReturnType<typeof prisma.item.findUnique>>;
  readonly conversionResult: FullConversionResult;
}

export interface UpdateItemResult {
  readonly item: Awaited<ReturnType<typeof prisma.item.findUnique>>;
  readonly version: Awaited<ReturnType<typeof prisma.itemVersion.create>>;
}

// -------------------------------------------------
// 관계 포함 공통 include 정의
// -------------------------------------------------

const ITEM_FULL_INCLUDE = {
  skills: {
    include: { skill: true },
  },
  standards: {
    include: { standard: true },
  },
  misconceptions: {
    include: { misconception: true },
  },
  solutions: true,
  difficultyProfile: true,
  versions: {
    orderBy: { version: "desc" as const },
    take: 10,
  },
  variants: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
} satisfies Prisma.ItemInclude;

// -------------------------------------------------
// 1. 문항 생성
// -------------------------------------------------

/**
 * 새 문항을 생성한다.
 * - LaTeX 3중 변환 실행 후 결과를 Item에 저장
 * - 초기 ItemVersion(version: 1) 생성
 * - DifficultyProfile 생성 (difficultyAuthor가 지정된 경우)
 * - 스킬/성취기준/오개념 연결
 * - 감사 로그 기록
 * - 전체 과정을 트랜잭션으로 보장
 */
export async function createItem(
  input: CreateItemInput,
  userId: string,
  orgId: string,
): Promise<CreateItemResult> {
  // 3중 변환 실행 (트랜잭션 외부 - 외부 서비스 호출 포함)
  const conversionResult = await convertLatex(input.bodyLatex);

  const item = await prisma.$transaction(async (tx: TxClient) => {
    // 문항 본체 생성
    const created = await tx.item.create({
      data: {
        orgId,
        bodyLatex: input.bodyLatex,
        bodyMathml: conversionResult.mathml,
        bodySympy: conversionResult.sympy,
        bodyHtml: conversionResult.html,
        bodyBlocks: input.bodyBlocks as Prisma.InputJsonValue ?? undefined,
        choices: input.choices as Prisma.InputJsonValue ?? undefined,
        answer: input.answer as Prisma.InputJsonValue,
        schoolLevel: input.schoolLevel,
        grade: input.grade,
        semester: input.semester,
        itemType: input.itemType,
        formulaType: input.formulaType,
        answerFormat: input.answerFormat,
        solutionSteps: input.solutionSteps,
        usagePurposes: input.usagePurposes ?? [],
        difficultyAuthor: input.difficultyAuthor,
        status: "draft",
        currentVersion: 1,
        createdBy: userId,
        passageId: input.passageId,
      },
    });

    // 초기 버전 이력 생성
    await tx.itemVersion.create({
      data: {
        itemId: created.id,
        version: 1,
        bodyLatex: input.bodyLatex,
        answer: input.answer as Prisma.InputJsonValue,
        changeSummary: "최초 생성",
      },
    });

    // 난이도 프로필 생성 (작성자 난이도가 지정된 경우)
    if (input.difficultyAuthor != null) {
      await tx.difficultyProfile.create({
        data: {
          itemId: created.id,
          authorDifficulty: input.difficultyAuthor,
        },
      });
    }

    // 스킬 연결 (첫 번째를 primary로 지정)
    if (input.skillIds && input.skillIds.length > 0) {
      await tx.itemSkill.createMany({
        data: input.skillIds.map((skillId, index) => ({
          itemId: created.id,
          skillId,
          isPrimary: index === 0,
        })),
      });
    }

    // 성취기준 연결
    if (input.standardIds && input.standardIds.length > 0) {
      await tx.itemStandard.createMany({
        data: input.standardIds.map((standardId) => ({
          itemId: created.id,
          standardId,
        })),
      });
    }

    // 오개념 연결
    if (input.misconceptionIds && input.misconceptionIds.length > 0) {
      await tx.itemMisconception.createMany({
        data: input.misconceptionIds.map((misconceptionId) => ({
          itemId: created.id,
          misconceptionId,
        })),
      });
    }

    // 감사 로그 기록
    await tx.auditLog.create({
      data: {
        orgId,
        tableName: "items",
        recordId: created.id,
        action: "create",
        performedBy: userId,
        newData: {
          bodyLatex: input.bodyLatex,
          schoolLevel: input.schoolLevel,
          grade: input.grade,
          itemType: input.itemType,
        } as Prisma.InputJsonValue,
      },
    });

    // 관계 포함하여 최종 조회
    return tx.item.findUnique({
      where: { id: created.id },
      include: ITEM_FULL_INCLUDE,
    });
  });

  // Meilisearch 인덱스 동기화 (비동기, 실패해도 문항 생성은 성공)
  if (item) {
    void indexItem(item);
    void runAutoReview(item.id, orgId);
  }

  return { item, conversionResult };
}

// -------------------------------------------------
// 2. 문항 수정
// -------------------------------------------------

/**
 * 기존 문항을 수정한다.
 * - 조직 소속 확인
 * - bodyLatex 변경 시 3중 변환 재실행
 * - 새 ItemVersion 행 삽입 (currentVersion 증가)
 * - 스킬/성취기준/오개념 연결 갱신 (지정 시 기존 삭제 후 재생성)
 * - 감사 로그 기록
 */
export async function updateItem(
  input: UpdateItemInput,
  userId: string,
  orgId: string,
): Promise<UpdateItemResult> {
  // 기존 문항 조회 및 소속 확인
  const existing = await prisma.item.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      orgId: true,
      bodyLatex: true,
      currentVersion: true,
      answer: true,
    },
  });

  if (!existing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `문항을 찾을 수 없습니다: ${input.id}`,
    });
  }

  if (existing.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 문항이 아닙니다",
    });
  }

  // bodyLatex 변경 시 3중 변환 재실행
  const latexChanged = input.bodyLatex != null && input.bodyLatex !== existing.bodyLatex;
  let conversionFields: {
    bodyMathml?: string | null;
    bodySympy?: string | null;
    bodyHtml?: string;
  } = {};

  if (latexChanged) {
    const conversion = await convertLatex(input.bodyLatex!);
    conversionFields = {
      bodyMathml: conversion.mathml,
      bodySympy: conversion.sympy,
      bodyHtml: conversion.html,
    };
  }

  const nextVersion = existing.currentVersion + 1;

  const [item, version] = await prisma.$transaction(async (tx: TxClient) => {
    // 변경 가능한 필드만 추출하여 업데이트 데이터 구성
    const updateData: Prisma.ItemUpdateInput = {
      ...conversionFields,
      currentVersion: nextVersion,
      ...(input.bodyLatex != null && { bodyLatex: input.bodyLatex }),
      ...(input.bodyBlocks !== undefined && { bodyBlocks: input.bodyBlocks as Prisma.InputJsonValue }),
      ...(input.choices !== undefined && { choices: input.choices as Prisma.InputJsonValue }),
      ...(input.answer !== undefined && { answer: input.answer as Prisma.InputJsonValue }),
      ...(input.schoolLevel != null && { schoolLevel: input.schoolLevel }),
      ...(input.grade != null && { grade: input.grade }),
      ...(input.semester !== undefined && { semester: input.semester }),
      ...(input.itemType != null && { itemType: input.itemType }),
      ...(input.formulaType !== undefined && { formulaType: input.formulaType }),
      ...(input.answerFormat != null && { answerFormat: input.answerFormat }),
      ...(input.solutionSteps !== undefined && { solutionSteps: input.solutionSteps }),
      ...(input.usagePurposes !== undefined && { usagePurposes: input.usagePurposes }),
      ...(input.difficultyAuthor !== undefined && { difficultyAuthor: input.difficultyAuthor }),
      ...(input.passageId !== undefined && { passageId: input.passageId }),
    };

    // 문항 본체 업데이트
    await tx.item.update({
      where: { id: input.id },
      data: updateData,
    });

    // 새 버전 이력 생성
    const newVersion = await tx.itemVersion.create({
      data: {
        itemId: input.id,
        version: nextVersion,
        bodyLatex: input.bodyLatex ?? existing.bodyLatex,
        answer: (input.answer ?? existing.answer) as Prisma.InputJsonValue,
        changeSummary: input.changeSummary ?? null,
      },
    });

    // 난이도 프로필 갱신
    if (input.difficultyAuthor !== undefined) {
      if (input.difficultyAuthor != null) {
        await tx.difficultyProfile.upsert({
          where: { itemId: input.id },
          create: {
            itemId: input.id,
            authorDifficulty: input.difficultyAuthor,
          },
          update: {
            authorDifficulty: input.difficultyAuthor,
          },
        });
      }
    }

    // 스킬 연결 갱신 (기존 삭제 후 재생성)
    if (input.skillIds !== undefined) {
      await tx.itemSkill.deleteMany({ where: { itemId: input.id } });
      if (input.skillIds.length > 0) {
        await tx.itemSkill.createMany({
          data: input.skillIds.map((skillId, index) => ({
            itemId: input.id,
            skillId,
            isPrimary: index === 0,
          })),
        });
      }
    }

    // 성취기준 연결 갱신
    if (input.standardIds !== undefined) {
      await tx.itemStandard.deleteMany({ where: { itemId: input.id } });
      if (input.standardIds.length > 0) {
        await tx.itemStandard.createMany({
          data: input.standardIds.map((standardId) => ({
            itemId: input.id,
            standardId,
          })),
        });
      }
    }

    // 오개념 연결 갱신
    if (input.misconceptionIds !== undefined) {
      await tx.itemMisconception.deleteMany({ where: { itemId: input.id } });
      if (input.misconceptionIds.length > 0) {
        await tx.itemMisconception.createMany({
          data: input.misconceptionIds.map((misconceptionId) => ({
            itemId: input.id,
            misconceptionId,
          })),
        });
      }
    }

    // 감사 로그 기록
    await tx.auditLog.create({
      data: {
        orgId,
        tableName: "items",
        recordId: input.id,
        action: "update",
        performedBy: userId,
        oldData: {
          bodyLatex: existing.bodyLatex,
          currentVersion: existing.currentVersion,
        } as Prisma.InputJsonValue,
        newData: {
          bodyLatex: input.bodyLatex ?? existing.bodyLatex,
          currentVersion: nextVersion,
          changeSummary: input.changeSummary,
        } as Prisma.InputJsonValue,
      },
    });

    // 관계 포함하여 최종 조회
    const updatedItem = await tx.item.findUnique({
      where: { id: input.id },
      include: ITEM_FULL_INCLUDE,
    });

    return [updatedItem, newVersion] as const;
  });

  // Meilisearch 인덱스 동기화
  if (item) {
    void indexItem(item);
  }

  return { item, version };
}

// -------------------------------------------------
// 3. 문항 단건 조회
// -------------------------------------------------

/**
 * ID로 문항을 조회한다.
 * 관계 데이터(스킬, 성취기준, 오개념, 풀이, 난이도, 버전)를 함께 반환한다.
 */
export async function getItemById(id: string, orgId: string) {
  const item = await prisma.item.findUnique({
    where: { id },
    include: ITEM_FULL_INCLUDE,
  });

  if (!item) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `문항을 찾을 수 없습니다: ${id}`,
    });
  }

  if (item.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 문항이 아닙니다",
    });
  }

  return item;
}

// -------------------------------------------------
// 4. 문항 목록 조회
// -------------------------------------------------

/**
 * 필터 + 페이지네이션으로 문항 목록을 조회한다.
 * - status: 복수 상태 필터 (OR)
 * - skillId: ItemSkill 조인 테이블을 통한 필터
 * - difficultyMin/Max: difficultyAuthor 범위 필터
 */
export async function listItems(params: ListItemsParams, orgId: string) {
  const {
    page,
    limit,
    status,
    schoolLevel,
    grade,
    skillId,
    itemType,
    difficultyMin,
    difficultyMax,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = params;

  // 동적 where 절 구성
  const where: Prisma.ItemWhereInput = {
    orgId,
    ...(status && status.length > 0 && { status: { in: status } }),
    ...(schoolLevel != null && { schoolLevel }),
    ...(grade != null && { grade }),
    ...(itemType != null && { itemType }),
    ...(skillId != null && {
      skills: { some: { skillId } },
    }),
    ...buildDifficultyFilter(difficultyMin, difficultyMax),
  };

  // 허용된 정렬 필드 검증
  const allowedSortFields = [
    "createdAt",
    "updatedAt",
    "grade",
    "difficultyAuthor",
    "currentVersion",
  ];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      include: {
        skills: { include: { skill: true } },
        difficultyProfile: true,
      },
      orderBy: { [safeSortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.item.count({ where }),
  ]);

  return { items, total, page, limit };
}

// -------------------------------------------------
// 내부 유틸리티
// -------------------------------------------------

/** 난이도 범위 필터 where 절 생성 */
function buildDifficultyFilter(
  min?: number,
  max?: number,
): Prisma.ItemWhereInput {
  if (min == null && max == null) return {};

  return {
    difficultyAuthor: {
      ...(min != null && { gte: min }),
      ...(max != null && { lte: max }),
    },
  };
}
