import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserSettings, updateUserSettings } from '../api';

const ToggleRow = ({ label, value, onValueChange }) => (
    <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Switch
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={value ? '#007AFF' : '#f4f3f4'}
            ios_backgroundColor="#3e3e3e"
            onValueChange={onValueChange}
            value={value}
        />
    </View>
);

export default function SettingsScreen() {
    const queryClient = useQueryClient();
    const { data: settingsData, isLoading, error } = useQuery({
        queryKey: ['userSettings'],
        queryFn: getUserSettings,
    });

    const [settings, setSettings] = useState(null);

    useEffect(() => {
        if (settingsData?.data) {
            setSettings(settingsData.data);
        }
    }, [settingsData]);

    const updateMutation = useMutation({
        mutationFn: (updatedSettings: any) => updateUserSettings(updatedSettings),
        onSuccess: () => {
            Alert.alert('Success', 'Your settings have been updated.');
            queryClient.invalidateQueries({ queryKey: ['userSettings'] });
        },
        onError: (err: any) => {
            Alert.alert('Error', err.response?.data?.message || 'Failed to update settings.');
        },
    });
    
    const handleValueChange = (key, value) => {
        setSettings(prev => ({...prev, [key]: value}));
    }
    
    const handleTopicChange = (topic, value) => {
        setSettings(prev => ({
            ...prev,
            notificationTopics: {
                ...prev.notificationTopics,
                [topic]: value,
            }
        }));
    }
    
    const handleSaveChanges = () => {
        updateMutation.mutate(settings);
    };
    
    const hasChanges = settings && settingsData?.data && JSON.stringify(settings) !== JSON.stringify(settingsData.data);

    if (isLoading) {
        return <View style={styles.center}><ActivityIndicator size="large" /></View>;
    }

    if (error || !settings) {
        return <View style={styles.center}><Text>Error loading settings.</Text></View>;
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Notifications</Text>
                <ToggleRow 
                    label="Email Notifications"
                    value={settings.enableEmailNotifications}
                    onValueChange={(val) => handleValueChange('enableEmailNotifications', val)}
                />
                <ToggleRow 
                    label="Push Notifications"
                    value={settings.enablePushNotifications}
                    onValueChange={(val) => handleValueChange('enablePushNotifications', val)}
                />
            </View>

            <View style={styles.card}>
                 <Text style={styles.cardTitle}>Notification Topics</Text>
                 <ToggleRow 
                    label="New Investment Opportunities"
                    value={settings.notificationTopics.newInvestments}
                    onValueChange={(val) => handleTopicChange('newInvestments', val)}
                />
                 <ToggleRow 
                    label="Q&A Updates on Investments"
                    value={settings.notificationTopics.qnaUpdates}
                    onValueChange={(val) => handleTopicChange('qnaUpdates', val)}
                />
                 <ToggleRow 
                    label="Monthly Digest"
                    value={settings.notificationTopics.monthlyDigest}
                    onValueChange={(val) => handleTopicChange('monthlyDigest', val)}
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
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f0f7',
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
        marginVertical: 10,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 10,
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    toggleLabel: {
        fontSize: 16,
    },
    saveButton: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 15,
        marginVertical: 20,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    disabledButton: {
        backgroundColor: '#aaa',
    },
});