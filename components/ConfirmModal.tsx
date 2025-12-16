import React from 'react';
import Modal from './Modal';
import Button from './Button';

const ConfirmModal: React.FC<{ open: boolean; title?: string; message: React.ReactNode; onConfirm: () => void; onCancel: () => void; confirmLabel?: string; cancelLabel?: string }> = ({ open, title, message, onConfirm, onCancel, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }) => {
    return (
        <Modal open={open} onClose={onCancel} title={title}>
            <div className="space-y-4">
                <div className="text-sm text-secondary-700 dark:text-secondary-300">{message}</div>
                <div className="flex items-center justify-end space-x-2">
                    <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
                    <Button onClick={onConfirm}>{confirmLabel}</Button>
                </div>
            </div>
        </Modal>
    );
};

export default ConfirmModal;
