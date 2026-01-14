import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { ENV_CONFIG, TABLES } from '@/lib/constants';
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
            return NextResponse.json({ isAdmin: true });
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
            .select('email')
            .eq('email', email.toLowerCase())
            .single();

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = no rows returned, which is not an error for our case
            console.error('Admin check error:', error);
            return NextResponse.json(
                { error: 'Database query failed', isAdmin: false },
                { status: 500 }
            );
        }

        return NextResponse.json({ isAdmin: !!data });
    } catch (error) {
        console.error('Admin check failed:', error);
        return NextResponse.json(
            { error: 'Internal server error', isAdmin: false },
            { status: 500 }
        );
    }
}
