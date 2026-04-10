// LTI 1.3 런치 콜백 엔드포인트
import { NextResponse } from "next/server";
import { handleLaunchCallback } from "@/server/services/lti.service";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const id_token = formData.get("id_token") as string | null;
    const state = formData.get("state") as string | null;

    if (!id_token || !state) {
      return NextResponse.json(
        { error: "id_token, state 필수" },
        { status: 400 },
      );
    }

    const launchData = await handleLaunchCallback({ id_token, state });

    // 런치 데이터의 target_link_uri나 기본 대시보드로 리다이렉트
    const targetUri =
      typeof launchData.ltiClaims.targetLinkUri === "string"
        ? launchData.ltiClaims.targetLinkUri
        : "/";

    const redirectUrl = new URL(targetUri, request.url);
    return NextResponse.redirect(redirectUrl.toString(), 302);
  } catch (err) {
    console.error("LTI launch callback failed:", err);
    return NextResponse.json({ error: "Launch callback failed" }, { status: 400 });
  }
}
