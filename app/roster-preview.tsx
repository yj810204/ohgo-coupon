import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator, Image, ScrollView, Alert, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { doc, getDoc, updateDoc, setDoc, deleteField } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

export default function RosterPreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { imageUri, date, tripNumber } = params;
  
  const [savingImage, setSavingImage] = useState(false);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [imageAvailable, setImageAvailable] = useState(false);
  const MAX_RETRIES = 3; // Maximum number of retry attempts
  
  // Gesture and animation values for pinch zoom and pan
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Function to reset zoom and pan state
  const resetZoomState = () => {
    console.log('Resetting zoom state');
    try {
      scale.value = withTiming(1);
      savedScale.value = 1;
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
      setIsZoomed(false);
    } catch (error) {
      console.error('Error in resetZoomState:', error);
      // Ensure we set the React state even if the animations fail
      setIsZoomed(false);
    }
  };

  // Define gesture handlers using useRef to maintain consistent references
  const gestures = useRef({
    pan: Gesture.Pan()
      .minDistance(0) // Reduce minimum distance to detect pan gesture
      .activeOffsetX([-5, 5]) // Detect horizontal pan with minimal movement
      .activeOffsetY([-5, 5]) // Detect vertical pan with minimal movement
      .onBegin(() => {
        'worklet';
        console.log('Pan gesture began');
      })
      .onUpdate((e) => {
        'worklet';
        try {
          // Only allow panning when zoomed in
          if (scale.value > 1) {
            translateX.value = savedTranslateX.value + e.translationX;
            translateY.value = savedTranslateY.value + e.translationY;
          }
        } catch (error) {
          console.error('Error in pan onUpdate:', error);
        }
      })
      .onEnd(() => {
        'worklet';
        try {
          // Save the final translation values
          savedTranslateX.value = translateX.value;
          savedTranslateY.value = translateY.value;
        } catch (error) {
          console.error('Error in pan onEnd:', error);
          // Reset to safe values if there's an error
          translateX.value = 0;
          translateY.value = 0;
          savedTranslateX.value = 0;
          savedTranslateY.value = 0;
        }
      }),

    doubleTap: Gesture.Tap()
      .numberOfTaps(2)
      .onStart(() => {
        'worklet';
        console.log('Double tap detected');
      })
      .onEnd(() => {
        'worklet';
        try {
          console.log('Double tap gesture ended, current scale:', scale.value);
          if (scale.value !== 1) {
            console.log('Double tap - resetting zoom');
            // Reset zoom directly in the worklet
            scale.value = withTiming(1);
            savedScale.value = 1;
            translateX.value = withTiming(0);
            translateY.value = withTiming(0);
            savedTranslateX.value = 0;
            savedTranslateY.value = 0;
            runOnJS(setIsZoomed)(false);
          } else {
            console.log('Double tap - zooming in to 2x');
            // Zoom in to 2x
            scale.value = withTiming(2);
            savedScale.value = 2;
            runOnJS(setIsZoomed)(true);
          }
        } catch (error) {
          console.error('Error in doubleTap onEnd:', error);
          // Reset to safe values if there's an error
          scale.value = withTiming(1);
          savedScale.value = 1;
          translateX.value = withTiming(0);
          translateY.value = withTiming(0);
          savedTranslateX.value = 0;
          savedTranslateY.value = 0;
          runOnJS(setIsZoomed)(false);
        }
      })
  }).current;

  // Combine gestures - using useRef to ensure stable references
  // Modified to remove pinch zoom while keeping double-tap zoom and panning
  const combinedGestures = useRef(
    Gesture.Simultaneous(
      gestures.pan,
      gestures.doubleTap
    )
  ).current;

  // First mount initialization
  useEffect(() => {
    // Initialize gesture handlers on first mount
    console.log('Initializing gesture handlers on first mount');

    // Pre-initialize the gesture system with more aggressive initialization
    // This helps ensure the gesture system is fully activated and responsive
    const timer1 = setTimeout(() => {
      // Small animation to ensure the gesture system is activated
      scale.value = withTiming(1.01, { duration: 5 }, () => {
        scale.value = withTiming(1, { duration: 5 });
      });
    }, 50);

    // Second initialization to ensure pan gesture is responsive
    const timer2 = setTimeout(() => {
      // Trigger small translations to initialize pan gesture handling
      translateX.value = withTiming(1, { duration: 5 }, () => {
        translateX.value = withTiming(0, { duration: 5 });
      });
      translateY.value = withTiming(1, { duration: 5 }, () => {
        translateY.value = withTiming(0, { duration: 5 });
      });
    }, 100);

    // Cleanup function to prevent memory leaks
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);

      // Reset all animation values when component unmounts
      scale.value = 1;
      savedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;

      // Also reset React state
      setIsZoomed(false);
      setImageError(false);
    };
  }, []);

  // Define animated style for the image
  const animatedImageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value }
      ]
    };
  });

  // Reset zoom state when image changes and initialize gesture handlers
  useEffect(() => {
    // Reset zoom state and ensure isZoomed is false
    resetZoomState();
    setIsZoomed(false);

    // Reset error state when a new image is set
    setImageError(false);

    // Force gesture handler initialization
    if (localImageUri) {
      // Log the new image URI being loaded
      console.log('Initializing with image URI:', localImageUri);

      // Immediate initialization to ensure gestures are ready as soon as possible
      const immediateTimer = setTimeout(() => {
        // Trigger small animations to ensure gesture handlers are properly initialized
        scale.value = withTiming(1.01, { duration: 5 }, () => {
          scale.value = withTiming(1, { duration: 5 });
        });

        // Also initialize pan gesture
        translateX.value = withTiming(1, { duration: 5 }, () => {
          translateX.value = withTiming(0, { duration: 5 });
        });
        translateY.value = withTiming(1, { duration: 5 }, () => {
          translateY.value = withTiming(0, { duration: 5 });
        });
      }, 50);

      // Secondary initialization after image is likely rendered
      const secondaryTimer = setTimeout(() => {
        // Repeat initialization to ensure gesture system is fully activated
        scale.value = withTiming(1.01, { duration: 5 }, () => {
          scale.value = withTiming(1, { duration: 5 });
        });
        translateX.value = withTiming(1, { duration: 5 }, () => {
          translateX.value = withTiming(0, { duration: 5 });
        });
      }, 300);

      return () => {
        clearTimeout(immediateTimer);
        clearTimeout(secondaryTimer);
      };
    }
  }, [localImageUri]);

  // Function to check if the image is available on the server
  const checkImageAvailability = useCallback(async () => {
    if (!date || !tripNumber || !imageUri) return false;

    try {
      // First check if the image is already available locally
      if (localImageUri && !imageError) {
        console.log('Image already available locally');
        return true;
      }

      console.log('Checking if image is available in Firestore');
      
      // Try to fetch the trip data from Firestore to get the latest image URL
      const dateStr = date as string;
      const tripNum = parseInt(tripNumber as string, 10);
      const tripKey = `trip${tripNum}` as `trip${number}`;

      // Reference to the trips document for this date
      const tripsDocRef = doc(db, 'trips', dateStr);
      const tripsDocSnap = await getDoc(tripsDocRef);

      if (tripsDocSnap.exists()) {
        const data = tripsDocSnap.data();
        // Check if this trip has an image URL
        if (data[tripKey] && data[tripKey].rosterImageUrl) {
          console.log('Found image URL in Firestore:', data[tripKey].rosterImageUrl);
          
          // If the image URL from Firestore is different from the one we have, update it
          if (data[tripKey].rosterImageUrl !== imageUri) {
            console.log('Updating image URI with the one from Firestore');
            setLocalImageUri(data[tripKey].rosterImageUrl);
          }
          
          return true;
        } else {
          console.log('No image URL found in Firestore yet');
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking image availability:', error);
      return false;
    }
  }, [date, tripNumber, imageUri, localImageUri, imageError]);

  // Fetch trip confirmation status from Firestore
  useEffect(() => {
    const checkConfirmationStatus = async () => {
      if (!date || !tripNumber) return;

      try {
        const dateStr = date as string;
        const tripNum = parseInt(tripNumber as string, 10);
        const tripKey = `trip${tripNum}` as `trip${number}`;

        // Reference to the trips document for this date
        const tripsDocRef = doc(db, 'trips', dateStr);
        const tripsDocSnap = await getDoc(tripsDocRef);

        if (tripsDocSnap.exists()) {
          const data = tripsDocSnap.data();
          // Check if this trip is confirmed
          if (data[tripKey] && data[tripKey].confirmed === true) {
            setIsConfirmed(true);
          }
        }
      } catch (error) {
        console.error('Error checking confirmation status:', error);
      }
    };

    checkConfirmationStatus();
  }, [date, tripNumber]);

  // Image availability check (polling removed as it's no longer needed)
  useEffect(() => {
    const checkImage = async () => {
      if (imageUri && !localImageUri && !imageAvailable) {
        // Check once if the image is available in Firestore
        const isAvailable = await checkImageAvailability();
        
        if (isAvailable) {
          console.log('Image is available in Firestore');
          setImageAvailable(true);
          setImageError(false);
        }
      }
    };
    
    checkImage();
  }, [imageUri, localImageUri, imageAvailable, checkImageAvailability]);

  useEffect(() => {
    console.log('imageUri from params:', imageUri);
    // Reset retry count whenever the image URI changes
    setRetryCount(0);
    // Reset image state
    setImageAvailable(false);

    if (imageUri) {
      // Firebase Storage URL 처리를 위한 로직 추가
      let uri = imageUri as string;

      // Firebase URL인 경우 경로 부분 다시 인코딩
      if (uri.includes('firebasestorage.googleapis.com')) {
        // URL 구조: https://firebasestorage.googleapis.com/v0/b/[bucket]/o/[path]?[params]

        // URL을 구성 요소로 분리
        const [baseUrl, params] = uri.split('?');

        // 경로 부분 추출 ('o/' 다음 부분)
        const parts = baseUrl.split('/o/');
        if (parts.length > 1) {
          // 경로 부분이 이미 인코딩되어 있는지 확인
          const path = parts[1];

          // 경로에 / 가 있고 %2F가 없다면 경로를 다시 인코딩
          if (path.includes('/') && !path.includes('%2F')) {
            console.log('Firebase URL 경로 재인코딩 필요:', path);
            // 경로 부분만 인코딩
            const encodedPath = encodeURIComponent(path);
            // 인코딩된 경로로 URL 재구성
            uri = `${parts[0]}/o/${encodedPath}?${params}`;
            console.log('재인코딩된 URL:', uri);
          }
        }
      }

      // Handle potential URI encoding issues
      if (!uri.startsWith('file://') && !uri.startsWith('content://') && !uri.startsWith('http')) {
        // If the URI doesn't have a proper protocol, assume it's a file URI
        uri = `file://${uri}`;
      }

      console.log('Setting image URI directly without cache parameters:', uri);
      setLocalImageUri(uri);
    } else {
      console.log('No imageUri provided in params');
      setImageError(true);
    }
  }, [imageUri]);

  const requestMediaLibraryPermissions = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '갤러리에 저장하기 위해 미디어 라이브러리 권한이 필요합니다.');
      return false;
    }
    return true;
  };
  
  // NOTE: These cache buster functions are no longer used as they were causing issues
  // with Firebase Storage URLs where tokens should not be modified.
  // We now use the original URLs without modification, which matches the behavior in admin-fish-edit.tsx
  
  /*
  // Helper function to clean cache parameters from a URI
  const cleanCacheParameters = (uri: string): string => {
    if (!uri.includes('cache=')) return uri;
    
    let cleanUri = uri;
    // Remove all existing cache parameters
    cleanUri = cleanUri.replace(/[?&]cache=\d+/g, '');
    
    // If we removed the ? entirely, we need to check if there are other parameters
    if (!cleanUri.includes('?') && cleanUri.includes('&')) {
      // Replace the first & with ? since the original ? was removed
      cleanUri = cleanUri.replace('&', '?');
    }
    
    return cleanUri;
  };
  
  // Helper function to add a cache buster to a URI
  const addCacheBuster = (uri: string): string => {
    // Safety check: if the URI is too long, it might have accumulated too many parameters
    // This prevents URLs from growing too large
    const MAX_URI_LENGTH = 2000; // Common limit for URLs
    if (uri.length > MAX_URI_LENGTH) {
      console.warn(`URI is too long (${uri.length} chars), truncating and cleaning`);
      // Extract the base URL without query parameters
      const baseUrl = uri.split('?')[0];
      return `${baseUrl}?cache=${Date.now()}`;
    }
    
    // First clean any existing cache parameters
    const cleanUri = cleanCacheParameters(uri);
    // Then add a new cache parameter
    return `${cleanUri}${cleanUri.includes('?') ? '&' : '?'}cache=${Date.now()}`;
  };
  */
  
  // Dummy functions to avoid errors in case they're still referenced somewhere
  const cleanCacheParameters = (uri: string): string => uri;
  const addCacheBuster = (uri: string): string => uri;

  const confirmDeparture = async () => {
    try {
      if (!date || !tripNumber) {
        Alert.alert('오류', '날짜 또는 항차 정보가 없습니다.');
        return;
      }
      
      // Show confirmation dialog before proceeding
      Alert.alert(
        '출항 확정',
        '출항을 확정하시겠습니까?\n주의: 출항을 확정하면 수정이 불가능합니다.',
        [
          {
            text: '취소',
            style: 'cancel',
            onPress: () => {
              console.log('출항 확정 취소됨');
            }
          },
          {
            text: '확인',
            onPress: () => {
              processConfirmation();
            }
          }
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('Error in confirmDeparture:', error);
      Alert.alert('오류', '출항 확정 처리 중 오류가 발생했습니다.');
    }
  };
  
  const processConfirmation = async () => {
    try {
      setSavingImage(true);

      // Save the image to the device gallery
      if (localImageUri) {
        // Request permissions first
        const hasPermission = await requestMediaLibraryPermissions();
        if (hasPermission) {
          try {
            // Save the image to the gallery
            const asset = await MediaLibrary.createAssetAsync(localImageUri);
            await MediaLibrary.createAlbumAsync('OhGo', asset, false);
            console.log('Image saved to gallery successfully');
          } catch (error) {
            console.error('Error saving image to gallery:', error);
            // Continue with confirmation even if gallery save fails
          }
        }

        // Upload the image to Firebase Storage
        try {
          const response = await fetch(localImageUri);
          const blob = await response.blob();

          // Create a reference to the storage location
          const dateStr = date as string;
          const tripNum = parseInt(tripNumber as string, 10);
          const imagePath = `rosters/${dateStr}/trip${tripNum}.jpg`;
          const storageRef = ref(storage, imagePath);

          // Upload the image
          await uploadBytes(storageRef, blob);

          // Get the download URL
          const downloadURL = await getDownloadURL(storageRef);
          console.log('Image uploaded to Firebase Storage successfully:', downloadURL);

          // Store the confirmation flag and image paths in the database
          const tripsDocRef = doc(db, 'trips', dateStr);
          
          // Check if the document exists
          const tripsDocSnap = await getDoc(tripsDocRef);
          
          // Define the trip key and trip data with proper typing
          const tripKey = `trip${tripNum}` as `trip${number}`;
          
          // Define the trip data type
          interface TripData {
            confirmed: boolean;
            confirmedAt: string;
            rosterImagePath?: string;
            rosterImageUrl?: string;
          }
          
          // Define the document data type with index signature for dynamic trip keys
          interface TripsDocData {
            [key: `trip${number}`]: TripData;
          }
          
          if (tripsDocSnap.exists()) {
            // Update the existing document
            const updatedData: Partial<TripsDocData> = {
              [tripKey]: {
                confirmed: true,
                confirmedAt: new Date().toISOString(),
                rosterImagePath: imagePath,
                rosterImageUrl: downloadURL
              }
            };
            
            await updateDoc(tripsDocRef, updatedData);
          } else {
            // Create a new document
            const newData: TripsDocData = {
              [tripKey]: {
                confirmed: true,
                confirmedAt: new Date().toISOString(),
                rosterImagePath: imagePath,
                rosterImageUrl: downloadURL
              }
            };
            
            await setDoc(tripsDocRef, newData);
          }
        } catch (error) {
          console.error('Error uploading image to Firebase Storage:', error);
          // Continue with confirmation even if image upload fails
        }
      }

      // If we don't have a localImageUri, just update the confirmation status
      else {
        // Store the confirmation flag in the database
        const dateStr = date as string;
        const tripNum = parseInt(tripNumber as string, 10);
        
        // Reference to the trips document for this date
        const tripsDocRef = doc(db, 'trips', dateStr);
        
        // Check if the document exists
        const tripsDocSnap = await getDoc(tripsDocRef);
        
        // Define the trip key and trip data with proper typing
        const tripKey = `trip${tripNum}` as `trip${number}`;
        
        // Define the trip data type
        interface TripData {
          confirmed: boolean;
          confirmedAt: string;
        }
        
        // Define the document data type with index signature for dynamic trip keys
        interface TripsDocData {
          [key: `trip${number}`]: TripData;
        }
        
        if (tripsDocSnap.exists()) {
          // Update the existing document
          const updatedData: Partial<TripsDocData> = {
            [tripKey]: {
              confirmed: true,
              confirmedAt: new Date().toISOString()
            }
          };
          
          await updateDoc(tripsDocRef, updatedData);
        } else {
          // Create a new document
          const newData: TripsDocData = {
            [tripKey]: {
              confirmed: true,
              confirmedAt: new Date().toISOString()
            }
          };
          
          await setDoc(tripsDocRef, newData);
        }
      }
      
      // Delete members field from the attendance document for the current day to prevent duplication in next voyage
      try {
        const dateStr = date as string;
        const attendanceRef = doc(db, 'attendance', dateStr);
        const attendanceSnap = await getDoc(attendanceRef);
        
        if (attendanceSnap.exists()) {
          // Delete the members field from the attendance document instead of setting it to an empty array
          // This ensures that QR-scanned members for the next voyage won't be lost
          await updateDoc(attendanceRef, {
            members: deleteField()
          });
          console.log('Members field deleted from attendance document for date:', dateStr);
        }
      } catch (error) {
        console.error('Error deleting members field from attendance document:', error);
        // Continue with confirmation even if deleting members field fails
      }
      
      Alert.alert('성공', '출항이 확정되었습니다. 승선명부 이미지가 갤러리와 서버에 저장되었습니다.');
      
      // Navigate back to today-roster screen with refresh
      router.replace('/today-roster');
    } catch (error) {
      console.error('Error in processConfirmation:', error);
      Alert.alert('오류', '출항 확정 정보를 저장하는 중 오류가 발생했습니다.');
    } finally {
      setSavingImage(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>명부 이미지 미리보기</Text>
      </View>

      <View style={styles.contentContainer}>
        {localImageUri ? (
          <View style={styles.imageContainer}>
            <GestureDetector gesture={combinedGestures}>
              <Animated.View style={{ width: '100%', alignItems: 'center' }}>
                <Animated.Image
                  source={{ uri: localImageUri }}
                  style={[styles.previewImage, animatedImageStyle]}
                  resizeMode="contain"
                  onLoadStart={() => console.log('Image load started:', localImageUri)}
                  onLoad={() => {
                    console.log('Image loaded successfully:', localImageUri);
                    // Mark image as available when it loads successfully
                    setImageAvailable(true);
                    setImageError(false);
                    
                    // Initialize gestures immediately when image loads
                    // This ensures gestures are responsive as soon as the image is visible
                    scale.value = withTiming(1.01, { duration: 5 }, () => {
                      scale.value = withTiming(1, { duration: 5 });
                    });
                    translateX.value = withTiming(1, { duration: 5 }, () => {
                      translateX.value = withTiming(0, { duration: 5 });
                    });
                    translateY.value = withTiming(1, { duration: 5 }, () => {
                      translateY.value = withTiming(0, { duration: 5 });
                    });
                  }}
                  onError={(e) => {
                    console.error('Image loading error:', e.nativeEvent.error);
                    
                    // Check if we've exceeded the maximum number of retries
                    if (retryCount >= MAX_RETRIES) {
                      console.log(`Maximum retry attempts (${MAX_RETRIES}) reached, setting error state`);
                      setImageError(true);
                      return;
                    }
                    
                    // Increment retry count
                    setRetryCount(prevCount => prevCount + 1);
                    
                    // Enhanced error handling for image loading failures
                    if (localImageUri) {
                      // First try: Check if URI needs a file:// prefix
                      if (!localImageUri.startsWith('file://') && 
                          !localImageUri.startsWith('content://') && 
                          !localImageUri.startsWith('http')) {
                        const fixedUri = `file://${localImageUri}`;
                        console.log(`Retry attempt ${retryCount + 1}/${MAX_RETRIES}: Trying with fixed URI format:`, fixedUri);
                        setLocalImageUri(fixedUri);
                        return;
                      }
                      
                      // For HTTP URLs, we'll use the original URL without modification
                      // This matches the behavior in admin-fish-edit.tsx
                      if (localImageUri.startsWith('http')) {
                        console.log(`Retry attempt ${retryCount + 1}/${MAX_RETRIES}: Using original URL without modification`);
                        // Force a re-render by setting the same URL again
                        setLocalImageUri(localImageUri);
                        return;
                      }
                    }
                    
                    console.log('Could not display image, setting error state');
                    setImageError(true);
                  }}
                />
              </Animated.View>
            </GestureDetector>
          </View>
        ) : imageError ? (
          <View style={styles.noImageContainer}>
            <Text style={styles.noImageText}>이미지를 불러올 수 없습니다.</Text>
            <Text style={styles.noImageSubText}>이미지 서버에 일시적인 문제가 있을 수 있습니다.</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                // Reset error state and retry count for manual retry
                setImageError(false);
                setRetryCount(0);
                setImageAvailable(false);
                
                // Try loading the image again with the original URL
                if (imageUri && typeof imageUri === 'string') {
                  console.log('Manual retry: Using original image URI without modification');
                  setLocalImageUri(imageUri as string);
                } else if (localImageUri) {
                  // If we only have localImageUri, use that without modification
                  console.log('Manual retry: Using original localImageUri without modification');
                  // Force a re-render by setting the same URL again
                  const currentUri = localImageUri;
                  setLocalImageUri(null);
                  setTimeout(() => setLocalImageUri(currentUri), 50);
                }
              }}
            >
              <Text style={styles.retryButtonText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noImageContainer}>
            <ActivityIndicator size="large" color="#1e88e5" style={styles.loadingIndicator} />
            <Text style={styles.noImageText}>이미지를 불러오는 중...</Text>
          </View>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={isConfirmed ? styles.fullWidthBackButton : styles.backButton}
          onPress={() => router.back()}
          disabled={savingImage}
        >
          <Text style={styles.buttonText}>이전</Text>
        </TouchableOpacity>

        {!isConfirmed && (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={confirmDeparture}
            disabled={savingImage}
          >
            {savingImage ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.buttonText}>출항 확정</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },
  headerContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "GiantRegular",
    color: '#333',
    textAlign: 'center',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  imageContainer: {
    width: '100%',
    minHeight: 500, // Ensure container has minimum height
    overflow: 'visible', // Allow image to overflow if needed
    alignItems: 'center', // Center horizontally
    justifyContent: 'center', // Center vertically
    marginVertical: 10, // Add some vertical margin
  },
  previewImage: {
    width: '100%',
    height: undefined,
    aspectRatio: 0.7, // A4 paper ratio (portrait)
    marginBottom: 0,
    // Ensure the image can be properly manipulated
    alignSelf: 'center',
    backgroundColor: '#f0f0f0', // Light background to see image boundaries
  },
  noImageContainer: {
    width: '100%',
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
  },
  loadingIndicator: {
    marginBottom: 16,
  },
  noImageText: {
    fontSize: 16,
    fontFamily: "GiantRegular",
    color: '#666',
    marginBottom: 8,
  },
  noImageSubText: {
    fontSize: 14,
    fontFamily: "GiantRegular",
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: 'white',
    position: 'relative', // Ensure it's not fixed at bottom
  },
  backButton: {
    flex: 1,
    backgroundColor: '#9e9e9e',
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  fullWidthBackButton: {
    flex: 1,
    backgroundColor: '#9e9e9e',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#1e88e5',
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: "GiantRegular",
  },
  retryButton: {
    backgroundColor: '#1e88e5',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: "GiantRegular",
    textAlign: 'center',
  },
});