import {addLocaleData} from 'react-intl';

import {localeData, isRtl} from '@turbowarp/scratch-l10n';
import editorMessages from '@turbowarp/scratch-l10n/locales/editor-msgs';
import addAdditionalTranslations from '../lib/tw-translations/index.js';

import {FORCED_LOCALE, LANGUAGE_KEY} from '../lib/detect-locale.js';

addAdditionalTranslations(editorMessages);
addLocaleData(localeData);

const UPDATE_LOCALES = 'scratch-gui/locales/UPDATE_LOCALES';
const SELECT_LOCALE = 'scratch-gui/locales/SELECT_LOCALE';

const DEFAULT_LOCALE = Object.prototype.hasOwnProperty.call(editorMessages, FORCED_LOCALE) ?
    FORCED_LOCALE :
    'en';

const initialState = {
    isRtl: false,
    locale: DEFAULT_LOCALE,
    messagesByLocale: editorMessages,
    messages: editorMessages[DEFAULT_LOCALE]
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case SELECT_LOCALE:
        return Object.assign({}, state, {
            isRtl: isRtl(action.locale),
            locale: action.locale,
            messagesByLocale: state.messagesByLocale,
            messages: state.messagesByLocale[action.locale]
        });
    case UPDATE_LOCALES:
        return Object.assign({}, state, {
            isRtl: state.isRtl,
            locale: state.locale,
            messagesByLocale: action.messagesByLocale,
            messages: action.messagesByLocale[state.locale]
        });
    default:
        return state;
    }
};

const selectLocale = function (locale) {
    // tw: store language in localStorage
    try {
        localStorage.setItem(LANGUAGE_KEY, locale);
    } catch (e) { /* ignore */ }
    return {
        type: SELECT_LOCALE,
        locale: locale
    };
};

const setLocales = function (localesMessages) {
    return {
        type: UPDATE_LOCALES,
        messagesByLocale: localesMessages
    };
};
const initLocale = function (currentState, locale) {
    if (Object.prototype.hasOwnProperty.call(currentState.messagesByLocale, locale)) {
        return Object.assign(
            {},
            currentState,
            {
                isRtl: isRtl(locale),
                locale: locale,
                messagesByLocale: currentState.messagesByLocale,
                messages: currentState.messagesByLocale[locale]
            }
        );
    }
    // don't change locale if it's not in the current messages
    return currentState;
};
export {
    reducer as default,
    initialState as localesInitialState,
    initLocale,
    selectLocale,
    setLocales
};
