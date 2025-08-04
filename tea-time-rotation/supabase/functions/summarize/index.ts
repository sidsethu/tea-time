/// <reference types="https://deno.land/x/service_worker@0.1.0/lib.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { session_id } = await req.json();

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

  // Sort by drinks_since_last_assigned (desc) and then by last_assigned_at (asc)
  users.sort((a, b) => {
    if (b.drinks_since_last_assigned !== a.drinks_since_last_assigned) {
      return b.drinks_since_last_assigned - a.drinks_since_last_assigned;
    }
    if (a.last_assigned_at === null) return -1;
    if (b.last_assigned_at === null) return 1;
    return new Date(a.last_assigned_at).getTime() - new Date(b.last_assigned_at).getTime();
  });

  // Find assignee, but retry if Vijay is selected
  let assignee = users[0];
  let attempts = 0;
  const maxAttempts = users.length; // Prevent infinite loop

  while (assignee.name.toLowerCase() === 'vijay' && attempts < maxAttempts) {
    attempts++;
    // Move Vijay to the end of the list and try again
    const vijayIndex = users.findIndex(user => user.name.toLowerCase() === 'vijay');
    if (vijayIndex !== -1) {
      const vijay = users.splice(vijayIndex, 1)[0];
      users.push(vijay);
    }
    assignee = users[0];
  }

  // Update last order details and drinks_since_last_assigned for each user
  for (const order of orders) {
    if (order.user_id) {
      const isAssignee = order.user_id === assignee.id;
      const updateData = {
        last_ordered_drink: order.drink_type,
        last_sugar_level: order.sugar_level,
        drinks_since_last_assigned: isAssignee ? 0 : (order.users.drinks_since_last_assigned || 0) + 1,
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

  await supabase
    .from('users')
    .update({ last_assigned_at: new Date().toISOString() })
    .eq('id', assignee.id);

  await supabase.rpc('increment_drink_count', { user_id: assignee.id });

  await supabase
    .from('sessions')
    .update({ status: 'completed', ended_at: new Date().toISOString(), assignee_name: assignee.name })
    .eq('id', session_id);

  return new Response(JSON.stringify({ assignee }), {
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
