// Local mobile constants for the Expo/mobile project
// Matches the root `constants.ts` used by the web SPA but scoped inside `mobile/`
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
