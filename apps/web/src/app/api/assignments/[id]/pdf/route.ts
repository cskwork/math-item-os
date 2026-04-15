import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { buildAssignmentHtmlById } from "@/server/services/pdf.service";

const DEFAULT_ORG_ID = "default-org";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const html = await buildAssignmentHtmlById(id, DEFAULT_ORG_ID);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "PDF 생성에 실패했습니다";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
