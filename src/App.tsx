import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Check, Volume2, VolumeX, FastForward, CloudRain, Sun, Wind, Contrast, Type } from 'lucide-react';
import ShaderBackground from './components/ShaderBackground';
import { generateReflection, type ReflectionResult } from './utils/reflection';

const MODES = [
  { id: 'Down', icon: CloudRain, label: 'Down', desc: 'Calm' },
  { id: 'Joy', icon: Sun, label: 'Joy', desc: 'Uplift' },
  { id: 'Drift', icon: Wind, label: 'Drift', desc: 'Wander' },
] as const;

const DOWN_TRACK_URL = new URL('./assets/calming-rain.wav', import.meta.url).href;
const JOY_TRACK_URL = new URL('./assets/joy-bright.wav', import.meta.url).href;
const DRIFT_TRACK_URL = new URL('./assets/space-sound.wav', import.meta.url).href;
const MAX_AUDIO_GAIN = 0.42;

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const char of paragraph) {
      const test = line + char;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = char;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }

  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: string
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

export default function App() {
  const [mode, setMode] = useState<'Down' | 'Joy' | 'Drift'>('Drift');
  const [text, setText] = useState('');
  const [fontFamily, setFontFamily] = useState('font-sans');
  const [fontSize, setFontSize] = useState('text-[22px]');
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasUserEnabledAudio, setHasUserEnabledAudio] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [highReadability, setHighReadability] = useState(true);
  const [isTextSettingsOpen, setIsTextSettingsOpen] = useState(false);
  const [isFinishActionsOpen, setIsFinishActionsOpen] = useState(false);
  const [reflection, setReflection] = useState<ReflectionResult | null>(null);
  const [releaseGhostText, setReleaseGhostText] = useState('');
  const [isReleaseFading, setIsReleaseFading] = useState(false);
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string | null>(null);
  const [isExportPreviewOpen, setIsExportPreviewOpen] = useState(false);
  const releaseTimerRef = useRef<number | null>(null);
  const textSettingsRef = useRef<HTMLDivElement | null>(null);
  const textSettingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSwitchVersionRef = useRef(0);

  const toAudioGain = (value: number) => (value / 100) * MAX_AUDIO_GAIN;
  const getTrackByMode = (currentMode: 'Down' | 'Joy' | 'Drift') => {
    if (currentMode === 'Down') return DOWN_TRACK_URL;
    if (currentMode === 'Joy') return JOY_TRACK_URL;
    return DRIFT_TRACK_URL;
  };
  const getPlaybackRateByMode = (currentMode: 'Down' | 'Joy' | 'Drift') => {
    if (currentMode === 'Down') return 0.92;
    if (currentMode === 'Joy') return 1.08;
    return 0.8;
  };

  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audio.muted = isMuted;
    audio.volume = toAudioGain(volume);
    audio.src = getTrackByMode(mode);
    audio.load();
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const targetSrc = getTrackByMode(mode);
    const shouldResume = hasUserEnabledAudio && !isMuted;
    const currentSwitchVersion = ++audioSwitchVersionRef.current;

    audio.volume = toAudioGain(volume);
    audio.muted = isMuted;
    audio.playbackRate = getPlaybackRateByMode(mode);

    if (audio.src !== targetSrc) {
      // Always stop previous track first to avoid any overlap/mixing.
      audio.pause();
      audio.currentTime = 0;
      audio.src = targetSrc;
      audio.load();
      if (!shouldResume) {
        setIsPlaying(false);
        return;
      }
      const playPromise = audio.play();
      if (playPromise) {
        playPromise
          .then(() => {
            if (audioSwitchVersionRef.current !== currentSwitchVersion) return;
            setIsPlaying(true);
          })
          .catch((error) => {
            if (audioSwitchVersionRef.current !== currentSwitchVersion) return;
            console.warn('Background audio play failed:', error);
            setIsPlaying(false);
          });
      } else {
        setIsPlaying(true);
      }
      return;
    }

    if (!shouldResume) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    audio.play().then(() => setIsPlaying(true)).catch((error) => {
      console.warn('Background audio play failed:', error);
      setIsPlaying(false);
    });
  }, [mode, volume, isMuted, hasUserEnabledAudio]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!isTextSettingsOpen) return;
      const target = event.target as Node;
      const panelEl = textSettingsRef.current;
      const buttonEl = textSettingsButtonRef.current;
      if (panelEl?.contains(target) || buttonEl?.contains(target)) return;
      setIsTextSettingsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsTextSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTextSettingsOpen]);

  useEffect(() => {
    return () => {
      if (releaseTimerRef.current) {
        window.clearTimeout(releaseTimerRef.current);
      }
    };
  }, []);

  const generateExportImage = () => {
    const exportReflection = reflection ?? generateReflection(text, mode);
    const canvas = document.createElement('canvas');
    const width = 1600;
    const height = 980;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const gradients: Record<'Down' | 'Joy' | 'Drift', [string, string]> = {
      Down: ['#1b2431', '#2d3f56'],
      Joy: ['#f2e4cf', '#f7cfa4'],
      Drift: ['#1b2038', '#2d3158'],
    };
    const [c1, c2] = gradients[mode];
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, c1);
    bg.addColorStop(1, c2);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const panelFill = mode === 'Joy' ? 'rgba(255,255,255,0.76)' : 'rgba(12,16,26,0.60)';
    const panelBorder = mode === 'Joy' ? 'rgba(0,0,0,0.20)' : 'rgba(255,255,255,0.24)';
    const textColor = mode === 'Joy' ? '#1b1b1b' : '#f2f4f8';
    const subTextColor = mode === 'Joy' ? 'rgba(18,18,18,0.62)' : 'rgba(242,244,248,0.62)';

    drawRoundedRect(ctx, 110, 90, width - 220, 540, 34, panelFill, panelBorder);

    ctx.fillStyle = textColor;
    ctx.font = '500 42px Inter, sans-serif';
    ctx.fillText('Mood Moment', 155, 170);
    ctx.font = '400 24px Inter, sans-serif';
    ctx.fillStyle = subTextColor;
    ctx.fillText(`${mode.toUpperCase()}  ·  Your Reflection`, 155, 212);

    ctx.font = '400 36px Inter, sans-serif';
    ctx.fillStyle = textColor;
    const textLines = wrapTextLines(ctx, text, width - 320).slice(0, 11);
    let y = 280;
    for (const line of textLines) {
      ctx.fillText(line || ' ', 155, y);
      y += 49;
    }

    drawRoundedRect(ctx, 150, 680, width - 300, 220, 26, panelFill, panelBorder);
    ctx.fillStyle = mode === 'Joy' ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)';
    ctx.fillRect(180, 720, 4, 140);

    ctx.font = '500 34px Inter, sans-serif';
    ctx.fillStyle = textColor;
    const quoteLines = wrapTextLines(ctx, `“${exportReflection.line}”`, width - 420).slice(0, 3);
    y = 760;
    for (const line of quoteLines) {
      ctx.fillText(line, 210, y);
      y += 45;
    }

    ctx.font = '400 24px Inter, sans-serif';
    ctx.fillStyle = subTextColor;
    ctx.fillText(exportReflection.source, 210, 860);

    return canvas.toDataURL('image/png');
  };

  const handleExport = async () => {
    if (!text.trim()) return;
    const url = generateExportImage();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `mood-moment-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  const handleOpenExportPreview = () => {
    if (!text.trim()) return;
    const url = generateExportImage();
    if (!url) return;
    setExportPreviewUrl(url);
    setIsExportPreviewOpen(true);
  };

  const handleFinish = () => {
    if (!text.trim()) return;
    setReflection(generateReflection(text, mode));
    setIsFinishActionsOpen((v) => !v);
  };

  const handleRelease = () => {
    if (releaseTimerRef.current) {
      window.clearTimeout(releaseTimerRef.current);
    }
    setReleaseGhostText(text);
    setIsReleaseFading(true);
    setText('');
    setReflection(null);
    setIsFinishActionsOpen(false);
    releaseTimerRef.current = window.setTimeout(() => {
      setIsReleaseFading(false);
      setReleaseGhostText('');
      releaseTimerRef.current = null;
    }, 2100);
  };

  useEffect(() => {
    // Hide generated reflection when user switches emotion module.
    setReflection(null);
    setIsFinishActionsOpen(false);
    setIsExportPreviewOpen(false);
  }, [mode]);

  const handleAudioToggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const targetSrc = getTrackByMode(mode);

    if (isMuted) {
      const nextVolume = Math.max(volume, 9);
      setHasUserEnabledAudio(true);
      setIsMuted(false);
      if (nextVolume !== volume) {
        setVolume(nextVolume);
      }
      audio.muted = false;
      audio.volume = toAudioGain(nextVolume);
      audio.playbackRate = getPlaybackRateByMode(mode);
      if (audio.src !== targetSrc) {
        audio.src = targetSrc;
        audio.load();
      }
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.then(() => setIsPlaying(true)).catch((error) => {
          console.warn('Background audio play failed:', error);
          setIsMuted(true);
          setIsPlaying(false);
        });
      } else {
        setIsPlaying(true);
      }
      return;
    }

    setIsMuted(true);
    setIsPlaying(false);
    audio.muted = true;
    audio.pause();
  };

  return (
    <div className="relative w-full h-screen overflow-hidden text-white/90 selection:bg-white/20 font-sans">
      <ShaderBackground mode={mode} speed={speed} />
      
      {/* Top Nav Area */}
      <div className="absolute top-0 left-0 w-full pt-8 z-50 flex items-center justify-center">
        <div className="relative isolate overflow-hidden flex gap-12 items-center bg-black/35 backdrop-blur-xl px-10 py-3 rounded-full border border-white/25 shadow-2xl">
          {MODES.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            return (
              <button 
                key={m.id}
                onClick={() => setMode(m.id as any)}
                className={`appearance-none border-0 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 flex items-center gap-3 transition-all duration-300 group rounded-full px-3 py-1.5 ${
                  isActive 
                    ? 'text-white bg-white/16 border border-white/35' 
                    : 'text-white/75 border border-transparent hover:text-white hover:bg-white/10'
                }`}
              >
                <div className={`p-2 rounded-full transition-colors duration-300 ${isActive ? 'bg-white/10' : 'bg-transparent group-hover:bg-white/5'}`}>
                  <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className={`text-xs tracking-[0.2em] uppercase transition-all duration-300 ${isActive ? 'font-medium' : ''}`}>
                    {m.label}
                  </span>
                  <span className={`text-[9px] tracking-widest transition-all duration-300 ${isActive ? 'text-white/60' : 'text-transparent group-hover:text-white/35'}`}>
                    {m.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full h-full flex flex-col items-center justify-center p-8 pt-16">
        {/* Editor */}
        <div className="w-full max-w-4xl flex-1 max-h-[64vh] min-h-[48vh] relative group">
          <div className="absolute left-0 -top-14 z-30">
            <button
              ref={textSettingsButtonRef}
              onClick={() => setIsTextSettingsOpen((v) => !v)}
              type="button"
              className={`h-11 min-w-[74px] px-4 rounded-xl border backdrop-blur-xl transition-all duration-300 flex items-center justify-center gap-2 text-xs tracking-widest uppercase shadow-lg cursor-pointer select-none touch-manipulation ${
                mode === 'Joy'
                  ? 'bg-white/78 border-black/30 text-black/85 hover:bg-white/88'
                  : 'bg-black/62 border-white/28 text-white/90 hover:bg-black/72'
              }`}
              aria-haspopup="dialog"
              aria-expanded={isTextSettingsOpen}
            >
              <Type size={16} strokeWidth={1.8} className="pointer-events-none" />
              <span className="pointer-events-none">Aa</span>
            </button>

            {isTextSettingsOpen && (
              <div
                ref={textSettingsRef}
                className={`absolute top-0 right-[calc(100%+12px)] w-60 rounded-2xl border backdrop-blur-2xl p-4 shadow-2xl ${
                  mode === 'Joy'
                    ? 'bg-white/85 border-black/25 text-black'
                    : 'bg-black/72 border-white/25 text-white'
                }`}
                role="dialog"
                aria-label="Text settings"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className={`text-[10px] uppercase tracking-[0.25em] ${mode === 'Joy' ? 'text-black/55' : 'text-white/55'}`}>Typeface</p>
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => setFontFamily('font-sans')}
                        className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                          fontFamily === 'font-sans'
                            ? mode === 'Joy'
                              ? 'bg-black/10 text-black font-medium'
                              : 'bg-white/15 text-white font-medium'
                            : mode === 'Joy'
                              ? 'text-black/75 hover:bg-black/5'
                              : 'text-white/80 hover:bg-white/10'
                        }`}
                        style={{ fontFamily: 'var(--font-sans)' }}
                      >
                        Inter
                      </button>
                      <button
                        onClick={() => setFontFamily('font-serif')}
                        className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                          fontFamily === 'font-serif'
                            ? mode === 'Joy'
                              ? 'bg-black/10 text-black font-medium'
                              : 'bg-white/15 text-white font-medium'
                            : mode === 'Joy'
                              ? 'text-black/75 hover:bg-black/5'
                              : 'text-white/80 hover:bg-white/10'
                        }`}
                        style={{ fontFamily: 'var(--font-serif)' }}
                      >
                        Playfair Display
                      </button>
                      <button
                        onClick={() => setFontFamily('font-mono')}
                        className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                          fontFamily === 'font-mono'
                            ? mode === 'Joy'
                              ? 'bg-black/10 text-black font-medium'
                              : 'bg-white/15 text-white font-medium'
                            : mode === 'Joy'
                              ? 'text-black/75 hover:bg-black/5'
                              : 'text-white/80 hover:bg-white/10'
                        }`}
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        JetBrains Mono
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className={`text-[10px] uppercase tracking-[0.25em] ${mode === 'Joy' ? 'text-black/55' : 'text-white/55'}`}>Size</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setFontSize('text-[20px]')}
                        className={`rounded-lg px-2 py-2 text-xs transition-colors ${
                          fontSize === 'text-[20px]'
                            ? mode === 'Joy'
                              ? 'bg-black/12 text-black font-medium'
                              : 'bg-white/18 text-white font-medium'
                            : mode === 'Joy'
                              ? 'text-black/80 hover:bg-black/6'
                              : 'text-white/80 hover:bg-white/10'
                        }`}
                      >
                        小
                      </button>
                      <button
                        onClick={() => setFontSize('text-[22px]')}
                        className={`rounded-lg px-2 py-2 text-xs transition-colors ${
                          fontSize === 'text-[22px]'
                            ? mode === 'Joy'
                              ? 'bg-black/12 text-black font-medium'
                              : 'bg-white/18 text-white font-medium'
                            : mode === 'Joy'
                              ? 'text-black/80 hover:bg-black/6'
                              : 'text-white/80 hover:bg-white/10'
                        }`}
                      >
                        中
                      </button>
                      <button
                        onClick={() => setFontSize('text-[26px]')}
                        className={`rounded-lg px-2 py-2 text-xs transition-colors ${
                          fontSize === 'text-[26px]'
                            ? mode === 'Joy'
                              ? 'bg-black/12 text-black font-medium'
                              : 'bg-white/18 text-white font-medium'
                            : mode === 'Joy'
                              ? 'text-black/80 hover:bg-black/6'
                              : 'text-white/80 hover:bg-white/10'
                        }`}
                      >
                        大
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={`absolute inset-0 backdrop-blur-3xl rounded-[2rem] border shadow-2xl transition-all duration-700 ${
            highReadability
              ? mode === 'Joy'
                ? 'bg-white/[0.82] border-black/[0.55] group-hover:bg-white/[0.88] group-hover:border-black/[0.62] shadow-[0_0_0_2px_rgba(255,255,255,0.35)]'
                : 'bg-black/[0.68] border-white/[0.52] group-hover:bg-black/[0.74] group-hover:border-white/[0.62] shadow-[0_0_0_2px_rgba(0,0,0,0.45)]'
              : mode === 'Joy'
                ? 'bg-white/[0.35] border-black/[0.28] group-hover:bg-white/[0.45] group-hover:border-black/[0.35]'
                : 'bg-black/[0.32] border-white/[0.26] group-hover:bg-black/[0.4] group-hover:border-white/[0.34]'
          }`} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isReleaseFading ? '' : 'Breathe in. Type your thoughts...'}
            className={`relative w-full h-full bg-transparent resize-none outline-none p-10 leading-relaxed ${fontFamily} ${fontSize} placeholder:text-[22px] custom-scrollbar transition-colors duration-700 ${
              highReadability
                ? mode === 'Joy'
                  ? 'text-black placeholder:text-black/65'
                  : 'text-white placeholder:text-white/60'
                : mode === 'Joy'
                  ? 'text-black/90 placeholder:text-black/55'
                  : 'text-white placeholder:text-white/45'
            }`}
            spellCheck={false}
          />
          <AnimatePresence>
            {isReleaseFading && releaseGhostText && (
              <motion.div
                initial={{ opacity: 0.95, filter: 'blur(0px)' }}
                animate={{ opacity: 0, filter: 'blur(2px)' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, ease: 'easeOut' }}
                className={`pointer-events-none absolute inset-0 p-10 leading-relaxed whitespace-pre-wrap break-words ${fontFamily} ${fontSize} ${
                  mode === 'Joy' ? 'text-black/90' : 'text-white/90'
                }`}
              >
                {releaseGhostText}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          {reflection && (
            <motion.div
              key={`${reflection.line}-${reflection.source}`}
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="w-full max-w-4xl mt-5 px-1"
            >
              <div className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl px-6 py-5 shadow-xl transition-colors duration-500 ${
                mode === 'Joy'
                  ? 'bg-white/75 border-black/25 text-black'
                  : 'bg-black/55 border-white/25 text-white'
              }`}>
                <div className={`absolute left-0 top-0 h-full w-[3px] ${mode === 'Joy' ? 'bg-black/25' : 'bg-white/25'}`} />
                <p className={`pl-3 text-[17px] leading-[1.8] font-medium ${mode === 'Joy' ? 'text-black/92' : 'text-white/92'}`}>
                  “{reflection.line}”
                </p>
                <p className={`mt-3 pl-3 text-[11px] tracking-[0.08em] ${mode === 'Joy' ? 'text-black/46' : 'text-white/46'}`}>
                  {reflection.source}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Console & Actions */}
        <div className="w-full max-w-4xl mt-8 flex items-center justify-between gap-6">
          {/* Console */}
          <div className={`flex items-center gap-6 backdrop-blur-xl px-6 py-3.5 rounded-xl border flex-1 shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-colors duration-500 ${
            highReadability
              ? mode === 'Joy'
                ? 'bg-white/78 border-black/35 text-black'
                : 'bg-black/58 border-white/35 text-white'
              : mode === 'Joy'
                ? 'bg-white/55 border-black/22 text-black/90'
                : 'bg-black/42 border-white/22 text-white'
          }`}>
            <div className="flex items-center gap-3.5 flex-1 group min-w-0">
              <button
                onClick={handleAudioToggle}
                className={`h-7 w-7 rounded-full flex items-center justify-center border transition-all duration-300 ${
                  mode === 'Joy'
                    ? 'border-black/22 hover:border-black/40'
                    : 'border-white/22 hover:border-white/40'
                }`}
                aria-label={isMuted ? 'Enable sound' : 'Mute sound'}
                title={isMuted ? 'Sound Off' : 'Sound On'}
              >
                {isMuted ? (
                  <VolumeX size={14} className={`${mode === 'Joy' ? 'text-black/70' : 'text-white/80'}`} strokeWidth={1.6} />
                ) : (
                  <Volume2 size={14} className={`${mode === 'Joy' ? 'text-black/70' : 'text-white/80'}`} strokeWidth={1.6} />
                )}
              </button>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                disabled={isMuted}
                className={`w-full h-[2px] rounded-full appearance-none outline-none cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110 ${mode === 'Joy' ? 'bg-black/20 [&::-webkit-slider-thumb]:bg-black/85 [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(0,0,0,0.35)]' : 'bg-white/20 [&::-webkit-slider-thumb]:bg-white/90 [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(255,255,255,0.35)]'}`}
              />
            </div>
            <div className={`w-px h-5 transition-colors duration-500 ${mode === 'Joy' ? 'bg-black/18' : 'bg-white/18'}`} />
            <div className="flex items-center gap-3.5 flex-1 group min-w-0">
              <FastForward size={14} className={`transition-colors ${mode === 'Joy' ? 'text-black/62 group-hover:text-black/80' : 'text-white/72 group-hover:text-white/85'}`} strokeWidth={1.6} />
              <input 
                type="range" 
                min="0.1" 
                max="3.0" 
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className={`w-full h-[2px] rounded-full appearance-none outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110 ${mode === 'Joy' ? 'bg-black/20 [&::-webkit-slider-thumb]:bg-black/85 [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(0,0,0,0.35)]' : 'bg-white/20 [&::-webkit-slider-thumb]:bg-white/90 [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(255,255,255,0.35)]'}`}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setHighReadability((v) => !v)}
              className={`flex items-center gap-3 backdrop-blur-xl px-6 py-5 rounded-2xl border transition-all duration-300 text-xs tracking-widest uppercase shadow-xl ${
                highReadability
                  ? mode === 'Joy'
                    ? 'bg-black text-white border-black/60'
                    : 'bg-white text-black border-white/70'
                  : mode === 'Joy'
                    ? 'bg-white/70 hover:bg-white/80 border-black/30 text-black/85 hover:text-black'
                    : 'bg-black/55 hover:bg-black/65 border-white/30 text-white/90 hover:text-white'
              }`}
            >
              <Contrast size={16} strokeWidth={1.8} />
              <span>{highReadability ? 'High Readability On' : 'High Readability Off'}</span>
            </button>
            <div className="relative">
              {isFinishActionsOpen && (
                <div className={`absolute bottom-[calc(100%+10px)] right-0 z-30 flex items-center gap-2 p-2 rounded-xl border backdrop-blur-xl shadow-xl ${
                  mode === 'Joy' ? 'bg-white/80 border-black/25' : 'bg-black/65 border-white/25'
                }`}>
                  <button
                    onClick={() => {
                      handleOpenExportPreview();
                      setIsFinishActionsOpen(false);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] tracking-[0.12em] uppercase transition-colors ${
                      mode === 'Joy' ? 'bg-black/10 hover:bg-black/15 text-black' : 'bg-white/12 hover:bg-white/18 text-white'
                    }`}
                  >
                    <Download size={14} strokeWidth={1.6} />
                    <span>Export</span>
                  </button>
                  <button
                    onClick={handleRelease}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] tracking-[0.12em] uppercase transition-colors ${
                      mode === 'Joy' ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90'
                    }`}
                  >
                    <Check size={14} strokeWidth={1.8} />
                    <span>Release</span>
                  </button>
                </div>
              )}
              <button 
                onClick={handleFinish}
                disabled={!text.trim()}
                className={`flex items-center gap-3 px-8 py-5 rounded-2xl transition-all duration-300 text-xs tracking-widest uppercase font-medium ring-1 disabled:cursor-not-allowed disabled:shadow-none ${
                  !text.trim()
                    ? mode === 'Joy'
                      ? 'bg-black/35 text-white/45 ring-black/20'
                      : 'bg-white/45 text-black/45 ring-white/25'
                    : mode === 'Joy'
                      ? 'bg-black text-white hover:bg-black/90 ring-black/40 shadow-[0_0_20px_rgba(0,0,0,0.28)] hover:shadow-[0_0_30px_rgba(0,0,0,0.45)]'
                      : 'bg-white text-black hover:bg-white/90 ring-white/45 shadow-[0_0_20px_rgba(255,255,255,0.28)] hover:shadow-[0_0_30px_rgba(255,255,255,0.45)]'
                }`}
              >
                <Check size={16} strokeWidth={2} />
                <span>Finish</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExportPreviewOpen && exportPreviewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/45 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setIsExportPreviewOpen(false)}
          >
            <motion.div
              initial={{ y: 14, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 8, scale: 0.99, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`w-full max-w-4xl rounded-2xl border shadow-2xl p-4 ${mode === 'Joy' ? 'bg-white/88 border-black/20' : 'bg-black/72 border-white/20'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <img src={exportPreviewUrl} alt="Export preview" className="w-full rounded-xl border border-white/15" />
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setIsExportPreviewOpen(false)}
                  className={`px-4 py-2 rounded-lg text-xs tracking-[0.12em] uppercase border ${mode === 'Joy' ? 'border-black/25 text-black/80 hover:bg-black/5' : 'border-white/25 text-white/85 hover:bg-white/10'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleExport();
                    setIsExportPreviewOpen(false);
                  }}
                  className={`px-4 py-2 rounded-lg text-xs tracking-[0.12em] uppercase ${mode === 'Joy' ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90'}`}
                >
                  Download
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={`fixed bottom-4 right-5 z-20 text-[11px] tracking-[0.14em] uppercase pointer-events-none select-none ${
          mode === 'Joy' ? 'text-black/28' : 'text-white/28'
        }`}
      >
        @EvieYAN02
      </div>
    </div>
  );
}
