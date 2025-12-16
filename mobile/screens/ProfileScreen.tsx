import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, ScrollView, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserProfile, updateUserProfile } from '../api';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type ProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const queryClient = useQueryClient();
  const { data: profileData, isLoading, error } = useQuery({
    queryKey: ['userProfile'],
    queryFn: getUserProfile,
  });

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    if (profileData?.data) {
      setEmail(profileData.data.email || '');
      setFullName(profileData.data.fullName || '');
      setBio(profileData.data.bio || '');
    }
  }, [profileData]);

  const updateMutation = useMutation({
    mutationFn: (updatedProfile: { email: string; fullName: string; bio: string }) => updateUserProfile(updatedProfile),
    onSuccess: () => {
      Alert.alert('Success', 'Your profile has been updated.');
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update profile.');
    },
  });

  const handleSaveChanges = () => {
    if (!email) {
        Alert.alert('Validation Error', 'Email cannot be empty.');
        return;
    }
    updateMutation.mutate({ email, fullName, bio });
  };
  
  const handleHelpPress = () => {
    // Replace with your actual support URL
    const supportUrl = 'https://your-support-page.com';
    Linking.canOpenURL(supportUrl).then(supported => {
      if (supported) {
        Linking.openURL(supportUrl);
      } else {
        Alert.alert('Error', `Don't know how to open this URL: ${supportUrl}`);
      }
    });
  };

  const hasChanges = profileData?.data ? (
      email !== profileData.data.email || 
      fullName !== profileData.data.fullName ||
      bio !== profileData.data.bio
  ) : false;

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (error) {
    return <View style={styles.center}><Text>Error loading profile.</Text></View>;
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={profileData?.data.username}
            editable={false}
          />

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="John Doe"
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, (updateMutation.isPending || !hasChanges) && styles.disabledButton]}
          onPress={handleSaveChanges}
          disabled={updateMutation.isPending || !hasChanges}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
            <Text style={styles.settingsButtonText}>Go to Settings</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.helpButton}
          onPress={handleHelpPress}
        >
            <Text style={styles.helpButtonText}>Help & Support</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f7',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    marginHorizontal: 15,
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
    color: '#333',
    marginTop: 10,
  },
  input: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    paddingHorizontal: 15,
    borderRadius: 5,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 100,
    paddingTop: 15,
  },
  disabledInput: {
      backgroundColor: '#e9ecef',
      color: '#6c757d',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 15,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#aaa',
  },
  settingsButton: {
    marginTop: 15,
    marginHorizontal: 15,
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
  },
  settingsButtonText: {
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '500',
  },
  helpButton: {
    marginTop: 15,
    marginHorizontal: 15,
    padding: 15,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  helpButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  }
});