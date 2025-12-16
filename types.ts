

export enum UserRole {
    APPLICANT = 'applicant',
    MEMBER = 'member',
    ADMIN = 'administrator',
}

export interface User {
    id: number;
    username: string;
    email: string;
    role: UserRole;
    token: string;
    refreshToken?: string;
    avatar_url?: string;
}

export interface UserProfile {
    username: string;
    email: string;
    id?: number;
    first_name?: string;
    last_name?: string;
    display_name?: string;
    fullName?: string;
    bio?: string;
    // Contact and company fields (match shortcode keys)
    phone?: string;
    location?: string;
    linkedin_profile?: string;
    company_name?: string;
    industry?: string;
    role_title?: string;
    team_size?: string | number;
    annual_revenue?: string | number;
    website?: string;
    // Address
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    investor_gender?: string;
    avatar_url?: string;
}

export interface UserSettings {
    enableEmailNotifications: boolean;
    enablePushNotifications: boolean;
    notificationTopics: {
        newInvestments: boolean;
        qnaUpdates: boolean;
        monthlyDigest: boolean;
    };
}

export enum ApplicationStatus {
    PENDING = 'Pending',
    APPROVED = 'Approved',
    REJECTED = 'Rejected',
    IN_PROGRESS = 'In Progress',
}

export interface Application {
    id: number;
    userId: number;
    username: string;
    status: ApplicationStatus;
    submittedDate: string;
}

export interface Transaction {
    id: string;
    date: string;
    amount: number;
    description: string;
    status: 'Completed' | 'Pending' | 'Failed';
}

export enum InvoiceStatus {
    PENDING_BANK_TRANSFER = 'Pending Bank Transfer',
    PENDING_CONFIRMATION = 'Pending Confirmation',
    PAID_PENDING_VERIFICATION = 'Paid - Pending Verification',
    COMPLETED = 'Completed',
    FAILED = 'Failed',
}

export interface Invoice {
    id: string;
    listingName: string;
    date: string;
    amount: number;
    status: InvoiceStatus;
}

// FIX: Add MemberDashboardData interface to be shared across components.
export interface MemberDashboardData {
    transactions: Transaction[];
    contributionBalance: number;
    contributionRequirement: number;
    contributionStatus: 'required' | 'paid';
    groupStats: {
        totalMembers: number;
        totalInvested: number;
    };
}


export interface Poll {
    id: number;
    question: string;
    options: { id: number; text: string; votes: number }[];
    isOpen: boolean;
    totalVotes: number;
}

export interface QuizQuestion {
    id: number;
    question: string;
    options: string[];
    correctAnswer: string;
}

export interface Quiz {
    id: number;
    title: string;
    questions: QuizQuestion[];
}

export interface Announcement {
    id: number;
    title: string;
    content: string;
    date: string;
}

export interface Listing {
  id: number;
  title: string;
  summary: string;
  description: string;
  price: number;
  availability: number;
  image: string;
    // optional server-provided seller info
    seller_user_id?: number;
    seller_display_name?: string;
    seller_avatar_url?: string;
    // normalized price keys from server
    price_per_share?: number;
    unit_price?: number;
    currency?: string;
        // Additional optional aliases and fields used across the codebase
        proposal_id?: number;
        proposalId?: number;
        proposal?: number;
        seller_id?: number;
        seller?: number | string;
        items_json?: any;
        itemsJson?: any;
        meta_json?: any;
        metaJson?: any;
        items?: any;
        available_quantity?: number;
        available_qty?: number;
        qty?: number;
        quantity?: number;
        unitPrice?: number;
        unitPriceValue?: number;
        value?: any;
        // allow other unknown server fields without breaking type checks
        [key: string]: any;
}