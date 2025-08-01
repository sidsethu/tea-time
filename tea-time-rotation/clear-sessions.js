import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cfinlimevshdrwnymuca.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmaW5saW1ldnNoZHJ3bnltdWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NzMzMTMsImV4cCI6MjA2OTQ0OTMxM30.eTk3PUOFX6gMwtzxwLZZMSQ0NzN7QA7QdttIK2tXg1w';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const clearSessions = async () => {
  const { error } = await supabase.from('sessions').delete().eq('status', 'active');
  if (error) {
    console.error('Error clearing sessions:', error);
  } else {
    console.log('Active sessions cleared.');
  }
};

clearSessions();
