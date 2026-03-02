import { useState, useEffect } from 'react';
import { getSupabaseConfig } from '../services/storageService';
import { MikirCloud } from '../services/supabaseService';
import { useAppStore } from '../store/useAppStore';

export const useMultiplayerSync = (setCurrentIndex: (index: number) => void) => {
  const { isMultiplayer, multiplayerRoomId: roomId } = useAppStore();
  const [multiplayerScores, setMultiplayerScores] = useState<any[]>([]);

  // Fetch and subscribe to multiplayer scores
  useEffect(() => {
    if (!isMultiplayer || !roomId) return;

    const fetchScores = async () => {
      try {
        const config = getSupabaseConfig();
        if (!config) return;
        const data = await MikirCloud.multiplayer.getLeaderboard(config, roomId);
        setMultiplayerScores(data);
      } catch (err) {
        console.error("Failed to fetch multiplayer scores", err);
      }
    };

    fetchScores();

    const config = getSupabaseConfig();
    if (config) {
      const subscription = MikirCloud.multiplayer.subscribeToLeaderboard(config, roomId, () => {
        fetchScores();
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [isMultiplayer, roomId]);

  // Subscribe to Room Status (Question Index)
  useEffect(() => {
    if (!isMultiplayer || !roomId) return;

    const config = getSupabaseConfig();
    if (config) {
      const subscription = MikirCloud.multiplayer.subscribeToRoom(config, roomId, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new.current_question_index !== undefined) {
          setCurrentIndex(payload.new.current_question_index);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [isMultiplayer, roomId, setCurrentIndex]);

  return { multiplayerScores };
};
