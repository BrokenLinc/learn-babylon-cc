/** @format */

import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { SpotLight } from "@babylonjs/core/Lights/spotLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import dirtTextureUrl from "../assets/dirt-1.png";
import pine1Url from "../assets/pine-1.png";
import pine2Url from "../assets/pine-2.png";
import pine3Url from "../assets/pine-3.png";
import pine4Url from "../assets/pine-4.png";
import pine5Url from "../assets/pine-5.png";
import pine6Url from "../assets/pine-6.png";
import pine7Url from "../assets/pine-7.png";
import pine8Url from "../assets/pine-8.png";
import pine9Url from "../assets/pine-9.png";
import roadTextureUrl from "../assets/road.jpg";
import { Player } from "./Player";
import { Track } from "./Track";

const pineUrls = [
  pine1Url,
  pine2Url,
  pine3Url,
  pine4Url,
  pine5Url,
  pine6Url,
  pine7Url,
  pine8Url,
  pine9Url,
];

// Sprite dimensions [width, height] - matching source PNGs
const pineSizes: [number, number][] = [
  [130, 249], // pine-1
  [91, 234], // pine-2
  [98, 204], // pine-3
  [98, 177], // pine-4
  [98, 248], // pine-5
  [69, 221], // pine-6
  [64, 243], // pine-7
  [43, 31], // pine-8 (small bush)
  [32, 21], // pine-9 (tiny bush)
];

interface StripGroup {
  root: Mesh; // Invisible parent with shear transform
  road: Mesh; // Child at local (0, 0, 0)
  leftCurb: Mesh; // Child with X offset
  rightCurb: Mesh; // Child with X offset
  leftLandscape: Mesh; // Single mesh with modifiable vertices
  rightLandscape: Mesh; // Single mesh with modifiable vertices
  leftTrees: Mesh[]; // Tree billboard sprites on left
  rightTrees: Mesh[]; // Tree billboard sprites on right
}

export class Renderer {
  private stripGroups: StripGroup[] = [];
  private stripMaterials: StandardMaterial[] = [];
  private curbMaterials: StandardMaterial[] = [];
  private landscapeMaterials: StandardMaterial[] = [];
  private treeMaterials: StandardMaterial[] = [];
  private playerMesh: Mesh;
  private headlight: SpotLight;

  private readonly visibleStrips = 80; // Number of strips to render ahead
  private readonly backwardStrips = 3; // Number of strips to render behind player
  private readonly stripDepth = 48; // Depth of each strip in world units
  private readonly curbWidth = 1; // Width of curb strips
  private readonly roadEdge = 0.83; // Must match Player.ts roadEdge

  // Colors for curbs
  private readonly curbColor1 = new Color3(0.9, 0.1, 0.1); // Red
  private readonly curbColor2 = new Color3(0.95, 0.95, 0.95); // White

  // Landscape configuration
  private readonly landscapeWidth = 1200; // Width per side
  private readonly landscapeSegments = 34; // Creates 5 vertices across
  private readonly landscapeColor1 = new Color3(0.3, 0.5, 0.2);
  private readonly landscapeColor2 = new Color3(0.4, 0.6, 0.3);

  // Tree configuration
  private readonly treesPerSide = 6; // Trees per strip side
  private readonly treeBaseWidth = 40; // Base sprite width
  private readonly treeBaseHeight = 60; // Base sprite height
  private readonly treeMinDistance = 20; // Min distance from road edge

  constructor(private scene: Scene, private track: Track) {
    this.createStripGroups();
    this.playerMesh = this.createPlayerMesh();
    this.headlight = this.createHeadlight();
  }

  private createHeadlight(): SpotLight {
    // Create a spotlight as headlight, shining down the track
    const headlight = new SpotLight(
      "headlight",
      new Vector3(0, 8, 0), // Position above player
      new Vector3(0, -0.1, 1), // Direction: slightly down, forward
      Math.PI / 6, // Angle: 60 degrees cone
      2, // Exponent: how focused the light is
      this.scene
    );
    headlight.intensity = 2;
    headlight.diffuse = new Color3(1, 0.95, 0.8); // Warm white
    headlight.range = 800; // How far the light reaches
    return headlight;
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

    // Create landscape materials with dirt texture
    const dirtTexture1 = new Texture(dirtTextureUrl, this.scene);
    dirtTexture1.uScale = 20; // Tile texture across landscape
    dirtTexture1.vScale = 1;

    const landscapeMat1 = new StandardMaterial("landscapeMat1", this.scene);
    landscapeMat1.diffuseTexture = dirtTexture1;
    landscapeMat1.diffuseColor = this.landscapeColor1;
    landscapeMat1.specularColor = Color3.Black();

    const dirtTexture2 = new Texture(dirtTextureUrl, this.scene);
    dirtTexture2.uScale = 20;
    dirtTexture2.vScale = 1;

    const landscapeMat2 = new StandardMaterial("landscapeMat2", this.scene);
    landscapeMat2.diffuseTexture = dirtTexture2;
    landscapeMat2.diffuseColor = this.landscapeColor2;
    landscapeMat2.specularColor = Color3.Black();
    this.landscapeMaterials = [landscapeMat1, landscapeMat2];

    // Create tree materials (9 sprites × 3 tints = 27 total)
    const tints = [
      new Color3(1.0, 1.0, 1.0), // Normal
      new Color3(0.85, 0.95, 0.85), // Slightly blue-green
      new Color3(1.0, 0.95, 0.9), // Slightly warm
    ];
    for (let spriteIdx = 0; spriteIdx < 7; spriteIdx++) {
      for (let tintIdx = 0; tintIdx < tints.length; tintIdx++) {
        const mat = new StandardMaterial(
          `treeMat_${spriteIdx}_${tintIdx}`,
          this.scene
        );
        const tex = new Texture(pineUrls[spriteIdx], this.scene);
        tex.hasAlpha = true;
        mat.diffuseTexture = tex;
        mat.useAlphaFromDiffuseTexture = true;
        mat.diffuseColor = tints[tintIdx];
        mat.specularColor = Color3.Black();
        mat.backFaceCulling = false;
        this.treeMaterials.push(mat);
      }
    }

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

      // Tree meshes - billboard sprites on each side
      const leftTrees: Mesh[] = [];
      const rightTrees: Mesh[] = [];
      for (let t = 0; t < this.treesPerSide; t++) {
        const leftTree = MeshBuilder.CreatePlane(
          `leftTree_${i}_${t}`,
          { width: this.treeBaseWidth, height: this.treeBaseHeight },
          this.scene
        );
        leftTree.parent = root;
        leftTree.billboardMode = Mesh.BILLBOARDMODE_Y;
        leftTree.material = this.treeMaterials[0]; // Default, updated per frame
        leftTrees.push(leftTree);

        const rightTree = MeshBuilder.CreatePlane(
          `rightTree_${i}_${t}`,
          { width: this.treeBaseWidth, height: this.treeBaseHeight },
          this.scene
        );
        rightTree.parent = root;
        rightTree.billboardMode = Mesh.BILLBOARDMODE_Y;
        rightTree.material = this.treeMaterials[0]; // Default, updated per frame
        rightTrees.push(rightTree);
      }

      this.stripGroups.push({
        root,
        road,
        leftCurb,
        rightCurb,
        leftLandscape,
        rightLandscape,
        leftTrees,
        rightTrees,
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
   * Accounts for strip rotation transforms to ensure adjacent strips connect seamlessly.
   *
   * The key insight: each strip has a different tilt angle (rotation around X).
   * This rotation mixes local Y and Z: worldY = localY * cos(tilt) + localZ * stretch * sin(tilt)
   * To make rear of strip N meet front of strip N+1, we must compute local Y values
   * that result in matching world Y positions after their respective transforms.
   */
  private updateLandscapeElevations(
    mesh: Mesh,
    stripIndex: number,
    nextStripIndex: number,
    isLeftSide: boolean,
    // Current strip transform parameters
    tiltAngle: number,
    stretchFactor: number,
    stripY: number,
    // Next strip transform parameters (for rear row alignment)
    nextTiltAngle: number,
    nextStretchFactor: number,
    nextStripY: number
  ): void {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;

    const verticesPerRow = this.landscapeSegments + 1; // 5 vertices
    const elevationScale = 5; // 5x intensity for visible hills
    const halfDepth = this.stripDepth / 2;

    // Precompute trig values
    const cosTilt = Math.cos(tiltAngle);
    const sinTilt = Math.sin(tiltAngle);
    const cosNextTilt = Math.cos(nextTiltAngle);
    const sinNextTilt = Math.sin(nextTiltAngle);

    for (let i = 0; i < verticesPerRow; i++) {
      const t = i / this.landscapeSegments;

      // For left side: vertex 0 is far from road, vertex 4 is near road (invert blend)
      // For right side: vertex 0 is near road, vertex 4 is far from road
      const blendFactor = isLeftSide ? 1 - t : t;
      const lateralOffset = blendFactor * this.landscapeWidth;

      // Get desired landscape elevations (height above road surface)
      const frontLandscapeElev =
        this.track.getLandscapeElevation(stripIndex, lateralOffset) *
        elevationScale *
        blendFactor;
      const rearLandscapeElev =
        this.track.getLandscapeElevation(nextStripIndex, lateralOffset) *
        elevationScale *
        blendFactor;

      // Babylon.js CreateGround vertex order is BACK-TO-FRONT:
      // - Row 0 (indices 0-4): Z = +halfDepth → REAR (further from player)
      // - Row 1 (indices 5-9): Z = -halfDepth → FRONT (closer to player)

      // REAR ROW (localZ = +halfDepth) - indices 0-4:
      // Must match the world position of the NEXT strip's front row.
      // Next strip front row (at localZ = -halfDepth) with landscape elevation rearLandscapeElev:
      //   localY_nextFront = rearLandscapeElev / cos(nextTilt)
      //   worldY_nextFront = localY_nextFront * cos(nextTilt) - halfDepth * nextStretch * sin(nextTilt) + nextStripY
      //                    = rearLandscapeElev - halfDepth * nextStretch * sin(nextTilt) + nextStripY
      //
      // For this strip's rear to match:
      //   localY_rear * cos(tilt) + halfDepth * stretch * sin(tilt) + stripY = worldY_nextFront
      //   localY_rear = (worldY_nextFront - stripY - halfDepth * stretch * sin(tilt)) / cos(tilt)
      const worldY_nextFront =
        rearLandscapeElev -
        halfDepth * nextStretchFactor * sinNextTilt +
        nextStripY;
      const localY_rear =
        (worldY_nextFront - stripY - halfDepth * stretchFactor * sinTilt) /
        cosTilt;
      positions[i * 3 + 1] = localY_rear;

      // FRONT ROW (localZ = -halfDepth) - indices 5-9:
      // We want the vertex to appear at frontLandscapeElev above the road surface.
      // After rotation: worldY = localY * cos(tilt) + (-halfDepth * stretch) * sin(tilt)
      // The road surface at front edge is at: 0 * cos(tilt) + (-halfDepth * stretch) * sin(tilt) = -halfDepth * stretch * sin(tilt)
      // For landscape to be frontLandscapeElev above road:
      //   localY * cos(tilt) - halfDepth * stretch * sin(tilt) = -halfDepth * stretch * sin(tilt) + frontLandscapeElev
      //   localY * cos(tilt) = frontLandscapeElev
      //   localY = frontLandscapeElev / cos(tilt)
      const localY_front = frontLandscapeElev / cosTilt;
      positions[(i + verticesPerRow) * 3 + 1] = localY_front;
    }

    mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
  }

  /**
   * Simple hash function for deterministic pseudo-random values.
   * Same stripIndex and slot always produces the same result.
   */
  private hashPosition(stripIndex: number, slot: number): number {
    const seed = stripIndex * 1000 + slot;
    let hash = Math.imul(seed, 2654435761);
    hash = Math.imul((hash >>> 16) ^ hash, 2654435761);
    hash = (hash >>> 16) ^ hash;
    return (hash >>> 0) / 0xffffffff; // 0 to 1
  }

  /**
   * Update tree positions and visibility for a strip.
   * Uses deterministic noise for natural clustering.
   */
  private updateTrees(
    trees: Mesh[],
    stripIndex: number,
    isLeftSide: boolean,
    curbEdge: number
  ): void {
    const worldScale = 0.5; // Scale factor to convert pixel dimensions to world units

    for (let t = 0; t < trees.length; t++) {
      const tree = trees[t];

      // Deterministic position based on strip and slot
      const hash = this.hashPosition(stripIndex, t + (isLeftSide ? 0 : 100));

      // Density check - creates gaps and clusters
      const clusterNoise = Math.sin(stripIndex * 0.15 + t * 0.5) * 0.5 + 0.5;
      if (hash > clusterNoise * 0.8) {
        tree.setEnabled(false);
        continue;
      }
      tree.setEnabled(true);

      // Select sprite type (0-8) based on hash
      const hash3 = this.hashPosition(stripIndex + 1000, t);
      const spriteIndex = Math.floor(hash3 * 7);
      const [spriteWidth, spriteHeight] = pineSizes[spriteIndex];

      // Select tint (0-2) based on another hash
      const hash5 = this.hashPosition(stripIndex + 2000, t);
      const tintIndex = Math.floor(hash5 * 3);
      const materialIndex = spriteIndex * 3 + tintIndex;
      tree.material = this.treeMaterials[materialIndex];

      // Size variation (0.8 to 1.2)
      const sizeVariation = 0.8 + hash3 * 0.4;
      const scaledWidth = spriteWidth * worldScale * sizeVariation;
      const scaledHeight = spriteHeight * worldScale * sizeVariation;

      // X position: spread across landscape width
      const lateralOffset =
        this.treeMinDistance +
        hash * (this.landscapeWidth - this.treeMinDistance * 2);
      const xPos = isLeftSide
        ? curbEdge - lateralOffset
        : curbEdge + lateralOffset;

      // Z position: vary within strip depth
      const hash2 = this.hashPosition(stripIndex + 500, t);
      const zOffset = (hash2 - 0.5) * this.stripDepth * 0.8;

      // Y position: match landscape elevation, anchor at bottom center
      const elevation =
        this.track.getLandscapeElevation(stripIndex, lateralOffset) * 5; // 5x scale
      const blendFactor = lateralOffset / this.landscapeWidth;
      const yPos = elevation * blendFactor + scaledHeight / 2; // Offset by half height for bottom anchor

      tree.position.set(xPos, yPos, zOffset);

      // Horizontal flip via negative X scale
      const hash4 = this.hashPosition(stripIndex + 1500, t);
      const flipX = hash4 > 0.5 ? 1 : -1;

      // Scale to match sprite dimensions (base mesh is 40x60, so we need to adjust)
      tree.scaling.set(
        (flipX * scaledWidth) / this.treeBaseWidth,
        scaledHeight / this.treeBaseHeight,
        1
      );
    }
  }

  /**
   * Update child local positions within a strip group.
   */
  private updateGroupChildren(
    group: StripGroup,
    strip: { width: number },
    stripIndex: number,
    // Current strip transform params (for landscape elevation correction)
    tiltAngle: number,
    stretchFactor: number,
    stripY: number,
    // Next strip transform params (for rear row alignment)
    nextTiltAngle: number,
    nextStretchFactor: number,
    nextStripY: number
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
    group.rightLandscape.position.set(
      rightCurbEdge + landscapeXOffset,
      -0.02,
      0
    );

    // Update vertex elevations for seamless terrain
    const nextStripIndex = stripIndex + 1;
    this.updateLandscapeElevations(
      group.leftLandscape,
      stripIndex,
      nextStripIndex,
      true,
      tiltAngle,
      stretchFactor,
      stripY,
      nextTiltAngle,
      nextStretchFactor,
      nextStripY
    );
    this.updateLandscapeElevations(
      group.rightLandscape,
      stripIndex,
      nextStripIndex,
      false,
      tiltAngle,
      stretchFactor,
      stripY,
      nextTiltAngle,
      nextStretchFactor,
      nextStripY
    );

    // Update materials
    group.road.material = this.stripMaterials[stripIndex % 2];
    group.leftCurb.material = this.curbMaterials[stripIndex % 2];
    group.rightCurb.material = this.curbMaterials[stripIndex % 2];
    group.leftLandscape.material = this.landscapeMaterials[stripIndex % 2];
    group.rightLandscape.material = this.landscapeMaterials[stripIndex % 2];

    // Update trees
    this.updateTrees(group.leftTrees, stripIndex, true, leftCurbEdge);
    this.updateTrees(group.rightTrees, stripIndex, false, rightCurbEdge);
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

      // Compute NEXT strip's transform parameters for landscape alignment
      // For backward strips, "next" means one step closer to player (behindStripIndex + 1)
      const nextStripIndex = behindStripIndex + 1;
      const nextStrip = this.track.getStrip(nextStripIndex);
      const nextElevationChange = nextStrip
        ? nextStrip.hill * elevationScale
        : 0;
      const nextTiltAngle = Math.atan2(nextElevationChange, this.stripDepth);
      const nextStretchFactor =
        Math.sqrt(
          this.stripDepth * this.stripDepth +
            nextElevationChange * nextElevationChange
        ) / this.stripDepth;
      const nextPivotCompensation =
        Math.sin(nextTiltAngle) * nextStretchFactor * (this.stripDepth / 2);
      // Next strip's elevation: if i=0, it's cumulativeElevation; otherwise backwardElevationData[i-1]
      const nextStripElevation =
        i === 0 ? cumulativeElevation : backwardElevationData[i - 1];
      const nextStripY =
        nextStripElevation - playerElevation + nextPivotCompensation;

      // Apply single transform to group root
      this.applyGroupTransform(
        group,
        new Vector3(baseX, stripY, relativeZ),
        tiltAngle,
        shearAmount,
        stretchFactor
      );

      // Update child positions and materials
      this.updateGroupChildren(
        group,
        strip,
        behindStripIndex,
        tiltAngle,
        stretchFactor,
        stripY,
        nextTiltAngle,
        nextStretchFactor,
        nextStripY
      );
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

      // Compute NEXT strip's transform parameters for landscape alignment
      const nextStrip = this.track.getStrip(stripIndex + 1);
      const nextElevationChange = nextStrip
        ? nextStrip.hill * elevationScale
        : 0;
      const nextTiltAngle = Math.atan2(nextElevationChange, this.stripDepth);
      const nextStretchFactor =
        Math.sqrt(
          this.stripDepth * this.stripDepth +
            nextElevationChange * nextElevationChange
        ) / this.stripDepth;
      const nextPivotCompensation =
        Math.sin(nextTiltAngle) * nextStretchFactor * (this.stripDepth / 2);
      const nextCumulativeElevation = cumulativeElevation + elevationChange;
      const nextStripY =
        nextCumulativeElevation - playerElevation + nextPivotCompensation;

      // Apply single transform to group root
      this.applyGroupTransform(
        group,
        new Vector3(baseX, stripY, relativeZ),
        tiltAngle,
        shearAmount,
        stretchFactor
      );

      // Update child positions and materials
      this.updateGroupChildren(
        group,
        strip,
        stripIndex,
        tiltAngle,
        stretchFactor,
        stripY,
        nextTiltAngle,
        nextStretchFactor,
        nextStripY
      );

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
      group.leftTrees.forEach((tree) => tree.dispose());
      group.rightTrees.forEach((tree) => tree.dispose());
    });
    this.stripMaterials.forEach((mat) => mat.dispose());
    this.curbMaterials.forEach((mat) => mat.dispose());
    this.landscapeMaterials.forEach((mat) => mat.dispose());
    this.treeMaterials.forEach((mat) => mat.dispose());
    this.playerMesh.dispose();
    this.headlight.dispose();
  }
}
