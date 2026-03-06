'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireAdmin } from '@/hooks/useAdminAuth';
import { AdminHeader, AdminLoginCard, AdminErrorAlert } from '@/components/admin';
import type { TourSlot, TourReservationWithSlot } from '@/types';

function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${month}/${day}(${weekday})`;
}

function formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('ko-KR', {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

export default function AdminTourPage() {
    const { user, isAuthorized, loading: authLoading, login, logout, error: authError, clearError } = useRequireAdmin();

    const [loading, setLoading] = useState(true);
    const [slots, setSlots] = useState<TourSlot[]>([]);
    const [reservations, setReservations] = useState<TourReservationWithSlot[]>([]);
    const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/tour/admin');
            const json = await res.json();
            if (json.slots) setSlots(json.slots);
            if (json.reservations) setReservations(json.reservations);
        } catch {
            console.error('Failed to fetch tour admin data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAuthorized) fetchData();
    }, [isAuthorized, fetchData]);

    const handleCancel = async (reservationId: string) => {
        if (!confirm('이 예약을 취소하시겠습니까?')) return;

        setCancelling(reservationId);
        try {
            const res = await fetch(`/api/tour/reservations/${reservationId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancel' }),
            });

            if (res.ok) {
                fetchData();
            }
        } catch {
            console.error('Failed to cancel reservation');
        } finally {
            setCancelling(null);
        }
    };

    if (authLoading) return null;

    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <AdminLoginCard user={user} onLogin={() => login('/admin/tour')} onLogout={logout} title="투어 관리" />
            </div>
        );
    }

    const activeReservations = reservations.filter(r => r.status === 'active');
    const totalActive = activeReservations.length;
    const filteredReservations = selectedSlotId
        ? reservations.filter(r => r.slot_id === selectedSlotId)
        : reservations;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-sm">
            <AdminHeader activePage={'tour' as never} onLogout={logout} />
            <main className="max-w-screen-xl mx-auto px-4 py-3">
                {authError && <AdminErrorAlert error={authError} onDismiss={clearError} />}

                {/* 요약 카드 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-3">
                        <div className="text-xs text-slate-500">전체 슬롯</div>
                        <div className="text-xl font-bold text-slate-800">{slots.length}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-3">
                        <div className="text-xs text-slate-500">총 신청</div>
                        <div className="text-xl font-bold text-indigo-600">{totalActive}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-3">
                        <div className="text-xs text-slate-500">총 정원</div>
                        <div className="text-xl font-bold text-slate-800">{slots.reduce((a, s) => a + s.max_capacity, 0)}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-3">
                        <div className="text-xs text-slate-500">잔여석</div>
                        <div className="text-xl font-bold text-green-600">{slots.reduce((a, s) => a + (s.max_capacity - s.current_bookings), 0)}</div>
                    </div>
                </div>

                {/* 슬롯별 현황 */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
                    <h2 className="font-bold text-slate-800 mb-3">일정별 현황</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        <button
                            onClick={() => setSelectedSlotId(null)}
                            className={`text-left px-3 py-2 rounded-lg text-xs transition-all ${
                                selectedSlotId === null
                                    ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                            }`}
                        >
                            전체 보기 ({reservations.length}건)
                        </button>
                        {slots.map(slot => {
                            const slotReservations = reservations.filter(r => r.slot_id === slot.id && r.status === 'active');
                            const isFull = slot.current_bookings >= slot.max_capacity;
                            return (
                                <button
                                    key={slot.id}
                                    onClick={() => setSelectedSlotId(slot.id)}
                                    className={`text-left px-3 py-2 rounded-lg text-xs transition-all ${
                                        selectedSlotId === slot.id
                                            ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium'
                                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                                    }`}
                                >
                                    <span className="font-medium">{formatDate(slot.tour_date)} {slot.time_label}</span>
                                    <span className={`ml-2 font-bold ${isFull ? 'text-red-500' : 'text-green-600'}`}>
                                        {slotReservations.length}/{slot.max_capacity}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 예약 목록 테이블 */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200">
                        <h2 className="font-bold text-slate-800">
                            신청 목록
                            <span className="text-slate-400 font-normal ml-2">({filteredReservations.length}건)</span>
                        </h2>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-slate-400">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mx-auto" />
                        </div>
                    ) : filteredReservations.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">신청 내역이 없습니다</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-500">
                                        <th className="px-3 py-2 text-left font-medium">일정</th>
                                        <th className="px-3 py-2 text-left font-medium">예약번호</th>
                                        <th className="px-3 py-2 text-left font-medium">이름</th>
                                        <th className="px-3 py-2 text-left font-medium">연락처</th>
                                        <th className="px-3 py-2 text-left font-medium">이메일</th>
                                        <th className="px-3 py-2 text-left font-medium">신청일</th>
                                        <th className="px-3 py-2 text-left font-medium">상태</th>
                                        <th className="px-3 py-2 text-left font-medium">관리</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredReservations.map(r => (
                                        <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {formatDate(r.tour_slots.tour_date)} {r.tour_slots.time_label}
                                            </td>
                                            <td className="px-3 py-2 font-mono font-bold text-indigo-600">{r.reservation_code}</td>
                                            <td className="px-3 py-2 font-medium">{r.name}</td>
                                            <td className="px-3 py-2">{r.phone}</td>
                                            <td className="px-3 py-2 text-slate-400">{r.email || '-'}</td>
                                            <td className="px-3 py-2 text-slate-400">{formatDateTime(r.created_at)}</td>
                                            <td className="px-3 py-2">
                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                    r.status === 'active'
                                                        ? 'bg-green-100 text-green-600'
                                                        : 'bg-red-100 text-red-600'
                                                }`}>
                                                    {r.status === 'active' ? '신청' : '취소'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2">
                                                {r.status === 'active' && (
                                                    <button
                                                        onClick={() => handleCancel(r.id)}
                                                        disabled={cancelling === r.id}
                                                        className="px-2 py-1 text-[10px] bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
                                                    >
                                                        {cancelling === r.id ? '...' : '취소'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
