import { create } from 'zustand';

const ACCESS_TOKEN_KEY = 'supreme_access_token';
const REFRESH_TOKEN_KEY = 'supreme_refresh_token';

export const useAuthStore = create((set, get) => ({
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshTokenValue: localStorage.getItem(REFRESH_TOKEN_KEY),
    user: null,

    setAuth: ({ accessToken, refreshToken, user = null }) => {
        if (accessToken) {
            localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        }

        if (refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        }

        set({
            accessToken: accessToken || get().accessToken,
            refreshTokenValue: refreshToken || get().refreshTokenValue,
            user
        });
    },

    clearAuth: () => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);

        set({
            accessToken: null,
            refreshTokenValue: null,
            user: null
        });
    },

    refreshToken: async () => {
        const refreshToken = get().refreshTokenValue;

        if (!refreshToken) {
            throw new Error('No refresh token');
        }

        const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refreshToken })
        });

        if (!response.ok) {
            throw new Error('Token refresh failed');
        }

        const data = await response.json();

        if (!data.accessToken) {
            throw new Error('No access token returned');
        }

        localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);

        set({
            accessToken: data.accessToken
        });

        return data.accessToken;
    },

    logout: async () => {
        const token = get().accessToken;

        try {
            await fetch('/api/auth/signout', {
                method: 'POST',
                headers: token
                    ? { Authorization: `Bearer ${token}` }
                    : {}
            });
        } finally {
            get().clearAuth();
        }
    }
}));
