import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Gauge,
  Music,
} from 'lucide-react';
import { formatSeconds } from '../utils/audioProcessor';

interface AudioPlayerBarProps {
  audioUrl?: string;
  audioFileName?: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (seconds: number) => void;
  playbackRate: number;
  onRateChange: (rate: number) => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  audioUrl,
  audioFileName,
  currentTime,
  duration,
  isPlaying,
  onPlay,
  onPause,
  onSeek,
  playbackRate,
  onRateChange,
}) => {
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const speedOptions = [0.75, 1, 1.25, 1.5, 2];

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onSeek(val);
  };

  const handleSkip = (delta: number) => {
    const target = Math.max(0, Math.min(duration || 3600, currentTime + delta));
    onSeek(target);
  };

  return (
    <div className="sticky bottom-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-slate-100 px-4 py-3 shadow-2xl">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Info & Title */}
        <div className="flex items-center space-x-3 w-full sm:w-1/4 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
            <Music className="w-4 h-4" />
          </div>
          <div className="truncate">
            <p className="text-xs font-semibold truncate text-slate-200">
              {audioFileName || 'Audio de la reunión sincronizado'}
            </p>
            <p className="text-[11px] text-slate-400 font-mono">
              {formatSeconds(currentTime)} / {formatSeconds(duration || 6510)}
            </p>
          </div>
        </div>

        {/* Controls and Seeker */}
        <div className="flex flex-col items-center w-full sm:w-2/4">
          <div className="flex items-center space-x-4 mb-1.5">
            <button
              onClick={() => handleSkip(-10)}
              className="text-slate-400 hover:text-white transition p-1"
              title="Retroceder 10 segundos"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={isPlaying ? onPause : onPlay}
              className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-600/30 transition hover:scale-105"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
            </button>

            <button
              onClick={() => handleSkip(10)}
              className="text-slate-400 hover:text-white transition p-1"
              title="Avanzar 10 segundos"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <div className="w-full flex items-center space-x-2">
            <span className="text-[10px] text-slate-400 font-mono w-10 text-right">
              {formatSeconds(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 6510}
              value={currentTime}
              onChange={handleSliderChange}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-[10px] text-slate-400 font-mono w-10">
              {formatSeconds(duration || 6510)}
            </span>
          </div>
        </div>

        {/* Speed & Volume */}
        <div className="flex items-center justify-end space-x-3 w-full sm:w-1/4">
          {/* Speed Selector */}
          <div className="flex items-center space-x-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700">
            <Gauge className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={playbackRate}
              onChange={(e) => onRateChange(parseFloat(e.target.value))}
              className="bg-transparent text-xs font-semibold text-slate-300 focus:outline-none cursor-pointer"
            >
              {speedOptions.map((rate) => (
                <option key={rate} value={rate} className="bg-slate-800 text-slate-200">
                  {rate}x
                </option>
              ))}
            </select>
          </div>

          {/* Mute button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="text-slate-400 hover:text-white transition p-1"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
