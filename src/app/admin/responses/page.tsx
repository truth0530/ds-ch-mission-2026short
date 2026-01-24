'use client';

import { useState, useEffect, useMemo } from 'react';
import { getSbClient } from '@/lib/supabase';
import { TABLES } from '@/lib/constants';
import { Question } from '@/lib/surveyData';
import { useRequireAdmin } from '@/hooks/useAdminAuth';
import { AdminLoginCard, AdminErrorAlert } from '@/components/admin';
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

const PAGE_SIZE = 50;

export default function ResponsesPage() {
    const { user, isAuthorized, loading: authLoading, login, logout, error: authError, clearError } = useRequireAdmin();

    const [loading, setLoading] = useState(true);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
    const [searchTerm, setSearchTerm] = useState('');
    const [dataError, setDataError] = useState<string | null>(null);

    // Pagination state
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
        created_at: 130,
        role: 70,
        respondent_name: 90,
        respondent_email: 160,
        team_country: 70,
        team_missionary: 90,
    });

    useEffect(() => {
        if (isAuthorized) {
            fetchData();
        }
    }, [isAuthorized, page]);

    const fetchData = async () => {
        const client = getSbClient();
        if (!client) {
            setDataError('데이터베이스 연결에 실패했습니다.');
            setLoading(false);
            return;
        }
        setLoading(true);
        setDataError(null);

        try {
            const [evalResult, questionsResult] = await Promise.all([
                client
                    .from(TABLES.EVALUATIONS)
                    .select('*', { count: 'exact' })
                    .order('created_at', { ascending: false })
                    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
                client.from(TABLES.QUESTIONS).select('*').eq('is_hidden', false).order('sort_order', { ascending: true })
            ]);

            if (evalResult.error) {
                setDataError('응답 데이터를 불러오는데 실패했습니다.');
            } else {
                setEvaluations(evalResult.data || []);
                setTotalCount(evalResult.count || 0);
            }

            if (!questionsResult.error) {
                setQuestions(questionsResult.data || []);
            }
        } catch {
            setDataError('데이터를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 0 && newPage < totalPages) {
            setPage(newPage);
        }
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
        if (sortConfig.key !== column) return <span className="text-slate-300 ml-0.5" aria-hidden="true">-</span>;
        if (sortConfig.direction === 'asc') return <span className="text-indigo-600 ml-0.5" aria-hidden="true">↑</span>;
        if (sortConfig.direction === 'desc') return <span className="text-indigo-600 ml-0.5" aria-hidden="true">↓</span>;
        return <span className="text-slate-300 ml-0.5" aria-hidden="true">-</span>;
    };

    const getAriaSort = (column: string): 'ascending' | 'descending' | 'none' => {
        if (sortConfig.key !== column || !sortConfig.direction) return 'none';
        return sortConfig.direction === 'asc' ? 'ascending' : 'descending';
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAuthorized) {
        return <AdminLoginCard user={user} onLogin={() => login('/admin/responses')} onLogout={logout} title="응답 데이터" />;
    }

    return (
        <div className="min-h-screen bg-white font-sans text-sm">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
                <div className="max-w-screen-xl mx-auto px-4 h-12 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                            <span className="font-bold text-slate-800">응답시트</span>
                        </div>
                        <nav className="flex items-center gap-1 text-xs">
                            <a href="/admin/dashboard" className="px-3 py-1.5 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">대시보드</a>
                            <span className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium shadow-lg shadow-cyan-500/25">응답시트</span>
                            <a href="/admin/questions" className="px-3 py-1.5 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">설정</a>
                        </nav>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500"><span className="font-semibold text-slate-700">{sortedData.length}</span>건</span>
                        <div className="relative">
                            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input type="text" placeholder="검색" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-32 pl-8 pr-3 py-1.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 placeholder:text-slate-400" />
                        </div>
                        <button onClick={handleExport} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors">Excel</button>
                        <button onClick={logout} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors" title="로그아웃">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-screen-xl mx-auto px-4 py-4">
                {(authError || dataError) && (
                    <AdminErrorAlert error={authError || dataError} onDismiss={authError ? clearError : () => setDataError(null)} />
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse" role="table" aria-label="설문 응답 데이터 시트">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th
                                        scope="col"
                                        aria-sort={getAriaSort('created_at')}
                                        className="relative border-r border-slate-100 px-3 py-2.5 text-left font-semibold text-slate-700 cursor-pointer hover:bg-indigo-50/50 select-none whitespace-nowrap transition-colors"
                                        style={{ width: columnWidths.created_at, minWidth: columnWidths.created_at }}
                                        onClick={() => handleSort('created_at')}
                                    >
                                        제출일시 <SortIndicator column="created_at" />
                                        <div
                                            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-400"
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
                                    <th scope="col" aria-sort={getAriaSort('role')} className="border-r border-slate-100 px-3 py-2.5 text-left font-semibold text-slate-700 cursor-pointer hover:bg-indigo-50/50 select-none whitespace-nowrap transition-colors" style={{ width: columnWidths.role }} onClick={() => handleSort('role')}>
                                        역할 <SortIndicator column="role" />
                                    </th>
                                    <th scope="col" aria-sort={getAriaSort('respondent_name')} className="border-r border-slate-100 px-3 py-2.5 text-left font-semibold text-slate-700 cursor-pointer hover:bg-indigo-50/50 select-none whitespace-nowrap transition-colors" style={{ width: columnWidths.respondent_name }} onClick={() => handleSort('respondent_name')}>
                                        응답자 <SortIndicator column="respondent_name" />
                                    </th>
                                    <th scope="col" aria-sort={getAriaSort('respondent_email')} className="border-r border-slate-100 px-3 py-2.5 text-left font-semibold text-slate-700 cursor-pointer hover:bg-indigo-50/50 select-none whitespace-nowrap transition-colors" style={{ width: columnWidths.respondent_email }} onClick={() => handleSort('respondent_email')}>
                                        이메일 <SortIndicator column="respondent_email" />
                                    </th>
                                    <th scope="col" aria-sort={getAriaSort('team_country')} className="border-r border-slate-100 px-3 py-2.5 text-left font-semibold text-slate-700 cursor-pointer hover:bg-indigo-50/50 select-none whitespace-nowrap transition-colors" style={{ width: columnWidths.team_country }} onClick={() => handleSort('team_country')}>
                                        국가 <SortIndicator column="team_country" />
                                    </th>
                                    <th scope="col" aria-sort={getAriaSort('team_missionary')} className="border-r border-slate-100 px-3 py-2.5 text-left font-semibold text-slate-700 cursor-pointer hover:bg-indigo-50/50 select-none whitespace-nowrap transition-colors" style={{ width: columnWidths.team_missionary }} onClick={() => handleSort('team_missionary')}>
                                        선교사 <SortIndicator column="team_missionary" />
                                    </th>
                                    {questionColumns.map(q => (
                                        <th
                                            key={q.id}
                                            scope="col"
                                            aria-sort={getAriaSort(`q_${q.id}`)}
                                            className="border-r border-slate-100 px-3 py-2.5 text-left font-semibold text-slate-700 cursor-pointer hover:bg-indigo-50/50 select-none transition-colors"
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
                            <tbody className="divide-y divide-slate-100">
                                {sortedData.map((e, idx) => (
                                    <tr key={e.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50 transition-colors`}>
                                        <td className="border-r border-slate-50 px-3 py-2 whitespace-nowrap text-slate-600">
                                            {new Date(e.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="border-r border-slate-50 px-3 py-2 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-semibold ${
                                                e.role === '선교사' ? 'bg-amber-100 text-amber-700' :
                                                e.role === '인솔자' ? 'bg-emerald-100 text-emerald-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                                {e.role}
                                            </span>
                                        </td>
                                        <td className="border-r border-slate-50 px-3 py-2 whitespace-nowrap text-slate-800 font-medium">
                                            {e.respondent_name || '-'}
                                        </td>
                                        <td className="border-r border-slate-50 px-3 py-2 whitespace-nowrap text-slate-500">
                                            {e.respondent_email || '-'}
                                        </td>
                                        <td className="border-r border-slate-50 px-3 py-2 whitespace-nowrap text-slate-600">
                                            {e.team_country || '-'}
                                        </td>
                                        <td className="border-r border-slate-50 px-3 py-2 whitespace-nowrap text-slate-600">
                                            {e.team_missionary || '-'}
                                        </td>
                                        {questionColumns.map(q => {
                                            const val = e.answers?.[q.id];
                                            const displayVal = Array.isArray(val) ? val.join(', ') : val ?? '';
                                            return (
                                                <td key={q.id} className="border-r border-slate-50 px-3 py-2 text-slate-600" title={String(displayVal)}>
                                                    <div className="truncate max-w-[160px]">
                                                        {q.type === 'scale' ? (
                                                            <span className={`font-semibold ${Number(displayVal) >= 5 ? 'text-emerald-600' : Number(displayVal) <= 3 ? 'text-red-500' : 'text-slate-600'}`}>
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
                        </div>
                        {sortedData.length === 0 && (
                            <div className="text-center py-16 text-slate-400">
                                {searchTerm ? '검색 결과가 없습니다.' : '응답 데이터가 없습니다.'}
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                                <div className="text-xs text-slate-500">
                                    <span className="font-semibold text-slate-700">{page * PAGE_SIZE + 1}</span>-<span className="font-semibold text-slate-700">{Math.min((page + 1) * PAGE_SIZE, totalCount)}</span> / {totalCount}건
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => handlePageChange(0)} disabled={page === 0} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg disabled:opacity-30 transition-colors" title="첫 페이지">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                                    </button>
                                    <button onClick={() => handlePageChange(page - 1)} disabled={page === 0} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg disabled:opacity-30 transition-colors" title="이전">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                                    </button>
                                    <span className="px-3 text-xs text-slate-600 font-medium">{page + 1}/{totalPages}</span>
                                    <button onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages - 1} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg disabled:opacity-30 transition-colors" title="다음">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                    <button onClick={() => handlePageChange(totalPages - 1)} disabled={page >= totalPages - 1} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg disabled:opacity-30 transition-colors" title="마지막">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
