// 시맨틱 메타데이터 자동 태깅 서비스
// 문항 본문 임베딩 기반 스킬/성취기준/오개념 추천 + 블룸 수준 휴리스틱 추정
import { prisma } from "@math-item-os/db";
import type { SchoolLevel, ItemType } from "@math-item-os/db";
import {
  generateEmbedding,
  generateEmbeddingBatch,
} from "./embedding.service";

// -------------------------------------------------
// 입력/출력 타입
// -------------------------------------------------

export interface SuggestMetadataInput {
  readonly bodyLatex: string;
  readonly schoolLevel: SchoolLevel;
  readonly grade: number;
  readonly itemType?: ItemType;
  readonly formulaType?: string;
  readonly solutionSteps?: number;
}

export interface SuggestedSkill {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description: string | null;
  readonly similarity: number;
}

export interface SuggestedStandard {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface SuggestedMisconception {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly typicalError: string | null;
}

export interface SuggestMetadataResult {
  readonly skills: SuggestedSkill[];
  readonly standards: SuggestedStandard[];
  readonly misconceptions: SuggestedMisconception[];
  readonly bloomLevel: number;
}

// -------------------------------------------------
// 스킬 임베딩 인-메모리 캐시 (5분 TTL)
// -------------------------------------------------

const skillEmbeddingCache = new Map<string, { embeddings: Map<string, number[]>; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// -------------------------------------------------
// 코사인 유사도
// -------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// -------------------------------------------------
// 블룸 수준 휴리스틱 추정
// -------------------------------------------------

function estimateBloomLevel(
  itemType?: ItemType,
  solutionSteps?: number,
): number {
  if (itemType === "essay") return 5;
  if (itemType === "short_answer") {
    if (solutionSteps != null && solutionSteps >= 4) return 4;
    if (solutionSteps != null && solutionSteps >= 2) return 3;
  }
  if (itemType === "multiple_choice") return 2;
  if (itemType === "true_false") return 1;
  if (itemType === "fill_in_blank") return 2;
  return 3;
}

// -------------------------------------------------
// 메인 추천 함수
// -------------------------------------------------

const SIMILARITY_THRESHOLD = 0.3;
const TOP_K = 5;

export async function suggestMetadata(
  input: SuggestMetadataInput,
  orgId: string,
): Promise<SuggestMetadataResult> {
  // 블룸 수준은 항상 계산 가능
  const bloomLevel = estimateBloomLevel(
    input.itemType as ItemType | undefined,
    input.solutionSteps,
  );

  // 스킬 추천: 임베딩 유사도 기반
  const suggestedSkills = await suggestSkills(input.bodyLatex, orgId);

  // 성취기준: schoolLevel + grade 필터
  const standards = await prisma.standard.findMany({
    where: { orgId, schoolLevel: input.schoolLevel, grade: input.grade },
    select: { id: true, code: true, title: true },
  });

  // 오개념: 추천된 스킬 코드와 relatedSkills 교집합
  const suggestedSkillCodes = suggestedSkills.map((s) => s.code);
  const misconceptions = suggestedSkillCodes.length > 0
    ? await prisma.misconception.findMany({
        where: {
          orgId,
          relatedSkills: { hasSome: suggestedSkillCodes },
        },
        select: { id: true, code: true, title: true, typicalError: true },
      })
    : [];

  return {
    skills: suggestedSkills,
    standards,
    misconceptions,
    bloomLevel,
  };
}

// -------------------------------------------------
// 스킬 임베딩 유사도 추천
// -------------------------------------------------

async function suggestSkills(
  bodyLatex: string,
  orgId: string,
): Promise<SuggestedSkill[]> {
  // 문항 본문 임베딩 생성
  const bodyEmbedding = await generateEmbedding(bodyLatex);
  if (bodyEmbedding == null) return [];

  // 캐시 확인
  const now = Date.now();
  const cached = skillEmbeddingCache.get(orgId);
  let embeddingsBySkillId: Map<string, number[]>;

  if (cached && cached.expiry > now) {
    // 캐시 히트: 기존 임베딩 재사용
    embeddingsBySkillId = cached.embeddings;
  } else {
    // 캐시 미스: 스킬 조회 및 임베딩 생성
    const skills = await prisma.skill.findMany({
      where: { orgId },
      select: { id: true, code: true, title: true, description: true },
    });

    if (skills.length === 0) return [];

    const skillTexts = skills.map(
      (s) => `${s.title}${s.description ? " " + s.description : ""}`,
    );
    const skillEmbeddings = await generateEmbeddingBatch(skillTexts);

    embeddingsBySkillId = new Map<string, number[]>();
    for (let i = 0; i < skills.length; i++) {
      const emb = skillEmbeddings[i];
      if (emb != null) {
        embeddingsBySkillId.set(skills[i].id, emb);
      }
    }

    skillEmbeddingCache.set(orgId, {
      embeddings: embeddingsBySkillId,
      expiry: now + CACHE_TTL_MS,
    });
  }

  // 캐시된 임베딩으로 스킬 메타데이터 조회 및 유사도 계산
  const skillIds = Array.from(embeddingsBySkillId.keys());
  if (skillIds.length === 0) return [];

  const skills = await prisma.skill.findMany({
    where: { id: { in: skillIds } },
    select: { id: true, code: true, title: true, description: true },
  });

  const scored: SuggestedSkill[] = [];

  for (const skill of skills) {
    const emb = embeddingsBySkillId.get(skill.id);
    if (emb == null) continue;

    const similarity = cosineSimilarity(bodyEmbedding, emb);
    if (similarity >= SIMILARITY_THRESHOLD) {
      scored.push({
        id: skill.id,
        code: skill.code,
        title: skill.title,
        description: skill.description,
        similarity: Math.round(similarity * 1000) / 1000,
      });
    }
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, TOP_K);
}
