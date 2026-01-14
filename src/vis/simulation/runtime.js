/**
 * Simulation runtime: Jolt world
 * -----------------------------
 *
 * Owns the long-lived JoltInterface + PhysicsSystem. Individual physics engines
 * (graph frames) add/remove bodies + constraints in this shared world.
 */

import initJolt from 'jolt-physics/wasm';
import joltWasmUrl from 'jolt-physics/jolt-physics.wasm.wasm?url';

let joltModulePromise = null;
let runtimePromise = null;

/**
 * @typedef {{
 *   Jolt: any,
 *   joltInterface: any,
 *   physicsSystem: any,
 *   bodyInterface: any,
 *   layerNonMoving: number,
 *   layerMoving: number
 * }} PhysicsRuntime
 */

/**
 * Load (and cache) the Jolt WASM module.
 *
 * @returns {Promise<any>}
 */
function loadJolt() {
  if (!joltModulePromise) {
    joltModulePromise = initJolt({ locateFile: () => joltWasmUrl });
  }
  return joltModulePromise;
}

/**
 * Create the shared Jolt runtime.
 *
 * @returns {Promise<PhysicsRuntime>}
 */
async function createRuntime() {
  const Jolt = await loadJolt();

  const layerNonMoving = 0;
  const layerMoving = 1;
  const bpLayerNonMoving = 0;
  const bpLayerMoving = 1;
  const numObjectLayers = 2;
  const numBroadPhaseLayers = 2;

  const objectLayerPairFilter = new Jolt.ObjectLayerPairFilterTable(
    numObjectLayers,
  );
  objectLayerPairFilter.EnableCollision(layerNonMoving, layerMoving);
  objectLayerPairFilter.EnableCollision(layerMoving, layerMoving);

  const broadPhaseLayerInterface = new Jolt.BroadPhaseLayerInterfaceTable(
    numObjectLayers,
    numBroadPhaseLayers,
  );
  broadPhaseLayerInterface.MapObjectToBroadPhaseLayer(
    layerNonMoving,
    new Jolt.BroadPhaseLayer(bpLayerNonMoving),
  );
  broadPhaseLayerInterface.MapObjectToBroadPhaseLayer(
    layerMoving,
    new Jolt.BroadPhaseLayer(bpLayerMoving),
  );

  const objectVsBroadPhaseLayerFilter =
    new Jolt.ObjectVsBroadPhaseLayerFilterTable(
      broadPhaseLayerInterface,
      numBroadPhaseLayers,
      objectLayerPairFilter,
      numObjectLayers,
    );

  const settings = new Jolt.JoltSettings();
  settings.mMaxBodies = 10_000;
  settings.mMaxBodyPairs = 10_000;
  settings.mMaxContactConstraints = 10_000;
  settings.mBroadPhaseLayerInterface = broadPhaseLayerInterface;
  settings.mObjectVsBroadPhaseLayerFilter = objectVsBroadPhaseLayerFilter;
  settings.mObjectLayerPairFilter = objectLayerPairFilter;

  const joltInterface = new Jolt.JoltInterface(settings);
  const physicsSystem = joltInterface.GetPhysicsSystem();
  physicsSystem.SetGravity(new Jolt.Vec3(0, 0, 0));

  return {
    Jolt,
    joltInterface,
    physicsSystem,
    bodyInterface: physicsSystem.GetBodyInterface(),
    layerNonMoving,
    layerMoving,
  };
}

/**
 * Get a cached shared physics runtime.
 *
 * @returns {Promise<PhysicsRuntime>}
 */
export async function getPhysicsRuntime() {
  if (!runtimePromise) runtimePromise = createRuntime();
  return runtimePromise;
}

