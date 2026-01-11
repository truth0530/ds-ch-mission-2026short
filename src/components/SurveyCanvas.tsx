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
    const hiddenInputRef = useRef<HTMLTextAreaElement>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [sbClient, setSbClient] = useState<any>(null);

    const [state, setState] = useState({
        view: 'landing',
        role: null as '선교사' | '인솔자' | '단기선교 팀원' | null,
        selectedTeam: null as TeamInfo | null,
        formData: {} as any,
        focus: null as string | null,
        mouse: { x: 0, y: 0, down: false },
        scroll: 0,
        cursorBlink: 0,
        width: 0,
        height: 0,
        questions: {
            missionary: [] as Question[],
            leader: [] as Question[],
            team_member: [] as Question[]
        },
        auth: {
            user: null as any,
            isAdmin: false,
            loading: true
        }
    });

    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);

    const loadQuestions = async (client: any) => {
        try {
            const { data, error } = await client
                .from('survey_questions')
                .select('*')
                .eq('is_hidden', false)
                .order('sort_order', { ascending: true });

            if (data && data.length > 0) {
                const qMap: any = { missionary: [], leader: [], team_member: [], common: [] };
                data.forEach((q: any) => {
                    const mappedQ: Question = { id: q.id, type: q.type as any, text: q.question_text, options: q.options };
                    if (q.role === 'common') qMap.common.push(mappedQ);
                    else if (qMap[q.role]) qMap[q.role].push(mappedQ);
                });
                setState(prev => ({
                    ...prev,
                    questions: {
                        missionary: qMap.missionary.length > 0 ? qMap.missionary : MISSIONARY_QUESTIONS,
                        leader: qMap.leader.length > 0 ? [...qMap.leader, ...qMap.common] : LEADER_QUESTIONS,
                        team_member: qMap.team_member.length > 0 ? [...qMap.team_member, ...qMap.common] : TEAM_QUESTIONS
                    }
                }));
            } else {
                throw new Error('No questions found');
            }
        } catch (e) {
            console.warn('Falling back to static questions:', e);
            setState(prev => ({
                ...prev,
                questions: {
                    missionary: MISSIONARY_QUESTIONS,
                    leader: LEADER_QUESTIONS,
                    team_member: TEAM_QUESTIONS
                }
            }));
        }
    };


    useEffect(() => {
        const url = ENV.SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (key && key !== 'your_anon_key_here') {
            (async () => {
                try {
                    const client = createSupabaseClient(url, key);
                    setSbClient(client);
                    await loadQuestions(client);

                    // Auth monitoring
                    const { data: { session } } = await client.auth.getSession();
                    if (session?.user) await checkAdmin(client, session.user);
                    else setState(prev => ({ ...prev, auth: { ...prev.auth, loading: false } }));

                    client.auth.onAuthStateChange(async (_event: string, session: any) => {
                        if (session?.user) await checkAdmin(client, session.user);
                        else setState(prev => ({ ...prev, auth: { user: null, isAdmin: false, loading: false } }));
                    });

                    setIsInitialized(true);
                } catch (e) {
                    console.error('Auto-initialization failed:', e);
                }
            })();
        }
    }, []);

    const checkAdmin = async (client: any, user: any) => {
        const { data } = await client.from('admin_users').select('email').eq('email', user.email).single();
        setState(prev => ({
            ...prev,
            auth: { user, isAdmin: !!data || user.email === 'truth0530@gmail.com', loading: false }
        }));
    };

    const handleGoogleLogin = async () => {
        if (!sbClient) return;
        await sbClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
    };

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

    const renderLanding = (ctx: CanvasRenderingContext2D) => {
        const { width, height, mouse, auth } = stateRef.current;
        renderHeader(ctx, '2026 Mission Survey', '단기선교 사역 평가를 위한 관리 시스템입니다.');

        const btnW = width - 80;
        const btnH = 60;
        const centerX = width / 2;
        const startY = height / 2 - 20;

        if (auth.loading) {
            ctx.fillStyle = layout.colors.label;
            ctx.font = '14px sans-serif';
            ctx.fillText('사용자 정보를 확인 중...', width / 2, startY);
            return;
        }

        if (!auth.user) {
            // anonymous start
            const hover1 = isInside(mouse.x, mouse.y, layout.padding, startY, btnW, btnH);
            drawRoundedRect(ctx, layout.padding, startY, btnW, btnH, 15, hover1 ? '#f8fafc' : '#fff', layout.colors.primary);
            ctx.fillStyle = layout.colors.primary;
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText('로그인 없이 설문 시작하기', centerX, startY + 36);

            // admin login
            const hover2 = isInside(mouse.x, mouse.y, layout.padding, startY + 80, btnW, btnH);
            drawRoundedRect(ctx, layout.padding, startY + 80, btnW, btnH, 15, hover2 ? '#1e293b' : '#334155');
            ctx.fillStyle = '#fff';
            ctx.fillText('관리자 구글 로그인', centerX, startY + 116);
        } else {
            // survey start
            const hover1 = isInside(mouse.x, mouse.y, layout.padding, startY, btnW, btnH);
            drawRoundedRect(ctx, layout.padding, startY, btnW, btnH, 15, hover1 ? '#f8fafc' : '#fff', layout.colors.primary);
            ctx.fillStyle = layout.colors.primary;
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText('설문 시작하기', centerX, startY + 36);

            if (auth.isAdmin) {
                const hover2 = isInside(mouse.x, mouse.y, layout.padding, startY + 80, btnW, btnH);
                drawRoundedRect(ctx, layout.padding, startY + 80, btnW, btnH, 15, hover2 ? '#eff6ff' : '#fff', '#2563eb');
                ctx.fillStyle = '#2563eb';
                ctx.fillText('관리 대시보드 이동', centerX, startY + 116);
            }

            ctx.fillStyle = '#94a3b8';
            ctx.font = '11px sans-serif';
            ctx.fillText(`Logged in as: ${auth.user.email}`, centerX, height - 40);
        }
    };

    const renderRoleSelection = (ctx: CanvasRenderingContext2D) => {
        const { width, mouse } = stateRef.current;
        renderHeader(ctx, '역할 선택', '본인의 사역 역할을 선택해 주세요.');

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

    const renderSurveyContent = (ctx: CanvasRenderingContext2D, startY: number) => {
        const { width, role, formData, focus, cursorBlink, mouse, scroll, questions: dynQuestions } = stateRef.current;
        let questions: Question[] = [];
        if (role === '선교사') questions = dynQuestions.missionary;
        else if (role === '인솔자') questions = dynQuestions.leader;
        else if (role === '단기선교 팀원') questions = dynQuestions.team_member;

        let currentY = startY + 20;
        questions.forEach((q) => {
            ctx.fillStyle = layout.colors.label;
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'left';

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
        return btnY + 100;
    };

    const renderTeamPage = (ctx: CanvasRenderingContext2D) => {
        const { width, height, mouse, scroll, selectedTeam, role } = stateRef.current;
        ctx.save();
        ctx.translate(0, -scroll);

        ctx.textAlign = 'left';
        ctx.fillStyle = layout.colors.text;
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = layout.colors.text;
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(role === '선교사' ? '선교사 평가' : '사역팀 선택', layout.padding, 60);

        // Back Button
        const backBtnW = 80;
        const backBtnH = 34;
        const backBtnX = width - layout.padding - backBtnW;
        const backBtnY = 36;
        const hoverBack = isInside(mouse.x, mouse.y + scroll, backBtnX, backBtnY, backBtnW, backBtnH);
        drawRoundedRect(ctx, backBtnX, backBtnY, backBtnW, backBtnH, 8, hoverBack ? '#f1f5f9' : '#fff', layout.colors.border);
        ctx.fillStyle = layout.colors.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('뒤로가기', backBtnX + backBtnW / 2, backBtnY + 21);
        ctx.textAlign = 'left';

        let currentY = 100;
        let lastDept = '';
        const isCollapsed = !!selectedTeam;

        MISSION_TEAMS.forEach((team) => {
            const isSelected = selectedTeam?.missionary === team.missionary;
            if (isCollapsed && !isSelected) return;

            if (!isCollapsed && team.dept !== lastDept) {
                currentY += 20;
                ctx.fillStyle = layout.colors.primary;
                ctx.font = 'bold 14px sans-serif';
                ctx.fillText(`[${team.dept}]`, layout.padding, currentY);
                currentY += 20;
                lastDept = team.dept;
            }

            const btnH = 65;
            const hover = isInside(mouse.x, mouse.y + scroll, layout.padding, currentY, width - layout.padding * 2, btnH);
            drawRoundedRect(ctx, layout.padding, currentY, width - layout.padding * 2, btnH, 10, isSelected ? '#eff6ff' : (hover ? '#f8fafc' : '#fff'), isSelected ? layout.colors.primary : layout.colors.border);

            ctx.fillStyle = layout.colors.text;
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText(`${team.missionary} (${team.country})`, layout.padding + 15, currentY + 25);
            ctx.fillStyle = layout.colors.label;
            ctx.font = '11px sans-serif';
            ctx.fillText(`인솔: ${team.leader} | 기간: ${team.period} | 인원: ${team.members}`, layout.padding + 15, currentY + 45);

            if (isSelected) {
                ctx.fillStyle = layout.colors.primary;
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText(isCollapsed ? '변경하려면 클릭' : '선택됨', width - layout.padding - 15, currentY + 25);
                ctx.textAlign = 'left';
            }

            currentY += btnH + 10;
        });

        if (isCollapsed) {
            currentY = renderSurveyContent(ctx, currentY);
        }

        ctx.restore();
        const scrollMax = Math.max(1, currentY - height);
        if (scrollMax > 1) {
            const trackH = height - 40;
            const thumbH = Math.max(30, (height / currentY) * trackH);
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
                case 'landing': renderLanding(ctx); break;
                case 'role_selection': renderRoleSelection(ctx); break;
                case 'team_selection': renderTeamPage(ctx); break;
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
    }, [state.cursorBlink, state.view, state.formData, state.focus, state.mouse, state.scroll, isInitialized, state.selectedTeam]);

    const handleInteraction = (mx: number, my: number) => {
        const { view, width, height, formData, scroll, selectedTeam, role } = stateRef.current;

        if (view === 'landing') {
            const btnW = width - 80;
            const btnH = 60;
            const startY = height / 2 - 20;

            if (!stateRef.current.auth.user) {
                if (isInside(mx, my, layout.padding, startY, btnW, btnH)) {
                    setState(prev => ({ ...prev, view: 'role_selection' }));
                } else if (isInside(mx, my, layout.padding, startY + 80, btnW, btnH)) {
                    handleGoogleLogin();
                }
            } else {
                if (isInside(mx, my, layout.padding, startY, btnW, btnH)) {
                    setState(prev => ({ ...prev, view: 'role_selection' }));
                } else if (stateRef.current.auth.isAdmin && isInside(mx, my, layout.padding, startY + 80, btnW, btnH)) {
                    window.location.href = '/admin/questions';
                }
            }
            return;
        }

        if (view === 'role_selection') {
            const roles = ['선교사', '인솔자', '단기선교 팀원'];
            const startY = 180;
            const btnH = 60;
            roles.forEach((r, i) => {
                const y = startY + (btnH + 20) * i;
                if (isInside(mx, my, layout.padding, y, width - layout.padding * 2, btnH)) {
                    setState(prev => ({ ...prev, role: r as any, view: 'team_selection', scroll: 0, formData: {}, selectedTeam: null }));
                }
            });
            return;
        }

        if (view === 'team_selection') {
            const realY = my + scroll;

            // Back Button Click
            const backBtnW = 80;
            const backBtnH = 34;
            const backBtnX = width - layout.padding - backBtnW;
            const backBtnY = 36;
            if (isInside(mx, realY, backBtnX, backBtnY, backBtnW, backBtnH)) {
                setState(prev => ({ ...prev, view: 'role_selection', role: null, selectedTeam: null, formData: {}, scroll: 0 }));
                return;
            }

            let currentY = 100;
            let lastDept = '';
            const isCollapsed = !!selectedTeam;

            for (let team of MISSION_TEAMS) {
                const isSelected = selectedTeam?.missionary === team.missionary;
                if (isCollapsed && !isSelected) continue;

                if (!isCollapsed && team.dept !== lastDept) { currentY += 40; lastDept = team.dept; }
                const btnH = 65;

                if (isInside(mx, realY, layout.padding, currentY, width - layout.padding * 2, btnH)) {
                    if (isSelected) {
                        setState(prev => ({ ...prev, selectedTeam: null, scroll: 0 }));
                    } else {
                        setState(prev => ({ ...prev, selectedTeam: team, scroll: 0 }));
                    }
                    return;
                }
                currentY += btnH + 10;
            }

            if (isCollapsed) {
                let questions: Question[] = [];
                const qData = stateRef.current.questions;
                if (role === '선교사') questions = qData.missionary;
                else if (role === '인솔자') questions = qData.leader;
                else if (role === '단기선교 팀원') questions = qData.team_member;

                currentY += 20;
                for (let q of questions) {
                    const ctx = canvasRef.current?.getContext('2d');
                    if (!ctx) return;
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
                            if (stateRef.current.focus !== q.id) {
                                setState(prev => ({ ...prev, focus: q.id }));
                                if (hiddenInputRef.current) {
                                    hiddenInputRef.current.value = formData[q.id] || '';
                                    hiddenInputRef.current.focus();
                                }
                            } else {
                                // Already focused, ensure we keep focus
                                hiddenInputRef.current?.focus();
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
            return;
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
            setState(prev => ({ ...prev, view: 'team_selection' }));
        } else {
            setState(prev => ({ ...prev, view: 'success' }));
        }
    };

    if (!isInitialized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f7f6]">
                <div className="animate-pulse text-xl font-bold text-gray-500">시스템 로딩중...</div>
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
                <textarea
                    ref={hiddenInputRef}
                    className="fixed top-0 left-0 w-px h-px opacity-0 pointer-events-none"
                    onChange={(e) => {
                        const val = e.target.value;
                        setState(prev => prev.focus ? { ...prev, formData: { ...prev.formData, [prev.focus]: val } } : prev);
                    }}
                />
            </div>
        </div>
    );
}
