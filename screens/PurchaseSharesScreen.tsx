import React, { useEffect, useMemo, useState } from 'react';
import Card from '../components/Card';
import Spinner from '../components/Spinner';
import { apiService } from '../services/apiService';
import { Listing, Invoice } from '../types';
import PurchaseModal from '../components/PurchaseModal';
import Button from '../components/Button';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

interface CartItem {
    listing: Listing;
    quantity: number;
}

interface PurchaseSharesScreenProps {
    navigateBack: () => void;
    onPurchaseSuccess?: (invoiceId: string) => void;
}

const currencyFormatter = (amount: number, currency = 'USD') => {
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
    } catch (e) {
        return `$${amount.toFixed(2)}`;
    }
};

const getDeep = (obj: any, path: string) => {
    try {
        const parts = path.split('.');
        let cur = obj;
        for (const p of parts) {
            if (cur == null) return undefined;
            cur = cur[p];
        }
        return cur;
    } catch (e) {
        return undefined;
    }
};

const getNumber = (obj: any, keys: string[]) => {
    for (const k of keys) {
        let v: any;
        if (k.indexOf('.') !== -1) v = getDeep(obj, k);
        else v = obj && (obj[k] !== undefined ? obj[k] : undefined);
        if (v !== undefined && v !== null && v !== '') {
            // If value is a string containing currency symbols or commas, clean it first
            if (typeof v === 'string') {
                // Remove any character that's not digit, dot, or minus
                const cleaned = v.replace(/[^0-9.-]+/g, '');
                const n = Number(cleaned);
                if (!isNaN(n)) return n;
            } else {
                const n = Number(v);
                if (!isNaN(n)) return n;
            }
        }
    }
    return 0;
};

const getString = (obj: any, keys: string[]) => {
    for (const k of keys) {
        let v: any;
        if (k.indexOf('.') !== -1) v = getDeep(obj, k);
        else v = obj && (obj[k] !== undefined ? obj[k] : undefined);
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
    }
    return '';
};

/**
 * Parse available quantity from a listing's various fields (quantity, items_json, meta_json).
 * Returns a non-negative integer.
 */
const parseItemsJsonQuantity = (listing: any): number => {
    try {
        if (!listing) return 0;
        // Prefer explicit quantity fields if present
        const explicit = listing.quantity ?? listing.qty ?? listing.available ?? listing.availability;
        if (explicit !== undefined && explicit !== null && explicit !== '') {
            const n = Number(String(explicit).replace(/[^0-9.-]+/g, ''));
            if (!isNaN(n) && n > 0) return Math.floor(n);
        }

        // Check items_json (may be HTML-escaped in DB as &quot;)
        const itemsJsonRaw = listing.items_json ?? listing.itemsJson ?? listing.items ?? listing.itemsJsonRaw;
        if (itemsJsonRaw) {
            const raw = typeof itemsJsonRaw === 'string' ? itemsJsonRaw : JSON.stringify(itemsJsonRaw);
            const normalized = raw.replace(/&quot;/g, '"');
            const arr = JSON.parse(normalized);
            if (Array.isArray(arr)) {
                return arr.reduce((sum: number, it: any) => {
                    const q = Number(it?.quantity ?? it?.qty ?? 0);
                    return sum + (isNaN(q) ? 0 : Math.floor(q));
                }, 0);
            }
        }

        // Check meta_json for items
        const metaRaw = listing.meta_json ?? listing.metaJson ?? listing.meta ?? listing.meta_raw;
        if (metaRaw) {
            const raw = typeof metaRaw === 'string' ? metaRaw : JSON.stringify(metaRaw);
            const normalized = raw.replace(/&quot;/g, '"');
            const meta = JSON.parse(normalized);
            const items = meta?.items ?? meta?.items_json ?? meta?.itemsJson;
            if (Array.isArray(items)) {
                return items.reduce((sum: number, it: any) => {
                    const q = Number(it?.quantity ?? it?.qty ?? 0);
                    return sum + (isNaN(q) ? 0 : Math.floor(q));
                }, 0);
            }
        }
    } catch (e) {
        // parsing failed – fall through to zero
    }
    return 0;
};

const getAvailable = (listing: any): number => {
    // Prefer normalized server-side field when present
    const serverAvail = getNumber(listing, ['available_quantity', 'availableQuantity', 'available_qty']);
    if (serverAvail && serverAvail > 0) return serverAvail;
    const parsed = parseItemsJsonQuantity(listing);
    if (parsed && parsed > 0) return parsed;
    return getNumber(listing, ['availability', 'available', 'qty', 'quantity', 'value.available']);
};

/**
 * Determine a per-share price for a listing. Looks at top-level fields then falls back
 * to parsing items_json / meta_json for an item-level price.
 */
const getListingPrice = (listing: any): number => {
    try {
        if (!listing) return 0;
        // Prefer server-normalized unit_price if present
        const serverUnit = getNumber(listing, ['unit_price', 'unitPrice', 'unitPriceValue']);
        if (serverUnit && serverUnit > 0) return serverUnit;
        // common top-level keys
        const top = getNumber(listing, ['price_per_share', 'price', 'ask_price', 'value.price', 'unit_price']);
        if (top && top > 0) return top;

        // If items exist, use the first item's price (or average) if present
        const itemsJsonRaw = listing.items_json ?? listing.itemsJson ?? listing.items ?? listing.itemsJsonRaw;
        if (itemsJsonRaw) {
            const raw = typeof itemsJsonRaw === 'string' ? itemsJsonRaw : JSON.stringify(itemsJsonRaw);
            const normalized = raw.replace(/&quot;/g, '"');
            const arr = JSON.parse(normalized);
            if (Array.isArray(arr) && arr.length > 0) {
                // prefer explicit numeric price fields on items
                for (const it of arr) {
                    const p = Number(it?.price ?? it?.price_per_share ?? it?.unit_price ?? 0);
                    if (!isNaN(p) && p > 0) return p;
                }
                // fallback: if items have a total and quantities, compute per-item
                const total = arr.reduce((s: number, it: any) => s + (Number(it?.price ?? 0) || 0), 0);
                const qty = arr.reduce((s: number, it: any) => s + (Number(it?.quantity ?? it?.qty ?? 0) || 0), 0);
                if (qty > 0 && total > 0) return Math.round((total / qty) * 100) / 100;
            }
        }

        // meta_json
        const metaRaw = listing.meta_json ?? listing.metaJson ?? listing.meta ?? listing.meta_raw;
        if (metaRaw) {
            const raw = typeof metaRaw === 'string' ? metaRaw : JSON.stringify(metaRaw);
            const normalized = raw.replace(/&quot;/g, '"');
            const meta = JSON.parse(normalized);
            const items = meta?.items ?? meta?.items_json ?? meta?.itemsJson;
            if (Array.isArray(items) && items.length > 0) {
                for (const it of items) {
                    const p = Number(it?.price ?? it?.price_per_share ?? 0);
                    if (!isNaN(p) && p > 0) return p;
                }
                const total = items.reduce((s: number, it: any) => s + (Number(it?.price ?? 0) || 0), 0);
                const qty = items.reduce((s: number, it: any) => s + (Number(it?.quantity ?? it?.qty ?? 0) || 0), 0);
                if (qty > 0 && total > 0) return Math.round((total / qty) * 100) / 100;
            }
        }
    } catch (e) {
        // swallow parse errors
    }
    return 0;
};

const PurchaseSharesScreen: React.FC<PurchaseSharesScreenProps> = ({ navigateBack, onPurchaseSuccess }) => {
    const [listings, setListings] = useState<Listing[]>([]);
    const [proposals, setProposals] = useState<Listing[]>([]);
    const [proposalAvail, setProposalAvail] = useState<Record<number, any>>({});
    const [selectedProposals, setSelectedProposals] = useState<Record<number, number>>({});
    const [sellerNames, setSellerNames] = useState<Record<number, string>>({});
    const [secondaryListings, setSecondaryListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [onlyAvailable, setOnlyAvailable] = useState(true);
    const [sortKey, setSortKey] = useState<'price' | 'availability' | 'title'>('price');
    const [cart, setCart] = useState<Record<number, CartItem>>({});
    const [previewInvoice, setPreviewInvoice] = useState<{ lines: Array<{ title: string; qty: number; unit: number; total: number }>; subtotal: number } | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'bank'>('stripe');
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedForModal, setSelectedForModal] = useState<Listing | null>(null);
    const [showSingleModal, setShowSingleModal] = useState(false);
    const [paymentsConfig, setPaymentsConfig] = useState<any>(null);
    const { show } = useToast();
    const { user } = useAuth();
    const [lastInvoice, setLastInvoice] = useState<{ id: string; amount?: number } | null>(null);

    useEffect(() => {
        let mounted = true;
        // Fetch proposals, listings and payments config in parallel
        Promise.all([apiService.getProposals(), apiService.getListings(), apiService.getPaymentsConfig()])
            .then(async ([p, l, pc]) => {
                if (!mounted) return;
                setProposals(p || []);
                setListings(l || []);
                setPaymentsConfig(pc || {});
                // Fetch availability for each proposal (best-effort). Use admin-ajax endpoint exposed by shortcode.
                try {
                    const ids = (p || []).map((it: any) => Number(it.id)).filter((id: number) => id && id > 0);
                    const availMap: Record<number, any> = {};
                    await Promise.all(ids.map(async (id) => {
                        try {
                            const a = await apiService.getProposalAvailability(Number(id));
                            // Normalize server availability fields into consistent numeric keys
                            const norm: any = {};
                            if (a && typeof a === 'object') {
                                // Common keys we expect: total_shares, sold_shares, available_shares, share_price
                                const total = getNumber(a, ['total_shares', 'totalShares', 'total', 'value.total']);
                                const sold = getNumber(a, ['sold_shares', 'sold', 'shares_sold', 'value.sold']);
                                const avail = getNumber(a, ['available_shares', 'available', 'value.available']);
                                const sp = getNumber(a, ['share_price', 'sharePrice', 'price', 'value.share_price']);
                                norm.total_shares = total;
                                norm.sold_shares = sold;
                                norm.available_shares = avail;
                                norm.share_price = sp;
                                // Also add convenient aliases used elsewhere in the UI
                                norm.totalValue = getNumber(a, ['total_value', 'totalValue', 'total']);
                                norm.sharePrice = sp;
                                norm.available = avail;
                                norm.sold = sold;
                            }
                            availMap[id] = norm;
                        } catch (e) {
                            // ignore per-proposal failures
                        }
                    }));
                    if (mounted) setProposalAvail(availMap);
                    // Fetch secondary listings per-proposal (normalized fields)
                    try {
                        const sec: Listing[] = [];
                        await Promise.all(ids.map(async (id) => {
                            try {
                                const s = await apiService.getProposalSecondaryListings(Number(id));
                                if (Array.isArray(s) && s.length > 0) sec.push(...s as Listing[]);
                            } catch (e) {
                                // ignore per-proposal secondary listings failures
                            }
                        }));
                        if (mounted) setSecondaryListings(sec);
                        // Merge server-normalized secondary listings into the main listings array so search shows authoritative data
                        try {
                            const base = (l || []).slice();
                            const byId: Record<string, any> = {};
                            base.forEach((it: any) => { if (it && it.id !== undefined) byId[String(it.id)] = { ...it }; });
                            (sec || []).forEach((s: any) => {
                                if (!s || s.id === undefined) return;
                                const sid = String(s.id);
                                const existing = byId[sid] || {};
                                // Prefer server-normalized fields from secondary listing
                                const merged = { ...existing, ...s };
                                // Normalize price field names to match client expectations
                                merged.price = merged.price || merged.price_per_share || merged.unit_price || merged.price_per_share;
                                merged.price_per_share = merged.price_per_share || merged.unit_price || merged.price;
                                merged.seller_display_name = merged.seller_display_name || merged.sellerName || merged.seller_name || '';
                                byId[sid] = merged;
                            });
                            const mergedArray = Object.keys(byId).map(k => byId[k]);
                            if (mounted) setListings(mergedArray as Listing[]);
                        } catch (e) {
                            // ignore merge errors
                        }
                    } catch (e) {
                        // ignore
                    }
                } catch (e) {
                    // ignore
                }

                // Build seller name map from server-provided fields to avoid extra REST calls.
                // For any seller IDs that don't have a name on the listing, batch-fetch profiles.
                try {
                    const combinedArr = [ ...(l || []), ...(sec || []) ];
                    const map: Record<number, string> = {};
                    const ids = new Set<number>();
                    combinedArr.forEach((it: any) => {
                        const sid = Number(it?.seller_user_id || it?.seller_id || 0);
                        if (!sid) return;
                        ids.add(sid);
                        if (!map[sid]) {
                            const candidate = String(it?.seller_display_name || it?.sellerName || it?.seller_name || '').trim();
                            if (candidate) map[sid] = candidate;
                        }
                    });

                    // Determine which seller IDs we still need to resolve via API
                    const missing: number[] = [];
                    ids.forEach((id) => { if (!map[id]) missing.push(id); });

                    // If we have missing IDs, fetch their profiles in parallel (batched).
                    if (missing.length > 0) {
                        try {
                            const profiles = await Promise.all(missing.map(async (id) => {
                                try {
                                    const p = await apiService.getUserProfile(id);
                                    return { id, name: String(p?.display_name || p?.displayName || p?.name || p?.nicename || id) };
                                } catch (e) {
                                    return { id, name: String(id) };
                                }
                            }));
                            profiles.forEach(pr => { if (pr && pr.id) map[pr.id] = pr.name; });
                        } catch (e) {
                            // ignore profile fetch failures
                        }
                    }

                    if (mounted) setSellerNames(map);
                } catch (e) {
                    // ignore seller name build failures
                }
            })
            .catch(e => console.error('Failed to load purchase page data', e))
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, []);

    const filtered = useMemo(() => {
        let out = listings.slice();
        if (search) {
            const q = search.toLowerCase();
            out = out.filter(l => (l.title || '').toLowerCase().includes(q) || (l.summary || '').toLowerCase().includes(q));
        }
        if (onlyAvailable) {
            out = out.filter(l => getAvailable(l) > 0);
        }
        out.sort((a, b) => {
            if (sortKey === 'price') return getListingPrice(a) - getListingPrice(b);
            if (sortKey === 'availability') return getAvailable(b) - getAvailable(a);
            return String(a.title || '').localeCompare(String(b.title || ''));
        });
        return out;
    }, [listings, search, onlyAvailable, sortKey]);

    // Secondary market source: prefer server-provided secondaryListings but only include
    // items that are actually for sale (available > 0). Fall back to listings with seller info.
    const secondarySource = useMemo(() => {
        const fromSec = (secondaryListings && secondaryListings.length > 0)
            ? (secondaryListings || []).filter(s => getNumber(s, ['available_quantity', 'availableQuantity', 'available', 'quantity']) > 0)
            : [];
        // Dedupe by listing id in case we fetched per-proposal and got duplicates
        if (fromSec.length > 0) {
            const byId: Record<string, any> = {};
            fromSec.forEach((s: any) => { if (s && s.id !== undefined) byId[String(s.id)] = s; });
            return Object.keys(byId).map(k => byId[k]);
        }
        // Fallback: use general listings with seller info
        const fallback = (listings || []).filter(l => (l.seller_user_id || l.seller_id || l.seller) && getAvailable(l) > 0);
        const byId2: Record<string, any> = {};
        fallback.forEach((s: any) => { if (s && s.id !== undefined) byId2[String(s.id)] = s; });
        return Object.keys(byId2).map(k => byId2[k]);
    }, [secondaryListings, listings]);

    const cartItems = useMemo(() => Object.values(cart), [cart]);
    const subtotal = useMemo(() => cartItems.reduce((s, it) => s + (getListingPrice(it.listing) * it.quantity), 0), [cartItems]);

    const updateQty = (listing: Listing, qty: number) => {
        setCart(prev => {
            const copy = { ...prev };
            if (!qty || qty <= 0) {
                delete copy[Number(listing.id)];
            } else {
                copy[Number(listing.id)] = { listing, quantity: qty };
            }
            return copy;
        });
    };

    const addToCart = (listing: Listing, qty = 1) => updateQty(listing, (cart[Number(listing.id)]?.quantity || 0) + qty);

    const handlePreview = () => {
        const lines = cartItems.map(ci => {
            const unit = getNumber(ci.listing, ['price', 'ask_price']);
            return { title: ci.listing.title, qty: ci.quantity, unit, total: unit * ci.quantity };
        });
        setPreviewInvoice({ lines, subtotal: lines.reduce((s, l) => s + l.total, 0) });
    };

    const handleCheckout = async () => {
        if (cartItems.length === 0) return;
        setIsProcessing(true);
        try {
            const createdInvoices: any[] = [];
            // For each cart item, record purchase on server. This mirrors web behavior where each line may create invoices/records.
            for (const item of cartItems) {
                if (paymentMethod === 'stripe') {
                    // Create a payment intent per item and simulate confirmation (PurchaseModal does confirmation flow for single items)
                    const { clientSecret } = await apiService.createStripeIntent(Number(item.listing.id), item.quantity);
                    // Simulate confirmation step (Stripe.js would confirm the intent in a real app)
                    await new Promise(r => setTimeout(r, 600));
                    const paymentPayload = { paymentIntentId: String(clientSecret || '').split('_secret_')[0] };
                    // If the listing has a client-side price (e.g. proposals), include it so server can honor it
                    const clientUnit = getNumber(item.listing, ['price', 'ask_price']) || getListingPrice(item.listing);
                    if (clientUnit && clientUnit > 0) paymentPayload.unit_price = clientUnit;
                    // Include proposal_id so server-side fallbacks can locate an available listing
                    try {
                        const pid = Number(item.listing?.proposal_id || item.listing?.proposalId || item.listing?.proposal || 0);
                        console.log('Extracted pid for stripe:', pid, 'from listing:', item.listing);
                        if (pid && pid > 0) paymentPayload.proposal_id = pid;
                    } catch (e) {}
                    const res = await apiService.recordPurchase(Number(item.listing.id), item.quantity, 'stripe', paymentPayload);
                    if ((res as any).newInvoice) createdInvoices.push((res as any).newInvoice);
                    else createdInvoices.push(res);
                } else {
                    const clientUnit = getNumber(item.listing, ['price', 'ask_price']) || getListingPrice(item.listing);
                    const paymentPayload = clientUnit && clientUnit > 0 ? { unit_price: clientUnit } : {};
                    try {
                        const pid = Number(item.listing?.proposal_id || item.listing?.proposalId || item.listing?.proposal || 0);
                        console.log('Extracted pid for bank:', pid, 'from listing:', item.listing);
                        if (pid && pid > 0) (paymentPayload as any).proposal_id = pid;
                    } catch (e) {}
                    const res = await apiService.recordPurchase(Number(item.listing.id), item.quantity, 'bank', paymentPayload);
                    if ((res as any).newInvoice) createdInvoices.push((res as any).newInvoice);
                    else createdInvoices.push(res);
                }
            }

            // Clear cart
            setCart({});

            // If invoices were created, navigate user to payments/invoices view and show toast/link
            if (createdInvoices.length > 0) {
                const first = createdInvoices[0];
                const invoiceId = String((first && (first.id || first.invoice_id || first.invoice || first.number)) || '');
                const invoiceAmount = (first && (first.amount || first.total_amount || first.total)) ? Number(first.amount || first.total_amount || first.total) : undefined;
                // Show success toast
                try { show(`Invoice #${invoiceId} created`, 'success'); } catch (e) { /* ignore if toast unavailable */ }
                setLastInvoice({ id: invoiceId, amount: invoiceAmount });
                // Let parent handle navigation if provided, otherwise navigate back
                if (onPurchaseSuccess) onPurchaseSuccess(invoiceId);
                else navigateBack();
            } else {
                navigateBack();
            }
        } catch (e: any) {
            console.error('Checkout failed', e);
            alert((e && (e.message || e)) || 'Purchase failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSingleSuccess = (newInvoice: Invoice) => {
        setShowSingleModal(false);
        setSelectedForModal(null);
        const invoiceId = String((newInvoice as any).id || (newInvoice as any).invoice_id || '');
        try { show(`Invoice #${invoiceId} created`, 'success'); } catch (e) {}
        setLastInvoice({ id: invoiceId, amount: Number((newInvoice as any).amount || (newInvoice as any).total || 0) });
        if (onPurchaseSuccess) onPurchaseSuccess(invoiceId);
        else navigateBack();
    };

    if (loading) return <Spinner />;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Purchase Shares</h1>
                <div>
                    <Button variant="secondary" onClick={navigateBack}>Back</Button>
                </div>
            </div>

            <div className="space-y-4">
                <Card>
                    <h3 className="font-semibold mb-3">Select Investment Proposal</h3>
                    <div className="mb-2" />
                    <div className="text-sm text-secondary-600 mb-2">Select Investment Proposal</div>
                    <div className="mb-3">
                        <Button variant="outline" onClick={() => {
                            if (!user) {
                                try { show('Please log in to add items to cart', 'error'); } catch (e) {}
                                return;
                            }
                            // Bulk add selected proposals to cart using selectedProposals map
                            const ids = Object.keys(selectedProposals).map(k => Number(k));
                            ids.forEach(id => {
                                const qty = Number(selectedProposals[id] || 0);
                                if (!qty || qty <= 0) return;
                                const p = proposals.find(x => Number(x.id) === id);
                                if (p) addToCart(p, qty);
                            });
                            // clear selections after adding
                            setSelectedProposals({});
                        }} disabled={Object.keys(selectedProposals).length === 0}>Add Selected to Cart</Button>
                    </div>
                    <div className="overflow-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-sm text-secondary-500">
                                    <th className="py-2">Select</th>
                                    <th className="py-2">Proposal</th>
                                    <th className="py-2">Total Value</th>
                                    <th className="py-2">Share Price</th>
                                    <th className="py-2">Sold</th>
                                    <th className="py-2">Available</th>
                                    <th className="py-2">Qty</th>
                                    <th className="py-2">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {proposals.map(p => {
                                    // Prefer authoritative availability data returned by the server availability endpoint
                                    const availData = proposalAvail[Number(p.id)] || {};
                                    const totalVal = getNumber(availData, ['total_value', 'totalValue', 'total', 'value.total', 'value.amount']) || getNumber(p, ['total_value', 'totalValue', 'total', 'investment_amount']);
                                    let sharePrice = getNumber(availData, ['share_price', 'sharePrice', 'price', 'value.share_price']) || getNumber(p, ['price', 'share_price', 'sharePrice', 'value.share_price', 'value.price', 'share_price']);
                                    // Fallback: if share price not provided, derive from investment_amount / total_shares (assume 1000 shares default)
                                    if (!sharePrice || sharePrice === 0) {
                                        const invest = getNumber(p, ['investment_amount', 'investmentAmount', 'value.investment_amount']);
                                        const totalShares = getNumber(p, ['total_shares', 'totalShares', 'total_shares', 'value.total_shares']) || 1000;
                                        if (invest && totalShares) sharePrice = Math.round((invest / totalShares) * 100) / 100;
                                    }
                                    const sold = getNumber(availData, ['sold_shares', 'sold', 'shares_sold', 'value.sold']) || getNumber(p, ['sold', 'shares_sold', 'sold_shares', 'sold_count', 'value.sold']);
                                    const available = getNumber(availData, ['available_shares', 'available', 'value.available', 'available_shares']) || getNumber(p, ['available', 'availability', 'available_shares', 'total_shares', 'value.available', 'available_shares']);
                                    const title = getString(p, ['proposal_title', 'title', 'name']) || (`Proposal ${String(p.id)}`);
                                    return (
                                    <tr key={p.id} className="border-t">
                                        <td className="py-2 align-top">
                                            <input type="checkbox" aria-label={`Select proposal ${title}`} checked={Boolean(selectedProposals[Number(p.id)])} onChange={(e) => {
                                                setSelectedProposals(prev => {
                                                    const copy = { ...prev };
                                                    if (e.target.checked) {
                                                        copy[Number(p.id)] = copy[Number(p.id)] || 1;
                                                    } else {
                                                        delete copy[Number(p.id)];
                                                    }
                                                    return copy;
                                                });
                                            }} />
                                        </td>
                                        <td className="py-2 align-top">{title}</td>
                                        <td className="py-2">{currencyFormatter(totalVal, paymentsConfig?.currency || 'USD')}</td>
                                        <td className="py-2">{currencyFormatter(sharePrice, paymentsConfig?.currency || 'USD')}</td>
                                        <td className="py-2">{sold}</td>
                                        <td className="py-2">{available}</td>
                                        <td className="py-2">
                                            <input aria-label={`Quantity for proposal ${title}`} type="number" min={0} max={available} value={selectedProposals[Number(p.id)] || ''} onChange={(e) => {
                                                const v = Number(e.target.value || 0);
                                                // clamp to available
                                                const clamped = Math.max(0, Math.min(v, available || 0));
                                                setSelectedProposals(prev => ({ ...prev, [Number(p.id)]: clamped }));
                                            }} className="im-input w-24" />
                                        </td>
                                        <td className="py-2"><Button onClick={() => {
                                            if (!user) { try { show('Please log in to add items to cart', 'error'); } catch (e) {} ; return; }
                                            const qty = Number(selectedProposals[Number(p.id)] || 1);
                                            if (!available || available <= 0) return alert('No shares available for this proposal');
                                            const safeQty = Math.max(1, Math.min(qty, available));
                                            addToCart({ ...(p as any), price: sharePrice } as Listing, safeQty);
                                            // if the proposal was selected, clear that selection
                                            setSelectedProposals(prev => { const c = { ...prev }; delete c[Number(p.id)]; return c; });
                                        }} disabled={!available || available <= 0}>Add to Cart</Button></td>
                                    </tr>
                                )})}
                                {proposals.length === 0 && (
                                    <tr><td colSpan={8} className="py-4 text-sm text-secondary-500">No proposals available.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <Card>
                    <h3 className="font-semibold mb-2">Secondary Market - Shares for Sale</h3>
                    {/* Prefer server-provided secondaryListings; fall back to listings with seller_user_id */}
                    <div className="text-sm text-secondary-500 mb-3">{secondarySource.length} share listings</div>
                    <div className="overflow-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-sm text-secondary-500">
                                    <th className="py-2">Proposal</th>
                                    <th className="py-2">Seller</th>
                                    <th className="py-2">Available Qty</th>
                                    <th className="py-2">Price per Share</th>
                                    <th className="py-2">Action</th>
                                </tr>
                            </thead>
                                    <tbody>
                                        {secondarySource.map(l => {
                                            const title = getString(l, ['proposal_title', 'title', 'name']);
                                            const avail = getNumber(l, ['available_quantity', 'availableQuantity', 'available', 'quantity']) || getAvailable(l);
                                            const price = getListingPrice(l);
                                            const sellerId = Number(l.seller_user_id || l.seller_id || l.seller || 0);
                                            return (
                                            <tr key={String(l.id) + '_' + String(sellerId)} className="border-t">
                                                <td className="py-2">{title}</td>
                                                    <td className="py-2">
                                                        <div className="flex items-center space-x-2">
                                                            { (l as any).seller_avatar_url ? (
                                                                <img src={(l as any).seller_avatar_url} alt={String(sellerId)} className="w-8 h-8 rounded-full object-cover" />
                                                            ) : null }
                                                            <span>{ (l as any).seller_display_name || sellerNames[sellerId] || String(sellerId || '') }</span>
                                                        </div>
                                                    </td>
                                                <td className="py-2">{avail}</td>
                                                <td className="py-2">{currencyFormatter(price, paymentsConfig?.currency || 'USD')}</td>
                                                <td className="py-2"><Button onClick={() => {
                                                    if (!user) { try { show('Please log in to add items to cart', 'error'); } catch (e) {} ; return; }
                                                    // Normalize listing shape for cart and add one unit
                                                    const cartListing = { ...(l as any) } as any;
                                                    cartListing.price = price || getListingPrice(l);
                                                    cartListing.availability = avail || getAvailable(l);
                                                    cartListing.title = title || cartListing.title || `Listing ${cartListing.id}`;
                                                    addToCart(cartListing, 1);
                                                }}>Add to Cart</Button></td>
                                            </tr>
                                        )})}
                                {secondarySource.length === 0 && (
                                    <tr><td colSpan={5} className="py-4 text-sm text-secondary-500">No secondary market listings.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <Card className="p-4">
                        <div className="flex items-center space-x-3 mb-3">
                            <input aria-label="Search listings" placeholder="Search listings" value={search} onChange={(e) => setSearch(e.target.value)} className="im-input flex-1" />
                            <label className="flex items-center space-x-2"><input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} /> <span>Only available</span></label>
                            <label className="sr-only" htmlFor="ps-sort">Sort listings</label>
                            <select id="ps-sort" value={sortKey} onChange={(e) => setSortKey((e.target.value as any))} className="im-select">
                                <option value="price">Sort by price</option>
                                <option value="availability">Sort by availability</option>
                                <option value="title">Sort by title</option>
                            </select>
                        </div>

                        {filtered.length === 0 && <div className="p-4">No listings match your search.</div>}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(() => {
                                const seen = new Set<number>();
                                return (filtered || []).filter(l => l && (l.seller_user_id || l.seller_id || l.seller)).filter(l => {
                                    const pid = Number(l.proposal_id || l.proposal || l.id || 0);
                                    if (!pid) return true;
                                    if (seen.has(pid)) return false;
                                    seen.add(pid);
                                    return true;
                                });
                            })().map(listing => (
                                <Card key={listing.id} className="p-3">
                                    <div className="flex space-x-3">
                                        <img src={listing.image} alt={listing.title} className="w-20 h-20 object-cover rounded" />
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-semibold flex items-center space-x-2"><span>{listing.title}</span></h3>
                                                    <div className="text-sm text-secondary-500 mt-1 flex items-center space-x-2">
                                                        { (listing as any).seller_avatar_url ? (
                                                            <img src={(listing as any).seller_avatar_url} alt={String((listing as any).seller_user_id)} className="w-6 h-6 rounded-full object-cover" />
                                                        ) : null }
                                                        <span>{ (listing as any).seller_display_name || sellerNames[Number(listing.seller_user_id || listing.seller_id || 0)] || '' }</span>
                                                    </div>
                                                    <div className="text-sm text-secondary-500">{listing.summary}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-bold text-primary-600">{currencyFormatter(getListingPrice(listing), (listing as any).currency || paymentsConfig?.currency || 'USD')}</div>
                                                    <div className="text-sm text-secondary-500">{getAvailable(listing)} available</div>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex items-center space-x-2">
                                                <input aria-label={`Quantity for ${listing.title}`} type="number" min={0} max={getAvailable(listing)} value={cart[Number(listing.id)]?.quantity || ''} onChange={(e) => updateQty(listing, Number(e.target.value || 0))} className="im-input w-24" />
                                                <Button onClick={() => addToCart(listing, 1)} variant="outline">Add</Button>
                                                <Button onClick={() => { setSelectedForModal(listing); setShowSingleModal(true); }} variant="secondary">Quick Buy</Button>
                                                <Button variant="link" onClick={() => window.location.href = `/word/listings/${listing.id}`}>Details</Button>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </Card>
                </div>

                <aside className="space-y-4">
                    <Card>
                        <h4 className="font-semibold mb-2">Your Cart</h4>
                        {cartItems.length === 0 && <div className="text-sm text-secondary-500">No items in cart.</div>}
                        {cartItems.map(ci => (
                            <div key={ci.listing.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                                <div>
                                    <div className="font-medium">{ci.listing.title}</div>
                                    <div className="text-sm text-secondary-500">{ci.quantity} × {currencyFormatter(getNumber(ci.listing, ['price', 'ask_price']), paymentsConfig?.currency || 'USD')}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-semibold">{currencyFormatter(getNumber(ci.listing, ['price', 'ask_price']) * ci.quantity, paymentsConfig?.currency || 'USD')}</div>
                                    <div className="mt-2 flex space-x-2">
                                        <Button onClick={() => updateQty(ci.listing, ci.quantity - 1)} variant="outline">−</Button>
                                        <Button onClick={() => updateQty(ci.listing, ci.quantity + 1)}>+</Button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="mt-3">
                            <div className="flex justify-between"><span>Subtotal</span><strong>{currencyFormatter(subtotal, paymentsConfig?.currency || 'USD')}</strong></div>
                        </div>

                        <div className="mt-3">
                            <label className="block text-sm font-medium">Payment Method</label>
                            <div className="mt-2 flex space-x-2">
                                <button onClick={() => setPaymentMethod('stripe')} className={`p-2 rounded border ${paymentMethod === 'stripe' ? 'border-primary-500 bg-primary-50' : 'border-secondary-300'}`}>Card (Stripe)</button>
                                <button onClick={() => setPaymentMethod('bank')} className={`p-2 rounded border ${paymentMethod === 'bank' ? 'border-primary-500 bg-primary-50' : 'border-secondary-300'}`}>Bank Transfer</button>
                            </div>
                        </div>

                        <div className="mt-4 space-y-2">
                            <Button onClick={handlePreview} disabled={cartItems.length === 0}>Preview Invoice</Button>
                            <Button onClick={handleCheckout} isLoading={isProcessing} variant="primary" disabled={cartItems.length === 0}>{paymentMethod === 'bank' ? 'Request Invoice' : 'Pay with Card'}</Button>
                        </div>
                    </Card>

                    {lastInvoice && (
                        <Card>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-secondary-600">Invoice created</div>
                                    <div className="font-semibold">#{lastInvoice.id} {lastInvoice.amount ? <span className="text-sm text-secondary-500">— {currencyFormatter(lastInvoice.amount, paymentsConfig?.currency || 'USD')}</span> : null}</div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Button variant="link" onClick={() => {
                                        // Prefer parent navigation handler if provided
                                        if (onPurchaseSuccess) onPurchaseSuccess(lastInvoice.id);
                                        else window.location.href = `/word/payments/invoices/${lastInvoice.id}`;
                                    }}>View Invoice</Button>
                                    <Button variant="outline" onClick={() => setLastInvoice(null)}>Dismiss</Button>
                                </div>
                            </div>
                        </Card>
                    )}

                    <Card>
                        <h4 className="font-semibold">Bank Transfer Instructions</h4>
                        <div className="text-sm text-secondary-600 mt-2">
                            <p>After requesting an invoice, please transfer the total amount to the account below and include your invoice number in the reference.</p>
                            <p className="mt-2 font-medium">Account name: Investor Network</p>
                            <p>Account number: 000-111222-33</p>
                            <p>Bank: Example Bank</p>
                            <p className="mt-2">Currency: {paymentsConfig?.currency || 'USD'}</p>
                        </div>
                    </Card>
                </aside>
            </div>

            </div>

            {previewInvoice && (
                <Card>
                    <h3 className="font-semibold mb-2">Invoice Preview</h3>
                    <div className="space-y-2">
                        {previewInvoice.lines.map((l, idx) => (
                            <div key={idx} className="flex justify-between">
                                <div>{l.qty} × {l.title}</div>
                                <div>{currencyFormatter(l.total, paymentsConfig?.currency || 'USD')}</div>
                            </div>
                        ))}
                        <div className="flex justify-between font-semibold mt-2"><div>Total</div><div>{currencyFormatter(previewInvoice.subtotal, paymentsConfig?.currency || 'USD')}</div></div>
                    </div>
                </Card>
            )}

            {showSingleModal && selectedForModal && (
                <PurchaseModal
                    listing={selectedForModal}
                    onClose={() => { setShowSingleModal(false); setSelectedForModal(null); }}
                    onSuccess={handleSingleSuccess}
                />
            )}
        </div>
    );
};

export default PurchaseSharesScreen;
