/**
 * ScreenHeader — Consistent, elegant screen title header used across all screens.
 * Supports an optional subtitle and a right-side action slot.
 */

import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { typography, fontFamily } from '../theme/typography';
import { spacing } from '../theme/spacing';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  centered?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ScreenHeader({ title, subtitle, right, centered = false, style }: ScreenHeaderProps) {
  return (
    <View style={[styles.container, centered && styles.centered, style]}>
      <View style={styles.textBlock}>
        <Text style={[styles.title, centered && styles.titleCentered]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, centered && styles.subtitleCentered]}>{subtitle}</Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
      {/* Accent underline */}
      <View style={[styles.underline, centered && styles.underlineCentered]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    marginBottom: spacing.md,
    flexDirection: 'column',
  },
  centered: { alignItems: 'center' },
  textBlock: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  title: {
    fontFamily: fontFamily.serif,
    fontSize: 28,
    fontWeight: '400',
    color: colors.text,
    letterSpacing: -0.5,
    lineHeight: 34,
    flex: 1,
  },
  titleCentered: { textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 4,
  },
  subtitleCentered: { textAlign: 'center' },
  right: { marginLeft: spacing.md },
  underline: {
    marginTop: spacing.sm,
    height: 3,
    width: 32,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  underlineCentered: { alignSelf: 'center' },
});
