-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "ltree";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "SchoolLevel" AS ENUM ('elementary', 'middle', 'high');

-- CreateEnum
CREATE TYPE "SemesterType" AS ENUM ('first', 'second');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('multiple_choice', 'short_answer', 'essay', 'fill_in_blank', 'true_false');

-- CreateEnum
CREATE TYPE "FormulaType" AS ENUM ('inline', 'display', 'mixed', 'none');

-- CreateEnum
CREATE TYPE "AnswerFormat" AS ENUM ('exact_value', 'expression', 'multiple_choice', 'range', 'set');

-- CreateEnum
CREATE TYPE "QualityStatus" AS ENUM ('draft', 'reviewed', 'approved', 'retired');

-- CreateEnum
CREATE TYPE "UsagePurpose" AS ENUM ('diagnosis', 'remediation', 'pre_exam', 'advanced', 'practice', 'review');

-- CreateEnum
CREATE TYPE "EdgeStrength" AS ENUM ('strong', 'weak');

-- CreateEnum
CREATE TYPE "SolutionMethod" AS ENUM ('standard', 'alternative', 'visual', 'shortcut');

-- CreateEnum
CREATE TYPE "RecType" AS ENUM ('remediation', 'advancement', 'practice', 'review');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete', 'approve', 'retire', 'generate', 'assign');

-- CreateEnum
CREATE TYPE "ReviewTaskType" AS ENUM ('tag_review', 'generation_review', 'duplicate_review', 'explanation_error');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'in_progress', 'completed', 'rejected');

-- CreateEnum
CREATE TYPE "AssignmentPurpose" AS ENUM ('diagnosis', 'remediation', 'pre_exam', 'advanced');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'reviewer', 'teacher');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'teacher',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "passageId" TEXT,
    "bodyLatex" TEXT NOT NULL,
    "bodyMathml" TEXT,
    "bodySympy" TEXT,
    "bodyHtml" TEXT,
    "choices" JSONB,
    "answer" JSONB NOT NULL,
    "schoolLevel" "SchoolLevel" NOT NULL,
    "grade" SMALLINT NOT NULL,
    "semester" "SemesterType",
    "topicPath" TEXT,
    "itemType" "ItemType" NOT NULL DEFAULT 'short_answer',
    "formulaType" "FormulaType" NOT NULL DEFAULT 'inline',
    "answerFormat" "AnswerFormat" NOT NULL DEFAULT 'exact_value',
    "solutionSteps" SMALLINT,
    "usagePurposes" "UsagePurpose"[] DEFAULT ARRAY[]::"UsagePurpose"[],
    "difficultyAuthor" SMALLINT,
    "status" "QualityStatus" NOT NULL DEFAULT 'draft',
    "isGenerated" BOOLEAN NOT NULL DEFAULT false,
    "templateId" TEXT,
    "currentVersion" SMALLINT NOT NULL DEFAULT 1,
    "createdBy" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_versions" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "version" SMALLINT NOT NULL,
    "bodyLatex" TEXT NOT NULL,
    "answer" JSONB NOT NULL,
    "changeSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "topicPath" TEXT NOT NULL,
    "bloomLevel" SMALLINT,
    "estimatedTimeMin" SMALLINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prerequisite_edges" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "fromSkillId" TEXT NOT NULL,
    "toSkillId" TEXT NOT NULL,
    "strength" "EdgeStrength" NOT NULL DEFAULT 'strong',
    "weight" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prerequisite_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standards" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "schoolLevel" "SchoolLevel" NOT NULL,
    "grade" SMALLINT NOT NULL,
    "topicPath" TEXT NOT NULL,
    "caseUri" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "misconceptions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "typicalError" TEXT,
    "remediation" TEXT,
    "severity" SMALLINT NOT NULL DEFAULT 3,
    "relatedSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "misconceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "difficulty_profiles" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "authorDifficulty" SMALLINT NOT NULL,
    "behavioralDifficulty" DECIMAL(4,3),
    "irtDifficulty" DECIMAL(5,3),
    "irtDiscrimination" DECIMAL(5,3),
    "irtGuessing" DECIMAL(4,3),
    "teacherPerceived" DECIMAL(3,1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "difficulty_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solutions" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "method" "SolutionMethod" NOT NULL DEFAULT 'standard',
    "steps" JSONB NOT NULL,
    "finalAnswer" TEXT NOT NULL,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "answerTemplate" TEXT NOT NULL,
    "constraints" JSONB NOT NULL DEFAULT '{}',
    "variantCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variants" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "paramValues" JSONB NOT NULL,
    "seed" BIGINT,
    "generationLog" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" "AssignmentPurpose" NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "recType" "RecType" NOT NULL,
    "itemIds" TEXT[],
    "reasoning" JSONB NOT NULL,
    "accepted" BOOLEAN,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "oldData" JSONB,
    "newData" JSONB,
    "performedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_skills" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "weight" DECIMAL(3,2) NOT NULL DEFAULT 1.0,

    CONSTRAINT "item_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_standards" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "alignment" TEXT,

    CONSTRAINT "item_standards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_misconceptions" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "misconceptionId" TEXT NOT NULL,
    "frequency" DECIMAL(4,3),
    "sampleN" SMALLINT,

    CONSTRAINT "item_misconceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_similarities" (
    "id" TEXT NOT NULL,
    "itemAId" TEXT NOT NULL,
    "itemBId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "score" DECIMAL(4,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_similarities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_standards" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,

    CONSTRAINT "skill_standards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_items" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "position" SMALLINT NOT NULL,
    "points" DECIMAL(5,1),

    CONSTRAINT "assignment_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "items_orgId_status_schoolLevel_grade_idx" ON "items"("orgId", "status", "schoolLevel", "grade");

-- CreateIndex
CREATE INDEX "items_orgId_itemType_idx" ON "items"("orgId", "itemType");

-- CreateIndex
CREATE INDEX "items_orgId_createdAt_idx" ON "items"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "item_versions_itemId_version_key" ON "item_versions"("itemId", "version");

-- CreateIndex
CREATE INDEX "skills_orgId_topicPath_idx" ON "skills"("orgId", "topicPath");

-- CreateIndex
CREATE UNIQUE INDEX "skills_orgId_code_key" ON "skills"("orgId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "prerequisite_edges_orgId_fromSkillId_toSkillId_key" ON "prerequisite_edges"("orgId", "fromSkillId", "toSkillId");

-- CreateIndex
CREATE INDEX "standards_orgId_topicPath_idx" ON "standards"("orgId", "topicPath");

-- CreateIndex
CREATE UNIQUE INDEX "standards_orgId_code_key" ON "standards"("orgId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "misconceptions_orgId_code_key" ON "misconceptions"("orgId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "difficulty_profiles_itemId_key" ON "difficulty_profiles"("itemId");

-- CreateIndex
CREATE INDEX "recommendation_events_orgId_recType_idx" ON "recommendation_events"("orgId", "recType");

-- CreateIndex
CREATE INDEX "audit_logs_orgId_tableName_action_idx" ON "audit_logs"("orgId", "tableName", "action");

-- CreateIndex
CREATE INDEX "audit_logs_orgId_recordId_idx" ON "audit_logs"("orgId", "recordId");

-- CreateIndex
CREATE INDEX "audit_logs_orgId_createdAt_idx" ON "audit_logs"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "item_skills_itemId_skillId_key" ON "item_skills"("itemId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "item_standards_itemId_standardId_key" ON "item_standards"("itemId", "standardId");

-- CreateIndex
CREATE UNIQUE INDEX "item_misconceptions_itemId_misconceptionId_key" ON "item_misconceptions"("itemId", "misconceptionId");

-- CreateIndex
CREATE UNIQUE INDEX "item_similarities_itemAId_itemBId_method_key" ON "item_similarities"("itemAId", "itemBId", "method");

-- CreateIndex
CREATE UNIQUE INDEX "skill_standards_skillId_standardId_key" ON "skill_standards"("skillId", "standardId");

-- CreateIndex
CREATE INDEX "assignment_items_assignmentId_position_idx" ON "assignment_items"("assignmentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_items_assignmentId_itemId_key" ON "assignment_items"("assignmentId", "itemId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_versions" ADD CONSTRAINT "item_versions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prerequisite_edges" ADD CONSTRAINT "prerequisite_edges_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prerequisite_edges" ADD CONSTRAINT "prerequisite_edges_fromSkillId_fkey" FOREIGN KEY ("fromSkillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prerequisite_edges" ADD CONSTRAINT "prerequisite_edges_toSkillId_fkey" FOREIGN KEY ("toSkillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standards" ADD CONSTRAINT "standards_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "misconceptions" ADD CONSTRAINT "misconceptions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "difficulty_profiles" ADD CONSTRAINT "difficulty_profiles_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solutions" ADD CONSTRAINT "solutions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_events" ADD CONSTRAINT "recommendation_events_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_skills" ADD CONSTRAINT "item_skills_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_skills" ADD CONSTRAINT "item_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_standards" ADD CONSTRAINT "item_standards_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_standards" ADD CONSTRAINT "item_standards_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "standards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_misconceptions" ADD CONSTRAINT "item_misconceptions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_misconceptions" ADD CONSTRAINT "item_misconceptions_misconceptionId_fkey" FOREIGN KEY ("misconceptionId") REFERENCES "misconceptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_similarities" ADD CONSTRAINT "item_similarities_itemAId_fkey" FOREIGN KEY ("itemAId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_similarities" ADD CONSTRAINT "item_similarities_itemBId_fkey" FOREIGN KEY ("itemBId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_standards" ADD CONSTRAINT "skill_standards_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_standards" ADD CONSTRAINT "skill_standards_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "standards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_items" ADD CONSTRAINT "assignment_items_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_items" ADD CONSTRAINT "assignment_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
