import React, { useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { API_BASE_URL } from '../constants';

type Props = {
  onClose: () => void;
  onSuccess?: () => void;
};

export default function SubscribeWebView({ onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(true);
  const [progressText, setProgressText] = useState('Loading...');
  const webviewRef = useRef<any>(null);

  const subscribeUrl = `${API_BASE_URL.replace(/\/$/, '')}/member-subscribe-form/`;

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    const { url } = navState;
    // If the user reached the thank-you page, treat as success and close the webview
    try {
      const u = new URL(url);
      if (u.pathname.indexOf('/thank-you') !== -1 || url.indexOf('/thank-you') !== -1) {
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (e) {
      // ignore URL parse errors
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Apply to join</Text>
        <View style={styles.headerRight} />
      </View>

      <WebView
        ref={webviewRef}
        source={{ uri: subscribeUrl }}
        onLoadStart={() => { setLoading(true); setProgressText('Loading...'); }}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={handleNavigationStateChange}
        startInLoadingState
        javaScriptEnabled
        domStorageEnabled
        style={{ flex: 1 }}
      />

      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#2271b1" />
          <Text style={styles.loadingText}>{progressText}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  closeBtn: { padding: 8 },
  closeText: { color: '#2271b1', fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '600' },
  headerRight: { width: 56 },
  loadingOverlay: { position: 'absolute', left: 0, right: 0, top: 56, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)' },
  loadingText: { marginTop: 12, color: '#444' },
});
