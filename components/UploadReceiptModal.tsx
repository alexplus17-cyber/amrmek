import React, { useState } from 'react';
import { Invoice } from '../types';
import Button from './Button';
import { apiService } from '../services/apiService';

interface UploadReceiptModalProps {
    invoice: Invoice;
    onClose: () => void;
    onUploadSuccess: (updatedInvoice: Invoice) => void;
}

const UploadReceiptModal: React.FC<UploadReceiptModalProps> = ({ invoice, onClose, onUploadSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [comment, setComment] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            setError('Please select a receipt file to upload.');
            return;
        }

        setIsUploading(true);
        setError('');
        try {
            const updatedInvoice = await apiService.uploadWebReceipt(invoice.id, file, comment);
            onUploadSuccess(updatedInvoice);
            onClose();
        } catch (err) {
            setError('Upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };


    return (
        <div 
            className="fixed inset-0 bg-secondary-800 bg-opacity-75 flex items-center justify-center p-4 z-50"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-secondary-900 rounded-lg shadow-xl w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-secondary-200 dark:border-secondary-700">
                    <h3 className="text-xl font-semibold text-secondary-900 dark:text-white">Upload Receipt</h3>
                    <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">For Invoice: {invoice.id} - {invoice.listingName}</p>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                         {error && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/50 p-3 rounded-md">{error}</p>}
                        <div>
                            <label htmlFor="receiptFile" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">
                                Receipt Image/PDF
                            </label>
                            <input 
                                id="receiptFile" 
                                type="file" 
                                onChange={handleFileChange} 
                                accept="image/*,.pdf"
                                required
                                className="mt-1 block w-full text-sm text-secondary-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 dark:file:bg-secondary-700 file:text-primary-700 dark:file:text-primary-200 hover:file:bg-primary-100 dark:hover:file:bg-secondary-600"
                            />
                            {file && <p className="text-xs mt-1 text-secondary-600 dark:text-secondary-400">Selected: {file.name}</p>}
                        </div>
                        <div>
                            <label htmlFor="comment" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">
                                Optional Comment
                            </label>
                            <textarea
                                id="comment"
                                rows={3}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                className="mt-1 appearance-none block w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-secondary-800"
                            />
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-secondary-50 dark:bg-secondary-800/50 flex justify-end space-x-3">
                        <Button type="button" variant="secondary" onClick={onClose} className="!w-auto !py-2">Cancel</Button>
                        <Button type="submit" isLoading={isUploading} className="!w-auto !py-2">Submit</Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UploadReceiptModal;
