
import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import './quick-access.css';
import {
    IconPortfolio, IconBuy, IconDocs, IconBell, IconMegaphone, IconMeetings, IconChart, IconCard, IconCalculator, IconSell, IconLedger, IconCashFlow, IconVote, IconShare
} from '../components/QuickAccessIcons';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/apiService';
import Spinner from '../components/Spinner';
// FIX: Import MemberDashboardData type for improved type safety.
import { Listing, MemberDashboardData } from '../types';
import PollsScreen from './PollsScreen';
import AnnouncementsScreen from './AnnouncementsScreen';
import InvoicesScreen from './InvoicesScreen';
import ErrorBoundary from '../components/ErrorBoundary';
import Button from '../components/Button';
import QuickAccessBuyCard from '../components/QuickAccessBuyCard';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MemberDashboardProps {
    setView: (view: any) => void;
    onSelectInvestment: (id: number) => void;
    // Optional navigation callback for opening arbitrary app routes/pages
    navigateTo?: (path: string) => void;
}


const FeaturedInvestments: React.FC<{ setView: (view: string) => void, onSelectInvestment: (id: number) => void }> = ({ setView, onSelectInvestment }) => {
    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiService.getProposals()
            .then(data => {
                // Sort by id descending to get the latest proposals
                const sorted = data.sort((a, b) => Number(b.id) - Number(a.id));
                setListings(sorted.slice(0, 3)); // Show up to 3 latest as featured
            })
            .catch(err => {
                console.error('Failed to load featured investments:', err);
                setError('Unable to load featured investments');
            })
            .finally(() => setLoading(false));
    }, []);

    const getPriceDisplay = (listing: Listing) => {
        const price = listing.price || listing.price_per_share || listing.ask_price;
        if (price) {
            return `$${Number(price).toFixed(2)} per share`;
        }
        return '';
    };

    const getImageSrc = (listing: Listing) => {
        return listing.image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjMyIiB5PSIzMiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgdGV4dC1iYXNlPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk5OSI+Tm8gSW1hZ2U8L3RleHQ+Cjwvc3ZnPg==';
    };

    return (
        <Card id="featured-investments" title="Featured Investments">
            {loading ? <Spinner /> : error ? (
                <div className="text-center py-4 text-secondary-600 dark:text-secondary-400">
                    {error}
                </div>
            ) : listings.length === 0 ? (
                <div className="text-center py-4 text-secondary-600 dark:text-secondary-400">
                    No featured investments available
                </div>
            ) : (
                <div className="space-y-4">
                    {listings.map(listing => (
                         <div key={listing.id} className="flex items-start space-x-4 p-3 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800 cursor-pointer transition-colors" onClick={() => setView('proposals')}>
                            <img src={getImageSrc(listing)} alt={listing.title} className="w-16 h-16 rounded-md object-cover flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                    <h4 className="font-semibold text-primary-600 dark:text-primary-400 truncate">{listing.title}</h4>
                                </div>
                                <p className="text-sm text-secondary-600 dark:text-secondary-400 line-clamp-2">{listing.summary || listing.description}</p>
                                {getPriceDisplay(listing) && (
                                    <p className="text-sm font-medium text-green-600 dark:text-green-400 mt-1">{getPriceDisplay(listing)}</p>
                                )}
                            </div>
                        </div>
                    ))}
                    <div className="pt-2">
                         <Button onClick={() => setView('proposals')} variant="secondary" className="!w-auto !py-2">View All Investments</Button>
                    </div>
                </div>
            )}
        </Card>
    );
};


const MemberDashboard: React.FC<MemberDashboardProps> = ({ setView, onSelectInvestment, navigateTo }) => {
    const { user, callApiWithAuth } = useAuth();
    // FIX: Use the specific MemberDashboardData type instead of any.
    const [data, setData] = useState<MemberDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [openMenu, setOpenMenu] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            (async () => {
                try {
                    const dashboard = await callApiWithAuth(() => apiService.getMemberDashboardData(user.id));
                    // Try to fetch holdings and listings as well so Quick Access can show sell info
                    const [holdingsRes, listingsRes] = await Promise.allSettled([
                        apiService.getMemberPortfolio({ type: 'holdings', per_page: 200 }),
                        apiService.getListings(),
                    ]);

                    const merged: any = { ...(dashboard || {}) };
                    if (holdingsRes.status === 'fulfilled') merged.holdings = (Array.isArray(holdingsRes.value) ? holdingsRes.value : (holdingsRes.value && (holdingsRes.value.holdings || holdingsRes.value.items || holdingsRes.value)) || []);
                    else merged.holdings = [];
                    if (listingsRes.status === 'fulfilled') merged.listings = listingsRes.value || [];
                    else merged.listings = [];

                    // Derive sell_requests from dashboard.transactions if available
                    const txs = dashboard && (dashboard.transactions || []);
                    merged.sell_requests = Array.isArray(txs) ? txs.filter((t:any) => String((t.type || t.action || '')).toLowerCase().includes('sell')).slice(0,10) : [];

                    setData(merged);
                } catch (err) {
                    console.error("Failed to fetch dashboard data, even after potential token refresh:", err);
                } finally {
                    setLoading(false);
                }
            })();
        }
    }, [user, callApiWithAuth]);
    
    const chartData = [
        { name: 'Q1', investment: 400000 },
        { name: 'Q2', investment: 300000 },
        { name: 'Q3', investment: 500000 },
        { name: 'Q4', investment: data?.groupStats.totalInvested - 1200000 || 50000 },
    ];

    if (loading) return <Spinner />;
    if (!data) return <p>Could not load dashboard data.</p>

    return (
        <>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Member Dashboard</h1>
                
                {/* Top Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card title="Latest Contribution">
                        <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">${data.contributionRequirement.toLocaleString()}</p>
                        <p className="text-secondary-500 dark:text-secondary-400">{data.contributionStatus === 'required' ? 'Required' : 'Paid'}</p>
                        <Button onClick={() => setView('purchaseShares')} className="!w-auto !py-2 mt-4">Make Contribution</Button>
                    </Card>
                    <Card title="Your Contribution Balance">
                        <p className="text-3xl font-bold text-green-600 dark:text-green-400">${data.contributionBalance.toLocaleString()}</p>
                        <p className="text-secondary-500 dark:text-secondary-400">Available</p>
                    </Card>
                    <Card title="Investment Group">
                        <p className="text-3xl font-bold">{data.groupStats.totalMembers}</p>
                        <p className="text-secondary-500 dark:text-secondary-400">Total Members</p>
                    </Card>
                </div>

                {/* Quick Access Cards (matching web dashboard) */}
                <section aria-labelledby="quick-access-title" className="mt-6">
                    <h2 id="quick-access-title" className="text-xl font-semibold">Quick Access</h2>
                    <div className="quick-access-grid mt-3">
                        {([
                            { key: 'portfolio', title: 'PORTFOLIO', desc: 'View investments & performance', action: () => { if (typeof navigateTo === 'function') { navigateTo('/member-portfolio/'); } else { /* fallback to native view */ setView('portfolio'); } }, icon: <IconPortfolio className="icon" /> },
                            { key: 'buy_shares', title: 'BUY SHARES', desc: 'Invest in new opportunities', action: () => setView('investments'), icon: <IconBuy className="icon" /> },
                            { key: 'calculator', title: 'CALCULATOR', desc: 'ROI & projections', action: () => { if (typeof navigateTo === 'function') { navigateTo('/investment-calculator/'); } else { window.location.href = window.location.origin + '/investment-calculator/'; } }, icon: <IconCalculator className="icon" /> },
                            { key: 'documents', title: 'DOCUMENTS', desc: 'Access library & resources', action: () => setView('documents'), icon: <IconDocs className="icon" /> },
                            { key: 'notifications', title: 'NOTIFICATIONS', desc: 'Manage alerts & messages', action: () => { setView('notifications'); }, icon: <IconBell className="icon" /> },
                            { key: 'announcements', title: 'ANNOUNCEMENTS', desc: 'Company updates & news', action: () => { if (typeof navigateTo === 'function') { navigateTo('/investor-announcements/'); } else { window.location.href = window.location.origin + '/investor-announcements/'; } }, icon: <IconMegaphone className="icon" /> },
                            { key: 'affiliate', title: 'AFFILIATE PROGRAM', desc: 'Invite and earn commissions', action: () => { if (typeof navigateTo === 'function') { navigateTo('/investor-affiliate-dashboard/'); } else { window.location.href = window.location.origin + '/investor-affiliate-dashboard/'; } }, icon: <IconShare className="icon" /> },
                            { key: 'sell_shares', title: 'SELL SHARES', desc: 'Sell shares you own', action: () => { setView('sellShares'); }, icon: <IconSell className="icon" /> },
                            { key: 'meetings', title: 'MEETINGS', desc: 'Schedule & join events', action: () => { if (typeof navigateTo === 'function') { navigateTo('/investor-meetings/'); } else { window.location.href = window.location.origin + '/investor-meetings/'; } }, icon: <IconMeetings className="icon" /> },
                            { key: 'financials', title: 'FINANCIALS', desc: 'Reports & performance', action: () => { if (typeof navigateTo === 'function') { navigateTo('/in-net-income-summary/'); } else { window.location.href = window.location.origin + '/in-net-income-summary/'; } }, icon: <IconChart className="icon" /> },
                            { key: 'cashflow', title: 'CASH FLOW', desc: 'Your cash flows by proposal', action: () => { if (typeof navigateTo === 'function') { navigateTo('/in-cashflow-summary/'); } else { window.location.href = window.location.origin + '/in-cashflow-summary/'; } }, icon: <IconCashFlow className="icon" /> },
                            { key: 'ledger', title: 'LEDGER', desc: 'Recent transactions & CSV', action: () => { if (typeof navigateTo === 'function') { navigateTo('/ledger-account/'); } else { window.location.href = window.location.origin + '/ledger-account/'; } }, icon: <IconLedger className="icon" /> },
                            { key: 'payments', title: 'PAYMENTS', desc: 'Manage payments & invoices', action: () => { if (typeof navigateTo === 'function') { navigateTo('/investor-payments-dashboard/'); } else { setView('payments'); } }, icon: <IconCard className="icon" /> },
                            { key: 'contributions', title: 'CONTRIBUTIONS', desc: 'Payment history & tracking', action: () => { if (typeof navigateTo === 'function') { navigateTo('/im-contributions/'); } else { window.location.href = window.location.origin + '/im-contributions/'; } }, icon: <IconCard className="icon" /> },
                            { key: 'proposals', title: 'PROPOSALS', desc: 'Vote & review', action: () => { setView('proposals'); }, icon: <IconVote className="icon" /> },
                        ] as Array<any>).map(card => {
                            if (card.key === 'buy_shares') {
                                return (
                                    <QuickAccessBuyCard key={card.key} setView={setView} navigateTo={navigateTo} />
                                );
                            }
                            return (
                                <div
                                    key={card.key}
                                    className="quick-access-card"
                                >
                                    <div>
                                        {card.icon}
                                        <div className="title">{card.title}</div>
                                        <div className="desc">{card.desc}</div>
                                    </div>
                                    {card.action ? (
                                        <div className="pt-3 flex items-center space-x-2">
                                            <Button onClick={(ev) => { ev.stopPropagation(); card.action(); }} variant="outline" className="!py-1 !px-2" aria-label={`Open ${card.title}`}>Open</Button>
                                            {card.key === 'financials' && (
                                                <div className="relative">
                                                    <button
                                                        onClick={(ev) => { ev.stopPropagation(); setOpenMenu(openMenu === card.key ? null : card.key); }}
                                                        aria-haspopup="true"
                                                        className="im-btn im-btn-sm"
                                                        title="More"
                                                    >
                                                        ⋯
                                                    </button>
                                                    {openMenu === card.key && (
                                                        <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow z-50">
                                                            <button className="block w-full text-left px-3 py-2 hover:bg-gray-100" onClick={(ev) => { ev.stopPropagation(); setOpenMenu(null); if (typeof navigateTo === 'function') { navigateTo('/in-net-income-summary/'); } else { window.location.href = window.location.origin + '/in-net-income-summary/'; } }}>Net Income Summary</button>
                                                            <button className="block w-full text-left px-3 py-2 hover:bg-gray-100" onClick={(ev) => { ev.stopPropagation(); setOpenMenu(null); document.getElementById('invoices-widget')?.scrollIntoView({ behavior: 'smooth' }); }}>Invoices</button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : null}

                                    {/* sell_shares compact UI moved into SellSharesScreen */}
                                </div>
                            );
                        })}
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <FeaturedInvestments setView={setView} onSelectInvestment={onSelectInvestment} />
                        <ErrorBoundary fallback={<div className="p-4">Unable to load invoices at this time.</div>}>
                            <div id="invoices-widget">
                                <InvoicesScreen />
                            </div>
                        </ErrorBoundary>
                    </div>

                    <div className="space-y-6">
                         <div id="polls-widget"><PollsScreen /></div>
                         <div id="announcements-widget"><AnnouncementsScreen /></div>
                    </div>
                </div>
            </div>
            
        </>
    );
};

export default MemberDashboard;