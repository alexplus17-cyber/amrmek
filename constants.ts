
// During local development this should point to your WordPress site URL.
// In this workspace the WP site is served from XAMPP at `/word`, so use that.
// Use localhost hostname to match typical XAMPP local setup and mobile emulator mapping
export const API_BASE_URL = 'http://10.0.2.2/word';

export const API_ENDPOINTS = {
    LOGIN: '/wp-json/jwt-auth/v1/token',
    REGISTER: '/wp-json/investor/v1/register',
    APPLY: '/wp-json/investor/v1/apply',
    UPLOAD_DOC: '/wp-json/investor/v1/upload-doc',
    QUIZ: '/wp-json/investor/v1/quiz',
    PAYMENTS: '/wp-json/investor/v1/payments',
    POLLS: '/wp-json/investor/v1/polls',
    VOTE: '/wp-json/investor/v1/vote',
    ANNOUNCEMENTS: '/wp-json/investor/v1/announcements',
    ADMIN_APPLICATIONS: '/wp-json/investor/v1/admin/applications',
};
