import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, FlatList, ActivityIndicator } from 'react-native';
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
      const startDateStr = format(monthStart, 'yyyy-MM-dd');
      const endDateStr = format(monthEnd, 'yyyy-MM-dd');
      
      // Create an array of all dates in the current month
      const datesArray = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const datesWithRosterArray: string[] = [];
      
      // Check each date for roster data
      for (const date of datesArray) {
        const dateStr = format(date, 'yyyy-MM-dd');
        const attendanceRef = doc(db, 'attendance', dateStr);
        const attendanceSnap = await getDoc(attendanceRef);
        
        if (attendanceSnap.exists() && attendanceSnap.data().members && attendanceSnap.data().members.length > 0) {
          datesWithRosterArray.push(dateStr);
        }
      }
      
      setDatesWithRoster(datesWithRosterArray);
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
  
  // Handle date selection
  const handleDateClick = (day: Date) => {
    setSelectedDate(day);
    
    // Navigate to roster list for the selected date
    router.push({
      pathname: '/roster-list',
      params: { 
        date: format(day, 'yyyy-MM-dd'),
        dateDisplay: format(day, 'yyyy년 MM월 dd일')
      }
    });
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
          <TouchableOpacity onPress={prevMonth}>
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.calendarTitle}>
            {format(currentMonth, dateFormat)}
          </Text>
          <TouchableOpacity onPress={nextMonth}>
            <Ionicons name="chevron-forward" size={24} color="#333" />
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
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell,
                  isToday ? styles.todayCell : null,
                ]}
                onPress={() => handleDateClick(day)}
              >
                <View style={styles.dayCellContent}>
                  <Text 
                    style={[
                      styles.dayText,
                      dayOfWeek === 0 ? styles.sundayText : null,
                      dayOfWeek === 6 ? styles.saturdayText : null,
                      isToday ? styles.todayText : null,
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>
                  {hasRoster && <View style={styles.rosterDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>날짜를 선택하면 해당 날짜의 명부를 확인할 수 있습니다.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
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
  },
  dayCellContent: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingBottom: 6, // Add padding to ensure consistent height
  },
  rosterDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1e88e5',
    position: 'absolute',
    bottom: 2, // Position dot at the bottom with consistent spacing
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 18,
    fontFamily: "GiantRegular",
    color: '#333',
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
});