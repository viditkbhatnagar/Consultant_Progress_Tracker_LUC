import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initialize auth on app load
    useEffect(() => {
        const initAuth = () => {
            const storedUser = authService.getStoredUser();
            const storedToken = localStorage.getItem('token');

            if (storedUser && storedToken) {
                setUser(storedUser);
                setToken(storedToken);
                authService.initializeAuth();
            }

            setLoading(false);
        };

        initAuth();
    }, []);

    const login = async (email, password) => {
        try {
            const data = await authService.login(email, password);

            if (data.success) {
                setUser(data.user);
                setToken(data.token);
                return { success: true, user: data.user };
            }

            return { success: false, message: data.message };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Login failed',
            };
        }
    };

    const logout = () => {
        authService.logout();
        setUser(null);
        setToken(null);
    };

    const updatePassword = async (currentPassword, newPassword) => {
        try {
            const data = await authService.updatePassword(currentPassword, newPassword);

            if (data.success) {
                setToken(data.token);
                return { success: true };
            }

            return { success: false, message: data.message };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Password update failed',
            };
        }
    };

    const isAdmin = () => user?.role === 'admin';
    const isTeamLead = () => user?.role === 'team_lead';
    const isConsultant = () => user?.role === 'consultant';

    const value = {
        user,
        token,
        loading,
        login,
        logout,
        updatePassword,
        isAuthenticated: !!user && !!token,
        isAdmin,
        isTeamLead,
        isConsultant,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
