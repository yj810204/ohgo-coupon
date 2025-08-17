// app/admin-main.tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function AdminMainScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Navigation functions
  const navigateToUserManagement = () => {
    router.push({
      pathname: '/admin',
      params: params,
    });
  };

  const navigateToSettings = () => {
    router.push({
      pathname: '/settings',
      params: params,
    });
  };
  
  const navigateToPushNotification = () => {
    router.push({
      pathname: '/admin-push',
      params: params,
    });
  };
  
  const navigateToFishManagement = () => {
    router.push({
      pathname: '/admin-fish',
      params: params,
    });
  };
  
  const navigateToGameSettings = () => {
    router.push({
      pathname: '/admin-game-settings',
      params: params,
    });
  };
  
  const navigateToGameRanking = () => {
    router.push({
      pathname: '/mini-games/ranking',
      params: params,
    });
  };
  
  const navigateToMiniGame = () => {
    router.push({
      pathname: '/mini-games/fishing',
      params: params,
    });
  };
  
  const navigateToBoardingForm = () => {
    router.push({
      pathname: '/boarding-form',
      params: params,
    });
  };


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>오고피씽</Text>
          <Text style={styles.headerSubtitle}>관리자 페이지</Text>
        </View>

        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.menuItem} onPress={navigateToUserManagement}>
            <View style={styles.iconContainer}>
              <Ionicons name="people" size={40} color="#1E88E5" />
            </View>
            <Text style={styles.menuText}>회원 관리</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={navigateToSettings}>
            <View style={styles.iconContainer}>
              <Ionicons name="settings" size={40} color="#34C759" />
            </View>
            <Text style={styles.menuText}>설정</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={navigateToPushNotification}>
            <View style={styles.iconContainer}>
              <Ionicons name="notifications" size={40} color="#FF9500" />
            </View>
            <Text style={styles.menuText}>전체 알림</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={navigateToFishManagement}>
            <View style={styles.iconContainer}>
              <Ionicons name="fish" size={40} color="#9C27B0" />
            </View>
            <Text style={styles.menuText}>물고기 도감</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={navigateToGameSettings}>
            <View style={styles.iconContainer}>
              <Ionicons name="settings-outline" size={40} color="#4CAF50" />
            </View>
            <Text style={styles.menuText}>게임 설정</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={navigateToMiniGame}>
            <View style={styles.iconContainer}>
              <Ionicons name="game-controller" size={40} color="#FF3B30" />
            </View>
            <Text style={styles.menuText}>미니 게임</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={navigateToGameRanking}>
            <View style={styles.iconContainer}>
              <Ionicons name="trophy" size={40} color="#FFD700" />
            </View>
            <Text style={styles.menuText}>게임 랭킹</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={navigateToBoardingForm}>
            <View style={styles.iconContainer}>
              <Ionicons name="boat" size={40} color="#007AFF" />
            </View>
            <Text style={styles.menuText}>명부 작성</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>오고피씽 관리자 페이지입니다.</Text>
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'GiantBold',
    color: '#333',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 18,
    fontFamily: 'GiantRegular',
    color: '#666',
  },
  menuContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  menuItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuText: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#333',
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#888',
  },
});