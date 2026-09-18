/* Formatting is structured data, never user-supplied HTML.
 *
 * Two editing surfaces share the same run model:
 *   edit()   - the large modal window (kept for long-form fields)
 *   inline() - in-place editing with a floating selection toolbar
 *
 * In-place editing is the default for tables: the user asked for Word-style
 * formatting (size, bold, italic, underline, highlight) to be reachable from
 * the selection and the right-click menu instead of forcing a big modal.
 */
(function (root) {
  'use strict';
  const sizes = [10, 12, 14, 16, 18, 20, 24, 28, 32];
  const colors = ['yellow', 'green', 'blue', 'pink'];
  const highlights = {yellow:'#ffe08a', green:'#bce7b3', blue:'#b9dbff', pink:'#f5bfd5'};
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function normalize(runs, plain) {
    const result = [];
    if (Array.isArray(runs)) for (const run of runs.slice(0, 10000)) {
      if (!run || typeof run.text !== 'string' || !run.text) continue;
      const clean = {text: run.text};
      for (const key of ['bold', 'italic', 'underline']) if (run[key] === true) clean[key] = true;
      if (sizes.includes(run.size)) clean.size = run.size;
      if (colors.includes(run.highlight)) clean.highlight = run.highlight;
      const previous = result.at(-1);
      if (previous && JSON.stringify({...previous,text:''}) === JSON.stringify({...clean,text:''})) previous.text += clean.text;
      else result.push(clean);
    }
    if (plain !== undefined && result.map(r => r.text).join('') !== String(plain)) return plain ? [{text: String(plain)}] : [];
    return result;
  }
  function html(runs, plain, strict = false) {
    return normalize(runs, plain).map(run => {
      const styles = [];
      if (!strict && run.bold) styles.push('font-weight:700');
      if (!strict && run.italic) styles.push('font-style:italic');
      if (run.underline) styles.push('text-decoration:underline');
      if (!strict && run.size) styles.push(`font-size:${run.size}px`);
      if (!strict && run.highlight) styles.push(`background-color:${highlights[run.highlight]};color:#161616`);
      return `<span${styles.length ? ` style="${styles.join(';')}"` : ''}>${escape(run.text)}</span>`;
    }).join('');
  }
  function apply(runs, start, end, key, value) {
    const result = []; let offset = 0;
    for (const run of normalize(runs)) {
      const next = offset + run.text.length, a = Math.max(offset, start), b = Math.min(next, end);
      if (a >= b) result.push({...run});
      else {
        if (a > offset) result.push({...run, text: run.text.slice(0, a - offset)});
        const middle = {...run, text: run.text.slice(a - offset, b - offset)};
        if (key === 'clear') for (const k of ['bold','italic','underline','size','highlight']) delete middle[k];
        else if (value) middle[key] = value; else delete middle[key];
        result.push(middle);
        if (b < next) result.push({...run, text: run.text.slice(b - offset)});
      }
      offset = next;
    }
    return normalize(result);
  }

  // --- shared DOM helpers ---------------------------------------------------

  /** Read a contenteditable subtree back into structured runs. */
  function readElement(surface) {
    const result = [];
    function walk(node, marks = {}) {
      if (node.nodeType === 3) { result.push({...marks, text:node.textContent}); return; }
      if (node.nodeType !== 1) return;
      const style = node.style;
      const next = {...marks};
      if (style.fontWeight === '700' || ['B','STRONG'].includes(node.tagName)) next.bold = true;
      if (style.fontStyle === 'italic' || ['I','EM'].includes(node.tagName)) next.italic = true;
      if (style.textDecoration.includes('underline') || node.tagName === 'U') next.underline = true;
      const size = parseInt(style.fontSize,10); if (sizes.includes(size)) next.size = size;
      if (node.dataset.highlight) next.highlight = node.dataset.highlight;
      if (node.tagName === 'BR') { result.push({...next, text:'\n'}); return; }
      node.childNodes.forEach(child => walk(child, next));
    }
    surface.childNodes.forEach(node => walk(node));
    return normalize(result);
  }

  /** Current selection as [start, end] character offsets, or null when outside. */
  function selectionOffsets(surface) {
    const s = surface.ownerDocument?.getSelection?.() || root.getSelection?.();
    if (!s?.rangeCount || !surface.contains(s.anchorNode) || !surface.contains(s.focusNode)) return null;
    const range = s.getRangeAt(0), before = range.cloneRange();
    before.selectNodeContents(surface); before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    return [start, start + range.toString().length];
  }

  function restoreOffsets(surface, offsets) {
    const walker = surface.ownerDocument.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
    let node, offset = 0; const points = [];
    while ((node = walker.nextNode())) {
      for (let i = 0; i < 2; i++) if (!points[i] && offsets[i] <= offset + node.length) points[i] = [node, Math.max(0, offsets[i] - offset)];
      offset += node.length;
    }
    const doc = surface.ownerDocument, range = doc.createRange();
    if (points[0] && points[1]) { range.setStart(...points[0]); range.setEnd(...points[1]); }
    else { range.selectNodeContents(surface); range.collapse(false); }
    const s = doc.getSelection(); if (!s) return;
    s.removeAllRanges(); s.addRange(range);
  }

  const TOOLBAR = `<div class="rich-toolbar" role="toolbar" aria-label="文字格式">
        <select data-format="size" aria-label="字号"><option value="">字号</option>${sizes.map(n => `<option value="${n}">${n}</option>`).join('')}</select>
        <button type="button" data-format="bold" aria-label="粗体 Ctrl+B" title="粗体 Ctrl+B" aria-pressed="false"><b>B</b></button>
        <button type="button" data-format="italic" aria-label="斜体 Ctrl+I" title="斜体 Ctrl+I" aria-pressed="false"><i>I</i></button>
        <button type="button" data-format="underline" aria-label="下划线 Ctrl+U" title="下划线 Ctrl+U" aria-pressed="false"><u>U</u></button>
        <select data-format="highlight" aria-label="高亮标记"><option value="">标记</option><option value="yellow">黄色标记</option><option value="green">绿色标记</option><option value="blue">蓝色标记</option><option value="pink">粉色标记</option></select>
        <button type="button" data-format="clear" title="清除格式" aria-label="清除格式">T×</button>
        <button type="button" data-history="undo" aria-label="撤销文字编辑" title="撤销 Ctrl+Z">↶</button><button type="button" data-history="redo" aria-label="重做文字编辑" title="重做 Ctrl+Shift+Z">↷</button>
      </div>`;

  /**
   * Shared controller over one editing surface.
   * Callbacks: onChange(current), onDirty(). Returns {current, selection, format, undo, insertText, sync, history, cursor}.
   */
  function createController(surface, {initial, onChange} = {}) {
    let current = normalize(initial?.runs, initial?.text ?? '');
    let selection = [0, 0], composing = false;
    let history = [structuredClone(current)], cursor = 0;

    const read = () => readElement(surface);
    const rememberSelection = () => {
      const next = selectionOffsets(surface); if (next) selection = next;
    };
    const restore = () => restoreOffsets(surface, selection);
    const render = () => {
      surface.innerHTML = '';
      for (const run of current) {
        const template = document.createElement('template'); template.innerHTML = html([run]);
        const span = template.content.firstChild;
        if (run.highlight) span.dataset.highlight = run.highlight;
        surface.append(span);
      }
    };
    const record = () => {
      if (JSON.stringify(history[cursor]) === JSON.stringify(current)) return;
      history.splice(cursor + 1); history.push(structuredClone(current));
      if (history.length > 100) history.shift();
      cursor = history.length - 1;
    };
    const undo = redo => {
      cursor = Math.max(0, Math.min(history.length - 1, cursor + (redo ? 1 : -1)));
      current = structuredClone(history[cursor]); render(); surface.focus(); restore(); onChange?.(current);
    };
    const format = (key, value) => {
      current = read(); rememberSelection();
      const length = current.map(r => r.text).join('').length;
      const [start, end] = selection[0] === selection[1] ? [0, length] : selection;
      if (['bold','italic','underline'].includes(key)) {
        let offset = 0;
        const selected = current.filter(run => { const next = offset + run.text.length; const yes = next > start && offset < end; offset = next; return yes; });
        value = !selected.every(r => r[key]);
      }
      current = apply(current, start, end, key, value); record(); render(); surface.focus(); restore(); rememberSelection(); onChange?.(current);
    };
    const insertText = value => {
      surface.focus(); restore();
      const doc = surface.ownerDocument, s = doc.getSelection();
      if (!s || !s.rangeCount) return;
      const range = s.getRangeAt(0);
      range.deleteContents();
      // 换行必须落成 <br>：readElement 只在 <br> 处产出 '\n'，
      // 若插入文本节点 '\n'，HTML 会把它折叠成空格，写入与回读就对不上了。
      const segments = String(value).split('\n');
      let last = null;
      segments.forEach((segment, index) => {
        if (index > 0) { last = doc.createElement('br'); range.insertNode(last); range.setStartAfter(last); range.collapse(true); }
        if (segment) { last = doc.createTextNode(segment); range.insertNode(last); range.setStartAfter(last); range.collapse(true); }
      });
      if (last) { range.setStartAfter(last); range.collapse(true); }
      s.removeAllRanges(); s.addRange(range);
      current = read(); rememberSelection(); record(); onChange?.(current);
    };
    const sync = () => { current = read(); rememberSelection(); record(); onChange?.(current); };

    // 具名以便卸载：单元格会长期存活，每次编辑都叠加一套监听器会泄漏并让状态错乱。
    const onBeforeInput = e => {
      if (['insertParagraph','insertLineBreak'].includes(e.inputType)) { e.preventDefault(); rememberSelection(); insertText('\n'); }
      if (['historyUndo','historyRedo'].includes(e.inputType)) { e.preventDefault(); undo(e.inputType === 'historyRedo'); }
    };
    const onPaste = e => { e.preventDefault(); rememberSelection(); insertText((e.clipboardData?.getData('text/plain') || '').slice(0, 10000)); };
    const onDrop = e => e.preventDefault();
    const onCompositionStart = () => { composing = true; };
    const onCompositionEnd = () => { composing = false; sync(); };
    const onInput = () => { if (!composing) sync(); };
    surface.addEventListener('beforeinput', onBeforeInput);
    surface.addEventListener('paste', onPaste);
    surface.addEventListener('drop', onDrop);
    surface.addEventListener('compositionstart', onCompositionStart);
    surface.addEventListener('compositionend', onCompositionEnd);
    surface.addEventListener('input', onInput);
    const dispose = () => {
      surface.removeEventListener('beforeinput', onBeforeInput);
      surface.removeEventListener('paste', onPaste);
      surface.removeEventListener('drop', onDrop);
      surface.removeEventListener('compositionstart', onCompositionStart);
      surface.removeEventListener('compositionend', onCompositionEnd);
      surface.removeEventListener('input', onInput);
    };

    return {
      render, record, sync, format, undo, insertText, rememberSelection, restore, read, dispose,
      get current() { return current; },
      get selection() { return selection; },
      get composing() { return composing; },
      get canUndo() { return cursor > 0; },
      get canRedo() { return cursor < history.length - 1; },
      /** Which marks the current selection shares, for toolbar pressed states. */
      marks() {
        let offset = 0;
        const [start, end] = selection;
        const hits = current.filter(run => { const next = offset + run.text.length; const yes = next > start && offset < end; offset = next; return yes; });
        const out = {};
        for (const key of ['bold','italic','underline']) out[key] = hits.length > 0 && hits.every(r => r[key]);
        out.size = hits.length && hits.every(r => r.size) ? hits[0].size : '';
        out.highlight = hits.length && hits.every(r => r.highlight) ? hits[0].highlight : '';
        return out;
      }
    };
  }

  /** Wire toolbar buttons to a controller, keeping the text selection intact. */
  function wireToolbar(toolbar, controller) {
    const sync = () => {
      const marks = controller.marks();
      for (const key of ['bold','italic','underline']) toolbar.querySelector(`[data-format="${key}"]`)?.setAttribute('aria-pressed', String(Boolean(marks[key])));
      const size = toolbar.querySelector('[data-format="size"]'); if (size) size.value = marks.size ? String(marks.size) : '';
      const highlight = toolbar.querySelector('[data-format="highlight"]'); if (highlight) highlight.value = marks.highlight || '';
      const undo = toolbar.querySelector('[data-history="undo"]'); if (undo) undo.disabled = !controller.canUndo;
      const redo = toolbar.querySelector('[data-history="redo"]'); if (redo) redo.disabled = !controller.canRedo;
    };
    toolbar.querySelectorAll('button[data-format]').forEach(button => {
      button.addEventListener('pointerdown', e => e.preventDefault());
      button.addEventListener('mousedown', e => e.preventDefault());
      button.addEventListener('click', () => { controller.format(button.dataset.format); sync(); });
    });
    toolbar.querySelectorAll('select[data-format]').forEach(select => {
      // 注意：原生 <select> 不能 preventDefault —— 那样下拉根本不会展开。
      // 焦点短暂移出编辑区由 inline() 的 blur 判定（relatedTarget）兜住。
      select.addEventListener('change', () => {
        const key = select.dataset.format;
        controller.format(key, key === 'size' ? Number(select.value) : select.value);
        controller.rememberSelection(); sync();
      });
    });
    toolbar.querySelectorAll('[data-history]').forEach(button => {
      button.addEventListener('pointerdown', e => e.preventDefault());
      button.addEventListener('mousedown', e => e.preventDefault());
      button.addEventListener('click', () => { controller.undo(button.dataset.history === 'redo'); sync(); });
    });
    return sync;
  }

  function edit({title, text = '', runs = []}) {
    const dialog = document.createElement('dialog');
    dialog.className = 'standard-dialog rich-editor-dialog';
    dialog.setAttribute('aria-label', title);
    dialog.innerHTML = `<form class="rich-editor-form"><header class="dialog-head"><h3>${escape(title)}</h3><button type="button" data-cancel aria-label="取消编辑" class="btn-ghost-icon">×</button></header>
      ${TOOLBAR}
      <div class="rich-editor-surface" contenteditable="true" role="textbox" aria-multiline="true" aria-label="${escape(title)}" spellcheck="false"></div>
      <footer><small role="status">选中文字设置格式；未选中时应用整段。Ctrl+Enter 保存，Esc 取消。</small><button type="button" data-cancel class="btn btn-secondary">取消</button><button class="btn btn-primary" type="submit">保存</button></footer></form>`;
    document.body.append(dialog);
    const surface = dialog.querySelector('.rich-editor-surface');
    const controller = createController(surface, {initial: {text, runs}});
    const syncToolbar = wireToolbar(dialog.querySelector('.rich-toolbar'), controller);
    const remember = () => { controller.rememberSelection(); syncToolbar(); };
    document.addEventListener('selectionchange', remember);
    controller.render(); dialog.showModal(); surface.focus();
    return new Promise(resolve => {
      let settled = false;
      const finish = result => { if (settled) return; settled = true; document.removeEventListener('selectionchange', remember); dialog.close(); dialog.remove(); resolve(result); };
      const save = () => {
        const value = controller.read(); const joined = value.map(r => r.text).join('');
        if (joined.length > 10000) { dialog.querySelector('[role="status"]').textContent = '最多保存 10000 个字符，请缩短内容。'; return; }
        finish({text: joined, runs: value});
      };
      dialog.querySelector('form').addEventListener('submit', e => { e.preventDefault(); save(); });
      dialog.querySelectorAll('[data-cancel]').forEach(button => button.addEventListener('click', () => finish(null)));
      dialog.addEventListener('cancel', e => { e.preventDefault(); finish(null); });
      dialog.addEventListener('keydown', e => {
        if (e.isComposing) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null); return; }
        if (e.ctrlKey || e.metaKey) {
          const key = e.key.toLowerCase();
          if (['b','i','u','z','y','enter'].includes(key)) {
            e.preventDefault(); e.stopPropagation();
            if (key === 'enter') save();
            else if (key === 'z' || key === 'y') { controller.undo(e.shiftKey || key === 'y'); syncToolbar(); }
            else { controller.format({b:'bold',i:'italic',u:'underline'}[key]); syncToolbar(); }
          }
        }
      });
    });
  }

  /**
   * In-place rich text editing on an existing element.
   *
   * element - the element whose innerHTML becomes the editing surface.
   * onTab   - (shift) => void, called after committing so the caller can move on.
   *
   * Resolves {text, runs} on commit and null on cancel. Commit happens on blur,
   * Enter or Ctrl+Enter; Escape reverts. The floating toolbar follows the text
   * selection and is also shown by right-clicking inside the field.
   */
  function inline({element, text = '', runs = [], title = '', onTab, clientX, clientY, source} = {}) {
    const host = element;
    if (!host) return Promise.resolve(null);
    const doc = host.ownerDocument;
    const originalHtml = host.innerHTML;
    const originalText = String(text || '');
    let settled = false;

    host.classList.add('is-rich-editing');
    host.setAttribute('contenteditable', 'true');
    host.setAttribute('role', 'textbox');
    host.setAttribute('aria-multiline', 'true');
    if (title) host.setAttribute('aria-label', title);
    host.spellcheck = false;

    const controller = createController(host, {initial: {text, runs}});
    controller.render();

    const toolbar = doc.createElement('div');
    toolbar.className = 'rich-float-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', title ? `${title} 文字格式` : '文字格式');
    toolbar.innerHTML = TOOLBAR;
    // 外层已经是 toolbar，避免嵌套同名 role 让读屏软件重复播报。
    const inner = toolbar.querySelector('.rich-toolbar');
    if (inner) { inner.removeAttribute('role'); inner.removeAttribute('aria-label'); }
    doc.body.append(toolbar);
    const syncToolbar = wireToolbar(toolbar, controller);

    const place = (rect) => {
      const width = toolbar.offsetWidth || 320, height = toolbar.offsetHeight || 34;
      const margin = 8;
      let left = rect ? rect.left + rect.width / 2 - width / 2 : host.getBoundingClientRect().left;
      let top = rect ? rect.top - height - 6 : host.getBoundingClientRect().top - height - 6;
      left = Math.max(margin, Math.min(left, root.innerWidth - width - margin));
      if (top < margin) top = (rect ? rect.bottom : host.getBoundingClientRect().bottom) + 6;
      toolbar.style.left = `${Math.round(left)}px`;
      toolbar.style.top = `${Math.round(Math.max(margin, top))}px`;
    };
    const showToolbar = (rect) => {
      toolbar.classList.add('is-visible');
      place(rect || null);
    };
    const hideToolbar = () => toolbar.classList.remove('is-visible');

    const selectionRect = () => {
      const s = doc.getSelection();
      if (!s?.rangeCount) return null;
      const range = s.getRangeAt(0);
      if (range.collapsed || !host.contains(range.commonAncestorContainer)) return null;
      const rect = range.getBoundingClientRect();
      return rect.width || rect.height ? rect : null;
    };

    const onSelectionChange = () => {
      if (settled) return;
      controller.rememberSelection();
      syncToolbar();
      const rect = selectionRect();
      if (rect) showToolbar(rect); else if (doc.activeElement === host) showToolbar(null);
    };
    doc.addEventListener('selectionchange', onSelectionChange);

    // Right-click inside the field opens the same formatting toolbar at the pointer.
    // 原生下拉（字号/标记）会把焦点短暂移出编辑区，不能因此误判为“编辑结束”。
    toolbar.addEventListener('pointerdown', event => {
      // 关键：阻止默认行为，焦点与正文选区才不会在按下按钮的瞬间丢失。
      // 原生 <select>（字号/标记）必须放行 —— 它需要拿到焦点才能展开下拉，
      // 焦点短暂移出由 onBlur 的 relatedTarget 判定兜住。
      if (!event.target.closest('select')) event.preventDefault();
    });

    const onContextMenu = event => {
      event.preventDefault();
      const rect = {left: event.clientX, top: event.clientY, width: 0, height: 0, bottom: event.clientY + 4};
      showToolbar(rect);
    };
    host.addEventListener('contextmenu', onContextMenu);

    const onPointerDown = event => { if (event.button !== 2) hideToolbar(); };
    host.addEventListener('pointerdown', onPointerDown);

    // 中文/日文输入法组字期间不能收尾：此时读到的是未完成内容，
    // 而且撤销 contenteditable 后 IME 仍会往已变回普通元素的节点里写入。
    let composingNow = false;
    let pendingAfterCompose = null;
    const onCompositionStart = () => { composingNow = true; };
    const onCompositionEnd = () => {
      composingNow = false;
      const queued = pendingAfterCompose;
      pendingAfterCompose = null;
      if (queued) queued();
    };
    host.addEventListener('compositionstart', onCompositionStart);
    host.addEventListener('compositionend', onCompositionEnd);

    // 兜底：宿主元素若被别的逻辑摘出 DOM（视图重建、筛选、排序），
    // contenteditable 不会触发 blur，必须主动收尾，否则内容丢失且浮动工具条永久滞留。
    let commitNow = null;
    let observer = null;
    const hostParent = host.parentNode;
    if (hostParent && typeof MutationObserver === 'function') {
      observer = new MutationObserver(() => {
        if (host.isConnected) return;
        observer.disconnect();
        commitNow?.();
      });
      observer.observe(hostParent, { childList: true });
    }

    return new Promise(resolve => {
      const finish = (result, restoreHtml) => {
        if (settled) return;
        settled = true;
        doc.removeEventListener('selectionchange', onSelectionChange);
        host.removeEventListener('contextmenu', onContextMenu);
        host.removeEventListener('pointerdown', onPointerDown);
        host.removeEventListener('blur', onBlur);
        host.removeEventListener('keydown', onKeyDown);
        host.removeEventListener('compositionstart', onCompositionStart);
        host.removeEventListener('compositionend', onCompositionEnd);
        if (observer) observer.disconnect();
        controller.dispose?.();
        toolbar.remove();
        host.removeAttribute('contenteditable');
        host.removeAttribute('role');
        host.removeAttribute('aria-multiline');
        host.classList.remove('is-rich-editing');
        if (restoreHtml) host.innerHTML = originalHtml;
        resolve(result);
      };
      const commit = () => {
        if (settled) return;
        if (composingNow) { pendingAfterCompose = commit; return; }
        const value = controller.read();
        const joined = value.map(r => r.text).join('');
        if (joined === originalText && JSON.stringify(value) === JSON.stringify(normalize(runs, originalText))) { finish(null, true); return; }
        finish({text: joined, runs: value}, false);
      };
      commitNow = commit;
      const onBlur = event => {
        // 焦点只是移进工具条（含原生 select 下拉）时属于格式操作，不是编辑结束。
        // 用 relatedTarget 判断而不是 :hover —— 键盘移动焦点时根本没有 hover。
        if (event.relatedTarget && toolbar.contains(event.relatedTarget)) return;
        if (composingNow) { pendingAfterCompose = commit; return; }
        commit();
      };
      const onKeyDown = async e => {
        if (e.isComposing) return;
        if (e.key === 'Escape') {
          e.preventDefault(); e.stopPropagation();
          if (composingNow) { pendingAfterCompose = () => finish(null, true); return; }
          finish(null, true); return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          const shift = e.shiftKey;
          commit();
          onTab?.(shift);
          return;
        }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) controller.insertText('\n');
          else commit();
          return;
        }
        if (e.ctrlKey || e.metaKey) {
          const key = e.key.toLowerCase();
          if (['b','i','u','z','y'].includes(key)) {
            e.preventDefault(); e.stopPropagation();
            if (key === 'z' || key === 'y') controller.undo(e.shiftKey || key === 'y');
            else controller.format({b:'bold',i:'italic',u:'underline'}[key]);
            syncToolbar();
          }
        }
      };
      host.addEventListener('blur', onBlur);
      host.addEventListener('keydown', onKeyDown);
      function placeCaretFromPoint(doc, host, x, y) {
        let range = null;
        if (typeof x === 'number' && typeof y === 'number') {
          if (doc.caretPositionFromPoint) {
            const pos = doc.caretPositionFromPoint(x, y);
            if (pos && host.contains(pos.offsetNode)) {
              range = doc.createRange();
              range.setStart(pos.offsetNode, pos.offset);
              range.collapse(true);
            }
          } else if (doc.caretRangeFromPoint) {
            const r = doc.caretRangeFromPoint(x, y);
            if (r && host.contains(r.startContainer)) {
              range = r;
              range.collapse(true);
            }
          }
        }

        if (!range) {
          range = doc.createRange();
          range.selectNodeContents(host);
          range.collapse(false);
        }

        const selection = doc.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }

      host.focus();
      placeCaretFromPoint(doc, host, clientX, clientY);
      showToolbar(null);
      syncToolbar();
    });
  }

  const api = {normalize, html, apply, edit, inline, readElement, sizes, colors};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FrameForgeRichText = api;
})(globalThis);
