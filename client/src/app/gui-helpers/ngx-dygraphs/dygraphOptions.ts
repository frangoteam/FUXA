export interface DygraphOptions {
    /**
     * Set this option to animate the transition between zoom windows. Applies to programmatic
     * and interactive zooms. Note that if you also set a drawCallback, it will be called several
     * times on each zoom. If you set a zoomCallback, it will only be called after the animation
     * is complete.
     */
    animatedZooms?: boolean;

    /**
     * Defines per-axis options. Valid keys are 'x', 'y' and 'y2'. Only some options may be set
     * on a per-axis basis. If an option may be set in this way, it will be noted on this page.
     * See also documentation on <a href='http://dygraphs.com/per-axis.html'>per-series and
     * per-axis options</a>.
     */
    axes?: any;

    /**
     * Should the area underneath the graph be filled? This option is not compatible with error bars.
     */
    fillGraph?: boolean;

    /**
     * Height, in pixels, of the chart. If the container div has been explicitly sized, this will
     * be ignored.
     */
    height?: number;

    /**
     * A name for each data series, including the independent (X) series. For CSV files and
     * DataTable objections, this is determined by context. For raw data, this must be specified.
     * If it is not, default values are supplied and a warning is logged.
     */
    labels?: string[];

    /**
     * Define Line Colors
     */
    colors?: string[];

    /**
     * When to display the legend. By default ("onmouseover"), it only appears when a user mouses over the chart.
     * Set it to "always" to always display a legend of some sort.
     * When set to "follow", legend follows highlighted points.
     */
    legend?: string;

    /**
     * A function (or array of functions) which plot each data series on the chart.
     */
    plotter?: Function | Function[];

    /**
     * The size of the dot to draw on each point in pixels (see drawPoints). A dot is always
     * drawn when a point is "isolated", i.e. there is a missing point on either side of it. This
     * also controls the size of those dots.
     */
    pointSize?: number;

    /**
     * Text to display above the chart. You can supply any HTML for this value, not just text. If
     * you wish to style it using CSS, use the 'dygraph-label' or 'dygraph-title' classes.
     */
    title?: string;

    /**
     * Which series should initially be visible? Once the Dygraph has been constructed, you can
     * access and modify the visibility of each series using the <code>visibility</code> and
     * <code>setVisibility</code> methods.
     */
    visibility?: boolean[];

    /**
     * Width, in pixels, of the chart. If the container div has been explicitly sized, this will
     * be ignored.
     */
    width?: number;

    /**
     * Text to display below the chart's x-axis. You can supply any HTML for this value, not just
     * text. If you wish to style it using CSS, use the 'dygraph-label' or 'dygraph-xlabel'
     * classes.
     */
    xlabel?: string;

    /**
     * Text to display to the left of the chart's y-axis. You can supply any HTML for this value,
     * not just text. If you wish to style it using CSS, use the 'dygraph-label' or
     * 'dygraph-ylabel' classes. The text will be rotated 90 degrees by default, so CSS rules may
     * behave in unintuitive ways. No additional space is set aside for a y-axis label. If you
     * need more space, increase the width of the y-axis tick labels using the yAxisLabelWidth
     * option. If you need a wider div for the y-axis label, either style it that way with CSS
     * (but remember that it's rotated, so width is controlled by the 'height' property) or set
     * the yLabelWidth option.
     */
    ylabel?: string;

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