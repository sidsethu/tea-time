import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and service role key are required.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { record: authUser } = await req.json();

    if (!authUser) {
      return new Response('No user data provided', { status: 400 });
    }

    const fullName = authUser.raw_user_meta_data?.full_name;
    const name = fullName ? fullName.split(' ')[0] : authUser.email.split('@')[0];

    // Check if a user with this name already exists
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('name', name)
      .single();

    if (userError && userError.code !== 'PGRST116') { // PGRST116 means no rows found
      throw userError;
    }

    let userId;

    if (existingUser) {
      // User exists, link the auth_user_id
      const { error: updateError } = await supabase
        .from('users')
        .update({ auth_user_id: authUser.id })
        .eq('id', existingUser.id);

      if (updateError) {
        throw updateError;
      }
      userId = existingUser.id;
    } else {
      // User does not exist, create a new one
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          auth_user_id: authUser.id,
          name: name,
        })
        .select('id')
        .single();

      if (insertError) {
        throw insertError;
      }
      userId = newUser.id;
    }

    // Assign the 'member' role to the user if they don't have it
    const { data: memberRole, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'member')
      .single();

    if (roleError) {
      throw roleError;
    }

    const { error: userRoleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: memberRole.id,
      });

    if (userRoleError) {
      throw userRoleError;
    }

    return new Response(JSON.stringify({ message: 'User synced successfully' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
