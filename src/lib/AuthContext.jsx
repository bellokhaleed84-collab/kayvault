import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';

const AuthContext = createContext();

// Keep the same shape the pages already use: user.uid, user.email, profile.*
const toUser = (p) => (p ? { uid: p.id, email: p.email } : null);

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api.get('/auth/me')
      .then(({ user }) => setProfile(user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password, remember = true) {
    const { token, user } = await api.post('/auth/login', { email, password, remember });
    setToken(token, remember);
    setProfile(user);
    return user;
  }

  async function signup(data) {
    const { token, user } = await api.post('/auth/signup', data);
    setToken(token, true);
    setProfile(user);
    return user;
  }

  const refreshProfile = async () => {
    const { user } = await api.get('/auth/me');
    setProfile(user);
  };

  const signOut = async () => {
    setToken(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{ user: toUser(profile), profile, loading, login, signup, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);