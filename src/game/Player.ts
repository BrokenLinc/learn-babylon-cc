/** @format */

import { Track } from "./Track";

export class Player {
  public distance: number = 0; // Distance traveled down the track
  public velocity: number = 0; // Current speed (units per second)
  public xOffset: number = 0; // Lateral position (-1 to 1, where ~0.5 is road edge)

  private readonly maxSpeed = 500; // Maximum velocity on road (increased for acceleration curve)
  private readonly offRoadMaxSpeed = 250; // Maximum velocity off-road (half)
  private readonly acceleration = 200; // Base acceleration rate
  private readonly deceleration = 100; // Natural deceleration (drag)
  private readonly braking = 200; // Braking deceleration
  private readonly baseSteerSpeed = 1; // Base lateral movement speed
  private readonly roadEdge = 0.4; // xOffset beyond this is off-road
  private readonly curveForce = 0.002; // How strongly curves affect lateral position

  constructor(private track: Track) {}

  public get isOffRoad(): boolean {
    return Math.abs(this.xOffset) > this.roadEdge;
  }

  public update(
    deltaTime: number,
    input: {
      accelerate: boolean;
      brake: boolean;
      steerLeft: boolean;
      steerRight: boolean;
    }
  ): void {
    // Determine current max speed based on terrain
    const currentMaxSpeed = this.isOffRoad
      ? this.offRoadMaxSpeed
      : this.maxSpeed;

    // Handle acceleration/braking
    if (input.accelerate) {
      // Diminishing acceleration as speed approaches max (asymptotic)
      const speedRatio = this.velocity / currentMaxSpeed;
      const effectiveAcceleration = this.acceleration * (1 - speedRatio);
      this.velocity += effectiveAcceleration * deltaTime;
    } else if (input.brake) {
      this.velocity -= this.braking * deltaTime;
    } else {
      // Natural deceleration
      this.velocity -= this.deceleration * deltaTime;
    }

    // If off-road and above off-road max speed, apply extra drag to slow down
    if (this.isOffRoad && this.velocity > this.offRoadMaxSpeed) {
      this.velocity -= this.deceleration * 2 * deltaTime;
    }

    // Clamp velocity to current max speed
    this.velocity = Math.max(0, Math.min(currentMaxSpeed, this.velocity));

    // Update distance
    this.distance += this.velocity * deltaTime;

    // Velocity-based steering: steering sensitivity scales with speed
    // At 0 speed = no steering, at max speed = full steering
    const speedRatio = this.velocity / this.maxSpeed;
    const steerSpeed = this.baseSteerSpeed * speedRatio;

    // Handle steering
    if (input.steerLeft) {
      this.xOffset -= steerSpeed * deltaTime;
    }
    if (input.steerRight) {
      this.xOffset += steerSpeed * deltaTime;
    }

    // Apply curve force - track curvature pushes player laterally
    const currentStrip = this.track.getStrip(this.currentStripIndex);
    if (currentStrip) {
      // Force scales with velocity - faster = stronger curve effect
      const curveEffect =
        currentStrip.curve * this.velocity * this.curveForce * deltaTime;
      this.xOffset -= curveEffect;
    }

    // Soft clamp lateral position (allow going off-road but not too far)
    this.xOffset = Math.max(-1.5, Math.min(1.5, this.xOffset));

    // Loop track
    if (this.distance >= this.track.totalDistance) {
      this.distance -= this.track.totalDistance;
    }
  }

  public get currentStripIndex(): number {
    return Math.floor(this.distance / this.track.stripLength);
  }

  public get positionInStrip(): number {
    return (this.distance % this.track.stripLength) / this.track.stripLength;
  }
}
