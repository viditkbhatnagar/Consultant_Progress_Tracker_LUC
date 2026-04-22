import React from 'react';
import { Box } from '@mui/material';
import { avatarColor, initials } from '../../utils/meetingDesign';

const MeetingAvatar = ({ name = '', size = 26, sx }) => {
    const c = avatarColor(name);
    return (
        <Box
            component="span"
            sx={{
                width: size,
                height: size,
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: c.bg,
                color: c.fg,
                fontSize: Math.round(size * 0.42),
                fontWeight: 600,
                flexShrink: 0,
                letterSpacing: 0.2,
                lineHeight: 1,
                userSelect: 'none',
                ...sx,
            }}
        >
            {initials(name)}
        </Box>
    );
};

export default MeetingAvatar;
