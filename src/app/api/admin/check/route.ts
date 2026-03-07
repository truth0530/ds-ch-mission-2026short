import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { ENV_CONFIG, TABLES } from '@/lib/constants';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/supabase-server';
import { isValidEmail } from '@/lib/validators';

// Create server-side Supabase client (uses service role key if available)
function getServerClient() {
    const supabaseUrl = ENV_CONFIG.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ENV_CONFIG.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return null;
    }

    return createClient(supabaseUrl, supabaseKey);
}

export async function POST(request: NextRequest) {
    try {
        const ip = getRequestIp(request);
        if (!checkRateLimit(`admin:check:${ip}`, 10, 10 * 60 * 1000)) {
            return NextResponse.json(
                { error: 'Too many requests', isAdmin: false },
                { status: 429 }
            );
        }

        const body = await request.json();
        const { email } = body;

        // Validate email
        if (!email || typeof email !== 'string') {
            return NextResponse.json(
                { error: 'Email is required', isAdmin: false },
                { status: 400 }
            );
        }

        if (!isValidEmail(email)) {
            return NextResponse.json(
                { error: 'Invalid email format', isAdmin: false },
                { status: 400 }
            );
        }

        // Check if it's the super admin
        if (email === ENV_CONFIG.ADMIN_EMAIL) {
            return NextResponse.json({ isAdmin: true, role: 'master' });
        }

        // Check database for admin users
        const client = getServerClient();
        if (!client) {
            return NextResponse.json(
                { error: 'Database connection failed', isAdmin: false },
                { status: 500 }
            );
        }

        const { data, error } = await client
            .from(TABLES.ADMIN_USERS)
            .select('email, role')
            .eq('email', email.toLowerCase())
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Admin check error:', error);
            return NextResponse.json(
                { error: 'Database query failed', isAdmin: false, role: null },
                { status: 500 }
            );
        }

        return NextResponse.json({ isAdmin: !!data, role: data?.role || null });
    } catch (error) {
        console.error('Admin check failed:', error);
        return NextResponse.json(
            { error: 'Internal server error', isAdmin: false },
            { status: 500 }
        );
    }
}
