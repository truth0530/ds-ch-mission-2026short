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

export function AdminHeader({ activePage, onLogout, rightContent }: AdminHeaderProps) {
    return (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-screen-xl mx-auto px-4 h-11 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <span className="font-bold text-gray-900">Mission Survey</span>
                    <nav className="flex items-center gap-1 text-xs" aria-label="관리자 메뉴">
                        {navItems.map(item => (
                            <Link
                                key={item.id}
                                href={item.href}
                                className={`px-3 py-1.5 rounded transition-colors ${
                                    activePage === item.id
                                        ? 'bg-gray-100 text-gray-900 font-medium'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                                aria-current={activePage === item.id ? 'page' : undefined}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>
                <div className="flex items-center gap-2">
                    {rightContent}
                    <button
                        onClick={onLogout}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100 transition-colors"
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
