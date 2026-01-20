'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { getSbClient, SupabaseClient } from '@/lib/supabase';
import { ENV_CONFIG, TABLES, PAGINATION_DEFAULTS } from '@/lib/constants';
import { Evaluation, TeamInfo, ToastMessage } from '@/types';
import { validateEvaluations, sanitizeInput } from '@/lib/validators';
import { MISSION_TEAMS, getQuestionText, getQuestionType, getScaleQuestionIds } from '@/lib/surveyData';
import { ToastContainer } from '@/components/ui/Toast';

interface ScaleStats {
    questionId: string;
    questionText: string;
    count: number;
    sum: number;
    average: number;
}

interface Stats {
    total: number;
    byRole: { missionary: number; leader: number; team_member: number };
    teamMemberByTeam: Record<string, number>;
    missionaries: Evaluation[];
    leaders: Evaluation[];
    scaleAverages: ScaleStats[];
}

export default function AdminDashboard() {
    const [loading, setLoading] = useState(true);
    const [authLoading, setAuthLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [isAuthorized, setIsAuthorized] = useState(false);

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
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [teamFilter, setTeamFilter] = useState<string>('all');
    const [countryFilter, setCountryFilter] = useState<string>('all');
    const [deptFilter, setDeptFilter] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    // Analysis View Toggle
    const [showAnalysis, setShowAnalysis] = useState<boolean>(false);

    // Detail Modal
    const [selectedEval, setSelectedEval] = useState<Evaluation | null>(null);
    const [selectedEvalIndex, setSelectedEvalIndex] = useState<number>(-1);

    // Teams
    const [teams, setTeams] = useState<TeamInfo[]>(MISSION_TEAMS);

    // Toast
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

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

    useEffect(() => {
        let isMounted = true;
        let subscription: { unsubscribe: () => void } | null = null;

        const client = getSbClient();
        if (!client) {
            if (process.env.NODE_ENV === 'development') {
                console.error('Supabase client not initialized. Check environment variables.');
            }
            setAuthLoading(false);
            return;
        }

        client.auth.getSession()
            .then(({ data: { session } }) => {
                if (!isMounted) return;
                if (session?.user) {
                    checkAuthorization(client, session.user);
                } else {
                    setUser(null);
                    setIsAuthorized(false);
                    setAuthLoading(false);
                }
            })
            .catch((error) => {
                if (!isMounted) return;
                if (process.env.NODE_ENV === 'development') {
                    console.error('Failed to get session:', error);
                }
                setAuthLoading(false);
            });

        const { data } = client.auth.onAuthStateChange((_event, session) => {
            if (!isMounted) return;
            if (session?.user) {
                checkAuthorization(client, session.user);
            } else {
                setUser(null);
                setIsAuthorized(false);
                setAuthLoading(false);
            }
        });
        subscription = data.subscription;

        return () => {
            isMounted = false;
            subscription?.unsubscribe();
        };
    }, []);

    const checkAuthorization = async (client: SupabaseClient, currentUser: User) => {
        const { data } = await client
            .from(TABLES.ADMIN_USERS)
            .select('email')
            .eq('email', currentUser.email)
            .maybeSingle();

        const fallbackEmail = ENV_CONFIG.ADMIN_EMAIL;
        if (data || (fallbackEmail && currentUser.email === fallbackEmail)) {
            setUser(currentUser);
            setIsAuthorized(true);
            fetchData();
        } else {
            setIsAuthorized(false);
            setUser(currentUser);
        }
        setAuthLoading(false);
    };

    const handleLogin = async () => {
        const client = getSbClient();
        if (!client) {
            showToast('인증 서비스에 연결할 수 없습니다.', 'error');
            return;
        }
        try {
            const { error } = await client.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + '/admin/dashboard'
                }
            });
            if (error) {
                showToast('로그인 중 오류가 발생했습니다: ' + error.message, 'error');
            }
        } catch (e) {
            showToast('로그인 중 오류가 발생했습니다. 다시 시도해 주세요.', 'error');
            if (process.env.NODE_ENV === 'development') {
                console.error('Login error:', e);
            }
        }
    };

    const handleLogout = async () => {
        const client = getSbClient();
        if (!client) return;
        try {
            await client.auth.signOut();
        } catch (e) {
            if (process.env.NODE_ENV === 'development') {
                console.error('Logout error:', e);
            }
        } finally {
            window.location.reload();
        }
    };

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
    }, [evaluations, roleFilter, teamFilter, countryFilter, deptFilter, dateFrom, dateTo, searchQuery]);

    const openEvalDetail = useCallback((evaluation: Evaluation, index: number) => {
        setSelectedEval(evaluation);
        setSelectedEvalIndex(index);
    }, []);

    const navigatePrevEval = useCallback(() => {
        if (selectedEvalIndex > 0) {
            const newIndex = selectedEvalIndex - 1;
            setSelectedEval(filteredEvaluations[newIndex]);
            setSelectedEvalIndex(newIndex);
        }
    }, [selectedEvalIndex, filteredEvaluations]);

    const navigateNextEval = useCallback(() => {
        if (selectedEvalIndex < filteredEvaluations.length - 1) {
            const newIndex = selectedEvalIndex + 1;
            setSelectedEval(filteredEvaluations[newIndex]);
            setSelectedEvalIndex(newIndex);
        }
    }, [selectedEvalIndex, filteredEvaluations]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedEval) return;
            if (e.key === 'ArrowLeft') {
                navigatePrevEval();
            } else if (e.key === 'ArrowRight') {
                navigateNextEval();
            } else if (e.key === 'Escape') {
                setSelectedEval(null);
                setSelectedEvalIndex(-1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedEval, navigatePrevEval, navigateNextEval]);

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

    const teamComparison = useMemo(() => {
        const scaleQuestionIds = getScaleQuestionIds();
        const teamData: Record<string, { count: number; scores: Record<string, { sum: number; count: number }> }> = {};

        filteredEvaluations.forEach(evaluation => {
            const teamKey = evaluation.team_missionary || 'Unknown';
            if (!teamData[teamKey]) {
                teamData[teamKey] = { count: 0, scores: {} };
                scaleQuestionIds.forEach(qId => {
                    teamData[teamKey].scores[qId] = { sum: 0, count: 0 };
                });
            }
            teamData[teamKey].count++;

            if (evaluation.answers) {
                Object.entries(evaluation.answers).forEach(([questionId, answer]) => {
                    if (teamData[teamKey].scores[questionId]) {
                        const score = Number(answer);
                        if (!isNaN(score) && score >= 1 && score <= 7) {
                            teamData[teamKey].scores[questionId].sum += score;
                            teamData[teamKey].scores[questionId].count++;
                        }
                    }
                });
            }
        });

        return Object.entries(teamData)
            .filter(([, data]) => data.count > 0)
            .map(([team, data]) => ({
                team,
                responseCount: data.count,
                averages: Object.entries(data.scores).reduce((acc, [qId, { sum, count }]) => {
                    acc[qId] = count > 0 ? Math.round((sum / count) * 10) / 10 : null;
                    return acc;
                }, {} as Record<string, number | null>)
            }))
            .sort((a, b) => b.responseCount - a.responseCount);
    }, [filteredEvaluations]);

    const exportToExcel = () => {
        const exportData = filteredEvaluations.map(evaluation => {
            const baseInfo: Record<string, string | number> = {
                '역할': evaluation.role,
                '팀': evaluation.team_missionary || '-',
                '국가': evaluation.team_country || '-',
                '부서': evaluation.team_dept || '-',
                '인솔자': evaluation.team_leader || '-',
                '응답자 이름': evaluation.respondent_name || '익명',
                '응답자 이메일': evaluation.respondent_email || '익명',
                '제출일': evaluation.submission_date ? new Date(evaluation.submission_date).toLocaleDateString('ko-KR') : '-',
                '제출 시각': new Date(evaluation.created_at).toLocaleString('ko-KR')
            };

            Object.entries(evaluation.answers || {}).forEach(([questionId, answer]) => {
                const questionText = getQuestionText(questionId);
                const shortQuestion = questionText.length > 50 ? questionText.substring(0, 50) + '...' : questionText;
                baseInfo[shortQuestion] = Array.isArray(answer) ? answer.join(', ') : String(answer);
            });

            return baseInfo;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const colWidths = Object.keys(exportData[0] || {}).map(key => ({
            wch: Math.min(Math.max(key.length, 10), 50)
        }));
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '설문 응답');
        XLSX.writeFile(wb, `설문응답_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('Excel 파일이 다운로드되었습니다.', 'success');
    };

    const handlePrevPage = () => {
        if (page > 0) {
            const newPage = page - 1;
            setPage(newPage);
            fetchData(newPage);
        }
    };

    const handleNextPage = () => {
        if ((page + 1) * pageSize < totalCount) {
            const newPage = page + 1;
            setPage(newPage);
            fetchData(newPage);
        }
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-lg shadow-sm w-full max-w-sm text-center border border-gray-200">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-lg font-bold mb-1 text-gray-900">관리자 로그인</h1>
                    <p className="text-gray-500 text-sm mb-6">
                        {user ? `${user.email}은 권한이 없습니다.` : '관리자 계정으로 로그인해 주세요.'}
                    </p>
                    {!user ? (
                        <button onClick={handleLogin} className="w-full py-3 bg-white border border-gray-200 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors text-sm">
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="" />
                            Google 로그인
                        </button>
                    ) : (
                        <button onClick={handleLogout} className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors text-sm">
                            다른 계정으로 로그인
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const uniqueTeams = Array.from(new Set(evaluations.map(e => e.team_missionary))).filter(Boolean);
    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-sm">
            <ToastContainer toasts={toasts} onClose={hideToast} />

            {/* Compact Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-screen-xl mx-auto px-4 h-11 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="font-bold text-gray-900">Mission Survey</span>
                        <nav className="flex items-center gap-1 text-xs">
                            <a href="/admin/dashboard" className="px-3 py-1.5 bg-gray-100 text-gray-900 rounded font-medium">대시보드</a>
                            <a href="/admin/responses" className="px-3 py-1.5 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-50">응답시트</a>
                            <a href="/admin/questions" className="px-3 py-1.5 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-50">설정</a>
                        </nav>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 hidden sm:inline">{user?.email}</span>
                        <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-red-500" title="로그아웃">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-screen-xl mx-auto px-4 py-4">
                {/* Summary Bar */}
                <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-wrap items-center gap-4 text-xs">
                    <div className="flex items-center gap-6">
                        <div><span className="text-gray-500">전체</span> <span className="font-bold text-gray-900 ml-1">{totalCount}</span></div>
                        <div><span className="text-gray-500">선교사</span> <span className="font-semibold text-amber-600 ml-1">{stats.byRole.missionary}</span></div>
                        <div><span className="text-gray-500">인솔자</span> <span className="font-semibold text-emerald-600 ml-1">{stats.byRole.leader}</span></div>
                        <div><span className="text-gray-500">팀원</span> <span className="font-semibold text-blue-600 ml-1">{stats.byRole.team_member}</span></div>
                    </div>
                    <div className="flex-1" />
                    <button
                        onClick={() => setShowAnalysis(!showAnalysis)}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${showAnalysis ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        {showAnalysis ? '분석 닫기' : '통계 분석'}
                    </button>
                    <button onClick={exportToExcel} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 transition-colors">
                        Excel 내보내기
                    </button>
                </div>

                {/* Analysis Panel */}
                {showAnalysis && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 space-y-4">
                        {/* Scale Averages */}
                        {stats.scaleAverages.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-gray-700 mb-2">척도 질문 평균 (1~7점)</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {stats.scaleAverages.map(stat => (
                                        <div key={stat.questionId} className="p-2 bg-gray-50 rounded border border-gray-100">
                                            <div className="text-[10px] text-gray-500 truncate mb-1" title={stat.questionText}>{stat.questionText}</div>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-lg font-bold text-gray-900">{stat.average.toFixed(1)}</span>
                                                <span className="text-[10px] text-gray-400">({stat.count}명)</span>
                                            </div>
                                            <div className="mt-1 h-1 bg-gray-200 rounded-full">
                                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(stat.average / 7) * 100}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Score Distribution */}
                        {scaleDistributions.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-gray-700 mb-2">응답 분포</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {scaleDistributions.slice(0, 6).map(dist => {
                                        const maxCount = Math.max(...dist.counts, 1);
                                        return (
                                            <div key={dist.questionId} className="p-2 bg-gray-50 rounded border border-gray-100">
                                                <div className="text-[10px] text-gray-500 truncate mb-2" title={dist.questionText}>{dist.questionText}</div>
                                                <div className="flex items-end gap-0.5 h-10">
                                                    {dist.counts.map((count, idx) => (
                                                        <div key={idx} className="flex-1 flex flex-col items-center">
                                                            <div className="w-full bg-blue-400 rounded-t" style={{ height: `${(count / maxCount) * 100}%`, minHeight: count > 0 ? '2px' : '0' }} title={`${idx + 1}점: ${count}명`} />
                                                            <span className="text-[8px] text-gray-400 mt-0.5">{idx + 1}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Team Comparison */}
                        {teamComparison.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-gray-700 mb-2">팀별 비교</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-gray-200">
                                                <th className="text-left py-1.5 px-2 font-medium text-gray-600">팀</th>
                                                <th className="text-center py-1.5 px-2 font-medium text-gray-600">N</th>
                                                {getScaleQuestionIds().slice(0, 5).map(qId => (
                                                    <th key={qId} className="text-center py-1.5 px-2 font-medium text-gray-500" title={getQuestionText(qId)}>{qId}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {teamComparison.slice(0, 8).map(row => (
                                                <tr key={row.team} className="border-b border-gray-50 hover:bg-gray-50">
                                                    <td className="py-1.5 px-2 font-medium text-gray-800">{row.team}</td>
                                                    <td className="py-1.5 px-2 text-center text-gray-600">{row.responseCount}</td>
                                                    {getScaleQuestionIds().slice(0, 5).map(qId => {
                                                        const avg = row.averages[qId];
                                                        const color = avg === null ? 'text-gray-300' : avg >= 6 ? 'text-emerald-600' : avg >= 5 ? 'text-blue-600' : avg >= 4 ? 'text-amber-600' : 'text-red-600';
                                                        return <td key={qId} className={`py-1.5 px-2 text-center font-medium ${color}`}>{avg !== null ? avg.toFixed(1) : '-'}</td>;
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="all">모든 역할</option>
                            <option value="선교사">선교사</option>
                            <option value="인솔자">인솔자</option>
                            <option value="단기선교 팀원">단기선교 팀원</option>
                        </select>
                        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="all">모든 팀</option>
                            {uniqueTeams.map(team => <option key={team} value={team!}>{team}</option>)}
                        </select>
                        <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="all">모든 국가</option>
                            {uniqueCountries.map(c => <option key={c} value={c!}>{c}</option>)}
                        </select>
                        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="all">모든 부서</option>
                            {uniqueDepts.map(d => <option key={d} value={d!}>{d}</option>)}
                        </select>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        <span className="text-gray-300">~</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        <input type="text" placeholder="검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 w-32" />
                        <button onClick={() => { setRoleFilter('all'); setTeamFilter('all'); setCountryFilter('all'); setDeptFilter('all'); setDateFrom(''); setDateTo(''); setSearchQuery(''); }} className="text-xs text-gray-400 hover:text-gray-600 px-2">초기화</button>
                        <div className="flex-1" />
                        <span className="text-xs text-gray-500">
                            <span className="font-semibold text-gray-700">{filteredEvaluations.length}</span> / {totalCount}건
                        </span>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {/* Left Sidebar - Team/Role Summary */}
                    <div className="lg:col-span-1 space-y-4">
                        {/* Team Breakdown */}
                        <div className="bg-white border border-gray-200 rounded-lg">
                            <div className="px-3 py-2 border-b border-gray-100 font-semibold text-xs text-gray-700">팀별 제출</div>
                            <div className="max-h-48 overflow-y-auto">
                                {teams.map(team => {
                                    const count = stats.teamMemberByTeam[team.missionary] || 0;
                                    return (
                                        <div key={team.id || team.missionary} className="px-3 py-1.5 flex items-center justify-between text-xs border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                            <span className="text-gray-700 truncate flex-1" title={team.missionary}>{team.missionary}</span>
                                            <span className={`font-medium ${count > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Missionary List */}
                        <div className="bg-white border border-gray-200 rounded-lg">
                            <div className="px-3 py-2 border-b border-gray-100 font-semibold text-xs text-gray-700">선교사 ({stats.missionaries.length})</div>
                            <div className="max-h-36 overflow-y-auto">
                                {stats.missionaries.length > 0 ? stats.missionaries.map(m => {
                                    const idx = filteredEvaluations.findIndex(e => e.id === m.id);
                                    return (
                                        <div key={m.id} className="px-3 py-1.5 flex items-center justify-between text-xs border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                            <span className="text-gray-700">{m.respondent_name || '익명'}</span>
                                            <button onClick={() => openEvalDetail(m, idx >= 0 ? idx : 0)} className="text-blue-500 hover:text-blue-700 text-[10px]">보기</button>
                                        </div>
                                    );
                                }) : <div className="px-3 py-3 text-center text-gray-400 text-xs">없음</div>}
                            </div>
                        </div>

                        {/* Leader List */}
                        <div className="bg-white border border-gray-200 rounded-lg">
                            <div className="px-3 py-2 border-b border-gray-100 font-semibold text-xs text-gray-700">인솔자 ({stats.leaders.length})</div>
                            <div className="max-h-36 overflow-y-auto">
                                {stats.leaders.length > 0 ? stats.leaders.map(l => {
                                    const idx = filteredEvaluations.findIndex(e => e.id === l.id);
                                    return (
                                        <div key={l.id} className="px-3 py-1.5 flex items-center justify-between text-xs border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                            <span className="text-gray-700">{l.respondent_name || '익명'}</span>
                                            <button onClick={() => openEvalDetail(l, idx >= 0 ? idx : 0)} className="text-blue-500 hover:text-blue-700 text-[10px]">보기</button>
                                        </div>
                                    );
                                }) : <div className="px-3 py-3 text-center text-gray-400 text-xs">없음</div>}
                            </div>
                        </div>
                    </div>

                    {/* Main Table */}
                    <div className="lg:col-span-3">
                        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                            {loading ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-gray-50 border-b border-gray-200">
                                                <tr>
                                                    <th className="text-left py-2 px-3 font-medium text-gray-600">역할</th>
                                                    <th className="text-left py-2 px-3 font-medium text-gray-600">팀</th>
                                                    <th className="text-left py-2 px-3 font-medium text-gray-600">응답자</th>
                                                    <th className="text-left py-2 px-3 font-medium text-gray-600">제출일</th>
                                                    <th className="text-center py-2 px-3 font-medium text-gray-600">응답</th>
                                                    <th className="text-right py-2 px-3 font-medium text-gray-600"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredEvaluations.map((evaluation, index) => (
                                                    <tr key={evaluation.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => openEvalDetail(evaluation, index)}>
                                                        <td className="py-2 px-3">
                                                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${evaluation.role === '선교사' ? 'bg-amber-100 text-amber-700' : evaluation.role === '인솔자' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                {evaluation.role === '단기선교 팀원' ? '팀원' : evaluation.role}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3 text-gray-700">{evaluation.team_missionary || '-'}</td>
                                                        <td className="py-2 px-3">
                                                            <div className="text-gray-800">{evaluation.respondent_name || '익명'}</div>
                                                            <div className="text-[10px] text-gray-400">{evaluation.respondent_email || ''}</div>
                                                        </td>
                                                        <td className="py-2 px-3 text-gray-600">{evaluation.submission_date ? new Date(evaluation.submission_date).toLocaleDateString('ko-KR') : '-'}</td>
                                                        <td className="py-2 px-3 text-center text-gray-600">{Object.keys(evaluation.answers || {}).length}</td>
                                                        <td className="py-2 px-3 text-right">
                                                            <button className="text-blue-500 hover:text-blue-700">상세</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {filteredEvaluations.length === 0 && (
                                            <div className="text-center py-12 text-gray-400">데이터가 없습니다.</div>
                                        )}
                                    </div>

                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-center gap-3 py-3 border-t border-gray-100">
                                            <button onClick={handlePrevPage} disabled={page === 0} className="px-3 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed">이전</button>
                                            <span className="text-xs text-gray-500">{page + 1} / {totalPages}</span>
                                            <button onClick={handleNextPage} disabled={(page + 1) * pageSize >= totalCount} className="px-3 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed">다음</button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Detail Modal */}
            {selectedEval && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setSelectedEval(null); setSelectedEvalIndex(-1); }}>
                    <div className="bg-white rounded-lg max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <h3 className="font-bold text-gray-900">응답 상세</h3>
                                <span className="text-xs text-gray-400">{selectedEvalIndex + 1} / {filteredEvaluations.length}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={navigatePrevEval} disabled={selectedEvalIndex <= 0} className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30" title="이전 (←)">
                                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <button onClick={navigateNextEval} disabled={selectedEvalIndex >= filteredEvaluations.length - 1} className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30" title="다음 (→)">
                                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                </button>
                                <div className="w-px h-4 bg-gray-200 mx-1" />
                                <button onClick={() => { setSelectedEval(null); setSelectedEvalIndex(-1); }} className="p-1.5 hover:bg-gray-100 rounded" title="닫기 (Esc)">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>

                        <div className="overflow-y-auto max-h-[calc(85vh-56px)]">
                            {/* Meta Info */}
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                                <div><span className="text-gray-400 block">역할</span><span className="font-medium text-gray-800">{selectedEval.role}</span></div>
                                <div><span className="text-gray-400 block">팀</span><span className="font-medium text-gray-800">{selectedEval.team_missionary || '-'}</span></div>
                                <div><span className="text-gray-400 block">국가</span><span className="font-medium text-gray-800">{selectedEval.team_country || '-'}</span></div>
                                <div><span className="text-gray-400 block">부서</span><span className="font-medium text-gray-800">{selectedEval.team_dept || '-'}</span></div>
                                <div><span className="text-gray-400 block">응답자</span><span className="font-medium text-gray-800">{selectedEval.respondent_name || '익명'}</span></div>
                                <div><span className="text-gray-400 block">제출일</span><span className="font-medium text-gray-800">{new Date(selectedEval.created_at).toLocaleString('ko-KR')}</span></div>
                            </div>

                            {/* Answers */}
                            <div className="p-4 space-y-2">
                                {Object.entries(selectedEval.answers || {}).map(([key, value]) => {
                                    const questionText = getQuestionText(key);
                                    const questionType = getQuestionType(key);
                                    const isScale = questionType === 'scale';

                                    return (
                                        <div key={key} className="p-3 bg-gray-50 rounded-lg">
                                            <div className="text-xs text-gray-500 mb-1">{sanitizeInput(questionText)}</div>
                                            <div className={`font-medium ${isScale ? 'text-blue-600 text-lg' : 'text-gray-800 text-sm'}`}>
                                                {isScale ? (
                                                    <span>{sanitizeInput(String(value))} <span className="text-xs font-normal text-gray-400">/ 7</span></span>
                                                ) : (
                                                    Array.isArray(value) ? value.map(v => sanitizeInput(String(v))).join(', ') : sanitizeInput(String(value))
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <button onClick={navigatePrevEval} disabled={selectedEvalIndex <= 0} className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-30 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                                        이전
                                    </button>
                                    <button onClick={navigateNextEval} disabled={selectedEvalIndex >= filteredEvaluations.length - 1} className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-30 flex items-center gap-1">
                                        다음
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                    <span className="text-[10px] text-gray-400 ml-2">키보드: ← → Esc</span>
                                </div>
                                <button onClick={() => { setSelectedEval(null); setSelectedEvalIndex(-1); }} className="px-4 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-800">닫기</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
