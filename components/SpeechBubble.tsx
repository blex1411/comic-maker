import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialogue } from '../types';
import { TrashIcon } from './icons/TrashIcon';

interface SpeechBubbleProps {
  dialogue: Dialogue;
  onUpdate: (updatedDialogue: Dialogue) => void;
  onDelete: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

const comicFonts = [
  { name: 'Comic Neue', family: "'Comic Neue', cursive" },
  { name: 'Bangers', family: "'Bangers', cursive" },
  { name: 'Permanent Marker', family: "'Permanent Marker', cursive" },
  { name: 'Creepster', family: "'Creepster', cursive" },
];

const resizeHandles = [
  { direction: 'top-left', cursor: 'nwse-resize' },
  { direction: 'top', cursor: 'ns-resize' },
  { direction: 'top-right', cursor: 'nesw-resize' },
  { direction: 'left', cursor: 'ew-resize' },
  { direction: 'right', cursor: 'ew-resize' },
  { direction: 'bottom-left', cursor: 'nesw-resize' },
  { direction: 'bottom', cursor: 'ns-resize' },
  { direction: 'bottom-right', cursor: 'nwse-resize' },
];

const calculateTailPath = (
  bubblePosition: { x: number; y: number },
  bubbleSize: { width: number; height: number },
  tailPosition: { x: number; y: number },
  containerRect: DOMRect | null
): string => {
  if (!containerRect || !containerRect.width || !containerRect.height) return '';

  const bubbleRect = {
    width: (bubbleSize.width / 100) * containerRect.width,
    height: (bubbleSize.height / 100) * containerRect.height,
    left: (bubblePosition.x / 100) * containerRect.width,
    top: (bubblePosition.y / 100) * containerRect.height,
  };
  
  const tailX = (tailPosition.x / 100) * containerRect.width;
  const tailY = (tailPosition.y / 100) * containerRect.height;

  const bubbleCenterX = bubbleRect.left + bubbleRect.width / 2;
  const bubbleCenterY = bubbleRect.top + bubbleRect.height / 2;

  const dx = tailX - bubbleCenterX;
  const dy = tailY - bubbleCenterY;

  if (Math.abs(dx) < bubbleRect.width / 2 && Math.abs(dy) < bubbleRect.height / 2) {
    return '';
  }

  const scale = Math.min(1, (bubbleRect.width / 2) / Math.abs(dx), (bubbleRect.height / 2) / Math.abs(dy));
  const anchorX = bubbleCenterX + dx * scale;
  const anchorY = bubbleCenterY + dy * scale;

  const anchorRelative = { x: anchorX - bubbleRect.left, y: anchorY - bubbleRect.top };
  const tailTipRelative = { x: tailX - bubbleRect.left, y: tailY - bubbleRect.top };
  
  const length = Math.sqrt(dx * dx + dy * dy);
  const perp = length > 0 ? { x: -dy / length, y: dx / length } : { x: 1, y: 0 };
    
  const tailWidth = Math.min(20, bubbleRect.width * 0.4);
  const basePoint1 = { x: anchorRelative.x + perp.x * tailWidth / 2, y: anchorRelative.y + perp.y * tailWidth / 2 };
  const basePoint2 = { x: anchorRelative.x - perp.x * tailWidth / 2, y: anchorRelative.y - perp.y * tailWidth / 2 };

  return `M ${basePoint1.x} ${basePoint1.y} L ${tailTipRelative.x} ${tailTipRelative.y} L ${basePoint2.x} ${basePoint2.y} Z`;
};


export const SpeechBubble: React.FC<SpeechBubbleProps> = ({ dialogue, onUpdate, onDelete, containerRef }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(dialogue.speech_text);
  
  const [position, setPosition] = useState(dialogue.position || { x: 10, y: 10 });
  const [size, setSize] = useState(dialogue.size || { width: 30, height: 15 });
  const [tailPosition, setTailPosition] = useState(dialogue.tailPosition || { x: 50, y: 50 });
  const [fontSize, setFontSize] = useState(dialogue.fontSize || 1);
  const [fontFamily, setFontFamily] = useState(dialogue.fontFamily || comicFonts[0].family);
  const [tailPath, setTailPath] = useState('');

  const [controlsVisible, setControlsVisible] = useState(false);
  const hideTimeoutRef = useRef<number | null>(null);

  const nodeRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const interactionState = useRef({
      isDragging: false,
      isDraggingTail: false,
      isResizing: false,
      direction: '',
      offset: { x: 0, y: 0 },
      initialMousePos: { x: 0, y: 0 },
      initialSize: { width: 0, height: 0 },
      initialPosition: { x: 0, y: 0 },
  });

  useEffect(() => {
    setText(dialogue.speech_text);
    setPosition(dialogue.position || { x: 10, y: 10 });
    setSize(dialogue.size || { width: 30, height: 15 });
    setTailPosition(dialogue.tailPosition || { x: 50, y: 50 });
    setFontSize(dialogue.fontSize || 1);
    setFontFamily(dialogue.fontFamily || comicFonts[0].family);
  }, [dialogue]);

  useEffect(() => {
    if (containerRef.current) {
        const path = calculateTailPath(position, size, tailPosition, containerRef.current.getBoundingClientRect());
        setTailPath(path);
    }
  }, [position, size, tailPosition, containerRef]);
  
  const showControls = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (!interactionState.current.isResizing && !interactionState.current.isDragging && !interactionState.current.isDraggingTail) {
      setControlsVisible(true);
    }
  }, []);

  const hideControls = useCallback(() => {
    hideTimeoutRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 100);
  }, []);

  const handleInteractionMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;

    const state = interactionState.current;
    const containerRect = containerRef.current.getBoundingClientRect();
    
    if (state.isDragging) {
        const newX = e.clientX - containerRect.left - state.offset.x;
        const newY = e.clientY - containerRect.top - state.offset.y;

        const xPercentage = Math.max(0, Math.min(100 - size.width, (newX / containerRect.width) * 100));
        const yPercentage = Math.max(0, Math.min(100 - size.height, (newY / containerRect.height) * 100));
        
        const newPosition = { x: xPercentage, y: yPercentage };
        const newPath = calculateTailPath(newPosition, size, tailPosition, containerRect);
        
        setPosition(newPosition);
        setTailPath(newPath);

    } else if (state.isDraggingTail) {
        const newX = e.clientX - containerRect.left;
        const newY = e.clientY - containerRect.top;

        const xPercentage = Math.max(0, Math.min(100, (newX / containerRect.width) * 100));
        const yPercentage = Math.max(0, Math.min(100, (newY / containerRect.height) * 100));

        const newTailPosition = { x: xPercentage, y: yPercentage };
        const newPath = calculateTailPath(position, size, newTailPosition, containerRect);

        setTailPosition(newTailPosition);
        setTailPath(newPath);

    } else if (state.isResizing) {
        const { direction, initialMousePos, initialSize, initialPosition } = state;
        const dx = e.clientX - initialMousePos.x;
        const dy = e.clientY - initialMousePos.y;
        
        let newPosPx = { ...initialPosition };
        let newSizePx = { ...initialSize };
        const minWidthPx = 50;
        const minHeightPx = 40;

        if (direction.includes('bottom')) newSizePx.height = Math.max(minHeightPx, initialSize.height + dy);
        if (direction.includes('right')) newSizePx.width = Math.max(minWidthPx, initialSize.width + dx);
        if (direction.includes('top')) {
            const newHeight = Math.max(minHeightPx, initialSize.height - dy);
            newPosPx.y = initialPosition.y + (initialSize.height - newHeight);
            newSizePx.height = newHeight;
        }
        if (direction.includes('left')) {
            const newWidth = Math.max(minWidthPx, initialSize.width - dx);
            newPosPx.x = initialPosition.x + (initialSize.width - newWidth);
            newSizePx.width = newWidth;
        }
        
        if (newPosPx.x < 0) newPosPx.x = 0;
        if (newPosPx.y < 0) newPosPx.y = 0;
        if (newPosPx.x + newSizePx.width > containerRect.width) newSizePx.width = containerRect.width - newPosPx.x;
        if (newPosPx.y + newSizePx.height > containerRect.height) newSizePx.height = containerRect.height - newPosPx.y;
        
        const newPosition = {
            x: (newPosPx.x / containerRect.width) * 100,
            y: (newPosPx.y / containerRect.height) * 100
        };
        const newSize = {
            width: (newSizePx.width / containerRect.width) * 100,
            height: (newSizePx.height / containerRect.height) * 100
        };

        const newPath = calculateTailPath(newPosition, newSize, tailPosition, containerRect);

        setPosition(newPosition);
        setSize(newSize);
        setTailPath(newPath);
    }
  }, [containerRef, position, size, tailPosition]);

  const handleMouseUp = useCallback(() => {
    const wasInteracting = interactionState.current.isDragging || interactionState.current.isDraggingTail || interactionState.current.isResizing;
    
    if (wasInteracting) {
        // Use a function for the state update to get the latest values
        setPosition(currentPos => {
            setSize(currentSize => {
                setTailPosition(currentTailPos => {
                    onUpdate({ ...dialogue, speech_text: text, position: currentPos, size: currentSize, tailPosition: currentTailPos, fontSize, fontFamily });
                    return currentTailPos;
                });
                return currentSize;
            });
            return currentPos;
        });
    }
    
    interactionState.current = { ...interactionState.current, isDragging: false, isDraggingTail: false, isResizing: false };
    document.removeEventListener('mousemove', handleInteractionMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [onUpdate, dialogue, text, fontSize, fontFamily, handleInteractionMove]);
  
  const handleInteractionStart = (
      e: React.MouseEvent<HTMLDivElement>, 
      type: 'drag' | 'tail' | 'resize', 
      direction: string = ''
  ) => {
    if (isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    
    setControlsVisible(false);

    interactionState.current.isDragging = type === 'drag';
    interactionState.current.isDraggingTail = type === 'tail';
    interactionState.current.isResizing = type === 'resize';
    interactionState.current.direction = direction;
    interactionState.current.initialMousePos = { x: e.clientX, y: e.clientY };

    if (type === 'drag' && nodeRef.current) {
        const nodeRect = nodeRef.current.getBoundingClientRect();
        interactionState.current.offset = {
            x: e.clientX - nodeRect.left,
            y: e.clientY - nodeRect.top
        };
    } else if (type === 'resize' && containerRef.current && nodeRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const bubbleRect = nodeRef.current.getBoundingClientRect();
        interactionState.current.initialSize = { width: bubbleRect.width, height: bubbleRect.height };
        interactionState.current.initialPosition = { x: bubbleRect.left - containerRect.left, y: bubbleRect.top - containerRect.top };
    }

    document.addEventListener('mousemove', handleInteractionMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);
  
  const handleDoubleClick = () => setIsEditing(true);
  
  const handleBlur = () => {
    setIsEditing(false);
    onUpdate({ ...dialogue, speech_text: text, position, size, tailPosition, fontSize, fontFamily });
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleBlur(); }
    if (e.key === 'Escape') { setText(dialogue.speech_text); setIsEditing(false); }
  };
  
  const handleFontSizeChange = (newSize: number) => {
    const clampedSize = Math.max(0.5, Math.min(3, newSize));
    setFontSize(clampedSize);
    onUpdate({ ...dialogue, fontSize: clampedSize });
  };
  
  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFontFamily = e.target.value;
    setFontFamily(newFontFamily);
    onUpdate({ ...dialogue, fontFamily: newFontFamily });
  };

  const isMonologue = dialogue.type === 'monologue';

  const bubbleClasses = [
    'relative w-full h-full p-3 bg-gray-100 border-2 border-black text-black shadow-lg select-none flex flex-col rounded-2xl',
    !isEditing ? 'cursor-grab active:cursor-grabbing' : '',
    isMonologue ? 'border-dashed' : ''
  ].join(' ');

  return (
    <>
      <div
        ref={nodeRef}
        style={{ 
          left: `${position.x}%`, 
          top: `${position.y}%`,
          width: `${size.width}%`,
          height: `${size.height}%`,
          position: 'absolute',
          zIndex: 10,
        }}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={showControls}
        onMouseLeave={hideControls}
      >
        <div
          className={bubbleClasses}
          onMouseDown={(e) => handleInteractionStart(e, 'drag')}
          title="Drag to move, double-click to edit"
        >
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              style={{ fontSize: `${fontSize}rem`, fontFamily: fontFamily }}
              className="w-full h-full bg-transparent text-lg resize-none focus:outline-none border-none p-0 m-0 overflow-auto leading-tight tracking-wide flex-grow"
            />
          ) : (
            <p 
              style={{ fontSize: `${fontSize}rem`, fontFamily: fontFamily }}
              className="text-lg whitespace-pre-wrap break-words m-0 leading-tight tracking-wide overflow-auto w-full h-full"
            >
                {text || ' '}
            </p>
          )}
        </div>
         <svg
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: -1 }}
        >
            <path 
              d={tailPath} 
              fill="#f3f4f6" 
              stroke="black" 
              strokeWidth="2"
              {...(isMonologue && { strokeDasharray: "4 4" })}
            />
        </svg>

        {!isEditing && controlsVisible && (
          <>
            {resizeHandles.map(({ direction, cursor }) => (
                <div
                    key={direction}
                    onMouseDown={(e) => handleInteractionStart(e, 'resize', direction)}
                    className="absolute bg-pink-500/80 border border-white rounded-sm"
                    style={{
                        width: '10px',
                        height: '10px',
                        cursor,
                        top: direction.includes('top') ? '-5px' : direction.includes('bottom') ? 'auto' : '50%',
                        bottom: direction.includes('bottom') ? '-5px' : 'auto',
                        left: direction.includes('left') ? '-5px' : direction.includes('right') ? 'auto' : '50%',
                        right: direction.includes('right') ? '-5px' : 'auto',
                        transform: `translate(${direction.includes('left') || direction.includes('right') ? '0' : '-50%'}, ${direction.includes('top') || direction.includes('bottom') ? '0' : '-50%'})`,
                        zIndex: 20
                    }}
                />
            ))}
            <div
                className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-800/80 backdrop-blur-sm p-1 rounded-full z-30 shadow-lg"
                onMouseDown={(e) => e.stopPropagation()}
                onMouseEnter={showControls}
                onMouseLeave={hideControls}
            >
                <button
                    onClick={onDelete}
                    className="p-1.5 bg-red-600 hover:bg-red-500 rounded-full text-white leading-none transition-transform hover:scale-110"
                    title="Hapus gelembung"
                    aria-label="Hapus gelembung teks"
                >
                    <TrashIcon className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-0.5 bg-slate-700/50 p-0.5 rounded-full">
                    <button
                        onClick={() => handleFontSizeChange(fontSize - 0.1)}
                        className="w-6 h-6 flex items-center justify-center text-white font-bold leading-none rounded-full hover:bg-slate-600 text-lg"
                        title="Perkecil Teks"
                    >
                        -
                    </button>
                     <span className="text-white text-xs w-6 text-center tabular-nums">{(fontSize).toFixed(1)}</span>
                    <button
                        onClick={() => handleFontSizeChange(fontSize + 0.1)}
                        className="w-6 h-6 flex items-center justify-center text-white font-bold leading-none rounded-full hover:bg-slate-600 text-base"
                        title="Perbesar Teks"
                    >
                        +
                    </button>
                </div>
                <select
                  value={fontFamily}
                  onChange={handleFontFamilyChange}
                  className="bg-slate-700 text-white text-xs rounded-full px-2 py-1 h-7 border border-transparent hover:bg-slate-600 focus:outline-none focus:ring-1 focus:ring-pink-500"
                  title="Ubah font"
                >
                  {comicFonts.map(font => (
                    <option key={font.name} value={font.family} style={{ fontFamily: font.family, fontSize: '1rem' }}>
                      {font.name}
                    </option>
                  ))}
                </select>
            </div>
          </>
        )}
      </div>
      
      {controlsVisible && (
        <div
            className="absolute w-4 h-4 bg-pink-500/70 border-2 border-white rounded-full cursor-move z-20 transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${tailPosition.x}%`, top: `${tailPosition.y}%` }}
            onMouseDown={(e) => handleInteractionStart(e, 'tail')}
            onMouseEnter={showControls}
            onMouseLeave={hideControls}
            title="Drag to move tail"
          />
      )}
    </>
  );
};
