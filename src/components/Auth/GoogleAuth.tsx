/**
 * Google Auth Component
 * 
 * Handles Google OAuth for Gmail access.
 * 
 * IMPORTANT: This uses OAuth for mailbox access (read-only).
 * The access token is used to call Gmail API directly.
 */

import { useGoogleLogin, TokenResponse } from '@react-oauth/google';
import { useAuthStore } from '../../store';
import { Mail, LogOut, User } from 'lucide-react';

// ============================================
// Combined Auth Component (for header)
// ============================================

export function GoogleAuth() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse: TokenResponse) => {
      try {
        const userResponse = await fetch(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          {
            headers: {
              Authorization: `Bearer ${tokenResponse.access_token}`,
            },
          }
        );
        
        if (!userResponse.ok) {
          throw new Error('Failed to fetch user profile');
        }
        
        const userInfo = await userResponse.json();
        
        setAuth(tokenResponse.access_token, {
          email: userInfo.email,
          name: userInfo.name || userInfo.email,
          picture: userInfo.picture || '',
        });
      } catch (error) {
        console.error('Auth error:', error);
      }
    },
    onError: (error) => {
      console.error('Google login error:', error);
    },
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
  });
  
  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-2">
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.name}
            className="w-8 h-8 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <button
          onClick={logout}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }
  
  return (
    <button
      onClick={() => login()}
      className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      Connect Gmail
    </button>
  );
}

export default GoogleAuth;
