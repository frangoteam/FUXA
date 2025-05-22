import { Injectable } from '@angular/core';

@Injectable()
export class JsonUtils {

    static tryToParse<T = any>(value: unknown, fallback: T | null = null): T | null {
        if (value === null || value === undefined) {
            return fallback;
        }
        // Se è già un oggetto (incluso array), lo restituisce direttamente
        if (typeof value === 'object') {
            return value as T;
        }
        // Se è una stringa, prova a fare il parse
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                if (typeof parsed === 'object' && parsed !== null) {
                    return parsed;
                }
            } catch (err) {
                console.warn('tryToParse(): invalid JSON string', err);
            }
        }

        return fallback;
    }
}
