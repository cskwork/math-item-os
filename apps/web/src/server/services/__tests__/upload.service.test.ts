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
});
