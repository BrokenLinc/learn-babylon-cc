export interface TrackStrip {
  index: number;
  curve: number;      // Horizontal curve: -1 (left) to 1 (right), 0 = straight
  hill: number;       // Vertical curve (future): -1 (down) to 1 (up), 0 = flat
  width: number;      // Road width at this strip
}

export class Track {
  public strips: TrackStrip[] = [];
  public readonly stripLength = 20; // Each strip represents ~20 feet

  constructor(numStrips: number = 500) {
    this.generateTrack(numStrips);
  }

  private generateTrack(numStrips: number): void {
    for (let i = 0; i < numStrips; i++) {
      // Generate rolling hills using combined sine waves
      const hill =
        Math.sin(i * 0.02) * 0.5 +          // Long gentle hills
        Math.sin(i * 0.05) * 0.3 +          // Medium hills
        Math.sin(i * 0.1) * 0.2;            // Short bumps

      // Generate curves using sine waves (different frequencies for variety)
      const curve =
        Math.sin(i * 0.015) * 0.8 +         // Long sweeping curves
        Math.sin(i * 0.04) * 0.4;           // Medium curves

      this.strips.push({
        index: i,
        curve: curve,   // Horizontal curve
        hill: hill,     // Elevation change rate
        width: 30,      // Road width in game units
      });
    }
  }

  public getStrip(index: number): TrackStrip | undefined {
    // Handle track looping
    const wrappedIndex = ((index % this.strips.length) + this.strips.length) % this.strips.length;
    return this.strips[wrappedIndex];
  }

  public get length(): number {
    return this.strips.length;
  }

  public get totalDistance(): number {
    return this.strips.length * this.stripLength;
  }
}
