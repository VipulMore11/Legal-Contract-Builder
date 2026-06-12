import { Extension } from '@tiptap/core';

const INDENT_STEP = 30;
const MAX_INDENT = 240;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

export const Indent = Extension.create({
  name: 'indent',

  addOptions() {
    return {
      types: ['paragraph', 'heading', 'blockquote'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: null,
            parseHTML: (element) => {
              const val = parseInt(element.style.marginLeft, 10);
              return isNaN(val) || val === 0 ? null : val;
            },
            renderHTML: (attributes) => {
              if (!attributes.indent) return {};
              return { style: `margin-left: ${attributes.indent}px` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          const { from, to } = selection;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (this.options.types.includes(node.type.name)) {
              const cur = (node.attrs.indent as number) || 0;
              const next = Math.min(cur + INDENT_STEP, MAX_INDENT);
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
              }
            }
          });
          if (dispatch) dispatch(tr);
          return true;
        },

      outdent:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          const { from, to } = selection;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (this.options.types.includes(node.type.name)) {
              const cur = (node.attrs.indent as number) || 0;
              const next = Math.max(cur - INDENT_STEP, 0);
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  indent: next === 0 ? null : next,
                });
              }
            }
          });
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        // Only indent when not inside a list
        if (this.editor.isActive('listItem')) return false;
        return this.editor.commands.indent();
      },
      'Shift-Tab': () => {
        if (this.editor.isActive('listItem')) return false;
        return this.editor.commands.outdent();
      },
    };
  },
});
