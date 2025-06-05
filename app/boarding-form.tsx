import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Modal from 'react-native-modal';
import { useRouter } from 'expo-router';
import { getDoc, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { getUser } from '../utils/secure-store';

export default function BoardingForm() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [form, setForm] = useState<{
    name: string;
    birth: string;
    gender: string;
    phone: string;
    emergency: string;
    address: string;
  }>({
    name: '',
    birth: '',
    gender: '',
    phone: '',
    emergency: '',
    address: '',
  });

  const [agreed, setAgreed] = useState(false);
  const [agreedThirdParty, setAgreedThirdParty] = useState(false);
  const [showBirthModal, setShowBirthModal] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [birthDate, setBirthDate] = useState(new Date());

  useEffect(() => {
    (async () => {
      try {
        const user = await getUser();
        if (!user?.uuid) return;
        const snap = await getDoc(doc(db, 'users', user.uuid, 'boarding', 'info'));
        if (snap.exists()) {
          const data = snap.data();
          setForm(data as typeof form);
          setAgreed(!!data.agreed);
          setAgreedThirdParty(!!data.agreedThirdParty);
        }
      } catch (e) {
        console.warn('불러오기 오류:', e);
      }
    })();
  }, []);

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm({ ...form, [key]: value });
  };

  const formatPhone = (value: string) => {
    const numbersOnly = value.replace(/[^0-9]/g, '');
    if (numbersOnly.length < 4) return numbersOnly;
    if (numbersOnly.length < 7)
      return `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3)}`;
    if (numbersOnly.length < 11)
      return `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3, 6)}-${numbersOnly.slice(6)}`;
    return `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3, 7)}-${numbersOnly.slice(7, 11)}`;
  };

  const handlePhoneChange = (key: keyof typeof form, value: string) => {
    const formatted = formatPhone(value);
    handleChange(key, formatted);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.birth || !form.gender || !form.phone || !form.emergency || !form.address) {
      Alert.alert('입력 필요', '모든 항목을 빠짐없이 입력해 주세요.');
      return;
    }
    if (!agreed) {
      Alert.alert('동의 필요', '개인정보 수집 및 이용에 동의하셔야 합니다.');
      return;
    }
    if (!agreedThirdParty) {
      Alert.alert('동의 필요', '제3자 개인정보 제공에 동의하셔야 합니다.');
      return;
    }
    if (!/^[0-9]{6}$|^[0-9]{8}$/.test(form.birth.replace(/-/g, ''))) {
      Alert.alert('생년월일 확인', '생년월일은 6자리 또는 8자리여야 합니다.');
      return;
    }
    try {
      const user = await getUser();
      if (!user?.uuid) throw new Error('UUID가 없습니다.');
      await setDoc(doc(db, 'users', user.uuid, 'boarding', 'info'), { ...form, agreed, agreedThirdParty });
      Alert.alert('저장 완료', '승선 정보가 저장되었습니다.');
      router.back();
    } catch (e) {
      console.error('저장 오류:', e);
      Alert.alert('오류', '정보 저장 중 오류가 발생했습니다.');
    }
  };

  const confirmBirthDate = () => {
    const yyyy = birthDate.getFullYear();
    const mm = String(birthDate.getMonth() + 1).padStart(2, '0');
    const dd = String(birthDate.getDate()).padStart(2, '0');
    handleChange('birth', `${yyyy}-${mm}-${dd}`);
    setShowBirthModal(false);
  };

  const handleBirthChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'set' && selectedDate) {
        setBirthDate(selectedDate);
        const yyyy = selectedDate.getFullYear();
        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const dd = String(selectedDate.getDate()).padStart(2, '0');
        handleChange('birth', `${yyyy}-${mm}-${dd}`);
      }
      setShowBirthModal(false);
    } else {
      if (selectedDate) setBirthDate(selectedDate);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" ref={scrollRef}>
        <View style={styles.cardBox}>
          <Text style={styles.title}>승선 정보 입력</Text>

          {[
            { label: '이름', key: 'name', placeholder: '홍길동' },
            { label: '생년월일', key: 'birth', placeholder: '생년월일 선택' },
            { label: '성별', key: 'gender', placeholder: '성별 선택' },
            { label: '연락처', key: 'phone', placeholder: '010-1234-5678' },
            { label: '비상 연락처', key: 'emergency', placeholder: '예: 보호자 연락처' },
            { label: '주소', key: 'address', placeholder: '주소를 입력해주세요.' },
          ].map(({ label, key, placeholder }) => (
            <View style={styles.field} key={key}>
              <Text style={styles.label}>{label}</Text>
              {key === 'birth' ? (
                <TouchableOpacity onPress={() => setShowBirthModal(true)} style={styles.input}>
                  <Text style={styles.text}>{form.birth || placeholder}</Text>
                </TouchableOpacity>
              ) : key === 'gender' ? (
                <TouchableOpacity onPress={() => setShowGenderModal(true)} style={styles.input}>
                  <Text style={styles.text}>{form.gender || placeholder}</Text>
                </TouchableOpacity>
              ) : (
                <TextInput
                  style={styles.input}
                  placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChangeText={(text) =>
                    key === 'phone' || key === 'emergency'
                      ? handlePhoneChange(key as keyof typeof form, text)
                      : handleChange(key as keyof typeof form, text)
                  }
                  keyboardType={key === 'phone' || key === 'emergency' ? 'phone-pad' : 'default'}
                />
              )}
            </View>
          ))}

          <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreed(!agreed)}>
            <Ionicons name={agreed ? 'checkbox-outline' : 'square-outline'} size={22} color={agreed ? '#1e88e5' : '#888'} />
            <Text style={styles.checkboxLabel}> 개인정보 수집 및 이용에 동의합니다.</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreedThirdParty(!agreedThirdParty)}>
            <Ionicons name={agreedThirdParty ? 'checkbox-outline' : 'square-outline'} size={22} color={agreedThirdParty ? '#1e88e5' : '#888'} />
            <Text style={styles.checkboxLabel}> 제3자 개인정보 제공에 동의합니다.</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>저장</Text>
          </TouchableOpacity>
        </View>

        <Modal isVisible={showBirthModal} onBackdropPress={() => setShowBirthModal(false)} style={styles.modalWrap}>
          <View style={styles.modalBox}>
            <DateTimePicker
              value={birthDate}
              mode="date"
              display="spinner"
              onChange={handleBirthChange}
              maximumDate={new Date()}
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity style={styles.submitButton} onPress={confirmBirthDate}>
                <Text style={styles.submitButtonText}>확인</Text>
              </TouchableOpacity>
            )}
          </View>
        </Modal>

        <Modal isVisible={showGenderModal} onBackdropPress={() => setShowGenderModal(false)} style={styles.modalWrap}>
          <View style={styles.modalBox}>
            {['남', '여'].map((gender) => (
              <TouchableOpacity key={gender} onPress={() => {
                setShowGenderModal(false);
                handleChange('gender', gender);
              }}>
                <Text style={styles.genderOption}>{gender}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowGenderModal(false)}>
              <Text style={[styles.genderOption, { color: '#888' }]}>취소</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  cardBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    marginBottom: 60,
  },
  title: {
    fontSize: 20,
    marginBottom: 20,
    color: '#1e88e5',
    fontFamily: 'GiantRegular',
  },
  field: { marginBottom: 16 },
  label: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
    fontFamily: 'GiantRegular',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    fontFamily: 'GiantRegular',
  },
  text: {
    fontFamily: 'GiantRegular',
    fontSize: 14,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    fontFamily: 'GiantRegular',
  },
  submitButton: {
    marginTop: 12,
    backgroundColor: '#1e88e5',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'GiantRegular',
  },
  modalWrap: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalBox: {
    backgroundColor: '#fff',
    padding: 10,
  },
  genderOption: {
    fontSize: 18,
    paddingVertical: 12,
    textAlign: 'center',
    fontFamily: 'GiantRegular',
  },
});
