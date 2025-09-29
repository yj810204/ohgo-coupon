import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { collection, doc, addDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

// 레벨 선택 드롭다운 컴포넌트
const LevelBar = ({ level, onSelectLevel, showLevelText = true }: { level: number, onSelectLevel: (level: number) => void, showLevelText?: boolean }) => {
  // 레벨은 -3부터 -1 및 1부터 5까지의 값 (0 제외)
  const normalizedLevel = level === 0 ? -1 : Math.max(-3, Math.min(5, level));
  
  // 레벨 옵션 정의 (0 제외)
  const levelOptions = [
    { value: -3, label: '-3 (차감 포인트 많음)' },
    { value: -2, label: '-2 (차감 포인트 중간)' },
    { value: -1, label: '-1 (차감 포인트 적음)' },
    { value: 1, label: '1 (매우 쉬움)' },
    { value: 2, label: '2 (쉬움)' },
    { value: 3, label: '3 (보통)' },
    { value: 4, label: '4 (어려움)' },
    { value: 5, label: '5 (매우 어려움)' }
  ];
  
  return (
    <View style={styles.levelSelectContainer}>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={normalizedLevel}
          onValueChange={(itemValue) => onSelectLevel(Number(itemValue))}
          style={styles.picker}
        >
          {levelOptions.map((option) => (
            <Picker.Item 
              key={option.value.toString()} 
              label={option.label} 
              value={option.value} 
            />
          ))}
        </Picker>
      </View>
    </View>
  );
};

export default function AdminFishAddScreen() {
  const [isLoading, setIsLoading] = useState(false);
  
  // 폼 상태
  const [name, setName] = useState('');
  const [level, setLevel] = useState('-1');
  const [image, setImage] = useState<string | null>(null);
  
  const router = useRouter();

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('권한 필요', '이미지를 선택하려면 갤러리 접근 권한이 필요합니다.');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (fishId: string): Promise<string | null> => {
    if (!image) return null;
    
    try {
      // 이미지 URI에서 Blob 가져오기
      const response = await fetch(image);
      const blob = await response.blob();
      
      // Storage 참조 생성 및 업로드
      const imageRef = ref(storage, `fishes/${fishId}`);
      await uploadBytes(imageRef, blob);
      
      // 다운로드 URL 가져오기
      const downloadURL = await getDownloadURL(imageRef);
      return downloadURL;
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      Alert.alert('오류', '이미지 업로드에 실패했습니다.');
      return null;
    }
  };

  const handleSubmit = async () => {
    // 유효성 검사
    if (!name.trim()) {
      Alert.alert('오류', '물고기 이름을 입력해주세요.');
      return;
    }
    
    const levelNum = Number(level);
    if (!level || isNaN(levelNum) || 
        (levelNum > 0 && (levelNum < 1 || levelNum > 5)) || 
        (levelNum < 0 && (levelNum < -3 || levelNum > -1))) {
      Alert.alert('오류', '유효한 레벨 값을 입력해주세요 (-3~-1 또는 1-5).');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // 새 물고기 추가
      const docRef = await addDoc(collection(db, 'fishes'), {
        name,
        level: Number(level),
        createdAt: new Date().toISOString(),
      });
      
      // 이미지 업로드 및 문서 업데이트
      const imgUrl = await uploadImage(docRef.id);
      if (imgUrl) {
        await updateDoc(docRef, { img: imgUrl });
      }
      
      Alert.alert(
        '성공', 
        '새 물고기가 추가되었습니다.',
        [
          { 
            text: '확인', 
            onPress: () => router.back() 
          }
        ]
      );
    } catch (error) {
      console.error('물고기 저장 오류:', error);
      Alert.alert('오류', '물고기 정보 저장에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView>
        <View style={styles.formContainer}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>이름 *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="물고기 이름"
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>난이도 *</Text>
            <View style={styles.levelContainer}>
              <LevelBar 
                level={Number(level)} 
                onSelectLevel={(selectedLevel) => setLevel(selectedLevel.toString())} 
              />
            </View>
          </View>
          
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>이미지 (선택사항)</Text>
            <TouchableOpacity 
              style={styles.imagePicker}
              onPress={pickImage}
            >
              {image ? (
                <Image source={{ uri: image }} style={styles.previewImage} />
              ) : (
                <View style={styles.imagePickerPlaceholder}>
                  <Ionicons name="image-outline" size={40} color="#ccc" />
                  <Text style={styles.imagePickerText}>이미지 선택</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          
          <View style={styles.formActions}>
            <TouchableOpacity 
              style={[styles.formButton, styles.cancelButton]}
              onPress={() => router.back()}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.formButton, styles.submitButton]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>추가하기</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f7f9fc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  // 드롭다운 선택 스타일
  levelSelectContainer: {
    marginVertical: 10,
    alignItems: 'center',
    width: '100%',
  },
  pickerContainer: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f9f9f9'
  },
  picker: {
    width: '100%'
  },
  levelDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    fontFamily: 'GiantRegular',
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontFamily: 'GiantRegular',
    color: '#1e88e5',
    marginLeft: 8,
  },
  levelContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
  },
  // Old level bar styles removed and replaced with radio button styles
  // Keeping these for backward compatibility
  levelButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  levelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  levelButtonSelected: {
    backgroundColor: '#1e88e5',
  },
  levelButtonText: {
    fontSize: 16,
    color: '#333',
  },
  levelButtonTextSelected: {
    color: '#fff',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'GiantRegular',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  imagePicker: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  imagePickerPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerText: {
    marginTop: 8,
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#999',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
    flex: 1,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  formButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontFamily: 'GiantRegular',
  },
  submitButton: {
    backgroundColor: '#1e88e5',
    marginLeft: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'GiantRegular',
  },
});