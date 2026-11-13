import { ChartState } from '../../_models/chart';

export interface StateInterval {
    from: number;
    to: number;
    state: ChartState;
}

/**
 * Trim aligned samples while retaining the state active at the new left boundary.
 * Numeric series keep their gaps; only categorical series carry a previous value.
 */
export function trimStateData(data: number[][], min: number, stateIndices: number[]): void {
    let removed = 0;
    const previous = new Map<number, number>();
    while (removed < data[0].length && data[0][removed] < min) {
        for (const index of stateIndices) {
            if (data[index][removed] != null) {
                previous.set(index, data[index][removed]);
            }
        }
        removed++;
    }
    if (!removed) {
        return;
    }
    data.forEach(values => values.splice(0, removed));
    // Keep an anchor at the window boundary; numeric series must not be forward-filled.
    if (previous.size && data[0].length && data[0][0] > min) {
        data.forEach((values, index) => values.unshift(index === 0 ? min : null));
    }
    if (data[0].length) {
        previous.forEach((value, index) => {
            if (data[index][0] == null) {
                data[index][0] = value;
            }
        });
    }
}

/** Encode categorical values for uPlot without exposing them to numeric axes. */
export class StateTimeline {
    private values: ChartState[] = [];
    private codes = new Map<string, number>();

    constructor(public label: string, private states: ChartState[], private color: string) { }

    encode(value: unknown): number {
        if (value === undefined) {
            return null; // No sample at this timestamp in an aligned series.
        }
        if (value === null || (typeof value === 'number' && !Number.isFinite(value))) {
            return NaN; // An explicit missing value ends the previous state.
        }
        const key = String(value);
        if (!this.codes.has(key)) {
            this.codes.set(key, this.values.length);
            this.values.push(this.states.find(state => String(state.value) === key) || {
                value: key, label: key, color: this.color || '#808080'
            });
        }
        return this.codes.get(key);
    }

    reset(): void {
        this.values = [];
        this.codes.clear();
    }

    /** Merge repeated samples and clip state intervals to the shared x scale. */
    intervals(times: number[], values: number[], min: number, max: number): StateInterval[] {
        const result: StateInterval[] = [];
        if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
            return result;
        }
        let current: number = null;
        let start: number;
        const append = (end: number) => {
            if (this.values[current] && end > Math.max(start, min)) {
                result.push({ from: Math.max(start, min), to: end, state: this.values[current] });
            }
        };
        for (let i = 0; i < times.length && times[i] <= max; i++) {
            const value = values[i];
            if (value === null || value === undefined || value === current) {
                continue;
            }
            append(times[i]);
            current = value;
            start = times[i];
        }
        // No state is inferred before the first sample returned by the historian.
        append(max);
        return result;
    }
}
