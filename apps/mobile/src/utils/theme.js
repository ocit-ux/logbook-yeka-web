import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const lightTheme = {
  mode: 'light',
  primary: '#1b4d3e', 
  primaryDark: '#0f2d24',
  secondary: '#d4af37', 
  background: '#f8faf9', 
  surface: '#ffffff',
  text: '#1f2937',
  textSecondary: '#4b5563',
  border: '#e5e7eb',
  borderPrimary: '#1b4d3e',
  error: '#ef4444',
  success: '#10b981',
};

export const darkTheme = {
  mode: 'dark',
  primary: '#2d7a62', // Lighter katulistiwa green for dark mode visibility
  primaryDark: '#1b4d3e',
  secondary: '#d4af37', 
  background: '#121212', 
  surface: '#1e1e1e',
  text: '#f3f4f6',
  textSecondary: '#9ca3af',
  border: '#374151',
  borderPrimary: '#2d7a62',
  error: '#f87171',
  success: '#34d399',
};

// Fallback untuk kompabilitas awal agar tidak error jika ada layar yang belum diupdate
export const katulistiwaTheme = lightTheme;

const ThemeContext = createContext({
  theme: lightTheme,
  isDark: false,
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('@app_theme');
        if (savedTheme === 'dark') {
          setIsDark(true);
        }
      } catch (e) {}
    })();
  }, []);

  const toggleTheme = async () => {
    try {
      const newMode = !isDark;
      setIsDark(newMode);
      await AsyncStorage.setItem('@app_theme', newMode ? 'dark' : 'light');
    } catch (e) {}
  };

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
