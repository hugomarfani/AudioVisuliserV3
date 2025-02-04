import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import icon from '../../assets/icon.svg';
import './App.css';

function Hello() {
  useEffect(() => {
    // Dynamic import of the sketch to ensure it only runs in the browser
    import('../particles/sketch').catch(console.error);
  }, []);

  return (
    <div>
      <div className="Hello">
        <img width="200" alt="icon" src={icon} />
      </div>
      <h1>Group 1</h1>
      <div className="particle-container" id="particle-container">
        {/* P5.js sketch will be mounted here */}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
