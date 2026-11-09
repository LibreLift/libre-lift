// Based on https://colorhunt.co/palette/2c36393f4e4fa27b5cdcd7c9.
const palette = { charcoal: '#2C3639', slate: '#3F4E4F', bronze: '#A27B5C', cream: '#DCD7C9' };

export const themes = {
  light: {
    background: palette.cream,
    surface: '#F5F2EB',
    text: palette.charcoal,
    secondary: palette.slate,
    accent: palette.bronze,
    border: '#BEB7A8',
    selected: palette.slate,
    onSelected: palette.cream,
  },
  dark: {
    background: palette.charcoal,
    surface: palette.slate,
    text: palette.cream,
    secondary: '#C3BEB1',
    accent: palette.bronze,
    border: '#657071',
    selected: palette.cream,
    onSelected: palette.charcoal,
  },
};
