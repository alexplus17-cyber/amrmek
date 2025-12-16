
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getListingDetails, createPaymentIntent, recordPurchase } from '../api';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useStripe } from '@stripe/stripe-react-native';

type PurchaseScreenProps = NativeStackScreenProps<RootStackParamList, 'Purchase'>;

export default function PurchaseScreen({ route, navigation }: PurchaseScreenProps) {
  const { listingId } = route.params;
  const [quantity, setQuantity] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'bank'>('stripe');
  const [isProcessing, setIsProcessing] = useState(false);

  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const queryClient = useQueryClient();

  const { data: listingData, isLoading, error } = useQuery({
    queryKey: ['listingDetails', listingId],
    queryFn: () => getListingDetails(listingId),
  });

  const listing = listingData?.data;

  useEffect(() => {
    if (listing?.title) {
      navigation.setOptions({ title: `Purchase: ${listing.title}` });
    } else {
      navigation.setOptions({ title: 'Purchase' });
    }
  }, [listing, navigation]);
  
  const handleStripePurchase = async (numQuantity: number) => {
    setIsProcessing(true);
    try {
        // 1. Create a payment intent on the server
        const response = await createPaymentIntent(listingId, numQuantity);
        const { clientSecret } = response.data;
        
        // Extract the Payment Intent ID from the client secret for later use
        const paymentIntentId = clientSecret.split('_secret_')[0];

        // 2. Initialize the Payment sheet
        const { error: initError } = await initPaymentSheet({
            merchantDisplayName: "Investor Network",
            paymentIntentClientSecret: clientSecret,
        });

        if (initError) {
            console.error(initError);
            Alert.alert('Error', 'Could not initialize payment sheet.');
            setIsProcessing(false);
            return;
        }

        // 3. Present the Payment sheet
        const { error: paymentError } = await presentPaymentSheet();

        if (paymentError) {
            if (paymentError.code !== 'Canceled') {
                console.error(paymentError);
                Alert.alert('Payment Failed', paymentError.message);
            }
        } else {
            // 4. Record the purchase on the server with the actual payment intent ID
            await recordPurchase(listingId, numQuantity, 'stripe', { payment_intent_id: paymentIntentId });
            
            Alert.alert('Payment Successful', 'Your purchase was completed successfully.', [
                { text: 'OK', onPress: () => {
                    queryClient.invalidateQueries({ queryKey: ['listings'] });
                    queryClient.invalidateQueries({ queryKey: ['listingDetails', listingId] });
                    navigation.navigate('Listings');
                }}
            ]);
        }
    } catch (apiError) {
        console.error(apiError);
        Alert.alert('API Error', 'Could not process payment. Please try again.');
    } finally {
        setIsProcessing(false);
    }
  };


  const handlePurchase = () => {
    const numQuantity = parseInt(quantity, 10);
    if (isNaN(numQuantity) || numQuantity <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid number of shares to purchase.');
      return;
    }
     if (numQuantity > (listing.availability || 0)) {
      Alert.alert('Not Enough Shares', 'The quantity you requested exceeds the number of available shares.');
      return;
    }

    if (paymentMethod === 'bank') {
        navigation.navigate('BankDetails', { listingId, quantity: numQuantity });
    } else { // Stripe flow
        handleStripePurchase(numQuantity);
    }
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (error || !listing) {
    return <View style={styles.center}><Text>Error loading listing details.</Text></View>;
  }

  const price = listing.price || 0;
  const totalCost = (parseInt(quantity, 10) || 0) * price;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{listing.title}</Text>
        <Text style={styles.detail}>Price per share: ${price.toFixed(2)}</Text>
        {listing.availability && <Text style={styles.detail}>Available: {listing.availability} shares</Text>}
      </View>
      
      <View style={styles.card}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Quantity:</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            placeholder="1"
          />
        </View>

        <View style={styles.paymentContainer}>
          <Text style={styles.label}>Payment Method:</Text>
          <View style={styles.paymentButtons}>
             <TouchableOpacity 
                style={[styles.paymentButton, paymentMethod === 'stripe' && styles.selectedPayment]} 
                onPress={() => setPaymentMethod('stripe')}
              >
                  <Text style={[styles.paymentButtonText, paymentMethod === 'stripe' && styles.selectedPaymentText]}>Stripe</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.paymentButton, paymentMethod === 'bank' && styles.selectedPayment]} 
                onPress={() => setPaymentMethod('bank')}
              >
                  <Text style={[styles.paymentButtonText, paymentMethod === 'bank' && styles.selectedPaymentText]}>Bank Transfer</Text>
              </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.totalLabel}>Total Cost</Text>
        <Text style={styles.totalAmount}>${totalCost.toFixed(2)}</Text>
      </View>
      
      <TouchableOpacity 
        style={[styles.confirmButton, isProcessing && styles.disabledButton]} 
        onPress={handlePurchase} 
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.confirmButtonText}>Proceed to Confirmation</Text>
        )}
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
    },
    card: {
      backgroundColor: '#fff',
      borderRadius: 8,
      padding: 20,
      marginHorizontal: 15,
      marginBottom: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
      elevation: 2,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    detail: {
        fontSize: 16,
        color: '#555',
        marginBottom: 5,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        marginBottom: 8,
        fontWeight: '500',
        color: '#333'
    },
    input: {
        height: 50,
        borderColor: '#ddd',
        borderWidth: 1,
        paddingHorizontal: 15,
        borderRadius: 5,
        fontSize: 16,
        backgroundColor: '#f9f9f9'
    },
    paymentContainer: {
        marginBottom: 10,
    },
    paymentButtons: {
        flexDirection: 'row',
    },
    paymentButton: {
      flex: 1,
      padding: 15,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: '#ccc',
      alignItems: 'center',
      marginHorizontal: 5,
    },
    selectedPayment: {
      borderColor: '#007AFF',
      backgroundColor: '#e6f2ff',
    },
    paymentButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#555'
    },
    selectedPaymentText: {
      color: '#007AFF'
    },
    totalLabel: {
      fontSize: 18,
      fontWeight: '600',
      color: '#555'
    },
    totalAmount: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#2e7d32',
      marginTop: 5,
    },
    confirmButton: {
      backgroundColor: '#007AFF',
      padding: 15,
      borderRadius: 8,
      alignItems: 'center',
      marginHorizontal: 15,
      marginBottom: 20,
    },
    confirmButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '600',
    },
    disabledButton: {
      backgroundColor: '#aaa',
    }
});