
import React, { useState, useEffect } from 'react';
import { Invoice, Listing } from '../types';
import Button from './Button';
import Input from './Input';
import { apiService } from '../services/apiService';

interface PurchaseModalProps {
    listing: Listing;
    onClose: () => void;
    onSuccess: (newInvoice: Invoice) => void;
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({ listing, onClose, onSuccess }) => {
    // FIX: Allow quantity to be an empty string to handle the user clearing the input field.
    const [quantity, setQuantity] = useState<number | ''>(1);
    const [totalCost, setTotalCost] = useState(listing.price);
    const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'bank'>('stripe');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const numQuantity = Number(quantity);
        if (!isNaN(numQuantity) && numQuantity > 0) {
            setTotalCost(numQuantity * listing.price);
        } else {
            setTotalCost(0);
        }
    }, [quantity, listing.price]);

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        // FIX: Handle empty string and number cases separately to satisfy TypeScript.
        if (val === '') {
            setQuantity('');
            return;
        }
        const numVal = parseInt(val, 10);
        if (!isNaN(numVal) && numVal >= 0) {
            setQuantity(numVal);
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const numQuantity = Number(quantity);

        if (numQuantity <= 0) {
            setError('Please enter a valid quantity.');
            return;
        }
        if (numQuantity > listing.availability) {
            setError('Requested quantity exceeds available shares.');
            return;
        }
        
        setIsProcessing(true);

        try {
            if (paymentMethod === 'stripe') {
                // 1. Simulate creating a payment intent
                const { clientSecret } = await apiService.createStripeIntent(listing.id, numQuantity);
                // 2. In a real app, you would now use Stripe.js to confirm the payment. We'll simulate success.
                console.log(`Simulating Stripe payment with secret: ${clientSecret}`);
                await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate Stripe checkout
                // 3. Record the purchase
                const { newInvoice } = await apiService.recordPurchase(listing.id, numQuantity, 'stripe', { paymentIntentId: clientSecret.split('_secret_')[0] });
                onSuccess(newInvoice);
            } else { // Bank Transfer
                const { newInvoice } = await apiService.recordPurchase(listing.id, numQuantity, 'bank', {});
                onSuccess(newInvoice);
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-secondary-800 bg-opacity-75 flex items-center justify-center p-4 z-50"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-secondary-900 rounded-lg shadow-xl w-full max-w-lg"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-secondary-200 dark:border-secondary-700">
                    <h3 className="text-xl font-semibold text-secondary-900 dark:text-white">Invest in {listing.title}</h3>
                    <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">
                        ${listing.price}/share &bull; {listing.availability} shares available
                    </p>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        {error && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/50 p-3 rounded-md">{error}</p>}
                        <Input
                            id="quantity"
                            label="Quantity (number of shares)"
                            type="number"
                            value={quantity}
                            onChange={handleQuantityChange}
                            required
                            min="1"
                            max={listing.availability}
                        />

                        <div className="p-4 rounded-md bg-secondary-100 dark:bg-secondary-800">
                            <div className="flex justify-between items-center">
                                <span className="font-medium text-secondary-700 dark:text-secondary-300">Total Cost</span>
                                <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">${totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                        </div>

                        <div>
                             <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                                Payment Method
                            </label>
                            <div className="flex space-x-2">
                                <button type="button" onClick={() => setPaymentMethod('stripe')} className={`flex-1 p-3 rounded-md border-2 transition-colors text-sm font-medium ${paymentMethod === 'stripe' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/50' : 'border-secondary-300 dark:border-secondary-600'}`}>
                                    Credit/Debit Card (Stripe)
                                </button>
                                <button type="button" onClick={() => setPaymentMethod('bank')} className={`flex-1 p-3 rounded-md border-2 transition-colors text-sm font-medium ${paymentMethod === 'bank' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/50' : 'border-secondary-300 dark:border-secondary-600'}`}>
                                    Bank Transfer
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-secondary-50 dark:bg-secondary-800/50 flex justify-end space-x-3">
                        <Button type="button" variant="secondary" onClick={onClose} className="!w-auto !py-2">Cancel</Button>
                        <Button type="submit" isLoading={isProcessing} className="!w-auto !py-2">
                            {isProcessing ? 'Processing...' : `Confirm Investment for $${totalCost.toLocaleString()}`}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PurchaseModal;
