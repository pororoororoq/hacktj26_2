import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { AssessmentScreen } from '../screens/AssessmentScreen';
import { MITScreen } from '../screens/MITScreen';
import { ResultsScreen } from '../screens/ResultsScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { ChallengeScreen } from '../screens/ChallengeScreen';
import { colors } from '../theme/colors';

export type RootStackParamList = {
  Welcome: undefined;
  Assessment: undefined;
  MIT: {
    weakPhonemes: string[];
    assessmentScore: number;
    wordResults: any[];
    recommendations: string[];
  };
  Results: {
    assessmentScore: number;
    pitchScore: number;
    wordResults: any[];
    weakPhonemes: string[];
    recommendations: string[];
    pitchFeedback: string;
    patientContour?: { time: number; frequency: number }[];
    targetContour?: { time: number; frequency: number }[];
  };
  Progress: undefined;
  Challenge: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Assessment" component={AssessmentScreen} />
      <Stack.Screen name="MIT" component={MITScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
      <Stack.Screen name="Progress" component={ProgressScreen} />
      <Stack.Screen name="Challenge" component={ChallengeScreen} />
    </Stack.Navigator>
  );
}
