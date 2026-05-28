// Thin ECharts `option` builders so call sites stay 1–3 lines. Each
// returns a plain option object that <EChart> merges its themed defaults
// underneath. Colors default to the chart palette but can be overridden
// per series.

// Donut / pie.
//   donutOption({ data: [{name, value, color?}], radius, showLabel, centerText })
export function donutOption({
    data = [],
    radius = ['52%', '72%'],
    showLabel = false,
    labelFormatter = '{b} ({d}%)',
    centerText,
} = {}) {
    const series = [{
        type: 'pie',
        radius,
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        label: showLabel
            ? { show: true, position: 'outside', formatter: labelFormatter }
            : { show: false },
        labelLine: { show: !!showLabel },
        emphasis: { label: { show: true, fontWeight: 'bold' } },
        data: data.map((d) => (d.color ? { name: d.name, value: d.value, itemStyle: { color: d.color } } : d)),
    }];
    const option = { tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' }, series };
    if (centerText) {
        option.graphic = {
            type: 'text',
            left: 'center',
            top: 'center',
            style: { text: centerText, textAlign: 'center', fontSize: 22, fontWeight: 700, fill: '#191918' },
        };
    }
    return option;
}

// Bar (vertical or horizontal, optional grouped/stacked + dual Y axis).
//   barOption({ categories, series:[{name,data,color,yAxisIndex?}], horizontal, stacked, yAxes, rotateLabels })
export function barOption({
    categories = [],
    series = [],
    horizontal = false,
    stacked = false,
    yAxes,
    rotateLabels = 0,
    valueFormatter,
} = {}) {
    const catAxis = {
        type: 'category',
        data: categories,
        axisLabel: { rotate: rotateLabels, interval: 0, hideOverlap: true },
        axisTick: { alignWithLabel: true },
    };
    const valAxis = (extra = {}) => ({
        type: 'value',
        axisLabel: valueFormatter ? { formatter: valueFormatter } : {},
        splitLine: { lineStyle: { type: 'dashed' } },
        ...extra,
    });

    const option = {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: series.length > 1 ? {} : { show: false },
        series: series.map((s) => ({
            type: 'bar',
            name: s.name,
            data: s.data,
            yAxisIndex: s.yAxisIndex || 0,
            stack: stacked ? 'total' : undefined,
            itemStyle: s.color ? { color: s.color, borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] } : { borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
            barMaxWidth: 38,
        })),
    };

    if (horizontal) {
        option.xAxis = valAxis();
        option.yAxis = { ...catAxis, inverse: true };
    } else {
        option.xAxis = catAxis;
        option.yAxis = yAxes && yAxes.length
            ? yAxes.map((y, i) => valAxis(i === 1 ? { position: 'right', ...y } : y))
            : valAxis();
    }
    return option;
}

// Multi-line trend.
//   lineOption({ categories, series:[{name,data,color,smooth?,yAxisIndex?,symbolSize?}], yAxes, valueFormatter })
export function lineOption({
    categories = [],
    series = [],
    yAxes,
    valueFormatter,
} = {}) {
    const valAxis = (extra = {}) => ({
        type: 'value',
        axisLabel: valueFormatter ? { formatter: valueFormatter } : {},
        splitLine: { lineStyle: { type: 'dashed' } },
        ...extra,
    });
    return {
        tooltip: { trigger: 'axis' },
        legend: series.length > 1 ? {} : { show: false },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: categories,
            axisLabel: { hideOverlap: true },
        },
        yAxis: yAxes && yAxes.length
            ? yAxes.map((y, i) => valAxis(i === 1 ? { position: 'right', ...y } : y))
            : valAxis(),
        series: series.map((s) => ({
            type: 'line',
            name: s.name,
            data: s.data,
            smooth: s.smooth !== false,
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
