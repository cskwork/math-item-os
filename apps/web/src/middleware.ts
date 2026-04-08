// Next.js 미들웨어 - Rate Limiting + CSRF 보호 + 보안 헤더
// 모든 API 요청에 적용되는 엣지 미들웨어
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// -------------------------------------------------
// Rate Limiting (인메모리, 엣지 런타임 호환)
// -------------------------------------------------

/** IP별 요청 카운트 (TTL: 60초) */
const rateLimitMap = new Map<
  string,
  { count: number; resetAt: number }
>();

/** 분당 최대 요청 수 */
const RATE_LIMIT_MAX = 100;
/** Rate limit 윈도우 (밀리초) */
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * IP 기반 rate limiting 검사.
 * 초과 시 true 반환.
 */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (entry == null || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

/** 오래된 엔트리 주기적 정리 (메모리 누수 방지) */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}

// 5분마다 정리 (엣지 런타임 제한으로 setInterval 대신 요청마다 확률적 실행)
let lastCleanup = Date.now();

// -------------------------------------------------
// CSRF 보호
// -------------------------------------------------

/** state-changing HTTP 메서드 */
const CSRF_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Origin/Referer 헤더로 CSRF 검증.
 * tRPC mutation은 POST로 전송되므로 POST 요청에 적용.
 */
function csrfCheck(request: NextRequest): boolean {
  if (!CSRF_METHODS.has(request.method)) {
    return true;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  if (host == null) return false;

  // origin 헤더가 있으면 호스트와 비교
  if (origin != null) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }

  // origin이 없으면 referer로 대체 검증
  if (referer != null) {
    try {
      const refererHost = new URL(referer).host;
      return refererHost === host;
    } catch {
      return false;
    }
  }

  // 둘 다 없으면 거부 (브라우저 요청은 항상 origin/referer 전송)
  return false;
}

// -------------------------------------------------
// 보안 헤더
// -------------------------------------------------

function addSecurityHeaders(response: NextResponse): void {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
}

// -------------------------------------------------
// 미들웨어 메인
// -------------------------------------------------

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API 라우트에만 보안 미들웨어 적용
  const isApi = pathname.startsWith("/api/");

  // 주기적 rate limit 맵 정리
  const now = Date.now();
  if (now - lastCleanup > 300_000) {
    cleanupExpiredEntries();
    lastCleanup = now;
  }

  if (isApi) {
    // Rate Limiting 검사
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    if (isRateLimited(ip)) {
      return new NextResponse(
        JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // CSRF 보호 (state-changing 요청)
    if (!csrfCheck(request)) {
      return new NextResponse(
        JSON.stringify({ error: "잘못된 요청 출처입니다." }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  const response = NextResponse.next();
  addSecurityHeaders(response);
  return response;
}

export const config = {
  matcher: [
    // API 라우트 + 페이지 (정적 파일 제외)
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
