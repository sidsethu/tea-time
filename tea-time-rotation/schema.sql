-- Create the users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  auth_user_id UUID UNIQUE,
  last_assigned_at TIMESTAMPTZ,
  last_ordered_drink TEXT,
  last_sugar_level TEXT,
  total_drinks_bought INTEGER DEFAULT 0,
  drink_count INTEGER DEFAULT 0,
  profile_picture_url TEXT
);

-- Create roles and permissions tables
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TYPE permission AS ENUM ('can_add_user', 'can_summarize_session', 'can_abandon_session', 'can_update_order', 'can_cancel_order');

CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission permission NOT NULL,
  PRIMARY KEY (role_id, permission)
);

-- Seed roles and permissions
INSERT INTO roles (name) VALUES ('admin'), ('member');

-- Assign all permissions to admin
INSERT INTO role_permissions (role_id, permission)
SELECT r.id, p.name
FROM roles r, (SELECT unnest(enum_range(NULL::permission)) AS name) p
WHERE r.name = 'admin';

-- Create the sessions table
CREATE TYPE session_status AS ENUM ('active', 'completed');
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  status session_status NOT NULL DEFAULT 'active',
  assignee_name TEXT,
  total_drinks_in_session INTEGER DEFAULT 0
);

-- Add a unique index to ensure only one active session exists at a time
CREATE UNIQUE INDEX unique_active_session ON sessions (status) WHERE (status = 'active');

-- Create the orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  user_id UUID NOT NULL REFERENCES users(id),
  drink_type TEXT NOT NULL,
  sugar_level TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_excused BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (session_id, user_id)
);

-- Add the new list of users in alphabetical order
INSERT INTO users (name) VALUES
  ('Akhilesh'),
  ('Apoorv'),
  ('Aswin'),
  ('Hemant'),
  ('Jaypal'),
  ('Kavya'),
  ('Khushi'),
  ('Khuzema'),
  ('Kranthi'),
  ('Navya'),
  ('Nikith'),
  ('Piyush'),
  ('Pranav'),
  ('Ritika'),
  ('Shailesh'),
  ('Shivam'),
  ('Sidharth'),
  ('Swami'),
  ('Venkatesh'),
  ('Vijay');

-- Create a function to increment the total_drinks_bought
CREATE OR REPLACE FUNCTION increment_total_drinks_bought(p_user_id UUID, p_amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET total_drinks_bought = total_drinks_bought + p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Create a function to increment the drink_count
CREATE OR REPLACE FUNCTION increment_drink_count(user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET drink_count = drink_count + 1
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;
