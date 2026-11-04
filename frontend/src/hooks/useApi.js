/**
 * useApi: load data from the API with loading and error state.
 *   const { data, loading, error, reload } = useApi('/agent/dashboard');
 * Re-runs when the URL or the params change.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

export default function useApi(url, params) {
  const key = url ? url + JSON.stringify(params || {}) : null;
  const [state, setState] = useState({ data: null, loading: Boolean(url), error: null });

  const load = useCallback(async () => {
    if (!url) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.get(url, params);
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
