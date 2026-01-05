/** @format */

import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { TrackStrip } from "./Track";

export class Landscape {
  // Mesh pools: [visibleStripIndex][subsectionIndex]
  private leftMeshes: Mesh[][] = [];
  private rightMeshes: Mesh[][] = [];
  private materials: StandardMaterial[] = [];

  // Configuration
  private readonly subsectionCount = 5;
  private readonly subsectionWidths = [10, 247.5, 247.5, 247.5, 247.5];
  private readonly subsectionCenters: number[];

  // Alternating green colors
  private readonly color1 = new Color3(0.3, 0.5, 0.2);
  private readonly color2 = new Color3(0.4, 0.6, 0.3);

  constructor(
    private scene: Scene,
    private visibleStrips: number,
    private stripDepth: number
  ) {
    this.subsectionCenters = this.calculateSubsectionCenters();
    this.createMaterials();
    this.createMeshPool();
  }

  private calculateSubsectionCenters(): number[] {
    const centers: number[] = [];
    let cumulative = 0;
    for (const width of this.subsectionWidths) {
      centers.push(cumulative + width / 2);
      cumulative += width;
    }
    return centers;
  }

  private createMaterials(): void {
    const mat1 = new StandardMaterial("landscapeMat1", this.scene);
    mat1.diffuseColor = this.color1;
    mat1.specularColor = Color3.Black();

    const mat2 = new StandardMaterial("landscapeMat2", this.scene);
    mat2.diffuseColor = this.color2;
    mat2.specularColor = Color3.Black();

    this.materials = [mat1, mat2];
  }

  private createMeshPool(): void {
    for (let i = 0; i < this.visibleStrips; i++) {
      const leftRow: Mesh[] = [];
      const rightRow: Mesh[] = [];

      for (let j = 0; j < this.subsectionCount; j++) {
        const width = this.subsectionWidths[j];

        const leftMesh = MeshBuilder.CreateGround(
          `leftLandscape_${i}_${j}`,
          { width, height: this.stripDepth },
          this.scene
        );
        leftMesh.material = this.materials[i % 2];
        leftRow.push(leftMesh);

        const rightMesh = MeshBuilder.CreateGround(
          `rightLandscape_${i}_${j}`,
          { width, height: this.stripDepth },
          this.scene
        );
        rightMesh.material = this.materials[i % 2];
        rightRow.push(rightMesh);
      }

      this.leftMeshes.push(leftRow);
      this.rightMeshes.push(rightRow);
    }
  }

  private applyShearTransform(
    mesh: Mesh,
    position: Vector3,
    tiltAngle: number,
    shearAmount: number,
    scaleX: number,
    scaleZ: number
  ): void {
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

    const scaleMatrix = Matrix.Scaling(scaleX, 1, scaleZ);
    const rotationMatrix = Matrix.RotationX(-tiltAngle);
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

    mesh.freezeWorldMatrix(worldMatrix);
  }

  public updateStrip(
    meshIndex: number,
    stripIndex: number,
    strip: TrackStrip,
    baseX: number,
    stripY: number,
    relativeZ: number,
    tiltAngle: number,
    shearAmount: number,
    stretchFactor: number,
    roadEdge: number,
    curbWidth: number
  ): void {
    // Calculate curb edges
    const halfRoadWidth = roadEdge * strip.width * 0.5;
    const leftCurbEdge = baseX - halfRoadWidth - curbWidth;
    const rightCurbEdge = baseX + halfRoadWidth + curbWidth;

    // Position each subsection
    for (let j = 0; j < this.subsectionCount; j++) {
      const center = this.subsectionCenters[j];
      const leftElevationOffset = strip.leftLandscape?.[j]?.elevationOffset ?? 0;
      const rightElevationOffset = strip.rightLandscape?.[j]?.elevationOffset ?? 0;

      // Left side
      const leftMesh = this.leftMeshes[meshIndex][j];
      this.applyShearTransform(
        leftMesh,
        new Vector3(
          leftCurbEdge - center,
          stripY + leftElevationOffset - 0.02,
          relativeZ
        ),
        tiltAngle,
        shearAmount,
        1, // scaleX = 1, width is baked into mesh
        stretchFactor
      );
      leftMesh.material = this.materials[stripIndex % 2];

      // Right side
      const rightMesh = this.rightMeshes[meshIndex][j];
      this.applyShearTransform(
        rightMesh,
        new Vector3(
          rightCurbEdge + center,
          stripY + rightElevationOffset - 0.02,
          relativeZ
        ),
        tiltAngle,
        shearAmount,
        1,
        stretchFactor
      );
      rightMesh.material = this.materials[stripIndex % 2];
    }
  }

  public dispose(): void {
    this.leftMeshes.flat().forEach((mesh) => mesh.dispose());
    this.rightMeshes.flat().forEach((mesh) => mesh.dispose());
    this.materials.forEach((mat) => mat.dispose());
  }
}
