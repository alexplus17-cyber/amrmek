
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getBankDetails } from '../api';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type BankDetailsScreenProps = NativeStackScreenProps<RootStackParamList, 'BankDetails'>;

export default function BankDetailsScreen({ route, navigation }: BankDetailsScreenProps) {
  const { listingId, quantity } = route.params;

  const { data: bankDetailsData, isLoading, error } = useQuery({
    queryKey: ['bankDetails'],
    queryFn: getBankDetails,
  });

  const bankDetails = bankDetailsData?.data;
  
  const handleProceed = () => {
      // In a real app, this step would first create an invoice on the backend
      // and return the new invoice ID. We'll mock that for now.
      const mockInvoiceId = `inv_${listingId}_${Date.now()}`;
      
      navigation.navigate('UploadReceipt', { invoiceId: mockInvoiceId });
  }

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (error || !bankDetails) {
    return (
        <View style={styles.center}>
            <Text style={styles.errorText}>Error loading bank details.</Text>
            <Text style={styles.errorSubText}>Please contact support.</Text>
        </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Bank Transfer Instructions</Text>
        <Text style={styles.instructions}>
          Please transfer the total purchase amount to the bank account below. Once the transfer is complete, please proceed to upload a screenshot or photo of your transaction receipt.
        </Text>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.detailTitle}>Bank Account Details</Text>
        {/* This assumes the API returns a simple string. Adjust if it's an object */}
        <Text style={styles.bankInfo}>{bankDetails.details || 'No details provided.'}</Text>
      </View>
      
      <TouchableOpacity
        style={styles.proceedButton}
        onPress={handleProceed}
      >
        <Text style={styles.proceedButtonText}>I Have Paid, Proceed to Upload</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f0f7',
        paddingVertical: 10,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
      backgroundColor: '#fff',
      borderRadius: 8,
      padding: 20,
      marginHorizontal: 15,
      marginBottom: 15,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    instructions: {
        fontSize: 16,
        lineHeight: 24,
        color: '#555',
    },
    detailTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 10,
    },
    bankInfo: {
        fontSize: 16,
        lineHeight: 26,
        fontFamily: 'monospace', // Use monospace for better alignment if details are formatted
        color: '#333'
    },
    proceedButton: {
      backgroundColor: '#2e7d32',
      padding: 15,
      borderRadius: 8,
      alignItems: 'center',
      marginHorizontal: 15,
      marginBottom: 20,
    },
    proceedButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '600',
    },
    errorText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#c0392b',
        textAlign: 'center',
    },
    errorSubText: {
        fontSize: 14,
        color: '#7f8c8d',
        marginTop: 8,
        textAlign: 'center',
    }
});
