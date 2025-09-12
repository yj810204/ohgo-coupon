import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, FlatList, ActivityIndicator, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, getDocs, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';
import { addMonths } from 'date-fns';
import { subMonths } from 'date-fns';
import { startOfMonth } from 'date-fns';
import { endOfMonth } from 'date-fns';
import { getDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { eachDayOfInterval } from 'date-fns/eachDayOfInterval';

export default function TodayRosterScreen() {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [datesWithRoster, setDatesWithRoster] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [tempSelectedDate, setTempSelectedDate] = useState<Date | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [confirmedTrips, setConfirmedTrips] = useState<Record<string, number[]>>({});
  const [usingCachedData, setUsingCachedData] = useState(false);
  
  // Cache for month data to avoid redundant fetches
  const [cachedMonths, setCachedMonths] = useState<Record<string, {
    datesWithRoster: string[],
    confirmedTrips: Record<string, number[]>,
    timestamp: number
  }>>({});
  
  // Function to limit cache size (keep only the 3 most recently used months)
  const limitCacheSize = (cache: Record<string, any>) => {
    const MAX_CACHE_SIZE = 3;
    if (Object.keys(cache).length <= MAX_CACHE_SIZE) return cache;
    
    // Sort by timestamp (most recent first)
    const sortedEntries = Object.entries(cache).sort((a, b) => b[1].timestamp - a[1].timestamp);
    // Keep only the MAX_CACHE_SIZE most recent entries
    const limitedEntries = sortedEntries.slice(0, MAX_CACHE_SIZE);
    
    return Object.fromEntries(limitedEntries);
  };

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = monthStart;
  const endDate = monthEnd;

  const dateFormat = "yyyy년 MM월";
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  // Get day names in Korean
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  
  // Calculate the day of the week for the first day of the month (0 = Sunday, 6 = Saturday)
  const startDay = getDay(monthStart);
  
  // Create empty cells for days before the first day of the month
  const blanks = Array(startDay).fill(null);
  
  // Navigate to previous month
  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };
  
  // Navigate to next month
  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };
  
  // Fetch roster data for the current month
  const fetchRosterData = async () => {
    setLoading(true);
    try {
      const monthKey = format(currentMonth, 'yyyy-MM');
      
      // Check if we already have cached data for this month
      if (cachedMonths[monthKey]) {
        console.log('Using cached data for month:', monthKey);
        setDatesWithRoster(cachedMonths[monthKey].datesWithRoster);
        setConfirmedTrips(cachedMonths[monthKey].confirmedTrips);
        setUsingCachedData(true);
        
        // Update the timestamp to mark this cache entry as recently used
        setCachedMonths(prev => {
          const updatedCache = {
            ...prev,
            [monthKey]: {
              ...prev[monthKey],
              timestamp: Date.now()
            }
          };
          return limitCacheSize(updatedCache);
        });
        
        setLoading(false);
        return;
      }
      
      // If we're fetching new data, reset the cached data flag
      setUsingCachedData(false);
      
      const startDateStr = format(monthStart, 'yyyy-MM-dd');
      const endDateStr = format(monthEnd, 'yyyy-MM-dd');
      
      // Create an array of all dates in the current month
      const datesArray = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const datesWithRosterArray: string[] = [];
      const confirmedTripsData: Record<string, number[]> = {};
      
      // Batch fetch attendance data for the entire month
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('__name__', '>=', startDateStr),
        where('__name__', '<=', endDateStr)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      
      // Create a map of dates with attendance
      const attendanceDates = new Map();
      attendanceSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.members && data.members.length > 0) {
          attendanceDates.set(doc.id, true);
        }
      });
      
      // Batch fetch trips data for the entire month
      const tripsQuery = query(
        collection(db, 'trips'),
        where('__name__', '>=', startDateStr),
        where('__name__', '<=', endDateStr)
      );
      const tripsSnapshot = await getDocs(tripsQuery);
      
      // Create a map of dates with confirmed trips
      const tripsDates = new Map();
      tripsSnapshot.forEach(doc => {
        const tripsData = doc.data();
        const confirmedForDate: number[] = [];
        
        // Define the trip data type with proper typing
        interface TripData {
          confirmed: boolean;
          confirmedAt: string;
        }
        
        // Define the document data type with index signature for dynamic trip keys
        interface TripsDocData {
          [key: `trip${number}`]: TripData;
        }
        
        // Cast the data to our typed interface
        const typedTripsData = tripsData as TripsDocData;
        
        // Check each trip (1, 2, 3)
        for (let i = 1; i <= 3; i++) {
          const tripKey = `trip${i}` as `trip${number}`;
          if (typedTripsData[tripKey] && typedTripsData[tripKey].confirmed) {
            confirmedForDate.push(i);
          }
        }
        
        if (confirmedForDate.length > 0) {
          tripsDates.set(doc.id, confirmedForDate);
        }
      });
      
      // Process all dates in the month using the cached data
      for (const date of datesArray) {
        const dateStr = format(date, 'yyyy-MM-dd');
        
        // Check for attendance data using the map
        if (attendanceDates.has(dateStr)) {
          datesWithRosterArray.push(dateStr);
        }
        
        // Check for confirmed trips using the map
        if (tripsDates.has(dateStr)) {
          confirmedTripsData[dateStr] = tripsDates.get(dateStr);
        }
      }
      
      // Update state
      setDatesWithRoster(datesWithRosterArray);
      setConfirmedTrips(confirmedTripsData);
      
      // Cache the data for this month with timestamp
      setCachedMonths(prev => {
        const updatedCache = {
          ...prev,
          [monthKey]: {
            datesWithRoster: datesWithRosterArray,
            confirmedTrips: confirmedTripsData,
            timestamp: Date.now()
          }
        };
        
        // Limit cache size
        return limitCacheSize(updatedCache);
      });
      
    } catch (error) {
      console.error('Error fetching roster data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Load roster data when month changes
  useEffect(() => {
    fetchRosterData();
  }, [currentMonth]);
  
  // Add a timeout to hide loading indicator if it takes too long
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setLoading(false);
      }, 10000); // 10 seconds timeout
      return () => clearTimeout(timer);
    }
  }, [loading]);
  
  // Handle date selection
  const handleDateClick = (day: Date) => {
    setTempSelectedDate(day);
    setSelectedTrip(null);
    setModalVisible(true);
  };
  
  // Check if a date is before today (for disabling new roster creation)
  const isDateBeforeToday = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date < today;
  };
  
  // Handle trip selection and navigation
  const handleTripSelection = (tripNumber: number) => {
    if (tempSelectedDate) {
      setSelectedDate(tempSelectedDate);
      setSelectedTrip(tripNumber);
      setModalVisible(false);
      
      // Navigate to roster list for the selected date and trip
      router.push({
        pathname: '/roster-list',
        params: { 
          date: format(tempSelectedDate, 'yyyy-MM-dd'),
          dateDisplay: format(tempSelectedDate, 'yyyy년 MM월 dd일'),
          tripNumber: tripNumber
        }
      });
    }
  };
  
  // Go back to previous screen
  const goBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={prevMonth} disabled={loading}>
            <Ionicons name="chevron-back" size={24} color={loading ? "#ccc" : "#333"} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.calendarTitle}>
              {format(currentMonth, dateFormat)}
            </Text>
            {usingCachedData && (
              <View style={styles.cachedIndicator}>
                <Ionicons name="flash" size={14} color="#4caf50" />
                <Text style={styles.cachedText}>빠른 로딩</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={nextMonth} disabled={loading}>
            <Ionicons name="chevron-forward" size={24} color={loading ? "#ccc" : "#333"} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.daysHeader}>
          {dayNames.map((day: string, index: number) => (
            <Text 
              key={index} 
              style={[
                styles.dayName, 
                index === 0 ? styles.sundayText : null,
                index === 6 ? styles.saturdayText : null
              ]}
            >
              {day}
            </Text>
          ))}
        </View>
        
        <View style={styles.daysContainer}>
          {/* Empty cells for days before the first day of the month */}
          {blanks.map((_: null, index: number) => (
            <View key={`blank-${index}`} style={styles.dayCell} />
          ))}
          
          {/* Calendar days */}
          {days.map((day: Date, index: number) => {
            const dayOfWeek = getDay(day);
            const dateStr = format(day, 'yyyy-MM-dd');
            const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
            const hasRoster = datesWithRoster.includes(dateStr);
            const isPastDate = isDateBeforeToday(new Date(day));
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell,
                  isToday ? styles.todayCell : null,
                  loading ? styles.dayCellDisabled : null,
                  isPastDate ? styles.pastDateCell : null,
                ]}
                onPress={() => !loading && handleDateClick(day)}
                disabled={loading}
              >
                <View style={styles.dayCellContent}>
                  <Text 
                    style={[
                      styles.dayText,
                      dayOfWeek === 0 ? styles.sundayText : null,
                      dayOfWeek === 6 ? styles.saturdayText : null,
                      isToday ? styles.todayText : null,
                      loading ? styles.dayTextDisabled : null,
                      isPastDate ? styles.pastDateText : null,
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>
                  {/* Show dots based on the number of trips */}
                  {confirmedTrips[dateStr] && confirmedTrips[dateStr].length > 0 && (
                    <View style={styles.dotsContainer}>
                      {confirmedTrips[dateStr].map((tripNum, idx) => (
                        <View key={idx} style={styles.rosterDot} />
                      ))}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        
        {/* Loading overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#1e88e5" />
            <Text style={styles.loadingText}>명부 정보를 불러오는 중...</Text>
          </View>
        )}
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>날짜를 선택하면 해당 날짜의 명부를 확인할 수 있습니다.</Text>
      </View>

      {/* Trip Selection Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {tempSelectedDate ? format(tempSelectedDate, 'yyyy년 MM월 dd일') : ''}
            </Text>
            
            <View style={styles.tripButtonsContainer}>
              {tempSelectedDate && (() => {
                const dateStr = format(tempSelectedDate, 'yyyy-MM-dd');
                const confirmedForDate = confirmedTrips[dateStr] || [];
                
                return (
                  <>
                    <TouchableOpacity 
                      style={[
                        styles.tripButton,
                        confirmedForDate.includes(1) && styles.tripButtonConfirmed
                      ]} 
                      onPress={async () => {
                        if (confirmedForDate.includes(1)) {
                          // For confirmed trips, get the image URL from Firebase and navigate to roster-preview
                          const dateStr = format(tempSelectedDate, 'yyyy-MM-dd');
                          const tripsDocRef = doc(db, 'trips', dateStr);
                          const tripsDocSnap = await getDoc(tripsDocRef);
                          
                          if (tripsDocSnap.exists()) {
                            const tripData = tripsDocSnap.data().trip1;
                            
                            if (tripData && tripData.rosterImageUrl) {
                              // Navigate directly to roster-preview with the image URL
                              router.push({
                                pathname: '/roster-preview',
                                params: { 
                                  imageUri: tripData.rosterImageUrl,
                                  date: dateStr,
                                  tripNumber: 1
                                }
                              });
                            } else {
                              // If no image URL is found, still go to roster-list with showPreview
                              router.push({
                                pathname: '/roster-list',
                                params: { 
                                  date: dateStr,
                                  dateDisplay: format(tempSelectedDate, 'yyyy년 MM월 dd일'),
                                  tripNumber: 1,
                                  showPreview: 'true'
                                }
                              });
                            }
                          } else {
                            // If no trip document exists, go to roster-list with showPreview
                            router.push({
                              pathname: '/roster-list',
                              params: { 
                                date: dateStr,
                                dateDisplay: format(tempSelectedDate, 'yyyy년 MM월 dd일'),
                                tripNumber: 1,
                                showPreview: 'true'
                              }
                            });
                          }
                        } else {
                          // For past dates, only allow viewing existing rosters, not creating new ones
                          if (isDateBeforeToday(tempSelectedDate)) {
                            // Show alert that new entries can't be created for past dates
                            Alert.alert(
                              '알림',
                              '오늘 이전의 명부는 미리보기만 가능하고 신규 작성은 불가능합니다.',
                              [{ text: '확인', onPress: () => setModalVisible(false) }]
                            );
                          } else {
                            handleTripSelection(1);
                          }
                        }
                      }}
                    >
                      <Text style={[
                        styles.tripButtonText,
                        confirmedForDate.includes(1) && styles.tripButtonTextConfirmed
                      ]}>
                        1항차 {confirmedForDate.includes(1) ? '(확정)' : ''}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[
                        styles.tripButton,
                        confirmedForDate.includes(2) && styles.tripButtonConfirmed
                      ]} 
                      onPress={async () => {
                        if (confirmedForDate.includes(2)) {
                          // For confirmed trips, get the image URL from Firebase and navigate to roster-preview
                          const dateStr = format(tempSelectedDate, 'yyyy-MM-dd');
                          const tripsDocRef = doc(db, 'trips', dateStr);
                          const tripsDocSnap = await getDoc(tripsDocRef);
                          
                          if (tripsDocSnap.exists()) {
                            const tripData = tripsDocSnap.data().trip2;
                            
                            if (tripData && tripData.rosterImageUrl) {
                              // Navigate directly to roster-preview with the image URL
                              router.push({
                                pathname: '/roster-preview',
                                params: { 
                                  imageUri: tripData.rosterImageUrl,
                                  date: dateStr,
                                  tripNumber: 2
                                }
                              });
                            } else {
                              // If no image URL is found, still go to roster-list with showPreview
                              router.push({
                                pathname: '/roster-list',
                                params: { 
                                  date: dateStr,
                                  dateDisplay: format(tempSelectedDate, 'yyyy년 MM월 dd일'),
                                  tripNumber: 2,
                                  showPreview: 'true'
                                }
                              });
                            }
                          } else {
                            // If no trip document exists, go to roster-list with showPreview
                            router.push({
                              pathname: '/roster-list',
                              params: { 
                                date: dateStr,
                                dateDisplay: format(tempSelectedDate, 'yyyy년 MM월 dd일'),
                                tripNumber: 2,
                                showPreview: 'true'
                              }
                            });
                          }
                        } else {
                          // For past dates, only allow viewing existing rosters, not creating new ones
                          if (isDateBeforeToday(tempSelectedDate)) {
                            // Show alert that new entries can't be created for past dates
                            Alert.alert(
                              '알림',
                              '오늘 이전의 명부는 미리보기만 가능하고 신규 작성은 불가능합니다.',
                              [{ text: '확인', onPress: () => setModalVisible(false) }]
                            );
                          } else {
                            handleTripSelection(2);
                          }
                        }
                      }}
                    >
                      <Text style={[
                        styles.tripButtonText,
                        confirmedForDate.includes(2) && styles.tripButtonTextConfirmed
                      ]}>
                        2항차 {confirmedForDate.includes(2) ? '(확정)' : ''}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[
                        styles.tripButton,
                        confirmedForDate.includes(3) && styles.tripButtonConfirmed
                      ]} 
                      onPress={async () => {
                        if (confirmedForDate.includes(3)) {
                          // For confirmed trips, get the image URL from Firebase and navigate to roster-preview
                          const dateStr = format(tempSelectedDate, 'yyyy-MM-dd');
                          const tripsDocRef = doc(db, 'trips', dateStr);
                          const tripsDocSnap = await getDoc(tripsDocRef);
                          
                          if (tripsDocSnap.exists()) {
                            const tripData = tripsDocSnap.data().trip3;
                            
                            if (tripData && tripData.rosterImageUrl) {
                              // Navigate directly to roster-preview with the image URL
                              router.push({
                                pathname: '/roster-preview',
                                params: { 
                                  imageUri: tripData.rosterImageUrl,
                                  date: dateStr,
                                  tripNumber: 3
                                }
                              });
                            } else {
                              // If no image URL is found, still go to roster-list with showPreview
                              router.push({
                                pathname: '/roster-list',
                                params: { 
                                  date: dateStr,
                                  dateDisplay: format(tempSelectedDate, 'yyyy년 MM월 dd일'),
                                  tripNumber: 3,
                                  showPreview: 'true'
                                }
                              });
                            }
                          } else {
                            // If no trip document exists, go to roster-list with showPreview
                            router.push({
                              pathname: '/roster-list',
                              params: { 
                                date: dateStr,
                                dateDisplay: format(tempSelectedDate, 'yyyy년 MM월 dd일'),
                                tripNumber: 3,
                                showPreview: 'true'
                              }
                            });
                          }
                        } else {
                          // For past dates, only allow viewing existing rosters, not creating new ones
                          if (isDateBeforeToday(tempSelectedDate)) {
                            // Show alert that new entries can't be created for past dates
                            Alert.alert(
                              '알림',
                              '오늘 이전의 명부는 미리보기만 가능하고 신규 작성은 불가능합니다.',
                              [{ text: '확인', onPress: () => setModalVisible(false) }]
                            );
                          } else {
                            handleTripSelection(3);
                          }
                        }
                      }}
                    >
                      <Text style={[
                        styles.tripButtonText,
                        confirmedForDate.includes(3) && styles.tripButtonTextConfirmed
                      ]}>
                        3항차 {confirmedForDate.includes(3) ? '(확정)' : ''}
                      </Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>
            
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },
  pastDateCell: {
    backgroundColor: '#f0f0f0',
  },
  pastDateText: {
    color: '#999999',
  },
  placeholder: {
    width: 40,
  },
  calendarContainer: {
    margin: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative', // For positioning the loading overlay
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    zIndex: 10,
  },
  loadingText: {
    marginTop: 10,
    color: '#1e88e5',
    fontSize: 14,
    fontFamily: "GiantRegular",
  },
  dayCellDisabled: {
    opacity: 0.5,
  },
  dayTextDisabled: {
    color: '#aaa',
  },
  dayCellContent: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingBottom: 6, // Add padding to ensure consistent height
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 2,
    width: '100%',
    gap: 4, // Space between dots
  },
  rosterDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1e88e5',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  calendarTitle: {
    fontSize: 18,
    fontFamily: "GiantRegular",
    color: '#333',
  },
  cachedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  cachedText: {
    fontSize: 10,
    color: '#4caf50',
    marginLeft: 2,
    fontFamily: "GiantRegular",
  },
  daysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dayName: {
    width: 40,
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    fontFamily: "GiantRegular"
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayCell: {
    width: '14.28%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayText: {
    fontSize: 16,
    color: '#333',
    fontFamily: "GiantRegular"
  },
  todayCell: {
    backgroundColor: '#e6f7ff',
    borderRadius: 20,
  },
  todayText: {
    color: '#1e88e5',
    fontFamily: "GiantRegular"
  },
  sundayText: {
    color: '#e53935',
  },
  saturdayText: {
    color: '#1e88e5',
  },
  infoContainer: {
    padding: 16,
    alignItems: 'center',
  },
  infoText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: "GiantRegular"
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "GiantRegular",
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  tripButtonsContainer: {
    width: '100%',
    marginBottom: 20,
  },
  tripButton: {
    backgroundColor: '#1e88e5',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  tripButtonDisabled: {
    backgroundColor: '#b0bec5',
    borderWidth: 1,
    borderColor: '#90a4ae',
  },
  tripButtonConfirmed: {
    backgroundColor: '#4caf50',
    borderWidth: 1,
    borderColor: '#388e3c',
  },
  tripButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: "GiantRegular",
  },
  tripButtonTextDisabled: {
    color: '#546e7a',
  },
  tripButtonTextConfirmed: {
    color: 'white',
    fontFamily: "GiantRegular",
  },
  cancelButton: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    width: '50%',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: "GiantRegular",
  },
});