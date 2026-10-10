import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useDragControls } from 'framer-motion';

export interface DragPosition {
  x: number;
  y: number;
}

interface DraggableFloatingWrapperProps {
  children: (props: {
    dragControls: ReturnType<typeof useDragControls>;
    position: DragPosition;
    setPosition: (pos: DragPosition) => void;
    snapToPreset: (preset: 'chart-bottom-right' | 'chart-top-right' | 'outside-right' | 'outside-left' | 'center') => void;
  }) => React.ReactNode;
  storageKey?: string;
  defaultPosition?: DragPosition;
  className?: string;
  isCollapsed?: boolean;
}

export const DraggableFloatingWrapper: React.FC<DraggableFloatingWrapperProps> = ({
  children,
  storageKey = 'quantbridge_floating_order_placer_pos',
  defaultPosition,
  className = '',
  isCollapsed = false,
}) => {
  const dragControls = useDragControls();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Initialize position from local state / localStorage, fallback to responsive default
  const [position, setPosition] = useState<DragPosition>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            const clampedX = Math.max(10, Math.min(window.innerWidth - (isCollapsed ? 260 : 360), parsed.x));
            const clampedY = Math.max(10, Math.min(window.innerHeight - 80, parsed.y));
            return { x: clampedX, y: clampedY };
          }
        }
      } catch (err) {
        console.warn('Failed to load saved draggable position:', err);
      }
      const initialX = defaultPosition?.x ?? Math.max(20, window.innerWidth - 380);
      const initialY = defaultPosition?.y ?? Math.max(80, window.innerHeight - 640);
      return { x: initialX, y: initialY };
    }
    return defaultPosition ?? { x: 100, y: 100 };
  });

  // Persist position changes to localStorage
  const handleUpdatePosition = (newPos: DragPosition) => {
    setPosition(newPos);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newPos));
      } catch (err) {
        // ignore localStorage quota errors
      }
    }
  };

  // Re-clamp position on window resize so widget never stays off-screen
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const width = isCollapsed ? 260 : 360;
        const clampedX = Math.max(10, Math.min(window.innerWidth - width, prev.x));
        const clampedY = Math.max(10, Math.min(window.innerHeight - 80, prev.y));
        if (clampedX !== prev.x || clampedY !== prev.y) {
          const updated = { x: clampedX, y: clampedY };
          try {
            localStorage.setItem(storageKey, JSON.stringify(updated));
          } catch (e) {}
          return updated;
        }
        return prev;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCollapsed, storageKey]);

  // Snap to preset positions across the viewport (both inside and outside chart)
  const snapToPreset = (preset: 'chart-bottom-right' | 'chart-top-right' | 'outside-right' | 'outside-left' | 'center') => {
    if (typeof window === 'undefined') return;

    let targetX = position.x;
    let targetY = position.y;

    if (preset === 'chart-bottom-right') {
      targetX = Math.max(20, window.innerWidth - 380);
      targetY = Math.max(80, window.innerHeight - 640);
    } else if (preset === 'chart-top-right') {
      targetX = Math.max(20, window.innerWidth - 380);
      targetY = 110;
    } else if (preset === 'outside-right') {
      targetX = Math.max(20, window.innerWidth - 360);
      targetY = Math.max(40, (window.innerHeight - 560) / 2);
    } else if (preset === 'outside-left') {
      targetX = 20;
      targetY = Math.max(40, (window.innerHeight - 560) / 2);
    } else if (preset === 'center') {
      targetX = Math.max(20, (window.innerWidth - 350) / 2);
      targetY = Math.max(40, (window.innerHeight - 560) / 2);
    }

    handleUpdatePosition({ x: targetX, y: targetY });
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <motion.div
      ref={wrapperRef}
      drag
      dragListener={false} // Only drag when initiating from dragControls (the header handle)
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', damping: 30, stiffness: 400, mass: 0.8 }}
      onDragEnd={(_, info) => {
        const width = isCollapsed ? 260 : 360;
        const newX = position.x + info.offset.x;
        const newY = position.y + info.offset.y;
        const clampedX = Math.max(10, Math.min(window.innerWidth - width, newX));
        const clampedY = Math.max(10, Math.min(window.innerHeight - 70, newY));
        handleUpdatePosition({ x: clampedX, y: clampedY });
      }}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 9999,
      }}
      className={`select-none touch-none ${className}`}
    >
      {children({
        dragControls,
        position,
        setPosition: handleUpdatePosition,
        snapToPreset,
      })}
    </motion.div>,
    document.body
  );
};
