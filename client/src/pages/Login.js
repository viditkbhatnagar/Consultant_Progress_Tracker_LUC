import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    TextField,
    Button,
    Typography,
    Alert,
    CircularProgress,
    Grid,
    useMediaQuery,
    useTheme,
    InputAdornment,
    IconButton,
    Container,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import MountainVistaParallax from '../components/MountainVistaParallax';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
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
            } else if (user.role === 'manager') {
                navigate('/student-database');
            } else if (user.role === 'skillhub') {
                navigate('/skillhub/dashboard');
            } else if (user.role === 'consultant') {
                navigate('/consultant/dashboard');
            } else {
                navigate('/');
            }
        } else {
            setError(result.message || 'Login failed');
        }
    };

    const handleClickShowPassword = () => {
        setShowPassword(!showPassword);
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                px: { xs: 2, sm: 3, md: 4 },
                pt: { xs: 4, md: '5vh' },
                pb: { xs: 2, md: 4 },
                overflow: 'hidden',
            }}
        >
            {/* Animated mountain parallax background */}
            <MountainVistaParallax />

            {/* Soft readability overlay — lighter at top, slightly warmer at bottom */}
            <Box
                aria-hidden="true"
                sx={{
                    position: 'absolute',
                    inset: 0,
                    background:
                        'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 35%, rgba(255,248,231,0.28) 100%)',
                    pointerEvents: 'none',
                    zIndex: 6,
                }}
            />

            <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 10 }}>
                <Box
                    sx={{
                        width: '100%',
                        maxWidth: '460px',
                        mx: 'auto',
                        p: { xs: 3, sm: 4 },
                        borderRadius: '20px',
                        backgroundColor: 'rgba(255, 255, 255, 0.82)',
                        backdropFilter: 'blur(18px)',
                        WebkitBackdropFilter: 'blur(18px)',
                        border: '1px solid rgba(255, 255, 255, 0.85)',
                        boxShadow: '0 20px 50px rgba(40, 50, 90, 0.18)',
                    }}
                >
                    {/* Integrated logos — small, side-by-side at the top of the card */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: { xs: 2, sm: 2.5 },
                            mb: 3.5,
                        }}
                    >
                        <img
                            src="/LUC-new-logo-svg-1.svg"
                            alt="LUC Logo"
                            style={{
                                height: 'auto',
                                width: 130,
                                objectFit: 'contain',
                                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.08))',
                            }}
                        />
                        <Box
                            sx={{
                                width: '1px',
                                minHeight: 48,
                                bgcolor: 'rgba(0,0,0,0.14)',
                            }}
                        />
                        <img
                            src="/skillhub-logo.jpeg"
                            alt="Skillhub Logo"
                            style={{
                                height: 'auto',
                                width: 60,
                                objectFit: 'contain',
                                borderRadius: '10px',
                                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.08))',
                            }}
                        />
                    </Box>

                    <Box sx={{ mb: 3.5, textAlign: 'center' }}>
                        <Typography
                            variant="h4"
                            component="h1"
                            gutterBottom
                            sx={{
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            Team Progress Tracker
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#4a4f6b' }}>
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
                                    sx={{
                                        mb: 2,
                                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                        borderRadius: 1,
                                        '& .MuiOutlinedInput-root': {
                                            '&:hover fieldset': {
                                                borderColor: '#764ba2',
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: '#667eea',
                                            },
                                        },
                                    }}
                                />
                                <TextField
                                    fullWidth
                                    label="Password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    margin="normal"
                                    required
                                    autoComplete="current-password"
                                    sx={{
                                        mb: 3,
                                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                        borderRadius: 1,
                                        '& .MuiOutlinedInput-root': {
                                            '&:hover fieldset': {
                                                borderColor: '#764ba2',
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: '#667eea',
                                            },
                                        },
                                    }}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    aria-label="toggle password visibility"
                                                    onClick={handleClickShowPassword}
                                                    edge="end"
                                                    sx={{ color: '#667eea' }}
                                                >
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
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
                                        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                                        '&:hover': {
                                            background: 'linear-gradient(135deg, #5568d3 0%, #63408a 100%)',
                                            boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                                            transform: 'translateY(-2px)',
                                        },
                                        '&.Mui-disabled': {
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            color: 'rgba(255, 255, 255, 0.8)',
                                        },
                                        transition: 'all 0.3s ease',
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
                </Box>
            </Container>
        </Box>
    );
};

export default Login;
