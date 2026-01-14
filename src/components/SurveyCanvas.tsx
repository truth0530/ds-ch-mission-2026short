'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { createSupabaseClient, SupabaseClient } from '@/lib/supabase';
import { ENV_CONFIG, TABLES } from '@/lib/constants';

import {
    MISSIONARY_QUESTIONS,
    LEADER_QUESTIONS,
    TEAM_QUESTIONS,
    COMMON_SHARED_QUESTIONS,
    Question,
    TeamInfo,
    MISSION_TEAMS
} from '@/lib/surveyData';

// Type definitions for Canvas state
type RoleType = '선교사' | '인솔자' | '단기선교 팀원';
type FormDataType = Record<string, string | number | string[]>;
interface QuestionsMap {
    missionary: Question[];
    leader: Question[];
    team_member: Question[];
    common?: Question[];
}

const layout = {
    padding: 24,
    maxWidth: 600,
    headerHeight: 140,
    rowGap: 80,
    inputH: 56,
    textareaH: 120,
    radius: 16,
    colors: {
        primary: '#4f46e5', // Indigo-600
        primaryHover: '#4338ca', // Indigo-700
        secondary: '#0ea5e9', // Sky-500
        text: '#1e293b', // Slate-800
        subtext: '#64748b', // Slate-500
        label: '#475569', // Slate-600
        border: '#e2e8f0', // Slate-200
        bg: '#ffffff',
        bgHover: '#f8fafc', // Slate-50
        cardBg: '#ffffff',
        success: '#10b981', // Emerald-500
        error: '#ef4444', // Red-500
        shadow: 'rgba(148, 163, 184, 0.1)', // Slate shadow
        shadowHover: 'rgba(148, 163, 184, 0.2)'
    }
};

export default function SurveyCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const hiddenInputRef = useRef<HTMLTextAreaElement>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [sbClient, setSbClient] = useState<SupabaseClient | null>(null);

    const [state, setState] = useState({
        view: 'landing',
        role: null as RoleType | null,
        selectedTeam: null as TeamInfo | null,
        formData: {} as FormDataType,
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
            user: null as User | null,
            isAdmin: false,
            loading: true
        },
        error: null as string | null,
        validationErrors: [] as string[],
        respondentInfo: {
            name: '',
            email: ''
        }
    });

    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);

    const loadQuestions = async (client: SupabaseClient) => {
        try {
            const { data, error } = await client
                .from('survey_questions')
                .select('*')
                .eq('is_hidden', false)
                .order('sort_order', { ascending: true });

            if (data && data.length > 0) {
                const qMap: QuestionsMap = { missionary: [], leader: [], team_member: [], common: [] };
                data.forEach((q: { id: string; type: string; question_text: string; options?: string[]; role: string }) => {
                    const mappedQ: Question = { id: q.id, type: q.type as Question['type'], text: q.question_text, options: q.options };
                    if (q.role === 'common') qMap.common?.push(mappedQ);
                    else if (q.role in qMap) (qMap[q.role as keyof QuestionsMap] as Question[]).push(mappedQ);
                });
                setState(prev => ({
                    ...prev,
                    questions: {
                        missionary: qMap.missionary.length > 0 ? qMap.missionary : MISSIONARY_QUESTIONS,
                        leader: qMap.leader.length > 0 ? [...qMap.leader, ...(qMap.common || [])] : LEADER_QUESTIONS,
                        team_member: qMap.team_member.length > 0 ? [...qMap.team_member, ...(qMap.common || [])] : TEAM_QUESTIONS
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

    // ===== VALIDATION FUNCTIONS =====
    const validateFormData = (questions: Question[], formData: FormDataType): string[] => {
        const errors: string[] = [];
        questions.forEach(q => {
            const answer = formData[q.id];
            if (!answer || (typeof answer === 'string' && answer.trim() === '')) {
                errors.push(q.id);
            } else if (q.type === 'multi_select' && Array.isArray(answer) && answer.length === 0) {
                errors.push(q.id);
            }
        });
        return errors;
    };

    const validateTeamSelection = (role: string | null, selectedTeam: TeamInfo | null): boolean => {
        // 인솔자와 팀원은 반드시 팀을 선택해야 함
        if ((role === '인솔자' || role === '단기선교 팀원') && !selectedTeam) {
            return false;
        }
        return true;
    };

    // ===== AUTO-SAVE FUNCTIONS =====
    const getStorageKey = (role: string | null, team: TeamInfo | null) => {
        return `survey_draft_${role}_${team?.missionary || 'general'}`;
    };

    const saveToLocalStorage = useCallback(() => {
        const { role, selectedTeam, formData, respondentInfo } = stateRef.current;
        if (Object.keys(formData).length > 0) {
            const key = getStorageKey(role, selectedTeam);
            localStorage.setItem(key, JSON.stringify({ formData, respondentInfo, savedAt: Date.now() }));
        }
    }, []);

    const loadFromLocalStorage = (role: string | null, team: TeamInfo | null) => {
        const key = getStorageKey(role, team);
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const savedDate = new Date(parsed.savedAt);
                return {
                    formData: parsed.formData || {},
                    respondentInfo: parsed.respondentInfo || { name: '', email: '' },
                    savedDate
                };
            } catch (e) {
                console.error('Failed to parse saved data:', e);
            }
        }
        return null;
    };

    const clearLocalStorage = (role: string | null, team: TeamInfo | null) => {
        const key = getStorageKey(role, team);
        localStorage.removeItem(key);
    };

    // Check for duplicate submission
    const checkDuplicateSubmission = (role: string | null, team: TeamInfo | null): boolean => {
        const key = `survey_submitted_${role}_${team?.missionary || 'general'}`;
        return sessionStorage.getItem(key) === 'true';
    };

    const markAsSubmitted = (role: string | null, team: TeamInfo | null) => {
        const key = `survey_submitted_${role}_${team?.missionary || 'general'}`;
        sessionStorage.setItem(key, 'true');
    };


    useEffect(() => {
        const url = ENV_CONFIG.SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (key && key !== 'your_anon_key_here') {
            (async () => {
                try {
                    const client = createSupabaseClient(url, key);
                    if (!client) {
                        setState(prev => ({ ...prev, auth: { ...prev.auth, loading: false } }));
                        return;
                    }
                    setSbClient(client);
                    await loadQuestions(client);

                    // Auth monitoring
                    const { data: { session } } = await client.auth.getSession();
                    if (session?.user) await checkAdmin(client, session.user);
                    else setState(prev => ({ ...prev, auth: { ...prev.auth, loading: false } }));

                    client.auth.onAuthStateChange(async (_event, session) => {
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

    const checkAdmin = async (client: SupabaseClient, user: User) => {
        const { data } = await client.from(TABLES.ADMIN_USERS).select('email').eq('email', user.email).single();
        const fallbackEmail = ENV_CONFIG.ADMIN_EMAIL;
        setState(prev => ({
            ...prev,
            auth: { user, isAdmin: !!data || !!(fallbackEmail && user.email === fallbackEmail), loading: false }
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
            // Use modulo to prevent infinite growth of cursorBlink value
            const interval = setInterval(() => {
                setState(prev => ({ ...prev, cursorBlink: (prev.cursorBlink + 1) % 60 }));
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

    // Auto-save formData to localStorage
    useEffect(() => {
        if (isInitialized && state.view === 'team_selection' && state.selectedTeam) {
            const timeoutId = setTimeout(() => {
                saveToLocalStorage();
            }, 1000); // Debounce: save 1 second after last change
            return () => clearTimeout(timeoutId);
        }
    }, [state.formData, state.respondentInfo, isInitialized, state.view, state.selectedTeam, saveToLocalStorage]);

    const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
        const words = text.split('');
        const lines = [];
        let currentLine = '';
        for (let i = 0; i < words.length; i++) {
            const char = words[i];
            const testLine = currentLine + char;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && i > 0) {
                lines.push(currentLine);
                currentLine = char;
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine);
        return lines;
    };

    const drawCard = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, opts: {
        fill?: string;
        stroke?: string;
        shadow?: boolean;
        radius?: number;
        hover?: boolean;
    }) => {
        const r = opts.radius || layout.radius;
        const fill = opts.fill || layout.colors.cardBg;

        ctx.save();
        if (opts.shadow) {
            ctx.shadowColor = opts.hover ? layout.colors.shadowHover : layout.colors.shadow;
            ctx.shadowBlur = opts.hover ? 15 : 10;
            ctx.shadowOffsetY = opts.hover ? 4 : 2;
        }

        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fillStyle = fill;
        ctx.fill();

        if (opts.stroke) {
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = opts.stroke;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();
    };

    const drawButton = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, opts: {
        primary?: boolean;
        hover?: boolean;
        icon?: string;
    }) => {
        const fill = opts.primary
            ? (opts.hover ? layout.colors.primaryHover : layout.colors.primary)
            : (opts.hover ? layout.colors.bgHover : layout.colors.bg);

        const textCol = opts.primary ? '#fff' : layout.colors.text;

        drawCard(ctx, x, y, w, h, {
            fill,
            radius: 12,
            shadow: !opts.primary,  // Add shadow to secondary buttons
            stroke: opts.primary ? undefined : layout.colors.border
        });

        ctx.fillStyle = textCol;
        ctx.font = 'bold 16px Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + w / 2, y + h / 2);

        // Reset defaults
        ctx.textBaseline = 'alphabetic';
    };

    const isInside = (mx: number, my: number, x: number, y: number, w: number, h: number) => {
        return mx >= x && mx <= x + w && my >= y && my <= y + h;
    };

    const renderHeader = (ctx: CanvasRenderingContext2D, title: string, subtitle: string) => {
        const { width } = stateRef.current;
        const cx = width / 2;

        // Decorative background blob
        ctx.save();
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, layout.colors.primary);
        gradient.addColorStop(1, layout.colors.secondary);
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, 180);
        ctx.globalAlpha = 1.0;
        ctx.restore();

        // Title
        ctx.fillStyle = layout.colors.text;
        ctx.font = '800 28px Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, cx, 60);

        // Subtitle logic
        ctx.font = '15px Pretendard, sans-serif';
        ctx.fillStyle = layout.colors.subtext;
        const words = subtitle.split('');
        let line = '';
        let currY = 90;
        for (let n = 0; n < words.length; n++) {
            let testLine = line + words[n];
            let metrics = ctx.measureText(testLine);
            if (metrics.width > width - 80 && n > 0) {
                ctx.fillText(line, cx, currY);
                line = words[n];
                currY += 24;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, cx, currY);
    };

    const renderLanding = (ctx: CanvasRenderingContext2D) => {
        const { width, height, mouse, auth } = stateRef.current;
        renderHeader(ctx, '2026 Mission Survey', '단기선교 사역 평가 및 피드백 시스템');

        const btnW = Math.min(width - 48, 320);
        const btnH = 64;
        const centerX = width / 2;
        const btnX = centerX - btnW / 2;
        const startY = height / 2 - 40;

        if (auth.loading) {
            ctx.fillStyle = layout.colors.subtext;
            ctx.font = '14px Pretendard, sans-serif';
            ctx.fillText('사용자 정보를 확인 중...', centerX, startY);
            return;
        }

        if (!auth.user) {
            // anonymous start
            const hover1 = isInside(mouse.x, mouse.y, btnX, startY, btnW, btnH);
            drawButton(ctx, btnX, startY, btnW, btnH, '로그인 없이 시작하기', { primary: true, hover: hover1 });

            // admin login
            const hover2 = isInside(mouse.x, mouse.y, btnX, startY + 80, btnW, btnH);
            drawButton(ctx, btnX, startY + 80, btnW, btnH, '관리자 구글 로그인', { primary: false, hover: hover2 });
        } else {
            // survey start
            const hover1 = isInside(mouse.x, mouse.y, btnX, startY, btnW, btnH);
            drawButton(ctx, btnX, startY, btnW, btnH, '설문 시작하기', { primary: true, hover: hover1 });

            if (auth.isAdmin) {
                const hover2 = isInside(mouse.x, mouse.y, btnX, startY + 80, btnW, btnH);
                drawButton(ctx, btnX, startY + 80, btnW, btnH, '관리 대시보드', { primary: false, hover: hover2 });
            }

            ctx.fillStyle = layout.colors.subtext;
            ctx.font = '12px Pretendard, sans-serif';
            ctx.fillText(`로그인됨: ${auth.user.email}`, centerX, height - 40);
        }
    };

    const renderRoleSelection = (ctx: CanvasRenderingContext2D) => {
        const { width, mouse } = stateRef.current;
        renderHeader(ctx, '역할 선택', '이번 단기선교에서 맡으신 역할을 선택해주세요.');

        const roles = ['선교사', '인솔자', '단기선교 팀원'];
        const startY = 180;
        const btnH = 72;
        const gap = 16;

        roles.forEach((role, i) => {
            const y = startY + (btnH + gap) * i;
            const hover = isInside(mouse.x, mouse.y, layout.padding, y, width - layout.padding * 2, btnH);

            drawCard(ctx, layout.padding, y, width - layout.padding * 2, btnH, {
                fill: hover ? layout.colors.bgHover : '#fff',
                stroke: hover ? layout.colors.primary : layout.colors.border,
                shadow: true,
                hover,
                radius: 16
            });

            ctx.fillStyle = hover ? layout.colors.primary : layout.colors.text;
            ctx.font = 'bold 18px Pretendard, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(role, layout.padding + 24, y + btnH / 2);

            // Arrow icon
            ctx.fillStyle = hover ? layout.colors.primary : layout.colors.subtext;
            ctx.font = '18px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('→', width - layout.padding - 24, y + btnH / 2);

            ctx.textBaseline = 'alphabetic'; // reset
        });
    };

    const renderSurveyContent = (ctx: CanvasRenderingContext2D, startY: number) => {
        const { width, role, formData, focus, cursorBlink, mouse, scroll, questions: dynQuestions, validationErrors } = stateRef.current;
        let questions: Question[] = [];
        if (role === '선교사') questions = dynQuestions.missionary;
        else if (role === '인솔자') questions = dynQuestions.leader;
        else if (role === '단기선교 팀원') questions = dynQuestions.team_member;

        let currentY = startY + 20;
        questions.forEach((q, idx) => {
            const hasError = validationErrors.includes(q.id);

            // Question Text
            ctx.fillStyle = hasError ? layout.colors.error : layout.colors.text;
            ctx.font = 'bold 16px Pretendard, sans-serif';
            ctx.textAlign = 'left';

            const qText = `${idx + 1}. ${q.text}`;
            const lines = wrapText(ctx, qText, width - layout.padding * 2);
            lines.forEach((line, li) => {
                ctx.fillText(line, layout.padding, currentY + li * 24);
            });
            currentY += lines.length * 24 + 12;

            if (q.type === 'scale') {
                const spacing = (width - layout.padding * 2) / 6;
                const circleY = currentY + 20;

                for (let j = 0; j < 7; j++) {
                    const val = j + 1;
                    const rx = layout.padding + (spacing * j);
                    const isSelected = formData[q.id] === val;
                    const isHover = Math.hypot(mouse.x - rx, (mouse.y + scroll) - circleY) < 18;

                    ctx.beginPath();
                    ctx.arc(rx, circleY, 16, 0, Math.PI * 2);

                    if (isSelected) {
                        ctx.fillStyle = layout.colors.primary;
                        ctx.fill();
                        ctx.fillStyle = '#fff';
                    } else {
                        ctx.fillStyle = isHover ? layout.colors.bgHover : '#fff';
                        ctx.fill();
                        ctx.strokeStyle = isHover ? layout.colors.primary : layout.colors.border;
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                        ctx.fillStyle = layout.colors.label;
                    }

                    ctx.font = isSelected ? 'bold 14px Pretendard' : '14px Pretendard';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(val.toString(), rx, circleY);
                }
                ctx.textBaseline = 'alphabetic';
                ctx.textAlign = 'left';

                // Labels for 1 and 7
                ctx.font = '11px Pretendard';
                ctx.fillStyle = layout.colors.subtext;
                ctx.fillText('매우 부족', layout.padding, circleY + 30);
                ctx.textAlign = 'right';
                ctx.fillText('매우 우수', width - layout.padding - 4, circleY + 30);

                currentY += 80;
            } else if (q.type === 'multi_select') {
                const options = q.options || [];
                options.forEach((opt, oi) => {
                    const selectedValues = formData[q.id];
                    const isSelected = Array.isArray(selectedValues) && selectedValues.includes(opt);
                    const optY = currentY + oi * 44;
                    const optH = 36;
                    const hover = isInside(mouse.x, mouse.y + scroll, layout.padding, optY, width - layout.padding * 2, optH);

                    drawCard(ctx, layout.padding, optY, width - layout.padding * 2, optH, {
                        fill: isSelected ? '#eff6ff' : (hover ? '#f8fafc' : '#fff'),
                        stroke: isSelected ? layout.colors.primary : layout.colors.border,
                        radius: 8
                    });

                    // Checkbox icon
                    const checkX = layout.padding + 12;
                    const checkY = optY + 10;
                    ctx.beginPath();
                    ctx.rect(checkX, checkY, 16, 16);
                    ctx.lineWidth = 1.5;
                    ctx.strokeStyle = isSelected ? layout.colors.primary : layout.colors.subtext;
                    ctx.stroke();

                    if (isSelected) {
                        ctx.fillStyle = layout.colors.primary;
                        ctx.fillRect(checkX + 3, checkY + 3, 10, 10);
                    }

                    ctx.fillStyle = isSelected ? layout.colors.primary : layout.colors.text;
                    ctx.font = '14px Pretendard';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(opt, layout.padding + 40, optY + optH / 2);
                });
                ctx.textBaseline = 'alphabetic';
                currentY += options.length * 44 + 20;
            } else {
                const isFocus = focus === q.id;
                const h = layout.textareaH;
                const borderColor = hasError ? layout.colors.error : (isFocus ? layout.colors.primary : layout.colors.border);

                drawCard(ctx, layout.padding, currentY, width - layout.padding * 2, h, {
                    fill: isFocus ? '#fff' : '#f8fafc',
                    stroke: borderColor,
                    shadow: isFocus,
                    radius: 12
                });

                ctx.fillStyle = formData[q.id] ? layout.colors.text : layout.colors.subtext;
                ctx.font = '14px Pretendard';
                const rawTxt = formData[q.id];
                const txt = (typeof rawTxt === 'string' ? rawTxt : '') || '답변을 자유롭게 작성해주세요...';
                const txtLines = wrapText(ctx, txt, width - layout.padding * 2 - 30);
                txtLines.forEach((tl, tli) => {
                    if (tli < 4) ctx.fillText(tl, layout.padding + 16, currentY + 30 + tli * 20);
                });
                if (isFocus && Math.floor(cursorBlink / 30) % 2 === 0) {
                    const lastLine = txtLines[txtLines.length - 1] || '';
                    const tw = ctx.measureText(lastLine).width;
                    ctx.fillStyle = layout.colors.primary;
                    ctx.fillRect(layout.padding + 16 + tw, currentY + 14 + (txtLines.length - 1) * 20, 2, 18);
                }
                currentY += h + 30;
            }
        });

        const btnY = currentY + 20;
        const hover = isInside(mouse.x, mouse.y + scroll, layout.padding, btnY, width - layout.padding * 2, 60);
        drawButton(ctx, layout.padding, btnY, width - layout.padding * 2, 60, '평가 제출하기', {
            primary: true,
            hover
        });

        return btnY + 120;
    };

    // Helper to keep team page logic intact but just update styling in next step...
    const renderTeamPageStyling = (ctx: CanvasRenderingContext2D) => { /* will replace real logic via tool */ };

    const renderTeamPage = (ctx: CanvasRenderingContext2D) => {
        const { width, height, mouse, scroll, selectedTeam, role, error } = stateRef.current;
        ctx.save();
        ctx.translate(0, -scroll);

        // Error banner (if any)
        if (error) {
            const bannerH = 64;
            drawCard(ctx, layout.padding, 20, width - layout.padding * 2, bannerH, {
                fill: '#fef2f2',
                stroke: '#ef4444',
                radius: 12
            });
            ctx.fillStyle = '#b91c1c';
            ctx.font = 'bold 14px Pretendard, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const errorLines = wrapText(ctx, error, width - layout.padding * 2 - 30);
            errorLines.forEach((line, i) => {
                ctx.fillText(line, width / 2, 52 + i * 20 - ((errorLines.length - 1) * 10));
            });
            ctx.textBaseline = 'alphabetic';
            ctx.textAlign = 'left';
        }

        const headerY = error ? 110 : 60;

        ctx.textAlign = 'left';
        ctx.fillStyle = layout.colors.text;
        ctx.font = '800 24px Pretendard, sans-serif';
        const title = role === '선교사' ? '단기선교팀 평가' : '사역팀 선택';
        ctx.fillText(title, layout.padding, headerY);

        // Back Button
        const backBtnW = 80;
        const backBtnH = 36;
        const backBtnX = width - layout.padding - backBtnW;
        const backBtnY = headerY - 26;
        const hoverBack = isInside(mouse.x, mouse.y + scroll, backBtnX, backBtnY, backBtnW, backBtnH);

        drawCard(ctx, backBtnX, backBtnY, backBtnW, backBtnH, {
            fill: hoverBack ? layout.colors.bgHover : '#fff',
            stroke: layout.colors.border,
            radius: 8,
            shadow: true,
            hover: hoverBack
        });

        ctx.fillStyle = layout.colors.subtext;
        ctx.font = 'bold 13px Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('뒤로가기', backBtnX + backBtnW / 2, backBtnY + backBtnH / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        let currentY = headerY + 40;
        let lastDept = '';
        const isCollapsed = !!selectedTeam;

        if (role === '선교사') {
            // For Missionaries, skip team selection and show content directly
            currentY = renderSurveyContent(ctx, currentY);
        } else {
            // For others, show team selection list
            MISSION_TEAMS.forEach((team) => {
                const isSelected = selectedTeam?.missionary === team.missionary;
                if (isCollapsed && !isSelected) return;

                if (!isCollapsed && team.dept !== lastDept) {
                    currentY += 24;
                    ctx.fillStyle = layout.colors.primary;
                    ctx.font = 'bold 13px Pretendard, sans-serif';
                    ctx.fillText(`[${team.dept}]`, layout.padding, currentY);
                    currentY += 12;
                    lastDept = team.dept;
                }

                const btnH = 80;
                const hover = isInside(mouse.x, mouse.y + scroll, layout.padding, currentY, width - layout.padding * 2, btnH);

                drawCard(ctx, layout.padding, currentY, width - layout.padding * 2, btnH, {
                    fill: isSelected ? '#eff6ff' : (hover ? '#f8fafc' : '#fff'),
                    stroke: isSelected ? layout.colors.primary : layout.colors.border,
                    shadow: true,
                    hover: hover || isSelected,
                    radius: 16
                });

                ctx.fillStyle = isSelected ? layout.colors.primary : layout.colors.text;
                ctx.font = 'bold 15px Pretendard, sans-serif';
                ctx.fillText(`${team.missionary} (${team.country})`, layout.padding + 16, currentY + 30);

                ctx.fillStyle = layout.colors.subtext;
                ctx.font = '13px Pretendard, sans-serif';
                ctx.fillText(`인솔: ${team.leader} | 기간: ${team.period}`, layout.padding + 16, currentY + 54);

                if (isSelected) {
                    ctx.fillStyle = layout.colors.primary;
                    ctx.font = 'bold 12px Pretendard, sans-serif';
                    ctx.textAlign = 'right';
                    ctx.fillText(isCollapsed ? '변경하려면 클릭' : '선택됨', width - layout.padding - 16, currentY + 44);
                    ctx.textAlign = 'left';
                }

                currentY += btnH + 12;
            });

            if (isCollapsed) {
                currentY = renderSurveyContent(ctx, currentY);
            }
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
            const roles: RoleType[] = ['선교사', '인솔자', '단기선교 팀원'];
            const startY = 180;
            const btnH = 60;
            roles.forEach((r, i) => {
                const y = startY + (btnH + 20) * i;
                if (isInside(mx, my, layout.padding, y, width - layout.padding * 2, btnH)) {
                    setState(prev => ({
                        ...prev,
                        role: r,
                        view: 'team_selection',
                        scroll: 0,
                        formData: {},
                        selectedTeam: null,
                        validationErrors: [],
                        error: null
                    }));
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
                        setState(prev => ({ ...prev, selectedTeam: null, scroll: 0, validationErrors: [] }));
                    } else {
                        // Check for saved draft when selecting a team
                        const saved = loadFromLocalStorage(role, team);
                        if (saved && Object.keys(saved.formData).length > 0) {
                            // Confirm restoration
                            const confirmMsg = `임시 저장된 답변이 있습니다. 불러오시겠습니까?`;
                            if (window.confirm(confirmMsg)) {
                                setState(prev => ({
                                    ...prev,
                                    selectedTeam: team,
                                    formData: saved.formData,
                                    respondentInfo: saved.respondentInfo,
                                    scroll: 0,
                                    validationErrors: []
                                }));
                            } else {
                                setState(prev => ({ ...prev, selectedTeam: team, scroll: 0, validationErrors: [] }));
                            }
                        } else {
                            setState(prev => ({ ...prev, selectedTeam: team, scroll: 0, validationErrors: [] }));
                        }
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
                                const rawVals = formData[q.id];
                                const currentVals = Array.isArray(rawVals) ? rawVals : [];
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
                                    const rawVal = formData[q.id];
                                    hiddenInputRef.current.value = typeof rawVal === 'string' ? rawVal : '';
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
        const { formData, role, selectedTeam, respondentInfo, auth, questions: dynQuestions } = stateRef.current;

        // 1. Validation: Check team selection
        if (!validateTeamSelection(role, selectedTeam)) {
            setState(prev => ({
                ...prev,
                error: '팀을 선택해주세요. 팀 선택 버튼을 클릭하세요.',
                scroll: 0
            }));
            return;
        }

        // 2. Validation: Check all required fields
        let questions: Question[] = [];
        if (role === '선교사') questions = dynQuestions.missionary;
        else if (role === '인솔자') questions = dynQuestions.leader;
        else if (role === '단기선교 팀원') questions = dynQuestions.team_member;

        const missingAnswers = validateFormData(questions, formData);
        if (missingAnswers.length > 0) {
            setState(prev => ({
                ...prev,
                error: `${missingAnswers.length}개의 필수 질문에 답변해주세요.`,
                validationErrors: missingAnswers,
                scroll: 0
            }));
            setTimeout(() => {
                setState(prev => ({ ...prev, error: null }));
            }, 5000);
            return;
        }

        // 3. Check duplicate submission
        if (checkDuplicateSubmission(role, selectedTeam)) {
            setState(prev => ({
                ...prev,
                error: '이미 이 팀에 대한 설문을 제출하셨습니다.',
            }));
            setTimeout(() => {
                setState(prev => ({ ...prev, error: null }));
            }, 3000);
            return;
        }

        if (!sbClient) {
            setState(prev => ({
                ...prev,
                error: '서비스에 연결할 수 없습니다. 페이지를 새로고침해 주세요.'
            }));
            return;
        }

        setState(prev => ({ ...prev, view: 'submitting', error: null, validationErrors: [] }));

        // 4. Prepare payload with enhanced data
        const payload = {
            role,
            team_dept: selectedTeam?.dept,
            team_country: selectedTeam?.country,
            team_missionary: selectedTeam?.missionary,
            team_leader: selectedTeam?.leader,
            respondent_email: auth.user?.email || respondentInfo.email || null,
            respondent_name: respondentInfo.name || null,
            submission_date: new Date().toISOString().split('T')[0],
            response_status: 'completed',
            answers: formData
        };

        // 5. Submit to database
        const { error } = await sbClient.from('mission_evaluations').insert([payload]);

        if (error) {
            console.error('Submission error:', error);
            setState(prev => ({
                ...prev,
                view: 'team_selection',
                error: '제출 중 오류가 발생했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.'
            }));
            setTimeout(() => {
                setState(prev => ({ ...prev, error: null }));
            }, 5000);
        } else {
            // 6. Success: Clear storage and mark as submitted
            clearLocalStorage(role, selectedTeam);
            markAsSubmitted(role, selectedTeam);
            setState(prev => ({
                ...prev,
                view: 'success',
                formData: {},
                respondentInfo: { name: '', email: '' },
                validationErrors: []
            }));
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
                    role="application"
                    aria-label="선교 설문조사 폼"
                    tabIndex={0}
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
