/**
 * 디스플레이/라벨 상수 — Prisma enum과 병행하여 한글 라벨, 정렬, 그룹핑 제공
 */

// ─── 학교급 ───
export const SCHOOL_LEVEL = {
  elementary: { value: "elementary" as const, label: "초등", order: 1 },
  middle: { value: "middle" as const, label: "중등", order: 2 },
  high: { value: "high" as const, label: "고등", order: 3 },
} as const;

export type SchoolLevelKey = keyof typeof SCHOOL_LEVEL;
export const SCHOOL_LEVEL_OPTIONS = Object.values(SCHOOL_LEVEL).sort((a, b) => a.order - b.order);

// ─── 문항 유형 ───
export const ITEM_TYPE = {
  multiple_choice: { value: "multiple_choice" as const, label: "선다형", order: 1 },
  short_answer: { value: "short_answer" as const, label: "단답형", order: 2 },
  essay: { value: "essay" as const, label: "서술형", order: 3 },
  fill_in_blank: { value: "fill_in_blank" as const, label: "빈칸채우기", order: 4 },
  true_false: { value: "true_false" as const, label: "참거짓", order: 5 },
} as const;

export type ItemTypeKey = keyof typeof ITEM_TYPE;
export const ITEM_TYPE_OPTIONS = Object.values(ITEM_TYPE).sort((a, b) => a.order - b.order);

// ─── 수식 유형 ───
export const FORMULA_TYPE = {
  inline: { value: "inline" as const, label: "인라인", order: 1 },
  display: { value: "display" as const, label: "디스플레이", order: 2 },
  mixed: { value: "mixed" as const, label: "혼합", order: 3 },
  none: { value: "none" as const, label: "없음", order: 4 },
} as const;

export type FormulaTypeKey = keyof typeof FORMULA_TYPE;
export const FORMULA_TYPE_OPTIONS = Object.values(FORMULA_TYPE).sort((a, b) => a.order - b.order);

// ─── 정답 형식 ───
export const ANSWER_FORMAT = {
  exact_value: { value: "exact_value" as const, label: "정확한 값", order: 1 },
  expression: { value: "expression" as const, label: "수식", order: 2 },
  multiple_choice: { value: "multiple_choice" as const, label: "선다형", order: 3 },
  range: { value: "range" as const, label: "범위", order: 4 },
  set: { value: "set" as const, label: "집합", order: 5 },
} as const;

export type AnswerFormatKey = keyof typeof ANSWER_FORMAT;
export const ANSWER_FORMAT_OPTIONS = Object.values(ANSWER_FORMAT).sort((a, b) => a.order - b.order);

// ─── 품질 상태 ───
export const QUALITY_STATUS = {
  draft: { value: "draft" as const, label: "초안", order: 1 },
  reviewed: { value: "reviewed" as const, label: "검토완료", order: 2 },
  approved: { value: "approved" as const, label: "승인", order: 3 },
  retired: { value: "retired" as const, label: "폐기", order: 4 },
} as const;

export type QualityStatusKey = keyof typeof QUALITY_STATUS;
export const QUALITY_STATUS_OPTIONS = Object.values(QUALITY_STATUS).sort((a, b) => a.order - b.order);

// ─── 활용 목적 ───
export const USAGE_PURPOSE = {
  diagnosis: { value: "diagnosis" as const, label: "진단", order: 1 },
  remediation: { value: "remediation" as const, label: "보충", order: 2 },
  pre_exam: { value: "pre_exam" as const, label: "시험대비", order: 3 },
  advanced: { value: "advanced" as const, label: "심화", order: 4 },
  practice: { value: "practice" as const, label: "연습", order: 5 },
  review: { value: "review" as const, label: "복습", order: 6 },
} as const;

export type UsagePurposeKey = keyof typeof USAGE_PURPOSE;
export const USAGE_PURPOSE_OPTIONS = Object.values(USAGE_PURPOSE).sort((a, b) => a.order - b.order);

// ─── 간선 강도 ───
export const EDGE_STRENGTH = {
  strong: { value: "strong" as const, label: "강", order: 1 },
  weak: { value: "weak" as const, label: "약", order: 2 },
} as const;

export type EdgeStrengthKey = keyof typeof EDGE_STRENGTH;
export const EDGE_STRENGTH_OPTIONS = Object.values(EDGE_STRENGTH).sort((a, b) => a.order - b.order);

// ─── 풀이 방법 ───
export const SOLUTION_METHOD = {
  standard: { value: "standard" as const, label: "표준", order: 1 },
  alternative: { value: "alternative" as const, label: "대안", order: 2 },
  visual: { value: "visual" as const, label: "시각", order: 3 },
  shortcut: { value: "shortcut" as const, label: "단축", order: 4 },
} as const;

export type SolutionMethodKey = keyof typeof SOLUTION_METHOD;
export const SOLUTION_METHOD_OPTIONS = Object.values(SOLUTION_METHOD).sort((a, b) => a.order - b.order);

// ─── 추천 유형 ───
export const REC_TYPE = {
  remediation: { value: "remediation" as const, label: "교정", order: 1 },
  advancement: { value: "advancement" as const, label: "심화", order: 2 },
  practice: { value: "practice" as const, label: "연습", order: 3 },
  review: { value: "review" as const, label: "복습", order: 4 },
} as const;

export type RecTypeKey = keyof typeof REC_TYPE;
export const REC_TYPE_OPTIONS = Object.values(REC_TYPE).sort((a, b) => a.order - b.order);

// ─── 감사 로그 액션 ───
export const AUDIT_ACTION = {
  create: { value: "create" as const, label: "생성", order: 1 },
  update: { value: "update" as const, label: "수정", order: 2 },
  delete: { value: "delete" as const, label: "삭제", order: 3 },
  approve: { value: "approve" as const, label: "승인", order: 4 },
  retire: { value: "retire" as const, label: "폐기", order: 5 },
  generate: { value: "generate" as const, label: "생성", order: 6 },
  assign: { value: "assign" as const, label: "배정", order: 7 },
} as const;

export type AuditActionKey = keyof typeof AUDIT_ACTION;
export const AUDIT_ACTION_OPTIONS = Object.values(AUDIT_ACTION).sort((a, b) => a.order - b.order);

// ─── 검수 작업 유형 ───
export const REVIEW_TASK_TYPE = {
  tag_review: { value: "tag_review" as const, label: "태그검수", order: 1 },
  generation_review: { value: "generation_review" as const, label: "생성검수", order: 2 },
  duplicate_review: { value: "duplicate_review" as const, label: "중복검수", order: 3 },
  explanation_error: { value: "explanation_error" as const, label: "해설오류", order: 4 },
} as const;

export type ReviewTaskTypeKey = keyof typeof REVIEW_TASK_TYPE;
export const REVIEW_TASK_TYPE_OPTIONS = Object.values(REVIEW_TASK_TYPE).sort((a, b) => a.order - b.order);

// ─── 검수 상태 ───
export const REVIEW_STATUS = {
  pending: { value: "pending" as const, label: "대기", order: 1 },
  in_progress: { value: "in_progress" as const, label: "진행중", order: 2 },
  completed: { value: "completed" as const, label: "완료", order: 3 },
  rejected: { value: "rejected" as const, label: "반려", order: 4 },
} as const;

export type ReviewStatusKey = keyof typeof REVIEW_STATUS;
export const REVIEW_STATUS_OPTIONS = Object.values(REVIEW_STATUS).sort((a, b) => a.order - b.order);

// ─── 배정 목적 ───
export const ASSIGNMENT_PURPOSE = {
  diagnosis: { value: "diagnosis" as const, label: "진단", order: 1 },
  remediation: { value: "remediation" as const, label: "보충", order: 2 },
  pre_exam: { value: "pre_exam" as const, label: "시험대비", order: 3 },
  advanced: { value: "advanced" as const, label: "심화", order: 4 },
} as const;

export type AssignmentPurposeKey = keyof typeof ASSIGNMENT_PURPOSE;
export const ASSIGNMENT_PURPOSE_OPTIONS = Object.values(ASSIGNMENT_PURPOSE).sort((a, b) => a.order - b.order);

// ─── 사용자 역할 ───
export const USER_ROLE = {
  admin: { value: "admin" as const, label: "시스템관리자", order: 1 },
  reviewer: { value: "reviewer" as const, label: "콘텐츠검수자", order: 2 },
  teacher: { value: "teacher" as const, label: "교사", order: 3 },
} as const;

export type UserRoleKey = keyof typeof USER_ROLE;
export const USER_ROLE_OPTIONS = Object.values(USER_ROLE).sort((a, b) => a.order - b.order);

// ─── 블룸 인지 수준 (숫자 키) ───
export const BLOOM_LEVEL = {
  1: { value: 1 as const, label: "기억", order: 1 },
  2: { value: 2 as const, label: "이해", order: 2 },
  3: { value: 3 as const, label: "적용", order: 3 },
  4: { value: 4 as const, label: "분석", order: 4 },
  5: { value: 5 as const, label: "평가", order: 5 },
  6: { value: 6 as const, label: "창조", order: 6 },
} as const;

export type BloomLevelKey = keyof typeof BLOOM_LEVEL;
export const BLOOM_LEVEL_OPTIONS = Object.values(BLOOM_LEVEL).sort((a, b) => a.order - b.order);

// ─── 난이도 (숫자 키) ───
export const DIFFICULTY_LEVEL = {
  1: { value: 1 as const, label: "매우 쉬움", order: 1 },
  2: { value: 2 as const, label: "쉬움", order: 2 },
  3: { value: 3 as const, label: "보통", order: 3 },
  4: { value: 4 as const, label: "어려움", order: 4 },
  5: { value: 5 as const, label: "매우 어려움", order: 5 },
} as const;

export type DifficultyLevelKey = keyof typeof DIFFICULTY_LEVEL;
export const DIFFICULTY_LEVEL_OPTIONS = Object.values(DIFFICULTY_LEVEL).sort((a, b) => a.order - b.order);

// ─── 학교급별 학년 매핑 ───
export const GRADE_BY_LEVEL = {
  elementary: [1, 2, 3, 4, 5, 6],
  middle: [1, 2, 3],
  high: [1, 2, 3],
} as const satisfies Record<SchoolLevelKey, readonly number[]>;

export type GradeByLevelKey = keyof typeof GRADE_BY_LEVEL;
