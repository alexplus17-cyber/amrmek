import React, { useEffect, useState, useRef } from 'react';

interface ExternalPageScreenProps {
    path: string;
}

const resolveFullUrl = (path: string) => {
    if (!path) return '';
    // If absolute URL, return as-is
    if (/^(https?:)?\/\//i.test(path)) return path;

    const origin = window.location.origin;
    const hasPort = /:\d+$/.test(origin);
    const normalizedPath = path.startsWith('/') ? path : '/' + path;

    if (hasPort) {
        const wpOrigin = origin.replace(/:\d+$/, '');
        if (normalizedPath.startsWith('/word')) {
            return wpOrigin + normalizedPath;
        }
        return wpOrigin + '/word' + normalizedPath;
    }
    return origin + normalizedPath;
};

const ExternalPageScreen: React.FC<ExternalPageScreenProps> = ({ path }) => {
    const url = resolveFullUrl(path);
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    useEffect(() => {
        setLoaded(false);
        setFailed(false);
        if (!url) return;
        // If iframe doesn't fire load within 2000ms, show fallback (likely X-Frame-Options)
        const t = setTimeout(() => {
            if (!loaded) setFailed(true);
        }, 2000);
        return () => clearTimeout(t);
    }, [url]);

    if (!url) return <p>No external path provided.</p>;

    return (
        <div className="min-h-screen">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold">External Page</h1>
                <div />
            </div>
            <div style={{ height: '80vh', border: '1px solid #e5e7eb', position: 'relative' }}>
                {!failed && (
                    <iframe
                        ref={iframeRef}
                        src={url}
                        title="External Page"
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        onLoad={() => { setLoaded(true); setFailed(false); }}
                        onError={() => { setFailed(true); }}
                    />
                )}
                {failed && (
                    <div className="p-6">
                        <p className="mb-4">This page could not be displayed inside the app (it may disallow embedding).</p>
                        <div className="flex items-center space-x-2">
                            <a href={url} target="_blank" rel="noreferrer noopener">
                                <button className="px-4 py-2 bg-primary-600 text-white rounded">Open in new tab</button>
                            </a>
                            <button className="px-4 py-2 border rounded" onClick={() => { window.location.href = url; }}>Open in same tab</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExternalPageScreen;
