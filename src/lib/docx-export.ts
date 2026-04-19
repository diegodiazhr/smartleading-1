import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType,
} from 'docx'

function parseMarkdownToDocx(markdown: string, companyName: string, docName: string) {
  const children: Paragraph[] = []

  // Cover header
  children.push(
    new Paragraph({
      children: [new TextRun({ text: companyName, bold: true, size: 28, color: '3730A3' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: docName, bold: true, size: 24 })],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '' })],
      spacing: { after: 400 },
    }),
  )

  const lines = markdown.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('## ')) {
      children.push(new Paragraph({
        text: trimmed.slice(3),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 120 },
      }))
    } else if (trimmed.startsWith('# ')) {
      children.push(new Paragraph({
        text: trimmed.slice(2),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 160 },
      }))
    } else if (trimmed.startsWith('### ')) {
      children.push(new Paragraph({
        text: trimmed.slice(4),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 80 },
      }))
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed.slice(2) })],
        bullet: { level: 0 },
        spacing: { after: 60 },
      }))
    } else if (trimmed === '' || trimmed === '---') {
      children.push(new Paragraph({ text: '', spacing: { after: 120 } }))
    } else {
      // Parse inline bold (**text**)
      const runs: TextRun[] = []
      const parts = trimmed.split(/(\*\*[^*]+\*\*)/)
      for (const part of parts) {
        if (part.startsWith('**') && part.endsWith('**')) {
          runs.push(new TextRun({ text: part.slice(2, -2), bold: true }))
        } else if (part) {
          runs.push(new TextRun({ text: part }))
        }
      }
      if (runs.length > 0) {
        children.push(new Paragraph({ children: runs, spacing: { after: 80 } }))
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
        document: {
          run: { font: 'Calibri', size: 22 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
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
