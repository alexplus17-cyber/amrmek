import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getInvoices } from '../api';
import Spinner from '../components/Spinner';

export default function LedgerScreen() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['invoices'], queryFn: async () => (await getInvoices()).data });

  if (isLoading) return <View style={styles.center}><Spinner /></View>;
  if (isError) return <View style={styles.center}><Text style={styles.error}>Failed to load ledger.</Text></View>;

  const invoices = Array.isArray(data) ? data : (data?.items || []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Ledger</Text>
      <FlatList
        data={invoices}
        keyExtractor={(item: any) => String(item.id || item.ID || item.number || Math.random())}
        renderItem={({ item }: any) => (
          <View style={styles.row}>
            <Text style={styles.amount}>${Number(item.amount || 0).toFixed(2)}</Text>
            <Text style={styles.date}>{item.date || item.created_at || ''}</Text>
            <Text style={styles.status}>{item.status || ''}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No ledger entries found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  amount: { fontWeight: '700' },
  date: { color: '#666' },
  status: { color: '#666' },
  empty: { color: '#888' },
  error: { color: 'red' },
});
