import { useState, useRef, useCallback } from 'react';

export interface TTSHighlightState {
  isHighlighted: boolean;
  highlightedWord: string;
  highlightIndex: number;
}

export function useTTSHighlight() {
  const [highlightState, setHighlightState] = useState<TTSHighlightState>({
    isHighlighted: false,
    highlightedWord: '',
    highlightIndex: -1,
  });

  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const highlightWord = useCallback((word: string, index: number, duration: number = 2000) => {
    // Clear any existing timeout
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    // Set highlight state
    setHighlightState({
      isHighlighted: true,
      highlightedWord: word,
      highlightIndex: index,
    });

    // Clear highlight after duration
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightState({
        isHighlighted: false,
        highlightedWord: '',
        highlightIndex: -1,
      });
    }, duration);
  }, []);

  const clearHighlight = useCallback(() => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    setHighlightState({
      isHighlighted: false,
      highlightedWord: '',
      highlightIndex: -1,
    });
  }, []);

  const isWordHighlighted = useCallback((index: number) => {
    return highlightState.isHighlighted && highlightState.highlightIndex === index;
  }, [highlightState]);

  return {
    highlightState,
    highlightWord,
    clearHighlight,
    isWordHighlighted,
  };
}