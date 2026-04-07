# Contract: Skill Router

**tRPC Router**: `skill`
**Auth**: 인증 필수

## Procedures

### skill.create

스킬 노드 등록.

- **Type**: mutation
- **Auth**: 검수자, 관리자
- **Input**:
  ```typescript
  {
    code: string               // 예: solve_linear_eq_distributive
    title: string
    description?: string
    topicPath: string          // ltree 경로 (math.algebra.linear_eq)
    bloomLevel?: number        // 1-6
    estimatedTimeMin?: number
  }
  ```
- **Output**: `{ skill: Skill }`
- **Errors**: `DUPLICATE_CODE`

### skill.createPrerequisite

선수학습 관계(엣지) 생성. DAG 순환 감지 필수.

- **Type**: mutation
- **Auth**: 검수자, 관리자
- **Input**:
  ```typescript
  {
    fromSkillId: string        // 선수 스킬
    toSkillId: string          // 후속 스킬
    strength: 'strong' | 'weak'
    weight?: number            // 0-1, default 1.0
  }
  ```
- **Output**: `{ edge: PrerequisiteEdge }`
- **Errors**: `CYCLE_DETECTED` (순환 감지), `SELF_REFERENCE`, `DUPLICATE_EDGE`
- **Validation**: INSERT 전 recursive CTE로 순환 검사 (Constitution II)

### skill.getPrerequisiteGraph

특정 스킬의 선수학습 DAG 조회 (시각화용).

- **Type**: query
- **Auth**: 인증된 사용자
- **Input**: `{ skillId: string, depth?: number (default 5), direction?: 'ancestors' | 'descendants' | 'both' }`
- **Output**:
  ```typescript
  {
    nodes: Array<{
      skill: Skill
      itemCount: number        // 연결된 문항 수
      difficultyDistribution: Record<number, number> // 1-5별 문항 수
    }>
    edges: Array<{
      from: string
      to: string
      strength: 'strong' | 'weak'
      weight: number
    }>
  }
  ```

### skill.list

스킬 목록 조회.

- **Type**: query
- **Auth**: 인증된 사용자
- **Input**: `{ topicPath?: string, bloomLevel?: number, page?: number, limit?: number }`
- **Output**: `{ skills: Skill[], total: number }`

### skill.getItems

특정 스킬에 연결된 문항 목록.

- **Type**: query
- **Auth**: 인증된 사용자
- **Input**: `{ skillId: string, page?: number, limit?: number, sortBy?: 'difficulty' | 'createdAt' }`
- **Output**: `{ items: Item[], total: number }`

---

## Misconception Procedures

### skill.listMisconceptions

오개념 목록 조회.

- **Type**: query
- **Auth**: 인증된 사용자
- **Input**: `{ skillId?: string, severity?: number, page?: number, limit?: number }`
- **Output**: `{ misconceptions: Misconception[], total: number }`

### skill.createMisconception

오개념 등록.

- **Type**: mutation
- **Auth**: 검수자, 관리자
- **Input**:
  ```typescript
  {
    code: string               // 예: sign_error_transposition
    title: string
    typicalError?: string
    remediation?: string
    severity?: number          // 1-5, default 3
    relatedSkillIds?: string[]
  }
  ```
- **Output**: `{ misconception: Misconception }`

### skill.getRemediationPath

오개념 기반 교정 문항 추천.

- **Type**: query
- **Auth**: 인증된 사용자
- **Input**: `{ misconceptionId: string, difficulty?: number, limit?: number }`
- **Output**:
  ```typescript
  {
    steps: Array<{
      phase: 'prerequisite_review' | 'basic_practice' | 'confirmation'
      items: Item[]
      explanation: string      // "이 단계에서 부호 이동 규칙을 복습합니다"
    }>
  }
  ```
