'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createSupabaseClient } from '@/lib/supabase';

const ENV = {
    PROJECT_NAME: '2026mission_short',
    PROJECT_ID: 'fjdorhdauvumfqhqujaj',
    get SUPABASE_URL() {
        return process.env.NEXT_PUBLIC_SUPABASE_URL || `https://${this.PROJECT_ID}.supabase.co`;
    }
};

import {
    MISSIONARY_QUESTIONS,
    LEADER_QUESTIONS,
    TEAM_QUESTIONS,
    COMMON_SHARED_QUESTIONS,
    Question,
    TeamInfo,
    MISSION_TEAMS
} from '@/lib/surveyData';

const layout = {
    padding: 40,
    headerHeight: 120,
    rowGap: 100,
    inputH: 50,
    textareaH: 100,
    colors: {
        primary: '#2563eb',
        text: '#1f2937',
        label: '#4b5563',
        border: '#d1d5db',
        bg: '#ffffff',
        success: '#10b981'
    }
};

export default function SurveyCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const hiddenInputRef = useRef<HTMLInputElement>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [sbClient, setSbClient] = useState<any>(null);
    const [sbKey, setSbKey] = useState('');

    const [state, setState] = useState({
        view: 'role_selection',
        role: null as '선교사' | '인솔자' | '단기선교 팀원' | null,
        selectedTeam: null as TeamInfo | null,
        formData: {} as any,
        focus: null as string | null,
        mouse: { x: 0, y: 0, down: false },
        scroll: 0,
        cursorBlink: 0,
        width: 0,
        height: 0
    });

    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);

    const initApp = () => {
        if (!sbKey) {
            alert('인증을 위해 Anon Key를 입력해주세요.');
            return;
        }
        try {
            const client = createSupabaseClient(ENV.SUPABASE_URL, sbKey);
            setSbClient(client);
            setIsInitialized(true);
        } catch (e: any) {
            alert('인증 실패: ' + e.message);
        }
    };

    useEffect(() => {
        const url = ENV.SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (key && key !== 'your_anon_key_here') {
            try {
                const client = createSupabaseClient(url, key);
                setSbClient(client);
                setIsInitialized(true);
            } catch (e) {
                console.error('Auto-initialization failed:', e);
            }
        }
    }, []);

    const resize = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const w = Math.min(window.innerWidth - 20, 500);
        const h = Math.min(window.innerHeight - 20, 800);
        setState(prev => ({ ...prev, width: w, height: h }));
        canvas.width = w * window.devicePixelRatio;
        canvas.height = h * window.devicePixelRatio;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
    }, []);

    useEffect(() => {
        if (isInitialized) {
            resize();
            window.addEventListener('resize', resize);
            const interval = setInterval(() => {
                setState(prev => ({ ...prev, cursorBlink: prev.cursorBlink + 1 }));
            }, 16);

            const handleWheel = (e: WheelEvent) => {
                if (stateRef.current.view.endsWith('_survey') || stateRef.current.view === 'team_selection') {
                    e.preventDefault();
                    setState(prev => ({
                        ...prev,
                        scroll: Math.max(0, Math.min(prev.scroll + e.deltaY, 4000))
                    }));
                }
            };
            window.addEventListener('wheel', handleWheel, { passive: false });

            return () => {
                window.removeEventListener('resize', resize);
                window.removeEventListener('wheel', handleWheel);
                clearInterval(interval);
            };
        }
    }, [isInitialized, resize]);

    const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
        const chars = text.split('');
        const lines = [];
        let currentLine = '';
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            const testLine = currentLine + char;
            const metrics = ctx.measureText(testLine);
            if (metrics.width < maxWidth) {
                currentLine = testLine;
            } else {
                lines.push(currentLine);
                currentLine = char;
            }
        }
        lines.push(currentLine);
        return lines;
    };

    const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
    };

    const isInside = (mx: number, my: number, x: number, y: number, w: number, h: number) => {
        return mx >= x && mx <= x + w && my >= y && my <= y + h;
    };

    const renderHeader = (ctx: CanvasRenderingContext2D, title: string, subtitle: string) => {
        const { width } = stateRef.current;
        ctx.fillStyle = layout.colors.text;
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, width / 2, 60);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = layout.colors.label;

        const words = subtitle.split(' ');
        let line = '';
        let currY = 85;
        for (let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = ctx.measureText(testLine);
            if (metrics.width > width - 60 && n > 0) {
                ctx.fillText(line, width / 2, currY);
                line = words[n] + ' ';
                currY += 18;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, width / 2, currY);
    };

    const renderRoleSelection = (ctx: CanvasRenderingContext2D) => {
        const { width, mouse } = stateRef.current;
        renderHeader(ctx, '2026 단기선교 사역 평가', '부족한 부분을 보완하고 더 나은 모습을 이루기 위하여 준비하였습니다.');

        const roles = ['선교사', '인솔자', '단기선교 팀원'];
        const startY = 180;
        const btnH = 60;

        roles.forEach((role, i) => {
            const y = startY + (btnH + 20) * i;
            const hover = isInside(mouse.x, mouse.y, layout.padding, y, width - layout.padding * 2, btnH);
            drawRoundedRect(ctx, layout.padding, y, width - layout.padding * 2, btnH, 12, hover ? '#f1f5f9' : '#fff', layout.colors.border);
            ctx.fillStyle = layout.colors.text;
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${i + 1}. ${role}`, width / 2, y + 36);
        });
    };

    const renderTeamSelection = (ctx: CanvasRenderingContext2D) => {
        const { width, height, mouse, scroll } = stateRef.current;

        ctx.save();
        ctx.translate(0, -scroll);

        ctx.textAlign = 'left';
        ctx.fillStyle = layout.colors.text;
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('사역팀 선택', layout.padding, 60);

        let currentY = 100;
        let lastDept = '';

        MISSION_TEAMS.forEach((team) => {
            if (team.dept !== lastDept) {
                currentY += 20;
                ctx.fillStyle = layout.colors.primary;
                ctx.font = 'bold 14px sans-serif';
                ctx.fillText(`[${team.dept}]`, layout.padding, currentY);
                currentY += 20;
                lastDept = team.dept;
            }

            const btnH = 65;
            const hover = isInside(mouse.x, mouse.y + scroll, layout.padding, currentY, width - layout.padding * 2, btnH);
            drawRoundedRect(ctx, layout.padding, currentY, width - layout.padding * 2, btnH, 10, hover ? '#f8fafc' : '#fff', layout.colors.border);

            ctx.fillStyle = layout.colors.text;
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText(`${team.missionary} (${team.country})`, layout.padding + 15, currentY + 25);

            ctx.fillStyle = layout.colors.label;
            ctx.font = '11px sans-serif';
            ctx.fillText(`인솔: ${team.leader} | 기간: ${team.period} | 인원: ${team.members}`, layout.padding + 15, currentY + 45);

            currentY += btnH + 10;
        });

        ctx.restore();

        const trackH = height - 40;
        const scrollMax = Math.max(1, currentY + 50 - height);
        if (scrollMax > 1) {
            const thumbH = Math.max(30, (height / (currentY + 50)) * trackH);
            const thumbY = 20 + (scroll / scrollMax) * (trackH - thumbH);
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(width - 8, 20, 4, trackH);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(width - 8, thumbY, 4, thumbH);
        }
    };

    const renderSurveyPage = (ctx: CanvasRenderingContext2D, title: string, questions: Question[]) => {
        const { width, height, formData, focus, cursorBlink, mouse, scroll, selectedTeam } = stateRef.current;

        ctx.save();
        ctx.translate(0, -scroll);

        ctx.textAlign = 'left';
        ctx.fillStyle = layout.colors.text;
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(title, layout.padding, 60);

        if (selectedTeam) {
            ctx.fillStyle = layout.colors.label;
            ctx.font = '12px sans-serif';
            ctx.fillText(`사역지: ${selectedTeam.country} | 선교사: ${selectedTeam.missionary}`, layout.padding, 85);
        }

        let currentY = 120;
        questions.forEach((q) => {
            ctx.fillStyle = layout.colors.label;
            ctx.font = 'bold 14px sans-serif';

            const lines = wrapText(ctx, q.text, width - layout.padding * 2);
            lines.forEach((line, li) => {
                ctx.fillText(line, layout.padding, currentY + li * 20);
            });
            currentY += lines.length * 20 + 10;

            if (q.type === 'scale') {
                const spacing = (width - layout.padding * 2) / 6;
                for (let j = 0; j < 7; j++) {
                    const val = j + 1;
                    const rx = layout.padding + (spacing * j);
                    const isSelected = formData[q.id] === val;
                    ctx.beginPath();
                    ctx.arc(rx, currentY + 15, 12, 0, Math.PI * 2);
                    ctx.strokeStyle = isSelected ? layout.colors.primary : layout.colors.border;
                    ctx.stroke();
                    if (isSelected) {
                        ctx.beginPath();
                        ctx.arc(rx, currentY + 15, 7, 0, Math.PI * 2);
                        ctx.fillStyle = layout.colors.primary;
                        ctx.fill();
                    }
                    ctx.fillStyle = isSelected ? layout.colors.primary : layout.colors.label;
                    ctx.font = '11px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(val.toString(), rx, currentY + 42);
                }
                ctx.textAlign = 'left';
                currentY += 60;
            } else if (q.type === 'multi_select') {
                const options = q.options || [];
                options.forEach((opt, oi) => {
                    const isSelected = (formData[q.id] || []).includes(opt);
                    const optY = currentY + oi * 35;

                    drawRoundedRect(ctx, layout.padding, optY, 20, 20, 4, isSelected ? layout.colors.primary : '#fff', layout.colors.border);
                    if (isSelected) {
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(layout.padding + 5, optY + 10);
                        ctx.lineTo(layout.padding + 9, optY + 14);
                        ctx.lineTo(layout.padding + 15, optY + 6);
                        ctx.stroke();
                    }

                    ctx.fillStyle = layout.colors.text;
                    ctx.font = '13px sans-serif';
                    ctx.textAlign = 'left';
                    ctx.fillText(opt, layout.padding + 30, optY + 15);
                });
                currentY += options.length * 35 + 20;
            } else {
                const isFocus = focus === q.id;
                const h = layout.textareaH;
                drawRoundedRect(ctx, layout.padding, currentY, width - layout.padding * 2, h, 8, isFocus ? '#f8fafc' : '#fff', isFocus ? layout.colors.primary : layout.colors.border);

                ctx.fillStyle = formData[q.id] ? layout.colors.text : '#9ca3af';
                ctx.font = '13px sans-serif';
                const txt = formData[q.id] || '내용을 입력해주세요...';
                const txtLines = wrapText(ctx, txt, width - layout.padding * 2 - 30);
                txtLines.forEach((tl, tli) => {
                    if (tli < 4) ctx.fillText(tl, layout.padding + 15, currentY + 25 + tli * 18);
                });

                if (isFocus && Math.floor(cursorBlink / 30) % 2 === 0) {
                    const lastLine = txtLines[txtLines.length - 1] || '';
                    const tw = ctx.measureText(lastLine).width;
                    ctx.fillStyle = layout.colors.primary;
                    ctx.fillRect(layout.padding + 16 + tw, currentY + 10 + (txtLines.length - 1) * 18, 2, 16);
                }
                currentY += h + 30;
            }
        });

        const btnY = currentY + 20;
        const hover = isInside(mouse.x, mouse.y + scroll, layout.padding, btnY, width - layout.padding * 2, 55);
        drawRoundedRect(ctx, layout.padding, btnY, width - layout.padding * 2, 55, 12, hover ? '#1d4ed8' : layout.colors.primary);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 17px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('평가 제출하기', width / 2, btnY + 34);

        ctx.restore();

        const trackH = height - 40;
        const scrollMax = Math.max(1, currentY + 100 - height);
        if (scrollMax > 1) {
            const thumbH = Math.max(30, (height / (currentY + 100)) * trackH);
            const thumbY = 20 + (scroll / scrollMax) * (trackH - thumbH);
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(width - 8, 20, 4, trackH);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(width - 8, thumbY, 4, thumbH);
        }
    };

    useEffect(() => {
        if (!isInitialized) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const render = () => {
            ctx.clearRect(0, 0, stateRef.current.width, stateRef.current.height);
            switch (stateRef.current.view) {
                case 'role_selection': renderRoleSelection(ctx); break;
                case 'team_selection': renderTeamSelection(ctx); break;
                case 'missionary_survey': renderSurveyPage(ctx, '선교사 평가설문', MISSIONARY_QUESTIONS); break;
                case 'leader_survey': renderSurveyPage(ctx, '인솔자 평가설문', LEADER_QUESTIONS); break;
                case 'team_member_survey': renderSurveyPage(ctx, '팀원 평가설문', TEAM_QUESTIONS); break;
                case 'submitting': {
                    ctx.fillStyle = layout.colors.text;
                    ctx.font = 'bold 20px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('데이터 전송 중...', stateRef.current.width / 2, stateRef.current.height / 2);
                    break;
                }
                case 'success': {
                    ctx.fillStyle = layout.colors.success;
                    ctx.font = 'bold 22px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('제출 완료!', stateRef.current.width / 2, stateRef.current.height / 2);
                    break;
                }
            }
        };
        render();
    }, [state.cursorBlink, state.view, state.formData, state.focus, state.mouse, state.scroll, isInitialized]);

    const handleInteraction = (mx: number, my: number) => {
        const { view, width, height, formData, scroll } = stateRef.current;

        if (view === 'role_selection') {
            const roles = ['선교사', '인솔자', '단기선교 팀원'];
            const startY = 180;
            const btnH = 60;
            roles.forEach((role, i) => {
                const y = startY + (btnH + 20) * i;
                if (isInside(mx, my, layout.padding, y, width - layout.padding * 2, btnH)) {
                    setState(prev => ({ ...prev, role: role as any, view: 'team_selection', scroll: 0, formData: {} }));
                }
            });
            return;
        }

        if (view === 'team_selection') {
            const realY = my + scroll;
            let currentY = 100;
            let lastDept = '';
            for (let team of MISSION_TEAMS) {
                if (team.dept !== lastDept) { currentY += 40; lastDept = team.dept; }
                const btnH = 65;
                if (isInside(mx, realY, layout.padding, currentY, width - layout.padding * 2, btnH)) {
                    const { role } = stateRef.current;
                    setState(prev => ({
                        ...prev,
                        selectedTeam: team,
                        view: role === '선교사' ? 'missionary_survey' : (role === '인솔자' ? 'leader_survey' : 'team_member_survey'),
                        scroll: 0
                    }));
                    return;
                }
                currentY += btnH + 10;
            }
            return;
        }

        if (view.endsWith('_survey')) {
            const realY = my + scroll;
            let currentY = 120;

            const ctx = canvasRef.current?.getContext('2d');
            if (!ctx) return;

            let activeQuestions: Question[] = [];
            if (view === 'missionary_survey') activeQuestions = MISSIONARY_QUESTIONS;
            else if (view === 'leader_survey') activeQuestions = LEADER_QUESTIONS;
            else if (view === 'team_member_survey') activeQuestions = TEAM_QUESTIONS;

            for (let q of activeQuestions) {
                const lineCount = wrapText(ctx, q.text, width - layout.padding * 2).length;
                currentY += lineCount * 20 + 10;

                if (q.type === 'scale') {
                    const spacing = (width - layout.padding * 2) / 6;
                    for (let j = 0; j < 7; j++) {
                        const rx = layout.padding + (spacing * j);
                        if (Math.hypot(mx - rx, realY - (currentY + 15)) < 20) {
                            setState(prev => ({ ...prev, formData: { ...prev.formData, [q.id]: j + 1 } }));
                            return;
                        }
                    }
                    currentY += 60;
                } else if (q.type === 'multi_select') {
                    const options = q.options || [];
                    options.forEach((opt, oi) => {
                        const optY = currentY + oi * 35;
                        if (isInside(mx, realY, layout.padding, optY, width - layout.padding * 2, 30)) {
                            const currentVals = formData[q.id] || [];
                            const nextVals = currentVals.includes(opt)
                                ? currentVals.filter((v: string) => v !== opt)
                                : [...currentVals, opt];
                            setState(prev => ({ ...prev, formData: { ...prev.formData, [q.id]: nextVals } }));
                        }
                    });
                    currentY += options.length * 35 + 20;
                } else {
                    if (isInside(mx, realY, layout.padding, currentY, width - layout.padding * 2, layout.textareaH)) {
                        setState(prev => ({ ...prev, focus: q.id }));
                        if (hiddenInputRef.current) {
                            hiddenInputRef.current.value = formData[q.id] || '';
                            hiddenInputRef.current.focus();
                        }
                        return;
                    }
                    currentY += layout.textareaH + 30;
                }
            }

            const lastBtnY = currentY + 20;
            if (isInside(mx, realY, layout.padding, lastBtnY, width - layout.padding * 2, 55)) {
                submitData();
            } else {
                setState(prev => ({ ...prev, focus: null }));
                hiddenInputRef.current?.blur();
            }
        }

        if (view === 'success') {
            const btnY = height / 2 + 100;
            if (isInside(mx, my, width / 2 - 60, btnY, 120, 40)) {
                setState(prev => ({ ...prev, view: 'role_selection', formData: {}, scroll: 0, role: null, selectedTeam: null }));
            }
        }
    };

    const submitData = async () => {
        const { formData, role, selectedTeam } = stateRef.current;
        setState(prev => ({ ...prev, view: 'submitting' }));

        const payload = {
            role,
            team_dept: selectedTeam?.dept,
            team_country: selectedTeam?.country,
            team_missionary: selectedTeam?.missionary,
            team_leader: selectedTeam?.leader,
            ...formData
        };

        const { error } = await sbClient.from('mission_evaluations').insert([payload]);
        if (error) {
            alert('제출 중 오류가 발생했습니다: ' + error.message);
            setState(prev => ({ ...prev, view: role === '선교사' ? 'missionary_survey' : (role === '인솔자' ? 'leader_survey' : 'team_member_survey') }));
        } else {
            setState(prev => ({ ...prev, view: 'success' }));
        }
    };

    if (!isInitialized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f7f6] p-5">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full">
                    <h2 className="text-2xl font-bold mb-4">사역 평가 시스템 접속</h2>
                    <input type="password" placeholder="Anon Key" value={sbKey} onChange={(e) => setSbKey(e.target.value)} className="w-full p-2.5 border rounded mb-4 focus:ring-1 focus:ring-blue-500 outline-none" />
                    <button onClick={initApp} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition">시작하기</button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative flex items-center justify-center min-h-screen bg-[#f4f7f6]">
            <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
                <canvas
                    ref={canvasRef}
                    onMouseMove={(e) => {
                        const rect = canvasRef.current?.getBoundingClientRect();
                        if (rect) setState(prev => ({ ...prev, mouse: { ...prev.mouse, x: e.clientX - rect.left, y: e.clientY - rect.top } }));
                    }}
                    onMouseDown={(e) => {
                        const rect = canvasRef.current?.getBoundingClientRect();
                        if (rect) {
                            const mx = e.clientX - rect.left;
                            const my = e.clientY - rect.top;
                            handleInteraction(mx, my);
                        }
                    }}
                    className="block cursor-default"
                />
                <input
                    ref={hiddenInputRef}
                    type="text"
                    className="absolute -top-24 -left-24 w-px h-px opacity-0"
                    onChange={(e) => {
                        const val = e.target.value;
                        setState(prev => prev.focus ? { ...prev, formData: { ...prev.formData, [prev.focus]: val } } : prev);
                    }}
                />
            </div>
        </div>
    );
}
