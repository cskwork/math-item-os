# Judge0 on Apple Silicon via Colima — 설정 가이드 (검증됨)

> **상태**: 이 가이드는 2026-04-13 기준 Apple Silicon(arm64) Mac + macOS 15+ + Judge0 1.13.1 조합으로 실제 검증되었다. Python `print("hello colima!")` 실행 → `stdout: "hello colima!\n"`, `status: Accepted` 확인.

## 왜 Colima인가

Docker Desktop on Apple Silicon은 Rosetta 2를 통해 amd64 컨테이너를 실행한다. 그러나 이 경로에서 privileged 컨테이너조차 `unshare`/`clone(CLONE_NEWUSER)` 같은 **Linux namespace 시스템콜이 거부**된다. 이것은 Apple Virtualization.framework가 ARM64 VM 위에 Rosetta로 x86_64 프로세스를 실행하는 구조적 한계이며, Judge0 버전을 올려도 해결되지 않는다.

**Colima는 다르다.** Colima의 `--vm-type qemu --arch x86_64` 옵션은 QEMU를 사용해 **네이티브 x86_64 Linux VM**(Ubuntu 24.04, 커널 6.8)을 띄운다. VM 커널 자체가 x86_64로 돌기 때문에 Rosetta 번역 경로가 없고, isolate가 요구하는 namespace/cgroups 연산이 정상 동작한다.

## 1. 필수 사전 조건

| 항목 | 요구사항 | 확인 방법 |
|---|---|---|
| 아키텍처 | arm64 (Apple Silicon) | `uname -m` → `arm64` |
| macOS 버전 | macOS 13+ | `sw_vers` |
| Homebrew 설치 | 필수 | `which brew` |
| 디스크 여유 공간 | 최소 20GB | `df -h` |

## 2. 설치 (3개 패키지 모두 필수)

```bash
brew install colima qemu lima-additional-guestagents
```

**왜 3개 모두 필요한가** (이 중 하나라도 빠지면 `colima start`가 실패):

- **colima**: Lima VM의 Docker 통합 래퍼
- **qemu**: `--arch x86_64`를 위한 x86_64 에뮬레이터 (기본 Lima는 호스트 아키텍처만 지원)
- **lima-additional-guestagents**: x86_64 guest VM 내부에서 실행될 lima-guestagent 바이너리 제공

## 3. 기존 Docker Desktop 스택 정지 + 데이터 백업

Colima는 Docker Desktop과 **다른 Docker 데몬**이다. 볼륨이 공유되지 않으므로 Postgres 데이터는 반드시 pg_dump로 백업해야 한다.

```bash
cd /Users/danny/Documents/PARA/Resource/hwp-to-html

# 1) Postgres 백업 (Docker Desktop 데몬이 아직 살아 있을 때)
mkdir -p /tmp/colima-migration
docker exec mathitem-postgres pg_dumpall -U postgres > /tmp/colima-migration/postgres-backup.sql
ls -lh /tmp/colima-migration/postgres-backup.sql

# 2) 컨테이너 전체 정지 (이미지/볼륨은 남는다)
docker compose down

# 3) Docker Desktop 앱 종료 (선택 — 남겨둬도 무방하지만 메모리 절약 목적으로 권장)
osascript -e 'quit app "Docker"'
```

> **⚠️ Meilisearch 인덱스**는 재기동 시 빈 상태가 된다. 검색 재인덱싱이 필요하다면 별도 수단(앱의 재색인 스크립트 등)이 필요하다. Postgres가 source of truth인 경우 문제 없다.

## 4. Colima x86_64 VM 기동

```bash
colima start --cpu 4 --memory 8 --disk 60 --arch x86_64 --vm-type qemu
```

**파라미터 의미:**
- `--cpu 4 --memory 8 --disk 60`: 개발용 리소스 (VM 전용, 호스트 리소스 예약이 아니라 상한)
- `--arch x86_64`: **핵심** — native x86_64 Linux VM 생성
- `--vm-type qemu`: QEMU 풀 에뮬레이션 (Apple의 vz 백엔드는 x86_64 guest를 지원하지 않음)

첫 기동은 디스크 이미지 다운로드 + VM 부트로 **2-4분** 정도 걸린다. 이후 기동은 훨씬 빠르다.

**기동 확인:**
```bash
colima status
docker context ls   # colima가 * 표시로 current여야 함
docker info | grep -E "Architecture|Operating System"
# Architecture: x86_64
# Operating System: Ubuntu 24.04.x LTS
```

## 5. AppArmor userns 제한 해제 (필수, VM 재부팅 시마다)

Ubuntu 24.04는 `kernel.apparmor_restrict_unprivileged_userns=1`이 기본값이다. 이 설정은 unprivileged 유저 네임스페이스 생성 시 AppArmor의 자동 re-confine 프로필을 적용하는데, isolate의 mount 동작을 차단한다.

**영구 설정** (권장 — VM 재시작 후에도 유지):
```bash
# colima 셸에 SSH로 설정 파일 작성
cat > /tmp/setup-judge0-sysctl.sh <<'EOF'
#!/bin/bash
set -e
echo "kernel.apparmor_restrict_unprivileged_userns=0" | sudo tee /etc/sysctl.d/99-judge0.conf
sudo sysctl -p /etc/sysctl.d/99-judge0.conf
EOF
# colima가 /Users/danny를 VM에 마운트하므로 홈 디렉토리로 옮겨서 실행
mv /tmp/setup-judge0-sysctl.sh ~/setup-judge0-sysctl.sh
colima ssh -- bash ~/setup-judge0-sysctl.sh
rm ~/setup-judge0-sysctl.sh
```

**일회성 설정** (VM 재기동 시 다시 해야 함):
```bash
colima ssh -- 'sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0'
```

확인:
```bash
colima ssh -- cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns
# 출력이 0이어야 함
```

## 6. 인프라 컨테이너 기동 + 데이터 복원

```bash
cd /Users/danny/Documents/PARA/Resource/hwp-to-html

# 인프라 먼저
docker compose up -d postgres redis meilisearch

# Postgres ready 대기
until docker exec mathitem-postgres pg_isready -U postgres -d mathitem; do sleep 1; done

# 백업 복원
cat /tmp/colima-migration/postgres-backup.sql | docker exec -i mathitem-postgres psql -U postgres

# 확인
docker exec mathitem-postgres psql -U postgres -d mathitem -c "SELECT COUNT(*) FROM items;"
```

## 7. Judge0 기동

```bash
docker compose up -d judge0-redis judge0-server judge0-workers
```

첫 기동은 judge0 이미지(~1.5GB) 다운로드 + Rails 앱 부트 + 언어 DB 시드로 **1-3분** 정도 걸린다.

`docker-compose.yml`에는 이미 다음 설정이 적용되어 있다 (Colima에서 동작하려면 필수):

- `judge0-server`: `privileged: true` + `security_opt: apparmor=unconfined, seccomp=unconfined`
- `judge0-workers`: 동일
- `judge0.conf`: `REDIS_HOST=judge0-redis`, `REDIS_PORT=6380` (REDIS_URL은 resque가 읽지 못함)

**healthy 확인:**
```bash
docker ps --filter name=mathitem-judge0
# mathitem-judge0가 (healthy)로 표시되어야 함
```

## 8. 검증

### 8-1. namespace 동작 확인 (Docker Desktop에서 실패하던 것)

```bash
docker exec mathitem-judge0-workers unshare --user --pid --fork echo ok
# → ok
```

### 8-2. Judge0 submission 직접 테스트

```bash
docker exec mathitem-judge0 curl -s -X POST \
  'http://localhost:2358/submissions?base64_encoded=false&wait=true' \
  -H 'Content-Type: application/json' \
  -d '{
    "source_code":"print(\"hello colima!\")",
    "language_id":71,
    "enable_per_process_and_thread_time_limit":true,
    "enable_per_process_and_thread_memory_limit":true
  }' | python3 -m json.tool
```

**기대 결과:**
```json
{
    "stdout": "hello colima!\n",
    "status": { "id": 3, "description": "Accepted" }
}
```

### 8-3. Next.js 앱에서 end-to-end

```bash
cd apps/web && npm run dev
```

브라우저에서 `/items/new` → 코드 블록 → Python `print("hello")` → ▶ 실행 → UI에 "성공" + 출력 확인.

## 9. 이 가이드가 해결한 함정들 (디버깅 히스토리)

Judge0 1.13.1을 Colima에서 돌리는 과정에서 발견한 **5개의 함정**. 각각 `docker-compose.yml`, `judge0.conf`, `code-execution.service.ts`에 수정이 반영되어 있다.

### 함정 1: `REDIS_URL` 무시

Judge0 1.13.1의 `config/initializers/redis.rb`는 `ENV['REDIS_HOST']`, `ENV['REDIS_PORT']`를 읽는다. `REDIS_URL`만 설정하면 resque-scheduler가 이를 무시하고 `localhost:6379`(기본값)로 폴백해 연결 실패한다.

**수정**: `docker/judge0/judge0.conf`에서 `REDIS_URL` 대신 `REDIS_HOST=judge0-redis` + `REDIS_PORT=6380` 사용. `REDIS_PASSWORD`는 **절대 빈 문자열로 설정하지 말 것** — Ruby Redis 클라이언트가 `AUTH ""`를 보내 "NOAUTH" 에러를 발생시킨다. 완전히 생략해야 한다.

### 함정 2: AppArmor userns 제한 (Ubuntu 24.04)

위 5절 참고. `apparmor_restrict_unprivileged_userns=1`이 isolate의 user namespace mount 동작을 차단한다. VM 레벨 sysctl로 해제.

### 함정 3: isolate의 `--cg` 플래그 실패

isolate 1.8.1은 cgroups v1 레이아웃(`/sys/fs/cgroup/memory/`, `/cpu/`)을 기대하지만 Ubuntu 24.04는 cgroups v2 통합 계층을 쓴다. Judge0는 기본값으로 `--cg`를 전달하려 한다.

**수정**: Next.js의 `code-execution.service.ts`에서 submission 호출 시 `enable_per_process_and_thread_time_limit: true`와 `enable_per_process_and_thread_memory_limit: true`를 모두 보낸다. 이렇게 하면 Judge0의 `IsolateJob`이 `@cgroups = ""`로 설정해 `--cg` 없이 isolate를 호출한다.

### 함정 4: `wait=true`는 API 서버에서 `perform_now`로 실행됨 ⭐ 가장 미묘한 함정

Judge0의 `SubmissionsController`는 `wait=true`일 때 `IsolateJob.perform_now(submission.id)`를 호출한다 — **워커 컨테이너가 아니라 API 서버 컨테이너에서 동기적으로 실행**된다. 따라서 `privileged: true`를 `judge0-workers`에만 설정하면 async(`wait=false`) 모드는 동작하지만 sync(`wait=true`) 모드는 "Cannot run proxy, clone failed: Operation not permitted"로 실패한다.

**수정**: `docker-compose.yml`의 `judge0-server`에도 `privileged: true` + `security_opt: apparmor=unconfined, seccomp=unconfined`를 설정.

### 함정 5: Rosetta 2 경로는 해결책이 아님

vz + Rosetta 2 조합(`--vm-type vz --arch x86_64 --vz-rosetta`)을 시도해도 Apple이 vz에서 x86_64 guest를 지원하지 않아 실패한다. `qemu` 백엔드만 사용 가능하며, 이는 Docker Desktop의 Rosetta 경로와 완전히 다른 코드 경로를 탄다.

## 10. 롤백 (Docker Desktop으로 복귀)

```bash
colima stop
open -a Docker
docker context use desktop-linux

# 필요하면 기존 Docker Desktop 스택 재기동
cd /Users/danny/Documents/PARA/Resource/hwp-to-html
docker compose up -d
```

## 11. 성능 노트

- **QEMU 기반 x86_64 VM은 네이티브 대비 2-5배 느리다**. Postgres/Redis 같은 I/O-heavy 워크로드는 체감 가능하게 느려진다.
- Judge0를 자주 쓰지 않는다면 필요할 때만 Colima를 켜는 전략 권장:
  ```bash
  # Judge0 테스트 세션 시작
  colima start
  docker compose up -d
  
  # 세션 종료
  docker compose down
  colima stop
  ```
- 두 개의 프로파일을 분리해서 운영할 수도 있다:
  ```bash
  colima start --profile native --arch aarch64              # 일반 개발 (빠름)
  colima start --profile judge0 --arch x86_64 --vm-type qemu # Judge0 전용
  docker context use colima-judge0
  ```

## 12. 체크리스트

- [ ] `brew install colima qemu lima-additional-guestagents` 완료
- [ ] Docker Desktop에서 `pg_dumpall`로 Postgres 백업
- [ ] `docker compose down`으로 기존 스택 정지
- [ ] `colima start --arch x86_64 --vm-type qemu` 기동 성공
- [ ] `docker context ls`에서 `colima *` 확인
- [ ] `kernel.apparmor_restrict_unprivileged_userns=0` 설정 (영구 또는 일회성)
- [ ] `docker compose up -d postgres redis meilisearch` 후 데이터 복원
- [ ] `docker compose up -d judge0-redis judge0-server judge0-workers` 후 `mathitem-judge0` healthy 확인
- [ ] `unshare --user --pid --fork echo ok` → `ok` 출력 확인
- [ ] Judge0 API 직접 submission 테스트 → `status.id: 3` 확인
- [ ] Next.js `/items/new`에서 code.execute UI 정상 동작 확인
