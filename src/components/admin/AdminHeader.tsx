'use client';

import Link from 'next/link';

export type AdminPage = 'dashboard' | 'responses' | 'settings';

interface AdminHeaderProps {
    activePage: AdminPage;
    onLogout: () => void;
    rightContent?: React.ReactNode;
}

const navItems: { id: AdminPage; label: string; href: string }[] = [
    { id: 'dashboard', label: '대시보드', href: '/admin/dashboard' },
    { id: 'responses', label: '응답시트', href: '/admin/responses' },
    { id: 'settings', label: '설정', href: '/admin/questions' },
];

const navIcons: Record<AdminPage, React.ReactNode> = {
    dashboard: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    responses: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    settings: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
};

const navGradients: Record<AdminPage, string> = {
    dashboard: 'from-indigo-500 to-purple-600 shadow-indigo-500/25',
    responses: 'from-cyan-500 to-blue-600 shadow-cyan-500/25',
    settings: 'from-amber-500 to-orange-600 shadow-amber-500/25',
};

export function AdminHeader({ activePage, onLogout, rightContent }: AdminHeaderProps) {
    return (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
            <div className="max-w-screen-xl mx-auto px-4 h-12 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${navGradients[activePage]} flex items-center justify-center shadow-lg text-white`}>
                            {navIcons[activePage]}
                        </div>
                        <span className="font-bold text-slate-800">{navItems.find(i => i.id === activePage)?.label || 'Admin'}</span>
                    </div>
                    <nav className="flex items-center gap-1 text-xs" aria-label="관리자 메뉴">
                        {navItems.map(item => (
                            <Link
                                key={item.id}
                                href={item.href}
                                className={`px-3 py-1.5 rounded-lg transition-all ${
                                    activePage === item.id
                                        ? `bg-gradient-to-r ${navGradients[item.id]} text-white font-medium shadow-lg`
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                }`}
                                aria-current={activePage === item.id ? 'page' : undefined}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>
                <div className="flex items-center gap-3">
                    {rightContent}
                    <button
                        onClick={onLogout}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        title="로그아웃"
                        aria-label="로그아웃"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </div>
        </header>
    );
}
