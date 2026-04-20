// 코드 실행 서비스 — Judge0 CE 연동
import { TRPCError } from "@trpc/server";
import type { CodeLanguage } from "@math-item-os/db";

/** Judge0 언어 ID 매핑 */
const LANGUAGE_IDS: Record<CodeLanguage, number> = {
  C: 50,       // GCC 9.2.0
  JAVA: 62,    // OpenJDK 13.0.1
  PYTHON: 71,  // Python 3.8.1
  SQL: 82,     // SQLite 3.27.2
};

/** 실행 결과 */
export interface ExecutionResult {
  readonly stdout: string | null;
  readonly stderr: string | null;
  readonly compileOutput: string | null;
  readonly status: { id: number; description: string };
  readonly time: string | null;
  readonly memory: number | null;
}

// -------------------------------------------------
// Rate Limiter (인메모리, 사용자당 분당 10회 제한)
// -------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `코드 실행 요청이 너무 많습니다. ${Math.ceil((entry.resetAt - now) / 1000)}초 후 다시 시도하세요.`,
    });
  }

  rateLimitMap.set(userId, { count: entry.count + 1, resetAt: entry.resetAt });
}

// -------------------------------------------------
// Judge0 API
// -------------------------------------------------

/** Judge0 API URL */
function getJudge0Url(): string {
  const url = process.env.JUDGE0_API_URL;
  if (!url) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "JUDGE0_API_URL 환경 변수가 설정되지 않았습니다",
    });
  }
  return url;
}

/**
 * 코드를 실행하고 결과를 반환한다.
 * Judge0 CE synchronous 모드(wait=true) 사용.
 * 사용자당 분당 10회 rate limit 적용.
 */
export async function executeCode(
  code: string,
  language: CodeLanguage,
  userId: string,
  stdin?: string,
): Promise<ExecutionResult> {
  checkRateLimit(userId);

  const judge0Url = getJudge0Url();
  const languageId = LANGUAGE_IDS[language];

  let response: Response;
  try {
    response = await fetch(
      `${judge0Url}/submissions?base64_encoded=false&wait=true`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_code: code,
          language_id: languageId,
          stdin: stdin ?? "",
          cpu_time_limit: 5,
          memory_limit: 131072, // 128MB (더 보수적)
          max_processes_and_or_threads: 3,
          // cgroups v2 호스트(Ubuntu 24.04+)에서 isolate가 --cg 플래그로 실패하므로
          // per-process 제한을 활성화하여 cgroups 비사용 경로로 실행한다.
          enable_per_process_and_thread_time_limit: true,
          enable_per_process_and_thread_memory_limit: true,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch (error) {
    console.error("[code-execution] Judge0 fetch failed:", {
      url: judge0Url,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, cause: error.cause }
          : error,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Judge0 연결 실패: ${
        error instanceof Error ? error.message : String(error)
      }`,
      cause: error,
    });
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "<unreadable>");
    console.error("[code-execution] Judge0 returned non-OK:", {
      status: response.status,
      statusText: response.statusText,
      body: bodyText.slice(0, 500),
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Judge0 API 오류: ${response.status} ${response.statusText}`,
    });
  }

  let data: {
    stdout: string | null;
    stderr: string | null;
    compile_output: string | null;
    status?: { id: number };
    time: string | null;
    memory: number | null;
  };
  try {
    data = await response.json();
  } catch (error) {
    console.error("[code-execution] Judge0 response not JSON:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Judge0 응답 파싱 실패",
      cause: error,
    });
  }

  return {
    stdout: data.stdout,
    stderr: data.stderr,
    compileOutput: data.compile_output,
    status: {
      id: data.status?.id ?? 0,
      description: translateStatus(data.status?.id ?? 0),
    },
    time: data.time,
    memory: data.memory,
  };
}

/** 지원 언어 목록 반환 */
export function getSupportedLanguages() {
  return [
    { value: "C" as const, label: "C (GCC 9.2.0)", id: 50 },
    { value: "JAVA" as const, label: "Java (OpenJDK 13)", id: 62 },
    { value: "PYTHON" as const, label: "Python (3.8.1)", id: 71 },
    { value: "SQL" as const, label: "SQLite (3.27.2)", id: 82 },
  ];
}

/** Judge0 상태 코드 한국어 매핑 */
function translateStatus(statusId: number): string {
  switch (statusId) {
    case 1: return "대기열에 있음";
    case 2: return "처리 중";
    case 3: return "성공";
    case 4: return "오답";
    case 5: return "시간 초과";
    case 6: return "컴파일 오류";
    case 7: case 8: case 9: case 10: case 11: case 12:
      return "런타임 오류";
    case 13: return "내부 오류";
    case 14: return "실행 형식 오류";
    default: return "알 수 없음";
  }
}
