import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { apiService } from '../services/apiService';
import Spinner from '../components/Spinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const formatMoney = (v: number) => '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CashFlowScreen: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<any[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);
    const [expanded, setExpanded] = useState<number | null>(null);
    const [seriesMap, setSeriesMap] = useState<Record<number, any[]>>({});

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        apiService.getCashflowSummary().then(data => {
            if (!mounted) return;
            // data: { labels: string[], datasets: [{label,data:[]}, ...], rows: [] }
            setRows(data.rows || []);
            // Build recharts-friendly data: [{ name: label, Operating: x, Investing: y, Financing: z }, ...]
            const labels = data.labels || [];
            const ds = data.datasets || [];
            const op = ds[0]?.data || [];
            const iv = ds[1]?.data || [];
            const fi = ds[2]?.data || [];
            const cData = labels.map((lab: string, i: number) => ({ name: lab, Operating: Number(op[i] || 0), Investing: Number(iv[i] || 0), Financing: Number(fi[i] || 0) }));
            setChartData(cData);
        }).catch(err => {
            console.error('Failed to load cashflow summary', err);
        }).finally(() => {
            if (mounted) setLoading(false);
        });
        return () => { mounted = false; };
    }, []);

    if (loading) return <Spinner />;

    // chartData is built from server labels/datasets (Operating/Investing/Financing)

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Cash Flow</h1>

            <Card title="Annual Cash Flow by Proposal">
                {chartData.length === 0 ? (
                    <p className="text-sm text-secondary-500">No cashflow data available.</p>
                ) : (
                    <div className="w-full h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis />
                                <Tooltip formatter={(value: number) => formatMoney(value)} />
                                <Bar dataKey="Operating" stackId="a" fill="#2b6cb0" />
                                <Bar dataKey="Investing" stackId="a" fill="#38a169" />
                                <Bar dataKey="Financing" stackId="a" fill="#d69e2e" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </Card>

            <Card title="Proposal Cash Flow Details">
                {rows.length === 0 ? (
                    <p className="text-sm text-secondary-500">No proposals to show.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] table-auto border-collapse">
                            <thead>
                                <tr className="text-left bg-secondary-50 dark:bg-secondary-800">
                                    <th className="px-3 py-2">&nbsp;</th>
                                    <th className="px-3 py-2">Proposal</th>
                                    <th className="px-3 py-2">Operating</th>
                                    <th className="px-3 py-2">Investing</th>
                                    <th className="px-3 py-2">Financing</th>
                                    <th className="px-3 py-2">My Contributions</th>
                                    <th className="px-3 py-2">My Refunds</th>
                                    <th className="px-3 py-2">My Sales</th>
                                    <th className="px-3 py-2">Net</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r: any) => (
                                    <React.Fragment key={r.proposal_id || r.id}>
                                        <tr className="border-t">
                                            <td className="px-3 py-2 align-top">
                                                <Button variant="outline" onClick={async () => {
                                                    const pid = r.proposal_id || r.id;
                                                    if (expanded === pid) {
                                                        setExpanded(null);
                                                        return;
                                                    }
                                                    // fetch series if we don't have it
                                                    if (!seriesMap[pid]) {
                                                        try {
                                                            const resp = await apiService.getCashflowProposalSeries(pid);
                                                            setSeriesMap(prev => ({ ...prev, [pid]: resp.series || [] }));
                                                        } catch (e) {
                                                            console.error('Failed to load proposal series', e);
                                                            setSeriesMap(prev => ({ ...prev, [pid]: [] }));
                                                        }
                                                    }
                                                    setExpanded(pid);
                                                }}>View</Button>
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                <div className="font-semibold">{r.proposal || r.title}</div>
                                            </td>
                                            <td className="px-3 py-2 align-top">{formatMoney(Number(r.operating_total || r.operating || 0))}</td>
                                            <td className="px-3 py-2 align-top">{formatMoney(Number(r.investing_total || r.investing || 0))}</td>
                                            <td className="px-3 py-2 align-top">{formatMoney(Number(r.financing_total || r.financing || 0))}</td>
                                            <td className="px-3 py-2 align-top">{formatMoney(Number(r.my_contributions || 0))}</td>
                                            <td className="px-3 py-2 align-top">{formatMoney(Number(r.my_refunds || 0))}</td>
                                            <td className="px-3 py-2 align-top">{formatMoney(Number(r.my_sales || 0))}</td>
                                            <td className="px-3 py-2 align-top font-semibold">{formatMoney(Number(r.net || 0))}</td>
                                        </tr>
                                        {expanded === (r.proposal_id || r.id) ? (
                                            <tr>
                                                <td colSpan={9} className="px-3 py-2 bg-secondary-50 dark:bg-secondary-900">
                                                    <div className="space-y-2">
                                                        <div className="text-sm font-medium">Monthly series</div>
                                                        {(!seriesMap[r.proposal_id || r.id] || seriesMap[r.proposal_id || r.id].length === 0) ? (
                                                            <div className="text-sm text-secondary-500">No monthly data.</div>
                                                        ) : (
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full table-auto text-sm">
                                                                    <thead>
                                                                        <tr>
                                                                            <th className="px-2 py-1">Period</th>
                                                                            <th className="px-2 py-1">Operating</th>
                                                                            <th className="px-2 py-1">Investing</th>
                                                                            <th className="px-2 py-1">Financing</th>
                                                                            <th className="px-2 py-1">Net</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {seriesMap[r.proposal_id || r.id].map((s: any, idx: number) => (
                                                                            <tr key={idx}>
                                                                                <td className="px-2 py-1">{`${s.period_year}-${String(s.period_month).padStart(2,'0')}`}</td>
                                                                                <td className="px-2 py-1">{formatMoney(Number(s.op || 0))}</td>
                                                                                <td className="px-2 py-1">{formatMoney(Number(s.iv || 0))}</td>
                                                                                <td className="px-2 py-1">{formatMoney(Number(s.fi || 0))}</td>
                                                                                <td className="px-2 py-1">{formatMoney(Number(s.net || ( (s.op||0)+(s.iv||0)+(s.fi||0) ) ))}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : null}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <div>
                <Button variant="secondary" onClick={() => window.print()}>Export / Print</Button>
            </div>
        </div>
    );
};

export default CashFlowScreen;
