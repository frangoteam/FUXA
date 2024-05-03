export class Intervals {
    public intervals: any [] = [];

    addInterval(delay: number, fnc: any, args: any, context?: any) {
        const interval = setInterval(() => fnc.call(context, args), delay);
        this.intervals.push(interval);
    }

    clearIntervals() {
        this.intervals.forEach(interval => {
            clearInterval(interval);
        });
        this.intervals = [];
    }
}
