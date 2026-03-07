import Link from 'next/link';

function MaterialIcon({ name, className = '' }: { name: string; className?: string }) {
    return (
        <span className={`material-symbols-outlined ${className}`}>
            {name}
        </span>
    );
}

export default function TourGuidePage() {
    return (
        <div className="min-h-screen bg-[#f7f6f8]">
            <div className="relative flex min-h-screen w-full flex-col max-w-[430px] mx-auto bg-[#f7f6f8] shadow-2xl">

                {/* Header */}
                <header className="px-4 pt-8 pb-2">
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="bg-[#6d13ec]/10 p-2 rounded-xl">
                            <MaterialIcon name="church" className="text-[#6d13ec]" />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900">기독유적지 투어</h1>
                    </div>
                    <p className="text-sm text-slate-500 mt-3 px-1">2026 단기선교 기독유적지 투어 신청 안내입니다.</p>
                </header>

                {/* Content */}
                <main className="flex-1 px-4 pt-4 pb-32 space-y-4">

                    {/* 신청 방법 */}
                    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <MaterialIcon name="edit_note" className="text-[#6d13ec]" />
                            <h2 className="text-base font-bold text-slate-900">신청 방법</h2>
                        </div>
                        <ol className="space-y-3 text-sm text-slate-700">
                            <li className="flex gap-3">
                                <span className="w-5 h-5 rounded-full bg-[#6d13ec] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                                <span><strong>조 번호 또는 조장 이름</strong>을 검색하여 선택합니다</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="w-5 h-5 rounded-full bg-[#6d13ec] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                                <span>원하는 <strong>날짜와 시간</strong>을 선택합니다</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="w-5 h-5 rounded-full bg-[#6d13ec] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                                <span><strong>4자리 숫자 비밀번호</strong>를 입력합니다</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="w-5 h-5 rounded-full bg-[#6d13ec] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                                <span>메모(선택)를 입력한 후 <strong>신청하기</strong>를 누릅니다</span>
                            </li>
                        </ol>
                    </section>

                    {/* 확인 · 변경 · 취소 */}
                    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <MaterialIcon name="manage_search" className="text-[#6d13ec]" />
                            <h2 className="text-base font-bold text-slate-900">확인 · 변경 · 취소</h2>
                        </div>
                        <ul className="space-y-2 text-sm text-slate-700">
                            <li className="flex gap-2 items-start">
                                <MaterialIcon name="check_circle" className="text-emerald-500 text-lg shrink-0 mt-0.5" />
                                <span><strong>신청현황</strong> 페이지에서 전체 현황을 확인할 수 있습니다</span>
                            </li>
                            <li className="flex gap-2 items-start">
                                <MaterialIcon name="check_circle" className="text-emerald-500 text-lg shrink-0 mt-0.5" />
                                <span><strong>이름 + 비밀번호</strong>를 입력하면 본인 예약을 조회할 수 있습니다</span>
                            </li>
                            <li className="flex gap-2 items-start">
                                <MaterialIcon name="check_circle" className="text-emerald-500 text-lg shrink-0 mt-0.5" />
                                <span>조회 후 <strong>메모 수정</strong> 또는 <strong>신청 취소</strong>가 가능합니다</span>
                            </li>
                        </ul>
                    </section>

                    {/* 주의사항 */}
                    <section className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <MaterialIcon name="warning" className="text-amber-600" />
                            <h2 className="text-base font-bold text-slate-900">주의사항</h2>
                        </div>
                        <ul className="space-y-2 text-sm text-slate-700">
                            <li className="flex gap-2 items-start">
                                <span className="text-amber-500 shrink-0">•</span>
                                <span>비밀번호는 <strong>숫자 4자리</strong>만 가능합니다</span>
                            </li>
                            <li className="flex gap-2 items-start">
                                <span className="text-amber-500 shrink-0">•</span>
                                <span>비밀번호를 잊으면 조회/수정/취소가 안 됩니다 → <strong>운영자에게 문의</strong>해주세요</span>
                            </li>
                            <li className="flex gap-2 items-start">
                                <span className="text-amber-500 shrink-0">•</span>
                                <span>1인 1회만 신청 가능합니다 (중복 신청 불가)</span>
                            </li>
                            <li className="flex gap-2 items-start">
                                <span className="text-amber-500 shrink-0">•</span>
                                <span>일정이 마감되면 해당 시간은 선택할 수 없습니다</span>
                            </li>
                        </ul>
                    </section>
                </main>

                {/* Fixed Bottom Buttons */}
                <div className="fixed bottom-0 left-0 right-0 z-10 flex justify-center">
                    <div className="w-full max-w-[430px] bg-white/90 backdrop-blur-md border-t border-slate-100 px-4 py-4 space-y-2">
                        <Link
                            href="/tour/register"
                            className="w-full h-14 bg-gradient-to-r from-[#6d13ec] to-[#9333ea] text-white font-bold rounded-xl shadow-lg shadow-[#6d13ec]/30 hover:shadow-[#6d13ec]/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-base"
                        >
                            신청하기
                            <MaterialIcon name="arrow_forward" className="text-lg" />
                        </Link>
                        <Link
                            href="/tour/my"
                            className="w-full h-12 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-1 text-sm"
                        >
                            신청현황 보기
                            <MaterialIcon name="arrow_forward_ios" className="text-xs" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
