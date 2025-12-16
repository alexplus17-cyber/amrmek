import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/apiService';

const NetIncomeScreen: React.FC = () => {
    const { user, callApiWithAuth } = useAuth();
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<any[]>([]);
    const [totals, setTotals] = useState<any>(null);
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            try {
                const res = await callApiWithAuth(() => apiService.getNetIncomeSummary({ date_from: dateFrom || undefined, date_to: dateTo || undefined }));
                if (!mounted) return;
                setRows(res.rows || []);
                setTotals(res.totals || null);
            } catch (err) {
                console.error('Failed to load net income summary', err);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [user, callApiWithAuth, dateFrom, dateTo]);

    const handleExportCsv = () => {
        if (!rows || rows.length === 0) {
            alert('No rows to export');
            return;
        }
        const header = ['Date','Category','Description','Amount','Net'];
        const lines = [header.join(',')];
        rows.forEach(r => {
            const cols = [`"${r.date_display}"`, `"${r.category}"`, `"${(r.description||'').replace(/"/g,'""')}"`, `"${r.amount}"`, `"${r.net}"`];
            lines.push(cols.join(','));
        });
        if (totals) {
            lines.push('');
            lines.push([`Totals`, '', '', `Income: ${totals.income}`, `Net: ${totals.net}`].join(','));
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'net-income-summary.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    };

    if (loading) return <Spinner />;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Net Income Summary</h1>

            <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-2 sm:space-y-0">
                <input type="date" className="border rounded p-2" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Start date" />
                <input type="date" className="border rounded p-2" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="End date" />
                <div className="flex items-center space-x-2">
                    <Button onClick={() => { /* re-run effect -- already bound to dateFrom/dateTo */ }}>Apply</Button>
                    <Button variant="outline" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</Button>
                    <Button variant="ghost" onClick={handleExportCsv}>Export CSV</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card title="Total Income">
                    <div className="text-2xl font-semibold">{totals?.income ?? '—'}</div>
                </Card>
                <Card title="Total Expenses">
                    <div className="text-2xl font-semibold">{totals?.expense ?? '—'}</div>
                </Card>
                <Card title="Net Income">
                    <div className="text-2xl font-semibold">{totals?.net ?? '—'}</div>
                </Card>
            </div>

            <Card title="Entries">
                {rows.length === 0 ? (
                    <div className="p-4 text-sm text-secondary-600">No entries found.</div>
                ) : (
                    <div className="space-y-2">
                        {rows.map(r => (
                            <div key={r.date_iso + '-' + r.description} className="flex items-center justify-between p-3 bg-white dark:bg-secondary-800 rounded border">
                                <div>
                                    <div className="font-medium">{r.description}</div>
                                    <div className="text-sm text-secondary-500">{r.date_display} • {r.category}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-medium">{r.amount}</div>
                                    <div className="text-sm text-secondary-500">Net: {r.net}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default NetIncomeScreen;
