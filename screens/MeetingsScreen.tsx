import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/apiService';

const MeetingsScreen: React.FC = () => {
    const { user, callApiWithAuth } = useAuth();
    const [loading, setLoading] = useState(true);
    const [meetings, setMeetings] = useState<any[]>([]);
    const [nextMeeting, setNextMeeting] = useState<any | null>(null);
    const [search, setSearch] = useState<string>('');
    const [year, setYear] = useState<string>('');
    const [month, setMonth] = useState<string>('');
    const [page, setPage] = useState<number>(1);
    const [perPage] = useState<number>(10);
    const [total, setTotal] = useState<number>(0);
    const [rsvpLoadingId, setRsvpLoadingId] = useState<number | null>(null);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            try {
                const res = await callApiWithAuth(() => apiService.getMeetings({ per_page: perPage, page, search: search || undefined, year: year || undefined, month: month || undefined }));
                const list = res.meetings || [];
                if (!mounted) return;
                setMeetings(list);
                setTotal(res.total || 0);

                // compute next meeting (soonest future)
                const now = Date.now();
                let next: any = null;
                list.forEach((m: any) => {
                    const dt = m.date ? new Date(m.date).getTime() : (m.start_time ? new Date(m.start_time).getTime() : 0);
                    if (dt && dt >= now && (!next || dt < (next.date ? new Date(next.date).getTime() : new Date(next.start_time).getTime()))) {
                        next = m;
                    }
                });
                setNextMeeting(next);
            } catch (err) {
                console.error('Failed to load meetings', err);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [user, callApiWithAuth, search, year, month, page, perPage]);

    if (loading) return <Spinner />;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Investor Meetings</h1>

            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3">
                    <input
                        aria-label="Search meetings"
                        placeholder="Search meetings"
                        className="border rounded p-2 flex-1"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    />
                    <select aria-label="Filter by year" className="border rounded p-2" value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }}>
                        <option value="">All years</option>
                        {/* include current and +-1 years for simplicity */}
                        {(() => { const y = new Date().getFullYear(); return [y - 1, y, y + 1].map(yy => <option key={yy} value={String(yy)}>{yy}</option>); })()}
                    </select>
                    <select aria-label="Filter by month" className="border rounded p-2" value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }}>
                        <option value="">All months</option>
                        {Array.from({ length: 12 }).map((_, i) => <option key={i+1} value={String(i+1)}>{new Date(0, i).toLocaleString(undefined, { month: 'long' })}</option>)}
                    </select>
                </div>

            {nextMeeting && (
                <Card title="Next Meeting">
                    <div className="space-y-2">
                        <div className="text-lg font-semibold">{nextMeeting.title || nextMeeting.topic}</div>
                        <div className="text-sm text-secondary-600">{nextMeeting.date_display || (nextMeeting.date ? new Date(nextMeeting.date).toLocaleString() : '')}</div>
                        <div className="text-sm text-secondary-500">Host: {nextMeeting.host || '—'}</div>
                        <div className="pt-3">
                            {nextMeeting.join_url ? (
                                <a href={nextMeeting.join_url} target="_blank" rel="noreferrer"><Button>RSVP / Join</Button></a>
                            ) : null}
                        </div>
                    </div>
                </Card>
            )}

            <Card title="All Meetings">
                {meetings.length === 0 ? (
                    <div className="p-4 text-sm text-secondary-600">No meetings found.</div>
                ) : (
                    <div className="space-y-3">
                        {meetings.map(m => (
                            <div key={m.id || m.ID || Math.random()} className="flex items-center justify-between p-3 bg-white dark:bg-secondary-800 rounded border">
                                <div>
                                    <div className="font-medium">{m.title || m.topic}</div>
                                    <div className="text-sm text-secondary-500">{m.date_display || (m.date ? new Date(m.date).toLocaleString() : '')}</div>
                                    {m.created_by_name ? <div className="text-xs text-secondary-400">Organizer: {m.created_by_name}</div> : null}
                                </div>
                                <div className="flex items-center space-x-2">
                                    {m.join_url ? <a href={m.join_url} target="_blank" rel="noreferrer"><Button variant="outline">Join</Button></a> : null}
                                    {m.agenda_url ? <a href={m.agenda_url} target="_blank" rel="noreferrer"><Button variant="ghost">Agenda</Button></a> : null}
                                    {/* RSVP buttons if supported */}
                                    {m.rsvp_status !== undefined ? (
                                        <div className="flex items-center space-x-1">
                                            {(['attending','not_attending','maybe'] as const).map(s => (
                                                <Button
                                                    key={s}
                                                    variant={m.rsvp_status === s ? 'primary' : 'outline'}
                                                    isLoading={rsvpLoadingId === m.id}
                                                    onClick={async () => {
                                                        try {
                                                            setRsvpLoadingId(m.id);
                                                            await callApiWithAuth(() => apiService.rsvpMeeting(Number(m.id), s));
                                                            // refresh list
                                                            const refreshed = await callApiWithAuth(() => apiService.getMeetings({ per_page: perPage, page, search: search || undefined, year: year || undefined, month: month || undefined }));
                                                            setMeetings(refreshed.meetings || []);
                                                            setTotal(refreshed.total || 0);
                                                        } catch (err) {
                                                            console.error('RSVP failed', err);
                                                            alert('RSVP failed.');
                                                        } finally {
                                                            setRsvpLoadingId(null);
                                                        }
                                                    }}
                                                >
                                                    {s === 'not_attending' ? 'Not attending' : s === 'maybe' ? 'Maybe' : 'Attending'}
                                                </Button>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {/* Pagination */}
                {total > perPage && (
                    <div className="pt-4 flex items-center justify-center space-x-2">
                        {Array.from({ length: Math.ceil(total / perPage) }).map((_, i) => (
                            <Button key={i} variant={page === i+1 ? 'primary' : 'outline'} onClick={() => setPage(i+1)}>{i+1}</Button>
                        ))}
                    </div>
                )}
            </Card>
            </div>
        </div>
    );
};

export default MeetingsScreen;
