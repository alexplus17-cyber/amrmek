import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import ThemeToggle from './ThemeToggle';
import { apiService } from '../services/apiService';

const UserIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
);

interface HeaderProps {
    onNavigate: (view: 'dashboard' | 'profile' | 'settings' | 'billing' | 'notifications') => void;
}

const Header: React.FC<HeaderProps> = ({ onNavigate }) => {
    const { user, logout, callApiWithAuth } = useAuth();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [notifPreviews, setNotifPreviews] = useState<Array<any>>([]);
    const [notifLoading, setNotifLoading] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
                setIsNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        // Listen for notifications updates from other parts of the app
        const onNotifs = () => { fetchUnread(); };
        window.addEventListener('notifications-updated', onNotifs as EventListener);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('notifications-updated', onNotifs as EventListener);
        };
    }, []);

    const fetchUnread = async () => {
        try {
            if (!user) { setUnreadCount(0); return; }
            // Prefer a lightweight unread-count endpoint
            const cnt = await callApiWithAuth(() => apiService.getUnreadNotificationsCount());
            setUnreadCount(Number(cnt || 0));
        } catch (e) {
            // ignore fetch errors
        }
    };

    const fetchSummary = async () => {
        if (!user) return;
        setNotifLoading(true);
        try {
            const sum = await callApiWithAuth(() => apiService.getNotificationsSummary({ per_page: 3 }));
            setNotifPreviews(sum.recent || []);
            setUnreadCount(Number(sum.unread || 0));
        } catch (e) {
            // ignore
        } finally {
            setNotifLoading(false);
        }
    };

    useEffect(() => { fetchUnread(); }, [user]);

    const handleNavigation = (view: 'profile' | 'settings' | 'billing') => {
        onNavigate(view);
        setIsDropdownOpen(false);
    }

    return (
        <header className="bg-white dark:bg-secondary-900 shadow-md">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div 
                        className="flex items-center cursor-pointer"
                        onClick={() => onNavigate('dashboard')}
                        role="button"
                        aria-label="Back to dashboard"
                    >
                        <svg className="h-8 w-8 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="ml-2 text-xl font-bold text-secondary-900 dark:text-white">Investor Network</span>
                    </div>
                    {user && (
                        <div className="flex items-center space-x-2 sm:space-x-4">
                            <span className="hidden sm:inline text-sm font-medium text-secondary-600 dark:text-secondary-300">
                                Welcome, <span className="font-bold text-primary-600 dark:text-primary-400">{user.username}</span>
                            </span>
                            <ThemeToggle />
                            {/* Notifications button - opens the notifications screen in-app */}
                            <button
                                onClick={async () => {
                                    // Toggle popover preview; fetch summary on open
                                    if (!isNotifOpen) {
                                        await fetchSummary();
                                    }
                                    setIsNotifOpen(!isNotifOpen);
                                }}
                                className="relative p-1 rounded-full text-secondary-500 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                aria-label={`Notifications, ${unreadCount} unread`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-semibold rounded-full px-1.5 leading-none" aria-hidden="false">{unreadCount > 99 ? '99+' : String(unreadCount)}</span>
                                )}
                            </button>

                            {/* Notifications popover preview */}
                            {isNotifOpen && (
                                <div className="origin-top-right absolute right-12 mt-2 w-80 rounded-md shadow-lg py-2 bg-white dark:bg-secondary-800 ring-1 ring-black ring-opacity-5 z-20">
                                    <div className="px-3 py-2 border-b border-secondary-200 dark:border-secondary-700 flex items-center justify-between">
                                        <strong className="text-sm">Notifications</strong>
                                        <button className="text-xs text-primary-600" onClick={async (e) => { e.stopPropagation(); await callApiWithAuth(() => apiService.markAllNotificationsRead()); window.dispatchEvent(new Event('notifications-updated')); await fetchSummary(); }}>Mark all read</button>
                                    </div>
                                    <div className="max-h-56 overflow-y-auto">
                                        {notifLoading && (<div className="p-3 text-sm text-secondary-500">Loading…</div>)}
                                        {!notifLoading && notifPreviews.length === 0 && (<div className="p-3 text-sm text-secondary-500">No notifications</div>)}
                                        {!notifLoading && notifPreviews.map((n: any) => (
                                            <div key={n.id} className={`px-3 py-2 flex items-start justify-between hover:bg-secondary-50 dark:hover:bg-secondary-700 cursor-default ${n.is_read ? 'opacity-90' : 'bg-secondary-50 dark:bg-secondary-900/30'}`}>
                                                <div className="flex items-start space-x-3 w-full" onClick={async (e) => { e.stopPropagation(); if (!n.is_read) { try { await callApiWithAuth(() => apiService.markNotificationRead(n.id)); } catch (err) {} window.dispatchEvent(new Event('notifications-updated')); } onNavigate('notifications'); setIsNotifOpen(false); }}>
                                                    <div className="pt-0.5">
                                                        {/* Icon per notification type */}
                                                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-200">
                                                            {(() => {
                                                                const t = (n.type || 'info').toString();
                                                                if (t === 'transaction' || t === 'payment') {
                                                                    return (
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.567-3 3.5S10.343 15 12 15s3-1.567 3-3.5S13.657 8 12 8z" /></svg>
                                                                    );
                                                                }
                                                                if (t === 'warning' || t === 'alert') {
                                                                    return (
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                                                                    );
                                                                }
                                                                // default info
                                                                return (
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 18.5a6.5 6.5 0 110-13 6.5 6.5 0 010 13z" /></svg>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <div className={`text-sm ${n.is_read ? 'text-secondary-700 dark:text-secondary-300' : 'font-semibold text-secondary-900 dark:text-white'}`}>{n.title}</div>
                                                            <div className="text-xs text-secondary-500 ml-2">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</div>
                                                        </div>
                                                        <div className="text-xs text-secondary-600 dark:text-secondary-300 mt-1 truncate">{n.message ? (n.message.length > 160 ? n.message.substring(0, 157) + '...' : n.message) : ''}</div>
                                                    </div>
                                                </div>
                                                <div className="ml-3 flex-shrink-0 flex flex-col items-end gap-1">
                                                    {/* Inline actions: mark read (if unread), delete */}
                                                    {!n.is_read ? (
                                                        <button title="Mark read" className="text-xs text-primary-600 px-2 py-0.5 rounded hover:bg-primary-50" onClick={async (e) => { e.stopPropagation(); try { await callApiWithAuth(() => apiService.markNotificationRead(n.id)); } catch (err) {} // update optimistically
                                                                setNotifPreviews(prev => prev.map(p => p.id === n.id ? ({ ...p, is_read: true }) : p));
                                                                window.dispatchEvent(new Event('notifications-updated'));
                                                            }}>
                                                            ✓
                                                        </button>
                                                    ) : (
                                                        <button title="Dismiss" className="text-xs text-secondary-500 px-2 py-0.5 rounded hover:bg-secondary-100" onClick={async (e) => { e.stopPropagation(); // archive server-side so dismissal persists
                                                                try {
                                                                    // optimistic removal + unread adjustment
                                                                    const wasUnread = !n.is_read;
                                                                    setNotifPreviews(prev => prev.filter(p => p.id !== n.id));
                                                                    if (wasUnread) setUnreadCount(u => Math.max(0, u - 1));
                                                                    await callApiWithAuth(() => apiService.archiveNotification(n.id));
                                                                    window.dispatchEvent(new Event('notifications-updated'));
                                                                } catch (err) {
                                                                    // on error, refetch summary to recover
                                                                    await fetchSummary();
                                                                }
                                                            }}>
                                                            ✕
                                                        </button>
                                                    )}
                                                    <button title="Delete" className="text-xs text-red-600 px-2 py-0.5 rounded hover:bg-red-50" onClick={async (e) => { e.stopPropagation(); if (!confirm('Delete this notification?')) return; try { const wasUnread = !n.is_read; await callApiWithAuth(() => apiService.deleteNotification(n.id)); setNotifPreviews(prev => prev.filter(p => p.id !== n.id)); if (wasUnread) setUnreadCount(u => Math.max(0, u - 1)); window.dispatchEvent(new Event('notifications-updated')); } catch (err) { /* ignore */ await fetchSummary(); } }}>
                                                        🗑
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="px-3 py-2 border-t border-secondary-200 dark:border-secondary-700">
                                        <button onClick={() => { 
                                            // Debug: log navigation attempt
                                            try {
                                                // close popover first
                                                setIsNotifOpen(false);
                                                console.debug('Header: navigating to notifications');
                                                onNavigate && onNavigate('notifications');
                                            } catch (err) {
                                                console.error('Header: onNavigate error', err);
                                            }
                                        }} className="w-full text-sm text-primary-600">View all notifications</button>
                                    </div>
                                </div>
                            )}

                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="p-1 rounded-full text-secondary-500 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                    aria-label="User menu"
                                    aria-haspopup="true"
                                >
                                    {user?.avatar_url ? (
                                        <img src={user.avatar_url} alt="User avatar" className="w-8 h-8 rounded-full object-cover" />
                                    ) : (
                                        <UserIcon className="w-6 h-6" />
                                    )}
                                </button>
                                {isDropdownOpen && (
                                    <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-secondary-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                                        <a href="#" onClick={(e) => { e.preventDefault(); handleNavigation('profile'); }} className="block px-4 py-2 text-sm text-secondary-700 dark:text-secondary-200 hover:bg-secondary-100 dark:hover:bg-secondary-700">Your Profile</a>
                                        <a href="#" onClick={(e) => { e.preventDefault(); handleNavigation('settings'); }} className="block px-4 py-2 text-sm text-secondary-700 dark:text-secondary-200 hover:bg-secondary-100 dark:hover:bg-secondary-700">Settings</a>
                                        <a href="#" onClick={(e) => { e.preventDefault(); handleNavigation('billing'); }} className="block px-4 py-2 text-sm text-secondary-700 dark:text-secondary-200 hover:bg-secondary-100 dark:hover:bg-secondary-700">Billing</a>
                                        <div className="border-t border-secondary-200 dark:border-secondary-700 my-1"></div>
                                        <a href="https://your-support-page.com" target="_blank" rel="noopener noreferrer" className="block px-4 py-2 text-sm text-secondary-700 dark:text-secondary-200 hover:bg-secondary-100 dark:hover:bg-secondary-700">Help & Support</a>
                                        <a href="#" onClick={(e) => { e.preventDefault(); logout(); }} className="block px-4 py-2 text-sm text-secondary-700 dark:text-secondary-200 hover:bg-secondary-100 dark:hover:bg-secondary-700">Logout</a>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;