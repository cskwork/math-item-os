-- Add reverse-direction lookup indexes
-- ItemSkill: supports queries filtering by skillId first (e.g. getSkillItems)
-- PrerequisiteEdge: supports reverse DAG traversal by (orgId, toSkillId) for remediation path

-- CreateIndex
CREATE INDEX "item_skills_skillId_itemId_idx" ON "item_skills"("skillId", "itemId");

-- CreateIndex
CREATE INDEX "prerequisite_edges_orgId_toSkillId_idx" ON "prerequisite_edges"("orgId", "toSkillId");
