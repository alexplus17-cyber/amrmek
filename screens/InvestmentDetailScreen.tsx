
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { Invoice, Listing } from '../types';
import Spinner from '../components/Spinner';
import Card from '../components/Card';
import Button from '../components/Button';
import PurchaseModal from '../components/PurchaseModal';

interface InvestmentDetailScreenProps {
    listingId: number;
    onBack: () => void;
    onPurchaseSuccess: (invoiceId: string) => void;
}

const InvestmentDetailScreen: React.FC<InvestmentDetailScreenProps> = ({ listingId, onBack, onPurchaseSuccess }) => {
    const [listing, setListing] = useState<Listing | null | undefined>(null);
    const [loading, setLoading] = useState(true);
    const [currentAvailability, setCurrentAvailability] = useState<number | null>(null);
    const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

    useEffect(() => {
        setLoading(true);
        apiService.getListingDetails(listingId)
            .then(data => {
                setListing(data);
                if (data) {
                    setCurrentAvailability(data.availability);
                }
            })
            .finally(() => setLoading(false));
    }, [listingId]);
    
    const handleCheckAvailability = async () => {
        setIsCheckingAvailability(true);
        try {
            const data = await apiService.getListingAvailability(listingId);
            setCurrentAvailability(data.availability);
        } catch (error) {
            console.error("Failed to check availability", error);
            // Optionally show an error to the user
        } finally {
            setIsCheckingAvailability(false);
        }
    };

    const handlePurchaseSuccess = (newInvoice: Invoice) => {
        setIsPurchaseModalOpen(false);
        onPurchaseSuccess(newInvoice.id);
    }

    if (loading) return <Spinner />;
    if (!listing) return <p>Investment not found.</p>;

    return (
        <>
            <div>
                <button onClick={onBack} className="mb-6 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline">
                    &larr; Back to all investments
                </button>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-3">
                         <img src={listing.image} alt={listing.title} className="w-full h-auto object-cover rounded-lg shadow-lg"/>
                    </div>
                    <div className="lg:col-span-2">
                        <Card>
                            <h1 className="text-3xl font-bold mb-2 text-secondary-900 dark:text-white">{listing.title}</h1>
                            <p className="text-md text-secondary-600 dark:text-secondary-400 mb-6">{listing.summary}</p>

                            <div className="space-y-4 mb-6">
                                <div className="flex justify-between items-center bg-secondary-100 dark:bg-secondary-800 p-3 rounded-md">
                                    <span className="font-medium">Price per Share</span>
                                    <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">${listing.price ? listing.price.toFixed(2) : 'N/A'}</span>
                                </div>
                                 <div className="flex justify-between items-center bg-secondary-100 dark:bg-secondary-800 p-3 rounded-md">
                                    <span className="font-medium">Shares Available</span>
                                    <div className="flex items-center space-x-2">
                                        {isCheckingAvailability ? (
                                            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <span className="font-bold text-lg">
                                                {currentAvailability !== null ? currentAvailability.toLocaleString() : 'N/A'}
                                            </span>
                                        )}
                                        <button 
                                            onClick={handleCheckAvailability} 
                                            disabled={isCheckingAvailability}
                                            className="text-xs font-semibold text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-200 disabled:opacity-50 disabled:cursor-wait"
                                            aria-label="Refresh available shares"
                                        >
                                            Refresh
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <Button onClick={() => setIsPurchaseModalOpen(true)} className="w-full">
                                Invest Now
                            </Button>
                        </Card>
                    </div>
                </div>

                 <div className="mt-8">
                    <Card title="Detailed Description">
                        <p className="text-secondary-700 dark:text-secondary-300 leading-relaxed">
                            {listing.description}
                        </p>
                    </Card>
                </div>
            </div>
            {isPurchaseModalOpen && (
                <PurchaseModal
                    listing={listing}
                    onClose={() => setIsPurchaseModalOpen(false)}
                    onSuccess={handlePurchaseSuccess}
                />
            )}
        </>
    );
};

export default InvestmentDetailScreen;
