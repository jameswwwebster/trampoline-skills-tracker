import React, { useState, useRef, useEffect } from 'react';
import './WaveLength.css';

const GAME_PHASES = {
  SET_LABELS: 'set_labels',
  SPIN: 'spin',
  VIEW: 'view',
  SET_POINTER: 'set_pointer',
  REVEAL: 'reveal'
};

const SCORE_LABELS = ['Right there', 'Right where?', 'Not there', 'Nowhere'];

// Disc constants
const DISC_SIZE = 400;
const DISC_CENTER = DISC_SIZE / 2;
const DISC_RADIUS = 150;
// "Right there" segment is centered at 90° (top of disc)
const RIGHT_THERE_ANGLE = 90;

function WaveLength() {
  const [leftLabel, setLeftLabel] = useState('');
  const [rightLabel, setRightLabel] = useState('');
  const [phase, setPhase] = useState(GAME_PHASES.SET_LABELS);
  const [discRotation, setDiscRotation] = useState(0); // Rotation angle of the disc (0-360)
  const [isSpinning, setIsSpinning] = useState(false);
  const [guessAngle, setGuessAngle] = useState(null); // Where player thinks "Right there" landed (0-180, top semicircle)
  const [isVisible, setIsVisible] = useState(false);
  const [score, setScore] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const discRef = useRef(null);

  // Calculate score based on angular difference between actual "Right there" position and guess
  // The target is where "Right there" (90°) appears after rotation
  // We need to find where 90° appears on the top semicircle after rotation
  const calculateScore = (actualRotation, guessAngle) => {
    // After rotation, the "Right there" segment (at 90° on disc) appears at:
    // topPosition = (90 - actualRotation + 360) % 360
    // But we only care about the top semicircle (0-180°)
    let actualTopPosition = (90 - actualRotation + 360) % 360;
    
    // If it's in the bottom half, find the equivalent position
    if (actualTopPosition > 180) {
      actualTopPosition = 360 - actualTopPosition;
    }
    
    // Calculate angular distance
    let distance = Math.abs(actualTopPosition - guessAngle);
    if (distance > 90) {
      distance = 180 - distance; // Take shorter path
    }
    
    // Score based on distance
    // "Right there" = 0-2.5° (5° total, ±2.5°)
    // "Right where?" = 2.5-7.5° (5° on each side)
    // "Not there" = 7.5-12.5° (5° on each side)
    // "Nowhere" = >12.5°
    if (distance <= 2.5) return 0; // Right there
    if (distance <= 7.5) return 1; // Right where?
    if (distance <= 12.5) return 2; // Not there
    return 3; // Nowhere
  };

  // Calculate angle from center to a point
  // The container shows only the top half of a circle, so the center is at the bottom of the container
  const getAngleFromPoint = (x, y, rect) => {
    const centerX = rect.left + rect.width / 2;
    // For a semicircle container (aspect-ratio 2:1), the circle center is at the bottom
    const centerY = rect.top + rect.height; // Bottom of container = center of full circle
    const clickX = x - centerX;
    const clickY = y - centerY;
    
    // Calculate angle (0° = right, 90° = bottom, 180° = left, 270° = top)
    let angle = Math.atan2(clickY, clickX) * 180 / Math.PI;
    angle = (angle + 360) % 360;
    
    // Convert to top semicircle position (0-180°, where 0° = right edge, 90° = top, 180° = left edge)
    // For top semicircle, we want 0° at right edge, 90° at top, 180° at left edge
    // Since we're only showing the top half, angles in the bottom half (180-360) should be mirrored
    if (angle > 180) {
      angle = 360 - angle; // Mirror bottom half to top
    }
    
    return angle;
  };

  // Handle drag start
  const handleDragStart = (e) => {
    if (phase !== GAME_PHASES.SET_POINTER) return;
    
    e.preventDefault();
    setIsDragging(true);
    
    const rect = discRef.current.getBoundingClientRect();
    const x = e.clientX || (e.touches && e.touches[0]?.clientX);
    const y = e.clientY || (e.touches && e.touches[0]?.clientY);
    
    if (x !== undefined && y !== undefined) {
      const angle = getAngleFromPoint(x, y, rect);
      setGuessAngle(angle);
    }
  };

  // Handle drag move
  const handleDragMove = (e) => {
    if (phase !== GAME_PHASES.SET_POINTER || !isDragging) return;
    
    e.preventDefault();
    const rect = discRef.current.getBoundingClientRect();
    const x = e.clientX || (e.touches && e.touches[0]?.clientX);
    const y = e.clientY || (e.touches && e.touches[0]?.clientY);
    
    if (x !== undefined && y !== undefined) {
      const angle = getAngleFromPoint(x, y, rect);
      setGuessAngle(angle);
    }
  };

  // Handle drag end
  const handleDragEnd = (e) => {
    if (phase !== GAME_PHASES.SET_POINTER) return;
    setIsDragging(false);
  };

  // Add global event listeners for dragging
  useEffect(() => {
    if (!isDragging || phase !== GAME_PHASES.SET_POINTER) return;

    const handleMouseMove = (e) => {
      if (!discRef.current) return;
      e.preventDefault();
      const rect = discRef.current.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      const angle = getAngleFromPoint(x, y, rect);
      setGuessAngle(angle);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleTouchMove = (e) => {
      if (!discRef.current) return;
      e.preventDefault();
      const rect = discRef.current.getBoundingClientRect();
      const x = e.touches[0]?.clientX;
      const y = e.touches[0]?.clientY;
      if (x !== undefined && y !== undefined) {
        const angle = getAngleFromPoint(x, y, rect);
        setGuessAngle(angle);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, phase]);

  // Handle spin - animate rotation
  const handleSpin = () => {
    setIsSpinning(true);
    // Random rotation (multiple full rotations + final position)
    const baseRotation = Math.random() * 360;
    const extraRotations = 5 + Math.random() * 5; // 5-10 extra rotations
    const finalRotation = baseRotation + (extraRotations * 360);
    
    setDiscRotation(finalRotation);
    
    // Stop spinning after animation
    setTimeout(() => {
      setIsSpinning(false);
      setPhase(GAME_PHASES.VIEW);
      setIsVisible(true);
      setGuessAngle(null);
      setScore(null);
    }, 2000); // 2 second spin animation
  };

  // Handle phase transitions
  const handleSetLabels = () => {
    if (leftLabel.trim() && rightLabel.trim()) {
      setPhase(GAME_PHASES.SPIN);
    }
  };

  const handleView = () => {
    setIsVisible(false);
    setPhase(GAME_PHASES.SET_POINTER);
  };

  const handleSetPointer = () => {
    if (guessAngle !== null) {
      const calculatedScore = calculateScore(discRotation, guessAngle);
      setScore(calculatedScore);
      setIsVisible(true);
      setPhase(GAME_PHASES.REVEAL);
    }
  };

  const handleNewRound = () => {
    setPhase(GAME_PHASES.SPIN);
    setDiscRotation(0);
    setGuessAngle(null);
    setIsVisible(false);
    setScore(null);
    setIsSpinning(false);
  };

  const handleReset = () => {
    setPhase(GAME_PHASES.SET_LABELS);
    setLeftLabel('');
    setRightLabel('');
    setDiscRotation(0);
    setGuessAngle(null);
    setIsVisible(false);
    setScore(null);
    setIsSpinning(false);
  };

  // Get current action button
  const getActionButton = () => {
    switch (phase) {
      case GAME_PHASES.SET_LABELS:
        return (
          <button 
            className="action-button primary" 
            onClick={handleSetLabels}
            disabled={!leftLabel.trim() || !rightLabel.trim()}
          >
            Set Labels
          </button>
        );
      case GAME_PHASES.SPIN:
        return (
          <button className="action-button primary" onClick={handleSpin} disabled={isSpinning}>
            {isSpinning ? 'Spinning...' : 'Spin'}
          </button>
        );
      case GAME_PHASES.VIEW:
        return (
          <button className="action-button primary" onClick={handleView}>
            Hide & Start Guessing
          </button>
        );
      case GAME_PHASES.SET_POINTER:
        return (
          <button 
            className="action-button primary" 
            onClick={handleSetPointer}
            disabled={guessAngle === null}
          >
            Reveal
          </button>
        );
      case GAME_PHASES.REVEAL:
        return null; // No action needed, result is already shown
      default:
        return null;
    }
  };

  // Helper function to create arc path for score segments
  // Creates a radial segment from center to edge, between two angles
  // Angles are relative to disc (0° = right, 90° = top, 180° = left, 270° = bottom)
  const createArcPath = (startAngle, endAngle) => {
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;
    
    const x1 = DISC_CENTER + DISC_RADIUS * Math.cos(startRad);
    const y1 = DISC_CENTER + DISC_RADIUS * Math.sin(startRad);
    const x2 = DISC_CENTER + DISC_RADIUS * Math.cos(endRad);
    const y2 = DISC_CENTER + DISC_RADIUS * Math.sin(endRad);
    
    const angleDiff = ((endAngle - startAngle + 360) % 360);
    const largeArc = angleDiff > 180 ? 1 : 0;
    
    return `M ${DISC_CENTER} ${DISC_CENTER} L ${x1} ${y1} A ${DISC_RADIUS} ${DISC_RADIUS} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  // Calculate where "Right there" appears on top semicircle after rotation
  const getRightThereTopPosition = () => {
    // "Right there" is at 90° on the disc
    // After rotation, it appears at: (90 - discRotation + 360) % 360
    let position = (90 - discRotation + 360) % 360;
    
    // Convert to top semicircle (0-180°)
    if (position > 180) {
      position = 360 - position;
    }
    
    return position;
  };

  return (
    <div className="wavelength-container">
      <div className="wavelength-header">
        <h1>WaveLength</h1>
        <div className="phase-indicator">
          Phase: {phase.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </div>
      </div>

      <div className="wavelength-content">
        {/* Labels Input */}
        {phase === GAME_PHASES.SET_LABELS && (
          <div className="labels-input">
            <div className="label-input-group">
              <label>Left Label:</label>
              <input
                type="text"
                value={leftLabel}
                onChange={(e) => setLeftLabel(e.target.value)}
                placeholder="Enter left label"
                className="label-input"
              />
            </div>
            <div className="label-input-group">
              <label>Right Label:</label>
              <input
                type="text"
                value={rightLabel}
                onChange={(e) => setRightLabel(e.target.value)}
                placeholder="Enter right label"
                className="label-input"
              />
            </div>
          </div>
        )}

        {/* Circular Disc Display */}
        {(phase !== GAME_PHASES.SET_LABELS) && (
          <div className="disc-wrapper">
            {/* Left Label */}
            <div className="side-label side-label-left">
              {leftLabel || 'Left'}
            </div>

            {/* Disc Container - only top half visible */}
            <div className="disc-container">
              {/* Hidden during guessing phase */}
              {phase !== GAME_PHASES.SET_POINTER && (
                <div 
                  ref={discRef}
                  className={`disc ${isSpinning ? 'spinning' : ''}`}
                  style={{ 
                    transform: `rotate(${discRotation}deg)`,
                    transition: isSpinning ? 'transform 2s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none'
                  }}
                >
                  <svg 
                    viewBox={`0 0 ${DISC_SIZE} ${DISC_SIZE}`}
                    className="disc-svg"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {/* Score segments - fixed on disc */}
                    {/* "Right there" - 5 degrees centered at 90° (87.5° to 92.5°) */}
                    <path
                      d={createArcPath(87.5, 92.5)}
                      className="score-segment score-0"
                      fill="rgba(46, 204, 113, 0.5)"
                      stroke="white"
                      strokeWidth="2"
                    />
                    
                    {/* "Right where?" - 5 degrees on each side (82.5-87.5 and 92.5-97.5) */}
                    <path
                      d={createArcPath(82.5, 87.5)}
                      className="score-segment score-1"
                      fill="rgba(241, 196, 15, 0.5)"
                      stroke="white"
                      strokeWidth="2"
                    />
                    <path
                      d={createArcPath(92.5, 97.5)}
                      className="score-segment score-1"
                      fill="rgba(241, 196, 15, 0.5)"
                      stroke="white"
                      strokeWidth="2"
                    />
                    
                    {/* "Not there" - 5 degrees on each side (77.5-82.5 and 97.5-102.5) */}
                    <path
                      d={createArcPath(77.5, 82.5)}
                      className="score-segment score-2"
                      fill="rgba(243, 156, 18, 0.5)"
                      stroke="white"
                      strokeWidth="2"
                    />
                    <path
                      d={createArcPath(97.5, 102.5)}
                      className="score-segment score-2"
                      fill="rgba(243, 156, 18, 0.5)"
                      stroke="white"
                      strokeWidth="2"
                    />
                    
                    {/* "Nowhere" - the rest */}
                    <path
                      d={createArcPath(0, 77.5)}
                      className="score-segment score-3"
                      fill="rgba(231, 76, 60, 0.5)"
                      stroke="white"
                      strokeWidth="2"
                    />
                    <path
                      d={createArcPath(102.5, 180)}
                      className="score-segment score-3"
                      fill="rgba(231, 76, 60, 0.5)"
                      stroke="white"
                      strokeWidth="2"
                    />
                    
                    {/* Repeat on bottom half (180° away) */}
                    <path
                      d={createArcPath(267.5, 272.5)}
                      className="score-segment score-0"
                      fill="rgba(46, 204, 113, 0.5)"
                      stroke="white"
                      strokeWidth="2"
                    />
                    <path
                      d={createArcPath(262.5, 267.5)}
                      className="score-segment score-1"
                      fill="rgba(241, 196, 15, 0.5)"
                      stroke="white"
                      strokeWidth="2"
                    />
                    <path
                      d={createArcPath(272.5, 277.5)}
                      className="score-segment score-1"
                      fill="rgba(241, 196, 15, 0.5)"
                      stroke="white"
                      strokeWidth="2"
                    />
                    <path
                      d={createArcPath(257.5, 262.5)}
                      className="score-segment score-2"
                      fill="rgba(243, 156, 18, 0.5)"
                      stroke="white"
                      strokeWidth="2"
                    />
                    <path
                      d={createArcPath(277.5, 282.5)}
                      className="score-segment score-2"
                      fill="rgba(243, 156, 18, 0.5)"
                      stroke="white"
                      strokeWidth="2"
                    />
                    <path
                      d={createArcPath(180, 257.5)}
                      className="score-segment score-3"
                      fill="rgba(231, 76, 60, 0.5)"
                      stroke="white"
                      strokeWidth="2"
                    />
                    <path
                      d={createArcPath(282.5, 360)}
                      className="score-segment score-3"
                      fill="rgba(231, 76, 60, 0.5)"
                      stroke="white"
                      strokeWidth="2"
                    />

                    {/* Show "Right there" position during view and reveal */}
                    {isVisible && (
                      <g className="target-indicator">
                        {(() => {
                          const topPosition = getRightThereTopPosition();
                          const angleRad = (topPosition - 90) * Math.PI / 180;
                          return (
                            <>
                              <line
                                x1={DISC_CENTER}
                                y1={DISC_CENTER}
                                x2={DISC_CENTER + DISC_RADIUS * Math.cos(angleRad)}
                                y2={DISC_CENTER + DISC_RADIUS * Math.sin(angleRad)}
                                stroke="#ffd700"
                                strokeWidth="6"
                                strokeLinecap="round"
                                style={{ filter: 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.9))' }}
                              />
                              <circle
                                cx={DISC_CENTER + (DISC_RADIUS + 20) * Math.cos(angleRad)}
                                cy={DISC_CENTER + (DISC_RADIUS + 20) * Math.sin(angleRad)}
                                r="12"
                                fill="#ffd700"
                                stroke="white"
                                strokeWidth="3"
                              />
                            </>
                          );
                        })()}
                      </g>
                    )}

                    {/* Show guess position during reveal */}
                    {phase === GAME_PHASES.REVEAL && guessAngle !== null && (
                      <g className="guess-indicator">
                        {(() => {
                          const angleRad = (guessAngle - 90) * Math.PI / 180;
                          return (
                            <>
                              <line
                                x1={DISC_CENTER}
                                y1={DISC_CENTER}
                                x2={DISC_CENTER + DISC_RADIUS * Math.cos(angleRad)}
                                y2={DISC_CENTER + DISC_RADIUS * Math.sin(angleRad)}
                                stroke="#4ecdc4"
                                strokeWidth="6"
                                strokeLinecap="round"
                                style={{ filter: 'drop-shadow(0 0 8px rgba(78, 205, 196, 0.9))' }}
                              />
                              <circle
                                cx={DISC_CENTER + (DISC_RADIUS + 20) * Math.cos(angleRad)}
                                cy={DISC_CENTER + (DISC_RADIUS + 20) * Math.sin(angleRad)}
                                r="12"
                                fill="#4ecdc4"
                                stroke="white"
                                strokeWidth="3"
                              />
                            </>
                          );
                        })()}
                      </g>
                    )}

                    {/* Center point */}
                    <circle
                      cx={DISC_CENTER}
                      cy={DISC_CENTER}
                      r="6"
                      fill="white"
                      stroke="#333"
                      strokeWidth="3"
                    />
                  </svg>
                </div>
              )}

              {/* Guessing phase - hidden disc, show draggable dial */}
              {phase === GAME_PHASES.SET_POINTER && (
                <div 
                  ref={discRef}
                  className="disc-guess-area"
                  onMouseDown={handleDragStart}
                  onTouchStart={handleDragStart}
                >
                  {/* Dial pointer - extends from center to edge */}
                  <div 
                    className="dial-pointer"
                    style={{
                      transform: `rotate(${guessAngle !== null ? guessAngle - 90 : -90}deg)`,
                      transformOrigin: 'center center',
                      opacity: guessAngle !== null ? 1 : 0.5
                    }}
                  >
                    <div className="dial-line"></div>
                    <div className="dial-handle"></div>
                  </div>
                </div>
              )}

              {/* Score display */}
              {score !== null && (
                <div className="score-display">
                  <div className={`score-result score-${score}`}>
                    {SCORE_LABELS[score]}
                  </div>
                </div>
              )}
            </div>

            {/* Right Label */}
            <div className="side-label side-label-right">
              {rightLabel || 'Right'}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="action-buttons">
          {getActionButton()}
          {phase !== GAME_PHASES.SET_LABELS && (
            <button className="action-button secondary" onClick={handleNewRound}>
              New Round
            </button>
          )}
          <button className="action-button secondary" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

export default WaveLength;
