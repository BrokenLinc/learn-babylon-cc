export interface TrackStrip {
  index: number;
  curve: number; // Horizontal curve: -1 (left) to 1 (right), 0 = straight
  hill: number; // Vertical curve: -1 (down) to 1 (up), 0 = flat
  width: number; // Road width at this strip
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

  /**
   * Generate landscape elevation at a specific strip index and lateral position.
   * Uses deterministic sine waves for natural-looking undulating hills.
   * @param stripIndex - The track strip index
   * @param lateralOffset - Distance from road edge (0 = near road, larger = farther)
   * @returns Y elevation offset for the terrain
   */
  public getLandscapeElevation(stripIndex: number, lateralOffset: number): number {
    // Combine sine waves for natural-looking hills
    // Different frequencies create varied terrain
    return (
      Math.sin(stripIndex * 0.03 + lateralOffset * 0.01) * 5 + // Large rolling hills
      Math.sin(stripIndex * 0.07 - lateralOffset * 0.02) * 2.5 + // Medium undulation
      Math.sin(lateralOffset * 0.005) * 3 // Hills that vary with distance from road
    );
  }
}
