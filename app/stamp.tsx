import { db } from '@/firebase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { clearUser } from '../utils/secure-store';
import { getCouponCount, getStamps } from '../utils/stamp-service';

export default function StampScreen() {
  const { name, dob, uuid } = useLocalSearchParams();
  const [stamps, setStamps] = useState<string[]>([]);
  const [couponCount, setCouponCount] = useState(0);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStamps(); // 기존 fetch 재사용
    setRefreshing(false);
  };

  const fetchStamps = async () => {
    if (typeof uuid !== 'string') return;
    const data = await getStamps(uuid);
    setStamps(data);

    const coupons = await getCouponCount(uuid);
    setCouponCount(coupons);
  };

  useFocusEffect(
    useCallback(() => {
      fetchStamps();
    }, [uuid])
  );

  const renderStamp = (index: number) => {
    const date = stamps[index];
    const filled = !!date;
    const formatDateShort = (date: string): string => {
        // "2025-05-14" → "25-05-14"
        if (date.length === 10) {
          return date.slice(2); // "25-05-14"
        }
        return date;
      };

    return (
      <View key={index} style={styles.stampBox}>
        <Text style={filled ? styles.stampChecked : styles.stampEmpty}>
          {/* {filled ? '🟢' : '◯'} */}
            {filled ? (
                <Ionicons name="ribbon-outline" size={32} color="#4caf50" />
            ) : (
                <Ionicons name="ellipse-outline" size={32} color="#ccc" />
            )}
        </Text>
        <Text style={styles.dateText} numberOfLines={1}>{date ? formatDateShort(date) : '-'}</Text>
      </View>
    );
  };

  const handleLogout = async () => {
    console.log('✅ 로그아웃 시도');
  
    try {
      const uuidString = typeof uuid === 'string' ? uuid : null;
      const pushToken = await SecureStore.getItemAsync('expoPushToken');
  
      console.log('uuid:', uuidString);
      console.log('pushToken:', pushToken);
  
      if (uuidString && pushToken) {
        console.log('푸시 토큰 삭제 시도:', pushToken);
  
        // ✅ Firestore 문서 필드 삭제
        await updateDoc(doc(db, 'users', uuidString), {
          expoPushToken: deleteField(),
        });
  
        // ✅ SecureStore 삭제
        await SecureStore.deleteItemAsync('expoPushToken');
      }
  
      await clearUser();
      await Updates.reloadAsync();
    } catch (e) {
      console.error('🚨 로그아웃 처리 중 에러:', e);
    }
  };
  

  return (
    <ScrollView contentContainerStyle={styles.container} refreshControl={
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
    }>
      <View style={styles.userInfo}>
        <Text style={styles.info}>회원정보 : {name} / {dob}</Text>
        <View style={styles.couponRow}>
            <Ionicons name="card-outline" size={24} color="#333" style={{ marginRight: 6 }} />
            <Text style={styles.couponText}>보유 쿠폰: {couponCount}개</Text>
        </View>
      </View>

        <View style={styles.cardBox}>
            <Text style={styles.title}>스탬프 적립 현황</Text>

            <View style={styles.grid}>
                {Array.from({ length: 10 }).map((_, i) => renderStamp(i))}
            </View>
        </View>

      <View style={styles.buttonWrapper}>
        <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
            router.push({
                pathname: '/qr-scan',
                params: { uuid, name, dob },
            })
            }
        >
            <Text style={styles.buttonText}>QR 스캔하기</Text>
        </TouchableOpacity>

        <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
            router.push({
                pathname: '/coupons',
                params: { uuid, name, dob },
            })
            }
        >
            <Text style={styles.buttonText}>보유 쿠폰 보기</Text>
        </TouchableOpacity>

        <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleLogout}
        >
            <Text style={styles.buttonText}>로그아웃</Text>
        </TouchableOpacity>
        </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
    container: {
      padding: 24,
      backgroundColor: '#f7f9fc',
      alignItems: 'center',
      minHeight: '100%',
    },
  
    userInfo: {
      backgroundColor: '#fff',
      padding: 16,
      borderRadius: 12,
      width: '100%',
      marginBottom: 20,
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
  
    info: {
      fontSize: 14,
      marginBottom: 6,
      fontFamily: 'GiantRegular',
      color: '#666',
    },
  
    couponRow: {
        flexDirection: 'row',
        alignItems: 'center'
      },
    couponText: {
        fontSize: 18,
        color: '#333',
        fontFamily: 'GiantRegular',
    },
  
    title: {
      fontSize: 22,
      fontFamily: 'GiantRegular',
      color: '#1e88e5',
      marginBottom: 8,
    },
  
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginBottom: 0,
      rowGap: 12,
    },
  
    stampBox: {
        width: 70,
        height: 70,
        margin: 6,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 24,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
    },
  
    stampChecked: {
      fontSize: 28,
      fontFamily: 'GiantRegular',
      color: '#4caf50',
    },
  
    stampEmpty: {
      fontSize: 28,
      color: '#ccc',
    },
  
    dateText: {
      fontSize: 11,
      marginTop: 3,
      color: '#666',
      fontFamily: 'GiantRegular',
    },
  
    buttonWrapper: {
        width: '100%',
        marginTop: 8,
        gap: 12,
      },
      
      primaryButton: {
        backgroundColor: '#2196F3',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
      },
      
      dangerButton: {
        backgroundColor: '#f44336',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
      },
      
      buttonText: {
        color: '#fff',
        fontSize: 18,
        fontFamily: 'GiantRegular',
      },
      cardBox: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        width: '100%',
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
  });
