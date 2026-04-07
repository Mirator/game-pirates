import {
  BoxGeometry,
  ColorRepresentation,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry
} from "three";

function createMaterial(color: ColorRepresentation): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.82,
    metalness: 0.08
  });
}

function enableShadows(mesh: Mesh): Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createShipMesh(baseColor: ColorRepresentation, sailColor: ColorRepresentation): Group {
  const group = new Group();

  const hull = enableShadows(new Mesh(new BoxGeometry(3, 0.9, 6.4), createMaterial(baseColor)));
  hull.position.y = 0.55;
  group.add(hull);

  const bow = enableShadows(new Mesh(new ConeGeometry(1.1, 1.8, 4), createMaterial(baseColor)));
  bow.rotation.x = Math.PI * 0.5;
  bow.rotation.z = Math.PI;
  bow.position.set(0, 0.56, 4.05);
  group.add(bow);

  const deck = enableShadows(new Mesh(new BoxGeometry(2.2, 0.28, 3.4), createMaterial("#e2be89")));
  deck.position.set(0, 1.05, 0.35);
  group.add(deck);

  const mast = enableShadows(new Mesh(new CylinderGeometry(0.12, 0.16, 3.6, 7), createMaterial("#6e4a29")));
  mast.position.set(0, 2.45, 0.4);
  group.add(mast);

  const sail = enableShadows(new Mesh(new PlaneGeometry(2.1, 1.8), createMaterial(sailColor)));
  sail.position.set(0, 2.5, 0.9);
  group.add(sail);

  return group;
}
