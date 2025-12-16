import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import { apiService } from '../services/apiService';
import { useToast } from '../contexts/ToastContext';

type NotificationItem = {
    id: number;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    action_url?: string | null;
    created_at?: string | null;
};

const NotificationsScreen: React.FC = () => {
    const [loading, setLoading] = useState<boolean>(true);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [perPage] = useState<number>(100);
    const { show } = useToast();

    const load = async () => {
        setLoading(true);
        try {
            const rows = await apiService.getNotifications({ per_page: perPage });
            setNotifications(Array.isArray(rows) ? rows : []);
        } catch (e: any) {
            console.error('Failed to load notifications', e);
            show('Failed to load notifications', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const markRead = async (id: number) => {
        try {
            await apiService.markNotificationRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            show('Marked read', 'success');
            // Notify other UI (header) to refresh counts
            try { window.dispatchEvent(new CustomEvent('notifications-updated')); } catch (e) {}
        } catch (e: any) {
            console.error('markRead failed', e);
            show('Failed to mark notification read', 'error');
        }
    };

    const markAll = async () => {
        try {
            await apiService.markAllNotificationsRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            show('All notifications marked read', 'success');
            try { window.dispatchEvent(new CustomEvent('notifications-updated')); } catch (e) {}
        } catch (e: any) {
            console.error('markAll failed', e);
            show('Failed to mark all read', 'error');
        }
    };

    const del = async (id: number) => {
        if (!confirm('Delete this notification?')) return;
        try {
            await apiService.deleteNotification(id);
            setNotifications(prev => prev.filter(n => n.id !== id));
            show('Notification deleted', 'success');
            try { window.dispatchEvent(new CustomEvent('notifications-updated')); } catch (e) {}
        } catch (e: any) {
            console.error('delete failed', e);
            show('Failed to delete notification', 'error');
        }
    };

    if (loading) return <Spinner />;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Notifications</h1>
                <div className="flex space-x-2">
                    <Button variant="secondary" onClick={load}>Refresh</Button>
                    <Button variant="primary" onClick={markAll}>Mark All Read</Button>
                </div>
            </div>

            <Card>
                <div className="mb-3 text-sm text-secondary-600">{notifications.length} notifications</div>
                {notifications.length === 0 && (<div className="text-sm text-secondary-500">No notifications</div>)}
                <div>
                    <table className="w-full text-left">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Title / Message</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {notifications.map(n => (
                                <tr key={n.id} className={`border-t ${n.is_read ? 'opacity-70' : ''}`}>
                                    <td style={{ width: 160 }}>
                                        <div>{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</div>
                                    </td>
                                    <td style={{ width: 140 }}>
                                        <div>{n.type}</div>
                                    </td>
                                    <td>
                                        <div className="font-semibold">{n.title}</div>
                                        <div className="text-sm text-secondary-600">{n.message}</div>
                                    </td>
                                    <td className="text-right">
                                        <div className="flex justify-end space-x-2">
                                            {!n.is_read && <button className="button button-small" onClick={() => markRead(n.id)}>Mark Read</button>}
                                            {n.action_url && <a className="button button-small" href={String(n.action_url)}>View</a>}
                                            <button className="button button-small" onClick={() => del(n.id)}>Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default NotificationsScreen;
