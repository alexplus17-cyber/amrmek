import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';

const announcements = [
  { id: '1', title: 'Quarterly Report Published' },
  { id: '2', title: 'New Investment Opportunity' },
];

export default function AnnouncementsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Announcements</Text>
      <FlatList
        data={announcements}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => <Text style={styles.item}>{item.title}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  item: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
});
