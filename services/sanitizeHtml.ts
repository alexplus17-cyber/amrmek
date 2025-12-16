// Lightweight HTML sanitizer to remove unsafe elements and attributes.
// Not a full replacement for a vetted library like DOMPurify, but sufficient
// for our use-case to strip scripts, iframes and on* handlers before rendering.
export default function sanitizeHtml(html: string): string {
    if (!html) return '';
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Remove dangerous elements
        const dangerous = doc.querySelectorAll('script, style, iframe, object, embed, link, meta');
        dangerous.forEach(n => n.remove());

        // Remove event handler attributes and javascript: URLs
        const all = doc.getElementsByTagName('*');
        for (let i = 0; i < all.length; i++) {
            const el = all[i] as Element;
            // Copy attributes first to avoid live mutation issues
            const attrs = Array.from(el.attributes).map(a => ({ name: a.name, value: a.value }));
            attrs.forEach(a => {
                const name = a.name.toLowerCase();
                const value = (a.value || '').toString();
                // Remove any on* handlers
                if (name.startsWith('on')) {
                    el.removeAttribute(a.name);
                    return;
                }
                // Remove javascript: protocol in href/src
                if ((name === 'href' || name === 'src') && value.trim().toLowerCase().startsWith('javascript:')) {
                    el.removeAttribute(a.name);
                    return;
                }
                // Remove style attributes to avoid css injection
                if (name === 'style') {
                    el.removeAttribute(a.name);
                    return;
                }
            });
        }

        // Return sanitized innerHTML of body
        return doc.body.innerHTML || '';
    } catch (e) {
        // On error, return an escaped fallback
        return '';
    }
}
