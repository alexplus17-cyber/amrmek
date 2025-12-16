export type RootStackParamList = {
  Login: undefined;
  Listings: undefined;
  Purchase: { listingId: number };
  ListingDetail: { listingId: number };
  UploadReceipt: { invoiceId: string };
  BankDetails: { listingId: number, quantity: number };
  Invoices: undefined;
  Profile: undefined;
  Settings: undefined; // New Settings route
  Dashboard: undefined;
  Calculator: undefined;
  Documents: undefined;
  Notifications: undefined;
  Announcements: undefined;
  Affiliate: undefined;
  Sell: undefined;
  Portfolio: undefined;
  Ledger: undefined;
  Payments: undefined;
  Proposals: undefined;
  Activity: undefined;
  Meetings: undefined;
  Support: undefined;
};