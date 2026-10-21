/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  FileText,
  CheckSquare,
  MessageSquare,
  Bot,
  Download,
  Calendar,
  Clock,
  Share2,
  ChevronRight,
  ArrowLeft,
  Volume2,
} from 'lucide-react';
import { MeetingData, Participant, ActionItem } from './types/meeting';
import { SAMPLE_MEETING } from './utils/mockData';
import { Header } from './components/Header';
import { AudioImporter } from './components/AudioImporter';
import { ParticipantsView } from './components/ParticipantsView';
import { ExecutiveSummaryView } from './components/ExecutiveSummaryView';
import { ActionItemsView } from './components/ActionItemsView';
import { TranscriptView } from './components/TranscriptView';
import { MeetingChat } from './components/MeetingChat';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { ExportModal } from './components/ExportModal';
import { HistoryModal } from './components/HistoryModal';
import { exportTasksToCSV } from './utils/exporter';

export default function App() {
  const [currentMeeting, setCurrentMeeting] = useState<MeetingData | null>(null);
  const [savedMeetings, setSavedMeetings] = useState<MeetingData[]>([]);
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'chat'>('summary');
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);

  // Modals
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load saved meetings from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('transcribeia_meetings');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSavedMeetings(parsed);
        }
      }
    } catch (e) {
      console.warn('Error reading from localStorage', e);
    }
  }, []);

  // Save meetings to localStorage whenever current meeting changes
  const saveMeetingToStorage = (meeting: MeetingData) => {
    try {
      // Don't store large blob URLs in localStorage to prevent quota errors
      const stripped: MeetingData = {
        ...meeting,
        audioBlobUrl: undefined,
      };

      setSavedMeetings((prev) => {
        const filtered = prev.filter((m) => m.id !== meeting.id);
        const updated = [stripped, ...filtered].slice(0, 50);
        localStorage.setItem('transcribeia_meetings', JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      console.warn('Error saving to localStorage', e);
    }
  };

  const handleTranscribeSuccess = (meeting: MeetingData) => {
    setCurrentMeeting(meeting);
    saveMeetingToStorage(meeting);
    setActiveTab('summary');
    setCurrentTime(0);
  };

  const handleLoadSample = () => {
    setCurrentMeeting(SAMPLE_MEETING);
    saveMeetingToStorage(SAMPLE_MEETING);
    setActiveTab('summary');
    setCurrentTime(0);
  };

  const handleDeleteSavedMeeting = (id: string) => {
    const updated = savedMeetings.filter((m) => m.id !== id);
    setSavedMeetings(updated);
    try {
      localStorage.setItem('transcribeia_meetings', JSON.stringify(updated));
    } catch (e) {}
    if (currentMeeting?.id === id) {
      setCurrentMeeting(null);
    }
  };

  // Sync participant rename across transcript and action items
  const handleUpdateParticipant = (id: string, newName: string, newRole: string) => {
    if (!currentMeeting) return;
    const oldName = currentMeeting.participants.find((p) => p.id === id)?.name;

    const updatedParticipants = currentMeeting.participants.map((p) =>
      p.id === id ? { ...p, name: newName, role: newRole } : p
    );

    const updatedTranscript = currentMeeting.transcript.map((s) =>
      s.speakerId === id || s.speakerName === oldName ? { ...s, speakerName: newName } : s
    );

    const updatedActionItems = currentMeeting.actionItems.map((a) =>
      a.assignee === oldName ? { ...a, assignee: newName } : a
    );

    const updatedMeeting: MeetingData = {
      ...currentMeeting,
      participants: updatedParticipants,
      transcript: updatedTranscript,
      actionItems: updatedActionItems,
    };

    setCurrentMeeting(updatedMeeting);
    saveMeetingToStorage(updatedMeeting);
  };

  // Update transcript segment text
  const handleUpdateSegmentText = (segmentId: string, newText: string) => {
    if (!currentMeeting) return;
    const updatedTranscript = currentMeeting.transcript.map((s) =>
      s.id === segmentId ? { ...s, text: newText } : s
    );
    const updatedMeeting = { ...currentMeeting, transcript: updatedTranscript };
    setCurrentMeeting(updatedMeeting);
    saveMeetingToStorage(updatedMeeting);
  };

  // Action items toggling & adding
  const handleToggleTaskStatus = (taskId: string) => {
    if (!currentMeeting) return;
    const updatedItems = currentMeeting.actionItems.map((item) =>
      item.id === taskId
        ? {
            ...item,
            status: (item.status === 'completada' ? 'pendiente' : 'completada') as any,
          }
        : item
    );
    const updatedMeeting = { ...currentMeeting, actionItems: updatedItems };
    setCurrentMeeting(updatedMeeting);
    saveMeetingToStorage(updatedMeeting);
  };

  const handleAddTask = (taskData: Omit<ActionItem, 'id'>) => {
    if (!currentMeeting) return;
    const newTask: ActionItem = {
      ...taskData,
      id: 'task-' + Date.now(),
    };
    const updatedMeeting = {
      ...currentMeeting,
      actionItems: [newTask, ...currentMeeting.actionItems],
    };
    setCurrentMeeting(updatedMeeting);
    saveMeetingToStorage(updatedMeeting);
  };

  // Audio seek & playback handlers
  const handleSeek = (seconds: number) => {
    setCurrentTime(seconds);
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      if (!isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      // Mock playback ticker for demo or audio-less meetings
      setIsPlaying(true);
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  };

  // Simulated audio timer for demo meetings without actual audio track
  useEffect(() => {
    let interval: any = null;
    if (isPlaying && !audioRef.current?.src) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 1 * playbackRate;
          if (next >= (duration || 6510)) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, playbackRate, duration]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white pb-24">
      {/* Hidden audio element for real audio playback */}
      {currentMeeting?.audioBlobUrl && (
        <audio
          ref={audioRef}
          src={currentMeeting.audioBlobUrl}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration);
            }
          }}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Global Top Header */}
      <Header
        currentMeeting={currentMeeting}
        onNewMeeting={() => setCurrentMeeting(null)}
        onOpenExport={() => setIsExportOpen(true)}
        onLoadSample={handleLoadSample}
        savedMeetingsCount={savedMeetings.length}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!currentMeeting ? (
          <AudioImporter
            onTranscribeSuccess={handleTranscribeSuccess}
            onLoadSample={handleLoadSample}
            onSaveBatchItem={saveMeetingToStorage}
          />
        ) : (
          <div className="space-y-6">
            {/* Meeting Meta Header Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2 text-xs text-blue-400 font-medium mb-1">
                  <span>Reunión Procesada</span>
                  <span>•</span>
                  <span>{currentMeeting.language}</span>
                  {currentMeeting.sourceType === 'sample' && (
                    <span className="px-2 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px]">
                      Demostración (1h 48m)
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
                  {currentMeeting.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
                  <span className="flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{currentMeeting.date}</span>
                  </span>
                  <span className="flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Duración: {currentMeeting.estimatedDuration}</span>
                  </span>
                  <span className="flex items-center space-x-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>{currentMeeting.participants.length} participantes identificados</span>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2.5 shrink-0">
                <button
                  onClick={() => setIsExportOpen(true)}
                  className="flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-105"
                >
                  <Download className="w-4 h-4" />
                  <span>Exportar (PDF / Word / SRT / CSV)</span>
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveTab('summary')}
                className={`flex items-center space-x-2 py-3 px-5 font-semibold text-sm rounded-xl transition ${
                  activeTab === 'summary'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Resumen Ejecutivo y Compromisos</span>
              </button>

              <button
                onClick={() => setActiveTab('transcript')}
                className={`flex items-center space-x-2 py-3 px-5 font-semibold text-sm rounded-xl transition ${
                  activeTab === 'transcript'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Transcripción Diarizada ({currentMeeting.transcript.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center space-x-2 py-3 px-5 font-semibold text-sm rounded-xl transition ${
                  activeTab === 'chat'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Bot className="w-4 h-4" />
                <span>Consultar a la Reunión (IA)</span>
              </button>
            </div>

            {/* Tab 1: Resumen y Tareas */}
            {activeTab === 'summary' && (
              <div className="space-y-6">
                {/* Participants Diarization Grid */}
                <ParticipantsView
                  participants={currentMeeting.participants}
                  onUpdateParticipant={handleUpdateParticipant}
                  selectedParticipantId={selectedParticipantId}
                  onSelectParticipant={(id) => {
                    setSelectedParticipantId(id);
                    if (id) setActiveTab('transcript');
                  }}
                />

                {/* Executive Summary Cards */}
                <ExecutiveSummaryView summary={currentMeeting.executiveSummary} />

                {/* Action Items Interactive Board */}
                <ActionItemsView
                  actionItems={currentMeeting.actionItems}
                  participants={currentMeeting.participants}
                  onToggleStatus={handleToggleTaskStatus}
                  onAddTask={handleAddTask}
                  onExportTasksCSV={() => exportTasksToCSV(currentMeeting)}
                />
              </div>
            )}

            {/* Tab 2: Full Diarized Transcript */}
            {activeTab === 'transcript' && (
              <div className="space-y-6">
                <ParticipantsView
                  participants={currentMeeting.participants}
                  onUpdateParticipant={handleUpdateParticipant}
                  selectedParticipantId={selectedParticipantId}
                  onSelectParticipant={setSelectedParticipantId}
                />

                <TranscriptView
                  transcript={currentMeeting.transcript}
                  participants={currentMeeting.participants}
                  currentAudioSeconds={currentTime}
                  onSeekAudio={handleSeek}
                  onUpdateSegmentText={handleUpdateSegmentText}
                  selectedParticipantId={selectedParticipantId}
                />
              </div>
            )}

            {/* Tab 3: Q&A Assistant */}
            {activeTab === 'chat' && (
              <div className="space-y-6">
                <MeetingChat meeting={currentMeeting} />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Synchronized Audio Player Bar (when meeting is loaded) */}
      {currentMeeting && (
        <AudioPlayerBar
          audioUrl={currentMeeting.audioBlobUrl}
          audioFileName={currentMeeting.audioFileName || currentMeeting.title}
          currentTime={currentTime}
          duration={duration || 6510}
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeek={handleSeek}
          playbackRate={playbackRate}
          onRateChange={(rate) => {
            setPlaybackRate(rate);
            if (audioRef.current) audioRef.current.playbackRate = rate;
          }}
        />
      )}

      {/* Export Modal */}
      {currentMeeting && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          meeting={currentMeeting}
        />
      )}

      {/* Saved Meetings History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        meetings={savedMeetings}
        onSelectMeeting={(m) => {
          setCurrentMeeting(m);
          setActiveTab('summary');
        }}
        onDeleteMeeting={handleDeleteSavedMeeting}
      />
    </div>
  );
}
