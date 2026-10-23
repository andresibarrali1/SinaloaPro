/** One running decode and one replaceable pending request; never a promise per seek. */
export class LatestPreview {
  private pending?: (current: () => boolean) => Promise<void>;
  private running = false;
  private version = 0;
  constructor(private readonly report: (error: unknown) => void) {}
  request(job: (current: () => boolean) => Promise<void>) {
    this.version++;
    this.pending = job;
    if (!this.running) void this.drain();
  }
  cancel() { this.version++; this.pending = undefined; }
  private async drain() {
    this.running = true;
    try {
      while (this.pending) {
        const job = this.pending, version = this.version;
        this.pending = undefined;
        try { await job(() => version === this.version); }
        catch (error) { if (version === this.version) this.report(error); }
      }
    } finally { this.running = false; }
  }
}
