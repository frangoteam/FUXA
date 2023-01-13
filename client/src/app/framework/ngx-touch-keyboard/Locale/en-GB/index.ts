import { Layout, Display, Locale } from '../type';
import { fnDisplay } from '../constants';

const layouts: Layout = {
  text_alphabetic: [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['{shift}', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '{backspace}'],
    ['{numeric}', '{space}', '{done}', '{enter}'],
  ],
  text_shift: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['{shift}', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '{backspace}'],
    ['{numeric}', '{space}', '{done}', '{enter}'],
  ],
  text_numeric: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
    ['{symbolic}', '.', ',', '?', '!', '\'', '{backspace}'],
    ['{alphabetic}', '{space}', '{done}', '{enter}'],
  ],
  text_symbolic: [
    ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
    ['_', '\\', '|', '~', '<', '>', '€', '£', '¥', '•'],
    ['{numeric}', '.', ',', '?', '!', '\'', '{backspace}'],
    ['{alphabetic}', '{space}', '{done}', '{enter}'],
  ],
  search_alphabetic: [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['{shift}', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '{backspace}'],
    ['{numeric}', '{space}', '{done}', '{enter}'],
  ],
  search_shift: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['{shift}', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '{backspace}'],
    ['{numeric}', '{space}', '{done}', '{enter}'],
  ],
  search_numeric: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
    ['{symbolic}', '.', ',', '?', '!', '\'', '{backspace}'],
    ['{alphabetic}', '{space}', '{done}', '{enter}'],
  ],
  search_symbolic: [
    ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
    ['_', '\\', '|', '~', '<', '>', '€', '£', '¥', '•'],
    ['{numeric}', '.', ',', '?', '!', '\'', '{backspace}'],
    ['{alphabetic}', '{space}', '{done}', '{enter}'],
  ],
  email_alphabetic: [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['{shift}', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '{backspace}'],
    ['{numeric}', '@', '{space}', '.', '{done}', '{enter}'],
  ],
  email_shift: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['{shift}', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '{backspace}'],
    ['{numeric}', '@', '{space}', '.', '{done}', '{enter}'],
  ],
  email_numeric: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['$', '!', '~', '&', '=', '#', '[', ']'],
    ['{symbolic}', '.', '_', '-', '+', '{backspace}'],
    ['{alphabetic}', '@', '{space}', '.', '{done}', '{enter}'],
  ],
  email_symbolic: [
    ['`', '|', '{', '}', '?', '%', '^', '*', '/', '\''],
    ['$', '!', '~', '&', '=', '#', '[', ']'],
    ['{numeric}', '.', '_', '-', '+', '{backspace}'],
    ['{alphabetic}', '@', '{space}', '.', '{done}', '{enter}'],
  ],
  url_alphabetic: [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['{shift}', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '{backspace}'],
    ['{numeric}', '/', '.com', '.', '{done}', '{enter}'],
  ],
  url_shift: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['{shift}', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '{backspace}'],
    ['{numeric}', '/', '.com', '.', '{done}', '{enter}'],
  ],
  url_numeric: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['@', '&', '%', '?', ',', '=', '[', ']'],
    ['{symbolic}', '_', ':', '-', '+', '{backspace}'],
    ['{alphabetic}', '/', '.com', '.', '{done}', '{enter}'],
  ],
  url_symbolic: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['*', '$', '#', '!', '\'', '^', '[', ']'],
    ['{numeric}', '~', ';', '(', ')', '{backspace}'],
    ['{alphabetic}', '/', '.com', '.', '{done}', '{enter}'],
  ],
  numeric_default: [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['0', '{backspace}', '{enter}'],
  ],
  decimal_default: [
    ['1', '2', '3', '-'],
    ['4', '5', '6', '+'],
    ['7', '8', '9', '{backspace}'],
    ['{done}', '0','.', '{enter}'],
  ],
  tel_default: [
    ['1', '2', '3', '*'],
    ['4', '5', '6', '#'],
    ['7', '8', '9', '+'],
    ['0', '{backspace}', '{enter}'],
  ],
};

const display: Display = {
  '{enter}': fnDisplay.ENTER,
  '{done}': fnDisplay.DONE,
  '{shift}': fnDisplay.SHIFT,
  '{backspace}': fnDisplay.BACKSPACE,
  '{space}': fnDisplay.SPACE,
  '{alphabetic}': 'ABC',
  '{numeric}': '123',
  '{symbolic}': '#+=',
};

const locale: Locale = {
  code: 'en-GB',
  dir: 'ltr',
  layouts: layouts,
  display: display,
};

export default locale;
