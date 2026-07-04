import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function migrate() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // Try loading from .env
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      for (const line of envContent.split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          if (!process.env[key]) process.env[key] = value;
        }
      }
    }
  }

  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Execute raw SQL via Supabase RPC or direct SQL
  // Since we can't run raw SQL via the JS client, we'll use the REST API
  const sql = fs.readFileSync(path.resolve(process.cwd(), 'scripts/add-assignment-progress.sql'), 'utf-8');

  console.log('Executing migration SQL...');
  console.log(sql);

  // Use the Supabase SQL editor API
  const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (response.ok) {
    console.log('Migration completed successfully');
  } else {
    const text = await response.text();
    console.log('RPC not available, trying direct approach...');
    console.log('Response:', text);

    // Alternative: add columns one by one using Supabase client
    // We can't add columns via the JS client, so we need to use the SQL API
    console.log('\nPlease run the following SQL in the Supabase SQL Editor:\n');
    console.log(sql);
  }
}

migrate().catch(console.error);
