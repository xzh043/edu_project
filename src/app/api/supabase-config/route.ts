import { NextResponse } from 'next/server';
import { getSupabaseCredentials } from '@/storage/database/supabase-client';

export async function GET() {
  try {
    const { url, anonKey } = getSupabaseCredentials();

    if (!url || !anonKey) {
      console.error('Supabase credentials not configured:', {
        url: !!url,
        anonKey: !!anonKey,
        NODE_ENV: process.env.NODE_ENV,
        SUPABASE_URL: process.env.SUPABASE_URL ? 'set' : 'not set',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'set' : 'not set',
      });
      return NextResponse.json(
        { error: 'Supabase credentials not configured' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url, anonKey });
  } catch (error) {
    console.error('Failed to get Supabase config:', error, {
      NODE_ENV: process.env.NODE_ENV,
      SUPABASE_URL: process.env.SUPABASE_URL ? 'set' : 'not set',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'set' : 'not set',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'not set',
      OAUTH_CLIENT_ID: process.env.OAUTH_CLIENT_ID ? 'set' : 'not set',
      OAUTH_PRIVATE_KEY: process.env.OAUTH_PRIVATE_KEY ? 'set' : 'not set',
      OAUTH_PUBLIC_KEY_ID: process.env.OAUTH_PUBLIC_KEY_ID ? 'set' : 'not set',
    });
    return NextResponse.json(
      { error: 'Failed to get Supabase config' },
      { status: 500 }
    );
  }
}
