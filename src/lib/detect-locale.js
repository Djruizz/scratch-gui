/**
 * @fileoverview
 * Utility function to detect locale from the browser setting or paramenter on the URL.
 */

// tw: read language from localStorage
export const LANGUAGE_KEY = 'tw:language';
export const FORCED_LOCALE = 'es-419';

/**
 * Forces the GameCodeKids editor to start in Latin American Spanish (`es-419`)
 * so blocks and UI labels always render in Spanish on initial load.
 * @param {Array.string} supportedLocales An array of supported locale codes.
 * @return {string} the preferred locale
 */
const detectLocale = supportedLocales => {
    if (Array.isArray(supportedLocales)) {
        if (supportedLocales.includes(FORCED_LOCALE)) {
            return FORCED_LOCALE;
        }
        if (supportedLocales.includes('es')) {
            return 'es';
        }
    }
    return FORCED_LOCALE;
};

export {
    detectLocale
};
