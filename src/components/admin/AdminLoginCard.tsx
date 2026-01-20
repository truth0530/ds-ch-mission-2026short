'use client';

import { User } from '@supabase/supabase-js';

interface AdminLoginCardProps {
    user: User | null;
    onLogin: () => void;
    onLogout: () => void;
    title?: string;
}

export function AdminLoginCard({ user, onLogin, onLogout, title = '관리자 페이지' }: AdminLoginCardProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
            <div className="bg-white p-8 rounded-lg border border-gray-200 w-full max-w-xs text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                </div>
                <h1 className="text-lg font-bold mb-2 text-gray-900">{title}</h1>
                <p className="text-gray-500 text-sm mb-6">
                    {user
                        ? `${user.email}은 접근 권한이 없습니다.`
                        : '관리자 계정으로 로그인해 주세요.'}
                </p>
                {!user ? (
                    <button
                        onClick={onLogin}
                        className="w-full py-3 bg-white border border-gray-200 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors text-sm"
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" />
                        <span className="text-gray-700">Google로 로그인</span>
                    </button>
                ) : (
                    <button
                        onClick={onLogout}
                        className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors text-sm"
                    >
                        다른 계정으로 로그인
                    </button>
                )}
            </div>
        </div>
    );
}
