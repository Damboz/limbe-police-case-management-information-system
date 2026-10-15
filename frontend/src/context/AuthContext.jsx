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
            .finally(() => {
                // StrictMode aborts and re-runs this effect in development. The
                // aborted run must not flip `loading` off while `user` is still
                // null, or the guards briefly render the login page before the
                // second request resolves.
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, []);

    // The server can end a session on its own (idle timeout) or another tab can sign
    // out. client.js broadcasts that as `auth:expired` on the next 401, and clearing the
    // user here lets ProtectedRoute send the browser back to the login page.
    useEffect(() => {
        const onExpired = () => setUser(null);
        window.addEventListener('auth:expired', onExpired);
        return () => window.removeEventListener('auth:expired', onExpired);
    }, []);

    const login = useCallback(async (badgeNumber, password) => {
        await api.login(badgeNumber, password);

        // The login response body is not proof that the browser actually stored the
        // session cookie. A blocked third-party cookie (SameSite/Secure) or one
        // dropped over an insecure origin is silently discarded, and the app would
        // then render the dashboard only for its first API call to 401 and bounce
        // back to login. Re-read the session so the dashboard is shown only once the
        // cookie has round-tripped, and use the server's re-validated projection.
        let user;
        try {
            const me = await api.me();
            user = me.data.user;
        } catch (err) {
            throw new Error(
                'Signed in, but the session could not be stored. Enable cookies for this site and try again.'
            );
        }

        setUser(user);
        return user;
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
