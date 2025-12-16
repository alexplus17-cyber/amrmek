import React, { useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/apiService';
import Card from '../components/Card';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

const MemberPortfolioScreen: React.FC<{ navigateBack: () => void }> = ({ navigateBack }) => {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<string>('name');
    const [sortAsc, setSortAsc] = useState<boolean>(true);
    const [page, setPage] = useState<number>(1);
    const [perPage, setPerPage] = useState<number>(10);
    const [total, setTotal] = useState<number>(0);
    const [summary, setSummary] = useState<any | null>(null);
    const [charts, setCharts] = useState<any | null>(null);
    const [chartsLoading, setChartsLoading] = useState(false);

    const [transactions, setTransactions] = useState<any[]>([]);
    const [txPage, setTxPage] = useState<number>(1);
    const [txPerPage, setTxPerPage] = useState<number>(10);
    const [txTotal, setTxTotal] = useState<number>(0);
    const [txLoading, setTxLoading] = useState<boolean>(false);

    useEffect(() => {
        fetchPortfolio();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, perPage, sortKey, sortAsc, search]);

    useEffect(() => {
        fetchSummary();
        fetchCharts();
        fetchTransactions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // re-fetch transactions on page/perPage change
        fetchTransactions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [txPage, txPerPage]);

    const fetchPortfolio = async () => {
        setLoading(true);
        setError(null);
        try {
            const sort_dir = sortAsc ? 'asc' : 'desc';
            const res = await apiService.getMemberPortfolio({ per_page: perPage, page, sort_key: sortKey, sort_dir, search: search || undefined });
            setItems(Array.isArray(res.items) ? res.items : (res.items || []));
            setTotal(Number(res.total || 0));
            const serverPer = Number(res.per_page || perPage);
            const serverTotalPages = serverPer > 0 ? Math.max(1, Math.ceil((Number(res.total || 0)) / serverPer)) : 1;
            if (page > serverTotalPages) setPage(serverTotalPages);
        } catch (e: any) {
            console.error('Failed to load portfolio', e);
            setError(e?.message || 'Failed to load portfolio');
        } finally {
            setLoading(false);
        }
    };

    const fetchSummary = async () => {
        try {
            const s = await apiService.getMemberPortfolio({ type: 'summary' });
            setSummary(s || null);
        } catch (e) {
            console.debug('Failed to fetch summary', e);
            setSummary(null);
        }
    };

    const fetchCharts = async () => {
        setChartsLoading(true);
        try {
            const c = await apiService.getMemberPortfolio({ type: 'charts' });
            // normalize distribution -> { name, value } and monthly_trend -> { month, value }
            if (c) {
                const normalized: any = {};
                if (Array.isArray(c.distribution)) {
                    normalized.distribution = c.distribution.map((d: any) => ({ name: d.name || d.proposal_title || (`#${d.proposal_id}`), value: Number(d.value ?? d.total_investment ?? d.total_investment_amount ?? 0) }));
                }
                if (Array.isArray(c.monthly_trend)) {
                    normalized.monthly_trend = c.monthly_trend.map((m: any) => ({ month: m.month || m.label, value: Number(m.value ?? m.monthly_investment ?? m.total_investment ?? 0) }));
                }
                setCharts(normalized);
            } else setCharts(null);
        } catch (e) {
            console.debug('Failed to fetch charts', e);
            setCharts(null);
        } finally {
            setChartsLoading(false);
        }
    };

    const fetchTransactions = async () => {
        setTxLoading(true);
        try {
            const res = await apiService.getMemberPortfolio({ type: 'transactions', page: txPage, per_page: txPerPage });
            const raw = Array.isArray(res.transactions) ? res.transactions : (res.items || res.transactions || []);
            const mapped = (raw || []).map((r: any) => ({
                id: r.id || r.transaction_id,
                date: r.purchased_at || r.date || r.created_at,
                type: r.type || 'purchase',
                proposal_name: r.proposal_title || r.name || (r.proposal_id ? `#${r.proposal_id}` : ''),
                amount: Number(r.total_amount ?? r.amount ?? r.value ?? 0),
                status: r.status || r.state || '',
            }));
            setTransactions(mapped);
            setTxTotal(Number(res.total || res.total_transactions || 0));
        } catch (e) {
            console.debug('Failed to load transactions', e);
            setTransactions([]);
            setTxTotal(0);
        } finally {
            setTxLoading(false);
        }
    };

    // When server-side paging is used, `items` already contains the current page's items.
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        let list = items.slice();
        if (q) {
            list = list.filter(i => (i.name || '').toString().toLowerCase().includes(q) || (i.category || '').toString().toLowerCase().includes(q));
        }
        return list;
    }, [items, search]);

    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const pageItems = filtered;

    const toggleSort = (key: string) => {
        if (sortKey === key) setSortAsc(!sortAsc);
        else {
            setSortKey(key);
            setSortAsc(true);
        }
        setPage(1);
    };

    const exportCsv = async () => {
        // Request all items from the server for a full export
        try {
            setLoading(true);
            const fullRes = await apiService.getMemberPortfolio({ type: 'holdings' });
            const rows = ((fullRes && (fullRes.holdings || fullRes.items)) || []).map((i: any) => ({
                id: i.id,
                name: i.name,
                category: i.category,
                shares: i.shares,
                value: i.value,
                avg_price: i.avg_price,
                ownership_percentage: i.ownership_percentage,
                date: i.date,
            }));
            const keys = Object.keys(rows[0] || {});
            const csv = [keys.join(',')].concat(rows.map(r => keys.map(k => {
                const v = (r as any)[k];
                if (v == null) return '';
                const s = String(v).replace(/"/g, '""');
                return `"${s}"`;
            }).join(','))).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'portfolio.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e: any) {
            console.error('Export failed', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="flex items-center mb-4">
                <Button onClick={navigateBack} className="im-btn im-btn-outline mr-2">Back</Button>
                <h2 className="text-lg font-semibold">My Portfolio</h2>
            </div>

            {loading ? <Spinner /> : (
                <div>
                    {error && <div className="im-alert im-alert-error">{error}</div>}

                    <div className="mb-4 flex items-center space-x-2">
                        <input className="im-input" placeholder="Search by name or category" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                        <Button onClick={() => { setSearch(''); setPage(1); }}>Clear</Button>
                        <div className="ml-4">
                            <Button onClick={() => { fetchPortfolio(); fetchSummary(); }} variant="outline">Refresh</Button>
                        </div>
                        <div className="ml-auto flex items-center space-x-2">
                            <label className="text-sm">Per page:</label>
                            <select className="im-input" aria-label="Items per page" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                            </select>
                            <Button onClick={exportCsv}>Export CSV</Button>
                        </div>
                    </div>

                    {summary && (
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
                            <Card>
                                <div className="text-sm">Total Investment</div>
                                <div className="text-xl font-bold">${Number(summary.total_investment || 0).toLocaleString()}</div>
                            </Card>
                            <Card>
                                <div className="text-sm">Total Shares</div>
                                <div className="text-xl font-bold">{Number(summary.total_shares || 0).toLocaleString()}</div>
                            </Card>
                            <Card>
                                <div className="text-sm">Active Investments</div>
                                <div className="text-xl font-bold">{Number(summary.active_investments || 0)}</div>
                            </Card>
                            <Card>
                                <div className="text-sm">Avg Ownership</div>
                                <div className="text-xl font-bold">{Number(summary.avg_ownership || 0).toFixed(2)}%</div>
                            </Card>
                        </div>
                    )}

                    {/* Performance Metrics */}
                    {summary && (
                        <Card title="Performance Metrics" className="mb-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="text-sm">Portfolio Diversity</div>
                                    <div className="text-lg font-semibold">{summary.portfolio_diversity ?? '—'}%</div>
                                </div>
                                <div>
                                    <div className="text-sm">Average Return (est.)</div>
                                    <div className="text-lg font-semibold">{summary.avg_return ?? '—'}%</div>
                                </div>
                                <div>
                                    <div className="text-sm">Risk Level</div>
                                    <div className="text-lg font-semibold">{summary.risk_level ?? '—'}</div>
                                </div>
                                <div>
                                    <div className="text-sm">Investment Horizon</div>
                                    <div className="text-lg font-semibold">{summary.investment_horizon ?? '—'}</div>
                                </div>
                            </div>
                        </Card>
                    )}

                    <Card title="Portfolio Value Chart">
                        {items.length === 0 ? <div>No data</div> : (
                            <div className="w-full h-40 sm:h-52">
                                <ResponsiveContainer>
                                    <BarChart data={filtered.slice(0, 20)}>
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#3b82f6" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </Card>

                    {/* Portfolio Analytics: distribution + monthly trend */}
                    <Card title="Portfolio Analytics" className="mt-4">
                        {chartsLoading ? <Spinner /> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="h-56">
                                    <div className="text-sm mb-2">Distribution by Holding</div>
                                    {charts && Array.isArray(charts.distribution) && charts.distribution.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={200}>
                                            <PieChart>
                                                <Pie data={charts.distribution} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} label>
                                                    {charts.distribution.map((entry: any, idx: number) => (
                                                        <Cell key={`cell-${idx}`} fill={["#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"][idx % 4]} />
                                                    ))}
                                                </Pie>
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : <div>No distribution data available.</div>}
                                </div>

                                <div className="h-56">
                                    <div className="text-sm mb-2">Monthly Trend</div>
                                    {charts && Array.isArray(charts.monthly_trend) && charts.monthly_trend.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={200}>
                                            <LineChart data={charts.monthly_trend}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="month" />
                                                <YAxis />
                                                <Tooltip />
                                                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : <div>No monthly trend data available.</div>}
                                </div>
                            </div>
                        )}
                    </Card>

                    <div className="mt-4">
                        <div className="hidden sm:block">
                            <div className="overflow-x-auto">
                                <table className="im-table w-full">
                            <thead>
                                <tr>
                                    <th onClick={() => toggleSort('name')} className="cursor-pointer">Name {sortKey==='name' ? (sortAsc ? '▲' : '▼') : ''}</th>
                                    <th onClick={() => toggleSort('category')} className="cursor-pointer">Category {sortKey==='category' ? (sortAsc ? '▲' : '▼') : ''}</th>
                                    <th onClick={() => toggleSort('shares')} className="cursor-pointer">Shares {sortKey==='shares' ? (sortAsc ? '▲' : '▼') : ''}</th>
                                    <th onClick={() => toggleSort('value')} className="cursor-pointer">Value {sortKey==='value' ? (sortAsc ? '▲' : '▼') : ''}</th>
                                    <th onClick={() => toggleSort('avg_price')} className="cursor-pointer hidden sm:table-cell">Avg Price {sortKey==='avg_price' ? (sortAsc ? '▲' : '▼') : ''}</th>
                                    <th onClick={() => toggleSort('ownership_percentage')} className="cursor-pointer hidden sm:table-cell">Ownership {sortKey==='ownership_percentage' ? (sortAsc ? '▲' : '▼') : ''}</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageItems.length === 0 ? (
                                    <tr><td colSpan={7} className="p-4">No portfolio items found.</td></tr>
                                ) : pageItems.map(item => (
                                    <tr key={item.id}>
                                        <td>{item.name}</td>
                                        <td>{item.category}</td>
                                        <td className="text-right">{item.shares}</td>
                                        <td className="text-right">{Number(item.value).toFixed(2)}</td>
                                        <td className="text-right hidden sm:table-cell">{Number(item.avg_price || 0).toFixed(2)}</td>
                                        <td className="text-right hidden sm:table-cell">{Number(item.ownership_percentage || 0).toFixed(2)}%</td>
                                        <td>
                                            <Button onClick={() => { /* future: show details */ }}>Details</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile stacked cards */}
                        <div className="sm:hidden space-y-3">
                            {pageItems.length === 0 ? <div className="p-4">No portfolio items found.</div> : pageItems.map(item => (
                                <Card key={item.id}>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="font-semibold">{item.name}</div>
                                            <div className="text-sm text-muted">{item.category}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold">${Number(item.value).toFixed(2)}</div>
                                            <div className="text-sm">{item.shares} shares</div>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <div className="text-sm">Avg: {Number(item.avg_price || 0).toFixed(2)}</div>
                                        <div className="text-sm">Own: {Number(item.ownership_percentage || 0).toFixed(2)}%</div>
                                        <Button onClick={() => { /* future: show details */ }}>Details</Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                        <div>Showing {filtered.length} items — page {page} of {totalPages}</div>
                        <div className="space-x-2">
                            <Button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</Button>
                            <Button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</Button>
                        </div>
                    </div>

                    {/* Recent Transactions */}
                    <Card title="Recent Transactions" className="mt-6">
                        {txLoading ? <Spinner /> : (
                            <div>
                                {/* Desktop/tablet view */}
                                <div className="hidden sm:block">
                                    {transactions.length === 0 ? <div className="p-4">No recent transactions.</div> : (
                                        <div className="overflow-x-auto">
                                            <table className="im-table w-full">
                                                <thead>
                                                    <tr>
                                                        <th>Date</th>
                                                        <th>Type</th>
                                                        <th>Proposal</th>
                                                        <th className="text-right">Amount</th>
                                                        <th>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {transactions.map(tx => (
                                                        <tr key={tx.id}>
                                                            <td>{tx.date}</td>
                                                            <td>{tx.type}</td>
                                                            <td>{tx.proposal_name}</td>
                                                            <td className="text-right">{Number(tx.amount || 0).toFixed(2)}</td>
                                                            <td>{tx.status}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Mobile stacked list */}
                                <div className="sm:hidden space-y-3">
                                    {transactions.length === 0 ? <div className="p-4">No recent transactions.</div> : transactions.map(tx => (
                                        <Card key={tx.id}>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-semibold">{tx.proposal_name}</div>
                                                    <div className="text-sm text-muted">{tx.type} • {tx.date}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-semibold">${Number(tx.amount || 0).toFixed(2)}</div>
                                                    <div className="text-sm">{tx.status}</div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>

                                <div className="mt-3 flex items-center justify-between">
                                    <div>Showing {transactions.length} transactions</div>
                                    <div className="space-x-2">
                                        <Button disabled={txPage <= 1} onClick={() => setTxPage(p => Math.max(1, p - 1))}>Prev</Button>
                                        <Button disabled={txPage * txPerPage >= (txTotal || 0)} onClick={() => setTxPage(p => p + 1)}>Next</Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
};

export default MemberPortfolioScreen;
