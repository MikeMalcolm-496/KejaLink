/**
 * ToastContext: small pop-up messages ("Saved", "Something went wrong").
 * Usage: const toast = useToast(); toast.success('Saved'); toast.error(err.message);
 */
import { createContext, useCallback, useContext, useState } from 'react';
import Icon from '../components/Icon';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, message, type }]);
    setTimeout(() => remove(id), type === 'error' ? 6000 : 3500);
  }, [remove]);
  const value = { success: (m) => show(m, 'success'), error: (m) => show(m, 'error') };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <Icon name={t.type === 'error' ? 'alert' : 'check'} />
            <span>{t.message}</span>
            <button className="close-btn" onClick={() => remove(t.id)} aria-label="Dismiss"><Icon name="x" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
