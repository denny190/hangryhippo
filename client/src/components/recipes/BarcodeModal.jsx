import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Search, Check, AlertCircle, RefreshCw } from 'lucide-react';
import Modal from '../common/Modal.jsx';

export default function BarcodeModal({ onFound, onClose }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const detector  = useRef(null);
  const ticker    = useRef(null);

  const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  const [mode,       setMode]       = useState(hasDetector ? 'camera' : 'manual');
  const [scanning,   setScanning]   = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  // ── camera ──────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    clearInterval(ticker.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const lookupCode = useCallback(async (code) => {
    stopCamera();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/barcode/${encodeURIComponent(code)}`);
      if (!res.ok) throw new Error('not found');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult({ ...data, code });
    } catch {
      setError(`No product found for "${code}". Try scanning again or switch to manual entry.`);
    } finally {
      setLoading(false);
    }
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setError('');
    setResult(null);

    // Build BarcodeDetector once
    if (hasDetector && !detector.current) {
      try {
        detector.current = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
        });
      } catch { /* unsupported formats — will fall back */ }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);

      if (detector.current) {
        ticker.current = setInterval(async () => {
          const v = videoRef.current;
          if (!v || v.readyState < 2 || v.videoWidth === 0) return;
          try {
            const codes = await detector.current.detect(v);
            if (codes.length > 0) {
              clearInterval(ticker.current);
              lookupCode(codes[0].rawValue);
            }
          } catch { /* frame not ready */ }
        }, 350);
      }
    } catch {
      setError('Camera not available. Enter the barcode number manually below.');
      setMode('manual');
    }
  }, [hasDetector, lookupCode]);

  useEffect(() => {
    if (mode === 'camera') startCamera();
    return () => stopCamera();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── UI ──────────────────────────────────────────────────────────────────
  return (
    <Modal title="Barcode lookup" onClose={() => { stopCamera(); onClose(); }} size="sm">
      <div className="space-y-4">
        {/* Mode toggle — only show when not in result/loading state */}
        {!result && !loading && (
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
            {hasDetector && (
              <button
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm rounded-lg transition-colors
                  ${mode === 'camera' ? 'bg-accent text-white' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => { setError(''); setMode('camera'); }}
              >
                <Camera size={13} /> Camera
              </button>
            )}
            <button
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm rounded-lg transition-colors
                ${mode === 'manual' ? 'bg-accent text-white' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => { setError(''); stopCamera(); setMode('manual'); }}
            >
              <Search size={13} /> Manual
            </button>
          </div>
        )}

        {/* Camera viewfinder */}
        {mode === 'camera' && !result && !loading && (
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {/* targeting reticule */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-52 h-28 border-2 border-accent rounded-xl opacity-70" />
              <div className="absolute w-3 h-3 border-t-2 border-l-2 border-accent top-[calc(50%-56px)] left-[calc(50%-104px)] rounded-tl" />
              <div className="absolute w-3 h-3 border-t-2 border-r-2 border-accent top-[calc(50%-56px)] right-[calc(50%-104px)] rounded-tr" />
              <div className="absolute w-3 h-3 border-b-2 border-l-2 border-accent bottom-[calc(50%-56px)] left-[calc(50%-104px)] rounded-bl" />
              <div className="absolute w-3 h-3 border-b-2 border-r-2 border-accent bottom-[calc(50%-56px)] right-[calc(50%-104px)] rounded-br" />
            </div>
            {scanning && (
              <div className="absolute bottom-3 inset-x-0 flex justify-center">
                <span className="text-xs text-white/80 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
                  {hasDetector && detector.current ? 'Scanning…' : 'Camera ready — BarcodeDetector not available in this browser'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Manual entry */}
        {mode === 'manual' && !result && !loading && (
          <div className="space-y-2">
            <label className="label">Barcode number (EAN-13, UPC-A, …)</label>
            <div className="flex gap-2">
              <input
                className="input flex-1 tabular-nums"
                placeholder="e.g. 5901234123457"
                value={manualCode}
                onChange={e => setManualCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && manualCode && lookupCode(manualCode)}
                autoFocus
                maxLength={14}
              />
              <button
                className="btn-primary"
                disabled={!manualCode}
                onClick={() => lookupCode(manualCode)}
              >
                Look up
              </button>
            </div>
          </div>
        )}

        {/* Loading spinner */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
            <RefreshCw size={16} className="animate-spin" />
            Looking up product…
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Result card */}
        {result && (
          <div className="space-y-3">
            <div className="p-3 bg-white/5 border border-border rounded-lg">
              <p className="font-semibold text-slate-100">{result.name || 'Unknown product'}</p>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">Barcode: {result.code}</p>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'kcal',    value: result.kcal,    color: 'text-cals' },
                { label: 'protein', value: result.protein, color: 'text-protein' },
                { label: 'carbs',   value: result.carbs,   color: 'text-carbs' },
                { label: 'fat',     value: result.fat,     color: 'text-fat' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white/3 rounded-lg py-2">
                  <div className={`text-sm font-semibold ${color}`}>{value}</div>
                  <div className="text-[10px] text-slate-500">{label}</div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 text-center">
              Values per 100{result.unit} · source: Open Food Facts
            </p>

            <div className="flex gap-2">
              <button
                className="btn-ghost flex-1 justify-center"
                onClick={() => { setResult(null); setError(''); if (mode === 'camera') startCamera(); }}
              >
                Scan again
              </button>
              <button
                className="btn-primary flex-1 justify-center"
                onClick={() => { onFound(result); onClose(); }}
              >
                <Check size={14} /> Use this
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
