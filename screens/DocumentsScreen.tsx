import React, { useEffect, useMemo, useState, useRef } from 'react';
import { apiService } from '../services/apiService';
import Card from '../components/Card';
import Spinner from '../components/Spinner';
import Button from '../components/Button';

const DocumentsScreen: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [documents, setDocuments] = useState<Array<any>>([]);
    const [error, setError] = useState<string | null>(null);

    // Filters & pagination
    const [search, setSearch] = useState<string>('');
    const [category, setCategory] = useState<string>('');
    const [year, setYear] = useState<string>('');
    const [perPage, setPerPage] = useState<number>(10);
    const [page, setPage] = useState<number>(1);
    const searchTimer = useRef<number | null>(null);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        // Request a reasonable per_page (server limits may apply) to allow client-side filtering & pagination
        apiService.getDocuments({ per_page: 100 }).then(res => {
            if (!mounted) return;
            setDocuments(res.documents || []);
        }).catch(err => {
            console.error('Failed to load documents', err);
            if (!mounted) return;
            setError(err && (err.message || String(err)) || 'Failed to load documents');
        }).finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, []);

    const handleOpen = (doc: any) => {
        if (!doc || !doc.file_url) return;
        try {
            window.open(doc.file_url, '_blank');
        } catch (e) {
            // fallback: navigate
            window.location.href = doc.file_url;
        }
    };

    const resetFilters = () => {
        setSearch('');
        setCategory('');
        setYear('');
        setPage(1);
    };

    // Derived lists
    const availableCategories = useMemo(() => {
        const cats = new Set<string>();
        documents.forEach(d => { if (d.category) cats.add(String(d.category)); });
        return Array.from(cats).sort();
    }, [documents]);

    const availableYears = useMemo(() => {
        const years = new Set<string>();
        documents.forEach(d => {
            if (!d.created_at) return;
            try {
                const y = String((new Date(d.created_at)).getFullYear());
                if (y && y !== 'NaN') years.add(y);
            } catch (e) {
                // ignore
            }
        });
        return Array.from(years).sort().reverse();
    }, [documents]);

    // Debounced search handler to avoid frequent re-rendering while typing
    const handleSearchChange = (v: string) => {
        if (searchTimer.current) window.clearTimeout(searchTimer.current);
        searchTimer.current = window.setTimeout(() => {
            setSearch(v);
            setPage(1);
        }, 250);
    };

    const filtered = useMemo(() => {
        const q = (search || '').trim().toLowerCase();
        let rows = documents.slice();
        if (q) {
            rows = rows.filter(d => ((d.title || '') + ' ' + (d.description || '') + ' ' + (d.file_name || '')).toLowerCase().indexOf(q) !== -1);
        }
        if (category) rows = rows.filter(d => String(d.category || '') === String(category));
        if (year) rows = rows.filter(d => {
            if (!d.created_at) return false;
            try { return String((new Date(d.created_at)).getFullYear()) === String(year); } catch (e) { return false; }
        });
        return rows;
    }, [documents, search, category, year]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    const paginated = useMemo(() => {
        const start = (page - 1) * perPage;
        return filtered.slice(start, start + perPage);
    }, [filtered, page, perPage]);

    return (
        <div className="p-4">
            <h1 className="text-2xl font-semibold">Documents</h1>
            <p className="text-sm text-secondary-500">Access member documents and resources.</p>
            <div className="mt-4">
                <Card>
                    {loading ? <Spinner /> : (
                        error ? <div className="text-red-600">{error}</div> : (
                            <div className="space-y-3">
                                {/* Filters */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 space-y-2 sm:space-y-0 mb-2">
                                    <input
                                        className="im-input flex-1"
                                        placeholder="Search documents..."
                                        defaultValue={search}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                        aria-label="Search documents"
                                    />
                                    <select className="im-select" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
                                        <option value="">All Categories</option>
                                        {['reports','presentations','financials','legal'].map(c => (
                                            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                                        ))}
                                        {availableCategories.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                    <select className="im-select" value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }}>
                                        <option value="">All Years</option>
                                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                    <Button variant="outline" onClick={resetFilters}>Reset</Button>
                                </div>

                                {/* Per-page & pagination controls */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <label className="text-sm">Per page:</label>
                                        <select className="im-select" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
                                            {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                        <div className="text-sm text-secondary-500">{filtered.length} results</div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Button onClick={() => setPage(p => Math.max(1, p-1))} variant="outline" disabled={page<=1}>Prev</Button>
                                        <div className="text-sm">Page {page} / {totalPages}</div>
                                        <Button onClick={() => setPage(p => Math.min(totalPages, p+1))} variant="outline" disabled={page>=totalPages}>Next</Button>
                                    </div>
                                </div>

                                {paginated.length === 0 && <div className="text-sm text-secondary-600">No documents available.</div>}
                                {paginated.map((d: any) => (
                                    <div key={String(d.id)} className="flex items-center justify-between p-2 border rounded">
                                        <div>
                                            <div className="font-medium">{d.title || d.file_name || 'Untitled'}</div>
                                            <div className="text-xs text-secondary-500">{d.description || d.category || ''}</div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Button onClick={() => handleOpen(d)} variant="outline">Open</Button>
                                            {d.file_url && (
                                                <a href={d.file_url} target="_blank" rel="noreferrer" className="text-sm text-primary-600">Download</a>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Pagination numeric quicklinks */}
                                <div className="flex items-center space-x-2 justify-center mt-3">
                                    {Array.from({ length: totalPages }).map((_, i) => {
                                        const p = i + 1;
                                        return (
                                            <button key={p} className={`im-btn im-btn-sm ${p===page ? 'active' : ''}`} onClick={() => setPage(p)} aria-current={p===page}>{p}</button>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    )}
                </Card>
            </div>
        </div>
    );
};

export default DocumentsScreen;
