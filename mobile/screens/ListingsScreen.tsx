import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, TextInput, SafeAreaView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getListings } from '../api';
import { useAuth } from '../contexts/AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type ListingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Listings'>;

export default function ListingsScreen({ navigation }: ListingsScreenProps) {
  const { signOut } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
      queryKey: ['listings'], 
      queryFn: getListings
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filteredData, setFilteredData] = useState(data?.data || []);

  useEffect(() => {
    if (data?.data) {
      if (searchQuery === '') {
        setFilteredData(data.data);
      } else {
        const lowercasedQuery = searchQuery.toLowerCase();
        const filtered = data.data.filter(item => {
          const titleMatch = item.title?.toLowerCase().includes(lowercasedQuery);
          const summaryMatch = item.summary?.toLowerCase().includes(lowercasedQuery);
          return titleMatch || summaryMatch;
        });
        setFilteredData(filtered);
      }
    }
  }, [searchQuery, data]);


  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <View style={styles.headerLeftContainer}>
          <TouchableOpacity onPress={() => navigation.navigate('Invoices')}>
            <Text style={styles.headerButtonText}>Invoices</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.headerButtonText}>Profile</Text>
          </TouchableOpacity>
        </View>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, signOut]);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (error) {
    return <View style={styles.center}><Text>Error fetching listings. Check connection.</Text></View>;
  }

  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <TouchableOpacity 
        style={styles.contentTouchable}
        onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
        activeOpacity={0.7}
      >
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.summary} numberOfLines={2}>{item.summary}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.purchaseButton}
        onPress={() => navigation.navigate('Purchase', { listingId: item.id })}
      >
        <Text style={styles.purchaseButtonText}>Purchase</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title or summary..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>
      <FlatList
        data={filteredData}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        onRefresh={refetch}
        refreshing={isLoading}
        contentContainerStyle={{paddingBottom: 8}}
        ListEmptyComponent={<View style={styles.center}><Text>No listings available.</Text></View>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f7',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#f0f0f7',
  },
  searchInput: {
    height: 44,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerLeftContainer: {
    flexDirection: 'row',
    gap: 20,
  },
  headerButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  logoutText: {
    color: '#007AFF',
    fontSize: 16,
    marginRight: 10,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  contentTouchable: {
    marginBottom: 16,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#111827',
  },
  summary: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  purchaseButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});