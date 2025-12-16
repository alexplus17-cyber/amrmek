import React from 'react';

export type ToastItem = { id: string; message: string; type?: 'success' | 'error' | 'info' };

export default function Toast({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
    return (
        <div className="fixed right-4 top-4 z-50" aria-live="polite">
            {toasts.map(t => (
                <div key={t.id} className={`p-3 mb-2 rounded shadow-md ${t.type === 'error' ? 'bg-red-600 text-white' : t.type === 'success' ? 'bg-green-600 text-white' : 'bg-gray-800 text-white'}`}>
                    <div className="flex items-center justify-between">
                        <div>{t.message}</div>
                        <button onClick={() => onDismiss(t.id)} aria-label="Dismiss toast" className="ml-3 text-sm opacity-80">✕</button>
                    </div>
                </div>
            ))}
        </div>
    );
}
