import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import { apiService } from '../services/apiService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Spinner from '../components/Spinner';
import Button from '../components/Button';

const formatMoney = (v: number) => '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const LedgerScreen: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [lines, setLines] = useState<any[]>([]);
    const [chart, setChart] = useState<{ labels: string[]; data: number[] } | null>(null);
    const [from, setFrom] = useState<string>('');
    const [to, setTo] = useState<string>('');
    const [exportUrl, setExportUrl] = useState<string | null>(null);

    useEffect(() => {
        const now = new Date();
        const toDate = now.toISOString().substr(0,10);
        const fromDate = new Date(now.getFullYear(), now.getMonth()-5, 1).toISOString().substr(0,10);
        setFrom(fromDate);
        setTo(toDate);
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            const [linesResp, monthly] = await Promise.all([
                apiService.getLedgerLines(from || undefined, to || undefined).catch(() => []),
                apiService.getLedgerMonthly(6).catch(() => ({ labels: [], data: [] })),
            ]);
            setLines(linesResp || []);
            setChart(monthly || { labels: [], data: [] });
            try {
                const u = await apiService.getLedgerExportUrl(from || undefined, to || undefined).catch(() => null);
                setExportUrl(u || null);
            } catch (e) {
                setExportUrl(null);
            }
        } catch (e) {
            console.error('Failed to load ledger', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (from && to) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [from, to]);

    return (
        <div className="min-h-screen">
            <h1 className="text-2xl font-bold mb-4">My Ledger</h1>
            <Card>
                <div className="flex items-end gap-3 mb-4">
                    <div>
                        <label htmlFor="ledger-from" className="text-sm">From</label>
                        <input id="ledger-from" title="From date" aria-label="From date" placeholder="YYYY-MM-DD" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 p-2 border rounded-md" />
                    </div>
                    <div>
                        <label htmlFor="ledger-to" className="text-sm">To</label>
                        <input id="ledger-to" title="To date" aria-label="To date" placeholder="YYYY-MM-DD" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 p-2 border rounded-md" />
                    </div>
                    <div>
                        <Button onClick={() => load()} variant="outline">Refresh</Button>
                    </div>
                    <div className="ml-auto">
                        {exportUrl ? (
                            <a href={exportUrl} className="text-sm text-primary-600" target="_blank" rel="noreferrer">Download CSV</a>
                        ) : null}
                    </div>
                </div>
                {loading ? <Spinner /> : (
                    <div>
                        <div className="h-44 mb-4">
                            {chart && chart.labels && chart.labels.length ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chart.labels.map((l,i) => ({ name: l, value: chart.data[i] || 0 }))}>
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip formatter={(v:number) => formatMoney(v)} />
                                        <Bar dataKey="value" fill="#4F46E5" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (<p className="text-sm text-secondary-500">No chart data available.</p>)}
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[640px]">
                                <thead>
                                    <tr className="text-left text-secondary-600">
                                        <th>Date</th>
                                        <th>Description</th>
                                        <th>Account</th>
                                        <th className="text-right">Debit</th>
                                        <th className="text-right">Credit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.length === 0 ? (
                                        <tr><td colSpan={5}>No recent activity found.</td></tr>
                                    ) : lines.map((r, idx) => (
                                        <tr key={idx} className="border-b border-secondary-100">
                                            <td>{new Date(r.txn_date).toLocaleDateString()}</td>
                                            <td>{r.description}</td>
                                            <td>{r.account_name}</td>
                                            <td className="text-right">{r.debit && Number(r.debit) > 0 ? formatMoney(Number(r.debit)) : '\u00A0'}</td>
                                            <td className="text-right">{r.credit && Number(r.credit) > 0 ? formatMoney(Number(r.credit)) : '\u00A0'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default LedgerScreen;
