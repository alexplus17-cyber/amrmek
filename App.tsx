
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MemberDashboard from './screens/MemberDashboard';
import LoginScreen from './screens/LoginScreen';
import SubscribeScreen from './screens/SubscribeScreen';
import ErrorBoundary from './components/ErrorBoundary';
import ApplicantDashboard from './screens/ApplicantDashboard';
import AdminDashboard from './screens/AdminDashboard';
import { UserRole } from './types';
import Header from './components/Header';
import CashFlowScreen from './screens/CashFlowScreen';
import ExternalPageScreen from './screens/ExternalPageScreen';
import ProposalDetailScreen from './screens/ProposalDetailScreen';
import CalculatorScreen from './screens/CalculatorScreen';
import AffiliateScreen from './screens/AffiliateScreen';
import LedgerScreen from './screens/LedgerScreen';
import AnnouncementsScreen from './screens/AnnouncementsScreen';
import ContributionsScreen from './screens/ContributionsScreen';
import Spinner from './components/Spinner';
import { ThemeProvider } from './contexts/ThemeContext';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import Button from './components/Button';
import Input from './components/Input';
import Card from './components/Card';
import InvestmentsScreen from './screens/InvestmentsScreen';
import InvestmentDetailScreen from './screens/InvestmentDetailScreen';
import PurchaseSharesScreen from './screens/PurchaseSharesScreen';
import PaymentsScreen from './screens/PaymentsScreen';
import PaymentsDashboardScreen from './screens/PaymentsDashboardScreen';
import MemberPortfolioScreen from './screens/MemberPortfolioScreen';
import MeetingsScreen from './screens/MeetingsScreen';
import NetIncomeScreen from './screens/NetIncomeScreen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './contexts/ToastContext';

// Create a client
const queryClient = new QueryClient();


// Use the shared `LoginScreen` component from `./screens/LoginScreen`


type View = 'dashboard' | 'profile' | 'settings' | 'investments' | 'investmentDetail' | 'billing' | 'cashflow' | 'external' | 'calculator' | 'ledger' | 'affiliate' | 'announcements' | 'contributions' | 'meetings' | 'netincome' | 'payments' | 'portfolio' | 'proposals' | 'proposalDetail' | 'purchaseShares' | 'notifications' | 'documents';
// Add 'sellShares' view for native sell shares screen
type ViewExtend = View | 'sellShares';


const AppContent: React.FC = () => {
    const { user, loading } = useAuth();
    const [view, setView] = useState<ViewExtend>('dashboard');
    const [externalPath, setExternalPath] = useState<string | null>(null);
    const [selectedInvestmentId, setSelectedInvestmentId] = useState<number | null>(null);
    const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 5000); // Hide notification after 5 seconds
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
    };

    const navigateToDetail = (id: number) => {
        setSelectedInvestmentId(id);
        setView('investmentDetail');
    };
    
    const handlePurchaseSuccess = (invoiceId: string) => {
        showNotification(`Investment successful! New invoice #${invoiceId} created.`);
        setView('dashboard'); // Or navigate to invoices screen by setting view to 'billing'
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-secondary-50 dark:bg-secondary-900">
                <div className="w-16 h-16 border-4 border-primary-500 border-dashed rounded-full animate-spin"></div>
            </div>
        );
    }
    
    if (!user) {
        // If the app is opened with #subscribe, render the SPA subscribe screen in-app.
        try {
            if (typeof window !== 'undefined' && window.location && window.location.hash === '#subscribe') {
                return <SubscribeScreen />;
            }
        } catch (e) {}

        return <LoginScreen />;
    }

    const renderDashboard = () => {
        switch (user.role) {
            case UserRole.ADMIN:
                return <AdminDashboard />;
            case UserRole.MEMBER:
                return (
                    <MemberDashboard
                        setView={setView}
                        onSelectInvestment={navigateToDetail}
                        navigateTo={(path: string) => {
                            // Special-case: open sell-shares as a full front-end page (avoid iframe embedding)
                            if (path.indexOf('sell-shares') !== -1) {
                                try {
                                    const origin = window.location.origin;
                                    const wpOrigin = origin.replace(/:\d+$/, '');
                                    const normalizedPath = path.startsWith('/') ? path : '/' + path;
                                    const full = (normalizedPath.startsWith('/word') ? wpOrigin + normalizedPath : wpOrigin + '/word' + normalizedPath);
                                    // Open in same tab to match front-end behavior
                                    window.location.href = full;
                                    return;
                                } catch (e) {
                                    // Fallback to external view if something goes wrong
                                }
                            }
                            // Prefer in-app routing for known internal paths.
                            if (path.indexOf('investment-calculator') !== -1) {
                                // Open the native calculator screen in-app
                                setView('calculator');
                                return;
                            }
                                    if (path.indexOf('investor-announcements') !== -1 || path.indexOf('investor-announcements') !== -1 || path.indexOf('announcements') !== -1) {
                                        setView('announcements');
                                        return;
                                    }
                                            if (path.indexOf('in-cashflow-summary') !== -1 || path.indexOf('cashflow-summary') !== -1 || path.indexOf('cashflow') !== -1) {
                                                setView('cashflow');
                                                return;
                                            }
                                            if (path.indexOf('im-contributions') !== -1 || path.indexOf('im_contributions') !== -1) {
                                                setView('contributions');
                                                return;
                                            }
                                            if (path.indexOf('investor-meetings') !== -1 || path.indexOf('investor_meetings') !== -1 || path.indexOf('investor_meetings') !== -1) {
                                                setView('meetings');
                                                return;
                                            }
                                            if (path.indexOf('in-net-income-summary') !== -1 || path.indexOf('in_net_income_summary') !== -1 || path.indexOf('net-income-summary') !== -1) {
                                                setView('netincome');
                                                return;
                                            }
                                            // Member portfolio should open the native portfolio screen
                                            if (path.indexOf('member-portfolio') !== -1 || path.indexOf('member_portfolio') !== -1) {
                                                setView('portfolio');
                                                return;
                                            }
                                                if (path.indexOf('investor-payments-dashboard') !== -1 || path.indexOf('investor_payments_dashboard') !== -1 || path.indexOf('investor-payments') !== -1) {
                                                    setView('payments');
                                                    return;
                                                }
                            // Let unknown or specific internal paths fall through to external view
                            if (path.indexOf('investor-affiliate-dashboard') !== -1 || path.indexOf('investor_affiliate_dashboard') !== -1) {
                                setView('affiliate');
                                return;
                            }
                                    if (path.indexOf('ledger-account') !== -1 || path.indexOf('ledger_account') !== -1) {
                                        setView('ledger');
                                        return;
                                    }
                            // Unknown path: attempt to open inside the app using the ExternalPageScreen
                            setExternalPath(path);
                            setView('external');
                            return;
                        }}
                    />
                );
            case UserRole.APPLICANT:
                return <ApplicantDashboard />;
            default:
                return <LoginScreen />;
        }
    };
    
    const renderContent = () => {
        switch(view) {
            case 'dashboard':
                return renderDashboard();
            case 'profile':
                return <ProfileScreen />;
            case 'settings':
                return <SettingsScreen />;
            case 'billing':
                return <PaymentsScreen />;
                case 'payments':
                    return <PaymentsDashboardScreen navigateBack={() => setView('dashboard')} />;
            case 'investments':
                return <InvestmentsScreen onSelectInvestment={navigateToDetail} />;
            case 'cashflow':
                return <CashFlowScreen />;
            case 'affiliate':
                return <AffiliateScreen />;
            case 'ledger':
                return <LedgerScreen />;
            case 'contributions':
                return <ContributionsScreen />;
            case 'meetings':
                return <MeetingsScreen />;
                    case 'netincome':
                        return <NetIncomeScreen />;
                    case 'portfolio':
                        return <MemberPortfolioScreen navigateBack={() => setView('dashboard')} />;
                    case 'proposals':
                                        return (
                                            <ErrorBoundary fallback={
                                                <div>
                                                    <h2 className="text-xl font-semibold">Proposals</h2>
                                                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded mt-3">
                                                        <p className="text-sm text-secondary-700 dark:text-secondary-300">An error occurred while rendering proposals. See console for details.</p>
                                                        <div className="mt-3 flex items-center space-x-2">
                                                            <Button onClick={() => window.location.reload()}>Reload</Button>
                                                            <Button onClick={() => setView('dashboard')} variant="secondary">Back</Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            }>
                                                <ProposalsLoader onBack={() => setView('dashboard')} />
                                            </ErrorBoundary>
                                        );
            case 'announcements':
                return <AnnouncementsScreen />;
            case 'sellShares':
                // Lazy-load SellSharesScreen to avoid bundler issues
                try {
                    const SellShares = React.lazy(() => import('./screens/SellSharesScreen'));
                    return (
                        <React.Suspense fallback={<div className="p-6"><Spinner /></div>}>
                            <SellShares navigateBack={() => setView('dashboard')} />
                        </React.Suspense>
                    );
                } catch (e) {
                    return <div className="p-4">Unable to load Sell Shares screen right now.</div>;
                }
            case 'purchaseShares':
                try {
                    const PurchaseShares = React.lazy(() => import('./screens/PurchaseSharesScreen'));
                    return (
                        <React.Suspense fallback={<div className="p-6"><Spinner /></div>}>
                            <PurchaseShares navigateBack={() => setView('dashboard')} onPurchaseSuccess={(invoiceId: string) => handlePurchaseSuccess(invoiceId)} />
                        </React.Suspense>
                    );
                } catch (e) {
                    return <div className="p-4">Unable to load Purchase Shares screen right now.</div>;
                }
            case 'notifications':
                try {
                    const Notifications = React.lazy(() => import('./screens/NotificationsScreen'));
                    return (
                        <React.Suspense fallback={<div className="p-6"><Spinner /></div>}>
                            <Notifications />
                        </React.Suspense>
                    );
                } catch (e) {
                    return <div className="p-4">Unable to load Notifications screen right now.</div>;
                }
            case 'documents':
                try {
                    const Documents = React.lazy(() => import('./screens/DocumentsScreen'));
                    return (
                        <React.Suspense fallback={<div className="p-6"><Spinner /></div>}>
                            <Documents />
                        </React.Suspense>
                    );
                } catch (e) {
                    return <div className="p-4">Unable to load Documents screen right now.</div>;
                }
            case 'calculator':
                return <CalculatorScreen />;
            case 'external':
                return <ExternalPageScreen path={externalPath || ''} />;
            case 'proposalDetail':
                if (selectedProposalId) return <ProposalDetailScreen proposalId={selectedProposalId} onBack={() => setView('proposals')} />;
                return renderDashboard();
            case 'investmentDetail':
                 if (selectedInvestmentId) {
                    return <InvestmentDetailScreen 
                                listingId={selectedInvestmentId} 
                                onBack={() => setView('investments')}
                                onPurchaseSuccess={handlePurchaseSuccess} 
                           />;
                }
                return renderDashboard(); // Fallback to dashboard
            default:
                return renderDashboard();
        }
    }

    // Lazy loader for proposals screen to avoid bundler/runtime import crashes
    const ProposalsLoader: React.FC<{ onBack: () => void }> = ({ onBack }) => {
        const [Comp, setComp] = React.useState<React.ComponentType | null>(null);
        const [err, setErr] = React.useState<any>(null);
        const [loadingComp, setLoadingComp] = React.useState(true);

        useEffect(() => {
            let mounted = true;
            setLoadingComp(true);
            import('./screens/ProposalsScreen')
                .then(mod => {
                    if (!mounted) return;
                    setComp(() => (mod && mod.default) ? mod.default : null);
                })
                .catch(e => {
                    console.error('Dynamic import failed for ProposalsScreen', e);
                    if (mounted) setErr(e);
                })
                .finally(() => { if (mounted) setLoadingComp(false); });
            return () => { mounted = false; };
        }, []);

        if (loadingComp) return <div className="p-6"><Spinner /></div>;
        if (err) {
            return (
                <div>
                    <h2 className="text-xl font-semibold">Proposals</h2>
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded mt-3">
                        <p className="text-sm text-secondary-700 dark:text-secondary-300">Unable to load proposals right now. Error details are shown below.</p>
                        <pre className="mt-3 whitespace-pre-wrap text-xs text-red-700 dark:text-red-300 max-h-48 overflow-auto p-2 bg-white dark:bg-black/30 border rounded">{String(err && (err.message || err))}
{String((err && (err.stack || '')) || '')}</pre>
                        <div className="mt-3 flex items-center space-x-2">
                            <Button onClick={() => { setErr(null); /* retry by reloading */ window.location.reload(); }}>Retry</Button>
                            <Button onClick={onBack} variant="secondary">Back</Button>
                        </div>
                    </div>
                </div>
            );
        }

        if (!Comp) return <div className="p-4">No proposals available.</div>;
        // Render the dynamically loaded component and provide in-app navigation helper
        const Loaded = Comp as React.ComponentType<any>;
        const navigateToExternal = (path: string) => {
            try {
                // Try to detect a proposal id in the URL query or fragment
                const url = new URL(path, window.location.origin);
                const pid = url.searchParams.get('proposal_id') || url.searchParams.get('id');
                if (pid && /^\\d+$/.test(pid)) {
                    setSelectedProposalId(Number(pid));
                    setView('proposalDetail');
                    return;
                }
                // Look for fragment like #proposal-123
                const fragMatch = (url.hash || '').match(/proposal-(\d+)/i);
                if (fragMatch) {
                    setSelectedProposalId(Number(fragMatch[1]));
                    setView('proposalDetail');
                    return;
                }
            } catch (e) {
                // Not a fully qualified URL; try to parse query manually
                const qMatch = (path || '').match(/[?&]proposal_id=(\d+)/i) || (path || '').match(/[?&]id=(\d+)/i);
                if (qMatch) {
                    setSelectedProposalId(Number(qMatch[1]));
                    setView('proposalDetail');
                    return;
                }
            }
            // Fallback: open as external page inside the app
            setExternalPath(path);
            setView('external');
        };
        return <Loaded navigate={navigateToExternal} />;
    };

    return (
        <div className="min-h-screen bg-secondary-100 dark:bg-secondary-800 text-secondary-900 dark:text-secondary-100">
           <Header onNavigate={setView} />
           {notification && (
                <div className={`p-4 text-white text-center ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {notification.message}
                </div>
            )}
           <main className="p-4 sm:p-6 lg:p-8">
             {renderContent()}
           </main>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <ThemeProvider>
            <AuthProvider>
                <QueryClientProvider client={queryClient}>
                    <ToastProvider>
                        <AppContent />
                    </ToastProvider>
                </QueryClientProvider>
            </AuthProvider>
        </ThemeProvider>
    );
};

export default App;
