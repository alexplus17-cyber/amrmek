import React, { useState } from 'react';
import { IconBuy } from './QuickAccessIcons';
import Button from './Button';
import PurchaseModal from './PurchaseModal';
import { apiService } from '../services/apiService';
import { Listing, Invoice } from '../types';

interface QuickAccessBuyCardProps {
    setView: (view: any) => void;
    navigateTo?: (path: string) => void;
}

const QuickAccessBuyCard: React.FC<QuickAccessBuyCardProps> = ({ setView, navigateTo }) => {
    const [buyListing, setBuyListing] = useState<Listing | null>(null);
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [loading, setLoading] = useState(false);

    const openQuickBuy = () => {
        // Navigate to the full purchase-shares screen which mirrors the web `/purchase-shares/` flow.
        setView('purchaseShares');
    };

    return (
        <div className="quick-access-card">
            <div>
                <IconBuy className="icon" />
                <div className="title">BUY SHARES</div>
                <div className="desc">Invest in new opportunities</div>
            </div>
            <div className="pt-3 flex items-center space-x-2">
                <Button onClick={(ev) => { ev.stopPropagation(); openQuickBuy(); }} variant="outline" className="!py-1 !px-2" aria-label="Open BUY SHARES">
                    Open
                </Button>
            </div>

        </div>
    );
};

export default QuickAccessBuyCard;
