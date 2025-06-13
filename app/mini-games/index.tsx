import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function MiniGameIndex() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎮 미니게임</Text>

      <TouchableOpacity
        style={styles.gameButton}
        onPress={() => router.push('/mini-games/fishing')}
      >
        <Text style={styles.gameText}>🎣 낚시 게임</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.gameButton}
        onPress={() => router.push('/mini-games/roulette')}
      >
        <Text style={styles.gameText}>🎡 룰렛 게임</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.gameButton}
        onPress={() => router.push('/mini-games/memory')}
      >
        <Text style={styles.gameText}>🧠 카드 뒤집기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, marginBottom: 40, fontFamily: 'GiantRegular', },
  gameButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 2, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  gameText: { fontSize: 20, fontFamily: 'GiantRegular' }
});
