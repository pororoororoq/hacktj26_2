import React, { useContext, useRef, useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  TextInput,
  SafeAreaView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { AuthContext } from '../navigation/AppNavigator';
import { register } from '../services/auth';
import { Disclaimer } from '../components/Disclaimer';
import { FadeInView } from '../components/FadeInView';
import { StaggeredWords } from '../components/StaggeredWords';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

type Nav = StackNavigationProp<RootStackParamList, 'Register'>;

// ── Bouncing logo emoji ───────────────────────────────────────────────────────

function BouncingEmoji() {
  const scale   = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 110,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.Text style={[styles.emoji, { transform: [{ scale }], opacity }]}>
      {'\uD83C\uDFB5'}
    </Animated.Text>
  );
}

// ── Animated field row ────────────────────────────────────────────────────────

function AnimatedField({
  label,
  delay,
  children,
}: {
  label: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <FadeInView delay={delay} fromY={14} duration={360}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </FadeInView>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function RegisterScreen() {
  const navigation       = useNavigation<Nav>();
  const { signIn }       = useContext(AuthContext);
  const [name,     setName]     = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleRegister = async () => {
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await register(username.trim(), password, name.trim());
      signIn();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Hero ──────────────────────────────────── */}
          <View style={styles.hero}>
            <BouncingEmoji />
            <StaggeredWords
              text="VoiceRecover"
              initialDelay={160}
              wordDelay={0}
              duration={440}
              fromY={18}
              style={styles.appNameWord}
            />
            <FadeInView delay={380} fromY={10} duration={380}>
              <Text style={styles.tagline}>AI Speech Therapy Companion</Text>
            </FadeInView>
          </View>

          {/* ── Card ──────────────────────────────────── */}
          <FadeInView delay={260} fromY={44} duration={520} style={styles.card}>
            <FadeInView delay={380} fromY={8} duration={360}>
              <Text style={styles.heading}>Create account</Text>
              <Text style={styles.subheading}>Your progress will be saved securely.</Text>
            </FadeInView>

            {error && (
              <FadeInView fromY={6} duration={300} style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </FadeInView>
            )}

            <AnimatedField label="YOUR NAME" delay={460}>
              <TextInput
                style={styles.input}
                placeholder="e.g. Alex"
                placeholderTextColor={colors.textLight}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </AnimatedField>

            <AnimatedField label="USERNAME" delay={530}>
              <TextInput
                style={styles.input}
                placeholder="choose_a_username"
                placeholderTextColor={colors.textLight}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </AnimatedField>

            <AnimatedField label="PASSWORD" delay={600}>
              <TextInput
                style={styles.input}
                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                placeholderTextColor={colors.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
            </AnimatedField>

            <FadeInView delay={710} fromY={16} duration={400}>
              <AnimatedPressable
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.primaryButtonText}>Create Account</Text>
                }
              </AnimatedPressable>
            </FadeInView>

            <FadeInView delay={800} fromY={10} duration={360}>
              <AnimatedPressable
                style={styles.linkRow}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.linkText}>Already have an account?  </Text>
                <Text style={[styles.linkText, styles.linkBold]}>Sign in</Text>
              </AnimatedPressable>
            </FadeInView>
          </FadeInView>

        </ScrollView>
      </KeyboardAvoidingView>
      <Disclaimer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex:      { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.xxl,
  },

  hero: { alignItems: 'center', marginBottom: spacing.xl },
  emoji: { fontSize: 52, marginBottom: spacing.sm },
  appNameWord: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  tagline: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },

  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
  heading:    { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  subheading: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },

  errorBanner: {
    backgroundColor: '#FFF0F0',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: { ...typography.body, color: colors.error },

  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },

  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonDisabled:    { opacity: 0.6 },
  primaryButtonText: { ...typography.button, color: '#fff', fontSize: 17 },

  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  linkText: { ...typography.body, color: colors.textSecondary },
  linkBold: { color: colors.primary, fontWeight: '700' },
});
