import { InjectionToken } from '@angular/core';
import * as _moment from 'moment';
const moment = _moment;

export const LOCALE_CONFIG = new InjectionToken<LocaleConfig>('daterangepicker.config');
/**
 *  LocaleConfig Interface
 */
export interface LocaleConfig {
    direction?: string;
    separator?: string;
    weekLabel?: string;
    applyLabel?: string;
    cancelLabel?: string;
    customRangeLabel?: string;
    daysOfWeek?: string[];
    monthNames?:  string[];
    firstDay?: number;
    format?: string;
}
/**
 *  DefaultLocaleConfig
 */
export const DefaultLocaleConfig: LocaleConfig = {
    direction: 'ltr',
    separator: ' - ',
    weekLabel: 'W',
    applyLabel: 'Apply',
    cancelLabel: 'Cancel',
    customRangeLabel: 'Custom range',
    daysOfWeek: moment.weekdaysMin(),
    monthNames: moment.monthsShort(),
    firstDay: moment.localeData().firstDayOfWeek()
};
