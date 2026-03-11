import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import './RichTextEditor.css';

function ToolbarButton({ onClick, active, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className={`rte-btn${active ? ' rte-btn--active' : ''}`}
      title={title}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, placeholder }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder || '' }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor]);

  const setLink = () => {
    const url = window.prompt('URL', editor.getAttributes('link').href || '');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  if (!editor) return null;

  return (
    <div className="rte" onClick={(e) => { if (!e.target.closest('button')) editor.commands.focus(); }}>
      <div className="rte-toolbar">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
          <span style={{ textDecoration: 'underline' }}>U</span>
        </ToolbarButton>
        <span className="rte-divider" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          &#8801;
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
          1.
        </ToolbarButton>
        <span className="rte-divider" />
        <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="Link">
          &#x1F517;
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} className="rte-content" />
    </div>
  );
}
