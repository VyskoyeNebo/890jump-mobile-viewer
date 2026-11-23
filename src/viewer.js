import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'meshoptimizer';
import {applyStockMaterials} from './stock-materials.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

const stage = document.getElementById('stage');
const status = document.getElementById('status');
const progress = document.getElementById('progress');
const overlay = document.getElementById('loading');
let renderer;
try { renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'low-power'}); }
catch (e) { status.textContent = '无法启动 3D。请更新 Android 系统 WebView，并确认设备支持 WebGL。'; throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
stage.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label', '890 Jump 三维模型，单指旋转，双指缩放或平移');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 1000);
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environment = pmrem.fromScene(room, 0.04);
scene.environment = environment.texture;
room.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xddeaff, 0x384050, 1.25));
const sun = new THREE.DirectionalLight(0xfff3db, 2.0); sun.position.set(-4, 6, 3); scene.add(sun);
const fill = new THREE.DirectionalLight(0x9dbbff, 0.7); fill.position.set(4, -2, -3); scene.add(fill);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.09;
controls.enablePan = true; controls.screenSpacePanning = true;
controls.minDistance = 0.6; controls.maxDistance = 18;
controls.autoRotateSpeed = 0.6;
let model, radius = 1, frame = 0, isVisible = true;
const views = {home: [1.1, 0.9, -1.2], top: [0, 1, 0.0001], bottom: [0, -1, 0.0001], side: [1, 0, 0], front: [0, 0, -1], rear: [0, 0, 1]};
let selectedView = 'home';
function render() {
  frame = 0;
  if (!isVisible) return;
  const changed = controls.update();
  // Game decals sit extremely close to the hull. A tight depth range avoids z-fighting.
  const distance = camera.position.distanceTo(controls.target);
  camera.near = Math.max(0.01, distance - radius * 1.04);
  camera.far = Math.max(camera.near + 1, distance + radius * 1.15);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  if (controls.autoRotate || changed) invalidate();
}
function invalidate() { if (!frame && isVisible) frame = requestAnimationFrame(render); }
controls.addEventListener('change', invalidate);
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); invalidate();
}
function setView(name) {
  controls.enableDamping=false;controls.update();
  selectedView = name;
  const vector = new THREE.Vector3(...views[name]).normalize();
  const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
  const limiting = Math.min(vertical, Math.atan(Math.tan(vertical) * camera.aspect));
  const distance = radius / Math.sin(limiting) * 1.08;
  controls.target.set(0, 0, 0); camera.up.set(0, 1, 0);
  camera.position.copy(vector.multiplyScalar(distance)); camera.lookAt(controls.target);
  controls.update();controls.enableDamping=true;invalidate();
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === name));
}
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { isVisible = !document.hidden; if (isVisible) invalidate(); });
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
document.getElementById('rotate').addEventListener('click', e => {
  controls.autoRotate = !controls.autoRotate; e.currentTarget.classList.toggle('active', controls.autoRotate);
  e.currentTarget.setAttribute('aria-pressed', String(controls.autoRotate)); invalidate();
});
document.getElementById('light').addEventListener('input', e => { renderer.toneMappingExposure = Number(e.target.value); invalidate(); });
document.getElementById('theme').addEventListener('click', () => { document.body.classList.toggle('light'); invalidate(); });
renderer.domElement.addEventListener('dblclick', () => setView('home'));
renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); overlay.hidden = false; status.textContent = '3D 显存暂时不足。关闭其他应用后重新打开本软件。'; });
resize(); setView('home');
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('./assets/890jump.glb', async gltf => {
  try {
  status.textContent='正在准备原厂材质…';
  const source=await Promise.all([fetch('./assets/stock-materials.json').then(r=>r.json()),fetch('./assets/surface-attributes.json').then(r=>r.json())]);
  const materialInfo=await applyStockMaterials(gltf.scene,source[0],source[1]);
  model = gltf.scene;
  // The Blender export has its long ship axis along glTF Z. Bow is negative Z.
  const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  const size = box.getSize(new THREE.Vector3()), scale = 4.5 / Math.max(size.x, size.y, size.z);
  const parent = new THREE.Group(); parent.add(model); parent.scale.setScalar(scale); scene.add(parent);
  parent.traverse(o => { if (o.isMesh) o.frustumCulled = true; });
  radius = box.getBoundingSphere(new THREE.Sphere()).radius * scale;
  setView('home'); overlay.hidden = true;
  document.getElementById('ready').textContent = '原厂材质数据 · 测试版';
  document.title = '890 Jump · 已就绪';
  window.viewerInfo = {ready:true, triangles:0, ...materialInfo, renderer:renderer.capabilities.isWebGL2?'WebGL 2':'WebGL 1'};
  parent.traverse(o => { if (o.isMesh) window.viewerInfo.triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  invalidate();
  } catch(error) { overlay.hidden=false;status.textContent='材质载入失败，请重新打开。';console.error(error); }
}, event => {
  const pct = event.total ? Math.round(100 * event.loaded / event.total) : 0;
  progress.style.width = pct + '%'; status.textContent = pct ? '正在载入原厂模型 ' + pct + '%' : '正在载入原厂模型…';
}, error => { status.textContent = '模型载入失败。请重新打开应用；网页版请检查网络。'; console.error(error); });
