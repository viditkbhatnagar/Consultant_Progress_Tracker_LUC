// Framer-motion variants + helpers for the dashboard redesign.
//
// One place for all motion vocabulary so AdminDashboard, TeamLeadDashboard,
// and AdminSkillhubView feel coordinated. Pairs with the --d-dur-* /
// --d-ease-* CSS tokens from dashboardTheme.js — both sides use the same
// durations so CSS hover transitions and framer entrances never fight.
//
// Respect `prefers-reduced-motion` by calling `useReducedMotionVariants`
// in the component; it swaps every entrance to an instant one.

import { useReducedMotion, animate, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

// Cubic-beziers as arrays (framer accepts both strings and arrays).
export const EASE = {
    enter: [0.22, 1, 0.36, 1],
    move: [0.25, 1, 0.5, 1],
    drawer: [0.32, 0.72, 0, 1],
};

export const DUR = {
    xs: 0.12,
    sm: 0.18,
    md: 0.24,
    lg: 0.32,
    hero: 0.6,
};

// Page-level container: stagger direct children on mount. Children opt in
// by using a `motion.div` with `variants={riseVariants}`.
export const pageStagger = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.07,
            delayChildren: 0.05,
        },
    },
};

// The default entrance for every dashboard section: fade + 8px rise.
export const riseVariants = {
    hidden: { opacity: 0, y: 8 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: DUR.md, ease: EASE.enter },
    },
};

// Smaller rise for items inside a strip (KPI cards, consultant cards).
export const riseItemVariants = {
    hidden: { opacity: 0, y: 6 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: DUR.md, ease: EASE.enter },
    },
};

// Card-grid stagger (team cards, consultant cards).
export const gridStagger = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.04,
            delayChildren: 0.02,
        },
    },
};

// Hover + press language applied to pressable cards (whileHover / whileTap).
// Keep lift subtle — impeccable rule "high-frequency hover stays quiet".
export const cardHover = {
    rest: { y: 0, boxShadow: 'var(--d-shadow-card)' },
    hover: {
        y: -2,
        boxShadow: 'var(--d-shadow-hover)',
        transition: { duration: DUR.sm, ease: EASE.enter },
    },
    press: { scale: 0.98, transition: { duration: DUR.xs } },
};

// AnimatePresence mode="wait" crossfade for tab panels.
export const tabPanelVariants = {
    hidden: { opacity: 0, y: 6 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: DUR.md, ease: EASE.enter },
    },
    exit: {
        opacity: 0,
        y: -4,
        transition: { duration: DUR.sm, ease: EASE.enter },
    },
};

// Wrap any variants set in this at the top of a component — it returns
// either the rich variants (normal) or a flat instant-on variant set when
// the user has prefers-reduced-motion: reduce.
export const useReducedMotionVariants = (normal) => {
    const reduce = useReducedMotion();
    if (!reduce) return normal;

    // Build a flat version: every property snaps to "show" with no motion.
    // Works for any variants object with `hidden` and `show` keys.
    const out = {};
    for (const key of Object.keys(normal)) {
        out[key] = {
            ...normal[key],
            transition: { duration: 0 },
        };
    }
    return out;
};

// Count-up hook for KPI values. Animates 0 → target the first time a
// non-zero target arrives; subsequent changes snap instantly so data
// refreshes (date-range, filters) don't re-animate and feel tacky.
// Respects prefers-reduced-motion.
//
// Why "first non-zero" and not "first render": on mount the derived
// totals are 0 because data is still loading. If we consumed the
// first-render flag on that initial 0, the real value (e.g. 57) that
// lands one render later would just snap.
//
// Usage:
//   const display = useCountUp(42);
//   <Typography>{display}</Typography>
export const useCountUp = (target, { duration = 0.9, decimals = 0 } = {}) => {
    const reduce = useReducedMotion();
    const hasAnimated = useRef(false);
    const mv = useMotionValue(0);
    const rounded = useTransform(mv, (v) => {
        if (decimals === 0) return Math.round(v);
        const factor = 10 ** decimals;
        return Math.round(v * factor) / factor;
    });
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        const unsub = rounded.on('change', setDisplay);
        return () => unsub();
    }, [rounded]);

    useEffect(() => {
        if (target == null || Number.isNaN(target)) return;

        if (reduce) {
            mv.set(target);
            hasAnimated.current = true;
            return;
        }

        // Already animated once — later updates snap.
        if (hasAnimated.current) {
            mv.set(target);
            return;
        }

        // Hold at 0 until real data arrives. A target that's genuinely
        // 0 forever just stays 0 — there's nothing to animate anyway.
        if (target === 0) {
            mv.set(0);
            return;
        }

        hasAnimated.current = true;
        const controls = animate(mv, target, {
            duration,
            ease: EASE.enter,
        });
        return () => controls.stop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target, reduce]);

    return display;
};

// Count-up for percentages — same behaviour but formats as `${n}%`.
export const useCountUpPct = (target, opts) => {
    const n = useCountUp(target, opts);
    return `${n}%`;
};
