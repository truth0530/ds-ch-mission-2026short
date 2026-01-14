/**
 * 공통 유틸리티 함수
 */

/**
 * 부서명에 따른 배지 색상 반환
 */
export const getBadgeColor = (dept: string): string => {
    if (dept.includes('15252')) return 'bg-rose-100 text-rose-700 border-rose-200';
    if (dept.includes('청년')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (dept.includes('교육')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (dept.includes('오픈')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (dept.includes('글로벌')) return 'bg-violet-100 text-violet-700 border-violet-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
};

/**
 * 역할명에 따른 배지 색상 반환
 */
export const getRoleBadgeColor = (role: string): string => {
    switch (role) {
        case '선교사':
            return 'bg-emerald-100 text-emerald-700';
        case '인솔자':
            return 'bg-blue-100 text-blue-700';
        case '단기선교 팀원':
            return 'bg-amber-100 text-amber-700';
        default:
            return 'bg-slate-100 text-slate-600';
    }
};

/**
 * 날짜를 한국어 형식으로 포맷
 */
export const formatDateKR = (dateString: string): string => {
    return new Date(dateString).toLocaleString('ko-KR');
};

/**
 * 날짜를 간단한 형식으로 포맷 (YYYY-MM-DD)
 */
export const formatDateShort = (dateString: string): string => {
    return new Date(dateString).toISOString().split('T')[0];
};

/**
 * 클래스명 조합 유틸리티
 */
export const cn = (...classes: (string | boolean | undefined | null)[]): string => {
    return classes.filter(Boolean).join(' ');
};

/**
 * 기간 문자열에서 시작 점수 계산 (정렬용)
 * @param period - "월/일~월/일" 형식의 기간 문자열
 * @returns 정렬을 위한 숫자 점수 (월*100 + 일)
 */
export const getStartScore = (period: string): number => {
    const match = period.match(/^(\d+)\/(\d+)/);
    if (!match) return 9999;
    return parseInt(match[1], 10) * 100 + parseInt(match[2], 10);
};

/**
 * 팀 정렬 함수 (부서 그룹 -> 시작일 순)
 * @param teams - 정렬할 팀 배열
 * @returns 정렬된 팀 배열
 */
export const sortTeamsByDeptAndDate = <T extends { dept: string; period: string }>(teams: T[]): T[] => {
    return [...teams].sort((a, b) => {
        // 1. Dept grouping (Korean sort)
        if (a.dept !== b.dept) {
            return a.dept.localeCompare(b.dept, 'ko');
        }
        // 2. Date sort (Ascending)
        return getStartScore(a.period) - getStartScore(b.period);
    });
};
