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
 * Judge0 CE�� synchronous 모드(wait=true) 사용.
 */
export async function executeCode(
  code: string,
  language: CodeLanguage,
  stdin?: string,
): Promise<ExecutionResult> {
  const judge0Url = getJudge0Url();
  const languageId = LANGUAGE_IDS[language];

  const response = await fetch(
    `${judge0Url}/submissions?base64_encoded=false&wait=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_code: code,
        language_id: languageId,
        stdin: stdin ?? "",
        cpu_time_limit: 5,
        memory_limit: 262144, // 256MB
        max_processes_and_or_threads: 5,
      }),
      signal: AbortSignal.timeout(15000), // 15초 HTTP 타임아웃
    },
  );

  if (!response.ok) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Judge0 API 오류: ${response.status} ${response.statusText}`,
    });
  }

  const data = await response.json();

  return {
    stdout: data.stdout,
    stderr: data.stderr,
    compileOutput: data.compile_output,
    status: {
      id: data.status?.id ?? 0,
      description: translateStatus(data.status?.id),
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

/** Judge0 상태 코드 → ���국어 메시지 */
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
