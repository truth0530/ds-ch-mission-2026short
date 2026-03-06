'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { createSupabaseClient, SupabaseClient } from '@/lib/supabase';
import { ENV_CONFIG, TABLES, STORAGE_KEYS } from '@/lib/constants';
import { RoleType, ViewState, TeamInfo, Question, AuthState, QuestionsMap } from '@/types';
import { SurveyFormData, SurveySubmissionPayload } from '@/types/survey';
import { MISSIONARY_QUESTIONS, LEADER_QUESTIONS, TEAM_QUESTIONS, MISSION_TEAMS } from '@/lib/surveyData';
import { removeDraft, markAsSubmitted } from '@/lib/storage';
import LandingView from './LandingView';
import RoleSelectionView from './RoleSelectionView';
import TeamSelectionView from './TeamSelectionView';
import SurveyFormView from './SurveyFormView';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../layout/Header';
import Footer from '../layout/Footer';

export default function SurveyContainer() {
    // State
    const [view, setView] = useState<ViewState>('landing');
    const [role, setRole] = useState<RoleType | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<TeamInfo | null>(null);
    const [formData, setFormData] = useState<Record<string, string | number | string[]>>({});
    const [auth, setAuth] = useState<AuthState>({ user: null, isAdmin: false, adminRole: null, loading: true });
    const [sbClient, setSbClient] = useState<SupabaseClient | null>(null);
    const [teams, setTeams] = useState<TeamInfo[]>(MISSION_TEAMS);
    const [questions, setQuestions] = useState<QuestionsMap>({
        missionary: MISSIONARY_QUESTIONS as unknown as Question[],
        leader: LEADER_QUESTIONS as unknown as Question[],
        team_member: TEAM_QUESTIONS as unknown as Question[]
    });
    const [error, setError] = useState<string | null>(null);
    const [existingSubmissionId, setExistingSubmissionId] = useState<string | null>(null);

    // Refs for race condition prevention and unmount handling
    const submitLockRef = useRef(false);
    const isMountedRef = useRef(true);

    // Initialize Supabase & Auth
    useEffect(() => {
        isMountedRef.current = true;

        const url = ENV_CONFIG.SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (key && key !== 'your_anon_key_here') {
            const client = createSupabaseClient(url, key);
            if (!client) {
                setAuth(prev => ({ ...prev, loading: false }));
                return;
            }

            setSbClient(client);

            // Load data
            loadTeams(client);

            // Check Auth
            client.auth.getSession()
                .then(({ data: { session } }) => {
                    if (!isMountedRef.current) return;
                    if (session?.user) {
                        checkUserStatus(client, session.user);
                    } else {
                        setAuth(prev => ({ ...prev, loading: false }));
                    }
                })
                .catch((error) => {
                    if (!isMountedRef.current) return;
                    if (process.env.NODE_ENV === 'development') {
                        console.error('Session check error:', error);
                    }
                    setAuth(prev => ({ ...prev, loading: false }));
                });

            const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
                if (!isMountedRef.current) return;
                if (session?.user) {
                    checkUserStatus(client, session.user);
                } else {
                    setAuth({ user: null, isAdmin: false, adminRole: null, loading: false });
                }
            });

            return () => {
                isMountedRef.current = false;
                subscription.unsubscribe();
            };
        } else {
            setAuth(prev => ({ ...prev, loading: false }));
        }
    }, []);

    const loadTeams = async (client: SupabaseClient) => {
        try {
            const { data, error } = await client
                .from(TABLES.TEAMS)
                .select('*')
                .order('country', { ascending: true });

            if (!isMountedRef.current) return;

            if (data && data.length > 0 && !error) {
                setTeams(data as TeamInfo[]);
            }
        } catch (e) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('Using static teams', e);
            }
        }
    };

    // Check User Status (Admin + Existing Submission)
    const checkUserStatus = async (client: SupabaseClient, user: User) => {
        if (!isMountedRef.current) return;

        try {
            // 1. Check Admin
            const { data: adminData, error: adminError } = await client
                .from(TABLES.ADMIN_USERS)
                .select('email')
                .eq('email', user.email)
                .maybeSingle();

            if (adminError && process.env.NODE_ENV === 'development') {
                console.error('Admin check error:', adminError);
            }

            const fallbackEmail = ENV_CONFIG.ADMIN_EMAIL;
            const isAdmin = !!adminData || !!(fallbackEmail && user.email === fallbackEmail);

            // 2. Check Existing Submission
            const { data: submission, error: submissionError } = await client
                .from(TABLES.EVALUATIONS)
                .select('*')
                .eq('respondent_email', user.email)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (submissionError && process.env.NODE_ENV === 'development') {
                console.error('Submission check error:', submissionError);
            }

            if (!isMountedRef.current) return;

            setAuth(prev => ({ ...prev, user, isAdmin, loading: false }));

            if (submission) {
                // Store existing submission ID for update
                setExistingSubmissionId(submission.id);

                // Load existing data
                setFormData(submission.answers || {});

                // Restore Role
                if (['선교사', '인솔자', '단기선교 팀원'].includes(submission.role)) {
                    setRole(submission.role as RoleType);
                }

                // Restore Team if exists
                if (submission.team_missionary && submission.team_missionary !== 'self') {
                    const foundTeam = teams.find(t => t.missionary === submission.team_missionary);
                    if (foundTeam) setSelectedTeam(foundTeam);
                }
            }
        } catch (e) {
            if (process.env.NODE_ENV === 'development') {
                console.error('User status check error:', e);
            }
            if (isMountedRef.current) {
                // 에러가 발생해도 기본 사용자 정보는 설정
                setAuth(prev => ({ ...prev, user, isAdmin: false, loading: false }));
            }
        }
    };

    const handleGoogleLogin = useCallback(async () => {
        if (!sbClient) {
            setError('인증 서비스에 연결할 수 없습니다. 페이지를 새로고침해 주세요.');
            return;
        }
        try {
            const { error } = await sbClient.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin }
            });
            if (error) {
                setError('로그인 중 오류가 발생했습니다: ' + error.message);
            }
        } catch (e) {
            setError('로그인 중 오류가 발생했습니다. 다시 시도해 주세요.');
            if (process.env.NODE_ENV === 'development') {
                console.error('Google login error:', e);
            }
        }
    }, [sbClient]);

    const handleLogout = useCallback(async () => {
        if (!sbClient) return;
        try {
            const { error } = await sbClient.auth.signOut();
            if (error && process.env.NODE_ENV === 'development') {
                console.error('Logout error:', error);
            }
        } catch (e) {
            if (process.env.NODE_ENV === 'development') {
                console.error('Logout error:', e);
            }
        } finally {
            // 항상 로컬 상태를 초기화
            setAuth({ user: null, isAdmin: false, adminRole: null, loading: false });
            setFormData({});
            setRole(null);
            setSelectedTeam(null);
            setExistingSubmissionId(null);
            setView('landing');
        }
    }, [sbClient]);

    // Navigation Handlers
    const handleStart = useCallback(() => {
        if (auth.user && Object.keys(formData).length > 0 && role) {
            setView('survey_form');
        } else {
            setView('role_selection');
        }
    }, [auth.user, formData, role]);

    const handleRoleSelect = useCallback((selectedRole: RoleType) => {
        setRole(selectedRole);
        if (selectedRole === '선교사' || selectedRole === '인솔자') {
            setView('survey_form');
        } else {
            setView('team_selection');
        }
    }, []);

    const handleTeamSelect = useCallback((team: TeamInfo) => {
        setSelectedTeam(team);
        setView('survey_form');
    }, []);

    const handleBack = useCallback(() => {
        if (view === 'role_selection') setView('landing');
        else if (view === 'team_selection') setView('role_selection');
        else if (view === 'survey_form') {
            if (role === '선교사' || role === '인솔자') setView('role_selection');
            else setView('team_selection');
        }
    }, [view, role]);

    const handleSubmit = useCallback(async (data: SurveyFormData) => {
        if (!role || !sbClient) return;

        // Race condition prevention: Double check with lock
        if (submitLockRef.current) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('Submission already in progress');
            }
            return;
        }
        submitLockRef.current = true;

        // Store previous state for recovery
        const previousView = view;
        const previousFormData = { ...formData };

        setView('submitting');
        setError(null);

        try {
            const payload: SurveySubmissionPayload = {
                role,
                team_missionary: selectedTeam?.missionary || null,
                team_dept: selectedTeam?.dept || null,
                team_country: selectedTeam?.country || null,
                team_leader: selectedTeam?.leader || null,
                respondent_name: data.respondent_name || (typeof auth.user?.user_metadata?.full_name === 'string' ? auth.user.user_metadata.full_name : '익명'),
                respondent_email: data.respondent_email || auth.user?.email || '',
                answers: data.answers
            };

            let result;

            // If logged in user has existing submission, update it
            if (auth.user && existingSubmissionId) {
                result = await sbClient
                    .from(TABLES.EVALUATIONS)
                    .update(payload)
                    .eq('id', existingSubmissionId);
            } else {
                // Insert new submission
                result = await sbClient
                    .from(TABLES.EVALUATIONS)
                    .insert([payload]);
            }

            if (result.error) throw result.error;

            // Success: Clear storage and mark as submitted
            if (role && selectedTeam?.missionary) {
                removeDraft(role, selectedTeam.missionary);
                markAsSubmitted(role, selectedTeam.missionary);
            }

            if (isMountedRef.current) {
                setView('success');
            }
        } catch (e: unknown) {
            if (process.env.NODE_ENV === 'development') {
                console.error('Submission error:', e);
            }

            if (isMountedRef.current) {
                // Recover previous state
                setView(previousView);
                setFormData(previousFormData);
                setError('제출 중 오류가 발생했습니다. 다시 시도해주세요.');
            }
        } finally {
            submitLockRef.current = false;
        }
    }, [role, sbClient, selectedTeam, auth.user, existingSubmissionId, view, formData]);

    // Helper to get questions for current role
    const getCurrentQuestions = useCallback((): Question[] => {
        if (role === '선교사') return questions.missionary;
        if (role === '인솔자') return questions.leader;
        if (role === '단기선교 팀원') return questions.team_member;
        return [];
    }, [role, questions]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-700 flex flex-col">
            <Header onContactClick={handleGoogleLogin} user={auth.user} onLogout={handleLogout} isAdmin={auth.isAdmin} />

            <main className="flex-1 flex flex-col relative">
                <AnimatePresence mode="wait">
                    {view === 'landing' && (
                        <LandingView
                            key="landing"
                            onStart={handleStart}
                            auth={auth}
                            onLogin={handleGoogleLogin}
                            onLogout={handleLogout}
                        />
                    )}
                    {view === 'role_selection' && (
                        <RoleSelectionView
                            key="role"
                            onSelect={handleRoleSelect}
                            onBack={handleBack}
                        />
                    )}
                    {view === 'team_selection' && (
                        <TeamSelectionView
                            key="team"
                            teams={teams}
                            onSelect={handleTeamSelect}
                            onBack={handleBack}
                        />
                    )}
                    {view === 'survey_form' && role && (
                        <SurveyFormView
                            key="form"
                            role={role}
                            team={selectedTeam}
                            questions={getCurrentQuestions()}
                            onSubmit={handleSubmit}
                            onBack={handleBack}
                            initialData={formData}
                        />
                    )}
                    {view === 'submitting' && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50"
                        >
                            <div className="text-xl font-bold text-indigo-600 animate-pulse">
                                소중한 의견을 전송하고 있습니다...
                            </div>
                        </motion.div>
                    )}
                    {view === 'success' && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center min-h-[60vh] p-6"
                        >
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 text-4xl">
                                🎉
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">제출이 완료되었습니다!</h2>
                            <p className="text-slate-600 mb-8 text-center">귀한 의견 감사합니다. <br />단기선교 사역의 발전을 위해 소중히 사용하겠습니다.</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-3 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-700 transition-colors"
                            >
                                처음으로 돌아가기
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <Footer />

            {error && (
                <div className="fixed bottom-4 left-4 right-4 bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl shadow-lg flex justify-between items-center z-50">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="font-bold ml-4 text-red-500 hover:text-red-700">
                        X
                    </button>
                </div>
            )}
        </div>
    );
}
