'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatTourLeaderLabel, searchTourLeaders } from '@/lib/tour-leaders';
import type { TourLeader } from '@/types';

interface TourLeaderAutocompleteProps {
  leaders: TourLeader[];
  label: string;
  placeholder: string;
  value: string;
  selectedLeader: TourLeader | null;
  onValueChange: (value: string) => void;
  onSelect: (leader: TourLeader) => void;
  disabled?: boolean;
}

export function TourLeaderAutocomplete({
  leaders,
  label,
  placeholder,
  value,
  selectedLeader,
  onValueChange,
  onSelect,
  disabled = false,
}: TourLeaderAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const filteredLeaders = useMemo(() => searchTourLeaders(leaders, value).slice(0, 8), [leaders, value]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <div className="flex items-center justify-between px-1">
        <label className="text-slate-700 text-sm font-semibold">{label}</label>
        {selectedLeader && (
          <span className="text-[11px] text-emerald-600 font-medium">
            선택됨: {formatTourLeaderLabel(selectedLeader)}
          </span>
        )}
      </div>

      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={event => {
            onValueChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="w-full px-4 h-12 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-[#6d13ec] focus:border-[#6d13ec] placeholder:text-slate-400 text-sm"
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
          required
        />

        {open && filteredLeaders.length > 0 && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-10 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="max-h-64 overflow-y-auto py-2">
              {filteredLeaders.map(leader => {
                const isSelected = selectedLeader?.name === leader.name;

                return (
                  <button
                    key={leader.name}
                    type="button"
                    onClick={() => {
                      onSelect(leader);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors ${
                      isSelected ? 'bg-[#6d13ec]/8 text-[#6d13ec]' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="font-medium">{leader.name}</span>
                    <span className="text-xs text-slate-400">{leader.group_number}조</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {open && value.trim() && filteredLeaders.length === 0 && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-10 rounded-2xl border border-slate-200 bg-white shadow-2xl px-4 py-3 text-sm text-slate-500">
            일치하는 조장이 없습니다. 조 번호 또는 이름으로 다시 검색해주세요.
          </div>
        )}
      </div>
    </div>
  );
}
