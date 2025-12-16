import React, { useEffect, useState, useMemo } from 'react';
import { apiService } from '../services/apiService';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useToast } from '../contexts/ToastContext';

type Invoice = any;

function PaymentForm({ clientSecret, invoiceId, onSuccess, onClose }: { clientSecret: string; invoiceId: number; onSuccess: () => void; onClose: () => void }) {
    const stripe = useStripe();
    const elements = useElements();
    const toast = useToast();
    const [processing, setProcessing] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;
        setProcessing(true);
        try {
            const card = elements.getElement(CardElement);
            if (!card) throw new Error('Card element not found');
            const res = await stripe.confirmCardPayment(clientSecret, {
                // `card` element typing can vary depending on Stripe element used (AU bank, card number, etc.).
                // Cast to `any` to satisfy TS while keeping runtime behavior intact.
                payment_method: { card: card as any },
            });
            if (res.error) {
                toast.show(res.error.message || 'Payment failed', 'error');
                setProcessing(false);
                return;
            }
            if (res.paymentIntent && res.paymentIntent.status === 'succeeded') {
                // finalize invoice on server
                await apiService.finalizeInvoice(invoiceId, res.paymentIntent.id);
                toast.show('Payment completed', 'success');
                onSuccess();
            } else {
                toast.show('Payment not completed', 'error');
            }
        } catch (err: any) {
            toast.show(err?.message || 'Payment error', 'error');
        } finally {
            setProcessing(false);
            onClose();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-4">
            <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Card details</label>
                <div className="p-3 border rounded bg-white"><CardElement /></div>
            </div>
            <div className="flex items-center space-x-2">
                <button type="submit" disabled={processing} className="im-btn im-btn-primary">{processing ? 'Processing…' : 'Pay'}</button>
                <button type="button" className="im-btn im-btn-outline" onClick={onClose}>Cancel</button>
            </div>
        </form>
    );
}

export default function PaymentsDashboardScreen({ navigateBack }: { navigateBack: () => void }) {
    const [data, setData] = useState<{ invoices: Invoice[]; total: number; per_page: number; page: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploadingId, setUploadingId] = useState<number | null>(null);
    const [perPage, setPerPage] = useState(10);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [paying, setPaying] = useState<{ invoiceId: number; clientSecret: string } | null>(null);
    const [stripePromise, setStripePromise] = useState<any>(null);
    const toast = useToast();

    useEffect(() => {
        fetchConfig();
    }, []);

    useEffect(() => {
        fetchInvoices();
    }, [page, perPage]);

    const fetchConfig = async () => {
        try {
            const cfg = await apiService.getPaymentsConfig();
            if (cfg?.stripe_publishable) {
                setStripePromise(loadStripe(cfg.stripe_publishable));
            }
        } catch (e) {
            console.debug('Failed to load payments config', e);
        }
    };

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const r = await apiService.getInvoices({ per_page: perPage, page, search });
            setData(r);
        } catch (e) {
            console.error('Failed to load invoices', e);
            toast.show('Failed to load invoices', 'error');
            setData({ invoices: [], total: 0, per_page: perPage, page });
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (id: number) => {
        try {
            const { url } = await apiService.downloadInvoiceReceipt(id);
            window.open(url, '_blank');
        } catch (e: any) {
            toast.show('Download failed: ' + (e?.message || ''), 'error');
        }
    };

    const handleUpload = async (id: number, file: File) => {
        setUploadingId(id);
        try {
            const res = await apiService.uploadWebReceipt(String(id), file, 'Uploaded from mobile');
            toast.show(res && (res as any).message ? (res as any).message : 'Upload complete', 'success');
            fetchInvoices();
        } catch (e: any) {
            toast.show('Upload failed: ' + (e?.message || ''), 'error');
        } finally {
            setUploadingId(null);
        }
    };

    const handlePay = async (id: number) => {
        try {
            const res = await apiService.createInvoiceStripeIntent(id);
            if (res && (res as any).client_secret) {
                setPaying({ invoiceId: id, clientSecret: (res as any).client_secret });
            } else {
                toast.show('Payment intent not available.', 'error');
            }
        } catch (e: any) {
            toast.show('Payment initiation failed: ' + (e?.message || ''), 'error');
        }
    };

    const totalPages = useMemo(() => {
        if (!data) return 1;
        return Math.max(1, Math.ceil((data.total || 0) / (data.per_page || perPage)));
    }, [data, perPage]);

    return (
        <div className="p-4">
            <div className="flex items-center mb-4">
                <button onClick={navigateBack} className="mr-2 im-btn im-btn-outline">Back</button>
                <h2 className="text-lg font-semibold">Payments & Invoices</h2>
            </div>

            <div className="mb-4 flex items-center space-x-2">
                <input placeholder="Search invoices" className="im-input" value={search} onChange={(e) => setSearch(e.target.value)} />
                <button className="im-btn" onClick={() => { setPage(1); fetchInvoices(); }}>Search</button>
                <div className="ml-auto">Per page:
                    <select aria-label="Invoices per page" className="ml-2 im-input" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                    </select>
                </div>
            </div>

            {loading ? <div>Loading invoices...</div> : (
                <div>
                    {(!data || !data.invoices || data.invoices.length === 0) ? (
                        <div className="im-alert im-alert-info">No invoices found.</div>
                    ) : (
                        <div className="im-table-responsive">
                            <table className="im-table w-full">
                                <thead>
                                    <tr>
                                        <th>Invoice #</th>
                                        <th>Amount</th>
                                        <th>Due</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.invoices.map((inv: any) => (
                                        <tr key={inv.id}>
                                            <td>#{inv.id}</td>
                                            <td>{inv.currency} {Number(inv.amount).toFixed(2)}</td>
                                            <td>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}</td>
                                            <td>{inv.status}</td>
                                            <td>
                                                <button className="im-btn im-btn-sm im-btn-outline mr-2" onClick={() => handleDownload(inv.id)}>Download</button>
                                                {inv.status === 'pending' && (
                                                    <>
                                                        <button className="im-btn im-btn-sm im-btn-primary mr-2" onClick={() => handlePay(inv.id)}>Pay</button>
                                                        <label className="im-btn im-btn-sm im-btn-secondary cursor-pointer">
                                                            {uploadingId === inv.id ? 'Uploading...' : 'Upload Receipt'}
                                                            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { if (e.target.files && e.target.files[0]) handleUpload(inv.id, e.target.files[0]); }} />
                                                        </label>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="mt-4 flex items-center justify-between">
                        <div>Showing page {data?.page} of {totalPages} — {data?.total} invoices</div>
                        <div className="space-x-2">
                            <button disabled={page <= 1} className="im-btn im-btn-sm" onClick={() => { setPage(p => Math.max(1, p - 1)); fetchInvoices(); }}>Prev</button>
                            <button disabled={page >= totalPages} className="im-btn im-btn-sm" onClick={() => { setPage(p => Math.min(totalPages, p + 1)); fetchInvoices(); }}>Next</button>
                        </div>
                    </div>
                </div>
            )}

            {paying && stripePromise && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
                    <div className="bg-white rounded shadow-lg w-full max-w-md">
                        <div className="p-4 border-b flex items-center justify-between">
                            <h3 className="font-semibold">Pay Invoice #{paying.invoiceId}</h3>
                            <button className="im-btn im-btn-sm" onClick={() => setPaying(null)}>Close</button>
                        </div>
                        <Elements stripe={stripePromise} options={{ clientSecret: paying.clientSecret }}>
                            <PaymentForm clientSecret={paying.clientSecret} invoiceId={paying.invoiceId} onSuccess={() => { fetchInvoices(); }} onClose={() => setPaying(null)} />
                        </Elements>
                    </div>
                </div>
            )}
        </div>
    );
}
