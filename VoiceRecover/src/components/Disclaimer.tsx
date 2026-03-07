import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

export function Disclaimer() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        This app is for speech practice only and is not a substitute for professional speech-language pathology services.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  text: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
  },
});
