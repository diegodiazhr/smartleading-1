import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Footer, PageNumber, TableOfContents,
  ShadingType, UnderlineType, LevelFormat,
} from 'docx'

interface TextSegment {
  text: string
  bold?: boolean
  italic?: boolean
  color?: string
  highlight?: string
}

function parseInline(text: string): TextSegment[] {
  const segments: TextSegment[] = []

  // Handle [INFORMACIÓN PENDIENTE: ...] → yellow highlight
  const pendingRe = /(\[INFORMACIÓN PENDIENTE:[^\]]*\])/g
  // Handle **bold**
  const boldRe = /\*\*([^*]+)\*\*/g

  let remaining = text
  const tokens: Array<{ type: 'pending' | 'bold' | 'text'; text: string }> = []

  // Tokenize pending first, then bold within normal text
  const parts = remaining.split(pendingRe)
  for (const part of parts) {
    if (part.startsWith('[INFORMACIÓN PENDIENTE:')) {
      tokens.push({ type: 'pending', text: part })
    } else {
      // Split by bold within this part
      const boldParts = part.split(boldRe)
      let isBoldCapture = false
      for (const bp of boldParts) {
        if (isBoldCapture) {
          tokens.push({ type: 'bold', text: bp })
        } else if (bp) {
          tokens.push({ type: 'text', text: bp })
        }
        isBoldCapture = !isBoldCapture
      }
    }
  }

  for (const token of tokens) {
    if (token.type === 'pending') {
      segments.push({ text: token.text, italic: true, color: 'C05000', highlight: 'yellow' })
    } else if (token.type === 'bold') {
      segments.push({ text: token.text, bold: true })
    } else {
      segments.push({ text: token.text })
    }
  }

  return segments.filter(s => s.text.length > 0)
}

function toRuns(text: string, baseSize = 22): TextRun[] {
  const segs = parseInline(text)
  return segs.map(s => new TextRun({
    text: s.text,
    bold: s.bold,
    italics: s.italic,
    color: s.color ?? '1A1A1A',
    size: baseSize,
    font: 'Calibri',
    ...(s.highlight === 'yellow' ? {
      shading: { type: ShadingType.CLEAR, fill: 'FFF3CD' },
    } : {}),
  }))
}

function parseMarkdownToDocx(markdown: string, companyName: string, docName: string): Paragraph[] {
  const children: Paragraph[] = []

  // ── Cover page ──────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({
        text: companyName.toUpperCase(),
        bold: true, size: 32, font: 'Calibri', color: '1E3A5F',
        characterSpacing: 50,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 1440, after: 160 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '─'.repeat(40), color: 'CBD5E1', size: 18, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
    new Paragraph({
      children: [new TextRun({ text: docName, bold: true, size: 40, font: 'Calibri', color: '111827' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
        size: 20, color: '6B7280', font: 'Calibri',
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 2880 },
    }),
  )

  const lines = markdown.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('# ')) {
      children.push(new Paragraph({
        children: [new TextRun({
          text: trimmed.slice(2), bold: true,
          size: 34, font: 'Calibri', color: '1E3A5F',
        })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 480, after: 200 },
        border: {
          bottom: { style: 'single', size: 6, color: '1E3A5F', space: 4 },
        },
      }))
    } else if (trimmed.startsWith('## ')) {
      children.push(new Paragraph({
        children: [new TextRun({
          text: trimmed.slice(3), bold: true,
          size: 28, font: 'Calibri', color: '2D5A8E',
        })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: 160 },
        border: {
          bottom: { style: 'single', size: 4, color: 'CBD5E1', space: 2 },
        },
      }))
    } else if (trimmed.startsWith('### ')) {
      children.push(new Paragraph({
        children: [new TextRun({
          text: trimmed.slice(4), bold: true,
          size: 24, font: 'Calibri', color: '374151',
        })],
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 240, after: 100 },
      }))
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: '•  ', bold: true, color: '2D5A8E', size: 22, font: 'Calibri' }),
          ...toRuns(trimmed.slice(2)),
        ],
        spacing: { after: 80 },
        indent: { left: 360 },
      }))
    } else if (trimmed.match(/^\d+\.\s/)) {
      // Numbered list
      const content = trimmed.replace(/^\d+\.\s/, '')
      const num = trimmed.match(/^(\d+)/)?.[1] ?? ''
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${num}.  `, bold: true, color: '2D5A8E', size: 22, font: 'Calibri' }),
          ...toRuns(content),
        ],
        spacing: { after: 80 },
        indent: { left: 360 },
      }))
    } else if (trimmed === '---') {
      children.push(new Paragraph({
        children: [new TextRun({ text: '' })],
        border: {
          bottom: { style: 'single', size: 4, color: 'E5E7EB', space: 2 },
        },
        spacing: { before: 200, after: 200 },
      }))
    } else if (trimmed === '') {
      children.push(new Paragraph({
        children: [new TextRun({ text: '' })],
        spacing: { after: 100 },
      }))
    } else {
      const runs = toRuns(trimmed)
      if (runs.length > 0) {
        children.push(new Paragraph({
          children: runs,
          spacing: { after: 120 },
          alignment: AlignmentType.JUSTIFIED,
        }))
      }
    }
  }

  return children
}

export async function generateDocx(
  markdownContent: string,
  documentName: string,
  companyName: string,
): Promise<Blob> {
  const paragraphs = parseMarkdownToDocx(markdownContent, companyName, documentName)

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22, color: '1A1A1A' } },
        heading1: { run: { font: 'Calibri', size: 34, bold: true, color: '1E3A5F' } },
        heading2: { run: { font: 'Calibri', size: 28, bold: true, color: '2D5A8E' } },
        heading3: { run: { font: 'Calibri', size: 24, bold: true, color: '374151' } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1584, right: 1134 },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: companyName, size: 16, color: '9CA3AF', font: 'Calibri' }),
                new TextRun({ text: '  ·  ', size: 16, color: 'D1D5DB', font: 'Calibri' }),
                new TextRun({ text: documentName, size: 16, color: '9CA3AF', font: 'Calibri' }),
                new TextRun({ text: '  ·  Página ', size: 16, color: '9CA3AF', font: 'Calibri' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '6B7280', font: 'Calibri' }),
                new TextRun({ text: ' de ', size: 16, color: '9CA3AF', font: 'Calibri' }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '6B7280', font: 'Calibri' }),
              ],
              alignment: AlignmentType.CENTER,
              border: {
                top: { style: 'single', size: 4, color: 'E5E7EB', space: 4 },
              },
            }),
          ],
        }),
      },
      children: paragraphs,
    }],
  })

  const buffer = await Packer.toBase64String(doc)
  const binary = atob(buffer)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}
