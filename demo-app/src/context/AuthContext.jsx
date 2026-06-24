import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const VALID_CREDENTIALS = {
  email: 'test@example.com',
  password: 'password123'
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('shopsim_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        setIsAuthenticated(true);
      } catch (e) {
        localStorage.removeItem('shopsim_user');
      }
    }
  }, []);

  const login = (email, password) => {
    if (email === VALID_CREDENTIALS.email && password === VALID_CREDENTIALS.password) {
      const userData = { email, name: 'Test User' };
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('shopsim_user', JSON.stringify(userData));
      return { success: true };
    }
    return { success: false, error: 'Invalid email or password' };
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('shopsim_user');
  };

  const updateProfile = (name, email) => {
    const updated = { ...user, name, email };
    setUser(updated);
    localStorage.setItem('shopsim_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
