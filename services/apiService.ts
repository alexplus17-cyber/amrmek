
// FIX: Import the new MemberDashboardData interface.
import { User, UserRole, ApplicationStatus, Application, Transaction, Poll, Quiz, Announcement, Invoice, InvoiceStatus, UserProfile, UserSettings, Listing, MemberDashboardData } from '../types';

// Resolve API base from common env names used by Vite / Create React App, or
// fall back to the current site origin (useful when running the web client
// from the same host as WordPress).
const resolveApiBase = (): string => {
    // Vite exposes variables on import.meta.env
    try {
        // @ts-ignore
        const vite = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_BASE : undefined;
        const cra = process?.env?.REACT_APP_API_BASE;
        const viteFallback = vite || cra;
        if (viteFallback) return String(viteFallback).replace(/\/$/, '');
    } catch (e) {
        // ignore
    }
    // With Vite proxy, use relative path to /word
    return '/word';
};

const API_BASE = resolveApiBase();

let authToken: string | null = null;

const setAuthToken = (token: string | null) => {
    authToken = token;
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
    if (!API_BASE) {
        throw new Error('API base URL is not configured (REACT_APP_API_BASE)');
    }
    const headers: Record<string, string> = {
        'Accept': 'application/json',
    };
    if (options.headers) {
        Object.assign(headers, options.headers as Record<string, string>);
    }
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    const res = await fetch(`${API_BASE}${path}`, {
        credentials: 'include',
        ...options,
        headers,
    });
    const text = await res.text();
    let data: any = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch (e) {
        // not JSON
        data = text;
    }
    if (!res.ok) {
        const err = new Error(data && data.message ? data.message : res.statusText || 'Request failed');
        (err as any).status = res.status;
        (err as any).body = data;
        throw err;
    }
    return data as T;
};

export const apiService = {
    setAuthToken,
    // Login using JWT plugin endpoint: returns token and user data
    login: async (username: string, password: string): Promise<User> => {
        const body = new URLSearchParams();
        body.append('username', username);
        body.append('password', password || '');
        // JWT plugin endpoint
        const res = await fetch(`${API_BASE}/wp-json/jwt-auth/v1/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });
        const json = await res.json();
        if (!res.ok) {
            throw new Error(json.message || 'Login failed');
        }
        // Save token and then fetch the current WP user to get the numeric ID
        setAuthToken(json.token);
        let wpUser: any = null;
        try {
            wpUser = await request<any>(`/wp-json/wp/v2/users/me`);
        } catch (e) {
            // If fetching the user fails, continue with best-effort info
            wpUser = null;
        }

        const user: User = {
            id: wpUser?.id || 0,
            username: wpUser?.slug || json.user_nicename || username,
            email: wpUser?.email || json.user_email || '',
            role: UserRole.MEMBER,
            token: json.token,
            refreshToken: json.refresh_token || '',
        };

        return user;
    },
    // Refresh token: if your server implements refresh endpoint, call it here.
    refreshToken: async (_refreshToken: string): Promise<{ token: string }> => {
        // Default behavior: not implemented on server — force re-login
        throw new Error('Refresh not implemented');
    },

    getListings: async (): Promise<Listing[]> => {
        // Some server versions return { value: [...] } while others return a plain array or { listings: [...] }.
        return request<any>(`/wp-json/investor-network/v1/listings`).then(r => {
            if (!r) return [];
            if (Array.isArray(r)) return r as Listing[];
            return (r.value || r.listings || r.rows || []) as Listing[];
        });
    },
    // Fetch proposals list via REST. Falls back to listings endpoint if proposals route not available.
    getProposals: async (): Promise<Listing[]> => {
        try {
            return request<{ value?: Listing[] }>(`/wp-json/investor-network/v1/proposals`).then(r => (r && (r as any).value) || r as any || []);
        } catch (e) {
            // If the proposals endpoint isn't available on server, fall back to listings
            return apiService.getListings();
        }
    },
    // Fetch share availability for a proposal. Prefer a REST endpoint protected by JWT
    // at `/wp-json/investor-network/v1/proposals/{id}/availability`. Fall back to the
    // legacy admin-ajax action `get_share_availability` if REST is not available.
    getProposalAvailability: async (proposalId: number) => {
        // Try REST first (this will include Authorization header when authToken is set)
        try {
            const restPath = `/wp-json/investor-network/v1/proposals/${proposalId}/availability`;
            const restRes = await request<any>(restPath);
            if (restRes) return restRes;
        } catch (e) {
            // ignore and fall back to admin-ajax
            console.debug('Proposal availability REST endpoint failed, falling back to admin-ajax:', (e as any)?.message || e);
        }

        // Fallback to admin-ajax POST. Note: this endpoint may require a nonce or
        // WP cookie session; mobile clients using JWT may not be able to call it.
        const path = `/wp-admin/admin-ajax.php`;
        const body = new URLSearchParams();
        body.append('action', 'get_share_availability');
        body.append('proposal_id', String(proposalId));
        const res = await fetch(`${API_BASE}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
            credentials: 'include',
        });
        const txt = await res.text();
        try {
            const j = JSON.parse(txt);
            // WP's wp_send_json_success returns { success: true, data: {...} }
            if (j && j.success && j.data) return j.data;
            // Some older handlers return raw data or { value: ... }
            return j.data || j.value || j;
        } catch (e) {
            // not JSON
            throw new Error('Failed to parse availability response');
        }
    },
    // Fetch secondary-market sell requests for a proposal using normalized server fields
    getProposalSecondaryListings: async (proposalId: number) => {
        try {
            const path = `/wp-json/investor-network/v1/proposals/${proposalId}/secondary-listings`;
            const res = await request<any>(path);
            if (!res) return [] as Listing[];
            // Server returns an array of normalized sell_request rows; some servers wrap in { value: [...] }
            if (Array.isArray(res)) return res as Listing[];
            return (res.value || res.listings || res.rows || []) as Listing[];
        } catch (e) {
            // If REST endpoint not available, fall back to the general listings endpoint and filter
            console.debug('Secondary listings REST endpoint failed, falling back to listings:', (e as any)?.message || e);
            const all = await apiService.getListings();
            return (all || []).filter(l => Number(l.proposal_id || l.proposalId || l.proposal || 0) === Number(proposalId) && (l.seller_user_id || l.seller_id || l.seller));
        }
    },
    getListingDetails: async (id: number): Promise<Listing> => {
        return request<Listing>(`/wp-json/investor-network/v1/listings/${id}`);
    },
    getListingAvailability: async (id: number): Promise<{ availability: number }> => {
        return request<{ availability: number }>(`/wp-json/investor-network/v1/listings/${id}/availability`);
    },
    createStripeIntent: async (listingId: number, quantity: number): Promise<{ clientSecret: string }> => {
        return request<{ client_secret: string }>(`/wp-json/investor-network/v1/stripe/create-payment-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: quantity, listing_id: listingId }),
        }).then(r => ({ clientSecret: (r as any).client_secret || (r as any).clientSecret }));
    },
    recordPurchase: async (listingId: number, quantity: number, paymentMethod: 'stripe' | 'bank', paymentPayload: object) => {
        // Defensive: ensure numeric quantity and normalized payment_method
        const normalizedQuantity = Number(quantity) || 0;
        let normalizedPaymentMethod = String(paymentMethod || '').toLowerCase();
        if (normalizedPaymentMethod === 'bank') normalizedPaymentMethod = 'bank_transfer';

        // Preflight: ensure the server still knows about this listing id. If the REST
        // GET returns 404, attempt a graceful retry: if the client included a
        // `proposal_id` in the payment payload, try to find the latest active
        // listing for that proposal and continue with that id. Otherwise, surface
        // a clearer error with available listing ids.
        try {
            await apiService.getListingDetails(Number(listingId));
        } catch (preErr) {
            console.log('Preflight failed for listingId:', listingId, 'error:', preErr);
            // If paymentPayload included a proposal_id, try to find a matching listing
            try {
                const maybePid = (paymentPayload && (paymentPayload as any).proposal_id) ? Number((paymentPayload as any).proposal_id) : 0;
                console.log('maybePid from paymentPayload:', maybePid);
                if (maybePid && maybePid > 0) {
                    try {
                        // Prefer the server's secondary-listings endpoint
                        const sec = await apiService.getProposalSecondaryListings(maybePid);
                        if (Array.isArray(sec) && sec.length > 0) {
                            // Choose the first available listing id
                            const candidate = sec.find((s: any) => Number(s.quantity || s.available || s.available_quantity || 0) > 0) || sec[0];
                            if (candidate && candidate.id) {
                                console.log('Found candidate from secondary listings:', candidate.id);
                                // Retry purchase using the candidate listing id
                                listingId = Number(candidate.id);
                            }
                        } else {
                            // Fallback: search the general listings list
                            const all = await apiService.getListings();
                            const found = (all || []).find((it: any) => Number(it.proposal_id || it.proposal || it.proposalId) === maybePid && Number(it.quantity || it.available || it.available_quantity || 0) > 0);
                            if (found && found.id) {
                                console.log('Found candidate from general listings:', found.id);
                                listingId = Number(found.id);
                            } else {
                                console.log('No candidate found for proposal_id:', maybePid);
                            }
                        }
                    } catch (inner) {
                        console.log('Error during retry lookup:', inner);
                        // ignore and continue to surface helpful error below
                    }
                } else {
                    console.log('No proposal_id in paymentPayload, trying fallback to any available listing');
                    // Fallback: if no proposal_id, try to find any available listing
                    try {
                        const all = await apiService.getListings();
                        const available = (all || []).find((it: any) => Number(it.quantity || it.available || it.available_quantity || 0) > 0);
                        if (available && available.id) {
                            console.log('Found fallback candidate:', available.id);
                            listingId = Number(available.id);
                        } else {
                            console.log('No available listings found');
                        }
                    } catch (fallbackErr) {
                        console.log('Fallback failed:', fallbackErr);
                    }
                }

                // If we changed listingId to a candidate, proceed; otherwise collect available ids for the error
                try {
                    console.log('Checking new listingId:', listingId);
                    await apiService.getListingDetails(Number(listingId));
                    console.log('New listingId is valid, proceeding');
                } catch (eAfter) {
                    console.log('New listingId also invalid:', eAfter);
                    const all = await apiService.getListings();
                    const availableIds = (all || []).map((i: any) => Number(i.id)).filter((x: any) => x);
                    const e: any = new Error('Listing not found on server. Please refresh listings.');
                    e.availableListingIds = availableIds;
                    throw e;
                }
            } catch (finalErr) {
                throw finalErr;
            }
        }

        // First attempt: call REST endpoint (preferred for token-authenticated requests)
        try {
            const r = await request<any>(`/wp-json/investor-network/v1/listings/${listingId}/purchase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quantity: normalizedQuantity,
                    payment_method: normalizedPaymentMethod,
                    payment_payload: paymentPayload || {},
                }),
            });
            const newInvoice = (r && (r.invoice || r.newInvoice || r.invoice_id || r.invoiceId)) ? (r.invoice || r.newInvoice) : undefined;
            return { newInvoice, raw: r } as any;
        } catch (err) {
            // If REST failed (server may expect legacy admin-ajax form fields), fall back to form-encoded admin-ajax POST
            try {
                const body = new URLSearchParams();
                // Action name expected by the shortcode: 'purchase_listing_shares'
                body.append('action', 'purchase_listing_shares');
                body.append('listing_id', String(listingId));
                // Legacy key expected by shortcode: 'share_quantity'
                body.append('share_quantity', String(normalizedQuantity));
                // Map payment method to legacy value (shortcode expects 'bank_transfer')
                body.append('payment_method', String(normalizedPaymentMethod));
                // If payment payload contains simple fields (note, etc.), append them as payment_payload JSON
                if (paymentPayload && Object.keys(paymentPayload).length) {
                    body.append('payment_payload', JSON.stringify(paymentPayload));
                }
                // If the shortcode localized object is present on the page, include the nonce so admin-ajax accepts the request
                try {
                    const win = (window as any) || {};
                    const sp = win.sharePurchase || win.share_purchase || null;
                    if (sp && sp.nonce) {
                        body.append('share_purchase_nonce', String(sp.nonce));
                    }
                    // Also accept other common nonce keys if present
                    if (sp && sp.payments_nonce) {
                        body.append('payments_nonce', String(sp.payments_nonce));
                    }
                } catch (e) {
                    // ignore if window not available (e.g., server-side)
                }

                const path = `/wp-admin/admin-ajax.php`;
                const res = await fetch(`${API_BASE}${path}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: body.toString(),
                    credentials: 'include',
                });
                const txt = await res.text();
                let j: any = null;
                try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = txt; }
                if (!res.ok) {
                    const msg = j && j.data ? (j.data || j.message || JSON.stringify(j)) : (j && j.message) || res.statusText;
                    throw new Error(msg || 'Purchase failed');
                }
                // Normalize admin-ajax wp_send_json_success result
                const payload = (j && j.success && j.data) ? j.data : j;
                const newInvoice = (payload && (payload.invoice || payload.invoice_id || payload.newInvoice)) ? (payload.invoice || payload.newInvoice) : undefined;
                return { newInvoice, raw: payload } as any;
            } catch (e2) {
                // Re-throw original REST error if fallback also fails
                throw err;
            }
        }
    },
    getInvoices: async (opts?: { per_page?: number; page?: number; search?: string }) => {
        const per_page = opts?.per_page ?? 20;
        const page = opts?.page ?? 1;
        const qs: string[] = [];
        qs.push(`per_page=${per_page}`);
        qs.push(`page=${page}`);
        if (opts?.search) qs.push(`search=${encodeURIComponent(opts.search)}`);
        const corePath = `/wp-json/investor-network/v1/invoices?${qs.join('&')}`;
        const mobilePath = `/wp-json/investor-network-mobile/v1/invoices?${qs.join('&')}`;

        // Prefer the mobile-specific invoices endpoint if available (it returns richer data for the app).
        try {
            const mobileRes = await request<any>(mobilePath);
            // If mobile endpoint returns an array, normalize to expected shape
            if (Array.isArray(mobileRes)) {
                return { invoices: mobileRes, total: mobileRes.length, per_page, page } as any;
            }
            // If it returns an object with invoices key, pass through
            if (mobileRes && (mobileRes.invoices || Array.isArray(mobileRes))) return mobileRes;
        } catch (e) {
            // ignore and fall back to core endpoint
        }

        // Fall back to core plugin invoices endpoint
        return request<{ invoices: Invoice[]; total: number; per_page: number; page: number }>(corePath);
    },
    getPaymentsConfig: async () => {
        return request<{ stripe_publishable?: string; paypal_client_id?: string; currency?: string }>(`/wp-json/investor-network/v1/payments/config`);
    },
    uploadWebReceipt: async (invoiceId: string, file: any, comment: string): Promise<Invoice> => {
        const form = new FormData();
        form.append('receipt_file', file);
        form.append('comment', comment);
        return fetch(`${API_BASE}/wp-json/investor-network/v1/invoices/${invoiceId}/upload-receipt`, {
            method: 'POST',
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
            body: form as any,
        }).then(async res => {
            if (!res.ok) throw new Error('Upload failed');
            return res.json();
        });
    },
    // Avatar upload for web client (multipart/form-data). file should be a File object.
    uploadAvatar: async (userId: number, file: File): Promise<{ attachment_id: number; avatar_url: string }> => {
        const form = new FormData();
        form.append('avatar', file as any);
        return fetch(`${API_BASE}/wp-json/investor-network/v1/members/${userId}/avatar`, {
            method: 'POST',
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
            body: form as any,
        }).then(async res => {
            if (!res.ok) {
                const txt = await res.text();
                throw new Error(txt || 'Avatar upload failed');
            }
            return res.json();
        });
    },
    // Change password for the current user. Server will require current_password and new_password.
    changePassword: async (userId: number, currentPassword: string, newPassword: string): Promise<{ success: boolean; message?: string }> => {
        return request<{ success: boolean; message?: string }>(`/wp-json/investor-network/v1/members/${userId}/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
        });
    },
    markInvoiceAsPaid: async (invoiceId: string) => {
        return request<Invoice>(`/wp-json/investor-network/v1/invoices/${invoiceId}/mark-paid`, { method: 'POST' });
    },
    // Other helpers can be implemented similarly
    getUserProfile: async (userId?: number) => request<UserProfile>(`/wp-json/investor-network/v1/members/${userId || 'me'}`),
    getUserSettings: async (userId?: number) => request<UserSettings>(`/wp-json/investor-network/v1/settings`),
        // Fetch the current WP user using the JWT token. Returns WP REST /users/me
        getCurrentWpUser: async (): Promise<any> => {
            return request<any>(`/wp-json/wp/v2/users/me`);
        },
    
    // Admin / other endpoints
    getAllApplications: async (): Promise<Application[]> => {
        return request<Application[]>(`/wp-json/investor-network/v1/applications`);
    },
    updateApplicationStatus: async (appId: number, status: ApplicationStatus): Promise<Application> => {
        return request<Application>(`/wp-json/investor-network/v1/applications/${appId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
    },
    getAnnouncements: async (): Promise<Announcement[]> => {
        return request<Announcement[]>(`/wp-json/investor-network/v1/announcements`);
    },
    getUnreadNotificationsCount: async () => {
        const path = `/wp-json/investor-network/v1/notifications/unread-count`;
        return request<any>(path).then(r => (r && (typeof r.unread === 'number')) ? Number(r.unread) : 0);
    },
    getNotificationsSummary: async (opts?: { per_page?: number }) => {
        const per_page = opts?.per_page ?? 3;
        const path = `/wp-json/investor-network/v1/notifications/summary?per_page=${per_page}`;
        return request<any>(path).then(r => ({ unread: (r && typeof r.unread === 'number') ? Number(r.unread) : 0, recent: (r && Array.isArray(r.recent)) ? r.recent : [] }));
    },
    // Notifications
    getNotifications: async (opts?: { per_page?: number }) => {
        const per_page = opts?.per_page ?? 50;
        const path = `/wp-json/investor-network/v1/notifications?per_page=${per_page}`;
        return request<any>(path).then(r => (r && r.notifications) ? r.notifications : []);
    },
    markNotificationRead: async (id: number) => {
        return request<any>(`/wp-json/investor-network/v1/notifications/${id}/mark-read`, { method: 'POST' });
    },
    markAllNotificationsRead: async () => {
        return request<any>(`/wp-json/investor-network/v1/notifications/mark-all-read`, { method: 'POST' });
    },
    deleteNotification: async (id: number) => {
        return request<any>(`/wp-json/investor-network/v1/notifications/${id}/delete`, { method: 'POST' });
    },
    archiveNotification: async (id: number) => {
        return request<any>(`/wp-json/investor-network/v1/notifications/${id}/archive`, { method: 'POST' });
    },
    // Meetings endpoints
    // Returns { meetings: any[], total: number }
    getMeetings: async (opts?: { per_page?: number; page?: number; status?: string; search?: string; year?: string; month?: string }) => {
        const per_page = opts?.per_page ?? 50;
        const page = opts?.page ?? 1;
        const status = opts?.status ?? '';
        const qs: string[] = [];
        qs.push(`per_page=${per_page}`);
        qs.push(`page=${page}`);
        if (status) qs.push(`status=${encodeURIComponent(status)}`);
        if (opts?.search) qs.push(`search=${encodeURIComponent(opts.search)}`);
        if (opts?.year) qs.push(`year=${encodeURIComponent(opts.year)}`);
        if (opts?.month) qs.push(`month=${encodeURIComponent(opts.month)}`);
        const path = `/wp-json/investor-network/v1/meetings?${qs.join('&')}`;
        const res = await request<any>(path);
        // Normalize: older endpoints return { value: [...] } or { meetings: [...] } or plain array
        const meetings = Array.isArray(res) ? res : (res.meetings || res.value || []);
        const total = Number(res.Count || res.total || meetings.length || 0);
        return { meetings, total };
    },
    rsvpMeeting: async (meetingId: number, status: 'attending' | 'not_attending' | 'maybe') => {
        const path = `/wp-json/investor-network/v1/meetings/${meetingId}/rsvp`;
        return request<any>(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
    },
    // Net income summary for current user. Optional date_from/date_to (YYYY-MM-DD)
    getNetIncomeSummary: async (params?: { date_from?: string; date_to?: string }) => {
        const qs: string[] = [];
        if (params?.date_from) qs.push(`date_from=${encodeURIComponent(params.date_from)}`);
        if (params?.date_to) qs.push(`date_to=${encodeURIComponent(params.date_to)}`);
        const path = `/wp-json/investor-network/v1/net-income${qs.length ? ('?' + qs.join('&')) : ''}`;
        return request<{ rows: any[]; totals: any }>(path);
    },
    getMemberPortfolio: async (opts?: { per_page?: number; page?: number; sort_key?: string; sort_dir?: 'asc' | 'desc'; search?: string; type?: 'summary' | 'holdings' | 'transactions' | 'charts' | 'all' }) => {
        const qs: string[] = [];
        if (opts?.per_page) qs.push(`per_page=${opts.per_page}`);
        if (opts?.page) qs.push(`page=${opts.page}`);
        if (opts?.sort_key) qs.push(`sort_key=${encodeURIComponent(opts.sort_key)}`);
        if (opts?.sort_dir) qs.push(`sort_dir=${encodeURIComponent(opts.sort_dir)}`);
        if (opts?.search) qs.push(`search=${encodeURIComponent(opts.search)}`);
        if (opts?.type) qs.push(`type=${encodeURIComponent(opts.type)}`);
        const path = `/wp-json/investor-network/v1/members/me/portfolio${qs.length ? ('?' + qs.join('&')) : ''}`;
        return request<any>(path);
    },
    getSellRequests: async (userId: number) => {
        const path = `/wp-json/investor-network/v1/members/${userId}/sell-requests`;
        return request<any>(path).then(r => (r && (r.sell_requests || r.value || [])) || []);
    },
    // Submit sell shares request via admin-ajax.php (AJAX handler). Expects payload: { items: Array<{ id: number|string, quantity: number, price?: string }>, listing_payment_method?: string, description?: string, redirect_to?: string }
    submitSellShares: async (payload: { items: Array<{ id: number | string; quantity: number; price?: string }>; listing_payment_method?: string; description?: string; redirect_to?: string; nonce?: string }) => {
        // If we have an auth token, prefer the REST endpoint which accepts JWT/Bearer tokens
        const restBody = {
            items: payload.items || [],
            listing_payment_method: payload.listing_payment_method || '',
            description: payload.description || '',
            redirect_to: payload.redirect_to || '',
        };
        if (authToken) {
            try {
                return await request<any>(`/wp-json/investor-network/v1/sell-shares`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(restBody),
                });
            } catch (e) {
                console.debug('REST sell-shares failed, falling back to admin-ajax:', e);
                // fallthrough to admin-ajax fallback
            }
        }

        // Fallback: post to admin-ajax.php (form-encoded) for environments without token auth
        const body = new URLSearchParams();
        body.append('action', 'investor_network_sell_shares_ajax');
        if (payload.description) body.append('sell_description', String(payload.description));
        if (payload.listing_payment_method) body.append('listing_payment_method', String(payload.listing_payment_method));
        if (payload.redirect_to) body.append('redirect_to', String(payload.redirect_to));
        if (payload.nonce) body.append('investor_network_sell_shares_nonce', String(payload.nonce));
        (payload.items || []).forEach((it: any) => {
            body.append('sell_qty[' + String(it.id) + ']', String(it.quantity));
            if (it.price !== undefined) body.append('sell_price[' + String(it.id) + ']', String(it.price));
        });

        const path = `/wp-admin/admin-ajax.php`;
        const res = await fetch(`${API_BASE}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
            credentials: 'include',
        });
        const txt = await res.text();
        try {
            const j = JSON.parse(txt);
            if (!res.ok) throw new Error(j && j.data ? (j.data || j.message || JSON.stringify(j)) : (j.message || res.statusText));
            return j;
        } catch (e) {
            if (!res.ok) throw new Error(txt || 'Sell request failed');
            return txt;
        }
    },
    getApplicationStatus: async (userId: number): Promise<Application> => {
        return request<Application>(`/wp-json/investor-network/v1/applications/${userId}`);
    },
    getQuiz: async (): Promise<Quiz> => {
        return request<Quiz>(`/wp-json/investor-network/v1/quiz`);
    },
    // Fetch the current authenticated user's dashboard. Use the `/members/me/dashboard`
    // route to avoid accidental cross-user requests which the server rejects with 403.
    getMemberDashboardData: async (userId?: number): Promise<MemberDashboardData> => {
        return request<MemberDashboardData>(`/wp-json/investor-network/v1/members/me/dashboard`);
    },
    // Ledger endpoints
    getLedgerLines: async (from?: string, to?: string) => {
        const qs = [] as string[];
        if (from) qs.push(`from=${encodeURIComponent(from)}`);
        if (to) qs.push(`to=${encodeURIComponent(to)}`);
        const path = `/wp-json/investor-network/v1/ledger/lines${qs.length ? ('?' + qs.join('&')) : ''}`;
        return request<any[]>(path);
    },
    getLedgerMonthly: async (months = 6) => {
        return request<{ labels: string[]; data: number[] }>(`/wp-json/investor-network/v1/ledger/monthly?months=${months}`);
    },
    getLedgerExportUrl: async (from?: string, to?: string) => {
        const qs = [] as string[];
        if (from) qs.push(`from=${encodeURIComponent(from)}`);
        if (to) qs.push(`to=${encodeURIComponent(to)}`);
        const path = `/wp-json/investor-network/v1/ledger/export${qs.length ? ('?' + qs.join('&')) : ''}`;
        return request<{ export_url: string }>(path).then(r => r.export_url);
    },
    // Cashflow endpoints - use the same REST API as the web shortcode ('im/v1') so the mobile UI shows the same data
    getCashflowSummary: async (params?: { from?: string; to?: string }) => {
        // Prefer user-specific shortcode route (im/v1). If it returns empty, fall back to the general endpoint
        const qs = [] as string[];
        if (params?.from) qs.push(`from=${encodeURIComponent(params.from)}`);
        if (params?.to) qs.push(`to=${encodeURIComponent(params.to)}`);
        const shortcodePath = `/wp-json/im/v1/cashflow/my-proposals${qs.length ? ('?' + qs.join('&')) : ''}`;
        try {
            const res = await request<{ labels: string[]; datasets: Array<{ label: string; data: number[] }>; rows: any[] }>(shortcodePath);
            const empty = (!res || (!Array.isArray(res.rows) || res.rows.length === 0) && (!Array.isArray(res.labels) || res.labels.length === 0));
            if (!empty) return res;
        } catch (e) {
            // ignore and try fallback
            console.debug('shortcode cashflow fetch failed, falling back:', (e as any)?.message || e);
        }
        // Fallback: use the general plugin API (returns sample/all proposals)
        const fallbackPath = `/wp-json/investor-network/v1/cashflow/summary${qs.length ? ('?' + qs.join('&')) : ''}`;
        return request<{ value?: any[]; labels?: string[]; datasets?: any[]; rows?: any[] }>(fallbackPath).then(r => {
            // Normalize the fallback response into { labels, datasets, rows }
            if ((r as any).rows && Array.isArray((r as any).rows)) return { labels: (r as any).labels || [], datasets: (r as any).datasets || [], rows: (r as any).rows };
            // older endpoint returned { value: [...] } where each item has monthly_cashflow/annual_cashflow
            const value = (r as any).value || [];
            const labels = value.map((v: any) => v.title || `P${v.id}`);
            const datasets = [{ label: 'Annual', data: value.map((v: any) => Number(v.annual_cashflow || 0)) }];
            const rows = value.map((v: any) => ({ proposal_id: v.id, proposal: v.title, operating_total: 0, investing_total: 0, financing_total: 0, my_contributions: 0, my_refunds: 0, my_sales: 0, net: Number(v.annual_cashflow || 0) }));
            return { labels, datasets, rows };
        });
    },
    getCashflowProposalSeries: async (proposalId: number, params?: { from?: string; to?: string }) => {
        const qs = [] as string[];
        if (params?.from) qs.push(`from=${encodeURIComponent(params.from)}`);
        if (params?.to) qs.push(`to=${encodeURIComponent(params.to)}`);
        const path = `/wp-json/im/v1/cashflow/my-proposal/${proposalId}${qs.length ? ('?' + qs.join('&')) : ''}`;
        return request<{ series: Array<{ period_year: number; period_month: number; op: number; iv: number; fi: number; my_contributions?: number; my_refunds?: number; my_distributions?: number; my_sales?: number; net?: number }> }>(path);
    },
    // Affiliate endpoints
    getAffiliateStats: async () => {
        return request<any>(`/wp-json/investor-network/v1/affiliates/stats`);
    },
    getAffiliates: async (per_page = 20, page = 1, status = '') => {
        return request<any[]>(`/wp-json/investor-network/v1/affiliates/list?per_page=${per_page}&page=${page}${status ? `&status=${encodeURIComponent(status)}` : ''}`);
    },
    getAffiliateCommissions: async (per_page = 20, page = 1) => {
        return request<any[]>(`/wp-json/investor-network/v1/affiliates/commissions?per_page=${per_page}&page=${page}`);
    },
    generateAffiliateLink: async () => {
        return request<{ invite_link: string }>(`/wp-json/investor-network/v1/affiliates/generate`, {
            method: 'POST',
        }).then(r => (r && (r as any).invite_link) || '');
    },
    sendAffiliateInvite: async (email: string, message?: string) => {
        return request<{ success: boolean }>(`/wp-json/investor-network/v1/affiliates/send-invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, message }),
        });
    },
    // Fetch proposal/calculator data via WP admin-ajax (shortcode AJAX handler)
    getProposalData: async (proposalId: number, nonce?: string): Promise<any> => {
        const body = new URLSearchParams();
        body.append('action', 'get_proposal_data');
        body.append('proposal_id', String(proposalId));
        if (nonce) body.append('nonce', nonce);

        // admin-ajax.php lives under the WP installation root. API_BASE already resolves to the WP origin + '/word' in this workspace.
        const path = `/wp-admin/admin-ajax.php?action=get_proposal_data`;
        const res = await fetch(`${API_BASE}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
            credentials: 'include',
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json && json.data ? (json.data || json) : (json.message || res.statusText));
        // WP returns { success: true, data: {...} } for wp_send_json_success
        return json.success ? json.data : Promise.reject(json.data || json);
    },
    // Fetch proposal details via REST API (preferred: avoids admin-ajax nonce requirement)
    getProposalDetails: async (proposalId: number): Promise<any> => {
        try {
            const data = await request<any>(`/wp-json/investor-network/v1/proposals/${proposalId}`);
            // Normalize REST response into calculator-friendly shape if needed
            if (data && (data.share_price !== undefined && data.share_price !== null)) {
                return data;
            }
            if (data && data.id) {
                const investment_amount = Number((data as any).investment_amount || 0);
                const expected_roi = Number((data as any).expected_roi || 0);
                const total_shares = 1000;
                const share_price = total_shares ? investment_amount / total_shares : 0;
                return {
                    investment_amount,
                    expected_roi,
                    share_price,
                    total_shares,
                    timeline: (data as any).timeline,
                    title: (data as any).title,
                    category: (data as any).category,
                    risk_level: (data as any).risk_level,
                };
            }
            return data;
        } catch (e) {
            // If REST route not available, fall back to admin-ajax method
            return apiService.getProposalData(proposalId);
        }
    },
    getProposalAttachments: async (proposalId: number): Promise<Array<{ title: string; url: string }>> => {
        try {
            const path = `/wp-json/investor-network/v1/proposals/${proposalId}/attachments`;
                const res = await request<any>(path);
            // Expect an array of { title, url }
            if (Array.isArray(res)) return res;
            return (res && Array.isArray(res)) ? res : [];
        } catch (e) {
            // Fail gracefully and return empty array
            console.debug('getProposalAttachments failed', e);
            return [];
        }
    },
        // Documents (member documents exposed by the main plugin via REST)
        getDocuments: async (opts?: { per_page?: number; page?: number }) => {
            const per_page = opts?.per_page ?? 100;
            const page = opts?.page ?? 1;
            const path = `/wp-json/investor-network/v1/documents?per_page=${per_page}&page=${page}`;
            return request<any>(path).then(r => {
                if (!r) return { documents: [], count: 0 };
                const docs = Array.isArray(r.documents) ? r.documents : (Array.isArray(r.value) ? r.value : (Array.isArray(r.rows) ? r.rows : []));
                return { documents: docs, count: Number(r.count || docs.length || 0) };
            });
        },
    // Submit a vote for a proposal. vote should be one of 'yes'|'no'|'abstain'
    submitProposalVote: async (proposalId: number, vote: 'yes' | 'no' | 'abstain') => {
        const path = `/wp-json/investor-network/v1/proposals/${proposalId}/vote`;
        return request<any>(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vote }),
        });
    },
    makeContributionPayment: async (userId: number, amount: number): Promise<{ success: boolean; newBalance: number; newTransaction: Transaction }> => {
        return request<{ success: boolean; newBalance: number; newTransaction: Transaction }>(`/wp-json/investor-network/v1/contributions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, amount }),
        });
    },
    // Get member contributions (summary + list)
    getMemberContributions: async (memberId: number) => {
        return request<{ summary: any; contributions: any[] }>(`/wp-json/investor-network/v1/contributions/member/${memberId}`);
    },
    // Download a contribution receipt as a blob and return an object URL
    downloadContributionReceipt: async (contributionId: number) => {
        const path = `/wp-json/investor-network/v1/contributions/${contributionId}/receipt`;
        const res = await fetch(`${API_BASE}${path}`, {
            method: 'GET',
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
            credentials: 'include',
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt || 'Failed to download receipt');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        return { url, blob };
    },
    // Download invoice/receipt (returns { url, blob } for client-side consumption)
    downloadInvoiceReceipt: async (invoiceId: number) => {
        const path = `/wp-json/investor-network/v1/invoices/${invoiceId}/receipt`;
        const res = await fetch(`${API_BASE}${path}`, {
            method: 'GET',
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
            credentials: 'include',
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt || 'Failed to download invoice');
        }
        // If server returned JSON with html (fallback), handle as text
        const contentType = res.headers.get('content-type') || '';
        if (contentType.indexOf('application/json') !== -1) {
            const j = await res.json();
            if (j && j.html) {
                const blob = new Blob([j.html], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                return { url, blob };
            }
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        return { url, blob };
    },
    // Create a Stripe PaymentIntent for an invoice and return client secret
    createInvoiceStripeIntent: async (invoiceId: number) => {
        const path = `/wp-json/investor-network/v1/invoices/${invoiceId}/stripe-intent`;
        return request<{ client_secret?: string; payment_intent_id?: string }>(path, { method: 'POST' });
    },
    // Finalize an invoice after payment (mark completed)
    finalizeInvoice: async (invoiceId: number, transactionId?: string) => {
        const path = `/wp-json/investor-network/v1/invoices/${invoiceId}/finalize`;
        return request<any>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transaction_id: transactionId || '' }) });
    },
    getPolls: async (): Promise<Poll[]> => request<Poll[]>(`/wp-json/investor-network/v1/polls`),
    submitVote: async (pollId: number, optionId: number): Promise<Poll> => request<Poll>(`/wp-json/investor-network/v1/polls/${pollId}/vote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ option_id: optionId }),
    }),
    updateUserProfile: async (userId: number, data: UserProfile): Promise<UserProfile> => request<UserProfile>(`/wp-json/investor-network/v1/members/${userId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }),
    updateUserSettings: async (userId: number, data: UserSettings): Promise<UserSettings> => request<UserSettings>(`/wp-json/investor-network/v1/settings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }),
};