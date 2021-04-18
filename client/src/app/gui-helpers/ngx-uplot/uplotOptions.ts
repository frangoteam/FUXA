
// export type AlignedData = [
// 	number[],
// 	(number | null)[][]
// ]

// export type LocalDateFromUnix = (ts: number) => Date;

// export type DateFormatterFactory = (tpl: string) => (date: Date) => string;

// export const enum DrawOrderKey {
// 	Axes   = 'axes',
// 	Series = 'series',
// }

// export namespace Scale {
// 	export type Auto = boolean | ((self: any /*uPlot*/, resetScales: boolean) => boolean);

// 	export type Range = Range.MinMax | Range.Function | Range.Config;

// 	export const enum Distr {
// 		Linear      = 1,
// 		Ordinal     = 2,
// 		Logarithmic = 3,
// 		ArcSinh     = 4,
// 	}

// 	export type LogBase = 10 | 2;

// 	export type Clamp = number | ((self: any /*uPlot*/, val: number, scaleMin: number, scaleMax: number, scaleKey: string) => number);
// }

// export namespace Range {
// 	export type MinMax = [number, number];

// 	export type Function = (self: any /*uPlot*/, initMin: number, initMax: number, scaleKey: string) => MinMax;

// 	export type SoftMode = 0 | 1 | 2 | 3;

// 	export interface Limit {
// 		/** initial multiplier for dataMax-dataMin delta */
// 		pad?: number; // 0.1

// 		/** soft limit */
// 		soft?: number; // 0

// 		/** soft limit active if... 0: never, 1: data <= limit, 2: data + padding <= limit, 3: data <= limit <= data + padding */
// 		mode?: SoftMode; // 3

// 		/** hard limit */
// 		hard?: number;
// 	}

// 	export interface Config {
// 		min: Range.Limit;
// 		max: Range.Limit;
// 	}
// }
export namespace Axis {
	export const enum Side {
		Top    = 0,
		Right  = 1,
		Bottom = 2,
		Left   = 3,
	}
	export interface Grid {
		/** on/off */
		show?: boolean; // true

		/** can filter which splits render lines. e.g splits.map(v => v % 2 == 0 ? v : null) */
		// filter?: Filter;

		/** line color */
		stroke?: any;//Stroke;

		/** line width in CSS pixels */
		width?: number;

		/** line dash segment array */
		dash?: number[];

		/** line cap */
		cap?: any;//Series.Cap;
	}

	export interface Ticks extends Grid {
		/** length of tick in CSS pixels */
		size?: number;
	}
}

export interface Axis {
	/** axis on/off */
	// show?: boolean;

	/** scale key */
	// scale?: string;

	/** side of chart - 0: top, 1: rgt, 2: btm, 3: lft */
	side?: Axis.Side;

	/** height of x axis or width of y axis in CSS pixels alloted for values, gap & ticks, but excluding axis label */
	// size?: Axis.Size;

	/** gap between axis values and axis baseline (or ticks, if enabled) in CSS pixels */
	// gap?: number;

	/** font used for axis values */
	font?: CanvasRenderingContext2D['font'];

	/** color of axis label & values */
	stroke?: any;//Axis.Stroke;

	/** axis label text */
	label?: string;

	/** height of x axis label or width of y axis label in CSS pixels */
	labelSize?: number;

	/** font used for axis label */
	labelFont?: CanvasRenderingContext2D['font'];

	/** minimum grid & tick spacing in CSS pixels */
	// space?: Axis.Space;

	/** available divisors for axis ticks, values, grid */
	// incrs?: Axis.Incrs;

	/** determines how and where the axis must be split for placing ticks, values, grid */
	// splits?: Axis.Splits;

	/** can filter which splits are passed to axis.values() for rendering. e.g splits.map(v => v % 2 == 0 ? v : null) */
	// filter?: Axis.Filter;

	/** formats values for rendering */
	// values?: Axis.Values;

	/** values rotation in degrees off horizontal (only bottom axes w/ side: 2) */
	// rotate?: Axis.Rotate;

	/** text alignment of axis values - 1: left, 2: right */
	// align?: Axis.Align;

	/** gridlines to draw from this axis' splits */
	grid?: Axis.Grid;

	/** ticks to draw from this axis' splits */
	ticks?: Axis.Ticks;
}

export interface Serie {
// 	/** series on/off. when off, it will not affect its scale */
// 	show?: boolean;

// 	/** className to add to legend parts and cursor hover points */
// 	class?: string;

// 	/** scale key */
// 	scale?: string;

// 	/** whether this series' data is scanned during auto-ranging of its scale */
// 	auto?: boolean; // true

// 	/** if & how the data is pre-sorted (scale.auto optimization) */
// 	sorted?: any; //Series.Sorted;

// 	/** when true, null data values will not cause line breaks */
	spanGaps?: boolean;

// 	/** whether path and point drawing should offset canvas to try drawing crisp lines */
// 	pxAlign?: boolean; // true

// 	/** legend label */
	label?: string;

// 	/** inline-legend value formatter. can be an fmtDate formatting string when scale.time: true */
// 	value?: any; //Series.Value;

// 	/** table-legend multi-values formatter */
// 	values?: any; //Series.Values;

// 	paths?: any; //Series.PathBuilder;

// 	/** rendered datapoints */
// 	points?: any; //Series.Points;

// 	/** line width in CSS pixels */
// 	width?: number;

// 	/** line & legend color */
	stroke?: any; //Series.Stroke;

// 	/** area fill & legend color */
// 	fill?: Series.Fill;

// 	/** area fill baseline (default: 0) */
// 	fillTo?: Series.FillTo;

// 	/** line dash segment array */
// 	dash?: number[];

// 	/** line cap */
// 	cap?: Series.Cap;

// 	/** alpha-transparancy */
// 	alpha?: number;

// 	/** current min and max data indices rendered */
// 	idxs?: Series.MinMaxIdxs;

// 	/** current min rendered value */
// 	min?: number;

// 	/** current max rendered value */
// 	max?: number;
}

export interface UplotOptions {
	/** chart title */
	title?: string;

	/** id to set on chart div */
	id?: string;

	/** className to add to chart div */
	class?: string;

	/** width of plotting area + axes in CSS pixels */
	width: number;

	/** height of plotting area + axes in CSS pixels (excludes title & legend height) */
	height: number;

	/** data for chart, if none is provided as argument to constructor */
	data?: any; //AlignedData;

	/** converts a unix timestamp to Date that's time-adjusted for the desired timezone */
	tzDate?: any; //LocalDateFromUnix;

	/** creates an efficient formatter for Date objects from a template string, e.g. {YYYY}-{MM}-{DD} */
	fmtDate?: any; //DateFormatterFactory;

	/** timestamp multiplier that yields 1 millisecond */
	ms?: 1e-3 | 1; // 1e-3

	/** drawing order for axes/grid & series (default: ["axes", "series"]) */
	drawOrder?: any; //DrawOrderKey[];

	/** whether vt & hz lines of series/grid/ticks should be crisp/sharp or sub-px antialiased */
	pxAlign?: boolean | number; // true

	series: any; //Series[];

	bands?: any; //Band[];

	scales?: any; //Scales;

	axes?: Axis[];

	/** padding per side, in CSS pixels (can prevent cross-axis labels at the plotting area limits from being chopped off) */
	padding?: any; //Padding;

	select?: any; //Select;

    legend?: any; //Legend;

	cursor?: any; //Cursor;

	focus?: any; //Focus;

	hooks?: any; //Hooks.Arrays;

	plugins?: any; //Plugin[];

    connectSeparatedPoints?: boolean;
    labelsSeparateLines?: boolean;
    titleHeight?: number;
    axisLabelFontSize?: number;
    axisLabelWidth?: number;
    labelsDivWidth?: number;
    axisLineColor?: string;
    axisLabelColor?: string;
    gridLineColor?: string;

    fontFamily?: string;
    legendFontSize?: number;
    colorBackground?: string;
    legendBackground?: string;
}