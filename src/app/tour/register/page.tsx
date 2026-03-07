'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TourLeaderAutocomplete } from '@/components/tour/TourLeaderAutocomplete';
import { getSbClient } from '@/lib/supabase';
import { TABLES } from '@/lib/constants';
import { formatTourLeaderLabel, getTourLeaderByName, getTourLeaderByQuery } from '@/lib/tour-leaders';
import type { TourLeader, TourReservationPublicView, TourSlot } from '@/types';

function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${month}월 ${day}일 (${weekday})`;
}

function formatMonth(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return `2026년 ${date.getMonth() + 1}월`;
}

function MaterialIcon({ name, className = '', filled = false }: { name: string; className?: string; filled?: boolean }) {
    return (
        <span className={`material-symbols-outlined ${className}`}
              style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>
            {name}
        </span>
    );
}

interface ReservationForm {
    name: string;
    pin: string;
    memo: string;
}

export default function TourPage() {
    const [slots, setSlots] = useState<TourSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSlot, setSelectedSlot] = useState<TourSlot | null>(null);
    const [leaders, setLeaders] = useState<TourLeader[]>([]);
    const [form, setForm] = useState<ReservationForm>({ name: '', pin: '', memo: '' });
    const [leaderQuery, setLeaderQuery] = useState('');
    const [selectedLeader, setSelectedLeader] = useState<TourLeader | null>(null);
    const [bookedNames, setBookedNames] = useState<Set<string>>(new Set());
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<TourReservationPublicView | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchSlots = useCallback(async () => {
        try {
            const res = await fetch('/api/tour/slots');
            const json = await res.json();
            if (json.data) setSlots(json.data);
        } catch {
            console.error('Failed to fetch slots');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchLeaders = useCallback(async () => {
        try {
            const res = await fetch('/api/tour/leaders');
            const json = await res.json();
            if (json.data) setLeaders(json.data);
        } catch {
            console.error('Failed to fetch leaders');
        }
    }, []);

    const fetchBookedNames = useCallback(async () => {
        try {
            const res = await fetch('/api/tour/reservations/public');
            const json = await res.json();
            if (json.data) {
                setBookedNames(new Set(json.data.map((r: { name: string }) => r.name)));
            }
        } catch {
            console.error('Failed to fetch booked names');
        }
    }, []);

    useEffect(() => {
        fetchSlots();
        fetchLeaders();
        fetchBookedNames();
    }, [fetchSlots, fetchLeaders, fetchBookedNames]);

    // Supabase Realtime
    useEffect(() => {
        const client = getSbClient();
        if (!client) return;
        const channel = client
            .channel('tour_slots_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.TOUR_SLOTS }, (payload) => {
                setSlots(prev => {
                    const updated = payload.new as TourSlot;
                    return prev.map(s => s.id === updated.id ? { ...s, ...updated } : s);
                });
            })
            .subscribe();
        return () => { client.removeChannel(channel); };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSlot) return;
        if (!selectedLeader) {
            setError('조/조장명을 검색해서 목록에서 선택해주세요');
            return;
        }
        if (!/^\d{4}$/.test(form.pin)) {
            setError('비밀번호 4자리를 입력해주세요');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch('/api/tour/reservations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slot_id: selectedSlot.id,
                    name: selectedLeader.name,
                    pin: form.pin,
                    memo: form.memo || undefined,
                }),
            });
            const json = await res.json();
            if (!res.ok) { setError(json.error || '신청에 실패했습니다'); return; }
            setResult(json.data);
            setSelectedSlot(null);
            setForm({ name: '', pin: '', memo: '' });
            setLeaderQuery('');
            setSelectedLeader(null);
            fetchSlots();
        } catch {
            setError('네트워크 오류가 발생했습니다');
        } finally {
            setSubmitting(false);
        }
    };

    const morningSlots = slots.filter(s => s.tour_time === '10:00:00' || s.tour_time === '10:00');
    const afternoonSlots = slots.filter(s => s.tour_time === '17:00:00' || s.tour_time === '17:00');
    const resultLeader = result ? getTourLeaderByName(leaders, result.name) : null;

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f7f6f8] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6d13ec]" />
            </div>
        );
    }

    // 신청 완료 화면
    if (result) {
        return (
            <div className="min-h-screen bg-[#f7f6f8] flex items-center justify-center px-4">
                <div className="w-full max-w-[430px] mx-auto">
                    <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
                            <MaterialIcon name="check_circle" className="text-emerald-500 text-5xl" filled />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">신청이 완료되었습니다!</h2>
                        <p className="text-sm text-slate-500 mb-6">수정/취소는 신청현황에서 비밀번호로 가능합니다</p>

                        <div className="bg-[#6d13ec]/5 border border-[#6d13ec]/20 rounded-2xl p-5 mb-6 text-left space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500 text-sm">일정</span>
                                <span className="font-bold text-slate-900">
                                    {formatDate(result.tour_slots.tour_date)} {result.tour_slots.time_label}
                                </span>
                            </div>
                            <div className="h-px bg-slate-200" />
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500 text-sm">신청자</span>
                                <span className="font-bold text-slate-900">
                                    {resultLeader ? formatTourLeaderLabel(resultLeader) : result.name}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setResult(null)}
                                className="flex-1 h-12 text-sm bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors font-semibold"
                            >
                                목록으로
                            </button>
                            <Link
                                href="/tour/my"
                                className="flex-1 h-12 text-sm bg-gradient-to-r from-[#6d13ec] to-[#9333ea] text-white rounded-xl hover:opacity-90 transition-all shadow-lg shadow-[#6d13ec]/30 font-semibold flex items-center justify-center gap-1"
                            >
                                신청현황 보기
                                <MaterialIcon name="arrow_forward" className="text-base" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f7f6f8]">
            <div className="relative flex min-h-screen w-full flex-col max-w-[430px] mx-auto bg-[#f7f6f8] shadow-2xl">

                {/* Header */}
                <header className="sticky top-0 z-10 bg-[#f7f6f8]/80 backdrop-blur-md px-4 pt-6 pb-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="bg-[#6d13ec]/10 p-2 rounded-xl">
                                <MaterialIcon name="church" className="text-[#6d13ec]" />
                            </div>
                            <h1 className="text-xl font-bold tracking-tight text-slate-900">기독유적지 투어 신청</h1>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Link
                            href="/tour/my"
                            className="text-xs font-semibold text-[#6d13ec] flex items-center gap-0.5 hover:opacity-80 transition-opacity"
                        >
                            내 신청 조회/변경/취소
                            <MaterialIcon name="arrow_forward_ios" className="text-[14px]" />
                        </Link>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 px-4 pb-8">
                    {error && !selectedSlot && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-4 flex items-center gap-2">
                            <MaterialIcon name="error" className="text-red-500 text-lg" />
                            {error}
                        </div>
                    )}

                    {/* Step 1: 조장 선택 */}
                    <section className="mt-2 mb-6">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-7 h-7 rounded-full bg-[#6d13ec] text-white text-xs font-bold flex items-center justify-center">1</div>
                                <h2 className="text-base font-bold text-slate-900">조/조장 선택</h2>
                            </div>
                            <TourLeaderAutocomplete
                                leaders={leaders}
                                label=""
                                placeholder="조 번호 또는 조장 이름으로 검색"
                                value={leaderQuery}
                                selectedLeader={selectedLeader}
                                onValueChange={value => {
                                    setLeaderQuery(value);
                                    setForm(f => ({ ...f, name: value }));
                                    const matchedLeader = getTourLeaderByQuery(leaders, value);
                                    setSelectedLeader(matchedLeader);
                                }}
                                onSelect={leader => {
                                    if (bookedNames.has(leader.name)) {
                                        setError('이미 신청된 조장입니다. 수정/취소는 신청현황에서 가능합니다.');
                                        setSelectedLeader(null);
                                        return;
                                    }
                                    setSelectedLeader(leader);
                                    setLeaderQuery(formatTourLeaderLabel(leader));
                                    setForm(f => ({ ...f, name: leader.name }));
                                    setError(null);
                                }}
                            />
                        </div>
                    </section>

                    {/* Step 2: 날짜 선택 (조장 선택 후 활성화) */}
                    <div className={`transition-opacity duration-300 ${selectedLeader ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${selectedLeader ? 'bg-[#6d13ec] text-white' : 'bg-slate-300 text-white'}`}>2</div>
                            <h2 className="text-base font-bold text-slate-900">날짜 선택</h2>
                            {!selectedLeader && <span className="text-xs text-slate-400">조장을 먼저 선택해주세요</span>}
                        </div>

                        {morningSlots.length > 0 && (
                            <SlotSection
                                title="오전 10시"
                                icon="light_mode"
                                iconColor="text-amber-500"
                                slots={morningSlots}
                                selectedSlot={selectedSlot}
                                onSelect={(slot) => { setSelectedSlot(slot); setError(null); }}
                            />
                        )}

                        {afternoonSlots.length > 0 && (
                            <SlotSection
                                title="오후 5시"
                                icon="dark_mode"
                                iconColor="text-indigo-500"
                                slots={afternoonSlots}
                                selectedSlot={selectedSlot}
                                onSelect={(slot) => { setSelectedSlot(slot); setError(null); }}
                            />
                        )}
                    </div>
                </main>

                {/* Bottom Sheet Form Modal */}
                {selectedSlot && (
                    <>
                        <div
                            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
                            onClick={() => { setSelectedSlot(null); setError(null); }}
                        />
                        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center">
                            <div className="w-full max-w-[480px] bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out]">
                                {/* Form Header */}
                                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                                    <h2 className="text-lg font-bold text-slate-900">투어 신청하기</h2>
                                    <button
                                        onClick={() => { setSelectedSlot(null); setError(null); }}
                                        className="text-slate-400 hover:text-slate-600 p-1 transition-colors"
                                    >
                                        <MaterialIcon name="close" className="text-2xl" />
                                    </button>
                                </div>

                                <div className="overflow-y-auto max-h-[70vh] p-5 space-y-5">
                                    {/* Selected Date Summary */}
                                    <div className="flex items-center gap-4 bg-[#6d13ec]/5 p-4 rounded-xl border border-[#6d13ec]/20">
                                        <div className="w-12 h-12 rounded-xl bg-[#6d13ec]/10 flex items-center justify-center shrink-0">
                                            <MaterialIcon name="event" className="text-[#6d13ec]" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[#6d13ec] text-xs font-bold uppercase tracking-wider">Selected Date</span>
                                            <p className="text-slate-900 text-lg font-bold leading-tight">
                                                {formatDate(selectedSlot.tour_date)}
                                            </p>
                                            <p className="text-slate-500 text-sm">
                                                {selectedSlot.time_label} · 잔여 {selectedSlot.max_capacity - selectedSlot.current_bookings}석
                                            </p>
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 flex items-center gap-2">
                                            <MaterialIcon name="error" className="text-red-500 text-lg" />
                                            {error}
                                        </div>
                                    )}

                                    {/* Form Fields */}
                                    <form id="tour-form" onSubmit={handleSubmit} className="space-y-4">
                                        {/* 선택된 조장 표시 */}
                                        {selectedLeader && (
                                            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                                                <MaterialIcon name="person" className="text-emerald-600" />
                                                <div>
                                                    <span className="text-xs text-emerald-600 font-medium">신청자</span>
                                                    <p className="text-sm font-bold text-slate-900">{formatTourLeaderLabel(selectedLeader)}</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-slate-700 text-sm font-semibold px-1">비밀번호 (숫자 4자리)</label>
                                            <input
                                                type="password"
                                                inputMode="numeric"
                                                value={form.pin}
                                                onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setForm(f => ({ ...f, pin: v })); }}
                                                className="w-full px-4 h-12 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-[#6d13ec] focus:border-[#6d13ec] placeholder:text-slate-400 text-base tracking-[0.3em] text-center font-mono"
                                                placeholder="●●●●"
                                                required
                                                maxLength={4}
                                            />
                                            <p className="text-xs text-slate-400 px-1">수정/취소 시 필요합니다</p>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-slate-700 text-sm font-semibold">메모</label>
                                                <span className="text-slate-400 text-xs">선택사항</span>
                                            </div>
                                            <textarea
                                                value={form.memo}
                                                onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-[#6d13ec] focus:border-[#6d13ec] placeholder:text-slate-400 resize-none text-sm"
                                                placeholder="특별한 요청 사항이 있다면 적어주세요"
                                                rows={2}
                                                maxLength={200}
                                            />
                                        </div>
                                    </form>
                                </div>

                                {/* Footer Action */}
                                <div className="p-5 border-t border-slate-100 bg-slate-50/50">
                                    <button
                                        type="submit"
                                        form="tour-form"
                                        disabled={submitting}
                                        className="w-full h-14 bg-gradient-to-r from-[#6d13ec] to-[#9333ea] text-white font-bold rounded-xl shadow-lg shadow-[#6d13ec]/30 hover:shadow-[#6d13ec]/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <span>{submitting ? '신청 중...' : '신청하기'}</span>
                                        {!submitting && <MaterialIcon name="send" className="text-lg" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

/* Slot Section Component */
function SlotSection({
    title, icon, iconColor, slots, selectedSlot, onSelect,
}: {
    title: string;
    icon: string;
    iconColor: string;
    slots: TourSlot[];
    selectedSlot: TourSlot | null;
    onSelect: (slot: TourSlot) => void;
}) {
    return (
        <section className="mt-6 first:mt-2">
            <div className="flex items-center gap-2 mb-4">
                <MaterialIcon name={icon} className={iconColor} filled />
                <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            </div>
            <div className="space-y-2">
                {slots.map(slot => {
                    const remaining = slot.max_capacity - slot.current_bookings;
                    const isFull = remaining <= 0;
                    const isSelected = selectedSlot?.id === slot.id;
                    const fillPercent = (slot.current_bookings / slot.max_capacity) * 100;

                    // 마감된 슬롯은 컴팩트하게 표시
                    if (isFull) {
                        return (
                            <div
                                key={slot.id}
                                className="w-full rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 flex items-center justify-between opacity-60"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-slate-500">
                                        {formatDate(slot.tour_date)}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        {slot.max_capacity}명 마감
                                    </span>
                                </div>
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-300 text-slate-600">
                                    마감
                                </span>
                            </div>
                        );
                    }

                    // 예약 가능한 슬롯은 기존처럼 표시
                    return (
                        <button
                            key={slot.id}
                            onClick={() => onSelect(slot)}
                            className={`w-full text-left rounded-2xl p-5 flex flex-col gap-4 transition-all ${
                                isSelected
                                    ? 'bg-white border-2 border-[#6d13ec] shadow-lg shadow-[#6d13ec]/10'
                                    : 'bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200'
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm text-slate-400 mb-0.5">{formatMonth(slot.tour_date)}</p>
                                    <h3 className="text-lg font-bold text-slate-900">{formatDate(slot.tour_date)}</h3>
                                </div>
                                <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                                    remaining <= 1
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                    잔여 {remaining}석
                                </span>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-medium text-slate-500">예약 현황</span>
                                    <span className="text-slate-400">
                                        {slot.current_bookings}/{slot.max_capacity}명 신청
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-[#6d13ec] transition-all duration-500"
                                        style={{ width: `${fillPercent}%` }}
                                    />
                                </div>
                            </div>

                            <div className="w-full bg-[#6d13ec] text-white font-bold py-3 rounded-xl text-center text-sm hover:opacity-90 transition-all">
                                신청하기
                            </div>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
