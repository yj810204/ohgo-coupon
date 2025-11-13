// app/mini-games/block.tsx
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  Easing,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Modal,
  Alert,
  StyleProp,
  ViewStyle,
  ImageBackground,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { doc, setDoc, increment, collection, addDoc, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { loadMiniGameBackground } from '../../utils/mini-game-background';

const { width, height } = Dimensions.get('window');
const BOARD_SIZE = 7; // Changed from 6 to 7 as requested
const CELL_SIZE = (width - 40) / BOARD_SIZE;
const HINT_DELAY = 7000; // milliseconds of inactivity before showing a hint

const BLOCK_THEME_PRIMARY = '#2E7D32';
const BLOCK_THEME_PRIMARY_LIGHT = '#66BB6A';
const BLOCK_THEME_PRIMARY_DARK = '#1B5E20';
const BLOCK_THEME_OVERLAY = 'rgba(46, 125, 50, 0.85)';
const BLOCK_THEME_OVERLAY_STRONG = 'rgba(46, 125, 50, 0.9)';
const BLOCK_THEME_RESULT = 'rgba(30, 115, 80, 0.85)';

// Block emojis - reduced for lower difficulty
const BLOCK_EMOJIS = [
  { emoji: '🍊', color: '#FF8C00' }, // Orange (주황색)
  { emoji: '🍉', color: '#FF69B4' }, // Watermelon (분홍색)
  { emoji: '🍑', color: '#FFB6C1' }, // Peach (Pink - 분홍색)
  { emoji: '🍇', color: '#DDA0DD' }, // Grapes (Purple - 보라색)
  { emoji: '🍒', color: '#DC143C' }, // Cherry (Red - 빨간색, 작고 구분됨)
  { emoji: '🥝', color: '#96CEB4' }, // Kiwi (Green - 초록색)
];


// 폭죽 애니메이션 컴포넌트
const Firework = ({ style, x, y, delay = 0, size = 1 }: { 
  style?: any; 
  x: number; 
  y: number; 
  delay?: number;
  size?: number;
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const particles = useRef(Array.from({ length: 12 }, () => ({
    angle: Math.random() * Math.PI * 2,
    distance: 0.5 + Math.random() * 0.5,
    color: [
      '#ffff00', // 노랑
      '#ff4500', // 주황
      '#ff0000', // 빨강
      '#00ff00', // 초록
      '#00ffff', // 하늘
      '#ff00ff', // 핑크
    ][Math.floor(Math.random() * 6)],
    size: 4 + Math.random() * 4,
  }))).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <View style={[{
      position: 'absolute',
      left: x,
      top: y,
      width: 1,
      height: 1,
    }, style]}>
      {particles.map((particle, index) => (
        <Animated.View
          key={index}
          style={{
            position: 'absolute',
            width: particle.size * size,
            height: particle.size * size,
            backgroundColor: particle.color,
            borderRadius: (particle.size * size) / 2,
            opacity: animatedValue.interpolate({
              inputRange: [0, 0.3, 1],
              outputRange: [0, 1, 0],
            }),
            transform: [
              {
                translateX: animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, Math.cos(particle.angle) * 100 * particle.distance * size],
                }),
              },
              {
                translateY: animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, Math.sin(particle.angle) * 100 * particle.distance * size],
                }),
              },
              {
                scale: animatedValue.interpolate({
                  inputRange: [0, 0.3, 1],
                  outputRange: [0.3, 1, 0.5],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
};

// 성공 폭죽 애니메이션 컴포넌트 (루프 재생)
const SuccessFireworks = () => {
  // 애니메이션 루프를 위한 상태 추가
  const [fireworksKey, setFireworksKey] = useState(0);
  const fireworks = useRef(Array.from({ length: 8 }, () => ({
    x: Math.random() * width * 0.8 + width * 0.1,
    y: Math.random() * height * 0.6 + height * 0.2,
    delay: Math.random() * 1000,
    size: 0.8 + Math.random() * 0.4,
  }))).current;

  // 애니메이션 루프를 위한 타이머 설정
  useEffect(() => {
    // 2.5초마다 새로운 폭죽 세트 생성
    const timer = setInterval(() => {
      // 새로운 랜덤 위치로 폭죽 재생성
      fireworks.forEach(firework => {
        firework.x = Math.random() * width * 0.8 + width * 0.1;
        firework.y = Math.random() * height * 0.6 + height * 0.2;
        firework.delay = Math.random() * 1000;
        firework.size = 0.8 + Math.random() * 0.4;
      });
      // 키 변경으로 컴포넌트 리렌더링 유도
      setFireworksKey(prev => prev + 1);
    }, 2500);

    return () => clearInterval(timer);
  }, []);

  return (
    <View style={{ 
      position: 'absolute', 
      width: width, 
      height: height, 
      zIndex: 1,
      pointerEvents: 'none' // Add pointerEvents: 'none' to allow touches to pass through
    }}>
      {fireworks.map((firework, index) => (
        <Firework 
          key={`${fireworksKey}-${index}`}
          x={firework.x} 
          y={firework.y}
          delay={firework.delay}
          size={firework.size}
        />
      ))}
    </View>
  );
};

type BlockType = {
  id: string;
  color: string;
  emoji: string;
  colorIndex: number;
  row: number;
  col: number;
  animatedValue: Animated.Value;
  isMatched: boolean;
  isAnimating: boolean;
  sequentialIndex?: number; // For sequential animation effect
};

type GameState = 'idle' | 'playing' | 'processing' | 'paused';

type Tournament = {
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
} | null;

export default function BlockGame() {
  const router = useRouter();
  const availabilityAlertShownRef = useRef(false);
  const [isMiniGameAvailable, setIsMiniGameAvailable] = useState(true);
  const [backgroundImageUri, setBackgroundImageUri] = useState<string | null>(null);
  const isGifBackground = useMemo(() => {
    if (!backgroundImageUri) return false;
    const uriWithoutQuery = backgroundImageUri.split('?')[0].toLowerCase();
    return uriWithoutQuery.endsWith('.gif');
  }, [backgroundImageUri]);
  
  // Create a stable ref object to store parameters
  const paramsRef = useRef<{ uuid: string | null }>({ uuid: null });
  
  // Use a separate ref to track if we've initialized the params
  const paramsInitializedRef = useRef<boolean>(false);
  
  // Access params once at the top level to avoid insertion effect issues
  // We need this to make TypeScript happy, but we'll access it safely
  const searchParams = useLocalSearchParams<{ uuid: string; name?: string }>();
  
  // Update the ref safely in an effect, not during render
  useEffect(() => {
    paramsRef.current.uuid = searchParams.uuid || null;
    paramsInitializedRef.current = true;
  }, [searchParams.uuid]);

  useEffect(() => {
    let isMounted = true;

    const checkAvailability = async () => {
      try {
        const visibilityDoc = await getDoc(doc(db, 'gameSettings', 'miniGames'));
        if (!isMounted) return;

        let enabled = true;
        if (visibilityDoc.exists()) {
          const data = visibilityDoc.data();
          enabled = data.blockEnabled !== false;
        }

        setIsMiniGameAvailable(enabled);

        if (!enabled && !availabilityAlertShownRef.current) {
          availabilityAlertShownRef.current = true;
          Alert.alert('이용 불가', '현재 블록 게임은 이용할 수 없습니다.', [
            {
              text: '확인',
              onPress: () => router.back(),
            },
          ]);
        }
      } catch (error) {
        console.error('블록 게임 표시 설정 조회 오류:', error);
      }
    };

    checkAvailability();

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const uri = await loadMiniGameBackground('block');
        if (isMounted) {
          setBackgroundImageUri(uri ?? null);
        }
      } catch (error) {
        console.error('블록 게임 배경 이미지 로드 오류:', error);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);
  
  const [gameState, setGameState] = useState<GameState>('idle');
  const [tournament, setTournament] = useState<Tournament>(null); // 이벤트 정보
  const [modalVisible, setModalVisible] = useState(false); // 이벤트 모달 표시 여부
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0); // Track score with ref to avoid closure issues
  const [moves, setMoves] = useState(0);
  const [board, setBoard] = useState<(BlockType | null)[][]>([]);
  const boardRef = useRef<(BlockType | null)[][]>([]); // Track board with ref to avoid closure issues
  const [selectedBlock, setSelectedBlock] = useState<{row: number, col: number} | null>(null);
  const [draggedBlock, setDraggedBlock] = useState<{row: number, col: number} | null>(null);
  const [blockProcessing, setBlockProcessing] = useState(false); // Track when blocks are being processed
  const blockProcessingRef = useRef(false); // ref로 최신 상태 추적
  const blockProcessingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 드래그 애니메이션 값 - 블록이 손가락을 따라다니도록
  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  
  // 클로저 문제 방지를 위한 ref
  const selectedBlockRef = useRef<{row: number, col: number} | null>(null);
  
  // blockProcessing ref 업데이트
  useEffect(() => {
    blockProcessingRef.current = blockProcessing;
  }, [blockProcessing]);
  
  // 안전장치: blockProcessing이 true로 설정되면 300ms 후 자동으로 false로 리셋
  // (정상적인 경우에는 애니메이션 완료 전에 false로 설정되므로 이는 최후의 안전장치)
  useEffect(() => {
    if (blockProcessing) {
      // 기존 타임아웃 클리어
      if (blockProcessingTimeoutRef.current) {
        clearTimeout(blockProcessingTimeoutRef.current);
      }
      
      // 300ms 후 자동으로 false로 리셋 (안전장치 - 정상적인 경우에는 사용되지 않음)
      blockProcessingTimeoutRef.current = setTimeout(() => {
        console.warn('Block processing timeout - auto resetting to false');
        setBlockProcessing(false);
        blockProcessingTimeoutRef.current = null;
      }, 300);
    } else {
      // false로 설정되면 타임아웃 클리어
      if (blockProcessingTimeoutRef.current) {
        clearTimeout(blockProcessingTimeoutRef.current);
        blockProcessingTimeoutRef.current = null;
      }
    }
    
    return () => {
      if (blockProcessingTimeoutRef.current) {
        clearTimeout(blockProcessingTimeoutRef.current);
      }
    };
  }, [blockProcessing]);
  
  // Game state declarations
  
  // Result modal state
  const [showResultModal, setShowResultModal] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  
  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(60); // 60 seconds = 1 minute
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Combo state
  const [comboCount, setComboCount] = useState(0);
  const [showCombo, setShowCombo] = useState(false);
  const comboAnim = useRef(new Animated.Value(0)).current;
  const comboResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comboAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const [hintMove, setHintMove] = useState<{ row1: number; col1: number; row2: number; col2: number } | null>(null);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintPulseAnim = useRef(new Animated.Value(0)).current;
  const hintAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const stopHintAnimation = useCallback(() => {
    if (hintAnimationRef.current) {
      hintAnimationRef.current.stop();
      hintAnimationRef.current = null;
    }
  }, []);

  const resetHintVisuals = useCallback(() => {
    stopHintAnimation();
    hintPulseAnim.setValue(0);
    setHintMove(null);
  }, [hintPulseAnim, stopHintAnimation]);

  const showHint = useCallback(() => {
    const currentBoard = boardRef.current;
    if (!currentBoard || currentBoard.length === 0) {
      return;
    }

    const clonedBoard = currentBoard.map(row => row.map(cell => (cell ? { ...cell } : null)));
    const movesResult = hasPossibleMoves(clonedBoard, true);

    if (Array.isArray(movesResult) && movesResult.length > 0) {
      const move = movesResult[Math.floor(Math.random() * movesResult.length)];
      setHintMove(move);
      hintPulseAnim.setValue(0);
      stopHintAnimation();
      hintAnimationRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(hintPulseAnim, {
            toValue: 1,
            duration: 550,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(hintPulseAnim, {
            toValue: 0,
            duration: 550,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      hintAnimationRef.current.start();
    } else {
      resetHintVisuals();
    }
  }, [hintPulseAnim, resetHintVisuals, stopHintAnimation]);

  const startHintTimer = useCallback(() => {
    if (hintTimeoutRef.current) {
      clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = null;
    }

    if (gameState !== 'playing') {
      return;
    }

    hintTimeoutRef.current = setTimeout(() => {
      hintTimeoutRef.current = null;
      showHint();
    }, HINT_DELAY);
  }, [gameState, showHint]);

  const registerPlayerAction = useCallback(() => {
    resetHintVisuals();
    startHintTimer();
  }, [resetHintVisuals, startHintTimer]);

  useEffect(() => {
    if (gameState === 'playing') {
      registerPlayerAction();
    } else {
      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current);
        hintTimeoutRef.current = null;
      }
      resetHintVisuals();
    }
  }, [gameState, registerPlayerAction, resetHintVisuals]);
  
  // Bait state
  const [baitUsed, setBaitUsed] = useState(false);
  const [dailyBaitLimit, setDailyBaitLimit] = useState(5); // 하루 미끼 제한 개수
  const [todayBaitUsed, setTodayBaitUsed] = useState(0); // 오늘 사용한 미끼 개수
  const [baitCount, setBaitCount] = useState<number>(0); // 남은 미끼 개수
  const [baitCoupons, setBaitCoupons] = useState(0); // 보유한 미끼 교환권 개수
  const [baitPerCoupon, setBaitPerCoupon] = useState(5); // 교환권 당 미끼 수량
  const [baitLoading, setBaitLoading] = useState(true); // 미끼 데이터 로딩 상태
  const [isStartButtonDisabled, setIsStartButtonDisabled] = useState<boolean>(false);
  
  // Helper function to get today's date as string (YYYY-MM-DD)
  const todayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  
  // Fetch bait data from Firebase
  useEffect(() => {
    // Check if params are initialized
    if (!paramsInitializedRef.current || !paramsRef.current.uuid) {
      console.log('블록 게임: UUID가 없음, 미끼 데이터 로딩 건너뜀');
      return;
    }
    
    console.log(`블록 게임: UUID ${paramsRef.current.uuid}에 대한 미끼 데이터 로딩 시작`);
    setBaitLoading(true);
    
    const loadBaitData = async () => {
      try {
        // Get bait configuration
        console.log('블록 게임: 미끼 설정 가져오기');
        const baitSnap = await getDoc(doc(db, 'config', 'bait'));
        if (baitSnap.exists()) {
          const baitData = baitSnap.data();
          setDailyBaitLimit(baitData.dailyLimit ?? 5);
          setBaitPerCoupon(baitData.baitPerCoupon ?? 5);
          console.log(`블록 게임: 미끼 설정 로드 완료 (일일한도: ${baitData.dailyLimit ?? 5}, 교환권당: ${baitData.baitPerCoupon ?? 5})`);
        } else {
          console.log('블록 게임: 미끼 설정 문서가 존재하지 않음, 기본값 사용');
        }
        
        // Get today's bait usage
        console.log(`블록 게임: 오늘(${todayStr()}) 사용한 미끼 정보 가져오기`);
        const usageSnap = await getDoc(doc(db, `users/${paramsRef.current.uuid}/baitUsage`, todayStr()));
        const todayUsed = usageSnap.exists() ? (usageSnap.data().used || 0) : 0;
        setTodayBaitUsed(todayUsed);
        console.log(`블록 게임: 오늘 사용한 미끼: ${todayUsed}개`);
        
        // Get bait coupons
        console.log('블록 게임: 사용자의 미끼 교환권 정보 가져오기');
        const userSnap = await getDoc(doc(db, 'users', String(paramsRef.current.uuid)));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setBaitCoupons(userData.baitCoupons || 0);
          console.log(`블록 게임: 미끼 교환권: ${userData.baitCoupons || 0}개`);
        } else {
          console.log('블록 게임: 사용자 문서가 존재하지 않음');
        }
        
        console.log('블록 게임: 미끼 데이터 로딩 완료');
      } catch (error) {
        console.error('블록 게임: 미끼 데이터 가져오기 오류:', error);
        Alert.alert('오류', '미끼 정보를 불러오는 중 문제가 발생했습니다. 다시 시도해 주세요.');
      } finally {
        setBaitLoading(false);
      }
    };
    
    loadBaitData();
  }, [paramsInitializedRef.current]);

  // 이벤트 정보 가져오기
  const fetchTournamentData = async () => {
    try {
      const tournamentDoc = await getDoc(doc(db, 'gameSettings', 'tournament'));

      if (tournamentDoc.exists()) {
        const data = tournamentDoc.data();
        if (data.title && data.startDate && data.endDate) {
          const startDate = data.startDate.toDate();
          const endDate = data.endDate.toDate();
          endDate.setHours(23, 59, 59);
          
          setTournament({
            title: data.title,
            description: data.description || '',
            startDate: startDate,
            endDate: endDate,
          });
          console.log('블록 게임: 이벤트 정보 로드 완료:', data.title);
        } else {
          console.log('블록 게임: 이벤트 정보 불완전');
          setTournament(null);
        }
      } else {
        console.log('블록 게임: 이벤트 정보 문서 없음');
        setTournament(null);
      }
    } catch (error) {
      console.error('블록 게임: 이벤트 정보 가져오기 오류:', error);
      setTournament(null);
    }
  };

  // 이벤트 정보 가져오기 (컴포넌트 마운트 시)
  useEffect(() => {
    fetchTournamentData();
  }, []);

  // 이벤트 기간 포맷 함수
  const formatTournamentPeriod = () => {
    if (!tournament) return '';

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    };

    return `${formatDate(tournament.startDate)} ~ ${formatDate(tournament.endDate)}`;
  };

  const isWithinTournamentPeriod = useCallback(() => {
    if (!tournament) return true;
    const now = new Date();
    return now >= tournament.startDate && now <= tournament.endDate;
  }, [tournament]);

  // Initialize board
  const initializeBoard = () => {
    // 보드 초기화 시 blockProcessing을 false로 초기화
    setBlockProcessing(false);
    
    const newBoard: (BlockType | null)[][] = [];
    let id = 0;
    
    for (let row = 0; row < BOARD_SIZE; row++) {
      const boardRow: (BlockType | null)[] = [];
      for (let col = 0; col < BOARD_SIZE; col++) {
        const colorIndex = Math.floor(Math.random() * BLOCK_EMOJIS.length);
        const emojiBlock = BLOCK_EMOJIS[colorIndex];
        boardRow.push({
          id: `block_${id++}`,
          color: emojiBlock.color,
          emoji: emojiBlock.emoji,
          colorIndex,
          row,
          col,
          animatedValue: new Animated.Value(1),
          isMatched: false,
          isAnimating: false,
        });
      }
      newBoard.push(boardRow);
    }
    
    setBoard(newBoard);
    
    // Check for initial matches after board is set
    // Use setTimeout to ensure board state is updated before checking
    setTimeout(() => {
      // Create lightweight board clone for match checking
      const checkBoard = newBoard.map(row => 
        row.map(block => block ? {
          ...block,
          // Only copy the properties needed for match checking
          colorIndex: block.colorIndex,
        } : null)
      );
      
      const initialMatchesExist = hasMatches(checkBoard);
      if (initialMatchesExist) {
        // Process initial matches automatically
        // checkForMatches가 연쇄적으로 applyGravityAndRefill을 호출하므로
        // 마지막에 blockProcessing이 false로 리셋됨
        checkForMatches(newBoard);
      } else {
        // 초기 매치가 없으면 blockProcessing을 false로 유지
        setBlockProcessing(false);
        console.log('Initial board - no matches, blockProcessing set to false');
      }
    }, 100);
  };

  // Swap two blocks
  const swapBlocks = (row1: number, col1: number, row2: number, col2: number) => {
    // Don't allow swapping if game is paused or blocks are being processed
    if (gameState === 'paused' || blockProcessing) {
      console.log("Swap blocked: game is paused or blocks are being processed");
      return;
    }

    registerPlayerAction();
    
    // Store original blocks for potential revert
    const origBlock1 = { ...board[row1][col1]! };
    const origBlock2 = { ...board[row2][col2]! };
    
    setBoard(prevBoard => {
      const newBoard = prevBoard.map(row => [...row]);
      const block1 = newBoard[row1][col1];
      const block2 = newBoard[row2][col2];
      
      if (block1 && block2) {
        // Swap positions
        newBoard[row1][col1] = { ...block2, row: row1, col: col1 };
        newBoard[row2][col2] = { ...block1, row: row2, col: col2 };
        
        setMoves(prev => prev + 1);
        
        // Check for matches after a shorter delay (100ms instead of 200ms)
        setTimeout(() => {
          // Create lightweight board clone for match checking
          // Avoid expensive JSON.parse(JSON.stringify())
          const checkBoard = newBoard.map(row => 
            row.map(block => block ? {
              ...block,
              // Only copy the properties needed for match checking
              colorIndex: block.colorIndex,
            } : null)
          );
          
          const matchesFound = hasMatches(checkBoard);
          
          if (matchesFound) {
            checkForMatches(newBoard);
          } else {
            // No matches found, revert the swap
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            
            // Reset combo count when no match is found
            setComboCount(0);
            setShowCombo(false);
            
            setBoard(prevBoard => {
              const revertedBoard = prevBoard.map(row => [...row]);
              
              // Reset to original positions
              revertedBoard[row1][col1] = { 
                ...origBlock1, 
                row: row1, 
                col: col1 
              };
              
              revertedBoard[row2][col2] = { 
                ...origBlock2, 
                row: row2, 
                col: col2 
              };
              
              return revertedBoard;
            });
            
          }
        }, 100);
      }
      
      return newBoard;
    });
  };

  // Helper function to check if the board has any matches
  const hasMatches = (currentBoard: (BlockType | null)[][]): boolean => {
    // Check horizontal matches
    for (let row = 0; row < BOARD_SIZE; row++) {
      let startCol = 0;
      while (startCol < BOARD_SIZE - 2) { // Need at least 3 blocks for a match
        // Find the start of a potential match
        if (!currentBoard[row][startCol]) {
          startCol++;
          continue;
        }
        
        const colorIndex = currentBoard[row][startCol]!.colorIndex;
        let matchLength = 1;
        
        // Find how far this match extends
        for (let col = startCol + 1; col < BOARD_SIZE; col++) {
          if (currentBoard[row][col] && currentBoard[row][col]!.colorIndex === colorIndex) {
            matchLength++;
            if (matchLength >= 3) {
              return true; // Found a match
            }
          } else {
            break;
          }
        }
        
        startCol++;
      }
    }
    
    // Check vertical matches
    for (let col = 0; col < BOARD_SIZE; col++) {
      let startRow = 0;
      while (startRow < BOARD_SIZE - 2) { // Need at least 3 blocks for a match
        // Find the start of a potential match
        if (!currentBoard[startRow][col]) {
          startRow++;
          continue;
        }
        
        const colorIndex = currentBoard[startRow][col]!.colorIndex;
        let matchLength = 1;
        
        // Find how far this match extends
        for (let row = startRow + 1; row < BOARD_SIZE; row++) {
          if (currentBoard[row][col] && currentBoard[row][col]!.colorIndex === colorIndex) {
            matchLength++;
            if (matchLength >= 3) {
              return true; // Found a match
            }
          } else {
            break;
          }
        }
        
        startRow++;
      }
    }
    
    return false; // No matches found
  };
  
  // Function to check if there are any possible moves and optionally return the possible match positions
  const hasPossibleMoves = (currentBoard: (BlockType | null)[][], returnPositions: boolean = false): boolean | {row1: number, col1: number, row2: number, col2: number}[] => {
    const possibleMoves: {row1: number, col1: number, row2: number, col2: number}[] = [];
    
    // Check each position on the board
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        // Skip empty cells
        if (!currentBoard[row][col]) continue;
        
        // Try swapping with right neighbor
        if (col < BOARD_SIZE - 1 && currentBoard[row][col+1]) {
          // Swap
          const temp = currentBoard[row][col];
          currentBoard[row][col] = currentBoard[row][col+1];
          currentBoard[row][col+1] = temp;
          
          // Check for matches
          const hasMatch = hasMatches(currentBoard);
          
          // Swap back
          const tempBack = currentBoard[row][col];
          currentBoard[row][col] = currentBoard[row][col+1];
          currentBoard[row][col+1] = tempBack;
          
          if (hasMatch) {
            if (returnPositions) {
              possibleMoves.push({row1: row, col1: col, row2: row, col2: col+1});
            } else {
              return true;
            }
          }
        }
        
        // Try swapping with bottom neighbor
        if (row < BOARD_SIZE - 1 && currentBoard[row+1][col]) {
          // Swap
          const temp = currentBoard[row][col];
          currentBoard[row][col] = currentBoard[row+1][col];
          currentBoard[row+1][col] = temp;
          
          // Check for matches
          const hasMatch = hasMatches(currentBoard);
          
          // Swap back
          const tempBack = currentBoard[row][col];
          currentBoard[row][col] = currentBoard[row+1][col];
          currentBoard[row+1][col] = tempBack;
          
          if (hasMatch) {
            if (returnPositions) {
              possibleMoves.push({row1: row, col1: col, row2: row+1, col2: col});
            } else {
              return true;
            }
          }
        }
      }
    }
    
    // If we're returning positions, return the array of possible moves
    if (returnPositions) {
      return possibleMoves;
    }
    
    // If we get here and we're not returning positions, there are no possible moves
    return false;
  };

  // Check for horizontal and vertical matches (3 or more in a row/column)
  const checkForMatches = (currentBoard: (BlockType | null)[][]) => {
    const matches: {row: number, col: number}[] = [];
    
    // Check horizontal matches
    for (let row = 0; row < BOARD_SIZE; row++) {
      let startCol = 0;
      while (startCol < BOARD_SIZE) {
        // Find the start of a potential match
        if (!currentBoard[row][startCol]) {
          startCol++;
          continue;
        }
        
        const colorIndex = currentBoard[row][startCol]!.colorIndex;
        let endCol = startCol;
        
        // Find how far this match extends
        while (
          endCol + 1 < BOARD_SIZE && 
          currentBoard[row][endCol + 1] && 
          currentBoard[row][endCol + 1]!.colorIndex === colorIndex
        ) {
          endCol++;
        }
        
        // If we have 3 or more in a row, add to matches
        if (endCol - startCol >= 2) {  // 3 or more blocks
          for (let col = startCol; col <= endCol; col++) {
            matches.push({row, col});
          }
        }
        
        // Move to the next potential match
        startCol = endCol + 1;
      }
    }
    
    // Check vertical matches
    for (let col = 0; col < BOARD_SIZE; col++) {
      let startRow = 0;
      while (startRow < BOARD_SIZE) {
        // Find the start of a potential match
        if (!currentBoard[startRow][col]) {
          startRow++;
          continue;
        }
        
        const colorIndex = currentBoard[startRow][col]!.colorIndex;
        let endRow = startRow;
        
        // Find how far this match extends
        while (
          endRow + 1 < BOARD_SIZE && 
          currentBoard[endRow + 1][col] && 
          currentBoard[endRow + 1][col]!.colorIndex === colorIndex
        ) {
          endRow++;
        }
        
        // If we have 3 or more in a column, add to matches
        if (endRow - startRow >= 2) {  // 3 or more blocks
          for (let row = startRow; row <= endRow; row++) {
            matches.push({row, col});
          }
        }
        
        // Move to the next potential match
        startRow = endRow + 1;
      }
    }

    if (matches.length > 0) {
      removeMatches(matches);
    }
  };

  // Remove matched blocks with animation
  const removeMatches = (matches: {row: number, col: number}[]) => {
    // Set blockProcessing to true to prevent interaction during animations
    setBlockProcessing(true);
    
    registerPlayerAction();

    const animations: Animated.CompositeAnimation[] = [];
    
    setBoard(prevBoard => {
      const newBoard = prevBoard.map(row => [...row]);
      
      matches.forEach(({row, col}) => {
        if (newBoard[row][col]) {
          newBoard[row][col]!.isMatched = true;
          newBoard[row][col]!.isAnimating = true;
          
          // Reduce animation duration from 300ms to 200ms for faster visual response
          const animation = Animated.timing(newBoard[row][col]!.animatedValue, {
            toValue: 0,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          });
          
          animations.push(animation);
        }
      });
      
      return newBoard;
    });

    // Play haptic feedback - moved before animation for faster tactile response
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Clear any existing combo reset timeout
    if (comboResetTimeoutRef.current) {
      clearTimeout(comboResetTimeoutRef.current);
      comboResetTimeoutRef.current = null;
    }
    
    // Set a new timeout to reset combo after 3 seconds of inactivity
    comboResetTimeoutRef.current = setTimeout(() => {
      setComboCount(0);
      setShowCombo(false);
    }, 3000); // 3 seconds timeout
    
    
    // Update score immediately for responsive UI with combo multiplier using the freshly computed combo value
    // Move scoring inside the combo updater to avoid using a stale comboCount value
    setComboCount(prev => {
      const newCombo = prev + 1;


      // Show combo animation for combos of 2 or higher
      if (newCombo >= 2) {
        if (comboAnimationRef.current) {
          comboAnimationRef.current.stop();
        }
        setShowCombo(true);
        comboAnim.setValue(0);
        comboAnimationRef.current = Animated.sequence([
          Animated.timing(comboAnim, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.back(1.8)),
            useNativeDriver: true,
          }),
          Animated.delay(500), // 적절한 표시 시간
          Animated.timing(comboAnim, {
            toValue: 0,
            duration: 400,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]);
        comboAnimationRef.current.start(() => {
          setShowCombo(false);
          comboAnimationRef.current = null;
        });
        if (newCombo >= 3) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
      }

      // Use the freshly updated combo value for scoring
      const matchPoints = matches.length * 10 * (newCombo > 0 ? newCombo : 1);
      setScore(prevScore => {
        const newScore = prevScore + matchPoints;
        scoreRef.current = newScore; // Update ref with latest score
        return newScore;
      });

      return newCombo;
    });
    
    // Run all animations
    Animated.parallel(animations).start(() => {
      // Apply gravity and refill
      applyGravityAndRefill(matches);
    });
  };


  // Apply gravity and refill empty spaces
  const applyGravityAndRefill = (removedBlocks: {row: number, col: number}[]) => {
    setBoard(prevBoard => {
      const newBoard = prevBoard.map(row => [...row]);
      let id = Date.now();
      
      // Remove matched blocks
      removedBlocks.forEach(({row, col}) => {
        newBoard[row][col] = null;
      });
      
      // Apply gravity column by column
      for (let col = 0; col < BOARD_SIZE; col++) {
        const column = [];
        
        // Collect non-null blocks from bottom to top
        for (let row = BOARD_SIZE - 1; row >= 0; row--) {
          if (newBoard[row][col]) {
            column.push(newBoard[row][col]);
            newBoard[row][col] = null;
          }
        }
        
        // Place blocks back from bottom
        for (let i = 0; i < column.length; i++) {
          const row = BOARD_SIZE - 1 - i;
          newBoard[row][col] = { ...column[i]!, row, col };
        }
        
        // Fill empty spaces with new blocks
        for (let row = 0; row < BOARD_SIZE - column.length; row++) {
          const colorIndex = Math.floor(Math.random() * BLOCK_EMOJIS.length);
          const emojiBlock = BLOCK_EMOJIS[colorIndex];
          newBoard[row][col] = {
            id: `block_${id++}`,
            color: emojiBlock.color,
            emoji: emojiBlock.emoji,
            colorIndex,
            row,
            col,
            animatedValue: new Animated.Value(0),
            isMatched: false,
            isAnimating: false,
          };
          
          // Animate new blocks falling in - reduced duration and delay for faster animation
          Animated.timing(newBoard[row][col]!.animatedValue, {
            toValue: 1,
            duration: 200, // Reduced from 300ms to 200ms
            delay: row * 20, // Reduced from 50ms to 20ms per row
            easing: Easing.bounce,
            useNativeDriver: true,
          }).start();
        }
      }
      
      return newBoard;
    });
    
    // Calculate maximum animation time for blocks falling
    // duration: 200ms + max delay: (BOARD_SIZE - 1) * 20ms = 200 + 120 = 320ms
    // 애니메이션 완료 후 즉시 blockProcessing을 false로 설정하여 사용자가 바로 드래그할 수 있게 함
    const maxAnimationTime = 200 + (BOARD_SIZE - 1) * 20 + 30; // 320ms (버퍼 축소)
    
    // 애니메이션 완료 후 매칭 체크 및 blockProcessing 관리
    setTimeout(() => {
      setBoard(currentBoard => {
        // Check if there are matches in the current board configuration
        const hasCurrentMatches = hasMatches(currentBoard);
        
        if (hasCurrentMatches) {
          // If there are matches, process them (blockProcessing remains true)
          checkForMatches(currentBoard);
        } else {
          // 매칭이 없으면 즉시 blockProcessing을 false로 설정
          // 이렇게 하면 사용자가 바로 드래그할 수 있음
          setBlockProcessing(false);
          console.log('No matches found - blockProcessing set to false');
        }
        return currentBoard;
      });
    }, maxAnimationTime);
  };
  
  // Shuffle the board when no moves are available
  const shuffleBoard = () => {
    registerPlayerAction();
    setBoard(prevBoard => {
      // Create a flat array of all non-special blocks
      const allBlocks: BlockType[] = [];
      prevBoard.forEach(row => {
        row.forEach(block => {
          if (block) {
            allBlocks.push(block);
          }
        });
      });
      
      // Shuffle the array
      for (let i = allBlocks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allBlocks[i], allBlocks[j]] = [allBlocks[j], allBlocks[i]];
      }
      
      // Create new board with shuffled blocks
      const newBoard = Array(BOARD_SIZE).fill(null).map(() => 
        Array(BOARD_SIZE).fill(null)
      );
      
      let blockIndex = 0;
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          if (blockIndex < allBlocks.length) {
            // Place shuffled blocks
            newBoard[row][col] = {
              ...allBlocks[blockIndex++],
              row,
              col,
              animatedValue: new Animated.Value(0)
            };
            
            // Animate blocks appearing
            Animated.timing(newBoard[row][col]!.animatedValue, {
              toValue: 1,
              duration: 200,
              delay: (row * BOARD_SIZE + col) * 10,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true
            }).start();
          }
        }
      }
      
      // Play haptic feedback for shuffle
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      // Check for matches after short delay
      setTimeout(() => {
        setBoard(currentBoard => {
          // Check if there are any possible moves after shuffling
          const clonedBoard = currentBoard.map(row => row.map(cell => cell ? {...cell} : null));
          
          if (hasPossibleMoves(clonedBoard)) {
            // Process any matches that might have formed after shuffling
            checkForMatches(currentBoard);
          }
          
          return currentBoard;
        });
      }, 500);
      
      return newBoard;
    });
  };

  // Timer logic
  const startTimer = () => {
    setTimerActive(true);
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Time's up - end the game
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Function to save score to Firebase
  const saveScoreToFirebase = async (finalScore: number) => {
    // Check if params are initialized and uuid is available
    if (!paramsInitializedRef.current || !paramsRef.current.uuid) return;
    
    try {
      // Get today's date string in YYYY-MM-DD format
      const todayStr = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      };
      
      // Get current timestamp
      const timestamp = new Date();
      
      // Create point document for this game
      await addDoc(collection(db, `users/${paramsRef.current.uuid}/points`), {
        point: finalScore,
        fishName: '블록 게임',  // Using "Block Game" as the fish name for consistency
        fishLevel: 1,           // Default level
        extraPoint: 0,          // No extra points
        at: timestamp,          // Record timestamp
        gameType: 'block'       // Specify game type
      });
      
      // Update user's total points
      const userRef = doc(db, 'users', paramsRef.current.uuid);
      
      // Use transaction to safely update total points
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error('User document does not exist!');
        }
        
        const currentPoints = userDoc.data().totalPoint || 0;
        transaction.update(userRef, { 
          totalPoint: currentPoints + finalScore,
          lastGameAt: timestamp
        });
      });
      
      console.log(`Score saved: ${finalScore} points`);
    } catch (error) {
      console.error('Error saving score to Firebase:', error);
    }
  };


  const endGame = () => {
    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerActive(false);
    setGameState('paused');
  
    // Use ref to get latest score value to avoid closure issues
    const currentScore = scoreRef.current;
    const finalScoreToSave = currentScore;
    console.log(`게임 종료 - 최종 점수: ${finalScoreToSave}`);
    
    // Update the displayed score
    setScore(finalScoreToSave);
    scoreRef.current = finalScoreToSave; // Update ref immediately
    
    // Save the final score to Firebase
    (async () => {
      try {
        await saveScoreToFirebase(finalScoreToSave);
        console.log('Firebase에 점수 저장 완료');
      } catch (error) {
        console.error('Firebase 점수 저장 실패:', error);
      }
      
      // Store final score for the result modal and show it
      setFinalScore(finalScoreToSave);
      setShowResultModal(true);
      
      // Play haptic feedback for game end
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    })();
  };

  // Function to consume one bait
  const consumeBait = async () => {
    // Check if params are initialized and uuid is available
    if (!paramsInitializedRef.current || !paramsRef.current.uuid || baitUsed) return;
    
    try {
      // Get today's date string in YYYY-MM-DD format
      const todayStr = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      };
      
      // Update bait usage in Firebase
      const usageRef = doc(db, `users/${paramsRef.current.uuid}/baitUsage`, todayStr());
      await setDoc(usageRef, { used: increment(1), date: todayStr() }, { merge: true });
      
      // Mark bait as used for this session
      setBaitUsed(true);
    } catch (error) {
      console.error('Error consuming bait:', error);
    }
  };

  // Initialize board and start timer on component mount
  useEffect(() => {
    // Do not auto-initialize the game
    // We'll initialize only after the start button is clicked
    
    // Cleanup timer on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (comboResetTimeoutRef.current) {
        clearTimeout(comboResetTimeoutRef.current);
      }
      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current);
      }
      stopHintAnimation();
    };
  }, [stopHintAnimation]);
  
  // Calculate available bait count
  useEffect(() => {
    setBaitCount(Math.max(0, dailyBaitLimit - todayBaitUsed));
  }, [dailyBaitLimit, todayBaitUsed]);

  // Update boardRef whenever board state changes
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  // Update scoreRef whenever score state changes
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const goBack = () => {
    router.back();
  };

  // Function to handle starting the game
  const startGame = async () => {
    // Prevent double-clicking
    setIsStartButtonDisabled(true);
    
    if (!isWithinTournamentPeriod()) {
      Alert.alert('이벤트 기간이 아닙니다', '이벤트 기간 내에만 게임에 참여할 수 있습니다.');
      setIsStartButtonDisabled(false);
      return;
    }

    // Consume bait first
    try {
      await consumeBait();
    } catch (error) {
      console.error('Error consuming bait:', error);
      setIsStartButtonDisabled(false);
      return;
    }
    
    // Reset game state
    setScore(0);
    scoreRef.current = 0; // Reset ref as well
    setMoves(0);
    setSelectedBlock(null);
    setDraggedBlock(null);
    setBlockProcessing(false); // 블록 처리 상태 초기화
    
    // Reset combo state
    setComboCount(0);
    setShowCombo(false);
    if (comboResetTimeoutRef.current) {
      clearTimeout(comboResetTimeoutRef.current);
      comboResetTimeoutRef.current = null;
    }
    if (hintTimeoutRef.current) {
      clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = null;
    }
    resetHintVisuals();
    
    // Game preparation complete
    
    // Reset timer
    setTimeRemaining(60);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Initialize new board
    initializeBoard();
    
    // Change game state to playing
    setGameState('playing');
    registerPlayerAction();
    
    // 초기 보드 생성 후 blockProcessing을 확실히 false로 설정
    // (초기 매치 처리 후 applyGravityAndRefill에서 리셋되지만, 안전장치로 추가)
    setTimeout(() => {
      setBlockProcessing(false);
      console.log('Game start - force blockProcessing to false after initialization');
    }, 600); // 초기 보드 + 초기 매치 처리 시간 고려
    
    // Start the timer after a brief delay to allow board initialization
    setTimeout(() => {
      startTimer();
    }, 500);
  };

  // Function to reset game after it's finished
  const resetGame = () => {
    // Show alert confirming bait will be used
    Alert.alert(
      '게임 다시하기',
      '게임을 다시 시작하면 미끼 1개가 차감됩니다. 계속할까요?',
      [
        {
          text: '취소',
          style: 'cancel'
        },
        {
          text: '확인',
          onPress: startGame
        }
      ]
    );
  };
  
  // Function to handle using bait coupon
  const handleUseBaitCoupon = async () => {
    registerPlayerAction();
    // Check if params are initialized and uuid is available
    if (!paramsInitializedRef.current || !paramsRef.current.uuid || baitCoupons <= 0) return;
    
    try {
      // Update bait coupons in Firebase
      const userRef = doc(db, 'users', paramsRef.current.uuid);
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("User document doesn't exist!");
        }
        
        const currentCoupons = userDoc.data().baitCoupons || 0;
        if (currentCoupons <= 0) {
          throw new Error('No bait coupons available');
        }
        
        // Decrease coupon count by 1
        transaction.update(userRef, {
          baitCoupons: currentCoupons - 1,
        });
      });
      
      // Set bait count to baitPerCoupon value
      const usageRef = doc(db, `users/${paramsRef.current.uuid}/baitUsage`, todayStr());
      await setDoc(usageRef, { 
        used: 0, // Reset used bait count to 0
        date: todayStr(),
        fromCoupon: true
      }, { merge: true });
      
      // Update local state
      setBaitCoupons(prev => prev - 1);
      setTodayBaitUsed(0);
      setBaitCount(baitPerCoupon);
      
      // Show success message
      Alert.alert('성공', `미끼 교환권을 사용하여 ${baitPerCoupon}개의 미끼를 받았습니다!`);
    } catch (error) {
      console.error('Error using bait coupon:', error);
      Alert.alert('오류', '미끼 교환권 사용 중 오류가 발생했습니다.');
    }
  };

  // 드래그 상태 초기화 함수
  const resetDragState = () => {
    Animated.parallel([
      Animated.timing(dragX, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(dragY, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedBlock(null);
      setDraggedBlock(null);
      selectedBlockRef.current = null;
    });
  };

  const createBlockPanResponder = (row: number, col: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => {
        // 터치는 항상 받되, 실제 동작은 onPanResponderGrant에서 확인
        console.log('onStartShouldSetPanResponder called for block:', { row, col, gameState, blockProcessing });
        return true;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // 작은 움직임도 감지
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderGrant: (evt, gestureState) => {
        // 게임 상태 확인 - paused나 processing 중이면 무시
        if (gameState !== 'playing') {
          console.log('Touch blocked: gameState is not playing', gameState);
          return;
        }
        
        if (blockProcessingRef.current) {
          console.log('Touch blocked: blockProcessing is true (ref)');
          return;
        }

        // ref를 사용하여 항상 최신 blockProcessing 상태 확인
        registerPlayerAction();

        console.log('Block touched successfully:', { row, col });
        
        const blockPos = {row, col};
        setSelectedBlock(blockPos);
        setDraggedBlock(blockPos);
        selectedBlockRef.current = blockPos; // ref도 업데이트
        
        // 드래그 애니메이션 값 초기화
        dragX.setValue(0);
        dragY.setValue(0);
        
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gameState === 'paused' || blockProcessing) return;
        
        // ref를 사용해서 항상 최신 값 확인 - 클로저 문제 해결
        const currentSelected = selectedBlockRef.current;
        if (currentSelected?.row === row && currentSelected?.col === col) {
          // 실시간으로 손가락 위치에 따라 블록 이동
          dragX.setValue(gestureState.dx);
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        // ref를 사용해서 최신 값 확인
        const currentSelected = selectedBlockRef.current;
        if (!currentSelected || gameState === 'paused') {
          resetDragState();
          return;
        }
        
        // 선택된 블록이 현재 블록이 아니면 무시
        if (currentSelected.row !== row || currentSelected.col !== col) {
          return;
        }
        
        const { dx, dy } = gestureState;
        const dragDistance = Math.sqrt(dx * dx + dy * dy);
        const minDragDistance = CELL_SIZE * 0.3;
        
        let targetRow = currentSelected.row;
        let targetCol = currentSelected.col;
        
        if (dragDistance >= minDragDistance) {
          if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0 && currentSelected.col < BOARD_SIZE - 1) {
              targetCol = currentSelected.col + 1;
            } else if (dx < 0 && currentSelected.col > 0) {
              targetCol = currentSelected.col - 1;
            }
          } else {
            if (dy > 0 && currentSelected.row < BOARD_SIZE - 1) {
              targetRow = currentSelected.row + 1;
            } else if (dy < 0 && currentSelected.row > 0) {
              targetRow = currentSelected.row - 1;
            }
          }
          
          const rowDiff = Math.abs(targetRow - currentSelected.row);
          const colDiff = Math.abs(targetCol - currentSelected.col);
          
          if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
            // 드래그 상태 즉시 초기화
            dragX.setValue(0);
            dragY.setValue(0);
            setSelectedBlock(null);
            setDraggedBlock(null);
            selectedBlockRef.current = null;
            
            swapBlocks(currentSelected.row, currentSelected.col, targetRow, targetCol);
            return;
          }
        }
        
        // 스왑이 발생하지 않았으면 원위치로 복귀
        resetDragState();
      },
      onPanResponderTerminate: () => {
        resetDragState();
      },
    });
  };

  // Visual-only version for game end (no score update, no gravity)

  const renderBlock = (block: BlockType | null, row: number, col: number) => {
    if (!block) return null;
    
    const isSelected = selectedBlock?.row === row && selectedBlock?.col === col;
    
    // For regular blocks, use pan responder
    const blockPanResponder = createBlockPanResponder(row, col);
    
    // 드래그 중인지 확인
    const isDragging = isSelected && draggedBlock?.row === row && draggedBlock?.col === col;
    
    // Transform 배열 구성 - 드래그 중이면 translate 추가
    const transformArray: any[] = [{ scale: block.animatedValue }];
    if (isDragging) {
      transformArray.push(
        { translateX: dragX },
        { translateY: dragY }
      );
    }
    
    return (
      <Animated.View
        key={block.id}
        style={[
          styles.block,
          {
            backgroundColor: 'transparent', // Remove block background
            transform: transformArray,
            opacity: block.animatedValue,
            borderWidth: isDragging ? 0 : (isSelected ? 3 : 0), // 드래그 중일 때는 border 제거
            borderColor: isDragging ? 'transparent' : (isSelected ? '#FFF' : 'transparent'), // 드래그 중일 때는 border 투명
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: isDragging ? 100 : 1, // 드래그 중인 블록을 맨 위로
            // Remove borderRadius to eliminate circular background
          },
          // 드래그 중일 때 그림자 효과
          isDragging && {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 10,
          }
        ]}
        {...blockPanResponder.panHandlers}
      >
        <Text style={styles.emojiText}>{block.emoji}</Text>
      </Animated.View>
    );
  };

  // Pre-calculate cell positions to avoid recalculating during render
  const cellPositions = useMemo(() => {
    const positions = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        positions.push({
          key: `${row}-${col}`,
          style: {
            top: row * CELL_SIZE,
            left: col * CELL_SIZE
          },
          row,
          col
        });
      }
    }
    return positions;
  }, [BOARD_SIZE, CELL_SIZE]);

  // Memoize board rendering to prevent unnecessary re-renders
  const renderBoard = useMemo(() => {
    return cellPositions.map(({key, style, row, col}) => {
      const block = board[row]?.[col] || null;
      const isHintCell = hintMove && (
        (row === hintMove.row1 && col === hintMove.col1) ||
        (row === hintMove.row2 && col === hintMove.col2)
      );
      return (
        <View
          key={key}
          style={[styles.cell, style]}
        >
          {block && renderBlock(block, row, col)}
          {isHintCell ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.hintHighlight,
                {
                  opacity: hintPulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.45, 1],
                  }),
                  transform: [{
                    scale: hintPulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1.12],
                    }),
                  }],
                },
              ]}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.hintHighlightInner,
                  {
                    opacity: hintPulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 0.95],
                    }),
                    transform: [{
                      scale: hintPulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1.2],
                      }),
                    }],
                  },
                ]}
              />
            </Animated.View>
          ) : null}
        </View>
      );
    });
  }, [board, selectedBlock, draggedBlock, hintMove, hintPulseAnim]);

  if (!isMiniGameAvailable) {
    return (
      <SafeAreaView style={[styles.container, styles.containerDefault]}>
        <StatusBar style="auto" />
        <View style={styles.disabledContainer}>
          <Text style={styles.disabledText}>현재 블록 게임을 이용할 수 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, backgroundImageUri ? styles.containerTransparent : styles.containerDefault]}>
      <StatusBar style="auto" />
      {backgroundImageUri ? (
        isGifBackground ? (
          <ExpoImage
            source={{ uri: backgroundImageUri }}
            style={styles.backgroundImage}
            contentFit="cover"
          />
        ) : (
          <ImageBackground
            source={{ uri: backgroundImageUri }}
            style={styles.backgroundImage}
            resizeMode="cover"
          />
        )
      ) : null}
      
      {/* 이벤트 정보 배너 - 상단에 배치 (게임 시작하면 안보이게 처리) */}
      {tournament && gameState === 'idle' && (
        <TouchableOpacity
          style={styles.tournamentBanner}
          onPress={() => setModalVisible(true)}
        >
          <View style={styles.tournamentTitleContainer}>
            <Ionicons name="trophy" size={20} color="#FFD700" style={styles.trophyIcon} />
            <Text style={styles.tournamentTitle}>{tournament.title}</Text>
          </View>
          <Text style={styles.tournamentPeriod}>{formatTournamentPeriod()}</Text>
        </TouchableOpacity>
      )}

      {/* 이벤트 정보 모달 */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>

            <View style={styles.modalTitleContainer}>
              <Ionicons name="trophy" size={24} color="#FFD700" style={styles.trophyIcon} />
              <Text style={styles.modalTitle}>{tournament?.title}</Text>
            </View>

            <Text style={styles.modalPeriod}>{formatTournamentPeriod()}</Text>

            {tournament?.description ? (
              <Text style={styles.modalDescription}>{tournament.description}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

      {gameState === 'idle' ? (
        // Start Screen
        <View style={styles.startOverlay}>
          {(() => {
            const isTournamentActive = isWithinTournamentPeriod();
            const buttonDisabled = baitLoading || baitCount <= 0 || !isTournamentActive || isStartButtonDisabled;

            return (
              <>
                <TouchableOpacity 
                  style={[
                    styles.primaryButton,
                    buttonDisabled && styles.primaryButtonDisabled
                  ]}
                  disabled={buttonDisabled}
                  onPress={startGame}
                >
                  <Text style={styles.buttonText}>시작!</Text>
                  <Text style={styles.baitCountText}>
                    {baitLoading
                      ? '미끼 정보 로딩 중...'
                      : !isTournamentActive
                        ? '이벤트 기간이 아닙니다.'
                        : baitCount > 0
                          ? `남은 미끼: ${baitCount}개`
                          : '남은 미끼: 0개'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.rankingButton}
                  onPress={() => {
                    router.push({
                      pathname: '/mini-games/ranking',
                      params: {
                        uuid: paramsRef.current.uuid || '',
                        name: searchParams.name || '',
                      },
                    });
                  }}
                >
                  <Ionicons name="ribbon" size={24} color="#fff" style={styles.rankingIcon} />
                  <Text style={styles.rankingButtonText}>랭킹 보기</Text>
                </TouchableOpacity>

                {baitCoupons > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.rankingButton,
                      styles.couponButton,
                      { backgroundColor: baitCount > 0 ? '#888' : BLOCK_THEME_PRIMARY_LIGHT }
                    ]}
                    onPress={handleUseBaitCoupon}
                  >
                    <Ionicons name="fish" size={24} color="#fff" style={styles.rankingIcon} />
                    <Text style={styles.rankingButtonText}>미끼 교환권({baitCoupons}장)</Text>
                  </TouchableOpacity>
                )}
              </>
            );
          })()}
        </View>
      ) : (
        // Game Screen
        <>
          {/* 게임 중에는 배경 애니메이션 제거 */}
          
          {/* Score and Timer */}
          <View style={styles.scoreContainer}>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreLabel}>점수</Text>
              <Text style={styles.scoreValue}>{score}</Text>
            </View>
            <View style={styles.scoreSeparator} />
            <View style={styles.scoreBox}>
              <Text style={styles.scoreLabel}>시간</Text>
              <Text style={[
                styles.scoreValue, 
                timeRemaining <= 10 ? styles.warningText : null
              ]}>
                {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          </View>

          {/* Combo Indicator - 점수/시간 아래, 게임판 위에 표시 */}
          {showCombo && (
            <Animated.View
              style={[
                styles.comboContainer,
                {
                  transform: [
                    { scale: comboAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.1] }) },
                  ],
                  opacity: comboAnim
                }
              ]}
            >
              <Text style={styles.comboText}>
                {comboCount}X 콤보!
              </Text>
            </Animated.View>
          )}

          {/* Game Board */}
          <View style={styles.gameContainer}>
            <View style={styles.gameBoard}>
              {renderBoard}
            </View>

          </View>

        </>
      )}

      {/* Game Result Modal */}
      <Modal
        transparent={true}
        visible={showResultModal}
        animationType="fade"
        onRequestClose={() => setShowResultModal(false)}
      >
        {/* 폭죽 애니메이션 추가 - 모달 내용 뒤에 위치하도록 먼저 렌더링 */}
        {showResultModal && <SuccessFireworks />}
        
        <View style={styles.resultModalOverlay}>
          <View style={styles.resultModalContent}>
            <View style={styles.unifiedResultContainer}>
              <Text style={[styles.resultModalTitle, { color: '#ffff00' }]}>
                게임 종료!
              </Text>
              
              <Text style={styles.resultMessage}>
                {finalScore}점을 획득했습니다!
              </Text>
              
              <TouchableOpacity 
                style={styles.resultModalButton}
                onPress={() => {
                  setShowResultModal(false);
                  resetGame();
                }}
              >
                <Text style={styles.resultModalButtonText}>다시 하기</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.resultModalButton, {backgroundColor: '#888'}]}
                onPress={() => {
                  setShowResultModal(false);
                  goBack();
                }}
              >
                <Text style={styles.resultModalButtonText}>나가기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Result Modal Styles
  resultModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultModalContent: {
    borderRadius: 20,
    padding: 0,
    width: '85%',
    maxWidth: 350,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    backgroundColor: 'transparent', // Make transparent to show fireworks
  },
  unifiedResultContainer: {
    backgroundColor: BLOCK_THEME_RESULT,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: BLOCK_THEME_PRIMARY_DARK,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    minWidth: width * 0.8,
    maxWidth: width * 0.9,
    width: '100%',
  },
  resultModalIconContainer: {
    backgroundColor: 'rgba(102, 187, 106, 0.25)',
    borderRadius: 50,
    padding: 15,
    marginVertical: 15,
    borderWidth: 2,
    borderColor: 'rgba(76, 175, 80, 0.6)',
    elevation: 3,
    shadowColor: 'rgba(56, 142, 60, 0.6)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  resultModalTitle: {
    fontSize: 30,
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: 'GiantRegular',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 4,
  },
  resultMessage: {
    fontSize: 24,
    fontFamily: 'GiantRegular',
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 4,
    lineHeight: 30,
    marginTop: 10,
    marginBottom: 15,
  },
  resultModalScoreContainer: {
    width: '100%',
    backgroundColor: 'rgba(27, 94, 32, 0.18)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229, 243, 231, 0.6)',
  },
  resultModalScoreLabel: {
    fontSize: 16,
    color: '#e8f5e9',
    marginBottom: 5,
    fontFamily: 'GiantRegular',
  },
  resultModalScoreValue: {
    fontSize: 32,
    color: BLOCK_THEME_PRIMARY_LIGHT,
    fontFamily: 'GiantRegular',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 3,
  },
  resultModalButton: {
    backgroundColor: BLOCK_THEME_PRIMARY_LIGHT,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginVertical: 8,
    width: '100%',
    alignItems: 'center',
    elevation: 3,
    shadowColor: BLOCK_THEME_PRIMARY_DARK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  resultModalButtonText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'GiantRegular',
  },
  container: {
    flex: 1,
    position: 'relative',
  },
  containerDefault: {
    backgroundColor: '#e8f5e9',
  },
  containerTransparent: {
    backgroundColor: 'transparent',
  },
  disabledContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  disabledText: {
    fontFamily: 'GiantRegular',
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    overflow: 'hidden',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backgroundImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(27, 94, 32, 0.08)',
  },
  // Start Screen Styles
  startOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    paddingBottom: 60,
    zIndex: 5,
  },
  primaryButton: {
    backgroundColor: BLOCK_THEME_PRIMARY, // 블록 게임 테마 색상 (녹색)
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: BLOCK_THEME_PRIMARY_DARK,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 3,
    borderColor: BLOCK_THEME_PRIMARY_LIGHT,
    marginVertical: 16,
    transform: [{ scale: 1.1 }],
    minWidth: width * 0.6,
    maxWidth: width * 0.8,
  },
  primaryButtonDisabled: {
    backgroundColor: '#888',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 26,
    fontFamily: 'GiantRegular',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 2, height: 2},
    textShadowRadius: 4,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  baitCountText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'GiantRegular',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
    marginTop: 4,
  },
  couponIcon: {
    marginRight: 10,
  },
  placeholder: {
    width: 40,
  },
  // Game Screen Styles
  comboContainer: {
    alignSelf: 'center',
    backgroundColor: 'rgba(102, 187, 106, 0.9)',
    paddingVertical: 5,
    paddingHorizontal: 25,
    borderRadius: 25,
    marginTop: 10,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(56, 142, 60, 0.9)',
    shadowColor: 'rgba(56, 142, 60, 0.8)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 6,
  },
  comboText: {
    color: BLOCK_THEME_PRIMARY_DARK,
    fontSize: 24,
    fontFamily: 'GiantRegular',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 1.2,
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
  resetButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'GiantRegular',
    color: BLOCK_THEME_PRIMARY_DARK,
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 18,
    marginTop: 12,
    marginBottom: 20,
    position: 'relative',
    zIndex: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
  },
  scoreBox: {
    alignItems: 'center',
    minWidth: 90,
  },
  scoreLabel: {
    fontSize: 12,
    fontFamily: 'GiantRegular',
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 24,
    fontFamily: 'GiantRegular',
    color: '#FFFFFF',
  },
  scoreSeparator: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 16,
  },
  gameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0, // Remove horizontal padding for full centering
    position: 'absolute', // Use absolute positioning to center in screen
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2, // Ensure proper layering above background
  },
  gameBoard: {
    width: BOARD_SIZE * CELL_SIZE,
    height: BOARD_SIZE * CELL_SIZE,
    backgroundColor: 'rgba(236, 253, 245, 0.95)',
    borderRadius: 10,
    position: 'relative',
    elevation: 3, // Add elevation for Android
    shadowColor: BLOCK_THEME_PRIMARY_DARK, // Add shadow for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cell: {
    position: 'absolute',
    width: CELL_SIZE,
    height: CELL_SIZE,
    padding: 0, // Removed padding to eliminate gaps
    borderWidth: 1,
    borderColor: 'rgba(102, 187, 106, 0.4)',
  },
  hintHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CELL_SIZE * 0.3,
    borderWidth: 4,
    borderColor: '#ffe066',
    backgroundColor: 'rgba(255, 224, 102, 0.35)',
    shadowColor: '#ffec99',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
    elevation: 12,
    zIndex: 5,
  },
  hintHighlightInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CELL_SIZE * 0.22,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  block: {
    flex: 1,
    margin: 0, // Removed margin to eliminate gaps
    backgroundColor: 'transparent', // Transparent background
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: Math.floor(CELL_SIZE * 0.65), // Reduced from 75% to 65% to prevent cutoff
    textAlign: 'center',
    lineHeight: Math.floor(CELL_SIZE * 0.8), // Reduced line height for better vertical alignment
    width: '100%', // Ensure it takes full width
    height: '100%', // Ensure it takes full height
    padding: 2, // Add padding to prevent text from touching edges
  },
  instructions: {
    padding: 20,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: BLOCK_THEME_PRIMARY_DARK,
    textAlign: 'center',
    marginBottom: 5,
  },
  instructionSubText: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#4e6e56',
    textAlign: 'center',
  },
  warningText: {
    color: '#FF3B30',
  },
  // No moves message and shuffle button styles
  noMovesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  noMovesContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
    borderRadius: 15,
    width: '80%',
    maxWidth: 300,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  noMovesText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'GiantRegular',
    marginBottom: 10,
    textAlign: 'center',
  },
  shuffleButton: {
    backgroundColor: BLOCK_THEME_PRIMARY_LIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginTop: 5,
  },
  shuffleIcon: {
    marginRight: 8,
  },
  shuffleButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'GiantRegular',
  },
  noShufflesText: {
    color: '#FF9800',
    fontSize: 14,
    fontFamily: 'GiantRegular',
    marginTop: 5,
  },
  // 이벤트 및 랭킹 관련 스타일
  tournamentBanner: {
    backgroundColor: BLOCK_THEME_OVERLAY_STRONG,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    elevation: 3,
    shadowColor: BLOCK_THEME_PRIMARY_DARK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  tournamentTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  trophyIcon: {
    marginRight: 8,
  },
  tournamentTitle: {
    fontSize: 18,
    fontFamily: 'GiantRegular',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  tournamentPeriod: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#E8F5E9',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: 'GiantRegular',
    color: BLOCK_THEME_PRIMARY_DARK,
    flex: 1,
  },
  modalPeriod: {
    fontSize: 15,
    fontFamily: 'GiantRegular',
    color: '#666',
    marginTop: 0,
    marginBottom: 15,
    backgroundColor: '#f5f5f5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  modalDescription: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#333',
    marginBottom: 15,
    lineHeight: 22,
  },
  rankingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLOCK_THEME_OVERLAY, // 블록 게임 테마 색상 (녹색)
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginTop: 20,
    elevation: 3,
    shadowColor: BLOCK_THEME_PRIMARY_DARK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    width: 200,
  },
  rankingButtonText: {
    fontSize: 18,
    color: '#fff',
    fontFamily: 'GiantRegular',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    textAlign: 'center',
  },
  rankingIcon: {
    marginRight: 8,
  },
  couponButton: {
    marginTop: 16,
    backgroundColor: BLOCK_THEME_PRIMARY_LIGHT,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});