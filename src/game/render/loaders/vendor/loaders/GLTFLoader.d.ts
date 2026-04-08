import type { Group, LoadingManager } from "three";

export class GLTFLoader {
  constructor(manager?: LoadingManager);
  loadAsync(url: string): Promise<{ scene: Group }>;
}
