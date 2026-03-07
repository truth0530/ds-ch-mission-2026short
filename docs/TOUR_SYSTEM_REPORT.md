# 투어 신청 시스템 보고서

**프로젝트**: `ds-ch-mission-2026short`  
**대상 기능**: 기독유적지 투어 신청/조회/변경/취소 시스템  
**작성일**: 2026-03-07  
**작성 기준**: `src/app/tour`, `src/app/api/tour`, `supabase/migrations` 구현 기준

## 1. 시스템 개요

### 1.1 기술 스택

| 구분 | 내용 |
| --- | --- |
| 프론트엔드 | Next.js 15 App Router, React, TypeScript, Tailwind CSS |
| 백엔드 | Next.js Route Handler |
| 데이터베이스 | Supabase PostgreSQL |
| 인증/권한 | Supabase Auth + `admin_users.role` |
| 실시간 반영 | Supabase Realtime (`tour_slots` 변경 구독) |
| 배포 | Vercel |

### 1.2 페이지 구성

| 페이지 | 경로 | 역할 |
| --- | --- | --- |
| 투어 신청 | `/tour` | 조장 선택, 슬롯 선택, PIN 입력, 예약 생성 |
| 내 신청 조회/변경/취소 | `/tour/my` | 이름 + PIN 조회 후 예약 변경/취소 |
| 관리자 투어 관리 | `/admin/tour` | 슬롯/예약 현황 조회, 관리자 취소, 조장 명단 관리 |

### 1.3 운영 모델

- 조장 마스터는 `tour_leaders` 테이블로 관리한다.
- 신청 가능 시간은 `tour_slots` 9개로 초기화되어 있다.
- 슬롯당 기본 정원은 4명이며 총 정원은 36명이다.
- 조장 수는 현재 31명이다.

## 2. 핵심 기능

### 2.1 신청 플로우

1. `/tour`에서 조 번호 또는 이름으로 조장을 검색한다.
2. 오전/오후 슬롯 중 마감되지 않은 일정을 선택한다.
3. 4자리 PIN과 선택 메모를 입력한다.
4. `POST /api/tour/reservations`가 RPC `create_tour_reservation`을 호출해 예약을 생성한다.
5. 완료 화면에서 일정과 신청자 정보를 확인하고 `/tour/my`로 이동할 수 있다.

구현 포인트:

- 자동완성은 최대 8건까지 노출된다.
- 이미 예약된 조장은 기본 목록에서 제외된다.
- 잔여 1석은 경고 색상으로 표시된다.
- 슬롯이 마감되면 버튼이 비활성화된다.

### 2.2 수정/취소 플로우

1. `/tour/my`에서 조장을 선택하고 4자리 PIN을 입력한다.
2. `POST /api/tour/reservations/lookup`으로 현재 활성 예약을 조회한다.
3. 사용자는 예약 취소 또는 다른 슬롯으로 변경할 수 있다.
4. 변경/취소는 `POST /api/tour/reservations/manage`를 통해 처리된다.

구현 포인트:

- 조회는 `name + PIN + active 상태` 기준이다.
- 변경 시 현재 슬롯은 제외되고 마감되지 않은 슬롯만 선택 가능하다.
- 취소 후에는 해당 조장이 다시 신청 가능 목록에 포함된다.

### 2.3 3계층 중복 방지

| 계층 | 위치 | 방식 |
| --- | --- | --- |
| UI | `/tour` | 이미 예약된 조장을 자동완성 기본 목록에서 제외 |
| API | `POST /api/tour/reservations` | 동일 이름의 활성 예약 사전 조회 후 409 반환 |
| DB | `idx_tour_reservations_active_name`, RPC | `status='active'` 조건 partial unique index + RPC 내부 중복 검사 |

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_tour_reservations_active_name
ON public.tour_reservations(name)
WHERE status = 'active';
```

### 2.4 동시성 제어

- 예약 생성 RPC는 대상 슬롯을 `FOR UPDATE`로 잠근 뒤 정원을 검사한다.
- 슬롯 변경 RPC도 기존 예약과 신규 슬롯을 각각 잠그고 처리한다.
- `current_bookings`는 트리거로 유지되어 애플리케이션 레벨 카운트 계산 오류를 줄인다.
- 이 구조는 같은 시점의 마지막 좌석 경쟁에서 oversell을 방지하도록 설계되어 있다.

### 2.5 실시간 업데이트

- `/tour`는 Supabase Realtime으로 `tour_slots` 변경을 구독한다.
- 다른 사용자가 예약하면 슬롯의 잔여석과 마감 상태는 자동 갱신된다.
- 현재 구독 대상은 `tour_slots`만이므로 조장 자동완성의 예약 제외 목록은 실시간 동기화되지 않는다.

## 3. DB 설계

### 3.1 테이블 구조

#### `tour_slots`

- `id`: UUID PK
- `tour_date`: DATE
- `tour_time`: TIME
- `time_label`: TEXT
- `max_capacity`: INTEGER, 기본 4
- `current_bookings`: INTEGER, 트리거로 관리
- `is_active`: BOOLEAN
- `created_at`: TIMESTAMPTZ

#### `tour_leaders`

- `id`: UUID PK
- `group_number`: INTEGER UNIQUE
- `name`: TEXT UNIQUE
- `is_active`: BOOLEAN
- `created_at`, `updated_at`

#### `tour_reservations`

- `id`: UUID PK
- `slot_id`: `tour_slots.id` FK
- `reservation_code`: 6자리 고유 코드
- `manage_token`: 현재는 사용자 입력 4자리 PIN 저장 용도
- `name`: 조장 이름
- `phone`: nullable
- `email`: nullable
- `memo`: nullable
- `status`: `active | cancelled`
- `created_at`, `updated_at`

### 3.2 트리거 및 제약

- `update_slot_booking_count()`
  - 예약 생성/변경/취소 시 `tour_slots.current_bookings`를 증감한다.
- `update_tour_reservation_updated_at()`
  - 예약 수정 시 `updated_at`을 갱신한다.
- `update_tour_leaders_updated_at()`
  - 조장 수정 시 `updated_at`을 갱신한다.
- `check_capacity`
  - `current_bookings`가 0 이상 `max_capacity` 이하인지 보장한다.

### 3.3 RPC 함수

| 함수 | 역할 |
| --- | --- |
| `create_tour_reservation` | 중복 검사, 슬롯 잠금, 정원 검사, 예약 생성 |
| `change_tour_reservation` | 이름 + PIN 인증 후 슬롯 변경 |
| `cancel_tour_reservation` | 이름 + PIN 인증 후 예약 취소 |

### 3.4 RLS 및 보안 모델

- `tour_slots`: 활성 슬롯만 공개 읽기 허용
- `tour_leaders`: 활성 조장만 공개 읽기 허용
- `tour_reservations`: 직접 공개 정책 없음
- 공개/사용자 API는 서버 Route Handler에서 Supabase 서버 클라이언트를 통해 처리한다.
- 관리자 API는 `Authorization: Bearer <token>` 기반으로 `requireAdminUser()` 검증을 거친다.

주의:

- 서버 클라이언트는 `SUPABASE_SERVICE_ROLE_KEY`가 없으면 anon key로 fallback한다.
- 따라서 운영 환경에서는 `SUPABASE_SERVICE_ROLE_KEY`가 사실상 필수다.

## 4. API 설계

### 4.1 사용자 흐름 기준 7개 엔드포인트

| Method | Endpoint | 설명 |
| --- | --- | --- |
| `GET` | `/api/tour/slots` | 활성 슬롯 목록 조회 |
| `GET` | `/api/tour/leaders` | 예약 가능한 조장 목록 조회 |
| `GET` | `/api/tour/leaders?all=true` | 전체 활성 조장 조회 |
| `GET` | `/api/tour/reservations/public` | 공개 신청 현황 조회 |
| `POST` | `/api/tour/reservations` | 신규 예약 생성 |
| `POST` | `/api/tour/reservations/lookup` | 이름 + PIN 예약 조회 |
| `POST` | `/api/tour/reservations/manage` | 예약 취소 또는 슬롯 변경 |

### 4.2 관리자 전용 엔드포인트

| Method | Endpoint | 설명 |
| --- | --- | --- |
| `GET` | `/api/tour/admin` | 슬롯/조장/예약 전체 조회 |
| `POST` | `/api/tour/leaders` | 조장 추가 |
| `PATCH` | `/api/tour/leaders/[id]` | 조장 수정 |
| `DELETE` | `/api/tour/leaders/[id]` | 조장 비활성화 |
| `PATCH` | `/api/tour/reservations/[id]` | 관리자 예약 취소 |

### 4.3 응답/에러 특성

- 중복 신청: `409`
- 마감 슬롯 신청/변경: `409`
- 잘못된 PIN 또는 예약 없음: `404`
- 잘못된 요청 본문: `400`
- 호출량 초과: `429`

## 5. 테스트 결과

이 절의 수치는 기존 검증 기록을 정리한 것이다. 현재 저장소에는 투어 기능 전용 자동화 테스트 스위트가 포함되어 있지 않다.

### 5.1 기능 테스트 요약

- 종합 UX 테스트: `28 / 31 PASS`
- 미검증 3건은 전체 슬롯을 모두 마감시켜야 하는 시나리오이며, 현재 기본 데이터에서는 총 정원 36석이 조장 수 31명보다 많아 재현 한계가 있었다.

### 5.2 확인된 정상 동작

- 조 번호/이름 기반 자동완성 검색
- PIN 숫자 4자리 제한
- 신규 신청 생성
- 이름 + PIN 기반 조회
- 슬롯 변경 및 취소
- 취소 후 재신청
- 중복 신청 차단
- 마감 슬롯 비활성화
- 슬롯별 예약 수와 공개 현황 정합성

### 5.3 스트레스/동시성 검증 기록

- 31명 순차 등록 성공
- 평균 응답 시간: 약 457ms
- 동시 중복 시도: 각 조장당 1건만 성공
- 공개 조회 10건 동시 요청 평균: 약 7ms
- 실시간 잔여석 반영: 약 504ms

## 6. 발견된 문제와 상태

### 6.1 수정 완료로 볼 수 있는 항목 6건

| 항목 | 상태 |
| --- | --- |
| 조장 마스터 부재 | `tour_leaders` 테이블과 관리자 CRUD 추가 |
| 공개 경로에서 직접 테이블 접근 가능했던 구조 | RLS를 축소하고 RPC/서버 API 중심 구조로 전환 |
| 이름만 입력해도 신청 가능했던 문제 | 활성 조장 목록 존재 여부를 서버에서 재검증 |
| PIN 기반 조회/변경/취소 부재 | lookup/manage API와 관련 RPC 추가 |
| 예약 생성 시 PIN이 DB에 제대로 저장되지 않던 문제 | `create_tour_reservation(..., p_pin)`으로 수정 |
| 동일 조장 중복 예약 가능성 | 클라이언트, API, DB 3계층 차단 추가 |

### 6.2 현재 알려진 한계 5건

| 항목 | 설명 |
| --- | --- |
| `manage_token` 인덱스 적용 상태 확인 필요 | 제거 마이그레이션 파일은 추가되었지만, 운영 DB에 아직 적용되지 않았다면 동일 PIN 재사용과 충돌할 수 있다. |
| PIN 평문 저장 | 현재 `manage_token`에 4자리 PIN이 그대로 저장된다. 해시 저장이 더 안전하다. |
| Rate limit 저장소가 메모리 기반 | 서버리스 멀티 인스턴스 환경에서 전역 보장이 되지 않는다. |
| 실시간 동기화 범위 제한 | `/tour`의 조장 예약 제외 목록은 Realtime으로 갱신되지 않는다. |
| 관리자 취소 경로 일관성 부족 | 관리자 취소는 사용자용 RPC가 아니라 직접 업데이트 경로를 사용한다. |

## 7. 개선 제안

### 7.1 보안

1. 추가된 인덱스 제거 마이그레이션을 운영 DB에 적용하고, 이후 PIN 해시 전환 시 별도 검증 구조를 설계한다.
2. PIN은 해시 저장하고 조회 실패 횟수 누적 잠금 로직을 추가한다.
3. 메모리 기반 rate limit을 Upstash Redis 같은 외부 저장소로 교체한다.
4. `SUPABASE_SERVICE_ROLE_KEY` 미설정 시 서버 시작 단계에서 명시적으로 실패시키는 편이 안전하다.

### 7.2 사용성

1. `/tour`에서 실시간으로 예약된 조장 목록도 다시 계산되도록 동기화한다.
2. 전체 마감 시 전용 빈 상태 문구와 CTA를 제공한다.
3. 조회/변경 모달의 에러 메시지를 액션별로 더 구체화한다.
4. 자동완성, 모달, 버튼에 접근성 속성을 보강한다.

### 7.3 기능

1. 관리자 화면에서 슬롯 추가/수정/비활성화 기능을 제공한다.
2. 예약 내역 CSV/Excel 내보내기를 추가한다.
3. 예약 변경 이력과 관리자 액션 로그를 남긴다.
4. SMS 또는 카카오 알림 연동을 고려한다.

### 7.4 인프라

1. 투어 기능용 API/DB 모니터링 대시보드를 추가한다.
2. 수동 검증 위주의 현 상태를 Playwright E2E로 전환한다.
3. 마이그레이션 검증용 CI를 추가해 스키마 불일치를 줄인다.

## 8. 파일 구조

```text
docs/
  CODE_ANALYSIS_REPORT.md
  SURVEY_QUESTIONS.md
  TOUR_SYSTEM_REPORT.md

src/
  app/
    tour/
      layout.tsx
      page.tsx
      my/page.tsx
    admin/
      tour/page.tsx
    api/tour/
      admin/route.ts
      slots/route.ts
      leaders/route.ts
      leaders/[id]/route.ts
      reservations/route.ts
      reservations/public/route.ts
      reservations/lookup/route.ts
      reservations/manage/route.ts
      reservations/[id]/route.ts
  components/
    tour/TourLeaderAutocomplete.tsx
  lib/
    tour.ts
    tour-leaders.ts
    supabase-server.ts
    supabase.ts
    rate-limit.ts
    validators.ts
  types/
    tour.ts

supabase/
  migrations/
    20260306_create_tour_tables.sql
    20260306120000_secure_tour_reservations.sql
    20260306133000_create_tour_leaders.sql
    20260306160000_admin_roles.sql
    20260306170000_make_phone_email_optional.sql
    20260306180000_pin_based_auth.sql
    20260306190000_prevent_duplicate_leader.sql
    20260307000000_fix_pin_storage.sql
    20260307010000_drop_manage_token_unique_index.sql
```

## 9. 운영 가이드

### 9.1 필수 환경 변수

| 변수 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 API용 서비스 키 |
| `NEXT_PUBLIC_ADMIN_EMAIL` | fallback master 관리자 이메일 |

### 9.2 초기화/운영 SQL 예시

```sql
-- 활성 예약 전체 취소
UPDATE public.tour_reservations
SET status = 'cancelled'
WHERE status = 'active';

-- 슬롯 재오픈
UPDATE public.tour_slots
SET is_active = true;

-- 신규 슬롯 추가
INSERT INTO public.tour_slots (tour_date, tour_time, time_label, max_capacity, is_active)
VALUES ('2026-05-23', '10:00', '오전 10시', 4, true);
```

### 9.3 운영 시 체크 포인트

- `SUPABASE_SERVICE_ROLE_KEY` 누락 여부
- `tour_slots.current_bookings`와 활성 예약 수 정합성
- `20260307010000_drop_manage_token_unique_index.sql` 적용 여부
- 관리자 권한 테이블 `admin_users.role` 값 검증

## 10. 작성 조언

- 이 문서는 현재 코드 기준 설명 문서로는 충분하지만, 테스트 결과 절은 자동화 근거가 없으므로 "수동 검증 기준"이라고 명시하는 편이 안전하다.
- 가장 먼저 보완할 부분은 PIN 평문 저장이다. `manage_token` UNIQUE 인덱스 제거는 마이그레이션 파일까지 준비된 상태다.
- 다음 우선순위는 메모리 기반 rate limit 교체와 Realtime 범위 확장이다.

## 11. 화면 동작 상세

### 11.1 `/tour` 신청 페이지

- 1단계와 2단계가 분리된 모바일 우선 UI다.
- 조장을 선택하기 전에는 슬롯 선택 영역이 반투명 상태로 잠겨 있다.
- 슬롯 카드는 날짜, 시간, 예약 진행률, 잔여석을 함께 표시한다.
- 신청은 바텀 시트 모달에서 마무리된다.
- 신청 폼 입력값은 현재 `PIN`, `memo` 두 개다.

### 11.2 `/tour/my` 조회/관리 페이지

- 메인 화면에서 전체 슬롯별 신청 현황을 먼저 공개한다.
- 마감 슬롯은 축약형 카드로 표시해 세로 공간을 줄인다.
- 개인 조회는 하단 모달에서 조장 선택 + PIN 입력으로 진행된다.
- 조회 후 상세 모달에서 취소 또는 변경 모달로 이어지는 2단계 구조다.

### 11.3 `/admin/tour` 관리자 페이지

- 상단 요약 카드에서 전체 슬롯, 총 신청, 총 정원, 잔여석을 확인할 수 있다.
- 조장 명단은 추가, 수정, 비활성화가 가능하다.
- 예약 목록은 슬롯 기준 필터링과 관리자 취소를 지원한다.
- 현재 슬롯 자체를 생성/수정하는 UI는 없다.

## 12. 테스트 한계 해설

### 12.1 `28 / 31 PASS`에서 남은 3건

남은 3건은 모두 "전체 마감 상태"를 전제로 한다.

1. 전체 마감 UI 표시
2. 마감 상태에서 일정 변경 불가
3. 캘린더뷰 전체 마감 표현

현재 기본 데이터는 다음과 같다.

- 활성 조장 수: 31명
- 총 슬롯 수: 9개
- 슬롯당 정원: 4명
- 총 정원: 36석

즉, 모든 조장이 신청해도 5석이 남으므로 "모든 슬롯이 꽉 찬 상태"를 자연스럽게 만들 수 없다. 이 때문에 테스트 실패라기보다 데이터셋 한계로 보는 편이 맞다.

### 12.2 지금 문서에서 조심해야 할 표현

- "실시간 504ms", "평균 응답 457ms" 같은 수치는 환경 의존적이다.
- 따라서 SLA처럼 단정하기보다 "기존 검증 기록 기준"이라고 유지하는 편이 안전하다.
- 투어 기능 자동화 테스트가 저장소에 없으므로 PASS 수치는 회귀 테스트 보장 수치가 아니다.

## 13. 권장 후속 작업 순서

### 13.1 즉시 처리

1. `20260307010000_drop_manage_token_unique_index.sql` 운영 DB 반영
2. `idx_tour_reservations_manage_token` 실제 제거 여부 확인
3. 운영 환경의 `SUPABASE_SERVICE_ROLE_KEY` 설정 재확인

### 13.2 다음 배포 전

1. PIN 해시 저장 방식 설계
2. 외부 저장소 기반 rate limit 적용
3. Realtime 대상 확장 또는 주기적 재조회 전략 결정

### 13.3 중기 개선

1. Playwright로 신청/조회/변경/취소 E2E 구축
2. 관리자용 슬롯 CRUD 추가
3. 감사 로그와 운영 대시보드 추가
