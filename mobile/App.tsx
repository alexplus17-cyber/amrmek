
import React, { useState, useEffect, createContext, useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { asyncStoragePersister, queryClient } from './queryClient';
import * as SecureStore from 'expo-secure-store';
import { StripeProvider } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';

import DashboardScreen from './screens/DashboardScreen';
import ListingsScreen from './screens/ListingsScreen';
import LoginScreen from './screens/LoginScreen';
import PurchaseScreen from './screens/PurchaseScreen';
import ListingDetailScreen from './screens/ListingDetailScreen';
import UploadReceiptScreen from './screens/UploadReceiptScreen';
import BankDetailsScreen from './screens/BankDetailsScreen';
import InvoicesScreen from './screens/InvoicesScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen'; // Import SettingsScreen
import CalculatorScreen from './screens/CalculatorScreen';
import DocumentsScreen from './screens/DocumentsScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import AnnouncementsScreen from './screens/AnnouncementsScreen';
import AffiliateScreen from './screens/AffiliateScreen';
import SellScreen from './screens/SellScreen';
import PortfolioScreen from './screens/PortfolioScreen';
import LedgerScreen from './screens/LedgerScreen';
import PaymentsScreen from './screens/PaymentsScreen';
import ProposalsScreen from './screens/ProposalsScreen';
import ActivityScreen from './screens/ActivityScreen';
import MeetingsScreen from './screens/MeetingsScreen';
import SupportScreen from './screens/SupportScreen';
import { ActivityIndicator, View } from 'react-native';
import { setupInterceptors } from './api';
import { usePushNotifications } from './hooks/usePushNotifications';

// Query client and persister are now provided from `queryClient.ts`

import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const STRIPE_KEY = Constants.expoConfig?.extra?.STRIPE_PUBLISHABLE_KEY;

import { AuthProvider, useAuth } from './contexts/AuthContext';

// --- App Navigation ---
function AppContent() {
  const { user } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator id="RootStack">
        {user ? (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Member Dashboard' }} />
            <Stack.Screen name="Listings" component={ListingsScreen} options={{ title: 'Investment Listings' }} />
            <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
            <Stack.Screen name="Purchase" component={PurchaseScreen} />
            <Stack.Screen name="BankDetails" component={BankDetailsScreen} options={{ title: 'Bank Transfer Details' }} />
            <Stack.Screen name="UploadReceipt" component={UploadReceiptScreen} options={{ title: 'Upload Receipt' }} />
            <Stack.Screen name="Invoices" component={InvoicesScreen} options={{ title: 'My Invoices' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
            <Stack.Screen name="Calculator" component={CalculatorScreen} options={{ title: 'Calculator' }} />
            <Stack.Screen name="Documents" component={DocumentsScreen} options={{ title: 'Documents' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
            <Stack.Screen name="Announcements" component={AnnouncementsScreen} options={{ title: 'Announcements' }} />
            <Stack.Screen name="Affiliate" component={AffiliateScreen} options={{ title: 'Affiliate Program' }} />
            <Stack.Screen name="Sell" component={SellScreen} options={{ title: 'Sell Shares' }} />
            <Stack.Screen name="Portfolio" component={PortfolioScreen} options={{ title: 'Portfolio' }} />
            <Stack.Screen name="Ledger" component={LedgerScreen} options={{ title: 'My Ledger' }} />
            <Stack.Screen name="Payments" component={PaymentsScreen} options={{ title: 'Payments' }} />
            <Stack.Screen name="Proposals" component={ProposalsScreen} options={{ title: 'Proposals' }} />
            <Stack.Screen name="Activity" component={ActivityScreen} options={{ title: 'Recent Activity' }} />
            <Stack.Screen name="Meetings" component={MeetingsScreen} options={{ title: 'Meetings' }} />
            <Stack.Screen name="Support" component={SupportScreen} options={{ title: 'Support' }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}


// --- Root Component ---
export default function App() {
  return (
    <StripeProvider publishableKey={STRIPE_KEY || ''}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: asyncStoragePersister }}
      >
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </PersistQueryClientProvider>
    </StripeProvider>
  );
}
