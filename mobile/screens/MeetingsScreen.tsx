import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import Spinner from '../components/Spinner';
import { useQuery } from '@tanstack/react-query';
import api from '../api';

export default function MeetingsScreen() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['meetings'], queryFn: async () => {
    try {
      const r = await api.get('/investor-network/v1/meetings');
      return r.data;
    } catch (e) {
      return [];
    }
  }});

  if (isLoading) return <View style={styles.center}><Spinner /></View>;
  if (isError) return <View style={styles.center}><Text style={styles.error}>Failed to load meetings.</Text></View>;

  const items = Array.isArray(data) ? data : (data?.items || []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meetings</Text>
      <FlatList
        data={items}
        keyExtractor={(item: any) => String(item.id || item.ID || Math.random())}
        renderItem={({ item }: any) => (
          <View style={styles.row}><Text style={styles.titleSmall}>{item.title || item.name || item.subject}</Text></View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No meetings found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  titleSmall: { fontSize: 15, fontWeight: '600' },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  empty: { color: '#888' },
  error: { color: 'red' },
});
