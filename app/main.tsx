// app/main.tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function MainScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Navigation functions
  const navigateToStamp = () => {
    router.push({
      pathname: '/stamp',
      params: params,
    });
  };

  const navigateToCoupons = () => {
    router.push({
      pathname: '/coupons',
      params: params,
    });
  };

  const navigateToMiniGames = () => {
    router.push({
      pathname: '/mini-games',
      params: params,
    });
  };

  const navigateToSettings = () => {
    router.push({
      pathname: '/settings',
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
          <Text style={styles.headerSubtitle}>환영합니다!</Text>
        </View>

        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.menuItem} onPress={navigateToStamp}>
            <View style={styles.iconContainer}>
              <Ionicons name="clipboard" size={40} color="#FF9500" />
            </View>
            <Text style={styles.menuText}>스탬프</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={navigateToCoupons}>
            <View style={styles.iconContainer}>
              <Ionicons name="gift" size={40} color="#FF2D55" />
            </View>
            <Text style={styles.menuText}>쿠폰</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={navigateToMiniGames}>
            <View style={styles.iconContainer}>
              <Ionicons name="game-controller" size={40} color="#FF3B30" />
            </View>
            <Text style={styles.menuText}>미니 게임</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={navigateToBoardingForm}>
            <View style={styles.iconContainer}>
              <Ionicons name="boat" size={40} color="#007AFF" />
            </View>
            <Text style={styles.menuText}>명부 작성</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={navigateToSettings}>
            <View style={styles.iconContainer}>
              <Ionicons name="settings" size={40} color="#34C759" />
            </View>
            <Text style={styles.menuText}>설정</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>오고피씽과 함께 즐거운 시간 되세요!</Text>
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