<script setup lang="ts">
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Unlink,
} from '@lucide/vue'
import Link from '@tiptap/extension-link'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import type { Component } from 'vue'

/**
 * Rich-text editor for news bodies (SCREENS §8): tiptap with a toolbar limited to the server's
 * sanitiser allowlist — headings H2/H3, bold, italic, lists, quote, code, links (https/mailto).
 */
const props = defineProps<{ invalid?: boolean; id?: string; describedBy?: string }>()
const model = defineModel<string>({ default: '' })

const editor = useEditor({
  content: model.value,
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      horizontalRule: false,
      strike: false,
      underline: false,
      link: false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      protocols: ['https', 'mailto'],
      defaultProtocol: 'https',
      isAllowedUri: (url) => /^(https:\/\/|mailto:)/i.test(url),
      HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
    }),
  ],
  editorProps: {
    attributes: {
      class: 'news-editor-content',
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-label': 'Article body',
    },
  },
  onUpdate: ({ editor: instance }) => {
    model.value = instance.isEmpty ? '' : instance.getHTML()
  },
})

watch(model, (value) => {
  const instance = editor.value
  if (instance && value !== instance.getHTML() && !(value === '' && instance.isEmpty)) {
    instance.commands.setContent(value, { emitUpdate: false })
  }
})

onBeforeUnmount(() => editor.value?.destroy())

interface Tool {
  label: string
  icon: Component
  active?: () => boolean
  run: () => void
}

const linkOpen = ref(false)
const linkUrl = ref('')
const linkError = ref<string | null>(null)

function openLink() {
  linkUrl.value = (editor.value?.getAttributes('link').href as string | undefined) ?? 'https://'
  linkError.value = null
  linkOpen.value = true
}
function applyLink() {
  const url = linkUrl.value.trim()
  if (!/^(https:\/\/[^\s]+\.[^\s]+|mailto:[^\s@]+@[^\s@]+)$/i.test(url)) {
    linkError.value = 'Use an https:// address or a mailto: link.'
    return
  }
  editor.value?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  linkOpen.value = false
}

const tools = computed<Tool[][]>(() => {
  const e = editor.value
  if (!e) return []
  return [
    [
      {
        label: 'Heading',
        icon: Heading2,
        active: () => e.isActive('heading', { level: 2 }),
        run: () => e.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        label: 'Subheading',
        icon: Heading3,
        active: () => e.isActive('heading', { level: 3 }),
        run: () => e.chain().focus().toggleHeading({ level: 3 }).run(),
      },
    ],
    [
      {
        label: 'Bold',
        icon: Bold,
        active: () => e.isActive('bold'),
        run: () => e.chain().focus().toggleBold().run(),
      },
      {
        label: 'Italic',
        icon: Italic,
        active: () => e.isActive('italic'),
        run: () => e.chain().focus().toggleItalic().run(),
      },
      {
        label: 'Code',
        icon: Code,
        active: () => e.isActive('code'),
        run: () => e.chain().focus().toggleCode().run(),
      },
    ],
    [
      {
        label: 'Bulleted list',
        icon: List,
        active: () => e.isActive('bulletList'),
        run: () => e.chain().focus().toggleBulletList().run(),
      },
      {
        label: 'Numbered list',
        icon: ListOrdered,
        active: () => e.isActive('orderedList'),
        run: () => e.chain().focus().toggleOrderedList().run(),
      },
      {
        label: 'Quote',
        icon: Quote,
        active: () => e.isActive('blockquote'),
        run: () => e.chain().focus().toggleBlockquote().run(),
      },
    ],
    [
      { label: 'Add link', icon: LinkIcon, active: () => e.isActive('link'), run: openLink },
      { label: 'Remove link', icon: Unlink, run: () => e.chain().focus().unsetLink().run() },
    ],
  ]
})
</script>

<template>
  <div
    :id="id"
    class="news-editor rounded-md border bg-sheet transition-[border-color,box-shadow] duration-(--dur-1) focus-within:border-ink focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--focus)_28%,transparent)]"
    :class="props.invalid ? 'border-st-negative' : 'border-field'"
    :aria-describedby="describedBy"
  >
    <div
      role="toolbar"
      aria-label="Formatting"
      class="flex flex-wrap items-center gap-1 border-b border-rule px-1.5 py-1"
    >
      <template v-for="(group, index) in tools" :key="index">
        <span v-if="index > 0" class="mx-1 h-5 w-px bg-rule" aria-hidden="true" />
        <UiIconButton
          v-for="tool in group"
          :key="tool.label"
          :icon="tool.icon"
          :label="tool.label"
          size="sm"
          :aria-pressed="tool.active ? tool.active() : undefined"
          :class="tool.active?.() && 'bg-pressed text-ink'"
          @click="tool.run"
        />
      </template>
    </div>
    <EditorContent :editor="editor" />
    <UiDialog
      v-model:open="linkOpen"
      title="Add a link"
      description="https:// addresses or mailto: links only."
      size="sm"
    >
      <form id="news-link-form" novalidate @submit.prevent="applyLink">
        <UiField label="Address" :error="linkError">
          <UiInput v-model="linkUrl" type="url" placeholder="https://wiki.example.com" />
        </UiField>
      </form>
      <template #footer>
        <UiButton variant="secondary" @click="linkOpen = false">Cancel</UiButton>
        <UiButton variant="primary" type="submit" form="news-link-form">Add link</UiButton>
      </template>
    </UiDialog>
  </div>
</template>

<style scoped>
.news-editor :deep(.news-editor-content) {
  min-height: 260px;
  padding: 14px 16px;
  outline: none;
  font-size: 15px;
  line-height: 24px;
}
.news-editor :deep(.news-editor-content p) {
  margin: 0 0 12px;
}
.news-editor :deep(.news-editor-content h2) {
  margin: 18px 0 8px;
  font-size: 17px;
  font-weight: 650;
}
.news-editor :deep(.news-editor-content h3) {
  margin: 14px 0 6px;
  font-size: 15px;
  font-weight: 650;
}
.news-editor :deep(.news-editor-content ul) {
  list-style: disc;
  padding-left: 22px;
  margin: 0 0 12px;
}
.news-editor :deep(.news-editor-content ol) {
  list-style: decimal;
  padding-left: 22px;
  margin: 0 0 12px;
}
.news-editor :deep(.news-editor-content blockquote) {
  border-left: 1px solid var(--ink);
  padding-left: 14px;
  font-family: var(--face-display);
  font-size: 17px;
}
.news-editor :deep(.news-editor-content code) {
  font-family: var(--face-mono);
  font-size: 0.93em;
}
.news-editor :deep(.news-editor-content a) {
  text-decoration: underline;
  text-decoration-color: var(--rule-strong);
}
</style>
