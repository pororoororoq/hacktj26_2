import { useState, useRef, useCallback, useEffect } from 'react';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';

const audioRecorderPlayer = new AudioRecorderPlayer();

/**
 * useAudioPlayback — MVP visual-only melody guide.
 *
 * For the hackathon we do not have pre-rendered melody audio files, so the
 * "playback" is purely a timed animation signal.  The hook advances a
 * `progress` value from 0 → 1 over `durationMs` milliseconds so the UI can
 * animate the melody line being traced in real time.
 *
 * If a real audioUri is supplied it will be loaded and played via
 * react-native-audio-recorder-player in addition to the progress animation.
 */
export function useAudioPlayback(durationMs: number = 3500) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0-1, drives melody trace animation

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      _clearTimer();
      audioRecorderPlayer.stopPlayer().catch(() => {});
      audioRecorderPlayer.removePlayBackListener();
    };
  }, []);

  const _clearTimer = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const play = useCallback(async (audioUri?: string) => {
    if (isPlaying) return;

    setIsPlaying(true);
    setProgress(0);
    startTimeRef.current = Date.now();

    // Optional real audio via react-native-audio-recorder-player
    if (audioUri) {
      try {
        await audioRecorderPlayer.startPlayer(audioUri);
        audioRecorderPlayer.addPlayBackListener((e) => {
          if (e.currentPosition >= e.duration) {
            audioRecorderPlayer.stopPlayer().catch(() => {});
            audioRecorderPlayer.removePlayBackListener();
          }
        });
      } catch {
        // Silently fall back to visual-only if audio fails
      }
    }

    // Progress animation tick every 50 ms
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const p = Math.min(elapsed / durationMs, 1);
      setProgress(p);
      if (p >= 1) {
        _clearTimer();
        setIsPlaying(false);
      }
    }, 50);
  }, [isPlaying, durationMs]);

  const stop = useCallback(async () => {
    _clearTimer();
    setIsPlaying(false);
    setProgress(0);

    try {
      await audioRecorderPlayer.stopPlayer();
      audioRecorderPlayer.removePlayBackListener();
    } catch {
      // ignore
    }
  }, []);

  return { play, stop, isPlaying, progress };
}
