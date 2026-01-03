/** @format */

import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { Player } from "./Player";
import { Track } from "./Track";

export class Renderer {
  private stripMeshes: Mesh[] = [];
  private leftCurbMeshes: Mesh[] = [];
  private rightCurbMeshes: Mesh[] = [];
  private stripMaterials: StandardMaterial[] = [];
  private curbMaterials: StandardMaterial[] = [];
  private playerMesh: Mesh;

  private readonly visibleStrips = 100; // Number of strips to render ahead (halved since strips are longer)
  private readonly stripDepth = 8; // Depth of each strip in world units (doubled)
  private readonly curbWidth = 1.5; // Width of curb strips
  private readonly roadEdge = 0.4; // Must match Player.ts roadEdge

  // Colors for alternating strips
  private readonly roadColor1 = new Color3(0.3, 0.3, 0.3); // Dark gray
  private readonly roadColor2 = new Color3(0.35, 0.35, 0.35); // Slightly lighter
  private readonly curbColor1 = new Color3(0.9, 0.1, 0.1); // Red
  private readonly curbColor2 = new Color3(0.95, 0.95, 0.95); // White

  constructor(private scene: Scene, private track: Track) {
    this.createStripMeshPool();
    this.playerMesh = this.createPlayerMesh();
  }

  private createStripMeshPool(): void {
    // Create road materials for alternating strips
    const mat1 = new StandardMaterial("roadMat1", this.scene);
    mat1.diffuseColor = this.roadColor1;
    mat1.specularColor = Color3.Black();

    const mat2 = new StandardMaterial("roadMat2", this.scene);
    mat2.diffuseColor = this.roadColor2;
    mat2.specularColor = Color3.Black();

    this.stripMaterials = [mat1, mat2];

    // Create curb materials for alternating curbs
    const curbMat1 = new StandardMaterial("curbMat1", this.scene);
    curbMat1.diffuseColor = this.curbColor1;
    curbMat1.specularColor = Color3.Black();

    const curbMat2 = new StandardMaterial("curbMat2", this.scene);
    curbMat2.diffuseColor = this.curbColor2;
    curbMat2.specularColor = Color3.Black();

    this.curbMaterials = [curbMat2, curbMat2];

    // Create mesh pools
    for (let i = 0; i < this.visibleStrips; i++) {
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
      { width: 0.8, height: 1.8, depth: 2.5 },
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
    const elevationScale = 2;
    const curveScale = 0.03;

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

      // Calculate X offset: player steering + curve offset
      // curveX is already relative to player (player's position = 0)
      const curveX = cumulativeCurveOffset;
      const baseX = -player.xOffset * strip.width * 0.5 + curveX;
      const stripY = cumulativeElevation - playerElevation;

      // Calculate tilt angle based on elevation change
      const tiltAngle = Math.atan2(elevationChange, this.stripDepth);

      // Scale Z to compensate for tilt (hypotenuse length)
      const stretchFactor =
        Math.sqrt(
          this.stripDepth * this.stripDepth + elevationChange * elevationChange
        ) / this.stripDepth;

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
        new Vector3(baseX - curbOffset, stripY + 0.01, relativeZ),
        tiltAngle,
        shearAmount,
        1, // curb width is fixed
        stretchFactor
      );

      // Right curb - apply same shear transform
      this.applyShearTransform(
        rightCurb,
        new Vector3(baseX + curbOffset, stripY + 0.01, relativeZ),
        tiltAngle,
        shearAmount,
        1, // curb width is fixed
        stretchFactor
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
  }
}
