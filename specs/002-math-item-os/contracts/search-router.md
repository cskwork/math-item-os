# Contract: Search Router

**tRPC Router**: `search`
**Auth**: 인증 필수

## Procedures

### search.items

한국어 자연어 + 구조 필터 하이브리드 검색.
Meilisearch(전문 검색) + PostgreSQL(구조 필터) 조합.

- **Type**: query
- **Auth**: 인증된 사용자 (교사: approved만, 검수자/관리자: 전 상태)
- **Input**:
  ```typescript
  {
    query?: string              // 자연어 검색어 (한국어)
    filters?: {
      schoolLevel?: SchoolLevel
      grade?: number
      semester?: SemesterType
      skillIds?: string[]
      standardIds?: string[]
      itemType?: ItemType
      difficultyMin?: number    // 1-5
      difficultyMax?: number    // 1-5
      usagePurposes?: UsagePurpose[]
      isGenerated?: boolean
      status?: QualityStatus[]  // 검수자/관리자만
    }
    page?: number               // default 1
    limit?: number              // default 20, max 50
    sort?: 'relevance' | 'difficulty' | 'createdAt'
  }
  ```
- **Output**:
  ```typescript
  {
    items: SearchResultItem[]   // 수식 렌더링 포함
    total: number
    page: number
    facets: {                   // Meilisearch faceted counts
      schoolLevel: Record<string, number>
      grade: Record<number, number>
      itemType: Record<string, number>
      difficulty: Record<number, number>
    }
    queryTime: number           // ms
  }
  ```
- **Performance**: p95 < 1.5초 @ 80K items (SC-002)

### search.similar

구조적 유사문항 검색. 6개 신호 결합 랭킹.

- **Type**: query
- **Auth**: 인증된 사용자
- **Input**: `{ itemId: string, limit?: number (default 20) }`
- **Output**:
  ```typescript
  {
    items: Array<{
      item: Item
      score: number             // 종합 유사도 (0-1)
      signals: {                // 개별 신호 점수
        skillMatch: number
        formulaStructure: number
        prerequisiteDistance: number
        textSemantic: number
        difficultyProximity: number
        misconceptionProfile: number
      }
      explanation: string       // "같은 스킬(분배법칙), 유사한 수식 구조"
    }>
  }
  ```
- **Ranking Weights** (초기): skill 0.30, formula 0.20, prerequisite 0.15, text 0.15, difficulty 0.10, misconception 0.10
- **Performance**: p95 < 2.0초

### search.similarFeedback

유사문항 검색 결과에 대한 교사 피드백 기록.

- **Type**: mutation
- **Auth**: 인증된 사용자
- **Input**: `{ sourceItemId: string, targetItemId: string, relevant: boolean }`
- **Output**: `{ success: boolean }`
- **Side Effects**: recommendation_event 기록, 향후 랭킹 보정에 반영
