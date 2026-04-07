# Contract: Item Router

**tRPC Router**: `item`
**Auth**: 모든 프로시저는 인증 필수 (Auth.js v5)

## Procedures

### item.create

문항 등록. LaTeX -> MathML + SymPy AST 3중 변환 자동 수행.

- **Type**: mutation
- **Auth**: 검수자, 관리자
- **Input**:
  ```typescript
  {
    bodyLatex: string          // LaTeX 원문 (필수)
    choices?: Choice[]         // 선택지 [{label, latex, isCorrect}]
    answer: Answer             // {value, format}
    schoolLevel: SchoolLevel   // elementary | middle | high
    grade: number              // 1-12
    semester?: SemesterType
    itemType: ItemType         // multiple_choice | short_answer | essay | ...
    formulaType?: FormulaType
    answerFormat: AnswerFormat
    solutionSteps?: number
    usagePurposes?: UsagePurpose[]
    difficultyAuthor?: number  // 1-5
    skillIds?: string[]        // 연결할 스킬 UUID
    standardIds?: string[]     // 연결할 성취기준 UUID
    misconceptionIds?: string[]
    passageId?: string
  }
  ```
- **Output**: `{ item: Item, conversionResult: ConversionResult }`
- **Errors**: `INVALID_LATEX`, `CONVERSION_FAILED`, `UNAUTHORIZED`
- **Side Effects**: audit_log INSERT, Meilisearch 인덱스 동기화

### item.update

문항 수정. 새 버전 자동 생성 (item_version INSERT).

- **Type**: mutation
- **Auth**: 검수자 (draft/reviewed), 관리자 (approved -> draft 역전이 후)
- **Input**: `{ id: string, ...Partial<CreateInput>, changeSummary?: string }`
- **Output**: `{ item: Item, version: number }`
- **Errors**: `NOT_FOUND`, `INVALID_STATE` (retired는 수정 불가)

### item.updateStatus

품질 상태 전이.

- **Type**: mutation
- **Auth**: 검수자 (draft <-> reviewed <-> approved), 관리자 (-> retired, approved -> draft)
- **Input**: `{ id: string, status: QualityStatus }`
- **Output**: `{ item: Item }`
- **Errors**: `INVALID_TRANSITION`, `UNAUTHORIZED_TRANSITION`

### item.getById

문항 상세 조회. 메타데이터, 스킬, 풀이 포함.

- **Type**: query
- **Auth**: 검수자, 관리자 (draft/reviewed 포함). 교사는 approved만.
- **Input**: `{ id: string }`
- **Output**: `{ item: Item, skills: Skill[], standards: Standard[], misconceptions: Misconception[], solutions: Solution[], difficultyProfile: DifficultyProfile, versions: ItemVersion[] }`

### item.list

문항 목록 조회. 페이지네이션 + 필터.

- **Type**: query
- **Auth**: 인증된 사용자
- **Input**:
  ```typescript
  {
    page?: number              // default 1
    limit?: number             // default 20, max 100
    status?: QualityStatus[]
    schoolLevel?: SchoolLevel
    grade?: number
    skillId?: string
    itemType?: ItemType
    difficultyMin?: number     // 1-5
    difficultyMax?: number     // 1-5
    sortBy?: 'createdAt' | 'difficulty' | 'updatedAt'
    sortOrder?: 'asc' | 'desc'
  }
  ```
- **Output**: `{ items: Item[], total: number, page: number, limit: number }`

### item.bulkUpload

CSV/JSON/QTI 일괄 업로드. 비동기 처리 (BullMQ).

- **Type**: mutation
- **Auth**: 검수자, 관리자
- **Input**: `{ format: 'csv' | 'json' | 'qti', fileUrl: string }`
- **Output**: `{ jobId: string, estimatedCount: number }`
- **Errors**: `INVALID_FORMAT`, `FILE_TOO_LARGE` (1만건 초과)
- **Side Effects**: BullMQ job 생성, 완료 시 Meilisearch 동기화

### item.getBulkUploadStatus

업로드 작업 상태 조회.

- **Type**: query
- **Auth**: 검수자, 관리자
- **Input**: `{ jobId: string }`
- **Output**: `{ status: 'pending' | 'processing' | 'completed' | 'failed', processed: number, total: number, errors: UploadError[] }`
