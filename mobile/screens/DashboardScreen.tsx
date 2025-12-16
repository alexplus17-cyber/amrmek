import React from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getMemberDashboard, getListings } from '../api';
import Spinner from '../components/Spinner';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

export default function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const renderCount = React.useRef(0);
  React.useEffect(() => {
    renderCount.current += 1;
    // Lightweight render diagnostic to help track hook-order instability during dev.
    // This will appear in the device logs.
    // eslint-disable-next-line no-console
    console.log(`DashboardScreen render #${renderCount.current}`);
  });
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['memberDashboard'],
    queryFn: async () => {
      const resp = await getMemberDashboard();
      return resp.data;
    },
  });

  const { data: listingsData, isLoading: listingsLoading } = useQuery({
    queryKey: ['listings'],
    queryFn: async () => {
      const r = await getListings();
      // API may return array or object; normalize to array
      return Array.isArray(r?.data) ? r.data : (r?.data?.items || []);
    },
  });
  // Prepare simple chart data (derive from groupStats or fallbacks)
  const chartPoints = React.useMemo(() => {
    const total = Number(data?.groupStats?.totalInvested || data?.contributionBalance || 0);
    if (!total) return [{ label: 'Total', value: 1 }];
    // simple break into quarters for display
    const q1 = Math.round(total * 0.25);
    const q2 = Math.round(total * 0.25);
    const q3 = Math.round(total * 0.25);
    const q4 = total - (q1 + q2 + q3);
    return [
      { label: 'Q1', value: q1 },
      { label: 'Q2', value: q2 },
      { label: 'Q3', value: q3 },
      { label: 'Q4', value: q4 },
    ];
  }, [data]);

  const featured = Array.isArray(listingsData) ? listingsData.slice(0, 3) : [];

  // Quick access cards similar to web Member Dashboard
  const quickAccess = [
    { id: 'portfolio', title: 'PORTFOLIO', subtitle: 'View investments & performance' },
    { id: 'buy', title: 'BUY SHARES', subtitle: 'Invest in new opportunities' },
    { id: 'calculator', title: 'CALCULATOR', subtitle: 'ROI & projections' },
    { id: 'documents', title: 'DOCUMENTS', subtitle: 'Access library & resources' },
    { id: 'notifications', title: 'NOTIFICATIONS', subtitle: 'Manage alerts & messages' },
    { id: 'announcements', title: 'ANNOUNCEMENTS', subtitle: 'Company updates & news' },
    { id: 'affiliate', title: 'AFFILIATE PROGRAM', subtitle: 'Invite and earn commissions' },
    { id: 'sell', title: 'SELL SHARES', subtitle: 'Sell shares you own' },
    { id: 'ledger', title: 'MY LEDGER', subtitle: 'Invoices & transactions' },
    { id: 'payments', title: 'PAYMENTS', subtitle: 'Manage payments & bank details' },
    { id: 'proposals', title: 'PROPOSALS', subtitle: 'Investment opportunities' },
    { id: 'activity', title: 'ACTIVITY', subtitle: 'Recent activity & timeline' },
    { id: 'meetings', title: 'MEETINGS', subtitle: 'Schedule & join meetings' },
    { id: 'support', title: 'SUPPORT', subtitle: 'Contact support & tickets' },
  ];

  const handleQuickAccess = (id: string) => {
    // Map quick access IDs to app routes matching the web behavior where possible
    switch (id) {
      case 'portfolio':
        navigation.navigate('Portfolio');
        break;
      case 'buy':
        navigation.navigate('Listings');
        break;
      case 'calculator':
        navigation.navigate('Calculator');
        break;
      case 'documents':
        navigation.navigate('Documents');
        break;
      case 'notifications':
        navigation.navigate('Notifications');
        break;
      case 'announcements':
        navigation.navigate('Announcements');
        break;
      case 'affiliate':
        navigation.navigate('Affiliate');
        break;
      case 'sell':
        navigation.navigate('Sell');
        break;
      case 'ledger':
        navigation.navigate('Ledger');
        break;
      case 'payments':
        navigation.navigate('Payments');
        break;
      case 'proposals':
        navigation.navigate('Proposals');
        break;
      case 'activity':
        navigation.navigate('Activity');
        break;
      case 'meetings':
        navigation.navigate('Meetings');
        break;
      case 'support':
        navigation.navigate('Support');
        break;
      default:
        // eslint-disable-next-line no-console
        console.warn('Unhandled quick access id', id);
        navigation.navigate('Profile');
    }
  };

  // Log query state for debugging (dev only)
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('Dashboard queries', {
      dashboardLoaded: !!data,
      dashboardError: !!error,
      listingsLoaded: !!listingsData,
      renderCount: renderCount.current,
    });
  }

  const showLoading = !!isLoading;
  const showError = !!isError;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Member Dashboard</Text>

      {showLoading && (
        <View style={styles.center}>
          <Spinner />
        </View>
      )}

      {showError && (
        <View style={styles.center}>
          <Text style={styles.error}>Failed to load dashboard: {String(error)}</Text>
        </View>
      )}

      {!showLoading && !showError && (
        <>
          <View style={styles.row}>
        <View style={[styles.card, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Contribution Requirement</Text>
          <Text style={styles.value}>${data?.contributionRequirement ?? 0}</Text>
          <Text style={styles.sub}>{data?.contributionStatus ?? 'unknown'}</Text>
        </View>

        <View style={[styles.card, { width: 140 }]}>
          <Text style={styles.label}>Balance</Text>
          <Text style={styles.value}>${data?.contributionBalance ?? 0}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Group Investment (simple chart)</Text>
      <View style={styles.chartWrap}>
        {chartPoints.map((pt) => {
          const max = Math.max(...chartPoints.map((p) => p.value)) || 1;
          const widthPct = Math.round((pt.value / max) * 100);
          return (
            <View key={pt.label} style={styles.chartRow}>
              <Text style={styles.chartLabel}>{pt.label}</Text>
              <View style={styles.chartBarBg}>
                <View style={[styles.chartBarFill, { width: `${widthPct}%` }]} />
              </View>
              <Text style={styles.chartValue}>${pt.value}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Featured Investments</Text>
      {/* Quick Access grid */}
      <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Quick Access</Text>
      <FlatList
        data={quickAccess}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.quickCard} onPress={() => handleQuickAccess(item.id)} testID={`quick-${item.id}`} accessibilityLabel={`quick-${item.id}`}>
            <View style={styles.quickIcon} />
            <Text style={styles.quickTitle}>{item.title}</Text>
            <Text style={styles.quickSub}>{item.subtitle}</Text>
            <View style={styles.quickButton}><Text style={styles.quickButtonText}>Open</Text></View>
          </TouchableOpacity>
        )}
      />

      {listingsLoading ? <Spinner /> : (
        featured.length === 0 ? <Text style={styles.empty}>No featured investments</Text> : (
          <FlatList
            data={featured}
            horizontal
            keyExtractor={(item: any) => String(item.id || item.ID || item.slug || item.title)}
            renderItem={({ item }: any) => (
              <TouchableOpacity style={styles.featureCard} onPress={() => navigation.navigate('ListingDetail', { listingId: Number(item.id || item.ID) })}>
                {item.image ? <Image source={{ uri: item.image }} style={styles.featureImage} /> : <View style={styles.featureImagePlaceholder} />}
                <Text style={styles.featureTitle} numberOfLines={2}>{item.title || item.post_title || item.name}</Text>
                {item.price && <Text style={styles.featurePrice}>${Number(item.price).toFixed(2)}</Text>}
              </TouchableOpacity>
            )}
          />
        )
      )}

      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      <FlatList
        data={(data?.transactions || []).slice(0, 10)}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }: any) => (
          <View style={styles.txRow}>
            <Text style={styles.txAmount}>${Number(item.amount).toFixed(2)}</Text>
            <Text style={styles.txDate}>{item.date}</Text>
            <Text style={styles.txStatus}>{item.status}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No recent transactions</Text>}
      />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  card: { padding: 12, borderRadius: 8, backgroundColor: '#f6f6f6', marginBottom: 10 },
  label: { fontSize: 12, color: '#666' },
  value: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 12, color: '#333' },
  sectionTitle: { marginTop: 8, fontSize: 16, fontWeight: '600', marginBottom: 6 },
  row: { flexDirection: 'row' },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  txAmount: { fontWeight: '600' },
  txDate: { color: '#666' },
  txStatus: { color: '#666' },
  empty: { color: '#888' },
  error: { color: 'red' },
  chartWrap: { marginBottom: 12 },
  chartRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  chartLabel: { width: 40, fontSize: 12 },
  chartBarBg: { flex: 1, height: 12, backgroundColor: '#eee', borderRadius: 6, marginHorizontal: 8 },
  chartBarFill: { height: 12, backgroundColor: '#4f46e5', borderRadius: 6 },
  chartValue: { width: 80, textAlign: 'right', fontSize: 12 },
  featureCard: { width: 180, padding: 8, marginRight: 10, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  featureImage: { width: '100%', height: 90, borderRadius: 6, marginBottom: 8 },
  featureImagePlaceholder: { width: '100%', height: 90, borderRadius: 6, marginBottom: 8, backgroundColor: '#f0f0f0' },
  featureTitle: { fontSize: 14, fontWeight: '600' },
  featurePrice: { color: '#0b6623', marginTop: 6 },
  quickCard: { width: '48%', padding: 12, marginBottom: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#eef2f7' },
  quickIcon: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#eef2ff', marginBottom: 10 },
  quickTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  quickSub: { fontSize: 12, color: '#666', marginBottom: 10 },
  quickButton: { marginTop: 'auto', backgroundColor: '#36454f', paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  quickButtonText: { color: '#fff', fontWeight: '600' },
});
