-- Create some tea sessions with orders
-- Insert a completed session with some orders
INSERT INTO sessions (id, started_at, ended_at, status, assignee_name) VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', '2025-01-01 10:00:00+00', '2025-01-01 10:30:00+00', 'completed', 'Vijay');

-- Insert orders for the completed session
INSERT INTO orders (session_id, user_id, drink_type, sugar_level, created_at) VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', (SELECT id FROM users WHERE name = 'Vijay'), 'Tea', '2 spoons', '2025-01-01 10:05:00+00'),
  ('550e8400-e29b-41d4-a716-446655440001', (SELECT id FROM users WHERE name = 'Akhilesh'), 'Coffee', '1 spoon', '2025-01-01 10:06:00+00'),
  ('550e8400-e29b-41d4-a716-446655440001', (SELECT id FROM users WHERE name = 'Apoorv'), 'Tea', 'No sugar', '2025-01-01 10:07:00+00'),
  ('550e8400-e29b-41d4-a716-446655440001', (SELECT id FROM users WHERE name = 'Hemant'), 'Green Tea', '1 spoon', '2025-01-01 10:08:00+00');

-- Create an active session with current orders
INSERT INTO sessions (id, started_at, status, assignee_name) VALUES 
  ('550e8400-e29b-41d4-a716-446655440002', now() - interval '10 minutes', 'active', 'Aswin');

-- Insert orders for the active session
INSERT INTO orders (session_id, user_id, drink_type, sugar_level, created_at) VALUES 
  ('550e8400-e29b-41d4-a716-446655440002', (SELECT id FROM users WHERE name = 'Kavya'), 'Masala Tea', '2 spoons', now() - interval '8 minutes'),
  ('550e8400-e29b-41d4-a716-446655440002', (SELECT id FROM users WHERE name = 'Khushi'), 'Black Coffee', 'No sugar', now() - interval '7 minutes'),
  ('550e8400-e29b-41d4-a716-446655440002', (SELECT id FROM users WHERE name = 'Nikith'), 'Tea', '1 spoon', now() - interval '6 minutes'),
  ('550e8400-e29b-41d4-a716-446655440002', (SELECT id FROM users WHERE name = 'Piyush'), 'Lemon Tea', '1 spoon', now() - interval '5 minutes'),
  ('550e8400-e29b-41d4-a716-446655440002', (SELECT id FROM users WHERE name = 'Shailesh'), 'Tea', '3 spoons', now() - interval '4 minutes');

-- Update some users' last preferences and drink counts
UPDATE users SET 
  last_ordered_drink = 'Tea',
  last_sugar_level = '2 spoons',
  drink_count = 2,
  last_assigned_at = '2025-01-01 10:00:00+00'
WHERE name = 'Vijay';

UPDATE users SET 
  last_ordered_drink = 'Coffee',
  last_sugar_level = '1 spoon',
  drink_count = 0
WHERE name = 'Akhilesh';

UPDATE users SET 
  last_ordered_drink = 'Green Tea',
  last_sugar_level = 'No sugar',
  drink_count = 1,
  last_assigned_at = '2024-12-28 14:00:00+00'
WHERE name = 'Hemant';

UPDATE users SET 
  last_ordered_drink = 'Masala Tea',
  last_sugar_level = '2 spoons',
  drink_count = 0
WHERE name = 'Kavya';

UPDATE users SET 
  last_ordered_drink = 'Black Coffee',
  last_sugar_level = 'No sugar',
  drink_count = 3,
  last_assigned_at = '2024-12-30 16:00:00+00'
WHERE name = 'Khushi';