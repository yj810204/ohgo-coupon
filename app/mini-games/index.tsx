// app/mini-games/index.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function MiniGamesMenu() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [fishingEnabled, setFishingEnabled] = useState(true);
  const [blockEnabled, setBlockEnabled] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchVisibility = async () => {
      try {
        const visibilityDoc = await getDoc(doc(db, 'gameSettings', 'miniGames'));

        if (!isMounted) return;

        if (visibilityDoc.exists()) {
          const data = visibilityDoc.data();
          setFishingEnabled(data.fishingEnabled !== false);
          setBlockEnabled(data.blockEnabled !== false);
        } else {
          setFishingEnabled(true);
          setBlockEnabled(true);
        }
      } catch (error) {
        console.error('미니 게임 표시 설정 조회 오류:', error);
        if (isMounted) {
          Alert.alert('오류', '미니 게임 정보를 불러오는 중 문제가 발생했습니다.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchVisibility();

    return () => {
      isMounted = false;
    };
  }, []);

  const navigateToFishing = () => {
    router.push({
      pathname: '/mini-games/fishing',
      params: params,
    });
  };

  const navigateToBlockGame = () => {
    router.push({
      pathname: '/mini-games/block',
      params: params,
    });
  };

  const navigateToRanking = () => {
    router.push({
      pathname: '/mini-games/ranking',
      params: params,
    });
  };

  const goBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>미니 게임 정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const noGamesAvailable = !fishingEnabled && !blockEnabled;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.subtitle}>
          <Text style={styles.subtitleText}>즐겨보세요!</Text>
        </View>

        <View style={styles.gamesContainer}>
          {fishingEnabled && (
            <TouchableOpacity style={styles.gameCard} onPress={navigateToFishing}>
              <View style={styles.gameIconContainer}>
                <Ionicons name="fish" size={32} color="#007AFF" />
              </View>
              <View style={styles.gameTextContainer}>
                <Text style={styles.gameTitle}>낚시 게임</Text>
                <Text style={styles.gameDescription}>물고기를 잡아서 포인트를 얻어보세요!</Text>
              </View>
            </TouchableOpacity>
          )}

          {blockEnabled && (
            <TouchableOpacity style={styles.gameCard} onPress={navigateToBlockGame}>
              <View style={styles.gameIconContainer}>
                <Ionicons name="grid" size={32} color="#FF3B30" />
              </View>
              <View style={styles.gameTextContainer}>
                <Text style={styles.gameTitle}>블록 게임</Text>
                <Text style={styles.gameDescription}>3개 이상 모인 블록을 터뜨려보세요!</Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.gameCard} onPress={navigateToRanking}>
            <View style={styles.gameIconContainer}>
              <Ionicons name="trophy" size={32} color="#FFD700" />
            </View>
            <View style={styles.gameTextContainer}>
              <Text style={styles.gameTitle}>게임 랭킹</Text>
              <Text style={styles.gameDescription}>다른 플레이어들과 순위를 확인하세요!</Text>
            </View>
          </TouchableOpacity>
          {noGamesAvailable && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>현재 이용 가능한 미니 게임이 없습니다.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'GiantRegular',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  subtitle: {
    alignItems: 'center',
    marginBottom: 20,
  },
  subtitleText: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#666',
  },
  gamesContainer: {
    gap: 12,
  },
  gameCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
    flexDirection: 'row',
    maxHeight: 100,
  },
  gameIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  gameTitle: {
    fontSize: 18,
    fontFamily: 'GiantRegular',
    color: '#333',
    marginBottom: 4,
  },
  gameDescription: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#666',
    lineHeight: 18,
  },
  gameTextContainer: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#666',
  },
  emptyState: {
    marginTop: 10,
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#666',
    textAlign: 'center',
  },
});