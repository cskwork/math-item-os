// LTI 1.3 OIDC 로그인 개시 엔드포인트
import { NextResponse } from "next/server";
import { handleOidcLogin } from "@/server/services/lti.service";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const iss = formData.get("iss") as string | null;
    const login_hint = formData.get("login_hint") as string | null;
    const target_link_uri = formData.get("target_link_uri") as string | null;
    const lti_message_hint = formData.get("lti_message_hint") as string | null;

    if (!iss || !login_hint || !target_link_uri) {
      return NextResponse.json(
        { error: "iss, login_hint, target_link_uri 필수" },
        { status: 400 },
      );
    }

    const { redirectUrl } = await handleOidcLogin({
      iss,
      login_hint,
      target_link_uri,
      lti_message_hint: lti_message_hint ?? undefined,
    });

    return NextResponse.redirect(redirectUrl, 302);
  } catch (err) {
    const message = err instanceof Error ? err.message : "LTI 로그인 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
