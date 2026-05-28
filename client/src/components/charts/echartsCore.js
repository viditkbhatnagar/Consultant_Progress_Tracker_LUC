// Tree-shaken Apache ECharts registration. Importing from echarts/core +
// registering only the pieces we use keeps the CRA bundle far smaller than
// pulling all of `echarts`. Every chart in the app goes through the EChart
// wrapper, which imports this module — so this is the single registration
// point. If a new chart needs a series/component not listed here, add it
// here (otherwise it renders blank with a console warning).

import * as echarts from 'echarts/core';
import { PieChart, BarChart, LineChart } from 'echarts/charts';
import {
    GridComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
    GraphicComponent,
    DatasetComponent,
    MarkLineComponent,
} from 'echarts/components';
import { LabelLayout, UniversalTransition } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
    PieChart,
    BarChart,
    LineChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
    GraphicComponent,
    DatasetComponent,
    MarkLineComponent,
    LabelLayout,
    UniversalTransition,
    CanvasRenderer,
]);

export default echarts;
