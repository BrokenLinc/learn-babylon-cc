export interface LandscapeSubsection {
  elevationOffset: number; // Relative to track elevation (for future rolling hills)
}

export interface TrackStrip {
  index: number;
  curve: number; // Horizontal curve: -1 (left) to 1 (right), 0 = straight
  hill: number; // Vertical curve: -1 (down) to 1 (up), 0 = flat
  width: number; // Road width at this strip
  leftLandscape: LandscapeSubsection[]; // 5 elements, index 0 = closest to road
  rightLandscape: LandscapeSubsection[]; // 5 elements, index 0 = closest to road
}

export class Track {
  public readonly stripLength = 20; // Each strip represents ~20 feet
  public readonly trackLength: number; // For looping mode reference

  constructor(trackLength: number = 500) {
    this.trackLength = trackLength;
  }

  /**
   * Generate strip data on-demand using deterministic math.
   * Same index always produces the same output.
   */
  private generateStrip(index: number): TrackStrip {
    // Rolling hills using combined sine waves
    const hill =
      Math.sin(index * 0.02) * 0.5 + // Long gentle hills
      Math.sin(index * 0.05) * 0.3 + // Medium hills
      Math.sin(index * 0.1) * 0.2; // Short bumps

    // Curves using sine waves (different frequencies for variety)
    const curve =
      Math.sin(index * 0.015) * 0.8 + // Long sweeping curves
      Math.sin(index * 0.04) * 0.4; // Medium curves

    return {
      index,
      curve,
      hill,
      width: 30,
      leftLandscape: Array(5)
        .fill(null)
        .map(() => ({ elevationOffset: 0 })),
      rightLandscape: Array(5)
        .fill(null)
        .map(() => ({ elevationOffset: 0 })),
    };
  }

  /**
   * Get strip data for infinite tracks (no wrapping).
   * Any index works - negative, zero, or positive.
   */
  public getStrip(index: number): TrackStrip {
    return this.generateStrip(index);
  }

  /**
   * Get strip data for looping tracks.
   * Index wraps at trackLength for seamless looping.
   */
  public getLoopedStrip(index: number): TrackStrip {
    const wrappedIndex =
      ((index % this.trackLength) + this.trackLength) % this.trackLength;
    return this.generateStrip(wrappedIndex);
  }

  public get length(): number {
    return this.trackLength;
  }

  public get totalDistance(): number {
    return this.trackLength * this.stripLength;
  }
}
