// Shared enter/leave animation for overlays.
//
// show(el): unhides and plays the element's `.is-entering` animation.
// hide(el): plays `.is-leaving`, then sets `hidden`. Resolves when it's gone.
// Calling show() while an element is still leaving cancels the exit and keeps it on screen
// without replaying the entrance, so back-to-back dialogue doesn't flicker.

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const pending = new WeakMap<HTMLElement, { timer: number; done: () => void }>();

/** Longest exit in the CSS, plus slack. A safety net in case animationend never fires. */
const MAX_LEAVE_MS = 420;

export function isLeaving(el: HTMLElement): boolean {
  return pending.has(el);
}

export function show(el: HTMLElement, opts: { replay?: boolean } = {}): void {
  const leaving = pending.get(el);
  if (leaving) {
    window.clearTimeout(leaving.timer);
    pending.delete(el);
    el.classList.remove('is-leaving');
    if (!opts.replay) return;
  } else if (!el.hidden && !opts.replay) {
    return;
  }
  el.hidden = false;
  if (reduced()) return;
  el.classList.remove('is-entering');
  void el.offsetWidth; // restart the animation
  el.classList.add('is-entering');
  const end = (e: AnimationEvent) => {
    if (e.target !== el) return;
    el.classList.remove('is-entering');
    el.removeEventListener('animationend', end);
  };
  el.addEventListener('animationend', end);
}

export function hide(el: HTMLElement): Promise<void> {
  if (el.hidden) return Promise.resolve();
  const already = pending.get(el);
  if (already) return new Promise((r) => {
    const prev = already.done;
    already.done = () => (prev(), r());
  });
  if (reduced()) {
    el.hidden = true;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    el.classList.remove('is-entering');
    el.classList.add('is-leaving');
    const entry = {
      timer: 0,
      done: () => resolve(),
    };
    const finish = () => {
      if (pending.get(el) !== entry) return;
      pending.delete(el);
      el.removeEventListener('animationend', onEnd);
      window.clearTimeout(entry.timer);
      el.classList.remove('is-leaving');
      el.hidden = true;
      entry.done();
    };
    const onEnd = (e: AnimationEvent) => {
      if (e.target === el) finish();
    };
    el.addEventListener('animationend', onEnd);
    entry.timer = window.setTimeout(finish, MAX_LEAVE_MS);
    pending.set(el, entry);
  });
}
