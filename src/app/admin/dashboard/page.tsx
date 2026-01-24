'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSbClient } from '@/lib/supabase';
import { TABLES, PAGINATION_DEFAULTS } from '@/lib/constants';
import { Evaluation, TeamInfo, ToastMessage } from '@/types';
import { validateEvaluations } from '@/lib/validators';
import { MISSION_TEAMS, getQuestionText, getScaleQuestionIds, getTextQuestions } from '@/lib/surveyData';
import { ToastContainer } from '@/components/ui/Toast';
import { useRequireAdmin } from '@/hooks/useAdminAuth';
import { AdminHeader, AdminLoginCard, AdminErrorAlert } from '@/components/admin';
import { ResponseDetailModal, DashboardFilters, ListModal, TextAnswersModal, Stats, FilterState } from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminDashboard() {
    const { user, isAuthorized, loading: authLoading, login, logout, error: authError, clearError, client } = useRequireAdmin();

    const [loading, setLoading] = useState(true);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [stats, setStats] = useState<Stats>({
        total: 0,
        byRole: { missionary: 0, leader: 0, team_member: 0 },
        teamMemberByTeam: {},
        missionaries: [],
        leaders: [],
        scaleAverages: []
    });

    // Pagination
    const [page, setPage] = useState<number>(PAGINATION_DEFAULTS.INITIAL_PAGE);
    const [totalCount, setTotalCount] = useState(0);
    const pageSize = PAGINATION_DEFAULTS.PAGE_SIZE;

    // Filters
    const [filters, setFilters] = useState<FilterState>({
        roleFilter: 'all',
        teamFilter: 'all',
        countryFilter: 'all',
        deptFilter: 'all',
        dateFrom: '',
        dateTo: '',
        searchQuery: '',
    });

    const handleFilterChange = useCallback((key: keyof FilterState, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters({
            roleFilter: 'all',
            teamFilter: 'all',
            countryFilter: 'all',
            deptFilter: 'all',
            dateFrom: '',
            dateTo: '',
            searchQuery: '',
        });
    }, []);

    // Detail Modal
    const [selectedEval, setSelectedEval] = useState<Evaluation | null>(null);
    const [selectedEvalIndex, setSelectedEvalIndex] = useState<number>(-1);
    const [contextEvaluations, setContextEvaluations] = useState<Evaluation[]>([]); // 현재 네비게이션 컨텍스트

    // List Modal
    const [listModalTitle, setListModalTitle] = useState<string>('');
    const [listModalEvaluations, setListModalEvaluations] = useState<Evaluation[]>([]);

    // Teams
    const [teams, setTeams] = useState<TeamInfo[]>(MISSION_TEAMS);

    // Toast
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    // Dashboard Tab
    const [dashboardTab, setDashboardTab] = useState<'charts' | 'text_answers'>('charts');

    // Text Answers Modal
    const [textAnswersModal, setTextAnswersModal] = useState<{
        isOpen: boolean;
        questionId: string;
        questionText: string;
        roleFilter: string;
    }>({
        isOpen: false,
        questionId: '',
        questionText: '',
        roleFilter: 'all',
    });

    const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
        const id = `toast-${Date.now()}`;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    const hideToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // Fetch data when authorized
    useEffect(() => {
        if (isAuthorized && client) {
            fetchData();
        }
    }, [isAuthorized, client]);

    const fetchData = async (pageNum = 0) => {
        setLoading(true);
        const client = getSbClient();
        if (!client) return;

        try {
            const [teamsResult, evaluationsResult] = await Promise.all([
                client.from(TABLES.TEAMS).select('*').order('country', { ascending: true }),
                client
                    .from(TABLES.EVALUATIONS)
                    .select('*', { count: 'exact' })
                    .order('created_at', { ascending: false })
                    .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)
            ]);

            const currentTeams = teamsResult.data && teamsResult.data.length > 0
                ? (teamsResult.data as TeamInfo[])
                : MISSION_TEAMS;
            setTeams(currentTeams);

            if (evaluationsResult.error) {
                showToast(`데이터 로드 실패: ${evaluationsResult.error.message}`, 'error');
            } else {
                const validatedData = validateEvaluations(evaluationsResult.data || []);
                setEvaluations(validatedData);
                setTotalCount(evaluationsResult.count || 0);
                calculateStats(validatedData, currentTeams);
            }
        } catch (error) {
            showToast('데이터를 불러오는 중 오류가 발생했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (data: Evaluation[], currentTeams: TeamInfo[] = teams) => {
        const newStats: Stats = {
            total: data.length,
            byRole: { missionary: 0, leader: 0, team_member: 0 },
            teamMemberByTeam: {},
            missionaries: [],
            leaders: [],
            scaleAverages: []
        };

        currentTeams.forEach(t => {
            if (t.missionary) newStats.teamMemberByTeam[t.missionary] = 0;
        });

        const scaleData: Record<string, { sum: number; count: number }> = {};
        const scaleQuestionIds = getScaleQuestionIds();

        data.forEach(evaluation => {
            if (evaluation.role === '선교사') {
                newStats.byRole.missionary++;
                newStats.missionaries.push(evaluation);
            } else if (evaluation.role === '인솔자') {
                newStats.byRole.leader++;
                newStats.leaders.push(evaluation);
            } else if (evaluation.role === '단기선교 팀원') {
                newStats.byRole.team_member++;
                const teamKey = evaluation.team_missionary || 'Unknown';
                newStats.teamMemberByTeam[teamKey] = (newStats.teamMemberByTeam[teamKey] || 0) + 1;
            }

            if (evaluation.answers) {
                Object.entries(evaluation.answers).forEach(([questionId, answer]) => {
                    if (scaleQuestionIds.includes(questionId)) {
                        const score = Number(answer);
                        if (!isNaN(score) && score >= 1 && score <= 7) {
                            if (!scaleData[questionId]) {
                                scaleData[questionId] = { sum: 0, count: 0 };
                            }
                            scaleData[questionId].sum += score;
                            scaleData[questionId].count++;
                        }
                    }
                });
            }
        });

        newStats.scaleAverages = Object.entries(scaleData)
            .map(([questionId, { sum, count }]) => ({
                questionId,
                questionText: getQuestionText(questionId),
                count,
                sum,
                average: count > 0 ? Math.round((sum / count) * 100) / 100 : 0
            }))
            .sort((a, b) => b.average - a.average);

        setStats(newStats);
    };

    const filteredEvaluations = useMemo(() => {
        const { roleFilter, teamFilter, countryFilter, deptFilter, dateFrom, dateTo, searchQuery } = filters;
        return evaluations.filter(evaluation => {
            if (roleFilter !== 'all' && evaluation.role !== roleFilter) return false;
            if (teamFilter !== 'all' && evaluation.team_missionary !== teamFilter) return false;
            if (countryFilter !== 'all' && evaluation.team_country !== countryFilter) return false;
            if (deptFilter !== 'all' && evaluation.team_dept !== deptFilter) return false;

            if (dateFrom || dateTo) {
                const evalDate = new Date(evaluation.created_at).toISOString().split('T')[0];
                if (dateFrom && evalDate < dateFrom) return false;
                if (dateTo && evalDate > dateTo) return false;
            }

            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    evaluation.respondent_name?.toLowerCase().includes(query) ||
                    evaluation.respondent_email?.toLowerCase().includes(query) ||
                    evaluation.team_missionary?.toLowerCase().includes(query)
                );
            }
            return true;
        });
    }, [evaluations, filters]);

    // 필터링된 데이터 기반 역할별 통계
    const filteredStats = useMemo(() => {
        const byRole = { missionary: 0, leader: 0, team_member: 0 };
        const missionaries: Evaluation[] = [];
        const leaders: Evaluation[] = [];

        filteredEvaluations.forEach(evaluation => {
            if (evaluation.role === '선교사') {
                byRole.missionary++;
                missionaries.push(evaluation);
            } else if (evaluation.role === '인솔자') {
                byRole.leader++;
                leaders.push(evaluation);
            } else if (evaluation.role === '단기선교 팀원') {
                byRole.team_member++;
            }
        });

        return { byRole, missionaries, leaders };
    }, [filteredEvaluations]);

    const openEvalDetail = useCallback((evaluation: Evaluation, index: number, context?: Evaluation[]) => {
        setSelectedEval(evaluation);
        setSelectedEvalIndex(index);
        setContextEvaluations(context || filteredEvaluations);
    }, [filteredEvaluations]);

    const closeModal = useCallback(() => {
        setSelectedEval(null);
        setSelectedEvalIndex(-1);
        setContextEvaluations([]);
    }, []);

    const closeListModal = useCallback(() => {
        setListModalTitle('');
        setListModalEvaluations([]);
    }, []);

    const showMissionaryList = useCallback(() => {
        setListModalTitle('선교사 목록');
        setListModalEvaluations(filteredStats.missionaries);
    }, [filteredStats.missionaries]);

    const showLeaderList = useCallback(() => {
        setListModalTitle('인솔자 목록');
        setListModalEvaluations(filteredStats.leaders);
    }, [filteredStats.leaders]);

    const showAllResponses = useCallback(() => {
        setListModalTitle('전체 응답');
        setListModalEvaluations(filteredEvaluations);
    }, [filteredEvaluations]);

    const showTeamMemberList = useCallback(() => {
        const teamMembers = filteredEvaluations.filter(e => e.role === '단기선교 팀원');
        setListModalTitle('팀원 목록');
        setListModalEvaluations(teamMembers);
    }, [filteredEvaluations]);

    const handleListItemClick = useCallback((evaluation: Evaluation, index: number) => {
        // listModalEvaluations를 컨텍스트로 사용하여 해당 그룹 내에서만 탐색
        const currentList = [...listModalEvaluations];
        closeListModal();
        openEvalDetail(evaluation, index, currentList);
    }, [closeListModal, listModalEvaluations, openEvalDetail]);

    const navigatePrevEval = useCallback(() => {
        if (selectedEvalIndex > 0 && contextEvaluations.length > 0) {
            const newIndex = selectedEvalIndex - 1;
            setSelectedEval(contextEvaluations[newIndex]);
            setSelectedEvalIndex(newIndex);
        }
    }, [selectedEvalIndex, contextEvaluations]);

    const navigateNextEval = useCallback(() => {
        if (selectedEvalIndex < contextEvaluations.length - 1 && contextEvaluations.length > 0) {
            const newIndex = selectedEvalIndex + 1;
            setSelectedEval(contextEvaluations[newIndex]);
            setSelectedEvalIndex(newIndex);
        }
    }, [selectedEvalIndex, contextEvaluations]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedEval) return;
            if (e.key === 'ArrowLeft') {
                navigatePrevEval();
            } else if (e.key === 'ArrowRight') {
                navigateNextEval();
            } else if (e.key === 'Escape') {
                closeModal();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedEval, navigatePrevEval, navigateNextEval, closeModal]);

    const uniqueCountries = useMemo(() =>
        Array.from(new Set(evaluations.map(e => e.team_country).filter(Boolean))).sort(),
        [evaluations]
    );

    const uniqueDepts = useMemo(() =>
        Array.from(new Set(evaluations.map(e => e.team_dept).filter(Boolean))).sort(),
        [evaluations]
    );

    const scaleDistributions = useMemo(() => {
        const scaleQuestionIds = getScaleQuestionIds();
        const distributions: Record<string, { questionText: string; counts: number[] }> = {};

        scaleQuestionIds.forEach(qId => {
            distributions[qId] = {
                questionText: getQuestionText(qId),
                counts: [0, 0, 0, 0, 0, 0, 0]
            };
        });

        filteredEvaluations.forEach(evaluation => {
            if (evaluation.answers) {
                Object.entries(evaluation.answers).forEach(([questionId, answer]) => {
                    if (distributions[questionId]) {
                        const score = Number(answer);
                        if (!isNaN(score) && score >= 1 && score <= 7) {
                            distributions[questionId].counts[score - 1]++;
                        }
                    }
                });
            }
        });

        return Object.entries(distributions)
            .filter(([, data]) => data.counts.some(c => c > 0))
            .map(([questionId, data]) => ({ questionId, ...data }));
    }, [filteredEvaluations]);

    // 필터링된 데이터 기반 척도 평균 계산
    const filteredScaleAverages = useMemo(() => {
        const scaleQuestionIds = getScaleQuestionIds();
        const scaleData: Record<string, { sum: number; count: number }> = {};

        filteredEvaluations.forEach(evaluation => {
            if (evaluation.answers) {
                Object.entries(evaluation.answers).forEach(([questionId, answer]) => {
                    if (scaleQuestionIds.includes(questionId)) {
                        const score = Number(answer);
                        if (!isNaN(score) && score >= 1 && score <= 7) {
                            if (!scaleData[questionId]) {
                                scaleData[questionId] = { sum: 0, count: 0 };
                            }
                            scaleData[questionId].sum += score;
                            scaleData[questionId].count++;
                        }
                    }
                });
            }
        });

        return Object.entries(scaleData)
            .map(([questionId, { sum, count }]) => ({
                questionId,
                questionText: getQuestionText(questionId),
                count,
                sum,
                average: count > 0 ? Math.round((sum / count) * 100) / 100 : 0
            }))
            .sort((a, b) => b.average - a.average);
    }, [filteredEvaluations]);

    // 서술형 문항 목록 (응답 개수 포함)
    const textQuestionsWithCounts = useMemo(() => {
        const textQuestions = getTextQuestions();
        return textQuestions.map(q => {
            let totalCount = 0;
            let missionaryCount = 0;
            let leaderCount = 0;
            let teamMemberCount = 0;

            filteredEvaluations.forEach(evaluation => {
                const answer = evaluation.answers?.[q.id];
                if (answer && typeof answer === 'string' && answer.trim()) {
                    totalCount++;
                    if (evaluation.role === '선교사') missionaryCount++;
                    else if (evaluation.role === '인솔자') leaderCount++;
                    else if (evaluation.role === '단기선교 팀원') teamMemberCount++;
                }
            });

            return {
                ...q,
                totalCount,
                missionaryCount,
                leaderCount,
                teamMemberCount,
            };
        }).filter(q => q.totalCount > 0);
    }, [filteredEvaluations]);

    // 선택된 문항의 답변 데이터
    const selectedQuestionAnswers = useMemo(() => {
        if (!textAnswersModal.isOpen || !textAnswersModal.questionId) return [];

        return filteredEvaluations
            .filter(evaluation => {
                const answer = evaluation.answers?.[textAnswersModal.questionId];
                return answer && typeof answer === 'string' && answer.trim();
            })
            .map(evaluation => ({
                evaluation,
                answer: String(evaluation.answers?.[textAnswersModal.questionId] || ''),
            }));
    }, [filteredEvaluations, textAnswersModal.isOpen, textAnswersModal.questionId]);

    // 선택된 문항의 역할별 답변 수
    const selectedQuestionRoleCounts = useMemo(() => {
        const counts = { total: 0, missionary: 0, leader: 0, team_member: 0 };
        selectedQuestionAnswers.forEach(({ evaluation }) => {
            counts.total++;
            if (evaluation.role === '선교사') counts.missionary++;
            else if (evaluation.role === '인솔자') counts.leader++;
            else if (evaluation.role === '단기선교 팀원') counts.team_member++;
        });
        return counts;
    }, [selectedQuestionAnswers]);

    const openTextAnswersModal = useCallback((questionId: string, questionText: string) => {
        setTextAnswersModal({
            isOpen: true,
            questionId,
            questionText,
            roleFilter: 'all',
        });
    }, []);

    const closeTextAnswersModal = useCallback(() => {
        setTextAnswersModal(prev => ({ ...prev, isOpen: false }));
    }, []);

    const handleTextAnswersRoleFilter = useCallback((role: string) => {
        setTextAnswersModal(prev => ({ ...prev, roleFilter: role }));
    }, []);

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAuthorized) {
        return <AdminLoginCard user={user} onLogin={() => login('/admin/dashboard')} onLogout={logout} title="대시보드" />;
    }

    const uniqueTeams = Array.from(new Set(evaluations.map(e => e.team_missionary))).filter(Boolean);

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-sm">
            <ToastContainer toasts={toasts} onClose={hideToast} />

            <AdminHeader
                activePage="dashboard"
                onLogout={logout}
                rightContent={<span className="text-xs text-gray-500 hidden sm:inline">{user?.email}</span>}
            />

            <main className="max-w-screen-xl mx-auto px-4 py-3">
                <AdminErrorAlert error={authError} onDismiss={clearError} />

                <DashboardFilters
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    onReset={resetFilters}
                    uniqueTeams={uniqueTeams as string[]}
                    uniqueCountries={uniqueCountries as string[]}
                    uniqueDepts={uniqueDepts as string[]}
                />

                {/* Tabs + Summary Cards in one row */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                    {/* Dashboard Tabs */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setDashboardTab('charts')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${dashboardTab === 'charts' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                        >
                            통계 차트
                        </button>
                        <button
                            onClick={() => setDashboardTab('text_answers')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${dashboardTab === 'text_answers' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                        >
                            주관식 답변보기
                        </button>
                    </div>

                    {/* All Summary Cards in one row */}
                    {/* 전체 */}
                    <div className={`flex items-center rounded-full border overflow-hidden transition-all ${filters.roleFilter === 'all' ? 'bg-slate-100 border-slate-400' : 'bg-white border-slate-200'}`}>
                        <button
                            onClick={() => handleFilterChange('roleFilter', 'all')}
                            className="flex items-center gap-6 px-6 py-2 text-xs hover:bg-slate-50 transition-colors"
                        >
                            <span className="text-muted-foreground">전체</span>
                            <span className="font-bold text-sm text-foreground">{filteredEvaluations.length}</span>
                        </button>
                        <div className="w-px h-5 bg-slate-300" />
                        <button
                            onClick={showAllResponses}
                            className="px-5 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                            상세보기
                        </button>
                    </div>
                    {/* 선교사 */}
                    <div className={`flex items-center rounded-full border overflow-hidden transition-all ${filters.roleFilter === '선교사' ? 'bg-amber-50 border-amber-400' : 'bg-white border-slate-200'}`}>
                        <button
                            onClick={() => handleFilterChange('roleFilter', filters.roleFilter === '선교사' ? 'all' : '선교사')}
                            className="flex items-center gap-6 px-6 py-2 text-xs hover:bg-amber-50 transition-colors"
                        >
                            <span className="text-muted-foreground">선교사</span>
                            <span className="font-bold text-sm text-amber-600">{filteredStats.byRole.missionary}</span>
                        </button>
                        <div className="w-px h-5 bg-amber-300" />
                        <button
                            onClick={showMissionaryList}
                            className="px-5 py-2 text-xs text-amber-500 hover:text-amber-700 hover:bg-amber-100 transition-colors"
                        >
                            상세보기
                        </button>
                    </div>
                    {/* 인솔자 */}
                    <div className={`flex items-center rounded-full border overflow-hidden transition-all ${filters.roleFilter === '인솔자' ? 'bg-emerald-50 border-emerald-400' : 'bg-white border-slate-200'}`}>
                        <button
                            onClick={() => handleFilterChange('roleFilter', filters.roleFilter === '인솔자' ? 'all' : '인솔자')}
                            className="flex items-center gap-6 px-6 py-2 text-xs hover:bg-emerald-50 transition-colors"
                        >
                            <span className="text-muted-foreground">인솔자</span>
                            <span className="font-bold text-sm text-emerald-600">{filteredStats.byRole.leader}</span>
                        </button>
                        <div className="w-px h-5 bg-emerald-300" />
                        <button
                            onClick={showLeaderList}
                            className="px-5 py-2 text-xs text-emerald-500 hover:text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                            상세보기
                        </button>
                    </div>
                    {/* 팀원 */}
                    <div className={`flex items-center rounded-full border overflow-hidden transition-all ${filters.roleFilter === '단기선교 팀원' ? 'bg-blue-50 border-blue-400' : 'bg-white border-slate-200'}`}>
                        <button
                            onClick={() => handleFilterChange('roleFilter', filters.roleFilter === '단기선교 팀원' ? 'all' : '단기선교 팀원')}
                            className="flex items-center gap-6 px-6 py-2 text-xs hover:bg-blue-50 transition-colors"
                        >
                            <span className="text-muted-foreground">팀원</span>
                            <span className="font-bold text-sm text-blue-600">{filteredStats.byRole.team_member}</span>
                        </button>
                        <div className="w-px h-5 bg-blue-300" />
                        <button
                            onClick={showTeamMemberList}
                            className="px-5 py-2 text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                            상세보기
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-muted border-t-foreground rounded-full animate-spin"></div>
                    </div>
                ) : dashboardTab === 'charts' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 척도 평균 순위 */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">척도 평균 순위 (1~7점)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {filteredScaleAverages.length > 0 ? (
                                    <div className="space-y-3">
                                        {filteredScaleAverages.slice(0, 10).map((stat, idx) => {
                                            const percentage = (stat.average / 7) * 100;
                                            const barColor = stat.average >= 6 ? 'bg-emerald-500' : stat.average >= 5 ? 'bg-blue-500' : stat.average >= 4 ? 'bg-amber-500' : 'bg-red-500';
                                            return (
                                                <div key={stat.questionId} className="flex items-center gap-3">
                                                    <span className="text-sm text-muted-foreground w-5 font-medium">{idx + 1}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm text-foreground truncate mb-1" title={stat.questionText}>
                                                            {stat.questionText}
                                                        </div>
                                                        <div className="h-5 bg-muted rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full ${barColor} rounded-full transition-all duration-300`}
                                                                style={{ width: `${percentage}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="text-right w-16">
                                                        <span className="text-lg font-bold text-foreground">{stat.average.toFixed(1)}</span>
                                                        <span className="text-xs text-muted-foreground ml-1">({stat.count})</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center text-muted-foreground py-12 text-sm">데이터 없음</div>
                                )}
                            </CardContent>
                        </Card>

                        {/* 점수 분포 차트 */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">점수 분포</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {scaleDistributions.length > 0 ? (
                                    <div className="space-y-4">
                                        {scaleDistributions.slice(0, 6).map(dist => {
                                            const maxCount = Math.max(...dist.counts, 1);
                                            const total = dist.counts.reduce((a, b) => a + b, 0);
                                            return (
                                                <div key={dist.questionId}>
                                                    <div className="text-sm text-foreground truncate mb-2" title={dist.questionText}>
                                                        {dist.questionText}
                                                    </div>
                                                    <div className="flex items-end gap-1 h-12">
                                                        {dist.counts.map((count, idx) => {
                                                            const height = (count / maxCount) * 100;
                                                            const barColor = idx >= 5 ? 'bg-emerald-400' : idx >= 3 ? 'bg-blue-400' : 'bg-amber-400';
                                                            return (
                                                                <div key={idx} className="flex-1 flex flex-col items-center">
                                                                    <div
                                                                        className={`w-full ${barColor} rounded-t transition-all duration-300`}
                                                                        style={{ height: `${height}%`, minHeight: count > 0 ? '3px' : '0' }}
                                                                        title={`${idx + 1}점: ${count}명 (${total > 0 ? ((count / total) * 100).toFixed(0) : 0}%)`}
                                                                    />
                                                                    <span className="text-xs text-muted-foreground mt-1 font-medium">{idx + 1}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center text-muted-foreground py-12 text-sm">데이터 없음</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    /* 주관식 답변보기 */
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">주관식 문항 목록</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {textQuestionsWithCounts.length > 0 ? (
                                <div className="space-y-2">
                                    {textQuestionsWithCounts.map((q, idx) => (
                                        <div
                                            key={q.id}
                                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors"
                                        >
                                            <span className="text-sm text-muted-foreground w-6 font-medium">{idx + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-foreground line-clamp-2" title={q.text}>
                                                    {q.text}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-xs text-slate-500">
                                                        답변 <span className="font-semibold text-slate-700">{q.totalCount}</span>개
                                                    </span>
                                                    {q.missionaryCount > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                                                            선교사 {q.missionaryCount}
                                                        </span>
                                                    )}
                                                    {q.leaderCount > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                                                            인솔자 {q.leaderCount}
                                                        </span>
                                                    )}
                                                    {q.teamMemberCount > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                                            팀원 {q.teamMemberCount}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => openTextAnswersModal(q.id, q.text)}
                                                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors whitespace-nowrap"
                                            >
                                                상세보기
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground py-12 text-sm">
                                    {filters.roleFilter === 'all' ? '답변이 없습니다.' : `${filters.roleFilter} 답변이 없습니다.`}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </main>

            {selectedEval && (
                <ResponseDetailModal
                    evaluation={selectedEval}
                    index={selectedEvalIndex}
                    totalCount={contextEvaluations.length}
                    onClose={closeModal}
                    onPrev={navigatePrevEval}
                    onNext={navigateNextEval}
                    canGoPrev={selectedEvalIndex > 0}
                    canGoNext={selectedEvalIndex < contextEvaluations.length - 1}
                />
            )}

            {listModalEvaluations.length > 0 && (
                <ListModal
                    title={listModalTitle}
                    evaluations={listModalEvaluations}
                    onClose={closeListModal}
                    onViewDetail={handleListItemClick}
                />
            )}

            {textAnswersModal.isOpen && (
                <TextAnswersModal
                    questionId={textAnswersModal.questionId}
                    questionText={textAnswersModal.questionText}
                    answers={selectedQuestionAnswers}
                    onClose={closeTextAnswersModal}
                    roleFilter={textAnswersModal.roleFilter}
                    onRoleFilterChange={handleTextAnswersRoleFilter}
                    roleCounts={selectedQuestionRoleCounts}
                />
            )}
        </div>
    );
}
