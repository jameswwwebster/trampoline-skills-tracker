import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Toast from './Toast';
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

export default function RichTextEditor({ value, onChange, placeholder, onImageUpload }) {
  const fileInputRef = React.useRef(null);
  const [linkInput, setLinkInput] = useState(null); // null = closed, string = current url value
  const [uploadError, setUploadError] = useState(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder || '' }),
      Image,
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor]);

  const openLinkInput = () => {
    setLinkInput(editor.getAttributes('link').href || '');
  };

  const applyLink = (url) => {
    setLinkInput(null);
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  if (!editor) return null;

  return (
    <div className="rte" onClick={(e) => { if (!e.target.closest('button') && !e.target.closest('input')) editor.commands.focus(); }}>
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
        <ToolbarButton onClick={openLinkInput} active={editor.isActive('link')} title="Link">
          &#x1F517;
        </ToolbarButton>
        {onImageUpload && (
          <>
            <span className="rte-divider" />
            <ToolbarButton onClick={() => fileInputRef.current.click()} title="Insert image">
              🖼
            </ToolbarButton>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                e.target.value = '';
                try {
                  const url = await onImageUpload(file);
                  editor.chain().focus().setImage({ src: url }).run();
                } catch (err) {
                  setUploadError(err.response?.data?.error || err.message || 'Image upload failed');
                }
              }}
            />
          </>
        )}
      </div>
      {linkInput !== null && (
        <div style={{ display: 'flex', gap: '0.4rem', padding: '0.4rem', borderTop: '1px solid #e0e0e0', background: '#f9f9f9', alignItems: 'center' }}>
          <input
            autoFocus
            className="rte-link-input"
            type="url"
            placeholder="https://"
            value={linkInput}
            onChange={e => setLinkInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); applyLink(linkInput); }
              if (e.key === 'Escape') setLinkInput(null);
            }}
            style={{ flex: 1, fontSize: '0.85rem', padding: '0.25rem 0.4rem', border: '1px solid #ccc', borderRadius: 4 }}
          />
          <button type="button" className="rte-btn" onMouseDown={e => { e.preventDefault(); applyLink(linkInput); }} style={{ fontSize: '0.8rem' }}>Apply</button>
          <button type="button" className="rte-btn" onMouseDown={e => { e.preventDefault(); setLinkInput(null); }} style={{ fontSize: '0.8rem' }}>Cancel</button>
        </div>
      )}
      <EditorContent editor={editor} className="rte-content" />
      {uploadError && <Toast message={uploadError} type="error" onDismiss={() => setUploadError(null)} />}
    </div>
  );
}
