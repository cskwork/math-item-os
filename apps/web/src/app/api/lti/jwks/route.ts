// 이 플랫폼의 JWKS 엔드포인트 - 툴 서명 검증용 공개키 노출
import { NextResponse } from "next/server";
import { getToolJwks } from "@/server/services/lti.service";

export async function GET() {
  const jwks = getToolJwks();

  return NextResponse.json(jwks, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/json",
    },
  });
}
