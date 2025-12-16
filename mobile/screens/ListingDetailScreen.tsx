
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getListingDetails, getListingAvailability } from '../api';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type ListingDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'ListingDetail'>;

export default function ListingDetailScreen({ route, navigation }: ListingDetailScreenProps) {
  const { listingId } = route.params;

  const { data: listingData, isLoading, error } = useQuery({
    queryKey: ['listingDetails', listingId],
    queryFn: () => getListingDetails(listingId),
  });
  
  const { 
    mutate: checkAvailability, 
    isPending: isCheckingAvailability, 
    data: availabilityData 
  } = useMutation({
    mutationFn: () => getListingAvailability(listingId),
  });

  const listing = listingData?.data;
  const finalAvailability = (availabilityData as any)?.data?.availability ?? listing?.availability;

  useEffect(() => {
    if (listing?.title) {
      navigation.setOptions({ title: listing.title });
    } else {
        navigation.setOptions({ title: 'Listing Details' });
    }
  }, [listing, navigation]);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (error || !listing) {
    return <View style={styles.center}><Text>Error loading listing details.</Text></View>;
  }

  return (
    <ScrollView 
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.card}>
            <Text style={styles.title}>{listing.title}</Text>
            <Text style={styles.description}>{listing.description || 'No detailed description available.'}</Text>
        </View>

        <View style={styles.card}>
            <Text style={styles.detailTitle}>Investment Details</Text>

            <View style={styles.priceContainer}>
                <Text style={styles.priceLabel}>Price per Share</Text>
                <Text style={styles.priceValue}>${listing.price?.toFixed(2) || 'N/A'}</Text>
            </View>

            <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Shares Available</Text>
                <View style={styles.availabilityContainer}>
                  {isCheckingAvailability ? (
                    <ActivityIndicator size="small" style={{marginRight: 10}}/>
                  ) : (
                    <Text style={styles.detailValue}>{finalAvailability ?? 'N/A'}</Text>
                  )}
                  <TouchableOpacity 
                    style={[styles.refreshButton, isCheckingAvailability && styles.disabledButton]} 
                    onPress={() => checkAvailability()}
                    disabled={isCheckingAvailability}
                  >
                    <Text style={styles.refreshButtonText}>Refresh</Text>
                  </TouchableOpacity>
                </View>
            </View>
        </View>
      </View>
      
      <TouchableOpacity
        style={styles.purchaseButton}
        onPress={() => navigation.navigate('Purchase', { listingId: listing.id })}
      >
        <Text style={styles.purchaseButtonText}>Proceed to Purchase</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f0f7',
    },
    content: {
        paddingBottom: 100, // Space for the floating button
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
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
    },
    description: {
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
    priceContainer: {
        backgroundColor: '#eef2ff',
        borderRadius: 8,
        padding: 15,
        alignItems: 'center',
        marginBottom: 20,
    },
    priceLabel: {
        fontSize: 16,
        color: '#4338ca',
        fontWeight: '500',
    },
    priceValue: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1e1b4b',
        marginTop: 4,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    detailLabel: {
        fontSize: 16,
        color: '#666',
    },
    detailValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    availabilityContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    refreshButton: {
      backgroundColor: '#007AFF',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 6,
    },
    refreshButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    disabledButton: {
      opacity: 0.5,
    },
    purchaseButton: {
        position: 'absolute',
        bottom: 20,
        left: 15,
        right: 15,
        backgroundColor: '#007AFF',
        paddingVertical: 15,
        borderRadius: 8,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    purchaseButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
});
