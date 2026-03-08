import React, { createContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';

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

// ── Auth context ─────────────────────────────────────────────────────────────

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

// ── Navigators ────────────────────────────────────────────────────────────────

const AuthStack     = createStackNavigator();
const HomeStack     = createStackNavigator();
const ExerciseStack = createStackNavigator();
const StatsStack    = createStackNavigator();
const Tab           = createBottomTabNavigator();

// ── Shared screen transition ──────────────────────────────────────────────────

const STACK_TRANSITION = {
  headerShown: false,
  cardStyleInterpolator: ({ current }: any) => ({
    cardStyle: {
      opacity: current.progress,
      transform: [{
        translateY: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
          extrapolate: 'clamp',
        }),
      }],
    },
  }),
  transitionSpec: {
    open:  { animation: 'timing' as const, config: { duration: 360, easing: Easing.out(Easing.quad) } },
    close: { animation: 'timing' as const, config: { duration: 260, easing: Easing.in(Easing.quad) } },
  },
};

// ── Stack sub-navigators ──────────────────────────────────────────────────────

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={STACK_TRANSITION}>
      <HomeStack.Screen name="Welcome"   component={WelcomeScreen} />
      <HomeStack.Screen name="Challenge" component={ChallengeScreen} />
    </HomeStack.Navigator>
  );
}

function ExerciseStackScreen() {
  return (
    <ExerciseStack.Navigator screenOptions={STACK_TRANSITION}>
      <ExerciseStack.Screen name="Assessment" component={AssessmentScreen} />
      <ExerciseStack.Screen name="MIT"        component={MITScreen} />
      <ExerciseStack.Screen name="Results"    component={ResultsScreen} />
    </ExerciseStack.Navigator>
  );
}

function StatsStackScreen() {
  return (
    <StatsStack.Navigator screenOptions={STACK_TRANSITION}>
      <StatsStack.Screen name="Progress" component={ProgressScreen} />
      <StatsStack.Screen name="Drill"    component={DrillScreen} />
    </StatsStack.Navigator>
  );
}

// ── Custom floating tab bar ───────────────────────────────────────────────────

const TAB_ITEMS = [
  { key: 'HomeTab',     label: 'Home',     icon: '\uD83C\uDFE0' },
  { key: 'ExerciseTab', label: 'Practice', icon: '\uD83C\uDFA4' },
  { key: 'StatsTab',    label: 'Stats',    icon: '\uD83D\uDCCA' },
  { key: 'ProfileTab',  label: 'Profile',  icon: '\uD83D\uDC64' },
  { key: 'AboutTab',    label: 'About',    icon: '\u2139\uFE0F' },
];

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const tabWidth   = (width - 32) / TAB_ITEMS.length; // 32 = 16 side margins × 2
  const activeIndex = state.index;

  // Animated pill x-position
  const pillX = useRef(new Animated.Value(activeIndex * tabWidth)).current;

  useEffect(() => {
    Animated.spring(pillX, {
      toValue: activeIndex * tabWidth,
      friction: 8,
      tension: 180,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, tabWidth]);

  return (
    <View style={tabBarStyles.wrapper}>
      <View style={tabBarStyles.bar}>
        {/* Sliding pill highlight */}
        <Animated.View
          style={[
            tabBarStyles.pill,
            {
              width:     tabWidth - 12,
              transform: [{ translateX: pillX }],
              left:      6,
            },
          ]}
        />

        {TAB_ITEMS.map((item, index) => {
          const focused = state.index === index;
          const scaleAnim = useRef(new Animated.Value(1)).current;

          const onPress = () => {
            Animated.sequence([
              Animated.timing(scaleAnim, { toValue: 0.88, duration: 90, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
              Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 200, useNativeDriver: true }),
            ]).start();

            const event = navigation.emit({ type: 'tabPress', target: state.routes[index].key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(state.routes[index].name);
            }
          };

          return (
            <Pressable
              key={item.key}
              onPress={onPress}
              style={[tabBarStyles.tab, { width: tabWidth }]}
              android_ripple={null}
            >
              <Animated.View style={[tabBarStyles.tabInner, { transform: [{ scale: scaleAnim }] }]}>
                <Text style={[tabBarStyles.icon, focused && tabBarStyles.iconFocused]}>
                  {item.icon}
                </Text>
                <Text style={[tabBarStyles.label, focused && tabBarStyles.labelFocused]}>
                  {item.label}
                </Text>
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const tabBarStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 20 : 14,
    left: 16,
    right: 16,
    // no height — let content define it
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 32,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 16,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    backgroundColor: colors.primary + '18', // 10% opacity
    borderRadius: 24,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabInner: { alignItems: 'center', gap: 2 },
  icon:       { fontSize: 20, opacity: 0.4 },
  iconFocused: { opacity: 1 },
  label:       { fontSize: 10, fontWeight: '500', color: colors.textSecondary },
  labelFocused: { color: colors.primary, fontWeight: '700' },
});

// ── Main Tab Navigator ────────────────────────────────────────────────────────

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="HomeTab"     component={HomeStackScreen} />
      <Tab.Screen name="ExerciseTab" component={ExerciseStackScreen} />
      <Tab.Screen name="StatsTab"    component={StatsStackScreen} />
      <Tab.Screen name="ProfileTab"  component={ProfileScreen} />
      <Tab.Screen name="AboutTab"    component={AboutScreen} />
    </Tab.Navigator>
  );
}

// ── Root Navigator ─────────────────────────────────────────────────────────────

export function AppNavigator() {
  const [authChecked,   setAuthChecked]   = useState(false);
  const [loggedIn,      setLoggedIn]      = useState(false);
  const [placementDone, setPlacementDone] = useState(false);

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
      const user = await getUser();
      setPlacementDone(user?.placement_done ?? false);
    },
    signOut: () => { logout(); setLoggedIn(false); setPlacementDone(false); },
  };

  if (!authChecked) {
    return (
      <View style={rootStyles.splash}>
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
        <AuthStack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyleInterpolator: ({ current }) => ({
              cardStyle: {
                opacity: current.progress,
                transform: [{
                  translateY: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                    extrapolate: 'clamp',
                  }),
                }],
              },
            }),
            transitionSpec: {
              open:  { animation: 'timing', config: { duration: 380, easing: Easing.out(Easing.quad) } },
              close: { animation: 'timing', config: { duration: 280, easing: Easing.in(Easing.quad) } },
            },
          }}
        >
          <AuthStack.Screen name="Login"    component={LoginScreen} />
          <AuthStack.Screen name="Register" component={RegisterScreen} />
        </AuthStack.Navigator>
      )}
    </AuthContext.Provider>
  );
}

const rootStyles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
