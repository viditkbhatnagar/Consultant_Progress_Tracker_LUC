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
            } else if (user.role === 'consultant') {
                navigate('/consultant/dashboard');
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
                background: 'linear-gradient(135deg, #FFF8E7 0%, #F5E6D3 50%, #FFF8E7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: { xs: 2, sm: 3, md: 4 },
            }}
        >
            <Container maxWidth="lg">
                <Grid container spacing={0} alignItems="center" sx={{ minHeight: '600px' }}>
                    {/* Logo Side - Left */}
                    <Grid
                        item
                        xs={12}
                        md={6}
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: { xs: 3, md: 6 },
                        }}
                    >
                        <Box sx={{ textAlign: 'center', width: '100%' }}>
                            <img
                                src="/LUC-new-logo-svg-1.svg"
                                alt="LUC Logo"
                                style={{
                                    width: '100%',
                                    maxWidth: '500px',
                                    height: 'auto',
                                    marginBottom: '2rem',
                                    filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.1))',
                                }}
                            />
                            <Typography
                                variant="h3"
                                sx={{
                                    fontWeight: 700,
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    mb: 2,
                                    display: { xs: 'none', md: 'block' },
                                }}
                            >
                                Team Progress Tracker
                            </Typography>
                            <Typography
                                variant="h6"
                                sx={{
                                    color: '#666',
                                    fontWeight: 400,
                                    maxWidth: '450px',
                                    mx: 'auto',
                                    lineHeight: 1.6,
                                    display: { xs: 'none', md: 'block' },
                                }}
                            >
                                Track, manage, and optimize your team's commitments and progress efficiently
                            </Typography>
                        </Box>
                    </Grid>

                    {/* Login Form Side - Right */}
                    <Grid
                        item
                        xs={12}
                        md={6}
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            p: { xs: 3, md: 6 },
                        }}
                    >
                        <Box sx={{ maxWidth: '450px', mx: 'auto', width: '100%' }}>
                            <Box sx={{ mb: 4 }}>
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
                                    Welcome Back
                                </Typography>
                                <Typography variant="body1" sx={{ color: '#666' }}>
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
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
};

export default Login;
