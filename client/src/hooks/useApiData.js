import { useCallback, useEffect, useState } from 'react';


export function useApiData(fetcher, deps = []) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [reloadToken, setReloadToken] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        let active = true;

        setLoading(true);
        setError(null);

        Promise.resolve(fetcher(controller.signal))
            .then((res) => {
                if (!active) return;
                setData(res && Object.prototype.hasOwnProperty.call(res, 'data') ? res.data : res);
            })
            .catch((err) => {
                if (!active || err.name === 'AbortError') return;
                setError(err.message || 'Something went wrong.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
            controller.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, reloadToken]);

    const reload = useCallback(() => setReloadToken(t => t + 1), []);

    return { data, error, loading, reload, setData };
}
