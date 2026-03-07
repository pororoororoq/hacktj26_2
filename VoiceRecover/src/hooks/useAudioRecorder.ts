import { useState, useRef, useCallback } from 'react';
import { Alert, Platform, PermissionsAndroid } from 'react-native';
import RNFS from 'react-native-fs';
import AudioRecorderPlayer, {
  AudioSourceAndroidType,
  AVEncodingOption,
  AVLinearPCMBitDepthKeyIOSType,
} from 'react-native-audio-recorder-player';

const audioRecorderPlayer = new AudioRecorderPlayer();

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const recordingPathRef = useRef<string | null>(null);

  const requestPermissions = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ]);
        if (
          grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !==
          PermissionsAndroid.RESULTS.GRANTED
        ) {
          Alert.alert('Permission Required', 'Microphone access is needed for speech assessment.');
          return false;
        }
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    // iOS permissions are handled via Info.plist + system prompt
    return true;
  }, []);

  const startRecording = useCallback(async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return null;

    // Generate unique path per recording to avoid overwriting previous recordings
    // iOS LPCM records as .caf; Android records as .wav
    const uniquePath = Platform.select({
      ios: `file://${RNFS.CachesDirectoryPath}/recording_${Date.now()}.caf`,
      android: `${RNFS.CachesDirectoryPath}/recording_${Date.now()}.wav`,
    });

    const uri = await audioRecorderPlayer.startRecorder(uniquePath, {
      AVSampleRateKeyIOS: 16000,
      AVNumberOfChannelsKeyIOS: 1,
      AVFormatIDKeyIOS: AVEncodingOption.lpcm,
      AVLinearPCMBitDepthKeyIOS: AVLinearPCMBitDepthKeyIOSType.bit16,
      AVLinearPCMIsBigEndianKeyIOS: false,
      AVLinearPCMIsFloatKeyIOS: false,
      AudioSourceAndroid: AudioSourceAndroidType.VOICE_RECOGNITION,
      AudioSamplingRateAndroid: 16000,
      AudioChannelsAndroid: 1,
    });

    audioRecorderPlayer.addRecordBackListener(() => {});
    recordingPathRef.current = uri;
    setIsRecording(true);
    return uri;
  }, [requestPermissions]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    setIsRecording(false);
    const result = await audioRecorderPlayer.stopRecorder();
    audioRecorderPlayer.removeRecordBackListener();
    return result || recordingPathRef.current;
  }, []);

  return { isRecording, startRecording, stopRecording };
}
