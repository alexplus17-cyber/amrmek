import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';

const docs = [
  { id: '1', title: 'Investor Agreement' },
  { id: '2', title: 'Terms & Conditions' },
  { id: '3', title: 'Privacy Policy' },
];

export default function DocumentsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Documents</Text>
      <FlatList
        data={docs}
        keyExtractor={(d) => d.id}
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
