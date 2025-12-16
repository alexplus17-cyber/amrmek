import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import { apiService } from '../services/apiService';
import Spinner from '../components/Spinner';
import Button from '../components/Button';

const formatMoney = (v: number) => '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AffiliateScreen: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [affiliates, setAffiliates] = useState<any[]>([]);
    const [commissions, setCommissions] = useState<any[]>([]);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [invitesRemaining, setInvitesRemaining] = useState<number | null>(null);
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [sendingInvite, setSendingInvite] = useState(false);
    const [generating, setGenerating] = useState(false);

    const extractInviteCode = (link: string | null) => {
        if (!link) return null;
        try {
            // Try URL param 'invite_code' or 'invite'
            const u = new URL(link, window.location.origin);
            const c = u.searchParams.get('invite_code') || u.searchParams.get('invite') || null;
            if (c) return c;
            // Fallback: look for INV-1- pattern in the string
            const m = link.match(/(INV-1-[A-Za-z0-9_-]+)/);
            return m ? m[1] : null;
        } catch (e) {
            const m = link.match(/(INV-1-[A-Za-z0-9_-]+)/);
            return m ? m[1] : null;
        }
    };
    const [affPage, setAffPage] = useState(1);
    const [commPage, setCommPage] = useState(1);
    const perPage = 20;

    const loadAffiliates = async (page = 1) => {
        try {
            const rows = await apiService.getAffiliates(perPage, page).catch(() => []);
            setAffiliates(rows || []);
            setAffPage(page);
        } catch (e) {
            console.error('Failed to load affiliates', e);
        }
    };

    const loadCommissions = async (page = 1) => {
        try {
            const rows = await apiService.getAffiliateCommissions(perPage, page).catch(() => []);
            setCommissions(rows || []);
            setCommPage(page);
        } catch (e) {
            console.error('Failed to load commissions', e);
        }
    };

    const loadStats = async () => {
        try {
            const s = await apiService.getAffiliateStats().catch(() => null);
            setStats(s);
            // populate invite link and remaining invites if present
            if (s) {
                // some servers may return 'invite_link' or 'invite_url'
                const il = s.invite_link || s.invite_url || null;
                // Only overwrite inviteLink if server returned one
                if (il) {
                    setInviteLink(il);
                }
                // Only update invitesRemaining when provided by server
                if (typeof s.invites_remaining !== 'undefined') {
                    setInvitesRemaining(Number(s.invites_remaining));
                }
            }
        } catch (e) {
            console.error('Failed to load affiliate stats', e);
        }
    };

    const load = async () => {
        setLoading(true);
        await Promise.all([loadStats(), loadAffiliates(1), loadCommissions(1)]);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const viewInvitee = (inviteeId: number) => {
        // Open the member profile page in a new tab (fallback to web profile path)
        const path = `/member-profile/?user_id=${inviteeId}`;
        const full = window.location.origin.replace(/:\d+$/, '') + '/word' + path;
        window.open(full, '_blank');
    };

    const requestPayout = (affiliateId: number) => {
        // Simple UX: navigate to payments dashboard to request payout
        const full = window.location.origin.replace(/:\d+$/, '') + '/word/investor-payments-dashboard/';
        window.open(full, '_blank');
    };

    if (loading) return <Spinner />;

    return (
        <div className="min-h-screen">
            <h1 className="text-2xl font-bold mb-4">Affiliate Program</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <Card>
                    <div className="text-sm text-secondary-600">Total Invites</div>
                    <div className="text-2xl font-bold">{stats?.total_invites ?? 0}</div>
                </Card>
                <Card>
                    <div className="text-sm text-secondary-600">Active Invites</div>
                    <div className="text-2xl font-bold">{stats?.active_invites ?? 0}</div>
                </Card>
                <Card>
                    <div className="text-sm text-secondary-600">Commission Earned</div>
                    <div className="text-2xl font-bold">{formatMoney(Number(stats?.total_earned || 0))}</div>
                </Card>
            </div>

            {/* Invite link + email invite form */}
            <div className="mb-6">
                <Card title="Your Invite Link">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-1">
                            <div className="text-sm text-secondary-600">Invite Code</div>
                            <div className="mt-1 break-words font-mono">{extractInviteCode(inviteLink) || <span className="text-secondary-500">No invite code available</span>}</div>
                            <div className="text-xs text-secondary-500 mt-1">Invites remaining: {invitesRemaining !== null ? `${invitesRemaining}/100` : '—'}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button onClick={async () => {
                                const code = extractInviteCode(inviteLink);
                                if (!code) return alert('No invite code to copy');
                                try {
                                    await navigator.clipboard.writeText(code);
                                    // small feedback
                                    alert('Invite code copied');
                                } catch (e) {
                                    // fallback: prompt with code
                                    window.prompt('Copy your invite code', code);
                                }
                            }} variant="outline">Copy Code</Button>
                            <Button onClick={async () => {
                                setGenerating(true);
                                try {
                                    const newLink = await apiService.generateAffiliateLink();
                                    if (newLink) {
                                        setInviteLink(newLink);
                                        await loadStats();
                                    } else {
                                        alert('Failed to generate an invite link.');
                                    }
                                } catch (e: any) {
                                    console.error('Failed to generate link', e);
                                    alert('Error generating invite link: ' + (e?.message || 'unknown'));
                                } finally {
                                    setGenerating(false);
                                }
                            }} disabled={generating} variant="outline">{generating ? 'Generating…' : 'Generate New Link'}</Button>
                        </div>
                    </div>

                    <div className="mt-4 border-t pt-4">
                        <div className="text-sm mb-2">Send Invite via Email</div>
                        <div className="space-y-2">
                            <input className="w-full p-2 border rounded" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} />
                            <textarea className="w-full p-2 border rounded" rows={3} placeholder="Personal Message (optional)" value={message} onChange={e => setMessage(e.target.value)} />
                            <div className="flex items-center justify-end">
                                <Button onClick={async () => {
                                    if (!email) return alert('Please enter an email address');
                                    setSendingInvite(true);
                                    try {
                                        await apiService.sendAffiliateInvite(email, message).catch(() => { throw new Error('server-fallback'); });
                                        alert('Invite sent (server)');
                                    } catch (e) {
                                        // Fallback to mailto: if server endpoint unavailable
                                        const subject = encodeURIComponent('You are invited to join');
                                        const body = encodeURIComponent((message ? message + '\n\n' : '') + (inviteLink ? `Join here: ${inviteLink}` : '')); 
                                        window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
                                    } finally {
                                        setSendingInvite(false);
                                    }
                                }} disabled={sendingInvite}>{sendingInvite ? 'Sending…' : 'Send Invite'}</Button>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title={`Affiliates (page ${affPage})`}>
                    {affiliates.length === 0 ? (
                        <p className="text-sm text-secondary-500">No affiliates yet.</p>
                    ) : (
                        <ul className="space-y-2">
                            {affiliates.map((a, i) => (
                                <li key={i} className="p-3 border rounded-md flex items-center justify-between">
                                    <div>
                                        <div className="font-semibold">{a.invitee_login || a.invitee_name || '—'}</div>
                                        <div className="text-sm text-secondary-600">Status: {a.status}</div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Button onClick={() => viewInvitee(a.invitee_id || a.invitee || 0)} variant="outline">View</Button>
                                        <Button onClick={() => requestPayout(a.id)} variant="outline">Request Payout</Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="flex items-center justify-between mt-3">
                        <div className="text-sm text-secondary-500">Showing {affiliates.length} items</div>
                        <div className="flex items-center space-x-2">
                            <Button onClick={() => { if (affPage > 1) loadAffiliates(affPage - 1); }} variant="outline" disabled={affPage <= 1}>Previous</Button>
                            <Button onClick={() => loadAffiliates(affPage + 1)} variant="outline">Next</Button>
                        </div>
                    </div>
                </Card>

                <Card title={`Recent Commissions (page ${commPage})`}>
                    {commissions.length === 0 ? (
                        <p className="text-sm text-secondary-500">No commission events recorded.</p>
                    ) : (
                        <ul className="space-y-2">
                            {commissions.map((c, i) => (
                                <li key={i} className="p-2 border rounded-md">
                                    <div className="flex justify-between">
                                        <div className="text-sm">{c.notes || c.type || 'Commission'}</div>
                                        <div className="font-semibold">{formatMoney(Number(c.amount || 0))}</div>
                                    </div>
                                    <div className="text-xs text-secondary-500">{c.created_at}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="flex items-center justify-between mt-3">
                        <div className="text-sm text-secondary-500">Showing {commissions.length} items</div>
                        <div className="flex items-center space-x-2">
                            <Button onClick={() => { if (commPage > 1) loadCommissions(commPage - 1); }} variant="outline" disabled={commPage <= 1}>Previous</Button>
                            <Button onClick={() => loadCommissions(commPage + 1)} variant="outline">Next</Button>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="mt-6">
                <Button onClick={() => load()}>Refresh</Button>
            </div>
        </div>
    );
};

export default AffiliateScreen;
