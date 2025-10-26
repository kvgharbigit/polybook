import { useState, useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';

interface StableDimensions {
  width: number;
  height: number;
}

/**
 * Provides stable dimensions that only update for meaningful changes
 * Prevents pagination thrashing from minor system UI adjustments
 */
export function useStableDimensions(
  debounceMs: number = 150,
  significantChangeThreshold: number = 10
): StableDimensions {
  const rawDimensions = useWindowDimensions();
  const [stableDimensions, setStableDimensions] = useState<StableDimensions>({
    width: rawDimensions.width,
    height: rawDimensions.height,
  });
  
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const lastSignificantDimensions = useRef<StableDimensions>({
    width: rawDimensions.width,
    height: rawDimensions.height,
  });

  useEffect(() => {
    const { width: newWidth, height: newHeight } = rawDimensions;
    const { width: lastWidth, height: lastHeight } = lastSignificantDimensions.current;
    
    // Check if change is significant enough to warrant update
    const widthChange = Math.abs(newWidth - lastWidth);
    const heightChange = Math.abs(newHeight - lastHeight);
    const isSignificantChange = widthChange > significantChangeThreshold || 
                               heightChange > significantChangeThreshold;
    
    if (!isSignificantChange) {
      return; // Ignore minor changes
    }
    
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Debounce the update
    debounceTimer.current = setTimeout(() => {
      // Double-check dimensions haven't changed again during debounce
      const currentDimensions = rawDimensions;
      
      setStableDimensions({
        width: currentDimensions.width,
        height: currentDimensions.height,
      });
      
      lastSignificantDimensions.current = {
        width: currentDimensions.width,
        height: currentDimensions.height,
      };
      
      debounceTimer.current = null;
    }, debounceMs);
    
    // Cleanup function
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [rawDimensions.width, rawDimensions.height, debounceMs, significantChangeThreshold]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return stableDimensions;
}