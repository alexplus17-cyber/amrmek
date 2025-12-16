import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getBankDetails, getInvoices } from '../api';
import Spinner from '../components/Spinner';

export default function PaymentsScreen() {
  const { data: bankData, isLoading: bankLoading } = useQuery({ queryKey: ['bankDetails'], queryFn: async () => (await getBankDetails()).data });
  const { data: invoices, isLoading: invoicesLoading } = useQuery({ queryKey: ['invoicesPay'], queryFn: async () => (await getInvoices()).data });

  if (bankLoading || invoicesLoading) return <View style={styles.center}><Spinner /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payments</Text>
      <Text style={styles.sectionTitle}>Bank Details</Text>
      <Text style={styles.sub}>{bankData?.bank_name ?? 'Not configured'}</Text>

      <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Recent Payments</Text>
      <FlatList
        data={Array.isArray(invoices) ? invoices : (invoices?.items || [])}
        keyExtractor={(item: any) => String(item.id || item.ID || Math.random())}
        renderItem={({ item }: any) => (
          <View style={styles.row}>
            <Text>${Number(item.amount || 0).toFixed(2)}</Text>
            <Text style={styles.date}>{item.date || item.created_at || ''}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No payments found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  sub: { color: '#333' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  date: { color: '#666' },
  empty: { color: '#888' },
});
