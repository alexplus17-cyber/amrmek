import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

const Spinner: React.FC<{ size?: number | 'small' | 'large'; color?: string }> = ({ size = 'large', color = '#4f46e5' }) => (
  <View style={styles.center}>
    <ActivityIndicator size={size as any} color={color} />
  </View>
);

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
});

export default Spinner;
