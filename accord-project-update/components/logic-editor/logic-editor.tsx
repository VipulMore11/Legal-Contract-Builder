'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const MonacoEditorBase = dynamic(
  () => import('@monaco-editor/react').then((mod) => {
    mod.loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });
    return mod.default;
  }),
  { ssr: false, loading: () => <div className="flex h-full w-full items-center justify-center bg-[#1e1e1e]"><Loader2 className="w-5 h-5 text-muted-foreground animate-spin" /></div> }
);

interface LogicEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: 'typescript' | 'plaintext' | 'json';
  readOnly?: boolean;
  height?: string;
}

export default function LogicEditor({ value, onChange, language = 'typescript', readOnly = false, height = '100%' }: LogicEditorProps) {
  return (
    <MonacoEditorBase
      height={height} language={language} value={value} theme="vs-dark"
      onChange={(v) => onChange?.(v ?? '')}
      options={{ readOnly, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, fontFamily: 'var(--font-geist-mono), monospace', lineNumbers: 'on', automaticLayout: true, padding: { top: 14, bottom: 14 }, folding: true, wordWrap: 'on', tabSize: 2, quickSuggestions: !readOnly }}
    />
  );
}
