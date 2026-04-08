// 대량 업로드 서비스
// CSV/JSON/QTI 형식 파싱, BullMQ 비동기 작업 큐, 진행률 추적
import { Queue, Worker, Job } from "bullmq";
import { TRPCError } from "@trpc/server";
import type {
  SchoolLevel,
  ItemType,
  AnswerFormat,
  FormulaType,
  SemesterType,
  UsagePurpose,
} from "@math-item-os/db";
import type { CreateItemInput } from "./item.service";
import { createItem } from "./item.service";

// -------------------------------------------------
// 상수
// -------------------------------------------------

/** 업로드당 최대 문항 수 */
const MAX_ITEMS_PER_UPLOAD = 10_000;

/** 배치 처리 크기 */
const BATCH_SIZE = 10;

/** BullMQ 큐 이름 */
const QUEUE_NAME = "bulk-upload";

/** Redis 연결 URL */
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// -------------------------------------------------
// 타입 정의
// -------------------------------------------------

/** 업로드 에러 */
export interface UploadError {
  readonly row: number;
  readonly field?: string;
  readonly message: string;
}

/** 대량 업로드 시작 결과 */
interface BulkUploadResult {
  readonly jobId: string;
  readonly estimatedCount: number;
}

/** 대량 업로드 상태 조회 결과 */
interface BulkUploadStatus {
  readonly status: "pending" | "processing" | "completed" | "failed";
  readonly processed: number;
  readonly total: number;
  readonly errors: readonly UploadError[];
}

/** 지원 파일 형식 */
type UploadFormat = "csv" | "json" | "qti";

/** BullMQ 작업 데이터 */
interface BulkUploadJobData {
  readonly format: UploadFormat;
  readonly fileUrl: string;
  readonly userId: string;
  readonly orgId: string;
}

/** CSV 행 원시 데이터 */
interface CsvRawRow {
  readonly [key: string]: string | undefined;
}

// -------------------------------------------------
// Redis 연결 파싱
// -------------------------------------------------

/** Redis URL을 BullMQ 연결 옵션으로 파싱 */
function parseRedisUrl(url: string): { host: string; port: number; password?: string; db?: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    ...(parsed.password ? { password: parsed.password } : {}),
    ...(parsed.pathname.length > 1 ? { db: Number(parsed.pathname.slice(1)) } : {}),
  };
}

const redisConnection = parseRedisUrl(REDIS_URL);

// -------------------------------------------------
// BullMQ 큐 (싱글턴)
// -------------------------------------------------

let queueInstance: Queue | null = null;

/** BullMQ 큐 싱글턴 반환 */
function getQueue(): Queue {
  if (!queueInstance) {
    queueInstance = new Queue(QUEUE_NAME, { connection: redisConnection });
  }
  return queueInstance;
}

// -------------------------------------------------
// 파일 가져오기
// -------------------------------------------------

/** URL에서 파일 내용을 텍스트로 가져온다 */
async function fetchFileContent(fileUrl: string): Promise<string> {
  const response = await fetch(fileUrl);

  if (!response.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `파일 다운로드 실패: ${response.status} ${response.statusText}`,
    });
  }

  return response.text();
}

// -------------------------------------------------
// CSV 파서
// -------------------------------------------------

/** CSV 문자열을 CreateItemInput 배열로 파싱 */
function parseCsv(content: string): { readonly items: readonly CreateItemInput[]; readonly errors: readonly UploadError[] } {
  const lines = content.trim().split("\n");
  if (lines.length < 2) {
    return { items: [], errors: [{ row: 0, message: "CSV 파일에 헤더와 데이터가 필요합니다" }] };
  }

  const headers = parseCSVLine(lines[0]!);
  const items: CreateItemInput[] = [];
  const errors: UploadError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line === "") continue;

    const result = parseCsvRow(headers, line, i + 1);
    if (result.error) {
      errors.push(result.error);
    } else if (result.item) {
      items.push(result.item);
    }
  }

  return { items, errors };
}

/** CSV 한 줄을 필드 배열로 분리 (쌍따옴표 지원) */
function parseCSVLine(line: string): readonly string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());

  return fields;
}

/** CSV 행 하나를 CreateItemInput으로 변환 */
function parseCsvRow(
  headers: readonly string[],
  line: string,
  rowNumber: number,
): { readonly item?: CreateItemInput; readonly error?: UploadError } {
  try {
    const values = parseCSVLine(line);
    const raw: CsvRawRow = {};
    headers.forEach((header, idx) => {
      (raw as Record<string, string>)[header] = values[idx] ?? "";
    });

    return { item: mapRawToCreateInput(raw, rowNumber) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: { row: rowNumber, message } };
  }
}

/** 원시 키-값 데이터를 CreateItemInput으로 매핑 */
function mapRawToCreateInput(raw: CsvRawRow, rowNumber: number): CreateItemInput {
  const bodyLatex = raw["bodyLatex"];
  if (!bodyLatex) {
    throw new Error(`행 ${rowNumber}: bodyLatex 필드가 비어있습니다`);
  }

  const schoolLevel = raw["schoolLevel"];
  if (!schoolLevel || !isValidSchoolLevel(schoolLevel)) {
    throw new Error(`행 ${rowNumber}: 유효하지 않은 schoolLevel: ${schoolLevel ?? "(없음)"}`);
  }

  const gradeStr = raw["grade"];
  const grade = gradeStr ? Number(gradeStr) : NaN;
  if (isNaN(grade) || grade < 1 || grade > 12) {
    throw new Error(`행 ${rowNumber}: 유효하지 않은 grade: ${gradeStr ?? "(없음)"}`);
  }

  const itemType = raw["itemType"];
  if (!itemType || !isValidItemType(itemType)) {
    throw new Error(`행 ${rowNumber}: 유효하지 않은 itemType: ${itemType ?? "(없음)"}`);
  }

  const answerFormat = raw["answerFormat"];
  if (!answerFormat || !isValidAnswerFormat(answerFormat)) {
    throw new Error(`행 ${rowNumber}: 유효하지 않은 answerFormat: ${answerFormat ?? "(없음)"}`);
  }

  const answerValue = raw["answerValue"] ?? raw["answer"] ?? "";

  return {
    bodyLatex,
    schoolLevel: schoolLevel as SchoolLevel,
    grade,
    itemType: itemType as ItemType,
    answerFormat: answerFormat as AnswerFormat,
    answer: { value: answerValue, format: answerFormat },
    ...(raw["semester"] && isValidSemester(raw["semester"])
      ? { semester: raw["semester"] as SemesterType }
      : {}),
    ...(raw["formulaType"] && isValidFormulaType(raw["formulaType"])
      ? { formulaType: raw["formulaType"] as FormulaType }
      : {}),
    ...(raw["difficultyAuthor"]
      ? { difficultyAuthor: Number(raw["difficultyAuthor"]) }
      : {}),
    ...(raw["solutionSteps"]
      ? { solutionSteps: Number(raw["solutionSteps"]) }
      : {}),
    ...(raw["skillIds"]
      ? { skillIds: raw["skillIds"].split(";").map((s) => s.trim()).filter(Boolean) }
      : {}),
    ...(raw["standardIds"]
      ? { standardIds: raw["standardIds"].split(";").map((s) => s.trim()).filter(Boolean) }
      : {}),
    ...(raw["misconceptionIds"]
      ? { misconceptionIds: raw["misconceptionIds"].split(";").map((s) => s.trim()).filter(Boolean) }
      : {}),
    ...(raw["usagePurposes"]
      ? { usagePurposes: raw["usagePurposes"].split(";").map((s) => s.trim()).filter(Boolean) as UsagePurpose[] }
      : {}),
    ...(raw["passageId"] ? { passageId: raw["passageId"] } : {}),
  };
}

// -------------------------------------------------
// JSON 파서
// -------------------------------------------------

/** JSON 문자열을 CreateItemInput 배열로 파싱 */
function parseJson(content: string): { readonly items: readonly CreateItemInput[]; readonly errors: readonly UploadError[] } {
  try {
    const parsed: unknown = JSON.parse(content);

    if (!Array.isArray(parsed)) {
      return { items: [], errors: [{ row: 0, message: "JSON 최상위가 배열이어야 합니다" }] };
    }

    const items: CreateItemInput[] = [];
    const errors: UploadError[] = [];

    for (let i = 0; i < parsed.length; i++) {
      const result = validateJsonItem(parsed[i], i + 1);
      if (result.error) {
        errors.push(result.error);
      } else if (result.item) {
        items.push(result.item);
      }
    }

    return { items, errors };
  } catch {
    return { items: [], errors: [{ row: 0, message: "JSON 파싱에 실패했습니다" }] };
  }
}

/** JSON 개별 항목의 필수 필드 검증 */
function validateJsonItem(
  raw: unknown,
  rowNumber: number,
): { readonly item?: CreateItemInput; readonly error?: UploadError } {
  if (typeof raw !== "object" || raw === null) {
    return { error: { row: rowNumber, message: "항목이 객체가 아닙니다" } };
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj["bodyLatex"] !== "string" || obj["bodyLatex"] === "") {
    return { error: { row: rowNumber, field: "bodyLatex", message: "bodyLatex가 필요합니다" } };
  }

  if (typeof obj["answer"] !== "object" || obj["answer"] === null) {
    return { error: { row: rowNumber, field: "answer", message: "answer 객체가 필요합니다" } };
  }

  if (!isValidSchoolLevel(String(obj["schoolLevel"] ?? ""))) {
    return { error: { row: rowNumber, field: "schoolLevel", message: `유효하지 않은 schoolLevel: ${String(obj["schoolLevel"])}` } };
  }

  if (!isValidItemType(String(obj["itemType"] ?? ""))) {
    return { error: { row: rowNumber, field: "itemType", message: `유효하지 않은 itemType: ${String(obj["itemType"])}` } };
  }

  if (!isValidAnswerFormat(String(obj["answerFormat"] ?? ""))) {
    return { error: { row: rowNumber, field: "answerFormat", message: `유효하지 않은 answerFormat: ${String(obj["answerFormat"])}` } };
  }

  return { item: obj as unknown as CreateItemInput };
}

// -------------------------------------------------
// QTI 파서 (간이)
// -------------------------------------------------

/** QTI XML을 CreateItemInput 배열로 파싱 (간이 구현) */
function parseQti(content: string): { readonly items: readonly CreateItemInput[]; readonly errors: readonly UploadError[] } {
  const items: CreateItemInput[] = [];
  const errors: UploadError[] = [];

  // assessmentItem 태그 추출
  const itemRegex = /<assessmentItem[^>]*>([\s\S]*?)<\/assessmentItem>/gi;
  let match: RegExpExecArray | null;
  let rowNumber = 0;

  while ((match = itemRegex.exec(content)) !== null) {
    rowNumber++;
    const itemXml = match[1] ?? "";
    const result = parseQtiItem(itemXml, rowNumber);
    if (result.error) {
      errors.push(result.error);
    } else if (result.item) {
      items.push(result.item);
    }
  }

  if (rowNumber === 0) {
    errors.push({ row: 0, message: "QTI 파일에서 assessmentItem을 찾을 수 없습니다" });
  }

  return { items, errors };
}

/** 개별 QTI assessmentItem을 파싱 */
function parseQtiItem(
  xml: string,
  rowNumber: number,
): { readonly item?: CreateItemInput; readonly error?: UploadError } {
  try {
    // itemBody 내 텍스트/LaTeX 추출
    const bodyMatch = /<itemBody[^>]*>([\s\S]*?)<\/itemBody>/i.exec(xml);
    const bodyContent = bodyMatch?.[1]?.trim() ?? "";

    // LaTeX 추출: <math> 태그 또는 일반 텍스트
    const latexMatch = /<math[^>]*>([\s\S]*?)<\/math>/i.exec(bodyContent);
    const bodyLatex = latexMatch?.[1]?.trim() ?? stripXmlTags(bodyContent);

    if (!bodyLatex) {
      return { error: { row: rowNumber, message: "QTI 항목에서 문제 본문을 추출할 수 없습니다" } };
    }

    // 정답 추출
    const correctMatch = /<correctResponse[^>]*>[\s\S]*?<value[^>]*>([\s\S]*?)<\/value>/i.exec(xml);
    const answerValue = correctMatch?.[1]?.trim() ?? "";

    // 선택지 존재 여부로 문항 유형 판단
    const hasChoices = /<simpleChoice/i.test(xml);

    return {
      item: {
        bodyLatex,
        answer: { value: answerValue, format: hasChoices ? "multiple_choice" : "exact_value" },
        schoolLevel: "middle" as SchoolLevel,
        grade: 7,
        itemType: hasChoices ? "multiple_choice" as ItemType : "short_answer" as ItemType,
        answerFormat: hasChoices ? "multiple_choice" as AnswerFormat : "exact_value" as AnswerFormat,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: { row: rowNumber, message: `QTI 파싱 오류: ${message}` } };
  }
}

/** XML 태그를 제거하고 텍스트만 반환 */
function stripXmlTags(xml: string): string {
  return xml.replace(/<[^>]+>/g, "").trim();
}

// -------------------------------------------------
// 열거형 검증 유틸
// -------------------------------------------------

const VALID_SCHOOL_LEVELS = new Set<string>(["elementary", "middle", "high"]);
const VALID_ITEM_TYPES = new Set<string>(["multiple_choice", "short_answer", "essay", "fill_in_blank", "true_false"]);
const VALID_ANSWER_FORMATS = new Set<string>(["exact_value", "expression", "multiple_choice", "range", "set"]);
const VALID_SEMESTERS = new Set<string>(["first", "second"]);
const VALID_FORMULA_TYPES = new Set<string>(["inline", "display", "mixed", "none"]);

function isValidSchoolLevel(value: string): boolean {
  return VALID_SCHOOL_LEVELS.has(value);
}

function isValidItemType(value: string): boolean {
  return VALID_ITEM_TYPES.has(value);
}

function isValidAnswerFormat(value: string): boolean {
  return VALID_ANSWER_FORMATS.has(value);
}

function isValidSemester(value: string): boolean {
  return VALID_SEMESTERS.has(value);
}

function isValidFormulaType(value: string): boolean {
  return VALID_FORMULA_TYPES.has(value);
}

// -------------------------------------------------
// 형식별 파서 디스패치
// -------------------------------------------------

/** 파일 형식에 따라 적절한 파서 호출 */
function parseByFormat(
  format: UploadFormat,
  content: string,
): { readonly items: readonly CreateItemInput[]; readonly errors: readonly UploadError[] } {
  switch (format) {
    case "csv":
      return parseCsv(content);
    case "json":
      return parseJson(content);
    case "qti":
      return parseQti(content);
  }
}

// -------------------------------------------------
// BullMQ 워커 프로세서
// -------------------------------------------------

/** 배치 단위로 문항을 생성한다 */
async function processBatch(
  batch: readonly CreateItemInput[],
  batchStartIndex: number,
  userId: string,
  orgId: string,
): Promise<readonly UploadError[]> {
  const errors: UploadError[] = [];

  const results = await Promise.allSettled(
    batch.map((input, idx) =>
      createItem(input, userId, orgId).catch((e: unknown) => {
        const row = batchStartIndex + idx + 1;
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`행 ${row}: ${message}`);
      }),
    ),
  );

  results.forEach((result, idx) => {
    if (result.status === "rejected") {
      const row = batchStartIndex + idx + 1;
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      errors.push({ row, message });
    }
  });

  return errors;
}

/** BullMQ 작업 프로세서: 파일 파싱 -> 배치 문항 생성 -> 진행률 업데이트 */
async function processUploadJob(job: Job<BulkUploadJobData>): Promise<void> {
  const { format, fileUrl, userId, orgId } = job.data;
  const allErrors: UploadError[] = [];

  // 1. 파일 다운로드
  const content = await fetchFileContent(fileUrl);

  // 2. 형식별 파싱
  const { items, errors: parseErrors } = parseByFormat(format, content);
  allErrors.push(...parseErrors);

  const total = items.length;

  // 진행률 초기 상태 저장
  await job.updateProgress({ processed: 0, total, errors: allErrors });

  if (total === 0) {
    await job.updateProgress({ processed: 0, total: 0, errors: allErrors });
    return;
  }

  // 3. 배치 단위 처리
  let processed = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchErrors = await processBatch(batch, i, userId, orgId);
    allErrors.push(...batchErrors);
    processed += batch.length;

    await job.updateProgress({ processed, total, errors: [...allErrors] });
  }
}

// -------------------------------------------------
// 워커 초기화 (지연 생성)
// -------------------------------------------------

let workerInstance: Worker | null = null;

/** 워커가 없으면 생성한다 */
function ensureWorker(): void {
  if (workerInstance) return;

  workerInstance = new Worker<BulkUploadJobData>(
    QUEUE_NAME,
    async (job) => processUploadJob(job),
    {
      connection: redisConnection,
      concurrency: 1,
    },
  );
}

// -------------------------------------------------
// 공개 API
// -------------------------------------------------

/**
 * 대량 업로드 작업을 시작한다.
 * 파일을 가져와 파싱 후 BullMQ 큐에 등록한다.
 * @returns jobId와 예상 문항 수
 */
export async function startBulkUpload(
  input: { readonly format: UploadFormat; readonly fileUrl: string },
  userId: string,
  orgId: string,
): Promise<BulkUploadResult> {
  // 파일 미리 가져와서 개수 확인
  const content = await fetchFileContent(input.fileUrl);
  const { items, errors } = parseByFormat(input.format, content);

  if (items.length === 0 && errors.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `파일 파싱 실패: ${errors[0]?.message ?? "알 수 없는 오류"}`,
    });
  }

  if (items.length > MAX_ITEMS_PER_UPLOAD) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `업로드 제한 초과: ${items.length}개 항목 (최대 ${MAX_ITEMS_PER_UPLOAD}개)`,
    });
  }

  // 워커 시작
  ensureWorker();

  // BullMQ 작업 등록
  const queue = getQueue();
  const job = await queue.add("bulk-upload", {
    format: input.format,
    fileUrl: input.fileUrl,
    userId,
    orgId,
  });

  return {
    jobId: job.id ?? "",
    estimatedCount: items.length,
  };
}

/**
 * 대량 업로드 작업 상태를 조회한다.
 * BullMQ job의 progress 정보를 반환한다.
 */
export async function getBulkUploadJobStatus(
  jobId: string,
): Promise<BulkUploadStatus> {
  const queue = getQueue();
  const job = await queue.getJob(jobId);

  if (!job) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `작업을 찾을 수 없습니다: ${jobId}`,
    });
  }

  const state = await job.getState();
  const progress = (job.progress ?? {}) as {
    processed?: number;
    total?: number;
    errors?: UploadError[];
  };

  return {
    status: mapJobState(state),
    processed: progress.processed ?? 0,
    total: progress.total ?? 0,
    errors: progress.errors ?? [],
  };
}

/** BullMQ 작업 상태를 API 상태로 매핑 */
function mapJobState(
  state: string,
): "pending" | "processing" | "completed" | "failed" {
  switch (state) {
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "active":
      return "processing";
    default:
      return "pending";
  }
}
