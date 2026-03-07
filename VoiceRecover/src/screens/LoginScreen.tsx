import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
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
import { login } from '../services/auth';
import { Disclaimer } from '../components/Disclaimer';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

type Nav = StackNavigationProp<RootStackParamList, 'Login'>;

export function LoginScreen() {
  const navigation         = useNavigation<Nav>();
  const { signIn }         = useContext(AuthContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('Please enter your username and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
      signIn();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Login failed. Check your credentials.';
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

          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.emoji}>🎵</Text>
            <Text style={styles.appName}>VoiceRecover</Text>
            <Text style={styles.tagline}>AI Speech Therapy Companion</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.heading}>Welcome back</Text>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="your_username"
              placeholderTextColor={colors.textLight}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryButtonText}>Sign In</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.linkText}>New here?  </Text>
              <Text style={[styles.linkText, styles.linkBold]}>Create an account</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
      <Disclaimer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex:       { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.xxl,
  },

  hero: { alignItems: 'center', marginBottom: spacing.xl },
  emoji:   { fontSize: 52, marginBottom: spacing.sm },
  appName: { ...typography.h1, color: colors.primary },
  tagline: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },

  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  heading: { ...typography.h2, color: colors.text, marginBottom: spacing.md },

  errorText: {
    ...typography.body,
    color: colors.error,
    backgroundColor: '#FFF0F0',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },

  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled:     { opacity: 0.6 },
  primaryButtonText:  { ...typography.button, color: '#fff', fontSize: 17 },

  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  linkText: { ...typography.body, color: colors.textSecondary },
  linkBold: { color: colors.primary, fontWeight: '700' },
});
