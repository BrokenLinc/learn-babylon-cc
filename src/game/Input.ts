export interface InputState {
  accelerate: boolean;
  brake: boolean;
  steerLeft: boolean;
  steerRight: boolean;
}

export class Input {
  private keys: Set<string> = new Set();

  constructor() {
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  private onKeyDown(event: KeyboardEvent): void {
    this.keys.add(event.code);
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.keys.delete(event.code);
  }

  public getState(): InputState {
    return {
      accelerate: this.keys.has('ArrowUp') || this.keys.has('KeyW'),
      brake: this.keys.has('ArrowDown') || this.keys.has('KeyS'),
      steerLeft: this.keys.has('ArrowLeft') || this.keys.has('KeyA'),
      steerRight: this.keys.has('ArrowRight') || this.keys.has('KeyD'),
    };
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    window.removeEventListener('keyup', this.onKeyUp.bind(this));
  }
}
