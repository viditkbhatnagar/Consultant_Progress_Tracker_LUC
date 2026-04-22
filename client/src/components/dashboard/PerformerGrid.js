import React from 'react';
import { Box } from '@mui/material';
import { motion } from 'framer-motion';
import { gridStagger, useReducedMotionVariants } from '../../utils/dashboardMotion';

// Responsive grid wrapper that staggers its PerformerCard children on mount.
// Direct children should be motion components that consume riseItemVariants.
const PerformerGrid = ({ children, minColumnWidth = 280 }) => {
    const variants = useReducedMotionVariants(gridStagger);

    return (
        <motion.div variants={variants}>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(auto-fill, minmax(280px, 1fr))',
                        md: `repeat(auto-fill, minmax(${minColumnWidth}px, 1fr))`,
                    },
                    gap: 1.75,
                }}
            >
                {children}
            </Box>
        </motion.div>
    );
};

export default PerformerGrid;
