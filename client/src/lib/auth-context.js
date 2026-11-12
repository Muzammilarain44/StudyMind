import { createContext } from 'react';

/**
 * Shared auth context. Kept in its own file (no components here) so that
 * auth.jsx only exports the AuthProvider component — this is what the
 * react-refresh/only-export-components lint rule requires. Previously the
 * context and the useAuth hook lived in auth.jsx next to the provider,
 * which produced the 1 lint warning carried since Phase 2.
 */
export const AuthContext = createContext(null);
