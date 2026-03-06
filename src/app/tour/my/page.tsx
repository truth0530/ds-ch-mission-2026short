'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { TourSlot, TourReservationWithSlot } from '@/types';

function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${month}월 ${day}일 (${weekday})`;
}

type ViewMode = 'lookup' | 'detail' | 'change';

export default function TourMyPage() {
    const [view, setView] = useState<ViewMode>('lookup');
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reservation, setReservation] = useState<TourReservationWithSlot | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    // 날짜 변경용
    const [slots, setSlots] = useState<TourSlot[]>([]);
    const [selectedNewSlot, setSelectedNewSlot] = useState<string | null>(null);
    const [changing, setChanging] = useState(false);

    const fetchSlots = useCallback(async () => {
        const res = await fetch('/api/tour/slots');
        const json = await res.json();
        if (json.data) setSlots(json.data);
    }, []);

    useEffect(() => {
        fetchSlots();
    }, [fetchSlots]);

    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const res = await fetch('/api/tour/reservations/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reservation_code: code, name }),
            });

            const json = await res.json();
            if (!res.ok) {
                setError(json.error);
                return;
            }

            setReservation(json.data);
            setView('detail');
        } catch {
            setError('네트워크 오류가 발생했습니다');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!reservation) return;
        if (!confirm('정말 취소하시겠습니까?')) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/tour/reservations/${reservation.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancel' }),
            });

            const json = await res.json();
            if (!res.ok) {
                setError(json.error);
                return;
            }

            setReservation(json.data);
            setMessage('예약이 취소되었습니다');
            fetchSlots();
        } catch {
            setError('네트워크 오류가 발생했습니다');
        } finally {
            setLoading(false);
        }
    };

    const handleChangeSlot = async () => {
        if (!reservation || !selectedNewSlot) return;

        setChanging(true);
        setError(null);

        try {
            const res = await fetch(`/api/tour/reservations/${reservation.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'change_slot', new_slot_id: selectedNewSlot }),
            });

            const json = await res.json();
            if (!res.ok) {
                setError(json.error);
                return;
            }

            setReservation(json.data);
            setMessage('일정이 변경되었습니다');
            setView('detail');
            setSelectedNewSlot(null);
            fetchSlots();
        } catch {
            setError('네트워크 오류가 발생했습니다');
        } finally {
            setChanging(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-md mx-auto">
                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-xl font-bold text-slate-800 mb-1">내 신청 조회</h1>
                    <p className="text-sm text-slate-500">예약번호와 이름으로 조회합니다</p>
                    <Link
                        href="/tour"
                        className="inline-block mt-2 text-xs text-indigo-500 hover:text-indigo-700 underline"
                    >
                        투어 신청 페이지로 돌아가기
                    </Link>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-4">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3 mb-4">
                        {message}
                    </div>
                )}

                {/* 조회 폼 */}
                {view === 'lookup' && (
                    <div className="bg-white rounded-2xl shadow-lg p-5">
                        <form onSubmit={handleLookup} className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">예약번호</label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={e => setCode(e.target.value.toUpperCase())}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent uppercase tracking-wider font-mono"
                                    placeholder="ABC123"
                                    required
                                    maxLength={6}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">이름</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="홍길동"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2.5 text-sm bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25 font-medium disabled:opacity-50"
                            >
                                {loading ? '조회 중...' : '조회하기'}
                            </button>
                        </form>
                    </div>
                )}

                {/* 예약 상세 */}
                {view === 'detail' && reservation && (
                    <div className="bg-white rounded-2xl shadow-lg p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                reservation.status === 'active'
                                    ? 'bg-green-100 text-green-600'
                                    : 'bg-red-100 text-red-600'
                            }`}>
                                {reservation.status === 'active' ? '신청완료' : '취소됨'}
                            </span>
                            <span className="text-xs text-slate-400">
                                예약번호: {reservation.reservation_code}
                            </span>
                        </div>

                        <div className="space-y-3 mb-4">
                            <div className="bg-slate-50 rounded-lg p-3">
                                <div className="text-xs text-slate-500 mb-1">일정</div>
                                <div className="font-medium text-slate-800">
                                    {formatDate(reservation.tour_slots.tour_date)} {reservation.tour_slots.time_label}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <div className="text-xs text-slate-500 mb-1">이름</div>
                                    <div className="font-medium text-slate-800">{reservation.name}</div>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <div className="text-xs text-slate-500 mb-1">연락처</div>
                                    <div className="font-medium text-slate-800">{reservation.phone}</div>
                                </div>
                            </div>
                            {reservation.email && (
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <div className="text-xs text-slate-500 mb-1">이메일</div>
                                    <div className="font-medium text-slate-800">{reservation.email}</div>
                                </div>
                            )}
                            {reservation.memo && (
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <div className="text-xs text-slate-500 mb-1">메모</div>
                                    <div className="text-sm text-slate-700">{reservation.memo}</div>
                                </div>
                            )}
                        </div>

                        {reservation.status === 'active' && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setView('change'); setError(null); setMessage(null); }}
                                    className="flex-1 py-2.5 text-sm bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all shadow-lg shadow-cyan-500/25 font-medium"
                                >
                                    일정 변경
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={loading}
                                    className="flex-1 py-2.5 text-sm bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-medium border border-red-200 disabled:opacity-50"
                                >
                                    {loading ? '취소 중...' : '신청 취소'}
                                </button>
                            </div>
                        )}

                        <button
                            onClick={() => { setView('lookup'); setReservation(null); setError(null); setMessage(null); }}
                            className="w-full mt-2 py-2 text-xs text-slate-400 hover:text-slate-600"
                        >
                            다른 예약 조회
                        </button>
                    </div>
                )}

                {/* 일정 변경 */}
                {view === 'change' && reservation && (
                    <div className="bg-white rounded-2xl shadow-lg p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-slate-800">일정 변경</h2>
                            <button
                                onClick={() => { setView('detail'); setSelectedNewSlot(null); setError(null); }}
                                className="text-slate-400 hover:text-slate-600 p-1"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="text-xs text-slate-500 mb-3">
                            현재: {formatDate(reservation.tour_slots.tour_date)} {reservation.tour_slots.time_label}
                        </div>

                        <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
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
                                                isSelected
                                                    ? 'border-cyan-400 ring-2 ring-cyan-200 bg-cyan-50'
                                                    : 'border-slate-200 hover:border-cyan-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-slate-800 text-sm">
                                                    {formatDate(slot.tour_date)} {slot.time_label}
                                                </span>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                    remaining <= 1 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
                                                }`}>
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

                        <button
                            onClick={handleChangeSlot}
                            disabled={!selectedNewSlot || changing}
                            className="w-full py-2.5 text-sm bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all shadow-lg shadow-cyan-500/25 font-medium disabled:opacity-50"
                        >
                            {changing ? '변경 중...' : '일정 변경하기'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
