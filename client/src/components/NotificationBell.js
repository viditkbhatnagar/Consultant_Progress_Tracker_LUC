import React, { useState, useEffect } from 'react';
import {
    IconButton,
    Badge,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Typography,
    Box,
} from '@mui/material';
import {
    Notifications as NotificationsIcon,
    CheckCircle as CheckCircleIcon,
    Delete as DeleteIcon,
    DoneAll as DoneAllIcon,
} from '@mui/icons-material';
import notificationService from '../services/notificationService';

const NotificationBell = () => {
    const [anchorEl, setAnchorEl] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const loadNotifications = async () => {
        try {
            const data = await notificationService.getNotifications();
            setNotifications(data.data || []);
            setUnreadCount(data.data?.filter(n => !n.isRead).length || 0);
        } catch (err) {
            console.error('Failed to load notifications:', err);
        }
    };

    useEffect(() => {
        loadNotifications();

        // Poll for new notifications every minute
        const interval = setInterval(loadNotifications, 60000);

        return () => clearInterval(interval);
    }, []);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleMarkAsRead = async (id) => {
        try {
            await notificationService.markAsRead(id);
            loadNotifications();
        } catch (err) {
            console.error('Failed to mark as read:', err);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await notificationService.markAllAsRead();
            loadNotifications();
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    };

    const handleDelete = async (id) => {
        try {
            await notificationService.deleteNotification(id);
            loadNotifications();
        } catch (err) {
            console.error('Failed to delete notification:', err);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'follow_up':
                return '📅';
            case 'weekly_summary':
                return '📊';
            case 'system':
                return '🔔';
            default:
                return '📬';
        }
    };

    return (
        <>
            <IconButton color="inherit" onClick={handleClick}>
                <Badge badgeContent={unreadCount} color="error">
                    <NotificationsIcon />
                </Badge>
            </IconButton>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                PaperProps={{
                    sx: { width: 350, maxHeight: 500 },
                }}
            >
                <Box sx={{ p: 2, pb: 1 }}>
                    <Typography variant="h6">Notifications</Typography>
                </Box>

                {unreadCount > 0 && (
                    <>
                        <MenuItem onClick={handleMarkAllAsRead}>
                            <ListItemIcon>
                                <DoneAllIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText>Mark all as read</ListItemText>
                        </MenuItem>
                        <Divider />
                    </>
                )}

                {notifications.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography color="text.secondary">
                            No notifications
                        </Typography>
                    </Box>
                ) : (
                    notifications.map((notification) => (
                        <MenuItem
                            key={notification._id}
                            sx={{
                                backgroundColor: notification.isRead ? 'transparent' : 'action.hover',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                whiteSpace: 'normal',
                                py: 1.5,
                            }}
                        >
                            <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>
                                <Box sx={{ mr: 1, fontSize: '1.2rem' }}>
                                    {getNotificationIcon(notification.type)}
                                </Box>
                                <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="body2">
                                        {notification.message}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {new Date(notification.createdAt).toLocaleDateString()} {new Date(notification.createdAt).toLocaleTimeString()}
                                    </Typography>
                                </Box>
                                <Box>
                                    {!notification.isRead && (
                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleMarkAsRead(notification._id);
                                            }}
                                        >
                                            <CheckCircleIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(notification._id);
                                        }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </Box>
                        </MenuItem>
                    ))
                )}
            </Menu>
        </>
    );
};

export default NotificationBell;
