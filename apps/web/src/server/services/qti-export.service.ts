// QTI 3.0 내보내기 서비스 - 내부 문항을 QTI 3.0 XML로 변환
import { TRPCError } from "@trpc/server";
import { prisma } from "@math-item-os/db";

// -------------------------------------------------
// 타입 정의
// -------------------------------------------------

interface QtiChoice {
  readonly label: string;
  readonly latex: string;
  readonly isCorrect: boolean;
}

interface QtiAnswer {
  readonly value: string;
  readonly format?: string;
}

interface QtiItem {
  readonly id: string;
  readonly bodyLatex: string;
  readonly bodyMathml: string | null;
  readonly choices: unknown;
  readonly answer: unknown;
  readonly schoolLevel: string;
  readonly grade: number;
  readonly itemType: string;
}

// -------------------------------------------------
// XML 이스케이프
// -------------------------------------------------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// -------------------------------------------------
// 학교급 한국어 라벨
// -------------------------------------------------

const SCHOOL_LEVEL_LABEL: Record<string, string> = {
  elementary: "초등",
  middle: "중등",
  high: "고등",
};

// -------------------------------------------------
// 선택지 파싱
// -------------------------------------------------

function parseChoices(raw: unknown): QtiChoice[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c) =>
      c != null &&
      typeof c === "object" &&
      typeof c.label === "string" &&
      typeof c.latex === "string" &&
      typeof c.isCorrect === "boolean",
  ) as QtiChoice[];
}

function parseAnswer(raw: unknown): QtiAnswer {
  if (raw != null && typeof raw === "object" && "value" in raw) {
    const obj = raw as Record<string, unknown>;
    return {
      value: String(obj.value ?? ""),
      format: typeof obj.format === "string" ? obj.format : undefined,
    };
  }
  return { value: String(raw ?? "") };
}

// -------------------------------------------------
// 본문 콘텐츠 생성 (MathML 우선, LaTeX 폴백)
// -------------------------------------------------

function buildBodyContent(item: QtiItem): string {
  if (item.bodyMathml) {
    return `    <p><![CDATA[${item.bodyMathml}]]></p>`;
  }
  return `    <p><pre>${escapeXml(item.bodyLatex)}</pre></p>`;
}

// -------------------------------------------------
// 문항 유형별 QTI interaction 생성
// -------------------------------------------------

interface InteractionResult {
  readonly responseDecl: string;
  readonly interaction: string;
}

function buildResponseDeclaration(
  baseType: string,
  correctValue: string,
): string {
  const valueEl = correctValue
    ? `\n      <qti-value>${escapeXml(correctValue)}</qti-value>`
    : "";
  const correctResp = correctValue
    ? `\n    <qti-correct-response>${valueEl}\n    </qti-correct-response>`
    : "";
  return `  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="${baseType}">${correctResp}\n  </qti-response-declaration>`;
}

function buildInteraction(item: QtiItem): InteractionResult {
  const answer = parseAnswer(item.answer);

  switch (item.itemType) {
    case "multiple_choice": {
      const choices = parseChoices(item.choices);
      const correctLabel =
        choices.find((c) => c.isCorrect)?.label ?? answer.value;
      const choiceXml = choices
        .map(
          (c) =>
            `      <qti-simple-choice identifier="${escapeXml(c.label)}">${escapeXml(c.latex)}</qti-simple-choice>`,
        )
        .join("\n");
      return {
        responseDecl: buildResponseDeclaration("identifier", correctLabel),
        interaction: `    <qti-choice-interaction response-identifier="RESPONSE" shuffle="false" max-choices="1">\n${choiceXml}\n    </qti-choice-interaction>`,
      };
    }

    case "true_false": {
      const correctValue = answer.value.toLowerCase() === "true" ? "TRUE" : "FALSE";
      return {
        responseDecl: buildResponseDeclaration("identifier", correctValue),
        interaction: `    <qti-choice-interaction response-identifier="RESPONSE" shuffle="false" max-choices="1">
      <qti-simple-choice identifier="TRUE">참</qti-simple-choice>
      <qti-simple-choice identifier="FALSE">거짓</qti-simple-choice>
    </qti-choice-interaction>`,
      };
    }

    case "short_answer":
    case "fill_in_blank": {
      return {
        responseDecl: buildResponseDeclaration("string", answer.value),
        interaction: `    <qti-text-entry-interaction response-identifier="RESPONSE" expected-length="20" />`,
      };
    }

    case "essay": {
      return {
        responseDecl: buildResponseDeclaration("string", ""),
        interaction: `    <qti-extended-text-interaction response-identifier="RESPONSE" expected-lines="10" />`,
      };
    }

    default: {
      return {
        responseDecl: buildResponseDeclaration("string", answer.value),
        interaction: `    <qti-text-entry-interaction response-identifier="RESPONSE" expected-length="20" />`,
      };
    }
  }
}

// -------------------------------------------------
// 단일 문항 QTI 3.0 XML 변환
// -------------------------------------------------

function itemToQtiXml(item: QtiItem): string {
  const levelLabel = SCHOOL_LEVEL_LABEL[item.schoolLevel] ?? item.schoolLevel;
  const title = `${levelLabel} ${item.grade}학년`;

  const result = buildInteraction(item);
  const bodyContent = buildBodyContent(item);

  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="item-${escapeXml(item.id)}" title="${escapeXml(title)}"
  adaptive="false" time-dependent="false">
${result.responseDecl}
  <qti-item-body>
${bodyContent}
${result.interaction}
  </qti-item-body>
</qti-assessment-item>`;
}

// -------------------------------------------------
// 공개 API
// -------------------------------------------------

/** 단일 문항을 QTI 3.0 XML로 변환한다. */
export async function exportItemToQti(itemId: string, orgId: string) {
  const item = await prisma.item.findFirst({
    where: { id: itemId, orgId },
    select: {
      id: true,
      bodyLatex: true,
      bodyMathml: true,
      choices: true,
      answer: true,
      schoolLevel: true,
      grade: true,
      itemType: true,
    },
  });

  if (!item) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "문항을 찾을 수 없습니다",
    });
  }

  return { xml: itemToQtiXml(item) };
}

/** 학습지 전체를 QTI 콘텐츠 패키지로 변환한다. */
export async function exportAssignmentToQtiPackage(
  assignmentId: string,
  orgId: string,
) {
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, orgId },
    include: {
      items: {
        include: {
          item: {
            select: {
              id: true,
              bodyLatex: true,
              bodyMathml: true,
              choices: true,
              answer: true,
              schoolLevel: true,
              grade: true,
              itemType: true,
            },
          },
        },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!assignment) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "학습지를 찾을 수 없습니다",
    });
  }

  // 각 문항 XML 생성
  const items = assignment.items.map((ai, idx) => ({
    filename: `item-${idx + 1}.xml`,
    xml: itemToQtiXml(ai.item),
  }));

  // imsmanifest.xml 생성
  const resourceEntries = items
    .map(
      (entry) =>
        `    <resource identifier="res-${entry.filename.replace(".xml", "")}" type="imsqti_item_xmlv3p0" href="${entry.filename}">
      <file href="${entry.filename}" />
    </resource>`,
    )
    .join("\n");

  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  identifier="manifest-${escapeXml(assignment.id)}">
  <metadata>
    <schema>QTI Content Package</schema>
    <schemaversion>3.0</schemaversion>
  </metadata>
  <organizations />
  <resources>
${resourceEntries}
  </resources>
</manifest>`;

  return { manifest, items };
}
