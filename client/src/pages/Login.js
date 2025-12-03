import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Paper,
    TextField,
    Button,
    Typography,
    Alert,
    CircularProgress,
    Grid,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Please enter both email and password');
            return;
        }

        setLoading(true);

        const result = await login(email, password);

        setLoading(false);

        if (result.success) {
            // Redirect based on role
            const user = result.user;
            if (user.role === 'admin') {
                navigate('/admin/dashboard');
            } else if (user.role === 'team_lead') {
                navigate('/team-lead/dashboard');
            } else if (user.role === 'consultant') {
                navigate('/consultant/dashboard');
            }
        } else {
            setError(result.message || 'Login failed');
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: { xs: 2, sm: 3, md: 4 },
            }}
        >
            <Paper
                elevation={24}
                sx={{
                    width: '100%',
                    maxWidth: { xs: '100%', sm: '500px', md: '1100px' },
                    borderRadius: { xs: 2, md: 4 },
                    overflow: 'hidden',
                }}
            >
                <Grid container sx={{ minHeight: { md: '600px' } }}>
                    {/* Logo Side - Hidden on mobile */}
                    {!isMobile && (
                        <Grid
                            item
                            xs={12}
                            md={6}
                            sx={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                p: 6,
                                position: 'relative',
                                '&::before': {
                                    content: '""',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    backdropFilter: 'blur(10px)',
                                },
                            }}
                        >
                            <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                                <img
                                    src="/LUC-new-logo-svg-1.svg"
                                    alt="LUC Logo"
                                    style={{
                                        width: '100%',
                                        maxWidth: '400px',
                                        height: 'auto',
                                        marginBottom: '2rem',
                                        filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.2))',
                                    }}
                                />
                                <Typography
                                    variant="h4"
                                    sx={{
                                        fontWeight: 700,
                                        color: '#fff',
                                        textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                        mb: 2,
                                    }}
                                >
                                    Team Progress Tracker
                                </Typography>
                                <Typography
                                    variant="body1"
                                    sx={{
                                        color: 'rgba(255,255,255,0.9)',
                                        maxWidth: '350px',
                                        mx: 'auto',
                                    }}
                                >
                                    Track, manage, and optimize your team's commitments and progress efficiently
                                </Typography>
                            </Box>
                        </Grid>
                    )}

                    {/* Login Form Side */}
                    <Grid
                        item
                        xs={12}
                        md={6}
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            p: { xs: 3, sm: 4, md: 6 },
                            backgroundColor: 'background.paper',
                        }}
                    >
                        {/* Mobile Logo */}
                        {isMobile && (
                            <Box sx={{ textAlign: 'center', mb: 3 }}>
                                <img
                                    src="/LUC-new-logo-svg-1.svg"
                                    alt="LUC Logo"
                                    style={{
                                        width: '100%',
                                        maxWidth: '200px',
                                        height: 'auto',
                                        marginBottom: '1rem',
                                    }}
                                />
                            </Box>
                        )}

                        <Box sx={{ mb: 4 }}>
                            <Typography
                                variant="h4"
                                component="h1"
                                gutterBottom
                                sx={{ fontWeight: 700, color: 'primary.main' }}
                            >
                                Welcome Back
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                                Sign in to your account to continue
                            </Typography>
                        </Box>

                        {error && (
                            <Alert severity="error" sx={{ mb: 3 }}>
                                {error}
                            </Alert>
                        )}

                        <form onSubmit={handleSubmit}>
                            <TextField
                                fullWidth
                                label="Email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                margin="normal"
                                required
                                autoComplete="email"
                                autoFocus
                                sx={{ mb: 2 }}
                            />
                            <TextField
                                fullWidth
                                label="Password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                margin="normal"
                                required
                                autoComplete="current-password"
                                sx={{ mb: 3 }}
                            />
                            <Button
                                fullWidth
                                type="submit"
                                variant="contained"
                                size="large"
                                disabled={loading}
                                sx={{
                                    py: 1.5,
                                    fontSize: '1.1rem',
                                    fontWeight: 600,
                                    textTransform: 'none',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    '&:hover': {
                                        background: 'linear-gradient(135deg, #5568d3 0%, #63408a 100%)',
                                        boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                                    },
                                    '&.Mui-disabled': {
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'rgba(255, 255, 255, 0.8)',
                                    },
                                }}
                            >
                                {loading ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <CircularProgress size={22} color="inherit" />
                                        <span>Signing In...</span>
                                    </Box>
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                        </form>
                    </Grid>
                </Grid>
            </Paper>
        </Box>
    );
};

export default Login;
