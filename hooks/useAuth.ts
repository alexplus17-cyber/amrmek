
import { useContext } from 'react';
import { AuthProvider, useAuth as useAuthFromContext } from '../contexts/AuthContext';

// This is just a re-export for cleaner import paths, the logic is in AuthContext.
export const useAuth = useAuthFromContext;
