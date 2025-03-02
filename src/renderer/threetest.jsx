import React, { Component, createRef } from "react";
import * as THREE from "three";

class ThreeScene extends Component {
  constructor(props) {
    super(props);
    this.mountRef = createRef();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cube = null;
    this.requestID = null;
  }

  componentDidMount() {
    // 1️⃣ Setup Scene, Camera, and Renderer
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.z = 2;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.mountRef.current.appendChild(this.renderer.domElement);

    // 2️⃣ Create a Rotating Cube
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0x0077ff });
    this.cube = new THREE.Mesh(geometry, material);
    this.scene.add(this.cube);

    // 3️⃣ Handle Window Resizing
    window.addEventListener("resize", this.handleResize);

    // 4️⃣ Start Animation Loop
    this.animate();
  }

  animate = () => {
    this.requestID = requestAnimationFrame(this.animate);
    this.cube.rotation.x += 0.01;
    this.cube.rotation.y += 0.01;
    this.renderer.render(this.scene, this.camera);
  };

  handleResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  componentWillUnmount() {
    // Cleanup: Stop animation loop
    cancelAnimationFrame(this.requestID);

    // Remove event listeners
    window.removeEventListener("resize", this.handleResize);

    // Remove Three.js canvas
    if (this.mountRef.current) {
      this.mountRef.current.removeChild(this.renderer.domElement);
    }
  }

  render() {
    return <div ref={this.mountRef} />;
  }
}

export default ThreeScene;
