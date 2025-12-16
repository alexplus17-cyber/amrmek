
import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Image, TextInput, Alert, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRoute, useNavigation } from '@react-navigation/native';
import { uploadReceipt as apiUploadReceipt } from '../api';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useMutation, useQueryClient } from '@tanstack/react-query';


export default function UploadReceiptScreen() {
  const route = useRoute();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { invoiceId } = route.params as { invoiceId: string };

  const [receiptImage, setReceiptImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [comment, setComment] = useState('');

  const uploadMutation = useMutation({
    mutationFn: ({ receiptUri, commentText }: { receiptUri: string, commentText: string }) => 
      apiUploadReceipt(invoiceId, receiptUri, commentText),
    
    onMutate: async ({ receiptUri }) => {
      await queryClient.cancelQueries({ queryKey: ['invoices'] });
      const previousInvoices = queryClient.getQueryData(['invoices']);

      queryClient.setQueryData(['invoices'], (old: any) => {
        if (!old || !old.data) return old;
        return {
          ...old,
          data: old.data.map(invoice =>
            invoice.id === invoiceId
              ? { ...invoice, status: 'Pending Confirmation', receiptPreview: receiptUri }
              : invoice
          ),
        };
      });
      
      // Immediately navigate away after optimistic update
      navigation.navigate('Invoices');
      return { previousInvoices };
    },

    onError: (err, variables, context) => {
      if (context?.previousInvoices) {
        queryClient.setQueryData(['invoices'], context.previousInvoices);
      }
      Alert.alert('Upload Failed', 'There was an error. Your upload will be retried when you are back online.');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    
    onSuccess: () => {
      // Success is handled by onSettled invalidation, alert isn't strictly needed
      // but can be good for confirming background sync success if the user is still in the app.
      console.log("Receipt for invoice", invoiceId, "synced successfully.");
    }
  });


  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8, // Slightly reduce quality for faster uploads
    });

    if (!result.canceled) {
      setReceiptImage(result.assets[0]);
    }
  };

  const handleSubmit = () => {
    if (!receiptImage) {
      Alert.alert('No Receipt', 'Please select a receipt image to upload.');
      return;
    }
    uploadMutation.mutate({ receiptUri: receiptImage.uri, commentText: comment });
  };


  return (
    <ScrollView style={styles.container}>
        <View style={styles.card}>
            <Text style={styles.label}>Invoice ID: {invoiceId}</Text>
            
            <TouchableOpacity style={styles.imagePickerContainer} onPress={pickImage}>
                {receiptImage ? (
                    <Image source={{ uri: receiptImage.uri }} style={styles.imagePreview} />
                ) : (
                    <Text style={styles.imagePickerText}>Select Receipt Image</Text>
                )}
            </TouchableOpacity>

            <View>
                <Text style={styles.label}>Optional Comment:</Text>
                <TextInput
                    style={styles.input}
                    value={comment}
                    onChangeText={setComment}
                    placeholder="e.g., Payment for October investment"
                    multiline
                />
            </View>
        </View>

        <TouchableOpacity 
            style={[styles.submitButton, uploadMutation.isPending && styles.disabledButton]} 
            onPress={handleSubmit} 
            disabled={uploadMutation.isPending}
        >
            {uploadMutation.isPending ? (
                <ActivityIndicator color="#ffffff" />
            ) : (
                <Text style={styles.submitButtonText}>Submit Receipt</Text>
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
    card: {
      backgroundColor: '#fff',
      borderRadius: 8,
      padding: 20,
      marginHorizontal: 15,
      marginVertical: 10,
    },
    label: {
        fontSize: 16,
        marginBottom: 10,
        fontWeight: '500',
    },
    imagePickerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 20,
        height: 150,
        borderWidth: 2,
        borderColor: '#007AFF',
        borderStyle: 'dashed',
        borderRadius: 8,
        backgroundColor: '#f9f9f9'
    },
    imagePickerText: {
        color: '#007AFF',
        fontWeight: '600'
    },
    imagePreview: {
        width: '100%',
        height: '100%',
        borderRadius: 6,
    },
    input: {
        height: 100,
        borderColor: '#ddd',
        borderWidth: 1,
        padding: 10,
        borderRadius: 5,
        fontSize: 16,
        textAlignVertical: 'top',
        backgroundColor: '#f9f9f9'
    },
    submitButton: {
      marginHorizontal: 15,
      marginVertical: 10,
      backgroundColor: '#007AFF',
      borderRadius: 8,
      padding: 15,
      alignItems: 'center',
    },
    disabledButton: {
      backgroundColor: '#aaa',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600'
    }
});