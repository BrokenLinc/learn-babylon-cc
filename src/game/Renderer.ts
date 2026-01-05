/** @format */

import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import roadTextureUrl from "../assets/road.jpg";
import { Landscape } from "./Landscape";
import { Player } from "./Player";
import { Track } from "./Track";

export class Renderer {
  private stripMeshes: Mesh[] = [];
  private leftCurbMeshes: Mesh[] = [];
  private rightCurbMeshes: Mesh[] = [];
  private stripMaterials: StandardMaterial[] = [];
  private curbMaterials: StandardMaterial[] = [];
  private playerMesh: Mesh;
  private landscape: Landscape;

  private readonly visibleStrips = 100; // Number of strips to render ahead (halved since strips are longer)
  private readonly backwardStrips = 3; // Number of strips to render behind player
  private readonly stripDepth = 48; // Depth of each strip in world units (doubled)
  private readonly curbWidth = 1; // Width of curb strips
  private readonly roadEdge = 0.83; // Must match Player.ts roadEdge

  // Colors for curbs
  private readonly curbColor1 = new Color3(0.9, 0.1, 0.1); // Red
  private readonly curbColor2 = new Color3(0.95, 0.95, 0.95); // White

  constructor(private scene: Scene, private track: Track) {
    this.createStripMeshPool();
    this.playerMesh = this.createPlayerMesh();
    this.landscape = new Landscape(
      this.scene,
      this.visibleStrips,
      this.stripDepth,
      this.backwardStrips
    );
  }

  private createStripMeshPool(): void {
    // Create road material with texture
    const roadMat = new StandardMaterial("roadMat", this.scene);
    // Create texture without mipmaps for sharp rendering at distance
    const roadTexture = new Texture(
      roadTextureUrl,
      this.scene,
      false, // noMipmap - disable mipmapping for sharp textures
      true // invertY
    );
    // Use nearest neighbor sampling for pixel-perfect sharpness
    // roadTexture.updateSamplingMode(Texture.NEAREST_NEAREST);
    // The texture is oriented up/down, so V scale controls repetition along the strip
    roadTexture.uScale = 1;
    roadTexture.vScale = 1;
    roadMat.diffuseTexture = roadTexture;
    roadMat.specularColor = Color3.Black();

    // Use same material for all strips (texture provides visual variety)
    this.stripMaterials = [roadMat, roadMat];

    // Create curb materials for alternating curbs
    const curbMat1 = new StandardMaterial("curbMat1", this.scene);
    curbMat1.diffuseColor = this.curbColor1;
    curbMat1.specularColor = Color3.Black();

    const curbMat2 = new StandardMaterial("curbMat2", this.scene);
    curbMat2.diffuseColor = this.curbColor2;
    curbMat2.specularColor = Color3.Black();

    this.curbMaterials = [curbMat2, curbMat2];

    // Create mesh pools (forward + backward strips)
    const totalStrips = this.visibleStrips + this.backwardStrips;
    for (let i = 0; i < totalStrips; i++) {
      // Main road strip
      const strip = MeshBuilder.CreateGround(
        `strip_${i}`,
        { width: 50, height: this.stripDepth },
        this.scene
      );
      strip.material = this.stripMaterials[i % 2];
      this.stripMeshes.push(strip);

      // Left curb
      const leftCurb = MeshBuilder.CreateGround(
        `leftCurb_${i}`,
        { width: this.curbWidth, height: this.stripDepth },
        this.scene
      );
      leftCurb.material = this.curbMaterials[i % 2];
      this.leftCurbMeshes.push(leftCurb);

      // Right curb
      const rightCurb = MeshBuilder.CreateGround(
        `rightCurb_${i}`,
        { width: this.curbWidth, height: this.stripDepth },
        this.scene
      );
      rightCurb.material = this.curbMaterials[i % 2];
      this.rightCurbMeshes.push(rightCurb);
    }
  }

  private createPlayerMesh(): Mesh {
    // Motorbike-shaped bounding box: thin and tall
    const player = MeshBuilder.CreateBox(
      "player",
      { width: 3, height: 7, depth: 0.1 },
      this.scene
    );
    const mat = new StandardMaterial("playerMat", this.scene);
    mat.diffuseColor = new Color3(0, 0.5, 1);
    mat.specularColor = Color3.Black();
    player.material = mat;
    return player;
  }

  /**
   * Apply a transformation matrix with shear to a mesh.
   * Shear skews the mesh so that X position changes based on Z position.
   * This creates a true parallelogram shape rather than a rotated rectangle.
   */
  private applyShearTransform(
    mesh: Mesh,
    position: Vector3,
    tiltAngle: number,
    shearAmount: number,
    scaleX: number,
    scaleZ: number
  ): void {
    // Build transformation matrix with shear
    // Shear matrix: X += shearAmount * Z
    const shearMatrix = Matrix.FromValues(
      1,
      0,
      0,
      0, // column 0 (X basis)
      0,
      1,
      0,
      0, // column 1 (Y basis)
      shearAmount,
      0,
      1,
      0, // column 2 (Z basis) - shear adds to X
      0,
      0,
      0,
      1 // column 3 (W)
    );

    // Scale matrix
    const scaleMatrix = Matrix.Scaling(scaleX, 1, scaleZ);

    // Rotation matrix (tilt around X axis for elevation)
    const rotationMatrix = Matrix.RotationX(-tiltAngle);

    // Translation matrix
    const translationMatrix = Matrix.Translation(
      position.x,
      position.y,
      position.z
    );

    // Combine: Scale -> Shear -> Rotate -> Translate
    const worldMatrix = scaleMatrix
      .multiply(shearMatrix)
      .multiply(rotationMatrix)
      .multiply(translationMatrix);

    // Freeze the world matrix to this custom transform
    mesh.freezeWorldMatrix(worldMatrix);
  }

  public update(player: Player): void {
    const playerStripIndex = player.currentStripIndex;
    const positionInStrip = player.positionInStrip;
    const elevationScale = 4;
    const curveScale = 0.5;

    // Calculate player's current elevation by accumulating hill values
    let playerElevation = 0;
    for (let i = 0; i < playerStripIndex; i++) {
      const strip = this.track.getStrip(i);
      if (strip) {
        playerElevation += strip.hill * elevationScale;
      }
    }
    // Add partial elevation for current strip (smooth interpolation)
    const currentStrip = this.track.getStrip(playerStripIndex);
    if (currentStrip) {
      playerElevation += currentStrip.hill * elevationScale * positionInStrip;
    }

    // cumulativeElevation should start at the START of the current strip
    let cumulativeElevation = playerElevation;
    if (currentStrip) {
      cumulativeElevation -=
        currentStrip.hill * elevationScale * positionInStrip;
    }

    // Initialize cumulative shear and offset with player position as zero point
    // Both must be coordinated for strips to connect edge-to-edge
    let cumulativeCurveOffset = 0;
    let cumulativeShear = 0;
    if (currentStrip) {
      const fullShear = (currentStrip.curve * curveScale) / this.stripDepth;
      // Shear at player position: back out partial strip
      cumulativeShear = -fullShear * positionInStrip;
      // Offset ensures X=0 at player's position within the strip
      // Player's local Z = (positionInStrip - 0.5) * depth
      cumulativeCurveOffset =
        -cumulativeShear * (positionInStrip - 0.5) * this.stripDepth;
    }

    // Pre-calculate backward strip curve and elevation data
    // We need to reverse the accumulation formulas to find values at earlier positions
    const backwardCurveData: { offset: number; shear: number }[] = [];
    const backwardElevationData: number[] = [];

    // Start from the beginning of the current strip (positionInStrip = 0)
    // At that point, cumulativeShear and cumulativeCurveOffset would both be 0
    let backShear = 0;
    let backOffset = 0;
    let backElevation = cumulativeElevation; // Elevation at start of current strip

    for (let i = 0; i < this.backwardStrips; i++) {
      const behindStripIndex = playerStripIndex - i - 1;

      // Handle track start boundary - can't render strips that don't exist
      if (behindStripIndex < 0) {
        backwardCurveData.push({ offset: NaN, shear: NaN });
        backwardElevationData.push(NaN);
        continue;
      }

      const behindStrip = this.track.getStrip(behindStripIndex);
      if (!behindStrip) {
        backwardCurveData.push({ offset: NaN, shear: NaN });
        backwardElevationData.push(NaN);
        continue;
      }

      // Get the per-strip shear for this behind strip
      const behindCurveChange = behindStrip.curve * curveScale;
      const behindPerStripShear = behindCurveChange / this.stripDepth;

      // Reverse the accumulation formulas:
      // Forward: shear[n+1] = shear[n] + perStripShear[n]
      // Reverse: shear[n-1] = shear[n] - perStripShear[n-1]
      backShear -= behindPerStripShear;

      // Forward: offset[n+1] = offset[n] + shear[n] * depth + perStripShear[n] * depth / 2
      // Reverse: offset[n-1] = offset[n] - shear[n-1] * depth - perStripShear[n-1] * depth / 2
      backOffset -=
        backShear * this.stripDepth +
        (behindPerStripShear * this.stripDepth) / 2;

      // Reverse elevation: subtract the behind strip's elevation contribution
      backElevation -= behindStrip.hill * elevationScale;

      backwardCurveData.push({ offset: backOffset, shear: backShear });
      backwardElevationData.push(backElevation);
    }

    // Render backward strips (behind player)
    for (let i = 0; i < this.backwardStrips; i++) {
      const behindStripIndex = playerStripIndex - i - 1;
      const meshPoolIndex = this.visibleStrips + i;

      // Skip if at track start or invalid data
      if (
        behindStripIndex < 0 ||
        isNaN(backwardCurveData[i]?.offset) ||
        isNaN(backwardElevationData[i])
      ) {
        // Hide these meshes
        this.stripMeshes[meshPoolIndex].setEnabled(false);
        this.leftCurbMeshes[meshPoolIndex].setEnabled(false);
        this.rightCurbMeshes[meshPoolIndex].setEnabled(false);
        this.landscape.hideStrip(meshPoolIndex);
        continue;
      }

      const strip = this.track.getStrip(behindStripIndex);
      if (!strip) continue;

      const mesh = this.stripMeshes[meshPoolIndex];
      const leftCurb = this.leftCurbMeshes[meshPoolIndex];
      const rightCurb = this.rightCurbMeshes[meshPoolIndex];

      // Enable meshes
      mesh.setEnabled(true);
      leftCurb.setEnabled(true);
      rightCurb.setEnabled(true);
      this.landscape.showStrip(meshPoolIndex);

      // Use pre-calculated curve data
      const curveX = backwardCurveData[i].offset;
      const shearAmount = backwardCurveData[i].shear;
      const stripElevation = backwardElevationData[i];

      // Calculate Z position (negative, behind player)
      // Strip i=0 is immediately behind player, its far edge should be at positionInStrip
      const relativeZ = -(i + 1 - positionInStrip + 0.5) * this.stripDepth;

      // Elevation change for this strip
      const elevationChange = strip.hill * elevationScale;

      // Tilt and stretch (same as forward)
      const tiltAngle = Math.atan2(elevationChange, this.stripDepth);
      const stretchFactor =
        Math.sqrt(
          this.stripDepth * this.stripDepth + elevationChange * elevationChange
        ) / this.stripDepth;

      // X position
      const baseX = -player.xOffset * strip.width * 0.5 + curveX;

      // Y position with pivot compensation
      const pivotCompensation =
        Math.sin(tiltAngle) * stretchFactor * (this.stripDepth / 2);
      const stripY = stripElevation - playerElevation + pivotCompensation;

      // Width scale
      const scaleX = strip.width / 50;

      // Apply transforms
      this.applyShearTransform(
        mesh,
        new Vector3(baseX, stripY, relativeZ),
        tiltAngle,
        shearAmount,
        scaleX,
        stretchFactor
      );

      // Position curbs at road edges
      const curbOffset =
        this.roadEdge * strip.width * 0.5 + this.curbWidth * 0.5;

      this.applyShearTransform(
        leftCurb,
        new Vector3(baseX - curbOffset, stripY - 0.01, relativeZ),
        tiltAngle,
        shearAmount,
        1,
        stretchFactor
      );

      this.applyShearTransform(
        rightCurb,
        new Vector3(baseX + curbOffset, stripY - 0.01, relativeZ),
        tiltAngle,
        shearAmount,
        1,
        stretchFactor
      );

      // Update landscape
      this.landscape.updateStrip(
        meshPoolIndex,
        behindStripIndex,
        strip,
        baseX,
        stripY,
        relativeZ,
        tiltAngle,
        shearAmount,
        stretchFactor,
        this.roadEdge,
        this.curbWidth
      );

      // Update materials based on strip index for alternating colors
      mesh.material = this.stripMaterials[behindStripIndex % 2];
      leftCurb.material = this.curbMaterials[behindStripIndex % 2];
      rightCurb.material = this.curbMaterials[behindStripIndex % 2];
    }

    for (let i = 0; i < this.visibleStrips; i++) {
      const stripIndex = playerStripIndex + i;
      const strip = this.track.getStrip(stripIndex);
      const mesh = this.stripMeshes[i];
      const leftCurb = this.leftCurbMeshes[i];
      const rightCurb = this.rightCurbMeshes[i];

      if (!strip) continue;

      // Get elevation change for this strip
      const elevationChange = strip.hill * elevationScale;

      // Get curve values for this strip
      const curveChange = strip.curve * curveScale;
      // Per-strip shear for accumulation
      const perStripShear = curveChange / this.stripDepth;
      // Use cumulative shear - player position is zero point
      const shearAmount = cumulativeShear;

      // Calculate Z position relative to player
      const relativeZ = (i - positionInStrip) * this.stripDepth;

      // Calculate tilt angle based on elevation change
      const tiltAngle = Math.atan2(elevationChange, this.stripDepth);

      // Scale Z to compensate for tilt (hypotenuse length)
      const stretchFactor =
        Math.sqrt(
          this.stripDepth * this.stripDepth + elevationChange * elevationChange
        ) / this.stripDepth;

      // Calculate X offset: player steering + curve offset
      // curveX is already relative to player (player's position = 0)
      const curveX = cumulativeCurveOffset;
      const baseX = -player.xOffset * strip.width * 0.5 + curveX;

      // Pivot compensation: strips rotate around center, but we position by near edge
      // When tilted, the near edge drops down by sin(tilt) * scaledDepth/2
      // Compensate by shifting the strip up so near edge lands at correct elevation
      const pivotCompensation =
        Math.sin(tiltAngle) * stretchFactor * (this.stripDepth / 2);
      const stripY = cumulativeElevation - playerElevation + pivotCompensation;

      // Scale width based on track data
      const scaleX = strip.width / 50;

      // Apply shear transform to main road strip
      this.applyShearTransform(
        mesh,
        new Vector3(baseX, stripY, relativeZ),
        tiltAngle,
        shearAmount,
        scaleX,
        stretchFactor
      );

      // Position curbs at road edges
      const curbOffset =
        this.roadEdge * strip.width * 0.5 + this.curbWidth * 0.5;

      // Left curb - apply same shear transform
      this.applyShearTransform(
        leftCurb,
        new Vector3(baseX - curbOffset, stripY - 0.01, relativeZ),
        tiltAngle,
        shearAmount,
        1, // curb width is fixed
        stretchFactor
      );

      // Right curb - apply same shear transform
      this.applyShearTransform(
        rightCurb,
        new Vector3(baseX + curbOffset, stripY - 0.01, relativeZ),
        tiltAngle,
        shearAmount,
        1, // curb width is fixed
        stretchFactor
      );

      // Update landscape strips
      this.landscape.updateStrip(
        i,
        stripIndex,
        strip,
        baseX,
        stripY,
        relativeZ,
        tiltAngle,
        shearAmount,
        stretchFactor,
        this.roadEdge,
        this.curbWidth
      );

      // Accumulate for next strip
      cumulativeElevation += elevationChange;
      // Offset must account for current shear's effect on edge position
      // Formula: shear_N * depth + perStripShear * depth/2
      cumulativeCurveOffset +=
        cumulativeShear * this.stripDepth +
        (perStripShear * this.stripDepth) / 2;
      cumulativeShear += perStripShear;

      // Update materials based on strip index for alternating colors
      mesh.material = this.stripMaterials[stripIndex % 2];
      leftCurb.material = this.curbMaterials[stripIndex % 2];
      rightCurb.material = this.curbMaterials[stripIndex % 2];
    }

    // Player mesh stays at fixed screen position (centered)
    this.playerMesh.position.x = 0;
    this.playerMesh.position.y = 0.5;
    this.playerMesh.position.z = 2;
  }

  public dispose(): void {
    this.stripMeshes.forEach((mesh) => mesh.dispose());
    this.leftCurbMeshes.forEach((mesh) => mesh.dispose());
    this.rightCurbMeshes.forEach((mesh) => mesh.dispose());
    this.stripMaterials.forEach((mat) => mat.dispose());
    this.curbMaterials.forEach((mat) => mat.dispose());
    this.playerMesh.dispose();
    this.landscape.dispose();
  }
}
