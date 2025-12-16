import React from 'react';
import { View, Text, StyleSheet, Button, Linking } from 'react-native';

export default function AffiliateScreen() {
  const openAffiliate = () => {
    // Placeholder: open external affiliate page or show share UI
    Linking.openURL('https://example.com/affiliate');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Affiliate Program</Text>
      <Text style={styles.note}>Invite friends and earn commissions.</Text>
      <Button title="Open Affiliate Portal" onPress={openAffiliate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  note: { color: '#666', marginBottom: 12 },
});
