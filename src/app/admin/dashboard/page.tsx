'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let sbClientInstance: any = null;
const getSbClient = () => {
    if (!sbClientInstance && SB_URL && SB_KEY) {
        sbClientInstance = createClient(SB_URL, SB_KEY);
    }
    return sbClientInstance;
};

interface Evaluation {
    id: string;
    role: string;
    team_dept: string;
    team_country: string;
    team_missionary: string;
    team_leader: string;
    respondent_email: string | null;
    respondent_name: string | null;
    submission_date: string;
    response_status: string;
    answers: Record<string, any>;
    created_at: string;
}

interface Stats {
    total: number;
    byRole: { missionary: number; leader: number; team_member: number };
    byTeam: Record<string, { missionary: number; leader: number; team_member: number }>;
}

export default function AdminDashboard() {
    const [loading, setLoading] = useState(true);
    const [authLoading, setAuthLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [isAuthorized, setIsAuthorized] = useState(false);

    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, byRole: { missionary: 0, leader: 0, team_member: 0 }, byTeam: {} });

    // Filters
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [teamFilter, setTeamFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Detail Modal
    const [selectedEval, setSelectedEval] = useState<Evaluation | null>(null);

    useEffect(() => {
        const client = getSbClient();
        if (!client) {
            setAuthLoading(false);
            return;
        }

        const { data: { subscription } } = client.auth.onAuthStateChange((_event: any, session: any) => {
            if (session?.user) {
                checkAuthorization(client, session.user);
            } else {
                setUser(null);
                setIsAuthorized(false);
                setAuthLoading(false);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    const checkAuthorization = async (client: any, currentUser: any) => {
        const { data } = await client
            .from('admin_users')
            .select('*')
            .eq('email', currentUser.email)
            .single();

        if (data || currentUser.email === 'truth0530@gmail.com') {
            setUser(currentUser);
            setIsAuthorized(true);
            fetchEvaluations();
        } else {
            setIsAuthorized(false);
            setUser(currentUser);
        }
        setAuthLoading(false);
    };

    const handleLogin = async () => {
        const client = getSbClient();
        if (!client) return;
        await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/admin/dashboard'
            }
        });
    };

    const handleLogout = async () => {
        const client = getSbClient();
        if (!client) return;
        await client.auth.signOut();
        window.location.reload();
    };

    const fetchEvaluations = async () => {
        const client = getSbClient();
        if (!client) return;
        setLoading(true);

        const { data, error } = await client
            .from('mission_evaluations')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setEvaluations(data);
            calculateStats(data);
        }
        setLoading(false);
    };

    const calculateStats = (data: Evaluation[]) => {
        const stats: Stats = {
            total: data.length,
            byRole: { missionary: 0, leader: 0, team_member: 0 },
            byTeam: {}
        };

        data.forEach(evaluation => {
            // Count by role
            if (evaluation.role === '선교사') stats.byRole.missionary++;
            else if (evaluation.role === '인솔자') stats.byRole.leader++;
            else if (evaluation.role === '단기선교 팀원') stats.byRole.team_member++;

            // Count by team
            const teamKey = evaluation.team_missionary || 'Unknown';
            if (!stats.byTeam[teamKey]) {
                stats.byTeam[teamKey] = { missionary: 0, leader: 0, team_member: 0 };
            }
            if (evaluation.role === '선교사') stats.byTeam[teamKey].missionary++;
            else if (evaluation.role === '인솔자') stats.byTeam[teamKey].leader++;
            else if (evaluation.role === '단기선교 팀원') stats.byTeam[teamKey].team_member++;
        });

        setStats(stats);
    };

    const filteredEvaluations = evaluations.filter(evaluation => {
        if (roleFilter !== 'all' && evaluation.role !== roleFilter) return false;
        if (teamFilter !== 'all' && evaluation.team_missionary !== teamFilter) return false;
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

    const exportToExcel = () => {
        const exportData = filteredEvaluations.map(evaluation => ({
            '역할': evaluation.role,
            '팀': evaluation.team_missionary,
            '국가': evaluation.team_country,
            '부서': evaluation.team_dept,
            '인솔자': evaluation.team_leader,
            '응답자 이름': evaluation.respondent_name || '익명',
            '응답자 이메일': evaluation.respondent_email || '익명',
            '제출일': new Date(evaluation.submission_date).toLocaleDateString('ko-KR'),
            '상태': evaluation.response_status,
            '응답 수': Object.keys(evaluation.answers || {}).length,
            '제출 시각': new Date(evaluation.created_at).toLocaleString('ko-KR')
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '설문 응답');
        XLSX.writeFile(wb, `설문응답_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const deleteEvaluation = async (id: string) => {
        if (!confirm('이 응답을 삭제하시겠습니까?')) return;
        const client = getSbClient();
        if (!client) return;

        const { error } = await client
            .from('mission_evaluations')
            .delete()
            .eq('id', id);

        if (!error) {
            fetchEvaluations();
            setSelectedEval(null);
        } else {
            alert('삭제 실패: ' + error.message);
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

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            {/* Nav */}
            <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex flex-col">
                            <span className="text-sm font-black text-gray-900 leading-tight">ADMIN DASHBOARD</span>
                            <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Analytics Mode</span>
                        </div>
                        <div className="hidden md:flex items-center gap-1 bg-gray-50 p-1 rounded-xl">
                            <a href="/admin/dashboard" className="px-4 py-2 rounded-lg text-sm font-bold bg-white shadow-sm text-blue-600">
                                대시보드
                            </a>
                            <a href="/admin/questions" className="px-4 py-2 rounded-lg text-sm font-bold text-gray-400 hover:text-gray-600">
                                문항 관리
                            </a>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex flex-col items-end mr-2">
                            <span className="text-xs font-bold text-gray-900">{user.email}</span>
                            <span className="text-[10px] text-gray-400">Authorized Admin</span>
                        </div>
                        <button onClick={handleLogout} className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:text-red-500 hover:bg-red-50 transition-all border border-gray-100" title="로그아웃">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto p-6 lg:p-10 space-y-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white rounded-3xl p-6 border-2 border-gray-100 hover:border-blue-500/20 hover:shadow-xl transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Total</span>
                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                        </div>
                        <div className="text-4xl font-black text-gray-900">{stats.total}</div>
                        <div className="text-xs text-gray-500 mt-1">전체 제출</div>
                    </div>

                    <div className="bg-white rounded-3xl p-6 border-2 border-gray-100 hover:border-amber-500/20 hover:shadow-xl transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Missionary</span>
                            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            </div>
                        </div>
                        <div className="text-4xl font-black text-gray-900">{stats.byRole.missionary}</div>
                        <div className="text-xs text-gray-500 mt-1">선교사 응답</div>
                    </div>

                    <div className="bg-white rounded-3xl p-6 border-2 border-gray-100 hover:border-green-500/20 hover:shadow-xl transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Leader</span>
                            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                        </div>
                        <div className="text-4xl font-black text-gray-900">{stats.byRole.leader}</div>
                        <div className="text-xs text-gray-500 mt-1">인솔자 응답</div>
                    </div>

                    <div className="bg-white rounded-3xl p-6 border-2 border-gray-100 hover:border-purple-500/20 hover:shadow-xl transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Team</span>
                            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            </div>
                        </div>
                        <div className="text-4xl font-black text-gray-900">{stats.byRole.team_member}</div>
                        <div className="text-xs text-gray-500 mt-1">팀원 응답</div>
                    </div>
                </div>

                {/* Team Breakdown */}
                <div className="bg-white rounded-3xl p-8 border-2 border-gray-100">
                    <h2 className="text-2xl font-black text-gray-900 mb-6">팀별 제출 현황</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b-2 border-gray-100">
                                    <th className="text-left py-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">팀 (선교사)</th>
                                    <th className="text-center py-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">선교사</th>
                                    <th className="text-center py-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">인솔자</th>
                                    <th className="text-center py-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">팀원</th>
                                    <th className="text-center py-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">합계</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {Object.entries(stats.byTeam).map(([team, counts]) => (
                                    <tr key={team} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-4 px-4 font-bold text-gray-900">{team}</td>
                                        <td className="py-4 px-4 text-center">
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold ${counts.missionary > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>
                                                {counts.missionary}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold ${counts.leader > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                                {counts.leader}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold ${counts.team_member > 0 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'}`}>
                                                {counts.team_member}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold bg-blue-100 text-blue-700">
                                                {counts.missionary + counts.leader + counts.team_member}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Responses Table */}
                <div className="bg-white rounded-3xl p-8 border-2 border-gray-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <h2 className="text-2xl font-black text-gray-900">상세 응답 목록</h2>
                        <button onClick={exportToExcel} className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 active:scale-95 transition-all shadow-lg shadow-green-100 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            Excel 내보내기
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="bg-gray-50 border-none rounded-xl p-3 font-bold text-sm focus:ring-2 focus:ring-blue-500">
                            <option value="all">모든 역할</option>
                            <option value="선교사">선교사</option>
                            <option value="인솔자">인솔자</option>
                            <option value="단기선교 팀원">단기선교 팀원</option>
                        </select>
                        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className="bg-gray-50 border-none rounded-xl p-3 font-bold text-sm focus:ring-2 focus:ring-blue-500">
                            <option value="all">모든 팀</option>
                            {uniqueTeams.map(team => (
                                <option key={team} value={team}>{team}</option>
                            ))}
                        </select>
                        <input type="text" placeholder="검색 (이름, 이메일, 팀)" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-gray-50 border-none rounded-xl p-3 font-bold text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b-2 border-gray-100">
                                        <th className="text-left py-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">역할</th>
                                        <th className="text-left py-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">팀</th>
                                        <th className="text-left py-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">응답자</th>
                                        <th className="text-left py-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">제출일</th>
                                        <th className="text-center py-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">응답수</th>
                                        <th className="text-right py-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">액션</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredEvaluations.map(evaluation => (
                                        <tr key={evaluation.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-4 px-4">
                                                <span className={`inline-block px-3 py-1 rounded-lg text-xs font-black ${evaluation.role === '선교사' ? 'bg-amber-100 text-amber-700' : evaluation.role === '인솔자' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                                                    {evaluation.role}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 font-bold text-gray-900">{evaluation.team_missionary}</td>
                                            <td className="py-4 px-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900">{evaluation.respondent_name || '익명'}</span>
                                                    <span className="text-xs text-gray-400">{evaluation.respondent_email || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-sm text-gray-600">{new Date(evaluation.submission_date).toLocaleDateString('ko-KR')}</td>
                                            <td className="py-4 px-4 text-center">
                                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold bg-blue-100 text-blue-700">
                                                    {Object.keys(evaluation.answers || {}).length}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <button onClick={() => setSelectedEval(evaluation)} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-black hover:bg-blue-100 transition-all">
                                                    상세보기
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredEvaluations.length === 0 && (
                                <div className="text-center py-20 text-gray-400 font-bold">
                                    응답 데이터가 없습니다.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Detail Modal */}
            {selectedEval && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEval(null)}>
                    <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-black text-gray-900">응답 상세</h3>
                            <button onClick={() => setSelectedEval(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Meta Info */}
                            <div className="grid grid-cols-2 gap-4 p-6 bg-gray-50 rounded-2xl">
                                <div>
                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">역할</div>
                                    <div className="font-bold text-gray-900">{selectedEval.role}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">팀</div>
                                    <div className="font-bold text-gray-900">{selectedEval.team_missionary}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">국가</div>
                                    <div className="font-bold text-gray-900">{selectedEval.team_country}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">부서</div>
                                    <div className="font-bold text-gray-900">{selectedEval.team_dept}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">응답자</div>
                                    <div className="font-bold text-gray-900">{selectedEval.respondent_name || '익명'}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">제출일</div>
                                    <div className="font-bold text-gray-900">{new Date(selectedEval.created_at).toLocaleString('ko-KR')}</div>
                                </div>
                            </div>

                            {/* Answers */}
                            <div className="space-y-4">
                                <h4 className="text-lg font-black text-gray-900">응답 내용</h4>
                                {Object.entries(selectedEval.answers || {}).map(([key, value]) => (
                                    <div key={key} className="p-4 bg-gray-50 rounded-xl">
                                        <div className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2">질문 ID: {key}</div>
                                        <div className="font-bold text-gray-900">
                                            {Array.isArray(value) ? value.join(', ') : String(value)}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
                                <button onClick={() => deleteEvaluation(selectedEval.id)} className="px-6 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all">
                                    삭제
                                </button>
                                <button onClick={() => setSelectedEval(null)} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all">
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
