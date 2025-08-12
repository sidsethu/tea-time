import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const result = dotenv.config({ path: path.resolve(__dirname, '.env.local') });

if (result.error) {
  console.error('Error loading .env file', result.error);
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const clearSessions = async () => {
  const { error } = await supabase.from('sessions').delete().eq('status', 'active');
  if (error) {
    console.error('Error clearing sessions:', error);
  } else {
    console.log('Active sessions cleared.');
  }
};

clearSessions();
