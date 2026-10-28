import { Group, Box3, Vector3, MeshPhysicalMaterial, MeshStandardMaterial, Color } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PhoneScreen } from "./screens.js?v=8f";

const HEIGHT = 2.6; // scene units for the 147.6 mm enclosure

// Materials per GLB material name. The exported ones only approximate the
// dark titanium, glass and optics, so they're rebuilt here.
function materialFor(name) {
  switch (name) {
    case "Natural Titanium • brushed":
      return new MeshPhysicalMaterial({
        color: new Color(0.16, 0.16, 0.175),
        metalness: 0.9,
        roughness: 0.38,
        envMapIntensity: 0.55,
        anisotropy: 0.4,
        clearcoat: 0.2,
        clearcoatRoughness: 0.3,
      });
    case "Polished black glass":
      return new MeshPhysicalMaterial({
        color: 0x050507,
        metalness: 0,
        roughness: 0.1,
        clearcoat: 0.5,
        clearcoatRoughness: 0.08,
        envMapIntensity: 0.4,
        ior: 1.52,
        specularIntensity: 1,
      });
    case "Frosted warm titanium glass":
      return new MeshPhysicalMaterial({
        color: 0x3a3a3f,
        metalness: 0.25,
        roughness: 0.52,
        clearcoat: 0.6,
        clearcoatRoughness: 0.45,
      });
    case "Optical sapphire blue":
      return new MeshPhysicalMaterial({
        color: 0x07080c,
        metalness: 0.4,
        roughness: 0.06,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        iridescence: 0.7,
        iridescenceIOR: 1.6,
      });
    case "Optical iris":
      return new MeshStandardMaterial({ color: 0x030304, metalness: 0.2, roughness: 0.35 });
    case "Antenna polymer":
      return new MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0, roughness: 0.55 });
    case "Flash ceramic":
      return new MeshStandardMaterial({ color: 0xd9d8d2, metalness: 0.05, roughness: 0.3 });
    default:
      return null;
  }
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Loads the enclosure once; `instance()` returns a phone with its own live screen. */
export async function loadPhone({ modelUrl, logoUrl, anisotropy }) {
  const [gltf, logo] = await Promise.all([new GLTFLoader().loadAsync(modelUrl), loadImage(logoUrl)]);

  const model = gltf.scene;
  // exported Y-up: the display faces +Y and the top points to -Z
  model.rotation.x = Math.PI / 2;
  const base = new Group();
  base.add(model);
  base.scale.setScalar(HEIGHT / 0.1476);

  const cache = new Map();
  let screenMesh = null;
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    const name = obj.material && obj.material.name;
    if (obj.name === "Screen" || name === "Screen") {
      screenMesh = obj;
      obj.name = "Screen";
      return;
    }
    if (!cache.has(name)) cache.set(name, materialFor(name));
    const mat = cache.get(name);
    if (mat) {
      obj.material.dispose();
      obj.material = mat;
    }
  });

  // screen aspect from the display mesh itself
  const box = new Box3().setFromObject(screenMesh);
  const size = box.getSize(new Vector3());
  const aspect = size.x / size.z;
  screenMesh.material.dispose();

  function instance(scale = 2) {
    const group = base.clone(true);
    group.name = "phone";
    const screen = new PhoneScreen(aspect, { logo, scale });
    screen.texture.anisotropy = anisotropy;
    const material = new MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveMap: screen.texture,
      emissiveIntensity: 1,
      roughness: 0.1,
      metalness: 0,
      envMapIntensity: 0.32,
    });
    material.toneMapped = false;
    group.traverse((obj) => {
      if (obj.isMesh && obj.name === "Screen") obj.material = material;
    });
    return { group, screen, material };
  }

  return { instance, materials: [...cache.values()].filter(Boolean) };
}
