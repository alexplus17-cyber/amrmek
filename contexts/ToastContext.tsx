import React, { createContext, useCallback, useContext, useState } from 'react';
import Toast, { ToastItem } from '../components/Toast';

type ToastContextShape = { show: (message: string, type?: ToastItem['type']) => void };
const ToastContext = createContext<ToastContextShape | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const show = useCallback((message: string, type: ToastItem['type'] = 'info') => {
        const id = String(Date.now()) + Math.random().toString(36).slice(2, 8);
        const t: ToastItem = { id, message, type };
        setToasts(prev => [...prev, t]);
        setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 6000);
    }, []);

    const dismiss = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);

    return (
        <ToastContext.Provider value={{ show }}>
            {children}
            <Toast toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
};
