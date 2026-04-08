# Contributing to Math Item OS

Math Item OS에 기여해주셔서 감사합니다! 이 문서는 기여 방법을 안내합니다.

## 개발 환경 설정

```bash
# 1. 저장소 Fork & Clone
git clone https://github.com/<your-username>/math-item-os.git
cd math-item-os

# 2. 의존성 설치
pnpm install

# 3. 인프라 실행
docker compose up -d

# 4. 환경 변수 설정
cp .env.example .env

# 5. DB 마이그레이션
pnpm db:migrate

# 6. 개발 서버 실행
pnpm dev
```

## 기여 워크플로우

1. 이슈를 먼저 확인하거나 새로 생성합니다.
2. Feature branch를 생성합니다: `git checkout -b feat/기능-이름`
3. 코드를 작성하고 테스트를 추가합니다.
4. 커밋 메시지는 [Conventional Commits](https://www.conventionalcommits.org/) 형식을 따릅니다:
   - `feat:` 새로운 기능
   - `fix:` 버그 수정
   - `docs:` 문서 변경
   - `refactor:` 리팩토링
   - `test:` 테스트 추가/수정
   - `chore:` 빌드, CI 등 기타
5. Push 후 Pull Request를 생성합니다.

## 코드 스타일

- TypeScript: ESLint + Prettier 설정을 따릅니다.
- Python: Ruff를 사용합니다.
- 테스트 커버리지 80% 이상을 유지합니다.

## 이슈 리포트

버그 리포트 시 아래 정보를 포함해주세요:

- 재현 단계
- 기대 결과 vs 실제 결과
- 환경 정보 (OS, Node.js 버전, 브라우저)

## 라이선스

기여하신 코드는 프로젝트의 [MIT License](LICENSE)가 적용됩니다.
