'use client';

import { NodeViewWrapper } from '@tiptap/react';
import { useRef, useState, useCallback } from 'react';
import { Pencil, Trash2, Check, X, PenLine, User, Building2, Briefcase } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { SignatureBlockAttrs } from './extensions/signature-block';

interface NodeViewProps {
  node: { attrs: SignatureBlockAttrs };
  updateAttributes: (attrs: Partial<SignatureBlockAttrs>) => void;
  deleteNode: () => void;
  selected: boolean;
}

// ---------------------------------------------------------------------------
// Canvas signature pad
// ---------------------------------------------------------------------------

function SignaturePad({
  onSave,
  onCancel,
}: {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const getXY = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.MouseEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const { x, y } = getXY(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) { ctx.beginPath(); ctx.moveTo(x, y); }
  };

  const move = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const { x, y } = getXY(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const end = () => { drawing.current = false; };

  const clear = () => {
    const c = canvasRef.current;
    if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  };

  const save = () => {
    const dataUrl = canvasRef.current?.toDataURL('image/png') ?? '';
    onSave(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-xl shadow-2xl p-6 w-[480px]">
        <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
          <PenLine className="w-5 h-5 text-primary" />
          Draw Your Signature
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Draw in the box below using your mouse or trackpad.
        </p>

        <canvas
          ref={canvasRef}
          width={432}
          height={180}
          className="w-full border-2 border-dashed border-border rounded-lg bg-white cursor-crosshair touch-none"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
        />

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={clear}
            className="text-sm text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-4 h-4" /> Clear
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary/50 text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Apply Signature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Info edit modal
// ---------------------------------------------------------------------------

function EditInfoModal({
  attrs,
  onSave,
  onCancel,
}: {
  attrs: SignatureBlockAttrs;
  onSave: (updates: Partial<SignatureBlockAttrs>) => void;
  onCancel: () => void;
}) {
  const [label, setLabel]     = useState(attrs.label || 'Authorized Signature');
  const [name, setName]       = useState(attrs.signatoryName || '');
  const [title, setTitle]     = useState(attrs.signatoryTitle || '');
  const [company, setCompany] = useState(attrs.signatoryCompany || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-xl shadow-2xl p-6 w-[400px]">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Signatory Details
        </h3>
        <div className="space-y-3">
          {[
            { label: 'Block label', value: label, set: setLabel, icon: PenLine },
            { label: 'Signatory name', value: name, set: setName, icon: User },
            { label: 'Title / Role', value: title, set: setTitle, icon: Briefcase },
            { label: 'Company', value: company, set: setCompany, icon: Building2 },
          ].map(({ label: lbl, value, set, icon: Icon }) => (
            <div key={lbl}>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                <Icon className="w-3 h-3 inline mr-1" />{lbl}
              </label>
              <input
                value={value}
                onChange={(e) => set(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary/50 text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ label, signatoryName: name, signatoryTitle: title, signatoryCompany: company })}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The node view rendered inside the Tiptap document
// ---------------------------------------------------------------------------

export function SignatureBlockView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const { label, signatoryName, signatoryTitle, signatoryCompany, signatureData, signedAt } = node.attrs;
  const [showPad, setShowPad]   = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const handleSign = useCallback((dataUrl: string) => {
    updateAttributes({ signatureData: dataUrl, signedAt: new Date().toISOString() });
    setShowPad(false);
  }, [updateAttributes]);

  const handleEdit = useCallback((updates: Partial<SignatureBlockAttrs>) => {
    updateAttributes(updates);
    setShowEdit(false);
  }, [updateAttributes]);

  const clearSig = useCallback(() => {
    updateAttributes({ signatureData: null, signedAt: null });
  }, [updateAttributes]);

  return (
    <NodeViewWrapper>
      {/* Signature pad modal */}
      {showPad  && <SignaturePad  onSave={handleSign} onCancel={() => setShowPad(false)} />}
      {showEdit && <EditInfoModal attrs={node.attrs} onSave={handleEdit} onCancel={() => setShowEdit(false)} />}

      {/* The signature block itself — styled to look like a real document signature line */}
      <div
        className={`my-6 select-none print:border-black ${
          selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-white' : ''
        }`}
        contentEditable={false}
      >
        <div className="border border-gray-300 rounded-lg p-5 bg-gray-50 relative group">
          {/* Floating controls (hidden in print) */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
            <button
              onClick={() => setShowEdit(true)}
              title="Edit signatory info"
              className="p-1.5 bg-white border border-gray-200 rounded hover:bg-gray-100 text-gray-600"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={deleteNode}
              title="Remove signature block"
              className="p-1.5 bg-white border border-gray-200 rounded hover:bg-red-50 hover:text-red-500 text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Label */}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            {label || 'Authorized Signature'}
          </p>

          {/* Signature area */}
          <div className="min-h-[72px] border-b-2 border-gray-400 mb-3 relative flex items-end pb-1">
            {signatureData ? (
              <>
                <img
                  src={signatureData}
                  alt="Signature"
                  className="max-h-16 max-w-xs object-contain"
                />
                <button
                  onClick={clearSig}
                  className="absolute bottom-1 right-0 text-xs text-gray-400 hover:text-red-500 print:hidden"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowPad(true)}
                className="mb-1 text-sm text-primary hover:underline print:hidden flex items-center gap-1.5"
              >
                <PenLine className="w-4 h-4" />
                Click to sign
              </button>
            )}
          </div>

          {/* Signatory info */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <div>
              <span className="text-gray-400 text-xs">Name:</span>{' '}
              <span className="text-gray-800 font-medium">{signatoryName || '___________________________'}</span>
            </div>
            <div>
              <span className="text-gray-400 text-xs">Date:</span>{' '}
              <span className="text-gray-800 font-medium">
                {signedAt ? formatDate(new Date(signedAt)) : '_______________'}
              </span>
            </div>
            {signatoryTitle && (
              <div>
                <span className="text-gray-400 text-xs">Title:</span>{' '}
                <span className="text-gray-800">{signatoryTitle}</span>
              </div>
            )}
            {signatoryCompany && (
              <div>
                <span className="text-gray-400 text-xs">Company:</span>{' '}
                <span className="text-gray-800">{signatoryCompany}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
