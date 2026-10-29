import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile as updateFirebaseProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured, handleFirestoreError, OperationType } from '../firebase/config';
import { UserProfile, Language } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  setError: (err: string | null) => void;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    pass: string,
    displayName?: string,
    businessName?: string
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
  updateUserProfileData: (data: {
    displayName?: string;
    businessName?: string;
    language?: Language;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && db) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            setUserProfile(userDoc.data() as UserProfile);
          } else {
            // First time login - initialize profile document
            const newProfile: UserProfile = {
              id: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || '',
              businessName: '',
              language: 'bn',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
          }
        } catch (err) {
          console.error('Error fetching/creating user profile:', err);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, pass: string) => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase is not configured.');
    }
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (err: any) {
      const msg = err?.message || 'Login failed';
      setError(msg);
      throw err;
    }
  };

  const signUpWithEmail = async (
    email: string,
    pass: string,
    displayName?: string,
    businessName?: string
  ) => {
    if (!isFirebaseConfigured || !auth || !db) {
      throw new Error('Firebase is not configured.');
    }
    setError(null);
    try {
      const res = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const now = new Date().toISOString();

      if (displayName) {
        await updateFirebaseProfile(res.user, { displayName });
      }

      const initialProfile: UserProfile = {
        id: res.user.uid,
        email: res.user.email || email.trim(),
        displayName: displayName || '',
        businessName: businessName || '',
        language: 'bn',
        createdAt: now,
        updatedAt: now,
      };

      try {
        await setDoc(doc(db, 'users', res.user.uid), initialProfile);
        setUserProfile(initialProfile);
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.CREATE, `users/${res.user.uid}`);
      }
    } catch (err: any) {
      const msg = err?.message || 'Sign up failed';
      setError(msg);
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase is not configured.');
    }
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      const msg = err?.message || 'Password reset failed';
      setError(msg);
      throw err;
    }
  };

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase is not configured.');
    }
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const userDocRef = doc(db, 'users', res.user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        const now = new Date().toISOString();
        const initialProfile: UserProfile = {
          id: res.user.uid,
          email: res.user.email || '',
          displayName: res.user.displayName || '',
          businessName: '',
          language: 'bn',
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(userDocRef, initialProfile);
        setUserProfile(initialProfile);
      }
    } catch (err: any) {
      const msg = err?.message || 'Google sign in failed';
      setError(msg);
      throw err;
    }
  };

  const logOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
    } catch (err: any) {
      setError(err?.message || 'Logout failed');
    }
  };

  const updateUserProfileData = async (data: {
    displayName?: string;
    businessName?: string;
    language?: Language;
  }) => {
    if (!user || !db) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const updatePayload = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(userDocRef, updatePayload);
      setUserProfile((prev) => (prev ? { ...prev, ...updatePayload } : null));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        error,
        setError,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        signInWithGoogle,
        logOut,
        updateUserProfileData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
