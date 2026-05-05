import React, { createContext, useEffect, useState } from 'react';
import { translations } from './LanguageContext';
import { supabase } from '../services/supabaseClient';

const AuthContext = createContext({});

const getLanguage = () => localStorage.getItem('language') || 'albanian';
const translate = (key) => translations[getLanguage()]?.[key] || translations.albanian?.[key] || key;
const isTimeoutError = (message) => message.includes('timeout') || message.includes('skaduar');
const isNetworkError = (message) => message.includes('network') || message.includes('fetch');

export default AuthContext;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        setUser(session?.user ?? null);
      } catch (authError) {
        console.error('Supabase auth initialization error:', authError);
        setError(authError.message);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const withTimeout = (promise, timeoutMs = 10000) =>
    Promise.race([
      promise,
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error(translate('timeout'))), timeoutMs);
      }),
    ]);

  const signUp = async (email, password, fullName) => {
    setLoading(true);
    setError(null);

    if (!navigator.onLine) {
      const message = translate('offline');
      setError(message);
      setLoading(false);
      return { data: null, error: { message } };
    }

    try {
      const { data, error: signUpError } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        })
      );

      if (signUpError) throw signUpError;
      return { data, error: null };
    } catch (authError) {
      const rawMessage = `${authError?.message || ''}`.toLowerCase();
      let message = authError?.message || translate('tryAgain');

      if (isTimeoutError(rawMessage)) {
        message = translate('timeout');
      } else if (isNetworkError(rawMessage)) {
        message = translate('networkError');
      } else if (rawMessage.includes('user already registered')) {
        message = getLanguage() === 'english'
          ? 'This email is already registered. Try signing in.'
          : 'Ky email është tashmë i regjistruar. Provoni të hyni.';
      } else if (rawMessage.includes('password should be at least')) {
        message = getLanguage() === 'english'
          ? 'Password needs to be stronger.'
          : 'Fjalëkalimi duhet të jetë më i fortë.';
      }

      setError(message);
      return { data: null, error: { message } };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    setLoading(true);
    setError(null);

    if (!navigator.onLine) {
      const message = translate('offline');
      setError(message);
      setLoading(false);
      return { data: null, error: { message } };
    }

    try {
      const { data, error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
        })
      );

      if (signInError) throw signInError;
      setUser(data?.user ?? null);
      return { data, error: null };
    } catch (authError) {
      const rawMessage = `${authError?.message || ''}`.toLowerCase();
      let message = authError?.message || translate('tryAgain');

      if (isTimeoutError(rawMessage)) {
        message = translate('timeout');
      } else if (isNetworkError(rawMessage)) {
        message = translate('networkError');
      } else if (rawMessage.includes('invalid login credentials')) {
        message = getLanguage() === 'english'
          ? 'Invalid credentials. Check your email and password.'
          : 'Kredencialet janë të pavlefshme. Kontrolloni email-in dhe fjalëkalimin.';
      }

      setError(message);
      return { data: null, error: { message } };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setUser(null);
      return { error: null };
    } catch (authError) {
      const message = authError?.message || 'Logout failed.';
      setError(message);
      return { error: { message } };
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signUp,
        signIn,
        signOut,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
