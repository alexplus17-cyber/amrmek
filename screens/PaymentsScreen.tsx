
import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Spinner from '../components/Spinner';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/apiService';
// FIX: Import the shared MemberDashboardData interface from types.ts
import { Transaction, MemberDashboardData } from '../types';

const PaymentsScreen: React.FC = () => {
    const { user, callApiWithAuth } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [contributionBalance, setContributionBalance] = useState<number>(0);
    const [requiredAmount, setRequiredAmount] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // State for the payment form
    const [paymentAmount, setPaymentAmount] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentError, setPaymentError] = useState('');
    const [paymentSuccess, setPaymentSuccess] = useState('');

    useEffect(() => {
        if (user) {
            setLoading(true);
            // FIX: Provide the specific type to callApiWithAuth to get a typed result.
            callApiWithAuth<MemberDashboardData>(() => apiService.getMemberDashboardData(user.id))
                .then(data => {
                    setTransactions(data.transactions);
                    setContributionBalance(data.contributionBalance);
                    setRequiredAmount(data.contributionRequirement);
                    setPaymentAmount(data.contributionRequirement.toString());
                })
                .catch(() => setError('Failed to load financial data.'))
                .finally(() => setLoading(false));
        }
    }, [user, callApiWithAuth]);

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) {
            setPaymentError('Please enter a valid amount.');
            return;
        }

        setIsProcessing(true);
        setPaymentError('');
        setPaymentSuccess('');

        try {
            const result = await apiService.makeContributionPayment(user.id, amount);
            setContributionBalance(result.newBalance);
            setTransactions(prev => [result.newTransaction, ...prev]);
            setPaymentSuccess(`Successfully contributed $${amount.toFixed(2)}!`);
            setTimeout(() => setPaymentSuccess(''), 4000);
        } catch (err: any) {
            setPaymentError(err.message || 'Payment failed. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) return <Spinner />;
    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Billing & Payments</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Payment Form Column */}
                <div className="lg:col-span-1 space-y-6">
                     <Card title="Your Balance">
                        <p className="text-3xl font-bold text-green-600 dark:text-green-400">${contributionBalance.toLocaleString()}</p>
                        <p className="text-secondary-500 dark:text-secondary-400">Available Contribution Balance</p>
                    </Card>
                    <Card title="Make a Contribution">
                        <form onSubmit={handlePaymentSubmit} className="space-y-4">
                            {paymentError && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/50 p-3 rounded-md">{paymentError}</p>}
                            {paymentSuccess && <p className="text-sm text-green-600 bg-green-100 dark:bg-green-900/50 p-3 rounded-md">{paymentSuccess}</p>}
                            <Input
                                id="paymentAmount"
                                label={`Amount (Required: $${requiredAmount})`}
                                type="number"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                required
                                step="0.01"
                            />
                            <div>
                                <p className="text-xs text-secondary-500 dark:text-secondary-400">Payments are processed securely via Stripe.</p>
                            </div>
                            <Button type="submit" isLoading={isProcessing}>
                                Pay ${parseFloat(paymentAmount) || 0}
                            </Button>
                        </form>
                    </Card>
                </div>

                {/* Transaction History Column */}
                <div className="lg:col-span-2">
                    <Card title="Transaction History">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-secondary-200 dark:divide-secondary-700">
                                <thead className="bg-secondary-50 dark:bg-secondary-800">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Date</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Description</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-secondary-500 uppercase tracking-wider">Amount</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-secondary-500 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-secondary-900 divide-y divide-secondary-200 dark:divide-secondary-700">
                                    {transactions.map(tx => (
                                        <tr key={tx.id}>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-secondary-500 dark:text-secondary-400">{tx.date}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-secondary-900 dark:text-white">{tx.description}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-semibold">${tx.amount.toLocaleString()}</td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                    tx.status === 'Completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {tx.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                         {transactions.length === 0 && (
                            <p className="text-center py-8 text-secondary-500 dark:text-secondary-400">No transactions yet.</p>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default PaymentsScreen;