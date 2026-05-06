import React, { createContext, useContext, useState, useEffect } from "react";

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  is_approved?: number | boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('ai-ssh-token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const verifyAuth = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setUser(data.user);
            setIsLoading(false);
          }
          return;
        }

        // Handle specific error codes if needed
        const errData = await res.json().catch(() => ({}));
        console.error(`Auth verification failed: ${res.status} ${res.statusText}`, errData);
        throw new Error('Not authenticated');

      } catch (err) {
        console.error(`Failed to fetch /api/auth/me (retry ${retryCount}):`, err);
        
        if (retryCount < maxRetries && isMounted) {
          retryCount++;
          setTimeout(verifyAuth, 1000 * retryCount); // Backoff retry
          return;
        }

        if (isMounted) {
          setToken(null);
          setUser(null);
          localStorage.removeItem('ai-ssh-token');
          setIsLoading(false);
        }
      }
    };

    verifyAuth();

    return () => { isMounted = false; };
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('ai-ssh-token', newToken);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('ai-ssh-token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
