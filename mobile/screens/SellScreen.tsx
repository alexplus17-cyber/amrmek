import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';

export default function SellScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sell Shares</Text>
      <Text style={styles.note}>Start a sell request for shares you own.</Text>
      <Button title="Start Sell Request" onPress={() => alert('Sell flow placeholder')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  note: { color: '#666', marginBottom: 12 },
});
