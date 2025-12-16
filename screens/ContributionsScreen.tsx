import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/apiService';

const ContributionsScreen: React.FC = () => {
    const { user, callApiWithAuth } = useAuth();
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<any>(null);
    const [contributions, setContributions] = useState<any[]>([]);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const res = await callApiWithAuth(() => apiService.getMemberContributions(user.id));
                if (!mounted) return;
                setSummary(res.summary || null);
                setContributions(res.contributions || []);
            } catch (err) {
                console.error('Failed to load contributions:', err);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [user, callApiWithAuth]);

    const handleDownload = async (id: number) => {
        try {
            setDownloadingId(id);
            const { url } = await apiService.downloadContributionReceipt(id);
            const a = document.createElement('a');
            a.href = url;
            a.download = `contribution-${id}-receipt.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            // Release the blob URL after a short delay
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (err) {
            console.error('Receipt download failed', err);
            alert('Failed to download receipt');
        } finally {
            setDownloadingId(null);
        }
    };

    if (loading) return <Spinner />;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Contributions & Receipts</h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card title="Total Contributed">
                    <div className="text-2xl font-semibold">${summary?.total_contributed?.toLocaleString?.() ?? '0'}</div>
                    <div className="text-sm text-secondary-500">Total contributed</div>
                </Card>
                <Card title="Contributions">
                    <div className="text-2xl font-semibold">{summary?.contributions_count ?? 0}</div>
                    <div className="text-sm text-secondary-500">Number of contributions</div>
                </Card>
                <Card title="Pending">
                    <div className="text-2xl font-semibold">{summary?.pending_contributions ?? 0}</div>
                    <div className="text-sm text-secondary-500">Pending</div>
                </Card>
                <Card title="Last Contribution">
                    <div className="text-2xl font-semibold">{summary?.last_contribution_date ? new Date(summary.last_contribution_date).toLocaleDateString() : 'N/A'}</div>
                    <div className="text-sm text-secondary-500">Last</div>
                </Card>
            </div>

            <Card title="Recent Contributions">
                {contributions.length === 0 ? (
                    <div className="p-4 text-sm text-secondary-600">No contributions found.</div>
                ) : (
                    <div className="space-y-3">
                        {contributions.map(c => (
                            <div key={c.id} className="flex items-center justify-between p-3 bg-white dark:bg-secondary-800 rounded border">
                                <div>
                                    <div className="font-medium">${Number(c.amount).toLocaleString()}</div>
                                    <div className="text-sm text-secondary-500">{c.method} • {new Date(c.created_at).toLocaleDateString()}</div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Button onClick={() => handleDownload(c.id)} isLoading={downloadingId === c.id}>Receipt</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default ContributionsScreen;
