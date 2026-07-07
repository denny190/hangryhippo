import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Hash, TextSearch, Check, AlertCircle, RefreshCw, Bookmark } from 'lucide-react';
import Modal from '../common/Modal.jsx';
import { api } from '../../utils/api.js';

const MacroGrid = ({ item }) => (
  <div className="grid grid-cols-4 gap-2 text-center">
    {[
      { label: 'kcal',    value: item.kcal,    color: 'text-cals' },
      { label: 'protein', value: item.protein, color: 'text-protein' },
      { label: 'carbs',   value: item.carbs,   color: 'text-carbs' },
      { label: 'fat',     value: item.fat,     color: 'text-fat' },
    ].map(({ label, value, color }) => (
      <div key={label} className="bg-white/3 rounded-lg py-2">
        <div className={`text-sm font-semibold ${color}`}>{value ?? 0}</div>
        <div className="text-[10px] text-slate-500">{label}</div>
      </div>
    ))}
  </div>
);

export default function BarcodeModal({ onFound, onClose, foods = [], onFoundExisting }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const detector  = useRef(null);
  const ticker    = useRef(null);

  const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  const [mode,          setMode]          = useState(hasDetector ? 'camera' : 'manual');
  const [scanning,      setScanning]      = useState(false);
  const [manualCode,    setManualCode]    = useState('');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [result,        setResult]        = useState(null);
  const [existingFood,  setExistingFood]  = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error,         setError]         = useState('');
  const [searchError,   setSearchError]   = useState('');

  // ── camera ──────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    clearInterval(ticker.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    detector.current  = null;
    setScanning(false);
  }, []);

  const lookupCode = useCallback(async (code) => {
    stopCamera();

    const dup = foods.find(f => f.code === code);
    if (dup) {
      if (onFoundExisting) {
        onFoundExisting(dup);
        onClose();
      } else {
        setExistingFood(dup);
      }
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await api.lookupBarcode(code);
      setResult(data);
    } catch {
      setError(`No product found for "${code}". Try again or switch to Search.`);
    } finally {
      setLoading(false);
    }
  }, [stopCamera, foods, onFoundExisting, onClose]);

  const startCamera = useCallback(async () => {
    // Stop any existing stream before starting a new one
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    setError('');
    setResult(null);
    setExistingFood(null);

    if (hasDetector && !detector.current) {
      try {
        detector.current = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
        });
      } catch { /* unsupported formats */ }
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
      setError('Camera not available. Enter the barcode number manually.');
      setMode('manual');
    }
  }, [hasDetector, lookupCode]);

  useEffect(() => {
    if (mode === 'camera') startCamera();
    return () => stopCamera();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── name search ──────────────────────────────────────────────────────────
  const runSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchLoading(true);
    setSearchError('');
    setSearchResults([]);
    try {
      const data = await api.searchFood(q);
      setSearchResults(data);
      if (data.length === 0) setSearchError('No results found. Try a different spelling or check your internet connection.');
    } catch {
      setSearchError('Search failed. Check your internet connection.');
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery]);

  const switchMode = (m) => {
    setError('');
    setResult(null);
    setExistingFood(null);
    setSearchResults([]);
    setSearchError('');
    if (mode === 'camera') stopCamera();
    setMode(m);
  };

  const isResultShowing = result || existingFood || loading;

  // ── tabs ─────────────────────────────────────────────────────────────────
  const tabs = [
    ...(hasDetector ? [{ id: 'camera',  icon: Camera,      label: 'Camera' }] : []),
    { id: 'manual', icon: Hash,       label: 'Barcode' },
    { id: 'search', icon: TextSearch, label: 'Search' },
  ];

  return (
    <Modal title="Food lookup" onClose={() => { stopCamera(); onClose(); }} size="sm">
      <div className="space-y-4">
        {!(isResultShowing && mode !== 'search') && (
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
            {tabs.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm rounded-lg transition-colors
                  ${mode === id ? 'bg-accent text-white' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => switchMode(id)}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        )}

        {/* ── Camera ── */}
        {mode === 'camera' && !isResultShowing && (
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
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
                  {hasDetector && detector.current ? 'Scanning…' : 'Camera ready — BarcodeDetector not supported in this browser'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Manual barcode ── */}
        {mode === 'manual' && !isResultShowing && (
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
              <button className="btn-primary" disabled={!manualCode} onClick={() => lookupCode(manualCode)}>
                Look up
              </button>
            </div>
          </div>
        )}

        {/* ── Name search ── */}
        {mode === 'search' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="e.g. Greek yogurt, tomato, oats…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runSearch()}
                autoFocus
              />
              <button className="btn-primary" disabled={!searchQuery.trim() || searchLoading} onClick={runSearch}>
                Search
              </button>
            </div>
            <p className="text-[10px] text-slate-600">Searches the Open Food Facts database · results per 100g</p>

            {searchLoading && (
              <div className="flex items-center justify-center gap-2 py-6 text-slate-400 text-sm">
                <RefreshCw size={16} className="animate-spin" /> Searching…
              </div>
            )}

            {searchError && !searchLoading && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />{searchError}
              </div>
            )}

            {!searchLoading && searchResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((item, i) => (
                  <div key={i} className="p-3 bg-white/3 border border-border rounded-lg">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-slate-200 leading-tight">{item.name}</p>
                      <button
                        className="btn-primary shrink-0 py-1 text-xs"
                        onClick={() => { onFound(item); onClose(); }}
                      >
                        <Check size={12} /> Use
                      </button>
                    </div>
                    <div className="flex gap-3 text-xs text-slate-500 tabular-nums">
                      <span className="text-cals/70">{item.kcal} kcal</span>
                      <span className="text-protein/70">{item.protein}g P</span>
                      <span className="text-carbs/70">{item.carbs}g C</span>
                      <span className="text-fat/70">{item.fat}g F</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Loading (barcode) ── */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
            <RefreshCw size={16} className="animate-spin" /> Looking up product…
          </div>
        )}

        {/* ── Error (barcode) ── */}
        {error && !loading && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />{error}
          </div>
        )}

        {/* ── Duplicate: already in Foods list ── */}
        {existingFood && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
              <Bookmark size={14} className="text-green-400 shrink-0" />
              <p className="text-sm text-green-300">Already in your Foods list</p>
            </div>
            <div className="p-3 bg-white/5 border border-border rounded-lg">
              <p className="font-semibold text-slate-100">{existingFood.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">per {existingFood.per}{existingFood.unit}</p>
            </div>
            <MacroGrid item={existingFood} />
            <button className="btn-ghost w-full justify-center" onClick={onClose}>Done</button>
          </div>
        )}

        {/* ── New barcode result ── */}
        {result && !existingFood && (
          <div className="space-y-3">
            <div className="p-3 bg-white/5 border border-border rounded-lg">
              <p className="font-semibold text-slate-100">{result.name || 'Unknown product'}</p>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">Barcode: {result.code}</p>
            </div>
            <MacroGrid item={result} />
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
