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

        // Check initial session with error handling
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

        // Listen for auth changes
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

    // Fetch Data with Promise.all for better performance
    const fetchData = async (pageNum = 0) => {
        setLoading(true);
        const client = getSbClient();
        if (!client) return;

        try {
            // Fetch Teams and Evaluations in parallel
            const [teamsResult, evaluationsResult] = await Promise.all([
                client.from(TABLES.TEAMS).select('*').order('country', { ascending: true }),
                client
                    .from(TABLES.EVALUATIONS)
                    .select('*', { count: 'exact' })
                    .order('created_at', { ascending: false })
                    .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)
            ]);

            // Handle Teams
            const currentTeams = teamsResult.data && teamsResult.data.length > 0
                ? (teamsResult.data as TeamInfo[])
                : MISSION_TEAMS;
            setTeams(currentTeams);

            // Handle Evaluations
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

        // Initialize all teams with 0
        currentTeams.forEach(t => {
            if (t.missionary) newStats.teamMemberByTeam[t.missionary] = 0;
        });

        // 척도 질문 통계를 위한 임시 저장소
        const scaleData: Record<string, { sum: number; count: number }> = {};
        const scaleQuestionIds = getScaleQuestionIds();

        data.forEach(evaluation => {
            // Count by role
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

            // 척도 질문 점수 집계
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

        // 척도 평균 계산
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

            // 날짜 필터
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

    // 고유 국가 및 부서 목록
    const uniqueCountries = useMemo(() =>
        Array.from(new Set(evaluations.map(e => e.team_country).filter(Boolean))).sort(),
        [evaluations]
    );

    const uniqueDepts = useMemo(() =>
        Array.from(new Set(evaluations.map(e => e.team_dept).filter(Boolean))).sort(),
        [evaluations]
    );

    // 척도 질문별 응답 분포 계산
    const scaleDistributions = useMemo(() => {
        const scaleQuestionIds = getScaleQuestionIds();
        const distributions: Record<string, { questionText: string; counts: number[] }> = {};

        scaleQuestionIds.forEach(qId => {
            distributions[qId] = {
                questionText: getQuestionText(qId),
                counts: [0, 0, 0, 0, 0, 0, 0] // 1~7점
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

    // 팀별 척도 질문 평균 비교
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
        // 기본 정보 + 모든 응답을 질문별로 펼쳐서 내보내기
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

            // 각 응답을 질문 텍스트를 키로 추가
            Object.entries(evaluation.answers || {}).forEach(([questionId, answer]) => {
                const questionText = getQuestionText(questionId);
                // 질문 텍스트가 너무 길면 앞 50자만 사용
                const shortQuestion = questionText.length > 50 ? questionText.substring(0, 50) + '...' : questionText;
                baseInfo[shortQuestion] = Array.isArray(answer) ? answer.join(', ') : String(answer);
            });

            return baseInfo;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);

        // 컬럼 너비 자동 조정
        const colWidths = Object.keys(exportData[0] || {}).map(key => ({
            wch: Math.min(Math.max(key.length, 10), 50)
        }));
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '설문 응답');
        XLSX.writeFile(wb, `설문응답_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('Excel 파일이 다운로드되었습니다.', 'success');
    };

    const deleteEvaluation = async (id: string) => {
        if (!confirm('이 응답을 삭제하시겠습니까?')) return;
        const client = getSbClient();
        if (!client) return;

        const { error, count } = await client
            .from(TABLES.EVALUATIONS)
            .delete({ count: 'exact' })
            .eq('id', id);

        if (error) {
            showToast('삭제 실패: ' + error.message, 'error');
        } else if (count === 0) {
            showToast('삭제된 데이터가 없습니다. 권한이 없거나 이미 삭제되었을 수 있습니다.', 'warning');
        } else {
            showToast('삭제되었습니다.', 'success');
            fetchData(page);
            setSelectedEval(null);
        }
    };

    // Pagination handlers
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
            <div className="flex items-center justify-center min-h-screen bg-white">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
                <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-sm text-center border border-gray-100">
                    <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-black mb-2 text-gray-900">ADMIN ACCESS</h1>
                    <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                        {user ? `${user.email}은 승인되지 않은 계정입니다.` : '관리자 권한이 있는 구글 계정으로 로그인해 주세요.'}
                    </p>
                    {!user ? (
                        <button onClick={handleLogin} className="w-full py-4 bg-white border-2 border-gray-100 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 hover:border-gray-200 active:scale-95 transition-all shadow-sm">
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" />
                            <span className="text-gray-700">Sign in with Google</span>
                        </button>
                    ) : (
                        <button onClick={handleLogout} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black active:scale-95 transition-all">
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 font-sans">
            {/* Toast Container */}
            <ToastContainer toasts={toasts} onClose={hideToast} />

            {/* Nav - Modern Glassmorphism Style */}
            <nav className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-50 shadow-sm shadow-slate-200/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Left: Logo & Navigation */}
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <div className="hidden sm:block">
                                    <div className="text-sm font-bold text-slate-800">Mission Survey</div>
                                    <div className="text-[10px] font-medium text-indigo-500 tracking-wide">Admin Dashboard</div>
                                </div>
                            </div>

                            {/* Navigation Tabs */}
                            <div className="hidden md:flex items-center bg-slate-100/80 p-1 rounded-xl">
                                <a href="/admin/dashboard" className="px-4 py-2 rounded-lg text-sm font-semibold bg-white shadow-sm text-indigo-600 transition-all">
                                    대시보드
                                </a>
                                <a href="/admin/questions" className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-white/50 transition-all">
                                    문항 관리
                                </a>
                            </div>
                        </div>

                        {/* Right: User Info & Logout */}
                        <div className="flex items-center gap-4">
                            <div className="hidden sm:flex flex-col items-end">
                                <span className="text-xs font-semibold text-slate-700">{user?.email}</span>
                                <span className="text-[10px] text-slate-400 font-medium">Admin</span>
                            </div>
                            <button onClick={handleLogout} className="p-2.5 bg-slate-100/80 text-slate-400 rounded-xl hover:text-rose-500 hover:bg-rose-50 transition-all" title="로그아웃">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto p-6 lg:p-10 space-y-8">
                {/* Stats Cards - Modern Glassmorphism */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="group relative bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-white/80 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                            </div>
                            <div className="text-3xl font-black text-slate-800">{totalCount}</div>
                            <div className="text-xs text-slate-500 mt-1">전체 제출</div>
                        </div>
                    </div>

                    <div className="group relative bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-white/80 shadow-sm hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Missionary</span>
                                <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                </div>
                            </div>
                            <div className="text-3xl font-black text-slate-800">{stats.byRole.missionary}</div>
                            <div className="text-xs text-slate-500 mt-1">선교사 응답</div>
                        </div>
                    </div>

                    <div className="group relative bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-white/80 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Leader</span>
                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                            </div>
                            <div className="text-3xl font-black text-slate-800">{stats.byRole.leader}</div>
                            <div className="text-xs text-slate-500 mt-1">인솔자 응답</div>
                        </div>
                    </div>

                    <div className="group relative bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-white/80 shadow-sm hover:shadow-xl hover:shadow-violet-500/10 transition-all duration-300 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Team</span>
                                <div className="w-10 h-10 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                </div>
                            </div>
                            <div className="text-3xl font-black text-slate-800">{stats.byRole.team_member}</div>
                            <div className="text-xs text-slate-500 mt-1">팀원 응답</div>
                        </div>
                    </div>
                </div>

                {/* Scale Question Averages - Modern Card */}
                {stats.scaleAverages.length > 0 && (
                    <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/80 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/25">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            척도 질문 평균 점수 (1~7점)
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {stats.scaleAverages.map(stat => (
                                <div key={stat.questionId} className="p-4 bg-white/80 rounded-xl border border-slate-100 hover:shadow-md transition-all">
                                    <div className="text-xs text-slate-500 mb-2 line-clamp-2 leading-relaxed" title={stat.questionText}>
                                        {stat.questionText}
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div className="text-2xl font-black text-indigo-600">{stat.average.toFixed(1)}</div>
                                        <div className="text-[10px] text-slate-400 font-medium">{stat.count}명 응답</div>
                                    </div>
                                    <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                                            style={{ width: `${(stat.average / 7) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Analysis Toggle Button - Modern Style */}
                <div className="flex justify-center">
                    <button
                        onClick={() => setShowAnalysis(!showAnalysis)}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${showAnalysis
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                            : 'bg-white/60 backdrop-blur-sm border border-indigo-200/50 text-indigo-600 hover:bg-indigo-50/50 hover:shadow-md'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        {showAnalysis ? '상세 분석 숨기기' : '상세 분석 보기'}
                    </button>
                </div>

                {/* Detailed Analysis Section */}
                {showAnalysis && (
                    <div className="space-y-6">
                        {/* Score Distribution Histograms */}
                        {scaleDistributions.length > 0 && (
                            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/80 shadow-sm">
                                <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/25">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    척도 질문별 응답 분포
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {scaleDistributions.map(dist => {
                                        const maxCount = Math.max(...dist.counts, 1);
                                        const total = dist.counts.reduce((a, b) => a + b, 0);
                                        return (
                                            <div key={dist.questionId} className="p-4 bg-white/80 rounded-xl border border-slate-100">
                                                <div className="text-xs text-slate-600 mb-4 line-clamp-2" title={dist.questionText}>
                                                    {dist.questionText}
                                                </div>
                                                <div className="flex items-end gap-1 h-20">
                                                    {dist.counts.map((count, idx) => (
                                                        <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                                            <div
                                                                className="w-full bg-gradient-to-t from-cyan-500 to-teal-400 rounded-t transition-all hover:from-cyan-600 hover:to-teal-500"
                                                                style={{ height: `${(count / maxCount) * 100}%`, minHeight: count > 0 ? '4px' : '0' }}
                                                                title={`${idx + 1}점: ${count}명`}
                                                            />
                                                            <span className="text-[10px] text-slate-400 font-semibold">{idx + 1}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-2 text-[10px] text-slate-400 text-right font-medium">총 {total}명</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Team Comparison Table */}
                        {teamComparison.length > 0 && (
                            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/80 shadow-sm">
                                <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gradient-to-br from-rose-400 to-pink-500 rounded-lg flex items-center justify-center shadow-lg shadow-rose-500/25">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                    팀별 척도 질문 평균 비교
                                </h2>
                                <div className="overflow-x-auto rounded-xl border border-slate-100">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50/80">
                                            <tr>
                                                <th className="text-left py-3 px-3 font-semibold text-slate-600 sticky left-0 bg-slate-50/80">팀 (선교사)</th>
                                                <th className="text-center py-3 px-3 font-semibold text-slate-600">응답수</th>
                                                {getScaleQuestionIds().slice(0, 6).map(qId => (
                                                    <th key={qId} className="text-center py-3 px-2 font-medium text-slate-500 min-w-[70px] text-xs" title={getQuestionText(qId)}>
                                                        {qId}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 bg-white">
                                            {teamComparison.map(row => (
                                                <tr key={row.team} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-3 px-3 font-semibold text-slate-800 sticky left-0 bg-white">{row.team}</td>
                                                    <td className="py-3 px-3 text-center">
                                                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg font-bold text-xs bg-rose-100 text-rose-700">
                                                            {row.responseCount}
                                                        </span>
                                                    </td>
                                                    {getScaleQuestionIds().slice(0, 6).map(qId => {
                                                        const avg = row.averages[qId];
                                                        const bgColor = avg === null ? 'bg-slate-100 text-slate-400' :
                                                            avg >= 6 ? 'bg-emerald-100 text-emerald-700' :
                                                                avg >= 5 ? 'bg-blue-100 text-blue-700' :
                                                                    avg >= 4 ? 'bg-amber-100 text-amber-700' :
                                                                        'bg-rose-100 text-rose-700';
                                                        return (
                                                            <td key={qId} className="py-3 px-2 text-center">
                                                                <span className={`inline-block px-2 py-1 rounded-lg font-semibold text-xs ${bgColor}`}>
                                                                    {avg !== null ? avg.toFixed(1) : '-'}
                                                                </span>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-slate-500">
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-100 rounded"></span> 6점 이상</span>
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-100 rounded"></span> 5~6점</span>
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-100 rounded"></span> 4~5점</span>
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-rose-100 rounded"></span> 4점 미만</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Team Member Breakdown */}
                    <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/80 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-violet-400 to-purple-500 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/25">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            팀원별 제출 현황
                        </h2>
                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                            <table className="w-full">
                                <thead className="bg-slate-50/80">
                                    <tr>
                                        <th className="text-left py-3 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">팀 (선교사)</th>
                                        <th className="text-center py-3 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">제출 수</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 bg-white">
                                    {teams.map((team) => {
                                        const count = stats.teamMemberByTeam[team.missionary] || 0;
                                        return (
                                            <tr key={team.id || `${team.country}-${team.missionary}-${team.leader}`} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3 px-3">
                                                    <div className="font-semibold text-slate-800 text-sm">{team.missionary}</div>
                                                    <div className="text-[10px] text-slate-400">{team.country}</div>
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-bold text-xs ${count > 0 ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400'}`}>
                                                        {count}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Missionary & Leader Breakdown */}
                    <div className="space-y-6">
                        {/* Missionary List */}
                        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/80 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/25">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                선교사 제출 명단
                            </h2>
                            {stats.missionaries.length > 0 ? (
                                <ul className="space-y-2">
                                    {stats.missionaries.map(m => (
                                        <li key={m.id} className="flex items-center justify-between p-3 bg-amber-50/50 rounded-xl border border-amber-100/50">
                                            <div>
                                                <div className="font-semibold text-slate-800 text-sm">{m.respondent_name || '익명'}</div>
                                                <div className="text-[10px] text-slate-400">{m.submission_date ? new Date(m.submission_date).toLocaleDateString('ko-KR') : '-'}</div>
                                            </div>
                                            <button onClick={() => setSelectedEval(m)} className="text-xs font-semibold text-amber-600 hover:text-amber-700 px-3 py-1.5 bg-amber-100/50 rounded-lg hover:bg-amber-100 transition-colors">보기</button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-center text-slate-400 text-sm py-6">아직 제출된 응답이 없습니다.</p>
                            )}
                        </div>

                        {/* Leader List */}
                        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/80 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/25">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                인솔자 제출 명단
                            </h2>
                            {stats.leaders.length > 0 ? (
                                <ul className="space-y-2">
                                    {stats.leaders.map(l => (
                                        <li key={l.id} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                                            <div>
                                                <div className="font-semibold text-slate-800 text-sm">{l.respondent_name || '익명'}</div>
                                                <div className="text-[10px] text-slate-400">{l.submission_date ? new Date(l.submission_date).toLocaleDateString('ko-KR') : '-'}</div>
                                            </div>
                                            <button onClick={() => setSelectedEval(l)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 px-3 py-1.5 bg-emerald-100/50 rounded-lg hover:bg-emerald-100 transition-colors">보기</button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-center text-slate-400 text-sm py-6">아직 제출된 응답이 없습니다.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Responses Table */}
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/80 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/25">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            상세 응답 목록
                        </h2>
                        <button onClick={exportToExcel} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-emerald-500/25 active:scale-95 transition-all flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            Excel 내보내기
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="space-y-4 mb-6">
                        {/* Row 1: Role, Team, Search */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="bg-slate-50 border border-slate-200/50 rounded-xl px-4 py-2.5 font-medium text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="all">모든 역할</option>
                                <option value="선교사">선교사</option>
                                <option value="인솔자">인솔자</option>
                                <option value="단기선교 팀원">단기선교 팀원</option>
                            </select>
                            <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className="bg-slate-50 border border-slate-200/50 rounded-xl px-4 py-2.5 font-medium text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="all">모든 팀</option>
                                {uniqueTeams.map(team => (
                                    <option key={team} value={team!}>{team}</option>
                                ))}
                            </select>
                            <input type="text" placeholder="검색 (이름, 이메일, 팀)" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-slate-50 border border-slate-200/50 rounded-xl px-4 py-2.5 font-medium text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400" />
                        </div>

                        {/* Row 2: Country, Dept, Date Range */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} className="bg-slate-50 border border-slate-200/50 rounded-xl px-4 py-2.5 font-medium text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="all">모든 국가</option>
                                {uniqueCountries.map(country => (
                                    <option key={country} value={country!}>{country}</option>
                                ))}
                            </select>
                            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="bg-slate-50 border border-slate-200/50 rounded-xl px-4 py-2.5 font-medium text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="all">모든 부서</option>
                                {uniqueDepts.map(dept => (
                                    <option key={dept} value={dept!}>{dept}</option>
                                ))}
                            </select>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={e => setDateFrom(e.target.value)}
                                    className="bg-slate-50 border border-slate-200/50 rounded-xl px-4 py-2.5 font-medium text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 flex-1"
                                    placeholder="시작일"
                                />
                                <span className="text-slate-300">~</span>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={e => setDateTo(e.target.value)}
                                    className="bg-slate-50 border border-slate-200/50 rounded-xl px-4 py-2.5 font-medium text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 flex-1"
                                    placeholder="종료일"
                                />
                            </div>
                            <button
                                onClick={() => {
                                    setRoleFilter('all');
                                    setTeamFilter('all');
                                    setCountryFilter('all');
                                    setDeptFilter('all');
                                    setDateFrom('');
                                    setDateTo('');
                                    setSearchQuery('');
                                }}
                                className="bg-slate-100 text-slate-600 rounded-xl px-4 py-2.5 font-medium text-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                초기화
                            </button>
                        </div>

                        {/* Filter Summary */}
                        <div className="flex items-center gap-2 text-sm text-slate-500 bg-indigo-50/50 rounded-xl px-4 py-2.5 border border-indigo-100/50 w-fit">
                            <span className="font-medium">결과:</span>
                            <span className="text-indigo-600 font-bold text-base">{filteredEvaluations.length}</span>
                            <span className="text-slate-400">/ {totalCount}건</span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto rounded-xl border border-slate-100">
                                <table className="w-full">
                                    <thead className="bg-slate-50/80">
                                        <tr>
                                            <th className="text-left py-3 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">역할</th>
                                            <th className="text-left py-3 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">팀</th>
                                            <th className="text-left py-3 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">응답자</th>
                                            <th className="text-left py-3 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">제출일</th>
                                            <th className="text-center py-3 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">응답수</th>
                                            <th className="text-right py-3 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">액션</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 bg-white">
                                        {filteredEvaluations.map(evaluation => (
                                            <tr key={evaluation.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3 px-4">
                                                    <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${evaluation.role === '선교사' ? 'bg-amber-100 text-amber-700' : evaluation.role === '인솔자' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}>
                                                        {evaluation.role}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-semibold text-slate-800 text-sm">{evaluation.team_missionary}</td>
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-slate-800 text-sm">{evaluation.respondent_name || '익명'}</span>
                                                        <span className="text-[10px] text-slate-400">{evaluation.respondent_email || '-'}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-slate-600">{evaluation.submission_date ? new Date(evaluation.submission_date).toLocaleDateString('ko-KR') : '-'}</td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg font-bold text-xs bg-indigo-100 text-indigo-700">
                                                        {Object.keys(evaluation.answers || {}).length}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <button onClick={() => setSelectedEval(evaluation)} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-all">
                                                        상세보기
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredEvaluations.length === 0 && (
                                    <div className="text-center py-16 text-slate-400 font-medium">
                                        응답 데이터가 없습니다.
                                    </div>
                                )}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-slate-100">
                                    <button
                                        onClick={handlePrevPage}
                                        disabled={page === 0}
                                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-all"
                                    >
                                        이전
                                    </button>
                                    <span className="text-sm font-semibold text-slate-600">
                                        {page + 1} / {totalPages}
                                    </span>
                                    <button
                                        onClick={handleNextPage}
                                        disabled={(page + 1) * pageSize >= totalCount}
                                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-all"
                                    >
                                        다음
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Detail Modal - Modern Design */}
            {selectedEval && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedEval(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-title"
                >
                    <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                            <h3 id="modal-title" className="text-lg font-bold text-slate-800">응답 상세</h3>
                            <button
                                onClick={() => setSelectedEval(null)}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-all"
                                aria-label="닫기"
                            >
                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Meta Info */}
                            <div className="grid grid-cols-2 gap-4 p-5 bg-slate-50 rounded-xl">
                                <div>
                                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">역할</div>
                                    <div className="font-semibold text-slate-800">{selectedEval.role}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">팀</div>
                                    <div className="font-semibold text-slate-800">{selectedEval.team_missionary}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">국가</div>
                                    <div className="font-semibold text-slate-800">{selectedEval.team_country}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">부서</div>
                                    <div className="font-semibold text-slate-800">{selectedEval.team_dept}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">응답자</div>
                                    <div className="font-semibold text-slate-800">{selectedEval.respondent_name || '익명'}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">제출일</div>
                                    <div className="font-semibold text-slate-800">{new Date(selectedEval.created_at).toLocaleString('ko-KR')}</div>
                                </div>
                            </div>

                            {/* Answers */}
                            <div className="space-y-3">
                                <h4 className="text-base font-bold text-slate-800">응답 내용</h4>
                                {Object.entries(selectedEval.answers || {}).map(([key, value]) => {
                                    const questionText = getQuestionText(key);
                                    const questionType = getQuestionType(key);
                                    const isScale = questionType === 'scale';

                                    return (
                                        <div key={key} className="p-4 bg-slate-50 rounded-xl">
                                            <div className="text-xs text-slate-600 mb-2 leading-relaxed">{sanitizeInput(questionText)}</div>
                                            <div className={`font-semibold ${isScale ? 'text-indigo-600 text-xl' : 'text-slate-800'}`}>
                                                {isScale ? (
                                                    <span className="flex items-center gap-2">
                                                        {sanitizeInput(String(value))}
                                                        <span className="text-xs font-normal text-slate-400">/ 7점</span>
                                                    </span>
                                                ) : (
                                                    Array.isArray(value) ? value.map(v => sanitizeInput(String(v))).join(', ') : sanitizeInput(String(value))
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                                <button onClick={() => deleteEvaluation(selectedEval.id)} className="px-5 py-2.5 bg-rose-50 text-rose-600 rounded-xl font-semibold text-sm hover:bg-rose-100 transition-all">
                                    삭제
                                </button>
                                <button onClick={() => setSelectedEval(null)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition-all">
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
