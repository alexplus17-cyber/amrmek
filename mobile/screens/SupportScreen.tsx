import React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';

export default function SupportScreen() {
  const openSupport = () => {
    // Fallback: open the support dashboard on the site
    const url = 'http://10.0.2.2/word/support/';
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Support</Text>
      <Text style={styles.sub}>Open support dashboard for help and tickets.</Text>
      <TouchableOpacity style={styles.button} onPress={openSupport}>
        <Text style={styles.buttonText}>Open Support</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  sub: { color: '#333', marginBottom: 12 },
  button: { backgroundColor: '#36454f', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
