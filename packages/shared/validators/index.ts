import { z } from "zod";

// ---------------------------------------------------------------------------
// 1. 공통 스키마
// ---------------------------------------------------------------------------

/** 페이지네이션 기본 스키마 */
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// 2. 열거형 스키마
// ---------------------------------------------------------------------------

export const schoolLevelSchema = z.enum(["elementary", "middle", "high"]);
export const semesterTypeSchema = z.enum(["first", "second"]);
export const itemTypeSchema = z.enum([
  "multiple_choice",
  "short_answer",
  "essay",
  "fill_in_blank",
  "true_false",
]);
export const formulaTypeSchema = z.enum(["inline", "display", "mixed", "none"]);
export const answerFormatSchema = z.enum([
  "exact_value",
  "expression",
  "multiple_choice",
  "range",
  "set",
]);
export const qualityStatusSchema = z.enum([
  "draft",
  "reviewed",
  "approved",
  "retired",
]);
export const usagePurposeSchema = z.enum([
  "diagnosis",
  "remediation",
  "pre_exam",
  "advanced",
  "practice",
  "review",
]);
export const edgeStrengthSchema = z.enum(["strong", "weak"]);
export const solutionMethodSchema = z.enum([
  "standard",
  "alternative",
  "visual",
  "shortcut",
]);
export const recTypeSchema = z.enum([
  "remediation",
  "advancement",
  "practice",
  "review",
]);
export const auditActionSchema = z.enum([
  "create",
  "update",
  "delete",
  "approve",
  "retire",
  "generate",
  "assign",
]);
export const userRoleSchema = z.enum(["admin", "reviewer", "teacher"]);
export const assignmentPurposeSchema = z.enum([
  "diagnosis",
  "remediation",
  "pre_exam",
  "advanced",
]);

// ---------------------------------------------------------------------------
// 3. 문항(Item) 라우터 스키마
// ---------------------------------------------------------------------------

/** 선택지 스키마 */
export const choiceSchema = z.object({
  label: z.string(),
  latex: z.string(),
  isCorrect: z.boolean(),
});

/** 정답 스키마 */
export const answerSchema = z.object({
  value: z.string(),
  format: z.string(),
  tolerance: z.number().optional(),
  alternatives: z.array(z.string()).optional(),
});

/** 문항 생성 입력 */
export const createItemSchema = z.object({
  bodyLatex: z.string().min(1),
  choices: z.array(choiceSchema).optional(),
  answer: answerSchema,
  schoolLevel: schoolLevelSchema,
  grade: z.number().int().min(1).max(12),
  semester: semesterTypeSchema.optional(),
  itemType: itemTypeSchema,
  formulaType: formulaTypeSchema.optional(),
  answerFormat: answerFormatSchema,
  solutionSteps: z.number().int().min(1).optional(),
  usagePurposes: z.array(usagePurposeSchema).optional(),
  difficultyAuthor: z.number().int().min(1).max(5).optional(),
  skillIds: z.array(z.string()).optional(),
  standardIds: z.array(z.string()).optional(),
  misconceptionIds: z.array(z.string()).optional(),
  passageId: z.string().optional(),
});

/** 문항 수정 입력 (전체 필드 선택적 + id 필수) */
export const updateItemSchema = createItemSchema.partial().extend({
  id: z.string(),
  changeSummary: z.string().optional(),
});

/** 문항 상태 변경 */
export const updateStatusSchema = z.object({
  id: z.string(),
  status: qualityStatusSchema,
});

/** 단건 조회 */
export const getByIdSchema = z.object({ id: z.string() });

/** 문항 목록 조회 (필터 + 페이지네이션) */
export const listItemsSchema = paginationSchema.extend({
  status: z.array(qualityStatusSchema).optional(),
  schoolLevel: schoolLevelSchema.optional(),
  grade: z.number().int().min(1).max(12).optional(),
  skillId: z.string().optional(),
  itemType: itemTypeSchema.optional(),
  difficultyMin: z.number().int().min(1).max(5).optional(),
  difficultyMax: z.number().int().min(1).max(5).optional(),
  sortBy: z.enum(["createdAt", "difficulty", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

/** 대량 업로드 요청 */
export const bulkUploadSchema = z.object({
  format: z.enum(["csv", "json", "qti"]),
  fileUrl: z.string().url(),
});

/** 대량 업로드 상태 조회 */
export const getBulkUploadStatusSchema = z.object({ jobId: z.string() });

// ---------------------------------------------------------------------------
// 4. 검색(Search) 라우터 스키마
// ---------------------------------------------------------------------------

/** 문항 검색 */
export const searchItemsSchema = z.object({
  query: z.string().optional(),
  filters: z
    .object({
      schoolLevel: schoolLevelSchema.optional(),
      grade: z.number().int().min(1).max(12).optional(),
      semester: semesterTypeSchema.optional(),
      skillIds: z.array(z.string()).optional(),
      standardIds: z.array(z.string()).optional(),
      itemType: itemTypeSchema.optional(),
      difficultyMin: z.number().int().min(1).max(5).optional(),
      difficultyMax: z.number().int().min(1).max(5).optional(),
      usagePurposes: z.array(usagePurposeSchema).optional(),
      isGenerated: z.boolean().optional(),
      status: z.array(qualityStatusSchema).optional(),
    })
    .optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
  sort: z.enum(["relevance", "difficulty", "createdAt"]).optional(),
});

/** 유사 문항 검색 */
export const searchSimilarSchema = z.object({
  itemId: z.string(),
  limit: z.number().int().min(1).max(50).default(20),
});

/** 유사도 피드백 */
export const similarFeedbackSchema = z.object({
  sourceItemId: z.string(),
  targetItemId: z.string(),
  relevant: z.boolean(),
});

// ---------------------------------------------------------------------------
// 5. 스킬(Skill) 라우터 스키마
// ---------------------------------------------------------------------------

/** 스킬 생성 */
export const createSkillSchema = z.object({
  code: z.string().min(1).max(100),
  title: z.string().min(1),
  description: z.string().optional(),
  topicPath: z.string().min(1),
  bloomLevel: z.number().int().min(1).max(6).optional(),
  estimatedTimeMin: z.number().int().min(1).optional(),
});

/** 선수 스킬 관계 생성 */
export const createPrerequisiteSchema = z.object({
  fromSkillId: z.string(),
  toSkillId: z.string(),
  strength: edgeStrengthSchema,
  weight: z.number().min(0).max(1).default(1.0),
});

/** 선수 스킬 그래프 조회 */
export const getPrerequisiteGraphSchema = z.object({
  skillId: z.string(),
  depth: z.number().int().min(1).max(10).default(5),
  direction: z.enum(["ancestors", "descendants", "both"]).default("both"),
});

/** 스킬 목록 조회 */
export const listSkillsSchema = paginationSchema.extend({
  topicPath: z.string().optional(),
  bloomLevel: z.number().int().min(1).max(6).optional(),
});

/** 스킬별 문항 목록 */
export const getSkillItemsSchema = z.object({
  skillId: z.string(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["difficulty", "createdAt"]).optional(),
});

/** 오개념 생성 */
export const createMisconceptionSchema = z.object({
  code: z.string().min(1).max(100),
  title: z.string().min(1),
  typicalError: z.string().optional(),
  remediation: z.string().optional(),
  severity: z.number().int().min(1).max(5).default(3),
  relatedSkillIds: z.array(z.string()).optional(),
});

/** 오개념 목록 조회 */
export const listMisconceptionsSchema = paginationSchema.extend({
  skillId: z.string().optional(),
  severity: z.number().int().min(1).max(5).optional(),
});

/** 교정 학습 경로 조회 */
export const getRemediationPathSchema = z.object({
  misconceptionId: z.string(),
  difficulty: z.number().int().min(1).max(5).optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

// ---------------------------------------------------------------------------
// 6. 관리(Admin) 라우터 스키마
// ---------------------------------------------------------------------------

/** 감사 로그 목록 */
export const listAuditLogsSchema = paginationSchema.extend({
  tableName: z.string().optional(),
  recordId: z.string().optional(),
  action: auditActionSchema.optional(),
  performedBy: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

/** 사용자 역할 변경 */
export const updateUserRoleSchema = z.object({
  userId: z.string(),
  role: userRoleSchema,
});

/** AI 변형 문항 생성 요청 */
export const generateVariantsSchema = z.object({
  templateId: z.string(),
  count: z.number().int().min(1).max(50),
  params: z
    .object({
      solutionSteps: z.number().int().min(1).optional(),
      coefficientRange: z.tuple([z.number(), z.number()]).optional(),
      includeFractions: z.boolean().optional(),
      includeNegatives: z.boolean().optional(),
    })
    .optional(),
});

/** 생성 결과 조회 */
export const getGenerationResultSchema = z.object({ jobId: z.string() });

/** 과제 생성 */
export const createAssignmentSchema = z.object({
  title: z.string().min(1),
  purpose: assignmentPurposeSchema,
  itemIds: z.array(z.string()).min(1),
  points: z.array(z.number()).optional(),
});

/** 과제 내보내기 */
export const exportAssignmentSchema = z.object({
  assignmentId: z.string(),
  format: z.enum(["pdf", "link"]),
});

/** 검수 작업 목록 */
export const listReviewTasksSchema = paginationSchema.extend({
  taskType: z
    .enum([
      "tag_review",
      "generation_review",
      "duplicate_review",
      "explanation_error",
    ])
    .optional(),
  status: z
    .enum(["pending", "in_progress", "completed", "rejected"])
    .optional(),
  assigneeId: z.string().optional(),
  priority: z.number().int().min(1).max(5).optional(),
});

/** 검수 작업 상태 변경 */
export const updateReviewTaskSchema = z.object({
  taskId: z.string(),
  status: z.enum(["pending", "in_progress", "completed", "rejected"]),
  comment: z.string().optional(),
});

/** 사용자 목록 조회 */
export const listUsersSchema = paginationSchema.extend({
  role: userRoleSchema.optional(),
});

/** 템플릿 목록 조회 */
export const listTemplatesSchema = paginationSchema;
