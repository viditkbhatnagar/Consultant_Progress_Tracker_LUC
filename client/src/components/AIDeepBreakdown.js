import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Autocomplete,
    Box,
    Button,
    Chip,
    CircularProgress,
    IconButton,
    LinearProgress,
    Tab,
    Tabs,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Groups as TeamsIcon,
    Person as PersonIcon,
    Refresh as RefreshIcon,
    PlayArrow as RunIcon,
    ErrorOutline as ErrorIcon,
} from '@mui/icons-material';
import aiService from '../services/aiService';

// Renders markdown body → cards with ## section headers + bulleted lists.
// Intentionally simple — re-uses the same parse/render shape as the
// org-wide AISummaryCard so the visual language stays consistent.
const parseSections = (text) => {
    if (!text) return [];
    const sections = [];
    let cur = null;
    text.split('\n').forEach((line) => {
        if (line.startsWith('## ')) {
            if (cur) sections.push(cur);
            cur = { title: line.replace('## ', ''), lines: [] };
        } else if (line.startsWith('# ')) {
            // skip h1
        } else if (cur) {
            cur.lines.push(line);
        } else {
            cur = { title: '', lines: [line] };
        }
    });
    if (cur) sections.push(cur);
    return sections;
};

const renderLines = (lines) =>
    lines.map((line, i) => {
        if (line.startsWith('- ') || line.startsWith('* ')) {
            const content = line.replace(/^[-*]\s/, '');
            return (
                <Box key={i} sx={{ display: 'flex', gap: 1, ml: 0.5, mb: 0.5 }}>
                    <Typography
                        sx={{
                            color: 'var(--d-accent, #2383E2)',
                            fontWeight: 700,
                            flexShrink: 0,
                            lineHeight: 1.7,
                        }}
                    >
                        &bull;
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: 'var(--d-text-2, #2A2927)', lineHeight: 1.7 }}
                        dangerouslySetInnerHTML={{
                            __html: content
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/\*(.*?)\*/g, '<em>$1</em>'),
                        }}
                    />
                </Box>
            );
        }
        if (line.trim() === '') return <Box key={i} sx={{ height: 6 }} />;
        return (
            <Typography
                key={i}
                variant="body2"
                sx={{ color: 'var(--d-text-2, #2A2927)', lineHeight: 1.7, mb: 0.3 }}
                dangerouslySetInnerHTML={{
                    __html: line
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>'),
                }}
            />
        );
    });

const STATUS_COLORS = {
    idle: { bg: 'var(--d-surface-muted, #F6F5F2)', text: 'var(--d-text-muted, #8A887E)' },
    pending: { bg: 'rgba(35,131,226,0.08)', text: 'var(--d-accent-text, #1F6FBF)' },
    done: { bg: 'rgba(34,197,94,0.10)', text: '#15803D' },
    error: { bg: 'rgba(220,38,38,0.10)', text: '#B91C1C' },
};

const orgLabel = (org) => {
    if (org === 'skillhub_training') return 'Skillhub · Training';
    if (org === 'skillhub_institute') return 'Skillhub · Institute';
    if (org === 'luc') return 'LUC';
    return org || '—';
};

// One card. Collapsed by default; expands to show the analysis markdown.
const BreakdownCard = ({ item, onRetry }) => {
    const [expanded, setExpanded] = useState(false);
    const status = item.status || 'idle';
    const paint = STATUS_COLORS[status] || STATUS_COLORS.idle;
    const sections = useMemo(() => parseSections(item.analysis), [item.analysis]);

    const title = item.consultantName || item.teamName || 'Unnamed';
    const subtitle = item.consultantName
        ? `${item.teamName || '—'} · ${orgLabel(item.organization)}`
        : orgLabel(item.organization);

    return (
        <Box
            sx={{
                backgroundColor: 'var(--d-surface, #FFFFFF)',
                border: '1px solid var(--d-border, #E6E3DC)',
                borderRadius: '14px',
                boxShadow: 'var(--d-shadow-card-sm)',
                overflow: 'hidden',
                transition: 'border-color 150ms ease',
                '&:hover': { borderColor: 'var(--d-border-strong, #D5D1C7)' },
            }}
        >
            <Box
                component="button"
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                sx={{
                    width: '100%',
                    border: 0,
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    px: 2,
                    py: 1.5,
                }}
            >
                <Box
                    sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '10px',
                        backgroundColor: 'var(--d-accent-bg, rgba(35,131,226,0.08))',
                        color: 'var(--d-accent-text, #1F6FBF)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    {item.consultantName ? (
                        <PersonIcon sx={{ fontSize: 20 }} />
                    ) : (
                        <TeamsIcon sx={{ fontSize: 20 }} />
                    )}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                        sx={{
                            fontWeight: 650,
                            fontSize: 14,
                            color: 'var(--d-text, #191918)',
                            letterSpacing: '-0.005em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {title}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: 11.5,
                            color: 'var(--d-text-muted, #8A887E)',
                            mt: 0.25,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {subtitle}
                    </Typography>
                </Box>
                <Chip
                    size="small"
                    label={
                        status === 'pending'
                            ? 'Analyzing…'
                            : status === 'done'
                            ? 'Ready'
                            : status === 'error'
                            ? 'Failed'
                            : 'Queued'
                    }
                    sx={{
                        backgroundColor: paint.bg,
                        color: paint.text,
                        fontSize: 10.5,
                        fontWeight: 600,
                        height: 22,
                        letterSpacing: '0.02em',
                    }}
                />
                {status === 'error' && onRetry && (
                    <Tooltip title={item.error || 'Retry'} arrow>
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRetry(item);
                            }}
                            sx={{ color: '#B91C1C' }}
                        >
                            <RefreshIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
                )}
                <ExpandMoreIcon
                    sx={{
                        color: 'var(--d-text-muted, #8A887E)',
                        transition: 'transform 180ms ease',
                        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                />
            </Box>

            {status === 'pending' && <LinearProgress sx={{ height: 2 }} />}

            {expanded && (
                <Box
                    sx={{
                        px: 2,
                        pb: 2,
                        pt: 0.5,
                        borderTop: '1px solid var(--d-border-soft, #ECE9E2)',
                        backgroundColor: 'var(--d-surface-muted, #FAFAF8)',
                    }}
                >
                    {status === 'idle' && (
                        <Typography
                            sx={{
                                color: 'var(--d-text-muted, #8A887E)',
                                fontSize: 13,
                                py: 2,
                            }}
                        >
                            Not analyzed yet. Click "Run deep breakdown" above.
                        </Typography>
                    )}
                    {status === 'pending' && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                py: 2,
                                color: 'var(--d-text-muted, #8A887E)',
                                fontSize: 13,
                            }}
                        >
                            <CircularProgress size={14} />
                            Generating analysis…
                        </Box>
                    )}
                    {status === 'error' && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 1,
                                py: 1.5,
                                color: '#B91C1C',
                                fontSize: 13,
                            }}
                        >
                            <ErrorIcon sx={{ fontSize: 16, mt: '2px' }} />
                            <Box>
                                <Box sx={{ fontWeight: 600 }}>Analysis failed</Box>
                                <Box
                                    sx={{
                                        color: 'var(--d-text-muted, #8A887E)',
                                        fontSize: 12,
                                        mt: 0.25,
                                    }}
                                >
                                    {item.error || 'Unknown error'}
                                </Box>
                            </Box>
                        </Box>
                    )}
                    {status === 'done' && sections.length > 0 && (
                        <Box sx={{ pt: 1.5 }}>
                            {sections.map((s, idx) => (
                                <Box key={idx} sx={{ mb: idx < sections.length - 1 ? 1.5 : 0 }}>
                                    {s.title && (
                                        <Typography
                                            sx={{
                                                fontSize: 12.5,
                                                fontWeight: 700,
                                                color: 'var(--d-text, #191918)',
                                                letterSpacing: '-0.005em',
                                                mb: 0.75,
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            {s.title}
                                        </Typography>
                                    )}
                                    {renderLines(s.lines)}
                                </Box>
                            ))}
                        </Box>
                    )}
                    {status === 'done' && sections.length === 0 && item.analysis && (
                        <Typography
                            sx={{ color: 'var(--d-text-muted, #8A887E)', fontSize: 13, py: 1.5 }}
                        >
                            {item.analysis}
                        </Typography>
                    )}
                </Box>
            )}
        </Box>
    );
};

// Fire `tasks` with at most `concurrency` in flight at once. Each task is a
// zero-arg function returning a Promise. Used to pace OpenAI calls so we
// don't trip rate limits when the window has ~50 targets.
const runConcurrent = async (tasks, concurrency = 4) => {
    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
        while (cursor < tasks.length) {
            const idx = cursor++;
            await tasks[idx]();
        }
    });
    await Promise.all(workers);
};

const AIDeepBreakdown = ({ startDate, endDate }) => {
    const [tab, setTab] = useState('teams');
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [teams, setTeams] = useState([]);
    const [consultants, setConsultants] = useState([]);

    // Full target catalogue (separate from what's in the grid). Pre-fetched
    // on date-range change so the "Run one team" / "Run one consultant"
    // Autocompletes are populated the moment the panel is visible —
    // no need to hit "Run all" first.
    const [targets, setTargets] = useState({ teams: [], consultants: [] });
    const [targetsLoading, setTargetsLoading] = useState(false);
    const [teamPick, setTeamPick] = useState(null);
    const [consultantPick, setConsultantPick] = useState(null);

    useEffect(() => {
        if (!startDate || !endDate) return;
        let cancelled = false;
        setTargetsLoading(true);
        (async () => {
            try {
                const res = await aiService.getAnalysisTargets(startDate, endDate);
                if (!cancelled && res?.success) {
                    setTargets({
                        teams: res.data?.teams || [],
                        consultants: res.data?.consultants || [],
                    });
                }
            } catch {
                /* swallow — "Run all" will surface a clearer error later */
            } finally {
                if (!cancelled) setTargetsLoading(false);
            }
        })();
        // Window changed → stale picks.
        setTeamPick(null);
        setConsultantPick(null);
        return () => {
            cancelled = true;
        };
    }, [startDate, endDate]);

    const totalTargets = teams.length + consultants.length;
    const doneCount =
        teams.filter((t) => t.status === 'done' || t.status === 'error').length +
        consultants.filter((c) => c.status === 'done' || c.status === 'error').length;

    // Upsert one team card into the grid and fire its analysis. New entries
    // land at the top of the list so the user sees targeted runs appear
    // without scrolling. Existing entries are replaced in place.
    const runOneTeam = useCallback(
        async (target) => {
            if (!target?.teamLeadId || !startDate || !endDate) return;
            setTeams((prev) => {
                const entry = {
                    ...target,
                    status: 'pending',
                    analysis: '',
                    error: '',
                };
                const idx = prev.findIndex(
                    (p) => p.teamLeadId === target.teamLeadId
                );
                if (idx >= 0) {
                    const cp = [...prev];
                    cp[idx] = entry;
                    return cp;
                }
                return [entry, ...prev];
            });
            try {
                const r = await aiService.generateTeamAnalysis({
                    startDate,
                    endDate,
                    teamLeadId: target.teamLeadId,
                });
                setTeams((prev) =>
                    prev.map((p) =>
                        p.teamLeadId === target.teamLeadId
                            ? { ...p, status: 'done', analysis: r.analysis || '' }
                            : p
                    )
                );
            } catch (err) {
                setTeams((prev) =>
                    prev.map((p) =>
                        p.teamLeadId === target.teamLeadId
                            ? {
                                  ...p,
                                  status: 'error',
                                  error:
                                      err?.response?.data?.message ||
                                      err?.message ||
                                      'Analysis failed',
                              }
                            : p
                    )
                );
            }
        },
        [startDate, endDate]
    );

    const runOneConsultant = useCallback(
        async (target) => {
            if (!target?.consultantName || !startDate || !endDate) return;
            const match = (p) =>
                p.consultantName === target.consultantName &&
                p.organization === target.organization;
            setConsultants((prev) => {
                const entry = {
                    ...target,
                    status: 'pending',
                    analysis: '',
                    error: '',
                };
                const idx = prev.findIndex(match);
                if (idx >= 0) {
                    const cp = [...prev];
                    cp[idx] = entry;
                    return cp;
                }
                return [entry, ...prev];
            });
            try {
                const r = await aiService.generateConsultantAnalysis({
                    startDate,
                    endDate,
                    consultantName: target.consultantName,
                    organization: target.organization,
                });
                setConsultants((prev) =>
                    prev.map((p) =>
                        match(p)
                            ? { ...p, status: 'done', analysis: r.analysis || '' }
                            : p
                    )
                );
            } catch (err) {
                setConsultants((prev) =>
                    prev.map((p) =>
                        match(p)
                            ? {
                                  ...p,
                                  status: 'error',
                                  error:
                                      err?.response?.data?.message ||
                                      err?.message ||
                                      'Analysis failed',
                              }
                            : p
                    )
                );
            }
        },
        [startDate, endDate]
    );

    // Kick off the full breakdown: every team + every consultant in the
    // window, fired in small parallel batches. Uses the already-fetched
    // target catalogue when available; falls back to re-fetching.
    const runAll = useCallback(async () => {
        if (!startDate || !endDate) return;
        setLoading(true);
        setLoadError('');
        try {
            let tgt = targets;
            if (!tgt.teams.length && !tgt.consultants.length) {
                const res = await aiService.getAnalysisTargets(startDate, endDate);
                if (!res?.success) {
                    setLoadError(res?.message || 'Failed to load analysis targets.');
                    setLoading(false);
                    return;
                }
                tgt = {
                    teams: res.data?.teams || [],
                    consultants: res.data?.consultants || [],
                };
                setTargets(tgt);
            }

            const nextTeams = tgt.teams.map((t) => ({
                ...t,
                status: 'pending',
                analysis: '',
                error: '',
            }));
            const nextConsultants = tgt.consultants.map((c) => ({
                ...c,
                status: 'pending',
                analysis: '',
                error: '',
            }));
            setTeams(nextTeams);
            setConsultants(nextConsultants);

            const teamTasks = nextTeams.map((t, i) => async () => {
                try {
                    const r = await aiService.generateTeamAnalysis({
                        startDate,
                        endDate,
                        teamLeadId: t.teamLeadId,
                    });
                    setTeams((prev) => {
                        const cp = [...prev];
                        cp[i] = { ...cp[i], status: 'done', analysis: r.analysis || '' };
                        return cp;
                    });
                } catch (err) {
                    setTeams((prev) => {
                        const cp = [...prev];
                        cp[i] = {
                            ...cp[i],
                            status: 'error',
                            error:
                                err?.response?.data?.message ||
                                err?.message ||
                                'Analysis failed',
                        };
                        return cp;
                    });
                }
            });
            const consultantTasks = nextConsultants.map((c, i) => async () => {
                try {
                    const r = await aiService.generateConsultantAnalysis({
                        startDate,
                        endDate,
                        consultantName: c.consultantName,
                        organization: c.organization,
                    });
                    setConsultants((prev) => {
                        const cp = [...prev];
                        cp[i] = { ...cp[i], status: 'done', analysis: r.analysis || '' };
                        return cp;
                    });
                } catch (err) {
                    setConsultants((prev) => {
                        const cp = [...prev];
                        cp[i] = {
                            ...cp[i],
                            status: 'error',
                            error:
                                err?.response?.data?.message ||
                                err?.message ||
                                'Analysis failed',
                        };
                        return cp;
                    });
                }
            });

            // Interleave so both lists fill in parallel instead of teams-
            // first-then-consultants.
            const interleaved = [];
            const max = Math.max(teamTasks.length, consultantTasks.length);
            for (let i = 0; i < max; i++) {
                if (i < teamTasks.length) interleaved.push(teamTasks[i]);
                if (i < consultantTasks.length) interleaved.push(consultantTasks[i]);
            }
            await runConcurrent(interleaved, 4);
        } catch (err) {
            setLoadError(
                err?.response?.data?.message || err?.message || 'Failed to run breakdown'
            );
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, targets]);

    const retryOne = useCallback(
        (item) => {
            if (item.consultantName) return runOneConsultant(item);
            if (item.teamLeadId) return runOneTeam(item);
            return Promise.resolve();
        },
        [runOneConsultant, runOneTeam]
    );

    const hasResults = totalTargets > 0;

    return (
        <Box
            sx={{
                mt: 4,
                borderTop: '1px solid var(--d-border, #E6E3DC)',
                pt: 3,
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 1.5,
                    mb: 1.5,
                }}
            >
                <Box>
                    <Typography
                        sx={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: 'var(--d-text, #191918)',
                            letterSpacing: '-0.01em',
                        }}
                    >
                        Deep breakdown
                    </Typography>
                    <Typography
                        sx={{ fontSize: 12.5, color: 'var(--d-text-muted, #8A887E)', mt: 0.25 }}
                    >
                        One AI card per team and per consultant for the selected window.
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    size="small"
                    startIcon={loading ? <CircularProgress size={14} /> : <RunIcon />}
                    onClick={runAll}
                    disabled={loading || !startDate || !endDate}
                    sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        borderRadius: '10px',
                        boxShadow: 'none',
                    }}
                >
                    {loading
                        ? `Analyzing ${doneCount}/${totalTargets}`
                        : hasResults
                        ? 'Re-run all'
                        : 'Run deep breakdown'}
                </Button>
            </Box>

            {/* Targeted runs — picking a value from either Autocomplete fires
                a single analysis and drops the result into the card grid
                below. Doesn't disturb any other in-flight or existing cards. */}
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1.5,
                    alignItems: 'center',
                    mb: 2,
                    p: 1.5,
                    borderRadius: '12px',
                    backgroundColor: 'var(--d-surface-muted, #FAFAF8)',
                    border: '1px dashed var(--d-border, #E6E3DC)',
                }}
            >
                <Typography
                    sx={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: 'var(--d-text-muted, #8A887E)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        flexShrink: 0,
                    }}
                >
                    Run one:
                </Typography>
                <Autocomplete
                    size="small"
                    options={targets.teams}
                    value={teamPick}
                    loading={targetsLoading}
                    onChange={(_e, value) => {
                        setTeamPick(null);
                        if (value) runOneTeam(value);
                    }}
                    getOptionLabel={(opt) =>
                        `${opt.teamName} · ${orgLabel(opt.organization)}`
                    }
                    isOptionEqualToValue={(a, b) => a.teamLeadId === b?.teamLeadId}
                    noOptionsText="No teams in this window"
                    disabled={!startDate || !endDate}
                    sx={{ minWidth: 260, flex: '1 1 260px' }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            placeholder="Pick a team…"
                            InputProps={{
                                ...params.InputProps,
                                startAdornment: (
                                    <>
                                        <TeamsIcon
                                            sx={{
                                                fontSize: 16,
                                                color: 'var(--d-text-muted, #8A887E)',
                                                ml: 0.5,
                                                mr: 0.5,
                                            }}
                                        />
                                        {params.InputProps.startAdornment}
                                    </>
                                ),
                                sx: {
                                    fontSize: 13,
                                    borderRadius: '10px',
                                    backgroundColor: 'var(--d-surface, #FFFFFF)',
                                },
                            }}
                        />
                    )}
                />
                <Autocomplete
                    size="small"
                    options={targets.consultants}
                    value={consultantPick}
                    loading={targetsLoading}
                    onChange={(_e, value) => {
                        setConsultantPick(null);
                        if (value) runOneConsultant(value);
                    }}
                    getOptionLabel={(opt) =>
                        `${opt.consultantName} · ${opt.teamName || '—'} · ${orgLabel(opt.organization)}`
                    }
                    isOptionEqualToValue={(a, b) =>
                        a.consultantName === b?.consultantName &&
                        a.organization === b?.organization
                    }
                    noOptionsText="No consultants in this window"
                    disabled={!startDate || !endDate}
                    sx={{ minWidth: 280, flex: '1 1 300px' }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            placeholder="Pick a consultant…"
                            InputProps={{
                                ...params.InputProps,
                                startAdornment: (
                                    <>
                                        <PersonIcon
                                            sx={{
                                                fontSize: 16,
                                                color: 'var(--d-text-muted, #8A887E)',
                                                ml: 0.5,
                                                mr: 0.5,
                                            }}
                                        />
                                        {params.InputProps.startAdornment}
                                    </>
                                ),
                                sx: {
                                    fontSize: 13,
                                    borderRadius: '10px',
                                    backgroundColor: 'var(--d-surface, #FFFFFF)',
                                },
                            }}
                        />
                    )}
                />
            </Box>

            {loadError && (
                <Box
                    sx={{
                        p: 1.25,
                        borderRadius: '10px',
                        backgroundColor: 'rgba(220,38,38,0.08)',
                        color: '#B91C1C',
                        fontSize: 13,
                        mb: 1.5,
                    }}
                >
                    {loadError}
                </Box>
            )}

            {hasResults && (
                <>
                    <Tabs
                        value={tab}
                        onChange={(_e, v) => setTab(v)}
                        sx={{
                            minHeight: 36,
                            mb: 2,
                            '& .MuiTab-root': {
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: 13,
                                minHeight: 36,
                                py: 0.75,
                            },
                            '& .MuiTabs-indicator': {
                                backgroundColor: 'var(--d-accent, #2383E2)',
                            },
                        }}
                    >
                        <Tab
                            value="teams"
                            label={`Teams (${teams.length})`}
                            icon={<TeamsIcon sx={{ fontSize: 16 }} />}
                            iconPosition="start"
                        />
                        <Tab
                            value="consultants"
                            label={`Consultants (${consultants.length})`}
                            icon={<PersonIcon sx={{ fontSize: 16 }} />}
                            iconPosition="start"
                        />
                    </Tabs>

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: '1fr',
                                sm: 'repeat(2, 1fr)',
                                lg: 'repeat(3, 1fr)',
                            },
                            gap: 1.5,
                        }}
                    >
                        {(tab === 'teams' ? teams : consultants).map((item, idx) => (
                            <BreakdownCard
                                key={
                                    tab === 'teams'
                                        ? item.teamLeadId
                                        : `${item.consultantName}__${item.organization}`
                                }
                                item={item}
                                onRetry={retryOne}
                            />
                        ))}
                    </Box>
                </>
            )}

            {!loading && !hasResults && !loadError && (
                <Box
                    sx={{
                        p: 3,
                        borderRadius: '14px',
                        border: '1px dashed var(--d-border, #E6E3DC)',
                        textAlign: 'center',
                        color: 'var(--d-text-muted, #8A887E)',
                        fontSize: 13,
                    }}
                >
                    Click <strong>Run deep breakdown</strong> for everything, or pick a
                    single team or consultant above to analyze just that one.
                </Box>
            )}
        </Box>
    );
};

export default AIDeepBreakdown;
