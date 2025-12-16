import React, { useEffect } from 'react';

const Modal: React.FC<{ title?: string; open: boolean; onClose: () => void; children?: React.ReactNode }> = ({ title, open, onClose, children }) => {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (open) document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4">
            <div className="fixed inset-0 bg-black opacity-40" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-3xl w-full max-h-[85vh] overflow-auto z-10">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <button aria-label="Close" className="text-sm px-3 py-1" onClick={onClose}>✕</button>
                </div>
                <div className="p-4">{children}</div>
            </div>
        </div>
    );
};

export default Modal;
