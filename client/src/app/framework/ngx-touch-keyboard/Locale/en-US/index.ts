import { Layout, Display, Locale } from '../type';
import { fnDisplay } from '../constants';

const layouts: Layout = {
  text_alphabetic: [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['{shift}', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '{backspace}'],
    ['{numeric}', '{space}', '{done}'],
  ],
  text_shift: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['{shift}', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '{backspace}'],
    ['{numeric}', '{space}', '{done}'],
  ],
  text_numeric: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
    ['{symbolic}', '.', ',', '?', '!', "'", '{backspace}'],
    ['{alphabetic}', '{space}', '{done}'],
  ],
  text_symbolic: [
    ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
    ['_', '\\', '|', '~', '<', '>', '€', '£', '¥', '•'],
    ['{numeric}', '.', ',', '?', '!', "'", '{backspace}'],
    ['{alphabetic}', '{space}', '{done}'],
  ],
  search_alphabetic: [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['{shift}', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '{backspace}'],
    ['{numeric}', '{space}', '{done}'],
  ],
  search_shift: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['{shift}', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '{backspace}'],
    ['{numeric}', '{space}', '{done}'],
  ],
  search_numeric: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
    ['{symbolic}', '.', ',', '?', '!', "'", '{backspace}'],
    ['{alphabetic}', '{space}', '{done}'],
  ],
  search_symbolic: [
    ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
    ['_', '\\', '|', '~', '<', '>', '€', '£', '¥', '•'],
    ['{numeric}', '.', ',', '?', '!', "'", '{backspace}'],
    ['{alphabetic}', '{space}', '{done}'],
  ],
  email_alphabetic: [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['{shift}', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '{backspace}'],
    ['{numeric}', '@', '{space}', '.', '{done}'],
  ],
  email_shift: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['{shift}', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '{backspace}'],
    ['{numeric}', '@', '{space}', '.', '{done}'],
  ],
  email_numeric: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['$', '!', '~', '&', '=', '#', '[', ']'],
    ['{symbolic}', '.', '_', '-', '+', '{backspace}'],
    ['{alphabetic}', '@', '{space}', '.', '{done}'],
  ],
  email_symbolic: [
    ['`', '|', '{', '}', '?', '%', '^', '*', '/', "'"],
    ['$', '!', '~', '&', '=', '#', '[', ']'],
    ['{numeric}', '.', '_', '-', '+', '{backspace}'],
    ['{alphabetic}', '@', '{space}', '.', '{done}'],
  ],
  url_alphabetic: [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['{shift}', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '{backspace}'],
    ['{numeric}', '/', '.com', '.', '{done}'],
  ],
  url_shift: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['{shift}', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '{backspace}'],
    ['{numeric}', '/', '.com', '.', '{done}'],
  ],
  url_numeric: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['@', '&', '%', '?', ',', '=', '[', ']'],
    ['{symbolic}', '_', ':', '-', '+', '{backspace}'],
    ['{alphabetic}', '/', '.com', '.', '{done}'],
  ],
  url_symbolic: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['*', '$', '#', '!', "'", '^', '[', ']'],
    ['{numeric}', '~', ';', '(', ')', '{backspace}'],
    ['{alphabetic}', '/', '.com', '.', '{done}'],
  ],
  numeric_default: [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['0', '{backspace}'],
  ],
  decimal_default: [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '{backspace}'],
  ],
  tel_default: [
    ['1', '2', '3', '*'],
    ['4', '5', '6', '#'],
    ['7', '8', '9', '+'],
    ['0', '{backspace}'],
  ],
};

const display: Display = {
  '{done}': fnDisplay.DONE,
  '{shift}': fnDisplay.SHIFT,
  '{backspace}': fnDisplay.BACKSPACE,
  '{space}': fnDisplay.SPACE,
  '{alphabetic}': 'ABC',
  '{numeric}': '123',
  '{symbolic}': '#+=',
};

const locale: Locale = {
  code: 'en-US',
  dir: 'ltr',
  layouts: layouts,
  display: display,
};

export default locale;
