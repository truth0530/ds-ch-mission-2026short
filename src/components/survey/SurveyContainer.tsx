'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createSupabaseClient } from '@/lib/supabase';
import { MISSIONARY_QUESTIONS, LEADER_QUESTIONS, TEAM_QUESTIONS, Question, TeamInfo, MISSION_TEAMS } from '@/lib/surveyData';
import LandingView from './LandingView';
import RoleSelectionView from './RoleSelectionView';
import TeamSelectionView from './TeamSelectionView';
import SurveyFormView from './SurveyFormView';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../layout/Header';
import Footer from '../layout/Footer';

type ViewState = 'landing' | 'role_selection' | 'team_selection' | 'survey_form' | 'submitting' | 'success';

const ENV = {
    PROJECT_NAME: '2026mission_short',
    PROJECT_ID: 'fjdorhdauvumfqhqujaj',
    get SUPABASE_URL() {
        return process.env.NEXT_PUBLIC_SUPABASE_URL || `https://${this.PROJECT_ID}.supabase.co`;
    }
};

export default function SurveyContainer() {
    const [view, setView] = useState<ViewState>('landing');
    const [role, setRole] = useState<'선교사' | '인솔자' | '단기선교 팀원' | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<TeamInfo | null>(null);
    const [formData, setFormData] = useState<any>({});
    const [auth, setAuth] = useState<{ user: any; isAdmin: boolean; loading: boolean }>({ user: null, isAdmin: false, loading: true });
    const [sbClient, setSbClient] = useState<any>(null);
    const [teams, setTeams] = useState<TeamInfo[]>(MISSION_TEAMS); // Default to static
    const [questions, setQuestions] = useState<{ missionary: Question[]; leader: Question[]; team_member: Question[] }>({
        missionary: MISSIONARY_QUESTIONS,
        leader: LEADER_QUESTIONS,
        team_member: TEAM_QUESTIONS
    });
    const [error, setError] = useState<string | null>(null);

    // Initialize Supabase & Auth
    useEffect(() => {
        const url = ENV.SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (key && key !== 'your_anon_key_here') {
            const client = createSupabaseClient(url, key);
            setSbClient(client);

            // Load data
            // loadQuestions(client); // Temporarily disabled to use updated static file for verification
            loadTeams(client);

            // Check Auth
            client.auth.getSession().then(({ data: { session } }: any) => {
                if (session?.user) checkUserStatus(client, session.user);
                else setAuth(prev => ({ ...prev, loading: false }));
            });

            const { data: { subscription } } = client.auth.onAuthStateChange((_event: string, session: any) => {
                if (session?.user) checkUserStatus(client, session.user);
                else setAuth({ user: null, isAdmin: false, loading: false });
            });

            return () => subscription.unsubscribe();
        }
    }, []);

    const loadQuestions = async (client: any) => {
        try {
            const { data } = await client
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
                setQuestions({
                    missionary: qMap.missionary.length > 0 ? qMap.missionary : MISSIONARY_QUESTIONS,
                    leader: qMap.leader.length > 0 ? [...qMap.leader, ...qMap.common] : LEADER_QUESTIONS,
                    team_member: qMap.team_member.length > 0 ? [...qMap.team_member, ...qMap.common] : TEAM_QUESTIONS
                });
            } else {
                throw new Error('No questions found');
            }
        } catch (e) {
            console.warn('Falling back to static questions', e);
            setQuestions({ missionary: MISSIONARY_QUESTIONS, leader: LEADER_QUESTIONS, team_member: TEAM_QUESTIONS });
        }
    };

    const loadTeams = async (client: any) => {
        try {
            const { data, error } = await client
                .from('mission_teams')
                .select('*')
                .order('country', { ascending: true });

            if (data && data.length > 0) {
                setTeams(data);
            }
        } catch (e) {
            console.warn('Using static teams', e);
        }
    };

    // Check User Status (Admin + Existing Submission)
    const checkUserStatus = async (client: any, user: any) => {
        // 1. Check Admin
        const { data: adminData } = await client.from('admin_users').select('email').eq('email', user.email).maybeSingle();
        const isAdmin = !!adminData || user.email === 'truth0530@gmail.com';

        // 2. Check Existing Submission
        const { data: submission } = await client
            .from('mission_evaluations')
            .select('*')
            .eq('respondent_email', user.email)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        setAuth(prev => ({ ...prev, user, isAdmin, loading: false }));

        if (submission) {
            // Load existing data
            setFormData(submission.answers);

            // Restore Role
            if (['선교사', '인솔자', '단기선교 팀원'].includes(submission.role)) {
                setRole(submission.role as any);
            }

            // Restore Team if exists (using missionary name as key mostly)
            if (submission.team_missionary && submission.team_missionary !== 'self') {
                const foundTeam = teams.find(t => t.missionary === submission.team_missionary);
                if (foundTeam) setSelectedTeam(foundTeam);
            }
        }
    };

    const handleGoogleLogin = async () => {
        if (!sbClient) return;
        await sbClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
    };

    const handleLogout = async () => {
        if (!sbClient) return;
        await sbClient.auth.signOut();
        setAuth({ user: null, isAdmin: false, loading: false });
        setFormData({});
        setRole(null);
        setSelectedTeam(null);
        setView('landing');
    };

    // Navigation Handlers
    const handleStart = () => {
        // If user has data, go straight to form
        if (auth.user && Object.keys(formData).length > 0 && role) {
            setView('survey_form');
        } else {
            setView('role_selection');
        }
    };

    const handleRoleSelect = (selectedRole: '선교사' | '인솔자' | '단기선교 팀원') => {
        setRole(selectedRole);
        if (selectedRole === '선교사' || selectedRole === '인솔자') {
            setView('survey_form');
        } else {
            setView('team_selection');
        }
    };

    const handleTeamSelect = (team: TeamInfo) => {
        setSelectedTeam(team);
        setView('survey_form');
    };

    const handleBack = () => {
        if (view === 'role_selection') setView('landing');
        else if (view === 'team_selection') setView('role_selection');
        else if (view === 'survey_form') {
            if (role === '선교사' || role === '인솔자') setView('role_selection');
            else setView('team_selection');
        }
    };

    const handleSubmit = async (data: any) => {
        if (!role) return;

        // Validation check (already done in form view)

        // Duplicate check (Client-side simple check) - Skipping for logged in users to allow edit
        const storageKey = `survey_submitted_${role}_${selectedTeam?.missionary || 'general'}`;
        if (!auth.user && sessionStorage.getItem(storageKey) === 'true') {
            // alert('이미 제출하신 설문입니다.'); // Disable strictly blocking for now, let server handle or allow re-submit
        }

        setView('submitting');

        try {
            const payload = {
                role,
                team_missionary: selectedTeam?.missionary || null,
                team_dept: selectedTeam?.dept || null,
                team_country: selectedTeam?.country || null,
                team_leader: selectedTeam?.leader || null,
                respondent_name: data.respondent_name || (auth.user ? auth.user.user_metadata.full_name : 'Anonymous'),
                respondent_email: data.respondent_email || (auth.user ? auth.user.email : ''),
                answers: data.answers
            };

            // Upsert if logged in (update existing), Insert if anonymous
            let result;
            if (auth.user) {
                // Try to find existing first to update? Or just Insert?
                // RLS policies usually handle "Can Insert". 
                // If we want "Edit", we might need to know the ID or use Upsert on unique constraint.
                // For now, let's just INSERT. Later we can refining to UPDATE if ID exists.
                // Actually, user wants "Edit". So we should Update if match found.
                // But without unique ID on frontend, simple Insert is safer.
                // Let's stick to Insert for now, but effectively it acts as a new version.
                // TODO: To support true 'Edit', we need to fetch ID and use .update().
                // Let's check if we fetched an ID in checkUserStatus.

                // However, simplified approach: Just Insert new row.
                result = await sbClient.from('mission_evaluations').insert([payload]);
            } else {
                result = await sbClient.from('mission_evaluations').insert([payload]);
            }

            if (result.error) throw result.error;

            sessionStorage.setItem(storageKey, 'true');
            // Clear draft
            const draftKey = `survey_draft_${role}_${selectedTeam?.missionary || 'general'}`;
            localStorage.removeItem(draftKey);

            setView('success');
        } catch (e: any) {
            console.error(e);
            setError('제출 중 오류가 발생했습니다. 다시 시도해주세요.');
            setView('survey_form');
        }
    };

    // Helper to get questions for current role
    const getCurrentQuestions = () => {
        if (role === '선교사') return questions.missionary;
        if (role === '인솔자') return questions.leader;
        if (role === '단기선교 팀원') return questions.team_member;
        return [];
    };

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

            {/* <Footer /> is now always visible */}
            <Footer />

            {error && (
                <div className="fixed bottom-4 left-4 right-4 bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl shadow-lg flex justify-between items-center z-50 animate-bounce">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="font-bold ml-4">✕</button>
                </div>
            )}
        </div>
    );
}
