# Contract: Admin Router

**tRPC Router**: `admin`
**Auth**: 관리자 또는 검수자 전용

## Review Procedures

### admin.listReviewTasks

검수 작업 큐 조회.

- **Type**: query
- **Auth**: 검수자, 관리자
- **Input**:
  ```typescript
  {
    taskType?: ReviewTaskType   // tag_review | generation_review | duplicate_review | explanation_error
    status?: ReviewStatus       // pending | in_progress | completed | rejected
    assigneeId?: string
    priority?: number           // 1-5
    page?: number
    limit?: number
  }
  ```
- **Output**: `{ tasks: ReviewTask[], total: number }`

### admin.updateReviewTask

검수 작업 상태 업데이트.

- **Type**: mutation
- **Auth**: 검수자 (자신 담당), 관리자 (전체)
- **Input**: `{ taskId: string, status: ReviewStatus, comment?: string }`
- **Output**: `{ task: ReviewTask }`
- **Side Effects**: audit_log, 대상 문항 상태 연동

## Audit Procedures

### admin.listAuditLogs

감사 로그 조회.

- **Type**: query
- **Auth**: 관리자
- **Input**:
  ```typescript
  {
    tableName?: string
    recordId?: string
    action?: AuditAction
    performedBy?: string
    dateFrom?: Date
    dateTo?: Date
    page?: number
    limit?: number
  }
  ```
- **Output**: `{ logs: AuditLog[], total: number }`

## User Management

### admin.listUsers

사용자 목록 조회.

- **Type**: query
- **Auth**: 관리자
- **Input**: `{ role?: 'admin' | 'reviewer' | 'teacher', page?: number, limit?: number }`
- **Output**: `{ users: User[], total: number }`

### admin.updateUserRole

사용자 역할 변경.

- **Type**: mutation
- **Auth**: 관리자
- **Input**: `{ userId: string, role: 'admin' | 'reviewer' | 'teacher' }`
- **Output**: `{ user: User }`
- **Side Effects**: audit_log

## Dashboard

### admin.getQualityMetrics

품질 KPI 대시보드 데이터.

- **Type**: query
- **Auth**: 검수자, 관리자
- **Output**:
  ```typescript
  {
    totalItems: number
    byStatus: Record<QualityStatus, number>
    metadataCompleteness: number    // 0-100%
    avgDifficulty: number
    recentActivity: AuditLog[]     // 최근 10건
    pendingReviews: number
    generatedItemPassRate: number   // CAS 검증 통과율
  }
  ```

## Generation Management

### admin.listTemplates

생성 템플릿 목록.

- **Type**: query
- **Auth**: 검수자, 관리자
- **Input**: `{ page?: number, limit?: number }`
- **Output**: `{ templates: Template[], total: number }`

### admin.generateVariants

템플릿 기반 변형 문항 생성 (비동기).

- **Type**: mutation
- **Auth**: 검수자, 관리자
- **Input**:
  ```typescript
  {
    templateId: string
    count: number              // 생성할 변형 수
    params?: {                 // 제어 변수 오버라이드
      solutionSteps?: number
      coefficientRange?: [number, number]
      includeFractions?: boolean
      includeNegatives?: boolean
    }
  }
  ```
- **Output**: `{ jobId: string }`
- **Side Effects**: Python math-ai 서비스 호출, BullMQ job, CAS 자동 검증
- **Performance**: 1건당 < 10초 (SC-005)

### admin.getGenerationResult

생성 작업 결과 조회.

- **Type**: query
- **Auth**: 검수자, 관리자
- **Input**: `{ jobId: string }`
- **Output**:
  ```typescript
  {
    status: 'pending' | 'processing' | 'completed' | 'failed'
    variants: Array<{
      item: Item
      casVerification: {
        passed: boolean
        answerEquivalence: boolean
        solutionUniqueness: boolean
        failureReason?: string
      }
    }>
    passRate: number           // 95%+ 미달 시 템플릿 검토 필요 (Constitution III)
  }
  ```

## Assignment Management

### admin.createAssignment

학습지/과제 생성.

- **Type**: mutation
- **Auth**: 검수자, 관리자
- **Input**:
  ```typescript
  {
    title: string
    purpose: UsagePurpose
    itemIds: string[]          // 문항 ID 목록 (순서 유지)
    points?: number[]          // 문항별 배점
  }
  ```
- **Output**: `{ assignment: Assignment }`

### admin.exportAssignment

학습지 PDF/링크 출력.

- **Type**: mutation
- **Auth**: 검수자, 관리자
- **Input**: `{ assignmentId: string, format: 'pdf' | 'link' }`
- **Output**: `{ url: string, expiresAt?: Date }`
