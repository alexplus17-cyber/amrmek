import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { login as apiLogin } from '../api';
import SubscribeWebView from './SubscribeWebView';
import { API_BASE_URL } from '../../constants';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const [showSubscribe, setShowSubscribe] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    // Defensive: don't submit obvious URL-like input as username (automation sometimes pastes exp:// links)
    if (typeof username === 'string' && username.includes('://')) {
      setError('Invalid username input detected. Please use your email or username.');
      setLoading(false);
      return;
    }
    try {
      const response = await apiLogin(username, password);
      // The JWT plugin may return only `token` (no refresh_token). Accept token-only responses.
      const { token, refresh_token } = response.data || {};
      if (token) {
        // Pass refresh_token only if provided (keep it undefined otherwise)
        signIn(token, refresh_token);
      } else {
        // Provide any server message if present for easier debugging
        const msg = response?.data?.message || 'Login failed. Please try again.';
        setError(msg);
      }
    } catch (err: any) {
      // Prefer server-provided error message when available
      const serverMsg = err?.response?.data?.message || err?.message || 'Invalid credentials or network error.';
      setError(serverMsg);
      console.error('Login error:', err?.response || err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Investor Network</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Button title="Sign In" onPress={handleLogin} />
      )}
      <View style={{ marginTop: 12 }}>
        <Button title="Sign up" onPress={() => setShowSubscribe(true)} />
      </View>

      {showSubscribe && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <SubscribeWebView
            onClose={() => setShowSubscribe(false)}
            onSuccess={() => {
              Alert.alert('Application submitted', 'Thank you — your application was submitted.');
            }}
          />
        </View>
      )}

      {/* Developer convenience: autofill test credentials and submit (dev only) */}
      {__DEV__ && (
        <View style={{ marginTop: 12 }}>
          <Button
            title="Auto-fill Test Credentials"
            onPress={() => {
              const testUser = 'test2@example.com';
              const testPass = 'TestPass123';
              setUsername(testUser);
              setPassword(testPass);
              // small delay to ensure inputs update before submit
              setTimeout(() => handleLogin(), 200);
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
  },
});