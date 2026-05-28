// Thin ECharts `option` builders. Each fully specifies its own legend +
// grid so nothing overlaps (the wrapper no longer injects a legend).
// NOTE: colors passed here must be real hex/rgb — ECharts canvas cannot
// resolve CSS `var(--x)` strings.

const LEGEND_TEXT = { fontSize: 11 };

// Donut / pie. Legend sits at the bottom (scrollable) so it never covers
// the ring or the centre total. The ring is nudged up to make room.
//   donutOption({ data:[{name,value,color?}], radius, showLabel, centerText })
export function donutOption({
    data = [],
    radius = ['52%', '70%'],
    showLabel = false,
    labelFormatter = '{b} ({d}%)',
    centerText,
} = {}) {
    const series = [{
        type: 'pie',
        radius,
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        label: showLabel
            ? { show: true, position: 'outside', formatter: labelFormatter, fontSize: 11 }
            : { show: false },
        labelLine: { show: !!showLabel, length: 8, length2: 8 },
        emphasis: { label: { show: true, fontWeight: 'bold' } },
        data: data.map((d) => (d.color ? { name: d.name, value: d.value, itemStyle: { color: d.color } } : d)),
    }];
    const option = {
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: {
            type: 'scroll',
            orient: 'horizontal',
            bottom: 0,
            left: 'center',
            itemWidth: 12,
            itemHeight: 12,
            textStyle: LEGEND_TEXT,
        },
        series,
    };
    if (centerText) {
        option.graphic = {
            type: 'text',
            left: 'center',
            top: '40%',
            style: { text: centerText, textAlign: 'center', fontSize: 22, fontWeight: 700, fill: '#191918' },
            z: 1,
        };
    }
    return option;
}

// Bar (vertical or horizontal, optional grouped/stacked + dual Y axis).
//   barOption({ categories, series:[{name,data,color,yAxisIndex?}], horizontal, stacked, yAxes, rotateLabels, valueFormatter })
export function barOption({
    categories = [],
    series = [],
    horizontal = false,
    stacked = false,
    yAxes,
    rotateLabels = 0,
    valueFormatter,
    barLabelFormatter = '{c}',
} = {}) {
    const multi = series.length > 1;
    const valAxis = (extra = {}) => ({
        type: 'value',
        splitNumber: 4,
        axisLabel: { fontSize: 10, ...(valueFormatter ? { formatter: valueFormatter } : {}) },
        splitLine: { lineStyle: { type: 'dashed' } },
        ...extra,
    });
    const catAxis = {
        type: 'category',
        data: categories,
        axisLabel: { rotate: rotateLabels, interval: 0, hideOverlap: true, fontSize: 11 },
        axisTick: { alignWithLabel: true },
    };

    const option = {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: multi ? { type: 'scroll', top: 0, itemWidth: 12, itemHeight: 12, textStyle: LEGEND_TEXT } : { show: false },
        series: series.map((s) => ({
            type: 'bar',
            name: s.name,
            data: s.data,
            yAxisIndex: s.yAxisIndex || 0,
            stack: stacked ? 'total' : undefined,
            itemStyle: {
                ...(s.color ? { color: s.color } : {}),
                borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
            },
            // For single-series horizontal (ranking) bars, print the value at
            // the bar end and drop the value axis — avoids the cramped,
            // overlapping axis labels in narrow cards.
            label: horizontal && !multi
                ? { show: true, position: 'right', formatter: barLabelFormatter, fontSize: 11, fontWeight: 600 }
                : undefined,
            barMaxWidth: 36,
        })),
    };

    if (horizontal) {
        option.grid = { top: multi ? 32 : 8, right: 44, bottom: 8, left: 8, containLabel: true };
        option.xAxis = multi
            ? valAxis()
            : { type: 'value', axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, max: (v) => v.max * 1.15 };
        option.yAxis = { ...catAxis, inverse: true, axisLabel: { fontSize: 11, interval: 0 } };
    } else {
        // Leave headroom for the legend (when multi) and the rotated labels.
        option.grid = {
            top: multi ? 34 : 12,
            right: 14,
            bottom: rotateLabels ? 64 : 24,
            left: 8,
            containLabel: true,
        };
        option.xAxis = { ...catAxis, axisLabel: { ...catAxis.axisLabel, rotate: rotateLabels, fontSize: 10, margin: 10 } };
        option.yAxis = yAxes && yAxes.length
            ? yAxes.map((y, i) => valAxis(i === 1 ? { position: 'right', ...y } : y))
            : valAxis();
    }
    return option;
}

// Multi-line trend. Single series → no legend; multi → top scroll legend.
//   lineOption({ categories, series:[{name,data,color,smooth?,yAxisIndex?,symbolSize?}], yAxes, valueFormatter })
export function lineOption({
    categories = [],
    series = [],
    yAxes,
    valueFormatter,
} = {}) {
    const multi = series.length > 1;
    const valAxis = (extra = {}) => ({
        type: 'value',
        splitNumber: 4,
        axisLabel: { fontSize: 10, ...(valueFormatter ? { formatter: valueFormatter } : {}) },
        splitLine: { lineStyle: { type: 'dashed' } },
        ...extra,
    });
    return {
        tooltip: { trigger: 'axis' },
        legend: multi ? { type: 'scroll', top: 0, itemWidth: 12, itemHeight: 12, textStyle: LEGEND_TEXT } : { show: false },
        grid: { top: multi ? 34 : 12, right: 16, bottom: 24, left: 8, containLabel: true },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: categories,
            axisLabel: { hideOverlap: true, fontSize: 11 },
        },
        yAxis: yAxes && yAxes.length
            ? yAxes.map((y, i) => valAxis(i === 1 ? { position: 'right', ...y } : y))
            : valAxis(),
        series: series.map((s) => ({
            type: 'line',
            name: s.name,
            data: s.data,
            smooth: s.smooth || false,
            connectNulls: false,
            yAxisIndex: s.yAxisIndex || 0,
            symbol: 'circle',
            symbolSize: s.symbolSize || 6,
            lineStyle: s.color ? { color: s.color, width: 2 } : { width: 2 },
            itemStyle: s.color ? { color: s.color } : undefined,
        })),
    };
}

// Common value-axis formatters.
export const currencyFmt = (v) => `AED ${Number(v).toLocaleString('en-US')}`;
export const percentFmt = (v) => `${v}%`;
export const compactCurrencyFmt = (v) => {
    const n = Number(v);
    if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
    return String(n);
};
