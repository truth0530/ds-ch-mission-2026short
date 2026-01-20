'use client';

import { useState, useEffect, useMemo } from 'react';
import { getSbClient } from '@/lib/supabase';
import { TABLES, ENV_CONFIG } from '@/lib/constants';
import { User } from '@supabase/supabase-js';
import { Question } from '@/lib/surveyData';
import * as XLSX from 'xlsx';

interface Evaluation {
    id: string;
    role: string;
    team_dept: string | null;
    team_country: string | null;
    team_missionary: string | null;
    team_leader: string | null;
    respondent_email: string | null;
    respondent_name: string | null;
    answers: Record<string, string | number | string[]>;
    created_at: string;
}

type SortDirection = 'asc' | 'desc' | null;
type SortConfig = { key: string; direction: SortDirection };

export default function ResponsesPage() {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
    const [searchTerm, setSearchTerm] = useState('');

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
        created_at: 130,
        role: 70,
        respondent_name: 90,
        respondent_email: 160,
        team_country: 70,
        team_missionary: 90,
    });

    useEffect(() => {
        const client = getSbClient();
        if (!client) {
            setAuthLoading(false);
            return;
        }

        const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
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

    useEffect(() => {
        if (isAuthorized) {
            fetchData();
        }
    }, [isAuthorized]);

    const checkAuthorization = async (client: ReturnType<typeof getSbClient>, currentUser: User) => {
        if (!client) return;
        try {
            const { data } = await client
                .from(TABLES.ADMIN_USERS)
                .select('*')
                .eq('email', currentUser.email)
                .maybeSingle();
            if (data || currentUser.email === ENV_CONFIG.ADMIN_EMAIL) {
                setUser(currentUser);
                setIsAuthorized(true);
            } else {
                setIsAuthorized(false);
                setUser(currentUser);
            }
        } catch {
            setIsAuthorized(false);
            setUser(currentUser);
        } finally {
            setAuthLoading(false);
        }
    };

    const fetchData = async () => {
        const client = getSbClient();
        if (!client) return;
        setLoading(true);

        const [evalResult, questionsResult] = await Promise.all([
            client.from(TABLES.EVALUATIONS).select('*').order('created_at', { ascending: false }),
            client.from(TABLES.QUESTIONS).select('*').eq('is_hidden', false).order('sort_order', { ascending: true })
        ]);

        if (!evalResult.error) setEvaluations(evalResult.data || []);
        if (!questionsResult.error) setQuestions(questionsResult.data || []);
        setLoading(false);
    };

    const handleLogin = async () => {
        const client = getSbClient();
        if (!client) return;
        await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                queryParams: { access_type: 'offline', prompt: 'select_account' },
                redirectTo: window.location.origin + '/admin/responses'
            }
        });
    };

    const handleLogout = async () => {
        const client = getSbClient();
        if (!client) return;
        await client.auth.signOut();
        window.location.reload();
    };

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key
                ? prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc'
                : 'asc'
        }));
    };

    const questionColumns = useMemo(() => {
        return questions.filter(q => q.type === 'scale' || q.type === 'text');
    }, [questions]);

    const sortedData = useMemo(() => {
        let data = [...evaluations];

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            data = data.filter(e =>
                (e.respondent_name || '').toLowerCase().includes(term) ||
                (e.respondent_email || '').toLowerCase().includes(term) ||
                (e.team_country || '').toLowerCase().includes(term) ||
                (e.team_missionary || '').toLowerCase().includes(term) ||
                e.role.toLowerCase().includes(term)
            );
        }

        if (sortConfig.key && sortConfig.direction) {
            data.sort((a, b) => {
                let aVal: string | number | null = null;
                let bVal: string | number | null = null;

                const key = sortConfig.key;
                if (key === 'created_at') {
                    aVal = a.created_at;
                    bVal = b.created_at;
                } else if (key === 'role') {
                    aVal = a.role;
                    bVal = b.role;
                } else if (key === 'respondent_name') {
                    aVal = a.respondent_name;
                    bVal = b.respondent_name;
                } else if (key === 'respondent_email') {
                    aVal = a.respondent_email;
                    bVal = b.respondent_email;
                } else if (key === 'team_country') {
                    aVal = a.team_country;
                    bVal = b.team_country;
                } else if (key === 'team_missionary') {
                    aVal = a.team_missionary;
                    bVal = b.team_missionary;
                } else if (key.startsWith('q_')) {
                    const qId = key.replace('q_', '');
                    aVal = a.answers?.[qId] as string | number | null ?? null;
                    bVal = b.answers?.[qId] as string | number | null ?? null;
                }

                if (aVal === null && bVal === null) return 0;
                if (aVal === null) return 1;
                if (bVal === null) return -1;

                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
                }

                const strA = String(aVal);
                const strB = String(bVal);
                return sortConfig.direction === 'asc'
                    ? strA.localeCompare(strB, 'ko')
                    : strB.localeCompare(strA, 'ko');
            });
        }

        return data;
    }, [evaluations, sortConfig, searchTerm]);

    const handleExport = () => {
        const headers = [
            '제출일시', '역할', '응답자', '이메일', '국가', '선교사', '팀장',
            ...questionColumns.map(q => q.question_text || q.id)
        ];

        const rows = sortedData.map(e => [
            new Date(e.created_at).toLocaleString('ko-KR'),
            e.role,
            e.respondent_name || '',
            e.respondent_email || '',
            e.team_country || '',
            e.team_missionary || '',
            e.team_leader || '',
            ...questionColumns.map(q => {
                const val = e.answers?.[q.id];
                return Array.isArray(val) ? val.join(', ') : val ?? '';
            })
        ]);

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '응답데이터');
        XLSX.writeFile(wb, `설문응답_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const handleColumnResize = (key: string, delta: number) => {
        setColumnWidths(prev => ({
            ...prev,
            [key]: Math.max(50, (prev[key] || 100) + delta)
        }));
    };

    const SortIndicator = ({ column }: { column: string }) => {
        if (sortConfig.key !== column) return <span className="text-gray-300 ml-0.5" aria-hidden="true">-</span>;
        if (sortConfig.direction === 'asc') return <span className="text-gray-700 ml-0.5" aria-hidden="true">A</span>;
        if (sortConfig.direction === 'desc') return <span className="text-gray-700 ml-0.5" aria-hidden="true">D</span>;
        return <span className="text-gray-300 ml-0.5" aria-hidden="true">-</span>;
    };

    const getAriaSort = (column: string): 'ascending' | 'descending' | 'none' => {
        if (sortConfig.key !== column || !sortConfig.direction) return 'none';
        return sortConfig.direction === 'asc' ? 'ascending' : 'descending';
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
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
                <div className="bg-white p-8 rounded-lg border border-gray-200 w-full max-w-xs text-center">
                    <h1 className="text-lg font-bold mb-2 text-gray-900">응답 데이터</h1>
                    <p className="text-gray-500 text-sm mb-6">
                        {user ? `${user.email}은 접근 권한이 없습니다.` : '관리자 계정으로 로그인해 주세요.'}
                    </p>
                    {!user ? (
                        <button onClick={handleLogin} className="w-full py-2 bg-white border border-gray-300 rounded text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50">
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="" />
                            <span className="text-gray-700">Google 로그인</span>
                        </button>
                    ) : (
                        <button onClick={handleLogout} className="w-full py-2 bg-gray-900 text-white rounded text-sm font-medium hover:bg-gray-800">
                            다른 계정으로 로그인
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-sm">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-full mx-auto px-4 h-11 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="font-bold text-gray-900">Mission Survey</span>
                        <nav className="flex items-center gap-1 text-xs">
                            <a href="/admin/dashboard" className="px-3 py-1.5 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-50">대시보드</a>
                            <a href="/admin/responses" className="px-3 py-1.5 bg-gray-100 text-gray-900 rounded font-medium">응답시트</a>
                            <a href="/admin/questions" className="px-3 py-1.5 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-50">설정</a>
                        </nav>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{sortedData.length}건</span>
                        <input
                            type="text"
                            placeholder="검색..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-36 px-2 py-1 text-xs bg-gray-100 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                        />
                        <button
                            onClick={handleExport}
                            className="px-2 py-1 bg-gray-900 text-white text-xs font-medium rounded hover:bg-gray-800"
                        >
                            Excel
                        </button>
                        <button onClick={handleLogout} className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100" title="로그아웃">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </div>
            </header>

            {/* Table */}
            <div className="p-2">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="bg-white rounded border border-gray-200 overflow-auto" style={{ maxHeight: 'calc(100vh - 60px)' }}>
                        <table className="w-max min-w-full text-xs border-collapse" role="table" aria-label="설문 응답 데이터 시트">
                            <thead className="bg-gray-100 sticky top-0 z-10">
                                <tr>
                                    <th
                                        scope="col"
                                        aria-sort={getAriaSort('created_at')}
                                        className="relative border-r border-gray-200 px-2 py-1.5 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200 select-none whitespace-nowrap"
                                        style={{ width: columnWidths.created_at, minWidth: columnWidths.created_at }}
                                        onClick={() => handleSort('created_at')}
                                    >
                                        제출일시 <SortIndicator column="created_at" />
                                        <div
                                            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-gray-400"
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                const startX = e.clientX;
                                                const startWidth = columnWidths.created_at;
                                                const onMove = (ev: MouseEvent) => handleColumnResize('created_at', ev.clientX - startX - (columnWidths.created_at - startWidth));
                                                const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                                                document.addEventListener('mousemove', onMove);
                                                document.addEventListener('mouseup', onUp);
                                            }}
                                        />
                                    </th>
                                    <th scope="col" aria-sort={getAriaSort('role')} className="border-r border-gray-200 px-2 py-1.5 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200 select-none whitespace-nowrap" style={{ width: columnWidths.role }} onClick={() => handleSort('role')}>
                                        역할 <SortIndicator column="role" />
                                    </th>
                                    <th scope="col" aria-sort={getAriaSort('respondent_name')} className="border-r border-gray-200 px-2 py-1.5 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200 select-none whitespace-nowrap" style={{ width: columnWidths.respondent_name }} onClick={() => handleSort('respondent_name')}>
                                        응답자 <SortIndicator column="respondent_name" />
                                    </th>
                                    <th scope="col" aria-sort={getAriaSort('respondent_email')} className="border-r border-gray-200 px-2 py-1.5 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200 select-none whitespace-nowrap" style={{ width: columnWidths.respondent_email }} onClick={() => handleSort('respondent_email')}>
                                        이메일 <SortIndicator column="respondent_email" />
                                    </th>
                                    <th scope="col" aria-sort={getAriaSort('team_country')} className="border-r border-gray-200 px-2 py-1.5 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200 select-none whitespace-nowrap" style={{ width: columnWidths.team_country }} onClick={() => handleSort('team_country')}>
                                        국가 <SortIndicator column="team_country" />
                                    </th>
                                    <th scope="col" aria-sort={getAriaSort('team_missionary')} className="border-r border-gray-200 px-2 py-1.5 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200 select-none whitespace-nowrap" style={{ width: columnWidths.team_missionary }} onClick={() => handleSort('team_missionary')}>
                                        선교사 <SortIndicator column="team_missionary" />
                                    </th>
                                    {questionColumns.map(q => (
                                        <th
                                            key={q.id}
                                            scope="col"
                                            aria-sort={getAriaSort(`q_${q.id}`)}
                                            className="border-r border-gray-200 px-2 py-1.5 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200 select-none"
                                            style={{ minWidth: 100, maxWidth: 180 }}
                                            onClick={() => handleSort(`q_${q.id}`)}
                                            title={q.question_text}
                                        >
                                            <div className="truncate max-w-[160px]">
                                                {q.question_text?.slice(0, 18)}...
                                            </div>
                                            <SortIndicator column={`q_${q.id}`} />
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedData.map((e, idx) => (
                                    <tr key={e.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                                        <td className="border-r border-b border-gray-100 px-2 py-1 whitespace-nowrap text-gray-600">
                                            {new Date(e.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="border-r border-b border-gray-100 px-2 py-1 whitespace-nowrap">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                e.role === '선교사' ? 'bg-amber-100 text-amber-700' :
                                                e.role === '인솔자' ? 'bg-emerald-100 text-emerald-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                                {e.role}
                                            </span>
                                        </td>
                                        <td className="border-r border-b border-gray-100 px-2 py-1 whitespace-nowrap text-gray-800 font-medium">
                                            {e.respondent_name || '-'}
                                        </td>
                                        <td className="border-r border-b border-gray-100 px-2 py-1 whitespace-nowrap text-gray-500">
                                            {e.respondent_email || '-'}
                                        </td>
                                        <td className="border-r border-b border-gray-100 px-2 py-1 whitespace-nowrap text-gray-600">
                                            {e.team_country || '-'}
                                        </td>
                                        <td className="border-r border-b border-gray-100 px-2 py-1 whitespace-nowrap text-gray-600">
                                            {e.team_missionary || '-'}
                                        </td>
                                        {questionColumns.map(q => {
                                            const val = e.answers?.[q.id];
                                            const displayVal = Array.isArray(val) ? val.join(', ') : val ?? '';
                                            return (
                                                <td key={q.id} className="border-r border-b border-gray-100 px-2 py-1 text-gray-600" title={String(displayVal)}>
                                                    <div className="truncate max-w-[160px]">
                                                        {q.type === 'scale' ? (
                                                            <span className={`font-semibold ${Number(displayVal) >= 5 ? 'text-emerald-600' : Number(displayVal) <= 3 ? 'text-red-500' : 'text-gray-600'}`}>
                                                                {displayVal}
                                                            </span>
                                                        ) : (
                                                            displayVal || '-'
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {sortedData.length === 0 && (
                            <div className="text-center py-12 text-gray-400">
                                {searchTerm ? '검색 결과가 없습니다.' : '응답 데이터가 없습니다.'}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
