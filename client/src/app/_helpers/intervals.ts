export class Intervals {
    public intervals: any [] = [];

    addInterval(delay: number, fnc: any, args: any, context?: any, once = false) {
        const callback = () => fnc.call(context, args);
        const interval = once ? setTimeout(callback, delay) : setInterval(callback, delay);
        this.intervals.push(interval);
    }

    clearIntervals() {
        this.intervals.forEach(interval => {
            clearInterval(interval);
        });
        this.intervals = [];
    }
}
