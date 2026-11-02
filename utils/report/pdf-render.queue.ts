import { AsyncLocalStorage } from 'node:async_hooks';
import puppeteer from 'puppeteer';
import type { Browser } from 'puppeteer';

// Every Chromium opened for PDF rendering (standalone conversion or shared
// render scope) is launched with the same args.
export const PUPPETEER_LAUNCH_ARGS = ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox'];

// Hard cap on Chromium processes alive at once in this process. Browsers
// killed by the OOM killer under load are the direct cause of the
// "Session closed. Most likely the page has been closed." failures, so more
// concurrency is never better. PDF_MAX_CONCURRENT_BROWSERS overrides it.
function getMaxConcurrentBrowsers(): number {
  const configured = Number(process.env.PDF_MAX_CONCURRENT_BROWSERS);
  return Number.isFinite(configured) && configured > 0 ? configured : 2;
}

// How long a conversion may wait in the render queue once the cap is full.
// Waiting until the reverse proxy kills the request is not acceptable: when
// the wait expires a PdfRenderQueueTimeoutError is thrown so callers can
// answer a clean 503. PDF_QUEUE_WAIT_MS overrides it.
function getQueueWaitMs(): number {
  const configured = Number(process.env.PDF_QUEUE_WAIT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 20000;
}

// Total wall-clock budget of one convertMarkupToPdf call, including the queue
// wait of each of its attempts. A retry is only granted the remaining budget
// for its queue wait, never a fresh full wait. PDF_RENDER_BUDGET_MS
// overrides it.
export function getPdfRenderBudgetMs(): number {
  const configured = Number(process.env.PDF_RENDER_BUDGET_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 45000;
}

export class PdfRenderQueueTimeoutError extends Error {
  constructor(allowedWaitMs: number, maxConcurrentBrowsers: number) {
    super(`PDF render queue wait exceeded ${allowedWaitMs}ms (max ${maxConcurrentBrowsers} concurrent browsers)`);
    this.name = 'PdfRenderQueueTimeoutError';
  }
}

// ---------------------------------------------------------------- queue ----

let activeBrowserSlots = 0;

interface BrowserSlotWaiter {
  done: boolean;
  timer: ReturnType<typeof setTimeout>;
  grant: () => void;
}

const browserSlotWaiters: BrowserSlotWaiter[] = [];

// Blocks until one of the PDF_MAX_CONCURRENT_BROWSERS slots is free. Waits are
// FIFO and bounded by the smaller of PDF_QUEUE_WAIT_MS and the remaining time
// of the calling request's render budget; expiring gives a
// PdfRenderQueueTimeoutError and never launches a browser.
export async function acquireBrowserSlot(queueDeadline: number): Promise<void> {
  const maxConcurrentBrowsers = getMaxConcurrentBrowsers();
  if (activeBrowserSlots < maxConcurrentBrowsers) {
    activeBrowserSlots++;
    return;
  }

  const allowedWaitMs = Math.min(getQueueWaitMs(), Math.max(0, queueDeadline - Date.now()));
  if (allowedWaitMs <= 0) {
    throw new PdfRenderQueueTimeoutError(0, maxConcurrentBrowsers);
  }

  await new Promise<void>((resolve, reject) => {
    let waiter: BrowserSlotWaiter;
    const timer = setTimeout(() => {
      // Timed out: leave the queue without ever getting a slot, so a later
      // release can't grant one to a dead waiter (that would leak it).
      if (waiter.done) {
        return;
      }
      const index = browserSlotWaiters.indexOf(waiter);
      if (index !== -1) {
        browserSlotWaiters.splice(index, 1);
      }
      waiter.done = true;
      reject(new PdfRenderQueueTimeoutError(allowedWaitMs, maxConcurrentBrowsers));
    }, allowedWaitMs);
    waiter = {
      done: false,
      timer,
      grant: () => {
        waiter.done = true;
        clearTimeout(timer);
        const index = browserSlotWaiters.indexOf(waiter);
        if (index !== -1) {
          browserSlotWaiters.splice(index, 1);
        }
        activeBrowserSlots++;
        resolve();
      },
    };
    browserSlotWaiters.push(waiter);
  });
}

// Frees the slot granted by acquireBrowserSlot and hands it to the
// longest-waiting live waiter. Must be called exactly once for every granted
// acquire, on every path (success, thrown error, retry); a leaked slot would
// deadlock all PDF rendering in this process.
export function releaseBrowserSlot(): void {
  if (activeBrowserSlots > 0) {
    activeBrowserSlots--;
  }
  while (browserSlotWaiters.length > 0) {
    const waiter = browserSlotWaiters.shift();
    if (!waiter.done) {
      waiter.grant();
      return;
    }
  }
}

// ------------------------------------------------------------- scope ----

// One render scope per bulk report: a single browser owned by the report,
// reused via a new page for every row, closed once when the scope ends (also
// on the error path). A retry relaunches it at most once and the remaining
// rows continue on the fresh browser - no orphan browsers left behind.
export interface PdfRenderScope {
  getBrowser(queueDeadline: number): Promise<Browser>;
  restartBrowser(queueDeadline: number): Promise<Browser>;
  closeBrowsers(): Promise<void>;
}

class PdfRenderScopeImpl implements PdfRenderScope {
  private browser: Browser = null;
  private slotHeld = false;

  async getBrowser(queueDeadline: number): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }
    return this.launchAndHold(queueDeadline);
  }

  async restartBrowser(queueDeadline: number): Promise<Browser> {
    const deadBrowser = this.browser;
    this.browser = null;
    if (deadBrowser) {
      // The dead browser's close() can itself reject - the retry must not be
      // masked by it. The report keeps its slot: relaunching only replaces the
      // process behind it.
      try {
        await deadBrowser.close();
      } catch {}
    }
    return this.launchAndHold(queueDeadline);
  }

  async closeBrowsers(): Promise<void> {
    const browser = this.browser;
    this.browser = null;
    if (browser) {
      // Same as everywhere else: a dying browser's close() may reject and must
      // not mask the report result or the report error.
      try {
        await browser.close();
      } catch {}
    }
    if (this.slotHeld) {
      this.slotHeld = false;
      releaseBrowserSlot();
    }
  }

  private async launchAndHold(queueDeadline: number): Promise<Browser> {
    // A relaunch (restartBrowser) replaces the process behind an already-held
    // slot and must NOT take a second one - that would leak a slot and slowly
    // deadlock all PDF rendering.
    const acquiredSlot = !this.slotHeld;
    if (acquiredSlot) {
      await acquireBrowserSlot(queueDeadline);
      this.slotHeld = true;
    }
    try {
      this.browser = await puppeteer.launch({ args: PUPPETEER_LAUNCH_ARGS });
    } catch (e) {
      if (acquiredSlot) {
        this.slotHeld = false;
        releaseBrowserSlot();
      }
      throw e;
    }
    return this.browser;
  }
}

const pdfRenderScopeStorage = new AsyncLocalStorage<PdfRenderScope>();

export function getPdfRenderScope(): PdfRenderScope | null {
  return pdfRenderScopeStorage.getStore() ?? null;
}

// Opens a render scope and guarantees its single browser is closed once the
// loop inside finishes or throws, without letting a failing close() mask the
// loop result or the loop error.
export async function runPdfRenderScope<T>(render: () => Promise<T>): Promise<T> {
  const scope = new PdfRenderScopeImpl();
  try {
    return await pdfRenderScopeStorage.run(scope, render);
  } finally {
    await scope.closeBrowsers();
  }
}