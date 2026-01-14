/** @format */

import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import roadTextureUrl from "../assets/road.jpg";
import { Player } from "./Player";
import { Track } from "./Track";

interface StripGroup {
  root: Mesh; // Invisible parent with shear transform
  road: Mesh; // Child at local (0, 0, 0)
  leftCurb: Mesh; // Child with X offset
  rightCurb: Mesh; // Child with X offset
  leftLandscape: Mesh; // Single mesh with modifiable vertices
  rightLandscape: Mesh; // Single mesh with modifiable vertices
}

export class Renderer {
  private stripGroups: StripGroup[] = [];
  private stripMaterials: StandardMaterial[] = [];
  private curbMaterials: StandardMaterial[] = [];
  private landscapeMaterials: StandardMaterial[] = [];
  private playerMesh: Mesh;

  private readonly visibleStrips = 100; // Number of strips to render ahead
  private readonly backwardStrips = 3; // Number of strips to render behind player
  private readonly stripDepth = 48; // Depth of each strip in world units
  private readonly curbWidth = 1; // Width of curb strips
  private readonly roadEdge = 0.83; // Must match Player.ts roadEdge

  // Colors for curbs
  private readonly curbColor1 = new Color3(0.9, 0.1, 0.1); // Red
  private readonly curbColor2 = new Color3(0.95, 0.95, 0.95); // White

  // Landscape configuration
  private readonly landscapeWidth = 1000; // Width per side
  private readonly landscapeSegments = 4; // Creates 5 vertices across
  private readonly landscapeColor1 = new Color3(0.3, 0.5, 0.2);
  private readonly landscapeColor2 = new Color3(0.4, 0.6, 0.3);

  constructor(private scene: Scene, private track: Track) {
    this.createStripGroups();
    this.playerMesh = this.createPlayerMesh();
  }

  private createStripGroups(): void {
    // Create road material with texture
    const roadMat = new StandardMaterial("roadMat", this.scene);
    const roadTexture = new Texture(
      roadTextureUrl,
      this.scene,
      false, // noMipmap
      true // invertY
    );
    roadTexture.uScale = 1;
    roadTexture.vScale = 1;
    roadMat.diffuseTexture = roadTexture;
    roadMat.specularColor = Color3.Black();
    this.stripMaterials = [roadMat, roadMat];

    // Create curb materials
    const curbMat1 = new StandardMaterial("curbMat1", this.scene);
    curbMat1.diffuseColor = this.curbColor1;
    curbMat1.specularColor = Color3.Black();

    const curbMat2 = new StandardMaterial("curbMat2", this.scene);
    curbMat2.diffuseColor = this.curbColor2;
    curbMat2.specularColor = Color3.Black();
    this.curbMaterials = [curbMat2, curbMat2];

    // Create landscape materials
    const landscapeMat1 = new StandardMaterial("landscapeMat1", this.scene);
    landscapeMat1.diffuseColor = this.landscapeColor1;
    landscapeMat1.specularColor = Color3.Black();

    const landscapeMat2 = new StandardMaterial("landscapeMat2", this.scene);
    landscapeMat2.diffuseColor = this.landscapeColor2;
    landscapeMat2.specularColor = Color3.Black();
    this.landscapeMaterials = [landscapeMat1, landscapeMat2];

    // Create strip groups (forward + backward)
    const totalStrips = this.visibleStrips + this.backwardStrips;
    for (let i = 0; i < totalStrips; i++) {
      // Create invisible root parent for the group
      const root = MeshBuilder.CreatePlane(
        `stripRoot_${i}`,
        { size: 0.001 },
        this.scene
      );
      root.visibility = 0;

      // Road mesh - child at local origin
      const road = MeshBuilder.CreateGround(
        `strip_${i}`,
        { width: 50, height: this.stripDepth },
        this.scene
      );
      road.parent = root;
      road.position = Vector3.Zero();
      road.material = this.stripMaterials[i % 2];

      // Left curb - child with X offset set per frame
      const leftCurb = MeshBuilder.CreateGround(
        `leftCurb_${i}`,
        { width: this.curbWidth, height: this.stripDepth },
        this.scene
      );
      leftCurb.parent = root;
      leftCurb.material = this.curbMaterials[i % 2];

      // Right curb - child with X offset set per frame
      const rightCurb = MeshBuilder.CreateGround(
        `rightCurb_${i}`,
        { width: this.curbWidth, height: this.stripDepth },
        this.scene
      );
      rightCurb.parent = root;
      rightCurb.material = this.curbMaterials[i % 2];

      // Landscape meshes - single mesh per side with modifiable vertices
      const leftLandscape = MeshBuilder.CreateGround(
        `leftLandscape_${i}`,
        {
          width: this.landscapeWidth,
          height: this.stripDepth,
          subdivisionsX: this.landscapeSegments,
          subdivisionsY: 1,
          updatable: true,
        },
        this.scene
      );
      leftLandscape.parent = root;
      leftLandscape.material = this.landscapeMaterials[i % 2];

      const rightLandscape = MeshBuilder.CreateGround(
        `rightLandscape_${i}`,
        {
          width: this.landscapeWidth,
          height: this.stripDepth,
          subdivisionsX: this.landscapeSegments,
          subdivisionsY: 1,
          updatable: true,
        },
        this.scene
      );
      rightLandscape.parent = root;
      rightLandscape.material = this.landscapeMaterials[i % 2];

      this.stripGroups.push({
        root,
        road,
        leftCurb,
        rightCurb,
        leftLandscape,
        rightLandscape,
      });
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
   * Apply transform to a strip group's root mesh.
   * All children inherit this transform automatically.
   */
  private applyGroupTransform(
    group: StripGroup,
    position: Vector3,
    tiltAngle: number,
    shearAmount: number,
    stretchFactor: number
  ): void {
    const shearMatrix = Matrix.FromValues(
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      shearAmount,
      0,
      1,
      0,
      0,
      0,
      0,
      1
    );
    const scaleMatrix = Matrix.Scaling(1, 1, stretchFactor);
    const rotationMatrix = Matrix.RotationX(-tiltAngle);
    const translationMatrix = Matrix.Translation(
      position.x,
      position.y,
      position.z
    );

    const worldMatrix = scaleMatrix
      .multiply(shearMatrix)
      .multiply(rotationMatrix)
      .multiply(translationMatrix);

    group.root.freezeWorldMatrix(worldMatrix);
  }

  /**
   * Update landscape mesh vertex elevations for seamless terrain.
   * Front row uses current strip's elevations, rear row uses next strip's
   * to ensure adjacent strips connect seamlessly.
   */
  private updateLandscapeElevations(
    mesh: Mesh,
    stripIndex: number,
    nextStripIndex: number
  ): void {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;

    const verticesPerRow = this.landscapeSegments + 1; // 5 vertices

    for (let i = 0; i < verticesPerRow; i++) {
      // Calculate lateral offset from road edge (0 = near road, landscapeWidth = far)
      const t = i / this.landscapeSegments;
      const lateralOffset = t * this.landscapeWidth;

      // Front row elevation (current strip)
      const frontY = this.track.getLandscapeElevation(stripIndex, lateralOffset);
      positions[i * 3 + 1] = frontY;

      // Rear row elevation (next strip's front = seamless connection)
      const rearY = this.track.getLandscapeElevation(nextStripIndex, lateralOffset);
      positions[(i + verticesPerRow) * 3 + 1] = rearY;
    }

    mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
  }

  /**
   * Update child local positions within a strip group.
   */
  private updateGroupChildren(
    group: StripGroup,
    strip: { width: number },
    stripIndex: number
  ): void {
    // Road: scale X based on strip width
    group.road.scaling.x = strip.width / 50;

    // Curbs: position at road edges
    const halfRoadWidth = this.roadEdge * strip.width * 0.5;
    const curbOffset = halfRoadWidth + this.curbWidth * 0.5;
    group.leftCurb.position.set(-curbOffset, -0.01, 0);
    group.rightCurb.position.set(curbOffset, -0.01, 0);

    // Landscape: position single meshes at curb edges
    const leftCurbEdge = -halfRoadWidth - this.curbWidth;
    const rightCurbEdge = halfRoadWidth + this.curbWidth;
    const landscapeXOffset = this.landscapeWidth / 2;
    group.leftLandscape.position.set(leftCurbEdge - landscapeXOffset, -0.02, 0);
    group.rightLandscape.position.set(rightCurbEdge + landscapeXOffset, -0.02, 0);

    // Update vertex elevations for seamless terrain
    const nextStripIndex = stripIndex + 1;
    this.updateLandscapeElevations(group.leftLandscape, stripIndex, nextStripIndex);
    this.updateLandscapeElevations(group.rightLandscape, stripIndex, nextStripIndex);

    // Update materials
    group.road.material = this.stripMaterials[stripIndex % 2];
    group.leftCurb.material = this.curbMaterials[stripIndex % 2];
    group.rightCurb.material = this.curbMaterials[stripIndex % 2];
    group.leftLandscape.material = this.landscapeMaterials[stripIndex % 2];
    group.rightLandscape.material = this.landscapeMaterials[stripIndex % 2];
  }

  public update(player: Player): void {
    const playerStripIndex = player.currentStripIndex;
    const positionInStrip = player.positionInStrip;
    const elevationScale = 4;
    const curveScale = 1;

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

    // Start from the current strip's curve state in the player coordinate system
    // This ensures the first backward strip connects to the current strip's back edge
    let backShear = cumulativeShear;
    let backOffset = cumulativeCurveOffset;
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
      const group = this.stripGroups[meshPoolIndex];

      // Skip if at track start or invalid data
      if (
        behindStripIndex < 0 ||
        isNaN(backwardCurveData[i]?.offset) ||
        isNaN(backwardElevationData[i])
      ) {
        // Hide the group
        group.root.setEnabled(false);
        continue;
      }

      const strip = this.track.getStrip(behindStripIndex);
      if (!strip) continue;

      // Enable the group
      group.root.setEnabled(true);

      // Use pre-calculated curve data
      const curveX = backwardCurveData[i].offset;
      const shearAmount = backwardCurveData[i].shear;
      const stripElevation = backwardElevationData[i];

      // Calculate Z position (negative, behind player)
      const relativeZ = -(i + positionInStrip + 1) * this.stripDepth;

      // Elevation change for this strip
      const elevationChange = strip.hill * elevationScale;

      // Tilt and stretch
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

      // Apply single transform to group root
      this.applyGroupTransform(
        group,
        new Vector3(baseX, stripY, relativeZ),
        tiltAngle,
        shearAmount,
        stretchFactor
      );

      // Update child positions and materials
      this.updateGroupChildren(group, strip, behindStripIndex);
    }

    for (let i = 0; i < this.visibleStrips; i++) {
      const stripIndex = playerStripIndex + i;
      const strip = this.track.getStrip(stripIndex);
      const group = this.stripGroups[i];

      if (!strip) continue;

      // Get elevation change for this strip
      const elevationChange = strip.hill * elevationScale;

      // Get curve values for this strip
      const curveChange = strip.curve * curveScale;
      const perStripShear = curveChange / this.stripDepth;
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
      const curveX = cumulativeCurveOffset;
      const baseX = -player.xOffset * strip.width * 0.5 + curveX;

      // Pivot compensation
      const pivotCompensation =
        Math.sin(tiltAngle) * stretchFactor * (this.stripDepth / 2);
      const stripY = cumulativeElevation - playerElevation + pivotCompensation;

      // Apply single transform to group root
      this.applyGroupTransform(
        group,
        new Vector3(baseX, stripY, relativeZ),
        tiltAngle,
        shearAmount,
        stretchFactor
      );

      // Update child positions and materials
      this.updateGroupChildren(group, strip, stripIndex);

      // Accumulate for next strip
      cumulativeElevation += elevationChange;
      cumulativeCurveOffset +=
        cumulativeShear * this.stripDepth +
        (perStripShear * this.stripDepth) / 2;
      cumulativeShear += perStripShear;
    }

    // Player mesh stays at fixed screen position (centered)
    this.playerMesh.position.x = 0;
    this.playerMesh.position.y = 0.5;
    this.playerMesh.position.z = -this.stripDepth / 2;
  }

  public dispose(): void {
    this.stripGroups.forEach((group) => {
      group.root.dispose();
      group.road.dispose();
      group.leftCurb.dispose();
      group.rightCurb.dispose();
      group.leftLandscape.dispose();
      group.rightLandscape.dispose();
    });
    this.stripMaterials.forEach((mat) => mat.dispose());
    this.curbMaterials.forEach((mat) => mat.dispose());
    this.landscapeMaterials.forEach((mat) => mat.dispose());
    this.playerMesh.dispose();
  }
}
