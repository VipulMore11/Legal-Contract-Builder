import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    signatureBlock: {
      insertSignatureBlock: (attrs?: Partial<SignatureBlockAttrs>) => ReturnType;
    };
  }
}

export interface SignatureBlockAttrs {
  label: string;
  signatoryName: string;
  signatoryTitle: string;
  signatoryCompany: string;
  signatureData: string | null;   // base64 PNG
  signedAt: string | null;        // ISO-8601
}

export const SignatureBlock = Node.create({
  name: 'signatureBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      label:            { default: 'Authorized Signature' },
      signatoryName:    { default: '' },
      signatoryTitle:   { default: '' },
      signatoryCompany: { default: '' },
      signatureData:    { default: null },
      signedAt:         { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="signature-block"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'signature-block',
        'data-label': node.attrs.label,
        'data-signatory': node.attrs.signatoryName,
      }),
    ];
  },

  addNodeView() {
    // Loaded lazily so the extension file itself stays SSR-safe
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SignatureBlockView } = require('../signature-block-view');
    return ReactNodeViewRenderer(SignatureBlockView);
  },

  addCommands() {
    return {
      insertSignatureBlock:
        (attrs = {}) =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs });
        },
    };
  },
});
