
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { Listing } from '../types';
import Card from '../components/Card';
import Spinner from '../components/Spinner';
import Input from '../components/Input';

interface InvestmentsScreenProps {
    onSelectInvestment: (id: number) => void;
}

const InvestmentsScreen: React.FC<InvestmentsScreenProps> = ({ onSelectInvestment }) => {
    const [listings, setListings] = useState<Listing[]>([]);
    const [filteredListings, setFilteredListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        apiService.getListings()
            .then(data => {
                setListings(data);
                setFilteredListings(data);
            })
            .finally(() => setLoading(false));
    }, []);
    
    useEffect(() => {
        const lowercasedTerm = searchTerm.toLowerCase();
        const filtered = listings.filter(listing => 
            listing.title.toLowerCase().includes(lowercasedTerm) ||
            listing.summary.toLowerCase().includes(lowercasedTerm)
        );
        setFilteredListings(filtered);
    }, [searchTerm, listings]);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Investment Opportunities</h1>
                <div className="w-full max-w-xs">
                    <Input 
                        id="search" 
                        label=""
                        type="text" 
                        placeholder="Search investments..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            {loading ? <Spinner /> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredListings.map(listing => (
                        <Card key={listing.id} className="!p-0 cursor-pointer transition-transform duration-200 hover:scale-105" onClick={() => onSelectInvestment(listing.id)}>
                            <img src={listing.image} alt={listing.title} className="w-full h-48 object-cover"/>
                            <div className="p-6">
                                <h3 className="text-lg font-bold text-primary-600 dark:text-primary-400">{listing.title}</h3>
                                <p className="mt-2 text-sm text-secondary-600 dark:text-secondary-400">{listing.summary}</p>
                                <div className="mt-4 flex justify-between items-center">
                                    <span className="text-lg font-bold text-secondary-800 dark:text-secondary-200">${listing.price}/share</span>
                                    <span className="text-sm font-medium text-green-600 dark:text-green-400">{listing.availability} available</span>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
             {filteredListings.length === 0 && !loading && (
                <div className="text-center py-12">
                    <p className="text-secondary-600 dark:text-secondary-400">No investments found matching your search.</p>
                </div>
            )}
        </div>
    );
};

export default InvestmentsScreen;
