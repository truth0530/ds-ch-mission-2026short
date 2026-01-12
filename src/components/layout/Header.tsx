'use client';

import React, { useState } from 'react';

interface HeaderProps {
    onContactClick?: () => void;
    user?: any;
    onLogout?: () => void;
    isAdmin?: boolean;
}

export default function Header({ onContactClick, user, onLogout, isAdmin }: HeaderProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <header className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-md border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center">
                    <img src="/images/logo_green.png" alt="Mission Survey" className="h-10 w-auto" />
                </div>
                <nav className="hidden md:flex gap-6 text-sm font-medium text-slate-600 items-center">
                    {/* Public Nav hidden as requested */}

                    {user && (
                        <div className="flex items-center gap-4">
                            {isAdmin && (
                                <a
                                    href="/admin/dashboard"
                                    className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors"
                                >
                                    관리자화면
                                </a>
                            )}

                            <div className="relative">
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className="flex items-center gap-2 focus:outline-none transition-transform active:scale-95"
                                >
                                    <img
                                        src={user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user.email}`}
                                        alt="Profile"
                                        className={`w-8 h-8 rounded-full border shadow-sm transition-all ${isMenuOpen ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-indigo-100 hover:border-indigo-300'}`}
                                    />
                                </button>

                                {isMenuOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => setIsMenuOpen(false)}
                                        />
                                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-20 py-2 animate-in fade-in zoom-in-95 duration-200">
                                            <div className="px-4 py-3 border-b border-slate-50 mb-1">
                                                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Signed in as</p>
                                                <p className="text-sm font-bold text-slate-800 truncate">{user.email}</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    onLogout?.();
                                                    setIsMenuOpen(false);
                                                }}
                                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                                로그아웃 (계정 변경)
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </nav>
            </div>
        </header>
    );
}
