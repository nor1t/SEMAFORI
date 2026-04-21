import React, { createContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

const AuthContext = createContext({});

export default AuthContext;

export export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        setUser(session?.user ?? null);
      } catch (err) {
        console.error('Supabase auth initialization error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email, password, fullName, retryCount = 0) => {
    setLoading(true);
    setError(null);

    // Check if offline
    if (!navigator.onLine) {
      const message = 'Jeni offline. Kontrolloni lidhjen tuaj të internetit dhe provoni përsëri.';
      setError(message);
      setLoading(false);
      return { data: null, error: { message } };
    }

    try {
      // Add timeout to the request
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Kërkesa ka skaduar. Provoni përsëri.')), 10000);
      });

      const signUpPromise = supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      const { data, error } = await Promise.race([signUpPromise, timeoutPromise]);

      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      let message = err?.message || 'Regjistrimi dështoi. Provoni përsëri.';

      // Handle specific error types
      if (err.message.includes('timeout') || err.message.includes('skaduar')) {
        message = 'Kërkesa ka skaduar. Provoni përsëri.';
      } else if (err.message.includes('network') || err.message.includes('fetch')) {
        message = 'Problem me lidhjen. Kontrolloni internetin dhe provoni përsëri.';
      } else if (err.message.includes('User already registered')) {
        message = 'Ky email është tashmë i regjistruar. Provoni të hyni.';
      } else if (err.message.includes('Password should be at least')) {
        message = 'Fjalëkalimi duhet të jetë më i fortë.';
      }

      setError(message);

      // Auto-retry for network errors, up to 2 retries
      if ((err.message.includes('network') || err.message.includes('timeout') || err.message.includes('fetch')) && retryCount < 2) {
        console.log(`Retrying sign up... Attempt ${retryCount + 1}`);
        setTimeout(() => signUp(email, password, fullName, retryCount + 1), 2000);
        return { data: null, error: { message: `${message} (Duke provuar përsëri...)` } };
      }

      setLoading(false);
      return { data: null, error: { message } };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password, retryCount = 0) => {
    setLoading(true);
    setError(null);

    // Check if offline
    if (!navigator.onLine) {
      const message = 'Jeni offline. Kontrolloni lidhjen tuaj të internetit dhe provoni përsëri.';
      setError(message);
      setLoading(false);
      return { data: null, error: { message } };
    }

    try {
      // Add timeout to the request
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Kërkesa ka skaduar. Provoni përsëri.')), 10000); // 10 second timeout
      });

      const signInPromise = supabase.auth.signInWithPassword({
        email,
        password,
      });

      const { data, error } = await Promise.race([signInPromise, timeoutPromise]);

      if (error) throw error;
      setUser(data?.user ?? null);
      return { data, error: null };
    } catch (err) {
      let message = err?.message || 'Hyrja dështoi. Kontrolloni kredencialet tuaja.';

      // Handle specific error types
      if (err.message.includes('timeout') || err.message.includes('skaduar')) {
        message = 'Kërkesa ka skaduar. Provoni përsëri.';
      } else if (err.message.includes('network') || err.message.includes('fetch')) {
        message = 'Problem me lidhjen. Kontrolloni internetin dhe provoni përsëri.';
      } else if (err.message.includes('Invalid login credentials')) {
        message = 'Kredencialet e pavlefshme. Kontrolloni email-in dhe fjalëkalimin.';
      }

      setError(message);

      // Auto-retry for network errors, up to 2 retries
      if ((err.message.includes('network') || err.message.includes('timeout') || err.message.includes('fetch')) && retryCount < 2) {
        console.log(`Retrying sign in... Attempt ${retryCount + 1}`);
        setTimeout(() => signIn(email, password, retryCount + 1), 2000); // Retry after 2 seconds
        return { data: null, error: { message: `${message} (Duke provuar përsëri...)` } };
      }

      setLoading(false);
      return { data: null, error: { message } };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      return { error: null };
    } catch (err) {
      const message = err?.message || 'Logout failed.';
      setError(message);
      return { error: { message } };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    error,
    signUp,
    signIn,
    signOut,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};