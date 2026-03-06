'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { TourLeaderAutocomplete } from '@/components/tour/TourLeaderAutocomplete';
import { formatTourLeaderLabel, getTourLeaderByQuery } from '@/lib/tour-leaders';
import type { TourLeader, TourReservationManageView, TourSlot } from '@/types';

interface PublicReservation {
    name: string;
    slot_id: string;
    status: string;
    tour_slots: { tour_date: string; tour_time: string; time_label: string };
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${month}월 ${day}일 (${weekday})`;
}

function formatShortDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function TourMyPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#f7f6f8]" />}>
            <TourMyContent />
        </Suspense>
    );
}

type ModalMode = null | 'auth' | 'detail' | 'change';

function TourMyContent() {
    const [slots, setSlots] = useState<TourSlot[]>([]);
    const [leaders, setLeaders] = useState<TourLeader[]>([]);
    const [reservations, setReservations] = useState<PublicReservation[]>([]);
    const [loading, setLoading] = useState(true);

    // Auth & manage
    const [modal, setModal] = useState<ModalMode>(null);
    const [leaderQuery, setLeaderQuery] = useState('');
    const [selectedLeader, setSelectedLeader] = useState<TourLeader | null>(null);
    const [pin, setPin] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [reservation, setReservation] = useState<TourReservationManageView | null>(null);
    const [selectedNewSlot, setSelectedNewSlot] = useState<string | null>(null);
    const [changing, setChanging] = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [slotsRes, leadersRes, reservationsRes] = await Promise.all([
                fetch('/api/tour/slots'),
                fetch('/api/tour/leaders'),
                fetch('/api/tour/reservations/public'),
            ]);
            const [slotsJson, leadersJson, reservationsJson] = await Promise.all([
                slotsRes.json(), leadersRes.json(), reservationsRes.json(),
            ]);
            if (slotsJson.data) setSlots(slotsJson.data);
            if (leadersJson.data) setLeaders(leadersJson.data);
            if (reservationsJson.data) setReservations(reservationsJson.data);
        } catch {
            console.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLeader) { setError('조장을 선택해주세요'); return; }
        if (!/^\d{4}$/.test(pin)) { setError('비밀번호 4자리를 입력해주세요'); return; }

        setAuthLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/tour/reservations/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: selectedLeader.name, pin }),
            });
            const json = await res.json();
            if (!res.ok) { setError(json.error); return; }
            setReservation(json.data);
            setModal('detail');
        } catch {
            setError('네트워크 오류가 발생했습니다');
        } finally {
            setAuthLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!reservation) return;
        if (!confirm('정말 취소하시겠습니까?')) return;

        setAuthLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/tour/reservations/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancel', name: reservation.name, pin }),
            });
            const json = await res.json();
            if (!res.ok) { setError(json.error); return; }
            setMessage('예약이 취소되었습니다');
            setModal(null);
            setReservation(null);
            fetchAll();
        } catch {
            setError('네트워크 오류가 발생했습니다');
        } finally {
            setAuthLoading(false);
        }
    };

    const handleChangeSlot = async () => {
        if (!reservation || !selectedNewSlot) return;
        setChanging(true);
        setError(null);
        try {
            const res = await fetch('/api/tour/reservations/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'change_slot', name: reservation.name, pin, new_slot_id: selectedNewSlot }),
            });
            const json = await res.json();
            if (!res.ok) { setError(json.error); return; }
            setReservation(json.data);
            setMessage('일정이 변경되었습니다');
            setModal(null);
            setSelectedNewSlot(null);
            fetchAll();
        } catch {
            setError('네트워크 오류가 발생했습니다');
        } finally {
            setChanging(false);
        }
    };

    const openAuthModal = () => {
        setModal('auth');
        setError(null);
        setMessage(null);
        setPin('');
        setLeaderQuery('');
        setSelectedLeader(null);
    };

    // Group reservations by slot
    const reservationsBySlot = reservations.reduce<Record<string, PublicReservation[]>>((acc, r) => {
        (acc[r.slot_id] ||= []).push(r);
        return acc;
    }, {});

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f7f6f8] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6d13ec]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f7f6f8]">
            <div className="max-w-[430px] mx-auto bg-[#f7f6f8] shadow-2xl min-h-screen">
                {/* Header */}
                <header className="sticky top-0 z-10 bg-[#f7f6f8]/80 backdrop-blur-md px-4 pt-6 pb-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-bold text-slate-900">신청 현황</h1>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={openAuthModal}
                                className="px-3 py-1.5 text-xs font-semibold bg-[#6d13ec] text-white rounded-lg hover:bg-[#5a0ec5] transition-colors"
                            >
                                내 신청 수정/취소
                            </button>
                            <Link href="/tour" className="text-xs text-[#6d13ec] font-semibold hover:opacity-80">
                                신청하기 &rarr;
                            </Link>
                        </div>
                    </div>
                </header>

                <main className="px-4 pb-8">
                    {message && (
                        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3 mb-4">
                            {message}
                        </div>
                    )}

                    {/* Slot cards with reservations */}
                    {slots.length === 0 && (
                        <p className="text-center text-slate-400 text-sm py-12">등록된 일정이 없습니다</p>
                    )}

                    {slots.map(slot => {
                        const slotReservations = reservationsBySlot[slot.id] || [];
                        const remaining = slot.max_capacity - slot.current_bookings;
                        const isFull = remaining <= 0;

                        return (
                            <div key={slot.id} className="bg-white rounded-xl border border-slate-100 shadow-sm mb-2 overflow-hidden">
                                {/* Slot header */}
                                <div className={`px-3 py-2 flex items-center justify-between ${slotReservations.length > 0 ? 'border-b border-slate-100' : ''}`}>
                                    <p className="font-bold text-sm text-slate-900">
                                        {formatDate(slot.tour_date)} <span className="text-slate-500 font-medium">{slot.time_label}</span>
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-400">{slot.current_bookings}/{slot.max_capacity}명</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            isFull ? 'bg-slate-200 text-slate-500'
                                            : remaining <= 1 ? 'bg-amber-100 text-amber-700'
                                            : 'bg-emerald-100 text-emerald-700'
                                        }`}>
                                            {isFull ? '마감' : `잔여 ${remaining}석`}
                                        </span>
                                    </div>
                                </div>

                                {/* Reservation list */}
                                {slotReservations.length > 0 && (
                                    <div className="px-3 py-1.5">
                                        <div className="flex flex-wrap gap-1">
                                            {slotReservations.map((r, i) => (
                                                <span key={i} className="inline-flex items-center px-2 py-0.5 bg-[#6d13ec]/5 text-[#6d13ec] text-[11px] font-medium rounded border border-[#6d13ec]/10">
                                                    {r.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </main>

                {/* Auth Modal */}
                {modal === 'auth' && (
                    <>
                        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)} />
                        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center">
                            <div className="w-full max-w-[480px] bg-white rounded-t-3xl shadow-2xl p-5 animate-[slideUp_0.3s_ease-out]">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-slate-900">내 신청 조회</h2>
                                    <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 p-1">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>

                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-4">{error}</div>
                                )}

                                <form onSubmit={handleAuth} className="space-y-4">
                                    <TourLeaderAutocomplete
                                        leaders={leaders}
                                        label="조/조장명"
                                        placeholder="조 번호 또는 조장 이름"
                                        value={leaderQuery}
                                        selectedLeader={selectedLeader}
                                        onValueChange={value => {
                                            setLeaderQuery(value);
                                            setSelectedLeader(getTourLeaderByQuery(leaders, value));
                                        }}
                                        onSelect={leader => {
                                            setSelectedLeader(leader);
                                            setLeaderQuery(formatTourLeaderLabel(leader));
                                            setError(null);
                                        }}
                                    />
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">비밀번호</label>
                                        <input
                                            type="password"
                                            inputMode="numeric"
                                            value={pin}
                                            onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setPin(v); }}
                                            className="w-full px-4 h-12 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-[#6d13ec] focus:border-[#6d13ec] text-base tracking-[0.3em] text-center font-mono placeholder:text-slate-400"
                                            placeholder="●●●●"
                                            required
                                            maxLength={4}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={authLoading}
                                        className="w-full h-12 bg-gradient-to-r from-[#6d13ec] to-[#9333ea] text-white font-bold rounded-xl shadow-lg shadow-[#6d13ec]/30 disabled:opacity-50"
                                    >
                                        {authLoading ? '조회 중...' : '조회하기'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </>
                )}

                {/* Detail Modal */}
                {modal === 'detail' && reservation && (
                    <>
                        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)} />
                        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center">
                            <div className="w-full max-w-[480px] bg-white rounded-t-3xl shadow-2xl p-5 animate-[slideUp_0.3s_ease-out]">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-slate-900">내 신청 정보</h2>
                                    <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 p-1">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>

                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-4">{error}</div>
                                )}

                                <div className="space-y-3 mb-5">
                                    <div className="bg-[#6d13ec]/5 border border-[#6d13ec]/20 rounded-xl p-4">
                                        <p className="text-xs text-[#6d13ec] font-bold mb-1">일정</p>
                                        <p className="text-lg font-bold text-slate-900">
                                            {formatDate(reservation.tour_slots.tour_date)} {reservation.tour_slots.time_label}
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl p-4">
                                        <p className="text-xs text-slate-500 mb-1">신청자</p>
                                        <p className="font-bold text-slate-900">{reservation.name}</p>
                                    </div>
                                    {reservation.memo && (
                                        <div className="bg-slate-50 rounded-xl p-4">
                                            <p className="text-xs text-slate-500 mb-1">메모</p>
                                            <p className="text-sm text-slate-700">{reservation.memo}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setModal('change'); setError(null); }}
                                        className="flex-1 h-12 text-sm bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold shadow-lg shadow-cyan-500/25"
                                    >
                                        일정 변경
                                    </button>
                                    <button
                                        onClick={handleCancel}
                                        disabled={authLoading}
                                        className="flex-1 h-12 text-sm bg-red-50 text-red-600 rounded-xl font-bold border border-red-200 hover:bg-red-100 disabled:opacity-50"
                                    >
                                        {authLoading ? '취소 중...' : '신청 취소'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Change Slot Modal */}
                {modal === 'change' && reservation && (
                    <>
                        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)} />
                        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center">
                            <div className="w-full max-w-[480px] bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out]">
                                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                                    <h2 className="text-lg font-bold text-slate-900">일정 변경</h2>
                                    <button onClick={() => { setModal('detail'); setSelectedNewSlot(null); setError(null); }} className="text-slate-400 hover:text-slate-600 p-1">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>

                                <div className="p-5 overflow-y-auto max-h-[60vh]">
                                    {error && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-4">{error}</div>
                                    )}

                                    <p className="text-xs text-slate-500 mb-3">
                                        현재: <span className="font-bold text-slate-700">{formatDate(reservation.tour_slots.tour_date)} {reservation.tour_slots.time_label}</span>
                                    </p>

                                    <div className="space-y-2">
                                        {slots
                                            .filter(s => s.id !== reservation.slot_id && s.current_bookings < s.max_capacity)
                                            .map(slot => {
                                                const remaining = slot.max_capacity - slot.current_bookings;
                                                const isSelected = selectedNewSlot === slot.id;
                                                return (
                                                    <button
                                                        key={slot.id}
                                                        onClick={() => setSelectedNewSlot(slot.id)}
                                                        className={`w-full text-left rounded-xl border p-3 transition-all ${
                                                            isSelected ? 'border-cyan-400 ring-2 ring-cyan-200 bg-cyan-50' : 'border-slate-200 hover:border-cyan-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-medium text-slate-800 text-sm">{formatDate(slot.tour_date)} {slot.time_label}</span>
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${remaining <= 1 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                                                                잔여 {remaining}석
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        {slots.filter(s => s.id !== reservation.slot_id && s.current_bookings < s.max_capacity).length === 0 && (
                                            <p className="text-center text-sm text-slate-400 py-4">변경 가능한 일정이 없습니다</p>
                                        )}
                                    </div>
                                </div>

                                <div className="p-5 border-t border-slate-100">
                                    <button
                                        onClick={handleChangeSlot}
                                        disabled={!selectedNewSlot || changing}
                                        className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 disabled:opacity-50"
                                    >
                                        {changing ? '변경 중...' : '일정 변경하기'}
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
