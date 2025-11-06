export interface Character {
  id: string;
  file: File;
  base64: string; // Raw base64 string
  previewUrl: string; // Data URL for img src
  name: string;
  mimeType: string;
  description?: string;
}

export interface Dialogue {
  character: string; // e.g., "[CHARACTER_1]"
  speech_text: string;
  type?: 'dialogue' | 'monologue';
  fontSize?: number;
  fontFamily?: string;
  position?: { x: number; y: number }; // Percentage-based position
  tailPosition?: { x: number; y: number }; // Percentage-based position of the tail tip
  size?: { width: number; height: number }; // Percentage-based size
}

export interface TextOverlay {
  text: string;
  style: 'caption' | 'onomatopoeia';
}

export interface Panel {
  id: string;
  panel_number: number;
  narrative_text: string;
  visual_description: string;
  dialogues?: Dialogue[];
  text_overlays?: TextOverlay[];
  imageUrl?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface Storybook {
  id: string;
  name: string;
  panels: Panel[];
}