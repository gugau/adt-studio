// Interactive editing script + styles injected into the BookPreviewFrame
// iframe. The script is gated by `body[data-editable="true"]`, so toggling
// editability does not require an iframe reload.

export const INTERACTIVE_SCRIPT = `<script>
(function() {
  var selected = null;
  var editing = null;
  var savedDisplayHtml = null;
  var savedOriginalText = null;
  var containerIdCounter = 0;

  function isEditable() { return document.body.dataset.editable === 'true'; }

  /** Structural tags eligible for container selection (when no data-id ancestor). */
  var CONTAINER_TAGS = { DIV:1, SECTION:1, ARTICLE:1, MAIN:1, NAV:1, ASIDE:1, HEADER:1, FOOTER:1,
    BUTTON:1, A:1, UL:1, OL:1, LI:1, FIGURE:1, FIGCAPTION:1, BLOCKQUOTE:1, TABLE:1,
    THEAD:1, TBODY:1, TR:1, TD:1, TH:1, FORM:1, FIELDSET:1, DETAILS:1, SUMMARY:1, SPAN:1,
    INPUT:1, SELECT:1, TEXTAREA:1, LABEL:1 };

  /** Walk up from target to find the nearest meaningful container element. */
  function findContainer(target) {
    var el = target;
    while (el && el !== document.body && el.id !== 'content') {
      if (el.nodeType === 1 && CONTAINER_TAGS[el.tagName]) return el;
      el = el.parentElement;
    }
    return null;
  }

  /** Ensure the element has a data-id; assign one if missing. */
  function ensureDataId(el) {
    var id = el.getAttribute('data-id');
    if (id) return id;
    id = '_el' + (++containerIdCounter);
    el.setAttribute('data-id', id);
    return id;
  }

  function getRect(el) {
    var r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, left: r.left, right: r.right, bottom: r.bottom };
  }

  function clearSelection() {
    if (selected) {
      selected.removeAttribute('data-adt-selected');
    }
    selected = null;
  }

  function selectElement(el) {
    clearSelection();
    selected = el;
    el.setAttribute('data-adt-selected', 'true');
    var isImg = el.tagName === 'IMG';
    parent.postMessage({
      type: isImg ? 'select-image' : 'select',
      dataId: el.getAttribute('data-id'),
      rect: getRect(el)
    }, '*');
  }

  function startEditing(el) {
    if (editing === el) return;
    if (el.tagName === 'IMG') return;
    editing = el;
    // Save the current MathML display before swapping to LaTeX
    savedDisplayHtml = el.innerHTML;
    var dataId = el.getAttribute('data-id');
    if (window.__origTexts && window.__origTexts[dataId] != null) {
      el.innerHTML = window.__origTexts[dataId];
    }
    // Capture original text AFTER the LaTeX swap so the comparison
    // in finishEditing compares LaTeX-to-LaTeX, not MathML-to-LaTeX
    savedOriginalText = el.textContent || '';
    el.contentEditable = 'true';
    el.setAttribute('data-adt-editing', 'true');
    el.focus();
    parent.postMessage({ type: 'editing', dataId: dataId }, '*');
  }

  function finishEditing() {
    if (!editing) return;
    var el = editing;
    var restoreHtml = savedDisplayHtml;
    var origText = savedOriginalText;
    editing = null;
    savedDisplayHtml = null;
    savedOriginalText = null;
    el.contentEditable = 'false';
    el.removeAttribute('data-adt-editing');
    var newText = el.textContent || '';
    var dataId = el.getAttribute('data-id');
    // If nothing changed, restore the saved MathML display so math content
    // re-renders (startEditing had swapped it to LaTeX source).
    if (newText === origText) {
      if (restoreHtml != null) el.innerHTML = restoreHtml;
      return;
    }
    // Text was edited: leave the new content in place and let the parent's
    // re-render replace it. Restoring the pre-edit HTML here would cause a
    // visible flash of the old text before the parent's update propagates.
    var wrapper = document.getElementById('content');
    var fullHtml;
    if (wrapper) {
      var cls = (wrapper.getAttribute('class') || '').trim();
      fullHtml = cls ? wrapper.outerHTML : wrapper.innerHTML;
    } else {
      fullHtml = document.body.innerHTML;
    }
    parent.postMessage({
      type: 'text-changed',
      dataId: dataId,
      newText: newText,
      fullHtml: fullHtml
    }, '*');
  }

  // Enter edit mode on mousedown (before the browser's default selection
  // behavior) so native drag-to-select works within the contentEditable
  // element. Handling this on 'click' was too late: the selection created
  // during mousedown/drag was wiped when startEditing swapped innerHTML.
  document.addEventListener('mousedown', function(e) {
    if (!isEditable()) return;
    var el = e.target.closest('[data-id]');
    if (!el) return;
    if (el.tagName === 'IMG') return;
    if (editing === el) return;
    if (editing && editing !== el) finishEditing();
    selectElement(el);
    startEditing(el);
  });

  document.addEventListener('click', function(e) {
    if (!isEditable()) return;
    var el = e.target.closest('[data-id]');
    if (!el) {
      // No data-id ancestor — try selecting a container element
      var container = findContainer(e.target);
      if (container) {
        // Prevent native focus/interaction on form elements so the click selects for editing
        var tag = container.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') {
          e.preventDefault();
        }
        if (editing) finishEditing();
        var cId = ensureDataId(container);
        clearSelection();
        selected = container;
        container.setAttribute('data-adt-selected', 'true');
        parent.postMessage({
          type: 'select-container',
          dataId: cId,
          tagName: container.tagName.toLowerCase(),
          rect: getRect(container)
        }, '*');
        return;
      }
      if (editing) finishEditing();
      clearSelection();
      parent.postMessage({ type: 'deselect' }, '*');
      return;
    }
    if (editing === el) return;
    if (editing && editing !== el) finishEditing();
    selectElement(el);
    if (el.tagName !== 'IMG') startEditing(el);
  });

  document.addEventListener('keydown', function(e) {
    if (!isEditable()) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        parent.dispatchEvent(new KeyboardEvent('keydown', { key: e.key }));
      }
      return;
    }
    if (editing) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finishEditing();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        // Restore MathML display on cancel
        if (savedDisplayHtml != null) {
          editing.innerHTML = savedDisplayHtml;
          savedDisplayHtml = null;
        }
        editing.contentEditable = 'false';
        editing.removeAttribute('data-adt-editing');
        editing = null;
      }
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      parent.dispatchEvent(new KeyboardEvent('keydown', { key: e.key }));
    }
  });
})();
<\/script>`

export const INTERACTIVE_STYLES = `body[data-editable="true"] [data-id] { cursor: pointer; transition: outline 0.1s; }
    body[data-editable="true"] [data-id]:hover { outline: 2px solid rgba(59,130,246,0.3); outline-offset: 2px; }
    body[data-editable="true"] img[data-id] { position: relative; z-index: 1; }
    body[data-editable="true"] div:hover, body[data-editable="true"] section:hover,
    body[data-editable="true"] button:hover, body[data-editable="true"] nav:hover,
    body[data-editable="true"] article:hover, body[data-editable="true"] aside:hover,
    body[data-editable="true"] figure:hover, body[data-editable="true"] li:hover,
    body[data-editable="true"] input:hover, body[data-editable="true"] select:hover,
    body[data-editable="true"] textarea:hover, body[data-editable="true"] label:hover {
      outline: 1px dashed rgba(59,130,246,0.25); outline-offset: 1px;
    }
    [data-adt-selected] { outline: 2px solid rgba(59,130,246,0.8) !important; outline-offset: 2px !important; }
    [data-adt-editing] { outline: 2px solid rgba(59,130,246,1) !important; outline-offset: 2px !important; }`
