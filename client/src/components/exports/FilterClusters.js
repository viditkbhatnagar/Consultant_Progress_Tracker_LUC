import React from 'react';
import { Box, Stack, Button, Typography, Chip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

import SearchableMultiSelect from './SearchableMultiSelect';

// Cluster rules per dataset variant. Keyed `<dataset>::<orgScope>` (or
// `<dataset>::*` to apply across all org scopes for that dataset).
// Anything not listed → falls into the implicit "Other" cluster (rendered
// after Who, hidden behind Show more). Datasets with ≤6 dims fall back to
// a flat single-row layout (no clusters).
const CLUSTERS_BY_DATASET = {
    'students::luc': {
        who:          ['source', 'consultantName', 'teamLeadName', 'teamName'],
        what:         ['university', 'program', 'campaignName', 'openDay', 'openDayLocation', 'referredBy'],
        demographics: ['gender', 'nationality', 'region'],
        when:         ['month', 'conversionBucket', 'closingDateMonth', 'closingDateQuarter'],
    },
    'students::skillhub_training': {
        who:          ['consultantName', 'organization'],
        what:         ['curriculum', 'curriculumSlug', 'yearOrGrade', 'academicYear', 'mode', 'courseDuration', 'school'],
        demographics: ['gender', 'addressEmirate'],
        status:       ['leadSource', 'studentStatus'],
    },
    'students::skillhub_institute': {
        who:          ['consultantName', 'organization'],
        what:         ['curriculum', 'curriculumSlug', 'yearOrGrade', 'academicYear', 'mode', 'courseDuration', 'school'],
        demographics: ['gender', 'addressEmirate'],
        status:       ['leadSource', 'studentStatus'],
    },
    'students::all': {
        who:          ['consultantName', 'organization'],
        demographics: ['gender'],
    },
    'commitments::*': {
        who:          ['teamName', 'teamLeadName', 'consultantName'],
        what:         ['status', 'leadStage', 'admissionClosed'],
        when:         ['dayCommitted', 'weekStartDateWeek', 'weekStartDateMonth'],
    },
    // meetings + hourly intentionally absent → flat fallback (≤6 dims).
};

const CLUSTER_ORDER = ['who', 'what', 'demographics', 'when', 'status', 'other'];
const CLUSTER_LABELS = {
    who:          'Who',
    what:         'What',
    demographics: 'Demographics',
    when:         'When',
    status:       'Status',
    other:        'Other',
};

const FLAT_FALLBACK_THRESHOLD = 6;

function lookupClusterMap(dataset, orgScope) {
    return (
        CLUSTERS_BY_DATASET[`${dataset}::${orgScope}`]
        || CLUSTERS_BY_DATASET[`${dataset}::*`]
        || null
    );
}

// Partition a dimension array against the cluster map. Returns
// { clusters: { who: [...], what: [...], ... }, isFlat: boolean }.
// "Other" catches any dim not assigned to a cluster.
function partitionDims(dataset, orgScope, dimensions) {
    const map = lookupClusterMap(dataset, orgScope);
    if (!map || dimensions.length <= FLAT_FALLBACK_THRESHOLD) {
        return { clusters: { all: dimensions }, isFlat: true };
    }
    const dimByKey = new Map(dimensions.map((d) => [d.key, d]));
    const clusters = {};
    const assigned = new Set();
    for (const clusterKey of CLUSTER_ORDER) {
        const keys = map[clusterKey];
        if (!Array.isArray(keys)) continue;
        const list = keys.map((k) => dimByKey.get(k)).filter(Boolean);
        if (list.length > 0) clusters[clusterKey] = list;
        for (const k of keys) assigned.add(k);
    }
    const other = dimensions.filter((d) => !assigned.has(d.key));
    if (other.length > 0) clusters.other = other;
    return { clusters, isFlat: false };
}

const FilterClusters = ({
    dataset,
    organization,
    dimensions = [],
    value = {},
    onChange,
}) => {
    const [showMore, setShowMore] = React.useState(false);

    const { clusters, isFlat } = React.useMemo(
        () => partitionDims(dataset, organization, dimensions),
        [dataset, organization, dimensions]
    );

    const handleDimChange = (dimKey) => (vals) => {
        onChange?.({ ...value, [dimKey]: vals && vals.length ? vals : undefined });
    };

    const renderDimRow = (dims) => (
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {dims.map((dim) => (
                <SearchableMultiSelect
                    key={dim.key}
                    label={dim.lbl}
                    options={dim.values || []}
                    value={value[dim.key] || []}
                    onChange={handleDimChange(dim.key)}
                    sx={{ width: 220 }}
                />
            ))}
        </Stack>
    );

    if (dimensions.length === 0) return null;

    if (isFlat) {
        return (
            <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Filters</Typography>
                {renderDimRow(clusters.all || [])}
            </Box>
        );
    }

    // Count active filters in the clusters that will be hidden by default
    // so the Show more button can advertise them.
    const hiddenClusterKeys = CLUSTER_ORDER.filter((k) => k !== 'who' && clusters[k]);
    const hiddenActiveCount = hiddenClusterKeys.reduce((sum, ck) => {
        const dims = clusters[ck] || [];
        return sum + dims.reduce((n, d) => (value[d.key]?.length ? n + 1 : n), 0);
    }, 0);

    const whoDims = clusters.who || [];

    return (
        <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Filters</Typography>

            {whoDims.length > 0 && (
                <Box sx={{ mb: 1 }}>
                    <Typography
                        variant="overline"
                        sx={{ color: 'var(--d-text-muted, text.secondary)', letterSpacing: 1, fontWeight: 600 }}
                    >
                        {CLUSTER_LABELS.who}
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>{renderDimRow(whoDims)}</Box>
                </Box>
            )}

            {hiddenClusterKeys.length > 0 && (
                <Box sx={{ mt: 1 }}>
                    <Button
                        size="small"
                        onClick={() => setShowMore((v) => !v)}
                        endIcon={showMore ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        sx={{ textTransform: 'none', color: 'var(--d-text-2, text.primary)' }}
                    >
                        {showMore ? 'Show fewer filters' : 'Show more filters'}
                    </Button>
                    {!showMore && hiddenActiveCount > 0 && (
                        <Chip
                            size="small"
                            label={`${hiddenActiveCount} active`}
                            sx={{ ml: 1, bgcolor: 'var(--d-accent-bg)', color: 'var(--d-accent-text)' }}
                        />
                    )}
                </Box>
            )}

            {showMore && (
                <Stack spacing={2} sx={{ mt: 2 }}>
                    {hiddenClusterKeys.map((ck) => (
                        <Box key={ck}>
                            <Typography
                                variant="overline"
                                sx={{ color: 'var(--d-text-muted, text.secondary)', letterSpacing: 1, fontWeight: 600 }}
                            >
                                {CLUSTER_LABELS[ck]}
                            </Typography>
                            <Box sx={{ mt: 0.5 }}>{renderDimRow(clusters[ck])}</Box>
                        </Box>
                    ))}
                </Stack>
            )}
        </Box>
    );
};

export default FilterClusters;
