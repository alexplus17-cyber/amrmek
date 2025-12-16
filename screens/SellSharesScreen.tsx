import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import Input from '../components/Input';
import { apiService } from '../services/apiService';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../hooks/useAuth';

type Holding = {
  id: number;
  title: string;
  owned: number;
  available: number;
  sell_qty: number;
  price: string | number;
  qty?: number;
  inputPrice?: string;
};

type Listing = {
  id: number;
  proposal_id: number;
  title: string;
  quantity: number;
  price_per_share: string | number;
};

type Transaction = {
  id: number;
  date: string;
  quantity: number;
  status: string;
};

type SellSharesScreenProps = {
  navigateBack?: () => void;
};

const SellSharesScreen: React.FC<SellSharesScreenProps> = ({ navigateBack }) => {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'sell' | 'listings' | 'history'>('sell');
  const [expandedHolding, setExpandedHolding] = useState<number | null>(null);
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  
  const { show } = useToast();
  const { user, callApiWithAuth } = useAuth();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    
    (async () => {
      try {
        const [holdingsRes, listingsRes, txRes] = await Promise.allSettled([
          user ? callApiWithAuth(() => apiService.getMemberPortfolio({ type: 'holdings', per_page: 200 })) : apiService.getMemberPortfolio({ type: 'holdings', per_page: 200 }),
          user ? callApiWithAuth(() => apiService.getListings()) : apiService.getListings(),
          // For history: prefer dedicated sell-requests endpoint when authenticated
          user ? callApiWithAuth(() => apiService.getSellRequests(user.id)) : apiService.getMemberPortfolio({ type: 'transactions', per_page: 10 }),
        ]);

        if (mounted) {
          // Process holdings
          if (holdingsRes.status === 'fulfilled') {
            const res = holdingsRes.value;
            const rows = Array.isArray(res) ? res : (res.rows || res.value || res.holdings || []);
            const mapped = (rows || []).map((r: any) => ({
              id: Number(r.proposal_id || r.id || r.proposal_id),
              title: r.proposal || r.title || r.name || String(r.id || ''),
              owned: Number(r.owned ?? r.shares ?? r.share_quantity ?? 0),
              available: Number(r.available ?? r.available_shares ?? r.shares ?? 0),
              sell_qty: r.sell_qty ?? r.listed_quantity ?? 0,
              price: r.price ?? r.avg_price ?? r.price_per_share ?? r.share_price ?? '',
              qty: 0,
              inputPrice: '',
            }));
            setHoldings(mapped);
          }

          // Process listings
          if (listingsRes.status === 'fulfilled') {
              const raw = listingsRes.value;
              const arr = Array.isArray(raw) ? raw : (raw && (raw.value || raw.listings || raw.rows) ? (raw.value || raw.listings || raw.rows) : []);
              const list = (arr || []).map((l: any) => ({
                id: l.id,
                proposal_id: l.proposal_id ?? l.proposal ?? null,
                title: l.title ?? l.proposal_title ?? l.name ?? `#${l.proposal_id ?? l.id}`,
                quantity: Number(l.quantity ?? l.share_quantity ?? l.available ?? 0),
                price_per_share: l.price_per_share ?? l.price ?? l.share_price ?? l.avg_price ?? '',
                seller_user_id: l.seller_user_id ?? l.seller_user ?? l.seller_id ?? l.user_id ?? null,
              }));
              setListings(list);
          }

          // Process history
          if (txRes.status === 'fulfilled') {
            const tx = txRes.value;
            // If we called getSellRequests, the result is an array of sell_request rows
            const sellRows = Array.isArray(tx) ? tx : (tx.sell_requests || tx.value || []);
            if (Array.isArray(sellRows) && sellRows.length > 0) {
              const historyMapped = sellRows.slice(0, 10).map((s: any) => ({
                id: s.id,
                date: s.created_at || s.requested_at || s.date || s.purchased_at || s.createdAt || '',
                quantity: s.quantity || (Array.isArray(s.items) && s.items.length ? (s.items[0].quantity || 0) : 0),
                status: s.status || 'unknown',
              }));
              setHistory(historyMapped);
            } else {
              // Fallback: process regular member transactions and attempt to detect sell-like entries
              const transactions = Array.isArray(tx) ? tx : (tx.transactions || tx.items || []);
              const sells = (transactions || []).filter((t: any) => 
                String((t.type || t.action || t.transaction_type || '')).toLowerCase().includes('sell') ||
                (t.metadata && String(t.metadata).toLowerCase().includes('sell'))
              );
              const historyMapped = sells.slice(0, 10).map((s: any) => ({
                id: s.id,
                date: s.requested_at || s.purchased_at || s.created_at || s.date || '',
                quantity: s.quantity || s.share_quantity || 0,
                status: s.status || s.state || 'unknown',
              }));
              setHistory(historyMapped);
            }
          }
        }
      } catch (e) {
        console.error('Failed to load sell overview', e);
        show('Failed to load data. Please try again.', 'error');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  const updateQty = (id: number, qty: number) => {
    setHoldings(prev => prev.map(h => 
      h.id === id ? { ...h, qty: Math.max(0, qty) } : h
    ));
  };

  const updatePrice = (id: number, price: string) => {
    setHoldings(prev => prev.map(h => 
      h.id === id ? { ...h, inputPrice: price } : h
    ));
  };

  const calculateTotalValue = () => {
    return holdings.reduce((total, h) => {
      const price = parseFloat(String(h.inputPrice || h.price)) || 0;
      return total + (price * (h.qty || 0));
    }, 0);
  };

  const getItemsToSell = () => {
    return holdings.filter(h => (h.qty || 0) > 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('completed') || statusLower.includes('success')) {
      return 'bg-green-100 text-green-800';
    } else if (statusLower.includes('pending') || statusLower.includes('processing')) {
      return 'bg-yellow-100 text-yellow-800';
    } else if (statusLower.includes('failed') || statusLower.includes('rejected')) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const pctWidthClass = (pct: number) => {
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    if (p === 0) return 'w-0';
    if (p <= 25) return 'w-1/4';
    if (p <= 50) return 'w-1/2';
    if (p <= 75) return 'w-3/4';
    return 'w-full';
  };

  const doSubmit = async () => {
    const items = getItemsToSell().map(h => ({ 
      id: h.id, 
      quantity: Number(h.qty), 
      price: h.inputPrice || h.price 
    }));

    if (items.length === 0) {
      show('Please enter quantities for at least one holding', 'error');
      return;
    }

    for (const it of items) {
      const h = holdings.find(h2 => h2.id === it.id);
      if (h && it.quantity > h.available) {
        show(`Quantity for "${h.title}" exceeds available shares (${h.available} available)`, 'error');
        return;
      }
      if (it.quantity <= 0) {
        show('Quantity must be greater than zero', 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      let nonce: string | undefined = undefined;
      try {
        const page = await fetch('/word/sell-shares/');
        const html = await page.text();
        const m = html.match(/name=["']investor_network_sell_shares_nonce["']\s+value=["']([^"']+)["']/i) || 
                   html.match(/<input[^>]+name="investor_network_sell_shares_nonce"[^>]+value="([^"]+)"/i);
        if (m && m[1]) nonce = m[1];
      } catch (e) {
        // unable to fetch nonce; continue without it
      }

      const res = await apiService.submitSellShares({ 
        items, 
        listing_payment_method: 'free', 
        nonce 
      });
      
      show('Sell request submitted successfully!', 'success');
      
      if (typeof res === 'string' && res.includes('sell_success')) {
        // Refresh data after successful submission
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (e: any) {
      console.error('Sell submit failed', e);
      show(e?.message || 'Failed to submit sell request. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExpandHolding = (id: number) => {
    setExpandedHolding(expandedHolding === id ? null : id);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const itemsToSell = getItemsToSell();
  const totalValue = calculateTotalValue();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sell Shares</h1>
            <p className="text-sm text-gray-600 mt-1">List your shares for sale</p>
          </div>
          {navigateBack && (
            <Button 
              variant="outline" 
              onClick={navigateBack}
              className="text-sm"
            >
              ← Back
            </Button>
          )}
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-blue-700">{holdings.length}</div>
            <div className="text-xs text-blue-600">Holdings</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-green-700">
              {listings.length}
            </div>
            <div className="text-xs text-green-600">Listed</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-purple-700">
              {itemsToSell.length}
            </div>
            <div className="text-xs text-purple-600">Ready to Sell</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mt-4">
          <button
            className={`flex-1 py-3 text-center text-sm font-medium ${activeTab === 'sell' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('sell')}
          >
            Sell
          </button>
          <button
            className={`flex-1 py-3 text-center text-sm font-medium ${activeTab === 'listings' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('listings')}
          >
            Listings ({listings.length})
          </button>
          <button
            className={`flex-1 py-3 text-center text-sm font-medium ${activeTab === 'history' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('history')}
          >
            History ({history.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'sell' && (
          <div className="space-y-4">
            {/* Summary Card */}
            {itemsToSell.length > 0 && (
              <Card className="bg-blue-50 border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-blue-900">Ready to Sell</h3>
                    <p className="text-sm text-blue-700">
                      {itemsToSell.length} holding{itemsToSell.length !== 1 ? 's' : ''} • {formatCurrency(totalValue)} total
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-900">
                      {formatCurrency(totalValue)}
                    </div>
                    <div className="text-xs text-blue-700">Estimated Value</div>
                  </div>
                </div>
              </Card>
            )}

            {/* Holdings List */}
            {holdings.length === 0 ? (
              <Card className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-4">📊</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Holdings Available</h3>
                <p className="text-gray-600">You don't have any shares to sell at the moment.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {holdings.map(holding => {
                  const isExpanded = expandedHolding === holding.id;
                  const qty = holding.qty || 0;
                  const percentage = holding.available > 0 ? Math.round((qty / holding.available) * 100) : 0;
                  
                  return (
                    <Card key={holding.id} className="overflow-hidden">
                      {/* Holding Header */}
                      <div 
                        className="p-4 cursor-pointer"
                        onClick={() => toggleExpandHolding(holding.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">
                              {holding.title}
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                                Available: {holding.available}
                              </span>
                              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                Price: {String(holding.price) || 'N/A'}
                              </span>
                            </div>
                          </div>
                          <button className="ml-2 text-gray-400">
                            {isExpanded ? '↑' : '↓'}
                          </button>
                        </div>

                        {/* Quantity Bar */}
                        {qty > 0 && (
                          <div className="mt-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">Selling: {qty} shares</span>
                              <span className="font-medium">{percentage}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`bg-green-500 h-2 rounded-full transition-all duration-300 ${pctWidthClass(percentage)}`}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Expanded Form */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 p-4 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Quantity to Sell
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  max={holding.available}
                                  value={qty}
                                  onChange={(e) => updateQty(holding.id, parseInt(e.target.value, 10) || 0)}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                  aria-label={`Quantity to sell for ${holding.title}`}
                                  title={`Quantity to sell for ${holding.title}`}
                                  placeholder="0"
                                />
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                                  / {holding.available}
                                </div>
                              </div>
                              <div className="flex gap-2 mt-2">
                                {[25, 50, 100].map(num => (
                                  <button
                                    key={num}
                                    type="button"
                                    onClick={() => updateQty(holding.id, Math.min(num, holding.available))}
                                    className="flex-1 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                                  >
                                    {num}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => updateQty(holding.id, holding.available)}
                                  className="flex-1 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded text-blue-700"
                                >
                                  Max
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Price per Share
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                                <input
                                  type="text"
                                  value={holding.inputPrice || holding.price || ''}
                                  onChange={(e) => updatePrice(holding.id, e.target.value)}
                                  placeholder="Enter price"
                                  aria-label={`Price per share for ${holding.title}`}
                                  title={`Price per share for ${holding.title}`}
                                  className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                              </div>
                              <div className="mt-2 text-xs text-gray-500">
                                Current: ${String(holding.price) || 'N/A'}
                              </div>
                            </div>
                          </div>

                          {/* Preview */}
                          {qty > 0 && (
                            <div className="bg-blue-50 rounded-lg p-3">
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="text-sm text-blue-700">Total Value</div>
                                  <div className="text-lg font-bold text-blue-900">
                                    {formatCurrency(qty * (parseFloat(String(holding.inputPrice || holding.price)) || 0))}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm text-blue-700">Remaining</div>
                                  <div className="text-lg font-bold text-blue-900">
                                    {holding.available - qty} shares
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'listings' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">Listings</div>
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600">Show only my listings</label>
                <button
                  type="button"
                  onClick={() => setShowOnlyMine(prev => !prev)}
                  className={`px-2 py-1 text-xs rounded ${showOnlyMine ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  {showOnlyMine ? 'Showing: Mine' : 'All'}
                </button>
              </div>
            </div>

            {(() => {
              const filtered = showOnlyMine && user ? listings.filter(l => l.seller_user_id === user.id) : listings;
              return filtered.length === 0 ? (
              <Card className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-4">📝</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Listings</h3>
                <p className="text-gray-600">You haven't listed any shares for sale yet.</p>
              </Card>
              ) : (
              filtered.map(listing => (
                <Card key={listing.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{listing.title}</h3>
                      <div className="text-sm text-gray-600">ID: {listing.proposal_id}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        {listing.quantity} shares
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatCurrency(parseFloat(String(listing.price_per_share)) || 0)} each
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {listing.seller_user_id && user && listing.seller_user_id === user.id ? (
                      <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Your Listing</span>
                    ) : null}
                    {listing.seller_user_id && (!user || listing.seller_user_id !== user?.id) ? (
                      <div className="text-xs text-gray-500">Seller: #{listing.seller_user_id}</div>
                    ) : null}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Value:</span>
                      <span className="font-bold">
                        {formatCurrency(listing.quantity * (parseFloat(String(listing.price_per_share)) || 0))}
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            );
          })()}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {history.length === 0 ? (
              <Card className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-4">🕒</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Sell History</h3>
                <p className="text-gray-600">You haven't sold any shares yet.</p>
              </Card>
            ) : (
              history.map(transaction => (
                <Card key={transaction.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {transaction.date ? new Date(transaction.date).toLocaleDateString() : 'Unknown Date'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {transaction.quantity} shares
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(transaction.status)}`}>
                        {transaction.status}
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Fixed Action Bar for Sell Tab */}
      {activeTab === 'sell' && itemsToSell.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm text-gray-600">Total Value</div>
              <div className="text-lg font-bold text-gray-900">{formatCurrency(totalValue)}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Shares to Sell</div>
              <div className="text-lg font-bold text-gray-900">
                {itemsToSell.reduce((sum, item) => sum + (item.qty || 0), 0)}
              </div>
            </div>
          </div>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                setHoldings(prev => prev.map(h => ({ ...h, qty: 0, inputPrice: '' })));
                show('Cleared all sell quantities', 'info');
              }}
              className="flex-1"
            >
              Clear All
            </Button>
            <Button
              onClick={doSubmit}
              isLoading={submitting}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {submitting ? 'Submitting...' : 'Sell Now'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellSharesScreen;