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
    phone: string;
    email: string;
    memo: string;
}

export default function TourPage() {
    const [slots, setSlots] = useState<TourSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSlot, setSelectedSlot] = useState<TourSlot | null>(null);
    const [leaders, setLeaders] = useState<TourLeader[]>([]);
    const [form, setForm] = useState<ReservationForm>({ name: '', phone: '', email: '', memo: '' });
    const [leaderQuery, setLeaderQuery] = useState('');
    const [selectedLeader, setSelectedLeader] = useState<TourLeader | null>(null);
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

    useEffect(() => {
        fetchSlots();
        fetchLeaders();
    }, [fetchSlots, fetchLeaders]);

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
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch('/api/tour/reservations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slot_id: selectedSlot.id,
                    name: selectedLeader.name,
                    phone: form.phone,
                    email: form.email || undefined,
                    memo: form.memo || undefined,
                }),
            });
            const json = await res.json();
            if (!res.ok) { setError(json.error || '신청에 실패했습니다'); return; }
            setResult(json.data);
            setSelectedSlot(null);
            setForm({ name: '', phone: '', email: '', memo: '' });
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
                        <p className="text-sm text-slate-500 mb-6">예약번호와 관리번호를 함께 보관해주세요</p>

                        <div className="bg-[#6d13ec]/5 border border-[#6d13ec]/20 rounded-2xl p-5 mb-6 text-left space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500 text-sm">예약번호</span>
                                <span className="font-bold text-[#6d13ec] text-xl tracking-widest font-mono">{result.reservation_code}</span>
                            </div>
                            <div className="h-px bg-slate-200" />
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500 text-sm">관리번호</span>
                                <span className="font-bold text-slate-900 text-sm tracking-wide font-mono">{result.manage_token}</span>
                            </div>
                            <div className="h-px bg-slate-200" />
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
                                href={`/tour/my?code=${encodeURIComponent(result.reservation_code)}&token=${encodeURIComponent(result.manage_token)}&name=${encodeURIComponent(result.name)}`}
                                className="flex-1 h-12 text-sm bg-gradient-to-r from-[#6d13ec] to-[#9333ea] text-white rounded-xl hover:opacity-90 transition-all shadow-lg shadow-[#6d13ec]/30 font-semibold flex items-center justify-center gap-1"
                            >
                                내 신청 조회
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
                                        <TourLeaderAutocomplete
                                            leaders={leaders}
                                            label="조/조장명"
                                            placeholder="예: 3조 또는 홍수경"
                                            value={leaderQuery}
                                            selectedLeader={selectedLeader}
                                            onValueChange={value => {
                                                setLeaderQuery(value);
                                                setForm(f => ({ ...f, name: value }));
                                                const matchedLeader = getTourLeaderByQuery(leaders, value);
                                                setSelectedLeader(matchedLeader);
                                            }}
                                            onSelect={leader => {
                                                setSelectedLeader(leader);
                                                setLeaderQuery(formatTourLeaderLabel(leader));
                                                setForm(f => ({ ...f, name: leader.name }));
                                                setError(null);
                                            }}
                                            disabled={submitting}
                                        />
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-slate-700 text-sm font-semibold px-1">연락처</label>
                                            <input
                                                type="tel"
                                                value={form.phone}
                                                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                                className="w-full px-4 h-12 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-[#6d13ec] focus:border-[#6d13ec] placeholder:text-slate-400 text-sm"
                                                placeholder="010-0000-0000"
                                                required
                                                maxLength={20}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-slate-700 text-sm font-semibold">이메일</label>
                                                <span className="text-slate-400 text-xs">선택사항</span>
                                            </div>
                                            <input
                                                type="email"
                                                value={form.email}
                                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                                className="w-full px-4 h-12 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-[#6d13ec] focus:border-[#6d13ec] placeholder:text-slate-400 text-sm"
                                                placeholder="example@email.com"
                                                maxLength={100}
                                            />
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
                                                rows={3}
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
            <div className="space-y-4">
                {slots.map(slot => {
                    const remaining = slot.max_capacity - slot.current_bookings;
                    const isFull = remaining <= 0;
                    const isSelected = selectedSlot?.id === slot.id;
                    const fillPercent = (slot.current_bookings / slot.max_capacity) * 100;

                    return (
                        <button
                            key={slot.id}
                            onClick={() => !isFull && onSelect(slot)}
                            disabled={isFull}
                            className={`w-full text-left rounded-2xl p-5 flex flex-col gap-4 transition-all ${
                                isFull
                                    ? 'bg-slate-50 border border-slate-200 opacity-70 cursor-not-allowed'
                                    : isSelected
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
                                    isFull
                                        ? 'bg-slate-200 text-slate-500'
                                        : remaining <= 1
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                    {isFull ? '마감' : `잔여 ${remaining}석`}
                                </span>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-medium text-slate-500">예약 현황</span>
                                    <span className="text-slate-400">
                                        {isFull
                                            ? `${slot.max_capacity}/${slot.max_capacity}명 신청 완료`
                                            : `${slot.current_bookings}/${slot.max_capacity}명 신청`
                                        }
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            isFull ? 'bg-slate-400' : 'bg-[#6d13ec]'
                                        }`}
                                        style={{ width: `${fillPercent}%` }}
                                    />
                                </div>
                            </div>

                            {!isFull ? (
                                <div className="w-full bg-[#6d13ec] text-white font-bold py-3 rounded-xl text-center text-sm hover:opacity-90 transition-all">
                                    신청하기
                                </div>
                            ) : (
                                <div className="w-full bg-slate-200 text-slate-500 font-bold py-3 rounded-xl text-center text-sm cursor-not-allowed">
                                    신청 마감
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
