import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Image, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInvoices, markInvoiceAsPaid } from '../api';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type InvoicesScreenProps = NativeStackScreenProps<RootStackParamList, 'Invoices'>;

const StatusBadge = ({ status }) => {
    let color = '#777';
    let backgroundColor = '#f0f0f0';

    switch (status) {
        case 'Pending Bank Transfer':
            color = '#d97706';
            backgroundColor = '#fef3c7';
            break;
        case 'Pending Confirmation':
            color = '#2563eb';
            backgroundColor = '#dbeafe';
            break;
        case 'Paid - Pending Verification':
             color = '#7e22ce';
             backgroundColor = '#f3e8ff';
             break;
        case 'Completed':
            color = '#16a34a';
            backgroundColor = '#dcfce7';
            break;
        case 'Failed':
            color = '#dc2626';
            backgroundColor = '#fee2e2';
            break;
    }

    return (
        <View style={[styles.badge, { backgroundColor }]}>
            <Text style={[styles.badgeText, { color }]}>{status}</Text>
        </View>
    );
};

export default function InvoicesScreen({ navigation }: InvoicesScreenProps) {
  const queryClient = useQueryClient();
  const { data: invoicesData, isLoading, error, refetch } = useQuery({
    queryKey: ['invoices'],
    queryFn: getInvoices,
  });

  const markAsPaidMutation = useMutation({
    mutationFn: (invoiceId: string) => markInvoiceAsPaid(invoiceId),
    onMutate: async (invoiceId: string) => {
        await queryClient.cancelQueries({ queryKey: ['invoices'] });
        const previousInvoices = queryClient.getQueryData(['invoices']);

        queryClient.setQueryData(['invoices'], (old: any) => {
            if (!old || !old.data) return old;
            return {
                ...old,
                data: old.data.map(invoice => 
                    invoice.id === invoiceId ? { ...invoice, status: 'Paid - Pending Verification' } : invoice
                )
            };
        });
        return { previousInvoices };
    },
    onError: (err, variables, context) => {
        if (context?.previousInvoices) {
            queryClient.setQueryData(['invoices'], context.previousInvoices);
        }
        Alert.alert('Error', 'Could not mark invoice as paid. Please try again.');
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }
  });


  const invoices = invoicesData?.data || [];

  if (isLoading && !invoices.length) { // Show loading only on initial fetch
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (error) {
    return (
        <View style={styles.center}>
            <Text>Error fetching invoices.</Text>
            <Text>Showing cached data if available.</Text>
        </View>
    );
  }

  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle}>{item.listingName}</Text>
        <Text style={styles.itemAmount}>${item.amount.toLocaleString()}</Text>
      </View>
      <Text style={styles.itemDate}>{item.date}</Text>
      <View style={styles.statusContainer}>
        <StatusBadge status={item.status} />
        {item.status === 'Pending Confirmation' && item.receiptPreview && (
          <Image source={{ uri: item.receiptPreview }} style={styles.receiptPreview} />
        )}
      </View>
      {item.status === 'Pending Bank Transfer' && (
        <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('UploadReceipt', { invoiceId: item.id })}
        >
            <Text style={styles.actionButtonText}>Upload Receipt</Text>
        </TouchableOpacity>
      )}
      {item.status === 'Pending Confirmation' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#dcfce7', borderColor: '#16a34a' }]}
            onPress={() => markAsPaidMutation.mutate(item.id)}
            disabled={markAsPaidMutation.isPending}
          >
              <Text style={[styles.actionButtonText, { color: '#16a34a' }]}>
                {markAsPaidMutation.isPending && markAsPaidMutation.variables === item.id 
                    ? 'Updating...' 
                    : 'Mark as Paid'}
              </Text>
          </TouchableOpacity>
      )}
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      data={invoices}
      renderItem={renderItem}
      keyExtractor={item => item.id.toString()}
      onRefresh={refetch}
      refreshing={isLoading}
      contentContainerStyle={{ paddingVertical: 8 }}
      ListEmptyComponent={<View style={styles.center}><Text>No invoices found.</Text></View>}
    />
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
    padding: 20,
    marginTop: 50,
  },
  itemContainer: {
    backgroundColor: '#fff',
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1, // Allow title to wrap
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  itemDate: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  receiptPreview: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  actionButton: {
    marginTop: 16,
    backgroundColor: '#e6f2ff',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#007AFF'
  },
  actionButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
});