import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';

const notifs = [
  { id: '1', title: 'Payment received', body: 'Your payment for invoice #123 has been processed.' },
  { id: '2', title: 'Listing updated', body: 'A listing you follow has new information.' },
];

export default function NotificationsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>
      <FlatList
        data={notifs}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemBody}>{item.body}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  itemTitle: { fontWeight: '700' },
  itemBody: { color: '#666' },
});
