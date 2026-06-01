import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);
const STORAGE_KEY = 'placementiq_user';

// Deterministic student-id from email for stable demo refreshes
function studentIdFor(email) {
  const slug = (email || 'demo@example.com')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 6)
    .padEnd(6, '0');
  return `STU-DEMO-${slug}`;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  const signin = useCallback(({ name, email, role, institute, studentId }) => {
    const fallbackName = role === 'admin' ? 'Lender Admin'
      : role === 'college' ? 'Placement Cell' : 'Demo Student';
    const next = {
      name: name?.trim() || fallbackName,
      email: email?.trim() || '',
      role,
      // Prefer the real student_id the backend account is bound to; only fall back
      // to the email-derived demo id when the backend didn't supply one.
      studentId: studentId || (role === 'student' ? studentIdFor(email || name) : null),
      institute: (institute && String(institute).trim())
        || (role === 'college' ? (name?.trim() || 'Demo Institute') : null),
      hasApplication: false,
      signedInAt: new Date().toISOString(),
    };
    setUser(next);
    return next;
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const signout = useCallback(() => setUser(null), []);

  return (
    <AuthContext.Provider value={{ user, role: user?.role || null, signin, signout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
