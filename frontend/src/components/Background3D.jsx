import React, { useEffect, useRef } from 'react';

const Background3D = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const { clientX, clientY } = e;
      const x = (clientX / window.innerWidth - 0.5) * 20;
      const y = (clientY / window.innerHeight - 0.5) * 20;
      
      containerRef.current.style.transform = `rotateX(${-y}deg) rotateY(${x}deg)`;
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="bg-3d-wrapper" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: -1,
      pointerEvents: 'none',
      perspective: '1000px',
      overflow: 'hidden'
    }}>
      <div ref={containerRef} className="bg-3d-content" style={{
        width: '100%',
        height: '100%',
        transition: 'transform 0.1s ease-out',
        transformStyle: 'preserve-3d'
      }}>
        <div className="grid-layer" style={{
          position: 'absolute',
          width: '200%',
          height: '200%',
          top: '-50%',
          left: '-50%',
          backgroundImage: `
            linear-gradient(var(--border-color) 1px, transparent 1px),
            linear-gradient(90deg, var(--border-color) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
          transform: 'rotateX(60deg) translateZ(-100px)',
          opacity: 0.15,
          maskImage: 'radial-gradient(circle, black, transparent 80%)'
        }} />
        <div className="glow-orb" style={{
          position: 'absolute',
          width: '800px',
          height: '800px',
          background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)',
          top: '-10%',
          left: '-10%',
          filter: 'blur(120px)',
          opacity: 0.08,
          transform: 'translateZ(50px)',
          mixBlendMode: 'screen'
        }} />
        <div className="glow-orb" style={{
          position: 'absolute',
          width: '700px',
          height: '700px',
          background: 'radial-gradient(circle, var(--accent-purple) 0%, transparent 70%)',
          bottom: '-10%',
          right: '-10%',
          filter: 'blur(120px)',
          opacity: 0.08,
          transform: 'translateZ(100px)',
          mixBlendMode: 'screen'
        }} />

      </div>
    </div>
  );
};

export default Background3D;
