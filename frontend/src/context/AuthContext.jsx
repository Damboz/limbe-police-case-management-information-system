import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { homePathFor } from '../lib/roles';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();

        api.me(controller.signal)
            .then((res) => setUser(res.data.user))
            .catch((err) => {
                if (err.name !== 'AbortError') setUser(null);
            })
            .finally(() => setLoading(false));

        return () => controller.abort();
    }, []);

    const login = useCallback(async (badgeNumber, password) => {
        const res = await api.login(badgeNumber, password);
        setUser(res.data.user);
        return res.data.user;
    }, []);

    const logout = useCallback(async () => {
        try {
            await api.logout();
        } finally {
            setUser(null);
        }
    }, []);

    const value = useMemo(
        () => ({ user, loading, login, logout, homePath: homePathFor(user) }),
        [user, loading, login, logout]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
