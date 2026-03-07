import React, { createContext, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { WelcomeScreen }    from '../screens/WelcomeScreen';
import { AssessmentScreen } from '../screens/AssessmentScreen';
import { MITScreen }        from '../screens/MITScreen';
import { ResultsScreen }    from '../screens/ResultsScreen';
import { ProgressScreen }   from '../screens/ProgressScreen';
import { ChallengeScreen }  from '../screens/ChallengeScreen';
import { ProfileScreen }    from '../screens/ProfileScreen';
import { AboutScreen }      from '../screens/AboutScreen';
import { LoginScreen }      from '../screens/LoginScreen';
import { RegisterScreen }   from '../screens/RegisterScreen';
import { PlacementScreen }  from '../screens/PlacementScreen';
import { DrillScreen }      from '../screens/DrillScreen';

import { isLoggedIn, logout, getUser } from '../services/auth';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

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
  Drill:     { phoneme: string };
};

// ── Navigators ───────────────────────────────────────────────────────────────

const AuthStack = createStackNavigator();
const HomeStack = createStackNavigator();
const ExerciseStack = createStackNavigator();
const StatsStack = createStackNavigator();
const Tab = createBottomTabNavigator();

// ── Tab icon component ──────────────────────────────────────────────────────

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
}

// ── Home Tab (Welcome + Challenge) ──────────────────────────────────────────

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Welcome" component={WelcomeScreen} />
      <HomeStack.Screen name="Challenge" component={ChallengeScreen} />
    </HomeStack.Navigator>
  );
}

// ── Exercise Tab (Assessment → MIT → Results) ───────────────────────────────

function ExerciseStackScreen() {
  return (
    <ExerciseStack.Navigator screenOptions={{ headerShown: false }}>
      <ExerciseStack.Screen name="Assessment" component={AssessmentScreen} />
      <ExerciseStack.Screen name="MIT" component={MITScreen} />
      <ExerciseStack.Screen name="Results" component={ResultsScreen} />
    </ExerciseStack.Navigator>
  );
}

// ── Stats Tab (Progress + Drill) ─────────────────────────────────────────────

function StatsStackScreen() {
  return (
    <StatsStack.Navigator screenOptions={{ headerShown: false }}>
      <StatsStack.Screen name="Progress" component={ProgressScreen} />
      <StatsStack.Screen name="Drill" component={DrillScreen} />
    </StatsStack.Navigator>
  );
}

// ── Main Tab Navigator ──────────────────────────────────────────────────────

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: tabStyles.tabBar,
        tabBarLabelStyle: tabStyles.tabLabel,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ExerciseTab"
        component={ExerciseStackScreen}
        options={{
          tabBarLabel: 'Exercise',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎤" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="StatsTab"
        component={StatsStackScreen}
        options={{
          tabBarLabel: 'Stats',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="AboutTab"
        component={AboutScreen}
        options={{
          tabBarLabel: 'About',
          tabBarIcon: ({ focused }) => <TabIcon emoji="ℹ️" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ── Tab bar styles ──────────────────────────────────────────────────────────

const tabStyles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 6,
    paddingBottom: 8,
    height: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
});

// ── Root Navigator ──────────────────────────────────────────────────────────

export function AppNavigator() {
  const [authChecked,    setAuthChecked]    = useState(false);
  const [loggedIn,       setLoggedIn]       = useState(false);
  const [placementDone,  setPlacementDone]  = useState(false);

  useEffect(() => {
    (async () => {
      const ok = await isLoggedIn();
      setLoggedIn(ok);
      if (ok) {
        const user = await getUser();
        setPlacementDone(user?.placement_done ?? false);
      }
      setAuthChecked(true);
    })();
  }, []);

  const authContext: AuthContextType = {
    signIn: async () => {
      setLoggedIn(true);
      // Check placement status from stored user data
      const user = await getUser();
      setPlacementDone(user?.placement_done ?? false);
    },
    signOut: () => { logout(); setLoggedIn(false); setPlacementDone(false); },
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
      {loggedIn ? (
        placementDone ? (
          <MainTabs />
        ) : (
          <PlacementScreen onComplete={() => setPlacementDone(true)} />
        )
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Register" component={RegisterScreen} />
        </AuthStack.Navigator>
      )}
    </AuthContext.Provider>
  );
}
