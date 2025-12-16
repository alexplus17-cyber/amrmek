import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CalculatorScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Calculator</Text>
      <Text style={styles.note}>Simple ROI & projection tools will be here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  note: { color: '#666' },
});
