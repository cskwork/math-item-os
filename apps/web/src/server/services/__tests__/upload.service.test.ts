// upload.service 단위 테스트 (실 Prisma + BullMQ/fetch 모킹)
// startBulkUpload / getBulkUploadJobStatus 두 공개 API를 검증한다.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

// ─────────────────────────────────────────────
// 환경 변수
// ─────────────────────────────────────────────
const TEST_DB_URL =
  "postgresql://postgres:postgres@localhost:5432/mathitem_test?schema=public";
process.env.TEST_DATABASE_URL ??= TEST_DB_URL;
process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL ?? TEST_DB_URL;
process.env.DIRECT_URL ??= process.env.TEST_DATABASE_URL ?? TEST_DB_URL;

// ─────────────────────────────────────────────
// BullMQ 모킹: 큐는 메모리 stub, 워커는 실행하지 않음
// ─────────────────────────────────────────────
type FakeJob = {
  id: string;
  data: Record<string, unknown>;
  progress: { processed: number; total: number; errors: unknown[] };
  state: "waiting" | "active" | "completed" | "failed";
  updateProgress: (p: unknown) => Promise<void>;
  getState: () => Promise<string>;
};

const fakeJobs = new Map<string, FakeJob>();
let jobCounter = 0;

vi.mock("bullmq", () => {
  class Queue {
    constructor(_name: string, _opts: unknown) {}
    async add(_jobName: string, data: Record<string, unknown>): Promise<FakeJob> {
      const id = `fake-job-${++jobCounter}`;
      const job: FakeJob = {
        id,
        data,
        progress: { processed: 0, total: 0, errors: [] },
        state: "waiting",
        async updateProgress(p: unknown) {
          this.progress = p as FakeJob["progress"];
        },
        async getState() {
          return this.state;
        },
      };
      fakeJobs.set(id, job);
      return job;
    }
    async getJob(id: string): Promise<FakeJob | undefined> {
      return fakeJobs.get(id);
    }
  }
  class Worker {
    constructor(_name: string, _processor: unknown, _opts: unknown) {}
  }
  return { Queue, Worker };
});

// ─────────────────────────────────────────────
// fetch 모킹: 파일 다운로드를 인메모리 텍스트로 대체
// ─────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// item.service.createItem이 호출하는 외부 I/O 모킹
vi.mock("../conversion.service", () => ({
  convertLatex: vi.fn(async (latex: string) => ({
    mathml: null,
    sympy: null,
    html: `<span>${latex}</span>`,
    errors: [],
  })),
}));
vi.mock("../meilisearch.service", () => ({
  indexItem: vi.fn(async () => undefined),
  deleteItemFromIndex: vi.fn(async () => undefined),
  toMeilisearchDocument: vi.fn(),
}));

import { prisma } from "@math-item-os/db";
import { TRPCError } from "@trpc/server";
import { startBulkUpload, getBulkUploadJobStatus } from "../upload.service";

// ─────────────────────────────────────────────
// 시드
// ─────────────────────────────────────────────
const PREFIX = "test-upload-svc";
const ORG_ID = `${PREFIX}-org`;
const USER_ID = `${PREFIX}-user`;

const validCsv = [
  "bodyLatex,schoolLevel,grade,itemType,answerFormat,answerValue",
  "x+1=2,middle,7,short_answer,exact_value,1",
  "y-3=4,middle,7,short_answer,exact_value,7",
].join("\n");

const invalidCsv = "bodyLatex,schoolLevel\nonly-one-field,middle";

function fakeOk(text: string) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => text,
  };
}

beforeAll(async () => {
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    create: { id: ORG_ID, name: "Upload Test Org", slug: `${PREFIX}-slug` },
    update: {},
  });
});

beforeEach(async () => {
  fakeJobs.clear();
  jobCounter = 0;
  mockFetch.mockReset();
});

afterAll(async () => {
  // 테스트 중 생성된 items 정리
  const items = await prisma.item.findMany({ where: { orgId: ORG_ID } });
  const ids = items.map((i) => i.id);
  if (ids.length > 0) {
    await prisma.auditLog.deleteMany({ where: { recordId: { in: ids } } });
    await prisma.itemVersion.deleteMany({ where: { itemId: { in: ids } } });
    await prisma.item.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.auditLog.deleteMany({ where: { orgId: ORG_ID } });
  await prisma.organization.deleteMany({ where: { id: ORG_ID } });
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────

describe("startBulkUpload", () => {
  it("happy path: 유효한 CSV를 받아 jobId와 estimatedCount를 반환한다", async () => {
    mockFetch.mockResolvedValue(fakeOk(validCsv));

    const result = await startBulkUpload(
      { format: "csv", fileUrl: "https://fake/file.csv" },
      USER_ID,
      ORG_ID,
    );

    expect(result.estimatedCount).toBe(2);
    expect(result.jobId).toMatch(/^fake-job-/);
    // 큐에 잡이 등록됐는지
    expect(fakeJobs.size).toBe(1);
  });

  it("error path: 파일 다운로드 실패 시 BAD_REQUEST", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "",
    });

    await expect(
      startBulkUpload(
        { format: "csv", fileUrl: "https://fake/missing.csv" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrow(TRPCError);
  });

  it("edge case: 모든 행이 무효한 CSV는 파싱 실패로 BAD_REQUEST", async () => {
    mockFetch.mockResolvedValue(fakeOk(invalidCsv));

    await expect(
      startBulkUpload(
        { format: "csv", fileUrl: "https://fake/invalid.csv" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });

  it("edge case: 유효하지 않은 JSON 형식 (배열 아님) → BAD_REQUEST", async () => {
    mockFetch.mockResolvedValue(fakeOk('{"not":"array"}'));

    await expect(
      startBulkUpload(
        { format: "json", fileUrl: "https://fake/object.json" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });
});

describe("getBulkUploadJobStatus", () => {
  it("error path: 존재하지 않는 jobId면 NOT_FOUND", async () => {
    await expect(
      getBulkUploadJobStatus("does-not-exist"),
    ).rejects.toThrow(TRPCError);
  });

  it("happy path: 큐에 등록된 작업을 조회하면 진행률을 반환한다", async () => {
    mockFetch.mockResolvedValue(fakeOk(validCsv));
    const start = await startBulkUpload(
      { format: "csv", fileUrl: "https://fake/file.csv" },
      USER_ID,
      ORG_ID,
    );

    // 큐에 등록된 fakeJob의 progress를 강제로 갱신해 놓고 조회
    const job = fakeJobs.get(start.jobId)!;
    job.progress = { processed: 1, total: 2, errors: [] };
    job.state = "active";

    const status = await getBulkUploadJobStatus(start.jobId);
    expect(status.status).toBe("processing");
    expect(status.processed).toBe(1);
    expect(status.total).toBe(2);
  });

  it("completed 상태 매핑: job.state='completed' → status='completed'", async () => {
    mockFetch.mockResolvedValue(fakeOk(validCsv));
    const start = await startBulkUpload(
      { format: "csv", fileUrl: "https://fake/file.csv" },
      USER_ID,
      ORG_ID,
    );
    const job = fakeJobs.get(start.jobId)!;
    job.state = "completed";
    job.progress = { processed: 2, total: 2, errors: [] };

    const status = await getBulkUploadJobStatus(start.jobId);
    expect(status.status).toBe("completed");
  });

  it("failed 상태 매핑: job.state='failed' → status='failed'", async () => {
    mockFetch.mockResolvedValue(fakeOk(validCsv));
    const start = await startBulkUpload(
      { format: "csv", fileUrl: "https://fake/file.csv" },
      USER_ID,
      ORG_ID,
    );
    const job = fakeJobs.get(start.jobId)!;
    job.state = "failed";

    const status = await getBulkUploadJobStatus(start.jobId);
    expect(status.status).toBe("failed");
  });

  it("waiting 상태 매핑: job.state='waiting' → status='pending'", async () => {
    mockFetch.mockResolvedValue(fakeOk(validCsv));
    const start = await startBulkUpload(
      { format: "csv", fileUrl: "https://fake/file.csv" },
      USER_ID,
      ORG_ID,
    );
    const job = fakeJobs.get(start.jobId)!;
    job.state = "waiting";

    const status = await getBulkUploadJobStatus(start.jobId);
    expect(status.status).toBe("pending");
  });

  it("progress가 비어있으면 기본값 (0, 0, [])을 반환한다", async () => {
    mockFetch.mockResolvedValue(fakeOk(validCsv));
    const start = await startBulkUpload(
      { format: "csv", fileUrl: "https://fake/file.csv" },
      USER_ID,
      ORG_ID,
    );
    const job = fakeJobs.get(start.jobId)!;
    job.progress = {} as FakeJob["progress"];

    const status = await getBulkUploadJobStatus(start.jobId);
    expect(status.processed).toBe(0);
    expect(status.total).toBe(0);
    expect(status.errors).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// JSON 파서 테스트
// ─────────────────────────────────────────────

describe("startBulkUpload - JSON format", () => {
  it("유효한 JSON 배열을 파싱하여 jobId를 반환한다", async () => {
    const validJson = JSON.stringify([
      {
        bodyLatex: "x + 1 = 2",
        schoolLevel: "middle",
        grade: 7,
        itemType: "short_answer",
        answerFormat: "exact_value",
        answer: { value: "1", format: "exact_value" },
      },
    ]);
    mockFetch.mockResolvedValue(fakeOk(validJson));

    const result = await startBulkUpload(
      { format: "json", fileUrl: "https://fake/valid.json" },
      USER_ID,
      ORG_ID,
    );
    expect(result.estimatedCount).toBe(1);
    expect(result.jobId).toMatch(/^fake-job-/);
  });

  it("유효하지 않은 JSON 문자열(파싱 실패) → BAD_REQUEST", async () => {
    mockFetch.mockResolvedValue(fakeOk("{invalid json"));

    await expect(
      startBulkUpload(
        { format: "json", fileUrl: "https://fake/bad.json" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });

  it("JSON 항목에 bodyLatex가 없으면 에러 행으로 분류", async () => {
    const jsonWithMissing = JSON.stringify([
      {
        schoolLevel: "middle",
        itemType: "short_answer",
        answerFormat: "exact_value",
        answer: { value: "1" },
      },
    ]);
    mockFetch.mockResolvedValue(fakeOk(jsonWithMissing));

    await expect(
      startBulkUpload(
        { format: "json", fileUrl: "https://fake/missing.json" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });

  it("JSON 항목에 answer 객체가 없으면 에러 행으로 분류", async () => {
    const jsonNoAnswer = JSON.stringify([
      {
        bodyLatex: "x = 1",
        schoolLevel: "middle",
        itemType: "short_answer",
        answerFormat: "exact_value",
      },
    ]);
    mockFetch.mockResolvedValue(fakeOk(jsonNoAnswer));

    await expect(
      startBulkUpload(
        { format: "json", fileUrl: "https://fake/noanswer.json" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });

  it("JSON 항목이 객체가 아닌 경우(숫자 등) 에러 행으로 분류", async () => {
    const jsonNonObject = JSON.stringify([42, "string", null]);
    mockFetch.mockResolvedValue(fakeOk(jsonNonObject));

    await expect(
      startBulkUpload(
        { format: "json", fileUrl: "https://fake/nonobj.json" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });

  it("JSON 항목에 유효하지 않은 schoolLevel 에러", async () => {
    const json = JSON.stringify([
      {
        bodyLatex: "x=1",
        schoolLevel: "invalid",
        itemType: "short_answer",
        answerFormat: "exact_value",
        answer: { value: "1" },
      },
    ]);
    mockFetch.mockResolvedValue(fakeOk(json));

    await expect(
      startBulkUpload(
        { format: "json", fileUrl: "https://fake/badlevel.json" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });

  it("JSON 항목에 유효하지 않은 itemType 에러", async () => {
    const json = JSON.stringify([
      {
        bodyLatex: "x=1",
        schoolLevel: "middle",
        itemType: "invalid_type",
        answerFormat: "exact_value",
        answer: { value: "1" },
      },
    ]);
    mockFetch.mockResolvedValue(fakeOk(json));

    await expect(
      startBulkUpload(
        { format: "json", fileUrl: "https://fake/badtype.json" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });

  it("JSON 항목에 유효하지 않은 answerFormat 에러", async () => {
    const json = JSON.stringify([
      {
        bodyLatex: "x=1",
        schoolLevel: "middle",
        itemType: "short_answer",
        answerFormat: "invalid_format",
        answer: { value: "1" },
      },
    ]);
    mockFetch.mockResolvedValue(fakeOk(json));

    await expect(
      startBulkUpload(
        { format: "json", fileUrl: "https://fake/badfmt.json" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });
});

// ─────────────────────────────────────────────
// QTI 파서 테스트
// ─────────────────────────────────────────────

describe("startBulkUpload - QTI format", () => {
  it("유효한 QTI XML을 파싱하여 jobId를 반환한다", async () => {
    const validQti = `
      <assessmentItem>
        <itemBody>
          <math>x + 1 = 2</math>
        </itemBody>
        <correctResponse>
          <value>1</value>
        </correctResponse>
      </assessmentItem>
    `;
    mockFetch.mockResolvedValue(fakeOk(validQti));

    const result = await startBulkUpload(
      { format: "qti", fileUrl: "https://fake/valid.qti" },
      USER_ID,
      ORG_ID,
    );
    expect(result.estimatedCount).toBe(1);
    expect(result.jobId).toMatch(/^fake-job-/);
  });

  it("assessmentItem이 없는 QTI → BAD_REQUEST", async () => {
    mockFetch.mockResolvedValue(fakeOk("<quiz></quiz>"));

    await expect(
      startBulkUpload(
        { format: "qti", fileUrl: "https://fake/empty.qti" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });

  it("QTI simpleChoice가 있으면 multiple_choice 유형으로 파싱된다", async () => {
    const qtiWithChoices = `
      <assessmentItem>
        <itemBody>
          <p>2 + 2 = ?</p>
          <simpleChoice identifier="A">3</simpleChoice>
          <simpleChoice identifier="B">4</simpleChoice>
        </itemBody>
        <correctResponse>
          <value>B</value>
        </correctResponse>
      </assessmentItem>
    `;
    mockFetch.mockResolvedValue(fakeOk(qtiWithChoices));

    const result = await startBulkUpload(
      { format: "qti", fileUrl: "https://fake/mc.qti" },
      USER_ID,
      ORG_ID,
    );
    expect(result.estimatedCount).toBe(1);
  });

  it("QTI itemBody가 없으면 본문을 추출할 수 없어 에러 행", async () => {
    const qtiNoBody = `
      <assessmentItem>
        <correctResponse><value>1</value></correctResponse>
      </assessmentItem>
    `;
    mockFetch.mockResolvedValue(fakeOk(qtiNoBody));

    await expect(
      startBulkUpload(
        { format: "qti", fileUrl: "https://fake/nobody.qti" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });

  it("여러 assessmentItem이 있는 QTI를 정상 파싱", async () => {
    const multiQti = `
      <assessmentItem>
        <itemBody><p>Q1</p></itemBody>
        <correctResponse><value>A</value></correctResponse>
      </assessmentItem>
      <assessmentItem>
        <itemBody><p>Q2</p></itemBody>
        <correctResponse><value>B</value></correctResponse>
      </assessmentItem>
    `;
    mockFetch.mockResolvedValue(fakeOk(multiQti));

    const result = await startBulkUpload(
      { format: "qti", fileUrl: "https://fake/multi.qti" },
      USER_ID,
      ORG_ID,
    );
    expect(result.estimatedCount).toBe(2);
  });
});

// ─────────────────────────────────────────────
// CSV 파서 고급 테스트
// ─────────────────────────────────────────────

describe("startBulkUpload - CSV advanced", () => {
  it("쌍따옴표로 감싼 필드를 올바르게 파싱한다", async () => {
    const csvWithQuotes = [
      "bodyLatex,schoolLevel,grade,itemType,answerFormat,answerValue",
      '"x + 1 = 2, solve",middle,7,short_answer,exact_value,1',
    ].join("\n");
    mockFetch.mockResolvedValue(fakeOk(csvWithQuotes));

    const result = await startBulkUpload(
      { format: "csv", fileUrl: "https://fake/quotes.csv" },
      USER_ID,
      ORG_ID,
    );
    expect(result.estimatedCount).toBe(1);
  });

  it("빈 CSV (헤더만 있음)는 items=0으로 BAD_REQUEST", async () => {
    const headerOnly = "bodyLatex,schoolLevel,grade,itemType,answerFormat,answerValue";
    mockFetch.mockResolvedValue(fakeOk(headerOnly));

    // 헤더만 있으면 items=0 + errors=1 (헤더와 데이터 필요)
    // 실제로는 items.length=0이고 errors도 비어있으면 빈 줄만 파싱 -> items=0
    // parseCsv에서 lines < 2 -> error
    await expect(
      startBulkUpload(
        { format: "csv", fileUrl: "https://fake/headeronly.csv" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });

  it("optional 필드(semester, formulaType 등)가 있는 CSV를 파싱한다", async () => {
    const csvWithOptionals = [
      "bodyLatex,schoolLevel,grade,itemType,answerFormat,answerValue,semester,formulaType,difficultyAuthor,solutionSteps,skillIds,standardIds,misconceptionIds,usagePurposes,passageId",
      "x=1,middle,7,short_answer,exact_value,1,first,inline,3,2,sk1;sk2,std1,mc1;mc2,diagnostic;practice,p1",
    ].join("\n");
    mockFetch.mockResolvedValue(fakeOk(csvWithOptionals));

    const result = await startBulkUpload(
      { format: "csv", fileUrl: "https://fake/optionals.csv" },
      USER_ID,
      ORG_ID,
    );
    expect(result.estimatedCount).toBe(1);
  });

  it("유효하지 않은 schoolLevel이면 에러 행으로 분류", async () => {
    const badLevel = [
      "bodyLatex,schoolLevel,grade,itemType,answerFormat,answerValue",
      "x=1,university,7,short_answer,exact_value,1",
    ].join("\n");
    mockFetch.mockResolvedValue(fakeOk(badLevel));

    await expect(
      startBulkUpload(
        { format: "csv", fileUrl: "https://fake/badlevel.csv" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });

  it("유효하지 않은 grade(13)이면 에러 행으로 분류", async () => {
    const badGrade = [
      "bodyLatex,schoolLevel,grade,itemType,answerFormat,answerValue",
      "x=1,middle,13,short_answer,exact_value,1",
    ].join("\n");
    mockFetch.mockResolvedValue(fakeOk(badGrade));

    await expect(
      startBulkUpload(
        { format: "csv", fileUrl: "https://fake/badgrade.csv" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });

  it("유효하지 않은 grade(0)이면 에러 행으로 분류", async () => {
    const badGrade = [
      "bodyLatex,schoolLevel,grade,itemType,answerFormat,answerValue",
      "x=1,middle,0,short_answer,exact_value,1",
    ].join("\n");
    mockFetch.mockResolvedValue(fakeOk(badGrade));

    await expect(
      startBulkUpload(
        { format: "csv", fileUrl: "https://fake/badgrade0.csv" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });

  it("grade가 숫자가 아니면 에러 행으로 분류", async () => {
    const badGrade = [
      "bodyLatex,schoolLevel,grade,itemType,answerFormat,answerValue",
      "x=1,middle,abc,short_answer,exact_value,1",
    ].join("\n");
    mockFetch.mockResolvedValue(fakeOk(badGrade));

    await expect(
      startBulkUpload(
        { format: "csv", fileUrl: "https://fake/nangrade.csv" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });

  it("bodyLatex가 비어있으면 에러 행으로 분류", async () => {
    const emptyBody = [
      "bodyLatex,schoolLevel,grade,itemType,answerFormat,answerValue",
      ",middle,7,short_answer,exact_value,1",
    ].join("\n");
    mockFetch.mockResolvedValue(fakeOk(emptyBody));

    await expect(
      startBulkUpload(
        { format: "csv", fileUrl: "https://fake/emptybody.csv" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });

  it("유효하지 않은 itemType이면 에러 행으로 분류", async () => {
    const badType = [
      "bodyLatex,schoolLevel,grade,itemType,answerFormat,answerValue",
      "x=1,middle,7,unknown_type,exact_value,1",
    ].join("\n");
    mockFetch.mockResolvedValue(fakeOk(badType));

    await expect(
      startBulkUpload(
        { format: "csv", fileUrl: "https://fake/badtype.csv" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });

  it("유효하지 않은 answerFormat이면 에러 행으로 분류", async () => {
    const badFmt = [
      "bodyLatex,schoolLevel,grade,itemType,answerFormat,answerValue",
      "x=1,middle,7,short_answer,bad_format,1",
    ].join("\n");
    mockFetch.mockResolvedValue(fakeOk(badFmt));

    await expect(
      startBulkUpload(
        { format: "csv", fileUrl: "https://fake/badfmt.csv" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrowError(/파싱/);
  });

  it("빈 줄은 건너뛴다", async () => {
    const csvWithBlanks = [
      "bodyLatex,schoolLevel,grade,itemType,answerFormat,answerValue",
      "x=1,middle,7,short_answer,exact_value,1",
      "",
      "y=2,middle,7,short_answer,exact_value,2",
      "   ",
    ].join("\n");
    mockFetch.mockResolvedValue(fakeOk(csvWithBlanks));

    const result = await startBulkUpload(
      { format: "csv", fileUrl: "https://fake/blanks.csv" },
      USER_ID,
      ORG_ID,
    );
    expect(result.estimatedCount).toBe(2);
  });

  it("이스케이프된 쌍따옴표를 올바르게 처리한다", async () => {
    const csvEscaped = [
      "bodyLatex,schoolLevel,grade,itemType,answerFormat,answerValue",
      '"She said ""hello""",middle,7,short_answer,exact_value,1',
    ].join("\n");
    mockFetch.mockResolvedValue(fakeOk(csvEscaped));

    const result = await startBulkUpload(
      { format: "csv", fileUrl: "https://fake/escaped.csv" },
      USER_ID,
      ORG_ID,
    );
    expect(result.estimatedCount).toBe(1);
  });

  it("유효하지 않은 semester는 무시된다 (에러가 아님)", async () => {
    const csvBadSemester = [
      "bodyLatex,schoolLevel,grade,itemType,answerFormat,answerValue,semester",
      "x=1,middle,7,short_answer,exact_value,1,third",
    ].join("\n");
    mockFetch.mockResolvedValue(fakeOk(csvBadSemester));

    const result = await startBulkUpload(
      { format: "csv", fileUrl: "https://fake/badsem.csv" },
      USER_ID,
      ORG_ID,
    );
    // semester가 유효하지 않으면 무시되고 문항은 정상 파싱됨
    expect(result.estimatedCount).toBe(1);
  });

  it("유효하지 않은 formulaType은 무시된다 (에러가 아님)", async () => {
    const csvBadFormula = [
      "bodyLatex,schoolLevel,grade,itemType,answerFormat,answerValue,formulaType",
      "x=1,middle,7,short_answer,exact_value,1,invalid_formula",
    ].join("\n");
    mockFetch.mockResolvedValue(fakeOk(csvBadFormula));

    const result = await startBulkUpload(
      { format: "csv", fileUrl: "https://fake/badformula.csv" },
      USER_ID,
      ORG_ID,
    );
    expect(result.estimatedCount).toBe(1);
  });
});
