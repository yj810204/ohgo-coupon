// hooks/useAutoRefresh.ts
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

export function useAutoRefresh(refreshFn: () => void) {
  useFocusEffect(
    useCallback(() => {
      refreshFn();
    }, [refreshFn])
  );
}
