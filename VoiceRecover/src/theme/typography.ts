import { Platform } from 'react-native';

const serifFamily = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

const sansFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'sans-serif',
});

export const fontFamily = {
  serif: serifFamily,
  sans: sansFamily,
};

export const typography = {
  h1:        { fontFamily: serifFamily, fontSize: 32, fontWeight: '400' as const, lineHeight: 40 },
  h2:        { fontFamily: serifFamily, fontSize: 24, fontWeight: '400' as const, lineHeight: 32 },
  h3:        { fontFamily: serifFamily, fontSize: 20, fontWeight: '400' as const, lineHeight: 28 },
  body:      { fontFamily: sansFamily,  fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyLarge: { fontFamily: sansFamily,  fontSize: 18, fontWeight: '400' as const, lineHeight: 28 },
  caption:   { fontFamily: sansFamily,  fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  button:    { fontFamily: sansFamily,  fontSize: 16, fontWeight: '500' as const, lineHeight: 24 },
  score:     { fontFamily: serifFamily, fontSize: 48, fontWeight: '400' as const, lineHeight: 56 },
};
