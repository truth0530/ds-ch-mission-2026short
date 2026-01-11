import React from 'react';
import { motion } from 'framer-motion';

interface LandingViewProps {
    onStart: () => void;
    auth: { user: any; isAdmin: boolean; loading: boolean };
    onLogin: () => void;
}

export default function LandingView({ onStart, auth, onLogin }: LandingViewProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-b from-indigo-50/50 to-slate-50"
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
                    <button
                        onClick={onStart}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
                    >
                        <span>설문 시작하기 (로그인 없이)</span>
                        <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </button>

                    {!auth.user && (
                        <button
                            onClick={onLogin}
                            className="w-full py-4 bg-white hover:bg-slate-50 text-slate-600 rounded-2xl font-semibold border border-slate-200 transition-all flex items-center justify-center gap-2"
                        >
                            <span>관리자 구글 로그인</span>
                        </button>
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
                    <div className="mt-8 text-sm text-slate-400">
                        Logged in as: {auth.user.email}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
