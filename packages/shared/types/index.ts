// 선택지
export interface Choice {
  label: string;
  latex: string;
  mathml?: string;
  isCorrect: boolean;
}

// 정답
export interface Answer {
  value: string;
  format: string;
  tolerance?: number;
  alternatives?: string[];
}

// 문항 (API 응답용)
export interface Item {
  id: string;
  orgId: string;
  subject: string;
  bodyLatex: string;
  bodyMathml: string | null;
  bodySympy: string | null;
  bodyHtml: string | null;
  bodyCode: string | null;
  codeLanguage: string | null;
  expectedOutput: string | null;
  bodyText: string | null;
  choices: Choice[] | null;
  answer: Answer;
  schoolLevel: string;
  grade: number;
  semester: string | null;
  topicPath: string | null;
  itemType: string;
  formulaType: string;
  answerFormat: string;
  solutionSteps: number | null;
  usagePurposes: string[];
  difficultyAuthor: number | null;
  status: string;
  isGenerated: boolean;
  templateId: string | null;
  currentVersion: number;
  createdBy: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

// 문항 버전
export interface ItemVersion {
  id: string;
  itemId: string;
  version: number;
  bodyLatex: string;
  answer: Answer;
  changeSummary: string | null;
  createdAt: Date;
}

// 스킬
export interface Skill {
  id: string;
  orgId: string;
  subject: string;
  code: string;
  title: string;
  description: string | null;
  topicPath: string;
  bloomLevel: number | null;
  estimatedTimeMin: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// 성취기준
export interface Standard {
  id: string;
  orgId: string;
  code: string;
  title: string;
  schoolLevel: string;
  grade: number;
  topicPath: string;
  caseUri: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// 오개념
export interface Misconception {
  id: string;
  orgId: string;
  code: string;
  title: string;
  typicalError: string | null;
  remediation: string | null;
  severity: number;
  relatedSkills: string[];
  createdAt: Date;
  updatedAt: Date;
}

// 난이도 프로필
export interface DifficultyProfile {
  id: string;
  itemId: string;
  authorDifficulty: number;
  behavioralDifficulty: number | null;
  irtDifficulty: number | null;
  irtDiscrimination: number | null;
  irtGuessing: number | null;
  teacherPerceived: number | null;
}

// 풀이 단계
export interface SolutionStep {
  stepNum: number;
  latex: string;
  explanation: string;
  hint?: string;
}

// 풀이
export interface Solution {
  id: string;
  itemId: string;
  method: string;
  steps: SolutionStep[];
  finalAnswer: string;
  explanation: string | null;
}

// 템플릿 매개변수
export interface TemplateParameter {
  name: string;
  type: string;
  range: [number, number];
  constraints?: Record<string, unknown>;
}

// 생성 템플릿
export interface Template {
  id: string;
  orgId: string;
  title: string;
  bodyTemplate: string;
  parameters: TemplateParameter[];
  answerTemplate: string;
  constraints: Record<string, unknown>;
  variantCount: number;
}

// 변형
export interface Variant {
  id: string;
  templateId: string;
  itemId: string;
  paramValues: Record<string, unknown>;
  seed: number | null;
  generationLog: Record<string, unknown>;
}

// 과제/학습지
export interface Assignment {
  id: string;
  orgId: string;
  title: string;
  purpose: string;
  isPublished: boolean;
}

// 추천 이벤트
export interface RecommendationEvent {
  id: string;
  orgId: string;
  recType: string;
  itemIds: string[];
  reasoning: Record<string, unknown>;
  accepted: boolean | null;
  feedback: string | null;
}

// 감사 로그
export interface AuditLog {
  id: string;
  orgId: string;
  tableName: string;
  recordId: string;
  action: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  performedBy: string;
  createdAt: Date;
}

// 3중 변환 결과
export interface ConversionResult {
  mathml: string | null;
  sympy: string | null;
  errors: string[];
}

// 검색 결과 아이템
export interface SearchResultItem extends Item {
  score?: number;
  highlights?: Record<string, string>;
}

// 유사문항 신호
export interface SimilaritySignals {
  skillMatch: number;
  formulaStructure: number;
  prerequisiteDistance: number;
  textSemantic: number;
  difficultyProximity: number;
  misconceptionProfile: number;
}

// 유사문항 결과
export interface SimilarItem {
  item: Item;
  score: number;
  signals: SimilaritySignals;
  explanation: string;
}

// 교정 경로 단계 유형
export type RemediationPhase =
  | "prerequisite_review"
  | "basic_practice"
  | "confirmation";

// 교정 단계
export interface RemediationStep {
  phase: RemediationPhase;
  items: Item[];
  explanation: string;
}

// 페이지네이션 응답
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// 검색 패싯 결과
export interface SearchFacets {
  subject: Record<string, number>;
  schoolLevel: Record<string, number>;
  grade: Record<number, number>;
  itemType: Record<string, number>;
  codeLanguage: Record<string, number>;
  difficulty: Record<number, number>;
}

// CAS 검증 결과
export interface CasVerification {
  passed: boolean;
  answerEquivalence: boolean;
  solutionUniqueness: boolean;
  failureReason?: string;
}

// 검수 작업
export interface ReviewTask {
  id: string;
  taskType: string;
  status: string;
  assigneeId: string | null;
  priority: number;
  comment: string | null;
}

// 품질 메트릭
export interface QualityMetrics {
  totalItems: number;
  byStatus: Record<string, number>;
  metadataCompleteness: number;
  avgDifficulty: number;
  recentActivity: AuditLog[];
  pendingReviews: number;
  generatedItemPassRate: number;
}

// 학생 풀이 세션
export interface StudentSession {
  readonly id: string;
  readonly assignmentId: string;
  readonly studentName: string;
  readonly token: string;
  readonly status: string;
  readonly startedAt: Date;
  readonly submittedAt: Date | null;
  readonly gradedAt: Date | null;
  readonly totalScore: number | null;
  readonly maxScore: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// 학생 응답
export interface StudentResponse {
  readonly id: string;
  readonly sessionId: string;
  readonly assignmentItemId: string;
  readonly studentAnswer: Record<string, unknown>;
  readonly result: string;
  readonly score: number | null;
  readonly maxScore: number | null;
  readonly timeTakenSec: number | null;
  readonly misconceptionIds: string[];
  readonly createdAt: Date;
}

// typeLevel별 통계
export interface TypeLevelStat {
  readonly typeLevel: number;
  readonly label: string;
  readonly totalCount: number;
  readonly correctCount: number;
  readonly correctRate: number;
}

// 오답 워크시트 항목
export interface ErrorWorksheetItem {
  readonly originalItem: Item;
  readonly studentAnswer: Record<string, unknown>;
  readonly correctAnswer: Answer;
  readonly result: string;
  readonly misconceptions: Misconception[];
  readonly twinProblems: SimilarItem[];
}

// 과제 분석 결과
export interface AssignmentAnalytics {
  readonly assignmentId: string;
  readonly sessionCount: number;
  readonly avgScore: number;
  readonly medianScore: number;
  readonly minScore: number;
  readonly maxScore: number;
  readonly typeLevelStats: TypeLevelStat[];
}

// 학생 약점 프로필
export interface StudentWeaknessProfile {
  readonly sessionId: string;
  readonly studentName: string;
  readonly totalScore: number;
  readonly maxScore: number;
  readonly weakTypeLevels: TypeLevelStat[];
  readonly weakSkills: Array<{ readonly skillId: string; readonly title: string; readonly correctRate: number }>;
}
