import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  LOCALE_ID,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { fnButton } from './Locale/constants';
import { Locale } from './Locale/type';
import * as Locales from './Locale';

@Component({
  selector: 'ngx-touch-keyboard',
  templateUrl: './ngx-touch-keyboard.component.html',
  styleUrls: ['./ngx-touch-keyboard.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgxTouchKeyboardComponent {
  locale: Locale = Locales.enUS;
  layoutMode = 'text';
  layoutName = 'alphabetic';
  debug = false;
  fullScreen = false;

  @Output() closePanel = new EventEmitter<void>();

  private _activeButtonClass = 'active';
  private _caretPosition: number | null = null;
  private _caretPositionEnd: number | null = null;
  private _activeInputElement!: HTMLInputElement | HTMLTextAreaElement | null;

  /**
   * Constructor
   */
  constructor(
    private _sanitizer: DomSanitizer,
    private _elementRef: ElementRef<HTMLInputElement>,
    @Inject(LOCALE_ID) private _defaultLocale: string
  ) {}

  // -----------------------------------------------------------------------------------------------------
  // @ Decorated methods
  // -----------------------------------------------------------------------------------------------------

  /**
   * On keyup
   */
  @HostListener('window:keyup', ['$event'])
  handleKeyUp(event: KeyboardEvent): void {
    if (event.isTrusted) {
      this._caretEventHandler(event);
      this._handleHighlightKeyUp(event);
    }
  }

  /**
   * On keydown
   */
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (event.isTrusted) {
      this._handleHighlightKeyDown(event);
    }
  }

  /**
   * On pointerup (mouseup or touchend)
   */
  @HostListener('window:pointerup', ['$event'])
  handleMouseUp(event: MouseEvent): void {
    this._caretEventHandler(event);
  }

  /**
   * On select
   */
  @HostListener('window:select', ['$event'])
  handleSelect(event: Event): void {
    this._caretEventHandler(event);
  }

  /**
   * On selectionchange
   */
  @HostListener('window:selectionchange', ['$event'])
  handleSelectionChange(event: Event): void {
    this._caretEventHandler(event);
  }

  // -----------------------------------------------------------------------------------------------------
  // @ Public methods
  // -----------------------------------------------------------------------------------------------------

  /**
   * Set layout keyboard for locale
   *
   * @param value
   */
  setLocale(value: string = this._defaultLocale): void {
    // normalize value
    value = value.replace('-', '').trim();
    // Set Locale if supported
    if ((Object.keys(Locales) as readonly string[]).includes(value)) {
      this.locale = Locales[value as 'enUS'];
    }
    // Set default Locale if not supported
    else {
      this.locale = Locales.enUS;
    }
  }

  /**
   * Set active input
   *
   * @param input Input native element
   */
  setActiveInput(input: HTMLInputElement | HTMLTextAreaElement): void {
    this._activeInputElement = input;

    /**
     * Tracking keyboard layout
     */
    const inputMode = this._activeInputElement?.inputMode;
    if (
      inputMode &&
      ['text', 'search', 'email', 'url', 'numeric', 'decimal', 'tel'].some(
        (i) => i === inputMode
      )
    ) {
      this.layoutMode = inputMode;
    } else {
      this.layoutMode = 'text';
    }

    if (
      inputMode &&
      ['numeric', 'decimal', 'tel'].some((i) => i === inputMode)
    ) {
      const currentType = this._activeInputElement?.getAttribute('type');
      if (currentType === 'number') {
        this._activeInputElement?.setAttribute('type', 'text');
      }
      this.layoutName = 'default';
    } else {
      this.layoutName = 'alphabetic';
    }

    if (this.debug) {
      console.log('Locale:', `${this.locale.code || this._defaultLocale}`);
      console.log('Layout:', `${this.layoutMode}_${this.layoutName}`);
    }

    /**
     * we must ensure caretPosition doesn't persist once reactivated.
     */
    this._setCaretPosition(
      this._activeInputElement.selectionStart,
      this._activeInputElement.selectionEnd
    );

    if (this.debug) {
      console.log(
        'Caret start at:',
        this._caretPosition,
        this._caretPositionEnd
      );
    }

    // And set focus to input
    this._focusActiveInput();
  }

  /**
   * Check whether the button is a standard button
   */
  isStandardButton = (button: string) =>
    button && !(button[0] === '{' && button[button.length - 1] === '}');

  /**
   * Retrieve button type
   *
   * @param button The button's layout name
   * @return The button type
   */
  getButtonType(button: string): 'standard-key' | 'function-key' {
    return this.isStandardButton(button) ? 'standard-key' : 'function-key';
  }

  /**
   * Adds default classes to a given button
   *
   * @param button The button's layout name
   * @return The classes to be added to the button
   */
  getButtonClass(button: string): string {
    const buttonTypeClass = this.getButtonType(button);
    const buttonWithoutBraces = button.replace('{', '').replace('}', '');
    let buttonNormalized = '';

    if (buttonTypeClass !== 'standard-key') {
      buttonNormalized = `${buttonWithoutBraces}-key`;
    }

    return `${buttonTypeClass} ${buttonNormalized}`;
  }

  /**
   * Returns the display (label) name for a given button
   *
   * @param button The button's layout name
   * @return The display name to be show to the button
   */
  getButtonDisplayName(button: string): SafeHtml {
    return this._sanitizer.bypassSecurityTrustHtml(
      this.locale.display[button] || button
    );
  }

  /**
   * Handles clicks made to keyboard buttons
   *
   * @param button The button layout name.
   * @param event The button event.
   */
  handleButtonClicked(button: string, e?: Event): void {
    if (this.debug) {
      console.log('Key pressed:', button);
    }

    if (button === fnButton.SHIFT) {
      this.layoutName =
        this.layoutName === 'alphabetic' ? 'shift' : 'alphabetic';
      return;
    } else if (button === fnButton.DONE) {
      this.closePanel.emit();
      return;
    }

    let commonParams: [number, number, boolean] = [
      this._caretPosition || 0,
      this._caretPositionEnd || 0,
      true,
    ];

    let output = this._activeInputElement?.value || '';
    if (this._caretPosition === null && this._caretPositionEnd === null) {
      commonParams[0] = this._activeInputElement?.inputMode === 'decimal' ? output.length : 0;
      commonParams[1] = this._activeInputElement?.inputMode === 'decimal' ? output.length : 0;
    }

    if (!this.isStandardButton(button)) {
      // Handel functional button
      if (button === fnButton.BACKSPACE) {
        if (output.length > 0) {
          output = this._removeAt(output, ...commonParams);
        }
      } else if (button === fnButton.SPACE) {
        output = this._addStringAt(output, ' ', ...commonParams);
      } else if (button === fnButton.TAB) {
        output = this._addStringAt(output, '\t', ...commonParams);
      } else if (button === fnButton.ENTER) {
        // output = this._addStringAt(output, '\n', ...commonParams);
      } else {
        this.layoutName = button.substring(1, button.length - 1);
        return;
      }
    } else {
      // Handel standard button
      output = this._addStringAt(output, button, ...commonParams);
    }

    if (this._activeInputElement) {
      this._activeInputElement.value = output;

      if (this.debug) {
        console.log(
          'Caret at:',
          this._caretPosition,
          this._caretPositionEnd,
          'Button',
          e
        );
      }
    }

    this._dispatchEvents(button);
    if (button === fnButton.ENTER) {
      this.closePanel.emit();
      return;
    }
  }

  /**
   * Handles button mousedown
   *
   * @param button The button layout name.
   * @param event The button event.
   */
  handleButtonMouseDown(button: string, e?: Event): void {
    if (e) {
      /**
       * Handle event options
       */
      e.preventDefault();
      e.stopPropagation();
    }

    /**
     * Add active class
     */
    this._setActiveButton(button);

  }

  /**
   * Handles button mouseup
   *
   * @param button The button layout name.
   * @param event The button event.
   */
  handleButtonMouseUp(button: string, e?: Event): void {
    if (e) {
      /**
       * Handle event options
       */
      e.preventDefault();
      e.stopPropagation();
    }

    /**
     * Remove active class
     */
    this._removeActiveButton();
  }

  get current() {
    return this._activeInputElement.value;
  }
  // -----------------------------------------------------------------------------------------------------
  // @ Private methods
  // -----------------------------------------------------------------------------------------------------

  /**
   * Changes the internal caret position
   *
   * @private
   * @param position The caret's start position
   * @param positionEnd The caret's end position
   */
  private _setCaretPosition(
    position: number | null,
    endPosition = position
  ): void {
    this._caretPosition = position;
    this._caretPositionEnd = endPosition;
  }

  /**
   * Moves the cursor position by a given amount
   *
   * @private
   * @param length Represents by how many characters the input should be moved
   * @param minus Whether the cursor should be moved to the left or not.
   */
  private _updateCaretPos(length: number, minus = false) {
    const newCaretPos = this._updateCaretPosAction(length, minus);
    this._setCaretPosition(newCaretPos);
  }

  /**
   * Action method of updateCaretPos
   *
   * @private
   * @param length Represents by how many characters the input should be moved
   * @param minus Whether the cursor should be moved to the left or not.
   */
  private _updateCaretPosAction(length: number, minus = false) {
    let caretPosition = this._caretPosition;

    if (caretPosition != null) {
      if (minus) {
        if (caretPosition > 0) {
          caretPosition = caretPosition - length;
        }
      } else {
        caretPosition = caretPosition + length;
      }
    }

    return caretPosition;
  }

  /**
   * Removes an amount of characters before a given position
   *
   * @private
   * @param source The source input
   * @param position The (cursor) position from where the characters should be removed
   * @param moveCaret Whether to update input cursor
   */
  private _removeAt(
    source: string,
    position = source.length,
    positionEnd = source.length,
    moveCaret = false
  ) {
    if (position === 0 && positionEnd === 0) {
      position = source.length;
      positionEnd = source.length;
    }

    let output;

    if (position === positionEnd) {
      let prevTwoChars;
      let emojiMatched;
      const emojiMatchedReg = /([\uD800-\uDBFF][\uDC00-\uDFFF])/g;

      /**
       * Emojis are made out of two characters, so we must take a custom approach to trim them.
       * For more info: https://mathiasbynens.be/notes/javascript-unicode
       */
      if (position && position >= 0) {
        prevTwoChars = source.substring(position - 2, position);
        emojiMatched = prevTwoChars.match(emojiMatchedReg);

        if (emojiMatched) {
          output = source.substr(0, position - 2) + source.substr(position);
          if (moveCaret) {
            this._updateCaretPos(2, true);
          }
        } else {
          output = source.substr(0, position - 1) + source.substr(position);
          if (moveCaret) {
            this._updateCaretPos(1, true);
          }
        }
      } else {
        prevTwoChars = source.slice(-2);
        emojiMatched = prevTwoChars.match(emojiMatchedReg);

        if (emojiMatched) {
          output = source.slice(0, -2);
          if (moveCaret) {
            this._updateCaretPos(2, true);
          }
        } else {
          output = source.slice(0, -1);
          if (moveCaret) {
            this._updateCaretPos(1, true);
          }
        }
      }
    } else {
      output = source.slice(0, position) + source.slice(positionEnd);
      if (moveCaret) {
        this._setCaretPosition(position);
      }
    }

    return output;
  }

  /**
   * Adds a string to the input at a given position
   *
   * @private
   * @param source The source input
   * @param str The string to add
   * @param position The (cursor) position where the string should be added
   * @param moveCaret Whether to update virtual-keyboard cursor
   */
  private _addStringAt(
    source: string,
    str: string,
    position = source.length,
    positionEnd = source.length,
    moveCaret = false
  ) {
    let output;

    if (!position && position !== 0) {
      output = source + str;
    } else {
      output = [source.slice(0, position), str, source.slice(positionEnd)].join(
        ''
      );
      if (moveCaret) {
        this._updateCaretPos(str.length, false);
      }
    }

    return output;
  }

  /**
   * Method to dispatch necessary keyboard events to current input element.
   * @see https://w3c.github.io/uievents/tools/key-event-viewer.html
   *
   * @param button
   */
  private _dispatchEvents(button: string) {
    let key, code;
    if (button.includes('{') && button.includes('}')) {
      // Capitalize name
      key = button.slice(1, button.length - 1).toLowerCase();
      key = key.charAt(0).toUpperCase() + key.slice(1);
      code = key;
    } else {
      key = button;
      code = Number.isInteger(Number(button))
        ? `Digit${button}`
        : `Key${button.toUpperCase()}`;
    }

    const eventInit: KeyboardEventInit = {
      bubbles: true,
      cancelable: true,
      shiftKey: this.layoutName == 'shift',
      key: key,
      code: code,
      location: 0,
    };

    // Simulate all needed events on base element
    this._activeInputElement?.dispatchEvent(
      new KeyboardEvent('keydown', eventInit)
    );
    this._activeInputElement?.dispatchEvent(
      new KeyboardEvent('keypress', eventInit)
    );
    this._activeInputElement?.dispatchEvent(
      new Event('input', { bubbles: true })
    );
    this._activeInputElement?.dispatchEvent(
      new KeyboardEvent('keyup', eventInit)
    );

    // And set focus to input
    this._focusActiveInput();
  }

  /**
   * Called when an event that warrants a cursor position update is triggered
   *
   * @private
   * @param event
   */
  private _caretEventHandler(event: any) {
    let targetTagName = '';
    if (event.target.tagName) {
      targetTagName = event.target.tagName.toLowerCase();
    }

    const isTextInput =
      targetTagName === 'textarea' ||
      (targetTagName === 'input' &&
        ['text', 'search', 'email', 'password', 'url', 'tel'].includes(
          event.target.type
        ));

    const isKeyboard =
      event.target === this._elementRef.nativeElement ||
      (event.target && this._elementRef.nativeElement.contains(event.target));
    if (this._activeInputElement == event.target) {
      /**
       * Tracks current cursor position
       * As keys are pressed, text will be added/removed at that position within the input.
       */
      this._setCaretPosition(
        event.target.selectionStart,
        event.target.selectionEnd
      );

      if (this.debug) {
        console.log(
          'Caret at:',
          this._caretPosition,
          this._caretPositionEnd,
          event && event.target.tagName.toLowerCase(),
          event
        );
      }
    } else if (
      event.type === 'pointerup' &&
      this._activeInputElement === document.activeElement
    ) {
      return;
    } else if (!isKeyboard && event?.type !== 'selectionchange' && event?.type !== 'select') {
      /**
       * we must ensure caretPosition doesn't persist once reactivated.
       */
      this._setCaretPosition(null);

      if (this.debug) {
        console.log(
          `Caret position reset due to "${event?.type}" event`,
          event
        );
      }

      /**
       * Close panel
       */
      this.closePanel.emit();
    }
  }

  /**
   * Focus to input
   *
   * @private
   */
  private _focusActiveInput(): void {
    this._activeInputElement?.focus();
    if (this._caretPosition && this._caretPositionEnd) {
      this._activeInputElement?.setSelectionRange(
        this._caretPosition,
        this._caretPositionEnd
      );
    }
  }

  /**
   * Handel highlight on key down
   *
   * @private
   * @param event The KeyboardEvent
   */
  private _handleHighlightKeyDown(event: KeyboardEvent): void {
    const buttonPressed = this._getKeyboardLayoutKey(event);
    /**
     * Add active class
     */
    this._setActiveButton(buttonPressed);
  }

  /**
   * Handel highlight on key up
   *
   * @private
   * @param event The KeyboardEvent
   */
  private _handleHighlightKeyUp(event: KeyboardEvent): void {
    const buttonPressed = this._getKeyboardLayoutKey(event);
    /**
     * Remove active class
     */
    this._removeActiveButton(buttonPressed);
  }

  /**
   * Transforms a KeyboardEvent's "key.code" string into a virtual-keyboard layout format
   *
   * @private
   * @param event The KeyboardEvent
   */
  private _getKeyboardLayoutKey(event: KeyboardEvent) {
    let output = '';
    const keyId = event.code || event.key;

    if (
      keyId?.includes('Space') ||
      keyId?.includes('Numpad') ||
      keyId?.includes('Backspace') ||
      keyId?.includes('CapsLock') ||
      keyId?.includes('Meta')
    ) {
      output = `{${event.code}}` || '';
    } else if (
      keyId?.includes('Control') ||
      keyId?.includes('Shift') ||
      keyId?.includes('Alt')
    ) {
      output = `{${event.key}}` || '';
    } else {
      output = event.key || '';
    }

    return output.length > 1 ? output?.toLowerCase() : output;
  }

  /**
   * Set active class in button
   *
   * @param buttonName
   */
  private _setActiveButton(buttonName: string): void {
    const node = this._elementRef.nativeElement
      .getElementsByTagName('button')
      .namedItem(buttonName);
    if (node && node.classList) {
      node.classList.add(this._activeButtonClass);
    }
  }

  /**
   * Remove active button
   *
   * @param buttonName
   */
  private _removeActiveButton(buttonName?: string): void {
    const nodes = this._elementRef.nativeElement.getElementsByTagName('button');
    if (buttonName) {
      const node = nodes.namedItem(buttonName);
      if (node && node.classList) {
        node.classList.remove(this._activeButtonClass);
      }
    } else {
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].classList.remove(this._activeButtonClass);
      }
    }
  }
}
