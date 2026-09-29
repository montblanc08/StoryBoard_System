import { create } from 'zustand';

export interface PresenceUser {
  session_id: string;
  user_id: string;
  user_name: string;
  color: string;
  state: string;
  selected_shot_id?: string | null;
  focused_field?: string | null;
}

export interface PresenceState {
  users: PresenceUser[];
  ws: WebSocket | null;
  isConnected: boolean;
  connect: (productionId: string, userId: string, userName: string) => void;
  disconnect: () => void;
  sendHeartbeat: (selectedShotId?: string | null, focusedField?: string | null) => void;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
function getColorForUser(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  users: [],
  ws: null,
  isConnected: false,

  connect: (productionId: string, userId: string, userName: string) => {
    const { ws, disconnect } = get();
    if (ws) disconnect();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // When running locally, Next.js dev server is on port 3000, API is on port 8000
    // We assume the API is at /api or port 8000
    const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
    
    const socket = new WebSocket(`${protocol}//${host}/api/v1/presence/rooms/${productionId}/ws`);
    
    socket.onopen = () => {
      set({ isConnected: true, ws: socket });
      
      const sessionId = Math.random().toString(36).substring(7);
      
      socket.send(JSON.stringify({
        type: 'join',
        session_id: sessionId,
        user_id: userId,
        user_name: userName,
        color: getColorForUser(userId),
        state: 'viewing'
      }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'init' || msg.type === 'presence_update') {
          const snapshot = msg.data;
          const usersList = (snapshot.sessions || []) as PresenceUser[];
          set({ users: usersList });
        }
      } catch (err) {
        console.error('Failed to parse presence message:', err);
      }
    };

    socket.onclose = () => {
      set({ isConnected: false, ws: null, users: [] });
    };

    set({ ws: socket });
  },

  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
      set({ ws: null, isConnected: false, users: [] });
    }
  },

  sendHeartbeat: (selectedShotId?: string | null, focusedField?: string | null) => {
    const { ws, isConnected } = get();
    if (ws && isConnected) {
      ws.send(JSON.stringify({
        type: 'heartbeat',
        selected_shot_id: selectedShotId,
        focused_field: focusedField
      }));
    }
  }
}));
