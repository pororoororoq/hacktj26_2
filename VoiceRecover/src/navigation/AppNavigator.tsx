import React, { createContext, useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';

import { WelcomeScreen }    from '../screens/WelcomeScreen';
import { AssessmentScreen } from '../screens/AssessmentScreen';
import { MITScreen }        from '../screens/MITScreen';
import { ResultsScreen }    from '../screens/ResultsScreen';
import { ProgressScreen }   from '../screens/ProgressScreen';
import { ChallengeScreen }  from '../screens/ChallengeScreen';
import { LoginScreen }      from '../screens/LoginScreen';
import { RegisterScreen }   from '../screens/RegisterScreen';

import { isLoggedIn, logout } from '../services/auth';
import { colors } from '../theme/colors';

// ── Auth context shared across the app ───────────────────────────────────────

interface AuthContextType {
  signIn:  () => void;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  signIn:  () => {},
  signOut: () => {},
});

// ── Route param types ─────────────────────────────────────────────────────────

export type RootStackParamList = {
  Login:      undefined;
  Register:   undefined;
  Welcome:    undefined;
  Assessment: undefined;
  MIT: {
    weakPhonemes:    string[];
    assessmentScore: number;
    wordResults:     any[];
    recommendations: string[];
  };
  Results: {
    assessmentScore: number;
    pitchScore:      number;
    wordResults:     any[];
    weakPhonemes:    string[];
    recommendations: string[];
    pitchFeedback:   string;
    patientContour?: { time: number; frequency: number }[];
    targetContour?:  { time: number; frequency: number }[];
  };
  Progress:  undefined;
  Challenge: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

// ── Navigator ─────────────────────────────────────────────────────────────────

export function AppNavigator() {
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn,    setLoggedIn]    = useState(false);

  useEffect(() => {
    isLoggedIn().then(ok => {
      setLoggedIn(ok);
      setAuthChecked(true);
    });
  }, []);

  const authContext: AuthContextType = {
    signIn:  () => setLoggedIn(true),
    signOut: () => { logout(); setLoggedIn(false); },
  };

  // Splash / loading state while AsyncStorage is read
  if (!authChecked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={authContext}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: colors.background },
          gestureEnabled: false,
        }}
      >
        {loggedIn ? (
          // ── Authenticated stack ──────────────────────────────────────────
          <>
            <Stack.Screen name="Welcome"    component={WelcomeScreen} />
            <Stack.Screen name="Assessment" component={AssessmentScreen} />
            <Stack.Screen name="MIT"        component={MITScreen} />
            <Stack.Screen name="Results"    component={ResultsScreen} />
            <Stack.Screen name="Progress"   component={ProgressScreen} />
            <Stack.Screen name="Challenge"  component={ChallengeScreen} />
          </>
        ) : (
          // ── Auth stack ───────────────────────────────────────────────────
          <>
            <Stack.Screen name="Login"    component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </AuthContext.Provider>
  );
}
