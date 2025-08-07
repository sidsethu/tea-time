import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  name: string;
  roles: string[];
  permissions: string[];
  profile_picture_url?: string;
}

export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('users')
          .select(`
            id,
            name,
            profile_picture_url,
            roles:user_roles(roles(name)),
            permissions:user_roles(roles(role_permissions(permission)))
          `)
          .eq('auth_user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
        } else if (data) {
          const roles = (data.roles as unknown as { roles: { name: string } }[]).map(
            (r) => r.roles.name
          );
          const permissions = (
            data.permissions as unknown as {
              roles: { role_permissions: { permission: string }[] };
            }[]
          ).flatMap((p) =>
            p.roles.role_permissions.map((rp) => rp.permission)
          );
          setProfile({ id: data.id, name: data.name || 'Guest', roles, permissions, profile_picture_url: data.profile_picture_url });

          // If the profile picture URL is empty, try to update it from the user's metadata
          if (!data.profile_picture_url && user.user_metadata?.picture) {
            const { error: updateError } = await supabase
              .from('users')
              .update({ profile_picture_url: user.user_metadata.picture })
              .eq('id', data.id);

            if (updateError) {
              console.error('Error updating profile picture:', updateError);
            } else {
              setProfile((prevProfile) => prevProfile ? { ...prevProfile, profile_picture_url: user.user_metadata.picture } : null);
            }
          }
        }
      }
    };

    fetchProfile();
  }, [user]);

  return { session, user, profile, loading };
};
