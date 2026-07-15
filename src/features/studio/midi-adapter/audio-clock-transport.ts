export type AudioTimeSource = { readonly currentTime: number };

export type RuntimeTransportSnapshot = {
  state: "paused" | "playing";
  positionSeconds: number;
};

export class AudioClockTransport {
  private source: AudioTimeSource | null = null;
  private state: RuntimeTransportSnapshot["state"] = "paused";
  private offsetSeconds = 0;
  private startedAtSeconds = 0;

  start(
    source: AudioTimeSource,
    offsetSeconds: number,
    startedAtSeconds: number,
  ) {
    this.source = source;
    this.offsetSeconds = Math.max(0, offsetSeconds);
    this.startedAtSeconds = startedAtSeconds;
    this.state = "playing";
  }

  pause() {
    if (this.state !== "playing") return this.snapshot();
    this.offsetSeconds = this.snapshot().positionSeconds;
    this.state = "paused";
    return this.snapshot();
  }

  snapshot(): RuntimeTransportSnapshot {
    if (this.state !== "playing" || !this.source)
      return { state: "paused", positionSeconds: this.offsetSeconds };
    return {
      state: "playing",
      positionSeconds:
        this.offsetSeconds +
        Math.max(0, this.source.currentTime - this.startedAtSeconds),
    };
  }
}
