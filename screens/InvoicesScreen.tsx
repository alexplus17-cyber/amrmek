import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import { Invoice, InvoiceStatus } from '../types';
import { apiService } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/Spinner';
import UploadReceiptModal from '../components/UploadReceiptModal';
import Button from '../components/Button';

const StatusBadge: React.FC<{ status: InvoiceStatus }> = ({ status }) => {
    const colorClasses = {
        [InvoiceStatus.PENDING_BANK_TRANSFER]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        [InvoiceStatus.PENDING_CONFIRMATION]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        [InvoiceStatus.PAID_PENDING_VERIFICATION]: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
        [InvoiceStatus.COMPLETED]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        [InvoiceStatus.FAILED]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    };
    return (
        <span className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full ${colorClasses[status]}`}>
            {status}
        </span>
    );
};

const InvoicesScreen: React.FC = () => {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [updatingInvoices, setUpdatingInvoices] = useState<Set<string>>(new Set());


    useEffect(() => {
        if (user) {
            apiService.getInvoices()
                .then((res: any) => {
                    // apiService.getInvoices returns { invoices: Invoice[], total, per_page, page }
                    const list = (res && (res.invoices || res.value)) || (Array.isArray(res) ? res : []);
                    setInvoices(list);
                })
                .catch(err => {
                    console.error('Failed to load invoices', err);
                    setInvoices([]);
                })
                .finally(() => setLoading(false));
        }
    }, [user]);

    const handleUploadSuccess = (updatedInvoice: Invoice) => {
        setInvoices(currentInvoices => 
            currentInvoices.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv)
        );
    };

    const handleMarkAsPaid = async (invoiceId: string) => {
        // Optimistic UI update
        setUpdatingInvoices(prev => new Set(prev).add(invoiceId));
        const originalInvoices = invoices;
        setInvoices(current => current.map(inv => 
            inv.id === invoiceId ? { ...inv, status: InvoiceStatus.PAID_PENDING_VERIFICATION } : inv
        ));

        try {
            const updatedInvoice = await apiService.markInvoiceAsPaid(invoiceId);
            // Confirm update from server response
             setInvoices(current => current.map(inv => 
                inv.id === updatedInvoice.id ? updatedInvoice : inv
            ));
        } catch (error) {
            console.error("Failed to mark invoice as paid", error);
            // Revert on error
            setInvoices(originalInvoices);
            alert("Could not mark invoice as paid. Please try again.");
        } finally {
            setUpdatingInvoices(prev => {
                const next = new Set(prev);
                next.delete(invoiceId);
                return next;
            });
        }
    };


    return (
        <>
            <Card title="Your Invoices">
                {loading ? (
                    <Spinner />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-secondary-200 dark:divide-secondary-700">
                            <thead className="bg-secondary-50 dark:bg-secondary-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Investment</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Investment Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider"></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-secondary-900 divide-y divide-secondary-200 dark:divide-secondary-700">
                                {invoices.map(invoice => (
                                    <tr key={invoice.id}>
                                        {/* Derive display values with sensible fallbacks */}
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-secondary-900 dark:text-white">{invoice.listingName || (`Invoice #${invoice.id}`)}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-secondary-500 dark:text-secondary-400">{(invoice.date && !isNaN(Date.parse(invoice.date))) ? new Date(invoice.date).toLocaleDateString() : (invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : 'N/A')}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold">${(Number(invoice.amount) || 0).toLocaleString()}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm"><StatusBadge status={invoice.status} /></td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                                            {invoice.status === InvoiceStatus.PENDING_BANK_TRANSFER && (
                                                <button 
                                                    onClick={() => setSelectedInvoice(invoice)}
                                                    className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-200"
                                                >
                                                    Upload Receipt
                                                </button>
                                            )}
                                            {invoice.status === InvoiceStatus.PENDING_CONFIRMATION && (
                                                <button
                                                    onClick={() => handleMarkAsPaid(invoice.id)}
                                                    disabled={updatingInvoices.has(invoice.id)}
                                                    className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200 disabled:opacity-50"
                                                >
                                                    {updatingInvoices.has(invoice.id) ? 'Updating...' : 'Mark as Paid'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
            {selectedInvoice && (
                <UploadReceiptModal 
                    invoice={selectedInvoice}
                    onClose={() => setSelectedInvoice(null)}
                    onUploadSuccess={handleUploadSuccess}
                />
            )}
        </>
    );
};

export default InvoicesScreen;