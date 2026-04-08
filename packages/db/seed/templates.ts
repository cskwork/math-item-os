// 시드 데이터: 예시 템플릿
// 중학교 수학 기본 템플릿 6개 (SymPy 4개 + LLM 2개)
import type { PrismaClient, Prisma } from "@prisma/client";

/** 프리셋 시드 데이터 (template-presets.ts와 동일한 내용) */
const SEED_TEMPLATES = [
  {
    title: "일차방정식 기본형",
    bodyTemplate: "{{a}}x + {{b}} = {{c}}",
    parameters: [
      { name: "a", type: "integer", min: 1, max: 9, constraints: ["nonzero"] },
      { name: "b", type: "integer", min: -10, max: 10, constraints: [] },
      { name: "c", type: "integer", min: -20, max: 20, constraints: [] },
    ],
    answerTemplate: "({{c}} - {{b}}) / {{a}}",
    constraints: { integer_solution: true, no_zero_denominator: true },
  },
  {
    title: "이차방정식 (인수분해형)",
    bodyTemplate: "x^2 + {{b}}x + {{c}} = 0",
    parameters: [
      { name: "b", type: "integer", min: -10, max: 10, constraints: [] },
      { name: "c", type: "integer", min: -20, max: 20, constraints: [] },
    ],
    answerTemplate: "(-{{b}} + sqrt({{b}}^2 - 4*{{c}})) / 2",
    constraints: { integer_solution: true },
  },
  {
    title: "일차부등식",
    bodyTemplate: "{{a}}x - {{b}} < {{c}}",
    parameters: [
      { name: "a", type: "integer", min: 1, max: 8, constraints: ["positive"] },
      { name: "b", type: "integer", min: 1, max: 15, constraints: ["positive"] },
      { name: "c", type: "integer", min: 1, max: 20, constraints: ["positive"] },
    ],
    answerTemplate: "x < ({{c}} + {{b}}) / {{a}}",
    constraints: { no_zero_denominator: true },
  },
  {
    title: "연립방정식 (2원1차)",
    bodyTemplate:
      "\\begin{cases} {{a1}}x + {{b1}}y = {{c1}} \\\\ {{a2}}x + {{b2}}y = {{c2}} \\end{cases}",
    parameters: [
      { name: "a1", type: "integer", min: 1, max: 5, constraints: ["nonzero"] },
      { name: "b1", type: "integer", min: -5, max: 5, constraints: ["nonzero"] },
      { name: "c1", type: "integer", min: -10, max: 10, constraints: [] },
      { name: "a2", type: "integer", min: 1, max: 5, constraints: ["nonzero"] },
      { name: "b2", type: "integer", min: -5, max: 5, constraints: ["nonzero"] },
      { name: "c2", type: "integer", min: -10, max: 10, constraints: [] },
    ],
    answerTemplate:
      "({{c1}}*{{b2}} - {{c2}}*{{b1}}) / ({{a1}}*{{b2}} - {{a2}}*{{b1}})",
    constraints: { integer_solution: true, no_zero_denominator: true },
  },
  {
    title: "피타고라스 정리 응용",
    bodyTemplate:
      "직각삼각형의 두 변의 길이가 주어졌을 때, 나머지 한 변의 길이를 구하시오.",
    parameters: [],
    answerTemplate: "",
    constraints: {},
  },
  {
    title: "확률 기본 (경우의 수)",
    bodyTemplate:
      "주머니에 빨간 구슬과 파란 구슬이 들어있다. 무작위로 하나를 꺼낼 때 특정 색 구슬이 나올 확률을 구하시오.",
    parameters: [],
    answerTemplate: "",
    constraints: {},
  },
] as const;

/** 예시 템플릿 시딩 (멱등: title 기준 upsert) */
export async function seedTemplates(prisma: PrismaClient, orgId: string) {
  let created = 0;
  let skipped = 0;

  for (const tpl of SEED_TEMPLATES) {
    const existing = await prisma.template.findFirst({
      where: { orgId, title: tpl.title },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.template.create({
      data: {
        orgId,
        title: tpl.title,
        bodyTemplate: tpl.bodyTemplate,
        parameters: tpl.parameters as unknown as Prisma.InputJsonValue,
        answerTemplate: tpl.answerTemplate,
        constraints: tpl.constraints as unknown as Prisma.InputJsonValue,
      },
    });
    created++;
  }

  console.log(`  [템플릿] 생성: ${created}개, 건너뜀: ${skipped}개`);
}
