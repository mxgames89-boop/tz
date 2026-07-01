export class Library {
  static cursorMap = {
    default: 'default',
    pointer: 'pointer',
    aim: "url('./texture/cursors/aim.png') 16 16, crosshair",
    move: "url('./assets/cursors/move.png') 16 16, grab",
    grabbing: "url('./assets/cursors/grabbing.png') 16 16, grabbing"
  };

  static currentCursorByElement = new WeakMap();

  static setCursor(element, cursorType = 'default') {
    if (!element) return;

    const cursor = Library.cursorMap[cursorType] || Library.cursorMap.default;

    // Чтобы не присваивать cursor каждый тик без нужды.
    const currentCursor = Library.currentCursorByElement.get(element);

    if (currentCursor === cursorType) {
      return;
    }

    element.style.cursor = cursor;
    Library.currentCursorByElement.set(element, cursorType);
  }

  static resetCursor(element) {
    Library.setCursor(element, 'default');
  }

  static addCursor(cursorType, cursorValue) {
    Library.cursorMap[cursorType] = cursorValue;
  }
}