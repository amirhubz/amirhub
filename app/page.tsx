'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { 
  Upload, 
  FileDown, 
  Lock, 
  Unlock, 
  Trash2, 
  FileCheck, 
  Loader2, 
  Info,
  Mail,
  MessageSquare,
  Share2,
  ExternalLink,
  ChevronDown, 
  Maximize2, 
  ArrowRight, 
  FileUp, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Key, 
  X, 
  Home,
  Image as ImageIcon,
  Plus,
  Save,
  Moon,
  Sun
} from 'lucide-react';
import JSZip from 'jszip';
import { motion, AnimatePresence } from 'framer-motion';

// --- Utility ---
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// --- Types ---
interface SvgFile {
  id: string;
  name: string;
  content: string; // The raw SVG string
  originalSize: { width: number; height: number };
}

interface CsvRow {
  id: string;
  filename: string;
  title: string;
  description: string;
  keywords: string;
  categories: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  imagePreview?: string;
}

export default function App() {
  const [activeTool, setActiveTool] = useState<'home' | 'svg-resizer' | 'svg-to-jpg' | 'file-size-increaser' | 'csv-generator' | 'about'>('home');

  // --- SVG Resizer State ---
  const [svgFiles, setSvgFiles] = useState<SvgFile[]>([]);
  const [targetWidth, setTargetWidth] = useState<number>(1000);
  const [targetHeight, setTargetHeight] = useState<number>(1000);
  const [isResizing, setIsResizing] = useState(false);

  // --- SVG to JPG State ---
  const [svgToJpgFiles, setSvgToJpgFiles] = useState<SvgFile[]>([]);
  const [jpgTargetWidth, setJpgTargetWidth] = useState<number>(1000);
  const [jpgTargetHeight, setJpgTargetHeight] = useState<number>(1000);
  const [isConvertingToJpg, setIsConvertingToJpg] = useState(false);
  const [jpgFinished, setJpgFinished] = useState(false);
  const [jpgProcessStats, setJpgProcessStats] = useState({ total: 0, completed: 0, startTime: 0 });

  // --- File Size Increaser State ---
  const [targetSize, setTargetSize] = useState<number>(4); // Default 4MB
  const [targetUnit, setTargetUnit] = useState<'MB' | 'KB'>('MB');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isProcessingImages, setIsProcessingImages] = useState(false);

  // --- Completion Suggestions State ---
  const [resizerFinished, setResizerFinished] = useState(false);
  const [increaserFinished, setIncreaserFinished] = useState(false);

  const [showApiKeys, setShowApiKeys] = useState(false);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [mistralApiKey, setMistralApiKey] = useState<string>('');
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('mistral_api_key');
    if (savedKey) setMistralApiKey(savedKey);
    
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleSaveApiKey = () => {
    setApiKeyStatus('saving');
    localStorage.setItem('mistral_api_key', mistralApiKey);
    setTimeout(() => {
      setApiKeyStatus('saved');
      setTimeout(() => setApiKeyStatus('idle'), 2000);
    }, 500);
  };
  const [keywordCount, setKeywordCount] = useState<number>(40);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);
  const [processStats, setProcessStats] = useState({ total: 0, completed: 0, failed: 0, startTime: 0 });
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showFailureModal, setShowFailureModal] = useState(false);

  // --- Refs ---
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- SVG Resizer Functions ---
  const onSvgUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: SvgFile[] = [];
    for (const file of Array.from(files)) {
      if (file.type !== 'image/svg+xml') continue;
      const text = await file.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      
      if (!svg) continue;

      let width = 0;
      let height = 0;

      // 1. Try ViewBox
      const viewBox = svg.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.split(/[ ,]+/).filter(Boolean).map(parseFloat);
        if (parts.length === 4) {
          width = parts[2];
          height = parts[3];
        }
      }

      // 2. Try Width/Height attributes
      if (!width || !height) {
        const wAttr = svg.getAttribute('width');
        const hAttr = svg.getAttribute('height');
        if (wAttr) width = parseFloat(wAttr);
        if (hAttr) height = parseFloat(hAttr);
      }

      // 3. Fallback
      width = width || 100;
      height = height || 100;

      newFiles.push({
        id: Math.random().toString(36).substring(2, 11),
        name: file.name,
        content: text,
        originalSize: { width, height }
      });
    }
    setSvgFiles(prev => [...prev, ...newFiles]);
  }, []);

  const onSvgToJpgUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: SvgFile[] = [];
    for (const file of Array.from(files)) {
      if (file.type !== 'image/svg+xml') continue;
      const text = await file.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      
      if (!svg) continue;

      let width = 0;
      let height = 0;

      const viewBox = svg.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.split(/[ ,]+/).filter(Boolean).map(parseFloat);
        if (parts.length === 4) {
          width = parts[2];
          height = parts[3];
        }
      }

      if (!width || !height) {
        const wAttr = svg.getAttribute('width');
        const hAttr = svg.getAttribute('height');
        if (wAttr) width = parseFloat(wAttr);
        if (hAttr) height = parseFloat(hAttr);
      }

      width = width || 100;
      height = height || 100;

      newFiles.push({
        id: Math.random().toString(36).substring(2, 11),
        name: file.name,
        content: text,
        originalSize: { width, height }
      });
    }
    setSvgToJpgFiles(prev => [...prev, ...newFiles].slice(0, 500));
  }, []);

  const handleSvgToJpgBatchProcess = async () => {
    if (svgToJpgFiles.length === 0 || !canvasRef.current) return;
    setIsConvertingToJpg(true);
    setJpgFinished(false);
    setJpgProcessStats({ total: svgToJpgFiles.length, completed: 0, startTime: Date.now() });
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const zip = new JSZip();

    for (const file of svgToJpgFiles) {
        const blob = new Blob([file.content], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        await new Promise<void>((resolve) => {
            const img = new (window as any).Image();
            img.onload = () => {
                canvas.width = jpgTargetWidth;
                canvas.height = jpgTargetHeight;
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, jpgTargetWidth, jpgTargetHeight);
                
                canvas.toBlob((jpgBlob) => {
                    if (jpgBlob) {
                        zip.file(file.name.replace('.svg', '.jpg'), jpgBlob);
                    }
                    URL.revokeObjectURL(url);
                    resolve();
                }, 'image/jpeg', 0.95);
            };
            img.src = url;
        });
        setJpgProcessStats(prev => ({ ...prev, completed: prev.completed + 1 }));
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Amirhub_JPGs_${Date.now()}.zip`;
    link.click();
    URL.revokeObjectURL(url);
    setIsConvertingToJpg(false);
    setJpgFinished(true);
  };

  const downloadAllSvgs = async () => {
    if (svgFiles.length === 0) return;
    setIsResizing(true);
    const zip = new JSZip();

    svgFiles.forEach(file => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(file.content, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (svg) {
        // Set new dimensions as pure numbers (recommended for microstock)
        svg.setAttribute('width', targetWidth.toString());
        svg.setAttribute('height', targetHeight.toString());
        
        // Ensure a viewBox exists for proper scaling
        if (!svg.getAttribute('viewBox')) {
            svg.setAttribute('viewBox', `0 0 ${file.originalSize.width} ${file.originalSize.height}`);
        }
        
        // Ensure it fills the new dimensions correctly
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        
        zip.file(file.name, new XMLSerializer().serializeToString(doc));
      }
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    // Renamed as requested
    link.download = `Amirhub_Vectors_${Date.now()}.zip`;
    link.click();
    URL.revokeObjectURL(url);
    setIsResizing(false);
    setResizerFinished(true); // Suggest next step
  };

  // --- File Size Increaser Functions ---
  const processImages = async () => {
    if (selectedImages.length === 0) return;
    setIsProcessingImages(true);
    
    const zip = new JSZip();
    const targetSizeBytes = targetUnit === 'MB' ? targetSize * 1024 * 1024 : targetSize * 1024;

    for (const file of selectedImages) {
        // Simple strategy: append dummy metadata or just repeat the image in a way that viewers ignore
        // For standard "increase file size" we actually just need to add junk data to the end of the file
        const arrayBuffer = await file.arrayBuffer();
        const padding = new Uint8Array(Math.max(0, targetSizeBytes - arrayBuffer.byteLength));
        // Fill with random data
        for (let i = 0; i < padding.length; i++) padding[i] = Math.floor(Math.random() * 256);
        
        const blob = new Blob([arrayBuffer, padding], { type: file.type });
        zip.file(file.name, blob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Amirhub_Fixed_Sizes_${Date.now()}.zip`;
    link.click();
    URL.revokeObjectURL(url);
    setIsProcessingImages(false);
    setIncreaserFinished(true); // Suggest next step
  };

  // --- CSV Generator Functions ---
  const addCsvRows = (files: FileList) => {
    const newRows: CsvRow[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      filename: file.name,
      title: '',
      description: '',
      keywords: '',
      categories: '',
      status: 'pending' as const,
      imagePreview: URL.createObjectURL(file)
    }));
    setCsvRows(prev => [...prev, ...newRows].slice(0, 500));
  };

  const addManualRow = () => {
    setCsvRows(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      filename: `image_${prev.length + 1}.jpg`,
      title: '',
      description: '',
      keywords: '',
      categories: '',
      status: 'pending' as const
    }]);
  };

  const processRow = async (rowIndex: number, apiKey: string, kCount: number) => {
    const row = csvRows[rowIndex];
    if (!row || (row.status !== 'pending' && row.status !== 'failed')) return;

    setCsvRows(prev => {
      const next = [...prev];
      if (next[rowIndex]) {
        next[rowIndex] = { ...next[rowIndex], status: 'processing' };
      }
      return next;
    });

    try {
      const response = await fetch('/api/generate-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Analyze the filename: "${row.filename}". Generate microstock metadata. 
          Context: The image filename is ${row.filename}.`,
          customApiKey: apiKey,
          keywordCount: kCount
        })
      });

      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'API Error');
      }
      const data = await response.json();

      setCsvRows(prev => {
        const next = [...prev];
        if (next[rowIndex]) {
            next[rowIndex] = {
              ...next[rowIndex],
              status: 'completed',
              title: data.title,
              description: data.description,
              keywords: data.keywords.join(', '),
              categories: data.categories.join(', ')
            };
        }
        return next;
      });
      setProcessStats(prev => ({ ...prev, completed: prev.completed + 1 }));
    } catch (err: any) {
      setCsvRows(prev => {
        const next = [...prev];
        if (next[rowIndex]) {
            next[rowIndex] = { ...next[rowIndex], status: 'failed', error: err.message };
        }
        return next;
      });
      setProcessStats(prev => ({ ...prev, failed: prev.failed + 1 }));
    }
  };

  const handleCsvBatchProcess = async () => {
    if (csvRows.length === 0) return;
    if (!mistralApiKey.trim()) {
      alert("Please provide your Mistral API Key in the API Configuration box.");
      setShowApiKeys(true);
      return;
    }
    setIsProcessingCsv(true);
    const completedAlready = csvRows.filter(r => r.status === 'completed').length;
    setProcessStats({ total: csvRows.length, completed: completedAlready, failed: 0, startTime: Date.now() });

    const concurrency = 5;
    const rowsToProcess = csvRows.map((_, idx) => idx).filter(idx => csvRows[idx].status === 'pending' || csvRows[idx].status === 'failed');
    
    for (let i = 0; i < rowsToProcess.length; i += concurrency) {
      const batch = rowsToProcess.slice(i, i + concurrency).map(idx => processRow(idx, mistralApiKey, keywordCount));
      await Promise.all(batch);
    }

    setIsProcessingCsv(false);
    
    setTimeout(() => {
      setCsvRows(currentRows => {
        const failedCount = currentRows.filter(r => r.status === 'failed').length;
        if (failedCount > 0) {
          setShowFailureModal(true);
        } else {
          setShowCompleteModal(true);
        }
        return currentRows;
      });
    }, 500);
  };

  const handleCsvDownload = () => {
    const completedRows = csvRows.filter(r => r.status === 'completed');
    if (completedRows.length === 0) return;
    
    const header = "Filename,Title,Description,Keywords,Categories\n";
    const rows = completedRows.map(row => {
      const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
      return `${escape(row.filename)},${escape(row.title)},${escape(row.description)},${escape(row.keywords)},${escape(row.categories)}`;
    }).join("\n");
    
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // Renamed as requested
    link.download = `Shutterstock_Matadata_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getTimeLeft = () => {
    const itemsDone = processStats.completed - (csvRows.filter(r => r.status === 'completed').length - processStats.completed);
    if (!isProcessingCsv || itemsDone <= 0) return 'Calculating...';
    const elapsed = Date.now() - processStats.startTime;
    const avgTimePerItem = elapsed / itemsDone;
    const remaining = processStats.total - processStats.completed;
    const timeLeftMs = avgTimePerItem * remaining;
    
    const minutes = Math.floor(timeLeftMs / 60000);
    const seconds = Math.floor((timeLeftMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getJpgTimeLeft = () => {
    if (!isConvertingToJpg || jpgProcessStats.completed <= 0) return 'Calculating...';
    const elapsed = Date.now() - jpgProcessStats.startTime;
    const avgTimePerItem = elapsed / jpgProcessStats.completed;
    const remaining = jpgProcessStats.total - jpgProcessStats.completed;
    const timeLeftMs = avgTimePerItem * remaining;
    
    if (timeLeftMs <= 0) return 'Finishing...';
    
    const minutes = Math.floor(timeLeftMs / 60000);
    const seconds = Math.floor((timeLeftMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const refineKeywords = (rowId: string) => {
    setCsvRows(prev => prev.map(r => {
      if (r.id === rowId) {
        const refined = r.keywords
          .split(',')
          .map(k => k.trim())
          .filter(k => k.length > 0 && !k.includes(' '))
          .join(', ');
        return { ...r, keywords: refined };
      }
      return r;
    }));
  };

  return (
    <div className="relative min-h-screen font-sans selection:bg-neutral-900 selection:text-white dark:selection:bg-white dark:selection:text-neutral-900 overflow-hidden bg-white dark:bg-neutral-950 transition-colors duration-300">
      {/* Top Colorful Accent Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 z-[100] bg-gradient-to-r from-blue-500 via-purple-500 via-pink-500 via-red-500 via-orange-500 to-yellow-500 animate-gradient-x" />
      
      {/* Dynamic Colorful Background */}
      <div className="fixed inset-0 z-0">
        <Image 
          src="https://i.postimg.cc/t4J9QKb2/20260501-182631-8-4-300-2.jpg"
          alt="background"
          fill
          className="object-cover opacity-70 dark:opacity-20 pointer-events-none transition-opacity duration-300"
          priority
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-white/5 dark:bg-black/40" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="border-b border-white/40 dark:border-white/10 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-3xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setActiveTool('home')}>
              <div className="w-10 h-10 bg-white dark:bg-neutral-800 rounded-xl flex items-center justify-center border border-neutral-100 dark:border-neutral-700 overflow-hidden shadow-sm group-hover:scale-110 transition-transform">
                <Image 
                  src="https://i.postimg.cc/t4J9QKb2/20260501-182631-8-4-300-2.jpg"
                  alt="logo"
                  width={40}
                  height={40}
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="text-xl font-black tracking-tighter bg-gradient-to-r from-neutral-900 via-purple-600 to-orange-600 dark:from-white dark:via-purple-400 dark:to-orange-400 bg-clip-text text-transparent">AMIRHUB</span>
            </div>
          
          <nav className="hidden md:flex items-center gap-1 bg-white/40 dark:bg-neutral-800/40 border border-white dark:border-neutral-700 p-1 rounded-2xl shadow-sm backdrop-blur-md">
            {[
              { id: 'svg-resizer', label: 'SVG Resizer', icon: Maximize2, color: 'hover:text-blue-500' },
              { id: 'svg-to-jpg', label: 'SVG to JPG', icon: ImageIcon, color: 'hover:text-purple-500' },
              { id: 'file-size-increaser', label: 'Size Up', icon: ArrowRight, color: 'hover:text-green-500' },
              { id: 'csv-generator', label: 'CSV AI', icon: FileCheck, color: 'hover:text-orange-500' },
              { id: 'about', label: 'About', icon: Info, color: 'hover:text-neutral-500' },
            ].map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id as any)}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all",
                  activeTool === tool.id 
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-lg shadow-neutral-900/10 dark:shadow-white/10" 
                    : cn("text-neutral-500 dark:text-neutral-400", tool.color)
                )}
              >
                <tool.icon className={cn("w-4 h-4", activeTool === tool.id ? (isDarkMode ? "text-neutral-900" : "text-white") : "opacity-70")} />
                {tool.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button 
              onClick={toggleDarkMode}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-100 dark:border-neutral-700 transition-all shadow-sm"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-blue-600" />}
            </button>
            <button 
              onClick={() => setActiveTool('about')}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                activeTool === 'about' ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              )}
            >
              <Info className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-6 py-12 w-full">
        <AnimatePresence mode="wait">
          {activeTool === 'home' && (
            <motion.div
              key="home"
              initial="hidden"
              animate="show"
              exit="exit"
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: { staggerChildren: 0.1 }
                },
                exit: { opacity: 0, scale: 0.95 }
              }}
              className="space-y-12"
            >
              <motion.div 
                variants={{
                  hidden: { y: 20, opacity: 0 },
                  show: { y: 0, opacity: 1 }
                }}
                className="text-center space-y-4 max-w-2xl mx-auto"
              >
                <h1 className="text-6xl font-black tracking-tight text-neutral-900 dark:text-white leading-tight">
                  Microstock <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500">Power Tools</span>
                </h1>
                <p className="text-neutral-500 dark:text-neutral-400 font-medium">
                  Professional utility suite designed for high-volume microstock contributors. 
                  Automate your metadata, resize assets, and optimize file sizes in seconds.
                </p>
              </motion.div>

              <div id="tool-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  {
                    id: 'svg-resizer',
                    title: 'SVG Batch Resizer',
                    desc: 'Professional vector scaling for perfect uploads.',
                    icon: Maximize2,
                    color: 'from-blue-600 to-indigo-500',
                    glow: 'shadow-blue-500/20',
                  },
                  {
                    id: 'svg-to-jpg',
                    title: 'SVG to JPG Converter',
                    desc: 'Batch conversion with custom dimensions.',
                    icon: ImageIcon,
                    color: 'from-purple-600 to-fuchsia-500',
                    glow: 'shadow-purple-500/20',
                  },
                  {
                    id: 'file-size-increaser',
                    title: 'Size Increaser',
                    desc: 'Meet minimum size requirements effortlessly.',
                    icon: ArrowRight,
                    color: 'from-emerald-600 to-teal-400',
                    glow: 'shadow-emerald-500/20',
                  },
                  {
                    id: 'csv-generator',
                    title: 'CSV AI Generator',
                    desc: 'AI-powered, SEO-optimized metadata.',
                    icon: FileCheck,
                    color: 'from-orange-600 to-amber-500',
                    glow: 'shadow-orange-500/20',
                  }
                ].map((tool) => (
                  <motion.button
                    key={tool.id}
                    variants={{
                      hidden: { y: 30, opacity: 0 },
                      show: { y: 0, opacity: 1 }
                    }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    onClick={() => setActiveTool(tool.id as any)}
                    className={cn(
                      "group bg-white dark:bg-neutral-900 p-8 rounded-[3rem] border border-white dark:border-neutral-800 text-left hover:border-transparent transition-all space-y-6 shadow-xl",
                      tool.glow,
                      "hover:shadow-2xl"
                    )}
                  >
                    <div className={cn("w-16 h-16 rounded-[1.25rem] flex items-center justify-center text-white bg-gradient-to-br shadow-lg transition-transform group-hover:rotate-6", tool.color)}>
                      <tool.icon className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-neutral-900 group-hover:to-neutral-500 dark:group-hover:from-white dark:group-hover:to-neutral-400 transition-all">{tool.title}</h3>
                      <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">{tool.desc}</p>
                    </div>
                  </motion.button>
                ))}
              </div>

            </motion.div>
          )}

          {activeTool === 'about' && (
            <motion.div
              key="about"
              initial={{ opacity: 0, scale: 0.8, rotate: -2 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 1.1, rotate: 2 }}
              transition={{ type: "spring", damping: 20, stiffness: 100 }}
              className="max-w-4xl mx-auto space-y-12"
            >
              <div className="bg-white/40 dark:bg-neutral-900/40 backdrop-blur-md rounded-[3rem] border border-neutral-200/50 dark:border-neutral-800/50 p-12 shadow-sm space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <h2 className="text-3xl font-black tracking-tight text-neutral-900 dark:text-white">About Amirhub</h2>
                       <p className="text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed">
                         Amirhub is a specialized utility suite designed for microstock contributors. 
                         Our mission is to simplify the content submission workflow by providing powerful, 
                         AI-driven tools for metadata generation, vector resizing, and file optimization.
                       </p>
                    </div>
                    
                    <div className="space-y-6">
                       <h3 className="text-sm font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Our Utility Suite</h3>
                       <ul className="space-y-3">
                         {[
                           "SVG Resizer: Professional vector scaling for pixel-perfect uploads.",
                           "SVG to JPG Converter: Fast batch conversion with custom dimensions.",
                           "File Size Increaser: Meet minimum size requirements (1MB+) effortlessly.",
                           "CSV Metadata Generator: AI-powered, SEO-optimized metadata generation."
                         ].map((text, idx) => (
                           <li key={idx} className="flex gap-3 text-sm font-bold text-neutral-700 dark:text-neutral-300">
                             <div className="w-5 h-5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">{idx + 1}</div>
                             {text}
                           </li>
                         ))}
                       </ul>
                    </div>

                    <div className="space-y-4 pt-4">
                       <h3 className="text-sm font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">How to use</h3>
                       <ul className="space-y-3">
                         {[
                           "Choose your tool from the dashboard.",
                           "Import your files (Supports batch up to 500 images for conversion).",
                           "Configure your settings (Dimensions, Size, or Keyword counts).",
                           "Process and download your optimized microstock assets."
                         ].map((text, idx) => (
                           <li key={idx} className="flex gap-3 text-sm font-bold text-neutral-500 dark:text-neutral-400">
                             <div className="w-5 h-5 border border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 text-[10px] flex items-center justify-center rounded-full flex-shrink-0 mt-0.5">{idx + 1}</div>
                             {text}
                           </li>
                         ))}
                       </ul>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="p-8 bg-neutral-900 dark:bg-black rounded-[2.5rem] text-white space-y-6 shadow-2xl shadow-neutral-900/40 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 blur-3xl" />
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/10 blur-3xl" />
                      
                      <h3 className="text-xl font-bold">Contact Information</h3>
                      <div className="space-y-4">
                        <a href="mailto:immdamirulislam@gmail.com" className="flex items-center gap-4 group">
                          <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center group-hover:bg-red-500/30 transition-all border border-red-500/20">
                            <Mail className="w-5 h-5 text-red-400 group-hover:text-red-300" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-neutral-400 dark:text-neutral-500">Email</p>
                            <p className="text-sm font-bold">immdamirulislam@gmail.com</p>
                          </div>
                        </a>
                        <a href="https://wa.me/8801978516155" target="_blank" className="flex items-center gap-4 group">
                          <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center group-hover:bg-green-500/30 transition-all border border-green-500/20">
                            <MessageSquare className="w-5 h-5 text-green-400 group-hover:text-green-300" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-neutral-400 dark:text-neutral-500">WhatsApp</p>
                            <p className="text-sm font-bold">+8801978516155</p>
                          </div>
                        </a>
                        <a href="https://facebook.com/iammdamirulislam" target="_blank" className="flex items-center gap-4 group">
                          <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:bg-blue-500/30 transition-all border border-blue-500/20">
                            <Share2 className="w-5 h-5 text-blue-400 group-hover:text-blue-300" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-neutral-400 dark:text-neutral-500">Facebook</p>
                            <p className="text-sm font-bold">@iammdamirulislam</p>
                          </div>
                        </a>
                        <a href="https://www.shutterstock.com/g/AiBackground" target="_blank" className="flex items-center gap-4 group">
                          <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center group-hover:bg-orange-500/30 transition-all border border-orange-500/20">
                            <ExternalLink className="w-5 h-5 text-orange-400 group-hover:text-orange-300" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-neutral-400 dark:text-neutral-500">Shutterstock Portfolio</p>
                            <p className="text-sm font-bold">AiBackground</p>
                          </div>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTool === 'csv-generator' && (
            <motion.div
              key="csv"
              initial={{ opacity: 0, y: 50, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  {showApiKeys ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Mistral API Key</h3>
                        <button onClick={() => setShowApiKeys(false)}>
                          <X className="w-4 h-4 text-neutral-500 hover:text-neutral-900 dark:hover:text-white" />
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="relative">
                          <input
                            type="password"
                            value={mistralApiKey}
                            onChange={(e) => setMistralApiKey(e.target.value)}
                            className="w-full bg-neutral-50 dark:bg-neutral-800 pl-4 pr-12 py-3 text-sm rounded-xl border border-neutral-100 dark:border-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-neutral-900/5 dark:focus:ring-white/5 outline-none transition-all"
                            placeholder="Paste your Mistral key here..."
                          />
                          <button 
                            onClick={handleSaveApiKey}
                            className={cn(
                              "absolute right-2 top-1.5 p-1.5 rounded-lg transition-all",
                              apiKeyStatus === 'saved' ? "bg-green-500 text-white" : "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200"
                            )}
                          >
                            {apiKeyStatus === 'saved' ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                          {apiKeyStatus === 'saved' ? 'Key saved successfully!' : 'Your key is saved securely in your browser\'s local storage.'}
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <button 
                      onClick={() => setShowApiKeys(true)}
                      className="bg-white dark:bg-neutral-900 p-6 w-full rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between hover:border-neutral-900 dark:hover:border-white transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center group-hover:bg-neutral-900 dark:group-hover:bg-white transition-all">
                          <Key className="w-5 h-5 text-neutral-500 dark:text-neutral-400 group-hover:text-white dark:group-hover:text-neutral-900" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-bold text-neutral-900 dark:text-white">API Key</h3>
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase">{mistralApiKey ? 'Key Configured' : 'No Key Set'}</p>
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-neutral-300 dark:text-neutral-600" />
                    </button>
                  )}

                  <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 blur-2xl" />
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Keywords Count</h3>
                      <span className="text-sm font-black text-orange-600">{keywordCount}</span>
                    </div>
                    <input 
                      type="range" 
                      min="25" 
                      max="50" 
                      step="1"
                      value={keywordCount}
                      onChange={(e) => setKeywordCount(parseInt(e.target.value))}
                      className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="flex justify-between text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase">
                      <span>25 Min</span>
                      <span>50 Max</span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800 space-y-6 shadow-sm">
                    <div className="space-y-3">
                      <button
                        onClick={handleCsvBatchProcess}
                        disabled={isProcessingCsv || csvRows.length === 0}
                        className="w-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all disabled:opacity-30 shadow-lg shadow-neutral-200 dark:shadow-black/20"
                      >
                        {isProcessingCsv ? 'Processing...' : 'Start Generating'}
                      </button>
                      <button
                        onClick={handleCsvDownload}
                        disabled={isProcessingCsv || !csvRows.some(r => r.status === 'completed')}
                        className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                      >
                        <FileDown className="w-5 h-5" /> Download CSV
                      </button>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  {isProcessingCsv && (
                    <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
                        <div className="flex justify-between items-center mb-2">
                             <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase">Estimated Time: {getTimeLeft()}</span>
                             <span className="text-xs font-bold text-neutral-900 dark:text-white">{processStats.completed} / {processStats.total}</span>
                        </div>
                        <div className="h-2 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-neutral-900 dark:bg-white transition-all duration-500" 
                                style={{ width: `${processStats.total > 0 ? (processStats.completed / processStats.total) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                  )}

                  <label className="group h-40 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl flex flex-col items-center justify-center bg-white dark:bg-neutral-900 hover:border-neutral-900 dark:hover:border-white transition-all cursor-pointer">
                    <input 
                        type="file" 
                        multiple 
                        className="hidden" 
                        onChange={(e) => e.target.files && addCsvRows(e.target.files)} 
                    />
                    <FileUp className="w-8 h-8 text-neutral-300 dark:text-neutral-700 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors mb-2" />
                    <p className="font-bold text-neutral-900 dark:text-white">Import Images</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">Max 500 files</p>
                  </label>

                  <div className="space-y-3">
                    {csvRows.map((row, idx) => (
                      <div key={row.id} className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           {row.imagePreview ? (
                             <img src={row.imagePreview} alt="p" className="w-10 h-10 object-cover rounded-lg" />
                           ) : (
                             <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center"><ImageIcon className="w-5 h-5 text-neutral-300 dark:text-neutral-700" /></div>
                           )}
                           <div>
                             <p className="text-sm font-bold text-neutral-900 dark:text-white truncate max-w-[200px]">{row.filename}</p>
                             <p className={cn(
                               "text-[10px] font-bold uppercase",
                               row.status === 'completed' ? "text-green-600 dark:text-green-400" : row.status === 'failed' ? "text-red-600 dark:text-red-400" : "text-neutral-400 dark:text-neutral-500"
                             )}>
                               {row.status}
                             </p>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           {row.status === 'completed' && (
                             <button onClick={() => refineKeywords(row.id)} className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-white">Refine</button>
                           )}
                           <button onClick={() => setCsvRows(prev => prev.filter(r => r.id !== row.id))} className="p-2 text-neutral-300 dark:text-neutral-700 hover:text-red-500"><X className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modals */}
              <AnimatePresence>
                {showCompleteModal && (
                   <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm transition-all">
                     <div className="bg-white dark:bg-neutral-900 rounded-[3rem] p-10 max-w-md w-full text-center space-y-6 shadow-2xl border border-white/20 dark:border-white/5">
                       <ShieldCheck className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto" />
                       <h2 className="text-2xl font-black text-neutral-900 dark:text-white">All Ready!</h2>
                       <button 
                        onClick={() => { handleCsvDownload(); setShowCompleteModal(false); }}
                        className="w-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-4 rounded-2xl font-black uppercase shadow-lg"
                       >
                         Download CSV
                       </button>
                     </div>
                   </div>
                )}
                {showFailureModal && (
                   <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm transition-all">
                     <div className="bg-white dark:bg-neutral-900 rounded-[3rem] p-10 max-w-md w-full text-center space-y-6 shadow-2xl border border-white/20 dark:border-white/5">
                       <AlertCircle className="w-16 h-16 text-red-600 dark:text-red-400 mx-auto" />
                       <h2 className="text-2xl font-black text-neutral-900 dark:text-white">Partial Success</h2>
                       <p className="text-neutral-500 dark:text-neutral-400">Some items failed to process. You can retry the failed items.</p>
                       <div className="flex gap-4">
                         <button onClick={() => setShowFailureModal(false)} className="flex-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white py-4 rounded-2xl font-black">Review</button>
                         <button onClick={() => { setShowFailureModal(false); handleCsvBatchProcess(); }} className="flex-1 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-4 rounded-2xl font-black">Retry Failed</button>
                       </div>
                     </div>
                   </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTool === 'svg-to-jpg' && (
            <motion.div
              key="svg-to-jpg"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Export Dimensions</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase">JPG Width</label>
                        <input 
                          type="number" 
                          value={jpgTargetWidth} 
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setJpgTargetWidth(isNaN(val) ? 0 : val);
                          }}
                          className="w-full bg-neutral-50 dark:bg-neutral-800 px-4 py-3 rounded-xl border border-neutral-100 dark:border-neutral-700 text-sm font-bold text-neutral-900 dark:text-white focus:ring-2 focus:ring-neutral-900/5 dark:focus:ring-white/5 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase">JPG Height</label>
                        <input 
                          type="number" 
                          value={jpgTargetHeight} 
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setJpgTargetHeight(isNaN(val) ? 0 : val);
                          }}
                          className="w-full bg-neutral-50 dark:bg-neutral-800 px-4 py-3 rounded-xl border border-neutral-100 dark:border-neutral-700 text-sm font-bold text-neutral-900 dark:text-white focus:ring-2 focus:ring-neutral-900/5 dark:focus:ring-white/5 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSvgToJpgBatchProcess}
                    disabled={isConvertingToJpg || svgToJpgFiles.length === 0}
                    className="w-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-4 rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all disabled:opacity-30 shadow-xl flex items-center justify-center gap-2"
                  >
                    {isConvertingToJpg ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                    Convert & Download
                  </button>

                  <AnimatePresence>
                    {jpgFinished && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30 rounded-3xl space-y-3"
                      >
                        <p className="text-xs font-bold text-purple-700 dark:text-purple-400 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Conversion Complete!
                        </p>
                        <button
                          onClick={() => {
                            setActiveTool('file-size-increaser');
                            setJpgFinished(false);
                          }}
                          className="w-full py-3 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-neutral-900 dark:hover:bg-white hover:text-white dark:hover:text-neutral-900 transition-all shadow-sm"
                        >
                          Next: Increase Size <ArrowRight className="w-4 h-4" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  {isConvertingToJpg && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-purple-200 dark:border-purple-800 shadow-xl space-y-4"
                    >
                        <div className="flex justify-between items-center mb-2">
                             <div className="flex flex-col">
                               <span className="text-[10px] font-black text-purple-500 dark:text-purple-400 uppercase tracking-widest flex items-center gap-2">
                                 <Loader2 className="w-3 h-3 animate-spin" /> Time Remaining
                               </span>
                               <span className="text-sm font-bold text-neutral-900 dark:text-white">{getJpgTimeLeft()}</span>
                             </div>
                             <div className="text-right">
                               <span className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Progress</span>
                               <p className="text-sm font-bold text-neutral-900 dark:text-white">{jpgProcessStats.completed} / {jpgProcessStats.total}</p>
                             </div>
                        </div>
                        <div className="h-4 w-full bg-neutral-100 rounded-full overflow-hidden p-1 border border-neutral-50">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${jpgProcessStats.total > 0 ? (jpgProcessStats.completed / jpgProcessStats.total) * 100 : 0}%` }}
                                className="h-full bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-600 bg-[length:200%_100%] animate-gradient-x rounded-full shadow-[0_0_15px_rgba(147,51,234,0.4)]" 
                            />
                        </div>
                        <p className="text-center text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Converting Large Assets... Please wait</p>
                    </motion.div>
                  )}

                  <label className="group h-40 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl flex flex-col items-center justify-center bg-white dark:bg-neutral-900 hover:border-neutral-900 dark:hover:border-white transition-all cursor-pointer">
                    <input 
                      type="file" 
                      multiple 
                      accept=".svg"
                      className="hidden" 
                      onChange={onSvgToJpgUpload} 
                    />
                    <FileUp className="w-8 h-8 text-neutral-300 dark:text-neutral-700 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors mb-2" />
                    <p className="font-bold text-neutral-900 dark:text-white">Import SVGs for JPG Conversion</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">Fast batch processing up to 500 images</p>
                  </label>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {svgToJpgFiles.map((file) => (
                      <div key={file.id} className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 group relative">
                        <div className="aspect-square bg-neutral-50 dark:bg-neutral-800 rounded-xl flex items-center justify-center mb-3 p-4 overflow-hidden border border-neutral-100 dark:border-neutral-700">
                          <div dangerouslySetInnerHTML={{ __html: file.content }} className="w-full h-full" />
                        </div>
                        <p className="text-xs font-bold text-neutral-900 dark:text-white truncate pr-6">{file.name}</p>
                        <button 
                          onClick={() => setSvgToJpgFiles(prev => prev.filter(f => f.id !== file.id))}
                          className="absolute top-2 right-2 p-1.5 bg-white dark:bg-neutral-800 shadow-sm border border-neutral-100 dark:border-neutral-700 rounded-lg text-neutral-300 dark:text-neutral-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTool === 'svg-resizer' && (
            <motion.div
              key="svg"
              initial={{ opacity: 0, x: -100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Target Dimensions</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase">Width</label>
                        <input 
                          type="number" 
                          value={targetWidth} 
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setTargetWidth(isNaN(val) ? 0 : val);
                          }}
                          className="w-full bg-neutral-50 dark:bg-neutral-800 px-4 py-3 rounded-xl border border-neutral-100 dark:border-neutral-700 text-sm font-bold text-neutral-900 dark:text-white focus:ring-2 focus:ring-neutral-900/5 dark:focus:ring-white/5 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase">Height</label>
                        <input 
                          type="number" 
                          value={targetHeight} 
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setTargetHeight(isNaN(val) ? 0 : val);
                          }}
                          className="w-full bg-neutral-50 dark:bg-neutral-800 px-4 py-3 rounded-xl border border-neutral-100 dark:border-neutral-700 text-sm font-bold text-neutral-900 dark:text-white focus:ring-2 focus:ring-neutral-900/5 dark:focus:ring-white/5 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={downloadAllSvgs}
                    disabled={isResizing || svgFiles.length === 0}
                    className="w-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-4 rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all disabled:opacity-30 shadow-xl flex items-center justify-center gap-2"
                  >
                    {isResizing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Maximize2 className="w-5 h-5" />}
                    Process & Download
                  </button>

                  <AnimatePresence>
                    {resizerFinished && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 rounded-3xl space-y-3"
                      >
                        <p className="text-xs font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Resizing Complete!
                        </p>
                        <button
                          onClick={() => {
                            setActiveTool('file-size-increaser');
                            setResizerFinished(false);
                          }}
                          className="w-full py-3 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-neutral-900 dark:hover:bg-white hover:text-white dark:hover:text-neutral-900 transition-all shadow-sm"
                        >
                          Step 2: Increase Size <ArrowRight className="w-4 h-4" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <label className="group h-40 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl flex flex-col items-center justify-center bg-white dark:bg-neutral-900 hover:border-neutral-900 dark:hover:border-white transition-all cursor-pointer">
                    <input 
                      type="file" 
                      multiple 
                      accept=".svg"
                      className="hidden" 
                      onChange={onSvgUpload} 
                    />
                    <FileUp className="w-8 h-8 text-neutral-300 dark:text-neutral-700 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors mb-2" />
                    <p className="font-bold text-neutral-900 dark:text-white">Import SVGs</p>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setResizerFinished(false);
                      }}
                      className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold hover:text-neutral-900 dark:hover:text-white transition-colors"
                    >
                      Clear Previous Suggestion
                    </button>
                  </label>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {svgFiles.map((file) => (
                      <div key={file.id} className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 group relative">
                        <div className="aspect-square bg-neutral-50 dark:bg-neutral-800 rounded-xl flex items-center justify-center mb-3 p-4 overflow-hidden border border-neutral-100 dark:border-neutral-700">
                          <div dangerouslySetInnerHTML={{ __html: file.content }} className="w-full h-full" />
                        </div>
                        <p className="text-xs font-bold text-neutral-900 dark:text-white truncate pr-6">{file.name}</p>
                        <button 
                          onClick={() => setSvgFiles(prev => prev.filter(f => f.id !== file.id))}
                          className="absolute top-2 right-2 p-1.5 bg-white dark:bg-neutral-800 shadow-sm border border-neutral-100 dark:border-neutral-700 rounded-lg text-neutral-300 dark:text-neutral-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTool === 'file-size-increaser' && (
            <motion.div
              key="increaser"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Target File Size</h3>
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        {['MB', 'KB'].map((unit) => (
                          <button
                            key={unit}
                            onClick={() => setTargetUnit(unit as any)}
                            className={cn(
                              "flex-1 py-2 text-xs font-black rounded-xl border transition-all",
                              targetUnit === unit ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-neutral-700" : "bg-neutral-50 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border-neutral-100 dark:border-neutral-700"
                            )}
                          >
                            {unit}
                          </button>
                        ))}
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max={targetUnit === 'MB' ? 10 : 1024} 
                        step="1"
                        value={targetSize}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setTargetSize(isNaN(val) ? 1 : val);
                        }}
                        className="w-full accent-neutral-900 dark:accent-white"
                      />
                      <div className="flex justify-between font-black text-xl text-neutral-900 dark:text-white">
                        <span>{targetSize}</span>
                        <span className="text-neutral-300 dark:text-neutral-700">{targetUnit}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={processImages}
                    disabled={isProcessingImages || selectedImages.length === 0}
                    className="w-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-4 rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all disabled:opacity-30 shadow-xl flex items-center justify-center gap-2"
                  >
                    {isProcessingImages ? <Loader2 className="w-5 h-5 animate-spin" /> : <Maximize2 className="w-5 h-5" />}
                    Increase & Download
                  </button>

                  <AnimatePresence>
                    {increaserFinished && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 rounded-3xl space-y-3"
                      >
                        <p className="text-xs font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Optimization Complete!
                        </p>
                        <button
                          onClick={() => {
                            setActiveTool('csv-generator');
                            setIncreaserFinished(false);
                          }}
                          className="w-full py-3 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-neutral-900 dark:hover:bg-white hover:text-white dark:hover:text-neutral-900 transition-all shadow-sm"
                        >
                          Step 3: Generate CSV <ArrowRight className="w-4 h-4" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <label className="group h-40 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl flex flex-col items-center justify-center bg-white dark:bg-neutral-900 hover:border-neutral-900 dark:hover:border-white transition-all cursor-pointer">
                    <input 
                      type="file" 
                      multiple 
                      className="hidden" 
                      onChange={(e) => e.target.files && setSelectedImages(prev => [...prev, ...Array.from(e.target.files!)])} 
                    />
                    <FileUp className="w-8 h-8 text-neutral-300 dark:text-neutral-700 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors mb-2" />
                    <p className="font-bold text-neutral-900 dark:text-white">Import Images</p>
                  </label>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedImages.map((file, idx) => (
                      <div key={idx} className="bg-white dark:bg-neutral-900 p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 group relative">
                        <div className="aspect-square bg-neutral-50 dark:bg-neutral-800 rounded-xl flex items-center justify-center mb-2 overflow-hidden border border-neutral-100 dark:border-neutral-700">
                          <ImageIcon className="w-8 h-8 text-neutral-200 dark:text-neutral-700" />
                        </div>
                        <p className="text-[10px] font-bold text-neutral-900 dark:text-white truncate pr-6">{file.name}</p>
                        <button 
                          onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-2 right-2 p-1.5 bg-white dark:bg-neutral-800 shadow-sm border border-neutral-100 dark:border-neutral-700 rounded-lg text-neutral-300 dark:text-neutral-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      {/* Floating Bottom Navigation */}
      <div className="fixed bottom-8 left-0 right-0 z-50 pointer-events-none px-8">
        <div className="max-w-7xl mx-auto flex justify-end items-end">
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.1, x: -5 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              if (activeTool === 'home') {
                document.getElementById('tool-grid')?.scrollIntoView({ behavior: 'smooth' });
              } else {
                setActiveTool('home');
              }
            }}
            className="pointer-events-auto px-10 h-14 bg-neutral-900 dark:bg-white shadow-2xl rounded-2xl flex items-center text-white dark:text-neutral-900 border border-neutral-800 dark:border-neutral-100 group overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative z-10 font-black text-sm uppercase tracking-widest">Tools</span>
          </motion.button>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
