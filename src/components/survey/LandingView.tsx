import React from 'react';
import { motion } from 'framer-motion';

interface LandingViewProps {
    onStart: () => void;
    auth: { user: any; isAdmin: boolean; loading: boolean };
    onLogin: () => void;
    onLogout: () => void;
}

export default function LandingView({ onStart, auth, onLogin, onLogout }: LandingViewProps) {
    const [showLoginModal, setShowLoginModal] = React.useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-b from-indigo-50/50 to-slate-50 relative"
        >
            <div className="w-full max-w-md text-center">
                <div className="mx-auto mb-8 flex items-center justify-center">
                    <img
                        src="/images/logo_symbol.png"
                        alt="Logo"
                        className="w-24 h-auto drop-shadow-xl hover:scale-105 transition-transform duration-300"
                    />
                </div>

                <h1 className="text-3xl font-extrabold text-slate-900 mb-6 tracking-tight">
                    2026 단기선교 사역 평가 설문
                </h1>
                <p className="text-slate-500 mb-10 text-base leading-relaxed text-justify break-keep">
                    ※ 본 설문은 동신교회 단기선교 사역을 평가하여 부족한 부분을 보완하고 더 나은 모습을 이루기 위하여 준비하였습니다. 이 설문에 성실히 대답해 주실 때 단기선교 현황을 파악하는 것은 물론 지속적으로 발전시키기 위한 방안이 마련될 수 있습니다. 느끼는 그대로 체크하여 주시고 평소에 생각했던 좋은 의견이 있으면 아낌없이 조언해 주시기 바랍니다.
                </p>

                <div className="space-y-4">
                    {!auth.user ? (
                        <>
                            <button
                                onClick={() => setShowLoginModal(true)}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
                            >
                                <span>설문 시작하기</span>
                                <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                            </button>
                        </>
                    ) : (
                        <div className="space-y-3">
                            <button
                                onClick={onStart}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
                            >
                                <span>내 설문 작성/수정하기</span>
                            </button>
                        </div>
                    )}

                    {auth.user && auth.isAdmin && (
                        <a
                            href="/admin/dashboard"
                            className="block w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-center hover:bg-slate-800 transition-all"
                        >
                            관리자 대시보드 이동
                        </a>
                    )}
                </div>

                {auth.user && (
                    <div className="mt-8 flex flex-col items-center gap-2">
                        <span className="text-sm text-slate-400">Logged in as: {auth.user.email}</span>
                        <button
                            onClick={onLogout}
                            className="text-xs text-slate-400 hover:text-slate-600 underline"
                        >
                            로그아웃
                        </button>
                    </div>
                )}
            </div>

            {/* Login Selection Modal */}
            {showLoginModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowLoginModal(false)}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative z-10 overflow-hidden"
                    >
                        <button
                            onClick={() => setShowLoginModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>

                        <div className="text-center mb-8 pt-2">
                            <h3 className="text-xl font-bold text-slate-900 mb-2">어떻게 시작하시겠어요?</h3>
                            <p className="text-slate-500 text-sm">로그인하시면 작성 내용이 저장되며,<br />제출 후에도 수정이 가능합니다.</p>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={onLogin}
                                className="w-full py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-base shadow-sm transition-all flex items-center justify-center gap-2.5 relative group overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                                <span className="relative z-10">구글 계정으로 시작하기</span>
                            </button>

                            <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">or</span></div>
                            </div>

                            <button
                                onClick={onStart}
                                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-base shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-2"
                            >
                                <span>로그인 없이 바로 시작</span>
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </motion.div>
    );
}
