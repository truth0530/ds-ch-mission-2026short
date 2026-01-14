# 코드 분석 보고서

**프로젝트**: ds-ch-mission-2026short
**분석일**: 2026-01-14
**분석 도구**: Claude Code

---

## 요약

| 카테고리 | 총 개수 | Critical | High | Medium | Low |
|----------|---------|----------|------|--------|-----|
| 에러 처리 | 7 | 6 | 1 | 0 | 0 |
| 타입 안정성 | 15 | 2 | 5 | 8 | 0 |
| 성능 | 8 | 0 | 0 | 8 | 0 |
| 보안 | 7 | 0 | 2 | 5 | 0 |
| 접근성 | 6 | 0 | 0 | 6 | 0 |
| 코드 품질 | 8 | 0 | 0 | 3 | 5 |
| React 패턴 | 5 | 0 | 0 | 3 | 2 |
| **총합** | **56** | **8** | **8** | **33** | **7** |

---

## Critical 이슈 (8개)

### 1. handleGoogleLogin 에러 처리 없음
- **파일**: `src/components/survey/SurveyContainer.tsx`
- **라인**: 151-157
- **문제**: OAuth 에러가 catch되지 않음

```typescript
// 현재 코드 (문제)
const handleGoogleLogin = useCallback(async () => {
    if (!sbClient) return;
    await sbClient.auth.signInWithOAuth({  // 에러 미처리
        provider: 'google',
        options: { redirectTo: window.location.origin }
    });
}, [sbClient]);

// 수정 제안
const handleGoogleLogin = useCallback(async () => {
    if (!sbClient) {
        setError('Supabase 클라이언트가 초기화되지 않았습니다.');
        return;
    }
    try {
        await sbClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
    } catch (error) {
        setError('로그인 중 오류가 발생했습니다: ' + String(error));
    }
}, [sbClient]);
```

### 2. handleLogout 에러 처리 없음
- **파일**: `src/components/survey/SurveyContainer.tsx`
- **라인**: 159-168
- **문제**: try-catch 누락

### 3. checkUserStatus 에러 처리 없음
- **파일**: `src/components/survey/SurveyContainer.tsx`
- **라인**: 105-149
- **문제**: 전체 함수에 try-catch 없음

### 4. handleLogin 에러 처리 누락 (Dashboard)
- **파일**: `src/app/admin/dashboard/page.tsx`
- **라인**: 134-143
- **문제**: OAuth 에러 미처리

### 5. handleLogin 에러 처리 누락 (Questions)
- **파일**: `src/app/admin/questions/page.tsx`
- **라인**: 188-202
- **문제**: OAuth 에러 미처리

### 6. handleAddQuestion 에러 처리
- **파일**: `src/app/admin/questions/page.tsx`
- **라인**: 274-296
- **문제**: try-catch 없음

### 7. SurveyCanvas any 타입 다수 (9개)
- **파일**: `src/components/SurveyCanvas.tsx`
- **라인**: 47, 53, 66, 81, 90-92, 121, 210, 223, 826
- **문제**: 타입 안정성 저하

```typescript
// 현재 코드 (문제)
const loadQuestions = async (client: any) => {
    data.forEach((q: any) => { ... });
};

// 수정 제안
const loadQuestions = async (client: SupabaseClient) => {
    data?.forEach((q: DbQuestion) => { ... });
};
```

### 8. LandingView any 타입
- **파일**: `src/components/survey/LandingView.tsx`
- **라인**: 6
- **문제**: auth 파라미터 타입 미정의

---

## High 이슈 (8개)

### 1. Header any 타입
- **파일**: `src/components/layout/Header.tsx`
- **라인**: 7
- **문제**: `user?: any` 타입 사용

### 2. handleSaveQuestion 에러 처리
- **파일**: `src/app/admin/questions/page.tsx`
- **라인**: 248-262
- **문제**: try-catch 없음

### 3. Avatar URL XSS 위험
- **파일**: `src/components/layout/Header.tsx`
- **라인**: 41
- **문제**: 사용자 메타데이터 검증 없음

```typescript
// 현재 코드 (위험)
src={user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user.email}`}

// 수정 제안
const safeAvatarUrl = user.user_metadata?.avatar_url
    ? sanitizeInput(user.user_metadata.avatar_url)
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || '')}`;
```

### 4. answers 출력 XSS 위험
- **파일**: `src/app/admin/dashboard/page.tsx`
- **라인**: 645-676
- **문제**: HTML 이스케이프 없음

### 5-8. 추가 타입 안정성 이슈
- SurveyFormView null 체크 누락 (라인 64)
- Dashboard teamsResult.data null 체크 (라인 170-182)
- Dashboard uniqueTeams forced non-null (라인 335)
- questions/page.tsx type 캐스팅 (라인 574)

---

## Medium 이슈 (33개)

### 성능 (8개)

| 파일 | 라인 | 문제 |
|------|------|------|
| RoleSelectionView.tsx | 9-44 | roles 배열 매 렌더링마다 재생성 |
| SurveyFormView.tsx | 70-77 | getBadgeColor 함수 재생성 |
| dashboard/page.tsx | 239-259 | exportToExcel useCallback 미사용 |
| questions/page.tsx | 35-43 | fetchTeams 메모이제이션 없음 |
| SurveyContainer.tsx | 29-32 | questions 타입 변환 매번 실행 |
| SurveyCanvas.tsx | 263-264 | cursorBlink 16ms마다 상태 업데이트 |
| dashboard/page.tsx | 223-237 | 검색 시 불필요한 리렌더링 |
| TeamSelectionView.tsx | 42-49 | getBadgeColor 중복 정의 |

### 접근성 (6개)

| 파일 | 라인 | 문제 |
|------|------|------|
| RoleSelectionView.tsx | 70-86 | 버튼 aria-label 없음 |
| TeamSelectionView.tsx | 88-90 | 버튼 aria-label 없음 |
| SurveyFormView.tsx | 225-244 | Scale 버튼 aria-label 없음 |
| SurveyFormView.tsx | 295-312 | 체크박스 aria-label 없음 |
| SurveyCanvas.tsx | 1070 | 키보드 지원 없음 |
| dashboard/page.tsx | 540-586 | 테이블 role="table" 없음 |

### 보안 (5개)

| 파일 | 라인 | 문제 |
|------|------|------|
| SurveyFormView.tsx | 182-188 | textarea 입력 저장 전 검증 |
| questions/page.tsx | 732 | 이메일 입력 즉시 검증 없음 |
| SurveyCanvas.tsx | 1093 | hidden textarea onChange 검증 |

### 코드 품질 (3개)

| 파일 | 문제 |
|------|------|
| SurveyFormView.tsx & TeamSelectionView.tsx | getBadgeColor 함수 중복 |
| dashboard & questions | 인증 로직 중복 |
| 전체 | 에러 처리 패턴 불일치 |

### React 패턴 (3개)

| 파일 | 라인 | 문제 |
|------|------|------|
| SurveyCanvas.tsx | 49-76 | 거대한 단일 state 객체 |
| SurveyContainer.tsx | 25-34 | Context 미사용 |
| dashboard/page.tsx | 22-54 | 페이지네이션/데이터 상태 분리 |

---

## Low 이슈 (7개)

### 코드 품질 (5개)
- SurveyCanvas.tsx: renderTeamPageStyling 미사용 함수 (라인 637)
- 불필요한 import 정리 필요
- console.error vs 무시 패턴 혼재
- 주석 스타일 불일치
- 파일 구조 개선 여지

### React 패턴 (2개)
- handleGoogleLogin 로딩 상태 없음
- handleLogout 로딩 상태 없음

---

## 수정 우선순위 권장

1. **에러 처리 (Critical)** - 크래시 방지
2. **any 타입 제거 (Critical/High)** - 컴파일 타임 버그 발견
3. **null 체크 추가 (High)** - 런타임 에러 방지
4. **XSS 보호 추가 (High)** - 보안 취약점 해결
5. **접근성 레이블 추가 (Medium)** - UX 개선
6. **중복 코드 리팩토링 (Medium)** - 유지보수성 향상
7. **성능 최적화 (Medium)** - useMemo/useCallback 적용

---

## 참고 파일 목록

### 주요 수정 대상
- `src/components/survey/SurveyContainer.tsx`
- `src/components/SurveyCanvas.tsx`
- `src/app/admin/dashboard/page.tsx`
- `src/app/admin/questions/page.tsx`
- `src/components/layout/Header.tsx`
- `src/components/survey/LandingView.tsx`
- `src/components/survey/SurveyFormView.tsx`
- `src/components/survey/RoleSelectionView.tsx`
- `src/components/survey/TeamSelectionView.tsx`

### 이미 개선된 파일
- `src/lib/validators.ts` - generateId 함수 추가
- `src/lib/constants.ts` - 상수 중앙화
- `src/hooks/useAdminAuth.ts` - 인증 훅
- `src/components/ui/Toast.tsx` - 토스트 컴포넌트

---

*이 보고서는 Claude Code에 의해 자동 생성되었습니다.*
