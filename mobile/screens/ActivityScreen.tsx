import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getMemberDashboard } from '../api';
import Spinner from '../components/Spinner';

export default function ActivityScreen() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['memberDashboardForActivity'], queryFn: async () => (await getMemberDashboard()).data });

  if (isLoading) return <View style={styles.center}><Spinner /></View>;
  if (isError) return <View style={styles.center}><Text style={styles.error}>Failed to load activity.</Text></View>;

  const activity = data?.activity || data?.recentActivity || [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recent Activity</Text>
      <FlatList
        data={activity}
        keyExtractor={(item: any, idx) => String(item.id || idx)}
        renderItem={({ item }: any) => (
          <View style={styles.row}><Text>{item.description || item.message || JSON.stringify(item)}</Text></View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No recent activity.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  empty: { color: '#888' },
  error: { color: 'red' },
});
