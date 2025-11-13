/// <reference types="https://deno.land/x/service_worker@0.1.0/lib.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization') ?? '' },
      },
    },
  );
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { session_id, confirm_assignee } = await req.json();

    const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*, users(*)')
    .eq('session_id', session_id)
    .eq('is_excused', false);

  if (ordersError) {
    return new Response(JSON.stringify({ error: ordersError.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }


  if (!orders || orders.length === 0) {
    return new Response(JSON.stringify({ error: 'No orders found for this session.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404,
    });
  }

  const users = orders.map(order => order.users);

  // Sort by drink_count/total_drinks_bought ratio (desc) and then by last_assigned_at (asc)
  users.sort((a, b) => {
    const ratioA = a.total_drinks_bought > 0 ? a.drink_count / a.total_drinks_bought : (a.drink_count > 0 ? Infinity : 0);
    const ratioB = b.total_drinks_bought > 0 ? b.drink_count / b.total_drinks_bought : (b.drink_count > 0 ? Infinity : 0);

    if (ratioA !== ratioB) {
      return ratioB - ratioA; // Sort descending by ratio
    }

    // Tie-breaker: earliest last_assigned_at
    if (a.last_assigned_at === null) return -1;
    if (b.last_assigned_at === null) return 1;
    return new Date(a.last_assigned_at).getTime() - new Date(b.last_assigned_at).getTime();
  });

  // Phase 1: Return top 2 candidates for admin selection
  if (!confirm_assignee) {
    const topCandidates = users.slice(0, Math.min(2, users.length));
    return new Response(JSON.stringify({
      requiresConfirmation: true,
      candidates: topCandidates
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  // Phase 2: Commit to DB with confirmed assignee
  const assignee = users.find(u => u.id === confirm_assignee);

  if (!assignee) {
    return new Response(JSON.stringify({ error: 'Invalid assignee selected.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  // Update last order details for each user
  for (const order of orders) {
    if (order.user_id) {
      const updateData = {
        last_ordered_drink: order.drink_type,
        last_sugar_level: order.sugar_level,
      };

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', order.user_id);

      if (error) {
        console.error(`Error updating user ${order.user_id}:`, error);
      }
    }
  }

  // Increment drink_count for all participating users
  for (const order of orders) {
    if (order.user_id) {
      await supabase.rpc('increment_drink_count', { user_id: order.user_id });
    }
  }

  await supabase
    .from('users')
    .update({ last_assigned_at: new Date().toISOString() })
    .eq('id', assignee.id);

  await supabase.rpc('increment_total_drinks_bought', { p_user_id: assignee.id, p_amount: orders.length });

  // Resolve summarizer from auth header
  let summarizerUserId: string | null = null;
  const { data: authUserResult } = await supabase.auth.getUser();
  const authUserId = authUserResult?.user?.id ?? null;
  if (authUserId) {
    const { data: summarizer } = await supabase
      .from('users')
      .select('id, name')
      .eq('auth_user_id', authUserId)
      .single();
    summarizerUserId = summarizer?.id ?? null;
  }

  await supabase
    .from('sessions')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      assignee_name: assignee.name,
      total_drinks_in_session: orders.length,
      summarized_by: summarizerUserId,
    })
    .eq('id', session_id);

  return new Response(JSON.stringify({ assignee, committed: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
