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
    console.log('Summarizing session:', session_id);

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

  console.log('Found orders:', orders);

  if (!orders || orders.length === 0) {
    return new Response(JSON.stringify({ error: 'No orders found for this session.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404,
    });
  }

  const users = orders.map(order => order.users);

  // Sort users by last_assigned_at, with nulls first
  users.sort((a, b) => {
    if (a.last_assigned_at === null) return -1;
    if (b.last_assigned_at === null) return 1;
    return new Date(a.last_assigned_at).getTime() - new Date(b.last_assigned_at).getTime();
  });

  const assignee = users[0];

  // Update last order details for each user
  for (const order of orders) {
    if (order.user_id) {
      console.log(`Updating user ${order.user_id} with drink ${order.drink_type} and sugar ${order.sugar_level}`);
      const { error } = await supabase
        .from('users')
        .update({
          last_ordered_drink: order.drink_type,
          last_sugar_level: order.sugar_level,
        })
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
