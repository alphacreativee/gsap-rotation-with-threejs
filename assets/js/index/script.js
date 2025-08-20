import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
document.addEventListener("DOMContentLoaded", () => {
  const lenis = new Lenis();
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  const container = document.querySelector("#webgl");
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    precision: "highp",
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  renderer.setSize(
    container.clientWidth || window.innerWidth,
    container.clientHeight || window.innerHeight
  );

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    50,
    (container.clientWidth || window.innerWidth) /
      (container.clientHeight || window.innerHeight),
    0.1,
    1000
  );
  scene.add(camera);

  const MODAL_URL = "./assets/images/the_cube.glb";

  const loader = new GLTFLoader();
  let model = null;

  let modelSize = new THREE.Vector3(1, 1, 1);
  let fitDistance = 5;
  const lookTarget = new THREE.Vector3(0, 0, 0);
  loader.load(
    MODAL_URL,
    (gltf) => {
      const originalModel = gltf.scene;

      // Tạo Group container để làm pivot point
      model = new THREE.Group();

      originalModel.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
        }
      });

      // Thêm model gốc vào group
      model.add(originalModel);

      // Tính toán bounding box từ toàn bộ group
      const box = new THREE.Box3().setFromObject(model);
      box.getSize(modelSize);

      // Tính center của bounding box
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Di chuyển model gốc để center nằm ở (0,0,0) trong group
      originalModel.position.sub(center);

      // Thêm group vào scene (không phải model gốc)
      scene.add(model);

      // Bây giờ model group sẽ xoay quanh trục center (0,0,0)
      // Rest of your code remains the same...

      // camera distance calculation
      const sphere = new THREE.Sphere();
      box.getBoundingSphere(sphere);
      const r = Math.max(sphere.radius, 0.0001);
      const fovV = THREE.MathUtils.degToRad(camera.fov);
      const distV = r / Math.tan(fovV / 2);
      const fovH = 2 * Math.atan(Math.atan(fovV / 2) * camera.aspect);
      const distH = r / Math.tan(fovH / 2);
      fitDistance = Math.max(distV, distH) * 1.5;

      camera.position.set(0, modelSize.y * 0.25, fitDistance);
      camera.near = Math.max(fitDistance / 200, 0.01);
      camera.far = fitDistance * 200;
      camera.updateProjectionMatrix();
      camera.lookAt(0, 0, 0);

      addFloorAndShadows(box);
      addLightting();
      buildScrollTimeline();

      // start render loop
      (function render() {
        camera.lookAt(lookTarget);
        renderer.render(scene, camera);
        requestAnimationFrame(render);
      })();
    },
    undefined,
    function (error) {
      console.error(error);
    }
  );

  // Thêm function helper để đảm bảo center rotation cho bất kỳ model nào
  // function centerModelForRotation(model) {
  //   // Tạo bounding box
  //   const box = new THREE.Box3().setFromObject(model);

  //   // Tính center
  //   const center = new THREE.Vector3();
  //   box.getCenter(center);

  //   // Tạo group container
  //   const pivotGroup = new THREE.Group();

  //   // Remove model từ parent hiện tại (nếu có)
  //   if (model.parent) {
  //     model.parent.remove(model);
  //   }

  //   // Thêm model vào group và điều chỉnh position
  //   pivotGroup.add(model);
  //   model.position.sub(center);

  //   return pivotGroup;
  // }

  // loader.load(
  //   MODAL_URL,
  //   (gltf) => {
  //     model = gltf.scene;
  //     model.traverse((o) => {
  //       if (o.isMesh) {
  //         o.castShadow = true;
  //       }
  //     });
  //     scene.add(model);

  //     // measure and center

  //     const box = new THREE.Box3().setFromObject(model);
  //     box.getSize(modelSize);

  //     const center = new THREE.Vector3();
  //     box.getCenter(center);
  //     model.position.sub(center);

  //     // camera distance
  //     const sphere = new THREE.Sphere();
  //     box.getBoundingSphere(sphere);
  //     const r = Math.max(sphere.radius, 0.0001);
  //     const fovV = THREE.MathUtils.degToRad(camera.fov);
  //     const distV = r / Math.tan(fovV / 2);
  //     const fovH = 2 * Math.atan(Math.atan(fovV / 2) * camera.aspect);
  //     const distH = r / Math.tan(fovH / 2);
  //     fitDistance = Math.max(distV, distH) * 1.5;

  //     camera.position.set(0, modelSize.y * 0.25, fitDistance);
  //     camera.near = Math.max(fitDistance / 200, 0.01);
  //     camera.far = fitDistance * 200;
  //     camera.updateProjectionMatrix();
  //     camera.lookAt(0, 0, 0);

  //     // ///////

  //     addFloorAndShadows(box);
  //     addLightting();
  //     buildScrollTimeline();

  //     // start render loop

  //     (function render() {
  //       camera.lookAt(lookTarget);
  //       renderer.render(scene, camera);
  //       requestAnimationFrame(render);
  //     })();
  //   },
  //   undefined,
  //   function (error) {
  //     console.error(error);
  //   }
  // );
  //
  let floorShadow = null;
  let floorTint = null;
  function addFloorAndShadows(box) {
    const floorGeo = new THREE.CircleGeometry(8, 64);
    // shadow catcher

    const shadowMath = new THREE.ShadowMaterial({ opacity: 0.22 });
    floorShadow = new THREE.Mesh(floorGeo, shadowMath);
    floorShadow.rotation.x = -Math.PI / 2;
    floorShadow.position.y = box.min.y + 0.001;
    floorShadow.receiveShadow = true;
    // scene.add(floorShadow);

    floorTint = new THREE.Mesh(
      floorGeo,
      new THREE.MeshStandardMaterial({
        color: 0xdde2e7,
        roughness: 1,
        metalness: 0,
      })
    );
    floorTint.position.y = box.min.y;
    // scene.add(floorTint);
  }

  // setup light

  let hemi = null;
  let key = null;

  function addLightting() {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // soft fill

    hemi = new THREE.HemisphereLight(0xffffff, 0xdde2e7, 1.0);
    scene.add(hemi);

    //  key light

    key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 6, 3);

    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 30;
    scene.add(key);

    scene.background = new THREE.Color(0x111111);
    scene.fog = new THREE.Fog(0xf5f7fb, fitDistance * 0.9, fitDistance * 3.0);
  }

  // drag control

  container.style.touchAction = "none"; // disable touch scroll
  container.style.cursor = "grab";

  let isDragging = false,
    lastX = 0,
    lastY = 0,
    vx = 0,
    vy = 0,
    inertiaTween = null;

  const ROT_SENS = 0.005;
  const PITCH_MIN = -Math.PI / 2 + 0.05;
  const PITCH_MAX = Math.PI / 2 - 0.05;

  function onPointerDown(e) {
    if (!model) return;
    isDragging = true;
    container.setPointerCapture(e.pointerId);
    container.style.cursor = "grabbing";
    lastX = e.clientX;
    lastY = e.clientY;
    vx = vy = 0;
    inertiaTween && inertiaTween.kill();
    e.preventDefault();
  }

  // function onPointerMove(e) {
  //   if (!isDragging || !model) return;
  //   const dx = e.clientX - lastX;
  //   const dy = e.clientY - lastY;
  //   lastX = e.clientX;
  //   lastY = e.clientY;

  //   vx = dx;
  //   vy = dy;

  //   model.rotation.y += dx * ROT_SENS;
  //   model.rotation.x = THREE.MathUtils.clamp(
  //     model.rotation.x + dy * ROT_SENS,
  //     PITCH_MIN,
  //     PITCH_MAX
  //   );
  // }
  function onPointerMove(e) {
    if (!isDragging || !model) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    vx = dx;
    vy = dy;

    // Rotation sẽ diễn ra quanh center của group (0,0,0)
    model.rotation.y += dx * ROT_SENS;
    model.rotation.x = THREE.MathUtils.clamp(
      model.rotation.x + dy * ROT_SENS,
      PITCH_MIN,
      PITCH_MAX
    );
  }
  function onPointerUp(e) {
    if (!model) return;
    isDragging = false;
    container.releasePointerCapture(e.pointerId);
    container.style.cursor = "grab";
    const targetY = model.rotation.y + vx * ROT_SENS * 10;
    const targetX = THREE.MathUtils.clamp(
      model.rotation.x + vy * ROT_SENS * 10,
      PITCH_MIN,
      PITCH_MAX
    );

    inertiaTween = gsap.to(model.rotation, {
      x: targetX,
      y: targetY,
      duration: 0.6,
      ease: "power3.out",
    });
  }
  container.addEventListener("pointerdown", onPointerDown, {
    passive: false,
  });
  container.addEventListener("pointermove", onPointerMove, {
    passive: false,
  });
  container.addEventListener("pointerup", onPointerUp, {
    passive: false,
  });

  function buildScrollTimeline() {
    if (!model) return;
    const stage =
      document.querySelector("#stage") ||
      container.parentElement ||
      document.body;
    const tl = gsap.timeline({
      scrollTrigger: {
        id: "spinPin",
        trigger: stage,
        start: "top top",
        end: `+=${window.innerHeight * 3}px`,
        pin: true,
        scrub: true,
        // markers: true,
      },
    });
    const cam1 = {
      x: -fitDistance * 0.45,
      y: modelSize.y * 0.45,
      z: fitDistance * 0.85,
    };
    const cam2 = {
      x: -fitDistance * 0.9,
      y: modelSize.y * 0.2,
      z: fitDistance * 0,
    };
    const key1 = {
      x: 2.5,
      y: 6.5,
      z: 2.5,
    };
    const key2 = {
      x: 3.5,
      y: 5.0,
      z: -2.0,
    };
    tl.to(model.rotation, {
      x: "+=" + Math.PI * 2,
      ease: "none",
      duration: 1,
    });
    tl.to(
      camera.position,
      {
        x: cam1.x,
        y: cam1.y,
        z: cam1.z,
        ease: "power1.inOut",
        duration: 1,
      },
      "<"
    );
    tl.to(
      key.position,
      {
        x: key1.x,
        y: key1.y,
        z: key1.z,
        ease: "power1.inOut",
        duration: 1,
      },
      "<"
    );
    // phase 2
    tl.to(model.rotation, {
      y: "+=" + Math.PI / 2,

      ease: "none",
      duration: 1,
    });
    tl.to(
      camera.position,
      {
        x: cam2.x,
        y: cam2.y,
        z: cam2.z,
        ease: "power1.inOut",
        duration: 1,
      },
      "<"
    );
    tl.to(
      key.position,
      {
        x: key2.x,
        y: key2.y,
        z: key2.z,
        ease: "power1.inOut",
        duration: 1,
      },
      "<"
    );
  }
  function sizeToHost() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);

    camera.aspect = Math.max(w, 1) / Math.max(h, 1);
    camera.updateProjectionMatrix();
    if (ScrollTrigger) requestAnimationFrame(() => ScrollTrigger.refresh());
  }
  window.addEventListener("resize", sizeToHost, {
    passive: true,
  });
  sizeToHost();
});
