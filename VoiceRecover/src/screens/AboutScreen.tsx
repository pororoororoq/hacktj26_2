import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

interface CitationProps {
  title: string;
  authors: string;
  detail: string;
  url?: string;
}

function Citation({ title, authors, detail, url }: CitationProps) {
  return (
    <TouchableOpacity
      style={styles.citationCard}
      onPress={url ? () => Linking.openURL(url) : undefined}
      activeOpacity={url ? 0.7 : 1}
    >
      <Text style={styles.citationTitle}>{title}</Text>
      <Text style={styles.citationAuthors}>{authors}</Text>
      <Text style={styles.citationDetail}>{detail}</Text>
      {url && <Text style={styles.citationLink}>View paper</Text>}
    </TouchableOpacity>
  );
}

export function AboutScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.heroSection}>
          <Text style={styles.emoji}>🎵</Text>
          <Text style={styles.title}>VoiceRecover</Text>
          <Text style={styles.version}>v1.0.0 - HackTJ 2026</Text>
          <Text style={styles.subtitle}>AI-powered speech therapy for aphasia recovery</Text>
        </View>

        {/* About */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <Text style={styles.bodyText}>
            VoiceRecover uses AI-driven speech analysis combined with Melodic Intonation Therapy (MIT) to help patients recovering from aphasia and speech disorders. The app provides personalized exercises using spaced repetition to optimize recovery.
          </Text>
        </View>

        {/* How It Works */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How It Works</Text>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>1</Text>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Speech Assessment</Text>
              <Text style={styles.stepDesc}>Record yourself saying target words. Our AI analyzes pronunciation at the phoneme level using Whisper transcription.</Text>
            </View>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>2</Text>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Melodic Intonation Therapy</Text>
              <Text style={styles.stepDesc}>Practice singing phrases with guided pitch patterns. MIT leverages music to activate right-hemisphere language pathways.</Text>
            </View>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>3</Text>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Adaptive Learning</Text>
              <Text style={styles.stepDesc}>Half-Life Regression (HLR) spaced repetition optimizes which words to practice and when, for maximum retention.</Text>
            </View>
          </View>
        </View>

        {/* Technology */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Technology</Text>
          <View style={styles.techRow}>
            <Text style={styles.techBadge}>OpenAI Whisper</Text>
            <Text style={styles.techBadge}>Librosa pYIN</Text>
            <Text style={styles.techBadge}>HLR / Spaced Rep</Text>
            <Text style={styles.techBadge}>FastAPI</Text>
            <Text style={styles.techBadge}>React Native</Text>
            <Text style={styles.techBadge}>DTW Pitch Analysis</Text>
          </View>
        </View>

        {/* Citations */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Citations & References</Text>

          <Citation
            title="Melodic Intonation Therapy for Aphasia"
            authors="Norton, A., Zipse, L., Marchina, S., & Schlaug, G."
            detail="Future Neurology, 2009. Foundational work on MIT for non-fluent aphasia."
            url="https://doi.org/10.2217/fnl.09.62"
          />

          <Citation
            title="A Trainable Spaced Repetition Model for Language Learning"
            authors="Settles, B. & Meeder, B. (Duolingo)"
            detail="ACL 2016. Half-Life Regression model used for our adaptive learning engine."
            url="https://doi.org/10.18653/v1/P16-1174"
          />

          <Citation
            title="Robust Speech Recognition via Large-Scale Weak Supervision (Whisper)"
            authors="Radford, A., Kim, J.W., Xu, T., Brockman, G., McLeavey, C., & Sutskever, I."
            detail="OpenAI, 2022. Whisper model used for speech-to-text transcription."
            url="https://arxiv.org/abs/2212.04356"
          />

          <Citation
            title="PYIN: A Fundamental Frequency Estimator Using Probabilistic YIN"
            authors="Mauch, M. & Dixon, S."
            detail="ICASSP 2014. Pitch detection algorithm used for melody therapy scoring."
            url="https://doi.org/10.1109/ICASSP.2014.6853678"
          />

          <Citation
            title="Speech Sound Disorders: Articulation and Phonological Processes"
            authors="Bauman-Waengler, J."
            detail="Pearson, 2020. Phoneme difficulty tiers based on developmental acquisition order."
          />
        </View>

        {/* Team */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Team</Text>
          <Text style={styles.bodyText}>
            Built at HackTJ 2026 — Theme: Invisible Infrastructure
          </Text>
          <Text style={[styles.bodyText, { marginTop: spacing.sm, fontStyle: 'italic' }]}>
            Speech is the invisible infrastructure of human connection. VoiceRecover rebuilds that infrastructure for those who have lost it.
          </Text>
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>
            This app is a research prototype and is NOT a substitute for professional speech-language pathology services. Always consult with a licensed speech-language pathologist (SLP) for diagnosis and treatment.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xxl },

  heroSection: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.lg },
  emoji: { fontSize: 48, marginBottom: spacing.sm },
  title: { ...typography.h1, color: colors.primary },
  version: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },

  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  bodyText: { ...typography.body, color: colors.text, lineHeight: 24 },

  step: { flexDirection: 'row', marginBottom: spacing.md, gap: spacing.md },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
    overflow: 'hidden',
  },
  stepContent: { flex: 1 },
  stepTitle: { ...typography.body, fontWeight: '600', color: colors.text, marginBottom: 2 },
  stepDesc: { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },

  techRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  techBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    overflow: 'hidden',
  },

  citationCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  citationTitle: { ...typography.body, fontWeight: '600', color: colors.text, marginBottom: 2 },
  citationAuthors: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic' },
  citationDetail: { ...typography.caption, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  citationLink: { ...typography.caption, color: colors.secondary, fontWeight: '600', marginTop: 4 },

  disclaimerBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    marginBottom: spacing.lg,
  },
  disclaimerText: { ...typography.caption, color: '#6D4C00', lineHeight: 18 },
});
