import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Track } from './Track';
import { Player } from './Player';
import { Input } from './Input';
import { Renderer } from './Renderer';

export class Game {
  private engine: Engine;
  private scene: Scene;
  private gameCamera!: FreeCamera;
  private debugCamera!: FreeCamera;
  private isDebugMode: boolean = false;
  private track: Track;
  private player: Player;
  private input: Input;
  private renderer: Renderer;
  private lastTime: number = 0;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Initialize BabylonJS engine
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.4, 0.6, 0.9, 1); // Sky blue

    // Create cameras
    this.setupCameras();

    // Create lighting
    this.setupLighting();

    // Initialize game components
    this.track = new Track(500);
    this.player = new Player(this.track);
    this.input = new Input();
    this.renderer = new Renderer(this.scene, this.track);

    // Handle window resize
    window.addEventListener('resize', () => {
      this.engine.resize();
    });

    // Toggle debug camera with F1
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F1') {
        this.toggleDebugCamera();
      }
    });
  }

  private setupCameras(): void {
    // Game camera - fixed, looking down the track
    this.gameCamera = new FreeCamera('gameCamera', new Vector3(0, 5, -5), this.scene);
    this.gameCamera.setTarget(new Vector3(0, 0, 50));

    // Debug camera - free movement for exploring
    this.debugCamera = new FreeCamera('debugCamera', new Vector3(0, 10, -20), this.scene);
    this.debugCamera.setTarget(new Vector3(0, 0, 0));
    this.debugCamera.speed = 2;
    this.debugCamera.keysUp = [87];    // W
    this.debugCamera.keysDown = [83];   // S
    this.debugCamera.keysLeft = [65];   // A
    this.debugCamera.keysRight = [68];  // D

    // Start with game camera active
    this.scene.activeCamera = this.gameCamera;
  }

  private toggleDebugCamera(): void {
    this.isDebugMode = !this.isDebugMode;

    if (this.isDebugMode) {
      // Switch to debug camera
      this.scene.activeCamera = this.debugCamera;
      this.debugCamera.attachControl(this.canvas, true);
      console.log('Debug camera enabled - WASD to move, mouse to look');
    } else {
      // Switch back to game camera
      this.debugCamera.detachControl();
      this.scene.activeCamera = this.gameCamera;
      console.log('Game camera enabled');
    }
  }

  private setupLighting(): void {
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), this.scene);
    light.intensity = 1;
  }

  public start(): void {
    this.lastTime = performance.now();

    this.engine.runRenderLoop(() => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
      this.lastTime = currentTime;

      this.update(deltaTime);
      this.scene.render();
    });
  }

  private update(deltaTime: number): void {
    // Only process game input when not in debug mode
    if (!this.isDebugMode) {
      // Get input state
      const inputState = this.input.getState();

      // Update player
      this.player.update(deltaTime, inputState);
    }

    // Always update renderer (so we can see the track in debug mode too)
    // Camera stays fixed - track moves based on player position
    this.renderer.update(this.player);
  }

  public dispose(): void {
    this.renderer.dispose();
    this.input.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
