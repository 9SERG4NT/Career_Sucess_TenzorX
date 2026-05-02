import React, { useEffect, useRef, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';

const PARTICLE_COUNT = 28;

const Background3D = () => {
  const containerRef = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 12;
      const y = (e.clientY / window.innerHeight - 0.5) * 12;
      containerRef.current.style.transform = `rotateX(${-y}deg) rotateY(${x}deg)`;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const particles = useMemo(() => Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    size: Math.random() * 3 + 1.5,
    delay: Math.random() * 6,
    duration: Math.random() * 8 + 8,
    opacity: Math.random() * 0.4 + 0.15,
    colorIndex: i % 3,
  })), []);

  const isDark = theme === 'dark';

  const particleColors = isDark
    ? ['rgba(59,130,246,', 'rgba(139,92,246,', 'rgba(6,182,212,']
    : ['rgba(59,130,246,', 'rgba(139,92,246,', 'rgba(16,185,129,'];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
        perspective: '1200px',
        overflow: 'hidden',
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: '100%', height: '100%',
          transition: 'transform 0.12s ease-out',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Perspective grid */}
        <div style={{
          position: 'absolute',
          width: '200%', height: '200%',
          top: '-50%', left: '-50%',
          backgroundImage: isDark
            ? `linear-gradient(rgba(59,130,246,0.07) 1px, transparent 1px),
               linear-gradient(90deg, rgba(59,130,246,0.07) 1px, transparent 1px)`
            : `linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
               linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
          transform: 'rotateX(62deg) translateZ(-120px)',
          opacity: isDark ? 0.6 : 0.5,
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 100%)',
        }} />

        {/* Primary blue orb — top-left */}
        <div style={{
          position: 'absolute',
          width: '900px', height: '900px',
          background: 'radial-gradient(circle, rgba(59,130,246,1) 0%, transparent 65%)',
          top: '-20%', left: '-15%',
          filter: 'blur(140px)',
          opacity: isDark ? 0.07 : 0.04,
          transform: 'translateZ(40px)',
        }} />

        {/* Purple orb — bottom-right */}
        <div style={{
          position: 'absolute',
          width: '800px', height: '800px',
          background: 'radial-gradient(circle, rgba(139,92,246,1) 0%, transparent 65%)',
          bottom: '-15%', right: '-10%',
          filter: 'blur(130px)',
          opacity: isDark ? 0.08 : 0.04,
          transform: 'translateZ(80px)',
        }} />

        {/* Cyan accent orb — center-right */}
        <div style={{
          position: 'absolute',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(6,182,212,1) 0%, transparent 70%)',
          top: '30%', right: '10%',
          filter: 'blur(100px)',
          opacity: isDark ? 0.05 : 0.03,
          transform: 'translateZ(60px)',
        }} />

        {/* Emerald orb — bottom-left */}
        <div style={{
          position: 'absolute',
          width: '450px', height: '450px',
          background: 'radial-gradient(circle, rgba(16,185,129,1) 0%, transparent 70%)',
          bottom: '5%', left: '15%',
          filter: 'blur(110px)',
          opacity: isDark ? 0.05 : 0.03,
          transform: 'translateZ(30px)',
        }} />

        {/* Rose accent — top-right corner */}
        <div style={{
          position: 'absolute',
          width: '350px', height: '350px',
          background: 'radial-gradient(circle, rgba(244,63,94,1) 0%, transparent 70%)',
          top: '5%', right: '5%',
          filter: 'blur(100px)',
          opacity: isDark ? 0.04 : 0.02,
          transform: 'translateZ(20px)',
        }} />

        {/* Floating particles */}
        {particles.map(p => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: p.left,
              top: p.top,
              width: `${p.size}px`,
              height: `${p.size}px`,
              borderRadius: '50%',
              background: `${particleColors[p.colorIndex]}${p.opacity})`,
              boxShadow: `0 0 ${p.size * 3}px ${particleColors[p.colorIndex]}${p.opacity * 0.7})`,
              animation: `floatParticle ${p.duration}s ease-in-out ${p.delay}s infinite`,
              transform: 'translateZ(20px)',
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes floatParticle {
          0%, 100% { transform: translateZ(20px) translateY(0px) scale(1); opacity: var(--op); }
          33% { transform: translateZ(30px) translateY(-18px) scale(1.1); }
          66% { transform: translateZ(10px) translateY(10px) scale(0.9); }
        }
      `}</style>
    </div>
  );
};

export default Background3D;
