import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Spinner from '../components/Spinner';
import { apiService } from '../services/apiService';
import { Listing } from '../types';
import { ResponsiveContainer, LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const CalculatorScreen: React.FC = () => {
    const [proposals, setProposals] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);
    const [shares, setShares] = useState<number>(100);
    const [proposalData, setProposalData] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        apiService.getProposals()
            .then(list => {
                if (!mounted) return;
                setProposals(list || []);
                if (list && list.length && selectedProposalId === null) {
                    setSelectedProposalId(list[0].id);
                }
            })
            .catch(() => setError('Failed to load proposals.'))
            .finally(() => mounted && setLoading(false));
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        if (!selectedProposalId) return;
        setProposalData(null);
        setError(null);
        try { (window as any).__lastProposalRequestedId = selectedProposalId; } catch (e) { /* ignore */ }

        console.log('Calculator: fetching proposal', selectedProposalId);
        apiService.getProposalDetails(selectedProposalId)
            .then(data => {
            console.log('Calculator: fetched proposal data', data);
                try { (window as any).__lastProposalRaw = data; } catch (e) { /* ignore */ }
                // REST route returns the proposal object directly; admin-ajax returns { share_price, expected_roi, ... }
                // Normalize to expected calculator shape when needed. Only treat the response as
                // already calculator-shaped when it contains `share_price`. REST responses include
                // `investment_amount` and `expected_roi` but not `share_price`, so compute it here.
                if (data && (data.share_price !== undefined && data.share_price !== null)) {
                    setProposalData(data);
                } else if (data && data.id) {
                    // REST proposal object: compute share_price and expose other fields
                    const investment_amount = Number((data as any).investment_amount || 0);
                    const expected_roi = Number((data as any).expected_roi || 0);
                    const total_shares = 1000;
                    const share_price = total_shares ? investment_amount / total_shares : 0;
                    const normalized = {
                        investment_amount,
                        expected_roi,
                        share_price,
                        total_shares,
                        timeline: (data as any).timeline,
                        title: (data as any).title,
                        category: (data as any).category,
                        risk_level: (data as any).risk_level,
                    };
                    try { (window as any).__lastProposalNormalized = normalized; } catch (e) { /* ignore */ }
                    setProposalData(normalized);
                } else {
                    setProposalData(null);
                }
            })
            .catch(err => {
                console.error('Calculator: proposal fetch error', err);
                try { (window as any).__lastProposalError = String(err); } catch (e) { /* ignore */ }
                setError(String(err));
            });
    }, [selectedProposalId]);

    // Fallback: if proposalData not set after a short delay, attempt a direct fetch
    useEffect(() => {
        if (!selectedProposalId) return;
        const t = setTimeout(async () => {
            if (proposalData) return;
            try {
                const res = await fetch(`/word/wp-json/investor-network/v1/proposals/${selectedProposalId}`);
                if (!res.ok) return;
                const data = await res.json();
                const investment_amount = Number((data as any).investment_amount || 0);
                const expected_roi = Number((data as any).expected_roi || 0);
                const total_shares = 1000;
                const share_price = total_shares ? investment_amount / total_shares : 0;
                const normalized = {
                    investment_amount,
                    expected_roi,
                    share_price,
                    total_shares,
                    timeline: (data as any).timeline,
                    title: (data as any).title,
                    category: (data as any).category,
                    risk_level: (data as any).risk_level,
                };
                try { (window as any).__lastProposalNormalized = normalized; } catch (e) { /* ignore */ }
                setProposalData(normalized);
            } catch (e) {
                // ignore fallback errors
            }
        }, 800);
        return () => clearTimeout(t);
    }, [selectedProposalId, proposalData]);

    if (loading) return <Spinner />;
    if (error) return <p className="text-red-500">{error}</p>;

    const sharePrice = proposalData ? (Number(proposalData.share_price) || 0) : 0;
    const totalInvestment = sharePrice * shares;
    const expectedRoi = proposalData ? (Number(proposalData.expected_roi) || 0) : 0;
    const potentialReturn = totalInvestment * (1 + expectedRoi / 100);
    const netProfit = potentialReturn - totalInvestment;

    // Build chart data across the proposal timeline (linear growth approximation)
    // Parse timeline robustly: allow values like "5+ years" by extracting leading number.
    const timelineYears = ((): number => {
        if (!proposalData || !proposalData.timeline) return 5;
        const raw = String(proposalData.timeline);
        const m = raw.match(/(\d+)/);
        const n = m ? parseInt(m[1], 10) : NaN;
        return Number.isFinite(n) ? n : 5;
    })();
    const chartData = Array.from({ length: Math.max(2, timelineYears + 1) }).map((_, i) => {
        const year = i; // 0..timelineYears
        const growthFactor = 1 + (expectedRoi / 100) * (year / Math.max(1, timelineYears));
        const value = totalInvestment * growthFactor;
        return { year: String(year), value };
    });

    // Expose chart data for automated tests / debugging
    try {
        // @ts-ignore
        (window as any).__lastChartData = chartData;
    } catch (e) {
        // ignore in environments where window isn't available
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Investment Calculator</h1>

            <Card title="Select Proposal">
                <div className="space-y-3">
                    <label htmlFor="calculator-proposal-select" className="sr-only">Select proposal</label>
                    <select
                        id="calculator-proposal-select"
                        aria-label="Select proposal"
                        value={selectedProposalId ?? ''}
                        onChange={e => setSelectedProposalId(Number(e.target.value))}
                        className="w-full p-2 border rounded"
                    >
                        {proposals.map(p => (
                            <option key={p.id} value={p.id}>{p.title} — ${p.price?.toLocaleString?.() ?? ''}</option>
                        ))}
                    </select>
                </div>
            </Card>

            <Card title="Your Investment">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Number of shares</label>
                        <label htmlFor="calculator-shares-slider" className="sr-only">Number of shares</label>
                        <input id="calculator-shares-slider" aria-label="Number of shares" type="range" min={1} max={1000} value={shares} onChange={e => setShares(Number(e.target.value))} className="w-full" />
                        <Input id="shares" label="Shares" type="number" value={String(shares)} onChange={e => setShares(Number(e.target.value))} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-secondary-50 rounded">
                            <div className="text-sm text-secondary-500">Share Price</div>
                            <div className="text-xl font-semibold">${sharePrice.toFixed(2)}</div>
                        </div>
                        <div className="p-4 bg-secondary-50 rounded">
                            <div className="text-sm text-secondary-500">Your Investment</div>
                            <div className="text-xl font-semibold">${totalInvestment.toFixed(2)}</div>
                        </div>
                        <div className="p-4 bg-secondary-50 rounded">
                            <div className="text-sm text-secondary-500">Expected ROI</div>
                            <div className="text-xl font-semibold">{expectedRoi}%</div>
                        </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-secondary-900 rounded">
                        <div className="text-sm text-secondary-500">Potential Return</div>
                        <div className="text-2xl font-bold">${potentialReturn.toFixed(2)}</div>
                        <div className="text-sm text-secondary-500">Net Profit: ${netProfit.toFixed(2)}</div>
                    </div>

                    <div>
                        <Button onClick={() => { /* placeholder for advanced actions like save/share */ }} variant="primary">Save Estimate</Button>
                    </div>
                </div>
            </Card>

            {proposalData && (
                <>
                <Card title="Growth Chart">
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.08} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottomRight', offset: -5 }} />
                                <YAxis />
                                <Tooltip formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Value']} />
                                <Area type="monotone" dataKey="value" stroke="#4F46E5" fillOpacity={1} fill="url(#colorValue)" />
                                <Line type="monotone" dataKey="value" stroke="#3730A3" strokeWidth={2} dot={{ r: 4, stroke: '#ffffff', strokeWidth: 2, fill: '#4338CA' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card title="Proposal Summary">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <div className="text-sm text-secondary-500">Proposal</div>
                            <div className="text-lg font-semibold">{proposalData.title || 'Untitled'}</div>
                            <div className="text-sm text-secondary-500 mt-2">Category: <span className="font-medium">{proposalData.category || '—'}</span></div>
                            <div className="text-sm text-secondary-500">Risk level: <span className="font-medium">{proposalData.risk_level || '—'}</span></div>
                        </div>
                        <div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="text-sm text-secondary-500">Total Investment</div>
                                <div className="text-right font-medium">${Number(proposalData.investment_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>

                                <div className="text-sm text-secondary-500">Total Shares</div>
                                <div className="text-right font-medium">{Number(proposalData.total_shares || 0).toLocaleString()}</div>

                                <div className="text-sm text-secondary-500">Share Price</div>
                                <div className="text-right font-medium">${Number(proposalData.share_price || 0).toFixed(2)}</div>

                                <div className="text-sm text-secondary-500">Expected ROI</div>
                                <div className="text-right font-medium">{Number(proposalData.expected_roi || 0).toFixed(2)}%</div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 text-sm text-secondary-600">
                        Timeline: <span className="font-medium">{proposalData.timeline || 'N/A'}</span>
                    </div>
                </Card>
                </>
            )}
            {proposalData && (
                <Card title="📈 Investment Summary">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-secondary-50 rounded">
                                <div className="text-sm text-secondary-500">📈 Investment Summary</div>
                                <div className="mt-2 grid grid-cols-1 gap-2">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm">🏁 Initial Value</div>
                                        <div className="font-semibold">${totalInvestment.toFixed(2)}</div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm">🎯 Potential Return</div>
                                        <div className="font-semibold">${potentialReturn.toFixed(2)}</div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm">💹 Net Profit</div>
                                        <div className="font-semibold">${netProfit.toFixed(2)}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-secondary-50 rounded">
                                <div className="text-sm text-secondary-500">Share Price:</div>
                                <div className="text-lg font-semibold">${sharePrice.toFixed(2)}</div>
                                <div className="text-sm text-secondary-500 mt-3">Your Investment:</div>
                                <div className="text-lg font-semibold">${totalInvestment.toFixed(2)}</div>
                                <div className="text-sm text-secondary-500 mt-3">Expected ROI:</div>
                                <div className="text-lg font-semibold">{Number(expectedRoi).toFixed(2)}%</div>
                            </div>
                        </div>

                        <div className="p-4 bg-white dark:bg-secondary-900 rounded">
                            <div className="text-sm text-secondary-500">📊 Investment Growth Visualization</div>
                            <div className="flex items-center space-x-4 mt-3">
                                <div className="flex items-center space-x-2"><span className="w-3 h-3 bg-primary-600 rounded-sm inline-block"></span><span className="text-sm">Initial Investment</span></div>
                                <div className="flex items-center space-x-2"><span className="w-3 h-3 bg-indigo-700 rounded-sm inline-block"></span><span className="text-sm">Potential Return</span></div>
                            </div>
                        </div>

                        <div className="p-4 bg-secondary-50 rounded">
                            <div className="text-sm text-secondary-500">🔍 Detailed Analysis</div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <div className="text-sm text-secondary-500">Risk Profile</div>
                                <div className="font-medium">{(proposalData.risk_level || 'N/A').toString()}</div>

                                <div className="text-sm text-secondary-500">Investment Timeline</div>
                                <div className="font-medium">{proposalData.timeline || (timelineYears + '+ years')}</div>

                                <div className="text-sm text-secondary-500">Category</div>
                                <div className="font-medium">🏷️ {proposalData.category || '—'}</div>
                            </div>
                        </div>

                        <div className="p-4 bg-white dark:bg-secondary-900 rounded">
                            <div className="text-sm text-secondary-500">📋 Executive Summary</div>
                            <div className="mt-2 text-sm text-secondary-700">
                                Based on your investment of <span className="font-medium">{shares} shares</span>, your initial investment of <span className="font-medium">${totalInvestment.toFixed(2)}</span> has the potential to grow to <span className="font-medium">${potentialReturn.toFixed(2)}</span> over the project timeline. This represents a net profit of <span className="font-medium">${netProfit.toFixed(2)}</span> ({Number(expectedRoi).toFixed(2)}% return). The expected {Number(expectedRoi).toFixed(2)}% ROI indicates growth potential for this <span className="font-medium">{proposalData.category || 'opportunity'}</span>.
                            </div>
                        </div>
                    </div>
                </Card>
            )}
            {/* Debug artifact for automated tests: JSON of the loaded proposal data */}
            <pre id="calculator-debug" className="hidden">{JSON.stringify(proposalData)}</pre>
        </div>
    );
};

export default CalculatorScreen;
